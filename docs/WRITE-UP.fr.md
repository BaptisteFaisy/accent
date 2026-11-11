# Accent — Elle ne te note pas. Elle nomme le son qui cloche.

> **Tu lis une phrase à voix haute. Accent isole le phonème fautif — pas un score vague —,
> nomme le son réellement produit, donne une paire minimale, et fait retravailler ce son
> seul avec trois phrases jusqu'à ce qu'il passe.**

Projet soumis à **IceHacks 2026** (CodeStarters, Devpost). Équipe d'une personne,
4 jours, budget 0 $. Ce document est la version française du write-up Devpost ;
la version soumise (anglais) est [`WRITE-UP.md`](WRITE-UP.md), la déclaration des
outils IA est [`AI-DISCLOSURE.md`](AI-DISCLOSURE.md).

## 1. Le problème

Un élève français apprend l'anglais depuis six ans. Quand il parle, on lui répond
*« on ne te comprend pas »*. Il ne **s'entend pas** se tromper : le /θ/ n'existe pas en
français, donc *think* et *sink* sonnent littéralement pareil pour lui. Que lui donnent
les outils actuels ?

- Les apps de prononciation donnent un **score global**. On n'agit pas sur un « 78 % ».
- Les cours sont **linéaires** (leçon 1, 2, 3…) — la plupart des apprenants abandonnent
  en trois semaines.
- Un prof particulier donne un excellent retour à **25-40 €/h**, inaccessible à la
  plupart.
- Les moments où la prononciation coûte réellement des points — oraux d'examen,
  entretiens, exposés — sont exactement ceux qu'on ne peut pas travailler spécifiquement.

**Le cœur du problème n'est pas la prononciation. C'est l'absence de diagnostic.** Un
élève qui sait *« mon problème, c'est /ð/ et les consonnes finales »* peut travailler
seul. Un élève qui a 78 % ne peut rien faire.

## 2. La thèse

**Un score ne se corrige pas. Un phonème, si.**

Accent refuse le score global par principe. Une session = **un seul** phonème cible :
l'app le nomme, nomme le son réellement produit, montre une paire minimale
(*think → sink*), mesure le progrès au « réessayer », puis fait travailler ce son seul
dans trois phrases. Quand il passe, on passe au suivant.

Trois garde-fous éthiques non négociables (écrits dans le write-up **et** à l'écran
dans le produit) :

1. **Jamais de score global.** Jamais de « mauvais accent ». Un son, à un instant donné.
2. **Aucun classement, aucune comparaison entre utilisateurs.** La progression ne se
   mesure que contre soi.
3. **L'objectif est d'être compréhensible, pas de paraître natif.** Dire le contraire
   serait un mensonge technique : à 30 ans, on ne perd pas son accent, on devient plus
   clair.

## 3. Ce qu'on a construit

Une webapp statique (Vite + React + TypeScript + Tailwind, zéro dépendance runtime hors
React), organisée en pipeline de 5 étapes orchestré par `executerPipeline()`
(`src/engine/pipeline.ts`) :

```
[Navigateur]                           [Edge]                   [API tierce]
 MediaRecorder → PCM mono 16 kHz
 Webapp statique
      │
      │  POST /api/analyse              Proxy (clé cachée,   ── clé ──▶  Azure Speech
      ├─ {texte, langue, audio base64}   quota, cache)                   Pronunciation
      │  ← scores par phonème                                          Assessment
      │
      ├─ Repli BYOK : la clé personnelle de l'utilisateur parle directement au fournisseur
      └─ localStorage : profil de sons + sessions (jamais l'audio)
```

