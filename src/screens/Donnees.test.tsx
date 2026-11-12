import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Donnees from './Donnees';
import { DECLARATIONS } from '../store/privacy';
import { consignerScore, enregistrerProfil, profilVide } from '../store/profile';

/**
 * RNF-P4 et RNF-P5 côté produit : la mention doit être à l'écran, l'export et la
 * suppression accessibles en un clic, et chaque affirmation renvoyer au code qui
 * la prouve.
 */

function rendre(profil = profilVide()) {
  const exports: string[] = [];
  let efface = 0;
  render(
    <Donnees
      profil={profil}
      onRetour={() => undefined}
      onExporter={() => {
        exports.push('md');
        return '# Accent — mes sons';
      }}
      onEffacer={() => {
        efface += 1;
      }}
    />,
  );
  return { exports, efface: () => efface };
}

beforeEach(() => {
  localStorage.clear();
  // jsdom n'implémente pas createObjectURL : on le bouchonne pour tester le
  // chemin nominal du téléchargement.
  (URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:test';
  (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('écran Tes données', () => {
  it('affiche la mention RNF-P5 en tête d’écran', () => {
    rendre();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tes données');
    expect(document.body.textContent).toContain('Ta voix n’est pas conservée');
  });

  it('liste explicitement ce qui n’est jamais stocké', () => {
    rendre();
    const texte = document.body.textContent ?? '';
    expect(texte).toContain('empreinte vocale');
    expect(texte).toContain('cookie');
  });

  it('chaque déclaration propose un lien vers sa preuve dans le code', () => {
    rendre();
    const liens = Array.from(document.querySelectorAll('a[href*="/blob/main/"]'));
    expect(liens.length).toBe(DECLARATIONS.length);
    for (const a of liens) expect(a.getAttribute('target')).toBe('_blank');
  });

  it('export en un clic', () => {
    const { exports } = rendre();
    fireEvent.click(screen.getByRole('button', { name: /Tout exporter/ }));
    expect(exports).toEqual(['md']);
    // Plusieurs zones live sur l'écran (preuve d'inventaire + message) : on
    // cherche le bon texte parmi elles.
    const messages = screen.getAllByRole('status').map((n) => n.textContent ?? '').join(' | ');
    expect(messages).toMatch(/Export téléchargé/);
  });

  it('téléchargement refusé par le navigateur : on le dit, pas de faux succès', () => {
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    const { exports } = rendre();
    fireEvent.click(screen.getByRole('button', { name: /Tout exporter/ }));
    expect(exports).toEqual(['md']);
    const refus = screen.getAllByRole('status').map((n) => n.textContent ?? '').join(' | ');
    expect(refus).toMatch(/refusé/i);
  });

  it('suppression en deux temps, avec avertissement', () => {
    const { efface } = rendre();
    fireEvent.click(screen.getByRole('button', { name: 'Tout supprimer' }));
    expect(efface()).toBe(0);
    expect(document.body.textContent).toMatch(/définitive/);
    fireEvent.click(screen.getByRole('button', { name: /Oui, tout effacer/ }));
    expect(efface()).toBe(1);
    const messages = screen.getAllByRole('status').map((n) => n.textContent ?? '').join(' | ');
    expect(messages).toMatch(/Tout est effacé/);
  });

  it('annuler la suppression ne supprime rien', () => {
    const { efface } = rendre();
    fireEvent.click(screen.getByRole('button', { name: 'Tout supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(efface()).toBe(0);
  });

  it('affiche l’inventaire réel quand quelque chose est stocké', () => {
    enregistrerProfil(consignerScore(profilVide(), 'P01', 42));
    rendre(consignerScore(profilVide(), 'P01', 42));
    expect(document.body.textContent).toMatch(/son travaillé|sons travaillés/);
    expect(document.body.textContent).toMatch(/accent\.profil/);
  });

  it('aucun score global ni moyenne dans tout l’écran', () => {
    rendre();
    const texte = (document.body.textContent ?? '').toLowerCase();
    // L'écran cite les garde-fous sous forme négative (« jamais de score global »,
    // « aucun classement ») : ce sont des engagements, pas des valeurs affichées.
    // On vérifie donc qu'aucun CHIFFRE agrégé n'apparaît.
    for (const interdit of ['moyenne', 'pourcentage']) {
      expect(texte, interdit).not.toContain(interdit);
    }
    expect(texte).not.toMatch(/\d+\s*%\s*(global|total)/i);
  });
});
