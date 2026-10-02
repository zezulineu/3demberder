#!/usr/bin/env bash
# One-time setup of 3demberder on a VPS that already runs host-level nginx.
# Safe to re-run. It never touches other sites: it only adds /etc/nginx/sites-available/3demberder
# and the /opt/3demberder folder. Run as root:  bash bootstrap.sh
set -euo pipefail
DOMAIN="${DOMAIN:-3d.ruscona.com}"
PORT="${PORT:-3000}"
DIR=/opt/3demberder
ORIGINS="${ALLOWED_ORIGINS:-https://www.ruscona.cz https://ruscona.cz https://www.ruscona.de https://ruscona.de https://www.ruscona.at https://ruscona.at}"
RAW=https://raw.githubusercontent.com/zezulineu/3demberder/main

[ "$(id -u)" = 0 ] || { echo "Run as root"; exit 1; }

if ss -tln | grep -q "127.0.0.1:${PORT}\b\|:${PORT}\b"; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q 3demberder; then
    echo "Port ${PORT} is already used by something else. Re-run with PORT=<free port>."; exit 1
  fi
fi

command -v docker >/dev/null || { echo "Installing Docker…"; curl -fsSL https://get.docker.com | sh; }
docker compose version >/dev/null

mkdir -p "$DIR/data" && cd "$DIR"
curl -fsSL "$RAW/docker-compose.prod.yml" -o docker-compose.yml
sed -i "s#127.0.0.1:3000:3000#127.0.0.1:${PORT}:3000#" docker-compose.yml

if [ ! -f .env ]; then
  PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)
  cat > .env <<ENV
PUBLIC_URL=https://${DOMAIN}
ADMIN_PASSWORD=${PASS}
ALLOWED_ORIGINS=${ORIGINS}
ENV
  chmod 600 .env
  echo "Admin password (save it): ${PASS}"
fi

docker compose pull
docker compose up -d

cat > /etc/nginx/sites-available/3demberder <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 200m;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/3demberder /etc/nginx/sites-enabled/3demberder
nginx -t && systemctl reload nginx

command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect
echo "Done: https://${DOMAIN}/admin  (user: admin)"
