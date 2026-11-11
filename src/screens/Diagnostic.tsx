import type { ResultatPipeline } from '../engine/pipeline';
import { expliquer, pairePour } from '../engine/explain';
import Entete from '../components/Entete';
import PhraseColoree from '../components/PhraseColoree';

/**
 * Écran 4 — Diagnostic : la phrase colorée, puis UN phonème en très grand,
 * avec le son réellement produit, la paire minimale et le mot concerné.
 * Un seul chiffre à l'écran (ACCENT.md §21).
 */

export interface Props {
  phrase: string;
  resultat: ResultatPipeline | null;
  erreur: string | null;
  onReessayer: () => void;
  onEntrainement: () => void;
  onAccueil: () => void;
}

export default function DiagnosticVue({ phrase, resultat, erreur, onReessayer, onEntrainement, onAccueil }: Props) {
  if (erreur) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-4 px-4 py-8">
        <Entete onAccueil={onAccueil} />
        <div className="carte border-erreur/40">
          <h1 className="text-xl font-semibold text-erreur">Je n’ai pas pu mesurer cette lecture</h1>
          <p className="mt-2 text-neutre">{erreur}</p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="bouton-secondaire" onClick={onReessayer}>Réessayer</button>
            <button type="button" className="bouton-fantome" onClick={onAccueil}>Changer de phrase</button>
          </div>
        </div>
      </div>
    );
  }

  if (!resultat) return null;
  const d = resultat.diagnostic;
  const cible = d.cible;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onAccueil} />

      <div className="carte">
        <PhraseColoree phrase={phrase} scores={d.scores} motCible={cible?.mot} />
        {resultat.simule && (
          <p className="mt-3 etiquette border-aTravailler/50 text-aTravailler">
            Mode démonstration : mesure simulée localement, pas une évaluation réelle
          </p>
        )}
      </div>

      {d.etat === 'rien_a_corriger' && (
        <div className="carte text-center">
          <h1 className="text-2xl font-semibold text-acquis">Rien à corriger sur cette phrase</h1>
          <p className="mt-2 text-neutre">{d.message}</p>
          <button type="button" className="bouton-primaire mt-4" onClick={onAccueil}>
            Prendre une phrase plus difficile
          </button>
        </div>
      )}

      {d.etat === 'instable' && (
        <div className="carte text-center">
          <h1 className="text-2xl font-semibold text-aTravailler">Mesure instable</h1>
          <p className="mt-2 text-neutre">{d.message}</p>
          <button type="button" className="bouton-primaire mt-4" onClick={onReessayer}>Réessayer</button>
        </div>
      )}

      {cible && (
        <div className="carte flex flex-col items-center gap-4 text-center">
          <p className="text-sm uppercase tracking-wide text-neutre">Le son à travailler</p>
          <p className="phoneme-heros" aria-label={`phonème ${cible.entree.ipa}`}>
            /{cible.entree.ipa}/
          </p>
          <p className="text-lg">
            dans <strong lang="en">{cible.mot}</strong>
            {cible.produitIpa ? (
              <> → sorti comme <strong>/{cible.produitIpa}/</strong></>
            ) : (
              <> → {cible.entree.signature}</>
            )}
          </p>
          <p className="text-4xl font-semibold tabular-nums" aria-label="score du phonème">
            {cible.score}
            <span className="text-base text-neutre"> /100</span>
          </p>
          {d.mesure && (
            <p className="text-sm text-neutre">
              médiane de {d.mesure.lectures} lecture{d.mesure.lectures > 1 ? 's' : ''} · écart {d.mesure.ecart}
            </p>
          )}
          <PaireMinimale cible={cible} />
          <p className="text-neutre">{cible.entree.conseil}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bouton-primaire" onClick={onReessayer}>
              Réessayer ce mot
            </button>
            <button type="button" className="bouton-secondaire" onClick={onEntrainement}>
              Travailler ce son
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-neutre">
        Pas de note globale, pas de classement : un son, à un instant donné.
      </p>
    </div>
  );
}

function PaireMinimale({ cible }: { cible: NonNullable<ResultatPipeline['diagnostic']['cible']> }) {
  const paire = pairePour(cible);
  const exp = expliquer(cible);
  if (exp.positionnel) {
    return (
      <p className="text-lg text-aTravailler">
        Ce n’est pas un son mais une place : accentue la bonne syllabe.
      </p>
    );
  }
  if (!paire) return null;
  return (
    <p className="text-lg">
      Paire minimale : <strong lang="en">{paire[0]}</strong>
      <span className="text-neutre"> ne doit pas devenir </span>
      <strong lang="en">{paire[1]}</strong>
    </p>
  );
}
