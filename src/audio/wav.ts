import { TAUX_ECHANTILLONNAGE } from '../constants';

/**
 * Audio : encodage WAV 16 bits mono et ré-échantillonnage vers 16 kHz.
 * Les API d'évaluation de prononciation attendent du PCM mono 16 kHz : on ne
 * leur envoie jamais le format brut du MediaRecorder (webm/mp4, 48 kHz).
 */

export function encoderWav(echantillons: Float32Array, taux: number): ArrayBuffer {
  const n = echantillons.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const texte = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  texte(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, taux, true);
  view.setUint32(28, taux * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  texte(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-1, Math.min(1, echantillons[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return buf;
}

/** Ré-échantillonnage linéaire : suffisant pour de la voix, zéro dépendance. */
export function reechantillonner(
  echantillons: Float32Array,
  tauxSource: number,
  tauxCible = TAUX_ECHANTILLONNAGE,
): Float32Array {
  if (tauxSource === tauxCible || tauxSource <= 0) return echantillons;
  const ratio = tauxSource / tauxCible;
  const n = Math.floor(echantillons.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, echantillons.length - 1);
    const frac = pos - i0;
    out[i] = echantillons[i0] * (1 - frac) + echantillons[i1] * frac;
  }
  return out;
}

/** Mixe tous les canaux en mono (moyenne), puis ré-échantillonne à 16 kHz. */
export function versMono16k(buffer: AudioBuffer): Float32Array {
  const n = buffer.length;
  const mono = new Float32Array(n);
  const canaux = buffer.numberOfChannels;
  for (let c = 0; c < canaux; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < n; i += 1) mono[i] += data[i] / canaux;
  }
  return reechantillonner(mono, buffer.sampleRate);
}

/** Décode un blob MediaRecorder en PCM mono 16 kHz (Web Audio, natif). */
export async function decoderVersMono16k(blob: Blob): Promise<Float32Array> {
  const array = await blob.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(array.slice(0));
    return versMono16k(buffer);
  } finally {
    void ctx.close();
  }
}

/** ArrayBuffer → Float32Array (WAV 16 bits mono), pour les tests et le replay. */
export function decoderWav16(buf: ArrayBuffer): Float32Array {
  const view = new DataView(buf);
  const debut = 44;
  const n = Math.max(0, Math.floor((buf.byteLength - debut) / 2));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = view.getInt16(debut + i * 2, true) / 0x8000;
  return out;
}
