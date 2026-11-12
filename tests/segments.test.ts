// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MAX_SEGMENTS,
  bilanParPhrase,
  decouper,
  etatAvancement,
  prochainePhrase,
  type ResultatPhrase,
} from '../src/engine/segments';
import type { EtatDiagnostic } from '../src/types';

/**
 * RF-21 — découpage du texte de l'oral et suivi phrase par phrase.
 * Le bilan ne doit JAMAIS produire de score global : c'est le garde-fou §10.
 */

function resultat(
  index: number,
  cible: ResultatPhrase['cible'],
  etat: EtatDiagnostic = 'a_travailler',
): ResultatPhrase {
  return { index, texte: `phrase ${index}`, cible, score: cible ? 40 : null, etat };
}

describe('decouper — ponctuation', () => {
  it('découpe sur point, point d’exclamation et point d’interrogation', () => {
    expect(decouper('Je viens. Tu viens ! Vient-il ?')).toEqual(['Je viens.', 'Tu viens !', 'Vient-il ?']);
  });

  it('gère les points de suspension', () => {
    expect(decouper('Il hésite… puis il part.')).toEqual(['Il hésite…', 'puis il part.']);
  });

  it('une seule phrase sans ponctuation finale reste entière', () => {
    expect(decouper('Le bon pain sent bon')).toEqual(['Le bon pain sent bon']);
  });

  it('texte vide ou blancs → aucun segment', () => {
    expect(decouper('')).toEqual([]);
    expect(decouper('   \n  ')).toEqual([]);
  });

  it('normalise sauts de ligne et espaces multiples', () => {
    expect(decouper('Première   phrase.\n\n  Deuxième phrase.')).toEqual([
      'Première phrase.',
      'Deuxième phrase.',
    ]);
  });
});

describe('decouper — pièges classiques', () => {
  it('les abréviations ne coupent pas la phrase', () => {
    expect(decouper('M. Dupont arrive etc. et reparte.')).toEqual([
      'M. Dupont arrive etc. et reparte.',
    ]);
  });

  it('un nombre décimal ne coupe pas la phrase', () => {
    expect(decouper('Il mesure 1.78 m environ.')).toEqual(['Il mesure 1.78 m environ.']);
  });

  it('un point suivi d’un mot sans espace ne coupe pas (nom de domaine)', () => {
    expect(decouper('Le site example.com est en ligne.')).toEqual([
      'Le site example.com est en ligne.',
    ]);
  });

  it('Dr et Mme ne coupent pas', () => {
    expect(decouper('Dr Martin et Mme Curie sont là.')).toEqual(['Dr Martin et Mme Curie sont là.']);
  });
});

describe('decouper — fragments et plafond', () => {
  it('un fragment est rattaché à la phrase précédente, jamais perdu', () => {
    const s = decouper('Il parle longtemps. Oui. Puis il conclut son propos.');
    expect(s.join(' ')).toContain('Oui.');
    expect(s).toEqual(['Il parle longtemps. Oui.', 'Puis il conclut son propos.']);
  });

  it('plafond : au-delà de 40 phrases, la fin est regroupée, rien n’est jeté', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Phrase numéro ${i} du texte.`).join(' ');
    const s = decouper(long);
    expect(s).toHaveLength(MAX_SEGMENTS);
    expect(s[MAX_SEGMENTS - 1]).toContain('Phrase numéro 59');
    expect(s.join(' ')).toContain('Phrase numéro 0');
  });

  it('exactement 40 phrases : aucune troncature', () => {
    const exact = Array.from({ length: 40 }, (_, i) => `Phrase numéro ${i} du texte.`).join(' ');
    expect(decouper(exact)).toHaveLength(40);
  });
});

describe('etatAvancement et prochainePhrase', () => {
  const segments = ['A un.', 'B deux.', 'C trois.'];

  it('marque la phrase courante et laisse les autres à faire', () => {
    const s = etatAvancement(segments, 1);
    expect(s.map((x) => x.etat)).toEqual(['a_faire', 'en_cours', 'a_faire']);
  });

  it('les états enregistrés priment sur la position', () => {
    const s = etatAvancement(segments, 2, { 0: 'fait', 1: 'saute' });
    expect(s.map((x) => x.etat)).toEqual(['fait', 'saute', 'en_cours']);
  });

  it('prochainePhrase saute ce qui est déjà traité', () => {
    expect(prochainePhrase(segments, { 0: 'fait' })).toBe(1);
    expect(prochainePhrase(segments, { 0: 'fait', 1: 'saute' })).toBe(2);
  });

  it('tout est traité → plus de prochaine phrase', () => {
    expect(prochainePhrase(segments, { 0: 'fait', 1: 'fait', 2: 'fait' })).toBeNull();
  });
});

describe('bilanParPhrase — jamais de note globale', () => {
  it('GARDE-FOU §10 : aucun champ de score agrégé dans le bilan', () => {
    const b = bilanParPhrase([resultat(0, 'P01'), resultat(1, null, 'rien_a_corriger')]);
    const cles = Object.keys(b).sort();
    expect(cles).toEqual(['faites', 'phrases', 'sansErreur', 'sautees', 'sonsRecurrents']);
    const brut = JSON.stringify(b).toLowerCase();
    for (const interdit of ['moyenne', 'pourcentage', 'global']) {
      expect(brut, interdit).not.toContain(interdit);
    }
  });

  it('compte les phrases faites, sautées et sans erreur', () => {
    const b = bilanParPhrase([
      resultat(0, 'P01'),
      resultat(1, null, 'rien_a_corriger'),
      resultat(2, null, 'erreur'),
    ]);
    expect(b.phrases).toHaveLength(3);
    expect(b.sansErreur).toBe(1);
    expect(b.sautees).toBe(1);
  });

  it('un son qui revient sur plusieurs phrases distinctes remonte', () => {
    const b = bilanParPhrase([
      resultat(0, 'P01'),
      resultat(1, 'P01'),
      resultat(2, 'P04'),
    ]);
    expect(b.sonsRecurrents).toEqual([{ code: 'P01', fois: 2 }]);
  });

  it('le même index compté deux fois ne gonfle pas la récurrence', () => {
    const b = bilanParPhrase([resultat(0, 'P01'), { ...resultat(0, 'P01'), texte: 'reprise' }]);
    expect(b.sonsRecurrents).toEqual([]);
  });

  it('liste vide : bilan vide, aucune exception', () => {
    const b = bilanParPhrase([]);
    expect(b.phrases).toEqual([]);
    expect(b.sonsRecurrents).toEqual([]);
    expect(b.faites).toBe(0);
  });
});

describe('decouper — fragment initial', () => {
  it('« Bonjour. » en ouverture est rattaché à la phrase suivante, pas isolé', () => {
    expect(decouper('Bonjour. Je presente le projet Accent aujourd hui.')).toEqual([
      'Bonjour. Je presente le projet Accent aujourd hui.',
    ]);
  });

  it('un texte d’un seul mot reste tel quel', () => {
    expect(decouper('Bonjour.')).toEqual(['Bonjour.']);
  });

  it('deux fragments initiaux successifs sont regroupés, pas éparpillés', () => {
    // « Oui. » et « Bon. » fusionnent entre eux ; le résultat (2 mots) atteint le
    // seuil d'une phrase et n'est donc pas aspiré par la suivante.
    expect(decouper('Oui. Bon. Nous allons commencer le travail maintenant.')).toEqual([
      'Oui. Bon.',
      'Nous allons commencer le travail maintenant.',
    ]);
  });
});
