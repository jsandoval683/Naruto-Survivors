# Despliegue en Oracle Cloud (región Bogotá)

Todo corre en **una sola VM gratuita**: el servidor Node sirve el juego, la API y el cooperativo
(WebSocket) en `127.0.0.1:8787`, y **Caddy** delante pone el HTTPS (certificado gratuito y renovación
automática). La base de datos es un archivo SQLite en `/var/lib/naruto-survivors`.

```
Jugador ──HTTPS/WSS──▶ Caddy :443 ──▶ Node :8787 (juego + /api + /ws) ──▶ SQLite
```

Los archivos de la carpeta [`deploy/`](deploy/) hacen casi todo el trabajo:

| Archivo | Qué hace |
| --- | --- |
| `setup.sh` | Instalación inicial: Node 24, Caddy, cortafuegos, compilación, servicio y copias diarias |
| `update.sh` | Publica la última versión de `main` (hace una copia de la base de datos antes) |
| `backup.sh` | Copia consistente de la base de datos; guarda las 14 últimas |
| `naruto-survivors.service` | Servicio de systemd (arranque automático y reinicio si falla) |
| `Caddyfile` | Proxy HTTPS y cabeceras de seguridad |

---

## 1. Cuenta de Oracle Cloud

1. Regístrate en Oracle Cloud Free Tier. Pide una tarjeta para verificar tu identidad, pero no cobra
   mientras uses solo recursos *Always Free*.
2. **Región de origen (home region): `Colombia Central (Bogotá)`**. Elígela bien: **no se puede cambiar**
   y los recursos gratuitos solo existen en la región de origen.

> Oracle puede **recuperar instancias gratuitas inactivas** (uso de CPU muy bajo durante 7 días). Si
> pasa, o si no hay capacidad para crear la VM, puedes pasar la cuenta a *Pay As You Go*. Los recursos
> *Always Free* siguen sin coste, pero vigila que no crees nada fuera del nivel gratuito. Revisa las
> condiciones vigentes en la documentación de Oracle.

## 2. Crear la máquina virtual

En la consola: **Compute → Instances → Create instance**.

- **Image:** Canonical Ubuntu **24.04**.
- **Shape:** `VM.Standard.A1.Flex` (ARM Ampere) con **2 OCPU y 12 GB** de RAM. Es gratis hasta 4 OCPU
  y 24 GB en total, y sobra para este juego. Si sale *Out of capacity*, reintenta más tarde o usa
  `VM.Standard.E2.1.Micro` (1 GB, también gratis; `setup.sh` añade memoria swap para poder compilar).
- **Networking:** crea una VCN nueva con **subred pública** y marca *Assign a public IPv4 address*.
- **SSH keys:** *Generate a key pair for me* → **descarga la clave privada** (`.key`) y guárdala bien.
  Sin ella no podrás entrar a la máquina.

Cuando arranque, apunta la **IP pública** que aparece en la ficha de la instancia.

## 3. Abrir los puertos 80 y 443 en Oracle

En la ficha de la instancia: **subred → Security Lists → Default Security List → Add Ingress Rules**.
Añade dos reglas:

| Source CIDR | IP Protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(El cortafuegos interno de la VM lo abre `setup.sh`. Hacen falta los dos.)

## 4. Dominio

HTTPS necesita un nombre de dominio que apunte a la IP de la VM. Opciones:

- **Dominio propio** (unos USD 10–15 al año un `.com`). En el panel del registrador crea un registro
  **A** con el nombre `@` (o un subdominio como `juego`) y la IP pública de la VM.
- **Gratis con DuckDNS:** entra en duckdns.org, crea un subdominio (`algo.duckdns.org`) y pon la IP de la VM.
- **Solo para probar:** `IP-CON-GUIONES.sslip.io` (por ejemplo `129-146-10-20.sslip.io`) apunta solo a esa
  IP sin configurar nada. No lo uses como dirección definitiva.

