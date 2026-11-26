const DEFAULT_EXT_CONFIG = {
  docs: {
    recibo: true,
    dni: true,
    mutuo: true,
    pagare: true,
    transferencia: true,
    scoring: false,
  },
  fuentePrioritaria: "supabase",
  modoDescarga: "automatico_silencioso",
  notifWindows: true,
  forzarMayusculas: true,
  carpetaRaiz: "AMMER_Legajos",
  patronCarpetas: "{CARPETA_RAIZ}/{DNI}",
  patronNombreArchivo: "{ID_EXPEDIENTE} {TIPO_DOC}.{EXT}",
};

const HISTORIAL_KEY = "ammerHistorialDescargas";
const DEDUPE_KEY = "ammerDedupeCache";
const MAX_HISTORIAL = 20;

const colaDescargas = [];
let procesandoCola = false;

function sanitizarSegmentoRuta(valor, fallback = "SIN_DATO") {
  const limpio = String(valor || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim();
  return limpio || fallback;
}

function normalizarUrlDrive(rawUrl) {
  const s = String(rawUrl || "").trim();
  if (!s || !/drive\.google\.com/i.test(s)) return s;
  const mPath = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (mPath) return `https://drive.google.com/uc?export=download&id=${mPath[1]}`;
  const mQuery = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (mQuery) return `https://drive.google.com/uc?export=download&id=${mQuery[1]}`;
  return s;
}

function construirListaFuentes(data, fuentePrioritaria) {
  const candidatas = {
    supabase: data.urlSupabase ? { fuente: "supabase", url: String(data.urlSupabase).trim() } : null,
    render: data.urlRender ? { fuente: "render", url: String(data.urlRender).trim() } : null,
    drive: data.urlDrive ? { fuente: "drive", url: normalizarUrlDrive(data.urlDrive) } : null,
    directa: data.urlDirecta ? { fuente: "directa", url: String(data.urlDirecta).trim() } : null,
  };
  const ordenPorPrioridad = {
    supabase: ["supabase", "render", "drive", "directa"],
    render: ["render", "supabase", "drive", "directa"],
    drive: ["drive", "supabase", "render", "directa"],
  };
  const orden = ordenPorPrioridad[fuentePrioritaria] || ordenPorPrioridad.supabase;
  const vistas = new Set();
  const lista = [];
  for (const k of orden) {
    const item = candidatas[k];
    if (item && item.url && !vistas.has(item.url)) {
      vistas.add(item.url);
      lista.push(item);
    }
  }
  return lista;
}

function construirRutaDestino(data, config) {
  const hoy = new Date().toISOString().split("T")[0];
  const tokens = {
    "{CARPETA_RAIZ}": sanitizarSegmentoRuta(config.carpetaRaiz, "AMMER_Legajos"),
    "{DNI}": sanitizarSegmentoRuta(data.dni, "SIN_DNI"),
    "{ID_EXPEDIENTE}": sanitizarSegmentoRuta(data.idExpediente, "EXP-S_N"),
    "{ORGANIZACION}": sanitizarSegmentoRuta(data.organizacion, "GENERAL"),
    "{LINEA}": sanitizarSegmentoRuta(data.linea, "GENERAL"),
    "{APELLIDO}": sanitizarSegmentoRuta(data.apellido, "SOCIO"),
    "{FECHA}": hoy,
    "{TIPO_DOC}": sanitizarSegmentoRuta(data.tipoDoc, "DOC"),
    "{EXT}": sanitizarSegmentoRuta(data.extension, "PDF"),
  };
  let carpetaRelativa = config.patronCarpetas || "{CARPETA_RAIZ}/{DNI}";
  let nombreArchivo = config.patronNombreArchivo || "{ID_EXPEDIENTE} {TIPO_DOC}.{EXT}";
  for (const [clave, valor] of Object.entries(tokens)) {
    carpetaRelativa = carpetaRelativa.replaceAll(clave, valor);
    nombreArchivo = nombreArchivo.replaceAll(clave, valor);
  }
  if (config.forzarMayusculas) {
    nombreArchivo = nombreArchivo.toUpperCase();
  }
  return `${carpetaRelativa}/${nombreArchivo}`.replace(/\/+/g, "/").replace(/^\/+/, "");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function descargarUrlConFallback(fuentes, rutaDestinoFinal, saveAs, authToken) {
  const errores = [];
  for (const item of fuentes) {
    try {
      let urlParaChrome = item.url;
      const requiereAuth = item.fuente === "render" && Boolean(authToken);
      if (requiereAuth) {
        const resp = await fetch(item.url, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const buf = await resp.arrayBuffer();
        const mime = resp.headers.get("content-type") || "application/pdf";
        urlParaChrome = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
      }
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: urlParaChrome,
            filename: rutaDestinoFinal,
            conflictAction: "overwrite",
            saveAs: Boolean(saveAs),
          },
          (id) => {
            if (chrome.runtime.lastError || !id) {
              reject(new Error((chrome.runtime.lastError && chrome.runtime.lastError.message) || "Error en chrome.downloads"));
            } else {
              resolve(id);
            }
          }
        );
      });
      return { ok: true, downloadId, fuente: item.fuente };
    } catch (err) {
      errores.push(`${item.fuente}: ${err.message}`);
    }
  }
  return { ok: false, error: errores.join(" | ") || "Todas las fuentes fallaron" };
}

