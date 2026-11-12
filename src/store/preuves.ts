import type { LangueCible } from '../types';

/**
 * Journal de preuves — chaque étape du parcours **prouve** qu'elle a fonctionné.
 *
 * Le principe du projet est déjà « aucune promesse non vérifiable » (RNF-P1..
 * P5, garde-fous §10). On l'applique à l'UX : après chaque action, l'app
 * affiche ce qui a été fait, avec les données qui le prouvent et le fichier du
 * code où on peut le vérifier.
 *
 * Le journal est local (comme le profil), exportable en Markdown avec le profil,
 * et effaçable d'un clic — donc il ne devient ni une trace cachée, ni une
 * donnée biométrique : uniquement des nombres, des dates et du texte.
 */

export interface Preuve {
  id: string;
  at: string;
  /** Étape du parcours : « enregistrement », « analyse », « comparaison »… */
  etape: string;
  /** L'affirmation établie. */
  titre: string;
  /** Les données qui la prouvent. */
  details: string[];
  /** Où vérifier dans le dépôt public. */
  source?: string;
}

const CLE = 'accent.preuves.v1';
const MAX = 60;

type Abonne = () => void;
const abonnes = new Set<Abonne>();
let cache: Preuve[] | null = null;

function lire(): Preuve[] {
  if (cache) return cache;
  try {
    const brut = localStorage.getItem(CLE);
    cache = brut ? (JSON.parse(brut) as Preuve[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function ecrire(preuves: Preuve[]): void {
  cache = preuves;
  try {
    localStorage.setItem(CLE, JSON.stringify(preuves.slice(0, MAX)));
  } catch {
    /* stockage indisponible : le journal reste en mémoire */
  }
  abonnes.forEach((fn) => fn());
}

export function abonnerPreuves(fn: Abonne): () => void {
  abonnes.add(fn);
  return () => {
    abonnes.delete(fn);
  };
}

export function chargerPreuves(): Preuve[] {
  return lire();
}

/** Enregistre une preuve et la renvoie (l'appelant l'affiche). */
export function ajouterPreuve(
  etape: string,
  titre: string,
  details: string[] = [],
  source?: string,
): Preuve {
  const preuve: Preuve = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    etape,
    titre,
    details: details.filter(Boolean),
    source,
  };
  ecrire([preuve, ...lire()]);
  return preuve;
}

/** Preuve la plus récente d'une étape (null si l'étape n'a rien produit). */
export function dernierePreuve(etape: string): Preuve | null {
  return lire().find((p) => p.etape === etape) ?? null;
}

export function effacerPreuves(): void {
  ecrire([]);
}

/** Le journal fait partie des données locales : « tout supprimer » l'efface. */
export function toutSupprimerDonneesLocales(): void {
  effacerPreuves();
}

/** Le journal des preuves, en Markdown (exporté avec le profil). */
export function preuvesEnMarkdown(preuves: Preuve[], langue: LangueCible = 'en'): string {
  const titres: Record<string, string> = {
    enregistrement: 'Enregistrement',
    analyse: 'Diagnostic',
    comparaison: 'Comparaison',
    entrainement: 'Entraînement',
    perception: 'Écoute',
    oral: 'Oral long',
    profil: 'Profil',
    donnees: 'Données',
    reglages: 'Réglages',
    export: 'Export',
  };
  const lignes = [
    '',
    '## Journal des preuves',
    '',
    `Ce que l'application a fait, et comment le vérifier. ${preuves.length} étape(s).`,
    '',
  ];
  for (const p of preuves) {
    lignes.push(`### ${titres[p.etape] ?? p.etape} — ${p.titre}`);
    lignes.push(`- quand : ${new Date(p.at).toLocaleString('fr-FR')}`);
    for (const d of p.details) lignes.push(`- ${d}`);
    if (p.source) lignes.push(`- où vérifier : \`${p.source}\``);
    lignes.push('');
  }
  void langue;
  return lignes.join('\n');
}
