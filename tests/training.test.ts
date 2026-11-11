import { describe, expect, it } from 'vitest';
import cacheEn from '../src/data/training.json';
import cacheFr from '../src/data/training.fr.json';
import { phrasesManquantes, phrasesPour } from '../src/data/training';
import { PHONEMES, codesPourLangue } from '../src/data/phonemes';
import { PHRASES_ENTRAINEMENT } from '../src/constants';
import type { CodePhoneme, LangueCible } from '../src/types';

/**
 * RF-08 et §18.2 étape 5 : trois phrases d'entraînement par phonème, servies par
 * le cache commité — la démo ne dépend jamais du réseau. RF-20 : la même
 * exigence vaut pour chaque paire de langues outillée (anglais, français).
 */

interface CacheBrut {
  version: number;
  langue: string;
  parCode: Record<string, Array<{ texte: string; motCle: string }>>;
}

const PAIRES: Array<{ langue: LangueCible; cache: CacheBrut }> = [
  { langue: 'en', cache: cacheEn as CacheBrut },
  { langue: 'fr', cache: cacheFr as CacheBrut },
];

function mots(texte: string): string[] {
  return texte.split(/\s+/).filter((m) => m.length > 0);
}

describe.each(PAIRES)('cache $langue', ({ langue, cache }) => {
  const codes = codesPourLangue(langue);

  it('couvre tous les codes de sa taxonomie', () => {
    expect(cache.version).toBe(1);
    expect(cache.langue).toBe(langue);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(Object.keys(cache.parCode), `${langue} : code manquant ${code}`).toContain(code);
    }
  });

  it(`contient exactement ${PHRASES_ENTRAINEMENT} phrases par code`, () => {
    for (const code of codes) {
      expect(cache.parCode[code], `${langue}/${code}`).toHaveLength(PHRASES_ENTRAINEMENT);
    }
  });

  it('ne contient aucun code d’une autre langue', () => {
    for (const cle of Object.keys(cache.parCode)) {
      expect(PHONEMES[cle as CodePhoneme].langueCible, `${cle} dans le cache ${langue}`).toBe(langue);
    }
  });

  it('phrasesManquantes() est vide : aucun repli nécessaire', () => {
    expect(phrasesManquantes(langue)).toEqual([]);
  });

  it('le mot clé est réellement présent dans la phrase', () => {
    for (const code of codes) {
      for (const p of cache.parCode[code]) {
        expect(p.motCle.trim().length, `${code} : motCle vide`).toBeGreaterThan(0);
        expect(
          p.texte.toLowerCase(),
          `${code} : « ${p.motCle} » absent de « ${p.texte} »`,
        ).toContain(p.motCle.toLowerCase());
      }
    }
  });

  it('entre 5 et 12 mots par phrase', () => {
    for (const code of codes) {
      for (const p of cache.parCode[code]) {
        const n = mots(p.texte).length;
        expect(n, `${code} : ${n} mots — « ${p.texte} »`).toBeGreaterThanOrEqual(5);
        expect(n, `${code} : ${n} mots — « ${p.texte} »`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('aucun doublon dans la langue', () => {
    const textes = codes.flatMap((c) => cache.parCode[c].map((p) => p.texte.toLowerCase()));
    expect(new Set(textes).size).toBe(textes.length);
  });

  it('les 3 phrases d’un même code varient les mots clés', () => {
    for (const code of codes) {
      const cles = cache.parCode[code].map((p) => p.motCle.toLowerCase());
      expect(new Set(cles).size, `${langue}/${code} : mots clés répétés`).toBeGreaterThan(1);
    }
  });

  it('ponctuation simple : pas de guillemets typographiques ni d’apostrophe courbe', () => {
    for (const code of codes) {
      for (const p of cache.parCode[code]) {
        expect(p.texte, `${code} : « ${p.texte} »`).not.toMatch(/[’“”«»]/);
      }
    }
  });

  it('ASCII strict pour l’anglais, accents autorisés en français', () => {
    for (const code of codes) {
      for (const p of cache.parCode[code]) {
        if (langue === 'en') {
          expect(/^[\x20-\x7E]*$/.test(p.texte), `${code} : « ${p.texte} »`).toBe(true);
        } else {
          // Latin-1 + Latin étendu A : couvre é, è, ê, à, ù et la ligature œ.
          expect(p.texte, `${code} : « ${p.texte} »`).toMatch(/^[\x20-\x7E\u00C0-\u017F]*$/);
        }
      }
    }
  });
});

describe('chargeur phrasesPour()', () => {
  it('renvoie 3 phrases pour chaque code, dans sa langue', () => {
    for (const { langue } of PAIRES) {
      for (const code of codesPourLangue(langue)) {
        expect(phrasesPour(code, langue), `${langue}/${code}`).toHaveLength(PHRASES_ENTRAINEMENT);
      }
    }
  });

  it('chaque phrase renvoyée porte son code', () => {
    for (const code of codesPourLangue('fr')) {
      for (const p of phrasesPour(code, 'fr')) expect(p.code).toBe(code);
    }
  });

  it('le repli local complète jusqu’à 3 phrases hors cache (langue non outillée)', () => {
    // `es` n'a pas de cache : le repli local prend le relais (§18.2 : la démo ne
    // dépend jamais du réseau ni d'un cache complet).
    const repli = phrasesPour('E01' as CodePhoneme, 'es');
    expect(repli).toHaveLength(PHRASES_ENTRAINEMENT);
    for (const p of repli) expect(p.texte.length).toBeGreaterThan(0);
  });

  it('un code demandé dans la mauvaise langue retombe sur le repli local', () => {
    const repli = phrasesPour('P01' as CodePhoneme, 'fr');
    expect(repli).toHaveLength(PHRASES_ENTRAINEMENT);
    expect(repli[0].motCle).toBe(PHONEMES.P01.motsExemples[0]);
  });
});
