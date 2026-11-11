import type { LangueCible } from '../types';
import { LECTURES_REFERENCE } from '../constants';

/**
 * Réglages locaux (écran 8). Jamais de serveur : tout vit dans le navigateur.
 * La clé BYOK est stockée en localStorage et n'est envoyée qu'au fournisseur
 * choisi — jamais à notre proxy (ACCENT.md §18.3).
 */

export interface Reglages {
  /** Base du proxy edge. Vide = même origine (`/api/analyse`). */
  urlProxy: string;
  jetonProxy?: string;
  /** Mode BYOK : clé Azure Speech de l'utilisateur. */
  cleAzure: string;
  regionAzure: string;
  langueCible: LangueCible;
  /** 3 lectures pour conclure, 1 en mode essai rapide (§18.4). */
  lectures: number;
  consentementAffiche: boolean;
}

const CLE = 'accent.reglages.v1';

export const REGLAGES_DEFAUT: Reglages = {
  urlProxy: '',
  cleAzure: '',
  regionAzure: 'westeurope',
  langueCible: 'en',
  lectures: LECTURES_REFERENCE,
  consentementAffiche: false,
};

export function chargerReglages(): Reglages {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { ...REGLAGES_DEFAUT };
    return { ...REGLAGES_DEFAUT, ...(JSON.parse(brut) as Partial<Reglages>) };
  } catch {
    return { ...REGLAGES_DEFAUT };
  }
}

export function enregistrerReglages(r: Reglages): void {
  localStorage.setItem(CLE, JSON.stringify(r));
}

/** Efface aussi la clé BYOK : suppression en un clic (RNF-P4). */
export function effacerReglages(): void {
  localStorage.removeItem(CLE);
}
