import { describe, expect, it } from 'vitest';
import { chordPcs, chordToString, parseChord } from './chord';
import { INSTRUMENTS, frettedVoicings } from './fretted';
import { changeKey, detectKey, keyToString, parseKey, transposeBySemitones } from './key';
import { mod } from './notes';
import { keyboardRange, pianoVoicing } from './piano';

const C = (s: string) => {
  const c = parseChord(s);
  if (!c) throw new Error('no parsea ' + s);
  return c;
};
const pcsOf = (s: string) => chordPcs(C(s)).sort((a, b) => a - b);

describe('parseChord', () => {
  it('reconoce acordes de jazz', () => {
    for (const s of ['G6', 'B7', 'E7', 'Am7', 'B9', 'Dm6', 'A9', 'D7', 'G#dim7', 'C6', 'Cm6', 'Gb6', 'F6', 'E6', 'Bm7', 'Bbm7',
      'Cmaj7', 'CM7', 'C∆7', 'Cm7b5', 'Cø', 'C°7', 'C7sus4', 'Csus2', 'Cadd9', 'C6/9', 'C69', 'D/F#', 'C7(b9)', 'C13', 'Caug', 'C+', 'Cm(maj7)', 'C5', 'C']) {
      expect(parseChord(s), s).not.toBeNull();
    }
  });
  it('rechaza palabras', () => {
    for (const s of ['All', 'of', 'me', 'Bad', 'Every', 'Can\'t', 'Verse']) expect(parseChord(s), s).toBeNull();
  });
  it('calcula notas', () => {
    expect(pcsOf('C')).toEqual([0, 4, 7]);
    expect(pcsOf('G6')).toEqual([2, 4, 7, 11]);
    expect(pcsOf('G#dim7')).toEqual([2, 5, 8, 11]);
    expect(pcsOf('Am7')).toEqual([0, 4, 7, 9]);
    expect(pcsOf('Cmaj7')).toEqual([0, 4, 7, 11]);
    expect(pcsOf('Cm7b5')).toEqual([0, 3, 6, 10]);
    expect(pcsOf('C9')).toEqual([0, 2, 4, 7, 10]);
    expect(pcsOf('D/F#')).toEqual([2, 6, 9]);
  });
});

describe('tonalidad', () => {
  const song = ['G6', 'B7', 'E7', 'Am7', 'B9', 'Dm6', 'A9', 'Am7', 'D7', 'G6'].map(C);
  it('detecta G', () => expect(keyToString(detectKey(song)!)).toBe('G'));
  it('detecta menor', () => expect(keyToString(detectKey(['Am', 'Dm', 'E7', 'Am'].map(C))!)).toBe('Am'));

  it('cambiar de tono deletrea bien (G → Eb)', () => {
    const t = changeKey(parseKey('G')!, parseKey('Eb')!);
    const out = song.map((c) => chordToString(t(c)));
    expect(out).toEqual(['Eb6', 'G7', 'C7', 'Fm7', 'G9', 'Bbm6', 'F9', 'Fm7', 'Bb7', 'Eb6']);
    expect(chordToString(t(C('G#dim7')))).toBe('Edim7');
  });
  it('transponer por semitonos usa la preferencia', () => {
    expect(chordToString(transposeBySemitones(-4, 'sharp')(C('G6')))).toBe('D#6');
    expect(chordToString(transposeBySemitones(-4, 'flat')(C('G6')))).toBe('Eb6');
    expect(chordToString(transposeBySemitones(2, 'sharp')(C('D/F#')))).toBe('E/G#');
  });
});

describe('posiciones con trastes', () => {
  const sounds = (inst: 'guitar' | 'ukulele', name: string) => {
    const vs = frettedVoicings(C(name), inst);
    expect(vs.length, name).toBeGreaterThan(0);
    const pcs = chordPcs(C(name));
    for (const v of vs) {
      v.frets.forEach((f, i) => {
        if (f !== null) expect(pcs, `${name} ${v.frets.join('')}`).toContain(mod(INSTRUMENTS[inst].tuning[i] + f, 12));
      });
      expect(v.fingers.filter((x) => x !== null).every((x) => x! >= 1 && x! <= 4)).toBe(true);
    }
    return vs[0];
  };
  it('formas abiertas conocidas', () => {
    expect(sounds('guitar', 'G').frets).toEqual([3, 2, 0, 0, 0, 3]);
    expect(sounds('guitar', 'Am7').frets).toEqual([null, 0, 2, 0, 1, 0]);
    expect(sounds('ukulele', 'C').frets).toEqual([0, 0, 0, 3]);
  });
  it('genera acordes raros en guitarra y ukelele', () => {
    for (const n of ['G6', 'B9', 'Dm6', 'G#dim7', 'Cm6', 'Gb6', 'Bbm7', 'F#m7b5', 'Ebmaj7', 'C13', 'D/F#', 'Abadd9']) {
      sounds('guitar', n);
      sounds('ukulele', n);
    }
  });
  it('el bajo de la guitarra es la fundamental', () => {
    const v = sounds('guitar', 'D/F#');
    const low = v.frets.findIndex((f) => f !== null);
    expect(mod(INSTRUMENTS.guitar.tuning[low] + v.frets[low]!, 12)).toBe(6);
  });
});

describe('piano', () => {
  it('ubica el acorde cerca del do central y dentro del teclado', () => {
    const r = keyboardRange(61);
    const ns = pianoVoicing(C('G6'), r);
    expect(ns).toEqual([55, 59, 62, 64]);
    const small = keyboardRange(25);
    const n2 = pianoVoicing(C('C13'), small);
    expect(Math.min(...n2)).toBeGreaterThanOrEqual(small.low);
    expect(Math.max(...n2)).toBeLessThanOrEqual(small.high);
  });
});

describe('ortografía de notas del acorde', () => {
  it('C7 tiene Bb y G#dim7 tiene F natural', async () => {
    const { chordNoteNames } = await import('./chord');
    const { noteToString } = await import('./notes');
    const names = (s: string) => [...chordNoteNames(C(s)).values()].map(noteToString);
    expect(names('C7')).toEqual(['C', 'E', 'G', 'Bb']);
    expect(names('G#dim7')).toEqual(['G#', 'B', 'D', 'F']);
    expect(names('Eb6')).toEqual(['Eb', 'G', 'Bb', 'C']);
  });
});
