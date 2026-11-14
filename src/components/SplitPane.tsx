import { Fragment, useRef } from 'react';

interface Props {
  /** Fracción del ancho para la columna izquierda (0..1). */
  split: number;
  onCommit: (split: number) => void;
  /** Valor al que vuelve con doble clic. */
  defaultSplit: number;
  /** Filas: cada una con su celda izquierda y derecha. La barra separadora ocupa todas las filas. */
  rows: [React.ReactNode, React.ReactNode][];
  className?: string;
  label?: string;
  min?: number;
  max?: number;
}

const HANDLE = 14;

/**
 * Dos columnas con una barra en el medio que se arrastra (mouse o dedo) para cambiar el ancho.
 * Mientras se arrastra se actualiza el estilo directamente (sin re-renderizar la canción) y al
 * soltar se guarda el valor.
 */
export function SplitPane({ split, onCommit, defaultSplit, rows, className = '', label = 'Ancho de columnas', min = 0.15, max = 0.85 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useRef(split);
  live.current = split;
  const dragging = useRef(false);

  const template = (f: number) => `minmax(0, ${f}fr) ${HANDLE}px minmax(0, ${1 - f}fr)`;
  const clamp = (f: number) => Math.min(max, Math.max(min, f));

  const apply = (f: number) => {
    live.current = f;
    if (ref.current) ref.current.style.gridTemplateColumns = template(f);
    ref.current?.querySelector(':scope > .split-handle')?.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  };

  const fromEvent = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return clamp((clientX - r.left - HANDLE / 2) / (r.width - HANDLE));
  };

  return (
    <div ref={ref} className={'split ' + className} style={{ gridTemplateColumns: template(split) }}>
      {rows.map(([a, b], i) => (
        <Fragment key={i}>
          <div className="split-a" style={{ gridRow: i + 1, gridColumn: 1 }}>{a}</div>
          <div className="split-b" style={{ gridRow: i + 1, gridColumn: 3 }}>{b}</div>
        </Fragment>
      ))}
      <div
        className="split-handle"
        style={{ gridRow: `1 / ${rows.length + 1}`, gridColumn: 2 }}
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        aria-valuenow={Math.round(split * 100)}
        tabIndex={0}
        title="Arrastrá para cambiar el ancho (doble clic: volver al original)"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          ref.current?.classList.add('dragging');
        }}
        onPointerMove={(e) => { if (dragging.current) apply(fromEvent(e.clientX)); }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          ref.current?.classList.remove('dragging');
          onCommit(live.current);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          ref.current?.classList.remove('dragging');
          onCommit(live.current);
        }}
        onDoubleClick={() => { apply(defaultSplit); onCommit(defaultSplit); }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowLeft' ? -0.02 : e.key === 'ArrowRight' ? 0.02 : 0;
          if (!d) return;
          e.preventDefault();
          const f = clamp(live.current + d);
          apply(f);
          onCommit(f);
        }}
      >
        <span className="split-grip" />
      </div>
    </div>
  );
}
