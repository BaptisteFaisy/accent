# Agent Hermes de résolution de conflits (InferHub)

Une PR en conflit ne doit jamais pourrir : Mergify refuse de l'embarquer
(`-conflict` dans `.mergify.yml`) et le gate [`hermes-lite`](../gate.py) ne
résout rien — il étiquette `hermes/conflit` et publie un check rouge. **Cet
agent est le seul pilote qui réconcilie.**

Porté du dépôt `vision` (`.github/fireworks/`, éprouvé sur des centaines de PR)
et branché sur **InferHub** (routeur de modèles compatible OpenAI) au lieu de
Fireworks.

## Qui appelle quoi

```
.github/workflows/hermes-conflit.yml     (cron 10 min + fin de CI + push de PR)
   └─ inventaire : PR ouvertes avec mergeStateStatus = DIRTY
       └─ git rebase origin/main  →  conflit
           └─ conflict_agent.py resolve --repo O/R --pr N --branch B --sha S
               ├─ quota.py            : cooldown 20 min, 10 saisines/h, 3/PR/30 min
               ├─ resolve_one()       : un conflit élémentaire → un appel modèle
               ├─ union_journal.py    : CHANGELOG/lock en union pure, SANS modèle
               ├─ compilation_gate.py : tsc --noEmit + vitest run AVANT de pousser
               └─ finish()            : push --force-with-lease + compte rendu
```

## Fournisseur de modèles

| Variable | Défaut | Rôle |
|---|---|---|
| `INFERHUB_API_KEY` | — | clé (secret de dépôt ; jamais dans le code) |
| `INFERHUB_BASE_URL` | `https://api.inferhub.dev/v1/chat/completions` | endpoint chat/completions |
| `INFERHUB_MODEL` | `combo/cheap` | modèle routé |
| `INFERHUB_AGENT_RESOLVE` | `1` | `0` = coupe-circuit, l'agent attend |

**Repli Fireworks** : si les `INFERHUB_*` sont absentes ou vides, les
`FIREWORKS_*` équivalentes sont lues (`env_ou`). Le même agent tourne donc sur
l'un ou l'autre sans changement de code. Testé : `FournisseurInferHubTest`.

⚠ Un `User-Agent` est **obligatoire** sur la requête : sans lui, le CDN répond
`403 error code 1010`. C'est posé dans `modele_complete()` et couvert par un test.

## Les cinq garanties

1. **Jamais de tête cassée poussée.** `compilation_gate.py` lance
   `npx tsc --noEmit` (et `npx vitest run` si des tests sont touchés) sur l'arbre
   résolu. Rouge → rien n'est poussé, la PR reste DIRTY, le tour suivant rappelle
   l'agent dans la limite du quota. Motif d'origine : PR #615 sur `vision`,
   réconciliation cassée poussée, classée « échec réel », PR morte en silence.
   Une porte qui ne peut pas s'exécuter (pas de `node_modules`) ne bloque rien et
   le dit. Coupe-circuit : `CONFLICT_COMPILE_GATE=0`.
2. **Jamais d'écrasement d'un push d'auteur** : push avec bail
   (`--force-with-lease`), et le SHA attendu est celui lu au début du run.
3. **Quota borné** : un conflit rebasé en boucle ne peut pas manger tout le
   quota horaire (incident #215 sur `vision`). Empreintes dans
   `~/.cache/hermes-agent`, jamais dans le clone.
4. **Périmètre protégé** : `REFUSED_PREFIXES = (".github/", ".mergify.yml")` —
   l'agent ne résout jamais un conflit dans sa propre tuyauterie.
5. **Échec visible** : commentaire sur la PR + label
   `hermes/intervention-humaine`, qui suspend la file Mergify
   (`-label = hermes/intervention-humaine`). Rien ne meurt en silence.

## Résolution sans modèle

`union_journal.py` traite les fichiers « journal » (CHANGELOG, fichiers de
traces) par **union des deux côtés** : pas d'appel modèle, pas de risque de
réécriture tronquée. C'est le cas le plus fréquent en pratique.

Le reste est résolu **conflit par conflit** (jamais le fichier entier) : un gros
fichier renvoyé d'un bloc serait tronqué par la limite de tokens.

## Codes de sortie

| Code | Sens |
|---|---|
| 0 | résolution poussée, compte rendu posté |
| 1 | échec commenté, label humain posé |
| 2 | rien à faire (quota, labels, plus de conflit) — saut silencieux |

## Tests

```bash
cd .github/hermes/agent
python3 -m unittest discover -s . -p 'test_*.py'    # 50 tests, stdlib seule
```

Les tests n'appellent jamais le réseau ni `git` pour de vrai : `urlopen` et
`subprocess.run` sont bouchonnés. Le seul appel réel de référence (preuve du
chemin HTTP) est fait à la main :

```bash
INFERHUB_API_KEY=$(cat ~/.inferhub-key) python3 -c "
import conflict_agent as ca; print(ca.modele_complete(ca.API_DEFAULT, __import__('os').environ['INFERHUB_API_KEY'], ca.MODEL_DEFAULT, [{'role':'user','content':'Rends exactement: OK'}]))"
```

## Désactiver

Variable de dépôt `INFERHUB_AGENT_RESOLVE=0` (l'agent attend proprement, les PR
en conflit repassent en main humaine), ou retirer le secret `INFERHUB_API_KEY`.
