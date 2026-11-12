import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apiMicro,
  compterEntrees,
  demanderMicro,
  diagnostiquerErreur,
  diagnostiquerMicro,
} from './permissions';

/**
 * Le navigateur ne montre sa fenêtre d'autorisation QUE s'il a un micro à
 * donner. Quand il n'y en a pas (cas réel observé : PipeWire sans aucune source,
 * profil audio en sortie seule), getUserMedia échoue en NotFoundError et
 * AUCUNE demande n'apparaît. L'app doit alors dire quoi, et comment s'en sortir.
 */

function sansMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
}

function avecMediaDevices(getUserMedia: unknown, enumerateDevices?: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: enumerateDevices ?? (() => Promise.resolve([])) },
  });
}

function domaine(nom: string): DOMException {
  const e = new Error(nom) as Error & { name: string };
  e.name = nom;
  return e as unknown as DOMException;
}

// jsdom ne déclare pas isSecureContext : sans ce bouchon, tout diagnostic
// retomberait sur « contexte non sécurisé » et masquerait les autres cas.
beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
});

afterEach(() => {
  sansMediaDevices();
});

describe('diagnostiquerErreur — chaque cause a son message', () => {
  it('accès refusé → pointer la barre d’adresse', () => {
    const d = diagnostiquerErreur(domaine('NotAllowedError'));
    expect(d.etat).toBe('refuse');
    expect(d.permission).toBe('denied');
    expect(d.conseil).toMatch(/barre d’adresse/i);
    expect(d.bloquant).toBe(true);
  });

  it('aucun matériel → dire de brancher un micro (le cas qui ne demande rien)', () => {
    const d = diagnostiquerErreur(domaine('NotFoundError'));
    expect(d.etat).toBe('aucun-materiel');
    expect(d.message).toMatch(/Aucun micro détecté/i);
    expect(d.conseil).toMatch(/branche un micro|casque/i);
  });

  it('micro occupé → dire de fermer l’autre application', () => {
    const d = diagnostiquerErreur(domaine('NotReadableError'));
    expect(d.etat).toBe('occupe');
    expect(d.conseil).toMatch(/autre application|visio/i);
  });

  it('erreur inconnue → on donne le détail technique au lieu de deviner', () => {
    const d = diagnostiquerErreur(domaine('PanneBizarre'));
    expect(d.etat).toBe('inconnu');
    expect(d.conseil).toContain('PanneBizarre');
  });

  it('chaque cas bloquant propose le repli fichier', () => {
    for (const nom of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'PanneBizarre']) {
      expect(diagnostiquerErreur(domaine(nom)).conseil, nom).toMatch(/téléverser un fichier/i);
    }
  });
});

describe('diagnostiquerMicro — vérifications passives', () => {
  it('API absente : le dit sans demander quoi que ce soit', async () => {
    sansMediaDevices();
    expect(apiMicro()).toBe(false);
    const d = await diagnostiquerMicro();
    expect(['api-absente', 'insecure']).toContain(d.etat);
    expect(d.bloquant).toBe(true);
  });

  it('permission non demandée mais AUCUNE entrée visible : on prévient (cas réel du 12/11)', async () => {
    // Poste fixe dont le profil audio est en sortie seule : le navigateur n'a
    // rien à demander, donc aucune fenêtre d'autorisation n'apparaît jamais.
    avecMediaDevices(() => Promise.reject(new Error('pas appelé ici')), () => Promise.resolve([]));
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'prompt' }) },
    });
    const d = await diagnostiquerMicro();
    expect(d.etat).toBe('aucun-materiel');
    expect(d.message).toMatch(/ne demandera donc rien/i);
    expect(d.conseil).toMatch(/profil audio|téléverser/i);
  });

  it('permission refusée : détectée sans nouvel appel au micro', async () => {
    avecMediaDevices(() => Promise.reject(new Error('ne devrait pas être appelé')));
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'denied' }) },
    });
    const d = await diagnostiquerMicro();
    expect(d.etat).toBe('refuse');
    expect(d.permission).toBe('denied');
  });

  it('autorisé mais aucune entrée visible → aucun matériel', async () => {
    avecMediaDevices(() => Promise.resolve({ getTracks: () => [] }), () => Promise.resolve([]));
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'granted' }) },
    });
    const d = await diagnostiquerMicro();
    expect(d.etat).toBe('aucun-materiel');
    expect(d.entrees).toBe(0);
  });

  it('autorisé avec deux entrées → prêt, non bloquant', async () => {
    avecMediaDevices(
      () => Promise.resolve({ getTracks: () => [] }),
      () =>
        Promise.resolve([
          { kind: 'audioinput', deviceId: 'a', label: '', groupId: '', toJSON: () => ({}) },
          { kind: 'audioinput', deviceId: 'b', label: '', groupId: '', toJSON: () => ({}) },
          { kind: 'audiooutput', deviceId: 'c', label: '', groupId: '', toJSON: () => ({}) },
        ]),
    );
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'granted' }) },
    });
    const d = await diagnostiquerMicro();
    expect(d.etat).toBe('pret');
    expect(d.bloquant).toBe(false);
    expect(d.entrees).toBe(2);
  });

  it('compterEntrees ne plante jamais si l’API est absente', async () => {
    sansMediaDevices();
    await expect(compterEntrees()).resolves.toBe(0);
  });
});

describe('demanderMicro — la demande explicite', () => {
  it('ne déclenche aucun appel si le diagnostic passif est bloquant', async () => {
    // API absente (ou contexte non sécurisé) : demander l'accès n'aurait aucun
    // sens, on rend le diagnostic passif sans toucher à getUserMedia.
    sansMediaDevices();
    const d = await demanderMicro();
    expect(d.bloquant).toBe(true);
    expect(['api-absente', 'insecure']).toContain(d.etat);
  });

  it('autorise, compte les entrées et LIBÈRE le micro aussitôt', async () => {
    const arretes: string[] = [];
    avecMediaDevices(
      () => Promise.resolve({ getTracks: () => [{ stop: () => arretes.push('piste') }] }),
      () => Promise.resolve([{ kind: 'audioinput', deviceId: 'a', label: '', groupId: '', toJSON: () => ({}) }]),
    );
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'prompt' }) },
    });
    const d = await demanderMicro();
    expect(d.etat).toBe('pret');
    expect(d.permission).toBe('granted');
    expect(d.entrees).toBe(1);
    expect(arretes).toEqual(['piste']);
  });

  it('un refus à la demande est traduit, pas avalé', async () => {
    // Une entrée existe (sinon le diagnostic passif conclurait « aucun matériel »
    // avant même la demande) mais l'utilisateur refuse la fenêtre d'autorisation.
    avecMediaDevices(
      () => Promise.reject(domaine('NotAllowedError')),
      () => Promise.resolve([{ kind: 'audioinput', deviceId: 'a', label: '', groupId: '', toJSON: () => ({}) }]),
    );
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'prompt' }) },
    });
    const d = await demanderMicro();
    expect(d.etat).toBe('refuse');
  });
});
