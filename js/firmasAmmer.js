(function (global) {
  'use strict';

  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const QR_LIB_CDN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  const LS_SELLO_KEY = 'AMMER_SELLO_OFICIAL_PNG';
  const LS_ENLACES_KEY = 'AMMER_ENLACES_FIRMA_CACHE';

  const ORIGENES_CAMPO = [
    { group: 'Solicitante', value: 'solicitante.nombre', label: 'Solicitante: Apellido y Nombre' },
    { group: 'Solicitante', value: 'solicitante.dni', label: 'Solicitante: DNI' },
    { group: 'Solicitante', value: 'solicitante.cuil', label: 'Solicitante: CUIL / CUIT' },
    { group: 'Solicitante', value: 'solicitante.domicilio', label: 'Solicitante: Domicilio' },
    { group: 'Solicitante', value: 'solicitante.localidad', label: 'Solicitante: Localidad' },
    { group: 'Solicitante', value: 'solicitante.telefono', label: 'Solicitante: Teléfono / WhatsApp' },
    { group: 'Solicitante', value: 'solicitante.email', label: 'Solicitante: Email' },
    { group: 'Solicitante', value: 'solicitante.cbu', label: 'Solicitante: CBU / CVU (22 dígitos)' },
    { group: 'Solicitante', value: 'solicitante.alias', label: 'Solicitante: Alias CBU' },
    { group: 'Solicitante', value: 'solicitante.banco', label: 'Solicitante: Banco / Entidad' },
    { group: 'Solicitante', value: 'solicitante.organismo', label: 'Solicitante: Organismo / Repartición' },
    { group: 'Solicitante', value: 'solicitante.legajo', label: 'Solicitante: N° Legajo' },
    { group: 'Solicitante', value: 'solicitante.estadoCivil', label: 'Solicitante: Estado Civil' },
    { group: 'Solicitante', value: 'solicitante.fechaNacimiento', label: 'Solicitante: Fecha Nacimiento' },
    { group: 'Préstamo', value: 'prestamo.lineaNombre', label: 'Préstamo: Línea de Ayuda' },
    { group: 'Préstamo', value: 'prestamo.monto', label: 'Préstamo: Monto Neto ($)' },
    { group: 'Préstamo', value: 'prestamo.cuotas', label: 'Préstamo: Cantidad de Cuotas' },
    { group: 'Préstamo', value: 'prestamo.valorCuota', label: 'Préstamo: Valor de Cuota ($)' },
    { group: 'Préstamo', value: 'prestamo.totalDevolver', label: 'Préstamo: Total a Reintegrar ($)' },
    { group: 'Expediente y Fecha', value: 'expediente.id', label: 'Expediente: N° Definitivo / Provisorio' },
    { group: 'Expediente y Fecha', value: 'fecha.hoy', label: 'Fecha Hoy (DD/MM/AAAA)' },
    { group: 'Expediente y Fecha', value: 'fecha.dia', label: 'Fecha Hoy: Día (DD)' },
    { group: 'Expediente y Fecha', value: 'fecha.mes', label: 'Fecha Hoy: Mes numérico (MM)' },
    { group: 'Expediente y Fecha', value: 'fecha.mesNombre', label: 'Fecha Hoy: Mes en letras' },
    { group: 'Expediente y Fecha', value: 'fecha.anio', label: 'Fecha Hoy: Año (AAAA)' },
    { group: 'Otros', value: 'manual', label: 'Texto Manual / Fijo o a Completar al Emitir' },
    { group: 'Otros', value: 'campo_vacio', label: '🧹 Limpiar / Dejar Campo Vacío (Borra texto previo del PDF)' },
    { group: 'Otros', value: 'firma', label: 'Caja de Firma Ológrafa Manuscrita' },
    { group: 'Otros', value: 'sello_institucional', label: 'Caja de Sello Oficial Institucional (PNG)' },
  ];

  const FIRMANTES_DISPONIBLES = [
    { clave: 'firmante_1', label: 'Firmante 1 (Principal / Asociado / Comercio)' },
    { clave: 'firmante_2', label: 'Firmante 2 (Co-titular / Representante AMMER)' },
    { clave: 'firmante_3', label: 'Firmante 3 (Tercero / Garante / Testigo)' },
    { clave: 'firmante_4', label: 'Firmante 4 (Adicional)' },
  ];

  const state = {
    initialized: false,
    pdfjsPromise: null,
    qrLibPromise: null,
    plantillas: [],
    solicitudesFirma: [],
    bandejaEstadoFiltro: 'TODOS',
    selectedPlantillaGenerar: null,
    selectedPlantillasPaqueteIds: [],
    selloPngBase64: '',
    firmantesGenerar: [
      { clave: 'firmante_1', etiqueta: 'Titular / Asociado', nombre: '', dni: '', telefono: '' },
    ],
    ultimoPdfPreviewB64: '',
    editor: {
      plantillaId: null,
      pdfBase64: '',
      pdfDoc: null,
      _loadedB64: '',
      _renderTask: null,
      _baseViewportW: 0,
      zoom: 1.0,
      vistaLimpia: false,
      grillaSnap: false,
      archivoNombre: '',
      totalPages: 1,
      currentPage: 1,
      campos: [],
      history: [],
      selectedFieldId: null,
      addModeTipo: null, // 'texto' | 'borrador' | 'firma' | 'sello' | null
    },
    canvasFirmaPrueba: {
      drawing: false,
      points: 0,
      hasInk: false,
    },
  };

  function getApiBase() {
    if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
      return RENDER_API_URL.replace(/\/$/, '');
    }
    if (global.AMMER_CONFIG && global.AMMER_CONFIG.RENDER_API_URL) {
      return String(global.AMMER_CONFIG.RENDER_API_URL).replace(/\/$/, '');
    }
    return 'https://ammer-auditor-api.onrender.com';
  }

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function notify(msg, tipo) {
    if (typeof mostrarToast === 'function') {
      mostrarToast(msg, tipo || 'info');
    } else if (typeof showToast === 'function') {
      showToast(msg, tipo || 'info');
    } else {
      console.log('[Firmas AMMER]', msg);
    }
  }

  function esAdminOAnalista() {
    if (typeof tieneAccesoFirmasAmmer === 'function') {
      return !!tieneAccesoFirmasAmmer();
    }
    return false;
  }

  function asegurarPdfJs() {
    if (global.pdfjsLib) {
      if (!global.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      }
      return Promise.resolve(global.pdfjsLib);
    }
    if (state.pdfjsPromise) return state.pdfjsPromise;
    state.pdfjsPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = PDFJS_CDN;
      sc.async = true;
      sc.onload = function () {
        if (global.pdfjsLib) {
          global.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
          resolve(global.pdfjsLib);
        } else {
          reject(new Error('No se pudo inicializar pdf.js'));
        }
      };
      sc.onerror = () => reject(new Error('Error cargando librería pdf.js desde CDN'));
      document.head.appendChild(sc);
    });
    return state.pdfjsPromise;
  }

  async function cargarDocumentoPdfJs(bytes) {
    const pdfjs = await asegurarPdfJs();
    // disableWorker: true evita fallos por política Same-Origin al cargar workers desde CDN en GitHub Pages
    return pdfjs.getDocument({ data: bytes, disableWorker: true }).promise;
  }

  function asegurarQrLib() {
    if (typeof global.qrcode === 'function') {
      return Promise.resolve(global.qrcode);
    }
    if (state.qrLibPromise) return state.qrLibPromise;
    state.qrLibPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = QR_LIB_CDN;
      sc.async = true;
      sc.onload = function () {
        if (typeof global.qrcode === 'function') resolve(global.qrcode);
        else reject(new Error('No se pudo inicializar qrcode'));
      };
      sc.onerror = () => reject(new Error('Error cargando generador QR'));
      document.head.appendChild(sc);
    });
    return state.qrLibPromise;
  }

  async function renderQrEnElemento(elId, url, titulo) {
    const box = document.getElementById(elId);
    if (!box || !url) return;
    try {
      const qrFn = await asegurarQrLib();
      const qr = qrFn(0, 'M');
      qr.addData(String(url));
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      box.title = 'Clic para ampliar código QR en pantalla completa';
      box.onclick = () => ampliarQrModal(url, titulo || 'Escanear para Firmar');
    } catch (_e) {
      box.innerHTML = '<span style="font-size:0.68rem;color:#64748b;text-align:center;">QR no disponible</span>';
    }
  }

  async function ampliarQrModal(url, titulo) {
    if (!url) return;
    let svgHtml = '';
    try {
      const qrFn = await asegurarQrLib();
      const qr = qrFn(0, 'M');
      qr.addData(String(url));
      qr.make();
      svgHtml = qr.createSvgTag({ cellSize: 8, margin: 3, scalable: true });
    } catch (_e) {
      notify('No se pudo renderizar el código QR ampliado.', 'warning');
      return;
    }
    ensureModalFase4Firmas(`📱 ${escHtml(titulo || 'Código QR de Firma')}`, `
      <div style="text-align:center;">
        <div style="font-size:0.84rem;color:#475569;margin-bottom:0.85rem;">Mostrá este código al asociado para que lo escanee con la cámara de su celular e ingrese directo al portal de firma:</div>
        <div style="width:min(300px,78vw);height:min(300px,78vw);margin:0 auto 0.9rem;background:#ffffff;border:2px solid #cbd5e1;border-radius:16px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,0.1);display:flex;align-items:center;justify-content:center;">
          ${svgHtml.replace('<svg ', '<svg style="width:100%;height:100%;display:block;" ')}
        </div>
        <div class="font-mono" style="font-size:0.72rem;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem;word-break:break-all;margin-bottom:0.75rem;">${escHtml(url)}</div>
        <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="navigator.clipboard.writeText('${escHtml(url)}').then(()=>window.notificarSistema && window.notificarSistema('Enlace copiado','success'))">📋 Copiar Enlace</button>
      </div>
    `);
  }

  function guardarEnlaceCacheado_(solId, info) {
    if (!solId || !info || !info.url_firma) return;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_ENLACES_KEY) || '{}');
      raw[String(solId)] = {
        url_firma: String(info.url_firma),
        pin_otp: info.pin_otp ? String(info.pin_otp) : '',
        expira_en: info.expira_en || null,
        ts: Date.now(),
      };
      const keys = Object.keys(raw);
      if (keys.length > 90) {
        keys.sort((a, b) => (raw[a].ts || 0) - (raw[b].ts || 0))
          .slice(0, keys.length - 90)
          .forEach((k) => { delete raw[k]; });
      }
      localStorage.setItem(LS_ENLACES_KEY, JSON.stringify(raw));
    } catch (_e) {}
  }

  function obtenerEnlaceCacheadoSolicitud_(solId) {
    if (!solId) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_ENLACES_KEY) || '{}');
      const item = raw[String(solId)];
      if (!item || !item.url_firma) return null;
      if (item.expira_en) {
        const exp = new Date(item.expira_en).getTime();
        if (!Number.isNaN(exp) && exp <= Date.now()) return null;
      } else if (item.ts && (Date.now() - item.ts) > 23.5 * 3600 * 1000) {
        return null;
      }
      return item;
    } catch (_e) {
      return null;
    }
  }

  function obtenerAuthHeaders() {
    if (typeof global.getAuthHeaders === 'function') {
      const h = global.getAuthHeaders();
      if (h && (h.Authorization || h.authorization)) return h;
    }
    let tok = '';
    if (typeof global.getApiAuthToken === 'function') {
      tok = global.getApiAuthToken() || '';
    }
    if (!tok) {
      try { tok = sessionStorage.getItem('AMMER_API_TOKEN') || ''; } catch (_e) {}
    }
    if (!tok) {
      try { tok = localStorage.getItem('AMMER_API_TOKEN') || ''; } catch (_e) {}
    }
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  }

  async function apiFetchJson(path, opts) {
    const url = getApiBase() + path;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      obtenerAuthHeaders(),
      (opts && opts.headers) || {}
    );
    const resp = await fetch(url, Object.assign({}, opts || {}, { headers }));
    let data = null;
    try {
      data = await resp.json();
    } catch (_e) {
      data = null;
    }
    if (!resp.ok) {
      if (resp.status === 401 && typeof global.setApiAuthToken === 'function') {
        // Limpiar token inválido/expirado si existía para forzar re-login limpio
        const tokActual = obtenerAuthHeaders().Authorization;
        if (tokActual) global.setApiAuthToken(null);
      }
      throw new Error((data && (data.detail || data.message)) || `Error HTTP ${resp.status}`);
    }
    return data;
  }

  function base64ToUint8Array(b64) {
    const clean = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
    const bin = atob(clean);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function descargarBase64Pdf(b64, nombreArchivo) {
    const bytes = base64ToUint8Array(b64);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || 'Documento_AMMER.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        const idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  function setEstadoEditorPdf(msg, tipo) {
    const el = document.getElementById('lblEditorEstadoPdf');
    if (!el) return;
    if (!msg) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.textContent = msg;
    if (tipo === 'ok') {
      el.style.background = '#dcfce7';
      el.style.borderColor = '#86efac';
      el.style.color = '#166534';
    } else if (tipo === 'warn') {
      el.style.background = '#fffbeb';
      el.style.borderColor = '#fde68a';
      el.style.color = '#92400e';
    } else if (tipo === 'err') {
      el.style.background = '#fef2f2';
      el.style.borderColor = '#fecaca';
      el.style.color = '#b91c1c';
    } else {
      el.style.background = '#eff6ff';
      el.style.borderColor = '#bfdbfe';
      el.style.color = '#1e3a8a';
    }
  }

  function getExpedientesLocales() {
    if (typeof getStoredSolicitudes === 'function') {
      const arr = getStoredSolicitudes();
      if (Array.isArray(arr)) return arr;
    }
    return [];
  }

  function construirContextoDesdeExpediente(expObj) {
    const e = expObj || {};
    const sol = e.solicitante || {};
    const prest = e.prestamo || {};
    const expId = String(e.id_definitivo || e.ID_Definitivo_Expediente || e.Nro_Definitivo || e.id_provisorio || e.id || '');

    const chkVinc = document.getElementById('chkFirmaMostrarVerValidacion');
    const mostrarValidacionExp = Boolean(e && (e.id || expId)) && (chkVinc ? Boolean(chkVinc.checked) : true);

    const ctx = {
      expediente: { id: expId },
      expediente_uid: e.id ? String(e.id) : null,
      expediente_provisorio: (e.id_provisorio || e.idProvisorio) ? String(e.id_provisorio || e.idProvisorio) : null,
      expediente_definitivo: (e.id_definitivo || e.ID_Definitivo_Expediente || e.Nro_Definitivo) ? String(e.id_definitivo || e.ID_Definitivo_Expediente || e.Nro_Definitivo) : null,
      mostrar_validacion_expediente: mostrarValidacionExp,
      solicitante: {
        nombre: sol.nombre || e.Apellido_Nombre || e.nombre || '',
        dni: String(sol.dni || e.dni || e.DNI || '').replace(/\D/g, ''),
        cuil: sol.cuil || e.cuil || '',
        domicilio: sol.domicilio || e.domicilio || '',
        localidad: sol.localidad || e.localidad || '',
        telefono: sol.telefono || e.telefono || '',
        email: sol.email || e.email || '',
        cbu: sol.cbu || e.cbu || '',
        alias: sol.alias || e.alias || '',
        banco: sol.banco || e.banco || '',
        organismo: sol.organismo || e.organismo || e.reparticion || '',
        legajo: sol.legajo || e.legajo || '',
        estadoCivil: sol.estadoCivil || e.estadoCivil || '',
        fechaNacimiento: sol.fechaNacimiento || e.fechaNacimiento || '',
      },
      prestamo: {
        lineaNombre: prest.lineaNombre || e.lineaNombre || e.linea || '',
        monto: prest.monto != null ? prest.monto : e.monto,
        cuotas: prest.cuotas != null ? prest.cuotas : e.cuotas,
        valorCuota: prest.valorCuota != null ? prest.valorCuota : e.valorCuota,
        totalDevolver: prest.totalDevolver != null ? prest.totalDevolver : e.totalDevolver,
        tna: prest.tna || e.tna || '',
        tipoTasa: prest.tipoTasa || e.tipoTasa || 'TASA FIJA',
      },
      manuales: {},
    };

    const manualInputs = document.querySelectorAll('[data-firma-campo-valor]');
    manualInputs.forEach((inp) => {
      const cid = inp.getAttribute('data-firma-campo-valor');
      if (!cid) return;
      ctx.manuales[cid] = inp.value;
      if (inp.dataset && inp.dataset.userEdited === '1' && String(inp.value || '').trim() === '') {
        ctx.manuales['__vacio__:' + cid] = true;
      }
    });
    const origenInputs = document.querySelectorAll('[data-firma-origen-valor]');
    origenInputs.forEach((inp) => {
      const org = inp.getAttribute('data-firma-origen-valor');
      if (!org) return;
      ctx.manuales['origen:' + org] = inp.value;
      if (inp.dataset && inp.dataset.userEdited === '1' && String(inp.value || '').trim() === '') {
        ctx.manuales['__vacio__:origen:' + org] = true;
      }
    });
    return ctx;
  }

  function resolverPreviewLocal(campo, ctx) {
    if (!campo) return '';
    if (campo.tipo === 'borrador' || campo.origen_campo === 'campo_vacio') return '';
    if (campo.tipo === 'firma') return '[Firma manuscrita]';
    if (campo.tipo === 'sello') return '[Sello Oficial PNG]';
    const origen = String(campo.origen_campo || 'manual');
    const now = new Date();
    if (origen === 'fecha.hoy') return now.toLocaleDateString('es-AR');
    if (origen === 'fecha.dia') return String(now.getDate()).padStart(2, '0');
    if (origen === 'fecha.mes') return String(now.getMonth() + 1).padStart(2, '0');
    if (origen === 'fecha.anio') return String(now.getFullYear());
    if (origen === 'manual') return campo.valor_manual || '';
    const partes = origen.split('.');
    let cur = ctx;
    for (const p of partes) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return campo.valor_manual || '';
    }
    return cur != null ? String(cur) : (campo.valor_manual || '');
  }

  // ==================== CAMBIO DE SUBTABS ====================
  function cambiarTabFirmas(tabKey) {
    const tabs = ['generar', 'bandeja', 'eliminados', 'editor'];
    tabs.forEach((k) => {
      const btn = document.getElementById('btnTabFirma_' + k);
      const pnl = document.getElementById('panelFirmas_' + k);
      if (btn) {
        if (k === 'editor' && !esAdminOAnalista()) {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'inline-flex';
        }
        btn.classList.toggle('active', k === tabKey);
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.style.boxShadow = '';
      }
      if (pnl) pnl.style.display = k === tabKey ? 'block' : 'none';
    });
    if (tabKey === 'bandeja' || tabKey === 'eliminados') cargarBandejaFirmas();
  }

  // ==================== SELLO PNG OFICIAL ====================
  function cargarSelloGuardado() {
    try {
      const saved = localStorage.getItem(LS_SELLO_KEY) || '';
      if (saved) state.selloPngBase64 = saved;
    } catch (_e) {}
    renderPreviewSelloPng();
  }

  function renderPreviewSelloPng() {
    const box = document.getElementById('previewSelloPngBox');
    if (!box) return;
    if (state.selloPngBase64) {
      const src = state.selloPngBase64.startsWith('data:')
        ? state.selloPngBase64
        : ('data:image/png;base64,' + state.selloPngBase64);
      box.innerHTML = `<img src="${src}" alt="Sello Oficial AMMER" style="max-width:100%;max-height:100%;object-fit:contain;"/>`;
    } else {
      box.textContent = 'Sin sello';
    }
  }

  async function onArchivoSelloPngSeleccionado(ev) {
    const file = ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      state.selloPngBase64 = b64;
      const chk = document.getElementById('chkRecordarSelloOficial');
      if (chk && chk.checked) {
        try { localStorage.setItem(LS_SELLO_KEY, b64); } catch (_e) {}
      }
      renderPreviewSelloPng();
      notify('Sello oficial PNG cargado correctamente.', 'success');
    } catch (err) {
      notify('Error leyendo imagen de sello: ' + err.message, 'error');
    }
  }

  function limpiarSelloPngOficial() {
    state.selloPngBase64 = '';
    try { localStorage.removeItem(LS_SELLO_KEY); } catch (_e) {}
    const inp = document.getElementById('inpFirmaSelloPngFile');
    if (inp) inp.value = '';
    renderPreviewSelloPng();
  }

  function renderSelectorPaquetePlantillas() {
    const cont = document.getElementById('firmaPaquetePlantillasContainer');
    if (!cont) return;
    if (state.plantillas.length === 0) {
      cont.innerHTML = '<span style="font-size:0.75rem;color:#64748b;">No hay plantillas disponibles aún.</span>';
      return;
    }
    cont.innerHTML = state.plantillas.map((p) => {
      const checked = state.selectedPlantillasPaqueteIds.includes(p.id);
      return `
        <label class="firmas-check-pill firmas-check-pill--compact">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.togglePlantillaEnPaquete('${escHtml(p.id)}', this.checked)"/>
          <span>${escHtml(p.nombre)}</span>
          <span style="font-weight:600;color:#64748b;font-size:0.7rem;">(${p.paginas || 1} pág.)</span>
        </label>
      `;
    }).join('');
  }

  function obtenerPlantillasSeleccionadasGenerador() {
    if (Array.isArray(state.selectedPlantillasPaqueteIds) && state.selectedPlantillasPaqueteIds.length > 0) {
      const list = state.selectedPlantillasPaqueteIds
        .map((id) => state.plantillas.find((p) => p.id === id))
        .filter(Boolean);
      if (list.length > 0) return list;
    }
    return state.selectedPlantillaGenerar ? [state.selectedPlantillaGenerar] : [];
  }

  function togglePlantillaEnPaquete(plantillaId, checked) {
    const idx = state.selectedPlantillasPaqueteIds.indexOf(plantillaId);
    if (checked && idx === -1) {
      state.selectedPlantillasPaqueteIds.push(plantillaId);
    } else if (!checked && idx !== -1) {
      state.selectedPlantillasPaqueteIds.splice(idx, 1);
    }
    renderSelectorPaquetePlantillas();
    const activas = obtenerPlantillasSeleccionadasGenerador();
    state.firmantesGenerar = derivarFirmantesDePlantillas(activas);
    renderCamposCompletarFormulario();
  }

  async function cargarPlantillas() {
    const selGen = document.getElementById('selFirmaPlantilla');
    const selEdit = document.getElementById('selEditarPlantillaExistente');
    try {
      const data = await apiFetchJson('/api/firmas/plantillas', { method: 'GET' });
      state.plantillas = Array.isArray(data.plantillas) ? data.plantillas : [];
    } catch (err) {
      console.warn('Error cargando plantillas de firma:', err);
      state.plantillas = [];
      if (String(err && err.message || '').toLowerCase().includes('autentic') || String(err && err.message || '').toLowerCase().includes('sesi')) {
        notify(err.message, 'warning');
      }
    }

    if (selGen) {
      const prev = selGen.value;
      selGen.innerHTML = '<option value="">-- Seleccionar plantilla PDF AMMER --</option>' +
        state.plantillas.map((p) => `<option value="${escHtml(p.id)}">${escHtml(p.nombre)} (${escHtml(p.categoria || 'GENERAL')} · ${(p.campos_json || []).length} campos)</option>`).join('');
      if (prev && state.plantillas.some((p) => p.id === prev)) selGen.value = prev;
      else if (state.plantillas.length > 0 && !selGen.value) selGen.value = state.plantillas[0].id;
      renderSelectorPaquetePlantillas();
      onPlantillaGenerarChange();
    } else {
      renderSelectorPaquetePlantillas();
    }

    if (selEdit) {
      selEdit.innerHTML = '<option value="">-- Cargar plantilla guardada para editar --</option>' +
        state.plantillas.map((p) => `<option value="${escHtml(p.id)}">${escHtml(p.nombre)} (${p.paginas || 1} pág.)</option>`).join('');
    }
  }

  function poblarSelectorExpedientes() {
    const sel = document.getElementById('selFirmaExpediente');
    if (!sel) return;
    const prev = sel.value;
    const list = getExpedientesLocales();
    sel.innerHTML = '<option value="">-- Carga manual (sin expediente vinculado) --</option>' +
      list.map((s) => {
        const nom = (s.solicitante && s.solicitante.nombre) || s.Apellido_Nombre || s.nombre || 'Socio';
        const dni = (s.solicitante && s.solicitante.dni) || s.dni || '';
        const cod = s.id_definitivo || s.id_provisorio || s.id;
        return `<option value="${escHtml(s.id)}">${escHtml(cod)} — ${escHtml(nom)} (DNI ${escHtml(dni)})</option>`;
      }).join('');
    if (prev) sel.value = prev;
    renderCamposCompletarFormulario();
  }

  function derivarFirmantesDePlantillas(tplsList) {
    const encontrados = [];
    const vistos = new Set();
    (tplsList || []).forEach((tpl) => {
      const campos = (tpl && Array.isArray(tpl.campos_json)) ? tpl.campos_json : [];
      campos.forEach((c) => {
        if (String(c.tipo || '').toLowerCase() !== 'firma') return;
        const clave = String(c.firmante_clave || 'firmante_1');
        if (vistos.has(clave)) return;
        vistos.add(clave);
        encontrados.push({
          clave,
          etiqueta: c.firmante_etiqueta || c.etiqueta || (clave === 'firmante_1' ? 'Titular / Asociado' : `Firmante ${encontrados.length + 1}`),
          nombre: '',
          dni: '',
          telefono: '',
          orden: encontrados.length + 1,
        });
      });
    });
    if (encontrados.length === 0) {
      encontrados.push({ clave: 'firmante_1', etiqueta: 'Titular / Asociado', nombre: '', dni: '', telefono: '', orden: 1 });
    }
    return encontrados;
  }

  function onPlantillaGenerarChange() {
    const sel = document.getElementById('selFirmaPlantilla');
    const pid = sel ? sel.value : '';
    state.selectedPlantillaGenerar = state.plantillas.find((p) => p.id === pid) || null;
    if (state.selectedPlantillasPaqueteIds.length <= 1) {
      state.selectedPlantillasPaqueteIds = state.selectedPlantillaGenerar ? [state.selectedPlantillaGenerar.id] : [];
      renderSelectorPaquetePlantillas();
    }
    const activas = obtenerPlantillasSeleccionadasGenerador();
    state.firmantesGenerar = derivarFirmantesDePlantillas(activas);
    renderCamposCompletarFormulario();
  }

  function getExpedienteSeleccionadoEnGenerador() {
    const sel = document.getElementById('selFirmaExpediente');
    const id = sel ? sel.value : '';
    if (!id) return null;
    return getExpedientesLocales().find((s) => String(s.id) === String(id)) || null;
  }

  function agregarFirmanteGenerador() {
    const idx = state.firmantesGenerar.length + 1;
    state.firmantesGenerar.push({
      clave: `firmante_${idx}`,
      etiqueta: `Firmante ${idx}`,
      nombre: '',
      dni: '',
      telefono: '',
      orden: idx,
    });
    renderFirmantesGenerar();
  }

  function eliminarFirmanteGenerador(idx) {
    if (state.firmantesGenerar.length <= 1) return;
    state.firmantesGenerar.splice(idx, 1);
    state.firmantesGenerar.forEach((f, i) => { f.orden = i + 1; });
    renderFirmantesGenerar();
  }

  function moverOrdenFirmanteGenerador(idx, delta) {
    const target = idx + delta;
    if (target < 0 || target >= state.firmantesGenerar.length) return;
    const tmp = state.firmantesGenerar[idx];
    state.firmantesGenerar[idx] = state.firmantesGenerar[target];
    state.firmantesGenerar[target] = tmp;
    state.firmantesGenerar.forEach((f, i) => { f.orden = i + 1; });
    renderFirmantesGenerar();
  }

  function actualizarDatoFirmanteGenerador(idx, prop, val) {
    if (state.firmantesGenerar[idx]) {
      state.firmantesGenerar[idx][prop] = val;
      if (idx === 0 && (prop === 'nombre' || prop === 'dni')) {
        actualizarPreviewFraseVozGenerador();
      }
    }
  }

  function renderFirmantesGenerar(ctxOpt) {
    const cont = document.getElementById('firmaMultifirmantesContainer');
    if (!cont) return;
    const ctx = ctxOpt || construirContextoDesdeExpediente(getExpedienteSeleccionadoEnGenerador());
    if (state.firmantesGenerar[0]) {
      if (!state.firmantesGenerar[0].nombre && ctx.solicitante.nombre) state.firmantesGenerar[0].nombre = ctx.solicitante.nombre;
      if (!state.firmantesGenerar[0].dni && ctx.solicitante.dni) state.firmantesGenerar[0].dni = ctx.solicitante.dni;
      if (!state.firmantesGenerar[0].telefono && ctx.solicitante.telefono) state.firmantesGenerar[0].telefono = ctx.solicitante.telefono;
    }

    cont.innerHTML = state.firmantesGenerar.map((f, idx) => `
      <div class="firmas-multifirmante-row">
        <div>
          <label class="firmas-label" style="margin-bottom:4px;">Turno #${idx + 1} · ${escHtml(f.clave)}</label>
          <input type="text" class="firmas-input firmas-input--sm" value="${escHtml(f.etiqueta)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'etiqueta', this.value)"/>
        </div>
        <div>
          <label class="firmas-label" style="margin-bottom:4px;">Nombre completo</label>
          <input type="text" class="firmas-input firmas-input--sm" value="${escHtml(f.nombre)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'nombre', this.value)" placeholder="Nombre y Apellido"/>
        </div>
        <div>
          <label class="firmas-label" style="margin-bottom:4px;">DNI</label>
          <input type="text" class="firmas-input firmas-input--sm font-mono" value="${escHtml(f.dni)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'dni', this.value)" placeholder="Sin puntos"/>
        </div>
        <div>
          <label class="firmas-label" style="margin-bottom:4px;">WhatsApp</label>
          <input type="text" class="firmas-input firmas-input--sm font-mono" value="${escHtml(f.telefono)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'telefono', this.value)" placeholder="3434..."/>
        </div>
        <div style="display:flex;gap:4px;align-items:center;padding-bottom:1px;">
          ${state.firmantesGenerar.length > 1 ? `
            <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-icon" onclick="window.moverOrdenFirmanteGenerador(${idx}, -1)" title="Subir orden">▲</button>
            <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-icon" onclick="window.moverOrdenFirmanteGenerador(${idx}, 1)" title="Bajar orden">▼</button>
            <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-icon firmas-btn-danger" onclick="window.eliminarFirmanteGenerador(${idx})" title="Quitar firmante">🗑️</button>
          ` : '<span style="display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 10px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:0.74rem;font-weight:800;color:#475569;">#1</span>'}
        </div>
      </div>
    `).join('');
  }

  function combinarValidacionesPaquete(tplsList) {
    const res = { firma_olografa: true, declaracion_uif: true, tapar_resaltados: true };
    (tplsList || []).forEach((t) => {
      const v = t.validaciones_json || {};
      ['dni_frente_dorso', 'selfie_liveness', 'selfie_voz_consentimiento', 'gps_obligatorio', 'requiere_sello_png', 'requiere_pin_otp'].forEach((k) => {
        if (v[k]) res[k] = true;
      });
      if (v.declaracion_uif === false) res.declaracion_uif = false;
      if (v.firma_olografa === false) res.firma_olografa = false;
      if (v.tapar_resaltados === false) res.tapar_resaltados = false;
    });
    if (res.selfie_voz_consentimiento) res.selfie_liveness = true;
    return res;
  }

  const FIRMA_PRESETS_MODULARES = {
    pdf_std: { requiere_pdf: true, declaracion_uif: true, dni_frente_dorso: false, selfie_liveness: false, selfie_voz_consentimiento: false, firma_olografa: true, gps_obligatorio: false, requiere_pin_otp: false, tituloSinPdf: 'Documento AMMER' },
    pdf_voz: { requiere_pdf: true, declaracion_uif: true, dni_frente_dorso: true, selfie_liveness: true, selfie_voz_consentimiento: true, firma_olografa: true, gps_obligatorio: true, requiere_pin_otp: false, tituloSinPdf: 'Ayuda Económica con Validación Reforzada' },
    solo_dni: { requiere_pdf: false, declaracion_uif: false, dni_frente_dorso: true, selfie_liveness: false, selfie_voz_consentimiento: false, firma_olografa: false, gps_obligatorio: false, requiere_pin_otp: false, tituloSinPdf: 'Validación Documental (Solo DNI)' },
    id_voz: { requiere_pdf: false, declaracion_uif: false, dni_frente_dorso: true, selfie_liveness: true, selfie_voz_consentimiento: true, firma_olografa: false, gps_obligatorio: false, requiere_pin_otp: false, tituloSinPdf: 'Validación Biométrica de Identidad y Voz' },
    dni_firma: { requiere_pdf: false, declaracion_uif: false, dni_frente_dorso: true, selfie_liveness: false, selfie_voz_consentimiento: false, firma_olografa: true, gps_obligatorio: false, requiere_pin_otp: false, tituloSinPdf: 'Validación DNI y Firma de Conformidad' },
  };

  function _sincronizarBotonesPresetFirmas(activeId) {
    Object.keys(FIRMA_PRESETS_MODULARES).forEach((pid) => {
      const btn = document.getElementById(`btnPresetFirma_${pid}`);
      if (!btn) return;
      btn.classList.remove('firmas-btn-navy', 'firmas-btn-soft-blue');
      btn.classList.add(pid === activeId ? 'firmas-btn-navy' : 'firmas-btn-soft-blue');
    });
  }

  function formatearMontoTextoSimpleEs(montoRaw) {
    if (montoRaw === null || montoRaw === undefined || montoRaw === '') return '';
    const num = Number(String(montoRaw).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(num) || num <= 0) return '';
    const val = Math.round(num);
    if (val >= 1000000) {
      const m = Math.floor(val / 1000000);
      const rm = Math.floor((val % 1000000) / 1000);
      const pref = m === 1 ? '1 millón' : `${m} millones`;
      return rm > 0 ? `${pref} ${rm} mil pesos` : `${pref} de pesos`;
    }
    if (val >= 1000) {
      const k = Math.floor(val / 1000);
      const r = val % 1000;
      return r >= 50 ? `${k} mil ${r} pesos` : `${k} mil pesos`;
    }
    return `${val} pesos`;
  }

  function actualizarPreviewFraseVozGenerador() {
    const lbl = document.getElementById('lblPreviewFraseVoz');
    if (!lbl) return;
    const customEl = document.getElementById('inpFirmaVozCustom');
    const customTxt = customEl ? String(customEl.value || '').trim() : '';
    if (customTxt) {
      lbl.textContent = `"${customTxt}"`;
      return;
    }
    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    const f1 = state.firmantesGenerar[0] || {};
    const nombre = String(f1.nombre || ctx.solicitante.nombre || 'Nombre y Apellido').trim() || 'Nombre y Apellido';
    const dniDigits = String(f1.dni || ctx.solicitante.dni || '').replace(/\D/g, '');
    const cod3 = dniDigits.length >= 3 ? dniDigits.slice(-3) : (dniDigits ? dniDigits.padStart(3, '0') : '000');
    const entEl = document.getElementById('selFirmaVozEntidad');
    const entidad = (entEl && entEl.value) ? entEl.value : 'FEDEM / Mutual Modelo';
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hoy = new Date();
    const fechaTxt = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;
    const prest = ctx.prestamo || {};
    const montoTxt = formatearMontoTextoSimpleEs(prest.monto);
    const cuotasNum = Math.round(Number(prest.cuotas || 0));
    if (montoTxt && cuotasNum > 0) {
      const cTxt = cuotasNum === 1 ? '1 cuota' : `${cuotasNum} cuotas`;
      lbl.textContent = `"Soy ${nombre}, hoy ${fechaTxt}, confirmo y acepto ante ${entidad} esta solicitud de ayuda económica por ${montoTxt} en ${cTxt}. Código ${cod3}."`;
    } else {
      lbl.textContent = `"Soy ${nombre}, hoy ${fechaTxt}, confirmo mi identidad y autorizo este trámite ante ${entidad}. Código ${cod3}."`;
    }
  }

  function aplicarPresetValidacionFirmas(presetId) {
    const p = FIRMA_PRESETS_MODULARES[presetId] || FIRMA_PRESETS_MODULARES.pdf_std;
    state.genPresetId = presetId;
    const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = Boolean(v); };
    setC('chkGenReqPdf', p.requiere_pdf);
    setC('chkGenReqUif', p.declaracion_uif);
    setC('chkGenReqDni', p.dni_frente_dorso);
    setC('chkGenReqSelfie', p.selfie_liveness || p.selfie_voz_consentimiento);
    setC('chkGenReqVoz', p.selfie_voz_consentimiento);
    setC('chkGenReqFirma', p.firma_olografa);
    setC('chkGenReqGps', p.gps_obligatorio);
    setC('chkGenReqPin', p.requiere_pin_otp);
    const inpTit = document.getElementById('inpFirmaTituloSinPdf');
    if (inpTit && !p.requiere_pdf) inpTit.value = p.tituloSinPdf || 'Validación de Identidad AMMER';
    _sincronizarBotonesPresetFirmas(presetId);
    renderCamposCompletarFormulario();
  }

  function onToggleValidacionGenerador() {
    const elVoz = document.getElementById('chkGenReqVoz');
    const elSelfie = document.getElementById('chkGenReqSelfie');
    if (elVoz && elVoz.checked && elSelfie && !elSelfie.checked) {
      elSelfie.checked = true;
    }
    state.genPresetId = 'custom';
    _sincronizarBotonesPresetFirmas('');
    renderCamposCompletarFormulario();
  }

  function obtenerValidacionesGenerador(tplsOpt) {
    const getC = (id, def) => {
      const el = document.getElementById(id);
      return el ? Boolean(el.checked) : def;
    };
    const reqPdf = getC('chkGenReqPdf', true);
    const tpls = reqPdf ? (tplsOpt || obtenerPlantillasSeleccionadasGenerador()) : [];
    const baseTpl = reqPdf ? combinarValidacionesPaquete(tpls) : { tapar_resaltados: true };

    const reqVoz = getC('chkGenReqVoz', false) || Boolean(baseTpl.selfie_voz_consentimiento);
    const reqSelfie = getC('chkGenReqSelfie', false) || reqVoz || Boolean(baseTpl.selfie_liveness);
    const entEl = document.getElementById('selFirmaVozEntidad');
    const custEl = document.getElementById('inpFirmaVozCustom');

    const res = {
      modo_tramite: reqPdf ? 'firma_pdf' : 'solo_identidad',
      requiere_pdf: reqPdf,
      declaracion_uif: getC('chkGenReqUif', reqPdf),
      dni_frente_dorso: getC('chkGenReqDni', false) || Boolean(baseTpl.dni_frente_dorso),
      selfie_liveness: reqSelfie,
      selfie_voz_consentimiento: reqVoz,
      firma_olografa: getC('chkGenReqFirma', reqPdf),
      gps_obligatorio: getC('chkGenReqGps', false) || Boolean(baseTpl.gps_obligatorio),
      requiere_pin_otp: getC('chkGenReqPin', false) || Boolean(baseTpl.requiere_pin_otp),
      requiere_sello_png: reqPdf ? Boolean(baseTpl.requiere_sello_png) : false,
      tapar_resaltados: reqPdf ? (baseTpl.tapar_resaltados !== false) : true,
    };
    if (reqVoz) {
      res.entidad_voz = (entEl && entEl.value) ? entEl.value : 'FEDEM / Mutual Modelo';
      const cTxt = custEl ? String(custEl.value || '').trim() : '';
      if (cTxt) res.frase_voz_personalizada = cTxt;
    }
    return res;
  }

  function renderCamposCompletarFormulario() {
    const cont = document.getElementById('firmaCamposGenerarContainer');
    const badgeVal = document.getElementById('firmaValidacionesResumen');
    const selloWrap = document.getElementById('firmaSelloInstitucionalWrap');
    if (!cont) return;

    const reqPdfChk = document.getElementById('chkGenReqPdf');
    const reqPdfFlag = reqPdfChk ? Boolean(reqPdfChk.checked) : true;
    const tpls = reqPdfFlag ? obtenerPlantillasSeleccionadasGenerador() : [];
    const vals = obtenerValidacionesGenerador(tpls);

    const cardTpl = document.getElementById('firmaStepCardPlantilla');
    const accPaq = document.getElementById('firmaPaqueteAccordion');
    const wrapTitSinPdf = document.getElementById('firmaTituloSinPdfWrap');
    const wrapVoz = document.getElementById('firmaVozConfigBox');
    if (cardTpl) {
      cardTpl.style.opacity = vals.requiere_pdf ? '1' : '0.45';
      cardTpl.style.pointerEvents = vals.requiere_pdf ? '' : 'none';
    }
    if (accPaq) accPaq.style.display = vals.requiere_pdf ? '' : 'none';
    if (wrapTitSinPdf) wrapTitSinPdf.style.display = vals.requiere_pdf ? 'none' : 'block';
    if (wrapVoz) wrapVoz.style.display = vals.selfie_voz_consentimiento ? 'block' : 'none';

    const exp = getExpedienteSeleccionadoEnGenerador();
    const wrapVinc = document.getElementById('wrapChkFirmaMostrarVerValidacion');
    if (wrapVinc) {
      wrapVinc.style.display = exp ? 'flex' : 'none';
    }
    const ctx = construirContextoDesdeExpediente(exp);
    renderFirmantesGenerar(ctx);
    if (vals.selfie_voz_consentimiento) {
      actualizarPreviewFraseVozGenerador();
    }

    const todosCampos = [];
    tpls.forEach((tpl) => {
      (Array.isArray(tpl.campos_json) ? tpl.campos_json : []).forEach((c) => {
        todosCampos.push({ campo: c, docNombre: tpl.nombre || 'PDF' });
      });
    });

    const usaSello = Boolean(vals.requiere_sello_png) || todosCampos.some(({ campo }) => String(campo.tipo || '').toLowerCase() === 'sello');
    if (selloWrap) selloWrap.style.display = (vals.requiere_pdf && usaSello) ? 'block' : 'none';
    renderPreviewSelloPng();

    if (badgeVal) {
      const chips = [];
      if (!vals.requiere_pdf) chips.push('📄 Trámite sin PDF previo (Constancia AMMER)');
      else if (tpls.length > 1) chips.push(`📦 Paquete unificado: ${tpls.length} PDFs`);
      chips.push(`👥 ${state.firmantesGenerar.length} ${state.firmantesGenerar.length === 1 ? 'firmante' : 'firmantes requeridos'}`);
      if (vals.declaracion_uif) chips.push('📋 DDJJ UIF');
      if (vals.dni_frente_dorso) chips.push('🪪 DNI Frente y Dorso');
      if (vals.selfie_liveness) chips.push('🤳 Selfie Liveness');
      if (vals.selfie_voz_consentimiento) chips.push('🎙️ Voz + Frase Dinámica');
      if (vals.firma_olografa) chips.push('✍️ Firma manuscrita');
      if (vals.gps_obligatorio) chips.push('📍 GPS');
      if (vals.requiere_pin_otp) chips.push('🔐 PIN 2FA');
      if (vals.requiere_pdf && usaSello) chips.push('🏛️ Sello Institucional PNG');
      if (vals.requiere_pdf && vals.tapar_resaltados !== false) chips.push('🧹 Limpia resaltados');
      badgeVal.innerHTML = chips.map((c) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;font-weight:700;padding:4px 10px;border-radius:9999px;background:#eff6ff;color:#0f2744;border:1px solid #bfdbfe;">${escHtml(c)}</span>`).join(' ');
    }

    const inpWa = document.getElementById('inpFirmaTelefonoWa');
    if (inpWa && ctx.solicitante.telefono) inpWa.value = ctx.solicitante.telefono;

    if (!vals.requiere_pdf) {
      cont.innerHTML = '<div style="padding:1.15rem;text-align:center;color:#0f2744;font-size:0.84rem;background:#f0fdf4;border-radius:12px;border:1.5px solid #86efac;">✅ <strong>Validación modular sin PDF previo:</strong> no necesitás elegir plantilla. Al emitir el enlace, se generará una Constancia Probatoria A4 AMMER con las validaciones marcadas arriba.</div>';
      return;
    }

    if (tpls.length === 0) {
      cont.innerHTML = '<div style="padding:1.4rem;text-align:center;color:#64748b;font-size:0.84rem;background:#f8fafc;border-radius:12px;border:1.5px dashed #cbd5e1;">Seleccioná una plantilla arriba (o desmarcá <strong>📄 Con documento PDF</strong> para solicitar solo identidad).</div>';
      return;
    }

    const camposEditables = todosCampos.filter(({ campo }) =>
      campo.tipo !== 'firma' && campo.tipo !== 'sello' && campo.tipo !== 'borrador' && campo.origen_campo !== 'campo_vacio'
    );
    if (camposEditables.length === 0) {
      cont.innerHTML = '<div style="padding:1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;font-size:0.82rem;color:#475569;">Estas plantillas no tienen campos de texto editables (solo zonas limpiadas, firma o sello).</div>';
      return;
    }

    // Deduplicar por origen_campo compartido (si es distinto de 'manual') para completar una sola vez para todo el paquete
    const itemsUnificados = [];
    const mapOrigen = new Map();
    camposEditables.forEach(({ campo, docNombre }) => {
      const org = String(campo.origen_campo || 'manual');
      if (org !== 'manual') {
        if (!mapOrigen.has(org)) {
          const obj = { campo, docs: new Set([docNombre]), sharedOrigen: org };
          mapOrigen.set(org, obj);
          itemsUnificados.push(obj);
        } else {
          mapOrigen.get(org).docs.add(docNombre);
        }
      } else {
        itemsUnificados.push({ campo, docs: new Set([docNombre]), sharedOrigen: null });
      }
    });

    cont.innerHTML = '<div class="firmas-campos-grid">' +
      itemsUnificados.map(({ campo: c, docs, sharedOrigen }) => {
        const val = resolverPreviewLocal(c, ctx);
        const attr = sharedOrigen
          ? `data-firma-origen-valor="${escHtml(sharedOrigen)}"`
          : `data-firma-campo-valor="${escHtml(c.id)}"`;
        const alcance = docs.size > 1
          ? `<span style="font-weight:700;color:#1d4ed8;background:#dbeafe;padding:1px 6px;border-radius:9999px;font-size:0.65rem;">${docs.size} PDFs</span>`
          : `<span style="font-weight:600;color:#64748b;background:#ffffff;border:1px solid #e2e8f0;padding:1px 6px;border-radius:9999px;font-size:0.65rem;">${tpls.length > 1 ? escHtml([...docs][0].slice(0, 18)) : 'Pág. ' + (c.pagina || 1)}</span>`;
        return `
          <div class="firmas-field-card">
            <label class="firmas-label" style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;">
              <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(c.etiqueta || c.id)}</span>
              ${alcance}
            </label>
            <div style="display:flex;gap:5px;align-items:center;">
              <input type="text" class="firmas-input firmas-input--sm" ${attr} value="${escHtml(val)}" oninput="this.dataset.userEdited='1'" placeholder="Dejar vacío o ingresar..."/>
              <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-icon firmas-btn-soft-blue" onclick="window.limpiarInputGenerarCampo(this)" title="Vaciar texto para dejar el campo en blanco en el PDF">🧹</button>
            </div>
          </div>
        `;
      }).join('') +
      '</div>';
  }

  function limpiarInputGenerarCampo(btn) {
    const wrap = btn && btn.parentElement;
    const inp = wrap ? wrap.querySelector('input') : null;
    if (!inp) return;
    inp.value = '';
    inp.dataset.userEdited = '1';
    inp.focus();
  }

  async function previsualizarPdfGenerado(usarFirmaPrueba) {
    const valsPre = obtenerValidacionesGenerador();
    if (valsPre.requiere_pdf === false) {
      notify('Las validaciones sin PDF previo generan su Constancia Probatoria A4 automáticamente al emitir el enlace.', 'info');
      return;
    }
    const tpls = obtenerPlantillasSeleccionadasGenerador();
    if (tpls.length === 0) {
      notify('Seleccioná al menos una plantilla PDF primero.', 'warning');
      return;
    }
    const tpl = tpls[0];
    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    const firmaPrueba = usarFirmaPrueba && state.canvasFirmaPrueba.hasInk
      ? document.getElementById('canvasFirmaPruebaPresencial').toDataURL('image/png')
      : null;
    const vals = obtenerValidacionesGenerador(tpls);

    notify(tpls.length > 1 ? `Generando vista previa consolidada del paquete (${tpls.length} PDFs)...` : 'Generando vista previa del PDF estampado...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/generar-preview', {
        method: 'POST',
        body: JSON.stringify({
          plantilla_id: tpl.id,
          plantillas_ids: tpls.map((t) => t.id),
          contexto: ctx,
          firmaPngBase64: firmaPrueba,
          selloPngBase64: state.selloPngBase64 || null,
          incluir_hoja_evidencia: Boolean(firmaPrueba),
          quitar_resaltados: vals.tapar_resaltados !== false,
        }),
      });
      state.ultimoPdfPreviewB64 = res.pdfBase64;
      await renderizarPreviewPdfEnPanel(res.pdfBase64);
      const wrap = document.getElementById('firmaPreviewPdfWrap');
      if (wrap) wrap.style.display = 'block';
      notify('Vista previa generada correctamente.', 'success');
    } catch (err) {
      notify('Error al previsualizar PDF: ' + err.message, 'error');
    }
  }

  async function renderizarPreviewPdfEnPanel(b64) {
    const cont = document.getElementById('firmaPreviewPaginasContainer');
    if (!cont) return;
    cont.innerHTML = '<div style="padding:1rem;text-align:center;color:#64748b;font-size:0.82rem;">Renderizando páginas PDF...</div>';
    try {
      const doc = await cargarDocumentoPdfJs(base64ToUint8Array(b64));
      cont.innerHTML = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = '100%';
        canvas.style.maxWidth = '660px';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto 0.75rem auto';
        canvas.style.borderRadius = '8px';
        canvas.style.boxShadow = '0 2px 10px rgba(15,23,42,0.12)';
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        cont.appendChild(canvas);
      }
    } catch (err) {
      cont.innerHTML = `<div style="color:#b91c1c;font-size:0.8rem;">No se pudo renderizar vista previa en pantalla (${escHtml(err.message)}), pero podés descargar el PDF con el botón superior.</div>`;
    }
  }

  async function generarEnlaceFirmaMovil() {
    const valsBase = obtenerValidacionesGenerador();
    const esSinPdf = valsBase.requiere_pdf === false;
    const tpls = esSinPdf ? [] : obtenerPlantillasSeleccionadasGenerador();
    if (!esSinPdf && tpls.length === 0) {
      notify('Seleccioná al menos una plantilla PDF primero (o desmarcá "Con documento PDF" para trámite modular).', 'warning');
      return;
    }
    const vals = obtenerValidacionesGenerador(tpls);
    if (esSinPdf && !vals.dni_frente_dorso && !vals.selfie_liveness && !vals.selfie_voz_consentimiento && !vals.declaracion_uif && !vals.firma_olografa) {
      notify('Activá al menos una validación (DNI, Selfie, Voz, UIF o Firma) para generar la solicitud sin PDF.', 'warning');
      return;
    }
    const tpl = tpls[0] || null;
    if (!esSinPdf && vals.requiere_sello_png && !state.selloPngBase64) {
      notify('Esta plantilla/paquete requiere subir la imagen PNG del Sello Oficial Institucional antes de generar el enlace.', 'warning');
      return;
    }

    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    const inpWa = document.getElementById('inpFirmaTelefonoWa');
    const telWa = (inpWa && inpWa.value.trim()) || ctx.solicitante.telefono || '';
    const baseFirma = new URL('firmar.html', window.location.href).href.split('?')[0];
    const ordenSecuencial = Boolean((document.getElementById('chkOrdenSecuencialFirma') || {}).checked);
    const enviarWaAuto = Boolean((document.getElementById('chkEnviarWaAutoFirma') || {}).checked);

    const firmantesPayload = state.firmantesGenerar.map((f, idx) => ({
      clave: f.clave || `firmante_${idx + 1}`,
      etiqueta: f.etiqueta || `Firmante ${idx + 1}`,
      nombre: f.nombre || (idx === 0 ? (ctx.solicitante.nombre || 'Asociado/a') : `Firmante ${idx + 1}`),
      dni: f.dni || (idx === 0 ? (ctx.solicitante.dni || '') : ''),
      telefono: f.telefono || (idx === 0 ? telWa : ''),
      orden: idx + 1,
    }));

    const inpTitSinPdf = document.getElementById('inpFirmaTituloSinPdf');
    const tituloSinPdf = (inpTitSinPdf && inpTitSinPdf.value.trim()) || 'Validación de Identidad AMMER';
    const nombreDocLabel = esSinPdf
      ? tituloSinPdf
      : (tpls.length > 1
        ? `Paquete (${tpls.length} docs): ${tpls.map((t) => t.nombre).slice(0, 3).join(' + ')}`
        : tpl.nombre);

    notify(
      esSinPdf
        ? 'Generando enlace seguro de validación modular (24hs)...'
        : (tpls.length > 1 ? `Generando paquete unificado (${tpls.length} PDFs)...` : 'Generando enlace(s) seguro(s) de firma 24hs...'),
      'info'
    );
    try {
      const res = await apiFetchJson('/api/firmas/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          plantilla_id: tpl ? tpl.id : null,
          plantillas_ids: tpls.map((t) => t.id),
          plantilla_nombre: nombreDocLabel,
          validaciones: vals,
          expediente_id: exp ? String(exp.id_definitivo || exp.id_provisorio || exp.id) : null,
          dni_solicitante: firmantesPayload[0].dni || ctx.solicitante.dni || '',
          nombre_solicitante: firmantesPayload[0].nombre || ctx.solicitante.nombre || 'Asociado/a',
          telefono_whatsapp: firmantesPayload[0].telefono || telWa,
          contexto: ctx,
          selloPngBase64: (!esSinPdf && state.selloPngBase64) ? state.selloPngBase64 : null,
          firmantes: firmantesPayload,
          orden_secuencial: ordenSecuencial,
          enviar_whatsapp_auto: enviarWaAuto,
          quitar_resaltados: vals.tapar_resaltados !== false,
          base_url_firma: baseFirma,
        }),
      });

      state.ultimoPdfPreviewB64 = res.pdfBase64 || '';
      const box = document.getElementById('firmaEnlaceGeneradoBox');
      const lblHash = document.getElementById('lblFirmaHashOriginal');
      const listCont = document.getElementById('firmaEnlacesListaContainer');
      if (lblHash) lblHash.textContent = res.hash_sha256_original || '-';

      const enlaces = Array.isArray(res.enlaces_firmantes) && res.enlaces_firmantes.length > 0
        ? res.enlaces_firmantes
        : [{ solicitud_id: res.solicitud_id, etiqueta: 'Firmante 1', nombre: firmantesPayload[0].nombre, telefono: telWa, url_firma: res.url_firma, pin_otp: res.pin_otp, orden: 1 }];

      enlaces.forEach((item, idx) => {
        const sId = item.solicitud_id || (idx === 0 ? res.solicitud_id : null);
        if (sId && item.url_firma) {
          guardarEnlaceCacheado_(sId, {
            url_firma: item.url_firma,
            pin_otp: item.pin_otp || '',
            expira_en: res.expira_en || null,
          });
        }
      });

      if (listCont) {
        listCont.innerHTML = enlaces.map((item, idx) => {
          const sId = item.solicitud_id || (idx === 0 ? res.solicitud_id : '');
          const pinNote = item.pin_otp ? `\n\n🔐 Tu código PIN de seguridad para confirmar la firma es: *${item.pin_otp}*` : '';
          const msg = `Hola ${item.nombre || 'Estimado/a'}, te compartimos desde Asociación Mutual Modelo de Entre Ríos (AMMER) el enlace seguro para revisar y firmar "${nombreDocLabel}" (${item.etiqueta || 'Firmante'}):\n\n${item.url_firma}${pinNote}\n\nEste enlace es personal y tiene vigencia de 24 horas.`;
          const pinBadge = item.pin_otp
            ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:0.55rem;padding:0.35rem 0.72rem;border-radius:9px;background:#f5f3ff;border:1px solid #ddd6fe;color:#5b21b6;font-size:0.78rem;font-weight:800;">🔐 PIN 2FA para firmar: <span class="font-mono" style="font-size:0.92rem;letter-spacing:2px;">${escHtml(item.pin_otp)}</span></div>`
            : '';
          const waAutoBadge = item.whatsapp_auto && item.whatsapp_auto.ok
            ? '<span style="display:inline-flex;align-items:center;margin-left:6px;padding:2px 8px;border-radius:9999px;background:#dcfce7;border:1px solid #86efac;color:#166534;font-size:0.68rem;font-weight:800;">🤖 Enviado por Bot WA</span>'
            : (ordenSecuencial && (item.orden || idx + 1) > 1
              ? '<span style="display:inline-flex;align-items:center;margin-left:6px;padding:2px 8px;border-radius:9999px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:0.68rem;font-weight:700;">⏳ Se habilita al firmar turno previo</span>'
              : '');
          const botSendBtn = sId
            ? `<button type="button" class="firmas-btn firmas-btn--sm firmas-btn-navy" onclick="window.enviarDirectoBotWaGenerado('${escHtml(sId)}', ${idx})" title="Enviar el enlace y PIN automáticamente desde el Bot WhatsApp institucional">🤖 Enviar por Bot WA ahora</button>`
            : '';
          return `
            <div style="background:#ffffff;border:1px solid #a7f3d0;border-radius:12px;padding:0.95rem 1.05rem;box-shadow:0 2px 8px rgba(5,150,105,0.06);display:flex;gap:0.95rem;flex-wrap:wrap;align-items:stretch;">
              <div style="flex:1 1 320px;min-width:0;">
                <div style="font-size:0.84rem;font-weight:800;color:#065f46;margin-bottom:0.5rem;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
                  <span>👤 ${ordenSecuencial ? `[Turno #${item.orden || idx + 1}] ` : ''}${escHtml(item.etiqueta || `Firmante ${idx + 1}`)}: ${escHtml(item.nombre || '-')}</span>
                  ${item.dni ? `<span class="font-mono" style="font-weight:600;color:#047857;font-size:0.77rem;">(DNI ${escHtml(item.dni)})</span>` : ''}
                  ${waAutoBadge}
                </div>
                ${pinBadge}
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.55rem;">
                  <input type="text" id="txtEnlaceFirmante_${idx}" class="firmas-input firmas-input--sm font-mono" readonly value="${escHtml(item.url_firma)}" style="flex:1;min-width:220px;border-color:#6ee7b7;background:#f8fafc;"/>
                  <button type="button" class="firmas-btn firmas-btn--sm" onclick="window.copiarInputPorId('txtEnlaceFirmante_${idx}', 'Enlace de firma')" style="border-color:#059669;color:#047857;">📋 Copiar Enlace</button>
                </div>
                <textarea id="txtMsgWaFirmante_${idx}" class="firmas-textarea" rows="3" style="border-color:#6ee7b7;font-size:0.78rem;margin-bottom:0.55rem;">${escHtml(msg)}</textarea>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                  <button type="button" class="firmas-btn firmas-btn--sm" onclick="window.copiarInputPorId('txtMsgWaFirmante_${idx}', 'Mensaje WhatsApp')" style="border-color:#059669;color:#047857;">📋 Copiar Mensaje</button>
                  ${botSendBtn}
                  <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-emerald" onclick="window.abrirWhatsAppFirmante('${escHtml(item.telefono || telWa)}', 'txtMsgWaFirmante_${idx}')">💬 Abrir Chat WhatsApp</button>
                </div>
              </div>
              <div class="firmas-qr-card">
                <div id="qrFirmaGenBox_${idx}" class="firmas-qr-svg" title="Generando QR...">
                  <span style="font-size:0.68rem;color:#64748b;">QR...</span>
                </div>
                <span style="font-size:0.69rem;font-weight:800;color:#065f46;text-align:center;">📱 Escanear en persona</span>
                <button type="button" class="firmas-btn firmas-btn--xs" style="width:100%;" onclick="window.ampliarQrModal('${escHtml(item.url_firma)}', '${escHtml(item.nombre || 'Firmante')}')">🔍 Ampliar QR</button>
              </div>
            </div>
          `;
        }).join('');
        enlaces.forEach((item, idx) => {
          if (item.url_firma) {
            renderQrEnElemento(`qrFirmaGenBox_${idx}`, item.url_firma, `${item.nombre || 'Firmante'} — Firma AMMER`);
          }
        });
      }
      if (box) box.style.display = 'block';
      notify(`Se generaron ${enlaces.length} enlace(s) de firma correctamente.`, 'success');
      if (exp && typeof cargarIndiceFirmasPorExpediente === 'function') {
        cargarIndiceFirmasPorExpediente(true);
      }
    } catch (err) {
      notify('Error al generar enlace de firma: ' + err.message, 'error');
    }
  }

  function copiarTextoSeguro(texto, desc) {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(
      () => notify(`${desc} copiado al portapapeles.`, 'success'),
      () => notify('No se pudo copiar automáticamente. Seleccionalo manualmente.', 'warning')
    );
  }

  function copiarInputPorId(elId, desc) {
    const el = document.getElementById(elId);
    if (el) copiarTextoSeguro(el.value, desc || 'Texto');
  }

  function abrirWhatsAppFirmante(telRaw, textareaId) {
    const msg = (document.getElementById(textareaId) || {}).value || '';
    let tel = String(telRaw || '').replace(/\D/g, '');
    if (tel && !tel.startsWith('54')) {
      tel = '549' + tel.replace(/^0+/, '');
    }
    const base = tel ? `https://wa.me/${tel}?text=` : 'https://wa.me/?text=';
    window.open(base + encodeURIComponent(msg), '_blank', 'noopener');
  }

  // ==================== BANDEJA DE FIRMAS, MÉTRICAS & BOT WA ====================
  async function cargarEstadoBotWhatsappFirmas() {
    const badge = document.getElementById('badgeEstadoBotWaFirmas');
    if (!badge) return;
    try {
      const d = await apiFetchJson('/api/firmas/whatsapp/estado', { method: 'GET' });
      if (d && d.connected) {
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
        badge.textContent = `🟢 Bot WA Conectado${d.phoneMasked ? ' (' + d.phoneMasked + ')' : ''}`;
      } else {
        badge.style.background = '#fef3c7';
        badge.style.color = '#92400e';
        badge.textContent = '🟡 Manual (wa.me)';
      }
    } catch (_e) {
      badge.style.background = '#f1f5f9';
      badge.style.color = '#64748b';
      badge.textContent = '🟡 Manual (wa.me)';
    }
  }

  function renderMetricasFirmas(m) {
    const bar = document.getElementById('firmaMetricasBar');
    if (!bar) return;
    if (!m || !m.ok) {
      bar.innerHTML = '';
      return;
    }
    const card = (lbl, val, accent, col) => `
      <div class="firmas-kpi-card" style="--kpi-accent:${accent};--kpi-val-color:${col};">
        <div class="firmas-kpi-lbl">${escHtml(lbl)}</div>
        <div class="firmas-kpi-val">${escHtml(val)}</div>
      </div>
    `;
    const promTxt = m.tiempo_promedio_firma_min != null
      ? (m.tiempo_promedio_firma_min >= 60 ? `${(m.tiempo_promedio_firma_min / 60).toFixed(1)} h` : `${m.tiempo_promedio_firma_min} min`)
      : '-';
    bar.innerHTML = [
      card('Total Solicitudes', m.total, '#0f2744', '#0f172a'),
      card('Completadas', `${m.firmadas} (${m.tasa_completitud_pct || 0}%)`, '#16a34a', '#166534'),
      card('En Espera / Parciales', (m.pendientes || 0) + (m.parciales || 0), '#d97706', '#b45309'),
      card('Tiempo Promedio', promTxt, '#135596', '#135596'),
      card('Paquetes Multi-PDF', m.paquetes_multidoc || 0, '#7c3aed', '#5b21b6'),
      card('Alertas Identidad', m.alertas_ekyc_o_cruce || 0, (m.alertas_ekyc_o_cruce > 0 ? '#dc2626' : '#64748b'), (m.alertas_ekyc_o_cruce > 0 ? '#b91c1c' : '#334155')),
    ].join('');
  }

  async function cargarMetricasFirmas() {
    try {
      const m = await apiFetchJson('/api/firmas/metricas', { method: 'GET' });
      renderMetricasFirmas(m);
    } catch (_e) {
      // Silencioso si el rol o endpoint no aplica
    }
  }

  async function notificarWhatsappSolicitud(solId, tipo, opts) {
    try {
      notify('Enviando notificación por WhatsApp...', 'info');
      const cached = obtenerEnlaceCacheadoSolicitud_(solId) || {};
      const bodyPayload = {
        tipo: tipo || 'recordatorio',
        url_firma: (opts && opts.url_firma) || cached.url_firma || null,
        pin_otp: (opts && opts.pin_otp) || cached.pin_otp || null,
      };
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/notificar-whatsapp`, {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      if (res.enviado_por_bot) {
        notify(tipo === 'envio' ? 'Enlace enviado automáticamente por el Bot WhatsApp AMMER.' : 'Recordatorio enviado automáticamente por el Bot WhatsApp AMMER.', 'success');
      } else if (res.wa_link) {
        notify('Bot WA desconectado; abriendo chat manual en WhatsApp Web...', 'warning');
        window.open(res.wa_link, '_blank', 'noopener');
      } else {
        notify(res.motivo || 'No se pudo enviar por WhatsApp.', 'warning');
      }
    } catch (err) {
      notify('Error enviando notificación WA: ' + err.message, 'error');
    }
  }

  async function enviarDirectoBotWaGenerado(solId, idx) {
    const inp = document.getElementById('txtEnlaceFirmante_' + idx);
    const urlVal = inp ? inp.value : null;
    await notificarWhatsappSolicitud(solId, 'envio', { url_firma: urlVal });
  }

  async function copiarORenovarEnlaceFila(solId) {
    const cached = obtenerEnlaceCacheadoSolicitud_(solId);
    if (cached && cached.url_firma) {
      copiarTextoSeguro(cached.url_firma, 'Enlace de firma activo');
      return;
    }
    if (!global.confirm('El enlace original está cifrado por seguridad y no está en caché local de este navegador.\n\n¿Querés generar un nuevo enlace válido por 24 horas (invalida el anterior)?')) {
      return;
    }
    await renovarEnlaceSolicitudFirma(solId);
  }

  async function cargarBandejaFirmas() {
    const tbody = document.getElementById('tbodyBandejaFirmas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#64748b;font-weight:600;">Cargando solicitudes de firma...</td></tr>';
    cargarMetricasFirmas();
    try {
      const data = await apiFetchJson('/api/firmas/solicitudes', { method: 'GET' });
      state.solicitudesFirma = Array.isArray(data.solicitudes) ? data.solicitudes : [];
      _reconstruirIndiceFirmasPorExpediente();
      renderBandejaFirmas();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#b91c1c;font-weight:600;">Error cargando bandeja: ${escHtml(err.message)}</td></tr>`;
    }
  }

  const ESTADOS_BAJA_FIRMA = ['ANULADO', 'CANCELADO', 'DESESTIMADO', 'ELIMINADO'];

  function esSolicitudEnBaja(r) {
    const est = String((r && r.estado) || '').trim().toUpperCase();
    return ESTADOS_BAJA_FIRMA.includes(est);
  }

  function solicitudTieneAlertaFirma_(r) {
    const ek = (r && r.ekyc_resumen) || {};
    const bo = ek.boletin_oficial_er || {};
    const cj = ek.cajajper || {};
    const ej = (r && r.validacion_ejemplar_manual) || {};
    return Boolean(
      ek.estado_ekyc === 'REVISION_REQUERIDA'
      || bo.tiene_alerta_critica
      || cj.nivel_alerta === 'ALTO'
      || Number(cj.cantidad_expedientes || 0) > 0
      || ej.valido === false
    );
  }

  function setFiltroEstadoBandejaFirmas(estado) {
    state.bandejaEstadoFiltro = estado || 'TODOS';
    renderBandejaFirmas();
  }

  function obtenerSolicitudesFiltradasBandeja_() {
    const activasAll = state.solicitudesFirma.filter((r) => !esSolicitudEnBaja(r));
    const q = String((document.getElementById('inpFiltroBandejaFirmas') || {}).value || '').trim().toLowerCase();
    const estFiltro = String(state.bandejaEstadoFiltro || 'TODOS').toUpperCase();
    return activasAll.filter((r) => {
      const est = String(r.estado || 'PENDIENTE').toUpperCase();
      if (estFiltro === 'ALERTAS') {
        if (!solicitudTieneAlertaFirma_(r)) return false;
      } else if (estFiltro !== 'TODOS' && est !== estFiltro) {
        return false;
      }
      if (!q) return true;
      return `${r.nombre_solicitante || ''} ${r.dni_solicitante || ''} ${r.expediente_id || ''} ${r.plantilla_nombre || ''} ${r.estado || ''}`.toLowerCase().includes(q);
    });
  }

  function exportarBandejaFirmasCsv() {
    const filas = obtenerSolicitudesFiltradasBandeja_();
    if (!filas || filas.length === 0) {
      notify('No hay solicitudes en la vista actual para exportar.', 'warning');
      return;
    }
    const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const headers = [
      'ID', 'Asociado', 'DNI', 'WhatsApp', 'Expediente', 'Documento', 'Estado',
      'Fecha Creacion UTC', 'Fecha Lectura UTC', 'Fecha Firma UTC', 'IP',
      'GPS Lat', 'GPS Lng', 'SHA256', 'eKYC', 'Face Match %', 'Boletin ER',
      'CajaJPER', 'TSA RFC3161', 'PAdES'
    ];
    const rows = filas.map((r) => {
      const ek = r.ekyc_resumen || {};
      const bo = ek.boletin_oficial_er || {};
      const cj = ek.cajajper || {};
      const tsa = r.tsa_resumen || {};
      const pades = r.pades_resumen || {};
      return [
        r.id || '',
        r.nombre_solicitante || '',
        r.dni_solicitante || '',
        r.telefono_whatsapp || '',
        r.expediente_id || '',
        r.plantilla_nombre || '',
        r.estado || 'PENDIENTE',
        r.created_at || '',
        r.leido_en || '',
        r.firmado_en || '',
        r.ip_origen || '',
        r.geo_latitud != null ? r.geo_latitud : '',
        r.geo_longitud != null ? r.geo_longitud : '',
        r.hash_sha256_firmado || r.hash_sha256_original || '',
        ek.estado_ekyc || '',
        ek.face_match_pct != null ? ek.face_match_pct : '',
        bo.consultado ? (bo.tiene_alerta_critica ? `ALERTA (${bo.total_resultados || 0})` : 'OK') : '',
        cj.consultado ? `${cj.cantidad_expedientes || 0} exp.` : '',
        tsa.ok ? 'OK' : '',
        pades.ok ? 'OK' : '',
      ].map(escCsv).join(';');
    });
    const csvContent = '\uFEFF' + [headers.map(escCsv).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bandeja_firmas_ammer_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportadas ${filas.length} solicitud(es) a CSV correctamente.`, 'success');
  }

  function formatearFechaHoraAr(isoStr) {
    if (!isoStr) return '-';
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return String(isoStr);
    try {
      return dt.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' hs';
    } catch (_) {
      return String(isoStr).slice(0, 16).replace('T', ' ');
    }
  }

  function renderBandejaFirmas() {
    const tbody = document.getElementById('tbodyBandejaFirmas');
    const tbodyElim = document.getElementById('tbodyFirmasEliminadas');
    const badgeElim = document.getElementById('badgeTabFirmasEliminadas');
    const chipsCont = document.getElementById('firmaBandejaEstadoChips');

    const activasAll = state.solicitudesFirma.filter((r) => !esSolicitudEnBaja(r));
    const eliminadasAll = state.solicitudesFirma.filter((r) => esSolicitudEnBaja(r));

    if (badgeElim) {
      badgeElim.textContent = String(eliminadasAll.length);
      badgeElim.style.display = eliminadasAll.length > 0 ? 'inline-flex' : 'none';
    }

    if (chipsCont) {
      const counts = {
        TODOS: activasAll.length,
        PENDIENTE: activasAll.filter((r) => String(r.estado || 'PENDIENTE').toUpperCase() === 'PENDIENTE').length,
        LEIDO: activasAll.filter((r) => String(r.estado || '').toUpperCase() === 'LEIDO').length,
        PARCIAL: activasAll.filter((r) => String(r.estado || '').toUpperCase() === 'PARCIAL').length,
        FIRMADO: activasAll.filter((r) => String(r.estado || '').toUpperCase() === 'FIRMADO').length,
        ALERTAS: activasAll.filter((r) => solicitudTieneAlertaFirma_(r)).length,
      };
      const defs = [
        { k: 'TODOS', lbl: 'Todos' },
        { k: 'PENDIENTE', lbl: '⏳ Pendientes' },
        { k: 'LEIDO', lbl: '👁️ Leídos' },
        { k: 'PARCIAL', lbl: '📝 Parciales' },
        { k: 'FIRMADO', lbl: '✅ Firmados' },
        { k: 'ALERTAS', lbl: '⚠️ Con Alertas', warn: true },
      ];
      chipsCont.innerHTML = defs.map((d) => {
        const act = String(state.bandejaEstadoFiltro || 'TODOS').toUpperCase() === d.k;
        return `<button type="button" class="firmas-status-chip ${d.warn ? 'firmas-status-chip--warn' : ''} ${act ? 'active' : ''}" onclick="window.setFiltroEstadoBandejaFirmas('${d.k}')"><span>${escHtml(d.lbl)}</span><span class="firmas-status-chip-count">${counts[d.k]}</span></button>`;
      }).join('');
    }

    const chipBadge = (txt, bg, col, bd) => `<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:9999px;font-size:0.67rem;font-weight:700;background:${bg};color:${col};border:1px solid ${bd || 'transparent'};white-space:nowrap;">${txt}</span>`;

    if (tbody) {
      const filtradas = obtenerSolicitudesFiltradasBandeja_();
      if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay solicitudes que coincidan con el filtro seleccionado.</td></tr>';
      } else {
        tbody.innerHTML = filtradas.map((r) => {
          const est = String(r.estado || 'PENDIENTE').toUpperCase();
          let bg = '#fef3c7', col = '#92400e', bd = '#fde68a';
          if (est === 'FIRMADO') { bg = '#dcfce7'; col = '#166534'; bd = '#86efac'; }
          else if (est === 'PARCIAL') { bg = '#ffedd5'; col = '#9a3412'; bd = '#fed7aa'; }
          else if (est === 'LEIDO') { bg = '#dbeafe'; col = '#1e40af'; bd = '#bfdbfe'; }

          const gpsHtml = (r.geo_latitud != null && r.geo_longitud != null)
            ? `<a href="https://maps.google.com/?q=${r.geo_latitud},${r.geo_longitud}" target="_blank" rel="noopener" style="color:#135596;text-decoration:underline;font-weight:700;font-size:0.72rem;">📍 Ver GPS</a>`
            : '<span style="color:#94a3b8;font-size:0.72rem;">Sin GPS</span>';

          const shaFull = r.hash_sha256_firmado || r.hash_sha256_original || '';
          const shaShort = shaFull.slice(0, 14);
          const tipoDescarga = (est === 'FIRMADO' || est === 'PARCIAL') ? 'firmado' : 'original';
          const labelDescarga = est === 'FIRMADO' ? 'Descargar PDF Firmado' : (est === 'PARCIAL' ? 'Descargar PDF Parcial' : 'Descargar PDF Original');

          const ek = r.ekyc_resumen || null;
          let badgesHtml = '';
          if (r.es_paquete) {
            badgesHtml += chipBadge(`📦 Paquete (${escHtml(r.paquete_cantidad || 2)} docs)`, '#eef2ff', '#3730a3', '#c7d2fe');
          }
          if (r.orden_secuencial) {
            badgesHtml += chipBadge(`🔢 Turno ${escHtml(r.orden_firma || 1)}/${escHtml(r.firmantes_total || 2)}`, '#fff7ed', '#9a3412', '#fed7aa');
          }
          if (r.impacto_expediente && r.impacto_expediente.ok) {
            badgesHtml += chipBadge('📂 En Ficha', '#f0fdf4', '#15803d', '#bbf7d0');
          }
          if (ek && ek.estado_ekyc) {
            const ekCol = ek.estado_ekyc === 'APROBADO' ? '#166534' : '#b45309';
            const ekBg = ek.estado_ekyc === 'APROBADO' ? '#dcfce7' : '#fef3c7';
            const ekBd = ek.estado_ekyc === 'APROBADO' ? '#86efac' : '#fde68a';
            const fmTxt = ek.face_match_pct != null ? ` · Face ${ek.face_match_pct}%` : '';
            badgesHtml += chipBadge(`🪪 eKYC ${escHtml(ek.estado_ekyc)}${escHtml(fmTxt)}`, ekBg, ekCol, ekBd);
            if (ek.pdf417_ok) {
              badgesHtml += chipBadge('📊 PDF417 OK', '#ecfeff', '#0e7490', '#a5f3fc');
            } else if (ek.qr_ok || ek.codigo_dni_ok) {
              badgesHtml += chipBadge('📱 QR DNI OK', '#ecfeff', '#0e7490', '#a5f3fc');
            }
            const ejMan = r.validacion_ejemplar_manual;
            if (ejMan && typeof ejMan.valido === 'boolean') {
              badgesHtml += ejMan.valido
                ? chipBadge('🪪 Ejemplar VÁLIDO', '#dcfce7', '#166534', '#86efac')
                : chipBadge('⛔ Ejemplar INVÁLIDO', '#fee2e2', '#b91c1c', '#fecaca');
            }
            const bo = ek.boletin_oficial_er;
            if (bo && bo.consultado) {
              const boAlert = bo.tiene_alerta_critica;
              badgesHtml += chipBadge(boAlert ? `⚠️ Boletín ER (${escHtml(bo.total_resultados || 0)})` : '📰 Boletín ER OK', boAlert ? '#fee2e2' : '#ecfdf5', boAlert ? '#b91c1c' : '#047857', boAlert ? '#fecaca' : '#a7f3d0');
            }
            const cj = ek.cajajper;
            if (cj && cj.consultado) {
              const cjTram = Number(cj.cantidad_expedientes || 0);
              const cjAlto = cj.nivel_alerta === 'ALTO';
              const cjBg = cjAlto ? '#fee2e2' : (cjTram > 0 ? '#fef3c7' : '#ecfdf5');
              const cjCol = cjAlto ? '#b91c1c' : (cjTram > 0 ? '#92400e' : '#047857');
              const cjBd = cjAlto ? '#fecaca' : (cjTram > 0 ? '#fde68a' : '#a7f3d0');
              badgesHtml += chipBadge(cjTram > 0 ? `🏛️ CajaJPER (${cjTram} exp.)` : '🏛️ CajaJPER OK', cjBg, cjCol, cjBd);
            }
          }
          if (r.pin_otp_verificado) {
            badgesHtml += chipBadge('🔐 PIN 2FA OK', '#f5f3ff', '#5b21b6', '#ddd6fe');
          }
          const tsa = r.tsa_resumen || null;
          if (tsa && tsa.ok) {
            badgesHtml += chipBadge('⏱️ TSA RFC 3161', '#eff6ff', '#1d4ed8', '#bfdbfe');
          }
          const pades = r.pades_resumen || null;
          if (pades && pades.ok) {
            badgesHtml += chipBadge('🔏 PAdES (.p12)', '#eef2ff', '#3730a3', '#c7d2fe');
          }

          const fechaCreadaTxt = (r.created_at || '').slice(0, 16).replace('T', ' ') || '-';
          const fechaFirmadaTxt = r.firmado_en ? r.firmado_en.slice(0, 16).replace('T', ' ') : '';
          const quickRecordarBtn = (est !== 'FIRMADO' && r.telefono_whatsapp)
            ? `<button type="button" class="firmas-btn firmas-btn--sm" onclick="window.notificarWhatsappSolicitud('${escHtml(r.id)}', 'recordatorio')" title="Enviar recordatorio directo por WhatsApp" style="border-color:#86efac;background:#f0fdf4;color:#15803d;">📲 Recordar</button>`
            : '';
          const quickLinkBtn = (est !== 'FIRMADO')
            ? `<button type="button" class="firmas-btn firmas-btn--sm" onclick="window.copiarORenovarEnlaceFila('${escHtml(r.id)}')" title="Copiar enlace activo de firma (o generar uno nuevo si no está en caché)">🔗 Enlace</button>`
            : '';

          return `
            <tr>
              <td data-label="Asociado / Exp." style="padding:0.85rem 0.78rem;font-size:0.83rem;">
                <div style="font-weight:800;color:#0f172a;">${escHtml(r.nombre_solicitante || '-')}</div>
                <div style="font-size:0.72rem;color:#64748b;margin-top:3px;">
                  <span class="font-mono">DNI ${escHtml(r.dni_solicitante || '-')}</span> · Exp: <strong>${escHtml(r.expediente_id || '-')}</strong>
                </div>
              </td>
              <td data-label="Documento" style="padding:0.85rem 0.78rem;font-size:0.81rem;color:#1e293b;max-width:270px;line-height:1.38;font-weight:600;">${escHtml(r.plantilla_nombre || '-')}</td>
              <td data-label="Estado" style="padding:0.85rem 0.78rem;text-align:center;">
                <span style="display:inline-flex;align-items:center;padding:3px 11px;border-radius:9999px;font-size:0.7rem;font-weight:800;background:${bg};color:${col};border:1px solid ${bd};white-space:nowrap;">${escHtml(est)}</span>
              </td>
              <td data-label="Fechas (UTC)" style="padding:0.85rem 0.78rem;font-size:0.73rem;color:#475569;white-space:nowrap;line-height:1.55;">
                <div>Creada: <strong class="font-mono">${escHtml(fechaCreadaTxt)}</strong></div>
                ${fechaFirmadaTxt ? `<div style="color:#166534;font-weight:700;">Firmada: <span class="font-mono">${escHtml(fechaFirmadaTxt)}</span></div>` : ''}
              </td>
              <td data-label="Evidencia y Ubicación" style="padding:0.85rem 0.78rem;font-size:0.72rem;">
                <div class="font-mono" style="color:#334155;" title="${escHtml(shaFull)}">SHA256: ${escHtml(shaShort)}…</div>
                <div style="margin-top:3px;color:#475569;">IP: <span class="font-mono">${escHtml(r.ip_origen || '-')}</span> · ${gpsHtml}</div>
                ${badgesHtml ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${badgesHtml}</div>` : ''}
              </td>
              <td class="firmas-td-actions" style="padding:0.85rem 0.78rem;">
                <div class="firmas-td-actions-inner">
                  ${quickRecordarBtn}
                  ${quickLinkBtn}
                  <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.abrirFichaSolicitudFirma('${escHtml(r.id)}')" title="Ver ficha completa: previsualización del PDF, fotos DNI/Selfie, validaciones, historial y acciones">
                    📋 Ver Ficha
                  </button>
                  <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-navy" onclick="window.descargarPdfSolicitudFirma('${escHtml(r.id)}', '${tipoDescarga}')" title="${escHtml(labelDescarga)}">
                    📥 Descargar PDF
                  </button>
                  <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-icon firmas-btn-danger" onclick="window.abrirModalBajaSolicitudFirma('${escHtml(r.id)}')" title="Cancelar, desestimar o eliminar ficha con código de validación por WhatsApp">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (tbodyElim) {
      const qE = String((document.getElementById('inpFiltroFirmasEliminadas') || {}).value || '').trim().toLowerCase();
      const elimFiltradas = eliminadasAll.filter((r) => {
        if (!qE) return true;
        const br = r.baja_registro || {};
        return `${r.nombre_solicitante || ''} ${r.dni_solicitante || ''} ${r.expediente_id || ''} ${r.plantilla_nombre || ''} ${r.estado || ''} ${br.eliminado_por_nombre || ''} ${br.eliminado_por_usuario || ''} ${br.motivo || ''}`.toLowerCase().includes(qE);
      });
      if (elimFiltradas.length === 0) {
        tbodyElim.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay fichas eliminadas, canceladas o desestimadas.</td></tr>';
      } else {
        tbodyElim.innerHTML = elimFiltradas.map((r) => {
          const est = String(r.estado || 'DESESTIMADO').toUpperCase();
          const br = r.baja_registro || {};
          const nomResp = br.eliminado_por_nombre || '-';
          const usrResp = br.eliminado_por_usuario ? `@${br.eliminado_por_usuario}` : '';
          const fechaBajaTxt = br.fecha_baja ? formatearFechaHoraAr(br.fecha_baja) : (br.fecha_baja_ar || formatearFechaHoraAr(r.created_at));
          const motivoTxt = br.motivo ? `<div style="font-size:0.72rem;color:#475569;margin-top:4px;max-width:220px;white-space:normal;">${escHtml(br.motivo)}</div>` : '';
          const waMask = br.telefono_validacion ? `<div style="font-size:0.7rem;color:#047857;margin-top:3px;font-weight:600;">📲 WA validado: ${escHtml(br.telefono_validacion)}</div>` : '';
          return `
            <tr class="firmas-row-elim" style="background:#fffafa;">
              <td data-label="Asociado / Exp." style="padding:0.82rem 0.78rem;font-size:0.83rem;">
                <div style="font-weight:800;color:#0f172a;">${escHtml(r.nombre_solicitante || '-')}</div>
                <div style="font-size:0.72rem;color:#64748b;margin-top:3px;"><span class="font-mono">DNI ${escHtml(r.dni_solicitante || '-')}</span> · Exp: <strong>${escHtml(r.expediente_id || '-')}</strong></div>
              </td>
              <td data-label="Documento" style="padding:0.82rem 0.78rem;font-size:0.8rem;color:#334155;max-width:240px;line-height:1.38;font-weight:600;">${escHtml(r.plantilla_nombre || '-')}</td>
              <td data-label="Estado / Motivo" style="padding:0.82rem 0.78rem;text-align:center;">
                <span style="display:inline-flex;padding:3px 10px;border-radius:9999px;font-size:0.7rem;font-weight:800;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;white-space:nowrap;">${escHtml(est)}</span>
                ${motivoTxt}
              </td>
              <td data-label="Responsable" style="padding:0.82rem 0.78rem;font-size:0.79rem;color:#0f172a;">
                <div style="font-weight:800;">${escHtml(nomResp)}</div>
                ${usrResp ? `<div style="font-size:0.72rem;color:#475569;font-weight:700;">Usuario: ${escHtml(usrResp)}</div>` : ''}
                ${waMask}
              </td>
              <td data-label="Fecha y Hora" style="padding:0.82rem 0.78rem;font-size:0.76rem;color:#334155;white-space:nowrap;font-weight:700;">
                <span class="font-mono">${escHtml(fechaBajaTxt)}</span>
              </td>
              <td class="firmas-td-actions" style="padding:0.82rem 0.78rem;">
                <div class="firmas-td-actions-inner">
                  <button type="button" class="firmas-btn firmas-btn--sm" onclick="window.abrirFichaSolicitudFirma('${escHtml(r.id)}')">
                    📋 Ver Ficha
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  const fichaModalState = {
    solId: null,
    tab: 'pdf',
    pdfB64: '',
    pdfZoom: 1.0,
    data: null,
  };

  function ensureModalFichaSolicitudShell() {
    let ov = document.getElementById('modalFichaSolicitudFirmaOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'modalFichaSolicitudFirmaOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99997;background:rgba(15,23,42,0.6);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;padding:1rem;';
      ov.addEventListener('click', (ev) => {
        if (ev.target === ov) ov.style.display = 'none';
      });
      document.body.appendChild(ov);
    }
    return ov;
  }

  function ampliarFotoFichaModal(src, titulo) {
    let vis = document.getElementById('modalZoomFotoFichaFirma');
    if (!vis) {
      vis = document.createElement('div');
      vis.id = 'modalZoomFotoFichaFirma';
      vis.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.86);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.25rem;';
      vis.addEventListener('click', () => { vis.style.display = 'none'; });
      document.body.appendChild(vis);
    }
    vis.innerHTML = `
      <div style="color:#ffffff;font-weight:800;font-size:0.95rem;margin-bottom:0.65rem;">${escHtml(titulo || 'Imagen de evidencia')}</div>
      <img src="${src}" alt="${escHtml(titulo || 'Captura')}" style="max-width:92vw;max-height:80vh;border-radius:10px;background:#ffffff;box-shadow:0 20px 45px rgba(0,0,0,0.45);object-fit:contain;"/>
      <div style="color:#cbd5e1;font-size:0.76rem;margin-top:0.65rem;">Hacé clic en cualquier lugar para cerrar</div>
    `;
    vis.style.display = 'flex';
  }

  async function renderizarPdfEnFichaModal() {
    const cont = document.getElementById('fichaModalPdfPagesWrap');
    const lblZoom = document.getElementById('lblFichaModalPdfZoom');
    if (!cont) return;
    if (lblZoom) lblZoom.textContent = `${Math.round((fichaModalState.pdfZoom || 1) * 100)}%`;

    if (!fichaModalState.pdfB64) {
      cont.innerHTML = '<div style="padding:2rem;text-align:center;color:#475569;font-size:0.84rem;">No se encontró PDF disponible para previsualizar en esta solicitud.</div>';
      return;
    }

    cont.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#475569;font-size:0.84rem;">⏳ Renderizando páginas del documento PDF...</div>';
    try {
      const pdfDoc = await cargarDocumentoPdfJs(base64ToUint8Array(fichaModalState.pdfB64));
      cont.innerHTML = '';
      const scale = 1.2 * Math.max(0.5, Math.min(2.4, Number(fichaModalState.pdfZoom || 1.0)));
      const dpr = Math.min(global.devicePixelRatio || 1, 2);

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const vpCss = page.getViewport({ scale });
        const vpRender = page.getViewport({ scale: scale * dpr });

        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin:0 auto 1rem auto;width:fit-content;background:#ffffff;border-radius:8px;box-shadow:0 3px 12px rgba(15,23,42,0.18);overflow:hidden;';

        const tag = document.createElement('div');
        tag.style.cssText = 'background:#f1f5f9;color:#475569;font-size:0.7rem;font-weight:700;padding:3px 10px;border-bottom:1px solid #cbd5e1;';
        tag.textContent = `Página ${i} de ${pdfDoc.numPages}`;
        wrap.appendChild(tag);

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vpRender.width);
        canvas.height = Math.round(vpRender.height);
        canvas.style.width = `${Math.round(vpCss.width)}px`;
        canvas.style.height = `${Math.round(vpCss.height)}px`;
        canvas.style.display = 'block';
        wrap.appendChild(canvas);
        cont.appendChild(wrap);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vpRender }).promise;
      }
    } catch (err) {
      cont.innerHTML = `<div style="padding:1.5rem;text-align:center;color:#b91c1c;font-size:0.84rem;">No se pudo previsualizar el PDF (${escHtml(err.message)}). Podés descargarlo desde el botón superior.</div>`;
    }
  }

  function zoomFichaPdfModal(delta) {
    const cur = Number(fichaModalState.pdfZoom || 1.0);
    fichaModalState.pdfZoom = Math.max(0.5, Math.min(2.2, Number((cur + Number(delta || 0)).toFixed(2))));
    renderizarPdfEnFichaModal();
  }

  function cambiarTabFichaSolicitudModal(tabKey) {
    fichaModalState.tab = tabKey || 'pdf';
    ['pdf', 'ekyc', 'evidencia', 'eventos'].forEach((k) => {
      const btn = document.getElementById('btnFichaModalTab_' + k);
      const pnl = document.getElementById('pnlFichaModalTab_' + k);
      const act = k === fichaModalState.tab;
      if (btn) {
        btn.classList.toggle('firmas-btn-navy', act);
      }
      if (pnl) pnl.style.display = act ? 'block' : 'none';
    });
    if (fichaModalState.tab === 'pdf') {
      const wrap = document.getElementById('fichaModalPdfPagesWrap');
      if (wrap && !wrap.querySelector('canvas')) {
        renderizarPdfEnFichaModal();
      }
    }
  }

  async function abrirFichaSolicitudFirma(solId) {
    const ov = ensureModalFichaSolicitudShell();
    fichaModalState.solId = solId;
    fichaModalState.tab = 'pdf';
    fichaModalState.pdfB64 = '';
    fichaModalState.pdfZoom = 1.0;

    ov.innerHTML = `
      <div class="firmas-ficha-dialog" style="max-width:1080px;">
        <div class="firmas-ficha-header" style="align-items:center;">
          <div style="font-weight:800;font-size:1rem;">📋 Cargando Ficha Completa de Firma y Evidencia...</div>
          <button type="button" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'" style="border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.14);color:#ffffff;border-radius:9px;width:32px;height:32px;font-weight:800;cursor:pointer;">✕</button>
        </div>
        <div style="padding:2.5rem;text-align:center;color:#475569;font-size:0.9rem;">⏳ Recuperando PDF, capturas biométricas, validaciones e historial forense...</div>
      </div>
    `;
    ov.style.display = 'flex';

    const filaLocal = state.solicitudesFirma.find((x) => String(x.id) === String(solId)) || {};
    const estLocal = String(filaLocal.estado || 'PENDIENTE').toUpperCase();
    const tipoPdfPref = (estLocal === 'FIRMADO' || estLocal === 'PARCIAL') ? 'firmado' : 'original';

    let fichaRes = null;
    let pdfRes = null;
    try {
      const [rF, rP] = await Promise.allSettled([
        apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/ficha`, { method: 'GET' }),
        apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/pdf?tipo=${tipoPdfPref}`, { method: 'GET' }),
      ]);
      if (rF.status === 'fulfilled' && rF.value && rF.value.ok) {
        fichaRes = rF.value;
      } else {
        // Fallback si el endpoint /ficha aún está desplegándose: armar desde listado + eventos
        let evsFallback = [];
        try {
          const evR = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/eventos`, { method: 'GET' });
          evsFallback = evR.eventos || [];
        } catch (_e2) {}
        fichaRes = { ok: true, solicitud: filaLocal, ekyc: filaLocal.ekyc_resumen || null, imagenes: {}, eventos: evsFallback };
      }
      if (rP.status === 'fulfilled' && rP.value && rP.value.pdfBase64) {
        pdfRes = rP.value;
      }
    } catch (err) {
      ov.innerHTML = `
        <div style="background:#ffffff;border-radius:16px;max-width:520px;width:94vw;padding:1.5rem;text-align:center;box-shadow:0 20px 50px rgba(15,23,42,0.3);">
          <div style="font-weight:800;color:#b91c1c;margin-bottom:0.5rem;">Error cargando Ficha</div>
          <div style="font-size:0.84rem;color:#475569;margin-bottom:1rem;">${escHtml(err.message)}</div>
          <button type="button" class="firmas-btn" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'">Cerrar</button>
        </div>
      `;
      return;
    }

    const r = fichaRes.solicitud || filaLocal;
    const ek = fichaRes.ekyc || r.ekyc_resumen || {};
    const imgs = fichaRes.imagenes || {};
    const evs = Array.isArray(fichaRes.eventos) ? fichaRes.eventos : [];
    fichaModalState.data = fichaRes;
    fichaModalState.pdfB64 = pdfRes ? pdfRes.pdfBase64 : '';

    const est = String(r.estado || 'PENDIENTE').toUpperCase();
    let bg = '#fef3c7', col = '#92400e';
    if (est === 'FIRMADO') { bg = '#dcfce7'; col = '#166534'; }
    else if (est === 'PARCIAL') { bg = '#ffedd5'; col = '#9a3412'; }
    else if (est === 'LEIDO') { bg = '#dbeafe'; col = '#1e40af'; }
    else if (est === 'ANULADO') { bg = '#fee2e2'; col = '#b91c1c'; }

    const tipoDescarga = (est === 'FIRMADO' || est === 'PARCIAL') ? 'firmado' : 'original';
    const labelDescarga = est === 'FIRMADO' ? 'Descargar PDF Firmado' : (est === 'PARCIAL' ? 'Descargar PDF Parcial' : 'Descargar PDF Original');
    const verifyUrl = `verificar.html?id=${encodeURIComponent(r.id)}&h=${encodeURIComponent((r.hash_sha256_original || '').slice(0, 16))}`;

    const vidMetaTop = (ek && ek.video_prueba_vida) || {};
    const driveCarpetaUrl = r.drive_carpeta_url || vidMetaTop.carpeta_url || '';
    const tieneEvidenciasParaDrive = Boolean(
      (vidMetaTop && vidMetaTop.presente)
      || imgs.dni_frente_b64 || imgs.dni_dorso_b64 || imgs.selfie_b64 || imgs.selfie_video_b64 || imgs.firma_png_b64
      || est === 'FIRMADO'
    );
    const driveBtn = r.drive_file_url
      ? `<a href="${escHtml(r.drive_file_url)}" target="_blank" rel="noopener" class="firmas-btn firmas-btn--sm" style="border-color:#86efac;background:#f0fdf4;color:#15803d;">☁️ Abrir PDF Drive</a>`
      : (est === 'FIRMADO'
        ? `<button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.respaldarSolicitudEnDrive('${escHtml(r.id)}').then(()=>window.abrirFichaSolicitudFirma('${escHtml(r.id)}'))">☁️ Respaldar Drive</button>`
        : '');
    const driveCarpetaBtn = driveCarpetaUrl
      ? `<a href="${escHtml(driveCarpetaUrl)}" target="_blank" rel="noopener" title="Abrir carpeta en Google Drive con fotos, PDF, video y archivos de validación" class="firmas-btn firmas-btn--sm" style="border-color:#15803d;background:#ecfdf5;color:#065f46;font-weight:800;">📁 Carpeta Drive</a>`
      : (tieneEvidenciasParaDrive
        ? `<button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.migrarVideoPruebaVidaDrive('${escHtml(r.id)}').then(()=>window.abrirFichaSolicitudFirma('${escHtml(r.id)}'))" title="Subir / migrar fotos, PDF y video de prueba de vida a su carpeta en Google Drive" style="font-weight:800;">📁 Enviar a Carpeta Drive</button>`
        : '');
    const tsrBtn = r.tiene_tsr
      ? `<button type="button" class="firmas-btn firmas-btn--sm firmas-btn-indigo" onclick="window.descargarTsrSolicitudFirma('${escHtml(r.id)}')">⏱️ Sello Hora (.tsr)</button>`
      : '';
    const recordarWaBtn = (r.telefono_whatsapp && !esSolicitudEnBaja(r) && est !== 'FIRMADO')
      ? `<button type="button" class="firmas-btn firmas-btn--sm" onclick="window.notificarWhatsappSolicitud('${escHtml(r.id)}', 'recordatorio')" style="border-color:#86efac;background:#f0fdf4;color:#15803d;">📲 Recordar WhatsApp</button>`
      : '';
    const renovarBtn = (est !== 'FIRMADO' && !esSolicitudEnBaja(r))
      ? `<button type="button" class="firmas-btn firmas-btn--sm" onclick="window.renovarEnlaceSolicitudFirma('${escHtml(r.id)}')" style="border-color:#fcd34d;background:#fffbeb;color:#b45309;">🔄 Renovar Enlace</button>`
      : '';
    const revocarBtn = !esSolicitudEnBaja(r)
      ? `<button type="button" class="firmas-btn firmas-btn--sm firmas-btn-danger" style="margin-left:auto;font-weight:800;" onclick="window.abrirModalBajaSolicitudFirma('${escHtml(r.id)}')">🗑️ Cancelar / Desestimar / Borrar</button>`
      : '';

    const renGuia = r.datos_renaper_guia || {};
    const dniExPre = (ek && ek.dni_extraido) || {};
    const ejManual = r.validacion_ejemplar_manual || null;
    const renArgs = JSON.stringify({
      solicitudId: r.id,
      nombre: r.nombre_solicitante || '-',
      dni: renGuia.dni || dniExPre.dni || r.dni_solicitante || '',
      sexo: renGuia.sexo || dniExPre.sexo || '',
      fecha_nacimiento: renGuia.fecha_nacimiento || dniExPre.fecha_nacimiento || '',
      ejemplar: renGuia.ejemplar || dniExPre.ejemplar || '',
      fecha_emision: renGuia.fecha_emision || dniExPre.fecha_emision || '',
      nro_tramite: renGuia.nro_tramite || dniExPre.nro_tramite || '',
      validacion_ejemplar_manual: ejManual,
      origen: 'firmas',
    }).replace(/"/g, '&quot;');

    // Fotos y firma
    const fotoCard = (titulo, b64, mimeDef, sinMsg) => {
      if (!b64) {
        return `
          <div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:1rem;text-align:center;">
            <div style="font-size:0.76rem;font-weight:800;color:#334155;margin-bottom:0.35rem;">${escHtml(titulo)}</div>
            <div style="font-size:0.74rem;color:#94a3b8;padding:1.2rem 0;">${escHtml(sinMsg || 'No requerida / No capturada')}</div>
          </div>
        `;
      }
      const src = b64.startsWith('data:') ? b64 : `data:${mimeDef};base64,${b64}`;
      return `
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem;box-shadow:0 2px 6px rgba(15,23,42,0.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <span style="font-size:0.77rem;font-weight:800;color:#0f2744;">${escHtml(titulo)}</span>
            <button type="button" class="firmas-btn firmas-btn--xs" data-ampliar-foto="${escHtml(src)}" data-ampliar-titulo="${escHtml(titulo)}">🔍 Ampliar</button>
          </div>
          <img src="${src}" alt="${escHtml(titulo)}" style="width:100%;height:175px;object-fit:contain;background:#f8fafc;border-radius:9px;border:1px solid #e2e8f0;cursor:pointer;" data-ampliar-foto="${escHtml(src)}" data-ampliar-titulo="${escHtml(titulo)}"/>
        </div>
      `;
    };

    const dniEx = (ek && ek.dni_extraido) || {};
    const bo = (ek && ek.boletin_oficial_er) || {};
    const cj = (ek && ek.cajajper) || {};
    const p417 = (ek && ek.pdf417) || {};
    const qrDni = (ek && ek.qr) || {};
    const codDni = (ek && ek.codigo_dni) || (p417.ok ? p417 : (qrDni.ok ? qrDni : {}));
    const codKpiTxt = codDni.ok
      ? `Válido (${codDni.tipo_codigo || 'CÓDIGO'} · ${codDni.formato || '-'}) · Ejemplar ${codDni.ejemplar || dniEx.ejemplar || '-'}`
      : 'Sin lectura automática (PDF417/QR)';
    const ejManKpi = ejManual
      ? (ejManual.valido
        ? `✅ VÁLIDO (${ejManual.analista_nombre || 'Asesor'})`
        : `⛔ NO VÁLIDO (${ejManual.analista_nombre || 'Asesor'})`)
      : 'Pendiente de comparar';
    const ejManBg = ejManual ? (ejManual.valido ? '#dcfce7' : '#fef2f2') : '#fffbeb';
    const ejManCol = ejManual ? (ejManual.valido ? '#166534' : '#b91c1c') : '#92400e';
    const tsa = r.tsa_resumen || {};
    const pades = r.pades_resumen || {};
    const gpsLink = (r.geo_latitud != null && r.geo_longitud != null)
      ? `<a href="https://maps.google.com/?q=${r.geo_latitud},${r.geo_longitud}" target="_blank" rel="noopener" style="color:#135596;font-weight:700;text-decoration:underline;">📍 ${r.geo_latitud}, ${r.geo_longitud} (Abrir en Google Maps)</a>`
      : 'No informada / Denegada';

    const kpiItem = (lbl, val, bgK, colK) => `
      <div style="background:${bgK || '#f8fafc'};border:1px solid #e2e8f0;border-radius:11px;padding:0.62rem 0.82rem;">
        <div style="font-size:0.66rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">${escHtml(lbl)}</div>
        <div style="font-size:0.86rem;font-weight:800;color:${colK || '#0f172a'};margin-top:3px;word-break:break-word;">${escHtml(val || '-')}</div>
      </div>
    `;

    const evHtml = evs.length === 0
      ? '<div style="padding:1.5rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay eventos registrados aún para esta solicitud.</div>'
      : evs.map((ev) => `
        <div style="border-left:3.5px solid #135596;background:#f8fafc;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:10px;padding:0.7rem 0.95rem;margin-bottom:0.6rem;">
          <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
            <strong style="color:#0f2744;font-size:0.83rem;">${escHtml(ev.evento || '-')}</strong>
            <span class="font-mono" style="font-size:0.72rem;color:#475569;">${escHtml((ev.created_at || '').slice(0, 19).replace('T', ' '))} UTC</span>
          </div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:3px;">IP: <span class="font-mono">${escHtml(ev.ip_origen || '-')}</span> · Navegador: ${escHtml((ev.user_agent || '-').slice(0, 90))}</div>
          ${ev.detalle_json ? `<details style="margin-top:0.35rem;"><summary style="cursor:pointer;font-size:0.72rem;color:#135596;font-weight:700;">Ver detalle técnico</summary><pre class="font-mono" style="margin:0.4rem 0 0;padding:0.55rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;font-size:0.69rem;overflow-x:auto;color:#334155;">${escHtml(JSON.stringify(ev.detalle_json, null, 2))}</pre></details>` : ''}
        </div>
      `).join('');

    const esAdminFirmas = (typeof window.tieneAccesoFirmasAmmer === 'function') ? window.tieneAccesoFirmasAmmer() : false;
    const verifyTechBtn = esAdminFirmas
      ? `<a href="${verifyUrl}&modo=tecnico" target="_blank" rel="noopener" class="firmas-btn firmas-btn--sm firmas-btn-indigo">🛡️ Validación Técnica (Admin)</a>`
      : '';

    const brInfo = r.baja_registro || null;
    const bajaBannerHtml = (esSolicitudEnBaja(r) && brInfo)
      ? `<div style="padding:0.72rem 1.35rem;background:#fef2f2;border-bottom:1px solid #fecaca;color:#991b1b;font-size:0.8rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <div>
            <strong>🗑️ Ficha ${escHtml(brInfo.accion || est)}:</strong>
            Por <strong>${escHtml(brInfo.eliminado_por_nombre || '-')}</strong> (@${escHtml(brInfo.eliminado_por_usuario || '-')})
            · Fecha/hora: <strong>${escHtml(brInfo.fecha_baja ? formatearFechaHoraAr(brInfo.fecha_baja) : (brInfo.fecha_baja_ar || '-'))}</strong>
            ${brInfo.motivo ? ` · Motivo: <em>${escHtml(brInfo.motivo)}</em>` : ''}
          </div>
          ${brInfo.telefono_validacion ? `<span style="font-size:0.73rem;font-weight:700;background:#ffffff;border:1px solid #fecaca;padding:2px 9px;border-radius:9999px;">📲 Validado WA ${escHtml(brInfo.telefono_validacion)}</span>` : ''}
        </div>`
      : '';

    ov.innerHTML = `
      <div class="firmas-ficha-dialog">
        <!-- HEADER -->
        <div class="firmas-ficha-header">
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:1.06rem;font-weight:800;letter-spacing:-0.01em;">📋 Ficha de Firma: ${escHtml(r.nombre_solicitante || '-')}</span>
              <span style="padding:2px 10px;border-radius:9999px;font-size:0.71rem;font-weight:800;background:${bg};color:${col};">${escHtml(est)}</span>
              ${r.es_paquete ? `<span style="padding:2px 9px;border-radius:9999px;font-size:0.71rem;font-weight:700;background:#e0e7ff;color:#1e3a8a;">📦 Paquete (${r.paquete_cantidad} docs)</span>` : ''}
            </div>
            <div style="font-size:0.78rem;color:rgba(226,232,240,0.92);margin-top:4px;">
              <span class="font-mono">DNI ${escHtml(r.dni_solicitante || '-')}</span> · Expediente: <strong>${escHtml(r.expediente_id || '-')}</strong> · Documento: <strong>${escHtml(r.plantilla_nombre || '-')}</strong>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'" style="border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.14);color:#ffffff;border-radius:9px;width:34px;height:34px;font-weight:800;cursor:pointer;font-size:0.95rem;flex-shrink:0;">✕</button>
        </div>

        ${bajaBannerHtml}

        <!-- BARRA DE ACCIONES -->
        <div class="firmas-ficha-actions">
          <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-navy" onclick="window.descargarPdfSolicitudFirma('${escHtml(r.id)}', '${tipoDescarga}')">📥 ${labelDescarga}</button>
          ${tsrBtn}
          ${driveBtn}
          ${driveCarpetaBtn}
          <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.abrirAsistenteRenaperMiEjemplar(${renArgs})">🪪 Validar Ejemplar (RENAPER)</button>
          <a href="${verifyUrl}" target="_blank" rel="noopener" class="firmas-btn firmas-btn--sm">🔍 Validación Pública</a>
          ${verifyTechBtn}
          ${recordarWaBtn}
          ${renovarBtn}
          ${revocarBtn}
        </div>

        <!-- PESTAÑAS INTERNAS DE LA FICHA -->
        <div class="firmas-ficha-tabs">
          <button type="button" id="btnFichaModalTab_pdf" class="firmas-btn firmas-btn--sm firmas-btn-navy" onclick="window.cambiarTabFichaSolicitudModal('pdf')">📑 Previsualización PDF</button>
          <button type="button" id="btnFichaModalTab_ekyc" class="firmas-btn firmas-btn--sm" onclick="window.cambiarTabFichaSolicitudModal('ekyc')">🪪 Identidad, Fotos y Cruces</button>
          <button type="button" id="btnFichaModalTab_evidencia" class="firmas-btn firmas-btn--sm" onclick="window.cambiarTabFichaSolicitudModal('evidencia')">🔐 Evidencia Técnica y Legal</button>
          <button type="button" id="btnFichaModalTab_eventos" class="firmas-btn firmas-btn--sm" onclick="window.cambiarTabFichaSolicitudModal('eventos')">📜 Historial (${evs.length})</button>
        </div>

        <!-- CUERPO SCROLLEABLE -->
        <div class="firmas-ficha-body">
          <!-- TAB 1: PDF PREVIEW -->
          <div id="pnlFichaModalTab_pdf" style="display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.7rem;">
              <div style="font-size:0.8rem;font-weight:700;color:#334155;">
                Visualizando: <strong style="color:#0f2744;">${pdfRes && pdfRes.tipo === 'firmado' ? 'PDF Firmado con Evidencia y Audit Trail' : 'PDF Original de la Solicitud'}</strong>
              </div>
              <div style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:9px;padding:3px 6px;">
                <button type="button" class="firmas-btn firmas-btn--xs" style="width:26px;padding:0;height:25px;" onclick="window.zoomFichaPdfModal(-0.2)">−</button>
                <span id="lblFichaModalPdfZoom" style="font-size:0.75rem;font-weight:800;min-width:44px;text-align:center;">100%</span>
                <button type="button" class="firmas-btn firmas-btn--xs" style="width:26px;padding:0;height:25px;" onclick="window.zoomFichaPdfModal(0.2)">+</button>
              </div>
            </div>
            <div id="fichaModalPdfPagesWrap" style="background:#94a3b8;border:1px solid #cbd5e1;border-radius:12px;padding:0.9rem;overflow:auto;max-height:60vh;"></div>
          </div>

          <!-- TAB 2: IDENTIDAD, FOTOS & CRUCES -->
          <div id="pnlFichaModalTab_ekyc" style="display:none;">
            <div class="firmas-ficha-kpis">
              ${kpiItem('Dictamen eKYC', (ek && ek.estado_ekyc) || 'Sin captura eKYC', (ek && ek.estado_ekyc === 'APROBADO') ? '#f0fdf4' : ((ek && ek.estado_ekyc === 'REVISION_REQUERIDA') ? '#fef2f2' : '#fffbeb'), (ek && ek.estado_ekyc === 'APROBADO') ? '#166534' : ((ek && ek.estado_ekyc === 'REVISION_REQUERIDA') ? '#b91c1c' : '#92400e'))}
              ${kpiItem('Cotejo Facial (Selfie vs DNI)', ek && ek.face_match_pct != null ? `${ek.face_match_pct}% coincidencia${ek.motor_biometria === 'biometria_local_offline' ? ' · Motor Local' : (ek.motor_biometria === 'gemini_vision' ? ' · Gemini IA' : '')}` : 'No ejecutado', '#eff6ff', '#135596')}
              ${(() => {
                const cf = (ek && ek.cotejo_firma) || r.cotejo_firma || {};
                const cfPct = cf && cf.firma_match_pct;
                const cfMotor = cf.motor_usado === 'hibrido_gemini_y_local' ? 'IA + Local' : (cf.motor_usado === 'gemini_vision' ? 'Gemini IA' : 'Motor Local');
                const cfTxt = cfPct != null ? `${cfPct}% coincidencia · ${cfMotor}` : (cf && cf.observaciones ? 'Revisión visual' : 'No ejecutado');
                const cfBg = cfPct == null ? '#f8fafc' : (cfPct >= 62 ? '#f0fdf4' : (cfPct >= 48 ? '#fffbeb' : '#fef2f2'));
                const cfCol = cfPct == null ? '#475569' : (cfPct >= 62 ? '#166534' : (cfPct >= 48 ? '#92400e' : '#b91c1c'));
                return kpiItem('Cotejo Firma (DNI vs Trazo)', cfTxt, cfBg, cfCol);
              })()}
              ${kpiItem('Prueba de Vida (Liveness)', ek && ek.liveness_ok === true ? 'Aprobada' : (ek && ek.liveness_ok === false ? 'Observada' : 'No ejecutada'))}
              ${(() => {
                const vv = (ek && ek.voz_validacion) || null;
                const reqVoz = Boolean((r.validaciones_requeridas_json || {}).selfie_voz_consentimiento || vv);
                if (!reqVoz) return '';
                if (!vv) return kpiItem('Voz + Frase Dinámica', 'Solicitada (pendiente)', '#fffbeb', '#92400e');
                const pctV = vv.coincidencia_frase_pct;
                const okV = vv.audio_presente !== false && !vv.posible_coaccion_o_spoofing && vv.lipsync_coherente !== false && vv.codigo_dicho_ok !== false && (pctV == null || pctV >= 60);
                const txtV = vv.audio_presente === false
                  ? 'Sin audio (revisión)'
                  : (pctV != null ? `${pctV}% frase · ${vv.codigo_dicho_ok === false ? 'Cód. obs.' : 'Cód. OK'}` : 'Resguardada');
                return kpiItem('Voz + Frase Dinámica', txtV, okV ? '#f0fdf4' : '#fef2f2', okV ? '#166534' : '#b91c1c');
              })()}
              ${kpiItem('Código DNI (PDF417 / QR)', codKpiTxt)}
              ${kpiItem('Validación RENAPER (Asesor)', ejManKpi, ejManBg, ejManCol)}
              ${kpiItem('Boletín Oficial Entre Ríos', bo.consultado ? (bo.tiene_alerta_critica ? `⚠️ ${bo.total_resultados || 0} alerta(s)` : `Limpio (${bo.total_resultados || 0} menc.)`) : 'No consultado', bo.tiene_alerta_critica ? '#fef2f2' : '#f0fdf4', bo.tiene_alerta_critica ? '#b91c1c' : '#166534')}
              ${kpiItem('CajaJPER Entre Ríos', cj.consultado ? `${cj.cantidad_expedientes || 0} expediente(s)` : 'No consultado')}
            </div>

            ${(() => {
              const valsR = r.validaciones_requeridas_json || {};
              if (valsR.requiere_pdf !== false && valsR.firma_olografa !== false) return '';
              return `
                <div style="margin-bottom:0.85rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:11px;padding:0.6rem 0.9rem;font-size:0.77rem;color:#1e3a8a;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                  <strong>🎛️ Trámite modular:</strong>
                  ${valsR.requiere_pdf === false ? '<span style="background:#ffffff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;font-weight:700;">📄 Constancia generada sin PDF previo</span>' : ''}
                  ${valsR.firma_olografa === false ? '<span style="background:#ffffff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;font-weight:700;">🪪 Validación sin firma ológrafa requerida</span>' : ''}
                  ${valsR.declaracion_uif === false ? '<span style="background:#ffffff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:999px;font-weight:700;">Sin DDJJ UIF</span>' : ''}
                </div>
              `;
            })()}

            ${(() => {
              const vv = (ek && ek.voz_validacion) || null;
              if (!vv) return '';
              const pctV = vv.coincidencia_frase_pct;
              const lsTxt = vv.lipsync_coherente === true ? '✅ Coherente' : (vv.lipsync_coherente === false ? '⛔ Desincronizado' : '—');
              const codTxtV = vv.codigo_dicho_ok === true ? '✅ Verificado' : (vv.codigo_dicho_ok === false ? '⛔ No coincide' : '—');
              const spoTxt = vv.posible_coaccion_o_spoofing ? '⛔ Alerta coacción / playback' : '✅ Sin señales';
              return `
                <div class="firmas-section-box" style="margin-bottom:1rem;background:#f0fdf4;border-color:#86efac;">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.45rem;">
                    <strong style="font-size:0.83rem;color:#065f46;">🎙️ Validación Extra por Voz + Sincronización Labial (Lip-Sync)</strong>
                    ${pctV != null ? `<span style="font-size:0.72rem;font-weight:800;padding:2px 9px;border-radius:999px;background:#ffffff;border:1px solid #86efac;color:${pctV >= 65 ? '#166534' : '#b91c1c'};">Coincidencia: ${pctV}%</span>` : ''}
                  </div>
                  <div style="font-size:0.77rem;color:#1e293b;display:flex;flex-direction:column;gap:0.35rem;">
                    ${vv.frase_esperada ? `<div><strong>Frase esperada:</strong> <em>"${escHtml(vv.frase_esperada)}"</em></div>` : ''}
                    <div><strong>Transcripción detectada:</strong> ${vv.transcripcion ? `"${escHtml(vv.transcripcion)}"` : '<span style="color:#64748b;">(No transcripta / sin audio)</span>'}</div>
                    <div style="display:flex;gap:0.8rem;flex-wrap:wrap;font-size:0.75rem;margin-top:2px;">
                      <span><strong>Código DNI:</strong> ${codTxtV}</span>
                      <span><strong>Lip-Sync:</strong> ${lsTxt}</span>
                      <span><strong>Integridad audio:</strong> ${spoTxt}</span>
                    </div>
                    ${vv.observaciones ? `<div style="font-size:0.74rem;color:#475569;"><strong>Obs.:</strong> ${escHtml(vv.observaciones)}</div>` : ''}
                  </div>
                </div>
              `;
            })()}

            ${(() => {
              const cf = (ek && ek.cotejo_firma) || r.cotejo_firma || {};
              const hayObs = Boolean((ek && ek.observaciones_biometria) || cf.observaciones || (ek && Array.isArray(ek.alertas) && ek.alertas.length));
              if (!hayObs) return '';
              return `
                <div class="firmas-section-box" style="margin-bottom:1rem;font-size:0.78rem;color:#334155;">
                  ${(ek && ek.observaciones_biometria) ? `<div><strong>Detalle biométrico facial:</strong> ${escHtml(ek.observaciones_biometria)}</div>` : ''}
                  ${cf.observaciones ? `<div style="margin-top:4px;"><strong>Análisis biométrico de firma:</strong> ${escHtml(cf.observaciones)}</div>` : ''}
                  ${(ek && Array.isArray(ek.alertas) && ek.alertas.length) ? `<div style="margin-top:4px;color:#b45309;"><strong>Alertas eKYC:</strong> ${ek.alertas.map(a => escHtml(a)).join(' · ')}</div>` : ''}
                </div>
              `;
            })()}

            ${ejManual ? `
              <div style="background:${ejManBg};border:1px solid ${ejManual.valido ? '#86efac' : '#fecaca'};border-radius:12px;padding:0.75rem 0.95rem;margin-bottom:1rem;font-size:0.79rem;color:${ejManCol};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <div>
                  <strong>${ejManual.valido ? '✅ Ejemplar validado manualmente contra RENAPER' : '⛔ Ejemplar marcado NO VÁLIDO contra RENAPER'}</strong><br/>
                  <span>DNI: Ejemplar <strong>${escHtml(ejManual.ejemplar_dni || dniEx.ejemplar || '-')}</strong> · Emisión <strong>${escHtml(ejManual.fecha_emision_dni || dniEx.fecha_emision || '-')}</strong></span>
                  ${(ejManual.ejemplar_renaper || ejManual.fecha_emision_renaper) ? ` · <span>RENAPER: Ejemplar <strong>${escHtml(ejManual.ejemplar_renaper || '-')}</strong> · Emisión <strong>${escHtml(ejManual.fecha_emision_renaper || '-')}</strong></span>` : ''}
                  ${ejManual.observaciones ? `<div style="margin-top:2px;">Obs.: <em>${escHtml(ejManual.observaciones)}</em></div>` : ''}
                </div>
                <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.abrirAsistenteRenaperMiEjemplar(${renArgs})">✏️ Editar comparación</button>
              </div>
            ` : ''}

            ${(dniEx.dni || dniEx.nombre || dniEx.fecha_nacimiento || dniEx.ejemplar || dniEx.fecha_emision) ? `
              <div class="firmas-section-box" style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.65rem;">
                  <strong style="font-size:0.83rem;color:#0f2744;">🪪 Datos completos extraídos del DNI</strong>
                  ${dniEx.formato_dni ? `<span style="font-size:0.69rem;font-weight:800;padding:2px 9px;border-radius:9999px;background:#e0f2fe;color:#0369a1;">${escHtml(dniEx.formato_dni)}</span>` : ''}
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.6rem;font-size:0.78rem;color:#334155;">
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Apellido y Nombre</span><div style="font-weight:800;color:#0f172a;">${escHtml(dniEx.nombre || '-')}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">DNI / CUIL</span><div class="font-mono" style="font-weight:800;color:#0f172a;">${escHtml(dniEx.dni || '-')}${dniEx.cuil ? ` · ${escHtml(dniEx.cuil)}` : ''}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Ejemplar / Sexo</span><div style="font-weight:800;color:#0f172a;">Ejemplar ${escHtml(dniEx.ejemplar || '-')} · ${escHtml(dniEx.sexo || '-')}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Fecha de Emisión</span><div class="font-mono" style="font-weight:800;color:#135596;">${escHtml(dniEx.fecha_emision || 'No detectada')}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Fecha de Vencimiento</span><div class="font-mono" style="font-weight:800;color:#0f172a;">${escHtml(dniEx.fecha_vencimiento || '-')}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Fecha de Nacimiento</span><div class="font-mono" style="font-weight:800;color:#0f172a;">${escHtml(dniEx.fecha_nacimiento || '-')}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Trámite N° / Of. Ident.</span><div style="font-weight:700;color:#0f172a;">${escHtml(dniEx.nro_tramite || '-')}${dniEx.oficina_identificadora ? ` · Of. ${escHtml(dniEx.oficina_identificadora)}` : ''}${dniEx.nro_serie ? ` · Serie ${escHtml(dniEx.nro_serie)}` : ''}</div></div>
                  <div><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Lugar de Nacimiento / Nac.</span><div style="font-weight:700;color:#0f172a;">${escHtml(dniEx.lugar_nacimiento || '-')}${dniEx.nacionalidad ? ` (${escHtml(dniEx.nacionalidad)})` : ''}</div></div>
                  <div style="grid-column:1/-1;"><span style="color:#64748b;font-size:0.68rem;font-weight:700;text-transform:uppercase;">Domicilio en DNI</span><div style="font-weight:700;color:#0f172a;">${escHtml(dniEx.domicilio || 'No detectado')}${dniEx.progenitores ? ` · Hijo/a de: ${escHtml(dniEx.progenitores)}` : ''}</div></div>
                </div>
              </div>
            ` : ''}

            <div style="font-size:0.83rem;font-weight:800;color:#0f2744;margin-bottom:0.6rem;">Capturas Documentales, 3 Momentos Biométricos y Cotejo de Firma (clic para ampliar)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:0.8rem;">
              ${fotoCard('🪪 DNI Frente', imgs.dni_frente_b64, 'image/jpeg', 'Sin foto DNI frente')}
              ${fotoCard('🪪 DNI Dorso', imgs.dni_dorso_b64, 'image/jpeg', 'Sin foto DNI dorso')}
              ${fotoCard('🤳 Selfie 1 · Mirada Frontal', imgs.selfie_b64, 'image/jpeg', 'Sin captura de selfie')}
              ${(imgs.selfie_2_b64 || imgs.selfie_desafio_b64) ? fotoCard('🤳 Selfie 2 · Sonrisa', imgs.selfie_2_b64 || imgs.selfie_desafio_b64, 'image/jpeg', '') : ''}
              ${imgs.selfie_3_b64 ? fotoCard('🤳 Selfie 3 · Giro de Cabeza', imgs.selfie_3_b64, 'image/jpeg', '') : ''}
              ${(() => {
                const cf = (ek && ek.cotejo_firma) || r.cotejo_firma || {};
                return cf.recorte_firma_dni_b64 ? fotoCard('✒️ Firma Aislada del DNI', cf.recorte_firma_dni_b64, 'image/png', '') : '';
              })()}
              ${fotoCard('✍️ Firma Ológrafa Capturada', imgs.firma_png_b64, 'image/png', 'Aún sin firma manuscrita')}
            </div>

            ${(() => {
              const vidB64 = imgs.selfie_video_b64 || '';
              const vidMime = imgs.selfie_video_mime || 'video/webm';
              const vidMeta = (ek && ek.video_prueba_vida) || {};
              const ext = vidMime.includes('mp4') ? 'mp4' : 'webm';
              const kbTxt = vidMeta.tamano_bytes ? `${Math.round(vidMeta.tamano_bytes / 1024)} KB` : '';
              const migradoDrive = vidMeta.estado_migracion_drive === 'MIGRADO_A_DRIVE' && Boolean(vidMeta.drive_url || vidMeta.drive_preview_url);
              const destTxt = vidMeta.destino_drive === 'expediente' ? 'Carpeta del Expediente' : 'FICHAS DE IDENTIDAD (Drive)';

              if (!vidB64 && !migradoDrive) {
                return `
                  <div style="margin-top:1rem;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:0.85rem 1rem;">
                    <div style="font-size:0.82rem;font-weight:800;color:#334155;margin-bottom:0.2rem;">🎥 Prueba de Vida (Video en vivo)</div>
                    <div style="font-size:0.76rem;color:#64748b;">Sin video grabado adjunto (captura previa o dispositivo sin MediaRecorder).</div>
                  </div>
                `;
              }

              const badgeEstado = migradoDrive
                ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;background:#dcfce7;color:#166534;font-size:0.69rem;font-weight:800;">☁️ Migrado a Drive (${escHtml(destTxt)}) · Copia Supabase liberada</span>`
                : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:0.69rem;font-weight:800;">🗄️ En Supabase (pendiente migrar a Drive)</span>`;

              const vidSrc = vidB64 ? (vidB64.startsWith('data:') ? vidB64 : `data:${vidMime};base64,${vidB64}`) : '';
              const dlName = `prueba_vida_${(r.dni_solicitante || 'firmante').replace(/\W+/g, '')}.${ext}`;
              return `
                <div style="margin-top:1rem;background:#f8fafc;border:1px solid ${migradoDrive ? '#86efac' : '#cbd5e1'};border-radius:13px;padding:0.95rem 1.1rem;">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <strong style="font-size:0.85rem;color:#0f2744;">🎥 Prueba de Vida (Video completo de validación facial)</strong>
                        ${badgeEstado}
                      </div>
                      <div style="font-size:0.72rem;color:#475569;margin-top:3px;">
                        ${escHtml(vidMime.toUpperCase())}${kbTxt ? ` · ${escHtml(kbTxt)}` : ''}${vidMeta.sha256 ? ` · SHA-256: <span class="font-mono">${escHtml(String(vidMeta.sha256).slice(0, 18))}…</span>` : ''}
                      </div>
                    </div>
                    <div style="display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">
                      ${vidMeta.drive_url ? `<a href="${escHtml(vidMeta.drive_url)}" target="_blank" rel="noopener" class="firmas-btn firmas-btn--xs" style="border-color:#86efac;background:#f0fdf4;color:#15803d;">▶️ Ver video en Drive</a>` : ''}
                      ${vidMeta.carpeta_url ? `<a href="${escHtml(vidMeta.carpeta_url)}" target="_blank" rel="noopener" class="firmas-btn firmas-btn--xs" style="border-color:#15803d;background:#ecfdf5;color:#065f46;">📁 Carpeta Drive</a>` : ''}
                      ${vidSrc ? `<a href="${escHtml(vidSrc)}" download="${escHtml(dlName)}" class="firmas-btn firmas-btn--xs firmas-btn-navy">⬇️ Descargar video</a>` : ''}
                      ${!migradoDrive ? `<button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.migrarVideoPruebaVidaDrive('${escHtml(r.id)}').then(()=>window.abrirFichaSolicitudFirma('${escHtml(r.id)}'))">📤 Migrar a Drive ahora</button>` : ''}
                    </div>
                  </div>
                  ${vidSrc
                    ? `<video controls playsinline preload="metadata" src="${escHtml(vidSrc)}" style="width:100%;max-width:420px;max-height:280px;border-radius:11px;background:#0f172a;display:block;border:2px solid #cbd5e1;"></video>`
                    : `<iframe src="${escHtml(vidMeta.drive_preview_url || vidMeta.drive_url)}" allow="autoplay" style="width:100%;max-width:480px;height:280px;border-radius:11px;border:2px solid #86efac;background:#0f172a;display:block;"></iframe>`}
                </div>
              `;
            })()}
          </div>

          <!-- TAB 3: EVIDENCIA TÉCNICA Y LEGAL -->
          <div id="pnlFichaModalTab_evidencia" style="display:none;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:0.65rem;">
              ${kpiItem('Fecha Creación (UTC)', (r.created_at || '').slice(0, 19).replace('T', ' ') || '-')}
              ${kpiItem('Primera Lectura (UTC)', (r.leido_en || '').slice(0, 19).replace('T', ' ') || '-')}
              ${kpiItem('Fecha Firma (UTC)', (r.firmado_en || '').slice(0, 19).replace('T', ' ') || 'Pendiente')}
              ${kpiItem('IP Pública del Firmante', r.ip_origen || '-')}
              ${kpiItem('PIN / OTP WhatsApp (2FA)', r.pin_otp_verificado ? 'Verificado correctamente' : (r.pin_otp_requerido ? 'Pendiente de validar' : 'No requerido'))}
              ${kpiItem('Puntos de Trazo Firma', r.puntos_trazo != null ? `${r.puntos_trazo} puntos` : '-')}
              ${kpiItem('Impacto en Padrón / Ficha', (r.impacto_expediente && r.impacto_expediente.ok) ? `Impactado (${r.impacto_expediente.tipo_validacion || 'OK'})` : 'Pendiente / Sin expediente')}
              ${kpiItem('Sello Temporal TSA RFC 3161', tsa.ok ? `${tsa.authority || 'TSA'} (${tsa.timestamp_utc || 'OK'})` : 'No emitido')}
              ${kpiItem('Certificado Criptográfico PAdES (.p12)', pades.ok ? `${pades.subject_cn || 'AMMER'} (Emisor: ${pades.issuer_cn || '-'})` : 'No aplicado')}
            </div>
            <div class="firmas-section-box" style="margin-top:0.9rem;font-size:0.78rem;color:#334155;display:flex;flex-direction:column;gap:0.45rem;">
              <div><strong>Geolocalización GPS:</strong> ${gpsLink}</div>
              <div class="font-mono" style="word-break:break-all;"><strong>SHA-256 Original:</strong> ${escHtml(r.hash_sha256_original || '-')}</div>
              <div class="font-mono" style="word-break:break-all;"><strong>SHA-256 Final Firmado:</strong> ${escHtml(r.hash_sha256_firmado || '-')}</div>
              <div style="word-break:break-word;"><strong>Dispositivo / User-Agent:</strong> ${escHtml(r.user_agent || '-')}</div>
            </div>
          </div>

          <!-- TAB 4: HISTORIAL -->
          <div id="pnlFichaModalTab_eventos" style="display:none;">
            ${evHtml}
          </div>
        </div>
      </div>
    `;

    ov.querySelectorAll('[data-ampliar-foto]').forEach((el) => {
      el.addEventListener('click', () => {
        ampliarFotoFichaModal(el.getAttribute('data-ampliar-foto'), el.getAttribute('data-ampliar-titulo'));
      });
    });

    await renderizarPdfEnFichaModal();
  }

  async function descargarPdfSolicitudFirma(solId, tipo) {
    try {
      notify('Descargando documento PDF...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/pdf?tipo=${encodeURIComponent(tipo || 'firmado')}`, { method: 'GET' });
      const slug = String(res.plantilla_nombre || 'AMMER').replace(/[^a-zA-Z0-9_-]+/g, '_');
      descargarBase64Pdf(res.pdfBase64, `${slug}_${res.tipo || 'doc'}.pdf`);
    } catch (err) {
      notify('Error descargando PDF: ' + err.message, 'error');
    }
  }

  async function descargarTsrSolicitudFirma(solId) {
    try {
      notify('Descargando sello temporal RFC 3161 (.tsr)...', 'info');
      const headers = obtenerAuthHeaders();
      const resp = await fetch(`${getApiBase()}/api/firmas/solicitudes/${encodeURIComponent(solId)}/tsa.tsr`, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AMMER_TSA_${solId.slice(0, 8)}.tsr`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      notify('Error descargando .tsr: ' + err.message, 'error');
    }
  }

  async function respaldarSolicitudEnDrive(solId) {
    try {
      notify('Subiendo PDF, capturas y evidencias a Google Drive...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/respaldar-drive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      notify('Evidencias y PDF respaldados correctamente en Google Drive.', 'success');
      if (res && (res.drive_file_url || res.drive_carpeta_url)) {
        const target = state.solicitudesFirma.find((x) => String(x.id) === String(solId));
        if (target) {
          if (res.drive_file_url) target.drive_file_url = res.drive_file_url;
          if (res.drive_carpeta_url) target.drive_carpeta_url = res.drive_carpeta_url;
        }
        renderBandejaFirmas();
      } else {
        await cargarBandejaFirmas();
      }
      return res;
    } catch (err) {
      notify('No se pudo respaldar en Drive: ' + err.message, 'error');
    }
  }

  async function migrarVideoPruebaVidaDrive(solId) {
    try {
      notify('Migrando fotos, video de prueba de vida y evidencias a Google Drive...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/migrar-video-drive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      notify('Evidencias y video migrados correctamente a Google Drive.', 'success');
      const target = state.solicitudesFirma.find((x) => String(x.id) === String(solId));
      if (target && res) {
        if (res.drive_file_url) target.drive_file_url = res.drive_file_url;
        if (res.drive_carpeta_url) target.drive_carpeta_url = res.drive_carpeta_url;
      }
      renderBandejaFirmas();
      return res;
    } catch (err) {
      notify('No se pudo migrar a Drive: ' + err.message, 'error');
    }
  }

  // ==================== EDITOR VISUAL DE PLANTILLAS PDF ====================
  async function capturarSnapshotsPaginasPdfJs(pdfDoc, maxPaginas) {
    const out = [];
    if (!pdfDoc) return out;
    const total = Math.min(maxPaginas || 4, pdfDoc.numPages || 1);
    for (let i = 1; i <= total; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({ scale: 1.05 });
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = vp.width;
        tmpCanvas.height = vp.height;
        await page.render({ canvasContext: tmpCanvas.getContext('2d'), viewport: vp }).promise;
        const dataUrl = tmpCanvas.toDataURL('image/jpeg', 0.72);
        out.push({ pagina: i, imageBase64: dataUrl });
      } catch (_e) {
        // Ignorar página si falla snapshot y continuar con análisis geométrico
      }
    }
    return out;
  }

  async function ejecutarAnalisisPdfServidor(b64, esManual) {
    const btnIa = document.getElementById('btnAnalizarPdfIaEditor');
    if (btnIa) {
      btnIa.disabled = true;
      btnIa.textContent = '⏳ Analizando PDF...';
    }
    try {
      const imgs = await capturarSnapshotsPaginasPdfJs(state.editor.pdfDoc, 4);
      const analisis = await apiFetchJson('/api/firmas/plantillas/analizar-pdf', {
        method: 'POST',
        body: JSON.stringify({
          pdfBase64: b64,
          usarIa: true,
          paginasImagenesBase64: imgs,
        }),
      });
      const detectados = Array.isArray(analisis.campos_detectados) ? analisis.campos_detectados : [];
      state.editor.totalPages = analisis.paginas || state.editor.totalPages || 1;
      return { analisis, detectados };
    } finally {
      if (btnIa) {
        btnIa.disabled = false;
        btnIa.textContent = '✨ Auto-detectar IA';
      }
    }
  }

  function actualizarBotonDeshacerEditor_() {
    const btn = document.getElementById('btnEditorDeshacer');
    if (!btn) return;
    const n = Array.isArray(state.editor.history) ? state.editor.history.length : 0;
    btn.disabled = n === 0;
    btn.title = n > 0
      ? `Deshacer último cambio (${n} paso(s) guardado(s), Ctrl+Z)`
      : 'Deshacer último cambio o movimiento (Ctrl+Z)';
  }

  function pushUndoEditor_() {
    if (!Array.isArray(state.editor.history)) state.editor.history = [];
    const snap = {
      campos: JSON.parse(JSON.stringify(state.editor.campos || [])),
      selectedFieldId: state.editor.selectedFieldId || null,
    };
    state.editor.history.push(snap);
    if (state.editor.history.length > 35) state.editor.history.shift();
    actualizarBotonDeshacerEditor_();
  }

  function deshacerCambioEditor() {
    if (!Array.isArray(state.editor.history) || state.editor.history.length === 0) {
      notify('No hay cambios previos para deshacer.', 'info');
      actualizarBotonDeshacerEditor_();
      return;
    }
    const snap = state.editor.history.pop();
    state.editor.campos = Array.isArray(snap.campos) ? snap.campos : [];
    state.editor.selectedFieldId = snap.selectedFieldId || (state.editor.campos[0] ? state.editor.campos[0].id : null);
    actualizarBotonDeshacerEditor_();
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
    notify('Último cambio deshecho.', 'info');
  }

  function snapCoord_(val) {
    if (!state.editor.grillaSnap) return Number(Number(val).toFixed(4));
    const step = 0.005;
    return Number((Math.round(Number(val) / step) * step).toFixed(4));
  }

  function toggleGrillaSnapEditor(checked) {
    state.editor.grillaSnap = !!checked;
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) {
      overlay.classList.toggle('firmas-editor-grid-bg', state.editor.grillaSnap);
    }
  }

  async function reanalizarPdfConIaEditor() {
    if (!state.editor.pdfBase64) {
      notify('Primero subí o seleccioná una plantilla PDF para analizar.', 'warning');
      return;
    }
    let reemplazar = true;
    if (state.editor.campos.length > 0) {
      reemplazar = global.confirm(
        `Ya tenés ${state.editor.campos.length} campo(s) marcado(s).\n\n` +
        'Aceptar = Reemplazar con los detectados automáticamente.\n' +
        'Cancelar = Mantener los actuales y agregar solo los nuevos sin solapar.'
      );
    }
    setEstadoEditorPdf('⏳ Analizando estructura y campos del PDF con reglas + IA...', 'info');
    try {
      const { analisis, detectados } = await ejecutarAnalisisPdfServidor(state.editor.pdfBase64, true);
      pushUndoEditor_();
      if (reemplazar) {
        state.editor.campos = detectados;
      } else {
        const existentes = state.editor.campos.slice();
        detectados.forEach((n) => {
          const cx = (n.x_pct || 0) + (n.w_pct || 0) * 0.5;
          const cy = (n.y_pct || 0) + (n.h_pct || 0) * 0.5;
          const dup = existentes.some((ex) =>
            Number(ex.pagina || 1) === Number(n.pagina || 1) &&
            Math.abs(((ex.x_pct || 0) + (ex.w_pct || 0) * 0.5) - cx) < 0.045 &&
            Math.abs(((ex.y_pct || 0) + (ex.h_pct || 0) * 0.5) - cy) < 0.035
          );
          if (!dup) {
            n.id = 'cmp_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1000);
            existentes.push(n);
          }
        });
        state.editor.campos = existentes;
      }
      state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;
      renderCajasOverlayEditor();
      renderInspectorCamposEditor();

      const viaIa = analisis.ia_usada ? ' (incluye análisis visual IA)' : ' (reglas geométricas PDF)';
      if (detectados.length > 0) {
        setEstadoEditorPdf(`✅ Se detectaron ${detectados.length} campos automáticamente${viaIa}. Arrastralos, editalos o quitalos libremente.`, 'ok');
        notify(`Auto-detección completada: ${detectados.length} campo(s).`, 'success');
      } else {
        setEstadoEditorPdf('ℹ️ No se encontraron campos vacíos ni líneas de firma automáticas. Usá los botones superiores para marcarlos manualmente.', 'warn');
      }
    } catch (err) {
      setEstadoEditorPdf(`⚠️ No se pudo ejecutar el análisis automático (${err.message}). Podés marcar los campos manualmente.`, 'warn');
      notify('Error analizando PDF: ' + err.message, 'error');
    }
  }

  async function onArchivoPdfPlantillaSeleccionado(ev) {
    const file = ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      notify('El archivo debe ser un PDF válido.', 'warning');
      return;
    }

    setEstadoEditorPdf(`⏳ Cargando vista previa local de "${file.name}"...`, 'info');
    let b64 = '';
    try {
      b64 = await fileToBase64(file);
      state.editor.plantillaId = null;
      state.editor.pdfBase64 = b64;
      state.editor._loadedB64 = '';
      state.editor.pdfDoc = null;
      state.editor.archivoNombre = file.name;
      state.editor.currentPage = 1;
      state.editor.campos = [];
      state.editor.history = [];
      state.editor.selectedFieldId = null;
      actualizarBotonDeshacerEditor_();

      const inpNom = document.getElementById('inpEditPlantillaNombre');
      if (inpNom && !inpNom.value.trim()) {
        inpNom.value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
      }

      // 1. Renderizar primero el PDF localmente en canvas para que SIEMPRE sea visible al instante
      await cargarPdfEnCanvasEditor(b64, 1);
      renderInspectorCamposEditor();
      setEstadoEditorPdf(`📄 PDF renderizado (${state.editor.totalPages} pág.). Analizando campos, espacios en blanco y firmas...`, 'info');
    } catch (errRender) {
      setEstadoEditorPdf(`⚠️ No se pudo renderizar vista previa en canvas (${errRender.message}).`, 'err');
      notify('Error renderizando PDF local: ' + errRender.message, 'error');
      return;
    }

    // 2. Detectar resaltados, AcroForm, reglas geométricas e IA en segundo plano sin bloquear el lienzo
    try {
      const { analisis, detectados } = await ejecutarAnalisisPdfServidor(b64, false);
      state.editor.campos = detectados;
      state.editor.selectedFieldId = detectados[0] ? detectados[0].id : null;
      renderCajasOverlayEditor();
      renderInspectorCamposEditor();

      const modoTxt = analisis.ia_usada
        ? ' mediante análisis IA + reglas'
        : (analisis.metodo_analisis === 'highlights' ? ' desde resaltados amarillos' : ' por análisis automático de espacios y firmas');
      if (detectados.length > 0) {
        setEstadoEditorPdf(`✅ Se detectaron ${detectados.length} campos${modoTxt}. Podés arrastrarlos, redimensionarlos, editarlos o quitarlos libremente.`, 'ok');
        notify(`PDF listo: ${detectados.length} campo(s) detectado(s).`, 'success');
      } else {
        setEstadoEditorPdf('ℹ️ No se detectaron espacios automáticamente en este PDF. Usá "➕ Marcar Campo Texto", "✍️ Marcar Caja Firma" o "✨ Auto-detectar IA".', 'warn');
        notify('PDF cargado. Hacé clic en los botones superiores para marcar campos y firmas.', 'info');
      }
    } catch (errAn) {
      setEstadoEditorPdf(`⚠️ PDF cargado en pantalla, pero el analizador automático no pudo responder (${errAn.message}). Podés marcar los campos y cajas de firma manualmente sobre el lienzo.`, 'warn');
    }
  }

  async function cargarPlantillaEnEditor(plantillaId) {
    if (!plantillaId) return;
    setEstadoEditorPdf('⏳ Descargando plantilla guardada...', 'info');
    try {
      const res = await apiFetchJson(`/api/firmas/plantillas/${encodeURIComponent(plantillaId)}/pdf`, { method: 'GET' });
      const tpl = res.plantilla || {};
      state.editor.plantillaId = tpl.id;
      state.editor.pdfBase64 = res.pdfBase64;
      state.editor._loadedB64 = '';
      state.editor.pdfDoc = null;
      state.editor.archivoNombre = tpl.archivo_nombre || 'plantilla.pdf';
      state.editor.totalPages = tpl.paginas || 1;
      state.editor.currentPage = 1;
      state.editor.campos = Array.isArray(tpl.campos_json) ? JSON.parse(JSON.stringify(tpl.campos_json)) : [];
      state.editor.history = [];
      state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;
      actualizarBotonDeshacerEditor_();

      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
      setVal('inpEditPlantillaNombre', tpl.nombre);
      setVal('selEditPlantillaCategoria', tpl.categoria || 'GENERAL');
      setVal('inpEditPlantillaDesc', tpl.descripcion || '');
      const vals = tpl.validaciones_json || {};
      setChk('chkValFirmaOlografa', vals.firma_olografa !== false);
      setChk('chkValDeclaracionUif', vals.declaracion_uif !== false);
      setChk('chkValTaparResaltados', vals.tapar_resaltados !== false);
      setChk('chkValRequiereSelloPng', vals.requiere_sello_png);
      setChk('chkValGpsObligatorio', vals.gps_obligatorio);
      setChk('chkValDniFrenteDorso', vals.dni_frente_dorso);
      setChk('chkValSelfieLiveness', vals.selfie_liveness);
      setChk('chkValSelfieVozConsentimiento', vals.selfie_voz_consentimiento);
      setChk('chkValRequierePinOtp', vals.requiere_pin_otp);

      await cargarPdfEnCanvasEditor(res.pdfBase64, 1);
      renderInspectorCamposEditor();
      setEstadoEditorPdf(`✅ Plantilla "${tpl.nombre}" cargada para edición (${state.editor.campos.length} campos).`, 'ok');
    } catch (err) {
      setEstadoEditorPdf(`❌ Error cargando plantilla: ${err.message}`, 'err');
      notify('Error cargando plantilla: ' + err.message, 'error');
    }
  }

  function sincronizarSelectZoomEditor() {
    const sel = document.getElementById('selEditorZoomPct');
    if (!sel) return;
    const zVal = Number((state.editor.zoom || 1.0).toFixed(2));
    const optExist = Array.from(sel.options).find((o) => Math.abs(parseFloat(o.value) - zVal) < 0.015);
    if (optExist) {
      sel.value = optExist.value;
    } else {
      let custom = sel.querySelector('option[data-custom-zoom="1"]');
      if (!custom) {
        custom = document.createElement('option');
        custom.setAttribute('data-custom-zoom', '1');
        sel.appendChild(custom);
      }
      custom.value = String(zVal);
      custom.textContent = `${Math.round(zVal * 100)}%`;
      sel.value = custom.value;
    }
  }

  async function cargarPdfEnCanvasEditor(b64, pageNum) {
    const canvas = document.getElementById('canvasEditorPlantillaPdf');
    const lblPag = document.getElementById('lblEditorPaginaActual');
    const frame = document.getElementById('editorPdfPageFrame');
    if (!canvas || !b64) return;
    if (!state.editor.pdfDoc || state.editor._loadedB64 !== b64) {
      state.editor.pdfDoc = await cargarDocumentoPdfJs(base64ToUint8Array(b64));
      state.editor._loadedB64 = b64;
      state.editor.totalPages = state.editor.pdfDoc.numPages || 1;
    }
    const pag = Math.max(1, Math.min(pageNum, state.editor.totalPages));
    state.editor.currentPage = pag;
    if (lblPag) lblPag.textContent = `Página ${pag} de ${state.editor.totalPages}`;

    if (state.editor._renderTask && typeof state.editor._renderTask.cancel === 'function') {
      try { state.editor._renderTask.cancel(); } catch (_e) {}
      state.editor._renderTask = null;
    }

    const page = await state.editor.pdfDoc.getPage(pag);
    const zoom = Math.max(0.4, Math.min(3.0, Number(state.editor.zoom || 1.0)));
    state.editor.zoom = zoom;
    sincronizarSelectZoomEditor();

    const baseVp = page.getViewport({ scale: 1.25 });
    state.editor._baseViewportW = baseVp.width;

    const cssScale = 1.25 * zoom;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const vpCss = page.getViewport({ scale: cssScale });
    const vpRender = page.getViewport({ scale: cssScale * dpr });

    const cssW = Math.max(120, Math.round(vpCss.width));
    const cssH = Math.max(120, Math.round(vpCss.height));
    canvas.width = Math.max(120, Math.round(vpRender.width));
    canvas.height = Math.max(120, Math.round(vpRender.height));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    if (frame) {
      frame.style.width = `${cssW}px`;
      frame.style.height = `${cssH}px`;
    }

    const ctx2d = canvas.getContext('2d');
    const renderTask = page.render({ canvasContext: ctx2d, viewport: vpRender });
    state.editor._renderTask = renderTask;
    try {
      await renderTask.promise;
    } catch (errRender) {
      if (!errRender || errRender.name !== 'RenderingCancelledException') throw errRender;
      return;
    } finally {
      if (state.editor._renderTask === renderTask) state.editor._renderTask = null;
    }
    renderCajasOverlayEditor();
  }

  function setZoomEditorPdf(newZoom, anchorRatio) {
    const z = Math.max(0.4, Math.min(3.0, Number(newZoom || 1.0)));
    const prevZ = Number(state.editor.zoom || 1.0);
    state.editor.zoom = Number(z.toFixed(2));
    sincronizarSelectZoomEditor();
    if (!state.editor.pdfBase64) return;

    const wrap = document.getElementById('editorPdfScrollWrap');
    let rx = 0.5, ry = 0.5;
    if (wrap && wrap.scrollWidth > 0 && wrap.scrollHeight > 0) {
      if (anchorRatio && typeof anchorRatio.rx === 'number') {
        rx = anchorRatio.rx;
        ry = anchorRatio.ry;
      } else {
        rx = (wrap.scrollLeft + wrap.clientWidth * 0.5) / wrap.scrollWidth;
        ry = (wrap.scrollTop + wrap.clientHeight * 0.5) / wrap.scrollHeight;
      }
    }

    Promise.resolve(cargarPdfEnCanvasEditor(state.editor.pdfBase64, state.editor.currentPage)).then(() => {
      if (wrap && Math.abs(state.editor.zoom - prevZ) > 0.005) {
        wrap.scrollLeft = Math.max(0, Math.round(rx * wrap.scrollWidth - wrap.clientWidth * 0.5));
        wrap.scrollTop = Math.max(0, Math.round(ry * wrap.scrollHeight - wrap.clientHeight * 0.5));
      }
    });
  }

  function zoomEditorPdf(delta) {
    const cur = Number(state.editor.zoom || 1.0);
    setZoomEditorPdf(cur + Number(delta || 0));
  }

  function ajustarZoomEditorPdf() {
    const wrap = document.getElementById('editorPdfScrollWrap');
    const baseW = Number(state.editor._baseViewportW || 0);
    if (!wrap || !baseW) {
      setZoomEditorPdf(1.0);
      return;
    }
    const availW = Math.max(260, wrap.clientWidth - 28);
    setZoomEditorPdf(availW / baseW);
  }

  function toggleVistaLimpiaEditor(checked) {
    state.editor.vistaLimpia = !!checked;
    renderCajasOverlayEditor();
  }

  function cambiarPaginaEditor(delta) {
    if (!state.editor.pdfBase64) return;
    const next = Math.max(1, Math.min(state.editor.totalPages, state.editor.currentPage + delta));
    if (next !== state.editor.currentPage) {
      cargarPdfEnCanvasEditor(state.editor.pdfBase64, next);
    }
  }

  function actualizarBotonesModoEditor() {
    ['texto', 'borrador', 'firma', 'sello', 'pan'].forEach((k) => {
      const btn = document.getElementById('btnModoCampo_' + k);
      if (!btn) return;
      const activo = state.editor.addModeTipo === k;
      btn.classList.toggle('is-active', activo);
      btn.style.outline = '';
      btn.style.outlineOffset = '';
      btn.style.transform = '';
    });
  }

  function activarModoClickAgregarCampo(tipo) {
    if (!state.editor.pdfBase64) {
      notify('Primero subí o seleccioná un PDF plantilla arriba para visualizarlo.', 'warning');
      return;
    }
    state.editor.addModeTipo = state.editor.addModeTipo === tipo ? null : tipo;
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) {
      overlay.style.cursor = state.editor.addModeTipo === 'pan'
        ? 'grab'
        : (state.editor.addModeTipo ? 'crosshair' : 'grab');
    }
    actualizarBotonesModoEditor();
    if (state.editor.addModeTipo === 'firma') notify('Hacé clic en el PDF donde querés ubicar la caja de Firma Manuscrita.', 'info');
    else if (state.editor.addModeTipo === 'sello') notify('Hacé clic en el PDF donde querés estampar el Sello Oficial PNG.', 'info');
    else if (state.editor.addModeTipo === 'borrador') notify('Hacé clic sobre el texto precompleto del PDF que querés borrar / dejar vacío.', 'info');
    else if (state.editor.addModeTipo === 'pan') notify('Modo desplazar activo: arrastrá sobre el PDF para moverlo en cualquier dirección.', 'info');
    else if (state.editor.addModeTipo === 'texto') notify('Hacé clic en el PDF donde querés colocar el nuevo campo.', 'info');
  }

  function agregarCampoEnCoords(xPct, yPct, tipo) {
    const id = 'cmp_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100);
    const esFirma = tipo === 'firma';
    const esSello = tipo === 'sello';
    const esBorrador = tipo === 'borrador';
    let nuevo;
    if (esFirma) {
      const firmasExistentes = state.editor.campos.filter((x) => x.tipo === 'firma').length;
      const numF = Math.min(4, firmasExistentes + 1);
      nuevo = {
        id,
        etiqueta: numF === 1 ? 'Firma Solicitante' : `Firma ${numF}`,
        tipo: 'firma',
        origen_campo: 'firma',
        firmante_clave: `firmante_${numF}`,
        firmante_etiqueta: numF === 1 ? 'Titular / Asociado' : `Firmante ${numF}`,
        valor_manual: '',
        pagina: state.editor.currentPage,
        x_pct: Math.max(0.01, Math.min(0.75, Number(xPct.toFixed(4)))),
        y_pct: Math.max(0.01, Math.min(0.90, Number(yPct.toFixed(4)))),
        w_pct: 0.28,
        h_pct: 0.08,
        font_size: 10,
        cubrir_fondo: false,
      };
    } else if (esSello) {
      nuevo = {
        id,
        etiqueta: 'Sello Oficial AMMER',
        tipo: 'sello',
        origen_campo: 'sello_institucional',
        valor_manual: '',
        pagina: state.editor.currentPage,
        x_pct: Math.max(0.01, Math.min(0.80, Number(xPct.toFixed(4)))),
        y_pct: Math.max(0.01, Math.min(0.88, Number(yPct.toFixed(4)))),
        w_pct: 0.18,
        h_pct: 0.11,
        font_size: 10,
        cubrir_fondo: false,
      };
      const chkSello = document.getElementById('chkValRequiereSelloPng');
      if (chkSello) chkSello.checked = true;
    } else if (esBorrador) {
      nuevo = {
        id,
        etiqueta: 'Campo vacío (borra texto)',
        tipo: 'borrador',
        origen_campo: 'campo_vacio',
        valor_manual: '',
        pagina: state.editor.currentPage,
        x_pct: Math.max(0.01, Math.min(0.80, Number(xPct.toFixed(4)))),
        y_pct: Math.max(0.01, Math.min(0.94, Number(yPct.toFixed(4)))),
        w_pct: 0.24,
        h_pct: 0.032,
        font_size: 10,
        cubrir_fondo: true,
      };
    } else {
      nuevo = {
        id,
        etiqueta: 'Campo nuevo',
        tipo: 'texto',
        origen_campo: 'manual',
        valor_manual: '',
        pagina: state.editor.currentPage,
        x_pct: Math.max(0.01, Math.min(0.80, Number(xPct.toFixed(4)))),
        y_pct: Math.max(0.01, Math.min(0.94, Number(yPct.toFixed(4)))),
        w_pct: 0.24,
        h_pct: 0.028,
        font_size: 10,
        cubrir_fondo: true,
      };
    }

    if (state.editor.grillaSnap) {
      nuevo.x_pct = Math.max(0, Math.min(1 - (nuevo.w_pct || 0.2), snapCoord_(nuevo.x_pct)));
      nuevo.y_pct = Math.max(0, Math.min(1 - (nuevo.h_pct || 0.03), snapCoord_(nuevo.y_pct)));
    }
    pushUndoEditor_();
    state.editor.campos.push(nuevo);
    state.editor.selectedFieldId = id;
    state.editor.addModeTipo = null;
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) overlay.style.cursor = 'grab';
    actualizarBotonesModoEditor();
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function obtenerEstilosCajaCampo(c, selected) {
    const esFirma = c.tipo === 'firma';
    const esSello = c.tipo === 'sello' || c.origen_campo === 'sello_institucional';
    const esBorrador = c.tipo === 'borrador' || c.origen_campo === 'campo_vacio';
    let borderCol = '#d97706', bgCol = 'rgba(245, 158, 11, 0.22)', tagBg = '#b45309';
    if (esBorrador) {
      borderCol = '#0284c7';
      bgCol = 'rgba(255, 255, 255, 0.94)';
      tagBg = '#0369a1';
    } else if (esFirma) {
      borderCol = '#059669'; bgCol = 'rgba(16, 185, 129, 0.16)'; tagBg = '#047857';
    } else if (esSello) {
      borderCol = '#7c3aed'; bgCol = 'rgba(124, 58, 237, 0.16)'; tagBg = '#6d28d9';
    } else if (state.editor.vistaLimpia && c.cubrir_fondo !== false) {
      bgCol = 'rgba(255, 255, 255, 0.94)';
    }
    if (selected) {
      borderCol = '#2563eb';
      tagBg = '#1d4ed8';
      if (!esBorrador && !(state.editor.vistaLimpia && c.cubrir_fondo !== false)) {
        bgCol = 'rgba(37, 99, 235, 0.22)';
      }
    }
    const borderStyle = (esFirma || esSello || esBorrador) ? '2px dashed' : (selected ? '2px solid' : '1.5px solid');
    return { border: `${borderStyle} ${borderCol}`, bgCol, tagBg, esFirma, esSello, esBorrador };
  }

  function obtenerTextoEtiquetaCaja(c) {
    if (c.tipo === 'borrador' || c.origen_campo === 'campo_vacio') {
      return `🧹 ${c.etiqueta || 'Campo vacío'}`;
    }
    if (c.tipo === 'firma') {
      const fc = String(c.firmante_clave || 'firmante_1').replace('firmante_', 'F');
      return `✍️ [${fc}] ${c.etiqueta || 'Firma'}`;
    }
    if (c.tipo === 'sello' || c.origen_campo === 'sello_institucional') {
      return `🏛️ ${c.etiqueta || 'Sello PNG'}`;
    }
    return c.etiqueta || c.origen_campo || 'Campo';
  }

  function actualizarEstiloSeleccionOverlay() {
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (!overlay) return;
    overlay.querySelectorAll('[data-field-id]').forEach((node) => {
      const cid = node.getAttribute('data-field-id');
      const c = state.editor.campos.find((x) => x.id === cid);
      if (!c) return;
      const sel = cid === state.editor.selectedFieldId;
      const st = obtenerEstilosCajaCampo(c, sel);
      node.style.border = st.border;
      node.style.background = st.bgCol;
      node.style.zIndex = sel ? '25' : '10';
      const lbl = node.querySelector('.campo-tag-lbl');
      if (lbl) lbl.style.background = st.tagBg;
    });
    const lista = document.getElementById('editorListaCamposResumen');
    if (lista) {
      lista.querySelectorAll('[data-pill-id]').forEach((btn) => {
        const act = btn.getAttribute('data-pill-id') === state.editor.selectedFieldId;
        btn.style.borderColor = act ? '#1d4ed8' : '#cbd5e1';
        btn.style.background = act ? '#dbeafe' : '#ffffff';
        btn.style.color = act ? '#1e3a8a' : '#334155';
      });
    }
  }

  function actualizarCoordsBadgeInspector(c) {
    const badge = document.getElementById('lblEditorCampoCoords');
    if (badge && c) {
      badge.textContent = `X: ${(Number(c.x_pct || 0) * 100).toFixed(1)}% · Y: ${(Number(c.y_pct || 0) * 100).toFixed(1)}% · Ancho: ${(Number(c.w_pct || 0) * 100).toFixed(1)}% · Alto: ${(Number(c.h_pct || 0) * 100).toFixed(1)}%`;
    }
  }

  function renderCajasOverlayEditor() {
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.classList.toggle('firmas-editor-grid-bg', !!state.editor.grillaSnap);

    const frag = document.createDocumentFragment();
    const camposPag = state.editor.campos.filter((c) => Number(c.pagina || 1) === state.editor.currentPage);
    camposPag.forEach((c) => {
      const el = document.createElement('div');
      el.setAttribute('data-field-id', c.id);
      const selected = c.id === state.editor.selectedFieldId;
      const st = obtenerEstilosCajaCampo(c, selected);

      el.style.position = 'absolute';
      el.style.left = `${(c.x_pct || 0) * 100}%`;
      el.style.top = `${(c.y_pct || 0) * 100}%`;
      el.style.width = `${(c.w_pct || 0.2) * 100}%`;
      el.style.height = `${(c.h_pct || 0.03) * 100}%`;
      el.style.border = st.border;
      el.style.background = st.bgCol;
      el.style.borderRadius = '3px';
      el.style.cursor = 'grab';
      el.style.boxSizing = 'border-box';
      el.style.userSelect = 'none';
      el.style.touchAction = 'none';
      el.style.zIndex = selected ? '25' : '10';
      el.title = `${c.etiqueta} (${c.origen_campo})`;

      const lbl = document.createElement('span');
      lbl.className = 'campo-tag-lbl';
      lbl.textContent = obtenerTextoEtiquetaCaja(c);
      lbl.style.position = 'absolute';
      lbl.style.top = '-16px';
      lbl.style.left = '0';
      lbl.style.fontSize = '10px';
      lbl.style.fontWeight = '700';
      lbl.style.padding = '1px 4px';
      lbl.style.borderRadius = '3px';
      lbl.style.whiteSpace = 'nowrap';
      lbl.style.background = st.tagBg;
      lbl.style.color = '#ffffff';
      lbl.style.pointerEvents = 'none';
      el.appendChild(lbl);

      const handle = document.createElement('div');
      handle.setAttribute('data-resize-handle', '1');
      handle.style.position = 'absolute';
      handle.style.right = '-5px';
      handle.style.bottom = '-5px';
      handle.style.width = '12px';
      handle.style.height = '12px';
      handle.style.background = '#1d4ed8';
      handle.style.border = '1.5px solid #ffffff';
      handle.style.borderRadius = '3px';
      handle.style.cursor = 'nwse-resize';
      handle.style.touchAction = 'none';
      el.appendChild(handle);

      el.addEventListener('pointerdown', (ev) => {
        if (ev.button && ev.button !== 0) return;
        ev.stopPropagation();

        // Actualizar selección SIN destruir el DOM (mantiene el elemento vivo durante el drag a 60fps)
        const cambioSel = state.editor.selectedFieldId !== c.id;
        state.editor.selectedFieldId = c.id;
        actualizarEstiloSeleccionOverlay();
        if (cambioSel) renderInspectorCamposEditor();

        const rect = overlay.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const isResize = ev.target === handle || (ev.target && ev.target.getAttribute('data-resize-handle') === '1');
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origXPct = c.x_pct;
        const origYPct = c.y_pct;
        const origWPct = c.w_pct;
        const origHPct = c.h_pct;
        const preDragCampos = JSON.parse(JSON.stringify(state.editor.campos || []));
        const preDragSelId = state.editor.selectedFieldId || null;

        el.style.cursor = isResize ? 'nwse-resize' : 'grabbing';
        try { el.setPointerCapture(ev.pointerId); } catch (_e) {}

        let rafId = null;
        let lastMove = null;

        function aplicarFrame() {
          rafId = null;
          if (!lastMove) return;
          const dx = (lastMove.clientX - startX) / rect.width;
          const dy = (lastMove.clientY - startY) / rect.height;
          if (isResize) {
            c.w_pct = Math.max(0.03, Math.min(1 - c.x_pct, snapCoord_(origWPct + dx)));
            c.h_pct = Math.max(0.015, Math.min(1 - c.y_pct, snapCoord_(origHPct + dy)));
            el.style.width = `${c.w_pct * 100}%`;
            el.style.height = `${c.h_pct * 100}%`;
          } else {
            c.x_pct = Math.max(0, Math.min(1 - c.w_pct, snapCoord_(origXPct + dx)));
            c.y_pct = Math.max(0, Math.min(1 - c.h_pct, snapCoord_(origYPct + dy)));
            el.style.left = `${c.x_pct * 100}%`;
            el.style.top = `${c.y_pct * 100}%`;
          }
          actualizarCoordsBadgeInspector(c);
        }

        function onMove(mv) {
          lastMove = { clientX: mv.clientX, clientY: mv.clientY };
          if (rafId === null) {
            rafId = window.requestAnimationFrame(aplicarFrame);
          }
        }

        function onUp(upEv) {
          if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            aplicarFrame();
          }
          el.style.cursor = 'grab';
          try { if (upEv && el.hasPointerCapture(upEv.pointerId)) el.releasePointerCapture(upEv.pointerId); } catch (_e) {}
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          if (c.x_pct !== origXPct || c.y_pct !== origYPct || c.w_pct !== origWPct || c.h_pct !== origHPct) {
            if (!Array.isArray(state.editor.history)) state.editor.history = [];
            state.editor.history.push({ campos: preDragCampos, selectedFieldId: preDragSelId });
            if (state.editor.history.length > 35) state.editor.history.shift();
            actualizarBotonDeshacerEditor_();
          }
          actualizarCoordsBadgeInspector(c);
        }

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
      });

      frag.appendChild(el);
    });
    overlay.appendChild(frag);
  }

  function setupOverlayClickListener() {
    const overlay = document.getElementById('overlayCamposPlantilla');
    const scrollWrap = document.getElementById('editorPdfScrollWrap');
    if (scrollWrap && !scrollWrap.dataset.boundWheelZoom) {
      scrollWrap.dataset.boundWheelZoom = '1';
      scrollWrap.addEventListener('wheel', (ev) => {
        if (!(ev.ctrlKey || ev.metaKey)) return;
        if (!state.editor.pdfBase64) return;
        ev.preventDefault();
        const rect = scrollWrap.getBoundingClientRect();
        const rx = scrollWrap.scrollWidth > 0
          ? (scrollWrap.scrollLeft + (ev.clientX - rect.left)) / scrollWrap.scrollWidth
          : 0.5;
        const ry = scrollWrap.scrollHeight > 0
          ? (scrollWrap.scrollTop + (ev.clientY - rect.top)) / scrollWrap.scrollHeight
          : 0.5;
        const delta = ev.deltaY < 0 ? 0.15 : -0.15;
        setZoomEditorPdf(Number(state.editor.zoom || 1.0) + delta, { rx, ry });
      }, { passive: false });
    }
    if (!overlay || overlay.dataset.boundClick) return;
    overlay.dataset.boundClick = '1';
    if (!state.editor.addModeTipo) overlay.style.cursor = 'grab';
    overlay.addEventListener('pointerdown', (ev) => {
      if (ev.button && ev.button !== 0 && ev.button !== 1) return;
      const modo = state.editor.addModeTipo;
      if (modo && modo !== 'pan') {
        if (ev.target !== overlay) return;
        const rect = overlay.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const xPct = (ev.clientX - rect.left) / rect.width;
        const yPct = (ev.clientY - rect.top) / rect.height;
        agregarCampoEnCoords(xPct, yPct, modo);
        return;
      }
      if (!scrollWrap) return;
      if (modo !== 'pan' && ev.target !== overlay) return;
      ev.preventDefault();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startLeft = scrollWrap.scrollLeft;
      const startTop = scrollWrap.scrollTop;
      overlay.style.cursor = 'grabbing';
      try { overlay.setPointerCapture(ev.pointerId); } catch (_e) {}

      function onPanMove(mv) {
        scrollWrap.scrollLeft = startLeft - (mv.clientX - startX);
        scrollWrap.scrollTop = startTop - (mv.clientY - startY);
      }

      function onPanUp(upEv) {
        overlay.style.cursor = (state.editor.addModeTipo && state.editor.addModeTipo !== 'pan') ? 'crosshair' : 'grab';
        try { if (upEv && overlay.hasPointerCapture(upEv.pointerId)) overlay.releasePointerCapture(upEv.pointerId); } catch (_e) {}
        overlay.removeEventListener('pointermove', onPanMove);
        overlay.removeEventListener('pointerup', onPanUp);
        overlay.removeEventListener('pointercancel', onPanUp);
      }

      overlay.addEventListener('pointermove', onPanMove);
      overlay.addEventListener('pointerup', onPanUp);
      overlay.addEventListener('pointercancel', onPanUp);
    });

    if (!document.body.dataset.boundEditorKeys) {
      document.body.dataset.boundEditorKeys = '1';
      let lastArrowUndoTs = 0;
      document.addEventListener('keydown', (ev) => {
        const pnl = document.getElementById('panelFirmas_editor');
        if (!pnl || pnl.style.display === 'none') return;
        const tag = (ev.target && ev.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        if ((ev.ctrlKey || ev.metaKey) && String(ev.key || '').toLowerCase() === 'z' && !ev.shiftKey) {
          ev.preventDefault();
          deshacerCambioEditor();
          return;
        }
        if (ev.key === '+' || ev.key === '=') {
          ev.preventDefault();
          zoomEditorPdf(0.2);
          return;
        }
        if (ev.key === '-' || ev.key === '_') {
          ev.preventDefault();
          zoomEditorPdf(-0.2);
          return;
        }
        if (ev.key === '0' && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          setZoomEditorPdf(1.0);
          return;
        }
        if (ev.key === 'Escape' && state.editor.addModeTipo) {
          state.editor.addModeTipo = null;
          overlay.style.cursor = 'grab';
          actualizarBotonesModoEditor();
          return;
        }
        const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId);
        if (!c || Number(c.pagina || 1) !== state.editor.currentPage) return;

        if (ev.key === 'Delete' || ev.key === 'Backspace') {
          ev.preventDefault();
          eliminarCampoEditor(c.id);
          return;
        }

        const isArrow = ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown';
        if (isArrow) {
          ev.preventDefault();
          const now = Date.now();
          if (now - lastArrowUndoTs > 700) {
            pushUndoEditor_();
          }
          lastArrowUndoTs = now;
          const step = ev.shiftKey ? 0.01 : 0.0025;
          if (ev.key === 'ArrowLeft') c.x_pct = Math.max(0, Number((c.x_pct - step).toFixed(4)));
          else if (ev.key === 'ArrowRight') c.x_pct = Math.min(1 - c.w_pct, Number((c.x_pct + step).toFixed(4)));
          else if (ev.key === 'ArrowUp') c.y_pct = Math.max(0, Number((c.y_pct - step).toFixed(4)));
          else if (ev.key === 'ArrowDown') c.y_pct = Math.min(1 - c.h_pct, Number((c.y_pct + step).toFixed(4)));
          const boxEl = overlay.querySelector(`[data-field-id="${CSS.escape(c.id)}"]`);
          if (boxEl) {
            boxEl.style.left = `${c.x_pct * 100}%`;
            boxEl.style.top = `${c.y_pct * 100}%`;
          }
          actualizarCoordsBadgeInspector(c);
        }
      });
    }
  }

  function renderInspectorCamposEditor() {
    const cont = document.getElementById('editorInspectorCampoContainer');
    const lista = document.getElementById('editorListaCamposResumen');
    const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId) || null;

    if (lista) {
      const qCampo = String((document.getElementById('inpBuscarCampoEditor') || {}).value || '').trim().toLowerCase();
      if (state.editor.campos.length === 0) {
        lista.innerHTML = '<span style="font-size:0.76rem;color:#64748b;">Sin campos marcados aún.</span>';
      } else {
        const filtrados = qCampo
          ? state.editor.campos.filter((item) => {
              const hay = `p${item.pagina || 1} pag ${item.pagina || 1} ${item.etiqueta || ''} ${item.id || ''} ${item.origen_campo || ''}`.toLowerCase();
              return hay.includes(qCampo);
            })
          : state.editor.campos;
        lista.innerHTML = filtrados.length === 0
          ? `<span style="font-size:0.76rem;color:#64748b;">Sin coincidencias para "${escHtml(qCampo)}".</span>`
          : filtrados.map((item) => {
            const act = item.id === state.editor.selectedFieldId;
            const ico = (item.tipo === 'borrador' || item.origen_campo === 'campo_vacio')
              ? '🧹 '
              : (item.tipo === 'firma' ? '✍️ ' : (item.tipo === 'sello' ? '🏛️ ' : ''));
            return `<button type="button" data-pill-id="${escHtml(item.id)}" class="firmas-btn firmas-btn--xs ${act ? 'firmas-btn-primary' : ''}" onclick="window.seleccionarCampoEditor('${escHtml(item.id)}')">${ico}P${item.pagina || 1}: ${escHtml(item.etiqueta || item.id)}</button>`;
          }).join(' ');
      }
    }

    if (!cont) return;
    if (!c) {
      cont.innerHTML = '<div style="padding:1.1rem;background:#f8fafc;border-radius:12px;border:1.5px dashed #cbd5e1;font-size:0.81rem;color:#64748b;line-height:1.5;">Hacé clic sobre un cuadro en el PDF (o agregá un campo nuevo) para configurar qué dato o firmante se estampa ahí. Podés usar las flechas del teclado para ajustar posición con precisión o <strong>Ctrl + rueda</strong> para hacer zoom.</div>';
      return;
    }

    const optHtml = ORIGENES_CAMPO.map((o) =>
      `<option value="${escHtml(o.value)}" ${c.origen_campo === o.value ? 'selected' : ''}>${escHtml(o.label)}</option>`
    ).join('');

    const esBorrador = c.tipo === 'borrador' || c.origen_campo === 'campo_vacio';

    let extraFirmaHtml = '';
    if (c.tipo === 'firma') {
      const fOpts = FIRMANTES_DISPONIBLES.map((f) =>
        `<option value="${escHtml(f.clave)}" ${(c.firmante_clave || 'firmante_1') === f.clave ? 'selected' : ''}>${escHtml(f.label)}</option>`
      ).join('');
      extraFirmaHtml = `
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:0.7rem;display:flex;flex-direction:column;gap:0.5rem;">
          <div>
            <label class="firmas-label" style="color:#065f46;margin-bottom:4px;">Persona asignada a esta caja de firma:</label>
            <select class="firmas-select firmas-select--sm" onchange="window.actualizarPropCampoEditor('firmante_clave', this.value)" style="border-color:#6ee7b7;">${fOpts}</select>
          </div>
          <div>
            <label class="firmas-label" style="color:#065f46;margin-bottom:4px;">Etiqueta visible del firmante:</label>
            <input type="text" class="firmas-input firmas-input--sm" value="${escHtml(c.firmante_etiqueta || c.etiqueta || 'Titular / Asociado')}" oninput="window.actualizarPropCampoEditor('firmante_etiqueta', this.value)" style="border-color:#6ee7b7;"/>
          </div>
        </div>
      `;
    }

    const fuenteBadge = c.fuente === 'ia_gemini'
      ? '<span style="font-size:0.66rem;padding:2px 7px;border-radius:9999px;background:#e0e7ff;color:#3730a3;font-weight:800;">✨ IA</span>'
      : (c.fuente === 'regla' ? '<span style="font-size:0.66rem;padding:2px 7px;border-radius:9999px;background:#fef3c7;color:#92400e;font-weight:800;">📐 Regla PDF</span>' : '');

    const textoPrevBox = c.texto_referencia
      ? `<div style="font-size:0.72rem;color:#64748b;background:#fffbeb;padding:0.45rem 0.65rem;border-radius:8px;border:1px solid #fde68a;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
           <span>Texto previo detectado: "${escHtml(c.texto_referencia)}"</span>
           ${!esBorrador ? `<button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', true)">🧹 Borrar y dejar vacío</button>` : ''}
         </div>`
      : '';

    cont.innerHTML = `
      <div class="firmas-section-box" style="padding:0.95rem;display:flex;flex-direction:column;gap:0.65rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;flex-wrap:wrap;">
          <strong style="font-size:0.83rem;color:#0f2744;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">Campo: ${escHtml(c.id)} (Pág. ${c.pagina || 1}) ${fuenteBadge}</strong>
          <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
            ${esBorrador
              ? `<button type="button" class="firmas-btn firmas-btn--xs" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', false)" style="border-color:#f59e0b;background:#fffbeb;color:#b45309;">✏️ Hacer rellenable</button>`
              : `<button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', true)" title="Elimina el texto previo del PDF sin pedir texto nuevo">🧹 Dejar vacío</button>`}
            <button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.duplicarCampoEditor('${escHtml(c.id)}')">📋 Duplicar</button>
            <button type="button" class="firmas-btn firmas-btn--xs firmas-btn-danger" onclick="window.eliminarCampoEditor('${escHtml(c.id)}')">🗑️ Quitar</button>
          </div>
        </div>
        <div id="lblEditorCampoCoords" class="font-mono" style="font-size:0.7rem;color:#475569;background:#ffffff;padding:4px 8px;border-radius:7px;border:1px solid #e2e8f0;">
          X: ${(Number(c.x_pct || 0) * 100).toFixed(1)}% · Y: ${(Number(c.y_pct || 0) * 100).toFixed(1)}% · Ancho: ${(Number(c.w_pct || 0) * 100).toFixed(1)}% · Alto: ${(Number(c.h_pct || 0) * 100).toFixed(1)}%
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.68rem;font-weight:700;color:#64748b;margin-right:2px;">Alinear:</span>
          <button type="button" class="firmas-btn firmas-btn--xs" onclick="window.alinearCampoEditor('izq')" title="Pegar al margen izquierdo (5%)">◧ Izq</button>
          <button type="button" class="firmas-btn firmas-btn--xs" onclick="window.alinearCampoEditor('centro_h')" title="Centrar horizontalmente en la página">◫ Centro</button>
          <button type="button" class="firmas-btn firmas-btn--xs" onclick="window.alinearCampoEditor('der')" title="Pegar al margen derecho (95%)">◨ Der</button>
          <button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.alinearCampoEditor('ancho_std')" title="Ajustar ancho estándar (25%)">📏 Ancho 25%</button>
          <button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" onclick="window.alinearCampoEditor('alto_std')" title="Ajustar alto estándar según tipo de campo">📐 Alto est.</button>
        </div>
        ${textoPrevBox}
        <div>
          <label for="editCampoEtiqueta" class="firmas-label" style="margin-bottom:4px;">Etiqueta visible</label>
          <input type="text" id="editCampoEtiqueta" class="firmas-input firmas-input--sm" value="${escHtml(c.etiqueta || '')}" oninput="window.actualizarPropCampoEditor('etiqueta', this.value)"/>
        </div>
        <div>
          <label for="editCampoOrigen" class="firmas-label" style="margin-bottom:4px;">Tipo / Dato del expediente a estampar</label>
          <select id="editCampoOrigen" class="firmas-select firmas-select--sm" onchange="window.actualizarOrigenCampoEditor(this.value)">${optHtml}</select>
        </div>
        ${extraFirmaHtml}
        ${esBorrador ? `
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:0.65rem 0.78rem;font-size:0.74rem;color:#0369a1;line-height:1.42;">
            🧹 <strong>Modo Campo Vacío activo:</strong> al generar o firmar el PDF, todo texto precompleto (o campo previo) cubierto por este recuadro se borrará en blanco sin escribir nada encima. Podés convertirlo en rellenable en cualquier momento.
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:0.55rem;align-items:end;">
            <div>
              <label class="firmas-label" style="margin-bottom:4px;">Tamaño fuente</label>
              <input type="number" class="firmas-input firmas-input--sm" min="6" max="18" step="0.5" value="${Number(c.font_size || 10)}" oninput="window.actualizarPropCampoEditor('font_size', parseFloat(this.value) || 10)"/>
            </div>
            <div>
              <label class="firmas-check-pill firmas-check-pill--compact" style="width:100%;justify-content:center;" title="Blanquea el texto previo que hubiera debajo en el PDF base">
                <input type="checkbox" ${c.cubrir_fondo !== false ? 'checked' : ''} onchange="window.actualizarPropCampoEditor('cubrir_fondo', this.checked)"/>
                <span>🧹 Fondo blanco</span>
              </label>
            </div>
          </div>
          <div>
            <label for="editCampoValorManual" class="firmas-label" style="margin-bottom:4px;">Valor por defecto / texto fijo (opcional)</label>
            <div style="display:flex;gap:5px;align-items:center;">
              <input type="text" id="editCampoValorManual" class="firmas-input firmas-input--sm" value="${escHtml(c.valor_manual || '')}" oninput="window.actualizarPropCampoEditor('valor_manual', this.value)" placeholder="Se usa si el dato es manual"/>
              <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.vaciarValorCampoEditor('${escHtml(c.id)}')" title="Borrar texto precompleto y dejar este campo vacío para completar">🧹 Vaciar</button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  function vaciarValorCampoEditor(cid) {
    const c = state.editor.campos.find((x) => x.id === (cid || state.editor.selectedFieldId));
    if (!c) return;
    pushUndoEditor_();
    c.valor_manual = '';
    c.cubrir_fondo = true;
    if (c.tipo !== 'firma' && c.tipo !== 'sello' && c.tipo !== 'borrador') {
      c.origen_campo = 'manual';
      c.tipo = 'texto';
    }
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
    notify('Campo vaciado y con fondo blanco activado para reemplazar texto previo.', 'success');
  }

  function convertirCampoSoloBorradorEditor(cid, hacerBorrador) {
    const c = state.editor.campos.find((x) => x.id === (cid || state.editor.selectedFieldId));
    if (!c) return;
    pushUndoEditor_();
    if (hacerBorrador) {
      c.tipo = 'borrador';
      c.origen_campo = 'campo_vacio';
      c.valor_manual = '';
      c.cubrir_fondo = true;
      if (!c.etiqueta || c.etiqueta === 'Campo nuevo') c.etiqueta = 'Campo vacío (borra texto)';
    } else {
      c.tipo = 'texto';
      c.origen_campo = 'manual';
      c.cubrir_fondo = true;
      if (String(c.etiqueta || '').includes('Campo vacío')) c.etiqueta = 'Campo a completar';
    }
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function seleccionarCampoEditor(cid) {
    const c = state.editor.campos.find((x) => x.id === cid);
    if (!c) return;
    state.editor.selectedFieldId = cid;
    if (Number(c.pagina || 1) !== state.editor.currentPage && state.editor.pdfBase64) {
      cargarPdfEnCanvasEditor(state.editor.pdfBase64, Number(c.pagina || 1));
    } else {
      actualizarEstiloSeleccionOverlay();
    }
    renderInspectorCamposEditor();
  }

  function actualizarPropCampoEditor(prop, val) {
    const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId);
    if (!c) return;
    c[prop] = val;
    if (prop === 'cubrir_fondo' && state.editor.vistaLimpia) {
      renderCajasOverlayEditor();
    }

    // Actualización puntual en DOM sin destruir ni reconstruir todo el overlay
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) {
      const box = overlay.querySelector(`[data-field-id="${CSS.escape(c.id)}"]`);
      if (box) {
        const lbl = box.querySelector('.campo-tag-lbl');
        if (lbl) lbl.textContent = obtenerTextoEtiquetaCaja(c);
        box.title = `${c.etiqueta || ''} (${c.origen_campo || ''})`;
      }
    }
    const pill = document.querySelector(`#editorListaCamposResumen [data-pill-id="${CSS.escape(c.id)}"]`);
    if (pill) {
      const ico = (c.tipo === 'borrador' || c.origen_campo === 'campo_vacio')
        ? '🧹 '
        : (c.tipo === 'firma' ? '✍️ ' : (c.tipo === 'sello' ? '🏛️ ' : ''));
      pill.textContent = `${ico}P${c.pagina || 1}: ${c.etiqueta || c.id}`;
    }
  }

  function actualizarOrigenCampoEditor(origen) {
    const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId);
    if (!c) return;
    pushUndoEditor_();
    c.origen_campo = origen;
    if (origen === 'firma') {
      c.tipo = 'firma';
      c.cubrir_fondo = false;
      if (!c.firmante_clave) c.firmante_clave = 'firmante_1';
    } else if (origen === 'sello_institucional') {
      c.tipo = 'sello';
      c.cubrir_fondo = false;
    } else if (origen === 'campo_vacio') {
      c.tipo = 'borrador';
      c.cubrir_fondo = true;
      c.valor_manual = '';
    } else if (origen.startsWith('fecha.')) {
      c.tipo = 'fecha';
      c.cubrir_fondo = true;
    } else {
      c.tipo = 'texto';
      c.cubrir_fondo = true;
    }
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function duplicarCampoEditor(cid) {
    const orig = state.editor.campos.find((x) => x.id === cid);
    if (!orig) return;
    pushUndoEditor_();
    const copia = JSON.parse(JSON.stringify(orig));
    copia.id = 'cmp_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100);
    copia.x_pct = Math.min(1 - (copia.w_pct || 0.2), Number(((orig.x_pct || 0) + 0.03).toFixed(4)));
    copia.y_pct = Math.min(1 - (copia.h_pct || 0.03), Number(((orig.y_pct || 0) + 0.03).toFixed(4)));
    copia.etiqueta = (orig.etiqueta || 'Campo') + ' (copia)';
    state.editor.campos.push(copia);
    state.editor.selectedFieldId = copia.id;
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function eliminarCampoEditor(cid) {
    pushUndoEditor_();
    state.editor.campos = state.editor.campos.filter((x) => x.id !== cid);
    state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function alinearCampoEditor(modo) {
    const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId);
    if (!c) {
      notify('Seleccioná un campo primero para alinearlo.', 'warning');
      return;
    }
    pushUndoEditor_();
    const w = Number(c.w_pct || 0.2);
    if (modo === 'izq') {
      c.x_pct = 0.05;
    } else if (modo === 'centro_h') {
      c.x_pct = Math.max(0, Math.min(1 - w, Number(((1 - w) * 0.5).toFixed(4))));
    } else if (modo === 'der') {
      c.x_pct = Math.max(0, Math.min(1 - w, Number((0.95 - w).toFixed(4))));
    } else if (modo === 'ancho_std') {
      c.w_pct = Math.min(1 - Number(c.x_pct || 0), 0.25);
    } else if (modo === 'alto_std') {
      const hTarget = c.tipo === 'firma' ? 0.08 : (c.tipo === 'sello' ? 0.11 : 0.028);
      c.h_pct = Math.min(1 - Number(c.y_pct || 0), hTarget);
    }
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function limpiarEditorPlantillaPdf(sinConfirmacion) {
    const tieneCambios = Boolean(state.editor.pdfBase64 || state.editor.plantillaId || (state.editor.campos && state.editor.campos.length > 0));
    if (tieneCambios && !sinConfirmacion) {
      if (!global.confirm('¿Querés cancelar la edición actual y limpiar el PDF, los campos y los datos del Editor Visual?')) {
        return;
      }
    }
    if (state.editor._renderTask && typeof state.editor._renderTask.cancel === 'function') {
      try { state.editor._renderTask.cancel(); } catch (_e) {}
    }
    state.editor.plantillaId = null;
    state.editor.pdfBase64 = '';
    state.editor.pdfDoc = null;
    state.editor._loadedB64 = '';
    state.editor._renderTask = null;
    state.editor._baseViewportW = 0;
    state.editor.zoom = 1.0;
    state.editor.vistaLimpia = false;
    state.editor.grillaSnap = false;
    state.editor.archivoNombre = '';
    state.editor.totalPages = 1;
    state.editor.currentPage = 1;
    state.editor.campos = [];
    state.editor.history = [];
    state.editor.selectedFieldId = null;
    state.editor.addModeTipo = null;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setVal('inpPlantillaPdfFile', '');
    setVal('selEditarPlantillaExistente', '');
    setVal('inpEditPlantillaNombre', '');
    setVal('selEditPlantillaCategoria', 'AUTORIZACION');
    setVal('inpEditPlantillaDesc', '');
    setVal('inpBuscarCampoEditor', '');
    setChk('chkValFirmaOlografa', true);
    setChk('chkValDeclaracionUif', true);
    setChk('chkValTaparResaltados', true);
    setChk('chkValRequiereSelloPng', false);
    setChk('chkValGpsObligatorio', false);
    setChk('chkValDniFrenteDorso', false);
    setChk('chkValSelfieLiveness', false);
    setChk('chkValSelfieVozConsentimiento', false);
    setChk('chkValRequierePinOtp', false);
    setChk('chkEditorVistaLimpia', false);
    setChk('chkEditorGrillaSnap', false);
    sincronizarSelectZoomEditor();

    const lblPag = document.getElementById('lblEditorPaginaActual');
    if (lblPag) lblPag.textContent = 'Página 1 de 1';
    const estBox = document.getElementById('lblEditorEstadoPdf');
    if (estBox) {
      estBox.style.display = 'none';
      estBox.textContent = '';
    }

    const canvas = document.getElementById('canvasEditorPlantillaPdf');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = '';
      canvas.style.height = '';
    }
    const frame = document.getElementById('editorPdfPageFrame');
    if (frame) {
      frame.style.width = '';
      frame.style.height = '';
    }
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.cursor = 'default';
      overlay.classList.remove('firmas-editor-grid-bg');
    }
    actualizarBotonesModoEditor();
    actualizarBotonDeshacerEditor_();
    renderInspectorCamposEditor();
    notify('Editor visual limpiado. Podés subir otro PDF o seleccionar una plantilla guardada.', 'info');
  }

  async function guardarPlantillaDesdeEditor() {
    const nombre = String((document.getElementById('inpEditPlantillaNombre') || {}).value || '').trim();
    const categoria = String((document.getElementById('selEditPlantillaCategoria') || {}).value || 'GENERAL');
    const descripcion = String((document.getElementById('inpEditPlantillaDesc') || {}).value || '').trim();

    if (!nombre) {
      notify('Ingresá un nombre para identificar la plantilla.', 'warning');
      return;
    }
    if (!state.editor.plantillaId && !state.editor.pdfBase64) {
      notify('Subí un archivo PDF antes de guardar.', 'warning');
      return;
    }

    const chk = (id, def) => {
      const el = document.getElementById(id);
      return el ? !!el.checked : def;
    };

    const payload = {
      id: state.editor.plantillaId || null,
      nombre,
      categoria,
      descripcion,
      archivo_nombre: state.editor.archivoNombre || `${nombre}.pdf`,
      paginas: state.editor.totalPages || 1,
      pdfBase64: state.editor.pdfBase64 || null,
      campos: state.editor.campos,
      validaciones: {
        firma_olografa: chk('chkValFirmaOlografa', true),
        declaracion_uif: chk('chkValDeclaracionUif', true),
        tapar_resaltados: chk('chkValTaparResaltados', true),
        requiere_sello_png: chk('chkValRequiereSelloPng', false),
        gps_obligatorio: chk('chkValGpsObligatorio', false),
        dni_frente_dorso: chk('chkValDniFrenteDorso', false),
        selfie_liveness: chk('chkValSelfieLiveness', false) || chk('chkValSelfieVozConsentimiento', false),
        selfie_voz_consentimiento: chk('chkValSelfieVozConsentimiento', false),
        requiere_pin_otp: chk('chkValRequierePinOtp', false),
      },
      activa: true,
    };

    notify('Guardando plantilla PDF en AMMER...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/plantillas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.editor.plantillaId = res.plantilla.id;
      await cargarPlantillas();
      const selExist = document.getElementById('selEditarPlantillaExistente');
      if (selExist && state.editor.plantillaId) selExist.value = state.editor.plantillaId;
      notify('Plantilla PDF guardada correctamente.', 'success');
    } catch (err) {
      notify('Error guardando plantilla: ' + err.message, 'error');
    }
  }

  function duplicarPlantillaActualEditor() {
    if (!state.editor.plantillaId && !state.editor.pdfBase64) {
      notify('Cargá o seleccioná una plantilla primero para duplicarla.', 'warning');
      return;
    }
    state.editor.plantillaId = null;
    state.editor.history = [];
    actualizarBotonDeshacerEditor_();
    const selExist = document.getElementById('selEditarPlantillaExistente');
    if (selExist) selExist.value = '';
    const inpNom = document.getElementById('inpEditPlantillaNombre');
    if (inpNom) {
      const baseNom = String(inpNom.value || state.editor.archivoNombre || 'Plantilla').trim();
      inpNom.value = /\(Copia\)$/i.test(baseNom) ? baseNom : `${baseNom} (Copia)`;
      inpNom.focus();
    }
    setEstadoEditorPdf('📋 Copia preparada en el editor (nuevo borrador). Ajustá los campos y presioná "💾 Guardar Plantilla" para guardarla aparte.', 'info');
    notify('Plantilla clonada como nueva. Presioná "Guardar Plantilla" para crear la copia.', 'success');
  }

  async function eliminarPlantillaActualEditor() {
    const selEl = document.getElementById('selEditarPlantillaExistente');
    const selId = state.editor.plantillaId || (selEl ? String(selEl.value || '').trim() : '');
    if (!selId) {
      notify('Seleccioná primero una plantilla guardada para eliminar.', 'warning');
      return;
    }
    const tpl = (state.plantillas || []).find((p) => String(p.id) === String(selId));
    const nombreTpl = (tpl && tpl.nombre) || String((document.getElementById('inpEditPlantillaNombre') || {}).value || '').trim() || selId;
    if (!global.confirm(`¿Seguro que querés eliminar la plantilla "${nombreTpl}"?\n\nLas solicitudes de firma ya enviadas se mantienen intactas, pero esta plantilla dejará de aparecer en el selector.`)) {
      return;
    }
    try {
      await apiFetchJson(`/api/firmas/plantillas/${encodeURIComponent(selId)}`, { method: 'DELETE' });
      limpiarEditorPlantillaPdf(true);
      await cargarPlantillas();
      notify(`Plantilla "${nombreTpl}" eliminada correctamente.`, 'success');
    } catch (err) {
      notify('Error eliminando plantilla: ' + err.message, 'error');
    }
  }

  async function probarEstampadoEditor() {
    if (!state.editor.pdfBase64) {
      notify('Cargá o abrí una plantilla PDF primero.', 'warning');
      return;
    }
    notify('Generando PDF de prueba con datos ficticios...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/generar-preview', {
        method: 'POST',
        body: JSON.stringify({
          pdfBase64: state.editor.pdfBase64,
          campos: state.editor.campos,
          selloPngBase64: state.selloPngBase64 || null,
          contexto: {
            expediente: { id: 'EXP-PRUEBA-001' },
            solicitante: {
              nombre: 'JUAN CARLOS DEMO AMMER',
              dni: '30123456',
              cuil: '20-30123456-9',
              domicilio: 'Av. Alameda de la Federación 450',
              localidad: 'Paraná, Entre Ríos',
              telefono: '3434123456',
              email: 'socio.demo@ammer.org.ar',
              cbu: '0110099130009998887771',
              alias: 'MUTUAL.MODELO.ER',
              banco: 'Banco Nación Argentina',
              organismo: 'Administración Pública ER',
              legajo: 'LG-4490',
              estadoCivil: 'Soltero/a',
            },
            prestamo: {
              lineaNombre: 'Ayuda Económica Haberes',
              monto: 450000,
              cuotas: 12,
              valorCuota: 56200,
              totalDevolver: 674400,
              tna: 74,
            },
          },
          incluir_hoja_evidencia: true,
          quitar_resaltados: (document.getElementById('chkValTaparResaltados') || {}).checked !== false,
        }),
      });
      descargarBase64Pdf(res.pdfBase64, 'Prueba_Estampado_AMMER.pdf');
      notify('PDF de prueba descargado con éxito.', 'success');
    } catch (err) {
      notify('Error generando prueba: ' + err.message, 'error');
    }
  }

  // ==================== CANVAS FIRMA PRESENCIAL DE PRUEBA ====================
  function setupCanvasFirmaPrueba() {
    const canvas = document.getElementById('canvasFirmaPruebaPresencial');
    if (!canvas || canvas.dataset.boundDraw) return;
    canvas.dataset.boundDraw = '1';

    const CSS_W = 320;
    const CSS_H = 110;
    const DPR = 3;
    canvas.style.width = CSS_W + 'px';
    canvas.style.height = CSS_H + 'px';
    canvas.style.maxWidth = '100%';
    canvas.width = CSS_W * DPR;
    canvas.height = CSS_H * DPR;

    const ctx = canvas.getContext('2d');
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    const baseCtx = baseCanvas.getContext('2d');

    const strokes = [];
    let currentStroke = null;
    let activePointerId = null;
    const LINE_W = 2.2;

    function styleCtx(targetCtx) {
      targetCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
      targetCtx.strokeStyle = '#0f172a';
      targetCtx.fillStyle = '#0f172a';
      targetCtx.lineWidth = LINE_W;
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';
      targetCtx.imageSmoothingEnabled = true;
      targetCtx.imageSmoothingQuality = 'high';
    }

    function drawSmoothStroke(targetCtx, pts) {
      if (!pts || !pts.length) return;
      if (pts.length === 1) {
        targetCtx.beginPath();
        targetCtx.arc(pts[0].x, pts[0].y, LINE_W * 0.55, 0, Math.PI * 2);
        targetCtx.fill();
        return;
      }
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 2) {
        targetCtx.lineTo(pts[1].x, pts[1].y);
        targetCtx.stroke();
        return;
      }
      const mid0 = { x: (pts[0].x + pts[1].x) * 0.5, y: (pts[0].y + pts[1].y) * 0.5 };
      targetCtx.lineTo(mid0.x, mid0.y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mid = { x: (pts[i].x + pts[i + 1].x) * 0.5, y: (pts[i].y + pts[i + 1].y) * 0.5 };
        targetCtx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
      }
      const last = pts[pts.length - 1];
      targetCtx.lineTo(last.x, last.y);
      targetCtx.stroke();
    }

    function renderFrame() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseCanvas, 0, 0);
      ctx.restore();
      if (currentStroke && currentStroke.length) {
        styleCtx(ctx);
        drawSmoothStroke(ctx, currentStroke);
      }
    }

    canvas.__resetSignature = () => {
      strokes.length = 0;
      currentStroke = null;
      activePointerId = null;
      state.canvasFirmaPrueba.drawing = false;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      baseCtx.save();
      baseCtx.setTransform(1, 0, 0, 1, 0, 0);
      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.restore();
    };

    function getPos(ev) {
      const r = canvas.getBoundingClientRect();
      const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      return {
        x: ((src.clientX - r.left) / (r.width || CSS_W)) * CSS_W,
        y: ((src.clientY - r.top) / (r.height || CSS_H)) * CSS_H,
      };
    }

    function start(ev) {
      if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();
      if (ev.pointerId !== undefined && canvas.setPointerCapture) {
        activePointerId = ev.pointerId;
        try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
      }
      state.canvasFirmaPrueba.drawing = true;
      currentStroke = [getPos(ev)];
      state.canvasFirmaPrueba.hasInk = true;
      state.canvasFirmaPrueba.points++;
      renderFrame();
    }

    function move(ev) {
      if (!state.canvasFirmaPrueba.drawing || !currentStroke) return;
      if (activePointerId !== null && ev.pointerId !== undefined && ev.pointerId !== activePointerId) return;
      ev.preventDefault();
      const coalesced = (typeof ev.getCoalescedEvents === 'function') ? ev.getCoalescedEvents() : [];
      const samples = coalesced && coalesced.length ? coalesced : [ev];
      let added = false;
      for (const s of samples) {
        const p = getPos(s);
        const prev = currentStroke[currentStroke.length - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        if ((dx * dx + dy * dy) >= 0.49) {
          currentStroke.push(p);
          state.canvasFirmaPrueba.hasInk = true;
          state.canvasFirmaPrueba.points++;
          added = true;
        }
      }
      if (added) renderFrame();
    }

    function stop(ev) {
      if (!state.canvasFirmaPrueba.drawing) return;
      if (activePointerId !== null && ev && ev.pointerId !== undefined && ev.pointerId !== activePointerId) return;
      state.canvasFirmaPrueba.drawing = false;
      if (ev && ev.pointerId !== undefined && canvas.releasePointerCapture) {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
      }
      activePointerId = null;
      if (currentStroke && currentStroke.length) {
        strokes.push(currentStroke);
        styleCtx(baseCtx);
        drawSmoothStroke(baseCtx, currentStroke);
        currentStroke = null;
        renderFrame();
      }
    }

    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', start, { passive: false });
      canvas.addEventListener('pointermove', move, { passive: false });
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
    } else {
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', stop);
    }
  }

  function limpiarCanvasFirmaPrueba() {
    const canvas = document.getElementById('canvasFirmaPruebaPresencial');
    if (!canvas) return;
    if (typeof canvas.__resetSignature === 'function') {
      canvas.__resetSignature();
    } else {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
    state.canvasFirmaPrueba.hasInk = false;
    state.canvasFirmaPrueba.points = 0;
  }

  // ==================== EXPORTACIÓN COMPLETA EXPEDIENTE .ZIP ====================
  async function exportarExpedienteCompletoZip(expedienteParam) {
    let exp = expedienteParam || global._fichaExpedienteActivoObj || getExpedienteSeleccionadoEnGenerador();
    if (!exp) {
      const elId = document.getElementById('detalle-id-solicitud');
      const idStr = elId ? elId.getAttribute('data-id') : '';
      if (idStr) {
        exp = getExpedientesLocales().find((s) => String(s.id) === String(idStr)) || null;
      }
    }
    if (!exp) {
      notify('No hay un expediente activo seleccionado para exportar.', 'warning');
      return;
    }

    const docs = [];
    const adj = exp.adjuntos || exp.documentos || {};
    if (Array.isArray(adj)) {
      adj.forEach((d, idx) => docs.push({ nombre: d.nombre || `adjunto_${idx + 1}.pdf`, tipo: d.tipo, url: d.url || d.driveUrl, base64: d.base64 }));
    } else if (adj && typeof adj === 'object') {
      Object.keys(adj).forEach((k) => {
        const val = adj[k];
        if (!val) return;
        if (typeof val === 'string') docs.push({ nombre: k, tipo: k, url: val.startsWith('http') ? val : null, base64: val.startsWith('http') ? null : val });
        else if (typeof val === 'object') docs.push({ nombre: val.nombre || k, tipo: k, url: val.url || val.driveUrl, base64: val.base64 });
      });
    }

    notify('Empaquetando expediente completo en .ZIP...', 'info');
    try {
      const headers = Object.assign(
        { 'Content-Type': 'application/json' },
        obtenerAuthHeaders()
      );
      const resp = await fetch(getApiBase() + '/api/expedientes/exportar-zip', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          expediente: exp,
          documentos: docs,
          validaciones: Array.isArray(exp.validaciones) ? exp.validaciones : [],
          firmas: [],
        }),
      });
      if (!resp.ok) {
        let detail = `Error HTTP ${resp.status}`;
        try { const j = await resp.json(); detail = j.detail || detail; } catch (_e) {}
        throw new Error(detail);
      }
      const blob = await resp.blob();
      const slug = String(exp.id_definitivo || exp.id_provisorio || exp.id || 'Expediente').replace(/[^A-Za-z0-9._-]+/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Expediente_AMMER_${slug}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1200);
      notify('Expediente .ZIP descargado con éxito.', 'success');
    } catch (err) {
      notify('Error exportando expediente ZIP: ' + err.message, 'error');
    }
  }

  // ==================== INICIALIZACIÓN VISTA FIRMAS AMMER ====================
  async function initFirmasAmmerView() {
    const btnEditorTab = document.getElementById('btnTabFirma_editor');
    if (btnEditorTab) {
      btnEditorTab.style.display = esAdminOAnalista() ? 'inline-flex' : 'none';
    }
    cargarSelloGuardado();
    setupOverlayClickListener();
    setupCanvasFirmaPrueba();
    poblarSelectorExpedientes();
    cargarEstadoBotWhatsappFirmas();
    await cargarPlantillas();
    if (!state.initialized) {
      state.initialized = true;
      cambiarTabFirmas('generar');
    }
  }

  // ==================== ASISTENTE RÁPIDO RENAPER MI EJEMPLAR ====================
  function normalizarSexoRenaper(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s) return 'Verificar en DNI';
    if (s.startsWith('M') || s.includes('MASC')) return 'Masculino';
    if (s.startsWith('F') || s.includes('FEM')) return 'Femenino';
    if (s.startsWith('X') || s.includes('BINAR')) return 'No binario';
    return raw;
  }

  function normalizarFechaDdMmAaaa(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
    return s;
  }

  const renaperAssistState = {
    winRef: null,
    extTabId: null,
    extSplitUsed: false,
    mode: 'none', // 'extension' | 'popup' | 'none'
    abierta: false,
    pollTimer: null,
    listenerBound: false,
    lastDatos: null,
  };

  function actualizarUiEstadoRenaperModal() {
    const stBox = document.getElementById('boxEstadoVentanaRenaper');
    const btnCerrar = document.getElementById('btnCerrarVentanaRenaperModal');
    const btnReabrir = document.getElementById('btnReabrirVentanaRenaperModal');
    if (!stBox) return;

    if (renaperAssistState.abierta) {
      stBox.style.background = '#dcfce7';
      stBox.style.borderColor = '#86efac';
      stBox.style.color = '#166534';
      stBox.innerHTML = renaperAssistState.mode === 'extension'
        ? (renaperAssistState.extSplitUsed
          ? '🟢 <strong>Pestaña dividida Chrome activa</strong> a la derecha (autocompletado habilitado).'
          : '🟢 <strong>Pestaña RENAPER abierta</strong> con asistente AMMER.')
        : '🟢 <strong>Ventana RENAPER abierta a la derecha</strong>. Al finalizar, cerrala con un clic abajo.';
      if (btnCerrar) btnCerrar.style.display = 'inline-flex';
      if (btnReabrir) btnReabrir.style.display = 'none';
    } else {
      stBox.style.background = '#f1f5f9';
      stBox.style.borderColor = '#cbd5e1';
      stBox.style.color = '#475569';
      stBox.innerHTML = '⚪ Consulta RENAPER cerrada.';
      if (btnCerrar) btnCerrar.style.display = 'none';
      if (btnReabrir) btnReabrir.style.display = 'inline-flex';
    }
  }

  function bindRenaperBridgeListeners() {
    if (renaperAssistState.listenerBound) return;
    renaperAssistState.listenerBound = true;
    global.addEventListener('message', (ev) => {
      if (ev.source !== global || !ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'AMMER_RENAPER_OPENED') {
        if (ev.data.requestId && String(ev.data.requestId).startsWith('drive_')) return;
        if (ev.data.ok) {
          renaperAssistState.mode = 'extension';
          renaperAssistState.extTabId = ev.data.tabId || null;
          renaperAssistState.extSplitUsed = !!ev.data.splitUsed;
          renaperAssistState.abierta = true;
          actualizarUiEstadoRenaperModal();
        } else if (renaperAssistState.lastDatos) {
          abrirPopupRenaperDerechaFallback(renaperAssistState.lastDatos);
        }
      } else if (ev.data.type === 'AMMER_RENAPER_CLOSED') {
        renaperAssistState.abierta = false;
        renaperAssistState.extTabId = null;
        actualizarUiEstadoRenaperModal();
      }
    });
  }

  function abrirPopupRenaperDerechaFallback(payload) {
    const scr = global.screen || {};
    const aLeft = Number(scr.availLeft != null ? scr.availLeft : 0);
    const aTop = Number(scr.availTop != null ? scr.availTop : 0);
    const aW = Number(scr.availWidth || global.innerWidth || 1280);
    const aH = Number(scr.availHeight || global.innerHeight || 760);
    const wPopup = Math.max(390, Math.floor(aW * 0.30));
    const hPopup = Math.max(580, aH - 20);
    const leftPopup = aLeft + Math.max(0, aW - wPopup);
    const features = `popup=yes,left=${leftPopup},top=${aTop},width=${wPopup},height=${hPopup},resizable=yes,scrollbars=yes`;

    let win = null;
    try {
      win = global.open('https://tramites.renaper.gob.ar/mi_ejemplar/', 'renaper_mi_ejemplar', features);
    } catch (_e) {}

    if (win) {
      renaperAssistState.winRef = win;
      renaperAssistState.mode = 'popup';
      renaperAssistState.abierta = true;
      try { win.focus(); } catch (_e) {}

      if (renaperAssistState.pollTimer) clearInterval(renaperAssistState.pollTimer);
      renaperAssistState.pollTimer = setInterval(() => {
        if (!renaperAssistState.winRef || renaperAssistState.winRef.closed) {
          clearInterval(renaperAssistState.pollTimer);
          renaperAssistState.pollTimer = null;
          renaperAssistState.winRef = null;
          renaperAssistState.abierta = false;
          actualizarUiEstadoRenaperModal();
        }
      }, 650);
    } else {
      renaperAssistState.abierta = false;
      notify('El navegador bloqueó la ventana emergente de RENAPER. Permití popups para este sitio o usá la extensión Chrome.', 'warning');
    }
    actualizarUiEstadoRenaperModal();
  }

  function cerrarVentanaRenaperMiEjemplar() {
    if (renaperAssistState.pollTimer) {
      clearInterval(renaperAssistState.pollTimer);
      renaperAssistState.pollTimer = null;
    }
    if (renaperAssistState.mode === 'extension') {
      try {
        global.postMessage(
          { type: 'AMMER_CLOSE_RENAPER_SPLIT', tabId: renaperAssistState.extTabId || null },
          global.location.origin
        );
      } catch (_e) {}
    }
    if (renaperAssistState.winRef && !renaperAssistState.winRef.closed) {
      try { renaperAssistState.winRef.close(); } catch (_e) {}
    }
    renaperAssistState.winRef = null;
    renaperAssistState.extTabId = null;
    renaperAssistState.abierta = false;
    actualizarUiEstadoRenaperModal();
    const modal = document.getElementById('modalGuiaRenaperEjemplar');
    if (modal) modal.style.display = 'none';
  }

  function _obtenerAsesorActualRenaper() {
    const sess = typeof global.getSession === 'function' ? global.getSession() : null;
    const usuario = String((sess && (sess.usuario || sess.username || sess.user)) || '').trim();
    const nombre = String((sess && (sess.nombre || sess.apellido_nombres || sess.name)) || usuario || 'Asesor').trim();
    return { usuario, nombre };
  }

  async function guardarDecisionManualRenaperModal(esValido) {
    const info = global._ultimoPayloadRenaperModal || {};
    const ejRen = String((document.getElementById('inpRenaperCompEjemplar') || {}).value || '').trim().toUpperCase();
    const emRen = String((document.getElementById('inpRenaperCompEmision') || {}).value || '').trim();
    const obsRen = String((document.getElementById('inpRenaperCompObs') || {}).value || '').trim();
    const asesor = _obtenerAsesorActualRenaper();
    const ahoraIso = new Date().toISOString();

    const reg = {
      valido: Boolean(esValido),
      estado: esValido ? 'VALIDO' : 'INVALIDO',
      ejemplar_dni: String(info.ejemplar || '').trim().toUpperCase() || null,
      fecha_emision_dni: String(info.fecha_emision || '').trim() || null,
      ejemplar_renaper: ejRen || null,
      fecha_emision_renaper: emRen || null,
      observaciones: obsRen || null,
      analista_usuario: asesor.usuario || null,
      analista_nombre: asesor.nombre,
      validado_en: ahoraIso,
    };

    const btnOk = document.getElementById('btnRenaperManualValido');
    const btnBad = document.getElementById('btnRenaperManualInvalido');
    if (btnOk) btnOk.disabled = true;
    if (btnBad) btnBad.disabled = true;

    try {
      if (info.solicitudId) {
        const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(info.solicitudId)}/validacion-ejemplar`, {
          method: 'POST',
          body: JSON.stringify({
            valido: reg.valido,
            ejemplarDni: reg.ejemplar_dni,
            fechaEmisionDni: reg.fecha_emision_dni,
            ejemplarRenaper: reg.ejemplar_renaper,
            fechaEmisionRenaper: reg.fecha_emision_renaper,
            observaciones: reg.observaciones,
            analistaUsuario: reg.analista_usuario,
            analistaNombre: reg.analista_nombre,
          }),
        });
        const regSaved = res.validacion_ejemplar_manual || reg;
        info.validacion_ejemplar_manual = regSaved;
        const idx = state.solicitudesFirma.findIndex((x) => String(x.id) === String(info.solicitudId));
        if (idx >= 0) {
          state.solicitudesFirma[idx].validacion_ejemplar_manual = regSaved;
          renderBandejaFirmas();
        }
        const ovFicha = document.getElementById('modalFichaSolicitudFirmaOverlay');
        if (ovFicha && ovFicha.style.display !== 'none') {
          abrirFichaSolicitudFirma(info.solicitudId);
        }
      } else if (info.origen === 'auditoria20' && global._auditoria20Estado && global._auditoria20Estado.dni) {
        global._auditoria20Estado.dni.validacion_ejemplar_manual = reg;
        info.validacion_ejemplar_manual = reg;
        if (typeof global.actualizarEstadoEjemplarManualAudit20 === 'function') {
          global.actualizarEstadoEjemplarManualAudit20(reg);
        }
        if (typeof global.ejecutarAuditoriaIntegralAudit20 === 'function') {
          global.ejecutarAuditoriaIntegralAudit20(true);
        }
      } else if (info.origen === 'expediente' && global._fichaExpedienteActivoObj) {
        global._fichaExpedienteActivoObj.validacion_ejemplar_manual = reg;
        info.validacion_ejemplar_manual = reg;
      }

      const statusBox = document.getElementById('boxEstadoManualEjemplarModal');
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.style.background = reg.valido ? '#dcfce7' : '#fef2f2';
        statusBox.style.borderColor = reg.valido ? '#86efac' : '#fecaca';
        statusBox.style.color = reg.valido ? '#166534' : '#b91c1c';
        statusBox.innerHTML = reg.valido
          ? `✅ Marcado como <strong>VÁLIDO</strong> por ${escHtml(reg.analista_nombre)}.`
          : `⛔ Marcado como <strong>NO VÁLIDO</strong> por ${escHtml(reg.analista_nombre)}.`;
      }
      notify(
        reg.valido
          ? 'Validación manual de Ejemplar guardada como VÁLIDA.'
          : 'Validación manual de Ejemplar marcada como NO VÁLIDA.',
        reg.valido ? 'success' : 'warning'
      );
    } catch (err) {
      notify('Error guardando validación manual: ' + err.message, 'error');
    } finally {
      if (btnOk) btnOk.disabled = false;
      if (btnBad) btnBad.disabled = false;
    }
  }

  function abrirAsistenteRenaperMiEjemplar(datos) {
    bindRenaperBridgeListeners();
    const info = datos || {};
    const dniClean = String(info.dni || '').replace(/\D/g, '');
    const sexoLabel = normalizarSexoRenaper(info.sexo);
    const fechaNac = normalizarFechaDdMmAaaa(info.fecha_nacimiento);
    const ejemplar = String(info.ejemplar || '').trim().toUpperCase();
    const fechaEmisionFmt = normalizarFechaDdMmAaaa(info.fecha_emision) || String(info.fecha_emision || '').trim();
    const nombre = String(info.nombre || 'Asociado').trim();
    const prevManual = info.validacion_ejemplar_manual || null;

    const payloadExt = {
      nombre,
      dni: dniClean,
      sexo: sexoLabel,
      fecha_nacimiento: fechaNac,
      ejemplar,
      fecha_emision: fechaEmisionFmt,
    };
    renaperAssistState.lastDatos = info;

    if (dniClean) {
      copiarTextoSeguro(dniClean, 'DNI sin puntos (listo para pegar en RENAPER)');
    }

    const tieneExt = Boolean(
      document.documentElement &&
      document.documentElement.dataset &&
      document.documentElement.dataset.ammerSplitExt
    );

    if (tieneExt) {
      renaperAssistState.mode = 'extension';
      renaperAssistState.abierta = true;
      global.postMessage(
        { type: 'AMMER_OPEN_RENAPER_SPLIT', payload: payloadExt, requestId: String(Date.now()) },
        global.location.origin
      );
    } else {
      abrirPopupRenaperDerechaFallback(payloadExt);
    }

    let modal = document.getElementById('modalGuiaRenaperEjemplar');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalGuiaRenaperEjemplar';
      modal.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;max-width:430px;width:calc(100vw - 32px);max-height:88vh;overflow-y:auto;background:#ffffff;border:1.5px solid #135596;border-radius:16px;box-shadow:0 22px 50px rgba(15,23,42,0.28);padding:1.1rem;font-family:inherit;';
      document.body.appendChild(modal);
    }

    const rowFn = (lbl, val, copyId, copiedAuto) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0.48rem 0.68rem;margin-bottom:0.4rem;">
        <div style="min-width:0;">
          <div style="font-size:0.65rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">${escHtml(lbl)}</div>
          <div style="font-size:0.85rem;font-weight:800;color:#0f172a;word-break:break-word;">${escHtml(val || 'No informado')}${copiedAuto ? ' <span style="font-size:0.68rem;color:#059669;">(Copiado)</span>' : ''}</div>
        </div>
        ${copyId && val ? `<button type="button" class="firmas-btn firmas-btn--xs firmas-btn-soft-blue" data-copy-renaper="${escHtml(val)}">📋 Copiar</button>` : ''}
      </div>
    `;

    const extHintHtml = tieneExt
      ? ''
      : `
        <details class="firmas-accordion" style="margin-top:0.55rem;padding:0.55rem 0.75rem;font-size:0.71rem;color:#334155;">
          <summary style="font-size:0.73rem;">🧩 ¿Querés usar Pestaña Dividida nativa de Chrome + Autocompletado?</summary>
          <div style="margin-top:0.4rem;line-height:1.45;">
            1. <a href="downloads/ammer-renaper-split-view-ext.zip" download style="color:#135596;font-weight:700;text-decoration:underline;">Descargá la extensión AMMER (.zip)</a> y descomprimila.<br/>
            2. En Chrome abrí <code>chrome://extensions</code>, activá <strong>Modo de desarrollador</strong> y tocá <strong>Cargar descomprimida</strong>.<br/>
            3. Recargá esta página (<code>F5</code>). Desde Chrome 155 abre RENAPER en pestaña dividida real y completa el formulario solo.
          </div>
        </details>
      `;

    const estadoPrevDisplay = prevManual ? 'block' : 'none';
    const estadoPrevBg = prevManual ? (prevManual.valido ? '#dcfce7' : '#fef2f2') : '#f8fafc';
    const estadoPrevBd = prevManual ? (prevManual.valido ? '#86efac' : '#fecaca') : '#e2e8f0';
    const estadoPrevCol = prevManual ? (prevManual.valido ? '#166534' : '#b91c1c') : '#334155';
    const estadoPrevTxt = prevManual
      ? (prevManual.valido
        ? `✅ Marcado como <strong>VÁLIDO</strong> por ${escHtml(prevManual.analista_nombre || 'Asesor')}.`
        : `⛔ Marcado como <strong>NO VÁLIDO</strong> por ${escHtml(prevManual.analista_nombre || 'Asesor')}.`)
      : '';

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.55rem;padding-bottom:0.5rem;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:0.9rem;font-weight:800;color:#0f2744;">🪪 Asistente RENAPER Mi Ejemplar</div>
        <button type="button" class="firmas-btn firmas-btn--xs" style="width:28px;padding:0;" onclick="document.getElementById('modalGuiaRenaperEjemplar').style.display='none'" title="Ocultar asistente">✕</button>
      </div>
      <div id="boxEstadoVentanaRenaper" style="font-size:0.72rem;border:1px solid #86efac;border-radius:9px;padding:0.45rem 0.65rem;margin-bottom:0.5rem;line-height:1.38;"></div>
      <div style="font-size:0.76rem;color:#475569;margin-bottom:0.5rem;">Titular: <strong style="color:#0f172a;">${escHtml(nombre)}</strong></div>
      ${rowFn('1. DNI (solo dígitos)', dniClean, true, Boolean(dniClean))}
      ${rowFn('2. Sexo en DNI', sexoLabel, false, false)}
      ${rowFn('3. Fecha de Nacimiento (DD/MM/AAAA)', fechaNac, Boolean(fechaNac), false)}

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:11px;padding:0.65rem 0.75rem;margin:0.55rem 0;">
        <div style="font-size:0.7rem;font-weight:800;color:#135596;text-transform:uppercase;margin-bottom:0.4rem;">🔎 Datos del DNI para comparar con RENAPER</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:0.45rem;">
          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:9px;padding:0.42rem 0.58rem;">
            <div style="font-size:0.64rem;font-weight:700;color:#64748b;text-transform:uppercase;">Ejemplar en DNI</div>
            <div style="font-size:0.9rem;font-weight:800;color:#0f172a;">${escHtml(ejemplar ? ('Ejemplar ' + ejemplar) : 'No leído')}</div>
          </div>
          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:9px;padding:0.42rem 0.58rem;">
            <div style="font-size:0.64rem;font-weight:700;color:#64748b;text-transform:uppercase;">Fecha de Emisión</div>
            <div class="font-mono" style="font-size:0.9rem;font-weight:800;color:#135596;">${escHtml(fechaEmisionFmt || 'No leída')}</div>
          </div>
        </div>
      </div>

      <div class="firmas-section-box" style="padding:0.7rem 0.78rem;margin-bottom:0.55rem;">
        <div style="font-size:0.73rem;font-weight:800;color:#0f2744;margin-bottom:0.45rem;">⚖️ Validación Manual del Asesor</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:0.45rem;margin-bottom:0.45rem;">
          <div>
            <label class="firmas-label" style="font-size:0.67rem;margin-bottom:3px;">Ejemplar en RENAPER</label>
            <input type="text" id="inpRenaperCompEjemplar" class="firmas-input firmas-input--sm" maxlength="4" value="${escHtml((prevManual && prevManual.ejemplar_renaper) || ejemplar || '')}" placeholder="Ej: A / B / C" style="font-weight:700;text-transform:uppercase;"/>
          </div>
          <div>
            <label class="firmas-label" style="font-size:0.67rem;margin-bottom:3px;">Emisión en RENAPER</label>
            <input type="text" id="inpRenaperCompEmision" class="firmas-input firmas-input--sm font-mono" value="${escHtml((prevManual && prevManual.fecha_emision_renaper) || fechaEmisionFmt || '')}" placeholder="DD/MM/AAAA" style="font-weight:700;"/>
          </div>
        </div>
        <input type="text" id="inpRenaperCompObs" class="firmas-input firmas-input--sm" value="${escHtml((prevManual && prevManual.observaciones) || '')}" placeholder="Observaciones (opcional: coincide ejemplar y fecha)" style="margin-bottom:0.48rem;"/>
        <div id="boxEstadoManualEjemplarModal" style="display:${estadoPrevDisplay};background:${estadoPrevBg};border:1px solid ${estadoPrevBd};color:${estadoPrevCol};border-radius:8px;padding:0.42rem 0.58rem;font-size:0.74rem;margin-bottom:0.48rem;">${estadoPrevTxt}</div>
        <div style="display:flex;gap:0.45rem;">
          <button type="button" id="btnRenaperManualValido" class="firmas-btn firmas-btn--sm firmas-btn-emerald" style="flex:1;" onclick="window.guardarDecisionManualRenaperModal(true)">✅ Marcar Válido</button>
          <button type="button" id="btnRenaperManualInvalido" class="firmas-btn firmas-btn--sm firmas-btn-danger-solid" style="flex:1;" onclick="window.guardarDecisionManualRenaperModal(false)">⛔ Marcar No Válido</button>
        </div>
      </div>

      <div style="display:flex;gap:0.45rem;margin-top:0.45rem;flex-wrap:wrap;">
        <button type="button" id="btnCerrarVentanaRenaperModal" class="firmas-btn firmas-btn--sm" style="flex:1;" onclick="window.cerrarVentanaRenaperMiEjemplar()">✕ Cerrar RENAPER</button>
        <button type="button" id="btnReabrirVentanaRenaperModal" class="firmas-btn firmas-btn--sm firmas-btn-primary" style="display:none;flex:1;" onclick="window.abrirAsistenteRenaperMiEjemplar(window._ultimoPayloadRenaperModal)">↗️ Reabrir RENAPER</button>
      </div>
      ${extHintHtml}
    `;
    global._ultimoPayloadRenaperModal = info;
    modal.style.display = 'block';
    actualizarUiEstadoRenaperModal();
    modal.querySelectorAll('[data-copy-renaper]').forEach((btn) => {
      btn.addEventListener('click', () => {
        copiarTextoSeguro(btn.getAttribute('data-copy-renaper') || '', 'Dato RENAPER');
      });
    });
  }

  function abrirAsistenteRenaperPorId(solId) {
    const r = state.solicitudesFirma.find((x) => String(x.id) === String(solId));
    if (!r) return;
    const guia = r.datos_renaper_guia || {};
    abrirAsistenteRenaperMiEjemplar({
      solicitudId: r.id,
      nombre: r.nombre_solicitante || '-',
      dni: guia.dni || r.dni_solicitante || '',
      sexo: guia.sexo || '',
      fecha_nacimiento: guia.fecha_nacimiento || '',
      ejemplar: guia.ejemplar || '',
      fecha_emision: guia.fecha_emision || '',
      validacion_ejemplar_manual: r.validacion_ejemplar_manual || null,
      origen: 'firmas',
    });
  }

  function abrirAsistenteRenaperDesdeFicha() {
    const s = global._fichaExpedienteActivoObj;
    if (!s) {
      notify('No hay ningún expediente activo seleccionado.', 'warning');
      return;
    }
    const sol = s.solicitante || {};
    abrirAsistenteRenaperMiEjemplar({
      nombre: sol.nombre || s.Apellido_Nombre || s.nombre || 'Asociado',
      dni: sol.dni || s.dni || '',
      sexo: sol.sexo || s.sexo || '',
      fecha_nacimiento: sol.fechaNacimiento || sol.fecha_nacimiento || s.fechaNacimiento || '',
      ejemplar: sol.ejemplar || '',
      fecha_emision: sol.fechaEmision || sol.fecha_emision || '',
      validacion_ejemplar_manual: s.validacion_ejemplar_manual || null,
      origen: 'expediente',
    });
  }

  // ==================== FASE 4: BITÁCORA, RENOVAR, REVOCAR, FICHA & PADES ====================
  function ensureModalFase4Firmas(titleHtml, bodyHtml) {
    let ov = document.getElementById('modalFase4FirmasOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'modalFase4FirmasOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,0.58);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div style="background:#ffffff;border-radius:16px;max-width:660px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 24px 55px rgba(15,23,42,0.34);overflow:hidden;border:1px solid #cbd5e1;">
        <div style="padding:0.95rem 1.2rem;background:linear-gradient(135deg,#0c2340 0%,#135596 100%);color:#ffffff;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
          <div style="font-weight:800;font-size:0.96rem;">${titleHtml}</div>
          <button type="button" onclick="document.getElementById('modalFase4FirmasOverlay').style.display='none'" style="border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.14);color:#ffffff;border-radius:8px;width:30px;height:30px;font-weight:800;cursor:pointer;">✕</button>
        </div>
        <div style="padding:1.1rem 1.2rem;overflow-y:auto;">${bodyHtml}</div>
      </div>
    `;
    ov.style.display = 'flex';
  }

  async function verBitacoraEventosFirma(solId) {
    try {
      notify('Cargando bitácora forense...', 'info');
      const data = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/eventos`, { method: 'GET' });
      const evs = Array.isArray(data.eventos) ? data.eventos : [];
      const rowsHtml = evs.length === 0
        ? '<div style="padding:1rem;text-align:center;color:#64748b;">No hay eventos registrados todavía para esta solicitud.</div>'
        : evs.map((ev) => `
          <div style="border-left:3.5px solid #135596;background:#f8fafc;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:9px;padding:0.6rem 0.8rem;margin-bottom:0.55rem;">
            <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
              <strong style="color:#0f2744;font-size:0.82rem;">${escHtml(ev.evento || '-')}</strong>
              <span class="font-mono" style="font-size:0.72rem;color:#475569;">${escHtml((ev.created_at || '').slice(0, 19).replace('T', ' '))} UTC</span>
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">IP: <span class="font-mono">${escHtml(ev.ip_origen || '-')}</span> · UA: ${escHtml((ev.user_agent || '-').slice(0, 75))}</div>
            ${ev.detalle_json ? `<pre class="font-mono" style="margin:0.35rem 0 0;padding:0.45rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;font-size:0.68rem;overflow-x:auto;color:#334155;">${escHtml(JSON.stringify(ev.detalle_json, null, 2))}</pre>` : ''}
          </div>
        `).join('');
      ensureModalFase4Firmas(`🕵️ Bitácora Forense (${escHtml(solId.slice(0, 8))})`, rowsHtml);
    } catch (err) {
      notify('Error consultando bitácora: ' + err.message, 'error');
    }
  }

  async function renovarEnlaceSolicitudFirma(solId) {
    try {
      notify('Generando nuevo enlace válido por 24 horas...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/renovar`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      guardarEnlaceCacheado_(solId, {
        url_firma: res.url_firma,
        pin_otp: res.pin_otp,
        expira_en: res.expira_en,
      });
      const pinNote = res.pin_otp ? `\n\n🔐 Tu nuevo PIN de seguridad para confirmar la firma es: *${res.pin_otp}*` : '';
      const msg = `Hola ${res.nombre_solicitante || 'Estimado/a'}, te reenviamos desde Asociación Mutual Modelo de Entre Ríos (AMMER) el nuevo enlace seguro para firmar "${res.plantilla_nombre || 'Documento'}":\n\n${res.url_firma}${pinNote}\n\nVigencia: 24 horas.`;
      ensureModalFase4Firmas('🔄 Enlace Renovado (24hs)', `
        <div style="font-size:0.82rem;color:#166534;background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:0.75rem;font-weight:700;">
          ✅ Enlace anterior invalidado. Ya podés compartir el nuevo link o mostrar el QR presencial.
        </div>
        ${res.pin_otp ? `<div style="margin-bottom:0.65rem;padding:0.48rem 0.75rem;border-radius:9px;background:#f5f3ff;border:1px solid #ddd6fe;color:#5b21b6;font-weight:800;font-size:0.84rem;">🔐 Nuevo PIN 2FA: <span class="font-mono">${escHtml(res.pin_otp)}</span></div>` : ''}
        <div class="firmas-qr-card" style="margin-bottom:0.65rem;">
          <div id="qrFirmaRenovadoBox" class="firmas-qr-svg" title="Clic para ampliar código QR">
            <span style="font-size:0.7rem;color:#64748b;">Generando QR...</span>
          </div>
          <div style="flex:1;min-width:210px;display:flex;flex-direction:column;gap:0.5rem;">
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
              <input type="text" id="txtEnlaceRenovadoModal" class="firmas-input firmas-input--sm font-mono" readonly value="${escHtml(res.url_firma)}" style="flex:1;min-width:180px;"/>
              <button type="button" class="firmas-btn firmas-btn--sm" onclick="window.copiarInputPorId('txtEnlaceRenovadoModal', 'Nuevo enlace')" style="border-color:#059669;color:#047857;">📋 Copiar</button>
            </div>
            <div style="font-size:0.72rem;color:#475569;">📱 Hacé clic sobre el código QR para ampliarlo en pantalla si el asociado está presente.</div>
          </div>
        </div>
        <textarea id="txtMsgWaRenovadoModal" class="firmas-textarea" rows="4" style="font-size:0.79rem;margin-bottom:0.65rem;">${escHtml(msg)}</textarea>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="firmas-btn firmas-btn--sm" onclick="window.copiarInputPorId('txtMsgWaRenovadoModal', 'Mensaje WhatsApp')">📋 Copiar Mensaje</button>
          <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-emerald" onclick="window.abrirWhatsAppFirmante('${escHtml(res.telefono_whatsapp || '')}', 'txtMsgWaRenovadoModal')">💬 Abrir WhatsApp</button>
          <button type="button" class="firmas-btn firmas-btn--sm firmas-btn-soft-blue" onclick="window.notificarWhatsappSolicitud('${escHtml(solId)}', 'recordatorio')">🤖 Enviar por Bot WA</button>
        </div>
      `);
      renderQrEnElemento('qrFirmaRenovadoBox', res.url_firma, `Enlace Renovado · ${res.nombre_solicitante || 'Firmante'}`);
      await cargarBandejaFirmas();
    } catch (err) {
      notify('Error renovando enlace: ' + err.message, 'error');
    }
  }

  async function revocarSolicitudFirma(solId) {
    if (!global.confirm('¿Seguro que querés ANULAR esta solicitud de firma? El enlace actual dejará de funcionar inmediatamente.')) return;
    try {
      await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/revocar`, { method: 'POST' });
      notify('Solicitud de firma anulada correctamente.', 'success');
      await cargarBandejaFirmas();
    } catch (err) {
      notify('Error anulando solicitud: ' + err.message, 'error');
    }
  }

  function obtenerOperadorActualBaja_() {
    const sess = (typeof global.getSession === 'function')
      ? global.getSession()
      : (global.estadoApp && global.estadoApp.usuarioActual ? global.estadoApp.usuarioActual : null);
    const nombre = String((sess && (sess.nombre || sess.nombreCompleto)) || 'Operador AMMER').trim() || 'Operador AMMER';
    const usuario = String((sess && (sess.usuario || sess.username || sess.id)) || 'operador').trim() || 'operador';
    return { nombre, usuario };
  }

  function abrirModalBajaSolicitudFirma(solId) {
    const row = state.solicitudesFirma.find((x) => String(x.id) === String(solId)) || {};
    if (esSolicitudEnBaja(row)) {
      notify('Esta ficha ya se encuentra en la pestaña de Eliminados / Cancelados.', 'warning');
      return;
    }

    let ov = document.getElementById('modalBajaSolicitudFirmaOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'modalBajaSolicitudFirmaOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:1rem;';
      ov.addEventListener('click', (ev) => {
        if (ev.target === ov) ov.style.display = 'none';
      });
      document.body.appendChild(ov);
    }

    const op = obtenerOperadorActualBaja_();
    let lastWa = '';
    try { lastWa = localStorage.getItem('AMMER_LAST_WA_BAJA_NUM') || ''; } catch (_) {}

    ov.innerHTML = `
      <div style="background:#ffffff;border-radius:16px;max-width:490px;width:96vw;box-shadow:0 24px 60px rgba(15,23,42,0.38);border:1px solid #fecaca;overflow:hidden;">
        <div style="padding:0.95rem 1.25rem;background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 100%);color:#ffffff;display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
          <div style="font-weight:800;font-size:0.98rem;">🗑️ Cancelar / Desestimar / Borrar Ficha</div>
          <button type="button" onclick="document.getElementById('modalBajaSolicitudFirmaOverlay').style.display='none'" style="border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.16);color:#ffffff;border-radius:8px;width:30px;height:30px;font-weight:800;cursor:pointer;">✕</button>
        </div>
        <div style="padding:1.2rem 1.3rem;">
          <div class="firmas-section-box" style="padding:0.75rem 0.9rem;margin-bottom:0.95rem;font-size:0.8rem;">
            <div style="font-weight:800;color:#0f172a;">${escHtml(row.nombre_solicitante || 'Ficha seleccionada')}</div>
            <div style="color:#475569;margin-top:2px;">DNI ${escHtml(row.dni_solicitante || '-')} · ${escHtml(row.plantilla_nombre || '-')} (${escHtml(row.estado || '-')})</div>
            <div style="color:#0f2744;margin-top:4px;font-weight:700;">👤 Responsable que quedará registrado: ${escHtml(op.nombre)} (@${escHtml(op.usuario)})</div>
          </div>

          <div id="bajaStep1Wrap">
            <div style="margin-bottom:0.75rem;">
              <label for="selBajaAccionTipo" class="firmas-label">Tipo de baja / acción *</label>
              <select id="selBajaAccionTipo" class="firmas-select" style="font-weight:700;">
                <option value="DESESTIMADO">Desestimar ficha (sin curso)</option>
                <option value="CANCELADO">Cancelar solicitud</option>
                <option value="ELIMINADO">Eliminar / Borrar ficha</option>
              </select>
            </div>
            <div style="margin-bottom:0.75rem;">
              <label for="inpBajaWaTelefono" class="firmas-label">Número de WhatsApp para enviar código de validación *</label>
              <input type="tel" id="inpBajaWaTelefono" class="firmas-input" value="${escHtml(lastWa)}" placeholder="Ej: 3434123456 (sin 0 ni 15)"/>
              <div style="font-size:0.71rem;color:#64748b;margin-top:4px;">Se generará un código automático de 6 dígitos y se enviará a este WhatsApp para autorizar la baja.</div>
            </div>
            <div style="margin-bottom:0.95rem;">
              <label for="inpBajaMotivo" class="firmas-label">Motivo / Observación (opcional)</label>
              <input type="text" id="inpBajaMotivo" class="firmas-input" maxlength="250" placeholder="Ej: Datos erróneos, operación desistida por asociado..."/>
            </div>
            <div id="bajaErrBox1" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:0.6rem 0.8rem;font-size:0.79rem;font-weight:600;margin-bottom:0.8rem;"></div>
            <div style="display:flex;gap:0.55rem;justify-content:flex-end;">
              <button type="button" class="firmas-btn" onclick="document.getElementById('modalBajaSolicitudFirmaOverlay').style.display='none'">Cancelar</button>
              <button type="button" id="btnBajaEnviarOtpWa" class="firmas-btn firmas-btn-emerald">📲 Enviar Código por WhatsApp</button>
            </div>
          </div>

          <div id="bajaStep2Wrap" style="display:none;">
            <div id="bajaOtpInfoBanner" style="background:#ecfdf5;border:1px solid #86efac;color:#166534;border-radius:11px;padding:0.7rem 0.9rem;font-size:0.8rem;font-weight:700;margin-bottom:0.85rem;"></div>
            <div id="bajaWaFallbackWrap" style="display:none;margin-bottom:0.85rem;">
              <a id="lnkBajaWaManual" href="#" target="_blank" rel="noopener" class="firmas-btn firmas-btn-emerald">💬 Abrir WhatsApp Web para enviar código</a>
            </div>
            <div style="margin-bottom:0.85rem;">
              <label for="inpBajaOtpCodigo" class="firmas-label">Ingresá el código de 6 dígitos enviado por WhatsApp *</label>
              <input type="text" id="inpBajaOtpCodigo" class="firmas-input font-mono" inputmode="numeric" maxlength="6" placeholder="000000" style="height:48px;border:2px solid #0f2744;font-size:1.35rem;font-weight:800;letter-spacing:8px;text-align:center;"/>
            </div>
            <div id="bajaErrBox2" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:0.6rem 0.8rem;font-size:0.79rem;font-weight:600;margin-bottom:0.8rem;"></div>
            <div style="display:flex;gap:0.55rem;justify-content:space-between;flex-wrap:wrap;">
              <button type="button" id="btnBajaVolverStep1" class="firmas-btn">← Reenviar / Cambiar WA</button>
              <button type="button" id="btnBajaConfirmarFinal" class="firmas-btn firmas-btn-danger-solid">✅ Validar Código y Confirmar Baja</button>
            </div>
          </div>
        </div>
      </div>
    `;

    ov.style.display = 'flex';

    const btnEnviar = document.getElementById('btnBajaEnviarOtpWa');
    const btnConfirmar = document.getElementById('btnBajaConfirmarFinal');
    const btnVolver = document.getElementById('btnBajaVolverStep1');

    if (btnEnviar) {
      btnEnviar.addEventListener('click', async () => {
        const tel = String((document.getElementById('inpBajaWaTelefono') || {}).value || '').trim();
        const accion = String((document.getElementById('selBajaAccionTipo') || {}).value || 'DESESTIMADO').trim();
        const motivo = String((document.getElementById('inpBajaMotivo') || {}).value || '').trim();
        const err1 = document.getElementById('bajaErrBox1');
        err1.style.display = 'none';

        if (tel.replace(/\D/g, '').length < 8) {
          err1.textContent = 'Ingresá un número de WhatsApp válido (mínimo 8 dígitos).';
          err1.style.display = 'block';
          return;
        }

        try { localStorage.setItem('AMMER_LAST_WA_BAJA_NUM', tel); } catch (_) {}

        btnEnviar.disabled = true;
        btnEnviar.textContent = '⏳ Generando y enviando código...';
        try {
          const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/baja/solicitar-codigo`, {
            method: 'POST',
            body: JSON.stringify({
              telefono_whatsapp: tel,
              accion,
              motivo,
              operador_nombre: op.nombre,
              operador_usuario: op.usuario,
            }),
          });
          document.getElementById('bajaStep1Wrap').style.display = 'none';
          document.getElementById('bajaStep2Wrap').style.display = 'block';
          const infoEl = document.getElementById('bajaOtpInfoBanner');
          const fbWrap = document.getElementById('bajaWaFallbackWrap');
          const lnkWa = document.getElementById('lnkBajaWaManual');
          if (res.enviado_por_bot) {
            infoEl.textContent = `✓ Código de 6 dígitos enviado por el Bot WhatsApp AMMER al ${res.telefono_enmascarado || tel}. Vence en ${res.expira_minutos || 10} min.`;
            fbWrap.style.display = 'none';
          } else {
            infoEl.textContent = `⚠️ Bot WhatsApp desconectado (${res.motivo || 'envío manual'}). Usá el botón verde de abajo para enviarte el código por WhatsApp Web al ${res.telefono_enmascarado || tel}:`;
            if (res.wa_link && lnkWa) {
              lnkWa.href = res.wa_link;
              fbWrap.style.display = 'block';
            }
          }
          setTimeout(() => {
            const cEl = document.getElementById('inpBajaOtpCodigo');
            if (cEl) cEl.focus();
          }, 80);
        } catch (err) {
          err1.textContent = err.message || 'No se pudo generar el código por WhatsApp.';
          err1.style.display = 'block';
        } finally {
          btnEnviar.disabled = false;
          btnEnviar.textContent = '📲 Enviar Código por WhatsApp';
        }
      });
    }

    if (btnVolver) {
      btnVolver.addEventListener('click', () => {
        document.getElementById('bajaErrBox2').style.display = 'none';
        document.getElementById('bajaStep2Wrap').style.display = 'none';
        document.getElementById('bajaStep1Wrap').style.display = 'block';
      });
    }

    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        const codigo = String((document.getElementById('inpBajaOtpCodigo') || {}).value || '').replace(/\D/g, '');
        const accion = String((document.getElementById('selBajaAccionTipo') || {}).value || 'DESESTIMADO').trim();
        const motivo = String((document.getElementById('inpBajaMotivo') || {}).value || '').trim();
        const err2 = document.getElementById('bajaErrBox2');
        err2.style.display = 'none';

        if (codigo.length !== 6) {
          err2.textContent = 'Ingresá el código de 6 dígitos recibido en tu WhatsApp.';
          err2.style.display = 'block';
          return;
        }

        btnConfirmar.disabled = true;
        btnConfirmar.textContent = '⏳ Validando código...';
        try {
          const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/baja/confirmar`, {
            method: 'POST',
            body: JSON.stringify({
              codigo,
              accion,
              motivo,
              operador_nombre: op.nombre,
              operador_usuario: op.usuario,
            }),
          });
          ov.style.display = 'none';
          const fichaOv = document.getElementById('modalFichaSolicitudFirmaOverlay');
          if (fichaOv) fichaOv.style.display = 'none';
          notify(`Ficha movida a Eliminados / Cancelados (${res.estado}) por ${op.nombre} (@${op.usuario}).`, 'success');
          await cargarBandejaFirmas();
        } catch (err) {
          err2.textContent = err.message || 'Código inválido o vencido.';
          err2.style.display = 'block';
        } finally {
          btnConfirmar.disabled = false;
          btnConfirmar.textContent = '✅ Validar Código y Confirmar Baja';
        }
      });
    }
  }

  async function enviarAFirmaDesdeFicha() {
    const expId = global._fichaExpedienteActivoId || (global._fichaExpedienteActivoObj && global._fichaExpedienteActivoObj.id);
    if (typeof global.cerrarModal === 'function') global.cerrarModal('modalFichaCompleta');
    if (typeof global.cambiarPestana === 'function') global.cambiarPestana('firmasAmmer');
    await initFirmasAmmerView();
    cambiarTabFirmas('generar');
    if (expId) {
      const sel = document.getElementById('selFirmaExpediente');
      if (sel) {
        sel.value = String(expId);
        renderCamposCompletarFormulario();
      }
    }
  }

  async function abrirModalCertificadoPades() {
    try {
      notify('Consultando estado de certificado PAdES (.p12)...', 'info');
      const st = await apiFetchJson('/api/firmas/pades/estado', { method: 'GET' });
      const c = st.certificado || {};
      const body = `
        <div style="font-size:0.83rem;color:#334155;margin-bottom:0.9rem;line-height:1.48;">
          Cada documento completado recibe un sello criptográfico <strong>PAdES (.p12)</strong> embebido dentro del PDF para detectar alteraciones en Adobe Reader.
          Hoy está operando en modo: <strong style="color:#3730a3;">${escHtml(st.modo || '-')}</strong>
        </div>
        <div class="firmas-section-box" style="padding:0.85rem;font-size:0.79rem;margin-bottom:0.9rem;display:flex;flex-direction:column;gap:4px;">
          <div><strong>Titular (CN):</strong> ${escHtml(c.subject_cn || '-')}</div>
          <div><strong>Emisor:</strong> ${escHtml(c.issuer_cn || '-')}</div>
          <div><strong>Tipo:</strong> ${c.autofirmado ? 'Autofirmado institucional gratuito' : 'Certificado externo / Autoridad Certificante'}</div>
          <div class="font-mono" style="margin-top:4px;word-break:break-all;"><strong>Huella SHA-256:</strong> ${escHtml(c.fingerprint_sha256 || '-')}</div>
        </div>
        <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:0.9rem;">
          <div style="font-size:0.82rem;font-weight:800;color:#3730a3;margin-bottom:4px;">Generar .p12 autofirmado estable para fijar en Render</div>
          <div style="font-size:0.74rem;color:#4338ca;margin-bottom:0.65rem;line-height:1.42;">Si querés mantener exactamente la misma huella entre reinicios o cuando contrates un certificado AATL/licenciado, configurá <code>PADES_P12_BASE64</code> y <code>PADES_P12_PASSWORD</code> en Render.</div>
          <button type="button" id="btnGenerarP12Modal" class="firmas-btn firmas-btn--sm" style="border-color:#4338ca;background:#4338ca;color:#ffffff;">🔐 Generar y Descargar .p12 + Base64</button>
          <div id="boxResultadoGenP12" style="display:none;margin-top:0.7rem;"></div>
        </div>
      `;
      ensureModalFase4Firmas('🔐 Certificado Criptográfico PDF PAdES (.p12)', body);
      const btnGen = document.getElementById('btnGenerarP12Modal');
      if (btnGen) {
        btnGen.addEventListener('click', async () => {
          btnGen.disabled = true;
          btnGen.textContent = '⏳ Generando RSA-2048 PKCS#12...';
          try {
            const g = await apiFetchJson('/api/firmas/pades/generar-p12', { method: 'POST', body: JSON.stringify({}) });
            const rawBin = atob(g.p12Base64);
            const arr = new Uint8Array(rawBin.length);
            for (let i = 0; i < rawBin.length; i++) arr[i] = rawBin.charCodeAt(i);
            const url = URL.createObjectURL(new Blob([arr], { type: 'application/x-pkcs12' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'AMMER_PAdES_Institucional.p12';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            const outBox = document.getElementById('boxResultadoGenP12');
            if (outBox) {
              outBox.style.display = 'block';
              outBox.innerHTML = `
                <div style="font-size:0.75rem;color:#166534;font-weight:700;margin-bottom:5px;">✅ Descargado AMMER_PAdES_Institucional.p12 (cargá su clave propia en <code>PADES_P12_PASSWORD</code> en Render)</div>
                <textarea id="txtP12Base64Out" class="firmas-textarea font-mono" rows="3" readonly style="font-size:0.69rem;margin-bottom:5px;">${escHtml(g.p12Base64)}</textarea>
                <button type="button" class="firmas-btn firmas-btn--xs" onclick="window.copiarInputPorId('txtP12Base64Out', 'PADES_P12_BASE64')">📋 Copiar PADES_P12_BASE64</button>
              `;
            }
          } catch (e) {
            notify('Error generando .p12: ' + e.message, 'error');
          } finally {
            btnGen.disabled = false;
            btnGen.textContent = '🔐 Generar y Descargar .p12 + Base64';
          }
        });
      }
    } catch (err) {
      notify('Error consultando PAdES: ' + err.message, 'error');
    }
  }

  let _firmasExpIndexPromise = null;
  let _firmasExpIndexLoaded = false;
  let _firmasPorExpMap = new Map();

  function esAdminOAnalistaFirma() {
    try {
      const sess = (typeof global.getSession === 'function') ? global.getSession() : null;
      const rol = String((sess && (sess.rol || sess.role)) || '').trim().toLowerCase();
      return rol === 'admin' || rol === 'administrador' || rol === 'analista';
    } catch (_) {
      return false;
    }
  }

  function _prioridadEstadoFirma(estRaw) {
    const e = String(estRaw || '').trim().toUpperCase();
    if (e === 'FIRMADO') return 4;
    if (e === 'PARCIAL') return 3;
    if (e === 'LEIDO') return 2;
    return 1;
  }

  function _reconstruirIndiceFirmasPorExpediente() {
    const mapa = new Map();
    const lista = Array.isArray(state.solicitudesFirma) ? state.solicitudesFirma : [];
    for (const r of lista) {
      if (!r || esSolicitudEnBaja(r)) continue;
      if (r.mostrar_validacion_expediente === false) continue;
      const keys = [
        r.expediente_id,
        r.expediente_uid,
        r.expediente_provisorio,
        r.expediente_definitivo,
      ]
        .map((k) => String(k || '').trim().toUpperCase())
        .filter(Boolean);
      if (keys.length === 0) continue;

      for (const k of keys) {
        const prev = mapa.get(k);
        if (!prev) {
          mapa.set(k, r);
          continue;
        }
        const pNew = _prioridadEstadoFirma(r.estado);
        const pOld = _prioridadEstadoFirma(prev.estado);
        if (pNew > pOld || (pNew === pOld && String(r.created_at || '') > String(prev.created_at || ''))) {
          mapa.set(k, r);
        }
      }
    }
    _firmasPorExpMap = mapa;
    _firmasExpIndexLoaded = true;
  }

  async function cargarIndiceFirmasPorExpediente(force = false) {
    if (!esAdminOAnalistaFirma()) return _firmasPorExpMap;
    if (!force && _firmasExpIndexLoaded) return _firmasPorExpMap;
    if (_firmasExpIndexPromise && !force) return _firmasExpIndexPromise;

    _firmasExpIndexPromise = (async () => {
      try {
        const data = await apiFetchJson('/api/firmas/solicitudes', { method: 'GET' });
        if (data && Array.isArray(data.solicitudes)) {
          state.solicitudesFirma = data.solicitudes;
          _reconstruirIndiceFirmasPorExpediente();
          if (typeof global.renderModuloMutualPropias === 'function') {
            global.renderModuloMutualPropias();
          }
          if (typeof global.renderModuloMutual === 'function') {
            global.renderModuloMutual();
          }
        }
      } catch (_) {
        // Silencioso si no hay sesión lista aún
      } finally {
        _firmasExpIndexPromise = null;
      }
      return _firmasPorExpMap;
    })();

    return _firmasExpIndexPromise;
  }

  function obtenerFirmaVinculadaAExpediente(solicitudObj) {
    if (!esAdminOAnalistaFirma() || !solicitudObj) return null;
    if (!_firmasExpIndexLoaded) {
      cargarIndiceFirmasPorExpediente(false);
      return null;
    }
    const candidates = [
      solicitudObj.id_definitivo,
      solicitudObj.ID_Definitivo_Expediente,
      solicitudObj.Nro_Definitivo,
      solicitudObj.id_provisorio,
      solicitudObj.idProvisorio,
      solicitudObj.id,
    ]
      .map((k) => String(k || '').trim().toUpperCase())
      .filter(Boolean);

    for (const k of candidates) {
      if (_firmasPorExpMap.has(k)) {
        return _firmasPorExpMap.get(k);
      }
    }
    return null;
  }

  async function abrirValidacionFirmaExpediente(solicitudId) {
    if (!esAdminOAnalistaFirma()) {
      notify('⛔ Solo usuarios Admin o Analista pueden ver la validación de firma.', 'error');
      return;
    }
    const all = (typeof global.getStoredSolicitudes === 'function') ? global.getStoredSolicitudes() : [];
    const sol = all.find((x) => String(x.id) === String(solicitudId) || String(x.id_provisorio) === String(solicitudId) || String(x.id_definitivo) === String(solicitudId));
    let firma = sol ? obtenerFirmaVinculadaAExpediente(sol) : null;
    if (!firma) {
      await cargarIndiceFirmasPorExpediente(true);
      firma = sol ? obtenerFirmaVinculadaAExpediente(sol) : null;
    }
    if (!firma || !firma.id) {
      notify('No se encontró una firma electrónica vinculada a este expediente.', 'warning');
      return;
    }
    return abrirFichaSolicitudFirma(firma.id);
  }

  // Exportar API global
  global.initFirmasAmmerView = initFirmasAmmerView;
  global.cambiarTabFirmas = cambiarTabFirmas;
  global.onPlantillaGenerarChange = onPlantillaGenerarChange;
  global.togglePlantillaEnPaquete = togglePlantillaEnPaquete;
  global.renderCamposCompletarFormulario = renderCamposCompletarFormulario;
  global.limpiarInputGenerarCampo = limpiarInputGenerarCampo;
  global.agregarFirmanteGenerador = agregarFirmanteGenerador;
  global.eliminarFirmanteGenerador = eliminarFirmanteGenerador;
  global.moverOrdenFirmanteGenerador = moverOrdenFirmanteGenerador;
  global.actualizarDatoFirmanteGenerador = actualizarDatoFirmanteGenerador;
  global.onArchivoSelloPngSeleccionado = onArchivoSelloPngSeleccionado;
  global.limpiarSelloPngOficial = limpiarSelloPngOficial;
  global.previsualizarPdfGenerado = previsualizarPdfGenerado;
  global.generarEnlaceFirmaMovil = generarEnlaceFirmaMovil;
  global.notificarWhatsappSolicitud = notificarWhatsappSolicitud;
  global.enviarDirectoBotWaGenerado = enviarDirectoBotWaGenerado;
  global.ampliarQrModal = ampliarQrModal;
  global.copiarInputPorId = copiarInputPorId;
  global.abrirWhatsAppFirmante = abrirWhatsAppFirmante;
  global.descargarUltimoPreviewPdfFirma = () => {
    if (!state.ultimoPdfPreviewB64) { notify('Generá una vista previa primero.', 'warning'); return; }
    descargarBase64Pdf(state.ultimoPdfPreviewB64, 'Documento_AMMER_Completado.pdf');
  };
  global.limpiarCanvasFirmaPrueba = limpiarCanvasFirmaPrueba;
  global.cargarBandejaFirmas = cargarBandejaFirmas;
  global.renderBandejaFirmas = renderBandejaFirmas;
  global.setFiltroEstadoBandejaFirmas = setFiltroEstadoBandejaFirmas;
  global.exportarBandejaFirmasCsv = exportarBandejaFirmasCsv;
  global.copiarORenovarEnlaceFila = copiarORenovarEnlaceFila;
  global.descargarPdfSolicitudFirma = descargarPdfSolicitudFirma;
  global.descargarTsrSolicitudFirma = descargarTsrSolicitudFirma;
  global.respaldarSolicitudEnDrive = respaldarSolicitudEnDrive;
  global.migrarVideoPruebaVidaDrive = migrarVideoPruebaVidaDrive;
  global.verBitacoraEventosFirma = verBitacoraEventosFirma;
  global.renovarEnlaceSolicitudFirma = renovarEnlaceSolicitudFirma;
  global.abrirFichaSolicitudFirma = abrirFichaSolicitudFirma;
  global.cambiarTabFichaSolicitudModal = cambiarTabFichaSolicitudModal;
  global.zoomFichaPdfModal = zoomFichaPdfModal;
  global.revocarSolicitudFirma = revocarSolicitudFirma;
  global.abrirModalBajaSolicitudFirma = abrirModalBajaSolicitudFirma;
  global.enviarAFirmaDesdeFicha = enviarAFirmaDesdeFicha;
  global.abrirModalCertificadoPades = abrirModalCertificadoPades;
  global.abrirAsistenteRenaperMiEjemplar = abrirAsistenteRenaperMiEjemplar;
  global.guardarDecisionManualRenaperModal = guardarDecisionManualRenaperModal;
  global.cerrarVentanaRenaperMiEjemplar = cerrarVentanaRenaperMiEjemplar;
  global.abrirAsistenteRenaperPorId = abrirAsistenteRenaperPorId;
  global.abrirAsistenteRenaperDesdeFicha = abrirAsistenteRenaperDesdeFicha;
  global.onArchivoPdfPlantillaSeleccionado = onArchivoPdfPlantillaSeleccionado;
  global.reanalizarPdfConIaEditor = reanalizarPdfConIaEditor;
  global.cargarPlantillaEnEditor = cargarPlantillaEnEditor;
  global.duplicarPlantillaActualEditor = duplicarPlantillaActualEditor;
  global.eliminarPlantillaActualEditor = eliminarPlantillaActualEditor;
  global.cambiarPaginaEditor = cambiarPaginaEditor;
  global.setZoomEditorPdf = setZoomEditorPdf;
  global.zoomEditorPdf = zoomEditorPdf;
  global.ajustarZoomEditorPdf = ajustarZoomEditorPdf;
  global.toggleVistaLimpiaEditor = toggleVistaLimpiaEditor;
  global.toggleGrillaSnapEditor = toggleGrillaSnapEditor;
  global.activarModoClickAgregarCampo = activarModoClickAgregarCampo;
  global.deshacerCambioEditor = deshacerCambioEditor;
  global.renderInspectorCamposEditor = renderInspectorCamposEditor;
  global.seleccionarCampoEditor = seleccionarCampoEditor;
  global.actualizarPropCampoEditor = actualizarPropCampoEditor;
  global.actualizarOrigenCampoEditor = actualizarOrigenCampoEditor;
  global.vaciarValorCampoEditor = vaciarValorCampoEditor;
  global.convertirCampoSoloBorradorEditor = convertirCampoSoloBorradorEditor;
  global.duplicarCampoEditor = duplicarCampoEditor;
  global.eliminarCampoEditor = eliminarCampoEditor;
  global.alinearCampoEditor = alinearCampoEditor;
  global.limpiarEditorPlantillaPdf = limpiarEditorPlantillaPdf;
  global.guardarPlantillaDesdeEditor = guardarPlantillaDesdeEditor;
  global.probarEstampadoEditor = probarEstampadoEditor;
  global.exportarExpedienteCompletoZip = exportarExpedienteCompletoZip;
  global.esAdminOAnalistaFirma = esAdminOAnalistaFirma;
  global.cargarIndiceFirmasPorExpediente = cargarIndiceFirmasPorExpediente;
  global.obtenerFirmaVinculadaAExpediente = obtenerFirmaVinculadaAExpediente;
  global.abrirValidacionFirmaExpediente = abrirValidacionFirmaExpediente;
  global.aplicarPresetValidacionFirmas = aplicarPresetValidacionFirmas;
  global.onToggleValidacionGenerador = onToggleValidacionGenerador;
  global.actualizarPreviewFraseVozGenerador = actualizarPreviewFraseVozGenerador;
})(window);
