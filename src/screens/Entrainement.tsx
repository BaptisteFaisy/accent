import { useState } from 'react';
import type { Cible, PhraseEntrainement } from '../types';
import Entete from '../components/Entete';
import ModeleAudio from '../components/ModeleAudio';

/**
 * Écran 6 — Entraînement : trois phrases contenant le phonème cible, à lire
 * l'une après l'autre. Même son, trois contextes (ACCENT.md §6, 1:55–2:15).
 * Les phrases viennent du cache commité : ça marche hors ligne.
 */

export interface Props {
  cible: Cible;
  phrases: PhraseEntrainement[];
  onPhrase: (texte: string) => void;
  onQuitter: () => void;
  /** Optionnel : discrimination auditive du son courant, avant de le produire. */
  onPerception?: () => void;
}

export default function Entrainement({ cible, phrases, onPhrase, onQuitter, onPerception }: Props) {
  const [index, setIndex] = useState(0);
  const p = phrases[index];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onQuitter} />
      <div className="carte flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-wide text-neutre">
            Exercice {index + 1} / {phrases.length} — un seul son
          </p>
          <p className="phoneme-heros text-3xl">/{cible.entree.ipa}/</p>
        </div>

        {p ? (
          <>
            <p className="text-2xl leading-relaxed" lang="en">
              {p.texte.split(new RegExp(`(${p.motCle})`, 'i')).map((morceau, i) =>
                morceau.toLowerCase() === p.motCle.toLowerCase() ? (
                  <mark key={i} className="rounded bg-aTravailler-doux px-1 text-aTravailler">
                    {morceau}
                  </mark>
                ) : (
                  <span key={i}>{morceau}</span>
                ),
              )}
            </p>
            <ModeleAudio
              texte={p.texte}
              langue={cible.entree.langueCible}
              label="Écouter la phrase"
            />
            <p className="text-neutre">{cible.entree.conseil}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="bouton-primaire" onClick={() => onPhrase(p.texte)}>
                Lire cette phrase
              </button>
              {onPerception && (
                <button type="button" className="bouton-secondaire" onClick={onPerception}>
                  Entraîner mon oreille d’abord
                </button>
              )}
              {index < phrases.length - 1 && (
                <button type="button" className="bouton-secondaire" onClick={() => setIndex(index + 1)}>
                  Passer à la suivante
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-neutre">Aucune phrase en cache pour ce son.</p>
        )}

        <ul className="flex flex-col gap-2 border-t border-nuit-bord pt-4">
          {cible.entree.pairesMinimales.map(([a, b]) => (
            <li key={a} className="text-base text-neutre" lang="en">
              {a} <span className="text-texte">≠</span> {b}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="bouton-fantome" onClick={onQuitter}>
        Revenir à l’accueil
      </button>
    </div>
  );
}
