# Naruto Shippuden Survivors

Juego de fans no oficial del género *survivors* (ver [DISENO.md](DISENO.md)). TypeScript + Canvas 2D en el navegador y un servidor Node para cuentas, ranking y cooperativo.

## Desarrollo

Necesitas Node 22.5 o superior (usa el SQLite integrado de Node).

```bash
npm install
```

En dos terminales:

```bash
npm run server
```

```bash
npm run dev
```

Abre http://localhost:5173. Vite reenvía `/api` y `/ws` al servidor (puerto 8787). Sin el servidor el juego funciona igual en solitario; solo fallan las cuentas, el ranking y el cooperativo.

Simulación de equilibrio (con `npm run dev` abierto, en la consola del navegador):

```js
(await import('/src/dev/sim.ts')).simulate('naruto')
```

## Producción

```bash
npm run build
```

```bash
npm start
```

Un solo proceso sirve el juego (`dist/`), la API y el WebSocket del cooperativo en `PORT` (8787 por defecto). Variables:

| Variable | Por defecto | Qué es |
|---|---|---|
| `PORT` | `8787` | Puerto HTTP |
| `DB_PATH` | `data/naruto-survivors.db` | Base de datos SQLite (necesita un disco persistente) |
| `STATIC_DIR` | `dist` | Carpeta del juego compilado |

Sirve en cualquier sitio que ejecute Node con un disco persistente (un VPS, Fly.io, Railway, Render con disco…). Ponlo detrás de HTTPS: el cliente usa `wss://` automáticamente cuando la página va por HTTPS.

## Estructura

- `src/game/` simulación (compartida por el navegador y el servidor)
- `src/render/` dibujo en canvas a partir de una vista de escena
- `src/meta/` progreso: mejoras, pergaminos, misiones, logros
- `src/net/` protocolo, API y cliente del cooperativo
- `src/ui/` pantallas del menú
- `server/` API (cuentas, guardado en la nube, ranking por temporadas) y salas cooperativas que ejecutan la partida
