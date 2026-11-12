import { LOCALES } from '../providers';
import type { LangueCible } from '../types';
import type { MoteurTts } from '../store/settings';

/**
 * Audio modèle (RF-23) — la voix de référence que l'élève compare à la sienne.
 *
 * Deux moteurs, au choix de l'utilisateur :
 *
 * 1. **le navigateur** (`window.speechSynthesis`) — par défaut : 0 $, hors ligne,
 *    rien ne sort de la machine, aucune clé à gérer. C'est aussi le mode le plus
 *    respectueux de la vie privée : le texte ne part nulle part.
 * 2. **Eleven Labs** (BYOK) — voix multilingue beaucoup plus naturelle
 *    (`eleven_multilingual_v2`), utile pour faire entendre un mot dans une autre
 *    langue que celle du système. La clé reste dans le navigateur et n'est
 *    envoyée qu'à Eleven Labs.
 *
 * **Ce qui part chez Eleven Labs : le TEXTE seulement.** Jamais l'audio de
 * l'élève (c'est le fournisseur qui synthétise, il n'entend rien) — la privacy
 * tient (RNF-P1..P3).
 *
 * Le ralenti (0,5× / 0,75×) est demandé à Eleven Labs via `voice_settings.speed`
 * (borné à 0,7 par l'API) et complété par `playbackRate` côté client : le timbre
 * bouge le moins possible.
 */

export interface OptionsParole {
  langue: LangueCible;
  /** 0,5 = ralenti (défaut du composant), 1 = vitesse normale. */
  debit?: number;
  pitch?: number;
  volume?: number;
  /** Moteur choisi dans les réglages. */
  moteur?: MoteurTts;
  /** Clé Eleven Labs (mode BYOK). */
  cle?: string;
  /** Identifiant de voix Eleven Labs. */
  voix?: string;
}

const BASE_ELEVEN = 'https://api.elevenlabs.io/v1';
const MODELE_MULTILINGUE = 'eleven_multilingual_v2';

let enCours: SpeechSynthesisUtterance | null = null;
let audioEnCours: HTMLAudioElement | null = null;

/** L'API existe-t-elle ici (navigateur, pas jsdom sans polyfill) ? */
export function disponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Meilleure voix du navigateur pour la langue : exacte, puis même préfixe, puis null. */
export function voixPour(langue: LangueCible): SpeechSynthesisVoice | null {
  if (!disponible()) return null;
  const locale = LOCALES[langue];
  const voix = window.speechSynthesis.getVoices();
  if (!voix.length) return null;
  const exacte = voix.find((v) => v.lang.toLowerCase() === locale.toLowerCase());
  if (exacte) return exacte;
  const prefixe = voix.find((v) => v.lang.toLowerCase().startsWith(locale.slice(0, 2)));
  return prefixe ?? null;
}

export function arret(): void {
  enCours = null;
  if (audioEnCours) {
    audioEnCours.pause();
    audioEnCours = null;
  }
  if (disponible()) window.speechSynthesis.cancel();
}

/** Lit le texte avec la voix du navigateur. */
function parlerNavigateur(texte: string, opts: OptionsParole): Promise<void> {
  if (!disponible()) return Promise.reject(new Error('Synthèse vocale indisponible'));
  return new Promise<void>((resolve, reject) => {
    arret();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = LOCALES[opts.langue];
    u.rate = opts.debit ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = opts.volume ?? 1;
    const voix = voixPour(opts.langue);
    if (voix) u.voice = voix;
    u.onend = () => {
      enCours = null;
      resolve();
    };
    u.onerror = (e) => {
      enCours = null;
      reject(new Error(`Synthèse vocale : ${e.error}`));
    };
    enCours = u;
    window.speechSynthesis.speak(u);
  });
}

