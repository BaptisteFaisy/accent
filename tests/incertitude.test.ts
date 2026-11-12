// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bornes, consoliderLectures, incertitude } from '../src/engine/measure';
import { choisirCible, traverseUnSeuil } from '../src/engine/selectTarget';
import { PHONEMES } from '../src/data/phonemes';
import type { ScorePhoneme } from '../src/types';

/**
 * §18.4 poussé jusqu'au bout : le score affiché est une ESTIMATION. On montre
 * donc l'étendue observée, et on dit quand cette étendue traverse un seuil de
 * décision — même principe que le refus d'afficher un écart > 20 points.
 */

function s(code: 'P01' | 'P04', mot: string, indexMot: number, score: number): ScorePhoneme {
  return { code, ipa: PHONEMES[code].ipa, mot, indexMot, score };
}

describe('bornes et incertitude', () => {
  it('bornes = min et max observés, arrondis', () => {
    const [m] = consoliderLectures([[s('P01', 'think', 1, 34)], [s('P01', 'think', 1, 41)], [s('P01', 'think', 1, 38)]]);
    expect(bornes(m.mesure)).toEqual({ min: 34, max: 41 });
    expect(incertitude(m.mesure)).toBe(4);
  });

  it('bornes écrêtées à [0, 100]', () => {
    const [m] = consoliderLectures([[s('P01', 'think', 1, 0)], [s('P01', 'think', 1, 100)]]);
    expect(bornes(m.mesure)).toEqual({ min: 0, max: 100 });
  });

  it('lecture unique : bornes réduites à la valeur, incertitude nulle', () => {
    const [m] = consoliderLectures([[s('P01', 'think', 1, 52)]]);
    expect(bornes(m.mesure)).toEqual({ min: 52, max: 52 });
    expect(incertitude(m.mesure)).toBe(0);
  });
});

describe('traverseUnSeuil — conclusion fragile détectée', () => {
  const mesures = (valeurs: number[]) =>
    consoliderLectures(valeurs.map((v) => [s('P01', 'think', 1, v)]));

  it('traverse le seuil « à travailler » (60)', () => {
    expect(traverseUnSeuil(mesures([52, 64, 58])[0])).toBe(true);
  });

  it('traverse le seuil « acquis » (80)', () => {
    expect(traverseUnSeuil(mesures([74, 86, 79])[0])).toBe(true);
  });

  it('ne traverse aucun seuil quand les lectures sont d’un même côté', () => {
    expect(traverseUnSeuil(mesures([20, 34, 28])[0])).toBe(false);
    expect(traverseUnSeuil(mesures([88, 95, 91])[0])).toBe(false);
  });

  it('un seul point sur le seuil compte comme traversée', () => {
    expect(traverseUnSeuil(mesures([55, 60, 58])[0])).toBe(true);
  });
});

describe('la cible porte son incertitude', () => {
  it('fourchette et drapeau présents sur la cible choisie', () => {
    const choix = choisirCible(consoliderLectures([
      [s('P01', 'think', 1, 34)],
      [s('P01', 'think', 1, 41)],
      [s('P01', 'think', 1, 38)],
    ]));
    expect(choix.cible?.fourchette).toEqual({ min: 34, max: 41 });
    expect(choix.cible?.auBordDuSeuil).toBe(false);
  });

  it('au bord du seuil : la cible reste affichée, mais le doute est signalé', () => {
    const choix = choisirCible(consoliderLectures([
      [s('P01', 'think', 1, 52)],
      [s('P01', 'think', 1, 66)],
      [s('P01', 'think', 1, 58)],
    ]));
    expect(choix.cible).not.toBeNull();
    expect(choix.cible?.auBordDuSeuil).toBe(true);
    expect(choix.cible?.score).toBe(58);
  });

  it('instable reste prioritaire sur le doute : aucun chiffre (RNF-11)', () => {
    const choix = choisirCible(consoliderLectures([
      [s('P01', 'think', 1, 20)],
      [s('P01', 'think', 1, 65)],
    ]));
    expect(choix.etat).toBe('instable');
    expect(choix.cible).toBeNull();
  });
});
