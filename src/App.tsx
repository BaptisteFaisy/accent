import { useCallback, useMemo, useState } from 'react';
import type { CodePhoneme, Diagnostic, ProgressionPipeline, Session } from './types';
import { PHRASES_PRETES } from './data/phrases';
import { ajouterPreuve, toutSupprimerDonneesLocales } from './store/preuves';
import { phrasesPour } from './data/training';
import { executerPipeline, type Lecture, type ResultatPipeline } from './engine/pipeline';
import { fournisseurSelonReglages, repliSurDemo } from './providers';
import { chargerReglages, enregistrerReglages, type Reglages } from './store/settings';
import {
  ajouterSession,
  chargerProfil,
  consignerScore,
  enregistrerProfil,
  exporterMarkdown,
  toutEffacer,
} from './store/profile';
import Accueil from './screens/Accueil';
import Enregistrement from './screens/Enregistrement';
import Analyse from './screens/Analyse';
import DiagnosticVue from './screens/Diagnostic';
import Comparaison from './screens/Comparaison';
import Entrainement from './screens/Entrainement';
import ProfilVue from './screens/Profil';
import ReglagesVue from './screens/Reglages';
import Donnees from './screens/Donnees';
import Perception from './screens/Perception';
import OralLong from './screens/OralLong';
import Catalogue from './screens/Catalogue';

export type Vue =
  | 'accueil'
  | 'enregistrement'
  | 'analyse'
  | 'diagnostic'
  | 'comparaison'
  | 'entrainement'
  | 'perception'
  | 'catalogue'
  | 'oralLong'
  | 'profil'
  | 'donnees'
  | 'reglages';

