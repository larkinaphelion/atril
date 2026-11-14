// Diagramas de acordes en SVG: caja de trastes (parcial), mástil completo y teclado de piano.
import type { FrettedSpec, FrettedVoicing } from '../music/fretted';
import { isBlackKey, midiName, mod } from '../music/notes';
import type { KeyboardRange } from '../music/piano';

interface FretProps {
  voicing: FrettedVoicing;
  spec: FrettedSpec;
  scale: number;
  showFingers: boolean;
}

/** Caja vertical de 5 trastes con el número de traste inicial (como en los cancioneros). */
export function FretBox({ voicing, spec, scale, showFingers }: FretProps) {
  const n = spec.tuning.length;
  const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const base = maxF <= 5 ? 1 : minF;
  const rows = Math.max(5, maxF - base + 1);
  const gap = 14;
  const fretH = 17;
  const padL = 22;
  const padT = 18;
  const w = padL + (n - 1) * gap + 14;
  const h = padT + rows * fretH + 6;
  const x = (i: number) => padL + i * gap;
  const y = (f: number) => padT + (f - base + 0.5) * fretH;
  const b = voicing.barre;

  return (
    <svg className="diagram fretbox" viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} role="img">
      {/* cuerdas */}
      {Array.from({ length: n }, (_, i) => (
        <line key={'s' + i} x1={x(i)} y1={padT} x2={x(i)} y2={padT + rows * fretH} className="d-line" />
      ))}
      {/* trastes */}
      {Array.from({ length: rows + 1 }, (_, k) => (
        <line key={'f' + k} x1={x(0)} y1={padT + k * fretH} x2={x(n - 1)} y2={padT + k * fretH}
          className={k === 0 && base === 1 ? 'd-nut' : 'd-line'} />
      ))}
      {base > 1 && (
        <text x={padL - 9} y={padT + fretH * 0.5 + 4} className="d-label" textAnchor="end">{base}</text>
      )}
      {/* x / o */}
      {voicing.frets.map((f, i) =>
        f === null ? (
          <text key={'m' + i} x={x(i)} y={padT - 6} className="d-mark" textAnchor="middle">×</text>
        ) : f === 0 ? (
          <circle key={'o' + i} cx={x(i)} cy={padT - 9} r={3.6} className="d-open" />
        ) : null,
      )}
      {/* cejilla */}
      {b && (
        <g>
          <rect x={x(b.from) - 6} y={y(b.fret) - 6} width={x(b.to) - x(b.from) + 12} height={12} rx={6} className="d-dot" />
          {showFingers && <text x={(x(b.from) + x(b.to)) / 2} y={y(b.fret) + 4} className="d-finger" textAnchor="middle">{voicing.fingers[b.from] ?? 1}</text>}
        </g>
      )}
      {/* dedos */}
      {voicing.frets.map((f, i) => {
        if (f === null || f === 0) return null;
        if (b && f === b.fret && i >= b.from && i <= b.to) return null;
        return (
          <g key={'d' + i}>
            <circle cx={x(i)} cy={y(f)} r={6} className="d-dot" />
            {showFingers && voicing.fingers[i] && (
              <text x={x(i)} y={y(f) + 4} className="d-finger" textAnchor="middle">{voicing.fingers[i]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Mástil completo horizontal (traste 0 a 15), cuerda más aguda arriba como en una tablatura. */
export function FullNeck({ voicing, spec, scale, showFingers }: FretProps) {
  const n = spec.tuning.length;
  const frets = spec.frets;
  const fw = 26;
  const rowGap = 13;
  const padL = 30;
  const padT = 8;
  const w = padL + frets * fw + 6;
  const h = padT + (n - 1) * rowGap + 22;
  const yS = (i: number) => padT + (n - 1 - i) * rowGap;
  const xF = (f: number) => padL + (f - 0.5) * fw;
  const midY = padT + ((n - 1) * rowGap) / 2;
  const b = voicing.barre;

  return (
    <svg className="diagram neck" viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} role="img">
      {[3, 5, 7, 9, 15].filter((f) => f <= frets).map((f) => (
        <circle key={'in' + f} cx={xF(f)} cy={midY} r={3.5} className="d-inlay" />
      ))}
      {frets >= 12 && (
        <>
          <circle cx={xF(12)} cy={padT + rowGap * 0.9} r={3.5} className="d-inlay" />
          <circle cx={xF(12)} cy={padT + (n - 1) * rowGap - rowGap * 0.9} r={3.5} className="d-inlay" />
        </>
      )}
      {Array.from({ length: n }, (_, i) => (
        <g key={'s' + i}>
          <line x1={padL} y1={yS(i)} x2={padL + frets * fw} y2={yS(i)} className="d-line" />
          <text x={6} y={yS(i) + 3.5} className="d-small">{spec.stringNames[i]}</text>
        </g>
      ))}
      {Array.from({ length: frets + 1 }, (_, k) => (
        <line key={'f' + k} x1={padL + k * fw} y1={yS(n - 1)} x2={padL + k * fw} y2={yS(0)} className={k === 0 ? 'd-nut' : 'd-line'} />
      ))}
      {Array.from({ length: frets }, (_, k) => k + 1).filter((f) => [1, 3, 5, 7, 9, 12, 15].includes(f)).map((f) => (
        <text key={'n' + f} x={xF(f)} y={h - 4} className="d-small" textAnchor="middle">{f}</text>
      ))}
      {voicing.frets.map((f, i) =>
        f === null ? (
          <text key={'m' + i} x={padL - 8} y={yS(i) + 4} className="d-mark" textAnchor="middle">×</text>
        ) : f === 0 ? (
          <circle key={'o' + i} cx={padL - 8} cy={yS(i)} r={3.6} className="d-open" />
        ) : null,
      )}
      {b && (
        <rect x={xF(b.fret) - 6} y={yS(b.to) - 6} width={12} height={yS(b.from) - yS(b.to) + 12} rx={6} className="d-dot" />
      )}
      {voicing.frets.map((f, i) => {
        if (f === null || f === 0) return null;
        const onBarre = b && f === b.fret && i >= b.from && i <= b.to;
        return (
          <g key={'d' + i}>
            {!onBarre && <circle cx={xF(f)} cy={yS(i)} r={6} className="d-dot" />}
            {showFingers && voicing.fingers[i] && (!onBarre || i === b!.to) && (
              <text x={xF(f)} y={yS(i) + 4} className="d-finger" textAnchor="middle">{voicing.fingers[i]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface PianoProps {
  notes: number[];
  range: KeyboardRange;
  scale: number;
  labels: string[];
  /** Mostrar nombres de las notas presionadas debajo (p. ej. "G3 B3 D4 E4"). */
  caption?: boolean;
}

/** Teclado con las teclas del acorde marcadas. Las C llevan su octava (C3, C4...). */
export function Piano({ notes, range, scale, labels, caption = true }: PianoProps) {
  let low = range.low;
  let high = range.high;
  if (isBlackKey(low)) low--;
  if (isBlackKey(high)) high++;
  const whites: number[] = [];
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) whites.push(m);
  const ww = 13;
  const wh = 52;
  const bw = 8;
  const bh = 32;
  const w = whites.length * ww + 2;
  const h = wh + 14;
  const xWhite = (m: number) => 1 + whites.indexOf(m) * ww;
  const pressed = new Set(notes);

  return (
    <div className="piano-wrap">
      <svg className="diagram piano" viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} role="img">
        {whites.map((m) => (
          <g key={m}>
            <rect x={xWhite(m)} y={1} width={ww} height={wh} rx={2} className={pressed.has(m) ? 'k-white on' : 'k-white'} />
            {pressed.has(m) && <circle cx={xWhite(m) + ww / 2} cy={wh - 9} r={4} className="k-dot" />}
            {mod(m, 12) === 0 && (
              <text x={xWhite(m) + ww / 2} y={h - 2} className="d-small" textAnchor="middle">{midiName(m)}</text>
            )}
          </g>
        ))}
        {Array.from({ length: high - low + 1 }, (_, k) => low + k).filter(isBlackKey).map((m) => {
          const x = xWhite(m - 1) + ww - bw / 2;
          return (
            <g key={m}>
              <rect x={x} y={1} width={bw} height={bh} rx={1.5} className={pressed.has(m) ? 'k-black on' : 'k-black'} />
              {pressed.has(m) && <circle cx={x + bw / 2} cy={bh - 7} r={3.2} className="k-dot" />}
            </g>
          );
        })}
      </svg>
      {caption && <div className="piano-caption">{labels.join(' · ')}</div>}
    </div>
  );
}
