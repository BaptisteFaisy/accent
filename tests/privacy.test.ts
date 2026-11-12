import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DECLARATIONS,
  JAMAIS_COLLECTE,
  inventorier,
  resume,
  urlPreuve,
} from '../src/store/privacy';
import { ajouterSession, consignerScore, profilVide, toutEffacer } from '../src/store/profile';
import { enregistrerReglages, REGLAGES_DEFAUT } from '../src/store/settings';
import type { Session } from '../src/types';

/**
 * RNF-P1..P5 et garde-fous §10 : l'écran « Tes données » doit couvrir chaque
 * exigence, pointer vers une preuve vérifiable dans le code, et ne JAMAIS
 * révéler de contenu sensible (la clé BYOK notamment).
 */

function session(cible: Session['cible'], phrase: string): Session {
  return {
    id: phrase,
    createdAt: new Date('2026-11-11T12:00:00Z').toISOString(),
    langueCible: 'en',
    phrase,
    cible,
    scores: [],
  };
}

beforeEach(() => {
  // On ne pré-écrit PAS les réglages : l'inventaire doit pouvoir être vide.
  localStorage.clear();
});

afterEach(() => {
  toutEffacer();
  localStorage.clear();
});

describe('couverture des déclarations', () => {
  const cles = DECLARATIONS.map((d) => d.cle);

  it('couvre les cinq exigences RNF-P1..P5', () => {
    expect(cles).toEqual(expect.arrayContaining(['audio', 'journal', 'biometrie', 'export', 'mention']));
  });

  it('couvre les garde-fous produit (§10)', () => {
    expect(cles).toEqual(expect.arrayContaining(['score-global', 'objectif']));
  });

  it('couvre le mode BYOK et l’absence de compte', () => {
    expect(cles).toEqual(expect.arrayContaining(['byok', 'compte']));
  });

  it('chaque déclaration a un titre, une réponse et une preuve exploitables', () => {
    for (const d of DECLARATIONS) {
      expect(d.titre.length, d.cle).toBeGreaterThan(10);
      expect(d.reponse.length, d.cle).toBeGreaterThan(40);
      expect(d.preuve, `${d.cle} sans preuve`).toMatch(/^[a-zA-Z0-9_./-]+\.(ts|tsx|mjs|yml|md)/);
    }
  });

  it('les preuves pointent vers des fichiers qui existent dans le dépôt', async () => {
    // @ts-ignore — module Node non typé dans ce projet
    const { readFileSync } = await import('node:fs');
    for (const d of DECLARATIONS) {
      const chemin = d.preuve.split(' ')[0].replace(/[·()]/g, '');
      expect(() => readFileSync(chemin, 'utf8'), `preuve illisible : ${chemin}`).not.toThrow();
    }
  });

  it('urlPreuve produit un lien GitHub vers main', () => {
    const url = urlPreuve('src/store/profile.ts (toutEffacer)');
    expect(url).toBe('https://github.com/Tradoooo/accent/blob/main/src/store/profile.ts');
  });

  it('la liste « jamais collecté » cite explicitement la voix et l’identité', () => {
    const texte = JAMAIS_COLLECTE.join(' ').toLowerCase();
    expect(texte).toContain('voix');
    expect(texte).toContain('nom');
    expect(texte).toContain('biométrique');
    expect(texte).toContain('cookie');
  });
});

describe('inventaire réel du navigateur', () => {
  it('vide : le dit clairement', () => {
    const etat = inventorier(profilVide());
    expect(etat.cles).toEqual([]);
    expect(resume(etat)[0]).toMatch(/Rien n’est stocké/);
  });

  it('reflète les séances et les sons travaillés', () => {
    ajouterSession(session('P01', 'I think so.'));
    const profil = consignerScore(profilVide(), 'P01', 42);
    const etat = inventorier(profil);
    expect(etat.sessions).toBe(1);
    expect(etat.phonemesTravailles).toBe(1);
    expect(etat.octetsTotal).toBeGreaterThan(0);
    expect(resume(etat).join(' ')).toMatch(/1 séance/);
  });

  it('détecte la présence d’une clé BYOK SANS jamais la révéler', () => {
    const cle = 'sk-secret-tres-long-1234567890';
    enregistrerReglages({ ...REGLAGES_DEFAUT, cleAzure: cle });
    const etat = inventorier(profilVide());
    expect(etat.byokPresent).toBe(true);
    const texte = resume(etat).join(' ');
    expect(texte).toMatch(/clé API personnelle/);
    expect(texte).not.toContain(cle);
    expect(texte).not.toContain('sk-secret');
  });

  it('le résumé ne contient ni audio, ni base64, ni empreinte', () => {
    ajouterSession(session('P01', 'I think this is the right thing.'));
    const etat = inventorier(consignerScore(profilVide(), 'P01', 34));
    const texte = resume(etat).join(' ');
    expect(texte.toLowerCase()).not.toContain('riff');
    expect(texte.toLowerCase()).not.toContain('base64');
    expect(texte.toLowerCase()).not.toContain('blob:');
    expect(texte).toMatch(/Aucun audio/);
  });
});
