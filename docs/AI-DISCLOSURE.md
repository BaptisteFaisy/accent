# Déclaration des outils IA — Accent

> Déclaration obligatoire au titre des règles IceHacks 2026 : *« AI tools are permitted…
> Participants must disclose significant AI-generated contributions and remain
> responsible for understanding and demonstrating their projects. »*
>
> Cette déclaration distingue quatre usages différents de l'IA. Elle est factuelle :
> chaque élément pointe vers un fichier du dépôt. Aucune survente.

## Fournisseur de voix (optionnel)

**ElevenLabs** est proposé comme moteur de synthèse de la voix modèle (BYOK :
l'utilisateur colle sa propre clé, leyalisation 0 $ par défaut). Quand il est
activé, **le texte** de la phrase ou du mot à faire entendre est envoyé à
ElevenLabs (`eleven_multilingual_v2`) ; l'audio de l'élève ne l'est jamais.
Par défaut, c'est la synthèse du navigateur qui est utilisée — rien ne sort de la
machine.

(a) L'API d'évaluation de prononciation — appelée PAR LE PRODUIT

C'est **le produit lui-même**, pas une aide au développement.

- **Fournisseur réel** : Azure Speech « Pronunciation Assessment », granularité phonème.
  Implémenté en BYOK dans `src/providers/azure.ts` : requête REST « short audio » avec
  l'en-tête `Pronunciation-Assessment` (`Granularity: 'Phoneme'`,
  `GradingSystem: 'HundredMark'`, `EnableMiscue: true`) ; `traduireAzure()` convertit la
  réponse en `ScorePhoneme[]` (score = `AccuracyScore` par phonème).
- **Chemin par défaut prévu** : via un proxy edge qui détient la clé (contrat codé dans
  `src/providers/proxy.ts`, `POST /api/analyse`). Le worker proxy lui-même n'est pas
  encore commité à la date de cette déclaration.
- **Mode démonstration local** : `src/providers/demo.ts` est une **simulation**
  déterministe (descripteurs acoustiques projetés sur la taxonomie). Elle renvoie
  `simule: true` et l'écran Diagnostic affiche « Mode démonstration : mesure simulée
  localement, pas une évaluation réelle » (`src/screens/Diagnostic.tsx`). Aucune mesure
  simulée n'est jamais présentée comme une mesure réelle.

## (b) Le LLM utilisé pour les phrases d'entraînement — ET LEUR CACHE STATIQUE COMMITÉ

- Les phrases d'entraînement (étape 5 du pipeline) ont été **rédigées à l'avance avec
  l'aide d'un LLM**, puis relues et **figées dans `src/data/training.json`**, fichier
  **commité dans le dépôt**. À la date de cette déclaration, le cache couvre 3 des 15
  codes (P01, P02, P04 — 3 phrases chacun).
- **Aucun LLM ne tourne pendant la démo.** `phrasesPour()` (`src/data/training.ts`) lit
  d'abord le cache commité, et complète jusqu'à 3 phrases avec un repli purement local
  (`repliLocal()`, construit sur les `motsExemples` de la taxonomie) pour les 12 codes
  non couverts. L'app fonctionne donc hors ligne et ne dépend d'aucun quota pour
  l'étape 5.
- Un enrichissement optionnel via `GET /api/phrases` existe côté client
  (`src/providers/proxy.ts`) ; en cas d'échec réseau, le code retombe sur le cache
  local. C'est un complément, jamais un prérequis.

## (c) L'assistance au codage par agents IA pendant le hackathon

- Le développement s'est fait **avec des agents IA d'assistance au code** (environnement
  ZeroClaw), pendant la période du hackathon — conformément à la règle « tout le travail
  doit être démarré pendant le hackathon ». L'historique du dépôt en atteste : dépôt
  initialisé et commits datés du 2026-11-11, dans la fenêtre du concours.
- Rôle exact des agents : génération et refactor de code sous la direction de l'auteur,
  rédaction de la documentation (dont ce dossier `docs/`), exécution des vérifications
  (`tsc --noEmit`, `vitest`, build).
- **Revue humaine systématique** : chaque diff est relu et validé par l'auteur avant
  commit. L'auteur assume l'entière responsabilité du code, **sait expliquer chaque
  ligne** et peut en faire la démonstration à un juge qui le demanderait.
- Part générée vs écrite à la main : le codage a été majoritairement agent-assisté ;
  donner un pourcentage exact serait inventé — nous préférons le dire tel quel. Les
  décisions produit (zéro score global, taxonomie fermée, 3 lectures/médiane, refus
  d'afficher un score instable, cache commité) sont celles de l'auteur, écrites dans le
  cahier des charges avant le code.

## (d) L'agent de résolution de conflits de merge

- Le dépôt utilise un **gate de fraîcheur de branche** : `.github/workflows/hermes-lite.yml`
  exécute `.github/hermes/gate.py` (stdlib Python seule). Il vérifie au moment du merge
  que la branche est à jour sur `main` et, en cas de **conflit réel**, pose le label
  `hermes/conflit` — les PR ainsi étiquetées partent vers un **agent de résolution de
  conflits** (escalade), ou vers un humain via le label `hermes/intervention-humaine`
  (bloquant dans `.mergify.yml`).
- Ce workflow est déclaré en dry-run côté configuration de dépôt
  (`HERMES_LITE_DRY_RUN`, cf. commentaires de `.mergify.yml`).
- La file de merge elle-même (Mergify, `.mergify.yml`) n'utilise **aucune IA** :
  conditions de checks (`ci`, `ci-budget`, `hermes-lite/verdict`), rebase, batch ≤ 3.

## Ce qui n'utilise PAS d'IA

Pour être exhaustif, les parties du produit volontairement **sans modèle** :

- **Étape 4 « Explique »** : paires minimales, signatures d'erreur, conseils — table de
  données codée en dur dans `src/data/phonemes.ts`, lue par `src/engine/explain.ts`.
  Zéro appel réseau, zéro génération. C'est un choix d'architecture assumé (voir
  `docs/ARCHITECTURE.md` §2, étape 4).
- **Sélection du phonème cible** : formule déterministe et testée
  (`poids()`, `choisirCible()` dans `src/engine/selectTarget.ts`).
- **Profil, historique, export** : `localStorage` et Markdown (`src/store/profile.ts`).
