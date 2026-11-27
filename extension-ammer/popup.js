function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMacroStatus(msg, isError) {
  const el = document.getElementById("macro_status");
  if (!el) return;
  el.style.color = isError ? "#dc2626" : "#0369a1";
  el.textContent = msg || "";
}

function cargarHistorial() {
  chrome.runtime.sendMessage({ accion: "OBTENER_HISTORIAL" }, (resp) => {
    const cont = document.getElementById("lista_historial");
    if (!cont) return;
    const items = (resp && resp.items) || [];
    if (!items.length) {
      cont.innerHTML = '<div class="empty">Todavía no hay descargas registradas.</div>';
      return;
    }
    cont.innerHTML = items
      .map((it) => {
        const fecha = it.fechaIso ? new Date(it.fechaIso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
        const badge = it.ok
          ? `<span class="badge ok">✓ ${esc(it.fuente || "OK")}</span>`
          : `<span class="badge err">✕ Error</span>`;
        const btnAbrir = it.ok && it.downloadId
          ? `<button class="btn" data-show-id="${esc(it.downloadId)}">📁 Abrir carpeta</button>`
          : "";
        return `
          <div class="item">
            <div class="item-top">
              <strong>${esc(it.idExpediente)} · ${esc(String(it.tipoDoc || "").toUpperCase())}</strong>
              <span>${badge} <span style="color:#64748b;font-size:0.68rem;">${esc(fecha)}</span></span>
            </div>
            <div class="ruta">${esc(it.ruta || "-")}</div>
            ${it.error ? `<div style="color:#b91c1c;font-size:0.7rem;margin-bottom:4px;">${esc(it.error)}</div>` : ""}
            ${btnAbrir}
          </div>
        `;
      })
      .join("");

    cont.querySelectorAll("[data-show-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          accion: "ABRIR_CARPETA_DESCARGA",
          downloadId: btn.getAttribute("data-show-id"),
        });
      });
    });
  });
}

