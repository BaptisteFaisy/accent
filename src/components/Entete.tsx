/**
 * Entête minimal : le produit n'affiche aucun score global, aucun streak,
 * aucune flamme (ACCENT.md §21). Deux accès seulement : profil et réglages.
 */

export interface Props {
  onProfil?: () => void;
  onReglages?: () => void;
  onAccueil?: () => void;
}

export default function Entete({ onProfil, onReglages, onAccueil }: Props) {
  return (
    <header className="flex items-center justify-between gap-3">
      <button type="button" className="bouton-fantome px-2" onClick={onAccueil} aria-label="Accueil Accent">
        <span className="text-lg font-semibold tracking-tight">Accent</span>
        <span className="ml-2 hidden text-sm text-neutre sm:inline">un son à la fois</span>
      </button>
      <nav className="flex items-center gap-1" aria-label="Navigation secondaire">
        {onProfil && (
          <button type="button" className="bouton-fantome" onClick={onProfil}>
            Mes sons
          </button>
        )}
        {onReglages && (
          <button type="button" className="bouton-fantome" onClick={onReglages} aria-label="Réglages">
            Réglages
          </button>
        )}
      </nav>
    </header>
  );
}
