import type { CodePhoneme, LangueCible, PhraseEntrainement } from '../types';
import { PHRASES_ENTRAINEMENT } from '../constants';
import { PHONEMES } from './phonemes';
import cache from './training.json';

/**
 * Phrases d'entraînement — étape 5 du pipeline (ACCENT.md §18.2).
 *
 * La démo ne doit jamais dépendre du réseau : le cache JSON est commité. S'il
 * manque des phrases pour un code, on complète localement à partir des mots
 * d'exemple de la taxonomie. Un fournisseur LLM n'est donc qu'un enrichissement
 * optionnel, jamais un prérequis.
 */
interface CacheBrut {
  version: number;
  langue: LangueCible;
  parCode: Partial<Record<CodePhoneme, Array<{ texte: string; motCle: string }>>>;
}

const CACHE = cache as CacheBrut;

function depuisCache(code: CodePhoneme): PhraseEntrainement[] {
  const brut = CACHE.parCode[code] ?? [];
  return brut.map((p) => ({ code, texte: p.texte, motCle: p.motCle }));
}

/** Repli hors ligne : une phrase simple par mot d'exemple, mot clé en évidence. */
function repliLocal(code: CodePhoneme): PhraseEntrainement[] {
  const e = PHONEMES[code];
  return e.motsExemples.slice(0, PHRASES_ENTRAINEMENT).map((mot) => ({
    code,
    texte: `Say it slowly: ${mot}.`,
    motCle: mot,
  }));
}

/** Retourne toujours PHRASES_ENTRAINEMENT phrases, cache d'abord, repli ensuite. */
export function phrasesPour(code: CodePhoneme, langue: LangueCible = 'en'): PhraseEntrainement[] {
  if (langue !== CACHE.langue) return repliLocal(code);
  const out = depuisCache(code);
  for (const p of repliLocal(code)) {
    if (out.length >= PHRASES_ENTRAINEMENT) break;
    if (!out.some((x) => x.texte === p.texte)) out.push(p);
  }
  return out.slice(0, PHRASES_ENTRAINEMENT);
}

export function phrasesManquantes(): CodePhoneme[] {
  return (Object.keys(PHONEMES) as CodePhoneme[]).filter(
    (c) => depuisCache(c).length < PHRASES_ENTRAINEMENT,
  );
}
