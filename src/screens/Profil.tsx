import type { CodePhoneme, Profil } from '../types';
import { SEUIL_ACQUIS } from '../constants';
import { CODES_PHONEMES, PHONEMES } from '../data/phonemes';
import { repartition } from '../store/profile';
import Entete from '../components/Entete';

/**
 * Écran 7 — Profil : les 15 phonèmes, ceux travaillés en couleur, les autres en
 * gris. Aucun classement, aucun pourcentage global (ACCENT.md §10, garde-fou 2).
 */

export interface Props {
  profil: Profil;
  onRetour: () => void;
  onEffacer: () => void;
  /** Retourne le Markdown à télécharger (RF-24). */
  onExporter: () => string;
}

function telecharger(markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'accent-mes-sons.md';
  a.click();
  URL.revokeObjectURL(url);
}

function classe(code: CodePhoneme, profil: Profil): string {
  const s = profil.parPhoneme[code];
  if (!s || s.tentatives === 0) return 'border-nuit-bord text-neutre';
  if ((s.meilleur ?? 0) >= SEUIL_ACQUIS) return 'border-acquis/50 bg-acquis-doux text-acquis';
  return 'border-aTravailler/50 bg-aTravailler-doux text-aTravailler';
}

export default function ProfilVue({ profil, onRetour, onEffacer, onExporter }: Props) {
  const { travailles, restants } = repartition(profil);
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

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CODES_PHONEMES.map((code) => {
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
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-3 border-t border-nuit-bord pt-4">
          <button type="button" className="bouton-secondaire" onClick={() => telecharger(onExporter())}>
            Exporter la liste (Markdown)
          </button>
          <button type="button" className="bouton-fantome text-erreur" onClick={onEffacer}>
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
