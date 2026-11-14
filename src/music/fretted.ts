// Posiciones (voicings) para instrumentos de cuerdas con trastes: guitarra y ukelele.
// Primero se buscan formas "de manual" conocidas; después, un generador busca todas
// las posiciones tocables y las ordena por comodidad.
import { Chord, bassPc, chordPcs, chordStructure, parseChord } from './chord';
import { mod, noteToPc } from './notes';

export type FrettedInstrument = 'guitar' | 'ukulele';

export interface FrettedSpec {
  name: string;
  /** Afinación en MIDI, de la cuerda más grave (índice 0) a la más aguda. */
  tuning: number[];
  stringNames: string[];
  /** Si la cuerda más grave sonando debe ser el bajo del acorde (no aplica al ukelele re-entrante). */
  bassMatters: boolean;
  minStrings: number;
  frets: number;
}

export const INSTRUMENTS: Record<FrettedInstrument, FrettedSpec> = {
  guitar: {
    name: 'Guitarra',
    tuning: [40, 45, 50, 55, 59, 64],
    stringNames: ['E', 'A', 'D', 'G', 'B', 'E'],
    bassMatters: true,
    minStrings: 4,
    frets: 15,
  },
  ukulele: {
    name: 'Ukelele',
    tuning: [67, 60, 64, 69],
    stringNames: ['G', 'C', 'E', 'A'],
    bassMatters: false,
    minStrings: 4,
    frets: 15,
  },
};

export interface Barre {
  fret: number;
  from: number;
  to: number;
}

export interface FrettedVoicing {
  /** null = cuerda al aire silenciada (x), 0 = al aire, n = traste. Índice 0 = cuerda más grave. */
  frets: (number | null)[];
  fingers: (number | null)[];
  barre?: Barre;
}

/* ---------- Formas conocidas ---------- */

const KNOWN: Record<FrettedInstrument, Record<string, string>> = {
  guitar: {
    C: 'x32010', C7: 'x32310', Cmaj7: 'x32000', Cm: 'x35543', Cadd9: 'x32030', C6: 'x32210',
    D: 'xx0232', D7: 'xx0212', Dm: 'xx0231', Dm7: 'xx0211', Dmaj7: 'xx0222', Dsus4: 'xx0233', Dsus2: 'xx0230', D6: 'xx0202',
    E: '022100', E7: '020100', Em: '022000', Em7: '022030', Emaj7: '021100', Esus4: '022200', E6: '022120',
    F: '133211', Fmaj7: 'xx3210', Fm: '133111', F7: '131211',
    G: '320003', G7: '320001', Gmaj7: '320002', G6: '320000', Gsus4: '330013',
    A: 'x02220', A7: 'x02020', Am: 'x02210', Am7: 'x02010', Amaj7: 'x02120', Asus4: 'x02230', Asus2: 'x02200', A6: 'x02222', Am6: 'x02212',
    B7: 'x21202', Bm: 'x24432', B: 'x24442', Bm7: 'x20202',
  },
  ukulele: {
    C: '0003', Cm: '0333', C7: '0001', Cmaj7: '0002', C6: '0000',
    D: '2220', Dm: '2210', D7: '2223', Dm7: '2213',
    E: '4442', Em: '0432', E7: '1202', Em7: '0202',
    F: '2010', Fm: '1013', F7: '2310', Fmaj7: '5500',
    G: '0232', Gm: '0231', G7: '0212', Gmaj7: '0222', G6: '0202',
    A: '2100', Am: '2000', A7: '0100', Am7: '0000', Amaj7: '1100',
    Bb: '3211', B: '4322', Bm: '4222', B7: '2322', Bm7: '2222',
  },
};

/** Firma de un acorde independiente de cómo se escribió (GM7 == Gmaj7). */
function signature(c: Chord): string {
  const root = noteToPc(c.root);
  const pcs = chordPcs(c).map((p) => mod(p - root, 12)).sort((a, b) => a - b);
  return `${root}|${pcs.join(',')}|${bassPc(c)}`;
}

