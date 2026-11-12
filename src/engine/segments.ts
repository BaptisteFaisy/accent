import type { CodePhoneme, EtatDiagnostic } from '../types';

/**
 * RF-21 — mode « oral long » : découpage d'un texte en phrases et suivi.
 *
 * Logique PURE (aucun DOM, aucun réseau) : c'est le cœur testable du mode.
 * La promesse produit tient ici : on travaille toujours UNE phrase à la fois,
 * donc le bilan final est une liste phrase par phrase — jamais une moyenne,
 * jamais un score global (garde-fou §10).
 */

/** Abréviations dont le point ne termine pas une phrase. */
const ABREVIATIONS = new Set([
  'm', 'mm', 'mme', 'mmes', 'mlle', 'mr', 'mrs', 'ms', 'dr', 'pr', 'st', 'ste',
  'etc', 'p', 'pp', 'n', 'vol', 'jr', 'sr', 'av', 'auj', 'cf', 'ex',
]);

/** Plafond de phrases par session : au-delà, la séance n'est plus guidable. */
export const MAX_SEGMENTS = 40;

/**
 * En dessous de ce seuil, un segment est un fragment (« Oui. », « Non ! ») : on
 * le rattache à la phrase précédente plutôt que d'en faire une étape. Seuil à 2
 * et non 3 : « Je viens. » est une phrase légitime, pas un fragment.
 */
const MIN_MOTS = 2;

function mots(texte: string): string[] {
  return texte.split(/\s+/).filter((m) => m.length > 0);
}

function normaliser(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(' ');
}

/** Le point courant termine-t-il vraiment une phrase ? */
function estFinDePhrase(texte: string, i: number): boolean {
  const c = texte[i];
  if (c !== '.' && c !== '!' && c !== '?' && c !== '…') return false;
  const suivant = texte[i + 1];
  if (suivant !== undefined && !/\s/.test(suivant)) return false; // 3.14, M.Dupont
  if (c === '.') {
    // Mot précédent : une abréviation ne coupe pas.
    let j = i - 1;
    while (j >= 0 && /[\p{L}]/u.test(texte[j])) j -= 1;
    const mot = texte.slice(j + 1, i).toLowerCase();
    if (ABREVIATIONS.has(mot)) return false;
    // Un chiffre avant le point = décimale.
    if (/\d/.test(texte[j] ?? '')) return false;
  }
  return true;
}

/**
 * Découpe un texte en phrases. Les fragments (< MIN_MOTS) sont rattachés à la
 * phrase précédente plutôt que supprimés : on ne perd jamais du texte de l'élève.
 * Au-delà de MAX_SEGMENTS, le reste est regroupé dans le dernier segment.
 */
export function decouper(texte: string): string[] {
  const propre = normaliser(texte);
  if (propre.length === 0) return [];

  const bruts: string[] = [];
  let debut = 0;
  for (let i = 0; i < propre.length; i += 1) {
    if (!estFinDePhrase(propre, i)) continue;
    bruts.push(propre.slice(debut, i + 1).trim());
    debut = i + 1;
  }
  const reste = propre.slice(debut).trim();
  if (reste.length > 0) bruts.push(reste);

  // Rattache les fragments à la phrase précédente.
  const fusionnes: string[] = [];
  for (const b of bruts) {
    if (mots(b).length < MIN_MOTS && fusionnes.length > 0) {
      fusionnes[fusionnes.length - 1] = `${fusionnes[fusionnes.length - 1]} ${b}`.trim();
    } else {
      fusionnes.push(b);
    }
  }

  if (fusionnes.length <= MAX_SEGMENTS) return fusionnes;
  const gardes = fusionnes.slice(0, MAX_SEGMENTS - 1);
  gardes.push(fusionnes.slice(MAX_SEGMENTS - 1).join(' '));
  return gardes;
}

export type EtatSegment = 'a_faire' | 'en_cours' | 'fait' | 'saute';

export interface SegmentSuivi {
  index: number;
  texte: string;
  etat: EtatSegment;
}

/** Fil d'Ariane : où en est l'élève dans son texte. */
export function etatAvancement(
  segments: string[],
  indexCourant: number,
  faits: Record<number, EtatSegment> = {},
): SegmentSuivi[] {
  return segments.map((texte, index) => ({
    index,
    texte,
    etat: faits[index] ?? (index === indexCourant ? 'en_cours' : 'a_faire'),
  }));
}

/** Résultat d'une phrase travaillée — ce que le bilan final aligne. */
export interface ResultatPhrase {
  index: number;
  texte: string;
  cible: CodePhoneme | null;
  score: number | null;
  etat: EtatDiagnostic;
}

export interface BilanOral {
  phrases: ResultatPhrase[];
  /** Sons revenus sur plusieurs phrases distinctes : le profil, pas une note. */
  sonsRecurrents: Array<{ code: CodePhoneme; fois: number }>;
  faites: number;
  sautees: number;
  sansErreur: number;
}

/**
 * Bilan phrase par phrase. Aucun agrégat de score : on compte des phrases et on
 * liste les sons qui reviennent. `type BilanOral` n'a volontairement aucun champ
 * `score`, `moyenne` ou `pourcentage` global.
 */
export function bilanParPhrase(
  resultats: ResultatPhrase[],
  seuilRecurrence = 2,
): BilanOral {
  const compte = new Map<CodePhoneme, Set<number>>();
  for (const r of resultats) {
    if (!r.cible) continue;
    const vus = compte.get(r.cible) ?? new Set<number>();
    vus.add(r.index);
    compte.set(r.cible, vus);
  }
  return {
    phrases: resultats,
    sonsRecurrents: [...compte.entries()]
      .map(([code, indexes]) => ({ code, fois: indexes.size }))
      .filter((x) => x.fois >= seuilRecurrence)
      .sort((a, b) => b.fois - a.fois || a.code.localeCompare(b.code)),
    faites: resultats.filter((r) => r.etat !== 'erreur').length,
    sautees: resultats.filter((r) => r.etat === 'erreur').length,
    sansErreur: resultats.filter((r) => r.etat === 'rien_a_corriger').length,
  };
}

/** Prochaine phrase à faire : la première non traitée, sinon null. */
export function prochainePhrase(
  segments: string[],
  faits: Record<number, EtatSegment>,
): number | null {
  for (let i = 0; i < segments.length; i += 1) {
    if (!faits[i]) return i;
  }
  return null;
}
