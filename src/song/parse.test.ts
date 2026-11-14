import { describe, expect, it } from 'vitest';
import { parseSong } from './parse';

const lyr = (l: ReturnType<typeof parseSong>['lines'][number]) =>
  l.kind === 'lyrics' ? l.segments.map((s) => (s.chord ? `[${s.chord.raw}]` : '') + s.text).join('') : l.kind;

describe('parseSong', () => {
  it('acordes arriba de la letra', () => {
    const s = parseSong(['Key: G', '', 'G6', 'All of me', '                 B7', 'Why not take all of me?', '[Verse 2]', 'C6        Cm6    G6  Gb6 F6'].join('\n'));
    expect(s.key).toBe('G');
    expect(lyr(s.lines[0])).toBe('[G6]All of me');
    expect(lyr(s.lines[1])).toBe('Why not take all [B7]of me?');
    expect(s.lines[2]).toEqual({ kind: 'section', label: 'Verse 2' });
    expect(s.lines[3].kind).toBe('lyrics');
  });
  it('ChordPro', () => {
    const s = parseSong('{title: Prueba}\n{key: Eb}\n[Eb]Hola [Bb7/D]mundo\n{soc}\nLa la');
    expect(s.title).toBe('Prueba');
    expect(s.key).toBe('Eb');
    expect(lyr(s.lines[0])).toBe('[Eb]Hola [Bb7/D]mundo');
    expect(s.lines[1]).toEqual({ kind: 'section', label: 'Estribillo' });
  });
  it('no confunde letra con acordes', () => {
    const s = parseSong('A love song\nAm I wrong');
    expect(s.lines.every((l) => l.kind === 'lyrics' && l.segments.every((x) => !x.chord))).toBe(true);
  });
  it('intro con etiqueta', () => {
    const s = parseSong('Intro: G  D  Em  C');
    expect(lyr(s.lines[0]).replace(/\s+/g, ' ')).toBe('[Intro:] [G] [D] [Em] [C] ');
  });
});
