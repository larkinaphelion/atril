import { useRef } from 'react';
import { MAJOR_KEYS, MINOR_KEYS, Key, keyToString } from '../music/key';
import { midiName } from '../music/notes';
import { KEYBOARD_PRESETS } from '../music/piano';
import type { Settings, SongRecord } from '../state/types';
import { Icon } from './Icon';

function Seg<T extends string | number>({ value, options, onChange }: {
  value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="seg-control" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel-row">
      <div className="panel-label">{label}</div>
      {children}
    </div>
  );
}

function Slider({ value, min, max, step, onChange, format }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="slider">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label="Menos"><Icon name="minus" size={16} /></button>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} aria-label="Más"><Icon name="plus" size={16} /></button>
      <span className="slider-value">{format ? format(value) : value}</span>
    </div>
  );
}

export function SettingsPanel({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const diagrams = s.instrument !== 'none' && s.chordView === 'diagrams';
  const lowOptions: number[] = [];
  for (let m = 21; m <= 60; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) lowOptions.push(m);

  return (
    <div className="panel-body">
      <Row label="Instrumento">
        <Seg value={s.instrument} onChange={(instrument) => set({ instrument })}
          options={[['guitar', 'Guitarra'], ['ukulele', 'Ukelele'], ['piano', 'Piano'], ['none', 'Solo letra']]} />
      </Row>
      {s.instrument !== 'none' && (
        <Row label="Acordes">
          <Seg value={s.chordView} onChange={(chordView) => set({ chordView })}
            options={[['names', 'Solo nombres'], ['diagrams', 'Cómo hacerlos']]} />
          <p className="hint">Con "Solo nombres", pasá el mouse o mantené apretado un acorde para ver cómo se hace.</p>
        </Row>
      )}
      {diagrams && (
        <Row label="Dónde mostrar cómo hacerlos">
          <Seg value={s.placement} onChange={(placement) => set({ placement })}
            options={[['top', 'Antes de la letra'], ['inline', 'Sobre la letra'], ['side', 'Al costado']]} />
        </Row>
      )}
      {diagrams && s.placement !== 'inline' && (
        <Row label="Orden">
          <Seg value={s.placement === 'top' && s.sideOrder === 'repeat' ? 'appearance' : s.sideOrder}
            onChange={(sideOrder) => set({ sideOrder })}
            options={[['appearance', 'Como aparecen'], ['alpha', 'Alfabético'],
              ...(s.placement === 'side' ? [['repeat', 'Repetir en cada línea'] as ['repeat', string]] : [])]} />
        </Row>
      )}
      {s.instrument !== 'none' && (
        <Row label="Vista del instrumento">
          <Seg value={s.scope} onChange={(scope) => set({ scope })}
            options={[['partial', s.instrument === 'piano' ? 'Solo las octavas del acorde' : 'Solo los trastes del acorde'],
              ['full', s.instrument === 'piano' ? 'Teclado completo' : 'Mástil completo']]} />
        </Row>
      )}
      {(s.instrument === 'guitar' || s.instrument === 'ukulele') && (
        <Row label="Números de dedos">
          <Seg value={s.showFingers ? 1 : 0} onChange={(v) => set({ showFingers: !!v })} options={[[1, 'Mostrar'], [0, 'Ocultar']]} />
        </Row>
      )}
      {s.instrument === 'piano' && (
        <Row label="Mi teclado">
          <div className="inline-fields">
            <label>
              Teclas
              <input type="number" min={12} max={88} value={s.pianoKeys}
                onChange={(e) => {
                  const k = Math.max(12, Math.min(88, +e.target.value || 61));
                  set({ pianoKeys: k, pianoLow: KEYBOARD_PRESETS[k] ?? s.pianoLow });
                }} list="key-presets" />
              <datalist id="key-presets">
                {Object.keys(KEYBOARD_PRESETS).map((k) => <option key={k} value={k} />)}
              </datalist>
            </label>
            <label>
              Desde
              <select value={s.pianoLow} onChange={(e) => set({ pianoLow: +e.target.value })}>
                {lowOptions.map((m) => <option key={m} value={m}>{midiName(m)}</option>)}
              </select>
            </label>
            <span className="hint">hasta {midiName(s.pianoLow + s.pianoKeys - 1)}</span>
          </div>
          <div className="chips">
            {Object.keys(KEYBOARD_PRESETS).map((k) => (
              <button key={k} className={+k === s.pianoKeys ? 'chip on' : 'chip'}
                onClick={() => set({ pianoKeys: +k, pianoLow: KEYBOARD_PRESETS[+k] })}>{k}</button>
            ))}
          </div>
        </Row>
      )}
      <Row label="Columnas de letra">
        <Seg value={s.lyricColumns} onChange={(lyricColumns) => set({ lyricColumns })} options={[[1, 'Una'], [2, 'Dos']]} />
      </Row>
      <Row label="Tamaño de la letra">
        <Slider value={s.lyricSize} min={10} max={48} step={1} onChange={(lyricSize) => set({ lyricSize })} format={(v) => v + 'px'} />
      </Row>
      <Row label="Tamaño de los acordes">
        <Slider value={s.chordSize} min={10} max={48} step={1} onChange={(chordSize) => set({ chordSize })} format={(v) => v + 'px'} />
      </Row>
      {s.instrument !== 'none' && (
        <Row label="Tamaño de los diagramas">
          <Slider value={s.diagramSize} min={0.5} max={2.5} step={0.1} onChange={(diagramSize) => set({ diagramSize })}
            format={(v) => Math.round(v * 100) + '%'} />
        </Row>
      )}
      {s.instrument !== 'none' && (
        <Row label="Fijar acordes arriba">
          <Seg value={s.pinChords ? 1 : 0} onChange={(v) => set({ pinChords: !!v })} options={[[1, 'Sí'], [0, 'No']]} />
        </Row>
      )}
      <Row label="Tema">
        <Seg value={s.theme} onChange={(theme) => set({ theme })} options={[['system', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]} />
      </Row>
    </div>
  );
}

export function KeyPanel({ rec, update, origKey, currentKey, keyWasGiven }: {
  rec: SongRecord; update: (p: Partial<SongRecord>) => void; origKey: Key | null; currentKey: Key | null; keyWasGiven: boolean;
}) {
  const keys = origKey?.minor ? MINOR_KEYS.map((k) => k + 'm') : MAJOR_KEYS;
  return (
    <div className="panel-body">
      <Row label="Tono">
        <div className="key-summary">
          Original: <b>{origKey ? keyToString(origKey) : '¿?'}</b>
          <span className="hint"> {keyWasGiven ? '(indicado en la canción)' : '(detectado)'}</span>
          {currentKey && (rec.transpose !== 0 || rec.mode === 'key') && <> · Ahora: <b>{keyToString(currentKey)}</b></>}
        </div>
      </Row>
      <Row label="Modo">
        <Seg value={rec.mode} onChange={(mode) => update({ mode })} options={[['transpose', 'Transponer'], ['key', 'Cambiar tono']]} />
        <p className="hint">
          {rec.mode === 'transpose'
            ? 'Mueve todos los acordes la misma cantidad de semitonos, escribiéndolos con sostenidos o bemoles según elijas.'
            : 'Reescribe cada acorde en la tonalidad elegida con la ortografía correcta (por ejemplo, de G a Eb: B7 → G7, G#dim7 → Edim7, en vez de D#…).'}
        </p>
      </Row>
      {rec.mode === 'transpose' ? (
        <>
          <Row label="Semitonos">
            <div className="stepper">
              <button onClick={() => update({ transpose: rec.transpose - 1 })} aria-label="Bajar"><Icon name="minus" /></button>
              <span className="stepper-value">{rec.transpose > 0 ? '+' : ''}{rec.transpose}</span>
              <button onClick={() => update({ transpose: rec.transpose + 1 })} aria-label="Subir"><Icon name="plus" /></button>
              <button className="link" onClick={() => update({ transpose: 0 })}>Original</button>
            </div>
          </Row>
          <Row label="Escribir con">
            <Seg value={rec.accidentals} onChange={(accidentals) => update({ accidentals })} options={[['sharp', '♯ Sostenidos'], ['flat', '♭ Bemoles']]} />
          </Row>
        </>
      ) : (
        <Row label="Nuevo tono">
          {origKey ? (
            <div className="chips">
              {keys.map((k) => (
                <button key={k} className={rec.targetKey === k ? 'chip on' : 'chip'} onClick={() => update({ targetKey: k })}>{k}</button>
              ))}
              <button className="chip" onClick={() => update({ targetKey: null })}>Original</button>
            </div>
          ) : (
            <p className="hint">No pude detectar el tono. Agregá una línea "Key: G" a la canción.</p>
          )}
        </Row>
      )}
    </div>
  );
}

export function TempoBar({ rec, update, playing, onToggle, metronome, setMetronome, countIn, setCountIn }: {
  rec: SongRecord; update: (p: Partial<SongRecord>) => void; playing: boolean; onToggle: () => void;
  metronome: boolean; setMetronome: (v: boolean) => void; countIn: number; setCountIn: (v: number) => void;
}) {
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 3000);
    t.push(now);
    taps.current = t;
    if (t.length >= 2) {
      const intervals = t.slice(1).map((x, i) => x - t[i]).slice(-4);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      update({ bpm: Math.round(60000 / avg) });
    }
  };
  const bpm = (v: number) => update({ bpm: Math.max(20, Math.min(300, v)) });

  return (
    <div className="tempo-bar">
      <button className={'play-btn' + (playing ? ' on' : '')} onClick={onToggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        <Icon name={playing ? 'pause' : 'play'} size={26} />
      </button>
      <div className="tempo-group">
        <span className="tempo-label">BPM</span>
        <button onClick={() => bpm(rec.bpm - 1)} aria-label="Más lento"><Icon name="minus" size={16} /></button>
        <input type="number" value={rec.bpm} min={20} max={300} onChange={(e) => bpm(+e.target.value || rec.bpm)} />
        <button onClick={() => bpm(rec.bpm + 1)} aria-label="Más rápido"><Icon name="plus" size={16} /></button>
        <button className="tap" onClick={tap}>Marcar</button>
      </div>
      <div className="tempo-group">
        <span className="tempo-label" title="Tiempos que dura cada acorde (o cada compás si usás barras |)">Tiempos/acorde</span>
        <input type="number" min={1} max={16} value={rec.beatsPerChord} onChange={(e) => update({ beatsPerChord: Math.max(1, +e.target.value || 4) })} />
      </div>
      <div className="tempo-group">
        <span className="tempo-label" title="Tiempos para una línea de letra sin acordes (0 = saltearla)">Línea sin acordes</span>
        <input type="number" min={0} max={32} value={rec.beatsPerLine} onChange={(e) => update({ beatsPerLine: Math.max(0, +e.target.value || 0) })} />
      </div>
      <div className="tempo-group">
        <button className={'chip' + (metronome ? ' on' : '')} onClick={() => setMetronome(!metronome)}>
          <Icon name="metronome" size={16} /> Metrónomo
        </button>
        <span className="tempo-label">Cuenta</span>
        <input type="number" min={0} max={8} value={countIn} onChange={(e) => setCountIn(Math.max(0, +e.target.value || 0))} />
      </div>
    </div>
  );
}
