# Shinobi Survivors

> **Juego de fans no oficial y sin ánimo de lucro.** No está afiliado, patrocinado ni respaldado por Masashi Kishimoto, Shueisha, TV Tokyo, Studio Pierrot, Bandai Namco ni ningún otro titular de la licencia de *Naruto*. Es gratuito, sin publicidad, compras ni donaciones. *Naruto* y sus personajes son propiedad de sus respectivos titulares.

Juego de fans no oficial del género *survivors* inspirado en *Naruto Shippuden* (ver [DISENO.md](DISENO.md)). TypeScript + Canvas 2D en el navegador y un servidor Node para cuentas, ranking y cooperativo.

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
| `HOST` | `0.0.0.0` | Interfaz donde escucha (`127.0.0.1` detrás de un proxy) |
| `TRUST_PROXY` | — | `1` para tomar la IP del jugador de `X-Forwarded-For` (límite de intentos de inicio de sesión) |

Despliegue previsto: una VM gratuita de Oracle Cloud en Bogotá con Caddy para el HTTPS. La guía paso a paso está en [DESPLIEGUE.md](DESPLIEGUE.md) y los scripts en [`deploy/`](deploy/). El cliente usa `wss://` automáticamente cuando la página va por HTTPS.

## Estructura

- `src/game/` simulación (compartida por el navegador y el servidor)
- `src/render/` dibujo en canvas a partir de una vista de escena
- `src/meta/` progreso: mejoras, pergaminos, misiones, logros
- `src/net/` protocolo, API y cliente del cooperativo
- `src/ui/` pantallas del menú
- `server/` API (cuentas, guardado en la nube, ranking por temporadas) y salas cooperativas que ejecutan la partida

## Aviso legal

- **Sin ánimo de lucro:** el juego no tiene ni tendrá publicidad, compras, suscripciones ni donaciones. Las monedas del juego (ryō, pergaminos) no se pueden comprar con dinero real ni tienen valor económico.
- **Contenido original:** el código, el pixel art (generado por el propio programa) y el sonido (sintetizado) son originales. No se incluye ninguna imagen, sprite, música o sonido del manga, del anime ni de los juegos oficiales.
- **Marcas:** *Naruto* y *Naruto Shippuden*, sus personajes, nombres y técnicas pertenecen a sus titulares y se usan solo como referencia de fan.
- **Retirada:** si eres titular de derechos y quieres que se modifique o retire algo, abre una incidencia en este repositorio y se atenderá lo antes posible.
- **Datos personales (Colombia, Ley 1581 de 2012):** el juego no usa analítica, publicidad, cookies ni recursos de terceros (la fuente se sirve desde el propio servidor). Las cuentas solo guardan nombre de usuario, contraseña cifrada (scrypt), progreso, puntuaciones y la fecha y versión de la autorización de tratamiento de datos (casilla obligatoria al registrarse); no se pide correo. Los usuarios pueden borrar su cuenta y todos sus datos desde el menú. Servidor previsto en Oracle Cloud, región Bogotá.
- **Uso de IA:** el código, el diseño y el pixel art (dibujado por código) se desarrollaron con ayuda de un asistente de IA (Claude, de Anthropic), bajo dirección y revisión humana. El juego no usa IA en tiempo de ejecución ni usa datos de jugadores para entrenar IA.
- El texto completo para jugadores está en [`public/legal.html`](public/legal.html) (se publica en `/legal.html`). **Antes de publicar, rellena los campos entre corchetes** de la política de tratamiento de datos (responsable, ciudad, correo, dirección y teléfono). Si cambias la política de forma sustancial, sube `POLICY_VERSION` en `server/auth.ts`.

### Recursos de terceros

| Recurso | Licencia |
|---|---|
| Fuente Pixelify Sans (vía `@fontsource/pixelify-sans`) | SIL Open Font License 1.1 (copia en `public/licenses/`) |
| `ws`, `tsx`, Vite, TypeScript | MIT / Apache 2.0 |
