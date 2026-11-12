import type { ReactNode } from 'react';
import type { Cible, Mesure } from '../types';
import type { ResultatPipeline } from '../engine/pipeline';
import { expliquer, pairePour } from '../engine/explain';
import Entete from '../components/Entete';
import PhraseColoree from '../components/PhraseColoree';
import PaireMinimale from '../components/PaireMinimale';
import BarresSyllabes from '../components/BarresSyllabes';
import CompteurAnime from '../components/CompteurAnime';
import FourchetteScore from '../components/FourchetteScore';
import ModeleAudio from '../components/ModeleAudio';
import Preuve from '../components/Preuve';
import SchemaArticulatoire from '../components/SchemaArticulatoire';

/**
 * Écran 4 — Diagnostic : le plan clé de la vidéo (ACCENT.md §6, 1:05-1:30).
 *
 * Hiérarchie imposée par §21 : UN seul chiffre à l'écran, le phonème en héros,
 * jamais de rouge pour un son, jamais de tableau de scores. Les états
 * « rien à corriger » (RNF-04) et « mesure instable » (RNF-11) ont leur propre
 * mise en page : on n'affiche pas un chiffre qu'on ne sait pas tenir.
 */

export interface Props {
  phrase: string;
  resultat: ResultatPipeline | null;
  erreur: string | null;
  onReessayer: () => void;
  onEntrainement: () => void;
  onAccueil: () => void;
  /** Optionnel : ouvre le mode « perception avant production » sur la cible. */
  onPerception?: () => void;
}

/** Indice à surligner dans la paire minimale : le son fautif, en lettres. */
function indicePaire(cible: Cible): string | undefined {
  const map: Record<string, string> = {
    'θ': 'th', 'ð': 'th', 'h': 'h', 'ɪ': 'i', 'æ': 'a', 'ʌ': 'u',
    'ɹ': 'r', 'ŋ': 'ng', 'v': 'v', 'dʒ': 'j', 'ə': 'a', 'b': 'b', 'st': 'st', 'ʊ': 'oo',
  };
  return map[cible.entree.ipa];
}

function CarteEtat({
  titre,
  ton,
  message,
  children,
}: {
  titre: string;
  ton: 'acquis' | 'aTravailler' | 'erreur';
  message: string;
  children?: ReactNode;
}) {
  const couleur =
    ton === 'acquis' ? 'text-acquis' : ton === 'erreur' ? 'text-erreur' : 'text-aTravailler';
  const bord = ton === 'erreur' ? 'border-erreur/40' : 'border-nuit-bord';
  return (
    <div className={`carte flex flex-col items-center gap-4 text-center ${bord}`}>
      <h1 className={`text-2xl font-semibold sm:text-3xl ${couleur}`}>{titre}</h1>
      <p className="max-w-prose text-lg text-neutre">{message}</p>
      {children}
    </div>
  );
}

function CoeurDiagnostic({ cible, mesure }: { cible: Cible; mesure: Mesure | null }) {
  const exp = expliquer(cible);
  const paire = pairePour(cible);
  return (
    <div className="carte flex flex-col items-center gap-5 text-center">
      <p className="etiquette">Le son à travailler — un seul</p>

      <p className="phoneme-heros" aria-label={`phonème cible ${cible.entree.ipa}`}>
        /{cible.entree.ipa}/
      </p>

      <p className="text-xl leading-snug">
        dans <strong lang="en">{cible.mot}</strong>
        {exp.ipaProduit ? (
          <>
            {' '}→ sorti comme <strong className="text-aTravailler">/{exp.ipaProduit}/</strong>
          </>
        ) : (
          <> → {cible.entree.signature}</>
        )}
      </p>

      <p className="text-6xl font-semibold" aria-label={`score du phonème : ${cible.score} sur 100`}>
        <CompteurAnime valeur={cible.score} depuis={0} dureeMs={700} suffixe=" /100" />
      </p>

      {mesure ? (
        <FourchetteScore
          mediane={cible.score}
          min={cible.fourchette?.min ?? cible.score}
          max={cible.fourchette?.max ?? cible.score}
          lectures={mesure.lectures}
          auBordDuSeuil={cible.auBordDuSeuil}
        />
      ) : null}

      {exp.positionnel && cible.entree.accentuation ? (
        <BarresSyllabes mots={cible.entree.accentuation} />
      ) : (
        paire && <PaireMinimale paire={paire} indice={indicePaire(cible)} cible={cible.mot} />
      )}

      <ModeleAudio texte={cible.mot} langue={cible.entree.langueCible} label="Écouter le mot" />

      {!exp.positionnel && <SchemaArticulatoire code={cible.code} />}

      <p className="max-w-prose text-base text-neutre">{cible.entree.conseil}</p>
      <p className="text-sm text-neutre" aria-hidden="true">
        {'★'.repeat(cible.entree.difficulte)}
        {'☆'.repeat(3 - cible.entree.difficulte)} · {cible.occurrences} occurrence
        {cible.occurrences > 1 ? 's' : ''} dans ta phrase
      </p>
    </div>
  );
}

