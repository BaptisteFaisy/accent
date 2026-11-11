# Script vidéo — 3 minutes, seconde par seconde

> **Obligatoire pour la soumission** : lien public YouTube/Vimeo, **≤ 3 min**, projet
> **en fonctionnement**. Sans lien vidéo fonctionnel au jugement = projet non jugé.
> Upload prévu le Jour 3 (jamais le dernier jour), lien non répertorié, **vérifié en
> navigation privée** avant soumission.

## Règles de tournage (non négociables)

1. **Filmer le vrai produit.** Chaque capture d'écran montre l'app qui tourne, avec de
   l'audio réellement enregistré au micro. Pas de maquette, pas de mockup.
2. **Toute étape simulée est écrite à l'écran.** Si le quota API est épuisé ou le proxy
   indisponible pendant le tournage, on filme le **mode démo local**
   (`src/providers/demo.ts`) — l'UI affiche elle-même l'étiquette « Mode démonstration :
   mesure simulée localement, pas une évaluation réelle » (`src/screens/Diagnostic.tsx`).
   Cette étiquette **doit rester visible** au montage ; ajouter en plus un carton
   « séquence en mode simulation » si la mesure n'est pas une évaluation réelle.
3. **L'honnêteté est notée ; le bluff est disqualifiant.** Le before/after (34 → 81) est
   filmé tel quel : si la mesure réelle bouge moins, on filme ce qu'elle fait vraiment.
4. Voix off en français (cible du récit) ou anglais (cible des juges) — au choix au
   montage ; les textes à l'écran restent lisibles dans les deux cas.

## Tableau temps / image / voix

