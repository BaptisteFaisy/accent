import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { CodePhoneme, FournisseurPrononciation, LangueCible, Profil } from '../types';
import { DUREE_MAX_MS } from '../constants';
import { PHONEMES } from '../data/phonemes';
import { CaptureMicro, depuisFichier, oublier, type Enregistrement as Prise } from '../audio/capture';
import { verdictQualite } from '../audio/quality';
import Waveform, { niveauVersAmplitude } from '../audio/waveform';
import { diagnostiquerErreur } from '../audio/permissions';
import MicroEtat from '../components/MicroEtat';
import { executerPipeline } from '../engine/pipeline';
import {
  bilanParPhrase,
  decouper,
  etatAvancement,
  prochainePhrase,
  type EtatSegment,
  type ResultatPhrase,
} from '../engine/segments';
import Entete from '../components/Entete';

/**
 * RF-21 — Mode oral long : l'élève colle SON texte (exposé, entretien, sujet de
 * bac), l'app le découpe en phrases et le guide phrase par phrase.
 *
 * Deux vitesses assumées :
 *  - **passage rapide** : une lecture par phrase, pour balayer tout l'oral en
 *    quelques minutes (l'écran le dit — §18.4 : le mode essai rapide est signalé) ;
 *  - **mode précis** : une phrase est renvoyée vers le parcours classique, avec
 *    les 3 lectures réglementaires et la médiane.
 *
 * Le bilan final est une liste phrase par phrase + les sons qui reviennent.
 * Jamais de moyenne, jamais de score global.
 */

export interface Props {
  texteInitial?: string;
  langue: LangueCible;
  fournisseur: FournisseurPrononciation;
  profil?: Profil | null;
  onQuitter: () => void;
  /** Renvoyer une phrase vers le parcours classique (3 lectures, diagnostic complet). */
  onPhrase?: (texte: string, cible: CodePhoneme | null) => void;
}

type Phase = 'saisie' | 'lecture' | 'analyse' | 'resultat' | 'bilan';

