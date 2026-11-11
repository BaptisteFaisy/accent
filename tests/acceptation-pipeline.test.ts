import { describe, expect, it } from 'vitest';
import { executerPipeline } from '../src/engine/pipeline';
import type { Lecture } from '../src/engine/pipeline';
import { fournisseurDemo } from '../src/providers/demo';
import { CODES_PHONEMES, motPorteur } from '../src/data/phonemes';
import { DUREE_MIN_MS, ECART_MAX, LECTURES_REFERENCE, SEUIL_ACQUIS } from '../src/constants';
import type { ProgressionPipeline } from '../src/types';
import { dureeMs, fournisseurEspion, lectureSynthetique, scoreDe, wavDe } from './aides';

/**
 * Critères d'acceptation §25 vérifiés de bout en bout sur le pipeline réel :
 * §25-1 (une cible unique + les 5 étapes annoncées), §25-3/RNF-04 (rien à
 * corriger), §25-5/RNF-11 (mesure instable) et §18.4 (audio trop court).
 *
 * Aucun micro : les lectures sont des WAV 16 kHz synthétisés en test.
 */

const PHRASE = 'I think this is the right thing.';

/** Trois lectures identiques d'un même signal : le mode « référence » du produit. */
function lectures(n: number, signal: Float32Array): Lecture[] {
  const wav = wavDe(signal);
  const duree = dureeMs(signal);
  return Array.from({ length: n }, () => ({ audio: wav, dureeMs: duree }));
}

function dedoublonner(etapes: string[], p: ProgressionPipeline): void {
  if (etapes[etapes.length - 1] !== p.etape) etapes.push(p.etape);
}

describe('§25-1 — une phrase lue produit un diagnostic nommant UN seul phonème cible', () => {
  const signal = lectureSynthetique(6);

  it('§25-1 : le pipeline réel (fournisseurDemo, 3 lectures) nomme exactement une cible', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, signal),
      fournisseur: fournisseurDemo,
    });

    const { cible, etat } = resultat.diagnostic;
    expect(etat).toBe('a_travailler');
    expect(cible).not.toBeNull();
    // UN seul phonème : un objet unique (jamais une liste), issu de la taxonomie fermée.
    expect(Array.isArray(cible)).toBe(false);
    expect(CODES_PHONEMES).toContain(cible?.code);
    expect(cible?.entree.code).toBe(cible?.code);
    // La cible nomme un mot réellement présent dans la phrase lue.
    expect(PHRASE.toLowerCase().split(/\W+/)).toContain(cible?.mot.toLowerCase());
    // Consolidation sur les 3 lectures (§18.4) : médiane, écart nul ici, mesure stable.
    expect(resultat.diagnostic.mesure?.lectures).toBe(LECTURES_REFERENCE);
    expect(resultat.diagnostic.mesure?.stable).toBe(true);
    expect(cible?.score).toBeLessThan(SEUIL_ACQUIS);
  });

  it('§25-1 : le pipeline annonce ses 5 étapes dans l’ordre via onProgress', async () => {
    const etapes: string[] = [];
    await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, signal),
      fournisseur: fournisseurDemo,
      onProgress: (p) => dedoublonner(etapes, p),
    });

    // Ordre imposé par §18.2 : écoute → évaluation → diagnostic → explication → exercice.
    expect(etapes).toEqual(['ecoute', 'evaluation', 'diagnostic', 'explication', 'exercice']);
  });

  it('§25-1 : chaque étape est chronométrée et le budget RNF-01 est tenu', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, signal),
      fournisseur: fournisseurDemo,
    });

    expect(Object.keys(resultat.msParEtape).sort()).toEqual(
      ['diagnostic', 'ecoute', 'evaluation', 'explication', 'exercice'].sort(),
    );
    expect(resultat.msTotal).toBeLessThan(10_000);
    expect(resultat.phrases).toHaveLength(3);
    expect(resultat.simule).toBe(true);
  });

  it('§25-1 : le diagnostic n’expose aucun champ de score global', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, signal),
      fournisseur: fournisseurDemo,
    });
    // Structure imposée par src/types.ts : état, cible, scores par phonème, mesure, message.
    expect(Object.keys(resultat.diagnostic).sort()).toEqual(
      ['cible', 'etat', 'mesure', 'message', 'scores'].sort(),
    );
  });

  /**
   * BUG PRODUIT n°1 — corrigé dans main par 85b80da (« lexique du moteur de
   * démonstration — plus de cible sur un mot d'une lettre »).
   *
   * Rappel du défaut : `phonemesAttendus()` (src/providers/demo.ts) rattachait les
   * mots par inclusion bidirectionnelle (`mot.includes(m) || m.includes(mot)`), donc
   * sur la phrase phare (§5) le pronom « i » s'accrochait à P01 (/θ/) et « is »/« the »
   * à P02 (/ð/). La cible étant l'occurrence la plus dégradée, l'écran Diagnostic
   * affichait « /θ/ dans « i » » au lieu de « /θ/ dans « think » » — le plan clé de
   * la vidéo (§6, 1:05-1:30).
   *
   * Ce test reste comme VERROU DE NON-RÉGRESSION : le mot de la cible doit porter
   * réellement le phonème au sens de la taxonomie (`motPorteur`).
   */
  it('§25-1 (bug n°1 corrigé par 85b80da) : le mot de la cible porte réellement le phonème', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, signal),
      fournisseur: fournisseurDemo,
    });
    const cible = resultat.diagnostic.cible;

    expect(cible).not.toBeNull();
    expect(motPorteur(cible!.code, cible!.mot), `« ${cible?.mot} » ne porte pas /${cible?.entree.ipa}/`).toBe(true);
    // Les mots d'une lettre ne sont plus rattachés à un phonème ni scorés.
    expect(cible!.mot.length).toBeGreaterThan(1);
    for (const s of resultat.diagnostic.scores) {
      expect(s.mot.length, `mot « ${s.mot} » scoré à tort`).toBeGreaterThan(1);
      expect(motPorteur(s.code!, s.mot), `« ${s.mot} » ne porte pas /${s.ipa}/`).toBe(true);
    }
  });
});

