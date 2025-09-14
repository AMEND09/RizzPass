#!/usr/bin/env bash
set -euo pipefail

# deploy-selfhost.sh
# Deploy RizzPass on a single Linux server. The script will:
# - prompt for or generate secrets (JWT_SECRET, DATABASE_URL, NEXT_PUBLIC_BASE_URL)
# - install Node.js if missing (will prompt)
# - install dependencies and build the Next.js app
# - create a systemd service to run `npm start` under a deploy user
# - optionally configure nginx as a reverse proxy and obtain TLS via certbot

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="rizzpass"
SERVICE_USER="rizzpass"
SERVICE_DIR="/var/www/$APP_NAME"
NODE_BIN=""

print() { printf "%s\n" "$*"; }

ensure_root() {
  if [ "$EUID" -ne 0 ]; then
    print "This script must be run as root (or with sudo) to create system users and services.";
    exit 1;
  fi
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

gen_secret() {
  if command_exists openssl; then
    openssl rand -base64 48 | tr -d '=+' | cut -c1-64
  else
    head -c 48 /dev/urandom | base64 | tr -d '=+' | cut -c1-64
  fi
}

read_or_env() {
  local name="$1"; local default="$2"; local val="${!name-}"
  if [ -n "$val" ]; then
    echo "$val"; return
  fi
  read -r -p "Enter $name${default:+ [$default]}: " input || true
  if [ -z "$input" ]; then
    if [ -n "$default" ]; then echo "$default"; else echo; fi
  else
    echo "$input";
  fi
}

ensure_node() {
  if command_exists node && command_exists npm; then
    NODE_BIN=$(command -v node)
    print "Found node: $NODE_BIN"
    return
  fi
  print "Node.js not found. Please install Node 18+ (distribution packages or NodeSource)."
  read -r -p "Attempt apt-get install nodejs/npm now? [y/N] " yn || true
  if [[ "$yn" =~ ^[Yy] ]]; then
    apt-get update && apt-get install -y nodejs npm
    NODE_BIN=$(command -v node || true)
    if [ -z "$NODE_BIN" ]; then
      print "Node installation failed. Install Node.js manually and re-run."; exit 1
    fi
  else
    print "Abort and install Node.js before running this script."; exit 1
  fi
}

ensure_root
ensure_node

print "Preparing deployment directory $SERVICE_DIR"
mkdir -p "$SERVICE_DIR"
rsync -a --exclude='.git' --exclude='node_modules' "$ROOT_DIR/" "$SERVICE_DIR/"

# Gather config
JWT_SECRET_VAL="$(read_or_env JWT_SECRET "$(gen_secret)")"
DATABASE_URL_VAL="$(read_or_env DATABASE_URL "sqlite://$SERVICE_DIR/data/db.sqlite")"
NEXT_PUBLIC_BASE_URL_VAL="$(read_or_env NEXT_PUBLIC_BASE_URL "https://$(hostname -f)")"

print "Config summary:"
print "  JWT_SECRET: (hidden)"
print "  DATABASE_URL: $DATABASE_URL_VAL"
print "  NEXT_PUBLIC_BASE_URL: $NEXT_PUBLIC_BASE_URL_VAL"

read -r -p "Proceed to install dependencies, build, and configure systemd service? [y/N] " confirm || true
if [[ ! "$confirm" =~ ^[Yy] ]]; then print "Aborted"; exit 0; fi

# Create deploy user
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  print "Creating service user $SERVICE_USER"
  useradd --system --home "$SERVICE_DIR" --shell /usr/sbin/nologin "$SERVICE_USER" || true
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$SERVICE_DIR"

print "Installing npm dependencies and building app (as $SERVICE_USER)"
su -s /bin/bash -c "cd '$SERVICE_DIR' && npm ci --no-audit --no-fund && npm run build" "$SERVICE_USER"

# Write environment file
ENV_FILE="/etc/$APP_NAME.env"
print "Writing env file to $ENV_FILE"
cat > "$ENV_FILE" <<EOF
JWT_SECRET=$JWT_SECRET_VAL
DATABASE_URL=$DATABASE_URL_VAL
NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL_VAL
PORT=3000
NODE_ENV=production
EOF
chmod 640 "$ENV_FILE"
chown root:"$SERVICE_USER" "$ENV_FILE"

# Create systemd service
SERVICE_PATH="/etc/systemd/system/$APP_NAME.service"
print "Creating systemd service $SERVICE_PATH"
cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=RizzPass Next.js app
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$SERVICE_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $SERVICE_DIR/node_modules/.bin/next start -p \\$PORT
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$APP_NAME"

print "Systemd service started. Check logs with: journalctl -u $APP_NAME -f"

read -r -p "Would you like to configure nginx as a reverse proxy and obtain TLS with certbot? [y/N] " do_nginx || true
if [[ "$do_nginx" =~ ^[Yy] ]]; then
  if ! command_exists nginx; then
    apt-get update && apt-get install -y nginx
  fi
  if ! command_exists certbot; then
    apt-get install -y certbot python3-certbot-nginx
  fi

  # nginx site config
  DOMAIN=$(echo "$NEXT_PUBLIC_BASE_URL_VAL" | sed -E 's#https?://##' | sed -E 's#/$##')
  NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
  print "Writing nginx config for $DOMAIN"
  cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name $DOMAIN;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/$APP_NAME
  nginx -t && systemctl restart nginx

  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@$DOMAIN || print "certbot failed or domain not pointed";
  print "Nginx + TLS configured (if certbot succeeded)."
fi

print "Deployment completed. Visit $NEXT_PUBLIC_BASE_URL_VAL"
