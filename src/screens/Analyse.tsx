import type { ProgressionPipeline } from '../types';
import Entete from '../components/Entete';

/**
 * Écran 3 — Analyse : les 5 étapes nommées, avec leur progression. L'attente
 * devient une démonstration du pipeline (ACCENT.md §18.2, critère Presentation).
 */

const ETAPES: Array<{ cle: ProgressionPipeline['etape']; label: string }> = [
  { cle: 'ecoute', label: 'Écoute' },
  { cle: 'evaluation', label: 'Évaluation' },
  { cle: 'diagnostic', label: 'Diagnostic' },
  { cle: 'explication', label: 'Explication' },
  { cle: 'exercice', label: 'Exercice' },
];

export interface Props {
  progression: ProgressionPipeline | null;
}

function etat(cle: ProgressionPipeline['etape'], actif: ProgressionPipeline | null): string {
  if (!actif) return 'text-neutre';
  const ordre = ETAPES.map((e) => e.cle);
  if (ordre.indexOf(cle) < ordre.indexOf(actif.etape)) return 'text-acquis';
  if (cle === actif.etape) return 'text-aTravailler';
  return 'text-neutre';
}

export default function Analyse({ progression }: Props) {
  const pct = progression ? Math.round(progression.avancement * 100) : 0;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Entete />
      <div className="carte flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Analyse en cours…</h1>
        <ol className="flex flex-col gap-3">
          {ETAPES.map((e) => (
            <li key={e.cle} className={`flex items-center gap-3 text-lg ${etat(e.cle, progression)}`}>
              <span aria-hidden="true">{progression?.etape === e.cle ? '▶' : '·'}</span>
              <span>{e.label}</span>
              {progression?.etape === e.cle && progression.detail && (
                <span className="text-sm text-neutre">{progression.detail}</span>
              )}
            </li>
          ))}
        </ol>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-neutre-doux"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement de l’analyse"
        >
          <div className="h-full bg-acquis transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-neutre">
          Objectif : moins de 10 secondes entre ta dernière lecture et le diagnostic.
        </p>
      </div>
    </div>
  );
}
