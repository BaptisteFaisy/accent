import { useMemo } from 'react';
import type { CodePhoneme, LangueCible, Profil } from '../types';
import { SEUIL_ACQUIS } from '../constants';
import { PHONEMES, codesPourLangue } from '../data/phonemes';
import { chargerSessions, repartition, sonsRecurrents } from '../store/profile';
import { jouable } from '../engine/perception';
import Entete from '../components/Entete';
import { telechargerFichier } from '../download';
import Preuve from '../components/Preuve';
import { ajouterPreuve, toutSupprimerDonneesLocales } from '../store/preuves';

/**
 * Écran 7 — Profil : les 15 phonèmes, ceux travaillés en couleur, les autres en
 * gris. Aucun classement, aucun pourcentage global (ACCENT.md §10, garde-fou 2).
 */

/** Retourne le Markdown à télécharger (RF-24). */
export interface Props {
  profil: Profil;
  onRetour: () => void;
  onEffacer: () => void;
  onExporter: () => string;
  /** Paire de langues affichée : le profil ne mélange pas deux taxonomies. */
  langue?: LangueCible;
  /** Optionnel : ouvre le catalogue des sons. */
  onCatalogue?: () => void;
  /** Optionnel : discrimination auditive d'un son précis. */
  onPerception?: (code: CodePhoneme) => void;
  /** Optionnel : entraînement à la voix d'un son précis. */
  onTravailler?: (code: CodePhoneme) => void;
}

function classe(code: CodePhoneme, profil: Profil): string {
  const s = profil.parPhoneme[code];
  if (!s || s.tentatives === 0) return 'border-nuit-bord text-neutre';
  if ((s.meilleur ?? 0) >= SEUIL_ACQUIS) return 'border-acquis/50 bg-acquis-doux text-acquis';
  return 'border-aTravailler/50 bg-aTravailler-doux text-aTravailler';
}

export default function ProfilVue({
  profil,
  onRetour,
  onEffacer,
  onExporter,
  langue = 'en',
  onCatalogue,
  onPerception,
  onTravailler,
}: Props) {
  const { travailles, restants } = repartition(profil, langue);
  const codes = codesPourLangue(langue);
  // RF-22 : ce qui revient sur plusieurs phrases n'est pas un accident.
  const recurrents = useMemo(
    () => sonsRecurrents(chargerSessions()).filter((r) => codes.includes(r.code)),
    [profil.sessions, langue],
  );
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onRetour} />
      <div className="carte flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Mon profil de sons</h1>
        <p className="text-neutre">
          {travailles.length} son{travailles.length > 1 ? 's' : ''} travaillé{travailles.length > 1 ? 's' : ''} ·{' '}
          {restants.length} restant{restants.length > 1 ? 's' : ''}. Pas de classement, pas de
          comparaison : juste ce qu’il te reste.
        </p>

        {recurrents.length > 0 && (
          <section className="rounded-xl border border-aTravailler/40 bg-aTravailler-doux p-4">
            <h2 className="text-lg font-semibold text-aTravailler">Ce qui revient</h2>
            <p className="mt-1 text-sm text-neutre">
              Ces sons sont ressortis sur plusieurs phrases différentes : c’est par là
              que ça vaut le coup de commencer.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {recurrents.map(({ code, fois }) => (
                <li key={code} className="etiquette border-aTravailler/50 text-aTravailler">
                  <span className="font-mono">/{PHONEMES[code].ipa}/</span>
                  <span className="ml-2">{PHONEMES[code].label}</span>
                  <span className="ml-2 text-neutre">· {fois} phrases</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onCatalogue && (
          <button type="button" className="bouton-secondaire self-start" onClick={onCatalogue}>
            Voir les {codes.length} sons et leurs fautes typiques
          </button>
        )}

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {codes.map((code) => {
            const e = PHONEMES[code];
            const s = profil.parPhoneme[code];
            return (
              <li key={code} className={`rounded-xl border px-4 py-3 ${classe(code, profil)}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xl">/{e.ipa}/</span>
                  {s && s.tentatives > 0 ? (
                    <span className="text-sm tabular-nums">
                      meilleur {s.meilleur} · {s.tentatives} essai{s.tentatives > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-sm">pas encore travaillé</span>
                  )}
                </div>
                <p className="text-sm opacity-80">{e.label}</p>
                {s?.acquisLe && (
                  <p className="text-xs opacity-70">
                    acquis le {new Date(s.acquisLe).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {(onPerception || onTravailler) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {onPerception && jouable(code) && (
                      <button
                        type="button"
                        className="min-h-[48px] rounded-lg px-2 text-sm underline underline-offset-2"
                        onClick={() => onPerception(code)}
                        aria-label={`Discriminer le son ${e.ipa} à l'oreille`}
                      >
                        Discriminer
                      </button>
                    )}
                    {onTravailler && (
                      <button
                        type="button"
                        className="min-h-[48px] rounded-lg px-2 text-sm underline underline-offset-2"
                        onClick={() => onTravailler(code)}
                        aria-label={`Travailler le son ${e.ipa} à la voix`}
                      >
                        Travailler
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Preuve complet />

        <div className="flex flex-wrap gap-3 border-t border-nuit-bord pt-4">
          <button
            type="button"
            className="bouton-secondaire"
            onClick={() => {
              const md = onExporter();
              telechargerFichier(md, 'accent-mes-sons.md');
              ajouterPreuve(
                'export',
                'Export Markdown généré',
                [
                  `${md.split('\n').length} lignes`,
                  'sons travaillés + journal des preuves',
                  'fichier local, jamais envoyé nulle part',
                ],
                'src/store/profile.ts',
              );
            }}
          >
            Exporter la liste (Markdown)
          </button>
          <button
            type="button"
            className="bouton-fantome text-erreur"
            onClick={() => {
              onEffacer();
              toutSupprimerDonneesLocales();
            }}
          >
            Tout supprimer
          </button>
        </div>
        <p className="text-sm text-neutre">
          Ces données vivent uniquement dans ton navigateur. Aucune voix, aucune empreinte vocale.
        </p>
      </div>
    </div>
  );
}