function cargarContextoYMacros() {
  chrome.runtime.sendMessage({ accion: "OBTENER_EXPEDIENTE_ACTIVO" }, (resp) => {
    const box = document.getElementById("exp_activo_box");
    const exp = resp && resp.expediente;
    if (!box) return;
    if (exp && (exp.idExpediente || exp.dni)) {
      box.innerHTML = `<strong>Expediente activo:</strong> ${esc(exp.idExpediente || "-")}<br><span>${esc(exp.nombre || "")} · DNI ${esc(exp.dni || "-")}</span>`;
    } else {
      box.textContent = "Sin expediente activo. Abrí una ficha en Simulador-Office.";
    }
  });

  chrome.runtime.sendMessage({ accion: "OBTENER_MACROS_DOM" }, (resp) => {
    const sel = document.getElementById("sel_macro_dom");
    if (!sel) return;
    const macros = (resp && resp.macros) || [];
    if (!macros.length) {
      sel.innerHTML = '<option value="">-- Sin macros guardadas --</option>';
      return;
    }
    sel.innerHTML = macros
      .map((m) => `<option value="${esc(m.id)}">${m.online ? '☁️' : '💻'} ${esc(m.nombre)} (${(m.pasos || []).length} pasos)</option>`)
      .join("");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cargarHistorial();
  cargarContextoYMacros();

  document.getElementById("tab_hist").addEventListener("click", () => {
    document.getElementById("tab_hist").classList.add("active");
    document.getElementById("tab_macros").classList.remove("active");
    document.getElementById("panel_hist").style.display = "block";
    document.getElementById("panel_macros").style.display = "none";
  });

  document.getElementById("tab_macros").addEventListener("click", () => {
    document.getElementById("tab_macros").classList.add("active");
    document.getElementById("tab_hist").classList.remove("active");
    document.getElementById("panel_macros").style.display = "block";
    document.getElementById("panel_hist").style.display = "none";
    cargarContextoYMacros();
  });

  chrome.runtime.sendMessage({ accion: "OBTENER_ESTADO_GRABACION" }, (st) => {
    const grabando = Boolean(st && st.grabando);
    document.getElementById("btn_grabar_dom").style.display = grabando ? "none" : "inline-block";
    document.getElementById("btn_detener_dom").style.display = grabando ? "inline-block" : "none";
    if (grabando) {
      document.getElementById("tab_macros").click();
      setMacroStatus("🔴 Grabación en curso en la pestaña actual. Tocá 'Detener y guardar' al terminar.");
    }
  });

  document.getElementById("btn_opciones").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("btn_carpeta_def").addEventListener("click", () => chrome.runtime.sendMessage({ accion: "ABRIR_CARPETA_DESCARGA" }));
  document.getElementById("btn_limpiar").addEventListener("click", () => chrome.runtime.sendMessage({ accion: "LIMPIAR_HISTORIAL" }, cargarHistorial));

  document.getElementById("btn_grabar_dom").addEventListener("click", () => {
    const nomPre = String((document.getElementById("inp_macro_nombre") || {}).value || "").trim();
    chrome.storage.local.set({ ammerPendingMacroName: nomPre }, () => {
      chrome.runtime.sendMessage({ accion: "INICIAR_GRABACION_DOM" }, (resp) => {
        if (!resp || !resp.ok) return setMacroStatus(resp && resp.error ? resp.error : "No se pudo grabar.", true);
        document.getElementById("btn_grabar_dom").style.display = "none";
        document.getElementById("btn_detener_dom").style.display = "inline-block";
        setMacroStatus(nomPre ? `🔴 Grabando "${nomPre}" en la pestaña actual...` : "🔴 Grabando clics e inputs en la pestaña actual...");
      });
    });
  });

  document.getElementById("btn_detener_dom").addEventListener("click", () => {
    chrome.runtime.sendMessage({ accion: "DETENER_GRABACION_DOM" }, (resp) => {
      document.getElementById("btn_grabar_dom").style.display = "inline-block";
      document.getElementById("btn_detener_dom").style.display = "none";
      const pasos = (resp && resp.pasos) || [];
      if (!pasos.length) return setMacroStatus("No se registraron pasos.", true);
      chrome.storage.local.get({ ammerPendingMacroName: "" }, (st) => {
        const nomGuardado = String(st.ammerPendingMacroName || "").trim();
        const nombre = nomGuardado || prompt("Nombre de la macro:", `Macro ${new Date().toLocaleTimeString("es-AR")}`);
        if (!nombre) return;
        chrome.storage.local.remove("ammerPendingMacroName");
        if (document.getElementById("inp_macro_nombre")) document.getElementById("inp_macro_nombre").value = "";
        chrome.runtime.sendMessage({ accion: "GUARDAR_MACRO_DOM", macro: { nombre, pasos } }, () => {
          cargarContextoYMacros();
          setMacroStatus(`✅ Macro "${nombre}" guardada (${pasos.length} pasos).`);
        });
      });
    });
  });

  document.getElementById("btn_ejecutar_dom").addEventListener("click", () => {
    const id = document.getElementById("sel_macro_dom").value;
    if (!id) return setMacroStatus("Seleccioná una macro primero.", true);
    chrome.runtime.sendMessage({ accion: "EJECUTAR_MACRO_DOM", id }, (resp) => {
      if (!resp || !resp.ok) return setMacroStatus(resp && resp.error ? resp.error : "Error ejecutando macro.", true);
      setMacroStatus(`▶️ Ejecutados ${resp.ejecutados}/${resp.total} pasos.`);
    });
  });

  document.getElementById("btn_exportar_dom").addEventListener("click", () => {
    const id = document.getElementById("sel_macro_dom").value;
    if (!id) return setMacroStatus("Seleccioná una macro para exportar.", true);
    chrome.runtime.sendMessage({ accion: "OBTENER_MACROS_DOM" }, (resp) => {
      const m = ((resp && resp.macros) || []).find((x) => x.id === id);
      if (!m) return setMacroStatus("No se encontró la macro seleccionada.", true);
      const payload = JSON.stringify({ formato: "AMMER_MACRO_V1", exportadoEn: new Date().toISOString(), macro: m }, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `macro_${String(m.nombre || "ammer").replace(/[^a-zA-Z0-9_-]+/g, "_")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMacroStatus(`⬇️ Macro "${m.nombre}" exportada (.json).`);
    });
  });

  document.getElementById("btn_importar_dom").addEventListener("click", () => {
    const inp = document.getElementById("inp_importar_dom");
    if (inp) inp.click();
  });

  document.getElementById("inp_importar_dom").addEventListener("change", (ev) => {
    const f = ev.target && ev.target.files && ev.target.files[0];
    if (ev.target) ev.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const m = parsed && parsed.macro ? parsed.macro : parsed;
        if (!m || !m.nombre || !Array.isArray(m.pasos)) {
          return setMacroStatus("Archivo JSON de macro inválido.", true);
        }
        chrome.runtime.sendMessage({
          accion: "GUARDAR_MACRO_DOM",
          macro: { nombre: m.nombre, pasos: m.pasos, urlInicial: m.urlInicial || "" },
        }, () => {
          cargarContextoYMacros();
          setMacroStatus(`⬆️ Macro "${m.nombre}" importada (${m.pasos.length} pasos).`);
        });
      } catch (_err) {
        setMacroStatus("Error leyendo el archivo JSON de macro.", true);
      }
    };
    reader.readAsText(f);
  });

  document.getElementById("btn_eliminar_dom").addEventListener("click", () => {
    const id = document.getElementById("sel_macro_dom").value;
    if (!id) return;
    chrome.runtime.sendMessage({ accion: "ELIMINAR_MACRO_DOM", id }, () => {
      cargarContextoYMacros();
      setMacroStatus("🗑️ Macro eliminada.");
    });
  });

  let builderPasos = [];
  const renderBuilderPasos = () => {
    const el = document.getElementById("builder_pasos_lista");
    if (!el) return;
    if (!builderPasos.length) {
      el.innerHTML = "Sin pasos agregados aún.";
      return;
    }
    el.innerHTML = builderPasos
      .map((p, idx) => `<div>${idx + 1}. <strong>${esc(p.tipo)}</strong>${p.selector ? ` · <code>${esc(p.selector)}</code>` : ""}${p.valor ? ` → "${esc(String(p.valor).slice(0, 32))}"` : ""}</div>`)
      .join("");
  };

  document.getElementById("btn_abrir_split_pre").addEventListener("click", () => {
    const url = (document.getElementById("sel_split_pre_url") || {}).value || "https://tramites.renaper.gob.ar/mi_ejemplar/";
    chrome.runtime.sendMessage({ accion: "ABRIR_URL_SPLIT_DESDE_POPUP", url }, (resp) => {
      if (!resp || !resp.ok) return setMacroStatus("No se pudo abrir en pestaña dividida.", true);
      setMacroStatus("🪟 Pestaña auxiliar abierta en Split View.");
    });
  });

  document.getElementById("btn_builder_add").addEventListener("click", () => {
    const tipo = (document.getElementById("sel_builder_tipo") || {}).value || "click";
    const selector = String((document.getElementById("inp_builder_selector") || {}).value || "").trim();
    const valor = String((document.getElementById("inp_builder_valor") || {}).value || "").trim();
    if (["input", "click"].includes(tipo) && !selector) {
      return setMacroStatus("Ingresá un selector CSS para este paso.", true);
    }
    if (["abrir_url", "abrir_split", "input"].includes(tipo) && !valor) {
      return setMacroStatus("Ingresá un valor o URL para este paso.", true);
    }
    builderPasos.push({ tipo, selector, valor });
    if (document.getElementById("inp_builder_selector")) document.getElementById("inp_builder_selector").value = "";
    if (document.getElementById("inp_builder_valor")) document.getElementById("inp_builder_valor").value = "";
    renderBuilderPasos();
    setMacroStatus(`➕ Paso ${builderPasos.length} agregado (${tipo}).`);
  });

  document.getElementById("btn_builder_clear").addEventListener("click", () => {
    builderPasos = [];
    renderBuilderPasos();
    setMacroStatus("🧹 Lista de pasos limpia.");
  });

  document.getElementById("btn_builder_guardar").addEventListener("click", () => {
    if (!builderPasos.length) return setMacroStatus("Agregá al menos 1 paso primero.", true);
    const nomInput = String((document.getElementById("inp_macro_nombre") || {}).value || "").trim();
    const nombre = nomInput || prompt("Nombre de la macro construida:", `Macro ${new Date().toLocaleTimeString("es-AR")}`);
    if (!nombre) return;
    chrome.runtime.sendMessage({ accion: "GUARDAR_MACRO_DOM", macro: { nombre, pasos: builderPasos } }, (resp) => {
      builderPasos = [];
      renderBuilderPasos();
      if (document.getElementById("inp_macro_nombre")) document.getElementById("inp_macro_nombre").value = "";
      cargarContextoYMacros();
      setMacroStatus(`✅ Macro "${nombre}" guardada (${resp && resp.online ? "☁️ Online" : "💻 Local"}).`);
    });
  });

  document.getElementById("btn_power_automate").addEventListener("click", () => {
    chrome.runtime.sendMessage({ accion: "GENERAR_TRIGGER_POWER_AUTOMATE" }, (resp) => {
      if (!resp || !resp.ok) return setMacroStatus("No se pudo exportar trigger JSON.", true);
      if (resp.flujo && /^ms-powerautomate:/i.test(resp.flujo)) {
        window.open(resp.flujo, "_blank");
      }
      setMacroStatus("🤖 Trigger JSON exportado para Power Automate.");
    });
  });

  document.getElementById("btn_ahk").addEventListener("click", () => {
    chrome.runtime.sendMessage({ accion: "GENERAR_SCRIPT_AHK" }, (resp) => {
      if (!resp || !resp.ok) return setMacroStatus("No se pudo generar el script .ahk.", true);
      setMacroStatus("⌨️ Script .ahk descargado en Downloads/AMMER_Macros.");
    });
  });
});
