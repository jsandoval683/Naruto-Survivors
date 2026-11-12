# Shinobi Survivors — Documento de diseño

Basado en el análisis de **PokéSurvivor** (pokesurvivor.com) y **Dragon Ball Survivors** (dbsurvivors.xyz), revisados el 11/11/2026 jugando una partida en cada uno y leyendo sus guías.

---

## 1. Qué son y cómo funcionan

Ambos son clones del género *survivors* (Vampire Survivors / Survivor.io) en navegador, gratis, para PC y móvil:

- Te mueves por un mapa infinito (WASD/flechas, o arrastrando el dedo en móvil: el joystick aparece donde tocas).
- **Tus ataques salen solos** (apuntan al enemigo más cercano o tienen patrón propio). Tú solo esquivas y te colocas.
- Los enemigos sueltan **cristales de experiencia** (DB los llama "ki"). Al recogerlos subes de nivel.
- **Al subir de nivel el juego se pausa** y eliges 1 de 3 cartas: técnica nueva, subir una técnica que ya tienes, o mejora pasiva. Hay botón de **"Volver a elegir"** (reroll) con usos limitados.
- Las oleadas crecen con el tiempo, aparecen élites y **jefes en minutos fijos**.
- Al morir (o ganar) cobras moneda que gastas fuera de la partida en **mejoras permanentes** → cada partida llegas más lejos. Ese es el "incremental".

### Comparativa

| Sistema | PokéSurvivor | Dragon Ball Survivors |
|---|---|---|
| Duración | Infinita; evento final en min 30 | ~20 min (4 sagas), luego modo infinito opcional |
| Personaje inicial | Test de personalidad de 8 preguntas → te asigna compañero | Goku |
| Personajes | 966 (gacha) | 31 (desbloqueo por logros o Tienda) |
| Ataques | Hasta 4 movimientos, **solo 1 activo** (cambias con 1-4) | Hasta **5 técnicas a la vez**, todas activas |
| Estadísticas | Ataque/At.Esp, Def/Def.Esp, crítico, recarga, regen | Poder, Vida, Velocidad, Recarga, Imán, Recuperación, Suerte |
| Evolución de ataques | Al nivel máx + mejora concreta (Ascuas → Llamarada). Vínculo = fusionar 2 en 1 hueco | Transformación a nivel 12 (y 2ª a nivel 24) |
| Afinidades | Tabla de tipos + clima (lluvia potencia Agua…) | — |
| Coleccionable en partida | Grietas → arena con legendario | 7 esferas del dragón → Shenlong: 3 deseos (vida / +1 nivel a todo / limpiar pantalla) |
| Objetos | Equipables (Restos, Vidasfera) y esferas de un uso (teclas 5-8) | Cápsulas en el mapa (curación, zeni, imán, Kaioken, radar), cápsulas doradas de élites/jefes (varias mejoras), estación Capsule Corp (elige regalo) |
| Mejoras permanentes | **Por personaje**: Vitalidad +8 vida, Fuerza +4%, Zancada +3%, Reflejos -3% recarga, Coraza +2%, Síntesis +0,2 vida/s, Imán +12%, Sabiduría +5% XP, Fortuna +8% monedas, Crítico +3%; y desbloqueos: +1 reroll, vetar 1 ataque, elegir ataque inicial, empezar con 2 | Por personaje: Poder, Vida, Velocidad, Recarga, Imán, Recuperación, Suerte |
| Gacha | Tragaperras por región, x10 / x100. Legendaria 1,5%, Épica 6,5%, Rara 17%, Poco común 30%, Común 45%, Shiny 1%. x10 garantiza Épica; **pity a 70**. Repetidos → monedas | Cápsulas de la suerte: Común 70%, Raro 24%, Épico 5%, Legendario 1%; **pity a 80** |
| Tienda | Rotación diaria (8 MT) | Guerreros, skins, auras, tickets |
| Retención | Misiones diarias/semanales, 130 logros, títulos, perfil, ranking | Misiones diarias (3 + bonus), 200 logros, ranking por temporadas de 14 días (Bajas / Supervivencia / Jefes), top 100 gana tickets |
| Cooperativo | Hasta 4, XP compartida, revivir quedándote al lado | Hasta 4, salas públicas y partida rápida, revivir 5 s al lado |
| Guardado | Firebase (cuenta o Google); invitado no guarda | `localStorage` (`dbs_save_v1`) sin cuenta, nube con cuenta |
| Tecnología | JS propio + Canvas 2D (1024×768) + Firebase Auth | JS propio + Canvas 2D, un solo `assets.js` |

