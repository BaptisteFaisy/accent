import { useState } from 'react';
import type { LangueCible } from '../types';
import { LECTURES_REFERENCE } from '../constants';
import type { Reglages } from '../store/settings';
import Entete from '../components/Entete';
import { parler, trouverVoix, voixElevenLabs, type VoixEleven } from '../audio/tts';
import MicroEtat from '../components/MicroEtat';
import Preuve from '../components/Preuve';
import { ajouterPreuve } from '../store/preuves';

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
  const [voix, setVoix] = useState<VoixEleven[]>([]);
  const [messageVoix, setMessageVoix] = useState<string | null>(null);
  const [enCoursVoix, setEnCoursVoix] = useState(false);

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
          ajouterPreuve(
            'reglages',
            'Réglages enregistrés',
            [
              `lectures pour conclure : ${etat.lectures}`,
              `paire de langues : ${etat.langueCible}`,
              etat.cleAzure ? 'clé Azure enregistrée dans ce navigateur' : 'aucune clé Azure enregistrée',
              etat.urlProxy ? `proxy : ${etat.urlProxy}` : 'aucun proxy : moteur local',
            ],
            'src/store/settings.ts',
          );
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
              <option value="fr">Espagnol → Français</option>
              <option value="es">Anglais → Espagnol (bientôt)</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm uppercase tracking-wide text-neutre">Voix du modèle</legend>
          <p className="text-sm text-neutre">
            Par défaut, la voix vient du navigateur : 0 $, hors ligne, rien ne sort de
            la machine. Eleven Labs donne une voix multilingue beaucoup plus
            naturelle — au prix d’un envoi du <strong>texte</strong> à un tiers.
            L’audio de l’élève, lui, ne part jamais.
          </p>
          <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="moteurTts">
            Moteur
            <select
              id="moteurTts"
              className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-3 text-base text-texte"
              value={etat.moteurTts}
              onChange={(e) => maj({ moteurTts: e.target.value as Reglages['moteurTts'] })}
            >
              <option value="navigateur">Voix du navigateur (0 $, hors ligne)</option>
              <option value="eleven">Eleven Labs (BYOK)</option>
            </select>
          </label>

          {etat.moteurTts === 'eleven' && (
            <>
              <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="cleEleven">
                Clé API Eleven Labs
                <input
                  id="cleEleven"
                  type="password"
                  autoComplete="off"
                  className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-4 text-base text-texte"
                  value={etat.cleEleven}
                  onChange={(e) => maj({ cleEleven: e.target.value.trim() })}
                />
              </label>
              <p className="text-xs text-neutre">
                Offre gratuite : 10 000 caractères par mois. Clé à créer sur
                elevenlabs.io/app/profile/api-keys. Elle reste dans ce navigateur et
                n’est envoyée qu’à Eleven Labs.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="bouton-secondaire"
                  disabled={enCoursVoix || !etat.cleEleven}
                  onClick={async () => {
                    setEnCoursVoix(true);
                    setMessageVoix(null);
                    try {
                      const liste = await voixElevenLabs(etat.cleEleven);
                      setVoix(liste);
                      const laure = trouverVoix(liste, 'Laure') ?? trouverVoix(liste, 'Laura');
                      if (laure) {
                        maj({ voixEleven: laure.voice_id });
                        setMessageVoix(`Voix « ${laure.name} » sélectionnée.`);
                      } else if (liste.length > 0) {
                        setMessageVoix(`${liste.length} voix trouvées. Choisis celle que tu veux.`);
                      } else {
                        setMessageVoix('Aucune voix dans ce compte.');
                      }
                    } catch (e) {
                      setMessageVoix(e instanceof Error ? e.message : 'Impossible de lister les voix.');
                    } finally {
                      setEnCoursVoix(false);
                    }
                  }}
                >
                  {enCoursVoix ? 'Chargement…' : 'Charger mes voix'}
                </button>
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={async () => {
                    setMessageVoix(null);
                    try {
                      await parler('This is the model voice, a little slower.', {
                        langue: etat.langueCible,
                        debit: 0.75,
                        moteur: etat.moteurTts,
                        cle: etat.cleEleven,
                        voix: etat.voixEleven,
                      });
                      setMessageVoix('Voix testée.');
                    } catch (e) {
                      setMessageVoix(e instanceof Error ? e.message : 'Test impossible.');
                    }
                  }}
                >
                  Tester la voix
                </button>
              </div>

              {voix.length > 0 && (
                <ul className="flex max-h-56 flex-col gap-1 overflow-auto rounded-xl border border-nuit-bord p-2">
                  {voix.map((v) => (
                    <li key={v.voice_id}>
                      <label className="flex min-h-[48px] items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="voixEleven"
                          checked={etat.voixEleven === v.voice_id}
                          onChange={() => maj({ voixEleven: v.voice_id })}
                        />
                        {v.name}
                        {v.labels?.accent ? <span className="text-neutre">· {v.labels.accent}</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              <label className="flex flex-col gap-1 text-sm text-neutre" htmlFor="voixEleven">
                Identifiant de voix
                <input
                  id="voixEleven"
                  className="min-h-[48px] rounded-xl border border-nuit-bord bg-nuit px-4 font-mono text-sm text-texte"
                  value={etat.voixEleven}
                  onChange={(e) => maj({ voixEleven: e.target.value.trim() })}
                />
              </label>

              {messageVoix && (
                <p className="text-sm text-aTravailler" role="status">{messageVoix}</p>
              )}
              <p className="text-xs text-neutre">
                Seul le texte de la phrase est envoyé à Eleven Labs. Ton audio n’est
                jamais transmis, et aucune donnée biométrique n’en sort.
              </p>
            </>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm uppercase tracking-wide text-neutre">Micro</legend>
          <p className="text-sm text-neutre">
            Si le navigateur ne demande jamais l’accès, c’est presque toujours
            qu’aucun micro n’est visible ou que l’accès est bloqué pour ce site.
            Ce panneau dit lequel des deux.
          </p>
          <MicroEtat detaille />
        </fieldset>

        <Preuve etape="reglages" />

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
