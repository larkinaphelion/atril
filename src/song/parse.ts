// Convierte texto en una canción. Acepta:
//  1) Acordes arriba de la letra (como en Ultimate Guitar / Cifra Club).
//  2) ChordPro: acordes entre corchetes dentro de la letra ("[G6]All of me") y directivas {title: ...}.
// Mezclas de ambos también funcionan.
import { Chord, parseChord } from '../music/chord';

export interface ChordToken {
  raw: string;
  chord: Chord | null; // null = anotación ("|", "x2", "N.C.", ...)
}

export interface Segment {
  chord: ChordToken | null;
  text: string;
}

export type Line =
  | { kind: 'lyrics'; segments: Segment[] }
  | { kind: 'section'; label: string }
  | { kind: 'comment'; text: string }
  | { kind: 'blank' };

export interface ParsedSong {
  title?: string;
  artist?: string;
  key?: string;
  tempo?: number;
  lines: Line[];
}

const ANNOTATION = /^(\||\|\||\/|-|%|N\.?C\.?|\(?x\d+\)?|\d+x|\(|\)|\.\.\.|:\|\||\|\|:|\*)$/i;

function chordToken(tok: string): ChordToken | null {
  const c = parseChord(tok);
  if (c) return { raw: tok, chord: c };
  // Acorde entre paréntesis: "(G)"
  const p = /^\((.+)\)$/.exec(tok);
  if (p) {
    const cc = parseChord(p[1]);
    if (cc) return { raw: tok, chord: cc };
  }
  if (ANNOTATION.test(tok)) return { raw: tok, chord: null };
  return null;
}

/** Una línea es "de acordes" si todos sus tokens son acordes o anotaciones (y hay al menos un acorde). */
export function chordLineTokens(line: string): { col: number; tok: ChordToken }[] | null {
  const re = /\S+/g;
  const toks: { col: number; tok: ChordToken }[] = [];
  let m: RegExpExecArray | null;
  let label: { col: number; text: string } | null = null;
  let first = true;
  while ((m = re.exec(line))) {
    // Permite una etiqueta inicial tipo "Intro:" o "Estribillo:"
    if (first && /^[^\s:]{2,}:$/.test(m[0]) && !parseChord(m[0].slice(0, -1))) {
      label = { col: m.index, text: m[0] };
      first = false;
      continue;
    }
    first = false;
    const t = chordToken(m[0]);
    if (!t) return null;
    toks.push({ col: m.index, tok: t });
  }
  if (!toks.some((t) => t.tok.chord)) return null;
  if (label) toks.unshift({ col: label.col, tok: { raw: label.text, chord: null } });
  return toks;
}

const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const META = /^(title|t[ií]tulo|artist|artista|key|tono|tonalidad|tempo|bpm)\s*:\s*(.+)$/i;
const SECTION_BRACKET = /^\[([^\]]+)\]$/;
const SECTION_WORD = /^(intro|verso|verse|estrofa|estribillo|coro|chorus|puente|bridge|pre-?coro|pre-?chorus|solo|interludio|interlude|outro|final|coda|instrumental)\b.*:?$/i;

