import type { CodePhoneme } from '../types';

/**
 * Paramètres articulatoires des 24 phonèmes de la taxonomie.
 *
 * Pourquoi des paramètres et pas 24 dessins : un schéma de coupe sagittale se
 * déduit de six grandeurs (lieu, pointe de langue, dos de langue, lèvres, voile
 * du palais, voisement). Une seule fonction de dessin (`SchemaArticulatoire`)
 * les projette tous — donc zéro duplication, et ajouter une paire de langues ne
 * demande que des lignes de données, jamais du SVG.
 *
 * P14 (accent de mot) est volontairement absent : ce n'est pas un son mais une
 * place, l'écran utilise `BarresSyllabes`.
 */

export type Lieu = 'levres' | 'dents' | 'alveoles' | 'palais' | 'voile' | 'glotte';
export type FormeLevres = 'ouvertes' | 'arrondies' | 'etirees' | 'serrees' | 'dents-levre' | 'projetees';

export interface Articulation {
  /** Lieu de la constriction principale. */
  lieu: Lieu;
  /** Hauteur/avancement de la pointe de la langue, 0 = basse et arrière, 1 = haute et avant. */
  pointeLangue: number;
  /** Hauteur du dos de la langue, 0 = bas, 1 = au contact du voile. */
  dosLangue: number;
  levres: FormeLevres;
  /** Voile du palais ouvert : l'air passe par le nez. */
  nasal: boolean;
  /** Cordes vocales en vibration. */
  voise: boolean;
  /** Flux d'air turbulent audible (fricatives, /h/). */
  souffle: boolean;
  /** Légende courte, lisible par un adolescent. */
  legende: string;
}

const A = (a: Articulation): Articulation => a;

