import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import { PHONEMES } from '../src/data/phonemes';
import { phrasesPour } from '../src/data/training';

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

describe('toutes les fonctionnalités sont visibles depuis l’accueil', () => {
  it('le hub liste les quatre modes', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Travailler une phrase/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /texte long phrase par phrase/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /catalogue des sons/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /mon profil de sons/i })).toBeTruthy();
  });

  it('« Entraîner mon oreille » ouvre le catalogue des 15 sons FR→EN', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /catalogue des sons/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Les 15 sons/);
    // Les boutons portent un aria-label descriptif (plus utile qu'un libellé court).
    expect(
      screen.getAllByRole('button', { name: /^Entraîner mon oreille sur le son/ }).length,
    ).toBeGreaterThan(10);
  });

  it('le catalogue donne accès à la discrimination auditive', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /catalogue des sons/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Entraîner mon oreille sur le son/ })[0]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Lequel as-tu entendu/);
  });

  it('le catalogue donne accès à l’entraînement à la voix, cible forcée', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /catalogue des sons/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Travailler le son .* à la voix$/ })[0]);
    expect(document.body.textContent).toMatch(/Lecture 1 \/ 3/);
  });

  it('le P14 (accent de mot) n’a pas de discrimination : bouton désactivé et expliqué', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /catalogue des sons/i }));
    // P14 est le seul code positionnel : son bouton de discrimination est désactivé.
    const tous = screen.getAllByRole('button', { name: /^Entraîner mon oreille sur le son/ });
    const desactives = tous.filter((b) => b.hasAttribute('disabled'));
    expect(desactives).toHaveLength(1);
    expect(desactives[0].getAttribute('aria-label')).toContain('ˈ');
    expect(desactives[0].textContent).toMatch(/Pas de paire minimale/);
  });

  it('en paire ES→FR, le catalogue liste les 9 sons français', () => {
    localStorage.setItem(
      'accent.reglages.v1',
      JSON.stringify({ langueCible: 'fr', urlProxy: '', cleAzure: '', regionAzure: 'westeurope', lectures: 3, consentementAffiche: true }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /catalogue des sons/i }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Les 9 sons/);
    expect(document.body.textContent).toContain('/y/');
  });

  it('le profil ouvre le catalogue et permet d’agir son par son', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes sons' }));
    expect(screen.getByRole('button', { name: /Voir les 15 sons/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Discriminer le son/ }).length).toBeGreaterThan(10);
    expect(screen.getAllByRole('button', { name: /Travailler le son/ }).length).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole('button', { name: /Voir les 15 sons/ }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Les 15 sons/);
  });
});

describe('entrées « oreille » présentes sur les écrans de travail', () => {
  // Un diagnostic complet exige trois enregistrements : on rend les écrans
  // directement avec des objets conformes à src/types.ts.
  const cible = {
    code: 'P01' as const,
    entree: PHONEMES.P01,
    score: 34,
    mot: 'think',
    indexMot: 1,
    poids: 100,
    occurrences: 2,
  };

  it('l’écran d’entraînement propose la discrimination auditive', async () => {
    const { default: Entrainement } = await import('../src/screens/Entrainement');
    render(
      <Entrainement
        cible={cible}
        phrases={phrasesPour('P01', 'en')}
        onPhrase={() => undefined}
        onQuitter={() => undefined}
        onPerception={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /Entraîner mon oreille/ })).toBeTruthy();
    cleanup();
  });

  it('le diagnostic propose la discrimination auditive pour une cible phonétique', async () => {
    const { default: DiagnosticVue } = await import('../src/screens/Diagnostic');
    render(
      <DiagnosticVue
        phrase="I think this is the right thing."
        resultat={{
          diagnostic: { etat: 'a_travailler', cible, scores: [], mesure: null, message: '' },
          phrases: phrasesPour('P01', 'en'),
          provider: 'demo-local',
          simule: true,
          msParEtape: {},
          msTotal: 10,
        }}
        erreur={null}
        onReessayer={() => undefined}
        onEntrainement={() => undefined}
        onAccueil={() => undefined}
        onPerception={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: /Entraîner mon oreille/ })).toBeTruthy();
    cleanup();
  });
});
