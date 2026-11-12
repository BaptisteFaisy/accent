import type { Diagnostic } from '../types';
import Entete from '../components/Entete';
import CompteurAnime from '../components/CompteurAnime';
import Preuve from '../components/Preuve';

/**
 * Écran 5 — Comparaison : LE before/after de la vidéo (ACCENT.md §6, 1:30-1:55).
 * « Tu réessaies. Ça bouge. » Deux chiffres, une flèche, le compteur qui glisse.
 * Toujours le même phonème : la progression ne se mesure que contre soi.
 */

export interface Props {
  avant: Diagnostic;
  apres: Diagnostic;
  onEntrainement: () => void;
  onAccueil: () => void;
}

function verdict(delta: number): { texte: string; ton: string } {
  if (delta > 0) return { texte: `Ça bouge : +${delta} points sur ce son.`, ton: 'text-acquis' };
  if (delta === 0) return { texte: 'Identique. Reprends la consigne, puis réessaie.', ton: 'text-aTravailler' };
  return { texte: `Revenu en arrière (${delta}). La consigne est juste en dessous.`, ton: 'text-aTravailler' };
}

export default function Comparaison({ avant, apres, onEntrainement, onAccueil }: Props) {
  const a = avant.cible;
  const b = apres.cible;
  const memeSon = Boolean(a && b && a.code === b.code);
  const delta = a && b ? b.score - a.score : 0;
  const v = verdict(delta);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onAccueil} />

      <div className="carte flex flex-col items-center gap-6 text-center">
        <p className="etiquette">Le même son, deux lectures</p>

        {a && b && memeSon ? (
          <>
            <p className="phoneme-heros" aria-label={`phonème ${a.entree.ipa}`}>
              /{a.entree.ipa}/
            </p>

            <div className="flex items-end justify-center gap-5 sm:gap-8">
              <figure className="flex flex-col items-center gap-1">
                <figcaption className="text-xs uppercase tracking-wide text-neutre">avant</figcaption>
                <span className="text-5xl font-semibold text-neutre tabular-nums" aria-label={`avant : ${a.score}`}>
                  {a.score}
                </span>
              </figure>
              <span className="pb-2 text-3xl text-neutre" aria-hidden="true">→</span>
              <figure className="flex flex-col items-center gap-1">
                <figcaption className="text-xs uppercase tracking-wide text-neutre">après</figcaption>
                <span className={`text-6xl font-semibold ${delta >= 0 ? 'text-acquis' : 'text-aTravailler'}`}>
                  <CompteurAnime valeur={b.score} depuis={a.score} dureeMs={1100}
                    label={`après : ${b.score} sur 100`} />
                </span>
              </figure>
            </div>

            <p className={`text-xl font-medium ${v.ton}`} role="status">{v.texte}</p>
            <p className="max-w-prose text-base text-neutre">{b.entree.conseil}</p>
          </>
        ) : (
          <>
            <p className="text-xl text-neutre">{apres.message}</p>
            <p className="text-sm text-neutre">
              Les deux lectures n’ont pas porté sur le même son : la comparaison n’a pas de sens,
              et on ne l’invente pas.
            </p>
          </>
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

      <Preuve etape="comparaison" />

      <p className="text-center text-sm text-neutre">
        La progression ne se mesure que contre toi. Aucun classement, aucune moyenne.
      </p>
    </div>
  );
}
