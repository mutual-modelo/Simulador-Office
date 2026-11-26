function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

document.addEventListener("DOMContentLoaded", () => {
  cargarHistorial();
  document.getElementById("btn_opciones").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("btn_carpeta_def").addEventListener("click", () => {
    chrome.runtime.sendMessage({ accion: "ABRIR_CARPETA_DESCARGA" });
  });
  document.getElementById("btn_limpiar").addEventListener("click", () => {
    chrome.runtime.sendMessage({ accion: "LIMPIAR_HISTORIAL" }, cargarHistorial);
  });
});