/** Le produit tient dans une machine à états : une seule cible à la fois. */
export default function App() {
  const [vue, setVue] = useState<Vue>('accueil');
  const [phrase, setPhrase] = useState(PHRASES_PRETES[0]);
  const [reglages, setReglages] = useState<Reglages>(chargerReglages);
  const [profil, setProfil] = useState(chargerProfil);
  const [progression, setProgression] = useState<ProgressionPipeline | null>(null);
  const [resultat, setResultat] = useState<ResultatPipeline | null>(null);
  const [avant, setAvant] = useState<Diagnostic | null>(null);
  const [forcer, setForcer] = useState<CodePhoneme | null>(null);
  /** Son choisi depuis le catalogue (sans diagnostic préalable). */
  const [codeChoisi, setCodeChoisi] = useState<CodePhoneme | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const fournisseur = useMemo(() => fournisseurSelonReglages(reglages), [reglages]);

  const memoriser = useCallback(
    (r: ResultatPipeline) => {
      const cible = r.diagnostic.cible;
      if (!cible) return;
      const suivant = consignerScore(profil, cible.code, cible.score);
      setProfil(suivant);
      enregistrerProfil(suivant);
      ajouterPreuve(
        'profil',
        `Profil mis à jour : /${cible.entree.ipa}/`,
        [
          `score retenu : ${cible.score} (sur 100)`,
          `meilleur score pour ce son : ${suivant.parPhoneme[cible.code]?.meilleur ?? cible.score}`,
          `${suivant.parPhoneme[cible.code]?.tentatives ?? 1} essai(s) au total`,
          cible.score >= 80 ? 'son marqué acquis' : 'son encore à travailler',
        ],
        'src/store/profile.ts · src/engine/selectTarget.ts',
      );
      const session: Session = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        langueCible: reglages.langueCible,
        phrase,
        cible: cible.code,
        scores: r.diagnostic.scores,
      };
      ajouterSession(session);
    },
    [profil, phrase, reglages.langueCible],
  );

  const analyser = useCallback(
    async (lectures: Lecture[]) => {
      setVue('analyse');
      setErreur(null);
      setProgression(null);
      try {
        let r = await executerPipeline({
          phrase,
          langueCible: reglages.langueCible,
          lectures,
          fournisseur,
          profil,
          forcerCible: forcer,
          onProgress: setProgression,
        });
        if (r.provider === 'proxy' && !r.diagnostic.cible && r.diagnostic.etat === 'erreur') {
          r = await executerPipeline({
            phrase,
            langueCible: reglages.langueCible,
            lectures,
            fournisseur: repliSurDemo(),
            profil,
            forcerCible: forcer,
            onProgress: setProgression,
          });
        }
        setResultat(r);
        memoriser(r);
        // PREUVE : d'où vient le chiffre, sur quelles lectures, et ce qu'il ne dit pas.
        const m = r.diagnostic.mesure;
        const c = r.diagnostic.cible;
        ajouterPreuve(
          'analyse',
          c
            ? `Diagnostic : /${c.entree.ipa}/ dans « ${c.mot} »`
            : `Diagnostic : ${r.diagnostic.message}`,
          [
            m && m.lectures > 1
              ? `${m.lectures} lectures consolidées : ${m.valeurs.join(', ')} → médiane ${m.mediane} (écart ${m.ecart})`
              : 'une seule lecture (mode essai rapide)',
            `source : ${r.provider}${r.simule ? ' — simulation locale, badge affiché' : ''}`,
            'aucun score global calculé, aucun classement (garde-fou §10)',
          ],
          'src/engine/measure.ts · src/engine/selectTarget.ts',
        );
        setVue(avant ? 'comparaison' : 'diagnostic');
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Erreur inattendue');
        setVue('diagnostic');
      }
    },
    [phrase, reglages.langueCible, fournisseur, profil, forcer, avant, memoriser],
  );

  const relancer = useCallback(() => {
    const avantScore = resultat?.diagnostic.cible?.score ?? null;
    setAvant(resultat?.diagnostic ?? null);
    setForcer(resultat?.diagnostic.cible?.code ?? null);
    if (avantScore !== null) {
      ajouterPreuve(
        'comparaison',
        'Nouvelle prise demandée sur le même son',
        [
          `même phrase : « ${phrase.slice(0, 60)} »`,
          `score de la prise précédente : ${avantScore}`,
          'mêmes conditions de mesure (mêmes lectures, même médiane)',
        ],
        'src/engine/measure.ts',
      );
    }
    setVue('enregistrement');
  }, [resultat, phrase]);

  const reinitialiser = useCallback(() => {
    setAvant(null);
    setForcer(null);
    setResultat(null);
    setErreur(null);
    setVue('accueil');
  }, []);

  const majReglages = useCallback((r: Reglages) => {
    setReglages(r);
    enregistrerReglages(r);
  }, []);

  /**
   * Travailler un son choisi au catalogue, sans diagnostic préalable : on impose
   * une phrase d'entraînement de ce son et on force la cible (§17 : une session,
   * un seul phonème).
   */
  const lancerTravail = useCallback(
    (code: CodePhoneme) => {
      const phrases = phrasesPour(code, reglages.langueCible);
      setPhrase(phrases[0]?.texte ?? PHRASES_PRETES[0]);
      setForcer(code);
      setCodeChoisi(code);
      setAvant(null);
      setResultat(null);
      setVue('enregistrement');
    },
    [reglages.langueCible],
  );

  if (vue === 'enregistrement') {
    return (
      <Enregistrement
        phrase={phrase}
        lecturesDemandees={reglages.lectures}
        cible={forcer}
        onLectures={(l) => void analyser(l)}
        onAnnuler={() => setVue(avant ? 'diagnostic' : 'accueil')}
      />
    );
  }

  if (vue === 'analyse') return <Analyse progression={progression} />;

  if (vue === 'diagnostic' && resultat) {
    return (
      <DiagnosticVue
        phrase={phrase}
        resultat={resultat}
        erreur={erreur}
        onReessayer={relancer}
        onEntrainement={() => setVue('entrainement')}
        onAccueil={reinitialiser}
        onPerception={() => setVue('perception')}
      />
    );
  }

  if (vue === 'comparaison' && resultat && avant) {
    return (
      <Comparaison
        avant={avant}
        apres={resultat.diagnostic}
        onEntrainement={() => setVue('entrainement')}
        onAccueil={reinitialiser}
      />
    );
  }

  if (vue === 'entrainement' && resultat?.diagnostic.cible) {
    return (
      <Entrainement
        cible={resultat.diagnostic.cible}
        phrases={resultat.phrases}
        onPhrase={(p) => {
          setPhrase(p);
          setForcer(resultat.diagnostic.cible?.code ?? null);
          setAvant(resultat.diagnostic);
          ajouterPreuve(
            'entrainement',
            `Phrase d'entraînement lancée : « ${p.slice(0, 60)} »`,
            [
              `son visé : /${resultat.diagnostic.cible?.entree.ipa ?? '?'}/`,
              `${resultat.phrases.length} phrases disponibles pour ce son`,
              'la prise suivante sera analysée comme les autres',
            ],
            'src/data/training.ts · src/engine/pipeline.ts',
          );
          setVue('enregistrement');
        }}
        onQuitter={reinitialiser}
        onPerception={() => setVue('perception')}
      />
    );
  }

  const codePerception = resultat?.diagnostic.cible?.code ?? codeChoisi;
  if (vue === 'perception' && codePerception) {
    const depuisDiagnostic = Boolean(resultat?.diagnostic.cible);
    return (
      <Perception
        code={codePerception}
        langue={reglages.langueCible}
        onQuitter={() => setVue(depuisDiagnostic ? 'diagnostic' : 'catalogue')}
        onTravailler={() => (depuisDiagnostic ? setVue('entrainement') : lancerTravail(codePerception))}
      />
    );
  }

  if (vue === 'catalogue') {
    return (
      <Catalogue
        langue={reglages.langueCible}
        profil={profil}
        onPerception={(code) => {
          setCodeChoisi(code);
          setVue('perception');
        }}
        onTravailler={lancerTravail}
        onRetour={() => setVue('accueil')}
      />
    );
  }

  if (vue === 'oralLong') {
    return (
      <OralLong
        langue={reglages.langueCible}
        fournisseur={fournisseur}
        profil={profil}
        onQuitter={() => setVue('accueil')}
        onPhrase={(texte, cible) => {
          setPhrase(texte);
          setForcer(cible);
          setAvant(null);
          setResultat(null);
          setVue('enregistrement');
        }}
      />
    );
  }

  if (vue === 'profil') {
    return (
      <ProfilVue
        profil={profil}
        langue={reglages.langueCible}
        onRetour={() => setVue('accueil')}
        onCatalogue={() => setVue('catalogue')}
        onPerception={(code) => {
          setCodeChoisi(code);
          setVue('perception');
        }}
        onTravailler={lancerTravail}
        onEffacer={() => {
          toutEffacer();
          toutSupprimerDonneesLocales();
          setProfil(chargerProfil());
        }}
        onExporter={() => exporterMarkdown(profil, reglages.langueCible)}
      />
    );
  }

  if (vue === 'donnees') {
    return (
      <Donnees
        profil={profil}
        onRetour={() => setVue('accueil')}
        onExporter={() => exporterMarkdown(profil, reglages.langueCible)}
        onEffacer={() => {
          toutEffacer();
          toutSupprimerDonneesLocales();
          setProfil(chargerProfil());
        }}
      />
    );
  }

  if (vue === 'reglages') {
    return (
      <ReglagesVue
        reglages={reglages}
        onEnregistrer={(r) => {
          majReglages(r);
          setVue('accueil');
        }}
        onRetour={() => setVue('accueil')}
      />
    );
  }

  return (
    <Accueil
      phrase={phrase}
      phrasesPretes={PHRASES_PRETES}
      langueCible={reglages.langueCible}
      fournisseur={fournisseur.label}
      onPhrase={setPhrase}
      onLangue={(l) => majReglages({ ...reglages, langueCible: l })}
      onDemarrer={() => {
        setAvant(null);
        setForcer(null);
        setResultat(null);
        setVue('enregistrement');
      }}
      onProfil={() => setVue('profil')}
      onReglages={() => setVue('reglages')}
      onDonnees={() => setVue('donnees')}
      onOralLong={() => setVue('oralLong')}
      onCatalogue={() => setVue('catalogue')}
    />
  );
}
