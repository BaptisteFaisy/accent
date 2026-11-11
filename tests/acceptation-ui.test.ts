import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import DiagnosticVue from '../src/screens/Diagnostic';
import type { Props } from '../src/screens/Diagnostic';
import { fournisseurDemo } from '../src/providers/demo';
import { dureeMs, lectureSynthetique, resultatDe, wavDe } from './aides';

/**
 * §25-9 / honnêteté — « Si une étape est simulée, l'écrire à l'écran » (§6,
 * règle de tournage). Le moteur de démonstration doit se déclarer `simule:true`
 * et l'écran Diagnostic doit afficher un badge « simulation » — et seulement
 * dans ce cas.
 *
 * Le badge réel porte le texte « Mode démonstration — mesure simulée, pas une
 * évaluation réelle » : on matche la racine /simul/i, qui couvre « simulée »
 * comme « simulation ».
 */

const PHRASE = 'I think this is the right thing.';

function props(opts: { simule: boolean }): Props {
  return {
    phrase: PHRASE,
    resultat: resultatDe({ simule: opts.simule }),
    erreur: null,
    onReessayer: () => {},
    onEntrainement: () => {},
    onAccueil: () => {},
  };
}

afterEach(() => {
  cleanup();
});

describe('§25-9 — le moteur de démonstration se déclare simulé', () => {
  it('§25-9 : fournisseurDemo.analyse renvoie simule:true', async () => {
    const signal = lectureSynthetique(6);
    const sortie = await fournisseurDemo.analyse({
      audio: wavDe(signal),
      texte: PHRASE,
      langueCible: 'en',
    });

    expect(sortie.simule).toBe(true);
    expect(sortie.provider).toBe(fournisseurDemo.id);
    expect(sortie.dureeMs).toBe(dureeMs(signal));
    expect(sortie.scores.length).toBeGreaterThan(0);
  });
});

describe('§25-9 — l’écran Diagnostic affiche le badge « simulation »', () => {
  it('§25-9 : badge présent quand resultat.simule est vrai', () => {
    const { queryAllByText } = render(createElement(DiagnosticVue, props({ simule: true })));
    const badges = queryAllByText(/simul/i);

    expect(badges.length).toBeGreaterThan(0);
    const texte = badges.map((b) => b.textContent ?? '').join(' ');
    expect(texte).toMatch(/simul/i);
    expect(texte).toMatch(/d[ée]monstration/i);
  });

  it('§25-9 : aucun badge « simulation » quand resultat.simule est faux', () => {
    const { queryAllByText, container } = render(createElement(DiagnosticVue, props({ simule: false })));

    expect(queryAllByText(/simul/i)).toHaveLength(0);
    expect(container.textContent ?? '').not.toMatch(/simul/i);
    // Le diagnostic reste affiché : seule la mention de simulation disparaît.
    expect(container.textContent ?? '').toContain('think');
  });

  it('§25-1 (écran) : un seul phonème cible est mis en avant', () => {
    const { container } = render(createElement(DiagnosticVue, props({ simule: true })));
    const heros = container.querySelectorAll('[aria-label^="phonème cible"]');

    expect(heros).toHaveLength(1);
    expect(heros[0]?.textContent).toContain('/θ/');
    // Paire minimale affichée : think → sink (§17, table locale, zéro appel modèle).
    const paires = container.querySelectorAll('[aria-label^="Paire minimale"]');
    expect(paires).toHaveLength(1);
    expect(paires[0]?.getAttribute('aria-label')).toMatch(/think/i);
    expect(paires[0]?.getAttribute('aria-label')).toMatch(/sink/i);
  });

  it('§25-9 : état « instable » → l’écran refuse d’afficher un chiffre', () => {
    const { container } = render(
      createElement(DiagnosticVue, {
        ...props({ simule: false }),
        resultat: resultatDe({ simule: false, etat: 'instable', cible: null }),
      }),
    );
    const texte = container.textContent ?? '';

    expect(texte).toMatch(/instable/i);
    expect(container.querySelectorAll('[aria-label^="phonème cible"]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-label^="score du phonème"]')).toHaveLength(0);
  });
});
