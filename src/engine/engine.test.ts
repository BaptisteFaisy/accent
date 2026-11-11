import { describe, expect, it } from 'vitest';
import { choisirCible, estAcquis, poids } from './selectTarget';
import { consoliderLectures, ecartMax, mediane, mesureUnique } from './measure';
import type { Profil, ScorePhoneme } from '../types';
import { PHONEMES } from '../data/phonemes';

/** Utilitaire : un score par mot, calé sur la taxonomie. */
function s(code: 'P01' | 'P02' | 'P04', mot: string, indexMot: number, score: number): ScorePhoneme {
  return { code, ipa: PHONEMES[code].ipa, mot, indexMot, score };
}

describe('mesure — médiane et écart (§18.4)', () => {
  it('médiane sur un nombre impair de lectures', () => {
    expect(mediane([34, 81, 60])).toBe(60);
  });

  it('médiane sur un nombre pair de lectures', () => {
    expect(mediane([10, 20, 30, 40])).toBe(25);
  });

  it('écart max = amplitude, pas variance', () => {
    expect(ecartMax([34, 81, 60])).toBe(47);
  });

  it('une mesure unique est stable par définition', () => {
    const m = mesureUnique('P01', s('P01', 'think', 1, 34));
    expect(m.mesure.stable).toBe(true);
    expect(m.mesure.lectures).toBe(1);
  });
});

describe('consolidation de 3 lectures', () => {
  const lectures = [
    [s('P01', 'think', 1, 34), s('P02', 'this', 0, 90)],
    [s('P01', 'think', 1, 41), s('P02', 'this', 0, 88)],
    [s('P01', 'think', 1, 38), s('P02', 'this', 0, 92)],
  ];

  it('prend la médiane par code et garde la pire occurrence', () => {
    const m = consoliderLectures(lectures);
    const p01 = m.find((x) => x.code === 'P01');
    expect(p01?.mesure.mediane).toBe(38);
    expect(p01?.mesure.lectures).toBe(3);
    expect(p01?.mesure.stable).toBe(true);
  });

  it('signale l’instabilité au-delà de 20 points d’écart (RNF-11)', () => {
    const instable = consoliderLectures([
      [s('P01', 'think', 1, 20)],
      [s('P01', 'think', 1, 90)],
    ]);
    expect(instable[0].mesure.stable).toBe(false);
  });

  it('ignore les phonèmes hors taxonomie (code null)', () => {
    const m = consoliderLectures([[{ code: null, ipa: 'x', mot: 'xyz', indexMot: 0, score: 12 }]]);
    expect(m).toHaveLength(0);
  });
});

describe('sélection de la cible unique (§17)', () => {
  it('choisit un seul phonème, le plus dégradé', () => {
    const m = consoliderLectures([
      [s('P01', 'think', 1, 34), s('P04', 'ship', 3, 55), s('P02', 'this', 0, 88)],
    ]);
    const choix = choisirCible(m);
    expect(choix.cible?.code).toBe('P01');
    expect(choix.etat).toBe('a_travailler');
  });

  it('RNF-04 : tout au-dessus de 80 → « rien à corriger », aucune cible', () => {
    const m = consoliderLectures([[s('P01', 'think', 1, 92), s('P04', 'ship', 3, 85)]]);
    const choix = choisirCible(m);
    expect(choix.etat).toBe('rien_a_corriger');
    expect(choix.cible).toBeNull();
  });

  it('RNF-11 : refus d’afficher un chiffre quand tout est instable', () => {
    const m = consoliderLectures([[s('P01', 'think', 1, 20)], [s('P01', 'think', 1, 95)]]);
    expect(choisirCible(m).etat).toBe('instable');
  });

  it('pondère par le nombre d’occurrences', () => {
    expect(poids(40, 3, 3)).toBeGreaterThan(poids(40, 1, 3));
  });

  it('pondère par la difficulté', () => {
    expect(poids(40, 1, 3)).toBeGreaterThan(poids(40, 1, 1));
  });

  it('exclut un phonème acquis depuis moins de 7 jours', () => {
    const maintenant = new Date('2026-11-11T12:00:00Z');
    const profil: Profil = {
      parPhoneme: {
        P01: { meilleur: 85, dernier: 85, tentatives: 2, acquisLe: '2026-11-09T12:00:00Z' },
      },
      sessions: 2,
      maj: maintenant.toISOString(),
    };
    expect(estAcquis('P01', profil, maintenant)).toBe(true);
    const m = consoliderLectures([[s('P01', 'think', 1, 50), s('P04', 'ship', 3, 55)]]);
    expect(choisirCible(m, { profil, maintenant }).cible?.code).toBe('P04');
  });

  it('un acquis de plus de 7 jours redevient ciblable', () => {
    const maintenant = new Date('2026-11-20T12:00:00Z');
    const profil: Profil = {
      parPhoneme: {
        P01: { meilleur: 85, dernier: 85, tentatives: 2, acquisLe: '2026-11-09T12:00:00Z' },
      },
      sessions: 2,
      maj: maintenant.toISOString(),
    };
    expect(estAcquis('P01', profil, maintenant)).toBe(false);
  });

  it('forcer un code garde la session sur le même son (RF-07)', () => {
    const m = consoliderLectures([[s('P01', 'think', 1, 34), s('P04', 'ship', 3, 20)]]);
    expect(choisirCible(m, { forcer: 'P01' }).cible?.code).toBe('P01');
  });

  it('aucune mesure → erreur explicite, pas de cible inventée', () => {
    expect(choisirCible([]).etat).toBe('erreur');
  });
});
