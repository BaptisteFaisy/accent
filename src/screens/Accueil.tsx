import type { LangueCible } from '../types';
import { PHRASE_MAX_CAR } from '../constants';
import Entete from '../components/Entete';
import { LANGUES } from '../providers';

/**
 * Écran 1 — Accueil : un champ « Quelle phrase veux-tu travailler ? » et les
 * 10 phrases prêtes. Rien d'autre : ton texte, pas notre programme (§4).
 */

export interface Props {
  phrase: string;
  phrasesPretes: string[];
  langueCible: LangueCible;
  fournisseur: string;
  onPhrase: (p: string) => void;
  onLangue: (l: LangueCible) => void;
  onDemarrer: () => void;
  onProfil: () => void;
  onReglages: () => void;
}

export default function Accueil(p: Props) {
  const reste = PHRASE_MAX_CAR - p.phrase.length;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <Entete onProfil={p.onProfil} onReglages={p.onReglages} />

      <p className="text-center text-lg text-neutre sm:text-xl">
        Elle ne te note pas. <span className="text-texte">Elle te montre le son qui cloche.</span>
      </p>

      <section className="carte flex flex-col gap-4">
        <h1 className="text-2xl font-semibold leading-snug">Quelle phrase veux-tu travailler ?</h1>
        <p className="text-neutre">
          Celle de ton exposé, de ton entretien, de ton oral. On ne t’entraîne pas sur notre cours :
          on t’entraîne sur <strong className="text-texte">ton texte</strong>.
        </p>
        <label className="flex flex-col gap-2" htmlFor="phrase">
          <span className="text-sm text-neutre">Ta phrase (200 caractères max)</span>
          <textarea
            id="phrase"
            className="min-h-24 w-full resize-y rounded-xl border border-nuit-bord bg-nuit p-4 text-lg
              focus:border-acquis focus:outline-none"
            value={p.phrase}
            maxLength={PHRASE_MAX_CAR}
            lang={p.langueCible}
            onChange={(e) => p.onPhrase(e.target.value)}
          />
          <span className="text-right text-sm text-neutre" aria-live="polite">
            {reste} caractères restants
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="bouton-primaire"
            disabled={p.phrase.trim().length < 3}
            onClick={p.onDemarrer}
          >
            Je la lis à voix haute
          </button>
          <select
            className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-3 text-base"
            value={p.langueCible}
            aria-label="Paire de langues"
            onChange={(e) => p.onLangue(e.target.value as LangueCible)}
          >
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code} disabled={!l.pret}>
                {l.label}
                {l.pret ? '' : ' (bientôt)'}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-neutre">Moteur : {p.fournisseur}</p>
      </section>

      <section className="flex flex-col gap-3" aria-label="Phrases prêtes">
        <h2 className="text-sm uppercase tracking-wide text-neutre">Ou pars d’une de ces phrases</h2>
        <ul className="flex flex-col gap-2">
          {p.phrasesPretes.map((texte) => (
            <li key={texte}>
              <button
                type="button"
                onClick={() => p.onPhrase(texte)}
                className="w-full rounded-xl border border-nuit-bord bg-nuit-carte px-4 py-3 text-left
                  text-base hover:border-neutre/50"
                lang="en"
              >
                {texte}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-neutre">
        Ta voix n’est pas conservée. Elle ne sert qu’à te corriger.
      </p>
    </div>
  );
}
