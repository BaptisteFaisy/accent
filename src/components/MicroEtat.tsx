import { useCallback, useEffect, useState } from 'react';
import {
  demanderMicro,
  diagnostiquerMicro,
  type DiagnosticMicro,
} from '../audio/permissions';

/**
 * État du micro, visible AVANT d'enregistrer.
 *
 * Le navigateur ne montre sa fenêtre d'autorisation que si un micro existe et
 * que le contexte est sécurisé. Quand ce n'est pas le cas, il ne se passe rien
 * de visible — l'élève croit que l'app est cassée. Ce composant dit ce qui
 * manque et quoi faire, et propose une demande explicite d'accès.
 */

export interface Props {
  /** Panneau détaillé (Réglages → « Tester mon micro »). */
  detaille?: boolean;
  /** Prévenu quand le micro devient utilisable. */
  onPret?: (d: DiagnosticMicro) => void;
  className?: string;
}

const LIBELLES: Record<DiagnosticMicro['permission'], string> = {
  granted: 'autorisé',
  denied: 'bloqué par le navigateur',
  prompt: 'pas encore demandé',
  inconnu: 'état inconnu',
};

export default function MicroEtat({ detaille = false, onPret, className = '' }: Props) {
  const [etat, setEtat] = useState<DiagnosticMicro | null>(null);
  const [enCours, setEnCours] = useState(false);

  const tester = useCallback(async () => {
    const d = await diagnostiquerMicro();
    setEtat(d);
    if (!d.bloquant) onPret?.(d);
    return d;
  }, [onPret]);

  useEffect(() => {
    void tester();
  }, [tester]);

  const demander = async () => {
    setEnCours(true);
    const d = await demanderMicro();
    setEtat(d);
    setEnCours(false);
    if (!d.bloquant) onPret?.(d);
  };

  if (!etat) return null;
  if (!etat.bloquant && !detaille) {
    // Micro utilisable et pas de panneau demandé : rien à signaler.
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-aTravailler/40 bg-aTravailler-doux p-3 ${className}`}
      role="status"
    >
      <p className="text-base font-medium text-aTravailler">{etat.message}</p>
      <p className="text-sm text-neutre">{etat.conseil}</p>

      {etat.bloquant && etat.etat !== 'insecure' && etat.etat !== 'api-absente' && (
        <button
          type="button"
          className="bouton-secondaire self-start"
          onClick={() => void demander()}
          disabled={enCours}
        >
          {enCours ? 'Le navigateur attend ton autorisation…' : 'Demander l’accès au micro'}
        </button>
      )}

      {detaille && (
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutre">
          <div className="flex gap-1">
            <dt>Permission :</dt>
            <dd>{LIBELLES[etat.permission]}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Entrées audio vues :</dt>
            <dd>{etat.entrees}</dd>
          </div>
          <div className="flex gap-1">
            <dt>HTTPS :</dt>
            <dd>{etat.etat === 'insecure' ? 'non' : 'oui'}</dd>
          </div>
          <button type="button" className="bouton-fantome text-sm" onClick={() => void tester()}>
            Re-tester
          </button>
        </dl>
      )}
    </div>
  );
}
