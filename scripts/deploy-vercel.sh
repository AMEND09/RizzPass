#!/usr/bin/env bash
set -euo pipefail

# Deploy helper for Vercel (Linux/macOS)
# - Ensures the Vercel CLI is available (or uses npx)
# - Prompts for or auto-generates JWT_SECRET, DATABASE_URL, NEXT_PUBLIC_BASE_URL
# - Optionally links project to an existing Vercel project or creates a new one
# - Uploads env vars to Vercel and runs a production deploy

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

print() { printf "%s\n" "$*"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

VCMD=""
if command_exists vercel; then
  VCMD=vercel
elif command_exists npx; then
  VCMD="npx vercel"
else
  print "Error: neither 'vercel' nor 'npx' found. Install the Vercel CLI or ensure npx is available." >&2
  exit 1
fi

print "Using Vercel command: $VCMD"

# Helper: generate a secure random secret
gen_secret() {
  if command_exists openssl; then
    openssl rand -base64 48 | tr -d '=+' | cut -c1-64
  else
    # fallback using /dev/urandom
    head -c 48 /dev/urandom | base64 | tr -d '=+' | cut -c1-64
  fi
}

read_or_generate() {
  local name="$1"
  local value="${2-}"
  if [ -n "$value" ]; then
    echo "$value"
    return
  fi
  read -r -p "Enter $name (leave empty to auto-generate): " input || true
  if [ -z "$input" ]; then
    if [ "$name" = "JWT_SECRET" ]; then
      gen_secret
    else
      echo
    fi
  else
    echo "$input"
  fi
}

print "Preparing environment variables for deployment. You can pass them via env when invoking this script, e.g. JWT_SECRET=... ./scripts/deploy-vercel.sh"

# Gather variables (env override allowed)
JWT_SECRET_VAL="${JWT_SECRET-}"
DATABASE_URL_VAL="${DATABASE_URL-}"
NEXT_PUBLIC_BASE_URL_VAL="${NEXT_PUBLIC_BASE_URL-}"

JWT_SECRET_VAL=$(read_or_generate "JWT_SECRET" "$JWT_SECRET_VAL")
if [ -z "$DATABASE_URL_VAL" ]; then
  read -r -p "Enter DATABASE_URL (sqlite path like sqlite://./data/db.sqlite or Postgres URL) (recommended Postgres for production): " DATABASE_URL_VAL || true
fi
if [ -z "$NEXT_PUBLIC_BASE_URL_VAL" ]; then
  read -r -p "Enter NEXT_PUBLIC_BASE_URL (e.g. https://rizzpass.example.com) [default: https://$(hostname -f)]: " NEXT_PUBLIC_BASE_URL_VAL || true
  if [ -z "$NEXT_PUBLIC_BASE_URL_VAL" ]; then
    NEXT_PUBLIC_BASE_URL_VAL="https://$(hostname -f)"
  fi
fi

print "Values to be used:"
print "  JWT_SECRET: (hidden)"
print "  DATABASE_URL: ${DATABASE_URL_VAL:-<empty>}"
print "  NEXT_PUBLIC_BASE_URL: $NEXT_PUBLIC_BASE_URL_VAL"

read -r -p "Proceed to set these env vars in Vercel and deploy? [y/N] " confirm || true
if [[ ! "$confirm" =~ ^[Yy] ]]; then
  print "Aborted by user."; exit 0
fi

# Ensure project linked
print "Linking project (interactive if necessary)..."
set +e
LINK_OUT=$(eval "$VCMD link --yes" 2>&1)
RC=$?
set -e
print "$LINK_OUT"
if [ $RC -ne 0 ]; then
  print "Warning: 'vercel link' may have failed or requires login. Try running '$VCMD login' first." >&2
fi

# Add env vars to Vercel (production environment)
print "Setting environment variables on Vercel (production)..."
eval "$VCMD env add JWT_SECRET production" <<< "$JWT_SECRET_VAL"
eval "$VCMD env add DATABASE_URL production" <<< "$DATABASE_URL_VAL"
eval "$VCMD env add NEXT_PUBLIC_BASE_URL production" <<< "$NEXT_PUBLIC_BASE_URL_VAL"

print "Triggering production deploy..."
eval "$VCMD --prod"

print "Done. Check the Vercel dashboard for the deployment URL and runtime logs."
