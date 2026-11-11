import { useState } from 'react';
import type { LangueCible } from '../types';
import { LECTURES_REFERENCE } from '../constants';
import type { Reglages } from '../store/settings';
import Entete from '../components/Entete';

/**
 * Écran 8 — Réglages : clé API personnelle (mode BYOK, filet de sécurité
 * ACCENT.md §18.3), lectures de référence, export/suppression, mentions de
 * confidentialité.
 */

export interface Props {
  reglages: Reglages;
  onEnregistrer: (r: Reglages) => void;
  onRetour: () => void;
}

export default function ReglagesVue({ reglages, onEnregistrer, onRetour }: Props) {
  const [etat, setEtat] = useState<Reglages>(reglages);
  const [enregistre, setEnregistre] = useState(false);

  const maj = (patch: Partial<Reglages>) => {
    setEtat((prev) => ({ ...prev, ...patch }));
    setEnregistre(false);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onRetour} />
      <form
        className="carte flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onEnregistrer(etat);
        }}
      >
        <h1 className="text-2xl font-semibold">Réglages</h1>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm uppercase tracking-wide text-neutre">Mode BYOK</legend>
          <p className="text-sm text-neutre">
            Si le quota du proxy est épuisé, colle ta clé Azure Speech : elle reste dans ce
            navigateur et n’est envoyée qu’à Microsoft.
          </p>
          <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="cle">
            Clé Azure Speech
            <input
              id="cle"
              type="password"
              autoComplete="off"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-4 text-base text-texte"
              value={etat.cleAzure}
              onChange={(e) => maj({ cleAzure: e.target.value.trim() })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="region">
            Région (ex. westeurope)
            <input
              id="region"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-4 text-base text-texte"
              value={etat.regionAzure}
              onChange={(e) => maj({ regionAzure: e.target.value.trim() })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="proxy">
            URL du proxy (vide = même origine)
            <input
              id="proxy"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-4 text-base text-texte"
              value={etat.urlProxy}
              onChange={(e) => maj({ urlProxy: e.target.value.trim() })}
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm uppercase tracking-wide text-neutre">Mesure</legend>
          <label className="flex items-center gap-3 text-base" htmlFor="lectures">
            Lectures pour conclure
            <select
              id="lectures"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-3"
              value={etat.lectures}
              onChange={(e) => maj({ lectures: Number(e.target.value) })}
            >
              <option value={1}>1 — essai rapide (mesure moins fiable)</option>
              <option value={LECTURES_REFERENCE}>3 — score de référence (médiane)</option>
            </select>
          </label>
          <label className="flex items-center gap-3 text-base" htmlFor="langue">
            Paire de langues
            <select
              id="langue"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-3"
              value={etat.langueCible}
              onChange={(e) => maj({ langueCible: e.target.value as LangueCible })}
            >
              <option value="en">Français → Anglais</option>
              <option value="fr">Espagnol → Français (bientôt)</option>
              <option value="es">Anglais → Espagnol (bientôt)</option>
            </select>
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-3 border-t border-nuit-bord pt-4">
          <button type="submit" className="bouton-primaire">Enregistrer</button>
          <button type="button" className="bouton-fantome" onClick={onRetour}>Retour</button>
          {enregistre && <span className="self-center text-sm text-acquis">Enregistré</span>}
        </div>

        <p className="text-sm text-neutre">
          Confidentialité : l’audio n’est jamais conservé, ni ici ni sur le proxy (RNF-P1, RNF-P2).
          Aucune donnée biométrique dérivée n’est demandée ni stockée (RNF-P3).
        </p>
      </form>
    </div>
  );
}
