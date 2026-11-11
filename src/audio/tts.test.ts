import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../providers';

/**
 * RF-23 — synthèse vocale du navigateur. Tout est bouchonné : aucun son réel,
 * aucun réseau. jsdom ne fournit pas speechSynthesis, donc on l'installe.
 */

interface UtteranceFaux {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

class UtteranceFauxImpl implements UtteranceFaux {
  text = '';

  lang = '';

  rate = 1;

  pitch = 1;

  volume = 1;

  voice: unknown = null;

  onend: (() => void) | null = null;

  onerror: ((e: { error: string }) => void) | null = null;

  constructor(texte: string) {
    this.text = texte;
  }
}

let parles: UtteranceFaux[] = [];
let annulations = 0;
let voix: Array<{ lang: string; name: string }> = [];

function installer(avecVoix = true) {
  parles = [];
  annulations = 0;
  voix = avecVoix
    ? [
        { lang: 'en-GB', name: 'British' },
        { lang: 'en-US', name: 'American' },
        { lang: 'fr-FR', name: 'Francais' },
      ]
    : [];
  const faux = {
    getVoices: () => voix,
    speak: (u: UtteranceFaux) => parles.push(u),
    cancel: () => {
      annulations += 1;
    },
    pending: false,
    speaking: false,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: faux, configurable: true });
  (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance = UtteranceFauxImpl;
}

function desinstaller() {
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
}

beforeEach(() => installer());
afterEach(() => desinstaller());

describe('disponible()', () => {
  it('vrai quand l’API est présente', async () => {
    const { disponible } = await import('./tts');
    expect(disponible()).toBe(true);
  });

  it('faux quand l’API est absente', async () => {
    desinstaller();
    const { disponible } = await import('./tts');
    expect(disponible()).toBe(false);
  });
});

describe('voixPour()', () => {
  it('préfère la locale exacte', async () => {
    const { voixPour } = await import('./tts');
    expect(voixPour('en')?.name).toBe('American');
    expect(voixPour('fr')?.name).toBe('Francais');
  });

  it('retombe sur le préfixe de langue', async () => {
    installer();
    voix = [{ lang: 'fr-CA', name: 'Quebec' }];
    const { voixPour } = await import('./tts');
    expect(voixPour('fr')?.name).toBe('Quebec');
  });

  it('null si aucune voix, et null si l’API est absente', async () => {
    installer(false);
    const { voixPour } = await import('./tts');
    expect(voixPour('en')).toBeNull();
    desinstaller();
    expect(voixPour('en')).toBeNull();
  });
});

describe('parler()', () => {
  it('utilise la locale de la langue cible et le débit demandé', async () => {
    const { parler, arret } = await import('./tts');
    const p = parler('think', { langue: 'en', debit: 0.5 });
    expect(parles).toHaveLength(1);
    expect(parles[0].lang).toBe(LOCALES.en);
    expect(parles[0].rate).toBe(0.5);
    expect(parles[0].text).toBe('think');
    parles[0].onend?.();
    await p;
    arret();
  });

  it('résout à la fin de l’énoncé', async () => {
    const { parler } = await import('./tts');
    const p = parler('hello', { langue: 'en', debit: 1 });
    parles[0].onend?.();
    await expect(p).resolves.toBeUndefined();
  });

  it('rejette sur erreur de synthèse', async () => {
    const { parler } = await import('./tts');
    const p = parler('hello', { langue: 'en' });
    parles[0].onerror?.({ error: 'not-allowed' });
    await expect(p).rejects.toThrow(/not-allowed/);
  });

  it('annule la lecture précédente avant d’en commencer une autre', async () => {
    const { parler } = await import('./tts');
    void parler('un', { langue: 'fr' });
    parles[0].onend?.();
    void parler('deux', { langue: 'fr' });
    expect(annulations).toBeGreaterThanOrEqual(1);
    expect(parles[parles.length - 1].text).toBe('deux');
    parles[parles.length - 1].onend?.();
  });

  it('texte vide : ne parle pas, résout aussitôt', async () => {
    const { parler } = await import('./tts');
    await expect(parler('   ', { langue: 'en' })).resolves.toBeUndefined();
    expect(parles).toHaveLength(0);
  });

  it('API absente : rejet explicite (l’UI le dit, pas de silence)', async () => {
    desinstaller();
    const { parler } = await import('./tts');
    await expect(parler('think', { langue: 'en' })).rejects.toThrow(/indisponible/i);
  });
});

describe('arret()', () => {
  it('annule et vide l’utterance en cours', async () => {
    const { arret, courant, parler } = await import('./tts');
    void parler('stop', { langue: 'en' });
    expect(courant()).not.toBeNull();
    arret();
    expect(courant()).toBeNull();
    // 2 annulations : celle de parler() (interrompre la lecture précédente) et
    // celle de arret() lui-même.
    expect(annulations).toBe(2);
  });

  it('sans API : ne plante pas', async () => {
    desinstaller();
    const { arret } = await import('./tts');
    expect(() => arret()).not.toThrow();
    expect(vi.fn()).toBeTruthy();
  });
});
