import type { CodePhoneme, LangueCible, PhraseEntrainement } from '../types';
import { PHRASES_ENTRAINEMENT } from '../constants';
import { PHONEMES, codesPourLangue } from './phonemes';
import cacheEn from './training.json';
import cacheFr from './training.fr.json';

/**
 * Phrases d'entraînement — étape 5 du pipeline (ACCENT.md §18.2).
 *
 * La démo ne doit jamais dépendre du réseau : les caches JSON sont commités,
 * un par paire de langues. S'il manque des phrases pour un code, on complète
 * localement à partir des mots d'exemple de la taxonomie, dans la langue de la
 * session. Un fournisseur LLM n'est donc qu'un enrichissement optionnel.
 */
interface CacheBrut {
  version: number;
  langue: LangueCible;
  parCode: Partial<Record<CodePhoneme, Array<{ texte: string; motCle: string }>>>;
}

const CACHES: Partial<Record<LangueCible, CacheBrut>> = {
  en: cacheEn as CacheBrut,
  fr: cacheFr as CacheBrut,
};

/** Gabarit du repli hors ligne : une phrase simple par mot d'exemple. */
const GABARITS: Record<LangueCible, (mot: string) => string> = {
  en: (mot) => `Say it slowly: ${mot}.`,
  fr: (mot) => `Dis-le lentement : ${mot}.`,
  es: (mot) => `Dilo despacio: ${mot}.`,
};

function depuisCache(code: CodePhoneme, langue: LangueCible): PhraseEntrainement[] {
  const cache = CACHES[langue];
  if (!cache || cache.langue !== langue) return [];
  const brut = cache.parCode[code] ?? [];
  return brut.map((p) => ({ code, texte: p.texte, motCle: p.motCle }));
}

function repliLocal(code: CodePhoneme, langue: LangueCible): PhraseEntrainement[] {
  const gabarit = GABARITS[langue] ?? GABARITS.en;
  return PHONEMES[code].motsExemples
    .slice(0, PHRASES_ENTRAINEMENT)
    .map((mot) => ({ code, texte: gabarit(mot), motCle: mot }));
}

/** Retourne toujours PHRASES_ENTRAINEMENT phrases : cache d'abord, repli ensuite. */
export function phrasesPour(code: CodePhoneme, langue: LangueCible = 'en'): PhraseEntrainement[] {
  const out = depuisCache(code, langue);
  if (PHONEMES[code].langueCible !== langue) return repliLocal(code, langue);
  for (const p of repliLocal(code, langue)) {
    if (out.length >= PHRASES_ENTRAINEMENT) break;
    if (!out.some((x) => x.texte === p.texte)) out.push(p);
  }
  return out.slice(0, PHRASES_ENTRAINEMENT);
}

/** Codes d'une langue dont le cache n'est pas complet (le repli prend le relais). */
export function phrasesManquantes(langue: LangueCible = 'en'): CodePhoneme[] {
  return codesPourLangue(langue).filter((c) => depuisCache(c, langue).length < PHRASES_ENTRAINEMENT);
}
