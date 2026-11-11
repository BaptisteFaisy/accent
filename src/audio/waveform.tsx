import { TAUX_ECHANTILLONNAGE } from '../constants';

/**
 * Forme d'onde — écran 2 (enregistrement) et écran 4 (diagnostic).
 *
 * Deux niveaux :
 *  - `peaks()` : fonction PURE, déterministe, testable sans DOM ni micro ;
 *  - `Waveform` : rendu SVG (aucune dépendance, aucun canvas), accessible et
 *    respectueux de `prefers-reduced-motion` (aucune animation ici de toute
 *    façon : le dessin est recalculé, pas animé).
 */

/** Amplitudes 0..1 pour `nbBarres` barres, à partir d'un signal mono. */
export function peaks(pcm: Float32Array, nbBarres: number): number[] {
  const n = Math.max(1, Math.floor(nbBarres));
  if (!pcm || pcm.length === 0) return new Array(n).fill(0);
  const pas = pcm.length / n;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const debut = Math.floor(i * pas);
    const fin = Math.max(debut + 1, Math.floor((i + 1) * pas));
    let max = 0;
    for (let j = debut; j < fin && j < pcm.length; j += 1) {
      const v = Math.abs(pcm[j]);
      if (v > max) max = v;
    }
    out.push(Math.min(1, max));
  }
  return out;
}

/** Niveau instantané (0..1) à partir d'un RMS : barre unique, échelle douce. */
export function niveauVersAmplitude(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.sqrt(rms) * 3);
}

export interface WaveformProps {
  /** Signal mono 16 kHz (facultatif : sinon on dessine le niveau instantané). */
  pcm?: Float32Array;
  /** Niveau RMS courant, utilisé si `pcm` est absent. */
  niveau?: number;
  barres?: number;
  /** Couleur du trait (classe Tailwind ou couleur CSS). */
  couleur?: string;
  hauteur?: number;
  label?: string;
}

/** Dessin SVG : role="img" + aria-label, texte de substitution toujours présent. */
export default function Waveform(props: WaveformProps) {
  const nb = Math.max(3, props.barres ?? 48);
  const h = props.hauteur ?? 64;
  const valeurs = props.pcm
    ? peaks(props.pcm, nb)
    : new Array(nb).fill(niveauVersAmplitude(props.niveau ?? 0));
  const label = props.label ?? 'Forme d’onde de ta lecture';
  return (
    <svg
      viewBox={`0 0 ${nb * 4} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
      focusable="false"
    >
      {valeurs.map((v, i) => {
        const hauteur = Math.max(2, v * h);
        return (
          <rect
            key={i}
            x={i * 4}
            y={(h - hauteur) / 2}
            width={2.5}
            height={hauteur}
            rx={1.25}
            fill={props.couleur ?? 'currentColor'}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/** Durée affichable d'un signal mono 16 kHz, en secondes (1 décimale). */
export function dureeSecondes(pcm: Float32Array, taux = TAUX_ECHANTILLONNAGE): number {
  if (!pcm || taux <= 0) return 0;
  return Math.round((pcm.length / taux) * 10) / 10;
}
