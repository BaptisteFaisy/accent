import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ajouterPreuve,
  chargerPreuves,
  effacerPreuves,
  preuvesEnMarkdown,
  toutSupprimerDonneesLocales,
} from './preuves';

/**
 * Le journal des preuves : chaque étape doit prouver qu'elle a fonctionné, et
 * la preuve doit être vérifiable (données + fichier du code). Aucun audio,
 * aucune donnée biométrique — seulement des nombres, des dates et du texte.
 */

beforeEach(() => {
  localStorage.clear();
  effacerPreuves();
});

afterEach(() => localStorage.clear());

describe('journal des preuves', () => {
  it('enregistre une preuve avec ses détails et sa source', () => {
    const p = ajouterPreuve('analyse', 'Diagnostic établi', ['médiane 38', 'écart 7'], 'src/engine/measure.ts');
    expect(p.etape).toBe('analyse');
    expect(p.titre).toBe('Diagnostic établi');
    expect(p.details).toEqual(['médiane 38', 'écart 7']);
    expect(p.source).toBe('src/engine/measure.ts');
    expect(p.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('les preuves sont persistées et relues', () => {
    ajouterPreuve('enregistrement', 'Prise 1 enregistrée', ['durée : 2.4 s']);
    const relues = chargerPreuves();
    expect(relues).toHaveLength(1);
    expect(relues[0].titre).toBe('Prise 1 enregistrée');
    expect(relues[0].details).toContain('durée : 2.4 s');
  });

  it('la preuve la plus récente d’une étape passe en premier', () => {
    ajouterPreuve('analyse', 'première', []);
    ajouterPreuve('analyse', 'seconde', []);
    const p = chargerPreuves();
    expect(p[0].titre).toBe('seconde');
    expect(p).toHaveLength(2);
  });

  it('les étapes sont indépendantes', () => {
    ajouterPreuve('analyse', 'A', []);
    ajouterPreuve('comparaison', 'B', []);
    const p = chargerPreuves();
    expect(p.filter((x) => x.etape === 'analyse')).toHaveLength(1);
    expect(p.filter((x) => x.etape === 'comparaison')).toHaveLength(1);
  });

  it('efface tout', () => {
    ajouterPreuve('analyse', 'A', []);
    toutSupprimerDonneesLocales();
    expect(chargerPreuves()).toEqual([]);
  });

  it('le Markdown porte chaque preuve, ses données et où la vérifier', () => {
    ajouterPreuve('analyse', 'Diagnostic : /θ/ dans think', ['médiane 38'], 'src/engine/measure.ts');
    const md = preuvesEnMarkdown(chargerPreuves());
    expect(md).toContain('Journal des preuves');
    expect(md).toContain('Diagnostic : /θ/ dans think');
    expect(md).toContain('médiane 38');
    expect(md).toContain('src/engine/measure.ts');
    expect(md).toContain('où vérifier');
  });

  it('aucune preuve ne contient d’audio ni d’empreinte', () => {
    ajouterPreuve('enregistrement', 'Prise', ['durée : 2.4 s']);
    const brut = JSON.stringify(chargerPreuves()).toLowerCase();
    expect(brut).not.toContain('riff');
    expect(brut).not.toContain('base64');
    expect(brut).not.toContain('blob:');
  });
});
