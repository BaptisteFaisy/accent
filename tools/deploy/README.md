# Déploiement de la démo (r630 → URL publique HTTPS)

Le produit est une webapp statique + un proxy. Deux hébergements sont prévus :

| Cible | Usage | Commande |
|---|---|---|
| **GitHub Pages** | URL publique **stable** : https://tradoooo.github.io/accent/ | `bash tools/deploy/publish-pages.sh` |
| **r630 + tunnel Cloudflare** | démo avec proxy `/api` (clé Azure côté serveur), 0 $ | `bash tools/deploy/deploy-r630.sh` |
| **Cloudflare Pages + Workers** | production propre, edge + quota + cache | voir [`../../worker/README.md`](../../worker/README.md) |

Sur **Pages** il n'y a pas de proxy : `/api/analyse` répond 404 et le navigateur
bascule sur son moteur local de démonstration, **signalé « simulation » à
l'écran** (`src/providers/proxy.ts`). Pour la mesure réelle, déployer le Worker
ou le serveur r630, puis renseigner l'URL du proxy dans Réglages (ou coller une
clé Azure en mode BYOK).

## Pourquoi un quick tunnel et pas Tailscale Funnel

Le r630 expose déjà un funnel public sur `/` (un autre projet), et modifier la
configuration `tailscale serve` demande **root** — or le compte agent tourne avec
`no_new_privs` (pas de sudo). `tailscale serve --set-path` a d'ailleurs commencé
par annoncer « Removing Funnel » avant d'être refusé : à ne pas retenter.

Le quick tunnel `cloudflared` ne demande **ni compte, ni clé, ni root** : il
donne une URL `https://<alea>.trycloudflare.com` en HTTPS public, ce qui suffit
au microphone (un contexte sécurisé est obligatoire pour `getUserMedia`).

**Contrepartie à connaître** : l'URL change à chaque redémarrage du tunnel. Elle
est écrite dans `DEPLOY-URL.txt` (non suivi par git) et affichée par le script.
Pour une URL stable (soumission Devpost), basculer sur Cloudflare Pages.

## Une commande

```bash
bash tools/deploy/deploy-r630.sh            # build + services + tunnel + URL
bash tools/deploy/deploy-r630.sh --sans-build   # redémarre sans reconstruire
```

Ce que fait le script :

1. `npm run build` (typecheck + Vite) puis `tools/check-bundle-size.mjs` (RNF-07) ;
2. installe deux unités systemd **utilisateur** (pas de sudo) :
   - `accent-web.service` → `node server/serve.mjs` sur le port **8820** ;
   - `accent-tunnel.service` → `cloudflared tunnel --url http://127.0.0.1:8820` ;
3. attend le serveur local (30 s) puis l'URL publique (60 s) ;
4. écrit l'URL dans `DEPLOY-URL.txt`.

Le script exporte lui-même `XDG_RUNTIME_DIR` et `DBUS_SESSION_BUS_ADDRESS` :
`systemctl --user` échoue sans eux depuis un shell non interactif (agent, cron).

## Mode réel (Azure Speech) ou mode démonstration

Sans clé, `/api/analyse` répond `proxy-sans-cle` et le navigateur bascule sur son
**moteur local de démonstration**, avec un badge « simulation » à l'écran
(honnêteté exigée par le règlement : toute étape simulée est écrite à l'écran).

Avec une clé (tier gratuit Azure Speech, 5 h audio/mois) :

```bash
mkdir -p ~/.config
umask 077
cat > ~/.config/accent.env <<'ENV'
AZURE_SPEECH_KEY=<ta-clé>
AZURE_SPEECH_REGION=westeurope
ENV
# puis décommenter EnvironmentFile= dans accent-web.service
bash tools/deploy/deploy-r630.sh --sans-build
```

La clé reste sur le serveur : elle n'est jamais dans le bundle (ACCENT.md §18.1).

## Vérifier après déploiement

```bash
U=$(cat DEPLOY-URL.txt)
curl -s -o /dev/null -w '%{http_code}\n' "$U/"          # 200
curl -s "$U/healthz"                                     # {"ok":true,…}
curl -s -o /dev/null -w '%{http_code}\n' "$U/profonde/route"   # 200 (SPA fallback)
```

Puis, sur téléphone : ouvrir l'URL, autoriser le micro, lire une phrase. Le micro
exige HTTPS — le tunnel le fournit.

## Exploitation

```bash
systemctl --user status accent-web accent-tunnel
journalctl --user -u accent-web -n 50          # journal : t, méthode, chemin, statut, ms, IP tronquée
journalctl --user -u accent-tunnel -f          # URL du tunnel au démarrage
systemctl --user restart accent-tunnel         # nouvelle URL
```

RNF-P2 : le journal ne contient **ni audio ni texte d'élève**. RNF-P1 : aucun
audio n'est écrit sur le disque (le cache ne garde que l'empreinte SHA-256 de la
requête et la réponse).

## Disponibilité pendant le jugement (RNF-08)

Le tunnel doit rester actif du 15 au 17 novembre. Les deux unités sont en
`Restart=always`. Un redémarrage du serveur change l'URL : dans ce cas,
relancer `deploy-r630.sh` et mettre à jour le lien de soumission — d'où
l'intérêt de passer sur Cloudflare Pages avant la soumission.