Comprueba que el dominio ya resuelve antes del paso 6:

```bash
nslookup tu-dominio.com
```

## 5. Entrar a la VM por SSH (desde Windows)

En PowerShell. La primera vez, restringe los permisos de la clave porque si no SSH la rechaza:

```powershell
icacls "C:\ruta\ssh-key.key" /inheritance:r /grant:r "$($env:USERNAME):R"
```

```powershell
ssh -i "C:\ruta\ssh-key.key" ubuntu@IP_PUBLICA
```

## 6. Instalar el juego

Antes, **sube a GitHub** los cambios (incluida la carpeta `deploy/`). En la VM:

```bash
curl -fsSL https://raw.githubusercontent.com/jsandoval683/Naruto-Survivors/main/deploy/setup.sh -o setup.sh
```

```bash
sudo bash setup.sh tu-dominio.com
```

Tarda unos minutos. Al terminar abre `https://tu-dominio.com`, crea una cuenta de prueba y prueba el
cooperativo desde dos navegadores.

> **Si el repositorio es privado**, la VM no puede descargarlo así. Lo más sencillo es hacerlo público.
> Si no, crea un *deploy key* de solo lectura en GitHub y ejecuta
> `sudo REPO=git@github.com:jsandoval683/Naruto-Survivors.git bash setup.sh tu-dominio.com`.

## 7. Publicar actualizaciones

En tu PC haz commit y push a `main`. Después:

```bash
ssh -i "C:\ruta\ssh-key.key" ubuntu@IP_PUBLICA sudo naruto-update
```

Hace una copia de la base de datos, descarga, compila y reinicia. Las partidas cooperativas en curso se
cortan durante el reinicio (unos segundos). Las cuentas y el progreso no se pierden.

## 8. Copias de seguridad

- Cada día a las 03:30 (hora del servidor, UTC) y antes de cada actualización se guarda una copia en
  `/var/lib/naruto-survivors/backups/` (las 14 últimas).
- Descarga alguna de vez en cuando a tu PC, porque si se pierde la VM se pierden también:

  ```powershell
  scp -i "C:\ruta\ssh-key.key" "ubuntu@IP_PUBLICA:/var/lib/naruto-survivors/backups/*.gz" .
  ```

- Restaurar una copia:

  ```bash
  sudo systemctl stop naruto-survivors
  ```

  ```bash
  gunzip -c /var/lib/naruto-survivors/backups/ARCHIVO.db.gz | sudo -u naruto tee /var/lib/naruto-survivors/naruto-survivors.db > /dev/null
  ```

  ```bash
  sudo rm -f /var/lib/naruto-survivors/naruto-survivors.db-wal /var/lib/naruto-survivors/naruto-survivors.db-shm && sudo systemctl start naruto-survivors
  ```

## 9. Comandos útiles

| Para… | Comando |
| --- | --- |
| Ver si el juego está en marcha | `systemctl status naruto-survivors` |
| Ver los registros en directo | `journalctl -u naruto-survivors -f` |
| Reiniciar el juego | `sudo systemctl restart naruto-survivors` |
| Registros de Caddy / HTTPS | `journalctl -u caddy -n 50` |
| Número de cuentas | `sudo -u naruto sqlite3 /var/lib/naruto-survivors/naruto-survivors.db "select count(*) from users"` |

**Si el HTTPS no funciona:** casi siempre es que el dominio aún no apunta a la IP o que faltan las
reglas del paso 3. Corrígelo y ejecuta `sudo systemctl restart caddy`.

## Antes de anunciarlo

- [ ] Rellenar los campos entre corchetes de `public/legal.html` (punto 4.1) y publicar con `naruto-update`.
- [ ] Comprobar que el enlace de GitHub Issues de la página legal funciona (repositorio público).
- [ ] Crear una cuenta, jugar una partida, probar el ranking y el cooperativo, y borrar la cuenta de prueba.
- [ ] Descargar a tu PC una primera copia de seguridad.
