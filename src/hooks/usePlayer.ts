// Avance automático según el tempo (BPM), con metrónomo opcional y cuenta de entrada.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineEvent } from '../song/timeline';

interface Options {
  events: TimelineEvent[];
  bpm: number;
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

export function usePlayer({ events, bpm, metronome, countIn }: Options): PlayerState {
  const [playing, setPlaying] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const [counting, setCounting] = useState(0);

  // Posición en beats; se guarda en refs para que el loop no dependa de renders.
  const posRef = useRef(0); // beat de la canción donde se arrancó
  const t0Ref = useRef(0);
  const lastBeatRef = useRef(-Infinity);
  const rafRef = useRef(0);
  const opts = useRef({ events, bpm, metronome, countIn });
  opts.current = { events, bpm, metronome, countIn };
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  const stopLoop = () => cancelAnimationFrame(rafRef.current);

  const currentBeat = () => {
    const { bpm: b } = opts.current;
    return posRef.current + ((performance.now() - t0Ref.current) / 60000) * b;
  };

  const loop = useCallback(() => {
    const { events: ev, metronome: met } = opts.current;
    const beat = currentBeat();
    const whole = Math.floor(beat);
    if (whole !== lastBeatRef.current) {
      lastBeatRef.current = whole;
      const idxForClick = findEvent(ev, whole);
      if (met) click(beat < 0 || (idxForClick >= 0 && Math.abs(ev[idxForClick].start - whole) < 1e-6));
    }
    if (beat < 0) {
      setCounting(Math.ceil(-beat));
    } else {
      setCounting(0);
      const last = ev[ev.length - 1];
      if (!last || beat >= last.start + last.beats) {
        setPlaying(false);
        return;
      }
      setEventIndex(findEvent(ev, beat));
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startFrom = useCallback((beat: number, withCountIn: boolean) => {
    stopLoop();
    posRef.current = beat - (withCountIn ? opts.current.countIn : 0);
    t0Ref.current = performance.now();
    lastBeatRef.current = -Infinity;
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const play = useCallback(() => {
    const ev = opts.current.events;
    if (!ev.length) return;
    const idx = eventIndexRef.current >= ev.length ? 0 : eventIndexRef.current;
    setPlaying(true);
    startFrom(ev[idx]?.start ?? 0, true);
  }, [startFrom]);

  const pause = useCallback(() => {
    stopLoop();
    setPlaying(false);
    setCounting(0);
  }, []);

  const eventIndexRef = useRef(eventIndex);
  eventIndexRef.current = eventIndex;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const seekToLine = useCallback((line: number) => {
    const ev = opts.current.events;
    const idx = ev.findIndex((e) => e.line >= line);
    if (idx < 0) return;
    setEventIndex(idx);
    if (playingRef.current) startFrom(ev[idx].start, false);
  }, [startFrom]);

  // Si cambia el tempo mientras suena, seguir desde el beat actual con el tempo nuevo.
  const prevBpm = useRef(bpm);
  useEffect(() => {
    if (playingRef.current && prevBpm.current !== bpm) {
      const elapsed = ((performance.now() - t0Ref.current) / 60000) * prevBpm.current;
      posRef.current += elapsed;
      t0Ref.current = performance.now();
    }
    prevBpm.current = bpm;
  }, [bpm]);

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
  useEffect(() => {
    // Si cambia la canción/tiempos, reiniciar.
    stopLoop();
    setPlaying(false);
    setEventIndex(0);
  }, [events]);

  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [play, pause]);
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
