import { useCallback, useMemo, useState } from 'react';
import type { CodePhoneme, Diagnostic, ProgressionPipeline, Session } from './types';
import { PHRASES_PRETES } from './data/phrases';
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
import Perception from './screens/Perception';
import OralLong from './screens/OralLong';

export type Vue =
  | 'accueil'
  | 'enregistrement'
  | 'analyse'
  | 'diagnostic'
  | 'comparaison'
  | 'entrainement'
  | 'perception'
  | 'oralLong'
  | 'profil'
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
  const [erreur, setErreur] = useState<string | null>(null);

  const fournisseur = useMemo(() => fournisseurSelonReglages(reglages), [reglages]);

  const memoriser = useCallback(
    (r: ResultatPipeline) => {
      const cible = r.diagnostic.cible;
      if (!cible) return;
      const suivant = consignerScore(profil, cible.code, cible.score);
      setProfil(suivant);
      enregistrerProfil(suivant);
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
        setVue(avant ? 'comparaison' : 'diagnostic');
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Erreur inattendue');
        setVue('diagnostic');
      }
    },
    [phrase, reglages.langueCible, fournisseur, profil, forcer, avant, memoriser],
  );

  const relancer = useCallback(() => {
    setAvant(resultat?.diagnostic ?? null);
    setForcer(resultat?.diagnostic.cible?.code ?? null);
    setVue('enregistrement');
  }, [resultat]);

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
          setVue('enregistrement');
        }}
        onQuitter={reinitialiser}
      />
    );
  }

  if (vue === 'perception' && resultat?.diagnostic.cible) {
    const codeCible = resultat.diagnostic.cible.code;
    return (
      <Perception
        code={codeCible}
        langue={reglages.langueCible}
        onQuitter={() => setVue('diagnostic')}
        onTravailler={() => setVue('entrainement')}
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
        onEffacer={() => {
          toutEffacer();
          setProfil(chargerProfil());
        }}
        onExporter={() => exporterMarkdown(profil, reglages.langueCible)}
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
    />
  );
}
