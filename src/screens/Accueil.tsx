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
  /** Optionnel : ouvre l'écran « Tes données » (RNF-P4/P5). */
  onDonnees?: () => void;
  /** Optionnel : ouvre le mode oral long (RF-21). */
  onOralLong?: () => void;
  /** Optionnel : ouvre le catalogue des sons (perception + entraînement). */
  onCatalogue?: () => void;
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

      {(p.onOralLong || p.onCatalogue) && (
        <section className="flex flex-col gap-3" aria-label="Autres façons de travailler">
          <h2 className="text-sm uppercase tracking-wide text-neutre">
            Tout ce que tu peux faire ici
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li>
              <ModeCarte
                titre="Une phrase"
                texte="Tu lis, elle isole le son qui cloche."
                onClick={p.onDemarrer}
                ariaLabel="Travailler une phrase"
              />
            </li>
            {p.onOralLong && (
              <li>
                <ModeCarte
                  titre="Un texte long"
                  texte="Exposé, entretien, oral : guidé phrase par phrase."
                  onClick={p.onOralLong}
                  ariaLabel="Travailler un texte long phrase par phrase"
                />
              </li>
            )}
            {p.onCatalogue && (
              <li>
                <ModeCarte
                  titre="Entraîner mon oreille"
                  texte="Les 15 sons et leurs fautes typiques, à discriminer."
                  onClick={p.onCatalogue}
                  ariaLabel="Ouvrir le catalogue des sons"
                />
              </li>
            )}
            <li>
              <ModeCarte
                titre="Mes sons"
                texte="Ce que tu as travaillé, ce qu’il te reste."
                onClick={p.onProfil}
                ariaLabel="Voir mon profil de sons"
              />
            </li>
          </ul>
        </section>
      )}

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

      {p.onDonnees ? (
        <button type="button" className="bouton-fantome text-sm" onClick={p.onDonnees}>
          Ta voix n’est pas conservée. Elle ne sert qu’à te corriger. — Voir mes données
        </button>
      ) : (
        <p className="text-center text-sm text-neutre">
          Ta voix n’est pas conservée. Elle ne sert qu’à te corriger.
        </p>
      )}
    </div>
  );
}


/** Carte de mode : une entrée visible par fonctionnalité (aucune feature cachée). */
function ModeCarte({
  titre,
  texte,
  onClick,
  ariaLabel,
}: {
  titre: string;
  texte: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex min-h-[48px] w-full flex-col items-start gap-1 rounded-xl border border-nuit-bord
        bg-nuit-carte px-4 py-3 text-left hover:border-neutre/50"
    >
      <span className="text-base font-medium">{titre}</span>
      <span className="text-sm text-neutre">{texte}</span>
    </button>
  );
}