| Étape | Ce qui se passe | Où ça vit |
|---|---|---|
| 1. **Écoute** | Capture micro, WAV 16 kHz mono, contrôle qualité (trop court < 1,5 s, silence, saturation) | `src/audio/` |
| 2. **Évalue** | Score 0-100 **par phonème** + phonème réellement produit, 3 lectures **en parallèle** | `src/providers/` |
| 3. **Sélectionne** | Médiane des lectures → **un** phonème cible, pondéré occurrences × difficulté | `src/engine/selectTarget.ts` |
| 4. **Explique** | Paire minimale + signature d'erreur + consigne — table locale, **zéro appel modèle** | `src/data/phonemes.ts`, `src/engine/explain.ts` |
| 5. **Entraîne** | 3 phrases contenant le son cible, depuis un **cache statique commité** (marche hors ligne) | `src/data/training.json` |

Budget : moins de 10 s de la fin de lecture au diagnostic. L'écran d'analyse affiche les
cinq étapes nommées en progression — l'attente devient une démonstration du pipeline.

Le savoir produit est une **taxonomie fermée de 15 phonèmes** (P01-P15) portant pour
chacun : symbole API, signature d'erreur typique du francophone (« sort en /s/ »),
paires minimales, mots d'exemple, difficulté 1-3, consigne courte et bienveillante. Le
système ne peut pas inventer de catégorie. L'accent de mot (P14) est traité à part,
comme **positionnel** et non phonétique : l'écran montre des syllabes accentuées au
lieu d'une paire minimale.

## 4. Le paysage concurrentiel, honnêtement

Oui, ELSA Speak existe, et oui, elle donne un retour par phonème. Voici le tableau qu'on
présente au juge avant qu'il le fasse :

| Solution | Ce qu'elle fait | Où elle échoue pour notre utilisateur |
|---|---|---|
| **ELSA Speak** | Coach de prononciation, retour par phonème | Parcours imposé (leçons), score global affiché, anglais uniquement, abonnement ; il faut **suivre son programme** |
| **Duolingo** | Motivation par le jeu | Ne corrige quasi pas la prononciation ; un jeu, pas un diagnostic |
| **ChatGPT vocal** | Conversation naturelle | Dit « c'est bien » ; ne sait pas nommer un phonème, encore moins le mesurer |
| **Prof particulier** | Retour excellent | 25-40 €/h, indisponible pour la plupart |
| **YouTube « prononciation française »** | Gratuit | Passif ; aucune mesure, aucun retour sur **ta** voix |

L'espace d'Accent :

