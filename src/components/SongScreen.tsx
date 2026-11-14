import { useCallback, useEffect, useMemo, useState } from 'react';
import { chordToString } from '../music/chord';
import { changeKey, detectKey, keyToString, parseKey, transposeBySemitones, transposeKey, type ChordTransform } from '../music/key';
import { keyboardRange } from '../music/piano';
import { allChords, parseSong } from '../song/parse';
import { buildTimeline } from '../song/timeline';
import { usePlayer } from '../hooks/usePlayer';
import type { Settings, SongRecord } from '../state/types';
import { ChordContext, ChordPopover, type ChordCtx, type PopoverState } from './ChordUI';
import { Icon } from './Icon';
import { KeyPanel, SettingsPanel, TempoBar } from './Panels';
import { DiagramGrid, SongView, type DisplayLine, type UniqueChord } from './SongView';

interface Props {
  rec: SongRecord;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  update: (p: Partial<SongRecord>) => void;
  onBack: () => void;
  onEdit: () => void;
}

type PanelName = 'settings' | 'key' | null;

export function SongScreen({ rec, settings, setSettings, update, onBack, onEdit }: Props) {
  const [panel, setPanel] = useState<PanelName>(null);
  const [tempoOpen, setTempoOpen] = useState(false);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const parsed = useMemo(() => parseSong(rec.text), [rec.text]);
  const chords = useMemo(() => allChords(parsed.lines), [parsed]);
  const givenKey = parsed.key ? parseKey(parsed.key) : null;
  const origKey = useMemo(() => givenKey ?? detectKey(chords), [parsed.key, chords]); // eslint-disable-line react-hooks/exhaustive-deps

  const transform: ChordTransform = useMemo(() => {
    if (rec.mode === 'key' && rec.targetKey && origKey) {
      const to = parseKey(rec.targetKey);
      if (to) return changeKey(origKey, to);
    }
    return transposeBySemitones(rec.mode === 'transpose' ? rec.transpose : 0, rec.accidentals);
  }, [rec.mode, rec.targetKey, rec.transpose, rec.accidentals, origKey]);

  const currentKey = useMemo(() => {
    if (!origKey) return null;
    if (rec.mode === 'key') return rec.targetKey ? parseKey(rec.targetKey) : origKey;
    return transposeKey(origKey, rec.transpose, rec.accidentals);
  }, [origKey, rec.mode, rec.targetKey, rec.transpose, rec.accidentals]);

  const lines: DisplayLine[] = useMemo(() => parsed.lines.map((l) => {
    if (l.kind !== 'lyrics') return l;
    return {
      kind: 'lyrics',
      segments: l.segments.map((s) => {
        if (!s.chord) return { name: null, chord: null, text: s.text };
        if (!s.chord.chord) return { name: s.chord.raw, chord: null, text: s.text };
        const c = transform(s.chord.chord);
        return { name: chordToString(c), chord: c, text: s.text };
      }),
    };
  }), [parsed, transform]);

  const uniqueAppearance: UniqueChord[] = useMemo(() => {
    const seen = new Map<string, UniqueChord>();
    for (const l of lines) if (l.kind === 'lyrics') for (const s of l.segments) {
      if (s.chord && s.name && !seen.has(s.name)) seen.set(s.name, { name: s.name, chord: s.chord });
    }
    return [...seen.values()];
  }, [lines]);
  const unique = useMemo(() => settings.sideOrder === 'alpha'
    ? [...uniqueAppearance].sort((a, b) => a.name.localeCompare(b.name, 'en'))
    : uniqueAppearance, [uniqueAppearance, settings.sideOrder]);

  // Avance automático
  const events = useMemo(() => buildTimeline(parsed.lines, rec.beatsPerChord, rec.beatsPerLine),
    [parsed, rec.beatsPerChord, rec.beatsPerLine]);
  const player = usePlayer({ events, bpm: rec.bpm, metronome: settings.metronome, countIn: settings.countIn });
  const showPosition = tempoOpen || player.playing;
  const ev = events[player.eventIndex];
  const activeLine = showPosition && ev ? ev.line : -1;
  const activeSeg = showPosition && ev ? ev.seg : -2;

  useEffect(() => {
    if (!player.playing || activeLine < 0) return;
    const el = document.querySelector(`[data-line="${activeLine}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLine, player.playing]);

  // Teclas rápidas: espacio = play/pausa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setTempoOpen(true);
        player.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const hidePopover = useCallback(() => setPopover(null), []);
  const ctx: ChordCtx = useMemo(() => ({
    settings,
    pianoRange: keyboardRange(settings.pianoKeys, settings.pianoLow),
    voicingIndex: (name) => rec.voicings[settings.instrument + ':' + name] ?? 0,
    cycleVoicing: (name, delta, total) => {
      const k = settings.instrument + ':' + name;
      update({ voicings: { ...rec.voicings, [k]: (((rec.voicings[k] ?? 0) + delta) % total + total) % total } });
    },
    showPopover: (name, chord, anchor) => setPopover({ name, chord, anchor }),
    hidePopover,
  }), [settings, rec.voicings, update, hidePopover]);

  const title = rec.title || parsed.title || 'Sin título';
  const artist = rec.artist || parsed.artist;

  return (
    <ChordContext.Provider value={ctx}>
      <div className="screen song-screen"
        style={{ '--lyric-size': settings.lyricSize + 'px', '--chord-size': settings.chordSize + 'px' } as React.CSSProperties}>
        <header className="toolbar">
          <button className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button>
          <div className="toolbar-title">
            <div className="t1">{title}</div>
            <div className="t2">{[artist, currentKey && 'Tono: ' + keyToString(currentKey)].filter(Boolean).join(' · ')}</div>
          </div>
          <button className={'icon-btn' + (panel === 'key' ? ' on' : '')} onClick={() => setPanel(panel === 'key' ? null : 'key')}
            aria-label="Transponer / cambiar tono" title="Transponer / cambiar tono">
            <Icon name="key" />
            {(rec.mode === 'transpose' ? rec.transpose !== 0 : !!rec.targetKey) && <span className="badge" />}
          </button>
          {settings.instrument !== 'none' && (
            <button className={'icon-btn' + (settings.pinChords ? ' on' : '')} onClick={() => setSettings({ pinChords: !settings.pinChords })}
              aria-label="Fijar acordes arriba" title="Fijar acordes arriba"><Icon name="pin" /></button>
          )}
          <button className={'icon-btn' + (tempoOpen ? ' on' : '')} onClick={() => { if (tempoOpen) player.pause(); setTempoOpen(!tempoOpen); }}
            aria-label="Avance automático" title="Avance automático"><Icon name="tempo" /></button>
          <button className="icon-btn" onClick={onEdit} aria-label="Editar" title="Editar"><Icon name="edit" /></button>
          <button className={'icon-btn' + (panel === 'settings' ? ' on' : '')} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            aria-label="Ajustes de vista" title="Ajustes de vista"><Icon name="settings" /></button>
        </header>

        {settings.pinChords && settings.instrument !== 'none' && uniqueAppearance.length > 0 && (
          <div className="pinned">
            <DiagramGrid unique={uniqueAppearance} scaleMul={0.7} compact />
          </div>
        )}

        <main className="song-main" onClick={() => setPanel(null)}>
          <SongView lines={lines} unique={unique} settings={settings} activeLine={activeLine} activeSeg={activeSeg}
            onLineClick={(i) => tempoOpen && player.seekToLine(i)} />
          <div className="song-end" />
        </main>

        {panel && (
          <div className="panel" role="dialog" aria-label={panel === 'key' ? 'Tono' : 'Ajustes'}>
            <div className="panel-head">
              <h2>{panel === 'key' ? 'Tono' : 'Vista'}</h2>
              <button className="icon-btn" onClick={() => setPanel(null)} aria-label="Cerrar"><Icon name="close" /></button>
            </div>
            {panel === 'key'
              ? <KeyPanel rec={rec} update={update} origKey={origKey} currentKey={currentKey} keyWasGiven={!!givenKey} />
              : <SettingsPanel s={settings} set={setSettings} />}
          </div>
        )}

        {tempoOpen && (
          <TempoBar rec={rec} update={update} playing={player.playing} onToggle={player.toggle}
            metronome={settings.metronome} setMetronome={(metronome) => setSettings({ metronome })}
            countIn={settings.countIn} setCountIn={(countIn) => setSettings({ countIn })} />
        )}
        {player.counting > 0 && <div className="count-in">{player.counting}</div>}

        <ChordPopover state={popover} onClose={hidePopover} />
      </div>
    </ChordContext.Provider>
  );
}