export default function OralLong(props: Props) {
  const { texteInitial = '', langue, fournisseur, profil = null, onQuitter, onPhrase } = props;
  const [texte, setTexte] = useState(texteInitial);
  const [segments, setSegments] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [faits, setFaits] = useState<Record<number, EtatSegment>>({});
  const [resultats, setResultats] = useState<ResultatPhrase[]>([]);
  const [phase, setPhase] = useState<Phase>('saisie');
  const [message, setMessage] = useState<string | null>(null);
  const [niveaux, setNiveaux] = useState<number[]>([]);
  const [detailMicro, setDetailMicro] = useState<string | null>(null);
  const capture = useMemo(() => new CaptureMicro(), []);

  useEffect(() => () => capture.annuler(), [capture]);

  const phrases = useMemo(() => decouper(texte), [texte]);
  const courant = resultats.find((r) => r.index === index) ?? null;
  const bilan = useMemo(() => bilanParPhrase(resultats), [resultats]);
  const suivi = useMemo(() => etatAvancement(segments, index, faits), [segments, index, faits]);

  const demarrer = useCallback(() => {
    const s = decouper(texte);
    setSegments(s);
    setIndex(0);
    setFaits({});
    setResultats([]);
    setMessage(s.length > 0 ? null : 'Aucune phrase détectée : colle un texte à lire.');
    setPhase(s.length > 0 ? 'lecture' : 'saisie');
  }, [texte]);

  const analyser = useCallback(
    async (prise: Prise) => {
      const verdict = verdictQualite(prise.qualite);
      if (!verdict.ok) {
        oublier(prise);
        setMessage(verdict.message);
        setPhase('lecture');
        return;
      }
      setMessage(null);
      setPhase('analyse');
      try {
        const r = await executerPipeline({
          phrase: segments[index],
          langueCible: langue,
          lectures: [{ audio: prise.wav, dureeMs: prise.dureeMs }],
          fournisseur,
          profil,
        });
        setResultats((avant) => [
          ...avant.filter((x) => x.index !== index),
          resultatDe(index, segments[index], r.diagnostic.cible?.code ?? null,
            r.diagnostic.cible?.score ?? null, r.diagnostic.etat),
        ]);
        setFaits((f) => ({ ...f, [index]: 'fait' }));
        setPhase('resultat');
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Analyse impossible sur cette phrase.');
        setPhase('lecture');
      } finally {
        oublier(prise);
      }
    },
    [segments, index, langue, fournisseur, profil],
  );

  const suivant = useCallback(() => {
    const suite = prochainePhrase(segments, faits);
    if (suite === null) {
      setPhase('bilan');
      return;
    }
    setIndex(suite);
    setPhase('lecture');
  }, [segments, faits]);

  const sauter = useCallback(() => {
    setFaits((f) => ({ ...f, [index]: 'saute' }));
    setResultats((avant) => [
      ...avant.filter((x) => x.index !== index),
      resultatDe(index, segments[index], null, null, 'erreur'),
    ]);
    suivant();
  }, [index, segments, suivant]);

  if (phase === 'saisie') {
    return (
      <Cadre onQuitter={onQuitter}>
        <h1 className="text-2xl font-semibold">Ton oral, phrase par phrase</h1>
        <p className="text-neutre">
          Colle le texte que tu dois vraiment dire — exposé, entretien, sujet de bac.
          Il est découpé en phrases, et tu les travailles une par une.
        </p>
        <textarea
          className="min-h-48 w-full resize-y rounded-xl border border-nuit-bord bg-nuit p-4 text-lg
            focus:border-acquis focus:outline-none"
          value={texte}
          lang={langue}
          aria-label="Texte de ton oral"
          onChange={(e) => setTexte(e.target.value)}
        />
        <p className="text-sm text-neutre" aria-live="polite">
          {phrases.length} phrase{phrases.length > 1 ? 's' : ''} détectée{phrases.length > 1 ? 's' : ''}
          {phrases.length >= 40 ? ' — plafond de 40 atteint, la fin sera regroupée' : ''}
        </p>
        {message && <p className="text-aTravailler" role="status">{message}</p>}
        <button type="button" className="bouton-primaire" onClick={demarrer}>Commencer</button>
      </Cadre>
    );
  }

  if (phase === 'bilan') {
    return (
      <Bilan
        bilan={bilan}
        langue={langue}
        onReprendre={() => setPhase('lecture')}
        onQuitter={onQuitter}
      />
    );
  }

  return (
    <Cadre onQuitter={onQuitter}>
      <FilAriane suivi={suivi} onAller={(i) => { setIndex(i); setPhase('lecture'); }} />
      <p className="text-sm uppercase tracking-wide text-neutre">
        Phrase {index + 1} / {segments.length} · passage rapide, une lecture
      </p>
      <p className="text-xl leading-relaxed" lang={langue}>{segments[index]}</p>

      {phase === 'analyse' && <p className="text-neutre" role="status">Analyse en cours…</p>}

      {phase === 'lecture' && (
        <div className="flex flex-col gap-3">
          <div className="text-acquis" aria-hidden="true">
            <Waveform pcm={new Float32Array(niveaux)} barres={40} hauteur={64} label="Niveau du micro" />
          </div>
          <BoutonMicro
            capture={capture}
            onNiveaux={setNiveaux}
            onFin={(p) => void analyser(p)}
            onErreur={(m, c) => {
              setMessage(m);
              setDetailMicro(c);
            }}
          />
          {message && (
            <div role="status">
              <p className="text-aTravailler">{message}</p>
              {detailMicro && <p className="mt-1 text-sm text-neutre">{detailMicro}</p>}
            </div>
          )}
          <MicroEtat />
        </div>
      )}

      {phase === 'resultat' && courant && (
        <Resultat
          r={courant}
          langue={langue}
          onSuivant={suivant}
          onRefaire={() => setPhase('lecture')}
          onPrecis={onPhrase ? () => onPhrase(courant.texte, courant.cible) : undefined}
        />
      )}

      <div className="flex flex-wrap gap-3 border-t border-nuit-bord pt-3">
        <button type="button" className="bouton-fantome" onClick={sauter} disabled={phase === 'analyse'}>
          Passer cette phrase
        </button>
        <button type="button" className="bouton-fantome" onClick={() => setPhase('bilan')}>
          Voir le bilan
        </button>
      </div>
      <p className="text-sm text-neutre">
        Ta voix n’est jamais conservée : chaque phrase est analysée puis oubliée.
      </p>
    </Cadre>
  );
}

function resultatDe(
  index: number,
  texte: string,
  cible: CodePhoneme | null,
  score: number | null,
  etat: ResultatPhrase['etat'],
): ResultatPhrase {
  return { index, texte, cible, score, etat };
}

/** Cadre commun : entête + carte. */
function Cadre({ children, onQuitter }: { children: ReactNode; onQuitter: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onQuitter} />
      <div className="carte flex flex-col gap-4">{children}</div>
    </div>
  );
}

