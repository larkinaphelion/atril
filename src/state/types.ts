export type Instrument = 'guitar' | 'ukulele' | 'piano' | 'none';
export type ChordView = 'names' | 'diagrams';
export type Placement = 'top' | 'inline' | 'side';
export type SideOrder = 'alpha' | 'appearance' | 'repeat';
export type Scope = 'partial' | 'full';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  instrument: Instrument;
  chordView: ChordView;
  placement: Placement;
  sideOrder: SideOrder;
  scope: Scope;
  lyricColumns: 1 | 2;
  lyricSize: number;
  chordSize: number;
  diagramSize: number;
  pinChords: boolean;
  pianoKeys: number;
  pianoLow: number;
  showFingers: boolean;
  metronome: boolean;
  countIn: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  instrument: 'guitar',
  chordView: 'names',
  placement: 'inline',
  sideOrder: 'appearance',
  scope: 'partial',
  lyricColumns: 1,
  lyricSize: 18,
  chordSize: 16,
  diagramSize: 1,
  pinChords: false,
  pianoKeys: 61,
  pianoLow: 36,
  showFingers: true,
  metronome: false,
  countIn: 4,
};

export interface SongRecord {
  id: string;
  title: string;
  artist: string;
  text: string;
  updatedAt: number;
  /** 'transpose' = mover semitonos; 'key' = cambiar a una tonalidad deletreada correctamente. */
  mode: 'transpose' | 'key';
  transpose: number;
  accidentals: 'sharp' | 'flat';
  targetKey: string | null;
  bpm: number;
  beatsPerChord: number;
  beatsPerLine: number;
  /** Posición elegida por acorde: "guitar:G6" → índice. */
  voicings: Record<string, number>;
}

export function newSong(partial: Partial<SongRecord> = {}): SongRecord {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    title: '',
    artist: '',
    text: '',
    updatedAt: Date.now(),
    mode: 'transpose',
    transpose: 0,
    accidentals: 'sharp',
    targetKey: null,
    bpm: 90,
    beatsPerChord: 4,
    beatsPerLine: 4,
    voicings: {},
    ...partial,
  };
}
