# Dossier juges — critères, profils, tracks

> Note interne de préparation (ne part pas dans la soumission). Objectif : savoir où
> Accent marque des points sur chaque critère, avec **preuves à l'appui** (fichiers,
> tests, chiffres du dépôt), et quel angle tenir devant chaque profil de juge.

## 1. Les 5 critères équipondérés — où on marque

### Technical Execution

| Preuve | Où la vérifier |
|---|---|
| Pipeline 5 étapes orchestré et chronométré (`msParEtape`, budget 10 s) | `src/engine/pipeline.ts` (`executerPipeline`) |
| Chaîne de fiabilité : 3 lectures → médiane ; écart > 20 pts → **refus d'afficher** ; audio < 1,5 s → rejet avant tout appel API | `src/engine/measure.ts`, `src/engine/selectTarget.ts`, `src/constants.ts` (`ECART_MAX`, `DUREE_MIN_MS`, `LECTURES_REFERENCE`) |
| **16 tests** moteur : médiane, instabilité, cible unique, « rien à corriger » (RNF-04), cooldown 7 jours, forçage du son | `src/engine/engine.test.ts` (`npm test`) |
| Build TypeScript strict propre ; CI self-hosted avec budget 5 min/job ; garde-fou bundle (60,2 Ko gzip mesurés, budget 300 Ko) | `ci.yml`, `tools/check-bundle-size.mjs` |
| Zéro dépendance runtime hors React ; audio 100 % natif (MediaRecorder + Web Audio, encodeur WAV maison, ré-échantillonnage 16 kHz) | `package.json`, `src/audio/wav.ts` |
| Garde produit automatisée : la CI **échoue** si un score global apparaît dans le code | `ci.yml` (grep `scoreGlobal\|globalScore\|noteGlobale\|overallScore`) |

**Phrase clé** : « L'app refuse d'afficher un score quand la mesure est instable —
c'est testé, et c'est ce qui distingue un diagnostic d'un wrapper. »

### Creativity & Originality

| Preuve | Où la vérifier |
|---|---|
| Inversion produit : **ton texte, pas notre programme** — l'accueil est un champ libre + 10 phrases prêtes | `src/screens/Accueil.tsx`, `src/data/phrases.ts` |
| Zéro score global par principe, rendu **impossible par les types** et interdit par la CI | `src/types.ts` (aucun champ), `ci.yml` (garde) |
| Taxonomie fermée de 15 phonèmes avec signature d'erreur du francophone, paires minimales, difficulté pondérée | `src/data/phonemes.ts` |
| L'explication est de la **donnée versionnée**, jamais une génération : étape 4 sans réseau ni modèle | `src/engine/explain.ts`, `docs/ARCHITECTURE.md` §2 |
| P14 (accent de mot) traité comme **positionnel** : syllabes accentuées au lieu d'une paire minimale | `src/data/phonemes.ts` (`accentuation`), `src/screens/Diagnostic.tsx` |
| Un mode démo local qui se **signale lui-même** « simulation » | `src/providers/demo.ts` (`simule: true`), badge dans `Diagnostic.tsx` |

**Phrase clé** : « Aucune app grand public ne refuse de vous noter par design. Nous, on
l'a écrit dans les types, et la CI le fait respecter. »

### Impact & Usefulness

