# Accent 🎙️

> **Tu lis une phrase. Elle isole le son exact qui cloche — pas un score vague — et te le fait
> retravailler jusqu'à ce qu'il passe.**

Toutes les apps de langue te donnent **un score**. Un score ne te dit pas **quoi** corriger.
Accent refuse le score : elle travaille **un seul son à la fois**, jusqu'à ce qu'il passe.

- Le score global dit : « 78 % » → l'élève ferme l'app.
- Accent dit : *« ton /θ/ sort comme un /s/. Un seul mot à refaire. »* → l'élève réessaie.

Projet soumis à **IceHacks 2026** (CodeStarters, Devpost).

---

## Le pipeline en 5 étapes

| Étape | Entrée | Sortie | Où ça vit |
|---|---|---|---|
| 1. **Écoute** | micro (MediaRecorder) | PCM mono 16 kHz + contrôle qualité | `src/audio/` |
| 2. **Évalue** | audio + texte attendu | score 0-100 **par phonème** | `src/providers/` |
| 3. **Sélectionne** | liste de scores | **un** phonème cible (pondéré) | `src/engine/selectTarget.ts` |
| 4. **Explique** | phonème cible | paire minimale + signature d'erreur | `src/data/phonemes.ts` (donnée, **zéro appel modèle**) |
| 5. **Entraîne** | phonème cible | 3 phrases contenant ce son | `src/data/training.json` (cache commité, **hors ligne**) |

Budget : **moins de 10 s** de la fin de lecture au diagnostic (`BUDGET_PIPELINE_MS`,
`src/constants.ts`). Orchestration : `executerPipeline()` dans `src/engine/pipeline.ts`.

### Une session, écran par écran

```
Accueil ──▶ Enregistrement ──▶ Analyse ──▶ Diagnostic ──▶ Comparaison
(saisie ou   (3 lectures,       (5 étapes    (UN phonème,   (avant/après
 10 phrases   niveau + aperçu)   nommées)     paire min.)    sur le même son)
 prêtes)                                                        │
                                                                ▼
                                                          Entrainement
                                                          (3 phrases, cache)
```

Machine à états : `src/App.tsx` (8 vues, aucune route, aucun compte).

### Navigateur → proxy → API

```
[Navigateur]                             [Edge]                   [API tierce]
 MediaRecorder → PCM 16 kHz
 Webapp statique (Vite+React)
      │
      │  POST /api/analyse               Proxy (clé cachée,   ── clé ──▶  Azure Speech
      ├─ {texte, langueCible, audioBase64} ─ quota, cache)                 Pronunciation
      │  ← {scores[], provider, quota}                                    Assessment
      │
      ├─ BYOK : si le quota est épuisé, la clé personnelle de l'utilisateur
      │   parle directement au fournisseur (jamais à notre proxy).
      │
      └─ localStorage : profil de sons + sessions (jamais l'audio, RNF-P1)
```

- Contrat client du proxy : `src/providers/proxy.ts` (`POST /api/analyse`,
  `GET /api/phrases`). **Le worker lui-même n'est pas encore commité** — voir
  « État d'avancement » ci-dessous.
- Choix du fournisseur et repli : `src/providers/index.ts`
  (`fournisseurSelonReglages` : BYOK Azure → proxy → démo locale ;
  `repliSurDemo` sur erreur proxy, branché dans `src/App.tsx`).

## Ce que le produit refuse de faire

1. **Jamais de score global.** Un son, à un instant donné. Garanti par un garde CI :
   `ci.yml` échoue si `scoreGlobal|globalScore|noteGlobale|overallScore` apparaît dans `src/`.
2. **Aucun classement, aucune comparaison entre utilisateurs.** La progression ne se mesure
   que contre soi (`src/screens/Profil.tsx`).
3. **L'objectif est d'être compréhensible, pas de paraître natif.**