describe('§25-3 / RNF-04 — phrase parfaitement prononcée : zéro faux positif', () => {
  const bonsScores = [
    scoreDe('P01', 'think', 1, 92),
    scoreDe('P02', 'this', 2, 88),
    scoreDe('P04', 'ship', 3, 85),
    scoreDe('P07', 'right', 5, SEUIL_ACQUIS),
  ];

  it('§25-3 : tous les phonèmes ≥ 80 → « rien_a_corriger », cible nulle', async () => {
    const espion = fournisseurEspion([bonsScores]);
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, lectureSynthetique(6)),
      fournisseur: espion,
    });

    expect(resultat.diagnostic.etat).toBe('rien_a_corriger');
    expect(resultat.diagnostic.cible).toBeNull();
    expect(resultat.diagnostic.mesure).toBeNull();
    expect(espion.appels).toBe(LECTURES_REFERENCE);
  });

  it('§25-3 : le message propose une phrase plus difficile, sans inventer de problème', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(LECTURES_REFERENCE, lectureSynthetique(6)),
      fournisseur: fournisseurEspion([bonsScores]),
    });

    expect(resultat.diagnostic.message).toMatch(/plus difficile/i);
    // Zéro faux positif : aucun chiffre avancé, aucune cible, aucun exercice imposé.
    expect(resultat.diagnostic.message).not.toMatch(/\d/);
    expect(resultat.phrases).toHaveLength(0);
  });
});

