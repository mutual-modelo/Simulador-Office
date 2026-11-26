const DEFAULT_CONFIG = {
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
  carpetaPowerAutomate: "AMMER_Trigger",
  flujoPowerAutomate: "",
  plantillaAhk: "; Macro AMMER AutoHotkey\n; Expediente: {ID_EXPEDIENTE}\n^!a::\n{\n  SendText \"{DNI}{Tab}{NOMBRE}{Tab}{CBU}{Tab}{MONTO}\"\n}\n",
};

function leerFormulario() {
  return {
    docs: {
      recibo: document.getElementById("doc_recibo").checked,
      dni: document.getElementById("doc_dni").checked,
      mutuo: document.getElementById("doc_mutuo").checked,
      pagare: document.getElementById("doc_pagare").checked,
      transferencia: document.getElementById("doc_transferencia").checked,
      scoring: document.getElementById("doc_scoring").checked,
    },
    fuentePrioritaria: document.getElementById("fuente_prioritaria").value,
    modoDescarga: document.getElementById("modo_descarga").value,
    notifWindows: document.getElementById("notif_windows").checked,
    forzarMayusculas: document.getElementById("forzar_mayusculas").checked,
    carpetaRaiz: document.getElementById("carpeta_raiz").value.trim() || "AMMER_Legajos",
    patronCarpetas: document.getElementById("patron_carpetas").value,
    patronNombreArchivo:
      document.getElementById("patron_nombre_archivo").value.trim() ||
      "{ID_EXPEDIENTE} {TIPO_DOC}.{EXT}",
    carpetaPowerAutomate: document.getElementById("carpeta_power_automate").value.trim() || "AMMER_Trigger",
    flujoPowerAutomate: document.getElementById("flujo_power_automate").value.trim(),
    plantillaAhk: document.getElementById("plantilla_ahk").value,
  };
}

function aplicarFormulario(items) {
  const cfg = { ...DEFAULT_CONFIG, ...(items || {}), docs: { ...DEFAULT_CONFIG.docs, ...((items && items.docs) || {}) } };
  document.getElementById("doc_recibo").checked = cfg.docs.recibo;
  document.getElementById("doc_dni").checked = cfg.docs.dni;
  document.getElementById("doc_mutuo").checked = cfg.docs.mutuo;
  document.getElementById("doc_pagare").checked = cfg.docs.pagare;
  document.getElementById("doc_transferencia").checked = cfg.docs.transferencia;
  document.getElementById("doc_scoring").checked = cfg.docs.scoring;
  document.getElementById("fuente_prioritaria").value = cfg.fuentePrioritaria;
  document.getElementById("modo_descarga").value = cfg.modoDescarga;
  document.getElementById("notif_windows").checked = cfg.notifWindows;
  document.getElementById("forzar_mayusculas").checked = cfg.forzarMayusculas;
  document.getElementById("carpeta_raiz").value = cfg.carpetaRaiz;
  document.getElementById("patron_carpetas").value = cfg.patronCarpetas;
  document.getElementById("patron_nombre_archivo").value = cfg.patronNombreArchivo;
  document.getElementById("carpeta_power_automate").value = cfg.carpetaPowerAutomate;
  document.getElementById("flujo_power_automate").value = cfg.flujoPowerAutomate;
  document.getElementById("plantilla_ahk").value = cfg.plantillaAhk;
  actualizarVistaPrevia();
}

function actualizarVistaPrevia() {
  const cfg = leerFormulario();
  const hoy = new Date().toISOString().split("T")[0];
  const tokens = {
    "{CARPETA_RAIZ}": cfg.carpetaRaiz,
    "{DNI}": "32456789",
    "{ID_EXPEDIENTE}": "SOL-575776",
    "{ORGANIZACION}": "FEDEM",
    "{LINEA}": "PROVINCIAL",
    "{APELLIDO}": "RAMIREZ",
    "{FECHA}": hoy,
    "{TIPO_DOC}": "RECIBO",
    "{EXT}": "PDF",
  };
  let carpeta = cfg.patronCarpetas;
  let archivo = cfg.patronNombreArchivo;
  for (const [k, v] of Object.entries(tokens)) {
    carpeta = carpeta.replaceAll(k, v);
    archivo = archivo.replaceAll(k, v);
  }
  if (cfg.forzarMayusculas) archivo = archivo.toUpperCase();
  const el = document.getElementById("ruta_preview");
  if (el) el.textContent = `Vista previa: Downloads/${carpeta}/${archivo}`.replace(/\/+/g, "/");
}

function mostrarEstado(msg, esError = false) {
  const status = document.getElementById("status");
  if (!status) return;
  status.className = esError ? "status-error" : "status-success";
  status.textContent = msg;
  status.style.display = "block";
  setTimeout(() => { status.style.display = "none"; }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(DEFAULT_CONFIG, aplicarFormulario);
  ["carpeta_raiz", "patron_carpetas", "patron_nombre_archivo", "forzar_mayusculas"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", actualizarVistaPrevia);
      el.addEventListener("change", actualizarVistaPrevia);
    }
  });
});

document.getElementById("btn_guardar").addEventListener("click", () => {
  chrome.storage.sync.set(leerFormulario(), () => {
    mostrarEstado("✅ Configuración guardada correctamente.");
  });
});

document.getElementById("btn_exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(leerFormulario(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ammer_extension_perfil.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn_importar").addEventListener("click", () => {
  document.getElementById("inp_importar_json").click();
});

document.getElementById("inp_importar_json").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    aplicarFormulario(parsed);
    chrome.storage.sync.set(leerFormulario(), () => {
      mostrarEstado("✅ Perfil importado y guardado.");
    });
  } catch (err) {
    mostrarEstado("❌ Archivo JSON inválido: " + err.message, true);
  } finally {
    e.target.value = "";
  }
});
