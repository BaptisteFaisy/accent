import { beforeEach, describe, expect, it } from 'vitest';
import {
  ajouterSession,
  chargerProfil,
  chargerSessions,
  consignerScore,
  enregistrerProfil,
  exporterMarkdown,
  profilVide,
  toutEffacer,
} from '../src/store/profile';
import { CODES_PHONEMES, PHONEMES, codesPourLangue } from '../src/data/phonemes';
import { base64De, lectureSynthetique, parcoursJson, scoreDe, sessionDe, wavDe } from './aides';

/**
 * §25-7 — « Aucun audio conservé après analyse (vérifiable dans l'onglet
 * Réseau + localStorage) », décliné en RNF-P1 (audio jamais persisté),
 * RNF-P3 (aucune donnée biométrique dérivée) et RNF-P4 (export + suppression
 * en un clic).
 */

const PHRASE = 'I think this is the right thing.';
const MOTS_PHRASE = PHRASE.toLowerCase().split(/\W+/).filter((m) => m.length > 0);
/** Symboles API autorisés : ceux de la taxonomie (cible ET substitutions typiques). */
const IPA = new Set(
  CODES_PHONEMES.flatMap((c) => [PHONEMES[c].ipa, ...PHONEMES[c].produitComme]),
);

/** Tout ce que le produit a le droit de stocker, d'après §19 et le critère §25-7. */
function categorie(s: string): string | null {
  if (/^P(0[1-9]|1[0-5])$/.test(s)) return 'code P01..P15';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s)) return 'date ISO';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'identifiant de session';
  if (/^(en|fr|es)$/.test(s)) return 'code langue';
  if (s === PHRASE) return 'phrase texte';
  if (IPA.has(s)) return 'symbole API de la taxonomie';
  if (MOTS_PHRASE.includes(s.toLowerCase())) return 'mot de la phrase';
  return null;
}

function contenuLocalStorage(): Array<{ cle: string; brut: string }> {
  const out: Array<{ cle: string; brut: string }> = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const cle = localStorage.key(i);
    if (cle === null) continue;
    out.push({ cle, brut: localStorage.getItem(cle) ?? '' });
  }
  return out;
}

beforeEach(() => {
  localStorage.clear();
});

