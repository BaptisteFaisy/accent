import { describe, expect, it } from 'vitest';
import { fournisseurDemo, phonemesAttendus } from '../src/providers/demo';
import { encoderWav } from '../src/audio/wav';
import { TAUX_ECHANTILLONNAGE } from '../src/constants';

/**
 * Le moteur de démonstration doit rester CRÉDIBLE à l'écran : un mot d'une
 * lettre ne peut pas être « le son à travailler » (bug vu en démo navigateur :
 * « /θ/ dans i »).
 */

function tone(ms: number, f = 220): ArrayBuffer {
  const n = Math.round((TAUX_ECHANTILLONNAGE * ms) / 1000);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i += 1) pcm[i] = 0.4 * Math.sin((2 * Math.PI * f * i) / TAUX_ECHANTILLONNAGE);
  return encoderWav(pcm, TAUX_ECHANTILLONNAGE);
}

describe('lexique du moteur de démo', () => {
  it('ne cible jamais un mot de moins de 4 lettres par sous-chaîne', () => {
    const attendus = phonemesAttendus('I think this is the right thing.');
    for (const a of attendus) expect(a.mot.length, a.mot).toBeGreaterThanOrEqual(4);
  });

  it('rattache les mots porteurs connus', () => {
    const codes = phonemesAttendus('I think this is the right thing.').map((a) => a.mot);
    expect(codes).toContain('think');
    expect(codes).toContain('this');
    expect(codes).toContain('right');
  });

  it('les index de mots suivent la phrase', () => {
    const attendus = phonemesAttendus('the ship is big');
    const ship = attendus.find((a) => a.mot === 'ship');
    expect(ship?.index).toBe(1);
  });
});

describe('analyse de démonstration', () => {
  it('signale simule:true et renvoie des scores bornés', async () => {
    const sortie = await fournisseurDemo.analyse({
      audio: tone(2500),
      texte: 'I think this is the right thing.',
      langueCible: 'en',
    });
    expect(sortie.simule).toBe(true);
    expect(sortie.provider).toBe('demo-local');
    expect(sortie.scores.length).toBeGreaterThan(0);
    for (const s of sortie.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.mot.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('le score bouge quand l’audio bouge (before/after filmable)', async () => {
    const a = await fournisseurDemo.analyse({ audio: tone(2500, 180), texte: 'think', langueCible: 'en' });
    const b = await fournisseurDemo.analyse({ audio: tone(2500, 3200), texte: 'think', langueCible: 'en' });
    expect(a.scores[0].score).not.toBe(b.scores[0].score);
  });

  it('audio vide : aucun score, aucune exception', async () => {
    const sortie = await fournisseurDemo.analyse({
      audio: encoderWav(new Float32Array(0), TAUX_ECHANTILLONNAGE),
      texte: 'think',
      langueCible: 'en',
    });
    expect(sortie.scores).toEqual([]);
  });
});