**Conclusión:** la estructura de **DB Survivors** (una historia por arcos en ~20 min, jefes de la serie en minutos fijos, transformaciones) encaja casi 1:1 con Shippuden. De **PokéSurvivor** conviene coger la tabla de afinidades (Naruto tiene una canónica), la evolución de ataques y las mejoras de calidad de vida (veto, elegir ataque inicial, reroll extra).

Los dos están hechos **sin motor**, con Canvas 2D a mano. No necesitan nada más.

---

## 2. Bucle de juego

```
Menú → elegir ninja → PARTIDA (20 min) → resultado (ryo, logros) → gastar ryo → repetir
            ↑                                                            |
            └──── desbloqueos (ninjas, mejoras permanentes, pergaminos) ─┘
```

Dentro de la partida:
`moverse → jutsus automáticos → enemigos sueltan chakra → subir nivel → elegir carta → más fuerte → jefe → siguiente arco`

---

## 3. Propuesta: Naruto Shippuden Survivors

### 3.1 Línea temporal (20 min, un arco cada 2:30)

| Minuto | Evento | Escenario |
|---|---|---|
| 0:00 | Ninjas renegados y marionetas | Desierto de Suna |
| 2:30 | **Deidara** | Desierto de Suna |
| 5:00 | **Sasori** (con marionetas). Al vencerlo → viaje | Guarida de Akatsuki |
| 7:30 | **Hidan y Kakuzu** (dúo; Kakuzu tiene 5 corazones = 5 barras de vida) | Bosque del País del Fuego |
| 10:00 | **Itachi** (Tsukuyomi: pantalla roja, ralentiza). Al vencerlo → viaje | Guarida Uchiha |
| 12:30 | **Los Seis Caminos de Pain** (6 mini-jefes a la vez) | Konoha |
| 15:00 | **Pain / Shinra Tensei**: el mapa queda arrasado (cráter) | Konoha destruida |
| 17:30 | **Guerra: Edo Tensei** (Kages reanimados) | Campo de batalla |
| 20:00 | **Madara / Óbito Jinchūriki** — victoria | Campo de batalla |

**Modo infinito** tras el min 20: Kaguya, Juubi, Kinkaku/Ginkaku, Kisame, Orochimaru… cada vez más fuertes, ranking de supervivencia.

### 3.2 Ninjas (cada uno con jutsu inicial y transformaciones)

Transformación al **nivel 12** y segunda al **nivel 24** (como DB). Durante la transformación: más daño/velocidad y efecto visual.

| Ninja | Jutsu inicial | Transformación 1 → 2 | Desbloqueo |
|---|---|---|---|
| Naruto | Rasengan | Modo Sabio → Modo Chakra Kyūbi | Inicial |
| Sakura | Puño de chakra (onda) | Sello Byakugō | Vencer a Sasori |
| Kakashi | Raikiri | Sharingan → Mangekyō (Kamui) | Vencer a Deidara |
| Gaara | Ataúd de arena | Escudo de arena absoluto | Sobrevivir 8 min |
| Rock Lee | Huracán de hoja | Puertas internas → 8ª puerta | 2.000 bajas totales |
| Sasuke | Chidori | Sello maldito → Susanoo | Vencer a Itachi |
| Shikamaru | Posesión de sombra | — | Tienda |
| Neji | Rotación (Kaiten) | Byakugan | Tienda |
| Hinata | Puños gemelos de león | Byakugan | Tienda |
| Jiraiya | Rasengan gigante | Modo Sabio | Tienda |
| Itachi | Katon | Mangekyō → Susanoo | Tienda |
| Minato | Kunai Hiraishin (teletransporte) | Modo Chakra Kyūbi | Tienda |
| Killer Bee | Espadas | Ocho Colas | Tienda |

