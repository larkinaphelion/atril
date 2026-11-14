// Teclados de distintos tamaños y posiciones de acordes en el piano.
import { Chord, chordStructure } from './chord';
import { mod, noteToPc } from './notes';

export interface KeyboardRange {
  low: number; // MIDI de la tecla más grave
  high: number; // MIDI de la tecla más aguda
}

/** Tamaños estándar de teclado: cantidad de teclas → nota más grave. */
export const KEYBOARD_PRESETS: Record<number, number> = {
  25: 48, // C3–C5
  32: 53, // F3–C6
  37: 48, // C3–C6
  49: 36, // C2–C6
  61: 36, // C2–C7
  73: 28, // E1–E7
  76: 28, // E1–G7
  88: 21, // A0–C8
};

export function keyboardRange(keys: number, low?: number): KeyboardRange {
  const lo = low ?? KEYBOARD_PRESETS[keys] ?? 60 - Math.floor(keys / 2 / 12) * 12;
  return { low: lo, high: lo + keys - 1 };
}

/** Notas MIDI de una posición del acorde: bajo (si hay barra) + acorde en estado fundamental cerca del do central. */
export function pianoVoicing(c: Chord, range: KeyboardRange): number[] {
  const st = chordStructure(c.suffix)!;
  const rootPc = noteToPc(c.root);
  const ints = [...st.intervals].sort((a, b) => a - b);
  const bass = c.bass ? noteToPc(c.bass) : null;

  const build = (r: number) => {
    const notes = ints.map((i) => r + i);
    if (bass !== null && bass !== rootPc) {
      notes.unshift(r - (mod(rootPc - bass, 12) || 12));
    }
    return notes;
  };

  const fits = (ns: number[]) => ns[0] >= range.low && ns[ns.length - 1] <= range.high;
  let best: number[] | null = null;
  let bestDist = Infinity;
  for (let r = rootPc; r <= 127; r += 12) {
    const ns = build(r);
    if (!fits(ns)) continue;
    const center = (ns[0] + ns[ns.length - 1]) / 2;
    const d = Math.abs(center - 64);
    if (d < bestDist) {
      bestDist = d;
      best = ns;
    }
  }
  if (best) return best;
  // Teclado muy chico: plegar las notas dentro del rango.
  return [...new Set(build(rootPc + 60).map((n) => {
    let x = n;
    while (x > range.high) x -= 12;
    while (x < range.low) x += 12;
    return x;
  }))].sort((a, b) => a - b);
}

/** Rango mínimo para mostrar "solo el pedazo": de la C (o F) anterior a la nota más grave hasta completar la octava. */
export function partialRange(notes: number[], full: KeyboardRange): KeyboardRange {
  const lo = Math.max(full.low, notes[0] - mod(notes[0], 12));
  let hi = notes[notes.length - 1];
  hi = hi + (11 - mod(hi, 12));
  if (hi - lo < 23) hi = lo + 23; // al menos dos octavas para ubicarse
  return { low: lo, high: Math.min(full.high, hi) };
}