function registrarEnHistorial(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [HISTORIAL_KEY]: [] }, (res) => {
      const lista = Array.isArray(res[HISTORIAL_KEY]) ? res[HISTORIAL_KEY] : [];
      lista.unshift(entry);
      chrome.storage.local.set({ [HISTORIAL_KEY]: lista.slice(0, MAX_HISTORIAL) }, resolve);
    });
  });
}

function verificarYMarcarDedupe(claveDedupe, forzarManual) {
  return new Promise((resolve) => {
    if (forzarManual) return resolve(false);
    chrome.storage.local.get({ [DEDUPE_KEY]: {} }, (res) => {
      const cache = res[DEDUPE_KEY] || {};
      const ahora = Date.now();
      if (cache[claveDedupe] && ahora - cache[claveDedupe] < 10 * 60 * 1000) {
        return resolve(true);
      }
      cache[claveDedupe] = ahora;
      const keys = Object.keys(cache);
      if (keys.length > 100) {
        delete cache[keys[0]];
      }
      chrome.storage.local.set({ [DEDUPE_KEY]: cache }, () => resolve(false));
    });
  });
}

async function procesarCola() {
  if (procesandoCola || !colaDescargas.length) return;
  procesandoCola = true;
  while (colaDescargas.length) {
    const tarea = colaDescargas.shift();
    try {
      await ejecutarTareaDescarga(tarea);
    } catch (err) {
      tarea.sendResponse({ ok: false, error: err.message });
    }
  }
  procesandoCola = false;
}

async function ejecutarTareaDescarga({ data, sendResponse }) {
  const config = await new Promise((resolve) => chrome.storage.sync.get(DEFAULT_EXT_CONFIG, resolve));
  const disparador = String(data.disparador || "auto").toLowerCase();
  if (config.modoDescarga === "manual" && disparador !== "manual") {
    return sendResponse({ ok: false, motivo: "OMITIDO_POR_MODO_MANUAL" });
  }
  if (
    config.modoDescarga === "al_liquidar" &&
    disparador !== "manual" &&
    String(data.estado || "").toUpperCase() !== "LIQUIDADO"
  ) {
    return sendResponse({ ok: false, motivo: "ESPERANDO_LIQUIDADO" });
  }

  const tipoKey = String(data.tipoDoc || "").toLowerCase();
  if (config.docs && config.docs[tipoKey] === false) {
    return sendResponse({ ok: false, motivo: "OMITIDO_POR_FILTRO" });
  }

  const fuentes = construirListaFuentes(data, config.fuentePrioritaria);
  if (!fuentes.length) {
    return sendResponse({ ok: false, error: "No se recibió URL de descarga válida." });
  }

  const rutaDestinoFinal = construirRutaDestino(data, config);
  const claveDedupe = `${data.idExpediente || ""}:${tipoKey}:${fuentes[0].url}`;
  const esDuplicado = await verificarYMarcarDedupe(claveDedupe, disparador === "manual");
  if (esDuplicado) {
    return sendResponse({ ok: false, motivo: "OMITIDO_POR_DUPLICADO" });
  }

  const res = await descargarUrlConFallback(
    fuentes,
    rutaDestinoFinal,
    config.modoDescarga === "preguntar",
    data.authToken || ""
  );

  await registrarEnHistorial({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    downloadId: res.downloadId || null,
    ruta: rutaDestinoFinal,
    fuente: res.fuente || fuentes[0].fuente,
    idExpediente: data.idExpediente || "-",
    tipoDoc: data.tipoDoc || "DOC",
    ok: res.ok,
    error: res.error || null,
    fechaIso: new Date().toISOString(),
  });

  if (res.ok && config.notifWindows) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      title: `AMMER — Guardado (${res.fuente})`,
      message: `Guardado en: ${rutaDestinoFinal}`,
    });
  }

  sendResponse(res.ok ? { ok: true, downloadId: res.downloadId, ruta: rutaDestinoFinal, fuente: res.fuente } : res);
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request) return;
  if (request.accion === "PROCESAR_COPIA_DOCUMENTO") {
    colaDescargas.push({ data: request.payload || {}, sendResponse });
    procesarCola();
    return true;
  }
  if (request.accion === "OBTENER_HISTORIAL") {
    chrome.storage.local.get({ [HISTORIAL_KEY]: [] }, (res) => {
      sendResponse({ ok: true, items: res[HISTORIAL_KEY] || [] });
    });
    return true;
  }
  if (request.accion === "LIMPIAR_HISTORIAL") {
    chrome.storage.local.set({ [HISTORIAL_KEY]: [], [DEDUPE_KEY]: {} }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (request.accion === "ABRIR_CARPETA_DESCARGA") {
    if (request.downloadId) {
      chrome.downloads.show(Number(request.downloadId));
    } else {
      chrome.downloads.showDefaultFolder();
    }
    sendResponse({ ok: true });
  }
});