| Temps | Image | Voix / texte à l'écran |
|---|---|---|
| 0:00–0:10 | Un élève lit une phrase en anglais. On voit sa bouche, on n'entend que le son. Puis un prof imaginaire dit « on ne comprend pas » | Voix off : « Six ans d'anglais. Et à chaque fois, la même phrase : on ne te comprend pas. » |
| 0:10–0:20 | Texte plein écran, fond sombre | « Le problème, c'est qu'il ne sait pas **quel** son le trahit. » |
| 0:20–0:30 | Montage rapide : un score « 78 % » qui tourne dans le vide, un cours de prononciation qu'on ferme | « Un pourcentage ne se corrige pas. Un cours ne se suit pas. » |
| 0:30–0:45 | **Le produit** : l'écran de saisie (`Accueil.tsx`). On colle une phrase qu'on doit vraiment dire | Voix : « Accent part de ta phrase. Pas d'un programme. » |
| 0:45–1:05 | L'élève lit. Waveform en direct (`Enregistrement.tsx`). Les mots se colorent (`PhraseColoree.tsx`) | Voix : « Tu lis. Elle écoute, au niveau du phonème. » |
| 1:05–1:30 | **Le moment clé** : zoom sur le phonème fautif, avec la paire minimale (`Diagnostic.tsx`) | Voix : « Elle n'affiche pas une note. Elle nomme le son. » — à l'écran : **/θ/ → /s/** · *think → sink* |
| 1:30–1:55 | Deuxième essai. Le phonème passe de l'orange au vert. Compteur 34 → 81 (`Comparaison.tsx`) | Voix : « Tu réessaies. Ça bouge. » — **c'est le before/after qui compte** |
| 1:55–2:15 | Enchaînement : 3 phrases avec le même son, depuis le cache (`Entrainement.tsx`) | Voix : « Puis elle te fait travailler **ce son seul**, trois fois, dans trois contextes. » |
| 2:15–2:35 | Vue « profil » : les sons travaillés, ceux qui restent (`Profil.tsx`) | Voix : « Ton profil de sons. Pas un classement. Pas de comparaison. Juste ce qu'il te reste. » |
| 2:35–2:50 | Écran confidentialité : « ta voix est supprimée après analyse » (mention d'`Accueil.tsx` / `Reglages.tsx`) | Voix : « Ta voix n'est pas conservée. Elle ne sert qu'à te corriger. » |
| 2:50–3:00 | Logo + URL publique + repo | « Accent. Un son à la fois. » |

## Plan additionnel recommandé — la preuve d'honnêteté

Le cahier des charges (RNF-04) exige de montrer le cas **« rien à corriger »** : une
phrase parfaitement prononcée affiche « Rien à corriger sur cette phrase. Essaie-en une
plus difficile. » (état `rien_a_corriger`, `src/engine/selectTarget.ts`), avec **zéro
faux positif**. C'est la preuve la plus rentable du projet : l'app sait ne rien dire
quand tout va bien.

- **Où l'insérer** : 10 s maximum, en remplacement partiel du segment 2:15–2:35
  (vue profil), pour rester ≤ 3 min.
- **Bonus optionnel** (même emplacement, si le montage le permet) : le refus
  « Mesure instable » (écart > 20 pts entre lectures) — l'app qui refuse d'afficher un
  chiffre incertain.

## Liste des plans à tourner

| # | Plan | Écran / lieu | Durée brute à filmer |
|---|---|---|---|
| 1 | Élève qui lit « I think this is the right thing. », bouche visible | face caméra, lieu calme | 30 s |
| 2 | Texte plein écran « quel son le trahit ? » | carton montage | — |
| 3 | Score « 78 % » inutile + cours fermé | carton montage / B-roll | 20 s |
| 4 | Saisie d'une phrase personnelle dans l'app | écran 1 (Accueil) | 30 s |
| 5 | Enregistrement : bouton, waveform, minuteur, aperçu | écran 2 (Enregistrement) | 60 s (3 lectures) |
| 6 | Progression des 5 étapes nommées | écran 3 (Analyse) | 15 s |
| 7 | **Diagnostic : zoom phonème /θ/ → /s/, paire minimale** | écran 4 (Diagnostic) | 30 s |
| 8 | **Réessai + comparaison avant/après, compteur qui glisse** | écran 5 (Comparaison) | 60 s |
| 9 | Les 3 phrases d'entraînement, mot clé surligné | écran 6 (Entrainement) | 30 s |
| 10 | Profil de sons + export/suppression | écran 7 (Profil) | 20 s |
| 11 | Mentions de confidentialité | écran 8 (Réglages) ou pied d'Accueil | 15 s |
| 12 | « Rien à corriger » sur une phrase bien prononcée | écran 4 | 30 s |
| 13 | Logo + URL + repo | carton final | — |

Tourner les plans 7 et 8 **en premier** (ce sont eux qui portent la vidéo), chacun en
2-3 prises. Vérifier avant chaque prise : micro autorisé, HTTPS (ou localhost),
fournisseur affiché en bas de l'Accueil (« Moteur : … ») — il doit correspondre à ce que
la voix off prétend.

## Matériel (budget 0 $)

- **Caméra A** : téléphone portable — plans 1 (visage/bouche) et captation d'écran en
  dépannage.
- **Capture d'écran produit** : enregistrement d'écran natif (macOS `⌘⇧5` / Windows
  `Win+G` / iOS-Android intégré) sur le laptop ou le téléphone qui fait tourner l'app —
  plans 4 à 12. Résolution ≥ 1080p.
- **Micro voix off** : micro du téléphone, dans une pièce calme (le même que celui du
  produit — cohérence honnête).
- **Montage** : logiciel gratuit (DaVinci Resolve, CapCut, iMovie, Kdenlive).
- **Cartons texte** : fond sombre `#0b0f14` (couleur `nuit` du produit,
  `tailwind.config.js`), texte `#e8eef4` — les cartons ressemblent à l'app.

## Checklist avant upload

- [ ] Durée finale ≤ 3:00 (vérifiée au montage, pas estimée)
- [ ] Chaque séquence simulée est écrite à l'écran (règle 2)
- [ ] Le cas « rien à corriger » apparaît (RNF-04)
- [ ] L'URL publique montrée dans le plan 13 fonctionne (sinon : ne pas la montrer)
- [ ] Upload YouTube/Vimeo en « non répertorié » ou public, **lien testé en navigation
      privée** depuis un autre appareil
- [ ] Lien collé dans le formulaire Devpost **avant** l'heure limite
      (voir `docs/SOUMISSION.md`)
