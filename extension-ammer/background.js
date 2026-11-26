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

function sanitizarSegmentoRuta(valor, fallback = "SIN_DATO") {
  const limpio = String(valor || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim();
  return limpio || fallback;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || request.accion !== "PROCESAR_COPIA_DOCUMENTO") return;
  const data = request.payload || {};

  chrome.storage.sync.get(DEFAULT_EXT_CONFIG, (config) => {
    const tipoKey = String(data.tipoDoc || "").toLowerCase();
    if (config.docs && config.docs[tipoKey] === false) {
      return sendResponse({ ok: false, motivo: "OMITIDO_POR_FILTRO" });
    }

    let urlFinal = data.urlSupabase || data.urlDirecta || "";
    if (config.fuentePrioritaria === "drive" && data.urlDrive) {
      urlFinal = data.urlDrive;
    } else if (config.fuentePrioritaria === "render" && data.urlRender) {
      urlFinal = data.urlRender;
    }
    if (!urlFinal) {
      return sendResponse({ ok: false, error: "No se recibió URL de descarga válida." });
    }

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

    const rutaDestinoFinal = `${carpetaRelativa}/${nombreArchivo}`.replace(/\/+/g, "/").replace(/^\/+/, "");

    chrome.downloads.download(
      {
        url: urlFinal,
        filename: rutaDestinoFinal,
        conflictAction: "overwrite",
        saveAs: config.modoDescarga === "preguntar",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        }
        if (config.notifWindows) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
            title: "AMMER — Copia Local Archivada",
            message: `Guardado en: ${rutaDestinoFinal}`,
          });
        }
        sendResponse({ ok: true, downloadId, ruta: rutaDestinoFinal });
      }
    );
  });

  return true;
});
