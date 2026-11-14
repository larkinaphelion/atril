// Recorre todas las notas (naturales, # y b) y todas las formas habituales de escribir
// cada tipo de acorde, y verifica: que se reconozca, que tenga las notas correctas y que
// haya posición en guitarra, ukelele y piano.
import { describe, expect, it } from 'vitest';
import { chordPcs, parseChord } from './chord';
import { frettedVoicings, INSTRUMENTS } from './fretted';
import { mod, noteToPc } from './notes';
import { keyboardRange, pianoVoicing } from './piano';

const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

/** Tipo de acorde → intervalos esperados (mod 12) → todas las formas de escribirlo. */
const TYPES: { name: string; pcs: number[]; spellings: string[] }[] = [
  { name: 'mayor', pcs: [0, 4, 7], spellings: ['', 'M', 'maj'] },
  { name: 'menor', pcs: [0, 3, 7], spellings: ['m', 'min', 'mi', '-'] },
  { name: 'disminuido', pcs: [0, 3, 6], spellings: ['dim', '°', 'º', 'o'] },
  { name: 'disminuido 7', pcs: [0, 3, 6, 9], spellings: ['dim7', '°7', 'º7', 'o7'] },
  { name: 'semidisminuido', pcs: [0, 3, 6, 10], spellings: ['m7b5', 'ø', 'ø7', 'm7(b5)', 'm7-5', '-7b5'] },
  { name: 'aumentado', pcs: [0, 4, 8], spellings: ['aug', '+', '(#5)', '+5'] },
  { name: 'aumentado 7', pcs: [0, 4, 8, 10], spellings: ['7#5', 'aug7', '+7', '7(#5)', '7+5'] },
  { name: 'séptima', pcs: [0, 4, 7, 10], spellings: ['7'] },
  { name: 'séptima mayor', pcs: [0, 4, 7, 11], spellings: ['maj7', 'M7', 'Δ', 'Δ7', '7M', 'Maj7'] },
  { name: 'menor 7', pcs: [0, 3, 7, 10], spellings: ['m7', 'min7', '-7', 'mi7'] },
  { name: 'menor maj7', pcs: [0, 3, 7, 11], spellings: ['mmaj7', 'mM7', 'm(maj7)', 'm7M', 'minmaj7'] },
  { name: 'sexta', pcs: [0, 4, 7, 9], spellings: ['6'] },
  { name: 'menor 6', pcs: [0, 3, 7, 9], spellings: ['m6', '-6', 'min6'] },
  { name: '6/9', pcs: [0, 2, 4, 7, 9], spellings: ['6/9', '69', '6add9'] },
  { name: 'novena', pcs: [0, 2, 4, 7, 10], spellings: ['9'] },
  { name: 'menor 9', pcs: [0, 2, 3, 7, 10], spellings: ['m9'] },
  { name: 'maj9', pcs: [0, 2, 4, 7, 11], spellings: ['maj9', 'M9'] },
  { name: 'add9', pcs: [0, 2, 4, 7], spellings: ['add9', 'add2', '(9)', '(add9)'] },
  { name: 'menor add9', pcs: [0, 2, 3, 7], spellings: ['madd9', 'm(add9)', 'm(9)'] },
  { name: 'sus2', pcs: [0, 2, 7], spellings: ['sus2', '2'] },
  { name: 'sus4', pcs: [0, 5, 7], spellings: ['sus4', 'sus', '4'] },
  { name: '7sus4', pcs: [0, 5, 7, 10], spellings: ['7sus4', '7sus', '7(4)'] },
  { name: '7b9', pcs: [0, 1, 4, 7, 10], spellings: ['7b9', '7(b9)', '7-9'] },
  { name: '7#9', pcs: [0, 3, 4, 7, 10], spellings: ['7#9', '7(#9)', '7+9'] },
  { name: '11', pcs: [0, 2, 4, 5, 7, 10], spellings: ['11'] },
  { name: 'm11', pcs: [0, 2, 3, 5, 7, 10], spellings: ['m11'] },
  { name: '13', pcs: [0, 2, 4, 7, 9, 10], spellings: ['13'] },
  { name: 'quinta (power)', pcs: [0, 7], spellings: ['5'] },
  { name: '7b5', pcs: [0, 4, 6, 10], spellings: ['7b5', '7(b5)', '7-5'] },
];

describe('todos los acordes', () => {
  for (const t of TYPES) {
    it(t.name, () => {
      const failures: string[] = [];
      for (const r of ROOTS) {
        for (const sp of t.spellings) {
          const name = r + sp;
          const c = parseChord(name);
          if (!c) {
            failures.push(`${name}: no se reconoce`);
            continue;
          }
          const root = noteToPc(c.root);
          const got = chordPcs(c).map((p) => mod(p - root, 12)).sort((a, b) => a - b);
          if (got.join() !== t.pcs.join()) {
            failures.push(`${name}: notas ${got.join(',')} (esperaba ${t.pcs.join(',')})`);
            continue;
          }
          for (const inst of ['guitar', 'ukulele'] as const) {
            const vs = frettedVoicings(c, inst);
            if (!vs.length) failures.push(`${name}: sin posición en ${inst}`);
            for (const v of vs) {
              v.frets.forEach((f, i) => {
                if (f !== null && !got.includes(mod(INSTRUMENTS[inst].tuning[i] + f - root, 12))) {
                  failures.push(`${name}: ${inst} ${v.frets.join('-')} tiene una nota que no va`);
                }
              });
            }
          }
          for (const keys of [25, 49, 61, 88]) {
            const ns = pianoVoicing(c, keyboardRange(keys));
            const range = keyboardRange(keys);
            if (ns.some((n) => n < range.low || n > range.high)) failures.push(`${name}: se sale del teclado de ${keys}`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('Am#, Cm#7 y similares (alteración después de la m) en todas las notas naturales', () => {
    for (const L of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      for (const sfx of ['m#', 'm#7', 'm#6']) {
        const c = parseChord(L + sfx);
        expect(c, L + sfx).not.toBeNull();
        expect(c!.root.acc, L + sfx).toBe(1);
      }
    }
  });

  it('acordes con bajo (barra) en todas las notas', () => {
    for (const r of ROOTS) for (const b of ROOTS) {
      const c = parseChord(`${r}m7/${b}`);
      expect(c, `${r}m7/${b}`).not.toBeNull();
      expect(frettedVoicings(c!, 'guitar').length, `${r}m7/${b}`).toBeGreaterThan(0);
    }
  });
});
