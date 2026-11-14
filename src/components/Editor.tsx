import { useState } from 'react';
import { parseSong } from '../song/parse';
import type { SongRecord } from '../state/types';
import { Icon } from './Icon';

const HELP = `Podés pegar la canción de dos formas (o mezclarlas):

1) Acordes arriba de la letra, alineados con espacios:
       G6
   All of me
                     B7
   Why not take all of me?

2) ChordPro, con los acordes entre corchetes:
   [G6]All of me, why not take [B7]all of me?

Extras:
   Key: G          → tono original (si no, se detecta solo)
   Tempo: 120      → tempo para el avance automático
   [Estribillo]    → título de sección
   | C6 Cm6 | G6 | → barras de compás: los acordes de un compás se reparten el tiempo
   {title: ...} {artist: ...} {key: ...} {tempo: ...} {c: comentario}`;

export function Editor({ rec, onSave, onCancel }: {
  rec: SongRecord; onSave: (p: Partial<SongRecord>) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(rec.title);
  const [artist, setArtist] = useState(rec.artist);
  const [text, setText] = useState(rec.text);
  const [help, setHelp] = useState(!rec.text);

  const save = () => {
    const p = parseSong(text);
    onSave({
      title: title.trim() || p.title || 'Sin título',
      artist: artist.trim() || p.artist || '',
      text,
      ...(p.tempo && !rec.text ? { bpm: p.tempo } : {}),
    });
  };

  return (
    <div className="screen editor">
      <header className="toolbar">
        <button className="icon-btn" onClick={onCancel} aria-label="Cancelar"><Icon name="back" /></button>
        <div className="toolbar-title"><div className="t1">{rec.text ? 'Editar canción' : 'Nueva canción'}</div></div>
        <button className="primary" onClick={save}>Guardar</button>
      </header>
      <main className="editor-main">
        <div className="editor-fields">
          <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <button className="link" onClick={() => setHelp(!help)}>{help ? 'Ocultar ayuda' : '¿Cómo escribo los acordes?'}</button>
        {help && <pre className="help">{HELP}</pre>}
        <textarea className="editor-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
          placeholder={'Pegá acá la letra con acordes…'} autoFocus={!rec.text} />
      </main>
    </div>
  );
}
