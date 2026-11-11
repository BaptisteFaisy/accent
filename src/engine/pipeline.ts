import type {
  CodePhoneme,
  Diagnostic,
  EcouteurProgression,
  EtapePipeline,
  LangueCible,
  PhraseEntrainement,
  Profil,
  ScorePhoneme,
} from '../types';
import { DUREE_MIN_MS } from '../constants';
import type { FournisseurPrononciation } from '../types';
import { consoliderLectures, mesureUnique } from './measure';
import { choisirCible } from './selectTarget';
import { phrasesPour } from '../data/training';
import { repartirSurLesMots } from '../audio/quality';

/**
 * Pipeline en 5 étapes — ACCENT.md §18.2. Budget : 10 s de la fin de lecture au
 * diagnostic (RNF-01). Chaque étape est nommée et publiée via `onProgress` :
 * l'attente devient une démonstration du pipeline (critère Presentation).
 */

export interface Lecture {
  /** PCM mono 16 kHz de préférence ; le fournisseur peut accepter un blob. */
  audio: ArrayBuffer | Blob;
  dureeMs: number;
}

export interface EntreePipeline {
  phrase: string;
  langueCible: LangueCible;
  lectures: Lecture[];
  fournisseur: FournisseurPrononciation;
  profil?: Profil | null;
  /** Écran « réessayer » : on reste sur le même phonème. */
  forcerCible?: CodePhoneme | null;
  onProgress?: EcouteurProgression;
  signal?: AbortSignal;
}

export interface ResultatPipeline {
  diagnostic: Diagnostic;
  phrases: PhraseEntrainement[];
  provider: string;
  /** true si la mesure vient du moteur local de démonstration (honnêteté §6). */
  simule: boolean;
  msParEtape: Partial<Record<EtapePipeline, number>>;
  msTotal: number;
}

function publier(
  onProgress: EcouteurProgression | undefined,
  etape: EtapePipeline,
  avancement: number,
  detail?: string,
): void {
  onProgress?.({ etape, avancement, detail });
}

function chrono(): () => number {
  const t0 = performance.now();
  return () => Math.round(performance.now() - t0);
}

/** Étape 1 : aucune lecture exploitable → on refuse d'évaluer. */
function verifierLectures(lectures: Lecture[]): Diagnostic | null {
  if (lectures.length === 0) {
    return { etat: 'erreur', cible: null, scores: [], mesure: null, message: 'Aucun enregistrement.' };
  }
  if (lectures.some((l) => l.dureeMs < DUREE_MIN_MS)) {
    return {
      etat: 'trop_court',
      cible: null,
      scores: [],
      mesure: null,
      message: 'Trop court : moins de 1,5 s d’audio. Lis la phrase en entier, puis réessaie.',
    };
  }
  return null;
}

interface SortieEvaluation {
  lectures: ScorePhoneme[][];
  simule: boolean;
  provider: string;
}

/** Étape 2 : les lectures partent en parallèle, le budget de 10 s en dépend. */
async function evaluer(e: EntreePipeline): Promise<SortieEvaluation> {
  const total = e.lectures.length;
  const t = chrono();
  const sorties = await Promise.all(
    e.lectures.map(async (l) =>
      e.fournisseur.analyse(
        { audio: l.audio, texte: e.phrase, langueCible: e.langueCible },
        e.signal,
      ),
    ),
  );
  for (let i = 0; i < sorties.length; i += 1) {
    publier(e.onProgress, 'evaluation', (i + 1) / total, `Lecture ${i + 1}/${total}`);
  }
  publier(e.onProgress, 'evaluation', 1, `${t()} ms`);
  return {
    lectures: sorties.map((s) => repartirSurLesMots(e.phrase, s.scores)),
    simule: sorties.some((s) => s.simule === true),
    provider: sorties[0]?.provider ?? e.fournisseur.id,
  };
}

export async function executerPipeline(e: EntreePipeline): Promise<ResultatPipeline> {
  const tTotal = chrono();
  const msParEtape: Partial<Record<EtapePipeline, number>> = {};

  publier(e.onProgress, 'ecoute', 0.2, 'Vérification de l’audio');
  let t = chrono();
  const refus = verifierLectures(e.lectures);
  msParEtape.ecoute = t();
  if (refus) {
    return {
      diagnostic: refus,
      phrases: [],
      provider: e.fournisseur.id,
      simule: false,
      msParEtape,
      msTotal: tTotal(),
    };
  }
  publier(e.onProgress, 'ecoute', 1, 'Audio exploitable');

  const ev = await evaluer(e);
  const lectures = ev.lectures;
  msParEtape.evaluation = t();

  t = chrono();
  publier(e.onProgress, 'diagnostic', 0.5, 'Choix du son à travailler');
  const reference = lectures.length > 1;
  const mesures = reference
    ? consoliderLectures(lectures)
    : lectures[0]
        .filter((s) => s.code)
        .map((s) => mesureUnique(s.code as CodePhoneme, s));
  const choix = choisirCible(mesures, {
    profil: e.profil,
    forcer: e.forcerCible ?? null,
  });
  const scores = reference
    ? mesures.map((m) => m.representant)
    : lectures[0];
  msParEtape.diagnostic = t();

  const diagnostic: Diagnostic = {
    etat: choix.etat,
    cible: choix.cible,
    scores,
    mesure: choix.cible ? (mesures.find((m) => m.code === choix.cible!.code)?.mesure ?? null) : null,
    message: choix.message,
  };

  t = chrono();
  publier(e.onProgress, 'explication', 0.5, 'Paire minimale et consigne');
  // Étape 4 : table locale, aucun appel réseau (voir engine/explain.ts).
  msParEtape.explication = t();
  publier(e.onProgress, 'explication', 1);

  t = chrono();
  let phrases: PhraseEntrainement[] = [];
  if (choix.cible) {
    publier(e.onProgress, 'exercice', 0.4, 'Trois phrases pour ce son seul');
    phrases = phrasesPour(choix.cible.code, e.langueCible);
  }
  msParEtape.exercice = t();
  publier(e.onProgress, 'exercice', 1);

  return {
    diagnostic,
    phrases,
    provider: ev.provider,
    simule: ev.simule,
    msParEtape,
    msTotal: tTotal(),
  };
}
