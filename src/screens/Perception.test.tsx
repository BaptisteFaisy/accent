import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Perception from './Perception';

/**
 * Écran de perception : sans synthèse vocale (jsdom n'en fournit pas), l'écran
 * doit le dire honnêtement et proposer le repli « à deux ». Le parcours de
 * réponse et le bilan doivent rester exempts de tout pourcentage global.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function boutonsReponse() {
  return [screen.getByRole('button', { name: 'Réponse A' }), screen.getByRole('button', { name: 'Réponse B' })];
}

describe('écran Perception', () => {
  it('pose la question et propose deux réponses A/B', () => {
    render(<Perception code="P01" langue="en" onQuitter={() => undefined} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Lequel as-tu entendu/);
    expect(boutonsReponse()).toHaveLength(2);
    expect(screen.getByText(/Exercice 1 \/ 6/)).toBeTruthy();
  });

  it('sans synthèse vocale : message de repli explicite, jamais de silence', () => {
    render(<Perception code="P01" langue="en" onQuitter={() => undefined} />);
    expect(screen.getByRole('status').textContent).toMatch(/ne peut pas lire les mots/i);
    expect(screen.getByRole('status').textContent).toMatch(/à deux/i);
  });

  it('une réponse révèle le mot entendu et la paire minimale', () => {
    render(<Perception code="P01" langue="en" onQuitter={() => undefined} />);
    fireEvent.click(boutonsReponse()[0]);
    // Le bloc de retour porte aria-live="polite" (role=status) ; il s'ajoute au
    // message de repli TTS déjà présent, donc on regarde le contenu global.
    expect(document.body.textContent).toMatch(/think|sink|three|free|mouth|mouse/);
    expect(screen.getByRole('button', { name: /Mot suivant|Voir le bilan/ })).toBeTruthy();
  });

  it('les boutons de réponse sont désactivés après avoir répondu', () => {
    render(<Perception code="P01" langue="en" onQuitter={() => undefined} />);
    fireEvent.click(boutonsReponse()[0]);
    for (const b of boutonsReponse()) expect(b.hasAttribute('disabled')).toBe(true);
  });

  it('parcours complet : le bilan compte des mots, jamais un pourcentage', () => {
    render(<Perception code="P01" langue="en" onQuitter={() => undefined} />);
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(boutonsReponse()[i % 2]);
      fireEvent.click(screen.getByRole('button', { name: /Mot suivant|Voir le bilan/ }));
    }
    const texte = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    expect(texte).toMatch(/mot(s)? reconnu(s)? sur 6/);
    expect(texte).not.toContain('%');
    expect(document.body.textContent).not.toMatch(/\d+\s*%/);
  });

  it('le bilan propose de refaire et de passer à la production', () => {
    render(
      <Perception code="P01" langue="en" onQuitter={() => undefined} onTravailler={() => undefined} />,
    );
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(boutonsReponse()[0]);
      fireEvent.click(screen.getByRole('button', { name: /Mot suivant|Voir le bilan/ }));
    }
    expect(screen.getByRole('button', { name: 'Refaire' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Travailler ce son à voix haute/ })).toBeTruthy();
  });

  it('code positionnel (P14) : pas d’exercice d’écoute, explication donnée', () => {
    render(<Perception code="P14" langue="en" onQuitter={() => undefined} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Pas d.exercice d.écoute/);
    expect(document.body.textContent).toMatch(/accent de\s*mot/);
  });
});
