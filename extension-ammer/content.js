const ORIGENES_PERMITIDOS = [
  /^https:\/\/mutual-modelo\.github\.io$/i,
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function esOrigenPermitido(origin) {
  return ORIGENES_PERMITIDOS.some((rx) => rx.test(String(origin || "")));
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !esOrigenPermitido(event.origin)) return;
  const msg = event.data;
  if (!msg) return;

  if (msg.tipo === "AMMER_SINCRONIZAR_EXPEDIENTE") {
    chrome.runtime.sendMessage(
      {
        accion: "PROCESAR_COPIA_DOCUMENTO",
        payload: msg.payload || {},
      },
      (resp) => {
        window.postMessage(
          {
            tipo: "AMMER_SINCRONIZAR_RESPUESTA",
            requestId: msg.requestId || null,
            respuesta: resp || { ok: false, error: "Sin respuesta de la extensión" },
          },
          event.origin
        );
      }
    );
  } else if (msg.tipo === "AMMER_CONTEXTO_EXPEDIENTE") {
    chrome.runtime.sendMessage({
      accion: "GUARDAR_EXPEDIENTE_ACTIVO",
      payload: msg.payload || {},
    });
  }
});
