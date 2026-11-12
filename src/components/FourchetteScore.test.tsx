import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import FourchetteScore from './FourchetteScore';
import { SEUIL_A_TRAVAILLER, SEUIL_ACQUIS } from '../constants';

/**
 * L'incertitude doit être visible : la barre montre l'étendue observée, le trait
 * la médiane, et un message explicite apparaît quand l'étendue traverse un seuil.
 */

afterEach(() => cleanup());

describe('FourchetteScore', () => {
  it('décrit la médiane et l’étendue dans un aria-label lisible', () => {
    render(<FourchetteScore mediane={38} min={34} max={41} lectures={3} />);
    const barre = screen.getByRole('img');
    expect(barre.getAttribute('aria-label')).toContain('38');
    expect(barre.getAttribute('aria-label')).toContain('entre 34 et 41');
    expect(barre.getAttribute('aria-label')).toContain('3 lectures');
  });

  it('affiche le texte « médiane de N lectures · observé entre min et max »', () => {
    const { container } = render(<FourchetteScore mediane={52} min={44} max={60} lectures={3} />);
    expect(container.textContent).toContain('médiane de 3 lectures');
    expect(container.textContent).toContain('entre 44 et 60');
  });

  it('une seule lecture : mention explicite « mesure indicative » (§18.4)', () => {
    const { container } = render(<FourchetteScore mediane={47} min={47} max={47} lectures={1} />);
    expect(container.textContent).toMatch(/Une seule lecture/i);
    expect(container.textContent).toMatch(/moins fiable/i);
  });

  it('étendue traversant un seuil : le doute est dit, pas caché', () => {
    const { container } = render(
      <FourchetteScore mediane={58} min={52} max={66} lectures={3} auBordDuSeuil />,
    );
    expect(container.textContent).toMatch(/traversent un seuil|trop large pour conclure/i);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('sans drapeau : aucun message de doute', () => {
    const { container } = render(<FourchetteScore mediane={38} min={34} max={41} lectures={3} />);
    expect(container.textContent).not.toMatch(/trop large pour conclure/i);
  });

  it('dessine les deux seuils de décision en repères discrets', () => {
    const { container } = render(<FourchetteScore mediane={70} min={62} max={78} lectures={3} />);
    const marques = Array.from(container.querySelectorAll('span[style]')).map((n) =>
      (n as HTMLElement).style.left,
    );
    expect(marques).toContain(`${SEUIL_A_TRAVAILLER}%`);
    expect(marques).toContain(`${SEUIL_ACQUIS}%`);
  });

  it('la barre d’étendue est bornée à 0-100 %', () => {
    const { container } = render(<FourchetteScore mediane={50} min={0} max={100} lectures={3} />);
    const styles = Array.from(container.querySelectorAll('span[style]')).map((n) =>
      (n as HTMLElement).style.width,
    );
    for (const l of styles.filter(Boolean)) {
      const valeur = parseFloat(l);
      expect(Number.isNaN(valeur) ? 0 : valeur).toBeLessThanOrEqual(100);
    }
  });
});