| Preuve | Où la vérifier |
|---|---|
| Cible immédiate : l'oral (bac, concours, entretien) — la phrase travaillée est **celle de l'échéance** | persona P1/P2, `docs/WRITE-UP.fr.md` §1 |
| Gratuit, 0 $ de budget, sans compte, sans abonnement | architecture statique + `localStorage`, `docs/ARCHITECTURE.md` §1 |
| Confidentialité par architecture : la voix (donnée biométrique RGPD) n'est jamais persistée ; export + suppression en un clic | `src/store/profile.ts` (`toutEffacer`, `exporterMarkdown`), `docs/CONFIDENTIALITE.md` |
| Architecture multi-langues **prouvée** : deux paires livrées (FR→EN 15 phonèmes, ES→FR 9 phonèmes), moteur inchangé | `src/data/phonemes.ts` (P01..P15, E01..E09), `tests/esfr.test.ts`, `codesPourLangue()` |
| La mesure est une estimation, et l'app le dit : étendue observée affichée, refus d'afficher si écart > 20 pts | `src/components/FourchetteScore.tsx`, `src/engine/selectTarget.ts` (`traverseUnSeuil`), RNF-11 |
| L'élève entend le modèle, au ralenti, sans API payante ni fichier audio | `src/audio/tts.ts` (`speechSynthesis`), `src/components/ModeleAudio.tsx` (RF-23) |
| Prof comme multiplicateur : la liste exportable des sons à travailler se partage | export Markdown (RF-24), `src/store/profile.ts` |
| La perception précède la production : on entraîne l'oreille avant la bouche | `src/engine/perception.ts`, écran `Perception.tsx` (aucune note, paires à revoir) |
| Le texte long de l'élève est guidé phrase par phrase, bilan sans moyenne | `src/engine/segments.ts` (RF-21), garde-fou testé sur la forme du bilan |
| Confidentialité vérifiable : chaque affirmation renvoie au fichier qui la prouve | écran « Tes données », `src/store/privacy.ts` |
| Installable et hors ligne (track Deployed) | `public/manifest.webmanifest`, `public/sw.js` (jamais d'audio en cache) |
| Le site **en ligne** est rejoué de bout en bout par un parcours automatique : 12 écrans, ~106 vérifications, zéro erreur console, recharge hors ligne | `tools/test-site.mjs` + `tools/TEST-SITE.md` (rapport et captures dans `/tmp/accent-e2e`) |

**Phrase clé** : « La discrimination par l'accent est réelle ; notre réponse n'est pas
de noter les accents, c'est de rendre chacun compréhensible, sur son propre texte. »

### Design & User Experience

| Preuve | Où la vérifier |
|---|---|
| Un seul chiffre à l'écran ; le phonème est le héros (typo `clamp(48px, 14vw, 96px)`) | `src/screens/Diagnostic.tsx`, `tailwind.config.js` (`phoneme`) |
| **Jamais de rouge pour un son** : orange = à travailler, vert = acquis, rouge réservé aux erreurs système | `tailwind.config.js`, `src/components/PhraseColoree.tsx` |
| Pas de streak, pas de flamme, pas d'XP — un diagnostic, pas un jeu | `src/components/Entete.tsx` (commentaire), aucune occurrence dans `src/` |
| Accessibilité : texte ≥ 16 px, cibles tactiles ≥ 48 px, contraste AA, `aria-*`, feedback textuel | `tailwind.config.js` (`base`, `tactile`), attributs dans les écrans |
| L'attente est mise en scène : les 5 étapes nommées progressent à l'écran | `src/screens/Analyse.tsx` |
| Messages bienveillants (« on explique, on ne culpabilise pas ») | `verdictQualite()` (`src/audio/quality.ts`), messages de `selectTarget.ts` |
| Avant/après filmable sur le même son | `src/screens/Comparaison.tsx` |

**Phrase clé** : « Le before/after **est** le design : deux chiffres, le même son, et
rien d'autre à l'écran. »

### Presentation

| Preuve | Où la vérifier |
|---|---|
| Hook 5 s : « Elle ne te note pas. Elle te montre le son qui cloche. » | README, première phrase prête « I think this is the right thing. » |
| Vidéo 3 min scriptée seconde par seconde, avec règles d'honnêteté (toute simulation écrite à l'écran) | `docs/VIDEO-SCRIPT.md` |
| Le cas « rien à corriger » montré dans la vidéo — la preuve qu'on n'invente pas de problèmes | RNF-04, état `rien_a_corriger` testé |
| Dossier complet : architecture, write-up FR/EN, déclaration IA, confidentialité | `docs/` |
| Démo jamais cassée par le réseau : cache d'entraînement commité + repli démo automatique | `src/data/training.json`, `repliSurDemo` (`src/App.tsx`) |

