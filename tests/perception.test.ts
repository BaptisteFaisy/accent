// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { corriger, creerExercice, jouable } from '../src/engine/perception';
import { CODES_PHONEMES, PHONEMES } from '../src/data/phonemes';
import type { CodePhoneme } from '../src/types';

/**
 * Mode « perception avant production » : la logique doit être déterministe
 * (tests reproductibles), non devinable (pas de motif A/B/A/B), et ne produire
 * AUCUN score global — des comptes et un détail, rien d'autre.
 */

describe('creerExercice', () => {
  it('produit le nombre d’items demandé', () => {
    expect(creerExercice('P01', 'en', { nb: 6, graine: 1 }).items).toHaveLength(6);
    expect(creerExercice('P01', 'en', { nb: 10, graine: 1 }).items).toHaveLength(10);
  });

  it('déterministe : même graine → même exercice', () => {
    const a = creerExercice('P01', 'en', { nb: 6, graine: 42 });
    const b = creerExercice('P01', 'en', { nb: 6, graine: 42 });
    expect(a).toEqual(b);
  });

  it('deux graines différentes → exercices différents', () => {
    const a = creerExercice('P01', 'en', { nb: 8, graine: 1 });
    const b = creerExercice('P01', 'en', { nb: 8, graine: 999 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('le mot annoncé correspond bien à l’index de la réponse', () => {
    for (const item of creerExercice('E03', 'fr', { nb: 12, graine: 7 }).items) {
      expect(item.mot).toBe(item.paire[item.reponse]);
    }
  });

  it('ne répète jamais la même paire deux fois de suite', () => {
    const items = creerExercice('P01', 'en', { nb: 15, graine: 3 }).items;
    for (let i = 1; i < items.length; i += 1) {
      const avant = items[i - 1].paire.join('|');
      const apres = items[i].paire.join('|');
      if (items.length > 1 && PHONEMES.P01.pairesMinimales.length > 1) {
        expect(avant === apres && i > 0).toBe(false);
      }
    }
  });

  it('jamais trois réponses identiques d’affilée (motif non devinable)', () => {
    for (const graine of [1, 2, 3, 5, 8, 13]) {
      const items = creerExercice('P04', 'en', { nb: 12, graine }).items;
      const suite = items.map((i) => i.reponse).join('');
      expect(suite, `graine ${graine} : ${suite}`).not.toMatch(/000|111/);
    }
  });

  it('borne le nombre d’items (1 à 20)', () => {
    expect(creerExercice('P01', 'en', { nb: 0, graine: 1 }).items).toHaveLength(1);
    expect(creerExercice('P01', 'en', { nb: 99, graine: 1 }).items).toHaveLength(20);
  });

  it('code positionnel (P14) : aucun exercice d’écoute', () => {
    expect(jouable('P14')).toBe(false);
    expect(creerExercice('P14', 'en', { nb: 6, graine: 1 }).items).toEqual([]);
  });

  it('tous les codes phonétiques sont jouables', () => {
    for (const code of CODES_PHONEMES) {
      if (PHONEMES[code].nature === 'positionnel') continue;
      expect(jouable(code as CodePhoneme), `${code} non jouable`).toBe(true);
    }
  });
});

describe('corriger', () => {
  const ex = creerExercice('P01', 'en', { nb: 4, graine: 11 });

  it('tout juste', () => {
    const b = corriger(ex, ex.items.map((i) => i.reponse));
    expect(b.reussis).toBe(4);
    expect(b.total).toBe(4);
    expect(b.pairesARevoir).toEqual([]);
  });

  it('tout faux', () => {
    const b = corriger(ex, ex.items.map((i) => (i.reponse === 0 ? 1 : 0) as 0 | 1));
    expect(b.reussis).toBe(0);
    expect(b.pairesARevoir.length).toBeGreaterThan(0);
  });

  it('réponses manquantes comptées comme échec, sans planter', () => {
    const b = corriger(ex, [null, null]);
    expect(b.reussis).toBe(0);
    expect(b.total).toBe(4);
    expect(b.detail).toHaveLength(4);
  });

  it('paires à revoir dédoublonnées', () => {
    const b = corriger(ex, ex.items.map(() => null));
    const cles = b.pairesARevoir.map(([a, c]) => `${a}|${c}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('GARDE-FOU : aucun pourcentage ni note globale dans le bilan', () => {
    const b = corriger(ex, ex.items.map((i) => i.reponse));
    expect(Object.keys(b).sort()).toEqual(['detail', 'pairesARevoir', 'reussis', 'total']);
    const brut = JSON.stringify(b).toLowerCase();
    for (const interdit of ['pourcentage', 'score', 'moyenne', 'note', '%']) {
      expect(brut, `le bilan contient « ${interdit} »`).not.toContain(interdit);
    }
  });
});
