import type { LangueCible, Profil } from '../types';
import { chargerSessions } from './profile';
import { chargerReglages } from './settings';

/**
 * Écran « Tes données » — la confidentialité rendue VISIBLE et VÉRIFIABLE.
 *
 * L'argument du produit n'est pas une promesse marketing mais une propriété
 * d'architecture : il n'y a pas de backend de données, donc il n'y a rien à
 * fuiter. Chaque déclaration ci-dessous pointe vers le fichier du dépôt public où
 * un juge (ou un élève curieux) peut le vérifier.
 */

export interface Declaration {
  cle: string;
  titre: string;
  reponse: string;
  /** Chemin dans le dépôt où la promesse est vérifiable. */
  preuve: string;
}

export const DECLARATIONS: Declaration[] = [
  {
    cle: 'audio',
    titre: 'Ta voix n’est jamais conservée',
    reponse:
      'L’audio est converti en mémoire, envoyé pour être analysé, puis libéré. Rien n’est écrit : ni sur ton appareil, ni sur un serveur.',
    preuve: 'src/audio/capture.ts (oublier) · src/engine/pipeline.ts',
  },
  {
    cle: 'journal',
    titre: 'Le serveur ne note ni ta voix ni ton texte',
    reponse:
      'Le journal du proxy contient uniquement horodatage, méthode, chemin, statut, durée et adresse IP tronquée. Jamais l’audio, jamais la phrase.',
    preuve: 'server/lib.mjs (ligneJournal, anonymiserIp)',
  },
  {
    cle: 'biometrie',
    titre: 'Aucune donnée biométrique dérivée',
    reponse:
      'Aucune empreinte vocale, aucune identification du locuteur, aucun embedding n’est calculé ni stocké. Seuls des scores par phonème sont gardés.',
    preuve: 'src/types.ts (Session, Profil) · docs/CONFIDENTIALITE.md',
  },
  {
    cle: 'export',
    titre: 'Exportable et supprimable en un clic',
    reponse:
      'Ton profil de sons s’exporte en Markdown et s’efface entièrement depuis cet écran, sans compte ni demande.',
    preuve: 'src/store/profile.ts (exporterMarkdown, toutEffacer)',
  },
  {
    cle: 'mention',
    titre: 'Tu es prévenu au moment d’enregistrer',
    reponse:
      'La mention « Ta voix n’est pas conservée. Elle ne sert qu’à te corriger. » est affichée à l’écran, pas seulement dans une page web.',
    preuve: 'src/screens/Accueil.tsx · src/screens/Enregistrement.tsx',
  },
  {
    cle: 'compte',
    titre: 'Pas de compte, pas d’identité demandée',
    reponse:
      'Aucun nom, aucun e-mail, aucun âge, aucun établissement. L’app ne sait pas qui tu es.',
    preuve: 'src/store/settings.ts (aucun champ d’identité)',
  },
  {
    cle: 'byok',
    titre: 'Ta clé API reste chez toi',
    reponse:
      'En mode BYOK, la clé Azure est stockée dans ton navigateur et part directement chez Microsoft. Elle ne transite jamais par notre proxy.',
    preuve: 'src/providers/azure.ts · src/store/settings.ts',
  },
  {
    cle: 'score-global',
    titre: 'Jamais de score global, jamais de classement',
    reponse:
      'L’app ne calcule aucune note d’ensemble et ne te compare à personne. C’est vérifié par un garde automatique dans la chaîne d’intégration.',
    preuve: '.github/workflows/ci.yml (garde « aucun score global »)',
  },
  {
    cle: 'objectif',
    titre: 'Être compréhensible, pas « natif »',
    reponse:
      'L’objectif affiché est l’intelligibilité. Rien dans l’app ne laisse entendre qu’un accent est une faute.',
    preuve: 'src/data/phonemes.ts (conseils) · docs/WRITE-UP.fr.md',
  },
];

/** Ce qui n'est jamais collecté — liste explicite, pas de formule vague. */
export const JAMAIS_COLLECTE: string[] = [
  'ta voix (aucun enregistrement audio n’est écrit)',
  'ton nom, ton e-mail, ton âge',
  'ton établissement ou ton professeur',
  'une empreinte vocale ou toute donnée biométrique dérivée',
  'ta position géographique',
  'un identifiant publicitaire ou un cookie de suivi',
];

export interface EtatDonnees {
  /** Clés présentes dans localStorage et leur taille en octets. */
  cles: Array<{ cle: string; octets: number }>;
  octetsTotal: number;
  sessions: number;
  phonemesTravailles: number;
  byokPresent: boolean;
  langue: LangueCible;
}

function tailleCle(cle: string): number {
  try {
    return new TextEncoder().encode(localStorage.getItem(cle) ?? '').length;
  } catch {
    return 0;
  }
}

/**
 * Fait l'inventaire réel de ce qui est stocké — SANS jamais exposer le contenu
 * sensible (la clé BYOK n'est signalée que par sa présence).
 */
export function inventorier(profil: Profil): EtatDonnees {
  const cles: Array<{ cle: string; octets: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (!cle || !cle.startsWith('accent.')) continue;
      cles.push({ cle, octets: tailleCle(cle) });
    }
  } catch {
    /* environnement sans localStorage : inventaire vide */
  }
  const reglages = chargerReglages();
  const travailles = Object.values(profil.parPhoneme).filter((p) => (p?.tentatives ?? 0) > 0);
  return {
    cles,
    octetsTotal: cles.reduce((a, c) => a + c.octets, 0),
    sessions: chargerSessions().length,
    phonemesTravailles: travailles.length,
    byokPresent: reglages.cleAzure.length > 0,
    langue: reglages.langueCible,
  };
}

/** Résumé en phrases lisibles par un adolescent — jamais de contenu sensible. */
export function resume(etat: EtatDonnees): string[] {
  const lignes: string[] = [];
  if (etat.cles.length === 0) {
    lignes.push('Rien n’est stocké pour l’instant : tu n’as pas encore fait de séance.');
    return lignes;
  }
  lignes.push(
    `${etat.cles.length} entrée${etat.cles.length > 1 ? 's' : ''} dans ce navigateur, ` +
      `${(etat.octetsTotal / 1024).toFixed(1)} Ko au total.`,
  );
  lignes.push(`${etat.sessions} séance${etat.sessions > 1 ? 's' : ''} enregistrée${etat.sessions > 1 ? 's' : ''}.`);
  lignes.push(`${etat.phonemesTravailles} son${etat.phonemesTravailles > 1 ? 's' : ''} travaillé${etat.phonemesTravailles > 1 ? 's' : ''}.`);
  lignes.push(
    etat.byokPresent
      ? 'Une clé API personnelle est enregistrée ici (elle n’apparaît jamais dans ce résumé).'
      : 'Aucune clé API personnelle enregistrée.',
  );
  lignes.push('Aucun audio, aucune empreinte vocale : uniquement des scores et des dates.');
  return lignes;
}

/** Lien vers le code public qui prouve la déclaration (dépôt + ligne de l'arborescence). */
export function urlPreuve(preuve: string, depot = 'https://github.com/Tradoooo/accent'): string {
  const chemin = preuve.split(' ')[0].replace(/[·()]/g, '');
  return `${depot}/blob/main/${chemin}`;
}