describe('§25-5 / RNF-11 — écart > 20 points entre deux lectures', () => {
  it('§25-5 : deux lectures écartées de plus de 20 points → « instable », aucun chiffre', async () => {
    const ecart = ECART_MAX + 25;
    const espion = fournisseurEspion([
      [scoreDe('P01', 'think', 1, 30)],
      [scoreDe('P01', 'think', 1, 30 + ecart)],
    ]);
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(2, lectureSynthetique(6)),
      fournisseur: espion,
    });

    expect(resultat.diagnostic.etat).toBe('instable');
    expect(resultat.diagnostic.cible).toBeNull();
    // Refus d'afficher un chiffre trompeur : ni cible, ni mesure, ni exercice.
    expect(resultat.diagnostic.mesure).toBeNull();
    expect(resultat.phrases).toHaveLength(0);
    expect(resultat.diagnostic.message).toMatch(/instable/i);
    expect(espion.appels).toBe(2);
  });

  it('§25-5 : un écart de 20 points exactement reste affichable (seuil non dépassé)', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(2, lectureSynthetique(6)),
      fournisseur: fournisseurEspion([
        [scoreDe('P01', 'think', 1, 40)],
        [scoreDe('P01', 'think', 1, 40 + ECART_MAX)],
      ]),
    });

    expect(resultat.diagnostic.etat).toBe('a_travailler');
    expect(resultat.diagnostic.cible?.code).toBe('P01');
    expect(resultat.diagnostic.mesure?.stable).toBe(true);
  });

  /**
   * BUG PRODUIT n°2 — src/engine/selectTarget.ts, `choisirCible()`.
   *
   * Le chemin « cible forcée » (RF-07, écran « réessayer ») renvoie la cible
   * AVANT le contrôle de stabilité : `if (opts.forcer) { ... return construire(force) }`.
   * Un écart > 20 points entre deux lectures y produit donc quand même un chiffre
   * (ici la médiane 53), ce qui contredit RNF-11 (« refus d'afficher un score
   * instable : obligatoire ») et le garde-fou d'honnêteté §18.4.
   *
   * Le mode « réessayer » suit désormais le réglage de lectures (3 par défaut),
   * donc l'écart est calculable et RNF-11 s'applique aussi sur ce chemin.
   *
   * Comportement ATTENDU : forcer la cible ne dispense pas du refus de score
   * instable. Corrigé par la branche `fix/rnf11-cible-forcee` (fusionnée ici) :
   * ce test devient un verrou de non-régression.
   */
  it('§25-5 / RNF-11 : une cible forcée instable n’affiche aucun chiffre', async () => {
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: lectures(2, lectureSynthetique(6)),
      fournisseur: fournisseurEspion([
        [scoreDe('P01', 'think', 1, 30)],
        [scoreDe('P01', 'think', 1, 75)],
      ]),
      forcerCible: 'P01',
    });

    expect(resultat.diagnostic.etat).toBe('instable');
    expect(resultat.diagnostic.cible).toBeNull();
    expect(resultat.diagnostic.mesure).toBeNull();
  });
});

describe('§18.4 — audio plus court que 1,5 s', () => {
  it('§18.4 : « trop_court », et le fournisseur n’est JAMAIS appelé', async () => {
    const espion = fournisseurEspion([[scoreDe('P01', 'think', 1, 30)]]);
    const etapes: string[] = [];
    const signal = lectureSynthetique(2); // ~ 880 ms, sous DUREE_MIN_MS
    const resultat = await executerPipeline({
      phrase: 'I think this.',
      langueCible: 'en',
      lectures: [{ audio: wavDe(signal), dureeMs: dureeMs(signal) }],
      fournisseur: espion,
      onProgress: (p) => dedoublonner(etapes, p),
    });

    expect(dureeMs(signal)).toBeLessThan(DUREE_MIN_MS);
    expect(resultat.diagnostic.etat).toBe('trop_court');
    expect(resultat.diagnostic.cible).toBeNull();
    expect(resultat.diagnostic.message).toMatch(/trop court/i);
    // Preuve demandée : l'objet espion n'a compté aucune analyse.
    expect(espion.appels).toBe(0);
    expect(etapes).toEqual(['ecoute']);
    expect(resultat.phrases).toHaveLength(0);
  });

  it('§18.4 : une seule lecture courte parmi trois suffit à refuser', async () => {
    const espion = fournisseurEspion([[scoreDe('P01', 'think', 1, 30)]]);
    const long = lectureSynthetique(8);
    const court = lectureSynthetique(1);
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: [
        { audio: wavDe(long), dureeMs: dureeMs(long) },
        { audio: wavDe(court), dureeMs: dureeMs(court) },
        { audio: wavDe(long), dureeMs: dureeMs(long) },
      ],
      fournisseur: espion,
    });

    expect(resultat.diagnostic.etat).toBe('trop_court');
    expect(espion.appels).toBe(0);
  });

  it('§18.4 : aucune lecture du tout → « erreur », pas de diagnostic inventé', async () => {
    const espion = fournisseurEspion([[scoreDe('P01', 'think', 1, 30)]]);
    const resultat = await executerPipeline({
      phrase: PHRASE,
      langueCible: 'en',
      lectures: [],
      fournisseur: espion,
    });

    expect(resultat.diagnostic.etat).toBe('erreur');
    expect(resultat.diagnostic.cible).toBeNull();
    expect(espion.appels).toBe(0);
  });
});
