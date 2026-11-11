// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  anonymiserIp,
  cleCache,
  creerQuota,
  encoderConfigAssessment,
  entetesCors,
  erreurJson,
  extrairePhonemes,
  ligneJournal,
  reponseSansProvider,
  urlAzure,
} from '../server/lib.mjs';

/**
 * Le proxy est le seul endroit où vit la clé d'évaluation. Ses règles sont donc
 * testées comme du code produit : quota, cache, journal sans donnée élève
 * (RNF-P2), traduction de la réponse Azure SANS score global (§10).
 */

const REPONSE_AZURE = {
  NBest: [
    {
      PronunciationAssessment: { AccuracyScore: 78.4, FluencyScore: 91.2, CompletenessScore: 100 },
      Words: [
        {
          Word: 'think',
          Phonemes: [
            { Phoneme: 'θ', AccuracyScore: 34, ErrorType: 'Mispronunciation' },
            { Phoneme: 'ɪ', AccuracyScore: 88, ErrorType: 'None' },
          ],
        },
        { Word: 'this', Phonemes: [{ Phoneme: 'ð', AccuracyScore: 41, ErrorType: 'None' }] },
      ],
    },
  ],
};

describe('en-tête Pronunciation-Assessment', () => {
  const brut = atob(encoderConfigAssessment('I think this'));
  const cfg = JSON.parse(brut) as Record<string, unknown>;

  it('demande le détail par phonème, sur 100 points', () => {
    expect(cfg.Granularity).toBe('Phoneme');
    expect(cfg.GradingSystem).toBe('HundredMark');
  });

  it('embarque le texte de référence', () => {
    expect(cfg.ReferenceText).toBe('I think this');
  });

  it('n’évalue ni l’intonation ni l’écoulement (hors périmètre §15.3)', () => {
    expect(cfg.EnableProsodyAssessment).toBe(false);
    expect(cfg.FluencyScore).toBeUndefined();
  });
});

describe('urlAzure', () => {
  it('cible l’API REST short audio avec la langue', () => {
    expect(urlAzure('westeurope', 'en-US')).toBe(
      'https://westeurope.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US',
    );
  });
});

describe('extrairePhonemes — traduction de la réponse Azure', () => {
  const scores = extrairePhonemes(REPONSE_AZURE, ['think', 'this']);

  it('un score par phonème, avec le mot et son index', () => {
    expect(scores).toHaveLength(3);
    expect(scores[0]).toMatchObject({ ipa: 'θ', mot: 'think', indexMot: 0, score: 34 });
    expect(scores[2]).toMatchObject({ ipa: 'ð', mot: 'this', indexMot: 1, score: 41 });
  });

  it('arrondit les scores Azure', () => {
    expect(
      extrairePhonemes({ NBest: [{ Words: [{ Word: 'a', Phonemes: [{ Phoneme: 'x', AccuracyScore: 66.6 }] }] }] }, ['a'])[0]
        .score,
    ).toBe(67);
  });

  it('GARDE-FEU §10 : aucun score global ne traverse le proxy', () => {
    for (const s of scores) {
      expect(JSON.stringify(s)).not.toContain('AccuracyScore');
      expect(JSON.stringify(s)).not.toContain('FluencyScore');
      expect(JSON.stringify(s)).not.toContain('78.4');
    }
  });

  it('laisse le rattachement à la taxonomie au client (code null)', () => {
    expect(scores.every((s) => s.code === null)).toBe(true);
  });

  it('réponse vide ou malformée → aucun score, aucune exception', () => {
    expect(extrairePhonemes({}, ['a'])).toEqual([]);
    expect(extrairePhonemes(undefined, undefined)).toEqual([]);
  });

  it('signale la nature du raté sans renvoyer le texte de l’élève', () => {
    expect(scores[0].erreur).toBe('Mispronunciation');
    expect(scores[1].erreur).toBeUndefined();
  });
});

