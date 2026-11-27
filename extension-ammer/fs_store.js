(function (root) {
  "use strict";

  const DB_NAME = "AmmerExtFsDb";
  const STORE_NAME = "handles";
  const ROOT_KEY = "legajosRootDir";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error("IndexedDB no disponible"));
      const req = root.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Error abriendo IndexedDB"));
    });
  }

  async function guardarCarpetaHandle(handle) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(handle, ROOT_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error("No se pudo guardar la carpeta")); };
    });
  }

  async function obtenerCarpetaHandle() {
    try {
      const db = await openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(ROOT_KEY);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); resolve(null); };
      });
    } catch (_e) {
      return null;
    }
  }

  async function limpiarCarpetaHandle() {
    try {
      const db = await openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(ROOT_KEY);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    } catch (_e) {
      return false;
    }
  }

  async function verificarPermiso(handle, solicitarSiHaceFalta = false) {
    if (!handle) return "none";
    try {
      const opts = { mode: "readwrite" };
      let state = await handle.queryPermission(opts);
      if (state !== "granted" && solicitarSiHaceFalta && typeof handle.requestPermission === "function") {
        state = await handle.requestPermission(opts);
      }
      return state;
    } catch (_e) {
      return "error";
    }
  }

  function resolverSubrutaParaCarpeta(rutaRelativa, handle, carpetaRaizConfig) {
    const partes = String(rutaRelativa || "").split("/").filter(Boolean);
    if (!handle || !handle.name || partes.length <= 1) return partes.join("/");
    const nomHandle = String(handle.name).trim().toUpperCase();
    const raizPrimera = String(partes[0] || "").trim().toUpperCase();
    const raizCfg = String(carpetaRaizConfig || "").split("/")[0].trim().toUpperCase();
    if (nomHandle && (nomHandle === raizPrimera || (raizCfg && nomHandle === raizCfg && raizPrimera === raizCfg))) {
      return partes.slice(1).join("/");
    }
    return partes.join("/");
  }

  async function escribirArchivoEnCarpeta(rootHandle, rutaRelativa, dataBuffer) {
    const partes = String(rutaRelativa || "").split("/").filter(Boolean);
    if (!partes.length) throw new Error("Ruta de archivo inválida");
    const nombreArchivo = partes.pop();
    let dir = rootHandle;
    for (const seg of partes) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }
    const fileHandle = await dir.getFileHandle(nombreArchivo, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(dataBuffer);
    await writable.close();
    return true;
  }

  root.AmmerFsStore = {
    guardarCarpetaHandle,
    obtenerCarpetaHandle,
    limpiarCarpetaHandle,
    verificarPermiso,
    resolverSubrutaParaCarpeta,
    escribirArchivoEnCarpeta,
  };
})(typeof self !== "undefined" ? self : window);
