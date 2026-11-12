#!/usr/bin/env bash
# Instalación inicial en una VM Ubuntu 24.04 de Oracle Cloud (ARM Ampere A1 o AMD Micro).
# Uso (en la VM):  sudo bash setup.sh tu-dominio.com
# Instala Node 24 y Caddy, abre los puertos 80/443, descarga el juego, lo compila
# y lo deja corriendo como servicio con HTTPS automático.
set -euo pipefail

DOMAIN="${1:?Uso: sudo bash setup.sh tu-dominio.com}"
REPO="${REPO:-https://github.com/jsandoval683/Naruto-Survivors.git}"
BRANCH="${BRANCH:-main}"
APP=/opt/naruto-survivors
DATA=/var/lib/naruto-survivors
SVC=naruto-survivors

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> Paquetes del sistema"
apt-get update
apt-get -y upgrade
apt-get install -y curl git sqlite3 gnupg ca-certificates debian-keyring debian-archive-keyring apt-transport-https netfilter-persistent

echo "==> Swap (solo si la máquina tiene menos de 2 GB de RAM, para poder compilar)"
if [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 2000000 ] && [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node.js 24"
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi

echo "==> Caddy (proxy con HTTPS automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi

echo "==> Cortafuegos de la VM: abrir 80 y 443"
# Las imágenes Ubuntu de Oracle traen iptables con un REJECT al final de INPUT:
# las reglas nuevas tienen que ir antes de él.
for port in 80 443; do
  if ! iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    line=$(iptables -L INPUT --line-numbers | awk '/REJECT/{print $1; exit}')
    if [ -n "$line" ]; then
      iptables -I INPUT "$line" -p tcp --dport "$port" -m state --state NEW -j ACCEPT
    else
      iptables -A INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT
    fi
  fi
done
netfilter-persistent save

echo "==> Usuario y carpetas"
id naruto >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --create-home --shell /usr/sbin/nologin naruto
mkdir -p "$DATA/backups"
chown -R naruto:naruto "$DATA"
chmod 750 "$DATA"

echo "==> Código del juego"
if [ ! -d "$APP/.git" ]; then
  git clone --branch "$BRANCH" "$REPO" "$APP"
fi
chown -R naruto:naruto "$APP"
cd "$APP"
sudo -u naruto -H git pull --ff-only
sudo -u naruto -H npm ci
sudo -u naruto -H npm run build

echo "==> Servicio"
install -m 644 "$APP/deploy/naruto-survivors.service" /etc/systemd/system/$SVC.service
install -m 755 "$APP/deploy/backup.sh" /usr/local/bin/naruto-backup
install -m 755 "$APP/deploy/update.sh" /usr/local/bin/naruto-update
systemctl daemon-reload
systemctl enable --now $SVC
systemctl restart $SVC

echo "==> Copia de seguridad diaria (03:30)"
echo "30 3 * * * naruto /usr/local/bin/naruto-backup" > /etc/cron.d/naruto-backup

echo "==> Caddy para $DOMAIN"
sed "s/DOMINIO/$DOMAIN/" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

echo
echo "Listo. Abre https://$DOMAIN (el certificado puede tardar un minuto la primera vez)."
echo "Estado:  systemctl status $SVC      Registros:  journalctl -u $SVC -f"
