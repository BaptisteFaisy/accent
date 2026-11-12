import type { CSSProperties } from 'react';
import { SEUIL_A_TRAVAILLER, SEUIL_ACQUIS } from '../constants';

/**
 * L'incertitude affichée, pas cachée (§18.4).
 *
 * Un score de prononciation sur un mot court est une ESTIMATION. On montre donc
 * l'étendue réellement observée sur les lectures : la barre grise = entre min et
 * max, le trait plein = la médiane retenue. Si cette étendue traverse un seuil
 * de décision (60 ou 80), on le dit : la mesure ne permet pas de conclure
 * fermement. C'est le même principe que le refus d'afficher un écart > 20 pts.
 */

export interface Props {
  mediane: number;
  min: number;
  max: number;
  lectures: number;
  auBordDuSeuil?: boolean;
}

function styleBarre(min: number, max: number): CSSProperties {
  const debut = Math.max(0, Math.min(100, min));
  const largeur = Math.max(1.5, Math.min(100 - debut, max - min));
  return { left: `${debut}%`, width: `${largeur}%` };
}

export default function FourchetteScore({ mediane, min, max, lectures, auBordDuSeuil }: Props) {
  const uneSeule = lectures <= 1;
  return (
    <div className="flex w-full flex-col gap-2">
      <div
        className="relative h-2 w-full rounded-full bg-neutre-doux"
        role="img"
        aria-label={`Score ${mediane} sur 100, observé entre ${min} et ${max} sur ${lectures} lecture${lectures > 1 ? 's' : ''}`}
      >
        {/* Seuils de décision : repères discrets, jamais une note. */}
        <span className="absolute top-0 h-full w-px bg-neutre/40" style={{ left: `${SEUIL_A_TRAVAILLER}%` }} />
        <span className="absolute top-0 h-full w-px bg-neutre/40" style={{ left: `${SEUIL_ACQUIS}%` }} />
        {!uneSeule && (
          <span className="absolute top-0 h-full rounded-full bg-neutre/50" style={styleBarre(min, max)} />
        )}
        <span
          className="absolute -top-1 h-4 w-1 rounded bg-acquis"
          style={{ left: `calc(${Math.max(0, Math.min(100, mediane))}% - 2px)` }}
          aria-hidden="true"
        />
      </div>
      <p className="text-center text-sm text-neutre">
        {uneSeule
          ? 'Une seule lecture : mesure indicative, moins fiable.'
          : `médiane de ${lectures} lectures · observé entre ${min} et ${max}`}
      </p>
      {auBordDuSeuil && !uneSeule && (
        <p className="text-center text-sm text-aTravailler" role="status">
          Tes lectures encadrent un seuil de décision : la mesure est trop large pour
          conclure fermement. Une quatrième lecture trancherait.
        </p>
      )}
    </div>
  );
}
