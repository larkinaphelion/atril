import { useRef, useState } from 'react';
import type { SongRecord } from '../state/types';
import { Icon } from './Icon';

interface Props {
  songs: SongRecord[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onImport: (songs: SongRecord[]) => void;
  onSettings: () => void;
}

export function Library({ songs, onOpen, onNew, onDelete, onImport, onSettings }: Props) {
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = songs
    .filter((s) => (s.title + ' ' + s.artist).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'atril-canciones.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      if (f.name.endsWith('.json')) {
        const data = JSON.parse(text);
        if (Array.isArray(data)) onImport(data.filter((x) => x && typeof x.text === 'string'));
      } else {
        onImport([{ text, title: f.name.replace(/\.[^.]+$/, '') } as SongRecord]);
      }
    } catch {
      alert('No pude leer ese archivo.');
    }
  };

  return (
    <div className="screen library">
      <header className="toolbar">
        <div className="brand"><img src="./icon.svg" alt="" width={28} height={28} /> Atril</div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Importar (.json, .txt, .cho)" aria-label="Importar"><Icon name="upload" /></button>
        <button className="icon-btn" onClick={exportAll} title="Exportar todas" aria-label="Exportar"><Icon name="download" /></button>
        <button className="icon-btn" onClick={onSettings} title="Ajustes" aria-label="Ajustes"><Icon name="settings" /></button>
        <input ref={fileRef} type="file" accept=".json,.txt,.cho,.chopro,.chordpro,text/plain" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
      </header>
      <main className="library-main">
        <div className="library-actions">
          <input className="search" placeholder="Buscar canción o artista…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary" onClick={onNew}><Icon name="plus" size={18} /> Nueva canción</button>
        </div>
        {filtered.length === 0 && <p className="empty">No hay canciones{q ? ' que coincidan' : ''}. Tocá “Nueva canción” y pegá letra con acordes.</p>}
        <ul className="song-list">
          {filtered.map((s) => (
            <li key={s.id}>
              <button className="song-item" onClick={() => onOpen(s.id)}>
                <span className="song-item-title">{s.title || 'Sin título'}</span>
                <span className="song-item-artist">{s.artist}</span>
              </button>
              <button className="icon-btn danger" aria-label={'Borrar ' + s.title}
                onClick={() => { if (confirm(`¿Borrar “${s.title || 'Sin título'}”?`)) onDelete(s.id); }}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
