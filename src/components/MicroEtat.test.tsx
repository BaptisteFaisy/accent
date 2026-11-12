import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MicroEtat from './MicroEtat';

/**
 * jsdom n'expose pas navigator.mediaDevices : c'est exactement le cas « le
 * navigateur ne peut rien demander ». Le composant doit alors parler, et non
 * rester muet comme un bouton d'enregistrement qui ne fait rien.
 */

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('MicroEtat', () => {
  it('affiche un statut quand le micro est inutilisable', async () => {
    render(<MicroEtat />);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    const texte = screen.getByRole('status').textContent ?? '';
    expect(texte.length).toBeGreaterThan(20);
  });

  it('reste silencieux quand tout va bien et qu’aucun détail n’est demandé', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
        enumerateDevices: () =>
          Promise.resolve([{ kind: 'audioinput', deviceId: 'a', label: '', groupId: '', toJSON: () => ({}) }]),
      },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'granted' }) },
    });
    const { container } = render(<MicroEtat />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('en mode détaillé, montre permission, entrées et HTTPS', async () => {
    render(<MicroEtat detaille />);
    await waitFor(() => expect(screen.getByText('Permission :')).toBeTruthy());
    expect(screen.getByText('Entrées audio vues :')).toBeTruthy();
    expect(screen.getByText('HTTPS :')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-tester' })).toBeTruthy();
  });

  it('API micro absente : on n’affiche PAS de bouton « demander » (il ne servirait à rien)', async () => {
    render(<MicroEtat detaille />);
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Demander l’accès au micro/ })).toBeNull();
    expect((screen.getByRole('status').textContent ?? '').length).toBeGreaterThan(20);
  });

  it('accès bloqué par le navigateur : le bouton de demande explicite est proposé', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new Error('refus')), enumerateDevices: () => Promise.resolve([]) },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => Promise.resolve({ state: 'denied' }) },
    });
    render(<MicroEtat detaille />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Demander l’accès au micro/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Demander l’accès au micro/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/bloqué|refusé/i));
  });
});
