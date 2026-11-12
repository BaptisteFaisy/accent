# Parcours complet du site — `tools/test-site.mjs`

Test de bout en bout du site **déployé**, dans un navigateur qui ne prend jamais
le focus : `agent-browser` conduit Chromium sur **Xvfb :99** (écran virtuel), rien
n'apparaît sur le poste, aucune fenêtre ne vole le focus.

```bash
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"

# site public (GitHub Pages)
node tools/test-site.mjs

# ou une autre cible (serveur de démo r630, build local servi…)
node tools/test-site.mjs http://127.0.0.1:8820/
node tools/test-site.mjs https://tradoooo.github.io/accent/ --out /tmp/accent-e2e

# version courte (lectures plus brèves)
node tools/test-site.mjs --rapide
```

Aucune dépendance npm : `node:child_process` + `node:fs`. Code de sortie **0** si
tout est vert, **1** sinon. Sorties dans `--out` (défaut `/tmp/accent-e2e`) :
`RAPPORT.md` (une ligne par vérification) + une capture PNG par écran.

## Ce qui est parcouru (10 sections, ~106 vérifications)

| # | Section | Ce qui est vérifié |
|---|---|---|
| 1 | Accueil | titre, accroche, mention RNF-P5, **hub des 4 modes**, 10 phrases prêtes, entrées « Tes données » et Réglages, moteur annoncé |
| 2 | Catalogue | 15 cartes FR→EN, une action *discriminer* et une *travailler* par son, **P14 désactivé**, phrase d'exemple, /θ/ affiché ; puis **9 sons en ES→FR** avec /y/ et /ɑ̃/ |
| 3 | Oral long (RF-21) | saisie, découpage en direct, guidage « Phrase 1 / 3 », mention du passage rapide, fil d'Ariane, enregistrement réel, **bilan sans note globale** |
| 4 | Parcours complet | 3 lectures → diagnostic (**un seul** phonème en héros, schéma articulatoire, fourchette d'incertitude, paire minimale À DIRE/ENTENDU, audio modèle, badge « simulation », **un seul chiffre /100**) → réessayer → comparaison avant/après → entraînement (3 phrases, vitesses 0,5×/0,75×/1×, lien perception) |
| 5 | Profil | titre, absence de classement, accès catalogue, action par son (14 écoutables, P14 exclu), export Markdown, suppression |
| 6 | Tes données | sections, **9 déclarations avec lien vers le fichier preuve**, export, suppression **avec confirmation et annulation** |
| 7 | Réglages | BYOK (champ masqué), région, 1 ou 3 lectures, paire ES→FR activée, mentions RNF-P1..P3 |
| 8 | PWA | `manifest.webmanifest` (200 + bon MIME + `start_url`/`scope` **relatifs** + standalone + 3 icônes dont maskable), `sw.js`, 3 PNG, service worker, réponse contrôlée de `/api/analyse` |
| 9 | Hors ligne | coupure réseau → l'app se recharge depuis le cache |
| 10 | Console + desktop | **zéro erreur JavaScript**, rendu en 1280×900 |

Garde-fous produit vérifiés en continu : aucun `%`, aucune « moyenne », un seul
chiffre à l'écran, badge « simulation » quand la mesure n'est pas réelle, le mot
ciblé est un vrai mot (pas le pronom « i »).

## Ce que ce test NE fait PAS

- **Il ne juge pas la qualité d'une mesure.** Le micro est bouchonné par un
  oscillateur (440 Hz) et la synthèse vocale est bouchonnée si absente : un test
  automatique n'a pas de voix. La justesse du diagnostic se valide sur le corpus
  réel (Annexe A, 10 mots × 3 lectures).
- Il ne teste pas le responsive réel (deux viewports seulement), ni l'accessibilité
  au lecteur d'écran (les `aria-label` sont vérifiés, pas annoncés).
- Il ne teste pas le proxy avec une vraie clé Azure (aucune clé en CI).

## Les trois pièges payés en écrivant ce script

1. **Session partagée.** La session par défaut d'`agent-browser` est **partagée par
   tous les agents de la machine** : en plein parcours, un autre processus a navigué
   ailleurs et le test s'est retrouvé sur un site tiers (22 faux échecs, dont
   « écran de diagnostic atteint — Gammes, your runbooks »). Le script impose donc
   `AGENT_BROWSER_SESSION=accent-e2e`. Et **ne jamais lancer `close --all`** : ça
   ferme les sessions des autres.
2. **`el.click()` dans un `eval` n'est pas un clic utilisateur.** Sans activation,
   `AudioContext.resume()` reste suspendu, le micro bouchonné ne produit aucune
   donnée et l'enregistrement ne démarre jamais. Le script marque l'élément en JS
   (sélection fiable par texte ou `aria-label`) puis clique avec
   `agent-browser click`, qui produit un vrai événement.
3. **Clic hors écran.** En viewport 420×900, un élément en bas de page reçoit un
   clic qui tombe à côté — et le pilote répond « Done ». D'où le
   `scrollintoview` systématique avant le clic.

## À lire aussi

- `tests/integration-app.test.tsx` : le même genre de garde, mais au niveau des
  composants (rend `<App />` et clique les entrées) — rapide, exécuté à chaque PR.
- `tools/test-site.mjs` vérifie le site **déployé** : c'est le seul test qui prouve
  que ce qui est en ligne correspond à ce qui est dans le dépôt.
