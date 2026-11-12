import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { messageErreurEleven, parlerElevenLabs, trouverVoix, type VoixEleven } from './tts';

/**
 * Voix Eleven Labs (BYOK). Ce qui part chez eux : le TEXTE. Jamais l'audio de
 * l'élève — le fournisseur synthétise, il n'entend rien.
 */

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_AUDIO = (globalThis as Record<string, unknown>).Audio;
const ORIGINAL_CREATE = URL.createObjectURL;
const ORIGINAL_REVOKE = URL.revokeObjectURL;

beforeEach(() => {
  (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:fake';
  (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
  (globalThis as Record<string, unknown>).Audio = class {
    playbackRate = 1;

    onended: (() => void) | null = null;

    onerror: (() => void) | null = null;

    constructor(public src: string) {}

    play() {
      setTimeout(() => this.onended?.(), 0);
      return Promise.resolve();
    }

    pause() {}
  };
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  (globalThis as Record<string, unknown>).Audio = ORIGINAL_AUDIO;
  (URL as unknown as Record<string, unknown>).createObjectURL = ORIGINAL_CREATE;
  (URL as unknown as Record<string, unknown>).revokeObjectURL = ORIGINAL_REVOKE;
});

describe('trouverVoix — la voix demandée', () => {
  const voix: VoixEleven[] = [
    { voice_id: 'v1', name: 'Rachel' },
    { voice_id: 'v2', name: 'Laure' },
    { voice_id: 'v3', name: 'Brian' },
  ];

  it('retrouve « Laure » dans le compte', () => {
    expect(trouverVoix(voix, 'Laure')?.voice_id).toBe('v2');
  });

  it('insensible à la casse et aux accents', () => {
    expect(trouverVoix(voix, 'laure')?.voice_id).toBe('v2');
    expect(trouverVoix([{ voice_id: 'x', name: 'Laura' }], 'Laure')?.voice_id).toBe('x');
  });

  it('accepte une correspondance partielle (voix clonée « Laure — perso »)', () => {
    const perso: VoixEleven[] = [{ voice_id: 'p1', name: 'Laure — perso' }];
    expect(trouverVoix(perso, 'Laure')?.voice_id).toBe('p1');
  });

  it('ne devine rien quand la voix n’existe pas', () => {
    const autres: VoixEleven[] = [{ voice_id: 'x', name: 'Brian' }, { voice_id: 'y', name: 'Domi' }];
    expect(trouverVoix(autres, 'Laure')).toBeNull();
    expect(trouverVoix([], 'Laure')).toBeNull();
    expect(trouverVoix(voix, '')).toBeNull();
  });

  it('« Laura » (voix Eleven Labs) et « Laure » (voix clonée) se rejoignent', () => {
    const melange: VoixEleven[] = [{ voice_id: 'la', name: 'Laura' }, { voice_id: 'pe', name: 'Laure' }];
    expect(trouverVoix(melange, 'Laure')?.voice_id).toBe('pe');
  });
});

describe('parlerElevenLabs — la requête', () => {
  it('appelle l’API de synthèse avec la clé, le texte et la vitesse', async () => {
    let url = '';
    let options: RequestInit = {};
    globalThis.fetch = (async (u: string, o: RequestInit) => {
      url = u;
      options = o;
      return new Response(new Blob(['audio'], { type: 'audio/mpeg' }), { status: 200 });
    }) as unknown as typeof fetch;

    await parlerElevenLabs('think', { langue: 'en', debit: 1, cle: 'sk-test', voix: 'v2' });

    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/v2');
    const headers = options.headers as Record<string, string>;
    expect(headers['xi-api-key']).toBe('sk-test');
    const corps = JSON.parse(String(options.body)) as {
      text: string;
      model_id: string;
      voice_settings: { speed: number };
    };
    expect(corps.text).toBe('think');
    expect(corps.model_id).toBe('eleven_multilingual_v2');
    expect(corps.voice_settings.speed).toBe(1);
  });

  it('le ralenti 0,5× est demandé à 0,7 (minimum de l’API) et complété côté client', async () => {
    let options: RequestInit = {};
    globalThis.fetch = (async (_u: string, o: RequestInit) => {
      options = o;
      return new Response(new Blob(['audio'], { type: 'audio/mpeg' }), { status: 200 });
    }) as unknown as typeof fetch;

    await parlerElevenLabs('think', { langue: 'en', debit: 0.5, cle: 'sk-test', voix: 'v2' });
    const corps = JSON.parse(String(options.body)) as { voice_settings: { speed: number } };
    expect(corps.voice_settings.speed).toBe(0.7);
  });

  it('refuse de partir sans clé', async () => {
    await expect(parlerElevenLabs('think', { langue: 'en', cle: '' })).rejects.toThrow(/clé/i);
  });

  it('texte vide : aucune requête', async () => {
    let appele = 0;
    globalThis.fetch = (async () => {
      appele += 1;
      return new Response(new Blob(['a']), { status: 200 });
    }) as unknown as typeof fetch;
    await parlerElevenLabs('   ', { langue: 'en', cle: 'sk-test' });
    expect(appele).toBe(0);
  });
});

describe('messages d’erreur Eleven Labs', () => {
  it('distingue clé refusée, crédits épuisés, quota et voix introuvable', () => {
    expect(messageErreurEleven(401)).toMatch(/clé/i);
    expect(messageErreurEleven(402)).toMatch(/crédits/i);
    expect(messageErreurEleven(429)).toMatch(/trop de requêtes/i);
    expect(messageErreurEleven(404)).toMatch(/introuvable/i);
    expect(messageErreurEleven(500)).toMatch(/500/);
  });

  it('une erreur HTTP devient un message lisible, pas une exception brute', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    await expect(parlerElevenLabs('think', { langue: 'en', cle: 'sk-test' })).rejects.toThrow(/clé/i);
  });
});
