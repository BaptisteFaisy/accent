import { describe, expect, it } from 'vitest';
import { decoderWav16, encoderWav, reechantillonner, versMono16k } from '../src/audio/wav';
import {
  analyserQualite,
  motsDe,
  pic,
  repartirSurLesMots,
  rms,
  segmentsVoix,
  tauxSaturation,
  verdictQualite,
} from '../src/audio/quality';
import { DUREE_MIN_MS, RMS_SILENCE, TAUX_ECHANTILLONNAGE } from '../src/constants';
import type { ScorePhoneme } from '../src/types';

/**
 * Chaîne audio sous tests — ACCENT.md §18.4 : la mesure est bruitée, donc tout
 * ce qui précède l'évaluation (format, durée, silence, saturation, segmentation)
 * doit être déterministe et vérifié. Aucun micro, aucun réseau, aucun timer.
 */

const T = TAUX_ECHANTILLONNAGE;

/** Signal synthétique : sinusoïde d'amplitude `amp` et de fréquence `f`. */
function sinus(ms: number, f = 220, amp = 0.5, taux = T): Float32Array {
  const n = Math.round((taux * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = amp * Math.sin((2 * Math.PI * f * i) / taux);
  return out;
}

function silence(ms: number, taux = T): Float32Array {
  return new Float32Array(Math.round((taux * ms) / 1000));
}

/** Concatène plusieurs signaux. */
function coller(...signaux: Float32Array[]): Float32Array {
  const n = signaux.reduce((a, s) => a + s.length, 0);
  const out = new Float32Array(n);
  let k = 0;
  for (const s of signaux) {
    out.set(s, k);
    k += s.length;
  }
  return out;
}

describe('encoderWav — en-tête RIFF/WAVE', () => {
  const pcm = sinus(50);
  const buf = encoderWav(pcm, T);
  const view = new DataView(buf);
  const texte = (off: number, n: number) =>
    Array.from({ length: n }, (_, i) => String.fromCharCode(view.getUint8(off + i))).join('');

  it('écrit les marqueurs RIFF, WAVE, fmt et data', () => {
    expect(texte(0, 4)).toBe('RIFF');
    expect(texte(8, 4)).toBe('WAVE');
    expect(texte(12, 4)).toBe('fmt ');
    expect(texte(36, 4)).toBe('data');
  });

  it('déclare PCM 16 bits mono au taux demandé', () => {
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(T);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('longueur = 44 octets d’en-tête + 2 octets par échantillon', () => {
    expect(buf.byteLength).toBe(44 + pcm.length * 2);
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
    expect(view.getUint32(4, true)).toBe(36 + pcm.length * 2);
  });

  it('un signal vide produit un WAV d’en-tête seul, sans exception', () => {
    expect(encoderWav(new Float32Array(0), T).byteLength).toBe(44);
  });
});

describe('aller-retour WAV 16 bits', () => {
  it('retrouve le signal à 1e-3 près', () => {
    const pcm = sinus(200, 300, 0.7);
    const retour = decoderWav16(encoderWav(pcm, T));
    expect(retour.length).toBe(pcm.length);
    let max = 0;
    for (let i = 0; i < pcm.length; i += 1) max = Math.max(max, Math.abs(pcm[i] - retour[i]));
    expect(max).toBeLessThan(1e-3);
  });

  it('écrête au-delà de [-1, 1] au lieu de déborder', () => {
    const fort = new Float32Array([2, -3, 0.5]);
    const retour = decoderWav16(encoderWav(fort, T));
    expect(retour[0]).toBeCloseTo(1, 3);
    expect(retour[1]).toBeCloseTo(-1, 3);
    expect(retour[2]).toBeCloseTo(0.5, 3);
  });
});

describe('reechantillonneur', () => {
  it('48 kHz → 16 kHz divise la longueur par trois', () => {
    const src = sinus(300, 440, 0.4, 48000);
    const out = reechantillonner(src, 48000, 16000);
    expect(out.length).toBe(Math.floor(src.length / 3));
  });

  it('identité si le taux est déjà le bon', () => {
    const src = sinus(100);
    expect(reechantillonner(src, T, T)).toBe(src);
  });

  it('conserve l’amplitude d’une sinusoïde lente', () => {
    const out = reechantillonner(sinus(400, 120, 0.8, 48000), 48000, 16000);
    let max = 0;
    for (let i = 0; i < out.length; i += 1) max = Math.max(max, Math.abs(out[i]));
    expect(max).toBeGreaterThan(0.7);
    expect(max).toBeLessThanOrEqual(0.81);
  });

  it('ne casse pas sur un signal vide ni sur un taux nul', () => {
    expect(reechantillonner(new Float32Array(0), 48000, 16000).length).toBe(0);
    expect(reechantillonner(sinus(10), 0, 16000).length).toBeGreaterThan(0);
  });
});

describe('versMono16k — mixage des canaux', () => {
  /** jsdom ne fournit pas AudioBuffer : on imite l'interface minimale. */
  function fauxBuffer(canaux: Float32Array[], taux: number): AudioBuffer {
    return {
      length: canaux[0].length,
      numberOfChannels: canaux.length,
      sampleRate: taux,
      duration: canaux[0].length / taux,
      getChannelData: (i: number) => canaux[i],
    } as unknown as AudioBuffer;
  }

  it('moyenne deux canaux puis rééchantillonne', () => {
    const g = new Float32Array(4800).fill(0.6);
    const d = new Float32Array(4800).fill(0.2);
    const out = versMono16k(fauxBuffer([g, d], 48000));
    expect(out.length).toBe(1600);
    expect(out[800]).toBeCloseTo(0.4, 2);
  });

  it('mono inchangé en amplitude', () => {
    const m = new Float32Array(1600).fill(-0.25);
    expect(versMono16k(fauxBuffer([m], 16000))[0]).toBeCloseTo(-0.25, 5);
  });
});

describe('mesures de niveau', () => {
  it('rms du silence = 0, rms d’un créneau = amplitude', () => {
    expect(rms(silence(100))).toBe(0);
    expect(rms(new Float32Array(100).fill(0.5))).toBeCloseTo(0.5, 5);
  });

  it('pic = valeur absolue maximale', () => {
    expect(pic(new Float32Array([0.1, -0.9, 0.4]))).toBeCloseTo(0.9, 5);
    expect(pic(new Float32Array(0))).toBe(0);
  });

  it('tauxSaturation compte les échantillons au-delà du seuil', () => {
    const s = new Float32Array([1, 0.99, 0.5, -1]);
    expect(tauxSaturation(s)).toBeCloseTo(0.75, 5);
    expect(tauxSaturation(new Float32Array(0))).toBe(0);
  });
});

describe('analyserQualite — les trois refus du produit (§18.4)', () => {
  it('trop court sous 1,5 s', () => {
    const q = analyserQualite(sinus(900, 220, 0.4), T);
    expect(q.dureeMs).toBeLessThan(DUREE_MIN_MS);
    expect(q.tropCourt).toBe(true);
    expect(q.silence).toBe(false);
  });

  it('silence détecté sous le seuil RMS', () => {
    const q = analyserQualite(silence(2000), T);
    expect(q.silence).toBe(true);
    expect(q.rms).toBeLessThan(RMS_SILENCE);
  });

  it('saturation détectée au-delà de 2 % d’échantillons écrêtés', () => {
    const sature = new Float32Array(T * 2).fill(1);
    const q = analyserQualite(sature, T);
    expect(q.sature).toBe(true);
    expect(q.tauxSaturation).toBe(1);
  });

  it('audio nominal : aucun refus', () => {
    const q = analyserQualite(sinus(2500, 220, 0.35), T);
    expect(q.tropCourt).toBe(false);
    expect(q.silence).toBe(false);
    expect(q.sature).toBe(false);
    expect(q.dureeMs).toBe(2500);
  });

  it('signal vide : durée 0, aucun plantage', () => {
    const q = analyserQualite(new Float32Array(0), T);
    expect(q.dureeMs).toBe(0);
    expect(q.tropCourt).toBe(true);
  });
});

describe('verdictQualite — ordre de priorité des messages', () => {
  it('trop court passe avant silence', () => {
    const v = verdictQualite(analyserQualite(silence(500), T));
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/Trop court/);
  });

  it('silence expliqué sans culpabiliser', () => {
    const v = verdictQualite(analyserQualite(silence(2000), T));
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/n’entends rien/);
  });

  it('saturation → consigne de distance', () => {
    const v = verdictQualite(analyserQualite(new Float32Array(T * 2).fill(1), T));
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/Trop fort/);
  });

  it('audio exploitable', () => {
    expect(verdictQualite(analyserQualite(sinus(2000, 220, 0.3), T)).ok).toBe(true);
  });
});

describe('segmentsVoix — découpage par silence', () => {
  it('retrouve deux zones sonores séparées par un silence', () => {
    const s = coller(silence(200), sinus(300, 200, 0.6), silence(300), sinus(300, 200, 0.6));
    const seg = segmentsVoix(s, T, 90);
    expect(seg.length).toBe(2);
    for (const [a, b] of seg) {
      expect(b).toBeGreaterThan(a);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(s.length);
    }
  });

  it('silence total → aucun segment', () => {
    expect(segmentsVoix(silence(1000), T, 90)).toHaveLength(0);
  });

  it('signal continu → un seul segment couvrant tout', () => {
    const s = sinus(600, 200, 0.6);
    const seg = segmentsVoix(s, T, 90);
    expect(seg).toHaveLength(1);
    expect(seg[0][1]).toBe(s.length);
  });

  it('signal vide → aucun segment, aucune exception', () => {
    expect(segmentsVoix(new Float32Array(0), T, 90)).toHaveLength(0);
  });
});

describe('mots de la phrase et répartition des scores', () => {
  it('ignore la ponctuation et garde les apostrophes', () => {
    expect(motsDe('I think this is the right thing.')).toEqual([
      'i', 'think', 'this', 'is', 'the', 'right', 'thing',
    ]);
    expect(motsDe("Don't stop")).toEqual(["don't", 'stop']);
  });

  it('phrase vide → aucun mot', () => {
    expect(motsDe('   ')).toEqual([]);
  });

  it('répartit les scores sur les mots quand le fournisseur ne les nomme pas', () => {
    const bruts: ScorePhoneme[] = [
      { code: 'P01', ipa: 'θ', mot: '', indexMot: -1, score: 30 },
      { code: 'P02', ipa: 'ð', mot: '', indexMot: -1, score: 40 },
    ];
    const out = repartirSurLesMots('I think this', bruts);
    expect(out[0].mot).toBe('i');
    expect(out[0].indexMot).toBe(0);
    expect(out[1].mot).toBe('think');
    expect(out[1].indexMot).toBe(1);
  });

  it('conserve le mot déjà nommé par le fournisseur', () => {
    const out = repartirSurLesMots('I think', [
      { code: 'P01', ipa: 'θ', mot: 'think', indexMot: 1, score: 30 },
    ]);
    expect(out[0].mot).toBe('think');
    expect(out[0].indexMot).toBe(1);
  });

  it('ne divise jamais par zéro sur une phrase vide', () => {
    const out = repartirSurLesMots('', [{ code: 'P01', ipa: 'θ', mot: '', indexMot: -1, score: 5 }]);
    expect(out).toHaveLength(1);
    expect(Number.isFinite(out[0].indexMot)).toBe(true);
  });
});
