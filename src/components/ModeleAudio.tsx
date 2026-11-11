import { useEffect, useState } from 'react';
import type { LangueCible } from '../types';
import { arret, disponible, parler } from '../audio/tts';

/**
 * Écoute du modèle (RF-23) : l'élève compare son son au modèle, **ralenti**.
 *
 * Vitesse par défaut 0,75× : assez lent pour entendre l'articulation, assez
 * naturel pour ne pas déformer le phonème. Aucun fichier audio, aucune API :
 * `window.speechSynthesis` (0 $, bundle inchangé).
 */

export interface Props {
  texte: string;
  langue: LangueCible;
  /** Libellé du bouton (par défaut « Écouter le modèle »). */
  label?: string;
  vitesses?: number[];
  className?: string;
}

const VITESSES_DEFAUT = [0.5, 0.75, 1];

export default function ModeleAudio({
  texte,
  langue,
  label = 'Écouter le modèle',
  vitesses = VITESSES_DEFAUT,
  className = '',
}: Props) {
  const [vitesse, setVitesse] = useState(0.75);
  const [lecture, setLecture] = useState(false);
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    if (!disponible()) setIndisponible(true);
    return () => arret();
  }, []);

  const jouer = async () => {
    setLecture(true);
    try {
      await parler(texte, { langue, debit: vitesse });
    } catch {
      setIndisponible(true);
    } finally {
      setLecture(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        className="bouton-secondaire"
        onClick={() => void jouer()}
        disabled={indisponible || lecture || !texte.trim()}
        aria-label={`${label} : ${texte}`}
      >
        <span aria-hidden="true">{lecture ? '⏸' : '▶'}</span>
        {lecture ? 'Lecture…' : label}
      </button>

      <div className="flex items-center gap-1" role="group" aria-label="Vitesse du modèle">
        {vitesses.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVitesse(v)}
            aria-pressed={v === vitesse}
            className={`min-h-[48px] min-w-[48px] rounded-lg border px-2 text-sm tabular-nums ${
              v === vitesse
                ? 'border-acquis bg-acquis-doux text-acquis'
                : 'border-nuit-bord text-neutre hover:border-neutre/50'
            }`}
          >
            {v}×
          </button>
        ))}
      </div>

      {indisponible && (
        <p className="text-sm text-neutre" role="status">
          Synthèse vocale indisponible sur ce navigateur : le modèle ne peut pas être lu.
        </p>
      )}
    </div>
  );
}
