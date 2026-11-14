import { useCallback, useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Icon } from './components/Icon';
import { Library } from './components/Library';
import { SettingsPanel } from './components/Panels';
import { SongScreen } from './components/SongScreen';
import { load, save } from './lib/storage';
import { exampleSongs } from './state/examples';
import { DEFAULT_SETTINGS, Settings, SongRecord, newSong } from './state/types';

type Route = { view: 'library' } | { view: 'song'; id: string } | { view: 'edit'; id: string } | { view: 'new' };

// Navegación por hash: funciona igual en web, GitHub Pages y dentro de Capacitor (y el botón "atrás" de Android).
function parseHash(): Route {
  const [, view, id] = location.hash.replace(/^#/, '').split('/');
  if (view === 'song' && id) return { view: 'song', id };
  if (view === 'edit' && id) return { view: 'edit', id };
  if (view === 'new') return { view: 'new' };
  return { view: 'library' };
}
const go = (hash: string) => { location.hash = hash; };

export default function App() {
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('atril.settings', {}) }));
  const [songs, setSongs] = useState<SongRecord[]>(() => load('atril.songs', null) ?? exampleSongs());
  const [route, setRoute] = useState<Route>(parseHash);
  const [libSettings, setLibSettings] = useState(false);
  const [draft] = useState(() => newSong());

  useEffect(() => save('atril.settings', settings), [settings]);
  useEffect(() => save('atril.songs', songs), [songs]);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Tema claro / oscuro
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16161a' : '#fbfaf7');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  const setSettings = useCallback((p: Partial<Settings>) => setSettingsState((s) => ({ ...s, ...p })), []);
  const updateSong = useCallback((id: string, p: Partial<SongRecord>) =>
    setSongs((list) => list.map((s) => (s.id === id ? { ...s, ...p, updatedAt: Date.now() } : s))), []);

  if (route.view === 'song') {
    const rec = songs.find((s) => s.id === route.id);
    if (rec) {
      return <SongScreen key={rec.id} rec={rec} settings={settings} setSettings={setSettings}
        update={(p) => updateSong(rec.id, p)} onBack={() => go('/')} onEdit={() => go('/edit/' + rec.id)} />;
    }
  }

  if (route.view === 'edit' || route.view === 'new') {
    const rec = route.view === 'edit' ? songs.find((s) => s.id === route.id) : draft;
    if (rec) {
      return <Editor key={rec.id} rec={rec} onCancel={() => history.back()}
        onSave={(p) => {
          let id = rec.id;
          if (route.view === 'new') {
            id = newSong().id;
            setSongs((l) => [...l, { ...rec, ...p, id, updatedAt: Date.now() }]);
          } else updateSong(rec.id, p);
          location.replace('#/song/' + id);
        }} />;
    }
  }

  return (
    <>
      <Library songs={songs} onOpen={(id) => go('/song/' + id)} onNew={() => go('/new')}
        onDelete={(id) => setSongs((l) => l.filter((s) => s.id !== id))}
        onImport={(items) => setSongs((l) => [...l, ...items.map((x) => newSong({ ...x, id: newSong().id }))])}
        onSettings={() => setLibSettings(true)} />
      {libSettings && (
        <div className="panel" role="dialog" aria-label="Ajustes">
          <div className="panel-head">
            <h2>Vista</h2>
            <button className="icon-btn" onClick={() => setLibSettings(false)} aria-label="Cerrar"><Icon name="close" /></button>
          </div>
          <SettingsPanel s={settings} set={setSettings} />
        </div>
      )}
    </>
  );
}
