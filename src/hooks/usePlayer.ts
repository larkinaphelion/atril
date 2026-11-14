// Avance automático. Dos modos:
//  - 'chords': sigue los acordes según el tempo (BPM) y resalta la línea/acorde actual.
//  - 'smooth': scrollea hacia abajo de forma continua a una velocidad elegida.
// En ambos, cambiar BPM, velocidad o tiempos por acorde mientras suena se aplica al instante.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TimelineEvent } from '../song/timeline';

export type ScrollMode = 'chords' | 'smooth';

interface Options {
  mode: ScrollMode;
  events: TimelineEvent[];
  bpm: number;
  /** Velocidad del scroll continuo, en píxeles por segundo. */
  speed: number;
  metronome: boolean;
  countIn: number;
}

export interface PlayerState {
  playing: boolean;
  eventIndex: number;
  /** Beats de cuenta de entrada restantes (0 si ya arrancó). */
  counting: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekToLine: (line: number) => void;
}

let audioCtx: AudioContext | null = null;
function click(accent: boolean) {
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch {
    /* sin audio */
  }
}

export function usePlayer(options: Options): PlayerState {
  const { events, bpm } = options;
  const [playing, setPlaying] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const [counting, setCounting] = useState(0);

  // La posición se lleva en beats: beat = posRef + (ahora - t0) * bpm. Al cambiar el BPM
  // se "re-ancla" (posRef = beat actual, t0 = ahora) para que siga desde donde está.
  const posRef = useRef(0);
  const t0Ref = useRef(0);
  const lastBeatRef = useRef(-Infinity);
  const lastFrameRef = useRef(0);
  const scrollCarry = useRef(0);
  const rafRef = useRef(0);
  const playingRef = useRef(false);
  const eventIndexRef = useRef(0);
  eventIndexRef.current = eventIndex;
  const opts = useRef(options);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  const beatNow = (b = opts.current.bpm) => posRef.current + ((performance.now() - t0Ref.current) / 60000) * b;
  const reanchor = (beat: number) => {
    posRef.current = beat;
    t0Ref.current = performance.now();
  };

  // Cambio de BPM en vivo: re-anclar con el tempo viejo antes de usar el nuevo.
  if (playingRef.current && bpm !== opts.current.bpm) reanchor(beatNow(opts.current.bpm));

  // Cambio de tiempos por acorde en vivo: mantener el mismo acorde y la misma fracción dentro de él.
  const prevEvents = opts.current.events;
  if (playingRef.current && events !== prevEvents && opts.current.mode === 'chords') {
    const beat = beatNow(opts.current.bpm);
    const oi = findEvent(prevEvents, beat);
    if (oi >= 0) {
      const old = prevEvents[oi];
      const frac = Math.min(1, Math.max(0, (beat - old.start) / old.beats));
      const ni = events.findIndex((e) => e.line === old.line && e.seg === old.seg);
      if (ni >= 0) reanchor(events[ni].start + frac * events[ni].beats);
    }
  }
  opts.current = options;

  const stopLoop = () => cancelAnimationFrame(rafRef.current);

  const loop = useCallback(() => {
    const { events: ev, metronome: met, mode, speed } = opts.current;
    const now = performance.now();
    const dt = Math.min(100, now - lastFrameRef.current);
    lastFrameRef.current = now;
    const beat = beatNow();
    const whole = Math.floor(beat);
    if (whole !== lastBeatRef.current) {
      lastBeatRef.current = whole;
      if (met) {
        const idx = mode === 'chords' ? findEvent(ev, whole) : -1;
        click(beat < 0 || (idx >= 0 && Math.abs(ev[idx].start - whole) < 1e-6) || (mode === 'smooth' && whole % 4 === 0));
      }
    }
    if (beat < 0) {
      setCounting(Math.ceil(-beat));
    } else {
      setCounting(0);
      if (mode === 'smooth') {
        scrollCarry.current += (speed * dt) / 1000;
        const px = Math.trunc(scrollCarry.current);
        if (px) {
          scrollCarry.current -= px;
          window.scrollBy(0, px);
        }
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        if (atBottom) return stop();
      } else {
        const last = ev[ev.length - 1];
        if (!last || beat >= last.start + last.beats) return stop();
        setEventIndex(findEvent(ev, beat));
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    stopLoop();
    playingRef.current = false;
    setPlaying(false);
    setCounting(0);
  };

  const startFrom = useCallback((beat: number, withCountIn: boolean) => {
    stopLoop();
    reanchor(beat - (withCountIn ? opts.current.countIn : 0));
    lastBeatRef.current = -Infinity;
    lastFrameRef.current = performance.now();
    scrollCarry.current = 0;
    playingRef.current = true;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const play = useCallback(() => {
    const { events: ev, mode } = opts.current;
    if (mode === 'smooth') {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) window.scrollTo(0, 0);
      return startFrom(0, true);
    }
    if (!ev.length) return;
    const idx = eventIndexRef.current >= ev.length ? 0 : eventIndexRef.current;
    startFrom(ev[idx]?.start ?? 0, true);
  }, [startFrom]);

  const pause = useCallback(() => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause]);

  const seekToLine = useCallback((line: number) => {
    const { events: ev, mode } = opts.current;
    if (mode === 'smooth') return;
    const idx = ev.findIndex((e) => e.line >= line);
    if (idx < 0) return;
    setEventIndex(idx);
    if (playingRef.current) startFrom(ev[idx].start, false);
  }, [startFrom]);

  // Al cambiar de modo, detener.
  useLayoutEffect(() => {
    stop();
  }, [options.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si cambia la canción (no solo los tiempos) y no está sonando, volver al principio.
  useEffect(() => {
    if (!playingRef.current && eventIndexRef.current >= events.length) setEventIndex(0);
  }, [events]);

  // Mantener la pantalla encendida mientras suena.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (playing && nav.wakeLock) {
      nav.wakeLock.request('screen').then((w) => (wakeRef.current = w)).catch(() => {});
    }
    return () => {
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, [playing]);

  useEffect(() => () => stopLoop(), []);

  return { playing, eventIndex, counting, play, pause, toggle, seekToLine };
}

function findEvent(ev: TimelineEvent[], beat: number): number {
  let lo = 0;
  let hi = ev.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ev[mid].start <= beat + 1e-9) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
