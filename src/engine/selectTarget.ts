import type { CodePhoneme, Cible, EtatDiagnostic, Profil } from '../types';
import { ACQUIS_COOLDOWN_JOURS, SEUIL_ACQUIS } from '../constants';
import { PHONEMES } from '../data/phonemes';
import type { MesureCode } from './measure';

/**
 * Sélection du phonème cible unique — ACCENT.md §17 et RF-05.
 *
 * Une session = un seul phonème. Le candidat est celui de plus faible score,
 * pondéré par le nombre d'occurrences dans la phrase et par sa difficulté :
 * un son raté trois fois dans une phrase de dix mots passe avant un son exotique
 * apparu une seule fois.
 */

export interface ChoixCible {
  etat: EtatDiagnostic;
  cible: Cible | null;
  message: string;
}

export interface OptionsCible {
  /** Profil local : un phonème acquis reste hors ciblage pendant 7 jours. */
  profil?: Profil | null;
  maintenant?: Date;
  /** Forcer un code (écran « réessayer » : on reste sur le même son). */
  forcer?: CodePhoneme | null;
}

/** Poids = manque à l'acquisition × occurrences × facteur de difficulté. */
export function poids(mediane: number, occurrences: number, difficulte: number): number {
  const manque = Math.max(0, SEUIL_ACQUIS - mediane);
  return manque * Math.max(1, occurrences) * (1 + 0.25 * difficulte);
}

/** Un phonème franchit 80 → acquis, et exclu du profil pendant 7 jours. */
export function estAcquis(
  code: CodePhoneme,
  profil?: Profil | null,
  maintenant = new Date(),
): boolean {
  const p = profil?.parPhoneme?.[code];
  if (!p?.acquisLe) return false;
  const date = new Date(p.acquisLe).getTime();
  if (Number.isNaN(date)) return false;
  const jours = (maintenant.getTime() - date) / 86_400_000;
  return jours >= 0 && jours < ACQUIS_COOLDOWN_JOURS;
}

function messagePour(mediane: number, ipa: string, mot: string): string {
  if (mediane >= SEUIL_ACQUIS) {
    return `/${ipa}/ passe dans « ${mot} ». Rien à corriger ici.`;
  }
  return `/${ipa}/ dans « ${mot} » ne passe pas encore. Un seul mot à refaire.`;
}

function construire(m: MesureCode): ChoixCible {
  const entree = PHONEMES[m.code];
  const cible: Cible = {
    code: m.code,
    entree,
    score: Math.round(m.mesure.mediane),
    produitIpa: m.representant.produitIpa,
    mot: m.representant.mot,
    indexMot: m.representant.indexMot,
    poids: Math.round(poids(m.mesure.mediane, m.occurrences, entree.difficulte)),
    occurrences: m.occurrences,
  };
  return {
    etat: 'a_travailler',
    cible,
    message: messagePour(m.mesure.mediane, entree.ipa, cible.mot),
  };
}

export function choisirCible(mesures: MesureCode[], opts: OptionsCible = {}): ChoixCible {
  const maintenant = opts.maintenant ?? new Date();
  if (mesures.length === 0) {
    return { etat: 'erreur', cible: null, message: 'Aucun son mesuré sur cette phrase.' };
  }

  if (opts.forcer) {
    const force = mesures.find((m) => m.code === opts.forcer);
    if (force) return construire(force);
  }

  const candidats = mesures.filter(
    (m) => m.mesure.mediane < SEUIL_ACQUIS && !estAcquis(m.code, opts.profil, maintenant),
  );

  if (candidats.length === 0) {
    // Cas RNF-04 : phrase parfaitement prononcée → « rien à corriger », 0 faux positif.
    return {
      etat: 'rien_a_corriger',
      cible: null,
      message: 'Rien à corriger sur cette phrase. Essaie-en une plus difficile.',
    };
  }

  const tries = candidats.slice().sort((a, b) => {
    const ea = PHONEMES[a.code];
    const eb = PHONEMES[b.code];
    return (
      poids(b.mesure.mediane, b.occurrences, eb.difficulte) -
      poids(a.mesure.mediane, a.occurrences, ea.difficulte)
    );
  });

  const choisi = tries.find((m) => m.mesure.stable);
  if (!choisi) {
    // Refus d'afficher un chiffre incertain (RNF-11) plutôt qu'un diagnostic faux.
    return {
      etat: 'instable',
      cible: null,
      message: 'Mesure instable : l’écart entre tes lectures dépasse 20 points. Réessaie.',
    };
  }
  return construire(choisi);
}
