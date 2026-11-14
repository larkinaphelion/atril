import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chordNoteNames, type Chord } from '../music/chord';
import { isAwkward, midiName, noteToString } from '../music/notes';
import { INSTRUMENTS, frettedVoicings } from '../music/fretted';
import { KeyboardRange, partialRange, pianoVoicing } from '../music/piano';
import type { Settings } from '../state/types';
import { FretBox, FullNeck, Piano } from './diagrams';

export interface ChordCtx {
  settings: Settings;
  pianoRange: KeyboardRange;
  voicingIndex: (name: string) => number;
  cycleVoicing: (name: string, delta: number, total: number) => void;
  showPopover: (name: string, chord: Chord, anchor: HTMLElement) => void;
  hidePopover: () => void;
}

export const ChordContext = createContext<ChordCtx | null>(null);
export const useChordCtx = () => useContext(ChordContext)!;

/** Diagrama del acorde para el instrumento elegido. Tocarlo pasa a la siguiente posición. */
export function ChordDiagram({ chord, name, showName = true, scaleMul = 1, cycle = true, compact = false }: {
  chord: Chord; name: string; showName?: boolean; scaleMul?: number; cycle?: boolean; compact?: boolean;
}) {
  const ctx = useChordCtx();
  const { settings } = ctx;
  const scale = settings.diagramSize * scaleMul;
  const inst = settings.instrument;
  const scope = compact ? 'partial' : settings.scope;
  if (inst === 'none') return null;

  let body: JSX.Element;
  let total = 1;
  let idx = 0;
  if (inst === 'piano') {
    const notes = pianoVoicing(chord, ctx.pianoRange);
    const range = scope === 'full' ? ctx.pianoRange : partialRange(notes, ctx.pianoRange);
    const spelled = chordNoteNames(chord);
    const labels = notes.map((m) => { const n = spelled.get(m % 12); return n && !isAwkward(n) ? noteToString(n) + (Math.floor(m / 12) - 1) : midiName(m, name[1] === 'b' ? 'flat' : 'sharp'); });
    body = <Piano notes={notes} range={range} scale={scale * (scope === 'full' ? 0.85 : 1)} labels={labels} />;
  } else {
    const voicings = frettedVoicings(chord, inst);
    total = voicings.length;
    if (!total) {
      body = <div className="diagram-missing">?</div>;
    } else {
      idx = ctx.voicingIndex(name) % total;
      const v = voicings[idx];
      const spec = INSTRUMENTS[inst];
      body = scope === 'full'
        ? <FullNeck voicing={v} spec={spec} scale={scale} showFingers={settings.showFingers} />
        : <FretBox voicing={v} spec={spec} scale={scale} showFingers={settings.showFingers} />;
    }
  }

  const canCycle = cycle && total > 1;
  return (
    <figure
      className={'chord-diagram' + (canCycle ? ' cyclable' : '')}
      onClick={canCycle ? (e) => { e.stopPropagation(); ctx.cycleVoicing(name, e.shiftKey ? -1 : 1, total); } : undefined}
      title={canCycle ? 'Tocá para ver otra posición' : undefined}
    >
      {showName && (
        <figcaption>
          <span className="chord-label" style={{ fontSize: settings.chordSize * 0.9 }}>{name}</span>
          {canCycle && <span className="voicing-count">{idx + 1}/{total}</span>}
        </figcaption>
      )}
      {body}
    </figure>
  );
}

/** Nombre del acorde; al pasar el mouse o mantener apretado muestra cómo se hace. */
export function ChordName({ chord, name, active }: { chord: Chord | null; name: string; active?: boolean }) {
  const ctx = useChordCtx();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>();
  const longPressed = useRef(false);
  const canShow = !!chord && ctx.settings.instrument !== 'none';

  if (!chord) return <span className="chord-name annotation">{name}</span>;

  const open = () => canShow && ref.current && ctx.showPopover(name, chord, ref.current);
  return (
    <span
      ref={ref}
      className={'chord-name' + (active ? ' active' : '')}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') open(); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') ctx.hidePopover(); }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        longPressed.current = false;
        timer.current = window.setTimeout(() => { longPressed.current = true; open(); }, 350);
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerCancel={() => window.clearTimeout(timer.current)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (!longPressed.current) open();
      }}
    >
      {name}
    </span>
  );
}

export interface PopoverState {
  name: string;
  chord: Chord;
  anchor: HTMLElement;
}

export function ChordPopover({ state, onClose }: { state: PopoverState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!state || !ref.current) return setPos(null);
    const a = state.anchor.getBoundingClientRect();
    const p = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = a.left + a.width / 2 - p.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    let top = a.top - p.height - 8;
    if (top < margin) top = a.bottom + 8;
    setPos({ left, top });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = (e: Event) => {
      if (ref.current?.contains(e.target as Node) || state.anchor.contains(e.target as Node)) return;
      onClose();
    };
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', close);
      window.addEventListener('scroll', onClose, { passive: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', onClose);
    };
  }, [state, onClose]);

  if (!state) return null;
  return (
    <div ref={ref} className="chord-popover" style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
      <ChordDiagram chord={state.chord} name={state.name} scaleMul={1.2} />
    </div>
  );
}
