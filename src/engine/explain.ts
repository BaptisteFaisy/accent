import type { Cible, EntreePhoneme } from '../types';

/**
 * Étape 4 « Explique » — ACCENT.md §18.2.
 *
 * Zéro appel réseau, zéro modèle : tout vient de la table des 15 phonèmes.
 * C'est ce qui rend le diagnostic instantané, gratuit, hors ligne et testable.
 * La connaissance pédagogique est de la donnée versionnée, pas une génération.
 */

export interface Explication {
  ipa: string;
  ipaProduit: string | null;
  transformation: string;
  paire: [string, string] | null;
  signature: string;
  conseil: string;
  difficulte: 1 | 2 | 3;
  positionnel: boolean;
  accentuation?: EntreePhoneme['accentuation'];
}

export function expliquer(cible: Cible): Explication {
  const e = cible.entree;
  const produit = cible.produitIpa ?? e.produitComme[0] ?? null;
  return {
    ipa: e.ipa,
    ipaProduit: produit,
    transformation: produit ? `/${e.ipa}/ → /${produit}/` : `/${e.ipa}/ absent`,
    paire: e.pairesMinimales[0] ?? null,
    signature: e.signature,
    conseil: e.conseil,
    difficulte: e.difficulte,
    positionnel: e.nature === 'positionnel',
    accentuation: e.accentuation,
  };
}

/** Paire minimale la plus proche du mot réellement prononcé, sinon la première. */
export function pairePour(cible: Cible): [string, string] | null {
  const mot = cible.mot.toLowerCase();
  const trouve = cible.entree.pairesMinimales.find(
    ([a, b]) => a.toLowerCase() === mot || b.toLowerCase() === mot,
  );
  return trouve ?? cible.entree.pairesMinimales[0] ?? null;
}