Empezar con 6 en el MVP y añadir más después.

### 3.3 Afinidades (tabla de tipos de Naruto)

Viene de la serie, así que no hace falta inventarla:

**Fuego > Viento > Rayo > Tierra > Agua > Fuego** (×1,5 a favor, ×0,75 en contra).

Cada enemigo y cada jutsu tiene naturaleza. Taijutsu, genjutsu y armas son neutrales. Opcional: el "clima" de PokéSurvivor = **zonas del mapa** (zona de niebla potencia Agua, desierto potencia Viento).

### 3.4 Jutsus (máximo 5 activos + 5 pasivas)

Cada uno con niveles 1-5 (daño, cantidad, área, recarga):

| Jutsu | Comportamiento | Naturaleza |
|---|---|---|
| Lanzar kunai/shuriken | Proyectil al más cercano | — |
| Clones de sombra | Clones que persiguen y golpean | — |
| Rasengan | Esfera que empuja y golpea en área pequeña | Viento |
| Chidori | Embestida en línea | Rayo |
| Katon: Bola de fuego | Proyectil grande que explota | Fuego |
| Suiton: Dragón de agua | Onda que atraviesa enemigos | Agua |
| Doton: Muro | Muro que bloquea y daña | Tierra |
| Fūton: Cuchilla de viento | Abanico en cono | Viento |
| Sellos explosivos | Minas en el suelo | Fuego |
| Posesión de sombra | Inmoviliza a los enemigos en línea | — |
| Kaiten | Aura giratoria que repele | — |
| Arena de Gaara | Orbes de arena que orbitan | Tierra |
| Invocación (sapo/babosa/serpiente) | Aliado temporal | — |
| Hiraishin | Te teletransporta y daña al llegar | — |

**Evoluciones** (jutsu a nivel máx + pasiva concreta, como en PokéSurvivor):
- Rasengan + Energía natural → **Rasen-shuriken**
- Chidori + Ojo Sharingan → **Kirin**
- Katon + Mangekyō → **Amaterasu** (llamas negras que duran en el suelo)
- Clones de sombra + Reserva de chakra → **Ejército de mil clones**

**Pasivas:** Reserva de chakra (-recarga), Taijutsu (+daño), Resistencia (+vida), Shunshin (+velocidad), Sensor (+imán), Regeneración, Suerte, Estudio (+XP), Energía natural (+área), Ojo Sharingan (+crítico).

### 3.5 Objetos y eventos en el mapa

| Objeto | Efecto | Equivalente |
|---|---|---|
| Ramen Ichiraku | Curación | Semilla del ermitaño |
| Bolsa de ryō | Monedas | Bolsa de zeni |
| Pergamino de invocación | Atrae todo el chakra del mapa | Imán |
| Píldora de soldado | Buff temporal de daño y velocidad | Kaioken |
| Cofres dorados (de élites y jefes) | Varias mejoras a la vez | Cápsula dorada |
| Tienda de armas de Tenten | Eliges un regalo de 3 | Capsule Corp |
| **9 Bijū** (aparecen por el mapa, el sensor ayuda a encontrarlos) | Al reunirlos: Juubi concede 1 de 3 deseos (curar y +vida máx / +1 nivel a todos los jutsus / limpiar pantalla). Opcional: con 5 en vez de 9 para que sea alcanzable | Esferas del dragón + Shenlong |

### 3.6 Progreso entre partidas

