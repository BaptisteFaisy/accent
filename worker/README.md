# Proxy edge — Worker Cloudflare + serveur de démo Node

Le navigateur ne doit **jamais** voir la clé d'évaluation (ACCENT.md §18.1). Deux
implémentations du même contrat HTTP partagent **une seule** logique métier,
dans [`../server/lib.mjs`](../server/lib.mjs) :

| Cible | Fichier | Usage |
|---|---|---|
| Cloudflare Workers | `worker/index.ts` | production : edge, cache, quota, clé en secret |
| Node (stdlib seule) | `../server/serve.mjs` | démo publique sur le r630 derrière un tunnel HTTPS, et développement local |

## Contrat HTTP

| Route | Méthode | Entrée | Sortie |
|---|---|---|---|
| `/api/analyse` | POST | `{texte, langueCible, audioBase64}` | `{scores:[{code,ipa,mot,indexMot,score,erreur?}], provider, simule, dureeMs, quota}` |
| `/api/phrases` | GET | `?code=P01&langue=en` | `{phrases:[{code,texte,motCle}]}` (Worker : 404, le cache est dans le bundle) |
| `/healthz` | GET | — | `{ok, provider: "azure" \| "demo"}` |

`scores[].code` est **null** côté proxy : la taxonomie des 15 phonèmes vit dans
le navigateur (`src/data/phonemes.ts`), c'est lui qui rattache l'IPA renvoyé par
Azure à un code `P01..P15`. Une seule source de vérité.

## Trois règles non négociables

1. **Aucun score global ne traverse le proxy.** La réponse Azure contient
   `PronunciationAssessment.AccuracyScore` / `FluencyScore` : `extrairePhonemes()`
   ne les lit jamais (test « GARDE-FEU §10 » dans `tests/proxy.test.ts`).
2. **Journal minimal (RNF-P2)** : horodatage, méthode, chemin, statut, durée, IP
   tronquée. Ni audio, ni texte, ni query string.
3. **Audio jamais persisté (RNF-P1)** : le proxy ne stocke que l'empreinte
   SHA-256 de la requête comme clé de cache. Le cache edge garde la *réponse*
   (des scores), pas l'audio.

## Dégradation gracieuse (RNF-09)

- Quota quotidien dépassé → **429** `{erreur:"quota", byok:true}` : l'UI propose
  le mode BYOK (l'élève ou le juge colle sa propre clé).
- Aucune clé configurée sur le proxy → `{scores:[], provider:"proxy-sans-cle",
  simule:true}` : le navigateur bascule sur son moteur local de démonstration,
  et l'écran affiche un badge « simulation ». La démo publique reste utilisable
  sans aucun compte cloud.

## Déployer le Worker

```bash
cd worker
npm i -g wrangler            # ou npx wrangler
wrangler login
wrangler secret put AZURE_SPEECH_KEY
wrangler deploy              # → https://accent-proxy.<compte>.workers.dev
```

Puis dans l'app (écran Réglages) ou via `VITE_PROXY_URL` au build :
`urlProxy = https://accent-proxy.<compte>.workers.dev`.

Variables dans `wrangler.toml` : région Azure, langue, quota par IP et par jour,
origines CORS autorisées (mettre l'URL du front en production, pas `*`).

### Quota en production
Le quota est en mémoire d'isolate : correct pour une démo (quelques centaines de
requêtes), **non garanti** entre isolates. Pour tenir la charge, adosser
`creerQuota()` à un KV ou à Durable Objects — l'interface est déjà isolée dans
`server/lib.mjs`, le remplacement est local.

## Déployer la démo Node (r630)

```bash
npm run build                          # produit dist/
bash tools/deploy/deploy-r630.sh       # services systemd + tunnel public HTTPS
```

Clé Azure optionnelle : `AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=westeurope`
dans `~/.config/accent.env` (fichier absent du dépôt, non suivi par git).

## Tests

```bash
npx vitest run tests/proxy.test.ts     # 26 tests : quota, cache, journal, Azure
npx tsc -p worker --noEmit             # typage du Worker
```
