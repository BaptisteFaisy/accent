import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Preuve from './Preuve';
import { ajouterPreuve, effacerPreuves } from '../store/preuves';

/**
 * La preuve doit être lisible, datée, et indiquer où la vérifier. Tant que
 * l'étape n'a rien produit, le composant ne rend RIEN (pas de boîte vide).
 */

afterEach(() => {
  cleanup();
  effacerPreuves();
  localStorage.clear();
});

describe('Preuve', () => {
  it('ne rend rien tant que l’étape n’a rien produit', () => {
    const { container } = render(<Preuve etape="analyse" />);
    expect(container.innerHTML).toBe('');
  });

  it('affiche la dernière preuve de l’étape avec ses détails et sa source', () => {
    ajouterPreuve('analyse', 'Diagnostic : /θ/ dans think', ['médiane 38', 'écart 7'], 'src/engine/measure.ts');
    render(<Preuve etape="analyse" />);
    const bloc = screen.getByRole('status');
    expect(bloc.textContent).toContain('Diagnostic : /θ/ dans think');
    expect(bloc.textContent).toContain('médiane 38');
    expect(bloc.textContent).toContain('src/engine/measure.ts');
    expect(bloc.textContent).toContain('✓');
  });

  it('n’affiche que la preuve de l’étape demandée', () => {
    ajouterPreuve('analyse', 'preuve analyse', []);
    ajouterPreuve('comparaison', 'preuve comparaison', []);
    render(<Preuve etape="comparaison" />);
    expect(screen.getByRole('status').textContent).toContain('preuve comparaison');
    expect(screen.getByRole('status').textContent).not.toContain('preuve analyse');
  });

  it('mode complet : le journal entier, du plus récent au plus ancien', () => {
    ajouterPreuve('analyse', 'preuve A', []);
    ajouterPreuve('profil', 'preuve B', []);
    const { container } = render(<Preuve complet />);
    expect(container.textContent).toContain('Journal des preuves');
    expect(container.textContent).toContain('preuve B');
    expect(container.textContent).toContain('preuve A');
  });

  it('mode complet sans aucune preuve : rien', () => {
    const { container } = render(<Preuve complet />);
    expect(container.innerHTML).toBe('');
  });
});
