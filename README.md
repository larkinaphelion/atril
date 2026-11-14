# Atril 🎸🎹

App web para **seguir letra y acordes mientras tocás**, en guitarra, ukelele o piano. Pegás la canción (acordes arriba de la letra, o ChordPro) y la arma para leerla de un vistazo, con los diagramas de cómo hacer cada acorde, transposición, cambio de tono y avance automático con el tempo.

Está hecha con React + TypeScript + Vite y lista para empaquetarse como app de **Android / iOS** con [Capacitor](https://capacitorjs.com).

## Qué hace

**Instrumentos**: guitarra, ukelele, piano o solo letra.

**Cómo ver los acordes**
- Solo los nombres. Pasando el mouse (o manteniendo apretado en el celular) sobre un acorde, aparece cómo se hace.
- Cómo hacerlos, en tres ubicaciones:
  - **Antes de la letra**: todos los diagramas arriba y, sobre la letra, solo los nombres.
  - **Sobre la letra**: nombre + diagrama arriba de cada sílaba.
  - **Al costado** (dos columnas): en orden alfabético, en el orden en que aparecen, o **repetidos en cada línea** junto a la letra.
- **Solo el pedazo** del instrumento donde va el acorde (con el número de traste; en piano, las octavas marcadas C3, C4…) o **el instrumento completo** (mástil de 15 trastes / teclado entero).
- Tocar un diagrama muestra **otra posición** del mismo acorde (se recuerda por canción).
- **Fijar acordes arriba**: barra fija con todos los acordes de la canción.

**Piano**: decile cuántas teclas tiene tu teclado (25, 32, 37, 49, 61, 73, 76, 88 o cualquier número) y desde qué nota arranca; los acordes se ubican dentro de ese rango.

**Tono**
- **Transponer**: mueve todo N semitonos, escribiendo con ♯ o ♭.
- **Cambiar tono**: reescribe cada acorde en la tonalidad nueva con la ortografía correcta. Por ejemplo, de G a Eb: `B7 → G7`, `G#dim7 → Edim7` (y no `D#`, `F##7`…). El tono original se toma de `Key: G` o se detecta solo.

**Avance automático**: marcás el tempo (BPM o botón *Marcar* tocando al ritmo), cuántos tiempos dura cada acorde y la app resalta la línea y el acorde actual y va scrolleando. Con metrónomo opcional, cuenta de entrada y la pantalla no se apaga mientras suena. Tocar una línea salta ahí. Si usás barras de compás (`| C6 Cm6 | G6 |`), los acordes de un mismo compás se reparten el tiempo.

**Vista**: tema claro / oscuro / automático, letra en una o dos columnas, tamaño de letra, de acordes y de diagramas por separado.

**Biblioteca**: las canciones se guardan en el dispositivo; se pueden exportar e importar (`.json`, o `.txt` / `.cho` sueltos).

## Formato de las canciones

Acordes arriba de la letra (alineados con espacios):

```
Key: G
[Verso 1]
  G     G7         C         G
Amazing grace! How sweet the sound
```

O ChordPro:

```
{title: Amazing Grace}
{key: G}
{tempo: 80}
'Twas [G]grace that [G7]taught my [C]heart to [G]fear
```

Se reconocen acordes como `G6`, `Am7`, `B9`, `G#dim7`, `Cm6`, `Bbmaj7#11`, `C6/9`, `D/F#`, `C7(b9)`, `Cø`, `C°7`, `Csus4`, `Cadd9`, `C13`…

## Desarrollo

Necesitás [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
npm test         # tests de la lógica musical y del parser
npm run build    # build de producción en dist/
```

## Pasarla a app de Android / iOS

El proyecto ya trae Capacitor configurado (`capacitor.config.ts`, `webDir: dist`, rutas con hash y `base: './'` para que funcione dentro del contenedor nativo).

```bash
npm install @capacitor/android @capacitor/ios
npx cap add android      # requiere Android Studio
npx cap add ios          # requiere macOS + Xcode
npm run cap:android      # build + sync + abre Android Studio
npm run cap:ios          # build + sync + abre Xcode
```

Para producción conviene sumar `@capacitor-community/keep-awake` (pantalla encendida) y, si querés, `@capacitor/preferences` para el guardado: todo el acceso a almacenamiento está en `src/lib/storage.ts`.

También funciona como web instalable (tiene `manifest.webmanifest`).

## Estructura

```
src/
  music/        lógica musical pura (sin React), con tests
    notes.ts      notas, alturas y ortografía
    chord.ts      parseo de acordes e intervalos
    key.ts        detección de tono, transponer y cambiar tono
    fretted.ts    posiciones para guitarra y ukelele (formas conocidas + generador)
    piano.ts      tamaños de teclado y posiciones en el piano
  song/
    parse.ts      texto → canción (acordes arriba o ChordPro)
    timeline.ts   duración de cada acorde para el avance automático
  components/   pantallas y diagramas SVG
  hooks/usePlayer.ts  avance automático, metrónomo y wake lock
  state/        tipos, ajustes y canciones de ejemplo
  lib/storage.ts      persistencia (cambiable por Capacitor Preferences)
```
