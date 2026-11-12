import { describe, expect, it } from 'vitest';
import { ARTICULATIONS, articulationPour, codesAvecSchema } from './articulation';
import { CODES_PHONEMES, PHONEMES } from './phonemes';

/**
 * La table articulatoire est de la DONNÉE pédagogique : elle doit couvrir toute
 * la taxonomie (sauf P14, qui est positionnel) et rester cohérente.
 */

describe('couverture de la table articulatoire', () => {
  it('couvre tous les codes sauf P14 (accent de mot = positionnel)', () => {
    const couverts = codesAvecSchema();
    for (const code of CODES_PHONEMES) {
      if (code === 'P14') {
        expect(articulationPour(code), 'P14 ne doit pas avoir de schéma').toBeNull();
        continue;
      }
      expect(couverts, `${code} sans schéma articulatoire`).toContain(code);
    }
  });

  it('n’invente aucun code hors taxonomie', () => {
    for (const code of codesAvecSchema()) {
      expect(CODES_PHONEMES, `${code} inconnu de la taxonomie`).toContain(code);
    }
  });

  it('P14 rend null (l’écran bascule sur BarresSyllabes)', () => {
    expect(articulationPour('P14')).toBeNull();
    expect(PHONEMES.P14.nature).toBe('positionnel');
  });
});

describe('cohérence des paramètres', () => {
  const entrees = Object.entries(ARTICULATIONS) as Array<[string, NonNullable<ReturnType<typeof articulationPour>>]>;

  it('positions de langue bornées dans [0, 1]', () => {
    for (const [code, a] of entrees) {
      expect(a.pointeLangue, `${code}.pointeLangue`).toBeGreaterThanOrEqual(0);
      expect(a.pointeLangue, `${code}.pointeLangue`).toBeLessThanOrEqual(1);
      expect(a.dosLangue, `${code}.dosLangue`).toBeGreaterThanOrEqual(0);
      expect(a.dosLangue, `${code}.dosLangue`).toBeLessThanOrEqual(1);
    }
  });

  it('chaque entrée a un lieu, une forme de lèvres et une légende lisible', () => {
    for (const [code, a] of entrees) {
      expect(a.lieu, code).toBeTruthy();
      expect(a.levres, code).toBeTruthy();
      expect(a.legende.length, `${code} : légende trop courte`).toBeGreaterThan(25);
      expect(typeof a.nasal, code).toBe('boolean');
      expect(typeof a.voise, code).toBe('boolean');
      expect(typeof a.souffle, code).toBe('boolean');
    }
  });

  it('les nasales ont le voile ouvert, et seulement elles', () => {
    const nasales = entrees.filter(([, a]) => a.nasal).map(([c]) => c);
    expect(nasales.sort()).toEqual(['E03', 'P08']);
  });

  it('/θ/ et /ð/ partagent le lieu mais pas le voisement', () => {
    expect(ARTICULATIONS.P01?.lieu).toBe(ARTICULATIONS.P02?.lieu);
    expect(ARTICULATIONS.P01?.voise).toBe(false);
    expect(ARTICULATIONS.P02?.voise).toBe(true);
  });

  it('/v/ et /b/ : même lieu lèvres-dents pour /v/, occlusif pour les finales', () => {
    expect(ARTICULATIONS.E05?.levres).toBe('dents-levre');
    expect(ARTICULATIONS.P09?.levres).toBe('dents-levre');
    expect(ARTICULATIONS.P12?.lieu).toBe('levres');
  });

  it('/ʃ/ et /ʒ/ ne diffèrent que par le voisement', () => {
    const ch = ARTICULATIONS.E04;
    const j = ARTICULATIONS.E09;
    expect(ch?.lieu).toBe(j?.lieu);
    expect(ch?.levres).toBe(j?.levres);
    expect(ch?.voise).toBe(false);
    expect(j?.voise).toBe(true);
  });

  it('les voyelles arrondies françaises sont marquées arrondies', () => {
    expect(ARTICULATIONS.E01?.levres).toBe('arrondies');
    expect(ARTICULATIONS.E07?.levres).toBe('arrondies');
  });
});
