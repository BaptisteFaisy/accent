// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { fournisseurProxy } from '../src/providers/proxy';
import { encoderWav } from '../src/audio/wav';
import { TAUX_ECHANTILLONNAGE } from '../src/constants';
import type { AnalyseEntree } from '../src/types';

/**
 * Le client du proxy doit survivre à tous les hébergements : proxy edge réel,
 * proxy sans clé, quota épuisé, et hébergement purement statique (GitHub Pages)
 * où `/api/analyse` n'existe pas. Dans tous les cas sauf le quota, on retombe
 * sur le moteur local — signalé `simule: true`, donc badge « simulation ».
 */

const entree: AnalyseEntree = {
  audio: encoderWav(new Float32Array(TAUX_ECHANTILLONNAGE * 2).fill(0.2), TAUX_ECHANTILLONNAGE),
  texte: 'I think this is the right thing.',
  langueCible: 'en',
};

const fetchOriginal = globalThis.fetch;

function fetchFaux(reponse: () => Response | Promise<Response>) {
  globalThis.fetch = (async () => reponse()) as unknown as typeof fetch;
}

function reponseJson(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('client proxy — hébergement statique et pannes', () => {
  it('404 (pas de proxy, ex. GitHub Pages) → moteur local, repli tracé', async () => {
    fetchFaux(() => reponseJson(404, { erreur: 'introuvable' }));
    const sortie = await fournisseurProxy({ url: '' }).analyse(entree);
    expect(sortie.simule).toBe(true);
    expect((sortie.brut as { repli: string }).repli).toBe('proxy-http-404');
    expect(sortie.scores.length).toBeGreaterThan(0);
  });

  it('réseau coupé → moteur local, repli « proxy-injoignable »', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const sortie = await fournisseurProxy({ url: 'https://proxy.inexistant' }).analyse(entree);
    expect(sortie.simule).toBe(true);
    expect((sortie.brut as { repli: string }).repli).toBe('proxy-injoignable');
  });

  it('proxy sans clé (scores vides) → moteur local', async () => {
    fetchFaux(() => reponseJson(200, { scores: [], provider: 'proxy-sans-cle', simule: true }));
    const sortie = await fournisseurProxy({ url: '' }).analyse(entree);
    expect(sortie.simule).toBe(true);
    expect((sortie.brut as { repli: string }).repli).toBe('proxy-sans-cle');
  });

  it('quota épuisé (429) → erreur explicite qui propose le BYOK, pas de repli silencieux', async () => {
    fetchFaux(() => reponseJson(429, { erreur: 'quota', byok: true }));
    await expect(fournisseurProxy({ url: '' }).analyse(entree)).rejects.toThrow(/BYOK/);
  });
});

describe('client proxy — réponse nominale', () => {
  it('rattache l’IPA renvoyé par le proxy à la taxonomie locale', async () => {
    fetchFaux(() =>
      reponseJson(200, {
        scores: [
          { code: null, ipa: 'θ', mot: 'think', indexMot: 1, score: 34 },
          { code: null, ipa: 'zzz', mot: 'xyz', indexMot: 2, score: 90 },
        ],
        provider: 'azure',
        simule: false,
        quota: { reste: 12, limite: 200 },
      }),
    );
    const sortie = await fournisseurProxy({ url: '' }).analyse(entree);
    expect(sortie.simule).toBe(false);
    expect(sortie.provider).toBe('azure');
    expect(sortie.scores[0].code).toBe('P01');
    expect(sortie.scores[1].code).toBeNull();
    expect(sortie.brut).toEqual({ reste: 12, limite: 200 });
  });
});