Et techniquement : aucun compte, aucune base de données, aucun audio conservé (RNF-P1).
Le profil vit dans ton navigateur, exportable et supprimable en un clic
(`toutEffacer()` / `exporterMarkdown()`, `src/store/profile.ts`).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — 16 tests moteur (médiane, stabilité, sélection, RNF-04/11)
npm run build      # tsc --noEmit + vite build
npm run size       # garde RNF-07 : bundle < 300 Ko gzip (actuellement ~60 Ko)
```

Sans clé API ni proxy configuré, l'app démarre sur le **moteur de démonstration local**
(`src/providers/demo.ts`) : elle est entièrement cliquable, et chaque mesure simulée est
signalée « simulation » à l'écran — jamais de bluff.

## Démo publique

**https://baptistefaisy.github.io/accent/** — GitHub Pages, HTTPS, accessible à tous,
sans compte. Le micro y fonctionne (contexte sécurisé). Sans proxy sur Pages,
l'app tourne sur son **moteur local de démonstration**, signalé « simulation » à
l'écran ; le mode BYOK (Réglages) permet de brancher une vraie clé Azure Speech.

## Déployer

| Cible | Usage | Commande |
|---|---|---|
| **GitHub Pages** | URL publique stable, 0 $, aucun compte | `bash tools/deploy/publish-pages.sh` |
| **r630 + tunnel** | démo avec proxy `/api` (clé Azure côté serveur) | `bash tools/deploy/deploy-r630.sh` |
| **Cloudflare Pages + Worker** | production : edge, cache, quota | `worker/README.md` |

```bash
npm run build      # génère dist/ (base './' : racine de domaine ou sous-chemin)
```

Le build utilise `base: './'` : le même `dist/` se publie à la racine d'un domaine
ou sous un sous-chemin (`/accent/` sur Pages). Le micro exige **HTTPS** (ou localhost).

## État d'avancement (honnête)

**Fait et vérifié** (`npx tsc --noEmit` + `npx vitest run` : **181/181**, bundle 63 Ko gzip) :

- Pipeline 5 étapes (`src/engine/`) et **deux taxonomies fermées** dans
  `src/data/phonemes.ts` : 15 phonèmes FR→EN (P01..P15) et 9 ES→FR (E01..E09),
  chacune avec signature d'erreur, paires minimales, conseil, difficulté.
- **72 phrases d'entraînement en cache** (45 anglaises + 27 françaises), commitées :
  l'étape 5 ne dépend jamais du réseau (`src/data/training*.json`).
- Fiabilité de la mesure : 3 lectures → médiane, écart > 20 pts → refus
  d'afficher, audio < 1,5 s → « trop court », y compris sur le chemin
  « réessayer » (`src/engine/measure.ts`, `src/engine/selectTarget.ts`).
- Écrans 1 à 8 (`src/screens/`), profil local + export Markdown + suppression en
  un clic (`src/store/profile.ts`), réglages BYOK (`src/store/settings.ts`).
- Trois fournisseurs : moteur local de démonstration (signalé « simulation »),
  proxy edge (clé cachée, quota, cache), BYOK Azure Speech (`src/providers/`).
- Proxy déployable : Worker Cloudflare (`worker/`) **et** serveur Node sans
  dépendance (`server/`), une seule logique partagée (`server/lib.mjs`).
- Deux hébergements publics vérifiés : GitHub Pages (URL stable) et le serveur
  r630 derrière un tunnel (`tools/deploy/`).
- CI self-hosted (≤ 5 min par job), file de merge Mergify, agent Hermes de
  résolution de conflits sur InferHub, garde « aucun score global ».

**Prévu / non implémenté** :

- **Mesure réelle** : il faut une clé Azure Speech (tier gratuit F0, 5 h audio/mois).
  Sans clé, l'app tourne sur le moteur local et **le dit à l'écran**.
- **Validation go/no-go** sur corpus audio réel (10 mots × 3 lectures, Annexe A) :
  à enregistrer par un francophone.
- **Vidéo ≤ 3 min** : script plan par plan dans `docs/VIDEO-SCRIPT.md`, tournage à faire.
- Troisième paire de langues (EN→ES) : déclarée `pret: false`, l'architecture est
  prête (il manque la table de données).
- RF-21 (oral long, texte découpé phrase par phrase) et RF-22 (sons récurrents sur
  ≥ 3 phrases) : non implémentés.

## Documentation

| Fichier | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Pipeline réel, seuils, modèle de données, fiabilité de la mesure |
| [`docs/WRITE-UP.md`](docs/WRITE-UP.md) | Write-up Devpost (anglais) — problème, thèse, décisions, échecs |
| [`docs/WRITE-UP.fr.md`](docs/WRITE-UP.fr.md) | Le même write-up en français |
| [`docs/AI-DISCLOSURE.md`](docs/AI-DISCLOSURE.md) | Déclaration obligatoire des outils IA |
| [`docs/VIDEO-SCRIPT.md`](docs/VIDEO-SCRIPT.md) | Script vidéo 3 min, seconde par seconde + plans + matériel |
| [`docs/JUDGES.md`](docs/JUDGES.md) | Critères du concours, profils de juges, stratégie de tracks |
| [`docs/SOUMISSION.md`](docs/SOUMISSION.md) | Checklist de soumission Devpost + conformité + heure limite |
| [`docs/CONFIDENTIALITE.md`](docs/CONFIDENTIALITE.md) | RNF-P1..P5 : les preuves dans le code |

## Développer

- CI : `ci.yml` sur runners self-hosted (`accent-worker`), **budget 5 minutes** par job.
- File de merge : Mergify (`.mergify.yml`), rebase, historique linéaire.
- Gate : `.github/workflows/hermes-lite.yml` (fraîcheur de branche exigée au merge) ;
  les vrais conflits partent à l'agent de résolution (label `hermes/conflit`).
- Une branche = une tâche = un PR ; le merge supprime la branche.

## Licence

MIT — voir [LICENSE](LICENSE).