export const ARTICULATIONS: Partial<Record<CodePhoneme, Articulation>> = {
  /* ----------------------------- FR → EN ----------------------------- */
  P01: A({
    lieu: 'dents', pointeLangue: 0.9, dosLangue: 0.3, levres: 'ouvertes',
    nasal: false, voise: false, souffle: true,
    legende: 'Pointe de la langue entre les dents, air soufflé, gorge muette.',
  }),
  P02: A({
    lieu: 'dents', pointeLangue: 0.9, dosLangue: 0.3, levres: 'ouvertes',
    nasal: false, voise: true, souffle: true,
    legende: 'Même place que /θ/, mais la gorge vibre.',
  }),
  P03: A({
    lieu: 'glotte', pointeLangue: 0.1, dosLangue: 0.1, levres: 'ouvertes',
    nasal: false, voise: false, souffle: true,
    legende: 'Rien ne se touche : un simple souffle avant la voyelle.',
  }),
  P04: A({
    lieu: 'palais', pointeLangue: 0.45, dosLangue: 0.55, levres: 'etirees',
    nasal: false, voise: true, souffle: false,
    legende: 'Langue haute mais relâchée, plus court que le « i » français.',
  }),
  P05: A({
    lieu: 'palais', pointeLangue: 0.5, dosLangue: 0.3, levres: 'ouvertes',
    nasal: false, voise: true, souffle: false,
    legende: 'Bouche ouverte, langue tirée vers l’avant : plus clair qu’un « a ».',
  }),
  P06: A({
    lieu: 'palais', pointeLangue: 0.3, dosLangue: 0.35, levres: 'ouvertes',
    nasal: false, voise: true, souffle: false,
    legende: 'Bref, au fond de la bouche, lèvres neutres — jamais arrondies.',
  }),
  P07: A({
    lieu: 'alveoles', pointeLangue: 0.75, dosLangue: 0.5, levres: 'arrondies',
    nasal: false, voise: true, souffle: false,
    legende: 'Pointe proche du palais sans le toucher, lèvres à peine arrondies.',
  }),
  P08: A({
    lieu: 'voile', pointeLangue: 0.1, dosLangue: 0.95, levres: 'ouvertes',
    nasal: true, voise: true, souffle: false,
    legende: 'Dos de la langue au voile, air par le nez, aucun « g » final.',
  }),
  P09: A({
    lieu: 'dents', pointeLangue: 0.2, dosLangue: 0.3, levres: 'dents-levre',
    nasal: false, voise: true, souffle: true,
    legende: 'Lèvre du bas contre les dents du haut, ça frotte et ça vibre.',
  }),
  P10: A({
    lieu: 'alveoles', pointeLangue: 0.95, dosLangue: 0.6, levres: 'ouvertes',
    nasal: false, voise: true, souffle: false,
    legende: 'Attaque collée comme un « d », puis relâchement en friction.',
  }),
  P11: A({
    lieu: 'palais', pointeLangue: 0.3, dosLangue: 0.45, levres: 'ouvertes',
    nasal: false, voise: true, souffle: false,
    legende: 'Syllabe non accentuée : tout se relâche, la voyelle devient neutre.',
  }),
  P12: A({
    lieu: 'levres', pointeLangue: 0.1, dosLangue: 0.2, levres: 'serrees',
    nasal: false, voise: true, souffle: false,
    legende: 'Consonne finale sonore : elle vibre jusqu’au bout, on ne la coupe pas.',
  }),
  P13: A({
    lieu: 'alveoles', pointeLangue: 0.9, dosLangue: 0.3, levres: 'ouvertes',
    nasal: false, voise: false, souffle: true,
    legende: 'Consonnes enchaînées sans voyelle entre elles : « s-t-r » collé.',
  }),
  /* P14 (accent de mot) : voir BarresSyllabes, aucun schéma. */
  P15: A({
    lieu: 'voile', pointeLangue: 0.2, dosLangue: 0.7, levres: 'arrondies',
    nasal: false, voise: true, souffle: false,
    legende: 'Bref et relâché, lèvres peu arrondies : plus court que « ou ».',
  }),

  /* ----------------------------- ES → FR ----------------------------- */
  E01: A({
    lieu: 'palais', pointeLangue: 0.6, dosLangue: 0.85, levres: 'arrondies',
    nasal: false, voise: true, souffle: false,
    legende: 'Lèvres en avant comme pour « ou », mais la langue dit « i ».',
  }),
  E02: A({
    lieu: 'voile', pointeLangue: 0.1, dosLangue: 0.8, levres: 'ouvertes',
    nasal: false, voise: true, souffle: true,
    legende: 'Frottement au fond de la gorge, pointe de la langue en bas.',
  }),
  E03: A({
    lieu: 'voile', pointeLangue: 0.3, dosLangue: 0.5, levres: 'ouvertes',
    nasal: true, voise: true, souffle: false,
    legende: 'Voile ouvert : l’air sort par le nez ET la bouche, sans /n/ final.',
  }),
  E04: A({
    lieu: 'palais', pointeLangue: 0.75, dosLangue: 0.7, levres: 'projetees',
    nasal: false, voise: false, souffle: true,
    legende: 'Lèvres projetées, friction douce : pas d’attaque « tch ».',
  }),
  E05: A({
    lieu: 'dents', pointeLangue: 0.2, dosLangue: 0.3, levres: 'dents-levre',
    nasal: false, voise: true, souffle: true,
    legende: '/v/ frotte et continue ; /b/ explose et s’arrête.',
  }),
  E06: A({
    lieu: 'palais', pointeLangue: 0.55, dosLangue: 0.5, levres: 'ouvertes',
    nasal: false, voise: true, souffle: false,
    legende: '/ɛ/ ouvert : la mâchoire descend. /e/ fermé : bouche presque close.',
  }),
  E07: A({
    lieu: 'palais', pointeLangue: 0.5, dosLangue: 0.7, levres: 'arrondies',
    nasal: false, voise: true, souffle: false,
    legende: 'Lèvres arrondies comme pour « o », la langue dit « é ».',
  }),
  E08: A({
    lieu: 'voile', pointeLangue: 0.1, dosLangue: 0.95, levres: 'ouvertes',
    nasal: false, voise: false, souffle: false,
    legende: 'Consonne finale tenue puis coupée net, sans voyelle derrière.',
  }),
  E09: A({
    lieu: 'palais', pointeLangue: 0.75, dosLangue: 0.7, levres: 'projetees',
    nasal: false, voise: true, souffle: true,
    legende: 'Même place que /ʃ/, mais la gorge vibre : c’est le « j » de journal.',
  }),
};

/** null pour les codes sans schéma (P14) : l'appelant bascule sur un autre rendu. */
export function articulationPour(code: CodePhoneme): Articulation | null {
  return ARTICULATIONS[code] ?? null;
}

/** Codes couverts par un schéma — utilisé par les tests de couverture. */
export function codesAvecSchema(): CodePhoneme[] {
  return Object.keys(ARTICULATIONS) as CodePhoneme[];
}
