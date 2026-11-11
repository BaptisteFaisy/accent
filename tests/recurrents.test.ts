// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sonsRecurrents } from '../src/store/profile';
import type { Session } from '../src/types';

/**
 * RF-22 — profil de sons : un phonème qui ressort comme cible sur plusieurs
 * phrases DIFFÉRENTES est une tendance, pas un accident. En dessous du seuil, on
 * ne dit rien (§10 : pas de jugement hâtif, pas de gamification).
 */

function session(cible: Session['cible'], phrase: string, id = phrase): Session {
  return {
    id,
    createdAt: new Date('2026-11-11T12:00:00Z').toISOString(),
    langueCible: 'en',
    phrase,
    cible,
    scores: [],
  };
}

describe('sonsRecurrents', () => {
  it('ne signale rien sous le seuil', () => {
    const s = [session('P01', 'I think so.'), session('P01', 'Think again.')];
    expect(sonsRecurrents(s)).toEqual([]);
  });

  it('signale un son vu sur 3 phrases différentes', () => {
    const s = [
      session('P01', 'I think so.'),
      session('P01', 'Think again.'),
      session('P01', 'Three thin threads.'),
    ];
    const out = sonsRecurrents(s);
    expect(out).toEqual([{ code: 'P01', fois: 3 }]);
  });

  it('trois séances sur la MÊME phrase ne comptent qu’une fois', () => {
    const s = [session('P01', 'I think so.'), session('P01', 'I think so.'), session('P01', 'i think so.')];
    expect(sonsRecurrents(s)).toEqual([]);
  });

  it('trie du plus fréquent au moins fréquent', () => {
    const s = [
      session('P04', 'The ship is big.'),
      session('P04', 'Six kids sit.'),
      session('P04', 'It is difficult.'),
      session('P01', 'I think so.'),
      session('P01', 'Think again.'),
      session('P01', 'Three threads.'),
      session('P01', 'Thank them.'),
    ];
    expect(sonsRecurrents(s).map((x) => x.code)).toEqual(['P01', 'P04']);
  });

  it('ignore les sessions sans cible (phrase sans erreur)', () => {
    const s = [session(null, 'Perfect.'), session(null, 'Perfect too.'), session(null, 'And again.')];
    expect(sonsRecurrents(s)).toEqual([]);
  });

  it('seuil paramétrable', () => {
    const s = [session('P07', 'My red bike.'), session('P07', 'Right behind.')];
    expect(sonsRecurrents(s, 2)).toEqual([{ code: 'P07', fois: 2 }]);
    expect(sonsRecurrents(s, 3)).toEqual([]);
  });

  it('liste vide : aucun plantage', () => {
    expect(sonsRecurrents([])).toEqual([]);
  });
});