/** P14 (accent de mot) n'a pas de paire minimale : pas d'exercice d'écoute. */
function exp_positionnel(cible: Cible): boolean {
  return cible.entree.nature === 'positionnel';
}

export default function DiagnosticVue({
  phrase,
  resultat,
  erreur,
  onReessayer,
  onEntrainement,
  onAccueil,
  onPerception,
}: Props) {
  if (!resultat && !erreur) return null;
  const d = resultat?.diagnostic ?? null;
  const cible = d?.cible ?? null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <Entete onAccueil={onAccueil} />

      {erreur && (
        <CarteEtat titre="Je n’ai pas pu mesurer cette lecture" ton="erreur" message={erreur}>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" className="bouton-secondaire" onClick={onReessayer}>Réessayer</button>
            <button type="button" className="bouton-fantome" onClick={onAccueil}>Changer de phrase</button>
          </div>
        </CarteEtat>
      )}

      {d && (
        <section className="carte flex flex-col gap-3" aria-label="Ta phrase, mot par mot">
          <PhraseColoree phrase={phrase} scores={d.scores} motCible={cible?.mot} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutre">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-acquis" aria-hidden="true" /> acquis
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-aTravailler" aria-hidden="true" /> à travailler
            </span>
            {resultat?.simule && (
              <span className="etiquette ml-auto border-aTravailler/50 text-aTravailler">
                Mode démonstration — mesure simulée, pas une évaluation réelle
              </span>
            )}
          </div>
        </section>
      )}

      {d?.etat === 'rien_a_corriger' && (
        <CarteEtat titre="Rien à corriger sur cette phrase" ton="acquis" message={d.message}>
          <button type="button" className="bouton-primaire" onClick={onAccueil}>
            Prendre une phrase plus difficile
          </button>
        </CarteEtat>
      )}

      {d?.etat === 'instable' && (
        <CarteEtat titre="Mesure instable" ton="aTravailler" message={d.message}>
          <p className="text-sm text-neutre">
            On préfère ne rien afficher plutôt que t’indiquer un chiffre faux.
          </p>
          <button type="button" className="bouton-primaire" onClick={onReessayer}>Réessayer</button>
        </CarteEtat>
      )}

      {d && (d.etat === 'trop_court' || d.etat === 'trop_bruyant' || d.etat === 'erreur') && !erreur && (
        <CarteEtat titre="Lecture inexploitable" ton="aTravailler" message={d.message}>
          <button type="button" className="bouton-primaire" onClick={onReessayer}>Réessayer</button>
        </CarteEtat>
      )}

      {cible && <CoeurDiagnostic cible={cible} mesure={d?.mesure ?? null} />}

      {cible && (
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="bouton-primaire" onClick={onReessayer}>
            Réessayer ce mot
          </button>
          <button type="button" className="bouton-secondaire" onClick={onEntrainement}>
            Travailler ce son
          </button>
          {onPerception && !exp_positionnel(cible) && (
            <button type="button" className="bouton-secondaire" onClick={onPerception}>
              Entraîner mon oreille d’abord
            </button>
          )}
          <button type="button" className="bouton-fantome" onClick={onAccueil}>
            Autre phrase
          </button>
        </div>
      )}

      <Preuve etape="analyse" />

      <p className="text-center text-sm text-neutre">
        Pas de note globale, pas de classement : un son, à un instant donné.
      </p>
    </div>
  );
}
