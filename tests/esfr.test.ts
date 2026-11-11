// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PHONEMES, codePourIpa, codesPourLangue, entrees } from '../src/data/phonemes';
import { fournisseurDemo, phonemesAttendus } from '../src/providers/demo';
import { phrasesPour } from '../src/data/training';
import { exporterMarkdown, consignerScore, profilVide } from '../src/store/profile';
import { executerPipeline } from '../src/engine/pipeline';
import { encoderWav } from '../src/audio/wav';
import { TAUX_ECHANTILLONNAGE } from '../src/constants';
import { LOCALES } from '../src/providers';
import type { CodePhoneme } from '../src/types';

/**
 * RF-20 — deuxième paire de langues (Espagnol → Français) sur le MÊME moteur.
 * C'est l'argument structurel face à un coach « anglais uniquement » : la
 * taxonomie est une donnée, pas un code parallèle. Ces tests verrouillent
 * l'isolation entre les deux taxonomies.
 */

const PHRASE_FR = 'Le bon pain sent bon dans la maison.';
const PHRASE_EN = 'I think this is the right thing.';

function tone(ms = 2500, f = 220): ArrayBuffer {
  const n = Math.round((TAUX_ECHANTILLONNAGE * ms) / 1000);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i += 1) pcm[i] = 0.4 * Math.sin((2 * Math.PI * f * i) / TAUX_ECHANTILLONNAGE);
  return encoderWav(pcm, TAUX_ECHANTILLONNAGE);
}

describe('taxonomie français (E01..E09)', () => {
  const codes = codesPourLangue('fr');

  it('compte 9 codes, tous marqués langueCible fr', () => {
    expect(codes).toHaveLength(9);
    for (const c of codes) expect(PHONEMES[c].langueCible).toBe('fr');
  });

  it('chaque entrée est exploitable à l’écran', () => {
    for (const c of codes) {
      const e = PHONEMES[c];
      expect(e.ipa.length, `${c} : ipa`).toBeGreaterThan(0);
      expect(e.signature.length, `${c} : signature`).toBeGreaterThan(10);
      expect(e.conseil.length, `${c} : conseil`).toBeGreaterThan(10);
      expect(e.pairesMinimales.length, `${c} : paires`).toBeGreaterThan(0);
      expect(e.motsExemples.length, `${c} : mots`).toBeGreaterThanOrEqual(3);
      expect([1, 2, 3], `${c} : difficulté`).toContain(e.difficulte);
      for (const [a, b] of e.pairesMinimales) {
        expect(a.length).toBeGreaterThan(0);
        expect(b.length).toBeGreaterThan(0);
      }
    }
  });

  it('les deux taxonomies restent disjointes', () => {
    const en = codesPourLangue('en');
    expect(en).toHaveLength(15);
    expect(en.filter((c) => codes.includes(c))).toEqual([]);
    expect(codes.filter((c) => en.includes(c))).toEqual([]);
  });

  it('entrees(langue) ne rend que la langue demandée', () => {
    expect(entrees('fr').every((e) => e.langueCible === 'fr')).toBe(true);
    expect(entrees('en').every((e) => e.langueCible === 'en')).toBe(true);
  });
});

describe('rattachement IPA — pas de collision entre paires de langues', () => {
  it('/v/ vaut P09 en anglais et E05 en français', () => {
    expect(codePourIpa('v', 'en')).toBe('P09');
    expect(codePourIpa('v', 'fr')).toBe('E05');
  });

  it('sans langue, le premier code gagne mais reste cohérent', () => {
    expect(codePourIpa('v')).not.toBeNull();
    expect(codePourIpa('y', 'fr')).toBe('E01');
    expect(codePourIpa('ʃ', 'fr')).toBe('E04');
    expect(codePourIpa('ʒ', 'fr')).toBe('E09');
  });

  it('un IPA inconnu reste null (affiché, jamais ciblé)', () => {
    expect(codePourIpa('ʔ', 'fr')).toBeNull();
    expect(codePourIpa('?', 'en')).toBeNull();
  });
});

describe('lexique du moteur de démo filtré par langue', () => {
  it('une phrase française ne raccroche que des codes E', () => {
    const attendus = phonemesAttendus(PHRASE_FR, 'fr');
    expect(attendus.length).toBeGreaterThan(0);
    for (const a of attendus) expect(a.code.startsWith('E'), `${a.mot} → ${a.code}`).toBe(true);
  });

  it('une phrase anglaise ne raccroche que des codes P', () => {
    const attendus = phonemesAttendus(PHRASE_EN, 'en');
    expect(attendus.length).toBeGreaterThan(0);
    for (const a of attendus) expect(a.code.startsWith('P'), `${a.mot} → ${a.code}`).toBe(true);
  });

  it('une phrase française analysée en anglais ne cible rien', () => {
    expect(phonemesAttendus(PHRASE_FR, 'en')).toEqual([]);
  });
});

describe('pipeline de bout en bout en français', () => {
  it('produit une cible E avec des phrases d’entraînement françaises', async () => {
    const lectures = [1, 2, 3].map(() => ({ audio: tone(), dureeMs: 2500 }));
    const r = await executerPipeline({
      phrase: PHRASE_FR,
      langueCible: 'fr',
      lectures,
      fournisseur: fournisseurDemo,
    });
    const code = r.diagnostic.cible?.code as CodePhoneme;
    expect(code, 'aucune cible').toBeTruthy();
    expect(code.startsWith('E')).toBe(true);
    expect(r.phrases).toHaveLength(3);
    for (const p of r.phrases) {
      expect(p.code).toBe(code);
      expect(p.texte.toLowerCase()).toContain(p.motCle.toLowerCase());
    }
  });

  it('les phrases françaises viennent du cache commité, pas du repli', () => {
    for (const code of codesPourLangue('fr')) {
      const phrases = phrasesPour(code, 'fr');
      expect(phrases).toHaveLength(3);
      expect(phrases.some((p) => p.texte.startsWith('Dis-le lentement')), `${code} : repli`).toBe(false);
    }
  });
});

describe('profil et export bornés à la paire de langues', () => {
  it('l’export français liste les E et pas les P', () => {
    const p = consignerScore(profilVide(), 'E01', 55);
    const md = exporterMarkdown(p, 'fr');
    expect(md).toContain('E01');
    expect(md).toContain('/y/');
    expect(md).not.toContain('P01');
    expect(md.split('\n').filter((l) => /^\|\s*E\d\d\s*\|/.test(l))).toHaveLength(9);
  });

  it('l’export anglais liste les P et pas les E', () => {
    const md = exporterMarkdown(consignerScore(profilVide(), 'P01', 42), 'en');
    expect(md).toContain('P01');
    expect(md).not.toContain('E01');
  });
});

describe('locales d’évaluation', () => {
  it('chaque langue cible a sa locale', () => {
    expect(LOCALES.en).toBe('en-US');
    expect(LOCALES.fr).toBe('fr-FR');
    expect(LOCALES.es).toBe('es-ES');
  });
});
