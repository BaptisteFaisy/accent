import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CodePhoneme, LangueCible } from '../types';
import { PHONEMES } from '../data/phonemes';
import {
  corriger,
  creerExercice,
  jouable,
  type BilanPerception,
  type ExercicePerception,
} from '../engine/perception';
import { disponible, parler } from '../audio/tts';
import Entete from '../components/Entete';

/**
 * Écran « Entraîner mon oreille » — perception avant production.
 *
 * On ne montre PAS les mots pendant l'écoute : l'élève doit trancher à l'oreille,
 * c'est tout l'exercice. Les mots ne sont révélés qu'après la réponse.
 * Aucun pourcentage global, aucun classement : un compte de mots reconnus et la
 * liste des paires encore confondues.
 */

export interface Props {
  code: CodePhoneme;
  langue: LangueCible;
  /** Retour à l'écran précédent (diagnostic ou entraînement). */
  onQuitter: () => void;
  /** L'élève veut travailler ce son à voix haute après l'exercice. */
  onTravailler?: (code: CodePhoneme) => void;
}

const NB_ITEMS = 6;

export default function Perception({ code, langue, onQuitter, onTravailler }: Props) {
  const [graine, setGraine] = useState(() => Date.now() % 100000);
  const exercice: ExercicePerception = useMemo(
    () => creerExercice(code, langue, { nb: NB_ITEMS, graine }),
    [code, langue, graine],
  );
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState<Array<0 | 1 | null>>([]);
  const [montre, setMontre] = useState(false);
  const tts = useMemo(() => disponible(), []);

  const item = exercice.items[index];
  const bilan: BilanPerception | null = useMemo(
    () => (index >= exercice.items.length ? corriger(exercice, reponses) : null),
    [exercice, reponses, index],
  );

  const ecouter = useCallback(
    async (mot: string, debit = 0.8) => {
      if (!tts || !mot) return;
      try {
        await parler(mot, { langue, debit });
      } catch {
        /* la synthèse peut être coupée par l'utilisateur : ce n'est pas une erreur */
      }
    },
    [tts, langue],
  );

  // Lecture automatique à chaque nouvel item — et seulement là (jamais en boucle).
  useEffect(() => {
    if (item && tts) void ecouter(item.mot);
  }, [index, graine, item, tts, ecouter]);

  const repondre = (choix: 0 | 1) => {
    if (montre) return;
    setReponses((r) => [...r.slice(0, index), choix]);
    setMontre(true);
  };

  const suivant = () => {
    setMontre(false);
    setIndex((i) => i + 1);
  };

  const refaire = () => {
    setReponses([]);
    setIndex(0);
    setMontre(false);
    setGraine(Date.now() % 100000);
  };

  if (!jouable(code) || exercice.items.length === 0) {
    return (
      <Shell onQuitter={onQuitter}>
        <h1 className="text-xl font-semibold">Pas d’exercice d’écoute pour ce son</h1>
        <p className="text-neutre">
          Ce point de la taxonomie n’a pas de paire minimale exploitable (c’est un accent de
          mot, pas un son). Passe directement à l’entraînement parlé.
        </p>
      </Shell>
    );
  }

  if (bilan) {
    return (
      <Shell onQuitter={onQuitter}>
        <h1 className="text-xl font-semibold">
          {bilan.reussis} mot{bilan.reussis > 1 ? 's' : ''} reconnu{bilan.reussis > 1 ? 's' : ''} sur{' '}
          {bilan.total}
        </h1>
        {bilan.pairesARevoir.length > 0 ? (
          <>
            <p className="text-neutre">Ces paires se confondent encore à l’oreille :</p>
            <ul className="flex flex-col gap-2">
              {bilan.pairesARevoir.map(([a, b]) => (
                <li key={a + b} className="flex items-center gap-3">
                  <span className="etiquette" lang={langue}>{a} ≠ {b}</span>
                  <button type="button" className="bouton-fantome text-sm" onClick={() => void ecouter(a, 0.6)}>
                    Écouter {a}
                  </button>
                  <button type="button" className="bouton-fantome text-sm" onClick={() => void ecouter(b, 0.6)}>
                    Écouter {b}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-neutre">
              Tant que l’oreille ne les sépare pas, la bouche n’y arrivera pas. Réécoute-les au
              ralenti, puis refais l’exercice.
            </p>
          </>
        ) : (
          <p className="text-neutre">
            Toutes les paires sont distinguées. Ton oreille est prête : passe à la production.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="bouton-secondaire" onClick={refaire}>Refaire</button>
          {onTravailler && (
            <button type="button" className="bouton-primaire" onClick={() => onTravailler(code)}>
              Travailler ce son à voix haute
            </button>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell onQuitter={onQuitter}>
      <p className="etiquette">
        Exercice {index + 1} / {exercice.items.length} — /{PHONEMES[code].ipa}/
      </p>
      <h1 className="text-xl font-semibold leading-snug">
        Deux mots très proches vont être lus. Lequel as-tu entendu ?
      </h1>

      {!tts && (
        <p className="rounded-xl border border-aTravailler/40 bg-aTravailler-doux p-3 text-sm text-aTravailler" role="status">
          Ce navigateur ne peut pas lire les mots. Fais l’exercice à deux : une personne lit
          l’un des deux mots, tu choisis A ou B.
        </p>
      )}

      <div className="flex gap-3">
        {([0, 1] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            className="bouton-secondaire flex-1 text-2xl"
            onClick={() => repondre(slot)}
            disabled={montre}
            aria-label={`Réponse ${slot === 0 ? 'A' : 'B'}`}
          >
            {slot === 0 ? 'A' : 'B'}
          </button>
        ))}
      </div>

      <button type="button" className="bouton-fantome" onClick={() => item && void ecouter(item.mot)}>
        Réécouter
      </button>

      {montre && item && (
        <div className="carte flex flex-col gap-2" aria-live="polite">
          <p className="text-lg">
            {reponses[index] === item.reponse ? (
              <span className="text-acquis">Oui, c’était </span>
            ) : (
              <span className="text-aTravailler">C’était </span>
            )}
            <strong lang={langue}>{item.mot}</strong>
          </p>
          <p className="text-neutre" lang={langue}>
            {item.paire[0]} ≠ {item.paire[1]}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="bouton-fantome text-sm" onClick={() => void ecouter(item.paire[0], 0.6)}>
              Écouter {item.paire[0]}
            </button>
            <button type="button" className="bouton-fantome text-sm" onClick={() => void ecouter(item.paire[1], 0.6)}>
              Écouter {item.paire[1]}
            </button>
          </div>
          <button type="button" className="bouton-primaire mt-2" onClick={suivant}>
            {index + 1 >= exercice.items.length ? 'Voir le bilan' : 'Mot suivant'}
          </button>
        </div>
      )}
    </Shell>
  );
}

/** Cadre commun : entête + carte, pour ne pas répéter la mise en page. */
function Shell({ children, onQuitter }: { children: ReactNode; onQuitter: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onQuitter} />
      <div className="carte flex flex-col gap-4">{children}</div>
    </div>
  );
}
