import type { CodePhoneme, LangueCible } from '../types';
import { PHONEMES } from '../data/phonemes';

/**
 * Mode « perception avant production ».
 *
 * Le problème racine (ACCENT.md §3) : « un francophone adulte perçoit mal les
 * phonèmes absents du français — il ne **s'entend pas** se tromper ». Demander à
 * un élève de produire /θ/ alors qu'il ne l'oppose pas à /s/ est voué à l'échec.
 * On entraîne donc d'abord l'oreille, sur les paires minimales de la taxonomie.
 *
 * Logique PURE et déterministe (graine) : testable sans audio ni DOM.
 * Garde-fou produit : aucune fonction ne renvoie de pourcentage global — on rend
 * des comptes et un détail, l'UI décide de ce qu'elle affiche.
 */

export interface ItemPerception {
  /** [mot A, mot B] de la paire minimale. */
  paire: [string, string];
  /** Index du mot qui sera lu à l'élève (0 = A, 1 = B). */
  reponse: 0 | 1;
  /** Le mot réellement lu — pratique pour le feedback et les tests. */
  mot: string;
}

export interface ExercicePerception {
  code: CodePhoneme;
  langue: LangueCible;
  items: ItemPerception[];
}

export interface ReponseItem {
  item: ItemPerception;
  donne: 0 | 1 | null;
  reussi: boolean;
}

export interface BilanPerception {
  reussis: number;
  total: number;
  detail: ReponseItem[];
  /** Paires encore confondues, sans doublon : c'est le seul « résultat » exploitable. */
  pairesARevoir: Array<[string, string]>;
}

/** PRNG déterministe (mulberry32) : indispensable pour des tests reproductibles. */
function aleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pairesDisponibles(code: CodePhoneme): Array<[string, string]> {
  const e = PHONEMES[code];
  // Un code positionnel (P14, accent de mot) n'est pas un son : l'opposition ne
  // s'écoute pas, elle se voit (BarresSyllabes). Pas d'exercice d'écoute.
  if (e.nature === 'positionnel') return [];
  return e.pairesMinimales.filter(([a, b]) => a.trim().length > 0 && b.trim().length > 0);
}

export interface OptionsExercice {
  nb?: number;
  graine?: number;
}

/**
 * Position de la bonne réponse : tirage aléatoire, mais jamais trois fois de
 * suite le même bouton — sinon l'élève répond par habitude, pas par oreille
 * (une alternance strictement A/B/A/B serait tout aussi devinable).
 */
function tirerReponse(tirage: () => number, historique: Array<0 | 1>): 0 | 1 {
  const n = historique.length;
  const deuxIdentiques = n >= 2 && historique[n - 1] === historique[n - 2];
  if (deuxIdentiques) return historique[n - 1] === 0 ? 1 : 0;
  return tirage() < 0.5 ? 0 : 1;
}

/**
 * Construit un exercice : `nb` items (défaut 6), sans répéter la même paire deux
 * fois de suite, et sans motif devinable sur la position de la bonne réponse.
 */
export function creerExercice(
  code: CodePhoneme,
  langue: LangueCible = 'en',
  opts: OptionsExercice = {},
): ExercicePerception {
  const nb = Math.max(1, Math.min(20, opts.nb ?? 6));
  const paires = pairesDisponibles(code);
  const tirage = aleatoire(opts.graine ?? 1234567);
  const items: ItemPerception[] = [];

  if (paires.length === 0) return { code, langue, items };

  let precedente = -1;
  for (let i = 0; i < nb; i += 1) {
    let choix = Math.floor(tirage() * paires.length) % paires.length;
    if (paires.length > 1 && choix === precedente) choix = (choix + 1) % paires.length;
    precedente = choix;
    const paire = paires[choix];
    const reponse = tirerReponse(tirage, items.map((x) => x.reponse));
    items.push({ paire, reponse, mot: paire[reponse] });
  }
  return { code, langue, items };
}

/** Corrige sans jamais produire de note globale : des comptes et un détail. */
export function corriger(
  exercice: ExercicePerception,
  reponses: Array<0 | 1 | null>,
): BilanPerception {
  const detail: ReponseItem[] = exercice.items.map((item, i) => {
    const donne = reponses[i] ?? null;
    return { item, donne, reussi: donne !== null && donne === item.reponse };
  });
  const reussis = detail.filter((d) => d.reussi).length;
  const pairesARevoir: Array<[string, string]> = [];
  for (const d of detail) {
    if (d.reussi) continue;
    const cle = d.item.paire;
    if (!pairesARevoir.some(([a, b]) => a === cle[0] && b === cle[1])) pairesARevoir.push(cle);
  }
  return { reussis, total: exercice.items.length, detail, pairesARevoir };
}

/** Un exercice est-il jouable (des paires existent-elles pour ce code) ? */
export function jouable(code: CodePhoneme): boolean {
  return pairesDisponibles(code).length > 0;
}
