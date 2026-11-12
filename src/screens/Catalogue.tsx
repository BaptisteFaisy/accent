import type { CodePhoneme, LangueCible, Profil } from '../types';
import { entrees } from '../data/phonemes';
import { jouable } from '../engine/perception';
import { phrasesPour } from '../data/training';
import Entete from '../components/Entete';

/**
 * Catalogue des sons — la taxonomie de la paire courante, rendue visible.
 *
 * Jusque-là, la taxonomie n'était visible qu'à travers un diagnostic : il
 * fallait d'abord enregistrer une phrase pour découvrir quels sons existent.
 * Cet écran montre les 15 phonèmes FR→EN (ou les 9 ES→FR) et donne accès
 * direct aux deux modes qui travaillent un son : discrimination à l'oreille
 * (`perception`) et entraînement à la voix.
 *
 * Chaque carte porte la signature d'erreur (« un francophone transforme /θ/ en
 * /s/ ») : c'est la pédagogie, pas une liste de symboles.
 */

export interface Props {
  langue: LangueCible;
  profil: Profil;
  /** Ouvre le mode discrimination sur ce son. */
  onPerception: (code: CodePhoneme) => void;
  /** Lance l'entraînement à la voix sur ce son (phrase d'entraînement imposée). */
  onTravailler: (code: CodePhoneme) => void;
  onRetour: () => void;
}

export default function Catalogue({ langue, profil, onPerception, onTravailler, onRetour }: Props) {
  const sons = entrees(langue);
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onRetour} />

      <section className="carte flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Les {sons.length} sons à travailler</h1>
        <p className="text-neutre">
          Chaque son porte sa faute typique. Entraîne l’oreille d’abord (entendre la
          différence), puis la bouche (produire le son).
        </p>
      </section>

      <ul className="flex flex-col gap-3">
        {sons.map((e) => {
          const deja = profil.parPhoneme[e.code];
          const discriminant = jouable(e.code);
          const phrases = phrasesPour(e.code, langue);
          return (
            <li key={e.code} className="carte flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-2xl font-semibold" aria-label={`phonème ${e.ipa}`}>
                  /{e.ipa}/
                </span>
                <span className="text-sm text-neutre" aria-hidden="true">
                  {'★'.repeat(e.difficulte)}
                  {'☆'.repeat(3 - e.difficulte)}
                </span>
              </div>
              <p className="text-base">{e.label}</p>
              <p className="text-sm text-neutre">{e.signature}</p>
              {deja && (
                <p className="text-sm text-acquis">
                  Déjà travaillé{deja.tentatives > 1 ? ` (${deja.tentatives} essais)` : ''}
                  {deja.acquisLe ? ' — acquis' : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() => onPerception(e.code)}
                  disabled={!discriminant}
                  aria-label={`Entraîner mon oreille sur le son ${e.ipa}`}
                >
                  {discriminant ? 'Discriminer à l’oreille' : 'Pas de paire minimale'}
                </button>
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() => onTravailler(e.code)}
                  aria-label={`Travailler le son ${e.ipa} à la voix`}
                >
                  Travailler à la voix
                </button>
              </div>
              {phrases.length > 0 && (
                <p className="text-sm text-neutre">
                  Exemple : <span lang={langue}>{phrases[0].texte}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-center text-sm text-neutre">
        La liste dépend de la paire de langues (Réglages). Chaque son a sa faute
        typique : c’est la donnée qui fait la pédagogie.
      </p>
    </div>
  );
}
