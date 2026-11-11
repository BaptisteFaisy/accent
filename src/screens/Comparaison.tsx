import type { Diagnostic } from '../types';
import Entete from '../components/Entete';

/**
 * Écran 5 — Comparaison : avant / après côte à côte, le compteur glisse.
 * C'est l'écran de la vidéo (ACCENT.md §6, 1:30–1:55) : le before/after est la
 * preuve que le produit sert à quelque chose.
 */

export interface Props {
  avant: Diagnostic;
  apres: Diagnostic;
  onEntrainement: () => void;
  onAccueil: () => void;
}

function delta(avant: number, apres: number): string {
  const d = apres - avant;
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return '±0';
}

export default function Comparaison({ avant, apres, onEntrainement, onAccueil }: Props) {
  const a = avant.cible;
  const b = apres.cible;
  const progres = a && b && a.code === b.code ? b.score - a.score : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onAccueil} />
      <div className="carte flex flex-col items-center gap-4 text-center">
        <p className="text-sm uppercase tracking-wide text-neutre">Le même son, deux lectures</p>
        {a && b ? (
          <>
            <p className="phoneme-heros">/{a.entree.ipa}/</p>
            <div className="flex items-end justify-center gap-6 text-5xl font-semibold tabular-nums">
              <span className="text-neutre" aria-label="score avant">{a.score}</span>
              <span className="text-neutre" aria-hidden="true">→</span>
              <span className={progres !== null && progres >= 0 ? 'text-acquis' : 'text-aTravailler'}
                aria-label="score après">
                {b.score}
              </span>
            </div>
            <p className="text-lg" aria-live="polite">
              {progres === null
                ? 'Deux sons différents mesurés.'
                : progres > 0
                  ? `Ça bouge : ${delta(a.score, b.score)} points.`
                  : progres === 0
                    ? 'Identique. Réessaie en suivant la consigne.'
                    : `Revenu en arrière (${delta(a.score, b.score)}) : reprends la consigne.`}
            </p>
            <p className="text-neutre">{b.entree.conseil}</p>
          </>
        ) : (
          <p className="text-neutre">{apres.message}</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="bouton-primaire" onClick={onEntrainement}>
            Travailler ce son
          </button>
          <button type="button" className="bouton-secondaire" onClick={onAccueil}>
            Autre phrase
          </button>
        </div>
      </div>
      <p className="text-center text-sm text-neutre">
        La progression ne se mesure que contre toi. Aucun classement.
      </p>
    </div>
  );
}
