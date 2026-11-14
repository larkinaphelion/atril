import { Fragment, memo } from 'react';
import type { Chord } from '../music/chord';
import type { Settings } from '../state/types';
import { ChordDiagram, ChordName } from './ChordUI';
import { SplitPane } from './SplitPane';

export interface DisplaySegment {
  name: string | null; // null = sin acorde
  chord: Chord | null; // null = anotación ("|", "x2") o sin acorde
  text: string;
}

export type DisplayLine =
  | { kind: 'lyrics'; segments: DisplaySegment[] }
  | { kind: 'section'; label: string }
  | { kind: 'comment'; text: string }
  | { kind: 'blank' };

export interface UniqueChord {
  name: string;
  chord: Chord;
}

interface Props {
  lines: DisplayLine[];
  unique: UniqueChord[]; // ya ordenados según la preferencia
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  activeLine: number;
  activeSeg: number;
  onLineClick: (line: number) => void;
}

export function SongView({ lines, unique, settings, setSettings, activeLine, activeSeg, onLineClick }: Props) {
  const hideChords = settings.instrument === 'none';
  const diagrams = !hideChords && settings.chordView === 'diagrams';
  const placement = diagrams ? settings.placement : 'names';
  const inline = placement === 'inline';
  const twoCols = settings.lyricColumns === 2;

  const renderLine = (l: DisplayLine, i: number) => (
    <LineView key={i} line={l} index={i} inlineDiagrams={inline} hideChords={hideChords}
      active={i === activeLine} activeSeg={i === activeLine ? activeSeg : -2} onClick={onLineClick} />
  );
  const indices = lines.map((_, i) => i);
  // Para dos columnas: se corta en un límite de estrofa cerca de la mitad.
  const cut = twoCols ? splitPoint(lines, inline) : lines.length;
  const halves = [indices.slice(0, cut), indices.slice(cut)];

  const colSplit = (left: React.ReactNode, right: React.ReactNode, className = '') => (
    <SplitPane className={'lyric-cols ' + className} split={settings.colSplit} defaultSplit={0.5}
      label="Ancho de las columnas de letra" onCommit={(colSplit) => setSettings({ colSplit })} rows={[[left, right]]} />
  );
  const lyricsBlock = (ids: number[]) => <div className="lyrics">{ids.map((i) => renderLine(lines[i], i))}</div>;

  if (placement === 'side' && settings.sideOrder === 'repeat') {
    // Cada línea con sus diagramas al lado; una sola barra para todas las filas.
    const rowsFor = (ids: number[]) => (
      <SplitPane className="side-rows lyrics" split={settings.sideSplit} defaultSplit={0.65}
        label="Ancho de letra y diagramas" onCommit={(sideSplit) => setSettings({ sideSplit })}
        rows={ids.map((i) => {
          const l = lines[i];
          const chords = l.kind === 'lyrics'
            ? l.segments.filter((s): s is DisplaySegment & { chord: Chord; name: string } => !!s.chord && !!s.name)
            : [];
          return [
            renderLine(l, i),
            <div className="side-row-diagrams">
              {chords.map((s, k) => <ChordDiagram key={k} chord={s.chord} name={s.name} scaleMul={0.8} />)}
            </div>,
          ];
        })} />
    );
    return <div className="song">{twoCols ? colSplit(rowsFor(halves[0]), rowsFor(halves[1])) : rowsFor(indices)}</div>;
  }

  const lyrics = twoCols ? colSplit(lyricsBlock(halves[0]), lyricsBlock(halves[1])) : lyricsBlock(indices);

  if (placement === 'side') {
    return (
      <div className="song">
        <SplitPane className="side-layout" split={settings.sideSplit} defaultSplit={0.65}
          label="Ancho de letra y diagramas" onCommit={(sideSplit) => setSettings({ sideSplit })}
          rows={[[lyrics, <aside className="side-diagrams"><DiagramGrid unique={unique} /></aside>]]} />
      </div>
    );
  }

  return (
    <div className="song">
      {placement === 'top' && <DiagramGrid unique={unique} />}
      {lyrics}
    </div>
  );
}

