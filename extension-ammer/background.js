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
  const now = new Date();
  const hoy = now.toISOString().split("T")[0];
  const meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
  const mesAnio = `${meses[now.getMonth()]} ${now.getFullYear()}`;
  const tokens = {
    "{CARPETA_RAIZ}": sanitizarSegmentoRuta(config.carpetaRaiz, "AMMER_Legajos"),
    "{MES_ANIO}": mesAnio,
    "{NOMBRE_COMPLETO}": sanitizarSegmentoRuta(data.nombreCompleto || data.apellido, "SOCIO"),
    "{DNI}": sanitizarSegmentoRuta(data.dni, "SIN_DNI"),
    "{ID_EXPEDIENTE}": sanitizarSegmentoRuta(data.idExpediente, "EXP-S_N"),
    "{ORGANIZACION}": sanitizarSegmentoRuta(data.organizacion, "GENERAL"),
    "{LINEA}": sanitizarSegmentoRuta(data.linea, "GENERAL"),
    "{APELLIDO}": sanitizarSegmentoRuta(data.apellido, "SOCIO"),
    "{FECHA}": hoy,
    "{TIPO_DOC}": sanitizarSegmentoRuta(data.tipoDoc, "DOC"),
    "{EXT}": sanitizarSegmentoRuta(data.extension, "PDF"),
  };
  let carpetaRelativa = config.patronCarpetas || "{CARPETA_RAIZ}/{MES_ANIO}/{NOMBRE_COMPLETO} {ID_EXPEDIENTE}";
  let nombreArchivo = config.patronNombreArchivo || "{ID_EXPEDIENTE} {TIPO_DOC}.{EXT}";
  for (const [clave, valor] of Object.entries(tokens)) {
    carpetaRelativa = carpetaRelativa.replaceAll(clave, valor);
    nombreArchivo = nombreArchivo.replaceAll(clave, valor);
  }
  if (config.forzarMayusculas) {
    carpetaRelativa = carpetaRelativa.toUpperCase();
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
    return;
  }
  if (request.accion === "GUARDAR_EXPEDIENTE_ACTIVO") {
    chrome.storage.local.set({ ammerExpedienteActivo: request.payload || {} }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (request.accion === "OBTENER_EXPEDIENTE_ACTIVO") {
    chrome.storage.local.get({ ammerExpedienteActivo: null }, (res) => {
      sendResponse({ ok: true, expediente: res.ammerExpedienteActivo });
    });
    return true;
  }
  if (request.accion === "SYNC_AUTH_CONTEXT") {
    chrome.storage.local.set({
      ammerAuthContext: {
        authToken: String(request.authToken || "").trim(),
        usuario: String(request.usuario || "").trim(),
        apiBase: String(request.apiBase || "https://ammer-auditor-api.onrender.com").replace(/\/+$/, ""),
        ts: Date.now(),
      },
    }, () => sendResponse({ ok: true }));
    return true;
  }
  if (request.accion === "OBTENER_MACROS_DOM") {
    chrome.storage.local.get({ ammerMacrosDom: [], ammerAuthContext: null }, async (res) => {
      let locales = Array.isArray(res.ammerMacrosDom) ? res.ammerMacrosDom : [];
      const auth = res.ammerAuthContext;
      if (auth && auth.authToken && auth.apiBase) {
        try {
          const rNet = await fetch(`${auth.apiBase}/api/extension/macros`, {
            method: "GET",
            headers: { Authorization: `Bearer ${auth.authToken}` },
          });
          if (rNet.ok) {
            const dNet = await rNet.json().catch(() => ({}));
            if (Array.isArray(dNet.macros)) {
              const map = new Map();
              dNet.macros.forEach((m) => { if (m && m.id) map.set(m.id, m); });
              locales.forEach((m) => { if (m && m.id && !map.has(m.id)) map.set(m.id, m); });
              locales = Array.from(map.values());
              chrome.storage.local.set({ ammerMacrosDom: locales.slice(0, 50) });
            }
          }
        } catch (_e) {}
      }
      sendResponse({ ok: true, macros: locales, online: Boolean(auth && auth.authToken) });
    });
    return true;
  }
  if (request.accion === "GUARDAR_MACRO_DOM") {
    chrome.storage.local.get({ ammerMacrosDom: [], ammerAuthContext: null }, async (res) => {
      const lista = Array.isArray(res.ammerMacrosDom) ? res.ammerMacrosDom : [];
      const macro = request.macro || {};
      const nueva = {
        id: macro.id || `mac_${Date.now()}`,
        nombre: String(macro.nombre || "Macro AMMER").trim(),
        urlInicial: String(macro.urlInicial || "").trim(),
        pasos: Array.isArray(macro.pasos) ? macro.pasos : [],
        compartida: Boolean(macro.compartida),
        creadaEn: new Date().toISOString(),
        online: false,
      };
      const auth = res.ammerAuthContext;
      if (auth && auth.authToken && auth.apiBase) {
        try {
          const rPost = await fetch(`${auth.apiBase}/api/extension/macros`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.authToken}`,
            },
            body: JSON.stringify({
              id: nueva.id,
              nombre: nueva.nombre,
              url_inicial: nueva.urlInicial,
              pasos: nueva.pasos,
              compartida: nueva.compartida,
            }),
          });
          const dPost = await rPost.json().catch(() => ({}));
          if (rPost.ok && dPost.ok) nueva.online = true;
        } catch (_e) {}
      }
      const filtrada = lista.filter((m) => m.id !== nueva.id);
      filtrada.unshift(nueva);
      chrome.storage.local.set({ ammerMacrosDom: filtrada.slice(0, 50) }, () => {
        sendResponse({ ok: true, macro: nueva, online: nueva.online });
      });
    });
    return true;
  }
  if (request.accion === "ELIMINAR_MACRO_DOM") {
    chrome.storage.local.get({ ammerMacrosDom: [], ammerAuthContext: null }, async (res) => {
      const filtrada = (res.ammerMacrosDom || []).filter((m) => m.id !== request.id);
      const auth = res.ammerAuthContext;
      if (auth && auth.authToken && auth.apiBase && request.id) {
        try {
          await fetch(`${auth.apiBase}/api/extension/macros/${encodeURIComponent(request.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${auth.authToken}` },
          });
        } catch (_e) {}
      }
      chrome.storage.local.set({ ammerMacrosDom: filtrada }, () => sendResponse({ ok: true }));
    });
    return true;
  }
  if (request.accion === "OBTENER_ESTADO_GRABACION") {
    chrome.storage.local.get({ ammerGrabandoMacro: false }, (res) => {
      sendResponse({ ok: true, grabando: Boolean(res.ammerGrabandoMacro) });
    });
    return true;
  }
  if (request.accion === "INICIAR_GRABACION_DOM" || request.accion === "DETENER_GRABACION_DOM") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) return sendResponse({ ok: false, error: "No hay pestaña activa." });
      const iniciar = request.accion === "INICIAR_GRABACION_DOM";
      chrome.storage.local.set({ ammerGrabandoMacro: iniciar });
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: (start) => {
            function selectorParaEl(el) {
              if (!el || el.nodeType !== 1) return "";
              if (el.id) return "#" + CSS.escape(el.id);
              const name = el.getAttribute("name");
              if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;
              const tid = el.getAttribute("data-testid");
              if (tid) return `[data-testid="${tid.replace(/"/g, '\\"')}"]`;
              return el.tagName.toLowerCase() + (el.className && typeof el.className === "string"
                ? "." + el.className.trim().split(/\s+/).slice(0, 2).map((c) => CSS.escape(c)).join(".")
                : "");
            }
            const oldBanner = document.getElementById("ammerMacroRecBanner");
            if (oldBanner) oldBanner.remove();
            if (start) {
              window.__ammerMacroPasos = [];
              if (window.__ammerMacroCleanup) window.__ammerMacroCleanup();
              const banner = document.createElement("div");
              banner.id = "ammerMacroRecBanner";
              banner.textContent = "🔴 Grabando Macro AMMER… (hacé tus clics/inputs y luego abrí la extensión para Detener)";
              banner.style.cssText = "position:fixed;bottom:14px;right:14px;z-index:2147483647;background:#dc2626;color:#fff;padding:8px 14px;border-radius:999px;font:700 12px/1.2 sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.28);pointer-events:none;";
              document.body.appendChild(banner);
              const onClick = (ev) => {
                if (ev.target && ev.target.id === "ammerMacroRecBanner") return;
                const sel = selectorParaEl(ev.target);
                if (sel) window.__ammerMacroPasos.push({ tipo: "click", selector: sel });
              };
              const onChange = (ev) => {
                const el = ev.target;
                if (!el || !("value" in el)) return;
                const sel = selectorParaEl(el);
                if (sel) window.__ammerMacroPasos.push({ tipo: "input", selector: sel, valor: String(el.value || "") });
              };
              document.addEventListener("click", onClick, true);
              document.addEventListener("change", onChange, true);
              window.__ammerMacroCleanup = () => {
                document.removeEventListener("click", onClick, true);
                document.removeEventListener("change", onChange, true);
              };
              return { grabando: true, pasos: [] };
            }
            if (window.__ammerMacroCleanup) window.__ammerMacroCleanup();
            const pasos = Array.isArray(window.__ammerMacroPasos) ? window.__ammerMacroPasos : [];
            return { grabando: false, pasos };
          },
          args: [iniciar],
        },
        (results) => {
          if (chrome.runtime.lastError) {
            chrome.storage.local.set({ ammerGrabandoMacro: false });
            return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          }
          const res = results && results[0] && results[0].result;
          sendResponse({ ok: true, ...(res || {}) });
        }
      );
    });
    return true;
  }
  if (request.type === "AMMER_OPEN_RENAPER_SPLIT" || request.type === "AMMER_OPEN_URL_SPLIT") {
    const targetUrl = request.type === "AMMER_OPEN_URL_SPLIT"
      ? (request.payload && request.payload.url)
      : "https://tramites.renaper.gob.ar/mi_ejemplar/";
    const openerTabId = _sender && _sender.tab && _sender.tab.id;
    if (!openerTabId || !targetUrl) {
      sendResponse({ ok: false, error: "Pestaña o URL inválida" });
      return;
    }
    if (String(targetUrl).includes("tramites.renaper.gob.ar")) {
      chrome.storage.local.set({ ammerPendingRenaper: { ...(request.payload || {}), openerTabId, ts: Date.now() } });
    } else if (request.type === "AMMER_OPEN_URL_SPLIT") {
      chrome.storage.local.set({ ammerPendingUrlSplit: { ...(request.payload || {}), url: targetUrl, openerTabId, ts: Date.now() } });
    }
    chrome.tabs.create({ url: targetUrl, splitWithTabId: openerTabId, index: (_sender.tab.index || 0) + 1, active: true })
      .then((tab) => sendResponse({ ok: true, tabId: tab.id, splitUsed: true }))
      .catch(() =>
        chrome.tabs.create({ url: targetUrl, index: (_sender.tab.index || 0) + 1, active: true })
          .then((tab) => sendResponse({ ok: true, tabId: tab.id, splitUsed: false }))
          .catch((e) => sendResponse({ ok: false, error: e.message }))
      );
    return true;
  }
  if (request.type === "AMMER_CLOSE_RENAPER_SPLIT") {
    const tId = (request.payload && request.payload.tabId) || (_sender && _sender.tab && _sender.tab.id);
    if (tId) chrome.tabs.remove(tId).catch(() => {});
    sendResponse({ ok: true });
    return;
  }
  if (request.accion === "EJECUTAR_MACRO_DOM") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) return sendResponse({ ok: false, error: "No hay pestaña activa." });
      chrome.storage.local.get({ ammerExpedienteActivo: {}, ammerMacrosDom: [] }, (st) => {
        const macro = (st.ammerMacrosDom || []).find((m) => m.id === request.id) || request.macro;
        if (!macro || !Array.isArray(macro.pasos) || !macro.pasos.length) {
          return sendResponse({ ok: false, error: "La macro no tiene pasos." });
        }
        const exp = st.ammerExpedienteActivo || {};
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: async (pasos, ctxExp) => {
              const tokens = {
                "{DNI}": String(ctxExp.dni || ""),
                "{CUIL}": String(ctxExp.cuil || ""),
                "{NOMBRE}": String(ctxExp.nombre || ""),
                "{CBU}": String(ctxExp.cbu || ""),
                "{MONTO}": String(ctxExp.monto || ""),
                "{ID_EXPEDIENTE}": String(ctxExp.idExpediente || ""),
              };
              const resolverTokens = (txt) => {
                let out = String(txt || "");
                for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(k, v);
                return out;
              };
              const esperarSelector = (sel, ms = 4000) =>
                new Promise((res) => {
                  const found = document.querySelector(sel);
                  if (found) return res(found);
                  const obs = new MutationObserver(() => {
                    const f = document.querySelector(sel);
                    if (f) { obs.disconnect(); res(f); }
                  });
                  obs.observe(document.body, { childList: true, subtree: true });
                  setTimeout(() => { obs.disconnect(); res(document.querySelector(sel)); }, ms);
                });
              let ejecutados = 0;
              for (const p of pasos) {
                const el = await esperarSelector(p.selector);
                if (!el) continue;
                if (p.tipo === "input") {
                  el.focus();
                  el.value = resolverTokens(p.valor);
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                } else {
                  el.click();
                }
                ejecutados += 1;
              }
              return { ejecutados, total: pasos.length };
            },
            args: [macro.pasos, exp],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            }
            const r = results && results[0] && results[0].result;
            sendResponse({ ok: true, ...(r || {}) });
          }
        );
      });
    });
    return true;
  }
  if (request.accion === "GENERAR_TRIGGER_POWER_AUTOMATE" || request.accion === "GENERAR_SCRIPT_AHK") {
    chrome.storage.sync.get(
      {
        carpetaPowerAutomate: "AMMER_Trigger",
        flujoPowerAutomate: "",
        plantillaAhk: "; Macro AMMER AutoHotkey\n; Expediente: {ID_EXPEDIENTE}\n^!a::\n{\n  SendText \"{DNI}{Tab}{NOMBRE}{Tab}{CBU}{Tab}{MONTO}\"\n}\n",
      },
      (cfg) => {
        chrome.storage.local.get({ ammerExpedienteActivo: {} }, (st) => {
          const exp = st.ammerExpedienteActivo || {};
          const idExp = sanitizarSegmentoRuta(exp.idExpediente, "SIN_EXP");
          if (request.accion === "GENERAR_TRIGGER_POWER_AUTOMATE") {
            const payload = {
              generadoEn: new Date().toISOString(),
              flujo: cfg.flujoPowerAutomate || "AMMER_Default",
              expediente: exp,
            };
            const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
            const carpetaPa = sanitizarSegmentoRuta(cfg.carpetaPowerAutomate, "AMMER_Trigger");
            chrome.downloads.download(
              { url: dataUrl, filename: `${carpetaPa}/trigger_${idExp}.json`, conflictAction: "overwrite" },
              (id) => sendResponse({ ok: Boolean(id), downloadId: id, flujo: cfg.flujoPowerAutomate || "" })
            );
          } else {
            let script = String(cfg.plantillaAhk || "");
            const tokens = {
              "{DNI}": String(exp.dni || ""),
              "{CUIL}": String(exp.cuil || ""),
              "{NOMBRE}": String(exp.nombre || ""),
              "{CBU}": String(exp.cbu || ""),
              "{MONTO}": String(exp.monto || ""),
              "{ID_EXPEDIENTE}": String(exp.idExpediente || ""),
            };
            for (const [k, v] of Object.entries(tokens)) script = script.replaceAll(k, v);
            const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(script)}`;
            chrome.downloads.download(
              { url: dataUrl, filename: `AMMER_Macros/macro_${idExp}.ahk`, conflictAction: "overwrite" },
              (id) => sendResponse({ ok: Boolean(id), downloadId: id })
            );
          }
        });
      }
    );
    return true;
  }
});
