import { afterEach, describe, expect, it } from 'vitest';
import { executerPipeline } from '../src/engine/pipeline';
import { phrasesPour } from '../src/data/training';
import { CODES_PHONEMES } from '../src/data/phonemes';
import { PHRASES_ENTRAINEMENT } from '../src/constants';
import type { Lecture } from '../src/engine/pipeline';
import { fournisseurEspion, lectureSynthetique, scoreDe, wavDe } from './aides';

/**
 * §25-6 : « 3 phrases d'entraînement s'affichent pour le phonème cible, même
 * hors ligne (cache) ». La preuve est radicale : `globalThis.fetch` est
 * remplacé par une fonction qui lève — tout appel réseau ferait échouer le test.
 */

const PHRASE = 'I think this is the right thing.';

let fetchOriginal: typeof globalThis.fetch | undefined;
let appelsReseau = 0;

function couperLeReseau(): void {
  fetchOriginal = globalThis.fetch;
  appelsReseau = 0;
  globalThis.fetch = (() => {
    appelsReseau += 1;
    throw new Error('réseau interdit par le test §25-6');
  }) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  if (fetchOriginal === undefined) {
    delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
  } else {
    globalThis.fetch = fetchOriginal;
  }
  fetchOriginal = undefined;
});

describe('§25-6 — trois phrases d’entraînement SANS réseau', () => {
  it('§25-6 : phrasesPour renvoie 3 phrases pour chacun des 15 codes, fetch coupé', () => {
    couperLeReseau();
    expect(CODES_PHONEMES).toHaveLength(15);
    for (const code of CODES_PHONEMES) {
      const phrases = phrasesPour(code);
      expect(phrases, `${code} : nombre de phrases`).toHaveLength(PHRASES_ENTRAINEMENT);
      for (const p of phrases) {
        expect(p.code, `${code} : phrase mal étiquetée`).toBe(code);
        expect(p.texte.length, `${code} : phrase vide`).toBeGreaterThan(0);
        expect(p.motCle.length, `${code} : mot clé vide`).toBeGreaterThan(0);
      }
    }
    expect(appelsReseau).toBe(0);
  });

  it('§25-6 : le repli local fonctionne aussi quand la langue n’est pas en cache', () => {
    couperLeReseau();
    for (const code of CODES_PHONEMES) {
      expect(phrasesPour(code, 'es'), `${code} en es`).toHaveLength(PHRASES_ENTRAINEMENT);
    }
    expect(appelsReseau).toBe(0);
  });

  it('§25-6 : executerPipeline renvoie 3 phrases pour la cible, fetch coupé', async () => {
    couperLeReseau();
    const signal = lectureSynthetique(6);
    const wav = wavDe(signal);
    const lectures: Lecture[] = [1, 2, 3].map(() => ({ audio: wav, dureeMs: 2500 }));
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures,
      fournisseur: fournisseurEspion([[scoreDe('P01', 'think', 1, 32)]]),
    });

    expect(resultat.diagnostic.cible?.code).toBe('P01');
    expect(resultat.phrases).toHaveLength(PHRASES_ENTRAINEMENT);
    for (const p of resultat.phrases) expect(p.code).toBe('P01');
    expect(appelsReseau).toBe(0);
  });

  it('§25-6 : le fournisseur de démo sert aussi ses phrases hors ligne', async () => {
    couperLeReseau();
    const { fournisseurDemo } = await import('../src/providers/demo');
    for (const code of CODES_PHONEMES) {
      const phrases = await fournisseurDemo.phrases(code, 'en');
      expect(phrases, code).toHaveLength(PHRASES_ENTRAINEMENT);
    }
    expect(appelsReseau).toBe(0);
  });
});
