#!/usr/bin/env bash
# Publica la última versión de la rama main.  Uso en la VM:  sudo naruto-update
set -euo pipefail
APP=/opt/naruto-survivors

[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo."; exit 1; }
# Como el usuario del servicio, para que SQLite no deje archivos -wal/-shm de root.
sudo -u naruto /usr/local/bin/naruto-backup
cd "$APP"
sudo -u naruto -H git pull --ff-only
sudo -u naruto -H npm ci
sudo -u naruto -H npm run build
install -m 644 deploy/naruto-survivors.service /etc/systemd/system/naruto-survivors.service
install -m 755 deploy/backup.sh /usr/local/bin/naruto-backup
install -m 755 deploy/update.sh /usr/local/bin/naruto-update
systemctl daemon-reload
systemctl restart naruto-survivors
echo "Actualizado a $(git log -1 --format='%h %s')"