- **Ryō**: se gana en la partida y se gasta en la Tienda.
- **Mejoras permanentes por ninja** (copiar el esquema de PokéSurvivor, que es el más completo): vida, daño, velocidad, recarga, defensa, regeneración, imán, XP, ryō, crítico, y además desbloqueos de calidad de vida: +1 reroll, vetar 1 jutsu, elegir jutsu inicial, empezar con 2 jutsus. Coste creciente: `coste = base × 1,5^nivel`.
- **Pergaminos de la suerte** (gacha) con tickets ganados jugando, nunca con dinero: Común 70 / Raro 24 / Épico 5 / Legendario 1, pity a 80. Premios: ninjas, skins (Naruto de Hokage, Sasuke de Akatsuki…), auras y ryō si sale repetido.
- **Misiones diarias** (3 + bonus) y **logros** (bajas, jefes, transformaciones, bijū reunidos…).
- **Ranking** (más adelante, necesita backend).

---

## 4. Arquitectura técnica recomendada

Igual que las referencias: **sin motor, TypeScript + Canvas 2D + Vite**. Es ligero, carga rápido en móvil y da control total. Alternativa si quieres ir más rápido con físicas y animaciones listas: **Phaser 3**.

```
src/
  main.ts               arranque, bucle con paso fijo (60 Hz) + render con interpolación
  core/
    input.ts            teclado, mando, joystick táctil "donde tocas"
    camera.ts
    pool.ts             reutilizar objetos (proyectiles, enemigos, cristales): clave para el rendimiento
    spatialHash.ts      rejilla para colisiones: miles de enemigos sin O(n²)
    save.ts             localStorage con versión (ns_save_v1) + migraciones
  game/
    player.ts
    enemy.ts            tipos: perseguidor, a distancia, curandero, kamikaze, élite
    weapons/            un archivo por comportamiento (projectile, orbit, aura, dash, mine, summon)
    spawner.ts          lee la línea temporal y genera oleadas
    levelup.ts          sorteo de cartas ponderado, reroll, veto
    pickups.ts
  data/                 TODO el contenido en datos, no en código
    ninjas.json
    jutsus.json         daño, recarga y escalado por nivel, naturaleza, evolución
    enemies.json
    timeline.json       minuto → oleada / jefe / cambio de escenario
  ui/                   menús en HTML/CSS por encima del canvas (como hacen ambos juegos)
```

Claves de rendimiento que se notan en las dos webs: object pooling, rejilla espacial, enemigos sin colisión entre ellos (o con separación barata), números de daño agrupados, y limitar a ~300-500 enemigos en pantalla.

---

## 5. Hoja de ruta

**Fase 1 – Núcleo jugable (MVP)**
1. Movimiento, cámara, mapa en mosaico infinito.
2. 3 tipos de enemigo + spawner por tiempo.
3. Naruto con 4 jutsus (kunai, clones, Rasengan, sellos explosivos) + 5 pasivas.
4. Chakra/XP, subida de nivel con 3 cartas y reroll.
5. Muerte → pantalla de resultado con ryō.

**Fase 2 – Estructura de Shippuden**
6. Línea temporal completa con los 8 jefes y cambios de escenario.
7. Transformaciones (nivel 12/24), evoluciones, afinidades.
8. 6 ninjas jugables.

**Fase 3 – Meta-progresión**
9. Tienda, mejoras permanentes, guardado local.
10. Bijū + deseo, cofres, tienda de Tenten.
11. Misiones diarias, logros, pergaminos de la suerte.

**Fase 4 – Online (opcional)**
12. Cuentas y guardado en la nube (Firebase o Supabase), ranking por temporadas.
13. Cooperativo de hasta 4 (WebSocket, servidor autoritativo o host-cliente).

---

## 6. Gráficos y aspecto legal

Las dos referencias son fan-games sin ánimo de lucro: avisan de que no son oficiales y usan sprites extraídos de otros juegos (DB: sprites de los juegos de GBA; PokéSurvivor: SpriteCollab con licencia CC BY-NC). Con Naruto pasa lo mismo: los personajes son de Masashi Kishimoto/Shueisha/Pierrot. Para un proyecto personal o sin ánimo de lucro, sigue su modelo: sin monetizar, con aviso de "juego no oficial hecho por fans" y créditos de los gráficos. Mi recomendación es empezar con **sprites provisionales simples** (formas y colores) para que la jugabilidad no dependa de los gráficos, y decidir el arte después.
