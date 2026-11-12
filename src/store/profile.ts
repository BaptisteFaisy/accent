import type { CodePhoneme, LangueCible, Profil, ProfilPhoneme, Session } from '../types';
import { SEUIL_ACQUIS } from '../constants';
import { PHONEMES, codesPourLangue } from '../data/phonemes';
import { chargerPreuves, preuvesEnMarkdown } from './preuves';

/**
 * Profil local (RF-09, écran 7). Aucune donnée biométrique, aucun audio :
 * uniquement des scores et des dates (RNF-P3). Exportable et supprimable en
 * un clic (RNF-P4). Aucun classement, aucune comparaison entre utilisateurs.
 */

const CLE_PROFIL = 'accent.profil.v1';
const CLE_SESSIONS = 'accent.sessions.v1';
const MAX_SESSIONS = 50;

export function profilVide(): Profil {
  return { parPhoneme: {}, sessions: 0, maj: new Date().toISOString() };
}

export function chargerProfil(): Profil {
  try {
    const brut = localStorage.getItem(CLE_PROFIL);
    if (!brut) return profilVide();
    const p = JSON.parse(brut) as Profil;
    return { parPhoneme: p.parPhoneme ?? {}, sessions: p.sessions ?? 0, maj: p.maj ?? '' };
  } catch {
    return profilVide();
  }
}

export function enregistrerProfil(p: Profil): void {
  localStorage.setItem(CLE_PROFIL, JSON.stringify(p));
}

/** Met à jour le profil après une mesure : meilleur, dernier, acquis. */
export function consignerScore(
  p: Profil,
  code: CodePhoneme,
  score: number,
  maintenant = new Date(),
): Profil {
  const avant: ProfilPhoneme = p.parPhoneme[code] ?? {
    meilleur: 0,
    dernier: 0,
    tentatives: 0,
    acquisLe: null,
  };
  const franchi = score >= SEUIL_ACQUIS;
  const apres: ProfilPhoneme = {
    meilleur: Math.max(avant.meilleur, score),
    dernier: score,
    tentatives: avant.tentatives + 1,
    acquisLe: franchi ? (avant.acquisLe ?? maintenant.toISOString()) : avant.acquisLe,
  };
  return {
    parPhoneme: { ...p.parPhoneme, [code]: apres },
    sessions: p.sessions + 1,
    maj: maintenant.toISOString(),
  };
}

export function chargerSessions(): Session[] {
  try {
    const brut = localStorage.getItem(CLE_SESSIONS);
    return brut ? (JSON.parse(brut) as Session[]) : [];
  } catch {
    return [];
  }
}

export function ajouterSession(s: Session): Session[] {
  const suivantes = [s, ...chargerSessions()].slice(0, MAX_SESSIONS);
  localStorage.setItem(CLE_SESSIONS, JSON.stringify(suivantes));
  return suivantes;
}

/** RNF-P4 : suppression totale, en un clic. */
export function toutEffacer(): void {
  localStorage.removeItem(CLE_PROFIL);
  localStorage.removeItem(CLE_SESSIONS);
}

/** RF-24 : export Markdown de la liste des sons à travailler. */
export function exporterMarkdown(
  p: Profil,
  langue: LangueCible = 'en',
  maintenant = new Date(),
): string {
  const lignes = [
    '# Accent — mes sons à travailler',
    '',
    `Export du ${maintenant.toLocaleDateString('fr-FR')} — aucun score global, un son à la fois.`,
    '',
    '| Code | Son | Meilleur | Dernier | Tentatives | Acquis le |',
    '|---|---|---|---|---|---|',
  ];
  for (const code of codesPourLangue(langue)) {
    const e = PHONEMES[code];
    const s = p.parPhoneme[code];
    lignes.push(
      `| ${code} | /${e.ipa}/ ${e.label} | ${s?.meilleur ?? '—'} | ${s?.dernier ?? '—'} | ${
        s?.tentatives ?? 0
      } | ${s?.acquisLe ? new Date(s.acquisLe).toLocaleDateString('fr-FR') : '—'} |`,
    );
  }
  // Le journal des preuves est joint : l'export dit aussi CE QUE L'APP A FAIT.
  return `${lignes.join('\n')}${preuvesEnMarkdown(chargerPreuves(), langue)}`;
}

/**
 * RF-22 — sons récurrents : un phonème qui ressort comme cible sur plusieurs
 * phrases différentes n'est pas un accident, c'est un profil. On ne l'affiche
 * qu'à partir de `seuil` sessions distinctes, pour ne pas inventer de tendance
 * sur deux essais (§10 : jamais de jugement hâtif).
 */
export function sonsRecurrents(sessions: Session[], seuil = 3): Array<{ code: CodePhoneme; fois: number }> {
  const compte = new Map<CodePhoneme, Set<string>>();
  for (const s of sessions) {
    if (!s.cible) continue;
    const phrases = compte.get(s.cible) ?? new Set<string>();
    phrases.add(s.phrase.trim().toLowerCase());
    compte.set(s.cible, phrases);
  }
  return [...compte.entries()]
    .map(([code, phrases]) => ({ code, fois: phrases.size }))
    .filter((x) => x.fois >= seuil)
    .sort((a, b) => b.fois - a.fois || a.code.localeCompare(b.code));
}

/** Sons travaillés (≥ 1 tentative) et sons restants, pour l'écran 7. */
export function repartition(
  p: Profil,
  langue: LangueCible = 'en',
): { travailles: CodePhoneme[]; restants: CodePhoneme[] } {
  const travailles: CodePhoneme[] = [];
  const restants: CodePhoneme[] = [];
  for (const code of codesPourLangue(langue)) {
    if ((p.parPhoneme[code]?.tentatives ?? 0) > 0) travailles.push(code);
    else restants.push(code);
  }
  return { travailles, restants };
}
