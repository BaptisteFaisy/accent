import { describe, expect, it } from 'vitest';
import { desenregistrer, enregistrerServiceWorker, serviceWorkerDisponible } from './pwa';

/**
 * L'enregistrement du SW doit être strictement défensif : un navigateur sans
 * serviceWorker (ou jsdom en test) ne doit jamais faire échouer l'app.
 */

describe('pwa', () => {
  it('jsdom ne fournit pas serviceWorker → détecté comme indisponible', () => {
    expect(serviceWorkerDisponible()).toBe(false);
  });

  it('enregistrerServiceWorker résout false sans API, et ne lève jamais', async () => {
    await expect(enregistrerServiceWorker()).resolves.toBe(false);
  });

  it('desenregistrer ne lève pas sans API', async () => {
    await expect(desenregistrer()).resolves.toBeUndefined();
  });

  it('avec une API simulée mais un environnement de dev : aucun enregistrement', async () => {
    const registre: string[] = [];
    const original = (navigator as unknown as Record<string, unknown>).serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: (url: string) => {
          registre.push(url);
          return Promise.resolve({});
        },
        getRegistrations: () => Promise.resolve([]),
      },
    });
    expect(serviceWorkerDisponible()).toBe(true);
    // import.meta.env.PROD est faux sous vitest : on n'enregistre jamais en dev.
    await expect(enregistrerServiceWorker()).resolves.toBe(false);
    expect(registre).toEqual([]);
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: original });
  });
});
