#!/usr/bin/env bash
# publish-pages.sh — publie le build statique sur GitHub Pages (URL publique stable).
#
# Pages sert la branche `gh-pages` à la racine : https://<owner>.github.io/accent/
# Le build Vite utilise `base: './'` (chemins relatifs), donc il fonctionne aussi
# bien sous ce sous-chemin qu'à la racine d'un domaine.
#
# Aucun proxy sur Pages : `/api/analyse` répond 404 et le navigateur bascule sur
# son moteur local de démonstration, signalé « simulation » à l'écran
# (voir src/providers/proxy.ts). Pour la mesure réelle, déployer le Worker
# Cloudflare (worker/README.md) ou le serveur r630 (tools/deploy/deploy-r630.sh)
# et renseigner l'URL du proxy dans Réglages.
#
# Usage : bash tools/deploy/publish-pages.sh [--sans-build]
set -euo pipefail
export LC_ALL=C PATH="$HOME/.local/bin:$HOME/bin:$PATH"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d /tmp/accent-pages.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

die()  { echo "ERREUR: $*" >&2; exit 1; }
step() { echo "==> $*"; }

cd "$RACINE"
[ -d .git ] || die "à lancer depuis un clone du dépôt"

if [ "${1:-}" != "--sans-build" ]; then
  step "Build + gardes"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npm run build
  node tools/check-bundle-size.mjs
fi
[ -f dist/index.html ] || die "dist/ absent : relance sans --sans-build"

step "Préparation de la branche gh-pages"
cp -a dist/. "$TMP"/
touch "$TMP/.nojekyll"
cat > "$TMP/README.txt" <<EOF
Accent — build publié sur GitHub Pages.
Généré depuis $(git rev-parse --short HEAD) le $(date -u '+%Y-%m-%d %H:%M UTC').
Ne pas éditer : republier avec tools/deploy/publish-pages.sh.
EOF

SHA="$(git rev-parse --short HEAD)"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name=BaptisteFaisy -c user.email=baptiste.faisy@gmail.com \
    commit -q -m "deploy: build Accent pour GitHub Pages (depuis ${SHA})"
git remote add origin "$(git -C "$RACINE" remote get-url origin)"

step "Publication (force : la branche ne porte que du build)"
git push -f -q origin gh-pages

step "Attente que Pages réponde (3 min max)"
URL="$(git -C "$RACINE" remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##; s#^([^/]+)/#\L\1\E/#')"
SITE="https://${URL%%/*}.github.io/${URL##*/}/"
ok=0
for _ in $(seq 1 36); do
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$SITE" 2>/dev/null || true)"
  [ "$code" = "200" ] && { ok=1; break; }
  sleep 5
done
[ "$ok" = 1 ] || die "Pages ne répond pas encore : $SITE (vérifier Settings → Pages)"
step "Site public : $SITE"
