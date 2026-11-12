/**
 * Enregistrement du service worker (PWA, RNF-08).
 *
 * Volontairement minimal et défensif :
 *  - uniquement en production (en dev, Vite et le SW se marchent dessus) ;
 *  - uniquement si l'API existe (navigateurs anciens, tests jsdom) ;
 *  - tout échec est silencieux : un SW absent ne doit jamais empêcher l'app de
 *    tourner, le produit fonctionne parfaitement sans lui.
 */

const CHEMIN_SW = 'sw.js';

/** L'API est-elle disponible ici ? */
export function serviceWorkerDisponible(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in window.navigator &&
    typeof window.navigator.serviceWorker.register === 'function'
  );
}

/** Enregistre le SW. Ne lève jamais d'exception. */
export function enregistrerServiceWorker(chemin = CHEMIN_SW): Promise<boolean> {
  if (!serviceWorkerDisponible()) return Promise.resolve(false);
  const production = typeof import.meta !== 'undefined' && import.meta.env?.PROD === true;
  if (!production) return Promise.resolve(false);
  return window.navigator.serviceWorker
    .register(new URL(chemin, window.location.href).href, { scope: './' })
    .then(() => true)
    .catch(() => false);
}

/** Désenregistrement complet + purge des caches (utile en dev et pour les tests). */
export async function desenregistrer(): Promise<void> {
  if (!serviceWorkerDisponible()) return;
  try {
    const regs = await window.navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) {
      const cles = await window.caches.keys();
      await Promise.all(cles.map((c) => window.caches.delete(c)));
    }
  } catch {
    /* rien à faire : c'est un nettoyage de confort */
  }
}