const knownIndex: Record<FrettedInstrument, Map<string, string>> = { guitar: new Map(), ukulele: new Map() };
for (const inst of Object.keys(KNOWN) as FrettedInstrument[]) {
  for (const [name, shape] of Object.entries(KNOWN[inst])) {
    const c = parseChord(name);
    if (c) knownIndex[inst].set(signature(c), shape);
  }
}

function parseShape(shape: string): (number | null)[] {
  return [...shape].map((ch) => (ch === 'x' ? null : parseInt(ch, 36)));
}

/* ---------- Dedos y cejilla ---------- */

export function fingerize(frets: (number | null)[]): { fingers: (number | null)[]; barre?: Barre; count: number } | null {
  const fingers: (number | null)[] = frets.map(() => null);
  const fretted = frets
    .map((f, i) => ({ f, i }))
    .filter((x): x is { f: number; i: number } => x.f !== null && x.f > 0);
  if (!fretted.length) return { fingers, count: 0 };
  const minF = Math.min(...fretted.map((x) => x.f));

  const assign = (list: { f: number; i: number }[], start: number) => {
    list
      .sort((a, b) => a.f - b.f || a.i - b.i)
      .forEach((x, k) => (fingers[x.i] = start + k));
  };

  if (fretted.length <= 4) {
    assign(fretted, 1);
    return { fingers, count: fretted.length };
  }
  // Necesita cejilla: probar en cada traste (primero el más bajo) y quedarse con la que use menos dedos.
  const lastFretted = Math.max(...fretted.map((x) => x.i));
  const candidates = [...new Set(fretted.map((x) => x.f))].sort((a, b) => a - b);
  let best: { fret: number; from: number; to: number; count: number } | null = null;
  for (const bf of candidates) {
    // Probar todos los tramos de cuerdas [from..to] que empiezan y terminan en ese traste
    // y no tienen en el medio cuerdas al aire, apagadas o más abajo.
    for (let from = 0; from < frets.length; from++) {
      if (frets[from] !== bf) continue;
      for (let to = from + 1; to < frets.length; to++) {
        const f = frets[to];
        if (f === null || f < bf) break;
        if (f !== bf) continue;
        const covered = (x: { f: number; i: number }) => x.f === bf && x.i >= from && x.i <= to;
        const count = fretted.filter((x) => !covered(x)).length + 1;
        // A igual cantidad de dedos, preferir cejilla más baja y más larga (la clásica).
        const better = !best || count < best.count || (count === best.count && bf === best.fret && to - from > best.to - best.from);
        if (count <= 4 && better) best = { fret: bf, from, to, count };
      }
    }
  }
  // Si la cejilla está en el traste más bajo, extenderla hasta la última cuerda pisada (como se toca normalmente).
  if (best && best.fret === minF) {
    let to = best.to;
    while (to + 1 <= lastFretted && frets[to + 1] !== null && frets[to + 1]! >= minF) to++;
    best.to = to;
  }
  if (!best) return null;
  const b = best;
  const isCovered = (x: { f: number; i: number }) => x.f === b.fret && x.i >= b.from && x.i <= b.to;
  const below = fretted.filter((x) => !isCovered(x) && x.f < b.fret);
  const above = fretted.filter((x) => !isCovered(x) && x.f >= b.fret);
  assign(below, 1);
  const barreFinger = below.length + 1;
  for (const x of fretted) if (isCovered(x)) fingers[x.i] = barreFinger;
  assign(above, barreFinger + 1);
  return { fingers, barre: { fret: b.fret, from: b.from, to: b.to }, count: b.count };
}

/* ---------- Generador ---------- */

const cache = new Map<string, FrettedVoicing[]>();

