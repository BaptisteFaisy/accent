import type {
  AnalyseEntree,
  AnalyseSortie,
  CodePhoneme,
  FournisseurPrononciation,
  PhraseEntrainement,
  ScorePhoneme,
} from '../types';
import { TAUX_ECHANTILLONNAGE } from '../constants';
import { PHONEMES, CODES_PHONEMES } from '../data/phonemes';
import { phrasesPour } from '../data/training';
import { motsDe, segmentsVoix } from '../audio/quality';
import { decoderWav16 } from '../audio/wav';

/**
 * Moteur de démonstration local — HONNÊTE : il est signalé « simulation » à
 * l'écran et dans `AnalyseSortie.simule` (ACCENT.md §6 : « si une étape est
 * simulée, l'écrire à l'écran »).
 *
 * À quoi il sert :
 *  1. rendre le produit démontrable sans clé API ni réseau (quota, jugement) ;
 *  2. servir de repli explicite quand le proxy est épuisé (RNF-09) ;
 *  3. tester le pipeline de bout en bout en CI, sans dépendance externe.
 *
 * Ce qu'il fait vraiment : il segmente l'audio en zones sonores, mesure trois
 * descripteurs par zone (durée, énergie, taux de passage par zéro) et les
 * projette sur les phonèmes attendus des mots de la phrase via une table de
 * correspondance. Le score bouge donc quand l'audio bouge — mais ce n'est PAS
 * une mesure phonétique réelle. La vraie mesure passe par `azure.ts`.
 */

/** Descripteurs acoustiques d'une zone sonore, bornés et comparables. */
interface Traits {
  dureeMs: number;
  energie: number;
  zcr: number;
}

function traits(pcm: Float32Array, debut: number, fin: number, taux: number): Traits {
  let somme = 0;
  let passages = 0;
  const n = Math.max(1, fin - debut);
  for (let i = debut; i < fin; i += 1) {
    somme += pcm[i] * pcm[i];
    if (i > debut && pcm[i] * pcm[i - 1] < 0) passages += 1;
  }
  return {
    dureeMs: Math.round((n / taux) * 1000),
    energie: Math.sqrt(somme / n),
    zcr: (passages / n) * taux,
  };
}

/** Mots de la phrase porteurs d'un phonème de la taxonomie (lexique local). */
export function phonemesAttendus(phrase: string): Array<{ mot: string; index: number; code: CodePhoneme }> {
  const mots = motsDe(phrase);
  const out: Array<{ mot: string; index: number; code: CodePhoneme }> = [];
  mots.forEach((mot, index) => {
    for (const code of CODES_PHONEMES) {
      const e = PHONEMES[code];
      // Égalité d'abord ; le sous-chaîne n'est admis que sur des mots assez
      // longs : sinon « i » ou « the » s'accrochent à « think » et le moteur
      // cible un mot d'une lettre (bug vu en démo navigateur, 11/11).
      const porte =
        e.motsExemples.some((m) => mot === m || (mot.length >= 4 && mot.includes(m))) ||
        e.pairesMinimales.some(
          ([a, b]) => mot === a.toLowerCase() || mot === b.toLowerCase(),
        );
      if (porte) {
        out.push({ mot, index, code });
        return;
      }
    }
  });
  return out;
}

/** Projection déterministe traits → score 0-100, par famille de phonème. */
function projeter(code: CodePhoneme, t: Traits): number {
  const e = PHONEMES[code];
  // Cibles empiriques : un /s/ est très lumineux (zcr élevé), une voyelle l'est
  // peu ; une consonne finale sonore est brève ; un schwa est court et faible.
  const zcrAttendu = code === 'P01' || code === 'P02' ? 5200 : code === 'P11' ? 2600 : 3400;
  const dureeAttendue = e.nature === 'positionnel' ? 320 : code === 'P12' || code === 'P11' ? 90 : 180;
  const ecartZcr = Math.abs(t.zcr - zcrAttendu) / zcrAttendu;
  const ecartDuree = Math.abs(t.dureeMs - dureeAttendue) / dureeAttendue;
  const penalite = 0.6 * Math.min(1.5, ecartZcr) + 0.4 * Math.min(1.5, ecartDuree);
  const bonusEnergie = t.energie < 0.01 ? 25 : 0;
  return Math.round(Math.max(4, Math.min(99, 96 - penalite * 70 - bonusEnergie)));
}

function pcmDepuis(entree: AnalyseEntree): Promise<Float32Array> {
  const { audio } = entree;
  if (audio instanceof ArrayBuffer) return Promise.resolve(decoderWav16(audio));
  return audio.arrayBuffer().then((b) => decoderWav16(b));
}

export const fournisseurDemo: FournisseurPrononciation = {
  id: 'demo-local',
  label: 'Moteur de démonstration (local, simulé)',

  async analyse(entree: AnalyseEntree): Promise<AnalyseSortie> {
    const pcm = await pcmDepuis(entree);
    // Rien de dit, rien de mesuré : pas de score (le pipeline refusera aussi
    // l'audio trop court avant d'arriver ici).
    if (pcm.length < Math.round(TAUX_ECHANTILLONNAGE * 0.3)) {
      return {
        scores: [],
        dureeMs: Math.round((pcm.length / TAUX_ECHANTILLONNAGE) * 1000),
        provider: 'demo-local',
        simule: true,
      };
    }
    const attendu = phonemesAttendus(entree.texte);
    const zones = segmentsVoix(pcm, TAUX_ECHANTILLONNAGE, 90);
    const scores: ScorePhoneme[] = attendu.map((a, i) => {
      const zone = zones[i] ?? zones[zones.length - 1] ?? [0, pcm.length];
      const t = traits(pcm, zone[0] as number, zone[1] as number, TAUX_ECHANTILLONNAGE);
      return {
        code: a.code,
        ipa: PHONEMES[a.code].ipa,
        mot: a.mot,
        indexMot: a.index,
        score: projeter(a.code, t),
      };
    });
    return {
      scores,
      dureeMs: Math.round((pcm.length / TAUX_ECHANTILLONNAGE) * 1000),
      provider: 'demo-local',
      simule: true,
    };
  },

  async phrases(code: CodePhoneme, langueCible): Promise<PhraseEntrainement[]> {
    return phrasesPour(code, langueCible);
  },
};
