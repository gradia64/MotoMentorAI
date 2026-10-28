// Controlli di sicurezza del main senza dipendenze da Electron (testabili con node:test).

// true se l'URL appartiene all'app: stessa origine del dev server, oppure un
// file dentro la cartella dist/ del pacchetto. Qualunque altra pagina finita
// nella finestra (link o file trascinato, redirect) non deve vedere il bridge.
export function isAppUrl(url, appBaseUrl) {
  let target;
  let base;
  try {
    target = new URL(url);
    base = new URL(appBaseUrl);
  } catch {
    return false;
  }
  if (base.protocol === 'file:') {
    return target.protocol === 'file:' && target.pathname.startsWith(base.pathname);
  }
  return target.origin === base.origin;
}

// Un viaggio condiviso è qualche centinaio di KB: oltre questa soglia il file
// non viene nemmeno letto (il main resterebbe bloccato su readFileSync/JSON.parse).
export const MAX_SHARED_TRIP_BYTES = 20 * 1024 * 1024;
