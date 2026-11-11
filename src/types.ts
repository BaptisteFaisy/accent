/**
 * Contrats partagés d'Accent — la seule source de vérité des types.
 *
 * Règle produit (ACCENT.md §17, §21) : jamais de score global. Un `Diagnostic`
 * ne porte qu'UNE cible ; aucun type ici ne permet d'exprimer une note globale.
 */

/**
 * Codes des taxonomies fermées (ACCENT.md §17).
 * - `P01..P15` : francophone apprenant l'anglais (la paire du MVP) ;
 * - `E01..E09` : hispanophone apprenant le français (RF-20, même moteur).
 *
 * Une liste fermée, pas de catégorie inventée : chaque code a sa signature
 * d'erreur et ses paires minimales dans `src/data/phonemes.ts`.
 */
export type CodePhoneme =
  | 'P01' | 'P02' | 'P03' | 'P04' | 'P05'
  | 'P06' | 'P07' | 'P08' | 'P09' | 'P10'
  | 'P11' | 'P12' | 'P13' | 'P14' | 'P15'
  | 'E01' | 'E02' | 'E03' | 'E04' | 'E05'
  | 'E06' | 'E07' | 'E08' | 'E09';

export type LangueCible = 'en' | 'fr' | 'es';

/** Nature du défaut : phonétique (paire minimale) ou positionnel (P14, syllabes). */
export type NatureCible = 'phonetique' | 'positionnel';

export interface EntreePhoneme {
  code: CodePhoneme;
  /** Symbole API cible, ex. « θ ». Affiché entre barres obliques : /θ/. */
  ipa: string;
  /** Nom lisible pour l'élève, en français, sans jargon. */
  label: string;
  langueCible: LangueCible;
  /** Signature d'erreur du francophone : ce que le son devient réellement. */
  signature: string;
  /** Substitutions typiques, en API (ex. ['s', 'f'] pour /θ/). */
  produitComme: string[];
  /** Paires minimales : [mot cible, mot confondu]. */
  pairesMinimales: Array<[string, string]>;
  /** Mots d'exemple portant le phonème. */
  motsExemples: string[];
  /** Difficulté 1 à 3 (★), sert de pondération à la sélection de la cible. */
  difficulte: 1 | 2 | 3;
  nature: NatureCible;
  /** Consigne courte et bienveillante, à l'écran, en français. */
  conseil: string;
  /** Syllabes accentuées attendues, pour P14 uniquement (mot → index accentué). */
  accentuation?: Array<{ mot: string; syllabes: string[]; accent: number }>;
}

/** Score d'un phonème sur un mot, tel que renvoyé par l'étape 2 du pipeline. */
export interface ScorePhoneme {
  /** null = phonème hors taxonomie (l'API en renvoie parfois) : affiché, non ciblé. */
  code: CodePhoneme | null;
  ipa: string;
  mot: string;
  indexMot: number;
  /** 0 à 100. */
  score: number;
  /** Phonème réellement produit, si le fournisseur sait le nommer. */
  produitIpa?: string;
}

/** Résultat consolidé de plusieurs lectures d'une même phrase. */
export interface Mesure {
  /** Nombre de lectures réellement exploitées. */
  lectures: number;
  /** Médiane des scores de la cible. */
  mediane: number;
  /** Écart max entre deux lectures. */
  ecart: number;
  /** false si l'écart dépasse ECART_MAX : on refuse d'afficher un chiffre. */
  stable: boolean;
  valeurs: number[];
}

export type EtatDiagnostic =
  | 'a_travailler'
  | 'acquis'
  | 'rien_a_corriger'
  | 'instable'
  | 'trop_court'
  | 'trop_bruyant'
  | 'erreur';

export interface Cible {
  code: CodePhoneme;
  entree: EntreePhoneme;
  /** Médiane consolidée (ou score unique en mode essai rapide). */
  score: number;
  produitIpa?: string;
  mot: string;
  indexMot: number;
  /** Poids ayant servi à la sélection (score × occurrences × difficulté). */
  poids: number;
  occurrences: number;
}

export interface Diagnostic {
  etat: EtatDiagnostic;
  cible: Cible | null;
  scores: ScorePhoneme[];
  mesure: Mesure | null;
  /** Phrase à afficher, déjà rédigée dans le ton bienveillant du produit. */
  message: string;
}

export interface PhraseEntrainement {
  code: CodePhoneme;
  texte: string;
  /** Mot porteur du phonème, mis en évidence à l'écran. */
  motCle: string;
}

export interface ProfilPhoneme {
  meilleur: number;
  dernier: number;
  tentatives: number;
  acquisLe: string | null;
}

/** Profil local : la progression ne se mesure que contre soi (garde-fou §10). */
export interface Profil {
  parPhoneme: Partial<Record<CodePhoneme, ProfilPhoneme>>;
  sessions: number;
  maj: string;
}

export interface Session {
  id: string;
  createdAt: string;
  langueCible: LangueCible;
  /** ≤ 200 caractères, aucun nom propre demandé. */
  phrase: string;
  cible: CodePhoneme | null;
  scores: ScorePhoneme[];
  /** Jamais d'audio ici : RNF-P1. */
}

/* ---------------------------------------------------------- fournisseurs */

export interface AnalyseEntree {
  /** Audio mono 16 kHz, WAV de préférence (voir src/audio/wav.ts). */
  audio: Blob | ArrayBuffer;
  texte: string;
  langueCible: LangueCible;
}

export interface AnalyseSortie {
  scores: ScorePhoneme[];
  dureeMs: number;
  /** Identifiant du fournisseur, affiché à l'écran (honnêteté, ACCENT.md §6). */
  provider: string;
  /** true si la réponse vient d'une simulation locale, pas d'une mesure réelle. */
  simule?: boolean;
  brut?: unknown;
}

/** Contrat unique de tous les fournisseurs (proxy, BYOK Azure, démo locale). */
export interface FournisseurPrononciation {
  readonly id: string;
  readonly label: string;
  analyse(entree: AnalyseEntree, signal?: AbortSignal): Promise<AnalyseSortie>;
  phrases(code: CodePhoneme, langueCible: LangueCible): Promise<PhraseEntrainement[]>;
}

/* ------------------------------------------------------------- pipeline */

export type EtapePipeline = 'ecoute' | 'evaluation' | 'diagnostic' | 'explication' | 'exercice';

export interface ProgressionPipeline {
  etape: EtapePipeline;
  /** 0 à 1, pour la barre de progression nommée (écran 3). */
  avancement: number;
  detail?: string;
}

export type EcouteurProgression = (p: ProgressionPipeline) => void;
