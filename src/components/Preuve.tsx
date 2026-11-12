import { useSyncExternalStore } from 'react';
import { abonnerPreuves, chargerPreuves, type Preuve } from '../store/preuves';

/**
 * Preuve d'étape — ce qui vient de se passer, et comment le vérifier.
 *
 * Composant unique réutilisé par tous les écrans : une ligne
 * `<Preuve etape="analyse" />` suffit à afficher la preuve de l'étape. Le
 * composant disparaît tant que l'étape n'a rien produit.
 */

export interface Props {
  /** Identifiant de l'étape (celui du journal) — inutile en mode `complet`. */
  etape?: string;
  /** Journal complet plutôt que la seule dernière preuve. */
  complet?: boolean;
  className?: string;
}

const ETAPES: Record<string, string> = {
  enregistrement: 'Enregistrement',
  analyse: 'Diagnostic',
  comparaison: 'Comparaison',
  entrainement: 'Entraînement',
  perception: 'Écoute',
  oral: 'Oral long',
  profil: 'Profil',
  donnees: 'Données',
  reglages: 'Réglages',
  export: 'Export',
};

function horodatage(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function Bloc({ preuve }: { preuve: Preuve }) {
  return (
    <div className="rounded-xl border border-acquis/40 bg-acquis-doux p-3">
      <p className="flex items-baseline gap-2 text-base font-medium text-acquis">
        <span aria-hidden="true">✓</span>
        <span>{preuve.titre}</span>
        <span className="ml-auto text-xs font-normal text-neutre">
          {ETAPES[preuve.etape] ?? preuve.etape} · {horodatage(preuve.at)}
        </span>
      </p>
      {preuve.details.length > 0 && (
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm text-neutre">
          {preuve.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {preuve.source && (
        <p className="mt-1 text-xs text-neutre">
          où vérifier : <span className="font-mono">{preuve.source}</span>
        </p>
      )}
    </div>
  );
}

export default function Preuve({ etape, complet = false, className = '' }: Props) {
  const preuves = useSyncExternalStore(abonnerPreuves, chargerPreuves, chargerPreuves);
  if (complet) {
    if (preuves.length === 0) return null;
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <h3 className="text-sm uppercase tracking-wide text-neutre">
          Journal des preuves ({preuves.length})
        </h3>
        {preuves.slice(0, 8).map((p: Preuve) => (
          <Bloc key={p.id} preuve={p} />
        ))}
      </div>
    );
  }
  const derniere = preuves.find((p) => p.etape === etape);
  if (!derniere) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-live="polite">
      <Bloc preuve={derniere} />
    </div>
  );
}