export function frettedVoicings(c: Chord, inst: FrettedInstrument): FrettedVoicing[] {
  const key = inst + ':' + signature(c);
  const hit = cache.get(key);
  if (hit) return hit;

  const spec = INSTRUMENTS[inst];
  const out: FrettedVoicing[] = [];
  const seen = new Set<string>();
  const push = (frets: (number | null)[]) => {
    const k = frets.join(',');
    if (seen.has(k)) return;
    const fz = fingerize(frets);
    if (!fz) return;
    seen.add(k);
    out.push({ frets, fingers: fz.fingers, barre: fz.barre });
  };

  const known = knownIndex[inst].get(signature(c));
  if (known) push(parseShape(known));
  for (const v of generate(c, spec)) push(v);

  const result = out.slice(0, 10);
  cache.set(key, result);
  return result;
}

function generate(c: Chord, spec: FrettedSpec): (number | null)[][] {
  const st = chordStructure(c.suffix)!;
  const root = noteToPc(c.root);
  const pcs = chordPcs(c);
  const bass = bassPc(c);
  const essentialAll = [...new Set(st.essential.map((i) => mod(root + i, 12)))];
  if (c.bass && !essentialAll.includes(bass)) essentialAll.splice(1, 0, bass);

  const nStrings = spec.tuning.length;
  const minStrings = pcs.length <= 2 ? 2 : Math.min(spec.minStrings, nStrings);

  // Si no hay solución con todas las notas imprescindibles, se van soltando las menos importantes.
  for (let keep = essentialAll.length; keep >= Math.min(2, essentialAll.length); keep--) {
    const required = essentialAll.slice(0, keep);
    for (const minS of [minStrings, minStrings - 1]) {
      const found = search(spec, pcs, required, bass, minS);
      if (found.length) return found;
    }
  }
  return [];
}

function search(spec: FrettedSpec, pcs: number[], required: number[], bass: number, minStrings: number) {
  const n = spec.tuning.length;
  const results: { frets: (number | null)[]; score: number }[] = [];
  const seen = new Set<string>();

  for (let ws = 1; ws <= spec.frets - 3; ws++) {
    const options: (number | null)[][] = spec.tuning.map((open) => {
      const o: (number | null)[] = [null];
      if (pcs.includes(mod(open, 12))) o.push(0);
      for (let f = ws; f <= ws + 3; f++) if (pcs.includes(mod(open + f, 12))) o.push(f);
      return o;
    });
    const cur: (number | null)[] = new Array(n).fill(null);
    const rec = (s: number) => {
      if (s === n) {
        const k = cur.join(',');
        if (seen.has(k)) return;
        seen.add(k);
        const sc = evaluate(spec, cur, pcs, required, bass, minStrings);
        if (sc !== null) results.push({ frets: [...cur], score: sc });
        return;
      }
      for (const o of options[s]) {
        cur[s] = o;
        rec(s + 1);
      }
    };
    rec(0);
  }
  results.sort((a, b) => a.score - b.score);
  return results.slice(0, 12).map((r) => r.frets);
}

function evaluate(
  spec: FrettedSpec, frets: (number | null)[], pcs: number[], required: number[], bass: number, minStrings: number,
): number | null {
  const sounding = frets.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0);
  if (sounding.length < minStrings) return null;
  const notes = sounding.map((i) => mod(spec.tuning[i] + frets[i]!, 12));
  for (const r of required) if (!notes.includes(r)) return null;
  if (spec.bassMatters && notes[0] !== bass) return null;

  const fz = fingerize(frets);
  if (!fz) return null;

  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const span = maxF - minF;
  const first = sounding[0];
  const last = sounding[sounding.length - 1];
  let inner = 0;
  for (let i = first; i <= last; i++) if (frets[i] === null) inner++;
  if (inner > 1) return null;
  const leadMutes = first;
  const topMutes = frets.length - 1 - last;
  const opens = frets.filter((f) => f === 0).length;
  const missing = pcs.filter((p) => !notes.includes(p)).length;

  let score = 0;
  score += minF * 0.6 + span * 0.5 + fz.count * 0.35;
  score += leadMutes * 0.6 + inner * 3 + topMutes * 2.5;
  score -= sounding.length * 0.4;
  score += missing * 0.8;
  score -= opens * (minF <= 4 ? 0.3 : -0.4);
  if (fz.barre) score += 0.5;
  return score;
}
