import type {
  AnalyseEntree,
  AnalyseSortie,
  CodePhoneme,
  FournisseurPrononciation,
  PhraseEntrainement,
  ScorePhoneme,
} from '../types';
import { phrasesPour } from '../data/training';
import { motsDe } from '../audio/quality';
import { codePourIpa } from '../data/phonemes';

/**
 * BYOK — Azure Speech « Pronunciation Assessment » (ACCENT.md §18.3).
 *
 * Filet de sécurité du projet : si le quota du proxy est épuisé pendant le
 * jugement, un juge peut coller sa propre clé et continuer à tester, sans
 * redéploiement. La clé reste dans le navigateur (localStorage) et n'est
 * envoyée qu'au fournisseur choisi.
 *
 * API utilisée : REST « short audio » de Speech-to-text, avec l'en-tête
 * `Pronunciation-Assessment` (JSON base64) qui demande le détail par phonème
 * (`AccuracyScore`, `ErrorType`, phonème attendu/produit).
 */

export interface OptionsAzure {
  cle: string;
  region: string;
  langue?: string;
}

interface AzurePhoneme {
  Phoneme?: string;
  AccuracyScore?: number;
  ErrorType?: string;
  Offset?: number;
  Duration?: number;
}

interface AzureMot {
  Word?: string;
  Offset?: number;
  Phonemes?: AzurePhoneme[];
  AccuracyScore?: number;
}

interface AzureReponse {
  NBest?: Array<{ Words?: AzureMot[]; PronunciationAssessment?: Record<string, number> }>;
}

function encoderConfig(reference: string): string {
  const cfg = {
    ReferenceText: reference,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true,
    EnableProsodyAssessment: false,
  };
  const json = JSON.stringify(cfg);
  let binaire = '';
  for (let i = 0; i < json.length; i += 1) binaire += String.fromCharCode(json.charCodeAt(i));
  return btoa(binaire);
}

/** Traduit la réponse Azure en `ScorePhoneme[]` de la taxonomie Accent. */
export function traduireAzure(reponse: AzureReponse, phrase: string): ScorePhoneme[] {
  const mots = reponse.NBest?.[0]?.Words ?? [];
  const attendus = motsDe(phrase);
  const out: ScorePhoneme[] = [];
  mots.forEach((m, indexMot) => {
    const mot = (m.Word ?? attendus[indexMot] ?? '').toLowerCase();
    for (const p of m.Phonemes ?? []) {
      const ipa = p.Phoneme ?? '';
      out.push({
        code: codePourIpa(ipa),
        ipa,
        mot,
        indexMot,
        score: Math.round(p.AccuracyScore ?? 0),
        produitIpa: p.ErrorType && p.ErrorType !== 'None' ? undefined : ipa,
      });
    }
  });
  return out;
}

export function fournisseurAzure(opts: OptionsAzure): FournisseurPrononciation {
  const langue = opts.langue ?? 'en-US';
  const hote = `https://${opts.region}.stt.speech.microsoft.com`;
  const chemin = `/speech/recognition/conversation/cognitiveservices/v1?language=${langue}`;

  return {
    id: 'byok-azure',
    label: 'Ta clé Azure (BYOK)',

    async analyse(entree: AnalyseEntree, signal?: AbortSignal): Promise<AnalyseSortie> {
      const audio =
        entree.audio instanceof ArrayBuffer ? entree.audio : await entree.audio.arrayBuffer();
      const res = await fetch(hote + chemin, {
        method: 'POST',
        signal,
        headers: {
          'Ocp-Apim-Subscription-Key': opts.cle,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
          'Pronunciation-Assessment': encoderConfig(entree.texte),
        },
        body: audio,
      });
      if (!res.ok) throw new Error(`Azure : HTTP ${res.status}`);
      const data = (await res.json()) as AzureReponse;
      const scores = traduireAzure(data, entree.texte);
      return { scores, dureeMs: 0, provider: 'azure-byok', simule: false, brut: data };
    },

    async phrases(code: CodePhoneme, langueCible): Promise<PhraseEntrainement[]> {
      return phrasesPour(code, langueCible);
    },
  };
}