function FilAriane({
  suivi,
  onAller,
}: {
  suivi: Array<{ index: number; texte: string; etat: EtatSegment }>;
  onAller: (i: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Avancement dans le texte">
      {suivi.map((s) => (
        <li key={s.index}>
          <button
            type="button"
            onClick={() => onAller(s.index)}
            className={`h-3 w-6 rounded-full ${classeEtat(s.etat)}`}
            aria-label={`Phrase ${s.index + 1} : ${s.etat.replace('_', ' ')}`}
            title={s.texte.slice(0, 60)}
          />
        </li>
      ))}
    </ol>
  );
}

function classeEtat(etat: EtatSegment): string {
  if (etat === 'fait') return 'bg-acquis/70';
  if (etat === 'en_cours') return 'bg-aTravailler ring-2 ring-aTravailler/40';
  if (etat === 'saute') return 'bg-neutre/30';
  return 'bg-neutre-doux';
}

function BoutonMicro({
  capture,
  onNiveaux,
  onFin,
  onErreur,
}: {
  capture: CaptureMicro;
  onNiveaux: Dispatch<SetStateAction<number[]>>;
  onFin: (p: Prise) => void;
  onErreur: (message: string, conseil: string) => void;
}) {
  const [actif, setActif] = useState(false);
  const [secondes, setSecondes] = useState(0);

  const demarrer = async () => {
    onNiveaux([]);
    try {
      await capture.demarrer({
        onNiveau: (rms) =>
          onNiveaux((h) => {
            const suivant = h.length >= 40 ? h.slice(h.length - 39) : h.slice();
            suivant.push(niveauVersAmplitude(rms));
            return suivant;
          }),
        onDuree: (ms) => setSecondes(Math.min(DUREE_MAX_MS, ms) / 1000),
      });
      setActif(true);
    } catch (e) {
      setActif(false);
      const d = diagnostiquerErreur(e);
      onErreur(d.message, d.conseil);
    }
  };

  const arreter = async () => {
    const p = await capture.arreter();
    setActif(false);
    setSecondes(0);
    onFin(p);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {!actif ? (
        <button type="button" className="bouton-primaire" onClick={() => void demarrer()}>
          Enregistrer cette phrase
        </button>
      ) : (
        <button type="button" className="bouton-secondaire" onClick={() => void arreter()}>
          Terminer ({secondes.toFixed(1)} s)
        </button>
      )}
      <label className="bouton-fantome text-sm">
        Micro indisponible ? Téléverser un fichier
        <input
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onFin(await depuisFichier(f));
          }}
        />
      </label>
    </div>
  );
}

function Resultat({
  r,
  langue,
  onSuivant,
  onRefaire,
  onPrecis,
}: {
  r: ResultatPhrase;
  langue: LangueCible;
  onSuivant: () => void;
  onRefaire: () => void;
  onPrecis?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg">
        {r.cible ? (
          <>
            À travailler : <strong className="font-mono">/{PHONEMES[r.cible].ipa}/</strong>{' '}
            <span className="text-neutre">{PHONEMES[r.cible].label}</span>
          </>
        ) : r.etat === 'rien_a_corriger' ? (
          <span className="text-acquis">Rien à corriger sur cette phrase.</span>
        ) : (
          <span className="text-neutre">Pas de diagnostic sur cette phrase.</span>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="bouton-primaire" onClick={onSuivant}>Phrase suivante</button>
        <button type="button" className="bouton-secondaire" onClick={onRefaire}>Refaire</button>
        {onPrecis && (
          <button type="button" className="bouton-secondaire" onClick={onPrecis} lang={langue}>
            Travailler en mode précis
          </button>
        )}
      </div>
    </div>
  );
}

function Bilan({
  bilan,
  langue,
  onReprendre,
  onQuitter,
}: {
  bilan: ReturnType<typeof bilanParPhrase>;
  langue: LangueCible;
  onReprendre: () => void;
  onQuitter: () => void;
}) {
  return (
    <Cadre onQuitter={onQuitter}>
      <h1 className="text-2xl font-semibold">Bilan, phrase par phrase</h1>
      <p className="text-neutre">
        {bilan.phrases.length} phrase{bilan.phrases.length > 1 ? 's' : ''} ·{' '}
        {bilan.sansErreur} sans erreur · {bilan.sautees} sautée{bilan.sautees > 1 ? 's' : ''}.
        Aucune note globale.
      </p>
      <ul className="flex flex-col gap-2">
        {bilan.phrases.map((r) => (
          <li key={r.index} className="rounded-xl border border-nuit-bord px-3 py-2">
            <p className="text-base" lang={langue}>{r.texte}</p>
            <p className="text-sm text-neutre">{libelleBilan(r)}</p>
          </li>
        ))}
      </ul>
      {bilan.sonsRecurrents.length > 0 && (
        <div className="rounded-xl border border-aTravailler/40 bg-aTravailler-doux p-4">
          <h2 className="text-lg font-semibold text-aTravailler">Ce qui revient</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {bilan.sonsRecurrents.map(({ code, fois }) => (
              <li key={code} className="etiquette border-aTravailler/50 text-aTravailler">
                <span className="font-mono">/{PHONEMES[code].ipa}/</span>
                <span className="ml-2">{fois} phrases</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="bouton-secondaire" onClick={onReprendre}>Reprendre</button>
        <button type="button" className="bouton-fantome" onClick={onQuitter}>Terminer</button>
      </div>
    </Cadre>
  );
}

function libelleBilan(r: ResultatPhrase): string {
  if (r.cible) return `à travailler : /${PHONEMES[r.cible].ipa}/ (${PHONEMES[r.cible].label})`;
  if (r.etat === 'rien_a_corriger') return 'rien à corriger';
  return 'sautée';
}