export function parseSong(text: string): ParsedSong {
  const song: ParsedSong = { lines: [] };
  const raw = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].replace(/\s+$/, '');
    const trimmed = line.trim();

    if (!trimmed) {
      song.lines.push({ kind: 'blank' });
      continue;
    }

    // Directivas ChordPro
    const d = DIRECTIVE.exec(trimmed);
    if (d) {
      handleDirective(song, d[1].toLowerCase(), d[2] ?? '');
      continue;
    }

    // Metadatos en texto plano
    const meta = META.exec(trimmed);
    if (meta && !trimmed.includes('[')) {
      const k = meta[1].toLowerCase();
      const v = meta[2].trim();
      if (k === 'title' || k === 'título' || k === 'titulo') song.title = v;
      else if (k.startsWith('artist')) song.artist = v;
      else if (k === 'bpm' || k === 'tempo') song.tempo = parseFloat(v) || undefined;
      else song.key = v.split(/\s/)[0];
      continue;
    }

    // [Verse 2] / [Estribillo] (pero no [G])
    const sb = SECTION_BRACKET.exec(trimmed);
    if (sb && !parseChord(sb[1])) {
      song.lines.push({ kind: 'section', label: sb[1].trim() });
      continue;
    }

    // Línea de acordes (formato "acordes arriba")
    const ct = chordLineTokens(line);
    if (ct) {
      const next = raw[i + 1]?.replace(/\s+$/, '') ?? '';
      const nextIsLyric = next.trim() && !chordLineTokens(next) && !DIRECTIVE.test(next.trim())
        && !(SECTION_BRACKET.test(next.trim()) && !parseChord(next.trim().slice(1, -1)))
        && !/\[[^\]]+\]/.test(next);
      if (nextIsLyric) {
        song.lines.push({ kind: 'lyrics', segments: merge(ct, next) });
        i++;
      } else {
        song.lines.push({ kind: 'lyrics', segments: chordsOnly(ct) });
      }
      continue;
    }

    // ChordPro en línea: "[G6]All of me [B7]why not"
    if (/\[[^\]]+\]/.test(line)) {
      const segs = inlineChordPro(line);
      if (segs) {
        song.lines.push({ kind: 'lyrics', segments: segs });
        continue;
      }
    }

    // Encabezado de sección sin corchetes ("Estribillo:")
    if (SECTION_WORD.test(trimmed) && trimmed.length < 30 && trimmed.split(/\s+/).length <= 3) {
      song.lines.push({ kind: 'section', label: trimmed.replace(/:$/, '') });
      continue;
    }

    song.lines.push({ kind: 'lyrics', segments: [{ chord: null, text: line }] });
  }

  // Sacar blancos al principio y al final
  while (song.lines[0]?.kind === 'blank') song.lines.shift();
  while (song.lines[song.lines.length - 1]?.kind === 'blank') song.lines.pop();
  return song;
}

function handleDirective(song: ParsedSong, name: string, value: string) {
  switch (name) {
    case 'title': case 't': song.title = value; break;
    case 'artist': case 'subtitle': case 'st': song.artist = value; break;
    case 'key': song.key = value; break;
    case 'tempo': song.tempo = parseFloat(value) || undefined; break;
    case 'comment': case 'c': case 'comment_italic': case 'ci':
      song.lines.push({ kind: 'comment', text: value }); break;
    case 'start_of_chorus': case 'soc': song.lines.push({ kind: 'section', label: value || 'Estribillo' }); break;
    case 'start_of_verse': case 'sov': song.lines.push({ kind: 'section', label: value || 'Verso' }); break;
    case 'start_of_bridge': case 'sob': song.lines.push({ kind: 'section', label: value || 'Puente' }); break;
    default: break; // end_of_*, etc.
  }
}

function merge(chords: { col: number; tok: ChordToken }[], lyric: string): Segment[] {
  const segs: Segment[] = [];
  if (chords[0].col > 0) segs.push({ chord: null, text: lyric.slice(0, chords[0].col) });
  chords.forEach((c, k) => {
    const end = k + 1 < chords.length ? chords[k + 1].col : Infinity;
    segs.push({ chord: c.tok, text: lyric.slice(c.col, end === Infinity ? undefined : end) });
  });
  return segs.filter((s, k) => k > 0 || s.chord || s.text);
}

function chordsOnly(chords: { col: number; tok: ChordToken }[]): Segment[] {
  return chords.map((c, k) => {
    const next = chords[k + 1];
    const gap = next ? next.col - c.col - c.tok.raw.length : 0;
    return { chord: c.tok, text: ' '.repeat(Math.max(1, gap)) };
  });
}

function inlineChordPro(line: string): Segment[] | null {
  const segs: Segment[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let current: ChordToken | null = null;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(line))) {
    const tok = chordToken(m[1].trim());
    if (!tok) return null;
    any = true;
    const text = line.slice(last, m.index);
    if (current || text) segs.push({ chord: current, text });
    current = tok;
    last = m.index + m[0].length;
  }
  if (!any) return null;
  segs.push({ chord: current, text: line.slice(last) });
  return segs;
}

/** Todos los acordes en orden de aparición (con repeticiones). */
export function allChords(lines: Line[]): Chord[] {
  const out: Chord[] = [];
  for (const l of lines) if (l.kind === 'lyrics') for (const s of l.segments) if (s.chord?.chord) out.push(s.chord.chord);
  return out;
}
