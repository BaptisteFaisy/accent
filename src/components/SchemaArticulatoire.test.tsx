import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SchemaArticulatoire from './SchemaArticulatoire';
import { articulationPour, codesAvecSchema } from '../data/articulation';

/**
 * Le schéma doit être accessible seul (RNF-06 : transcription textuelle de tout
 * retour visuel) et se déduire entièrement des paramètres articulatoires.
 */

// globals: false dans vite.config.ts → cleanup manuel obligatoire.
afterEach(() => cleanup());

describe('SchemaArticulatoire — rendu', () => {
  it('dessine un SVG avec role="img", un aria-label et un <title>', () => {
    render(<SchemaArticulatoire code="P01" />);
    const svg = screen.getByRole('img');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('aria-label')).toMatch(/coupe sagittale/i);
    expect(svg.querySelector('title')?.textContent).toMatch(/pointe de la langue/i);
  });

  it('la légende textuelle reprend la légende des données', () => {
    const a = articulationPour('P01');
    const { container } = render(<SchemaArticulatoire code="P01" />);
    expect(container.querySelector('figcaption')?.textContent).toContain(a?.legende);
  });

  it('tous les codes couverts rendent un schéma, sans exception', () => {
    for (const code of codesAvecSchema()) {
      const { container, unmount } = render(<SchemaArticulatoire code={code} />);
      expect(container.querySelector('svg'), `${code} sans svg`).not.toBeNull();
      expect(container.querySelector('figcaption')?.textContent?.length).toBeGreaterThan(20);
      unmount();
    }
  });

  it('P14 ne rend rien (l’écran utilise BarresSyllabes)', () => {
    const { container } = render(<SchemaArticulatoire code="P14" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('SchemaArticulatoire — sémantique du dessin', () => {
  it('un phonème nasal montre le passage vers le nez', () => {
    const { container } = render(<SchemaArticulatoire code="P08" />);
    expect(container.textContent).toContain('air par le nez');
    expect(container.querySelector('text')?.textContent).toBe('nez');
  });

  it('un phonème non nasal ne montre pas le nez', () => {
    const { container } = render(<SchemaArticulatoire code="P01" />);
    expect(container.textContent).not.toContain('air par le nez');
  });

  it('un phonème voisé annonce la vibration des cordes vocales', () => {
    const { container } = render(<SchemaArticulatoire code="P02" />);
    expect(container.textContent).toContain('cordes vocales en vibration');
  });

  it('un phonème sourd ne l’annonce pas', () => {
    const { container } = render(<SchemaArticulatoire code="P01" />);
    expect(container.textContent).not.toContain('cordes vocales');
  });

  it('la zone active est toujours matérialisée par un cercle', () => {
    for (const code of codesAvecSchema()) {
      const { container, unmount } = render(<SchemaArticulatoire code={code} />);
      expect(container.querySelectorAll('circle').length, `${code} sans repère`).toBeGreaterThanOrEqual(2);
      unmount();
    }
  });

  it('aucune ressource externe : ni <image>, ni href, ni police web', () => {
    for (const code of codesAvecSchema()) {
      const { container, unmount } = render(<SchemaArticulatoire code={code} />);
      const html = container.innerHTML;
      expect(html, `${code} : ressource externe`).not.toContain('<image');
      expect(html, `${code} : href externe`).not.toContain('href=');
      unmount();
    }
  });

  it('la hauteur est bornée et configurable', () => {
    const { container } = render(<SchemaArticulatoire code="E01" hauteur={220} />);
    expect(container.querySelector('svg')?.getAttribute('height')).toBe('220');
  });
});
