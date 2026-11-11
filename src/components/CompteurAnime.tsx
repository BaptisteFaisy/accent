import { useEffect, useRef, useState } from 'react';

/**
 * Compteur qui glisse d'une valeur à l'autre — l'écran de la vidéo
 * (ACCENT.md §6, 1:30-1:55 : « le before/after qui compte »).
 *
 * `prefers-reduced-motion` : on affiche la valeur finale sans animation
 * (RNF-06). Aucune dépendance : requestAnimationFrame natif.
 */

export interface Props {
  valeur: number;
  /** Valeur de départ de l'animation (par défaut : la valeur affichée). */
  depuis?: number;
  dureeMs?: number;
  suffixe?: string;
  /** aria-label du nombre, pour la transcription textuelle (RNF-06). */
  label?: string;
  className?: string;
}

function mouvementReduit(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export default function CompteurAnime({
  valeur,
  depuis,
  dureeMs = 900,
  suffixe = '',
  label,
  className = '',
}: Props) {
  const [affiche, setAffiche] = useState(valeur);
  const frame = useRef(0);

  useEffect(() => {
    const debut = depuis ?? valeur;
    if (mouvementReduit() || debut === valeur) {
      setAffiche(valeur);
      return;
    }
    const t0 = performance.now();
    const pas = (maintenant: number) => {
      const p = Math.min(1, (maintenant - t0) / dureeMs);
      // easeOutCubic : le chiffre ralentit en arrivant, lisible à la caméra.
      const ease = 1 - Math.pow(1 - p, 3);
      setAffiche(Math.round(debut + (valeur - debut) * ease));
      if (p < 1) frame.current = requestAnimationFrame(pas);
    };
    frame.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(frame.current);
  }, [valeur, depuis, dureeMs]);

  return (
    <span className={`tabular-nums ${className}`} aria-live="polite"
      aria-label={label ?? `${valeur}${suffixe}`}>
      {affiche}
      {suffixe && <span className="text-base text-neutre">{suffixe}</span>}
    </span>
  );
}
