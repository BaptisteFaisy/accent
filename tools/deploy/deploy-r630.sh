#!/usr/bin/env bash
# deploy-r630.sh — publie la démo Accent en HTTPS public depuis le r630.
#
# Deux services systemd utilisateur :
#   accent-web     : dist/ en statique + /api (proxy Azure si clé, sinon mode démo)
#   accent-tunnel  : quick tunnel Cloudflare → URL publique HTTPS (micro OK)
#
# Pourquoi un tunnel et pas Tailscale Funnel : le funnel du r630 est déjà pris
# par un autre projet sur `/` et sa configuration exige root (pas de sudo ici).
# Le quick tunnel ne demande aucun compte ni aucune clé.
#
# Usage : bash tools/deploy/deploy-r630.sh [--sans-build]
set -euo pipefail
export LC_ALL=C PATH="$HOME/.local/bin:$HOME/bin:$PATH"

# systemd --user a besoin du bus de session : absent d'un shell non interactif
# (agent, cron). On le reconstruit à partir de l'uid.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UNITE="$HOME/.config/systemd/user"
CLOUDFLARED="$HOME/tools/cloudflared"
URL_FILE="$RACINE/DEPLOY-URL.txt"

die() { echo "ERREUR: $*" >&2; exit 1; }
step() { echo "==> $*"; }

[ -f "$CLOUDFLARED" ] || die "cloudflared absent : $CLOUDFLARED"
mkdir -p "$UNITE"

if [ "${1:-}" != "--sans-build" ]; then
  step "Build (tsc --noEmit + vite build)"
  cd "$RACINE"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npm run build
  node tools/check-bundle-size.mjs
fi

[ -f "$RACINE/dist/index.html" ] || die "dist/ absent : relance sans --sans-build"

step "Installation des unités systemd utilisateur"
for u in accent-web accent-tunnel; do
  cp "$RACINE/tools/deploy/$u.service" "$UNITE/$u.service"
done
systemctl --user daemon-reload
systemctl --user enable --now accent-web.service
sleep 2
# L'URL du quick tunnel change à CHAQUE redémarrage : on borne la lecture du
# journal au démarrage qu'on provoque, sinon on relit l'URL précédente (piège
# payé le 11/11 : DEPLOY-URL.txt périmée → 530 côté Cloudflare).
SINCE="$(date '+%Y-%m-%d %H:%M:%S')"
systemctl --user restart accent-tunnel.service 2>/dev/null || systemctl --user start accent-tunnel.service

step "Attente du serveur local (30 s max)"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS -m 2 -o /dev/null http://127.0.0.1:8820/; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || die "serveur local muet sur 8820 : journalctl --user -u accent-web -n 50"

step "Attente de l'URL publique (60 s max)"
url=""
for _ in $(seq 1 45); do
  url="$(journalctl --user -u accent-tunnel --since "$SINCE" --no-pager 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)"
  [ -n "$url" ] && break
  sleep 2
done
[ -n "$url" ] || die "URL de tunnel introuvable : journalctl --user -u accent-tunnel -f"

printf '%s\n' "$url" > "$URL_FILE"
step "Démo publique : $url"
echo "    (écrite dans DEPLOY-URL.txt — elle change à chaque redémarrage du tunnel)"
echo "    Test micro : ouvrir l'URL sur téléphone, autoriser le micro, lire une phrase."
