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
  carpetaRaiz: "AMMER_LEGAJOS",
  patronCarpetas: "{CARPETA_RAIZ}/{MES_ANIO}/{ID_EXPEDIENTE} {NOMBRE_COMPLETO}",
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
    carpetaRaiz: document.getElementById("carpeta_raiz").value.trim() || "AMMER_LEGAJOS",
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
  const selPatron = document.getElementById("patron_carpetas");
  if (selPatron) {
    selPatron.value = cfg.patronCarpetas;
    if (!selPatron.value) selPatron.value = DEFAULT_CONFIG.patronCarpetas;
  }
  document.getElementById("patron_nombre_archivo").value = cfg.patronNombreArchivo;
  document.getElementById("carpeta_power_automate").value = cfg.carpetaPowerAutomate;
  document.getElementById("flujo_power_automate").value = cfg.flujoPowerAutomate;
  document.getElementById("plantilla_ahk").value = cfg.plantillaAhk;
  actualizarVistaPrevia();
}

  let carpetaPcHandleActual = null;

  async function refrescarEstadoCarpetaPc() {
    const estEl = document.getElementById("carpeta_pc_estado");
    const btnReset = document.getElementById("btn_reset_carpeta_pc");
    if (typeof AmmerFsStore === "undefined") return;
    carpetaPcHandleActual = await AmmerFsStore.obtenerCarpetaHandle();
    if (carpetaPcHandleActual) {
      const perm = await AmmerFsStore.verificarPermiso(carpetaPcHandleActual, false);
      if (estEl) {
        estEl.innerHTML = perm === "granted"
          ? `📂 Carpeta elegida: <strong>${carpetaPcHandleActual.name}</strong> <span style="color:#166534;">(✓ Permiso activo · independiente de Descargas)</span>`
          : `📂 Carpeta elegida: <strong>${carpetaPcHandleActual.name}</strong> <span style="color:#b45309;">(⏳ Tocá "Elegir carpeta" para reautorizar)</span>`;
      }
      if (btnReset) btnReset.style.display = "inline-block";
    } else {
      if (estEl) {
        estEl.textContent = "📥 Usando carpeta Descargas estándar de Chrome (Downloads/...)";
      }
      if (btnReset) btnReset.style.display = "none";
    }
    actualizarVistaPrevia();
  }

  function actualizarVistaPrevia() {
    const cfg = leerFormulario();
    const now = new Date();
    const hoy = now.toISOString().split("T")[0];
    const meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    const mesAnio = `${meses[now.getMonth()]} ${now.getFullYear()}`;
    const baseLimpia = String(cfg.carpetaRaiz || "AMMER_LEGAJOS")
      .replace(/\\/g, "/")
      .split("/")
      .map((p) => p.replace(/[:*?"<>|]/g, "_").trim())
      .filter((p) => p && p !== "." && p !== "..")
      .join("/") || "AMMER_LEGAJOS";
    const tokens = {
      "{CARPETA_RAIZ}": baseLimpia,
      "{MES_ANIO}": mesAnio,
      "{NOMBRE_COMPLETO}": "RAMIREZ JUAN CARLOS",
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
    if (cfg.forzarMayusculas) {
      carpeta = carpeta.toUpperCase();
      archivo = archivo.toUpperCase();
    }
    const rutaRel = `${carpeta}/${archivo}`.replace(/\/+/g, "/").replace(/^\/+/, "");
    const el = document.getElementById("ruta_preview");
    if (!el) return;
    if (carpetaPcHandleActual && typeof AmmerFsStore !== "undefined") {
      const sub = AmmerFsStore.resolverSubrutaParaCarpeta(rutaRel, carpetaPcHandleActual, baseLimpia);
      el.textContent = `Vista previa: [Carpeta PC: ${carpetaPcHandleActual.name}]/${sub}`;
    } else {
      el.textContent = `Vista previa: Downloads/${rutaRel}`;
    }
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
    chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
      aplicarFormulario(items);
      refrescarEstadoCarpetaPc();
    });
    ["carpeta_raiz", "patron_carpetas", "patron_nombre_archivo", "forzar_mayusculas"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", actualizarVistaPrevia);
        el.addEventListener("change", actualizarVistaPrevia);
      }
    });
    const btnElegir = document.getElementById("btn_elegir_carpeta_pc");
    if (btnElegir) {
      btnElegir.addEventListener("click", async () => {
        if (typeof window.showDirectoryPicker !== "function") {
          return mostrarEstado("❌ Tu navegador no soporta showDirectoryPicker.", true);
        }
        try {
          const handle = await window.showDirectoryPicker({ mode: "readwrite" });
          const perm = await AmmerFsStore.verificarPermiso(handle, true);
          if (perm !== "granted") {
            return mostrarEstado("⚠️ No otorgaste permiso de escritura sobre la carpeta.", true);
          }
          await AmmerFsStore.guardarCarpetaHandle(handle);
          chrome.storage.local.remove("ammerCarpetaPcPendientePermiso");
          await refrescarEstadoCarpetaPc();
          mostrarEstado(`✅ Carpeta "${handle.name}" configurada sin alterar tus descargas normales.`);
        } catch (err) {
          if (err && err.name === "AbortError") return;
          mostrarEstado("❌ Error eligiendo carpeta: " + (err && err.message ? err.message : err), true);
        }
      });
    }
    const btnReset = document.getElementById("btn_reset_carpeta_pc");
    if (btnReset) {
      btnReset.addEventListener("click", async () => {
        await AmmerFsStore.limpiarCarpetaHandle();
        chrome.storage.local.remove("ammerCarpetaPcPendientePermiso");
        await refrescarEstadoCarpetaPc();
        mostrarEstado("📥 Restablecido a Descargas/AMMER_LEGAJOS por defecto.");
      });
    }
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
