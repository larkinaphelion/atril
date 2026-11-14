// Persistencia simple. En web usa localStorage (también funciona dentro de Capacitor).
// Si en el futuro querés usar @capacitor/preferences o una base de datos, cambiá solo este archivo.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado: se ignora */
  }
}
