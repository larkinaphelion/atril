// Tonalidades: detección, transposición por semitonos y cambio de tono con ortografía correcta.
import { Chord, chordQuality } from './chord';
import {
  AccidentalPref, Note, isAwkward, mod, noteToPc, noteToString, parseNote, pcToNote,
} from './notes';

export interface Key {
  tonic: Note;
  minor: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#'];

export function parseKey(s: string): Key | null {
  const m = /^\s*([A-G][#b♯♭]?)\s*(m|min|minor|menor|-)?\s*$/i.exec(s);
  if (!m) return null;
  const tonic = parseNote(m[1][0].toUpperCase() + m[1].slice(1));
  if (!tonic) return null;
  return { tonic, minor: !!m[2] };
}

export function keyToString(k: Key): string {
  return noteToString(k.tonic) + (k.minor ? 'm' : '');
}

/** Escala diatónica de la tonalidad, deletreada (una letra por grado). */
export function keyScale(k: Key): Note[] {
  const steps = k.minor ? MINOR : MAJOR;
  const t = noteToPc(k.tonic);
  return steps.map((st, deg) => {
    const letter = (k.tonic.letter + deg) % 7;
    const pc = mod(t + st, 12);
    const natural = [0, 2, 4, 5, 7, 9, 11][letter];
    let acc = mod(pc - natural, 12);
    if (acc > 6) acc -= 12;
    return { letter, acc };
  });
}

/** ¿La armadura de esta tonalidad usa bemoles? */
export function keyPrefersFlats(k: Key): boolean {
  return keyScale(k).some((n) => n.acc < 0);
}

/** Deletrea una clase de altura según la tonalidad (diatónica si se puede; si no, según armadura). */
export function spellInKey(pc: number, k: Key): Note {
  const scale = keyScale(k);
  const hit = scale.find((n) => noteToPc(n) === mod(pc, 12));
  if (hit) return { ...hit };
  return pcToNote(pc, keyPrefersFlats(k) ? 'flat' : 'sharp');
}

/** Ortografía convencional de una tonalidad para una clase de altura (evita F# vs Gb con 6 alteraciones → elige la más común). */
export function conventionalKey(pc: number, minor: boolean): Key {
  const preferred = minor
    ? ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
    : ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  return { tonic: parseNote(preferred[mod(pc, 12)])!, minor };
}

/** Detecta la tonalidad más probable a partir de los acordes. */
export function detectKey(chords: Chord[]): Key | null {
  if (!chords.length) return null;
  let best: { key: Key; score: number } | null = null;
  for (let pc = 0; pc < 12; pc++) {
    for (const minor of [false, true]) {
      const key = conventionalKey(pc, minor);
      const steps = minor ? MINOR : MAJOR;
      const qualities = minor
        ? ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major']
        : ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
      let score = 0;
      for (const c of chords) {
        const rel = mod(noteToPc(c.root) - pc, 12);
        const deg = steps.indexOf(rel);
        if (deg >= 0) {
          score += 1;
          if (chordQuality(c) === qualities[deg]) score += 0.5;
        }
        // En menor, el V suele ser mayor (dominante armónica)
        if (minor && rel === 7 && chordQuality(c) === 'major') score += 1;
      }
      const tonicBonus = (c: Chord) => {
        if (noteToPc(c.root) !== pc) return 0;
        const q = chordQuality(c);
        return (minor ? q === 'minor' : q === 'major') ? 3 : 1;
      };
      score += tonicBonus(chords[0]) + tonicBonus(chords[chords.length - 1]);
      if (!minor) score += 0.1;
      if (!best || score > best.score) best = { key, score };
    }
  }
  if (!best) return null;
  // Usar la ortografía de la tónica tal como aparece en la canción, si aparece.
  const tpc = noteToPc(best.key.tonic);
  const asWritten = chords.find((c) => noteToPc(c.root) === tpc);
  if (asWritten && !isAwkward(asWritten.root)) best.key.tonic = { ...asWritten.root };
  return best.key;
}

/* ---------- Transformaciones de acordes ---------- */

export type ChordTransform = (c: Chord) => Chord;

/** Transponer: mueve N semitonos y deletrea con la preferencia elegida (♯ o ♭). */
export function transposeBySemitones(n: number, pref: AccidentalPref): ChordTransform {
  return (c) => {
    if (n === 0) return c;
    const mv = (x: Note) => pcToNote(noteToPc(x) + n, pref);
    return { root: mv(c.root), suffix: c.suffix, bass: c.bass ? mv(c.bass) : undefined };
  };
}

/**
 * Cambiar de tono: transpone por intervalo (letra + semitonos), así cada acorde
 * conserva su función y se deletrea bien en la tonalidad nueva (p. ej. G → Eb: B7 → G7, G#dim7 → Edim7).
 */
export function changeKey(from: Key, to: Key): ChordTransform {
  const letterSteps = mod(to.tonic.letter - from.tonic.letter, 7);
  const semis = mod(noteToPc(to.tonic) - noteToPc(from.tonic), 12);
  const mv = (x: Note): Note => {
    const letter = (x.letter + letterSteps) % 7;
    const pc = mod(noteToPc(x) + semis, 12);
    let acc = mod(pc - [0, 2, 4, 5, 7, 9, 11][letter], 12);
    if (acc > 6) acc -= 12;
    const n = { letter, acc };
    return isAwkward(n) ? spellInKey(pc, to) : n;
  };
  return (c) => ({ root: mv(c.root), suffix: c.suffix, bass: c.bass ? mv(c.bass) : undefined });
}

export function transposeKey(k: Key, n: number, pref: AccidentalPref): Key {
  return { tonic: pcToNote(noteToPc(k.tonic) + n, pref), minor: k.minor };
}