describe('§25-7 / RNF-P1 + RNF-P3 — aucun audio persisté', () => {
  /** Le produit vient d'analyser cet audio : il ne doit rien en rester. */
  const audio = wavDe(lectureSynthetique(6));
  const base64Audio = base64De(audio);

  function ecrireCommeLeProduit(): void {
    const profil = consignerScore(profilVide(), 'P01', 42);
    enregistrerProfil(profil);
    ajouterSession(sessionDe(PHRASE, 'P01', [scoreDe('P01', 'think', 1, 42, 's')]));
  }

  it('§25-7 : après consignerScore + ajouterSession, localStorage ne contient ni base64 audio ni blob', () => {
    ecrireCommeLeProduit();
    const stocke = contenuLocalStorage();
    expect(stocke.length).toBeGreaterThan(0);

    for (const { cle, brut } of stocke) {
      expect(brut, `${cle} : audio encodé en base64`).not.toContain(base64Audio);
      expect(brut, `${cle} : début d'un payload base64`).not.toContain(base64Audio.slice(0, 64));
      expect(brut, `${cle} : data-URL audio`).not.toMatch(/data:audio/i);
      expect(brut, `${cle} : URL de blob`).not.toMatch(/blob:/i);
      expect(brut, `${cle} : en-tête WAV`).not.toMatch(/RIFF|WAVE/);
      expect(brut, `${cle} : champ audio`).not.toMatch(/audioBase64|audio|pcm|echantillon/i);
      // Une piste audio pèse des dizaines de Ko : rien ici ne peut en cacher une.
      expect(brut.length, `${cle} : taille suspecte (${brut.length} octets)`).toBeLessThan(4000);
    }
  });

  it('§25-7 / RNF-P3 : aucune empreinte vocale ni donnée biométrique stockée', () => {
    ecrireCommeLeProduit();
    const { cles, chaines } = parcoursJson(contenuLocalStorage().map((s) => JSON.parse(s.brut)));

    for (const cle of cles) {
      expect(cle, `clé suspecte : ${cle}`).not.toMatch(/audio|voix|voice|empreinte|blob|spectro|biometr|vecteur|embedding/i);
    }
    for (const s of chaines) {
      expect(s, `chaîne suspecte : ${s.slice(0, 40)}`).not.toMatch(/empreinte|voiceprint|voice_print|speaker|locuteur|biometr/i);
      // Aucun payload base64 (l'audio encodé est long : 40+ caractères d'alphabet base64).
      expect(/^[A-Za-z0-9+/]{40,}={0,2}$/.test(s), `payload base64 : ${s.slice(0, 40)}`).toBe(false);
    }
  });

  it('§25-7 : les valeurs stockées se limitent à codes P01..P15, nombres, dates et phrase texte', () => {
    ecrireCommeLeProduit();
    const brut = contenuLocalStorage().map((s) => s.brut).join('\n');
    const { chaines } = parcoursJson(contenuLocalStorage().map((s) => JSON.parse(s.brut)));

    const inconnues = chaines.filter((s) => categorie(s) === null);
    expect(inconnues, `chaînes hors périmètre : ${JSON.stringify(inconnues)}`).toEqual([]);

    // Les codes de phonème stockés appartiennent tous à la taxonomie fermée.
    const codes = chaines.filter((s) => /^P\d\d$/.test(s));
    expect(codes.length).toBeGreaterThan(0);
    for (const c of codes) expect(CODES_PHONEMES).toContain(c);

    // Aucun tableau d'échantillons : l'audio ne peut pas se cacher dans une liste de nombres.
    expect(brut).not.toMatch(/\[\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*,/);
  });

  it('§25-7 : la phrase et le score par phonème survivent, l’audio non', () => {
    ecrireCommeLeProduit();
    const sessions = chargerSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].phrase).toBe(PHRASE);
    expect(sessions[0].cible).toBe('P01');
    expect(sessions[0].scores[0].score).toBe(42);
    expect(Object.keys(sessions[0]).sort()).toEqual(
      ['cible', 'createdAt', 'id', 'langueCible', 'phrase', 'scores'].sort(),
    );
  });
});

describe('§25-7 / RNF-P4 — export et suppression en un clic', () => {
  it('§25-7 : exporterMarkdown renvoie un en-tête et les codes de la langue', () => {
    const md = exporterMarkdown(consignerScore(profilVide(), 'P01', 42));
    expect(md.split('\n')[0]).toMatch(/^#\s+Accent/);
    expect(md).toContain('|');
    // L'export est borné à la paire de langues choisie (RF-20) : il ne mélange
    // pas les taxonomies.
    const codesEn = codesPourLangue('en');
    for (const code of codesEn) {
      expect(md, `${code} absent de l'export`).toContain(code);
    }
    expect(md).not.toContain('E01');
    // Une ligne par phonème, et aucune ligne d'agrégat : l'export reste par son.
    const lignesCodes = md.split('\n').filter((l) => /^\|\s*P\d\d\s*\|/.test(l));
    expect(lignesCodes).toHaveLength(codesEn.length);
    expect(md).not.toMatch(/moyenne/i);
    expect(md).not.toMatch(/total/i);
    expect(md).not.toMatch(/pourcentage/i);
  });

  it('§25-7 : toutEffacer vide le profil ET les sessions', () => {
    enregistrerProfil(consignerScore(profilVide(), 'P01', 42));
    ajouterSession(sessionDe(PHRASE, 'P01', [scoreDe('P01', 'think', 1, 42)]));
    expect(chargerProfil().parPhoneme.P01).toBeDefined();
    expect(chargerSessions()).toHaveLength(1);

    toutEffacer();

    expect(localStorage.getItem('accent.profil.v1')).toBeNull();
    expect(localStorage.getItem('accent.sessions.v1')).toBeNull();
    const profil = chargerProfil();
    expect(profil.parPhoneme).toEqual({});
    expect(profil.sessions).toBe(0);
    expect(chargerSessions()).toEqual([]);
  });
});
