import { LOCALES } from '../providers';
import type { LangueCible } from '../types';

/**
 * Audio modèle (RF-23) — synthèse vocale du navigateur.
 *
 * Choix assumé : `window.speechSynthesis`, pas une API TTS payante ni des
 * fichiers audio commités. Budget 0 $ (RNF-10), bundle inchangé (RNF-07), et
 * l'élève peut comparer son son au modèle **ralenti** (0,5×) sans réseau.
 *
 * Limites honnêtes : la qualité des voix dépend de l'appareil, et certaines
 * plateformes n'exposent aucune voix hors ligne. `disponible()` et `voixPour()`
 * permettent à l'UI de le dire plutôt que de faire semblant.
 */

export interface OptionsParole {
  langue: LangueCible;
  /** 0,5 = ralenti (défaut du composant), 1 = vitesse normale. */
  debit?: number;
  pitch?: number;
  volume?: number;
}

let enCours: SpeechSynthesisUtterance | null = null;

/** L'API existe-t-elle ici (navigateur, pas jsdom sans polyfill) ? */
export function disponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Meilleure voix pour la langue : exacte, puis même préfixe, puis null. */
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
  if (!disponible()) return;
  enCours = null;
  window.speechSynthesis.cancel();
}

/** Lit le texte et résout à la fin (ou au rejet si la synthèse est absente). */
export function parler(texte: string, opts: OptionsParole): Promise<void> {
  if (!disponible()) return Promise.reject(new Error('Synthèse vocale indisponible'));
  const propre = texte.trim();
  if (!propre) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    arret();
    const u = new SpeechSynthesisUtterance(propre);
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

/** Utterance en cours (pour les tests et l'état de l'UI). */
export function courant(): SpeechSynthesisUtterance | null {
  return enCours;
}
