import type { CodePhoneme, Mesure, ScorePhoneme } from '../types';
import { ECART_MAX } from '../constants';

/**
 * Fiabilité de la mesure — ACCENT.md §18.4.
 *
 * Mesurer un phonème sur un mot court est bruité : on ne conclut jamais sur une
 * seule lecture. Trois lectures → médiane ; écart trop grand → on refuse
 * d'afficher un chiffre (« mesure instable, réessaie ») plutôt que de mentir.
 */

export interface MesureCode {
  code: CodePhoneme;
  mesure: Mesure;
  /** L'occurrence la plus dégradée : c'est elle qu'on montre à l'écran. */
  representant: ScorePhoneme;
  occurrences: number;
}

export function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 0 ? (tri[milieu - 1] + tri[milieu]) / 2 : tri[milieu];
}

export function ecartMax(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[tri.length - 1] - tri[0];
}

/** Regroupe les occurrences d'un même code dans une lecture. */
function grouperParCode(lecture: ScorePhoneme[]): Map<CodePhoneme, ScorePhoneme[]> {
  const parCode = new Map<CodePhoneme, ScorePhoneme[]>();
  for (const s of lecture) {
    if (!s.code) continue; // hors taxonomie : affiché, jamais ciblé
    const liste = parCode.get(s.code) ?? [];
    liste.push(s);
    parCode.set(s.code, liste);
  }
  return parCode;
}

/** Le pire score d'une liste, et l'occurrence qui le porte. */
function pire(scores: ScorePhoneme[]): ScorePhoneme {
  return scores.reduce((min, s) => (s.score < min.score ? s : min), scores[0]);
}

/**
 * Consolide plusieurs lectures d'une même phrase en une mesure par code.
 * `valeurs` = une valeur par lecture (le pire score du code dans cette lecture),
 * ce qui rend l'écart comparable d'une lecture à l'autre.
 */
export function consoliderLectures(lectures: ScorePhoneme[][]): MesureCode[] {
  const utiles = lectures.filter((l) => l.length > 0);
  if (utiles.length === 0) return [];

  const codes = new Set<CodePhoneme>();
  const groupes = utiles.map((l) => {
    const g = grouperParCode(l);
    for (const c of g.keys()) codes.add(c);
    return g;
  });

  const out: MesureCode[] = [];
  for (const code of codes) {
    const parLecture = groupes
      .map((g) => g.get(code))
      .filter((x): x is ScorePhoneme[] => Boolean(x) && x!.length > 0);
    if (parLecture.length === 0) continue;

    const valeurs = parLecture.map((l) => pire(l).score);
    const representants = parLecture.map((l) => pire(l));
    const representant = representants.reduce((a, b) => (b.score < a.score ? b : a));
    const ecart = ecartMax(valeurs);
    out.push({
      code,
      representant,
      occurrences: Math.max(...parLecture.map((l) => l.length)),
      mesure: {
        lectures: valeurs.length,
        mediane: mediane(valeurs),
        ecart,
        stable: ecart <= ECART_MAX,
        valeurs,
      },
    });
  }
  return out.sort((a, b) => a.mesure.mediane - b.mesure.mediane);
}

/** Une mesure unique (mode essai rapide) : pas d'écart possible, jamais « stable ». */
export function mesureUnique(code: CodePhoneme, score: ScorePhoneme): MesureCode {
  return {
    code,
    representant: score,
    occurrences: 1,
    mesure: { lectures: 1, mediane: score.score, ecart: 0, stable: true, valeurs: [score.score] },
  };
}