1. **Ton texte, pas leur programme.** Tu apportes la phrase que tu dois vraiment dire
   (exposé, entretien, oral d'examen). L'accueil est un champ texte et dix phrases
   prêtes — rien d'autre.
2. **Zéro score global, par principe** — garanti par un garde CI qui fait échouer le
   build si `scoreGlobal|globalScore|noteGlobale|overallScore` apparaît dans `src/`.
3. **N'importe quelle paire de langues, même architecture.** La taxonomie est de la
   donnée (`src/data/phonemes.ts`) : une table Espagnol→Français est une nouvelle table,
   pas un nouveau moteur. (Aujourd'hui seule FR→EN est prête — `fr`/`es` sont livrées
   désactivées, « bientôt ».)
4. **La progression est locale** — ta voix ne passe jamais par une base de données,
   parce qu'il n'y en a pas.

## 5. Les décisions difficiles

**Pourquoi zéro score global.** Un nombre invite au jugement ; un diagnostic invite à
l'action. C'est un choix éthique (la discrimination par l'accent est interdite au
travail dans plusieurs pays) **et** un choix produit : la règle « un seul phonème » est
ce qui fait tenir la boucle de remédiation. On l'a rendue vérifiable par machine : le
système de types n'a aucun moyen d'exprimer un score global (`src/types.ts`), et la CI
grep les noms interdits (`ci.yml`).

**Pourquoi une seule paire de langues au départ.** Quatre jours, une personne. La
taxonomie fermée des 15 phonèmes n'a de sens que pour une paire L1→L2 **donnée** — les
signatures d'erreur (« un francophone transforme /θ/ en /s/ ») **sont** la pédagogie.
Livrer une paire parfaitement vaut mieux que trois approximativement. L'architecture
tient la promesse : la langue est un paramètre (`LangueCible`), la taxonomie est de la
donnée, et le sélecteur liste déjà ES→FR et EN→ES en `pret: false`.

**Pourquoi 3 lectures et la médiane.** Mesurer un phonème sur un mot court est bruité :
une seule lecture peut balancer de plusieurs dizaines de points. Les trois lectures
partent **en parallèle** (`Promise.all` dans `pipeline.ts` — la latence reste celle d'un
aller-retour API), consolidées en médiane par phonème (`consoliderLectures()`,
`src/engine/measure.ts`). Si l'écart entre lectures dépasse 20 points (`ECART_MAX`),
l'app **refuse d'afficher un chiffre** : « mesure instable, réessaie » (`choisirCible()`
→ état `instable`, RNF-11). Sous 1,5 s d'audio (`DUREE_MIN_MS`), elle dit « trop court »
**avant** d'appeler la moindre API. Un mode « essai rapide » à 1 lecture existe,
explicitement signalé moins fiable.

**Pourquoi un proxy edge et pas de backend.** Il n'y a aucune donnée utilisateur à
stocker : le profil vit dans `localStorage`, les sessions sont bornées à 50, l'export
est un téléchargement Markdown, la suppression tient en un clic (`toutEffacer()`,
`src/store/profile.ts`). Le seul besoin serveur est de cacher la clé API et borner le
quota — un travail de worker statique, pas un backend. Pas de base, pas d'auth, pas de
RGPD serveur. (État honnête : le contrat client du proxy est codé dans
`src/providers/proxy.ts` ; le worker lui-même n'est pas encore commité.)

**Pourquoi l'étape 4 est de la donnée, jamais un modèle.** L'explication (paire
minimale, signature, consigne) vient de la table commitée des 15 phonèmes, pas d'un LLM.
Résultat : instantané (< 10 ms), gratuit, hors ligne, testable, défendable — chaque
paire minimale se relit dans le diff. La connaissance pédagogique est de la donnée
versionnée, pas une génération. Même principe pour les phrases d'entraînement : elles
sont en cache dans `src/data/training.json`, commité — la démo ne casse jamais parce
qu'une API a répondu 429.

## 6. Les échecs et les contournements

C'est la section dont on est le plus fier, parce que chaque échec a façonné le produit :

- **La mesure est bruitée sur un mot court.** Les premiers tests montraient le même mot
  scorer 34, puis 70, puis 41 d'une lecture à l'autre. Une lecture ne prouve rien.
  Contournement : trois lectures, médiane, refus explicite d'afficher quoi que ce soit
  quand l'écart dépasse 20 points. Dire « je ne suis pas sûr, relis » est une
  fonctionnalité, pas un défaut — c'est ce qui distingue un diagnostic d'un horoscope.
  (Testé : `engine.test.ts`, 16 tests.)
- **Les consonnes finales sont surestimées.** L'évaluation est indulgente avec les
  consonnes de fin de mot : un *dog* assourdi en *dok* score quand même haut, masquant
  exactement l'erreur du francophone (P12 de la taxonomie). Contournement : P12 est une
  entrée de plein droit avec sa signature et ses paires minimales (*dog/dock*,
  *bed/bet*), et la pondération de sélection (`poids()`) utilise occurrences × difficulté
  pour qu'une erreur répétée et structurellement importante passe avant un exotisme
  isolé.
- **Le quota est le vrai ennemi de la démo.** Les tiers gratuits se comptent en heures
  d'audio ; les juges testent dans une fenêtre de 48 h. Contournements, dans l'ordre :
  (1) le cache d'entraînement commité — l'étape 5 n'appelle jamais le réseau ;
  (2) un **moteur de simulation local** (`src/providers/demo.ts`), toujours disponible,
  toujours signalé « simulation » à l'écran — jamais une fausse mesure ne passe pour une
  vraie ; (3) le **BYOK** : chacun peut coller sa clé Azure Speech dans Réglages,
  stockée dans son navigateur, envoyée à Microsoft uniquement — l'app continue de
  fonctionner pour un juge même si notre quota meurt ; (4) le repli automatique : sur
  erreur du proxy, l'app relance le pipeline sur le moteur de démo (`App.tsx`), avec le
  même étiquetage honnête.

## 7. Ce qu'on a appris

- **La perception précède la production.** Un apprenant ne peut pas corriger un contraste
  qu'il n'entend pas. La paire minimale n'est pas une décoration — c'est l'outil
  pédagogique : *think/sink* rend le /θ/ audible avant de le rendre prononçable.
- **La fiabilité est une décision d'UX.** Les trois constantes les plus dures du projet
  (`ECART_MAX = 20`, `DUREE_MIN_MS = 1500`, `LECTURES_REFERENCE = 3`) ne sont pas des
  détails d'ingénierie ; ce sont les moments où le produit choisit l'honnêteté plutôt
  qu'un chiffre. Elles vivent toutes dans un seul fichier, `src/constants.ts`.
- **Les API de parole gratuites sont indulgentes à des endroits prévisibles** (consonnes
  finales) et bruitées ailleurs. Savoir **où** une API ment vaut mieux qu'espérer
  qu'elle ne mente pas.
- **Les contraintes font le produit.** Pas de compte, pas de backend, pas de score
  global, un phonème par session : chaque « non » a supprimé un mode de panne et aiguisé
  le pitch.

## 8. La suite

1. **Deuxième paire de langues (ES→FR)** avec le même moteur — l'argument le plus fort
   contre « ELSA le fait déjà » : l'architecture est de la donnée par paire de langues,
   pas du code anglais-only.
2. **Mode oral d'examen** : texte long, guidage phrase par phrase (RF-21).
3. **Profil de sons récurrents** sur ≥ 3 phrases (RF-22) : l'écran Profil stocke déjà
   l'historique par phonème ; la règle de détection reste à écrire.
4. **Audio modèle ralenti (TTS)** pour la comparaison côte à côte (RF-23).
5. **Validation avec des profs** et corpus de test enregistré (10 mots piégeux × 3
   lectures ; cible d'acceptation : bon phonème identifié ≥ 8/10).
6. Committer le **worker proxy** et déployer sur une URL publique HTTPS.

## 9. Outils IA utilisés — déclaration explicite

Obligatoire selon les règles du concours ; le détail est dans
[`AI-DISCLOSURE.md`](AI-DISCLOSURE.md). En résumé : (a) le produit lui-même appelle une
**API d'évaluation de prononciation** (Azure Speech, granularité phonème) — c'est le
produit, pas une aide au développement ; (b) les phrases d'entraînement ont été rédigées
avec un **LLM** et sont livrées en **cache statique commité** (`src/data/training.json`)
— aucun LLM ne tourne pendant la démo ; (c) le codage a été fait avec des **agents IA
d'assistance au code** pendant le hackathon, sous revue de l'auteur — l'auteur sait
expliquer chaque ligne ; (d) les conflits de merge sont triés par un **gate assisté par
agent** (Hermes, `.github/workflows/hermes-lite.yml`).

## 10. État d'avancement (honnête)

Au vert au moment de la préparation de la soumission : build TypeScript propre,
**16/16 tests moteur** passants (médiane, refus d'instabilité, sélection de la cible
unique, cas « rien à corriger » sans faux positif, cooldown de 7 jours des sons acquis),
bundle JS initial **60,2 Ko gzip** (budget : 300 Ko), CI sur runners self-hosted avec
budget de 5 min par job. Pas encore faits : déploiement public HTTPS, commit du worker
proxy, cache d'entraînement complet (3/15 codes commités, le reste bascule sur des
phrases générées localement), corpus audio de validation. On l'écrit parce qu'on préfère
être vérifiés que crus.

---

*Accent. Un son à la fois.*
