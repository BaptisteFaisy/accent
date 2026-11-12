import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';

/**
 * Test d'intégration du câblage — leçon du 12/11 : deux PR ont modifié le même
 * bloc JSX de src/App.tsx, le merge a été TEXTUELLEMENT propre mais a perdu
 * `onOralLong` : la vue existait, plus aucun bouton n'y menait. Aucun test
 * unitaire ne pouvait le voir (chaque écran pris isolément fonctionnait).
 *
 * On vérifie donc que chaque entrée annoncée mène réellement à son écran.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('câblage des écrans depuis l’accueil', () => {
  it('affiche les deux entrées ajoutées (oral long, mes données)', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /texte long/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Voir mes données/i })).toBeTruthy();
  });

  it('« Voir mes données » ouvre bien l’écran Tes données', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Voir mes données/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tes données');
  });

  it('« texte long » ouvre bien le mode oral long', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /texte long/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/oral, phrase par phrase/i);
    expect(screen.getByLabelText('Texte de ton oral')).toBeTruthy();
  });

  it('« Mes sons » ouvre le profil de la paire de langues courante', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes sons' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/profil de sons/i);
  });

  it('le mode oral long découpe le texte collé en direct', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /texte long/i }));
    const zone = screen.getByLabelText('Texte de ton oral') as HTMLTextAreaElement;
    fireEvent.change(zone, { target: { value: 'Je viens. Tu viens ! Vient-il ?' } });
    expect(document.body.textContent).toMatch(/3 phrases détectées/);
  });
});