describe('clé de cache', () => {
  it('déterministe pour un même couple texte/audio', async () => {
    expect(await cleCache('think', 'AAA')).toBe(await cleCache('think', 'AAA'));
  });

  it('différente si l’audio change, même texte', async () => {
    expect(await cleCache('think', 'AAA')).not.toBe(await cleCache('think', 'AAB'));
  });

  it('différente si le texte change, même audio', async () => {
    expect(await cleCache('think', 'AAA')).not.toBe(await cleCache('three', 'AAA'));
  });
});

describe('quota par IP et par jour', () => {
  it('autorise jusqu’à la limite puis refuse', () => {
    const q = creerQuota(3);
    expect(q.consommer('1.2.3.4').ok).toBe(true);
    expect(q.consommer('1.2.3.4').ok).toBe(true);
    expect(q.consommer('1.2.3.4').reste).toBe(0);
    expect(q.consommer('1.2.3.4').ok).toBe(false);
  });

  it('compte séparément chaque IP', () => {
    const q = creerQuota(1);
    expect(q.consommer('a').ok).toBe(true);
    expect(q.consommer('b').ok).toBe(true);
    expect(q.consommer('a').ok).toBe(false);
  });

  it('se remet à zéro le jour suivant', () => {
    const q = creerQuota(1);
    expect(q.consommer('a', new Date('2026-11-11T10:00:00Z')).ok).toBe(true);
    expect(q.consommer('a', new Date('2026-11-11T11:00:00Z')).ok).toBe(false);
    expect(q.consommer('a', new Date('2026-11-12T00:00:01Z')).ok).toBe(true);
  });
});

describe('journal — RNF-P2, aucune donnée élève', () => {
  const ligne = ligneJournal({
    methode: 'POST',
    chemin: '/api/analyse',
    statut: 200,
    ms: 812.4,
    ip: '82.64.12.9',
  });
  const objet = JSON.parse(ligne) as Record<string, unknown>;

  it('ne contient que horodatage, méthode, chemin, statut, durée, IP', () => {
    expect(Object.keys(objet).sort()).toEqual(['ip', 'm', 'ms', 'p', 's', 't']);
  });

  it('n’écrit ni texte ni audio : le chemin est seul, sans query string', () => {
    expect(ligne).not.toContain('think');
    expect(ligne).not.toContain('audioBase64');
    expect(objet.p).toBe('/api/analyse');
  });

  it('arrondit la durée', () => {
    expect(objet.ms).toBe(812);
  });
});

describe('anonymisation de l’IP', () => {
  it('IPv4 : dernier groupe à zéro', () => {
    expect(anonymiserIp('82.64.12.9')).toBe('82.64.12.0');
  });

  it('IPv6 : préfixe /48 seulement', () => {
    expect(anonymiserIp('2001:db8:1234:5678::1')).toBe('2001:db8:1234::');
  });

  it('IP absente ou invalide : tiret', () => {
    expect(anonymiserIp('')).toBe('-');
    expect(anonymiserIp('pas-une-ip')).toBe('-');
  });
});

describe('CORS et erreurs', () => {
  it('renvoie l’origine autorisée, et rien sinon', () => {
    expect(entetesCors('https://accent.example', ['https://accent.example'])['access-control-allow-origin']).toBe(
      'https://accent.example',
    );
    expect(entetesCors('https://pirate.example', ['https://accent.example'])['access-control-allow-origin']).toBe('');
  });

  it("'*' autorise toute origine (mode démo)", () => {
    expect(entetesCors('https://x.example', ['*'])['access-control-allow-origin']).toBe('https://x.example');
  });

  it('les corps d’erreur sont stables et lisibles par l’UI', () => {
    const e = JSON.parse(erreurJson('quota', 'Quota atteint.', { byok: true })) as Record<string, unknown>;
    expect(e).toMatchObject({ erreur: 'quota', message: 'Quota atteint.', byok: true });
  });

  it('sans clé, le proxy annonce un mode simulé et zéro score', () => {
    const r = reponseSansProvider();
    expect(r.scores).toEqual([]);
    expect(r.simule).toBe(true);
    expect(r.provider).toBe('proxy-sans-cle');
  });
});