/** Message d'erreur lisible pour un code HTTP d'Eleven Labs. */
export function messageErreurEleven(statut: number): string {
  switch (statut) {
    case 401:
      return 'Clé Eleven Labs refusée (401). Vérifie la clé dans les réglages.';
    case 402:
      return 'Crédits Eleven Labs épuisés (402). Le quota gratuit est de 10 000 caractères par mois.';
    case 429:
      return 'Trop de requêtes Eleven Labs (429). Réessaie dans un instant.';
    case 404:
      return 'Voix Eleven Labs introuvable (404). Choisis une autre voix.';
    default:
      return `Eleven Labs : HTTP ${statut}.`;
  }
}

/** Parle avec Eleven Labs (BYOK). Le TEXTE part chez eux, l'audio de l'élève non. */
export async function parlerElevenLabs(
  texte: string,
  opts: OptionsParole & { cle: string; voix?: string },
): Promise<void> {
  const propre = texte.trim();
  if (!propre) return;
  if (!opts.cle) throw new Error('Aucune clé Eleven Labs : ajoute-la dans les réglages.');

  const debit = opts.debit ?? 1;
  const vitesseEnvoyee = Math.max(0.7, Math.min(1.2, debit));
  const res = await fetch(`${BASE_ELEVEN}/text-to-speech/${encodeURIComponent(opts.voix ?? '')}`, {
    method: 'POST',
    headers: {
      'xi-api-key': opts.cle,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: propre,
      model_id: MODELE_MULTILINGUE,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
        speed: vitesseEnvoyee,
      },
    }),
  });
  if (!res.ok) throw new Error(messageErreurEleven(res.status));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = debit / vitesseEnvoyee;
  audioEnCours = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      audioEnCours = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      audioEnCours = null;
      URL.revokeObjectURL(url);
      reject(new Error('Lecture du son Eleven Labs impossible'));
    };
    void audio.play().catch((e) => {
      audioEnCours = null;
      URL.revokeObjectURL(url);
      reject(new Error(`Lecture impossible : ${String(e).slice(0, 80)}`));
    });
  });
}

/**
 * Lit le texte et résout à la fin. Choit du moteur : Eleven Labs si une clé est
 * fournie, sinon la voix du navigateur (qui ne demande rien à personne).
 */
export function parler(texte: string, opts: OptionsParole): Promise<void> {
  const propre = texte.trim();
  if (!propre) return Promise.resolve();
  if (opts.moteur === 'eleven' && opts.cle) {
    return parlerElevenLabs(propre, { ...opts, cle: opts.cle });
  }
  return parlerNavigateur(propre, opts);
}

export interface VoixEleven {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
}

/**
 * Retrouve la voix demandée dans le compte Eleven Labs.
 *
 * « la voix de Laure » : la recherche est insensible à la casse ET aux accents
 * (« Laure », « laura », « Laure. »), et elle accepte aussi les voix clonées
 * du compte, pas seulement la bibliothèque Eleven Labs. Si la voix n'existe pas,
 * on renvoie null et l'UI le dit — on ne devine pas.
 */
export function trouverVoix(voix: VoixEleven[], nom: string): VoixEleven | null {
  const cible = normaliser(nom);
  if (!cible) return null;
  const exacte = voix.find((v) => normaliser(v.name) === cible);
  if (exacte) return exacte;
  // Préfixe de 4 caractères : « Laura » (voix Eleven Labs) et « Laure » (voix
  // clonée) ne diffèrent que d'une lettre — on ne veut pas obliger à deviner.
  if (cible.length >= 4) {
    const prefixe = cible.slice(0, 4);
    const partiel = voix.find((v) => normaliser(v.name).startsWith(prefixe));
    if (partiel) return partiel;
  }
  return null;
}

function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Voix disponibles dans le compte Eleven Labs (nécessite la clé). */
export async function voixElevenLabs(cle: string): Promise<VoixEleven[]> {
  if (!cle) return [];
  const res = await fetch(`${BASE_ELEVEN}/voices`, { headers: { 'xi-api-key': cle } });
  if (!res.ok) throw new Error(messageErreurEleven(res.status));
  const data = (await res.json()) as { voices?: VoixEleven[] };
  return data.voices ?? [];
}

/** Utterance en cours (pour les tests et l'état de l'UI). */
export function courant(): SpeechSynthesisUtterance | null {
  return enCours;
}
