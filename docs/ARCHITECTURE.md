# Architecture d'Accent

> Ce document décrit le pipeline **tel qu'il est réellement codé** sur la branche `main`.
> Chaque affirmation pointe vers un fichier ou une fonction du dépôt. Ce qui n'est pas
> implémenté est écrit « prévu / non implémenté ».

## 1. Vue d'ensemble

```
[Navigateur]                             [Edge]                   [API tierce]
 MediaRecorder → PCM mono 16 kHz
 Webapp statique (Vite + React + TS)
      │
      │  POST /api/analyse                Proxy (clé cachée,   ── clé ──▶  Azure Speech
      ├─ {texte, langueCible, audioBase64}  quota, cache)                   Pronunciation
      │  ← {scores[], provider, quota}                                     Assessment
      │
      ├─ BYOK : clé personnelle → directement au fournisseur (jamais au proxy)
      └─ localStorage : accent.profil.v1, accent.sessions.v1,
         accent.reglages.v1 — jamais l'audio (RNF-P1)
```

**Choix structurants** :

1. **Zéro backend de données.** Profil et sessions vivent dans `localStorage`
   (`src/store/profile.ts`, clés `accent.profil.v1` / `accent.sessions.v1`,
   50 sessions max — constante `MAX_SESSIONS`). Pas de base, pas d'auth.
2. **Proxy edge minimal** : la clé API ne doit jamais apparaître dans le bundle.
   Le contrat client est codé dans `src/providers/proxy.ts`
   (`POST /api/analyse`, `GET /api/phrases?code&langue`).
   ⚠️ **Le worker lui-même n'est pas commité** — prévu / non implémenté dans ce dépôt.
3. **Webapp statique** : `vite.config.ts` avec `base: './'` — la même build tourne à la
   racine d'un domaine ou sous un chemin monté. Déploiement public : prévu, non fait.
4. **Mode BYOK** (`src/providers/azure.ts`) : champ « clé Azure Speech » dans
   `src/screens/Reglages.tsx`, stockée dans `localStorage` (`src/store/settings.ts`) et
   envoyée **uniquement** à `https://{region}.stt.speech.microsoft.com`.

## 2. Le pipeline en 5 étapes — tel que codé

Orchestrateur : `executerPipeline()` dans `src/engine/pipeline.ts`. Il publie la
progression étape par étape via `onProgress` (`ProgressionPipeline`, `src/types.ts`),
affichée par `src/screens/Analyse.tsx`, et chronomètre chaque étape (`msParEtape`,
`msTotal` dans `ResultatPipeline`). Budget : **10 s** (`BUDGET_PIPELINE_MS`).

| Étape | Fichiers / fonctions | Entrée → Sortie |
|---|---|---|
| 1. **Écoute** | `src/audio/capture.ts` (`CaptureMicro`), `src/audio/wav.ts` (`decoderVersMono16k`, `encoderWav`), `src/audio/quality.ts` (`analyserQualite`, `verdictQualite`) | micro → PCM mono 16 kHz + verdict qualité |
| 2. **Évalue** | `src/providers/*` via `FournisseurPrononciation.analyse()` ; les lectures partent **en parallèle** (`Promise.all` dans `evaluer()`, `pipeline.ts`) | audio + texte → `ScorePhoneme[]` par lecture |
| 3. **Sélectionne** | `src/engine/measure.ts` (`consoliderLectures`) puis `src/engine/selectTarget.ts` (`choisirCible`, `poids`, `estAcquis`) | scores consolidés → **une** `Cible` (ou un état de refus) |
| 4. **Explique** | `src/engine/explain.ts` (`expliquer`, `pairePour`) + table `src/data/phonemes.ts` | cible → paire minimale, signature, conseil. **Zéro appel réseau** |
| 5. **Entraîne** | `src/data/training.ts` (`phrasesPour`) + cache `src/data/training.json` | cible → 3 phrases (`PHRASES_ENTRAINEMENT = 3`) |

### Étape 1 — Écoute (capture)

