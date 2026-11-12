# Confidentialité — RNF-P1..P5 : les preuves dans le code

> Une voix est une **donnée biométrique** au sens du RGPD. « On ne stocke pas ta voix »
> est ici un argument vrai **par architecture**, pas par promesse : il n'existe aucun
> serveur de données, et chaque exigence ci-dessous se vérifie dans un fichier précis.
> Comment vérifier soi-même : §7.

## Troisième partie : ce qui sort de la machine (quand on l'accepte)

| Élément | Vers qui | Quoi exactement | Pourquoi |
|---|---|---|---|
| **Voix Eleven Labs** (optionnel, BYOK) | Eleven Labs | **le TEXTE** de la phrase ou du mot à faire entendre (jamais l'audio de l'élève) | le fournisseur synthétise la voix du modèle ; il n'entend rien de l'élève |
| **Clé Azure Speech** (BYOK) | Microsoft | l'audio de l'élève, pour l'analyse | c'est le cœur du service : sans elle, l'app tourne en mode démonstration (signalé) |
| **Proxy edge** | notre worker | l'audio analysé + la phrase | le worker ajoute la clé, borne le quota, met en cache les **réponses** (jamais l'audio) |

Le mode par défaut (voix du navigateur, moteur local de démonstration) n'envoie
**rien** : aucune donnée ne sort de la machine. Choisir Eleven Labs ou Azure est un
choix explicite, affiché dans les réglages, avec le rappel que seul le texte (ou
l'audio analysé) part.


## 1. RNF-P1 — L'audio n'est jamais persisté, ni client ni serveur

| Preuve | Fichier |
|---|---|
| Le type `Session` (ce qui est écrit dans `localStorage`) n'a **aucun champ audio** — commentaire du type : « Jamais d'audio ici : RNF-P1 » | `src/types.ts` |
| Trois clés `localStorage` seulement : `accent.profil.v1`, `accent.sessions.v1`, `accent.reglages.v1` — scores, dates, compteurs, réglages. Aucun octet audio. | `src/store/profile.ts`, `src/store/settings.ts` |
| Aucun autre mécanisme de stockage dans tout `src/` : pas d'IndexedDB, pas de cookies, pas de `sessionStorage`, pas de `sendBeacon` (vérifiable par grep) | `grep -rn "indexedDB\|document.cookie\|sessionStorage" src/` → vide |
| Le blob micro vit en mémoire : `CaptureMicro.arreter()` le décode en PCM (`decoderVersMono16k`), l'encode en WAV (`encoderWav`) pour l'envoi, puis `libereMicro()` coupe les pistes du micro | `src/audio/capture.ts` |
| L'aperçu « écouter avant envoi » est une `URL.createObjectURL` **révoquée** dès la validation, le « refaire » ou le démontage de l'écran (`oublier()`) — jamais uploadée | `src/audio/capture.ts` (`oublier`), `src/screens/Enregistrement.tsx` (appels + `useEffect` de nettoyage) |
| Le profil et les sessions écrits après analyse ne contiennent que des scores : `consignerScore()`, `ajouterSession()` | `src/store/profile.ts`, appel dans `memoriser()` (`src/App.tsx`) |

Côté serveur : il n'y a **pas de backend de données** (zéro base, zéro compte). L'audio
transite uniquement vers le fournisseur d'évaluation (proxy ou Azure en BYOK) pour être
analysé. ⚠️ Le worker proxy n'étant pas encore commité, l'absence de conservation
côté proxy est une **exigence de son implémentation** (RNF-P2 ci-dessous), à vérifier
au commit du worker.

## 2. RNF-P2 — Le proxy ne loggue ni l'audio ni le texte

Exigence : le proxy edge ne journalise que **horodatage + code HTTP + durée** — jamais
le contenu (texte lu, audio).

- **État : prévu / non implémenté dans ce dépôt.** Le worker proxy n'est pas commité ;
  le contrat client (ce que le front envoie) est figé dans `src/providers/proxy.ts` :
  `POST /api/analyse` avec `{texte, langueCible, audioBase64}`, jeton optionnel
  `x-accent-jeton`. Le texte et l'audio transitent donc nécessairement par le proxy —
  c'est inhérent à l'évaluation — mais **ne doivent être ni loggués ni stockés**.
- À vérifier au commit du worker : aucun `console.log` du corps de requête, aucune
  écriture KV/R2 du payload, logs bornés à `timestamp, status, durationMs`.
- Ce document sert de cahier des charges opposable au worker : toute déviation est un
  bug de confidentialité, pas un détail.

## 3. RNF-P3 — Aucune donnée biométrique dérivée

| Preuve | Fichier |
|---|---|
| `Profil` = `{ parPhoneme: { meilleur, dernier, tentatives, acquisLe }, sessions, maj }` — des **scores et des dates**, rien d'autre. Aucune empreinte vocale, aucune identification du locuteur, aucun embedding. | `src/types.ts` (`Profil`, `ProfilPhoneme`) |
| `Session` = identifiant aléatoire (`crypto.randomUUID()`), date, langue, phrase choisie, code du phonème cible, scores. La phrase est le texte **saisi par l'utilisateur** (≤ 200 caractères), pas une transcription de sa voix. | `src/types.ts`, `src/App.tsx` (`memoriser()`) |
| Aucune donnée biométrique n'est **demandée** : pas de compte, pas de nom, pas d'e-mail, aucun champ d'identité dans les écrans | `src/screens/Reglages.tsx` (seuls champs : clé BYOK, région, URL proxy, lectures, langue) |

## 4. RNF-P4 — Profil exportable et supprimable en un clic

| Action | Implémentation | Écran |
|---|---|---|
| **Suppression totale en un clic** | `toutEffacer()` : `localStorage.removeItem('accent.profil.v1')` + `removeItem('accent.sessions.v1')` | bouton « Tout supprimer » (`src/screens/Profil.tsx`) |
| **Suppression des réglages** (inclut la clé BYOK) | `effacerReglages()` : `removeItem('accent.reglages.v1')` | `src/store/settings.ts` |
| **Export en un clic** | `exporterMarkdown()` : tableau Markdown des 15 phonèmes (meilleur / dernier / tentatives / acquis le), téléchargé en `accent-mes-sons.md` | bouton « Exporter la liste (Markdown) » (`src/screens/Profil.tsx`, `telecharger()`) |

L'export ne contient **aucune donnée personnelle** — uniquement des scores par phonème.
Il existe pour que l'élève (ou son prof) emporte sa liste de sons à travailler (RF-24).

## 5. RNF-P5 — La mention à l'écran

« Ta voix n'est pas conservée. Elle ne sert qu'à te corriger. » — et ses variantes,
là où l'utilisateur en a besoin :

| Écran | Mention exacte | Fichier |
|---|---|---|
| Accueil (pied de page, permanent) | « Ta voix n'est pas conservée. Elle ne sert qu'à te corriger. » | `src/screens/Accueil.tsx` |
| Enregistrement | « L'audio n'est jamais enregistré : il est supprimé dès l'analyse. » | `src/screens/Enregistrement.tsx` |
| Réglages | « Confidentialité : l'audio n'est jamais conservé, ni ici ni sur le proxy (RNF-P1, RNF-P2). Aucune donnée biométrique dérivée n'est demandée ni stockée (RNF-P3). » | `src/screens/Reglages.tsx` |
| Profil | « Ces données vivent uniquement dans ton navigateur. Aucune voix, aucune empreinte vocale. » | `src/screens/Profil.tsx` |
| Diagnostic (pied de page) | « Pas de note globale, pas de classement : un son, à un instant donné. » | `src/screens/Diagnostic.tsx` |

## 6. Cas particulier : la clé BYOK

Le mode BYOK (filet de sécurité quota) stocke la clé Azure Speech de l'utilisateur dans
`localStorage` (`accent.reglages.v1`). Trade-off assumé et **documenté à l'écran** :
« elle reste dans ce navigateur et n'est envoyée qu'à Microsoft »
(`src/screens/Reglages.tsx`). Dans le code : `fournisseurAzure()` n'envoie la clé qu'à
`https://{region}.stt.speech.microsoft.com` via l'en-tête `Ocp-Apim-Subscription-Key`
(`src/providers/azure.ts`) — jamais à notre proxy, jamais ailleurs. Elle est effacée par
« Tout supprimer » côté réglages (`effacerReglages()`).

## 7. Comment vérifier soi-même (2 minutes)

1. Ouvrir l'app, faire une analyse complète.
2. **Onglet Application → Local Storage** : trois clés `accent.*`. Les ouvrir —
   uniquement du JSON de scores/dates/réglages, aucun audio, aucun champ identité.
3. **Onglet Réseau** : l'audio (base64 dans `POST /api/analyse`, ou WAV brut vers
   `*.stt.speech.microsoft.com` en BYOK) ne part **que** vers le fournisseur choisi,
   affiché en clair en bas de l'écran d'accueil (« Moteur : … »).
4. Recharger la page après l'analyse : aucun enregistrement rejouable, l'aperçu a été
   révoqué (`oublier()`).
5. Cliquer « Tout supprimer » (Profil) puis recharger : les trois clés ont disparu.

## 8. Résumé des exigences

| Réf | Exigence | État |
|---|---|---|
| RNF-P1 | Audio jamais persisté, client ni serveur | ✅ côté client (preuves §1) ; côté proxy : exigence au commit du worker |
| RNF-P2 | Proxy : logs horodatage + statut + durée seulement | ⏳ prévu — worker non commité (§2) |
| RNF-P3 | Aucune donnée biométrique dérivée demandée ni stockée | ✅ (§3) |
| RNF-P4 | Profil exportable et supprimable en un clic | ✅ (§4) |
| RNF-P5 | Mention à l'écran | ✅ (§5) |