/** Índice donde empieza la segunda columna: el límite de estrofa más cercano a la mitad de la altura. */
function splitPoint(lines: DisplayLine[], inlineDiagrams: boolean): number {
  const weight = (l: DisplayLine) => {
    if (l.kind === 'blank') return 0.6;
    if (l.kind !== 'lyrics') return 1;
    const chords = l.segments.some((s) => s.name);
    return chords ? (inlineDiagrams ? 5 : 2) : 1;
  };
  const w = lines.map(weight);
  const total = w.reduce((a, b) => a + b, 0);
  let best = Math.ceil(lines.length / 2);
  let bestScore = Infinity;
  let acc = 0;
  for (let i = 1; i < lines.length; i++) {
    acc += w[i - 1];
    const boundary = lines[i].kind === 'section' || lines[i - 1].kind === 'blank';
    const score = Math.abs(acc - total / 2) + (boundary ? 0 : total * 0.15);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  // No empezar la segunda columna con un renglón en blanco.
  while (best < lines.length && lines[best].kind === 'blank') best++;
  return best;
}

export function DiagramGrid({ unique, scaleMul = 1, compact = false }: { unique: UniqueChord[]; scaleMul?: number; compact?: boolean }) {
  return (
    <div className="diagram-grid">
      {unique.map((u) => <ChordDiagram key={u.name} chord={u.chord} name={u.name} scaleMul={scaleMul} compact={compact} />)}
    </div>
  );
}

const LineView = memo(function LineView({ line, index, inlineDiagrams, hideChords, active, activeSeg, onClick }: {
  line: DisplayLine; index: number; inlineDiagrams: boolean; hideChords: boolean;
  active: boolean; activeSeg: number; onClick: (i: number) => void;
}) {
  if (line.kind === 'blank') return <div className="line blank" />;
  if (line.kind === 'section') return <div className="line section">{line.label}</div>;
  if (line.kind === 'comment') return <div className="line comment">{line.text}</div>;

  const hasChords = !hideChords && line.segments.some((s) => s.name);
  const hasText = line.segments.some((s) => s.text.trim());
  if (hideChords && !hasText) return null;

  if (!hasChords) {
    return (
      <div className={'line lyrics-line plain' + (active ? ' active' : '')} data-line={index} onClick={() => onClick(index)}>
        {line.segments.map((s) => s.text).join('')}
      </div>
    );
  }

  // Se agrupa por palabras para que, si la línea no entra en pantalla, corte entre palabras y no en medio.
  const words = groupWords(line.segments);
  return (
    <div className={'line lyrics-line' + (active ? ' active' : '') + (hasText ? '' : ' chords-only')}
      data-line={index} onClick={() => onClick(index)}>
      {words.map((w, wi) => (
        <span className="word" key={wi}>
          {w.map((it, k) => (
            <Fragment key={k}>
              <span className="seg">
                <span className="seg-chord">
                  {it.seg && it.seg.name && (inlineDiagrams && it.seg.chord
                    ? <ChordDiagram chord={it.seg.chord} name={it.seg.name} scaleMul={0.75} />
                    : <ChordName chord={it.seg.chord} name={it.seg.name} active={activeSeg === it.segIndex} />)}
                </span>
                <span className="seg-text">{it.text || (hasText ? '' : ' ')}</span>
              </span>
            </Fragment>
          ))}
        </span>
      ))}
    </div>
  );
});

interface WordItem {
  seg: DisplaySegment | null; // segmento cuyo acorde va arriba de este pedazo (solo el primero)
  segIndex: number;
  text: string;
}

function groupWords(segments: DisplaySegment[]): WordItem[][] {
  const words: WordItem[][] = [];
  let prevEndsWithSpace = true;
  segments.forEach((s, si) => {
    const pieces = s.text.match(/\S+\s*|\s+/g) ?? [''];
    pieces.forEach((p, pi) => {
      const item: WordItem = { seg: pi === 0 ? s : null, segIndex: si, text: p };
      const startsWord = prevEndsWithSpace || /^\s/.test(p) || !words.length;
      if (startsWord) words.push([item]);
      else words[words.length - 1].push(item);
      prevEndsWithSpace = p === '' ? prevEndsWithSpace : /\s$/.test(p);
    });
  });
  return words;
}
