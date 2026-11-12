import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodePhoneme } from '../types';
import { DUREE_MAX_MS, DUREE_MIN_MS } from '../constants';
import { CaptureMicro, depuisFichier, oublier, type Enregistrement as Prise } from '../audio/capture';
import Waveform, { niveauVersAmplitude } from '../audio/waveform';
import { diagnostiquerErreur } from '../audio/permissions';
import MicroEtat from '../components/MicroEtat';
import { verdictQualite } from '../audio/quality';
import type { Lecture } from '../engine/pipeline';
import Entete from '../components/Entete';

/**
 * Écran 2 — Enregistrement : gros bouton, niveau en direct, minuteur, aperçu
 * avant envoi (RF-02). Trois lectures pour conclure, une seule en mode essai
 * rapide (ACCENT.md §18.4) — et l'écran le dit.
 */

export interface Props {
  phrase: string;
  lecturesDemandees: number;
  cible: CodePhoneme | null;
  onLectures: (l: Lecture[]) => void;
  onAnnuler: () => void;
}

type Phase = 'pret' | 'enCours' | 'apercu';

export default function Enregistrement({ phrase, lecturesDemandees, cible, onLectures, onAnnuler }: Props) {
  const [phase, setPhase] = useState<Phase>('pret');
  const [historique, setHistorique] = useState<number[]>([]);
  const [duree, setDuree] = useState(0);
  const [prises, setPrises] = useState<Lecture[]>([]);
  const [apercu, setApercu] = useState<Prise | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailMicro, setDetailMicro] = useState<string | null>(null);
  const capture = useRef<CaptureMicro | null>(null);

  useEffect(() => () => { capture.current?.annuler(); if (apercu) oublier(apercu); }, [apercu]);

  /** Le niveau arrive à ~60 fps : on garde une fenêtre glissante de 40 barres. */
  const surNiveau = useCallback((rms: number) => {
    setHistorique((h) => {
      const suivant = h.length >= 40 ? h.slice(h.length - 39) : h.slice();
      suivant.push(niveauVersAmplitude(rms));
      return suivant;
    });
  }, []);

  const demarrer = useCallback(async () => {
    setMessage(null);
    try {
      const c = new CaptureMicro();
      capture.current = c;
      await c.demarrer({ onNiveau: surNiveau, onDuree: setDuree });
      setPhase('enCours');
    } catch (e) {
      // Dire POURQUOI le navigateur n'a rien demandé : matériel absent, accès
      // bloqué, micro occupé… chaque cause a son conseil (audio/permissions.ts).
      const d = diagnostiquerErreur(e);
      setMessage(d.message);
      setDetailMicro(d.conseil);
      setPhase('pret');
    }
  }, [surNiveau]);

  const valider = useCallback(
    (p: Prise) => {
      const verdict = verdictQualite(p.qualite);
      if (!verdict.ok) {
        setMessage(verdict.message);
        oublier(p);
        setApercu(null);
        setPhase('pret');
        return;
      }
      const suivantes = [...prises, { audio: p.wav, dureeMs: p.dureeMs }];
      setPrises(suivantes);
      oublier(p);
      setApercu(null);
      if (suivantes.length >= lecturesDemandees) {
        onLectures(suivantes);
        return;
      }
      setMessage(null);
      setPhase('pret');
    },
    [prises, lecturesDemandees, onLectures],
  );

  const arreter = useCallback(async () => {
    const c = capture.current;
    if (!c) return;
    const prise = await c.arreter();
    capture.current = null;
    setApercu(prise);
    setHistorique([]);
    setPhase('apercu');
  }, []);

  const surFichier = useCallback(async (f: File | null) => {
    if (!f) return;
    valider(await depuisFichier(f));
  }, [valider]);

  const secondes = Math.min(DUREE_MAX_MS, duree) / 1000;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-6 px-4 py-6">
      <Entete onAccueil={onAnnuler} />
      <div className="carte flex flex-col gap-5">
        <p className="text-sm uppercase tracking-wide text-neutre">
          Lecture {Math.min(prises.length + 1, lecturesDemandees)} / {lecturesDemandees}
          {cible ? ` — même son, même mot` : ''}
        </p>
        {lecturesDemandees === 1 && (
          <p className="text-sm text-aTravailler" role="status">
            Mode essai rapide : une seule lecture, mesure moins fiable. Trois
            lectures donnent un score de référence (médiane).
          </p>
        )}
        <p className="text-2xl leading-snug" lang="en">{phrase}</p>

        <div className="text-acquis" aria-hidden="true">
          <Waveform
            pcm={new Float32Array(historique)}
            barres={40}
            hauteur={72}
            label="Niveau du micro en direct"
          />
        </div>

        <p className="text-center text-4xl tabular-nums" aria-live="off">{secondes.toFixed(1)} s</p>

        <div className="flex flex-col items-center gap-3">
          {phase !== 'enCours' && (
            <button type="button" className="bouton-primaire text-lg" onClick={demarrer} disabled={phase === 'apercu'}>
              Enregistrer ma lecture
            </button>
          )}
          {phase === 'enCours' && (
            <button type="button" className="bouton-secondaire text-lg" onClick={arreter}>
              Terminer ({secondes.toFixed(1)} s)
            </button>
          )}
          {phase === 'apercu' && apercu && (
            <div className="flex flex-wrap justify-center gap-3">
              <audio controls src={apercu.apercuUrl} className="w-full" aria-label="Écouter mon enregistrement" />
              <button type="button" className="bouton-primaire" onClick={() => valider(apercu)}>
                C’est bon, analyser
              </button>
              <button type="button" className="bouton-secondaire" onClick={() => { oublier(apercu); setApercu(null); setPhase('pret'); }}>
                Refaire
              </button>
            </div>
          )}
          <label className="bouton-fantome text-sm">
            Micro indisponible ? Téléverser un fichier
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => void surFichier(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {message && (
          <div className="text-center" role="status">
            <p className="text-aTravailler">{message}</p>
            {detailMicro && <p className="mt-1 text-sm text-neutre">{detailMicro}</p>}
          </div>
        )}
        <MicroEtat />
        <p className="text-center text-sm text-neutre">
          Entre {DUREE_MIN_MS / 1000} et {DUREE_MAX_MS / 1000} s. L’audio n’est jamais enregistré :
          il est supprimé dès l’analyse.
        </p>
      </div>
    </div>
  );
}
