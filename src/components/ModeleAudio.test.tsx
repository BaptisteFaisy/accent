import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ModeleAudio from './ModeleAudio';

/**
 * RF-23 côté UI : le bouton « Écouter le modèle » et son choix de vitesse.
 * On vérifie l'accessibilité et la dégradation (API absente → on le dit), sans
 * jamais déclencher de synthèse réelle.
 */

class UtteranceFaux {
  text: string;

  lang = '';

  rate = 1;

  pitch = 1;

  volume = 1;

  onend: (() => void) | null = null;

  onerror: (() => void) | null = null;

  constructor(texte: string) {
    this.text = texte;
  }
}

let parles: UtteranceFaux[] = [];

function installer() {
  parles = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ lang: 'en-US', name: 'American' }],
      speak: (u: UtteranceFaux) => parles.push(u),
      cancel: () => undefined,
      pending: false,
      speaking: false,
    },
  });
  (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance = UtteranceFaux;
}

function desinstaller() {
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
}

// globals:false dans vite.config : le nettoyage automatique de testing-library
// n'est pas actif, il faut le faire à la main (sinon les rendus s'accumulent).
beforeEach(() => installer());
afterEach(() => {
  cleanup();
  desinstaller();
});

describe('ModeleAudio', () => {
  it('affiche le bouton avec un aria-label qui contient le texte', () => {
    render(<ModeleAudio texte="think" langue="en" />);
    const bouton = screen.getByRole('button', { name: /Écouter le modèle : think/ });
    expect(bouton).toBeTruthy();
  });

  it('vitesse par défaut : 0,75× (le « ralenti » de RF-23)', () => {
    render(<ModeleAudio texte="think" langue="en" />);
    const lent = screen.getByRole('button', { name: '0.75×' });
    expect(lent.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '0.5×' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('la vitesse choisie est celle envoyée à la synthèse', () => {
    render(<ModeleAudio texte="sink" langue="en" />);
    fireEvent.click(screen.getByRole('button', { name: '0.5×' }));
    fireEvent.click(screen.getByRole('button', { name: /Écouter le modèle/ }));
    expect(parles).toHaveLength(1);
    expect(parles[0].rate).toBe(0.5);
    expect(parles[0].text).toBe('sink');
    expect(parles[0].lang).toBe('en-US');
  });

  it('libellé personnalisé pris en compte', () => {
    render(<ModeleAudio texte="tu" langue="fr" label="Écouter « tu »" />);
    expect(screen.getByRole('button', { name: /Écouter « tu » : tu/ })).toBeTruthy();
  });

  it('API absente : bouton désactivé et message explicite', () => {
    desinstaller();
    render(<ModeleAudio texte="think" langue="en" />);
    expect(screen.getByRole('button', { name: /Écouter le modèle/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/indisponible/i);
  });

  it('texte vide : bouton désactivé, rien à lire', () => {
    render(<ModeleAudio texte="   " langue="en" />);
    expect(screen.getByRole('button', { name: /Écouter le modèle/ }).hasAttribute('disabled')).toBe(true);
  });

  it('le groupe de vitesse est étiqueté pour la navigation clavier', () => {
    render(<ModeleAudio texte="think" langue="en" />);
    expect(screen.getByRole('group', { name: 'Vitesse du modèle' })).toBeTruthy();
  });
});
