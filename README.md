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

Budget : **moins de 10 s** de la fin de lecture au diagnostic.

## Ce que le produit refuse de faire

1. **Jamais de score global.** Un son, à un instant donné.
2. **Aucun classement, aucune comparaison entre utilisateurs.** La progression ne se mesure que contre soi.
3. **L'objectif est d'être compréhensible, pas de paraître natif.**

Et techniquement : aucun compte, aucune base de données, aucun audio conservé (RNF-P1).
Le profil vit dans ton navigateur, exportable et supprimable en un clic.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # tsc --noEmit + vite build
node tools/check-bundle-size.mjs   # garde RNF-07 (< 300 Ko gzip)
```

## Développer

- CI : `ci.yml` sur runners self-hosted (`accent-worker`), **budget 5 minutes** par job.
- File de merge : Mergify (`.mergify.yml`), rebase, historique linéaire.
- Gate : `.github/workflows/hermes-lite.yml` (fraîcheur de branche exigée au merge) ;
  les vrais conflits partent à l'agent de résolution (label `hermes/conflit`).
- Une branche = une tâche = un PR ; le merge supprime la branche.

Documentation complète : [`docs/`](docs/) — architecture, write-up concours, déclaration des
outils IA, script vidéo.

## Licence

MIT — voir [LICENSE](LICENSE).
