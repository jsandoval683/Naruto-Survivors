#!/usr/bin/env bash
# Copia consistente de la base de datos (válida con el servidor en marcha).
# Guarda las últimas 14 en /var/lib/naruto-survivors/backups.
set -euo pipefail
DATA=/var/lib/naruto-survivors
DB="$DATA/naruto-survivors.db"
OUT="$DATA/backups/naruto-survivors-$(date +%F-%H%M).db"

[ -f "$DB" ] || exit 0
sqlite3 "$DB" ".backup '$OUT'"
gzip -f "$OUT"
ls -1t "$DATA"/backups/naruto-survivors-*.db.gz | tail -n +15 | xargs -r rm --
