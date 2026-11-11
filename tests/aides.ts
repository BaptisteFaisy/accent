import { encoderWav } from '../src/audio/wav';
import { TAUX_ECHANTILLONNAGE } from '../src/constants';
import { PHONEMES } from '../src/data/phonemes';
import { phrasesPour } from '../src/data/training';
import type { ResultatPipeline } from '../src/engine/pipeline';
import type {
  AnalyseEntree,
  AnalyseSortie,
  Cible,
  CodePhoneme,
  Diagnostic,
  EtatDiagnostic,
  FournisseurPrononciation,
  LangueCible,
  PhraseEntrainement,
  Profil,
  ScorePhoneme,
  Session,
} from '../src/types';

/**
 * Fabriques de signaux et de résultats pour les tests d'acceptation (§25).
 *
 * Règle imposée : déterminisme total. Aucun micro, aucun réseau, aucun timer
 * réel — les signaux sont synthétisés en code (sinusoïdes, silences, rampes).
 */

export const TAUX = TAUX_ECHANTILLONNAGE;

/** Sinusoïde pure : amplitude et fréquence maîtrisées, reproductible. */
export function sinus(ms: number, frequence = 220, amplitude = 0.5): Float32Array {
  const n = Math.round((TAUX * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequence * i) / TAUX);
  }
  return out;
}

/** Rampe linéaire : sert à varier l'énergie d'un burst sans bruit aléatoire. */
export function rampe(ms: number, debut = 0.1, fin = 0.6): Float32Array {
  const n = Math.round((TAUX * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = debut + ((fin - debut) * i) / Math.max(1, n - 1);
  return out;
}

export function silence(ms: number): Float32Array {
  return new Float32Array(Math.round((TAUX * ms) / 1000));
}

export function coller(...signaux: Float32Array[]): Float32Array {
  const n = signaux.reduce((a, s) => a + s.length, 0);
  const out = new Float32Array(n);
  let k = 0;
  for (const s of signaux) {
    out.set(s, k);
    k += s.length;
  }
  return out;
}

/**
 * Une « lecture » synthétique : un burst sonore par mot, séparés par des
 * silences assez longs pour que `segmentsVoix` les distingue (fenêtre 90 ms).
 */
export function lectureSynthetique(nbMots = 6, motMs = 300): Float32Array {
  const morceaux: Float32Array[] = [];
  for (let i = 0; i < nbMots; i += 1) {
    morceaux.push(sinus(motMs, 180 + i * 25, 0.5));
    morceaux.push(silence(140));
  }
  return coller(...morceaux);
}

/** WAV 16 bits mono 16 kHz : le format que les fournisseurs attendent. */
export function wavDe(signal: Float32Array): ArrayBuffer {
  return encoderWav(signal, TAUX);
}

export function dureeMs(signal: Float32Array): number {
  return Math.round((signal.length / TAUX) * 1000);
}

/** Base64 d'un buffer : sert à prouver qu'aucun audio n'est stocké. */
export function base64De(buf: ArrayBuffer): string {
  const octets = new Uint8Array(buf);
  const pas = 0x8000;
  let binaire = '';
  for (let i = 0; i < octets.length; i += pas) {
    binaire += String.fromCharCode(...octets.subarray(i, i + pas));
  }
  return btoa(binaire);
}

/* ---------------------------------------------------------- fournisseurs */

/** Fournisseur de test qui COMPTE les appels : preuve qu'il n'est pas sollicité. */
export interface FournisseurEspion extends FournisseurPrononciation {
  appels: number;
}

/**
 * Renvoie `lectures[i]` à la i-ème analyse (la dernière au-delà). Les appels
 * sont comptés ; `phrases()` délègue au cache local, jamais au réseau.
 */
export function fournisseurEspion(lectures: ScorePhoneme[][]): FournisseurEspion {
  let i = 0;
  const espion: FournisseurEspion = {
    id: 'espion',
    label: 'Fournisseur de test (aucun réseau)',
    appels: 0,
    async analyse(_entree: AnalyseEntree): Promise<AnalyseSortie> {
      espion.appels += 1;
      const scores = lectures[Math.min(i, lectures.length - 1)] ?? [];
      i += 1;
      return { scores, dureeMs: 10, provider: 'espion', simule: false };
    },
    async phrases(code: CodePhoneme, langueCible: LangueCible): Promise<PhraseEntrainement[]> {
      return phrasesPour(code, langueCible);
    },
  };
  return espion;
}

/* ------------------------------------------------------------ résultats */

export function scoreDe(
  code: CodePhoneme,
  mot: string,
  indexMot: number,
  score: number,
  produitIpa?: string,
): ScorePhoneme {
  const base: ScorePhoneme = { code, ipa: PHONEMES[code].ipa, mot, indexMot, score };
  return produitIpa ? { ...base, produitIpa } : base;
}

export function cibleDe(code: CodePhoneme, mot = 'think', score = 34): Cible {
  const entree = PHONEMES[code];
  return {
    code,
    entree,
    score,
    produitIpa: entree.produitComme[0],
    mot,
    indexMot: 1,
    poids: Math.round((80 - score) * entree.difficulte),
    occurrences: 1,
  };
}

export function diagnosticDe(etat: EtatDiagnostic, cible: Cible | null, message = 'message de test'): Diagnostic {
  return {
    etat,
    cible,
    scores: cible ? [scoreDe(cible.code, cible.mot, cible.indexMot, cible.score)] : [],
    mesure: null,
    message,
  };
}

/** ResultatPipeline littéral : conforme à src/types.ts, sans passer par le moteur. */
export function resultatDe(opts: {
  simule: boolean;
  etat?: EtatDiagnostic;
  cible?: Cible | null;
}): ResultatPipeline {
  const cible = opts.cible === undefined ? cibleDe('P01') : opts.cible;
  return {
    diagnostic: diagnosticDe(opts.etat ?? (cible ? 'a_travailler' : 'rien_a_corriger'), cible),
    phrases: cible ? phrasesPour(cible.code, 'en') : [],
    provider: 'test',
    simule: opts.simule,
    msParEtape: {},
    msTotal: 12,
  };
}

export function sessionDe(phrase: string, cible: CodePhoneme | null, scores: ScorePhoneme[] = []): Session {
  return {
    id: '3f2b8c1e-0d4a-4f6b-9c2e-7a1d5e8f0b34',
    createdAt: '2026-11-11T18:00:00.000Z',
    langueCible: 'en',
    phrase,
    cible,
    scores,
  };
}

export function profilDe(code: CodePhoneme, score: number): Profil {
  return {
    parPhoneme: { [code]: { meilleur: score, dernier: score, tentatives: 1, acquisLe: null } },
    sessions: 1,
    maj: '2026-11-11T18:00:00.000Z',
  };
}

/* ------------------------------------------------------------- parcours */

export interface ParcoursJson {
  cles: string[];
  chaines: string[];
}

/** Liste toutes les clés et toutes les chaînes d'un objet JSON : audit RNF-P1/P3. */
export function parcoursJson(valeur: unknown): ParcoursJson {
  const cles: string[] = [];
  const chaines: string[] = [];
  const visiter = (v: unknown): void => {
    if (typeof v === 'string') {
      chaines.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visiter(x);
      return;
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        cles.push(k);
        visiter(val);
      }
    }
  };
  visiter(valeur);
  return { cles, chaines };
}
