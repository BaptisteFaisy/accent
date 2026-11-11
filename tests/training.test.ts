import { describe, expect, it } from 'vitest';
import cache from '../src/data/training.json';
import { phrasesManquantes, phrasesPour } from '../src/data/training';
import { CODES_PHONEMES } from '../src/data/phonemes';
import { PHRASES_ENTRAINEMENT } from '../src/constants';
import type { CodePhoneme } from '../src/types';

/**
 * RF-08 et §18.2 étape 5 : trois phrases d'entraînement par phonème, servies
 * par le cache commité — la démo ne dépend jamais du réseau.
 */

interface CacheBrut {
  version: number;
  langue: string;
  parCode: Record<string, Array<{ texte: string; motCle: string }>>;
}

const C = cache as CacheBrut;

function mots(texte: string): string[] {
  return texte.split(/\s+/).filter((m) => m.length > 0);
}

describe('cache des phrases d’entraînement', () => {
  it('couvre les 15 codes de la taxonomie', () => {
    expect(C.version).toBe(1);
    expect(C.langue).toBe('en');
    for (const code of CODES_PHONEMES) {
      expect(Object.keys(C.parCode), `code manquant : ${code}`).toContain(code);
    }
  });

  it(`contient exactement ${PHRASES_ENTRAINEMENT} phrases par code`, () => {
    for (const code of CODES_PHONEMES) {
      expect(C.parCode[code], code).toHaveLength(PHRASES_ENTRAINEMENT);
    }
  });

  it('phrasesManquantes() est vide : aucun repli nécessaire', () => {
    expect(phrasesManquantes()).toEqual([]);
  });
});

describe('contenu de chaque phrase', () => {
  const toutes = CODES_PHONEMES.flatMap((code) =>
    (C.parCode[code] ?? []).map((p) => ({ code, ...p })),
  );

  it('le mot clé est réellement présent dans la phrase', () => {
    for (const p of toutes) {
      expect(p.motCle.trim().length, `${p.code} : motCle vide`).toBeGreaterThan(0);
      const minuscule = p.texte.toLowerCase();
      expect(minuscule, `${p.code} : « ${p.motCle} » absent de « ${p.texte} »`).toContain(
        p.motCle.toLowerCase(),
      );
    }
  });

  it('texte ASCII uniquement, sans guillemet typographique', () => {
    for (const p of toutes) {
      expect(/^[\x20-\x7E]*$/.test(p.texte), `${p.code} : « ${p.texte} »`).toBe(true);
    }
  });

  it('entre 5 et 12 mots par phrase', () => {
    for (const p of toutes) {
      const n = mots(p.texte).length;
      expect(n, `${p.code} : ${n} mots — « ${p.texte} »`).toBeGreaterThanOrEqual(5);
      expect(n, `${p.code} : ${n} mots — « ${p.texte} »`).toBeLessThanOrEqual(12);
    }
  });

  it('aucun doublon, tous codes confondus', () => {
    const textes = toutes.map((p) => p.texte.toLowerCase());
    expect(new Set(textes).size).toBe(textes.length);
  });

  it('les 3 phrases d’un même code varient les mots clés', () => {
    for (const code of CODES_PHONEMES) {
      const cles = (C.parCode[code] ?? []).map((p) => p.motCle.toLowerCase());
      expect(new Set(cles).size, `${code} : mots clés répétés`).toBeGreaterThan(1);
    }
  });
});

describe('chargeur phrasesPour()', () => {
  it('renvoie 3 phrases pour chacun des 15 codes', () => {
    for (const code of CODES_PHONEMES) {
      expect(phrasesPour(code), code).toHaveLength(PHRASES_ENTRAINEMENT);
    }
  });

  it('chaque phrase renvoyée porte son code', () => {
    for (const code of CODES_PHONEMES) {
      for (const p of phrasesPour(code)) expect(p.code).toBe(code);
    }
  });

  it('le repli local complète jusqu’à 3 phrases hors cache (langue non mise en cache)', () => {
    // `fr` n'est pas dans le cache : on exerce volontairement le repli (§18.2 :
    // la démo ne doit jamais dépendre du réseau ni d'un cache complet).
    const repli = phrasesPour('P01' as CodePhoneme, 'fr');
    expect(repli).toHaveLength(PHRASES_ENTRAINEMENT);
    for (const p of repli) expect(p.texte.length).toBeGreaterThan(0);
  });
});
