// Notas, alturas (pitch classes) y ortografía (sostenidos / bemoles).

/** Letra 0..6 = C D E F G A B. Alteración: -2..2 (bb, b, natural, #, ##). */
export interface Note {
  letter: number;
  acc: number;
}

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

export type AccidentalPref = 'sharp' | 'flat';

const SHARP_NAMES: Note[] = [
  { letter: 0, acc: 0 }, { letter: 0, acc: 1 }, { letter: 1, acc: 0 }, { letter: 1, acc: 1 },
  { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 3, acc: 1 }, { letter: 4, acc: 0 },
  { letter: 4, acc: 1 }, { letter: 5, acc: 0 }, { letter: 5, acc: 1 }, { letter: 6, acc: 0 },
];
const FLAT_NAMES: Note[] = [
  { letter: 0, acc: 0 }, { letter: 1, acc: -1 }, { letter: 1, acc: 0 }, { letter: 2, acc: -1 },
  { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 4, acc: -1 }, { letter: 4, acc: 0 },
  { letter: 5, acc: -1 }, { letter: 5, acc: 0 }, { letter: 6, acc: -1 }, { letter: 6, acc: 0 },
];

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export function noteToPc(n: Note): number {
  return mod(LETTER_PC[n.letter] + n.acc, 12);
}

export function pcToNote(pc: number, pref: AccidentalPref): Note {
  return { ...(pref === 'flat' ? FLAT_NAMES : SHARP_NAMES)[mod(pc, 12)] };
}

export function noteToString(n: Note): string {
  const acc = n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc);
  return LETTERS[n.letter] + acc;
}

/** Parsea "C", "Eb", "F#", "Bb", "E♭"... Devuelve null si no es una nota. */
export function parseNote(s: string): Note | null {
  const m = /^([A-Ga-g])([#♯b♭]{0,2})$/.exec(s.trim());
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase());
  let acc = 0;
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : -1;
  return { letter, acc };
}

/** Nombre de nota con octava en notación científica (C4 = do central = MIDI 60). */
export function midiName(midi: number, pref: AccidentalPref = 'sharp'): string {
  return noteToString(pcToNote(midi, pref)) + (Math.floor(midi / 12) - 1);
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(mod(midi, 12));
}

/** Una ortografía es "rara" si tiene doble alteración o es E#, B#, Cb, Fb. */
export function isAwkward(n: Note): boolean {
  if (Math.abs(n.acc) > 1) return true;
  if (n.acc === 1 && (n.letter === 2 || n.letter === 6)) return true;
  if (n.acc === -1 && (n.letter === 0 || n.letter === 3)) return true;
  return false;
}