- `CaptureMicro.demarrer()` : `getUserMedia({ echoCancellation: true, noiseSuppression: true,
  channelCount: 1 })`, `MediaRecorder` avec morceaux de 200 ms, arrêt automatique à
  **15 s** (`DUREE_MAX_MS`), niveau RMS temps réel via `AnalyserNode` (waveform de
  `src/screens/Enregistrement.tsx`).
- `CaptureMicro.arreter()` : décode le blob (`decoderVersMono16k` — Web Audio
  `decodeAudioData`, mix mono, ré-échantillonnage linéaire 16 kHz), encode en WAV 16 bits
  (`encoderWav`), analyse la qualité (`analyserQualite`).
- Contrôle qualité (`src/audio/quality.ts`) : `tropCourt` (< 1 500 ms, `DUREE_MIN_MS`),
  `silence` (RMS < 0,004, `RMS_SILENCE`), `sature` (> 2 % d'échantillons ≥ 0,985).
  `verdictQualite()` traduit en messages dans le ton du produit.
- Repli micro refusé : `depuisFichier()` (téléversement audio), branché dans
  `src/screens/Enregistrement.tsx`.
- RNF-P1 : l'aperçu est une `URL.createObjectURL` **révoquée après usage**
  (`oublier()` dans `capture.ts`) ; l'audio ne quitte jamais la mémoire volatile.

### Étape 2 — Évalue (fournisseurs)

Contrat unique `FournisseurPrononciation` (`src/types.ts`) : `analyse()` et `phrases()`.
Trois implémentations, choisies par `fournisseurSelonReglages()` (`src/providers/index.ts`) :

| Priorité | Fournisseur | Fichier | Réalité |
|---|---|---|---|
| 1 | **BYOK Azure** (si clé + région renseignées) | `src/providers/azure.ts` | Mesure réelle : REST Speech-to-text « short audio », en-tête `Pronunciation-Assessment` (base64) avec `Granularity: 'Phoneme'`, `EnableMiscue: true`, `GradingSystem: 'HundredMark'`. `traduireAzure()` mappe `NBest[0].Words[].Phonemes[]` vers `ScorePhoneme[]` (score = `AccuracyScore`, code via `codePourIpa`). |
| 2 | **Proxy** (si `urlProxy` renseignée) | `src/providers/proxy.ts` | Envoie `{texte, langueCible, audioBase64}` ; `429` → message explicite invitant au BYOK. Le worker edge derrière : **prévu / non commité**. |
| 3 | **Démo locale** (défaut) | `src/providers/demo.ts` | **Simulation assumée** : segmente l'audio (`segmentsVoix`), extrait 3 descripteurs par zone (durée, énergie, taux de passage par zéro), les projette sur les phonèmes attendus des mots (`phonemesAttendus`, `projeter`). Retourne `simule: true`, affiché « Mode démonstration » dans `src/screens/Diagnostic.tsx`. |

Repli : si le proxy renvoie un diagnostic en erreur, `src/App.tsx` relance le pipeline sur
`repliSurDemo()` (RNF-09, dégradation gracieuse).

### Étape 3 — Sélectionne (cible unique)

C'est le cœur produit. Deux temps :

**Consolidation** (`src/engine/measure.ts`) — voir §4 ci-dessous.

**Choix** (`choisirCible()`, `src/engine/selectTarget.ts`) :

1. Option `forcer` (écran « réessayer », RF-07) : si le code forcé est mesuré, on reste
   dessus — une session ne change jamais de son en cours de route.
2. Candidats = mesures avec `mediane < SEUIL_ACQUIS (80)` **et** non acquises récemment
   (`estAcquis()` : `acquisLe` depuis moins de `ACQUIS_COOLDOWN_JOURS = 7` jours).
3. Aucun candidat → état `rien_a_corriger` : « Rien à corriger sur cette phrase.
   Essaie-en une plus difficile. » (RNF-04, testé dans `src/engine/engine.test.ts`).
4. Tri par poids décroissant, `poids(mediane, occurrences, difficulte)` :

   ```ts
   manque = max(0, 80 - mediane)
   poids  = manque × max(1, occurrences) × (1 + 0,25 × difficulte)
   ```

   Un son raté trois fois dans la phrase passe avant un son exotique apparu une fois ;
   la difficulté (★ de la taxonomie) départage.
5. Le premier candidat **stable** (`mesure.stable`) devient la `Cible`. Aucun stable →
   état `instable`, on refuse d'afficher un chiffre (RNF-11).

Phonèmes hors taxonomie : `ScorePhoneme.code` vaut `null` → affichés dans la phrase
colorée, **jamais ciblés** (`grouperParCode` les ignore dans `measure.ts`).

### Étape 4 — Explique (de la donnée, jamais un modèle)

`src/engine/explain.ts` ne fait **aucun appel réseau** : `expliquer(cible)` lit
`cible.entree`, qui vient de `PHONEMES` (`src/data/phonemes.ts`) — la table fermée des
15 phonèmes (P01..P15) avec `ipa`, `signature`, `produitComme`, `pairesMinimales`,
`motsExemples`, `difficulte` (1-3), `conseil`, `nature`. `pairePour()` choisit la paire
minimale qui contient le mot réellement prononcé, sinon la première.

**Le choix « l'étape 4 est de la donnée, jamais un modèle »** : la connaissance
pédagogique est codée en dur, versionnée, testée. Conséquences : diagnostic instantané
(< 10 ms), gratuit, hors ligne, reproductible — et défendable devant un juge, puisque
chaque paire minimale se relit dans le diff. Un modèle génératif ici ajouterait de la
latence, du coût et de l'aléatoire sans ajouter de savoir.

Cas particulier **P14 (accent de mot)** : `nature: 'positionnel'`, avec données
d'`accentuation` (mot → syllabes → index accentué). L'écran Diagnostic affiche alors
« Ce n'est pas un son mais une place » au lieu d'une paire minimale
(`PaireMinimale` dans `src/screens/Diagnostic.tsx`).

### Étape 5 — Entraîne (cache d'abord)

`phrasesPour(code, langue)` (`src/data/training.ts`) : lit le cache **commité**
`src/data/training.json`, complète avec `repliLocal()` (phrases simples bâties sur
`motsExemples`) jusqu'à 3, ne renvoie jamais moins de 3 phrases pour `langue = 'en'`.

⚠️ État réel du cache : **3 codes sur 15** couverts (P01, P02, P04 — 3 phrases chacun).
Les 12 autres tombent sur le repli local : fonctionnel hors ligne, mais générique.
Compléter le cache est prévu. Un enrichissement LLM via `GET /api/phrases` existe dans
`src/providers/proxy.ts` — **optionnel, jamais un prérequis** (le local suffit).

## 3. Modèle de données (`src/types.ts`)

Stocké **localement uniquement** (`localStorage`). Aucun audio, aucune voix, aucun nom.

```ts
interface ScorePhoneme {
  code: CodePhoneme | null; // null = hors taxonomie : affiché, non ciblé
  ipa: string;              // ex. « θ »
  mot: string;              // mot de la phrase où il apparaît
  indexMot: number;
  score: number;            // 0..100
  produitIpa?: string;      // phonème réellement produit, si le fournisseur le nomme
}

interface Session {
  id: string;               // crypto.randomUUID() (src/App.tsx, memoriser())
  createdAt: string;        // ISO
  langueCible: LangueCible; // 'en' | 'fr' | 'es' — seul 'en' est prêt
  phrase: string;           // ≤ 200 car (PHRASE_MAX_CAR), aucun nom propre demandé
  cible: CodePhoneme | null;
  scores: ScorePhoneme[];
  // aucun champ audio : RNF-P1 — vérifiable dans la définition du type
}

interface Profil {
  parPhoneme: Partial<Record<CodePhoneme, ProfilPhoneme>>;
  // ProfilPhoneme : { meilleur, dernier, tentatives, acquisLe: string | null }
  sessions: number;
  maj: string;
}
```

Écritures : `consignerScore()` (meilleur / dernier / tentatives / `acquisLe` au premier
franchissement de 80), `ajouterSession()` (50 max), `enregistrerProfil()` — tout dans
`src/store/profile.ts`. Aucun type du dépôt ne permet d'exprimer un score global, et la
CI le vérifie par grep (`ci.yml`, garde « aucun score global »).

États d'un diagnostic (`EtatDiagnostic`) : `a_travailler`, `rien_a_corriger`, `instable`,
`trop_court`, `erreur` sont réellement émis (pipeline.ts / selectTarget.ts).
`acquis` et `trop_bruyant` sont **déclarés dans le type mais jamais émis** par le moteur
actuel — la saturation audio passe par `verdictQualite()` avant l'analyse.

## 4. La chaîne de fiabilité de la mesure

Mesurer un phonème sur un mot court est bruité. Trois parades, toutes dans
`src/constants.ts` + `src/engine/` :

| Parade | Seuil | Implémentation | Test |
|---|---|---|---|
| **3 lectures → médiane** | `LECTURES_REFERENCE = 3` | `consoliderLectures()` : par code, une valeur par lecture = le **pire** score du code dans cette lecture ; `mediane()` sur ces valeurs. 1 lecture = mode « essai rapide » explicite (`mesureUnique()`, libellé dans `Reglages.tsx` : « mesure moins fiable »). Dans `App.tsx` : `lecturesDemandees = forcer ? 1 : reglages.lectures`. | `engine.test.ts` : médiane impair/pair, consolidation 3 lectures |
| **Écart > 20 pts → refus d'afficher** | `ECART_MAX = 20` | `Mesure.stable = ecartMax(valeurs) <= 20` (`measure.ts`) ; `choisirCible()` ne cible qu'une mesure stable, sinon état `instable` : « l'écart entre tes lectures dépasse 20 points. Réessaie. » | `engine.test.ts` : RNF-11 (20 vs 90 → instable) |
| **Audio < 1,5 s → trop court** | `DUREE_MIN_MS = 1500` | `verifierLectures()` (`pipeline.ts`) renvoie l'état `trop_court` **avant tout appel API** ; doublé côté capture par `analyserQualite().tropCourt` et `verdictQualite()`. | garde amont du pipeline |

Le représentant affiché à l'écran est **l'occurrence la plus dégradée** (`pire()` dans
`measure.ts`) : on montre à l'élève le mot qui pose réellement problème, et l'écran
Diagnostic affiche la transparence complète (« médiane de 3 lectures · écart 7 »).

Refuser d'afficher un chiffre incertain est un choix produit : mieux vaut « mesure
instable, réessaie » qu'un diagnostic faux qui détruit la confiance.

## 5. Seuils — source unique `src/constants.ts`

| Constante | Valeur | Rôle |
|---|---|---|
| `SEUIL_A_TRAVAILLER` | 60 | En dessous : orange dans `PhraseColoree.tsx` |
| `SEUIL_ACQUIS` | 80 | Au-dessus : acquis, vert ; exclu du ciblage |
| `ACQUIS_COOLDOWN_JOURS` | 7 | Un acquis reste hors profil 7 jours (`estAcquis`) |
| `ECART_MAX` | 20 | Au-delà : refus d'afficher (`instable`) |
| `LECTURES_REFERENCE` | 3 | Lectures pour conclure (médiane) |
| `DUREE_MIN_MS` | 1 500 | Audio plus court : « trop court, réessaie » |
| `DUREE_MAX_MS` | 15 000 | Borne d'enregistrement (RF-02) |
| `PHRASE_MAX_CAR` | 200 | Saisie maximale (RF-01) |
| `BUDGET_PIPELINE_MS` | 10 000 | Fin de lecture → diagnostic (RNF-01) |
| `TAUX_ECHANTILLONNAGE` | 16 000 | PCM mono 16 kHz attendu par les API |
| `RMS_SILENCE` | 0,004 | En dessous : silence détecté |
| `PHRASES_ENTRAINEMENT` | 3 | Phrases d'entraînement par cible (RF-08) |

Aucun chiffre magique ailleurs : toute la logique de décision lit ces constantes.

## 6. Écrans et design

Machine à états dans `src/App.tsx` (**12 vues**, pas de router) :

1. **Accueil** (`Accueil.tsx`) : saisie libre ≤ 200 car + les 10 phrases prêtes
   (`src/data/phrases.ts`, la première est celle du « wow » : *« I think this is the
   right thing. »*), puis un **hub « Tout ce que tu peux faire ici »** (une phrase,
   un texte long, entraîner mon oreille, mes sons). Mention RNF-P5 en pied de page,
   qui ouvre l'écran « Tes données ».
2. **Enregistrement** (`Enregistrement.tsx`) : gros bouton, waveform en direct
   (`Waveform`), minuteur, `<audio controls>` d'aperçu avant envoi, repli fichier,
   mention explicite du mode essai rapide à 1 lecture (§18.4).
3. **Analyse** (`Analyse.tsx`) : les 5 étapes nommées + barre de progression —
   l'attente devient une démonstration du pipeline.
4. **Diagnostic** (`Diagnostic.tsx`) : phrase colorée (`PhraseColoree.tsx` — vert ≥ 80,
   orange < 60 ou cible, **jamais de rouge pour un son**), puis UN phonème en très grand
   (`phoneme-heros`, `clamp(48px, 14vw, 96px)`), son produit, paire minimale
   (`PaireMinimale.tsx`) **ou** barres de syllabes pour P14 (`BarresSyllabes.tsx`),
   schéma articulatoire (`SchemaArticulatoire.tsx`), fourchette d'incertitude
   (`FourchetteScore.tsx`), audio modèle ralenti (`ModeleAudio.tsx`), un seul chiffre.
   Badge « simulation » si `resultat.simule`. Entrées : réessayer, travailler ce son,
   **entraîner mon oreille d'abord**.
5. **Comparaison** (`Comparaison.tsx`) : avant/après sur le même son, compteur animé
   (`CompteurAnime.tsx`), delta en points — l'écran de la vidéo.
6. **Entraînement** (`Entrainement.tsx`) : 3 phrases du cache, mot clé surligné,
   audio modèle ralenti, et « entraîner mon oreille d'abord ».
7. **Perception** (`Perception.tsx`) : discrimination auditive de paires minimales
   (A/B, mots non affichés pendant l'écoute), bilan sans note globale. Logique dans
   `src/engine/perception.ts`.
8. **Catalogue** (`Catalogue.tsx`) : les sons de la paire courante (15 en FR→EN, 9 en
   ES→FR), chacun avec signature d'erreur, difficulté, état dans le profil, phrase
   d'exemple, et deux actions (discriminer / travailler à la voix). C'est l'écran qui
   rend la taxonomie **visible sans passer par un diagnostic**.
9. **Oral long** (`OralLong.tsx`, RF-21) : texte collé, découpé (`src/engine/segments.ts`),
   guidage phrase par phrase, fil d'Ariane, bilan sans moyenne.
10. **Profil** (`Profil.tsx`) : les sons de la paire courante, travaillés en couleur /
    autres en gris, section « Ce qui revient » (RF-22), export Markdown + « Tout
    supprimer », accès au catalogue et action par son. Aucun classement.
11. **Tes données** (`Donnees.tsx`) : RNF-P4/P5 côté produit — ce qui n'est jamais
    stocké, l'inventaire réel du navigateur, et chaque déclaration avec un lien vers
    le fichier du dépôt qui la prouve (`src/store/privacy.ts`).
12. **Réglages** (`Reglages.tsx`) : BYOK Azure, URL proxy, 1 ou 3 lectures, paire de
    langues (FR→EN et ES→FR actives), mentions de confidentialité.

**Règle de découverte** : aucune fonctionnalité ne doit être joignable uniquement au
bout d'un parcours de trois enregistrements. Chaque mode a une entrée depuis l'accueil
(hub), et chaque écran de travail propose les modes voisins. C'est verrouillé par
`tests/integration-app.test.tsx`, qui rend `<App />` et clique réellement les entrées —
motif : un merge textuellement propre avait débranché `onOralLong` sans qu'aucun test
unitaire ne le voie (12/11).

Design tokens : `tailwind.config.js` — fond sombre `#0b0f14`, orange `#f2a33c`
(à travailler), vert `#4ec98a` (acquis), rouge `#e5484d` **réservé aux erreurs système**,
texte ≥ 16 px, cibles tactiles ≥ 48 px (RNF-06).

## 7. Fiabilité de livraison (CI / merge)

- `.github/workflows/ci.yml` (runner self-hosted `accent-worker`, timeout 5 min) :
  `npm ci` → typecheck → **16 tests** (`src/engine/engine.test.ts`) → build →
  budget bundle (`tools/check-bundle-size.mjs`, 300 Ko gzip ; mesuré à **60,2 Ko**) →
  garde grep « aucun score global ».
- `ci-budget.yml` : échoue si un job déclare > 5 min de timeout.
- `hermes-lite.yml` + `.github/hermes/gate.py` : fraîcheur de branche exigée au merge ;
  les conflits réels sont étiquetés `hermes/conflit` et escaladés à l'agent de résolution.
- `stale-base-guard.yml` : informatif (warning, exit 0).
- `.mergify.yml` : file de merge, conditions `ci` + `ci-budget` + `hermes-lite/verdict`
  + sans conflit + non draft ; merge **rebase**, batch ≤ 3.

## 8. Ce qui manque (prévu / non implémenté)

| Élément | État | Preuve |
|---|---|---|
| Worker proxy edge | Contrat client prêt, worker absent du dépôt | `proxy.ts` référence `worker/README.md` ; aucun répertoire `worker/` |
| Déploiement HTTPS public | Non fait | aucune config d'hébergement dans le dépôt |
| Cache d'entraînement complet | 3/15 codes | `src/data/training.json` ; repli `repliLocal()` |
| Deuxième paire de langues (RF-20) | **Fait** : ES→FR, 9 codes E01..E09 | `codesPourLangue()` + `training.fr.json` ; même moteur, mêmes seuils |
| Sons récurrents (RF-22) | **Fait** : ≥ 3 phrases distinctes | `sonsRecurrents()` (`src/store/profile.ts`), section « Ce qui revient » |
| Audio modèle ralenti (RF-23) | **Fait** : 0,5× / 0,75× / 1× | `src/audio/tts.ts` (`speechSynthesis`), `src/components/ModeleAudio.tsx` |
| Export Markdown (RF-24) | **Fait** | `exporterMarkdown()`, borné à la paire de langues |
| Mode oral long (RF-21) | **Fait** : découpage + guidage | `src/engine/segments.ts`, `src/screens/OralLong.tsx` |
| Perception avant production | **Fait** (hors cahier, ajouté) | `src/engine/perception.ts`, `src/screens/Perception.tsx` |
| Schémas articulatoires | **Fait** (hors cahier, ajouté) | `src/data/articulation.ts`, `src/components/SchemaArticulatoire.tsx` |
| Écran « Tes données » | **Fait** (RNF-P4/P5 côté produit) | `src/store/privacy.ts`, `src/screens/Donnees.tsx` |
| PWA installable + hors ligne | **Fait** (RNF-08) | `public/manifest.webmanifest`, `public/sw.js`, `src/pwa.ts` |
| Incertitude de la mesure affichée | **Fait** | `bornes()`/`traverseUnSeuil()`, `src/components/FourchetteScore.tsx` |
| Corpus audio de validation (go/no-go) | À enregistrer | aucun fichier audio dans le dépôt |
| `npm run serve` | Script cassé | `server/serve.mjs` absent |
