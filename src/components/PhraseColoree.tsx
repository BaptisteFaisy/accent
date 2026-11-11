import type { ScorePhoneme } from '../types';
import { SEUIL_A_TRAVAILLER, SEUIL_ACQUIS } from '../constants';

/**
 * Écran 4 : la phrase avec les mots colorés. Vert = acquis, orange = à
 * travailler. Jamais de rouge pour un son (ACCENT.md §21) : le rouge est
 * réservé aux erreurs système.
 */

export interface Props {
  phrase: string;
  scores: ScorePhoneme[];
  motCible?: string | null;
}

function pireParMot(scores: ScorePhoneme[]): Map<number, number> {
  const parMot = new Map<number, number>();
  for (const s of scores) {
    const avant = parMot.get(s.indexMot);
    if (avant === undefined || s.score < avant) parMot.set(s.indexMot, s.score);
  }
  return parMot;
}

function classe(score: number | undefined, estCible: boolean): string {
  if (score === undefined) return 'text-neutre';
  if (score >= SEUIL_ACQUIS) return 'mot-ok';
  if (score < SEUIL_A_TRAVAILLER || estCible) return 'mot-a-travailler font-semibold';
  return 'text-aTravailler/80';
}

export default function PhraseColoree({ phrase, scores, motCible }: Props) {
  const parMot = pireParMot(scores);
  const mots = phrase.split(/\s+/);
  return (
    <p className="text-xl leading-relaxed sm:text-2xl" lang="en">
      {mots.map((mot, i) => {
        const nu = mot.toLowerCase().replace(/[^a-z']/g, '');
        const estCible = Boolean(motCible) && nu === motCible!.toLowerCase();
        return (
          <span key={`${mot}-${i}`} className={classe(parMot.get(i), estCible)}>
            {mot}
            {i < mots.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}
