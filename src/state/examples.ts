import { SongRecord, newSong } from './types';

// Canciones de ejemplo (de dominio público) para probar los dos formatos de entrada.

const AMAZING_GRACE = `{title: Amazing Grace}
{artist: John Newton (tradicional)}
Key: G

[Verso 1]
  G     G7         C         G
Amazing grace! How sweet the sound
     G       Em7    A7   D7
That saved a wretch like me!
  G        G7        C      G
I once was lost, but now am found;
    Em7        D7    G
Was blind, but now I see.

[Verso 2]
'Twas [G]grace that [G7]taught my [C]heart to [G]fear,
And [G]grace my [Em7]fears re[A7]lie[D7]ved;
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em7]hour I [D7]first be[G]lieved.`;

const ARROZ = `{title: Arroz con leche}
{artist: Tradicional}
{key: C}

[C]Arroz con leche, me quiero ca[G7]sar
con una señorita de San Nico[C]lás,
que sepa co[C7]ser, que sepa bor[F]dar,
que sepa a[G7]brir la puerta para ir a ju[C]gar.`;

const JAZZ = `{title: Demo: progresión de jazz}
{artist: Atril}
Key: G

[Intro]
G6   E7   Am7   D7

[Parte A]
| G6   | B7   | E7     | Am7    |
| B9   | Dm6  | A9     | Am7 D7 |
| G6   | B7   | G#dim7 | Am7    |
| C6 Cm6 | G6 Gb6 F6 | E6 | Bm7 Bbm7 | Am7 D7 | G6 |`;

export function exampleSongs(): SongRecord[] {
  return [
    newSong({ id: 'ej-amazing-grace', title: 'Amazing Grace', artist: 'John Newton (tradicional)', text: AMAZING_GRACE, bpm: 80, beatsPerChord: 3, beatsPerLine: 6 }),
    newSong({ id: 'ej-arroz', title: 'Arroz con leche', artist: 'Tradicional', text: ARROZ, bpm: 110, beatsPerChord: 6, beatsPerLine: 6 }),
    newSong({ id: 'ej-jazz', title: 'Demo: progresión de jazz', artist: 'Atril', text: JAZZ, bpm: 120, beatsPerChord: 4 }),
  ];
}
