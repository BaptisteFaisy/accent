import { useMemo, useState } from 'react';
import type { Profil } from '../types';
import {
  DECLARATIONS,
  JAMAIS_COLLECTE,
  inventorier,
  resume,
  urlPreuve,
} from '../store/privacy';
import Entete from '../components/Entete';
import { telechargerFichier } from '../download';

/**
 * Écran « Tes données » — RNF-P4 et RNF-P5 côté produit.
 *
 * La promesse de confidentialité du projet est architecturale (aucun backend de
 * données). Cet écran la rend lisible par un adolescent en dix secondes, et
 * vérifiable : chaque affirmation pointe vers le fichier du dépôt public qui la
 * prouve.
 */

export interface Props {
  profil: Profil;
  onRetour: () => void;
  /** Retourne le Markdown à télécharger (RF-24). */
  onExporter: () => string;
  /** Efface profil et séances. */
  onEffacer: () => void;
}

export default function Donnees({ profil, onRetour, onExporter, onEffacer }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [fait, setFait] = useState<string | null>(null);
  // Inventaire recalculé à chaque affichage : il reflète l'état réel du navigateur.
  const etat = useMemo(() => inventorier(profil), [profil]);
  const lignes = useMemo(() => resume(etat), [etat]);

  const effacer = () => {
    onEffacer();
    setConfirm(false);
    setFait('Tout est effacé de ce navigateur.');
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onRetour} />

      <section className="carte flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Tes données</h1>
        <p className="text-lg text-acquis">
          Ta voix n’est pas conservée. Elle ne sert qu’à te corriger.
        </p>
        <p className="text-neutre">
          Il n’y a pas de compte, pas de base de données, pas de serveur qui garde ton
          audio. Ce n’est pas une promesse : c’est l’architecture — et le code est public.
        </p>
      </section>

      <section className="carte flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ce qui n’est jamais stocké</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-neutre">
          {JAMAIS_COLLECTE.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section className="carte flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ce qui vit dans ton navigateur</h2>
        <ul className="flex flex-col gap-1 text-neutre" aria-live="polite">
          {lignes.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {etat.cles.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {etat.cles.map((c) => (
              <li key={c.cle} className="etiquette font-mono text-xs">
                {c.cle} · {(c.octets / 1024).toFixed(1)} Ko
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Les preuves, dans le code</h2>
        <ul className="flex flex-col gap-3">
          {DECLARATIONS.map((d) => (
            <li key={d.cle} className="flex flex-col gap-1 border-b border-nuit-bord pb-3 last:border-0">
              <span className="font-medium">{d.titre}</span>
              <span className="text-sm text-neutre">{d.reponse}</span>
              <a
                className="text-sm text-acquis underline underline-offset-2"
                href={urlPreuve(d.preuve)}
                target="_blank"
                rel="noreferrer"
              >
                Vérifier : {d.preuve}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="carte flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Reprendre la main</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="bouton-secondaire"
            onClick={() => {
              const ok = telechargerFichier(onExporter(), 'accent-mes-donnees.md');
              setFait(
                ok
                  ? 'Export téléchargé (Markdown).'
                  : 'Téléchargement refusé par ce navigateur : le contenu reste copiable dans le profil.',
              );
            }}
          >
            Tout exporter (Markdown)
          </button>
          {confirm ? (
            <span className="flex flex-wrap items-center gap-2">
              <button type="button" className="bouton-primaire" onClick={effacer}>
                Oui, tout effacer
              </button>
              <button type="button" className="bouton-fantome" onClick={() => setConfirm(false)}>
                Annuler
              </button>
            </span>
          ) : (
            <button type="button" className="bouton-fantome text-erreur" onClick={() => setConfirm(true)}>
              Tout supprimer
            </button>
          )}
        </div>
        {confirm && (
          <p className="text-sm text-erreur" role="status">
            Cette action efface ton profil et tes séances de ce navigateur. Elle est
            définitive : il n’y a aucune copie ailleurs.
          </p>
        )}
        {fait && !confirm && (
          <p className="text-sm text-acquis" role="status">{fait}</p>
        )}
      </section>

      <button type="button" className="bouton-fantome" onClick={onRetour}>Retour</button>
    </div>
  );
}
