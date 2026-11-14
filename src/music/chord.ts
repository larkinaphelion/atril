// Parseo de acordes ("G6", "B7", "G#dim7", "Am7", "C6/9", "D/F#", "Bbmaj7#11"...) y sus intervalos.
import { Note, parseNote, noteToString, noteToPc, mod } from './notes';

export interface Chord {
  root: Note;
  /** Sufijo tal como se escribió (se conserva para mostrarlo igual). */
  suffix: string;
  bass?: Note;
}

export interface ChordStructure {
  /** Intervalos en semitonos desde la fundamental (pueden superar 12: 9nas, 11nas, 13nas). */
  intervals: number[];
  /** Intervalos imprescindibles, ordenados por importancia (el primero es el más importante). */
  essential: number[];
}

const NOTE_RE = /^([A-G](?:##|bb|#|b|♯|♭)?)(.*)$/;

export function parseChord(raw: string): Chord | null {
  const s = raw.trim();
  const m = NOTE_RE.exec(s);
  if (!m) return null;
  const root = parseNote(m[1]);
  if (!root) return null;
  let suffix = m[2];
  // "Am#", "Am#7" → A#m, A#m7 (alteración escrita después de la "m", como en algunos cancioneros)
  const late = /^(m|min|mi|-)([#♯])(?=$|[67](?!\d)|\/|maj|M7|7M)/.exec(suffix);
  if (late && root.acc === 0) {
    root.acc = 1;
    suffix = late[1] + suffix.slice(late[0].length);
  }
  // Disminuido escrito con "o" o "º" (G#o, G#º7) y "7M" = maj7 (notación brasileña)
  suffix = suffix.replace(/^[oº](?!mit)/, '°').replace(/^(m?)7M/, '$1maj7');
  let bass: Note | undefined;
  const slash = /^(.*)\/([A-G](?:#|b|♯|♭)?)$/.exec(suffix);
  if (slash) {
    const b = parseNote(slash[2]);
    if (b) {
      bass = b;
      suffix = slash[1];
    }
  }
  if (!chordStructure(suffix)) return null;
  return { root, suffix, bass };
}

export function chordToString(c: Chord): string {
  return noteToString(c.root) + c.suffix + (c.bass ? '/' + noteToString(c.bass) : '');
}

function normalize(q: string): string {
  return q
    .replace(/[♭]/g, 'b')
    .replace(/∆/g, 'Δ')
    .replace(/[♯]/g, '#')
    .replace(/[()\s,]/g, '')
    .replace(/^Δ7?/, 'maj7')
    .replace(/Δ/g, 'maj')
    .replace(/^ø7?/, 'm7b5')
    .replace(/°/g, 'dim')
    .replace(/^min/, 'm')
    .replace(/^mi(?!n)/, 'm')
    .replace(/^-/, 'm')
    .replace(/^(M|maj|Maj)$/, '')
    .replace(/^M(?=7|9|11|13)/, 'maj')
    .replace(/^Maj/, 'maj')
    .replace(/^mM/, 'mmaj');
}

const cache = new Map<string, ChordStructure | null>();

/** Devuelve la estructura del acorde para un sufijo, o null si no se reconoce. */
export function chordStructure(suffix: string): ChordStructure | null {
  if (cache.has(suffix)) return cache.get(suffix)!;
  const r = computeStructure(suffix);
  cache.set(suffix, r);
  return r;
}

function computeStructure(suffix: string): ChordStructure | null {
  let s = normalize(suffix);
  let third: number | null = 4;
  let fifth: number | null = 7;
  let fifthAltered = false;
  let seventh: number | null = null;
  let sixth = false;
  const ext = new Set<number>();

  if (s === '5') return { intervals: [0, 7], essential: [0, 7] };
  if (s === '2') s = 'sus2';
  if (s === '4') s = 'sus4';

  // Triada base
  if (s.startsWith('mmaj')) {
    third = 3;
    s = s.slice(1);
  } else if (s.startsWith('m') && !s.startsWith('maj')) {
    third = 3;
    s = s.slice(1);
  } else if (s.startsWith('dim')) {
    third = 3;
    fifth = 6;
    fifthAltered = true;
    s = s.slice(3);
    if (s.startsWith('7')) {
      seventh = 9;
      s = s.slice(1);
    }
  } else if (s.startsWith('aug') || s.startsWith('+')) {
    fifth = 8;
    fifthAltered = true;
    s = s.slice(s.startsWith('aug') ? 3 : 1);
  }

  // Séptima / extensiones principales
  let m: RegExpExecArray | null;
  if ((m = /^maj(7|9|11|13)/.exec(s))) {
    seventh = 11;
    addExtensions(ext, m[1]);
    s = s.slice(m[0].length);
  } else if ((m = /^6\/?9/.exec(s))) {
    sixth = true;
    ext.add(14);
    s = s.slice(m[0].length);
  } else if ((m = /^6/.exec(s))) {
    sixth = true;
    s = s.slice(1);
  } else if (seventh === null && (m = /^(7|9|11|13)/.exec(s))) {
    seventh = 10;
    addExtensions(ext, m[1]);
    s = s.slice(m[0].length);
  }

  // Resto de modificadores
  let sus: number | null = null;
  let omit3 = false;
  let omit5 = false;
  const tokens: [RegExp, () => void][] = [
    [/^sus2/, () => (sus = 2)],
    [/^sus4?/, () => (sus = 5)],
    [/^add(9|2)/, () => ext.add(14)],
    [/^add(11|4)/, () => ext.add(17)],
    [/^add(13|6)/, () => ext.add(21)],
    [/^(b5|-5)/, () => { fifth = 6; fifthAltered = true; }],
    [/^(#5|\+5|aug)/, () => { fifth = 8; fifthAltered = true; }],
    [/^(b9|-9)/, () => ext.add(13)],
    [/^(#9|\+9)/, () => ext.add(15)],
    [/^(#11|\+11)/, () => ext.add(18)],
    [/^(b13|-13)/, () => ext.add(20)],
    [/^13/, () => ext.add(21)],
    [/^11/, () => ext.add(17)],
    [/^9/, () => ext.add(14)],
    [/^(no3|omit3)/, () => (omit3 = true)],
    [/^(no5|omit5)/, () => (omit5 = true)],
    [/^alt/, () => { ext.add(13); ext.add(15); fifth = 6; fifthAltered = true; }],
    [/^\//, () => {}],
  ];
  let guard = 0;
  while (s.length && guard++ < 20) {
    let matched = false;
    for (const [re, fn] of tokens) {
      const mm = re.exec(s);
      if (mm) {
        fn();
        s = s.slice(mm[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }

  if (sus !== null) third = sus;
  if (omit3) third = null;
  // En acordes de 11 (no "add11", no "#11") la 3ra suele omitirse: la dejamos opcional.
  const has11 = ext.has(17);

  const intervals = [0];
  const essential = [0];
  if (third !== null) {
    intervals.push(third);
    if (!has11 || sus !== null) essential.push(third);
  }
  if (fifth !== null && !omit5) {
    intervals.push(fifth);
    if (fifthAltered) essential.push(fifth);
  }
  if (sixth) {
    intervals.push(9);
    essential.push(9);
  }
  if (seventh !== null) {
    intervals.push(seventh);
    essential.push(seventh);
  }
  const exts = [...ext].sort((a, b) => a - b);
  for (const e of exts) {
    intervals.push(e);
  }
  // Las alteraciones van antes que las extensiones "naturales" en importancia.
  const altered = exts.filter((e) => [13, 15, 18, 20].includes(e));
  const natural = exts.filter((e) => ![13, 15, 18, 20].includes(e)).reverse(); // 13 > 11 > 9
  essential.push(...altered, ...natural);
  return { intervals, essential };
}

function addExtensions(ext: Set<number>, level: string | undefined) {
  if (level === '9') ext.add(14);
  if (level === '11') {
    ext.add(14);
    ext.add(17);
  }
  if (level === '13') {
    ext.add(14);
    ext.add(21);
  }
}

/** Clases de altura (0..11) del acorde, empezando por la fundamental (y el bajo si es acorde con barra). */
export function chordPcs(c: Chord): number[] {
  const st = chordStructure(c.suffix)!;
  const root = noteToPc(c.root);
  const pcs = [...new Set(st.intervals.map((i) => mod(root + i, 12)))];
  if (c.bass) {
    const b = noteToPc(c.bass);
    if (!pcs.includes(b)) pcs.push(b);
  }
  return pcs;
}

export function bassPc(c: Chord): number {
  return noteToPc(c.bass ?? c.root);
}

/** Calidad simplificada (para detectar tonalidad). */
export function chordQuality(c: Chord): 'major' | 'minor' | 'dim' | 'other' {
  const st = chordStructure(c.suffix)!;
  const i = st.intervals;
  if (i.includes(3) && i.includes(6)) return 'dim';
  if (i.includes(3)) return 'minor';
  if (i.includes(4)) return 'major';
  return 'other';
}

const STEPS_BY_INTERVAL: Record<number, number> = {
  0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6,
  13: 1, 14: 1, 15: 1, 17: 3, 18: 3, 20: 5, 21: 5,
};

/** Nombre (con ortografía) de cada clase de altura del acorde: en C7 la séptima es Bb, no A#. */
export function chordNoteNames(c: Chord): Map<number, Note> {
  const st = chordStructure(c.suffix)!;
  const root = noteToPc(c.root);
  const isDim7 = st.intervals.includes(3) && st.intervals.includes(6) && st.intervals.includes(9) && !st.intervals.includes(10);
  const out = new Map<number, Note>();
  for (const i of st.intervals) {
    const steps = isDim7 && i === 9 ? 6 : STEPS_BY_INTERVAL[i] ?? 0;
    const letter = (c.root.letter + steps) % 7;
    const pc = mod(root + i, 12);
    let acc = mod(pc - [0, 2, 4, 5, 7, 9, 11][letter], 12);
    if (acc > 6) acc -= 12;
    if (!out.has(pc)) out.set(pc, { letter, acc });
  }
  if (c.bass) out.set(noteToPc(c.bass), c.bass);
  return out;
}
