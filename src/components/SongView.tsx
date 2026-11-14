import { Fragment, memo } from 'react';
import type { Chord } from '../music/chord';
import type { Settings } from '../state/types';
import { ChordDiagram, ChordName } from './ChordUI';

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
  activeLine: number;
  activeSeg: number;
  onLineClick: (line: number) => void;
}

export function SongView({ lines, unique, settings, activeLine, activeSeg, onLineClick }: Props) {
  const hideChords = settings.instrument === 'none';
  const diagrams = !hideChords && settings.chordView === 'diagrams';
  const placement = diagrams ? settings.placement : 'names';
  const colsClass = settings.lyricColumns === 2 ? ' cols-2' : '';

  const renderLine = (l: DisplayLine, i: number, inlineDiagrams: boolean) => (
    <LineView key={i} line={l} index={i} inlineDiagrams={inlineDiagrams} hideChords={hideChords}
      active={i === activeLine} activeSeg={i === activeLine ? activeSeg : -2} onClick={onLineClick} />
  );

  if (placement === 'side' && settings.sideOrder === 'repeat') {
    return (
      <div className={'song side-rows' + colsClass}>
        {lines.map((l, i) => {
          const chords = l.kind === 'lyrics'
            ? l.segments.filter((s): s is DisplaySegment & { chord: Chord; name: string } => !!s.chord && !!s.name)
            : [];
          return (
            <div key={i} className="side-row">
              {renderLine(l, i, false)}
              <div className="side-row-diagrams">
                {chords.map((s, k) => <ChordDiagram key={k} chord={s.chord} name={s.name} scaleMul={0.8} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (placement === 'side') {
    return (
      <div className="song side-layout">
        <div className={'lyrics' + colsClass}>{lines.map((l, i) => renderLine(l, i, false))}</div>
        <aside className="side-diagrams">
          <DiagramGrid unique={unique} />
        </aside>
      </div>
    );
  }

  return (
    <div className="song">
      {placement === 'top' && <DiagramGrid unique={unique} />}
      <div className={'lyrics' + colsClass}>{lines.map((l, i) => renderLine(l, i, placement === 'inline'))}</div>
    </div>
  );
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
