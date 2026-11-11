import { describe, expect, it } from 'vitest';
import { CODES_PHONEMES, PHONEMES, motPorteur } from '../src/data/phonemes';
import type { CodePhoneme } from '../src/types';

/**
 * Annexe A — les 10 mots du corpus de test du Jour 1. Chaque mot doit être
 * rattaché à un code de la taxonomie fermée (§17), et chaque code concerné
 * doit disposer d'au moins une paire minimale : c'est ce qui permet à l'étape 4
 * (« Explique ») de nommer l'erreur sans aucun appel modèle.
 */

const CORPUS: Array<{ mot: string; code: CodePhoneme; signatureAttendue: string }> = [
  { mot: 'think', code: 'P01', signatureAttendue: '/s/' },
  { mot: 'this', code: 'P02', signatureAttendue: '/z/' },
  { mot: 'house', code: 'P03', signatureAttendue: 'muet' },
  { mot: 'ship', code: 'P04', signatureAttendue: '/i/' },
  { mot: 'cat', code: 'P05', signatureAttendue: '/a/' },
  { mot: 'cup', code: 'P06', signatureAttendue: '/o/' },
  { mot: 'red', code: 'P07', signatureAttendue: 'roulé' },
  { mot: 'sing', code: 'P08', signatureAttendue: 'singue' },
  { mot: 'very', code: 'P09', signatureAttendue: '/w/' },
  { mot: 'street', code: 'P13', signatureAttendue: 'street' },
];

function codesRattaches(mot: string): CodePhoneme[] {
  return CODES_PHONEMES.filter((c) => motPorteur(c, mot));
}

describe('Annexe A — les 10 mots du corpus sont rattachés à la taxonomie', () => {
  it('Annexe A : chaque mot du corpus est porté par son code attendu (motPorteur)', () => {
    for (const { mot, code } of CORPUS) {
      expect(motPorteur(code, mot), `${mot} → ${code}`).toBe(true);
    }
  });

  it('Annexe A : chaque mot du corpus est rattaché à au moins un code', () => {
    for (const { mot, code } of CORPUS) {
      const trouves = codesRattaches(mot);
      expect(trouves.length, `${mot} n’est rattaché à aucun code`).toBeGreaterThan(0);
      expect(trouves, `${mot} : codes trouvés`).toContain(code);
    }
  });

  it('Annexe A : chaque mot apparaît dans motsExemples ou dans une paire minimale du code', () => {
    for (const { mot, code } of CORPUS) {
      const e = PHONEMES[code];
      const dansExemples = e.motsExemples.some((m) => m.toLowerCase() === mot);
      const dansPaires = e.pairesMinimales.some(
        ([a, b]) => a.toLowerCase() === mot || b.toLowerCase() === mot,
      );
      expect(dansExemples || dansPaires, `${mot} absent de la table ${code}`).toBe(true);
      expect(e.langueCible).toBe('en');
    }
  });

  it('Annexe A : les 10 mots couvrent 10 codes distincts de la taxonomie', () => {
    const codes = CORPUS.map((c) => c.code);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(CODES_PHONEMES).toContain(c);
  });

  it('Annexe A : chaque code concerné possède au moins une paire minimale exploitable', () => {
    for (const { code } of CORPUS) {
      const paires = PHONEMES[code].pairesMinimales;
      expect(paires.length, `${code} sans paire minimale`).toBeGreaterThan(0);
      for (const [a, b] of paires) {
        expect(a.trim().length, `${code} : mot attendu vide`).toBeGreaterThan(0);
        expect(b.trim().length, `${code} : mot entendu vide`).toBeGreaterThan(0);
        // Une paire minimale oppose deux mots réellement différents : sinon
        // l'écran afficherait « X ne doit pas devenir X ».
        expect(a.toLowerCase(), `${code} : paire dégénérée ${a}/${b}`).not.toBe(b.toLowerCase());
      }
    }
  });

  it('Annexe A : chaque code concerné porte la signature d’erreur attendue (§17)', () => {
    for (const { mot, code, signatureAttendue } of CORPUS) {
      const signature = PHONEMES[code].signature;
      expect(signature.length, `${code} sans signature`).toBeGreaterThan(0);
      expect(signature, `${mot} → ${code} : signature sans « ${signatureAttendue} »`).toContain(
        signatureAttendue,
      );
      // La signature est rédigée pour l'élève : un conseil accompagne le diagnostic.
      expect(PHONEMES[code].conseil.length, `${code} sans conseil`).toBeGreaterThan(0);
    }
  });

});
