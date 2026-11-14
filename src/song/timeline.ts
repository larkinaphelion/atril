// Línea de tiempo para el avance automático: cuántos tiempos (beats) dura cada acorde / línea.
import type { Line } from './parse';

export interface TimelineEvent {
  line: number;
  /** Índice del segmento con el acorde, o -1 si es una línea de letra sin acordes. */
  seg: number;
  start: number; // en beats
  beats: number;
}

/**
 * Cada acorde dura `beatsPerChord` tiempos. Si la línea usa barras de compás ("| C6 Cm6 |"),
 * los acordes dentro de un mismo compás se reparten ese compás.
 * Las líneas de letra sin acordes duran `beatsPerLine` tiempos (0 = se saltean).
 */
export function buildTimeline(lines: Line[], beatsPerChord: number, beatsPerLine: number): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let t = 0;
  lines.forEach((l, li) => {
    if (l.kind !== 'lyrics') return;
    const chordSegs = l.segments.map((s, i) => ({ s, i })).filter((x) => x.s.chord);
    const hasChords = chordSegs.some((x) => x.s.chord!.chord);
    if (!hasChords) {
      const hasText = l.segments.some((s) => s.text.trim());
      if (hasText && beatsPerLine > 0) {
        events.push({ line: li, seg: -1, start: t, beats: beatsPerLine });
        t += beatsPerLine;
      }
      return;
    }
    const usesBars = chordSegs.some((x) => /^\|+:?$|^:?\|+$/.test(x.s.chord!.raw));
    if (usesBars) {
      let bar: number[] = [];
      const flush = () => {
        if (!bar.length) return;
        const each = beatsPerChord / bar.length;
        for (const i of bar) {
          events.push({ line: li, seg: i, start: t, beats: each });
          t += each;
        }
        bar = [];
      };
      for (const { s, i } of chordSegs) {
        if (s.chord!.chord) bar.push(i);
        else if (s.chord!.raw.includes('|')) flush();
      }
      flush();
    } else {
      for (const { s, i } of chordSegs) {
        if (!s.chord!.chord) continue;
        events.push({ line: li, seg: i, start: t, beats: beatsPerChord });
        t += beatsPerChord;
      }
    }
  });
  return events;
}
