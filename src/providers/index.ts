import type { FournisseurPrononciation, LangueCible } from '../types';
import { fournisseurDemo } from './demo';
import { fournisseurProxy } from './proxy';
import { fournisseurAzure } from './azure';
import type { Reglages } from '../store/settings';

/**
 * Choix du fournisseur — RNF-09 (dégradation gracieuse).
 *
 * Ordre : BYOK si une clé est collée (le juge teste même quota épuisé),
 * sinon le proxy (clé cachée, quota borné), sinon le moteur local de
 * démonstration — toujours signalé « simulation » à l'écran.
 */

export function fournisseurSelonReglages(r: Reglages): FournisseurPrononciation {
  if (r.cleAzure && r.regionAzure) {
    return fournisseurAzure({
      cle: r.cleAzure,
      region: r.regionAzure,
      langue: LOCALES[r.langueCible],
    });
  }
  if (r.urlProxy) {
    return fournisseurProxy({ url: r.urlProxy, jeton: r.jetonProxy });
  }
  return fournisseurDemo;
}

/** Repli explicite quand le proxy répond 429 ou est injoignable. */
export function repliSurDemo(): FournisseurPrononciation {
  return fournisseurDemo;
}

export const FOURNISSEURS = { demo: fournisseurDemo, proxy: fournisseurProxy, azure: fournisseurAzure };

/** Paires de langues réellement outillées (taxonomie + cache de phrases). */
export const LANGUES: Array<{ code: LangueCible; label: string; pret: boolean }> = [
  { code: 'en', label: 'Français → Anglais', pret: true },
  { code: 'fr', label: 'Espagnol → Français', pret: true },
  { code: 'es', label: 'Anglais → Espagnol', pret: false },
];

/** Locale attendue par l'API d'évaluation pour chaque langue cible. */
export const LOCALES: Record<LangueCible, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};
