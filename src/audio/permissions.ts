/**
 * Diagnostic du micro — pourquoi le navigateur ne demande rien.
 *
 * Motif réel (12/11) : sur une machine dont PipeWire n'expose **aucune source**
 * (profil audio en sortie seule, aucune entrée branchée), `getUserMedia` échoue
 * en `NotFoundError` **avant** toute demande d'autorisation : la fenêtre de
 * permission n'apparaît jamais. L'app répondait alors « Micro refusé ou
 * indisponible », ce qui ne dit ni pourquoi ni quoi faire.
 *
 * Chaque cause a donc son état, son message et son conseil.
 */

export type EtatMicro =
  | 'pret'
  | 'insecure'
  | 'api-absente'
  | 'aucun-materiel'
  | 'refuse'
  | 'occupe'
  | 'inconnu';

export type EtatPermission = 'granted' | 'denied' | 'prompt' | 'inconnu';

export interface DiagnosticMicro {
  etat: EtatMicro;
  /** Ce qui se passe, en une phrase. */
  message: string;
  /** Ce que l'utilisateur peut faire, en une phrase. */
  conseil: string;
  /** Nombre d'entrées audio vues par le navigateur (0 si inconnu). */
  entrees: number;
  permission: EtatPermission;
  /** true si l'utilisateur peut encore agir dans le navigateur. */
  bloquant: boolean;
}

function diagnostic(
  etat: EtatMicro,
  message: string,
  conseil: string,
  extra: Partial<DiagnosticMicro> = {},
): DiagnosticMicro {
  return {
    etat,
    message,
    conseil,
    entrees: extra.entrees ?? 0,
    permission: extra.permission ?? 'inconnu',
    bloquant: extra.bloquant ?? etat !== 'pret',
  };
}

export const CONSEIL_FICHIER =
  'En attendant, tu peux téléverser un fichier audio : le diagnostic fonctionne pareil.';

/** Le contexte est-il sécurisé ? Sans HTTPS (ou localhost), pas de micro du tout. */
export function contexteSur(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/** L'API existe-t-elle ? (navigateur ancien, iframe sans allow="microphone") */
export function apiMicro(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** État de la permission via l'API Permissions — 'inconnu' si non supportée. */
export async function etatPermission(): Promise<EtatPermission> {
  try {
    const nav = navigator as Navigator & {
      permissions?: { query: (d: { name: string }) => Promise<{ state: string }> };
    };
    if (!nav.permissions?.query) return 'inconnu';
    const p = await nav.permissions.query({ name: 'microphone' });
    if (p.state === 'granted' || p.state === 'denied' || p.state === 'prompt') return p.state;
    return 'inconnu';
  } catch {
    return 'inconnu';
  }
}

/** Nombre d'entrées audio déclarées (les libellés restent vides avant accord). */
export async function compterEntrees(): Promise<number> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 0;
    const appareils = await navigator.mediaDevices.enumerateDevices();
    return appareils.filter((a) => a.kind === 'audioinput').length;
  } catch {
    return 0;
  }
}

/** Vérifications passives : ne déclenche AUCUNE demande d'autorisation. */
export async function diagnostiquerMicro(): Promise<DiagnosticMicro> {
  if (!contexteSur()) {
    return diagnostic(
      'insecure',
      'Le micro exige une connexion sécurisée (HTTPS).',
      'Ouvre le site en https:// — c’est le cas de l’URL publique de démonstration.',
    );
  }
  if (!apiMicro()) {
    return diagnostic(
      'api-absente',
      'Ce navigateur n’expose pas l’API micro.',
      'Essaie Chrome, Edge, Firefox ou Safari récents — ou téléverse un fichier audio.',
    );
  }
  const permission = await etatPermission();
  if (permission === 'denied') {
    return diagnostic(
      'refuse',
      'L’accès au micro est bloqué pour ce site.',
      'Clique sur le cadenas (ou l’icône de réglages) dans la barre d’adresse, autorise le micro, puis recharge la page.',
      { permission },
    );
  }
  // On compte les entrées même avant autorisation : les navigateurs listent les
  // périphériques (libellés masqués tant que l'accès n'est pas accordé). Zéro
  // entrée visible explique pourquoi AUCUNE fenêtre de permission n'apparaîtra :
  // le navigateur n'a rien à demander. C'est un avertissement, pas un blocage —
  // si le navigateur sous-déclare, le bouton « Enregistrer » reste utilisable.
  const entrees = await compterEntrees();
  if (entrees === 0) {
    return diagnostic(
      'aucun-materiel',
      'Aucun micro n’est visible pour le navigateur : il ne demandera donc rien.',
      'Branche un micro ou un casque, puis vérifie les réglages de son du système '
        + '(entrée). Sur un poste fixe, le profil audio est parfois en sortie seule. '
        + CONSEIL_FICHIER,
      { permission, entrees },
    );
  }
  return diagnostic(
    'pret',
    permission === 'granted' ? 'Micro autorisé.' : 'Le micro sera demandé au premier enregistrement.',
    permission === 'granted' ? 'Tu peux enregistrer.' : 'Clique sur « Enregistrer » : le navigateur demandera l’accès.',
    { permission, entrees, bloquant: false },
  );
}

/** Traduit une erreur de `getUserMedia` en diagnostic lisible. */
export function diagnostiquerErreur(erreur: unknown, entrees = 0): DiagnosticMicro {
  const nom = erreur instanceof Error ? erreur.name : '';
  const permission: EtatPermission = nom === 'NotAllowedError' || nom === 'SecurityError' ? 'denied' : 'inconnu';
  switch (nom) {
    case 'NotAllowedError':
    case 'SecurityError':
      return diagnostic(
        'refuse',
        'L’accès au micro a été refusé.',
        'Autorise le micro pour ce site dans la barre d’adresse, puis réessaie. ' + CONSEIL_FICHIER,
        { permission, entrees },
      );
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return diagnostic(
        'aucun-materiel',
        'Aucun micro détecté : le navigateur n’a rien à enregistrer.',
        'Branche un micro ou un casque (ou vérifie Réglages → Son → Entrée du système). ' + CONSEIL_FICHIER,
        { entrees },
      );
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return diagnostic(
        'occupe',
        'Le micro est déjà utilisé par une autre application.',
        'Ferme l’application qui l’occupe (visio, dictée), puis réessaie. ' + CONSEIL_FICHIER,
        { entrees },
      );
    default:
      return diagnostic(
        'inconnu',
        'Le micro n’a pas pu démarrer.',
        `Détail technique : ${nom || 'erreur inconnue'}. ${CONSEIL_FICHIER}`,
        { entrees },
      );
  }
}

/**
 * Demande explicite d'accès : ouvre la fenêtre de permission du navigateur et
 * libère aussitôt le micro. Sert à rendre la demande visible et volontaire,
 * plutôt qu'elle surgisse au milieu d'un enregistrement.
 */
export async function demanderMicro(): Promise<DiagnosticMicro> {
  const passif = await diagnostiquerMicro();
  if (passif.etat !== 'pret') return passif;
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    const entrees = await compterEntrees();
    flux.getTracks().forEach((t) => t.stop());
    return diagnostic('pret', 'Micro autorisé.', 'Tu peux enregistrer.', {
      permission: 'granted',
      entrees,
      bloquant: false,
    });
  } catch (e) {
    return diagnostiquerErreur(e, await compterEntrees());
  }
}
