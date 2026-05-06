#!/bin/bash
# Script de déploiement de l'application Inventaire
# À exécuter sur le serveur distant via SSH

set -e

PORT=4040
APP_DIR=/opt/inventaire
REPO_URL="https://github.com/momssn-commits/inventaire.git"
NODE_MAJOR=20

echo "════════════════════════════════════════"
echo "   DÉPLOIEMENT INVENTAIRE — PORT $PORT  "
echo "════════════════════════════════════════"

# 1. Installer Node.js si absent
if ! command -v node >/dev/null; then
  echo "▶ Installation de Node.js $NODE_MAJOR via NodeSource..."
  apt-get update -qq
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x 2>/dev/null | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
fi
echo "  Node.js : $(node --version), npm : $(npm --version)"

# 2. Cloner ou mettre à jour le repo
if [ ! -d "$APP_DIR" ]; then
  echo "▶ Clonage du dépôt..."
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "▶ Mise à jour du dépôt..."
  cd "$APP_DIR" && git fetch && git reset --hard origin/main
fi

cd "$APP_DIR"

# 3. Configurer .env (avec JWT_SECRET aléatoire fort)
if [ ! -f .env ]; then
  echo "▶ Génération du .env..."
  JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
  cat > .env <<EOF
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="production"
PORT=$PORT
EOF
  chmod 600 .env
fi

# 4. Installer les dépendances + générer Prisma + initialiser la DB
echo "▶ npm install..."
npm install --no-audit --no-fund --prefer-offline 2>&1 | tail -3

echo "▶ Génération du client Prisma..."
npx prisma generate 2>&1 | tail -2

if [ ! -f prisma/dev.db ]; then
  echo "▶ Initialisation de la base de données..."
  npx prisma db push --skip-generate 2>&1 | tail -2
  npm run db:seed 2>&1 | tail -3
fi

# 5. Build de production
echo "▶ Build Next.js..."
npm run build 2>&1 | tail -5

# 6. Installer PM2 si absent
if ! command -v pm2 >/dev/null; then
  echo "▶ Installation de PM2..."
  npm install -g pm2 2>&1 | tail -2
fi

# 7. Démarrer / redémarrer l'app via PM2
echo "▶ (Re)démarrage de l'application..."
PM2_NAME=inventaire
if pm2 list 2>/dev/null | grep -q "$PM2_NAME"; then
  pm2 reload "$PM2_NAME" --update-env
else
  cd "$APP_DIR"
  PORT=$PORT pm2 start "npm run start" --name "$PM2_NAME" --time
fi
pm2 save 2>&1 | tail -1

# 8. Démarrage automatique au boot
if [ ! -f /etc/systemd/system/pm2-root.service ]; then
  pm2 startup systemd -u root --hp /root 2>&1 | tail -1
fi

# 9. Ouvrir le port dans le pare-feu si UFW est actif
if command -v ufw >/dev/null; then
  if ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow $PORT/tcp >/dev/null 2>&1 || true
    echo "  Port $PORT ouvert dans UFW"
  fi
fi

echo ""
echo "✅ Déploiement terminé"
echo ""
sleep 2
pm2 list 2>&1 | grep -E "(inventaire|│)" | head -10
echo ""
echo "▶ Test interne (localhost:$PORT)"
curl -s -o /dev/null -w "  Health: HTTP %{http_code} en %{time_total}s\n" http://localhost:$PORT/api/v1/health
echo ""
echo "🌐 Application accessible : http://187.124.52.164:$PORT"
echo "📚 Documentation API     : http://187.124.52.164:$PORT/api/docs"
echo "🔐 Compte initial        : admin@inventaire.fr / admin123"
