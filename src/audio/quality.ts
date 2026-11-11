import type { ScorePhoneme } from '../types';
import { DUREE_MIN_MS, RMS_SILENCE } from '../constants';

/**
 * Contrôle qualité avant évaluation — ACCENT.md §18.4 et §24 (bruit ambiant).
 * Fonctions pures sur des échantillons : testables sans microphone.
 */

export interface QualiteAudio {
  dureeMs: number;
  rms: number;
  pic: number;
  tropCourt: boolean;
  silence: boolean;
  sature: boolean;
  /** Proportion d'échantillons au-dessus du seuil de saturation. */
  tauxSaturation: number;
}

export function rms(echantillons: Float32Array): number {
  if (echantillons.length === 0) return 0;
  let somme = 0;
  for (let i = 0; i < echantillons.length; i += 1) somme += echantillons[i] * echantillons[i];
  return Math.sqrt(somme / echantillons.length);
}

export function pic(echantillons: Float32Array): number {
  let max = 0;
  for (let i = 0; i < echantillons.length; i += 1) {
    const v = Math.abs(echantillons[i]);
    if (v > max) max = v;
  }
  return max;
}

export function tauxSaturation(echantillons: Float32Array, seuil = 0.985): number {
  if (echantillons.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < echantillons.length; i += 1) if (Math.abs(echantillons[i]) >= seuil) n += 1;
  return n / echantillons.length;
}

export function analyserQualite(echantillons: Float32Array, taux: number): QualiteAudio {
  const dureeMs = taux > 0 ? Math.round((echantillons.length / taux) * 1000) : 0;
  const niveau = rms(echantillons);
  const sat = tauxSaturation(echantillons);
  return {
    dureeMs,
    rms: niveau,
    pic: pic(echantillons),
    tropCourt: dureeMs < DUREE_MIN_MS,
    silence: niveau < RMS_SILENCE,
    sature: sat > 0.02,
    tauxSaturation: sat,
  };
}

/** Verdict lisible, dans le ton du produit : on explique, on ne culpabilise pas. */
export function verdictQualite(q: QualiteAudio): { ok: boolean; message: string } {
  if (q.tropCourt) return { ok: false, message: 'Trop court : lis la phrase en entier, puis réessaie.' };
  if (q.silence) return { ok: false, message: 'Je n’entends rien. Vérifie le micro et réessaie.' };
  if (q.sature) return { ok: false, message: 'Trop fort : éloigne un peu le téléphone et réessaie.' };
  return { ok: true, message: 'Audio exploitable.' };
}

/** Segmente grossièrement en zones sonores séparées par des silences. */
export function segmentsVoix(echantillons: Float32Array, taux: number, minMs = 90): Array<[number, number]> {
  const fenetre = Math.max(1, Math.round((taux * minMs) / 1000));
  const seuil = Math.max(RMS_SILENCE, rms(echantillons) * 0.35);
  const segments: Array<[number, number]> = [];
  let debut = -1;
  for (let i = 0; i < echantillons.length; i += fenetre) {
    const fin = Math.min(i + fenetre, echantillons.length);
    let actif = false;
    for (let j = i; j < fin; j += 1) if (Math.abs(echantillons[j]) > seuil) { actif = true; break; }
    if (actif && debut < 0) debut = i;
    if (!actif && debut >= 0) { segments.push([debut, i]); debut = -1; }
  }
  if (debut >= 0) segments.push([debut, echantillons.length]);
  return segments;
}

/** Comptage de mots attendu : sert à répartir les scores sur la phrase. */
export function motsDe(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[^a-z'’-]+/)
    .filter((m) => m.length > 0);
}

/** Scores d'un fournisseur sans détail par mot : répartition uniforme. */
export function repartirSurLesMots(phrase: string, scores: ScorePhoneme[]): ScorePhoneme[] {
  const mots = motsDe(phrase);
  return scores.map((s, i) => ({
    ...s,
    mot: s.mot || mots[i % Math.max(1, mots.length)] || '',
    indexMot: s.indexMot >= 0 ? s.indexMot : i % Math.max(1, mots.length),
  }));
}