## 2. Profils de juges et angle pour chacun

| Juge / profil | Angle à tenir |
|---|---|
| **Section Leader, Stanford Code in Place** | Outil d'apprentissage pur : diagnostic → pratique ciblée → mesure du progrès. Montrer la boucle « réessayer » (RF-07) et le compteur avant/après. |
| **Mentor, Stanford Code in Place** | Pédagogie de la remédiation, pas de la note : un son à la fois, paire minimale comme outil perceptif, consignes bienveillantes (`conseil` dans `phonemes.ts`). |
| **AI/ML Trainer, iCodeGuru** | Pipeline parole de bout en bout : capture 16 kHz → évaluation par phonème (Azure, granularité Phonème, EnableMiscue) → médiane multi-lectures → exercice. Parler du bruit de mesure et d'`ECART_MAX` : c'est son langage. |
| **Muskaan Irfan (TA Stanford, juge international)** | Enjeu réel des étudiants non-natifs : l'oral d'examen/entretien, travailler **sa** phrase, pas un cursus. Garde-fou 3 : compréhensible ≠ natif. |
| **Fondateurs (Zoro, NovemberAI, Intellia)** | Thèse nette en une phrase, inversion défendable (« ton texte, pas notre programme »), marché évident, coût marginal ~0 (statique + cache). |
| **Consultant BCG / Head of Growth** | Le pitch tient en une phrase ; le before/after se filme en 10 s ; la cible est immense ; le tableau concurrentiel est déjà fait (write-up §4). |
| **Ingénieurs (Microsoft, Meta, BNSF, LPL)** | Zéro backend, proxy edge minimal, BYOK comme filet de quota, bundle 60 Ko gzip, CI 5 min sur runners self-hosted, 16 tests, types stricts, grep-garde produit. |

**Avantage structurel** : CodeStarters est une asso dont la mission est l'**éducation**
CS/IA. Trois juges enseignent. Un outil d'apprentissage de la prononciation ne passe pas
devant ce jury — il lui parle.

## 3. Stratégie de tracks

Un projet peut être opt-in sur plusieurs tracks mais n'en gagne qu'**un** (le plus
élevé ; les autres repassent aux suivants). Cocher large ne coûte rien.

| Track | Lot | Légitimité d'Accent | À cocher |
|---|---|---|---|
| **Best AI Hack** | 9 750 $ de lots (dont bourse YRI 1 500 $) | Évaluation de prononciation par phonème = usage d'IA profond et mesurable (Azure Pronunciation Assessment, granularité phonème) | ✅ |
| **Best Deployed / Shipped App** (1/2/3) | 4 000 / 2 000 / 1 000 $ | Repo public + docs + CI + fiabilité (cache, repli démo, BYOK). **URL publique en ligne** : https://baptistefaisy.github.io/accent/ (GitHub Pages, redéployée à chaque merge de `main`), installable en PWA, et rejouée par `tools/test-site.mjs` | ✅ déployé |
| **Best Design & UX** | Mobbin Pro 1 an | Le before/after et l'écran de phonème **sont** le design ; AA, 48 px, zéro rouge | ✅ |
| **Overall** | 150 / 100 / 50 $ + crédits | Les 5 critères sont couverts (section 1 ci-dessus) | ✅ |

### Pourquoi le lot Momen ne s'applique pas

Le lot Momen (2 000 $ de crédits) exige un projet **construit sur Momen** (plateforme
no-code). Accent est une base de code Vite + React + TypeScript écrite pendant le
hackathon — pas un export Momen. Tordre le projet pour ce lot n'a aucun sens : la valeur
réelle visée est la **bourse YRI** (Best AI Hack) et la reconnaissance des tracks
Deployed / Design. On ne coche pas Momen.
