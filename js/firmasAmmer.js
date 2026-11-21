(function (global) {
  'use strict';

  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const LS_SELLO_KEY = 'AMMER_SELLO_OFICIAL_PNG';

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
    plantillas: [],
    solicitudesFirma: [],
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
      archivoNombre: '',
      totalPages: 1,
      currentPage: 1,
      campos: [],
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

    const ctx = {
      expediente: { id: expId },
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
    const tabs = ['generar', 'bandeja', 'editor'];
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
        if (k === tabKey) {
          btn.style.background = '#0f2744';
          btn.style.color = '#ffffff';
          btn.style.borderColor = '#0f2744';
          btn.style.boxShadow = '0 2px 6px rgba(15,39,68,0.22)';
        } else {
          btn.style.background = '#f8fafc';
          btn.style.color = '#1e293b';
          btn.style.borderColor = '#cbd5e1';
          btn.style.boxShadow = 'none';
        }
      }
      if (pnl) pnl.style.display = k === tabKey ? 'block' : 'none';
    });
    if (tabKey === 'bandeja') cargarBandejaFirmas();
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
      cont.innerHTML = '<span style="font-size:0.74rem;color:#64748b;">No hay plantillas disponibles aún.</span>';
      return;
    }
    cont.innerHTML = state.plantillas.map((p) => {
      const checked = state.selectedPlantillasPaqueteIds.includes(p.id);
      return `
        <label style="display:inline-flex;align-items:center;gap:6px;padding:0.35rem 0.65rem;border-radius:8px;border:1px solid ${checked ? '#1d4ed8' : '#cbd5e1'};background:${checked ? '#dbeafe' : '#ffffff'};color:${checked ? '#1e3a8a' : '#334155'};font-size:0.76rem;font-weight:700;cursor:pointer;">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.togglePlantillaEnPaquete('${escHtml(p.id)}', this.checked)"/>
          ${escHtml(p.nombre)} <span style="font-weight:500;color:#64748b;">(${p.paginas || 1}p)</span>
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
      <div style="display:grid;grid-template-columns:minmax(140px,1fr) minmax(150px,1.2fr) minmax(105px,0.8fr) minmax(115px,0.9fr) auto;gap:0.45rem;align-items:end;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem;">
        <div>
          <label style="display:block;font-size:0.68rem;font-weight:700;color:#475569;">Turno #${idx + 1} · ${escHtml(f.clave)}</label>
          <input type="text" value="${escHtml(f.etiqueta)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'etiqueta', this.value)" style="width:100%;padding:0.35rem 0.45rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.78rem;"/>
        </div>
        <div>
          <label style="display:block;font-size:0.68rem;font-weight:700;color:#475569;">Nombre completo</label>
          <input type="text" value="${escHtml(f.nombre)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'nombre', this.value)" placeholder="Nombre y Apellido" style="width:100%;padding:0.35rem 0.45rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.78rem;"/>
        </div>
        <div>
          <label style="display:block;font-size:0.68rem;font-weight:700;color:#475569;">DNI</label>
          <input type="text" value="${escHtml(f.dni)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'dni', this.value)" placeholder="Sin puntos" style="width:100%;padding:0.35rem 0.45rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.78rem;"/>
        </div>
        <div>
          <label style="display:block;font-size:0.68rem;font-weight:700;color:#475569;">WhatsApp</label>
          <input type="text" value="${escHtml(f.telefono)}" oninput="window.actualizarDatoFirmanteGenerador(${idx}, 'telefono', this.value)" placeholder="3434..." style="width:100%;padding:0.35rem 0.45rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.78rem;"/>
        </div>
        <div style="display:flex;gap:3px;align-items:center;">
          ${state.firmantesGenerar.length > 1 ? `
            <button type="button" onclick="window.moverOrdenFirmanteGenerador(${idx}, -1)" title="Subir orden" style="padding:0.3rem 0.42rem;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;font-size:0.72rem;cursor:pointer;">▲</button>
            <button type="button" onclick="window.moverOrdenFirmanteGenerador(${idx}, 1)" title="Bajar orden" style="padding:0.3rem 0.42rem;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;font-size:0.72rem;cursor:pointer;">▼</button>
            <button type="button" onclick="window.eliminarFirmanteGenerador(${idx})" title="Quitar firmante" style="padding:0.32rem 0.5rem;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:0.75rem;cursor:pointer;">🗑️</button>
          ` : '<span style="font-size:0.72rem;color:#94a3b8;padding:0 4px;">#1</span>'}
        </div>
      </div>
    `).join('');
  }

  function combinarValidacionesPaquete(tplsList) {
    const res = { firma_olografa: true, tapar_resaltados: true };
    (tplsList || []).forEach((t) => {
      const v = t.validaciones_json || {};
      ['dni_frente_dorso', 'selfie_liveness', 'gps_obligatorio', 'requiere_sello_png', 'requiere_pin_otp'].forEach((k) => {
        if (v[k]) res[k] = true;
      });
      if (v.tapar_resaltados === false) res.tapar_resaltados = false;
    });
    return res;
  }

  function renderCamposCompletarFormulario() {
    const cont = document.getElementById('firmaCamposGenerarContainer');
    const badgeVal = document.getElementById('firmaValidacionesResumen');
    const selloWrap = document.getElementById('firmaSelloInstitucionalWrap');
    if (!cont) return;

    const tpls = obtenerPlantillasSeleccionadasGenerador();
    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    renderFirmantesGenerar(ctx);

    if (tpls.length === 0) {
      if (selloWrap) selloWrap.style.display = 'none';
      cont.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.84rem;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1;">Seleccioná una plantilla arriba (o cargá tus PDFs en el <strong>Editor Visual de Plantillas PDF</strong> si todavía no creaste ninguna).</div>';
      if (badgeVal) badgeVal.innerHTML = '';
      return;
    }

    const todosCampos = [];
    tpls.forEach((tpl) => {
      (Array.isArray(tpl.campos_json) ? tpl.campos_json : []).forEach((c) => {
        todosCampos.push({ campo: c, docNombre: tpl.nombre || 'PDF' });
      });
    });

    const vals = combinarValidacionesPaquete(tpls);
    const usaSello = Boolean(vals.requiere_sello_png) || todosCampos.some(({ campo }) => String(campo.tipo || '').toLowerCase() === 'sello');
    if (selloWrap) selloWrap.style.display = usaSello ? 'block' : 'none';
    renderPreviewSelloPng();

    if (badgeVal) {
      const chips = [];
      if (tpls.length > 1) chips.push(`📦 Paquete unificado: ${tpls.length} PDFs`);
      chips.push(`👥 ${state.firmantesGenerar.length} ${state.firmantesGenerar.length === 1 ? 'firmante' : 'firmantes requeridos'}`);
      if (usaSello) chips.push('🏛️ Sello Institucional PNG');
      if (vals.firma_olografa !== false) chips.push('✍️ Firma manuscrita');
      if (vals.gps_obligatorio) chips.push('📍 GPS');
      if (vals.tapar_resaltados !== false) chips.push('🧹 Limpia resaltados amarillos');
      if (vals.dni_frente_dorso) chips.push('🪪 DNI Frente y Dorso');
      if (vals.selfie_liveness) chips.push('🤳 Selfie Liveness + Cotejo Facial');
      if (vals.requiere_pin_otp) chips.push('🔐 PIN 2FA (4 dígitos)');
      badgeVal.innerHTML = chips.map((c) => `<span style="font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:9999px;background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe;">${escHtml(c)}</span>`).join(' ');
    }

    const inpWa = document.getElementById('inpFirmaTelefonoWa');
    if (inpWa && ctx.solicitante.telefono) inpWa.value = ctx.solicitante.telefono;

    const camposEditables = todosCampos.filter(({ campo }) =>
      campo.tipo !== 'firma' && campo.tipo !== 'sello' && campo.tipo !== 'borrador' && campo.origen_campo !== 'campo_vacio'
    );
    if (camposEditables.length === 0) {
      cont.innerHTML = '<div style="padding:0.85rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.82rem;color:#475569;">Estas plantillas no tienen campos de texto editables (solo zonas limpiadas, firma o sello).</div>';
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

    cont.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:0.65rem;">' +
      itemsUnificados.map(({ campo: c, docs, sharedOrigen }) => {
        const val = resolverPreviewLocal(c, ctx);
        const attr = sharedOrigen
          ? `data-firma-origen-valor="${escHtml(sharedOrigen)}"`
          : `data-firma-campo-valor="${escHtml(c.id)}"`;
        const alcance = docs.size > 1
          ? `<span style="font-weight:700;color:#1d4ed8;">(Aplica a ${docs.size} PDFs)</span>`
          : `<span style="font-weight:500;color:#94a3b8;">(${tpls.length > 1 ? escHtml([...docs][0].slice(0, 18)) : 'Pág.' + (c.pagina || 1)})</span>`;
        return `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.65rem;">
            <label style="display:block;font-size:0.71rem;font-weight:700;color:#475569;margin-bottom:3px;">
              ${escHtml(c.etiqueta || c.id)} ${alcance}
            </label>
            <div style="display:flex;gap:4px;align-items:center;">
              <input type="text" ${attr} value="${escHtml(val)}" oninput="this.dataset.userEdited='1'" placeholder="Dejar vacío o ingresar..." style="flex:1;min-width:0;padding:0.38rem 0.55rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.82rem;background:#ffffff;color:#0f172a;"/>
              <button type="button" onclick="window.limpiarInputGenerarCampo(this)" title="Vaciar texto para dejar el campo en blanco en el PDF" style="padding:0.36rem 0.5rem;border-radius:6px;border:1px solid #cbd5e1;background:#ffffff;color:#0369a1;font-size:0.75rem;cursor:pointer;">🧹</button>
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
    const vals = combinarValidacionesPaquete(tpls);

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
    const tpls = obtenerPlantillasSeleccionadasGenerador();
    if (tpls.length === 0) {
      notify('Seleccioná al menos una plantilla PDF primero.', 'warning');
      return;
    }
    const tpl = tpls[0];
    const vals = combinarValidacionesPaquete(tpls);
    if (vals.requiere_sello_png && !state.selloPngBase64) {
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

    const nombreDocLabel = tpls.length > 1
      ? `Paquete (${tpls.length} docs): ${tpls.map((t) => t.nombre).slice(0, 3).join(' + ')}`
      : tpl.nombre;

    notify(tpls.length > 1 ? `Generando paquete unificado (${tpls.length} PDFs)...` : 'Generando enlace(s) seguro(s) de firma 24hs...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          plantilla_id: tpl.id,
          plantillas_ids: tpls.map((t) => t.id),
          plantilla_nombre: tpls.length > 1 ? nombreDocLabel : tpl.nombre,
          expediente_id: exp ? String(exp.id_definitivo || exp.id_provisorio || exp.id) : null,
          dni_solicitante: firmantesPayload[0].dni || ctx.solicitante.dni || '',
          nombre_solicitante: firmantesPayload[0].nombre || ctx.solicitante.nombre || 'Asociado/a',
          telefono_whatsapp: firmantesPayload[0].telefono || telWa,
          contexto: ctx,
          selloPngBase64: state.selloPngBase64 || null,
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
        : [{ etiqueta: 'Firmante 1', nombre: firmantesPayload[0].nombre, telefono: telWa, url_firma: res.url_firma, orden: 1 }];

      if (listCont) {
        listCont.innerHTML = enlaces.map((item, idx) => {
          const pinNote = item.pin_otp ? `\n\n🔐 Tu código PIN de seguridad para confirmar la firma es: *${item.pin_otp}*` : '';
          const msg = `Hola ${item.nombre || 'Estimado/a'}, te compartimos desde Asociación Mutual Modelo de Entre Ríos (AMMER) el enlace seguro para revisar y firmar "${nombreDocLabel}" (${item.etiqueta || 'Firmante'}):\n\n${item.url_firma}${pinNote}\n\nEste enlace es personal y tiene vigencia de 24 horas.`;
          const pinBadge = item.pin_otp
            ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:0.45rem;padding:0.32rem 0.65rem;border-radius:8px;background:#f5f3ff;border:1px solid #ddd6fe;color:#5b21b6;font-size:0.78rem;font-weight:800;">🔐 PIN 2FA para firmar: <span class="font-mono" style="font-size:0.9rem;letter-spacing:2px;">${escHtml(item.pin_otp)}</span></div>`
            : '';
          const waAutoBadge = item.whatsapp_auto && item.whatsapp_auto.ok
            ? '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9999px;background:#dcfce7;color:#166534;font-size:0.68rem;font-weight:800;">🤖 Enviado por Bot WA</span>'
            : (ordenSecuencial && (item.orden || idx + 1) > 1
              ? '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9999px;background:#fff7ed;color:#9a3412;font-size:0.68rem;font-weight:700;">⏳ Se habilita al firmar turno previo</span>'
              : '');
          return `
            <div style="background:#ffffff;border:1px solid #a7f3d0;border-radius:10px;padding:0.8rem;">
              <div style="font-size:0.8rem;font-weight:800;color:#065f46;margin-bottom:0.4rem;">
                👤 ${ordenSecuencial ? `[Turno #${item.orden || idx + 1}] ` : ''}${escHtml(item.etiqueta || `Firmante ${idx + 1}`)}: ${escHtml(item.nombre || '-')}
                ${item.dni ? `<span style="font-weight:500;color:#047857;">(DNI ${escHtml(item.dni)})</span>` : ''}
                ${waAutoBadge}
              </div>
              ${pinBadge}
              <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                <input type="text" id="txtEnlaceFirmante_${idx}" readonly value="${escHtml(item.url_firma)}" style="flex:1;min-width:220px;padding:0.42rem 0.6rem;border:1px solid #6ee7b7;border-radius:7px;background:#f8fafc;font-size:0.78rem;color:#0f172a;"/>
                <button type="button" onclick="window.copiarInputPorId('txtEnlaceFirmante_${idx}', 'Enlace de firma')" style="padding:0.42rem 0.8rem;border-radius:7px;border:1px solid #047857;background:#ffffff;color:#047857;font-size:0.76rem;font-weight:700;cursor:pointer;">📋 Copiar Enlace</button>
              </div>
              <textarea id="txtMsgWaFirmante_${idx}" rows="3" style="width:100%;padding:0.45rem;border:1px solid #6ee7b7;border-radius:7px;font-size:0.76rem;background:#ffffff;color:#0f172a;margin-bottom:0.45rem;">${escHtml(msg)}</textarea>
              <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                <button type="button" onclick="window.copiarInputPorId('txtMsgWaFirmante_${idx}', 'Mensaje WhatsApp')" style="padding:0.4rem 0.78rem;border-radius:7px;border:1px solid #047857;background:#ffffff;color:#047857;font-size:0.76rem;font-weight:700;cursor:pointer;">📋 Copiar Mensaje</button>
                <button type="button" onclick="window.abrirWhatsAppFirmante('${escHtml(item.telefono || telWa)}', 'txtMsgWaFirmante_${idx}')" style="padding:0.4rem 0.85rem;border-radius:7px;border:1px solid #16a34a;background:#16a34a;color:#ffffff;font-size:0.76rem;font-weight:700;cursor:pointer;">💬 Abrir Chat WhatsApp</button>
              </div>
            </div>
          `;
        }).join('');
      }
      if (box) box.style.display = 'block';
      notify(`Se generaron ${enlaces.length} enlace(s) de firma correctamente.`, 'success');
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
    const card = (lbl, val, bg, col) => `
      <div style="background:${bg};border:1px solid #e2e8f0;border-radius:10px;padding:0.6rem 0.8rem;">
        <div style="font-size:0.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.02em;">${escHtml(lbl)}</div>
        <div style="font-size:1.08rem;font-weight:800;color:${col};margin-top:3px;">${escHtml(val)}</div>
      </div>
    `;
    const promTxt = m.tiempo_promedio_firma_min != null
      ? (m.tiempo_promedio_firma_min >= 60 ? `${(m.tiempo_promedio_firma_min / 60).toFixed(1)} h` : `${m.tiempo_promedio_firma_min} min`)
      : '-';
    bar.innerHTML = [
      card('Total Solicitudes', m.total, '#f8fafc', '#0f172a'),
      card('Completadas', `${m.firmadas} (${m.tasa_completitud_pct || 0}%)`, '#f0fdf4', '#166534'),
      card('En Espera / Parciales', (m.pendientes || 0) + (m.parciales || 0), '#fffbeb', '#b45309'),
      card('Tiempo Promedio', promTxt, '#eff6ff', '#1d4ed8'),
      card('Paquetes Multi-PDF', m.paquetes_multidoc || 0, '#f5f3ff', '#5b21b6'),
      card('Alertas Identidad', m.alertas_ekyc_o_cruce || 0, (m.alertas_ekyc_o_cruce > 0 ? '#fef2f2' : '#f8fafc'), (m.alertas_ekyc_o_cruce > 0 ? '#b91c1c' : '#334155')),
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

  async function notificarWhatsappSolicitud(solId, tipo) {
    try {
      notify('Enviando notificación por WhatsApp...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/notificar-whatsapp`, {
        method: 'POST',
        body: JSON.stringify({ tipo: tipo || 'recordatorio' }),
      });
      if (res.enviado_por_bot) {
        notify('Recordatorio enviado automáticamente por el Bot WhatsApp AMMER.', 'success');
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

  async function cargarBandejaFirmas() {
    const tbody = document.getElementById('tbodyBandejaFirmas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.25rem;text-align:center;color:#64748b;">Cargando solicitudes de firma...</td></tr>';
    cargarMetricasFirmas();
    try {
      const data = await apiFetchJson('/api/firmas/solicitudes', { method: 'GET' });
      state.solicitudesFirma = Array.isArray(data.solicitudes) ? data.solicitudes : [];
      renderBandejaFirmas();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:1.25rem;text-align:center;color:#b91c1c;">Error cargando bandeja: ${escHtml(err.message)}</td></tr>`;
    }
  }

  function renderBandejaFirmas() {
    const tbody = document.getElementById('tbodyBandejaFirmas');
    if (!tbody) return;
    const q = String((document.getElementById('inpFiltroBandejaFirmas') || {}).value || '').trim().toLowerCase();
    const filtradas = state.solicitudesFirma.filter((r) => {
      if (!q) return true;
      return `${r.nombre_solicitante || ''} ${r.dni_solicitante || ''} ${r.expediente_id || ''} ${r.plantilla_nombre || ''} ${r.estado || ''}`.toLowerCase().includes(q);
    });
    if (filtradas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#64748b;">No hay solicitudes de firma registradas aún.</td></tr>';
      return;
    }
    tbody.innerHTML = filtradas.map((r) => {
      const est = String(r.estado || 'PENDIENTE').toUpperCase();
      let bg = '#fef3c7', col = '#92400e';
      if (est === 'FIRMADO') { bg = '#dcfce7'; col = '#166534'; }
      else if (est === 'PARCIAL') { bg = '#ffedd5'; col = '#9a3412'; }
      else if (est === 'LEIDO') { bg = '#dbeafe'; col = '#1e40af'; }
      else if (est === 'ANULADO') { bg = '#fee2e2'; col = '#b91c1c'; }

      const gpsHtml = (r.geo_latitud != null && r.geo_longitud != null)
        ? `<a href="https://maps.google.com/?q=${r.geo_latitud},${r.geo_longitud}" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline;font-size:0.72rem;">📍 Ver GPS</a>`
        : '<span style="color:#94a3b8;font-size:0.72rem;">Sin GPS</span>';

      const shaFull = r.hash_sha256_firmado || r.hash_sha256_original || '';
      const shaShort = shaFull.slice(0, 14);
      const tipoDescarga = (est === 'FIRMADO' || est === 'PARCIAL') ? 'firmado' : 'original';
      const labelDescarga = est === 'FIRMADO' ? 'Descargar PDF Firmado' : (est === 'PARCIAL' ? 'Descargar PDF Parcial' : 'Descargar PDF Original');

      const ek = r.ekyc_resumen || null;
      let badgesHtml = '';
      if (r.es_paquete) {
        badgesHtml += `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#eef2ff;color:#3730a3;">📦 Paquete (${r.paquete_cantidad || 2} docs)</span>`;
      }
      if (r.orden_secuencial) {
        badgesHtml += `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#fff7ed;color:#9a3412;">🔢 Turno ${r.orden_firma || 1}/${r.firmantes_total || 2}</span>`;
      }
      if (r.impacto_expediente && r.impacto_expediente.ok) {
        badgesHtml += '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#f0fdf4;color:#15803d;">📂 En Ficha</span>';
      }
      if (ek && ek.estado_ekyc) {
        const ekCol = ek.estado_ekyc === 'APROBADO' ? '#166534' : '#b45309';
        const ekBg = ek.estado_ekyc === 'APROBADO' ? '#dcfce7' : '#fef3c7';
        const fmTxt = ek.face_match_pct != null ? ` · Face ${ek.face_match_pct}%` : '';
        badgesHtml += `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:${ekBg};color:${ekCol};">🪪 eKYC ${escHtml(ek.estado_ekyc)}${escHtml(fmTxt)}</span>`;
        if (ek.pdf417_ok) {
          badgesHtml += '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#ecfeff;color:#0e7490;">📊 PDF417 OK</span>';
        }
        const bo = ek.boletin_oficial_er;
        if (bo && bo.consultado) {
          const boAlert = bo.tiene_alerta_critica;
          badgesHtml += `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:${boAlert ? '#fee2e2' : '#ecfdf5'};color:${boAlert ? '#b91c1c' : '#047857'};">${boAlert ? '⚠️ Boletín ER (' + (bo.total_resultados || 0) + ')' : '📰 Boletín ER OK'}</span>`;
        }
        const cj = ek.cajajper;
        if (cj && cj.consultado) {
          const cjTram = Number(cj.cantidad_expedientes || 0);
          const cjAlto = cj.nivel_alerta === 'ALTO';
          const cjBg = cjAlto ? '#fee2e2' : (cjTram > 0 ? '#fef3c7' : '#ecfdf5');
          const cjCol = cjAlto ? '#b91c1c' : (cjTram > 0 ? '#92400e' : '#047857');
          badgesHtml += `<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:${cjBg};color:${cjCol};">${cjTram > 0 ? '🏛️ CajaJPER (' + cjTram + ' exp.)' : '🏛️ CajaJPER OK'}</span>`;
        }
      }
      if (r.pin_otp_verificado) {
        badgesHtml += '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#f5f3ff;color:#5b21b6;">🔐 PIN 2FA OK</span>';
      }
      const tsa = r.tsa_resumen || null;
      if (tsa && tsa.ok) {
        badgesHtml += '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#eff6ff;color:#1d4ed8;">⏱️ TSA RFC 3161</span>';
      }
      const pades = r.pades_resumen || null;
      if (pades && pades.ok) {
        badgesHtml += '<span style="display:inline-block;padding:1px 6px;border-radius:6px;font-size:0.68rem;font-weight:700;background:#eef2ff;color:#3730a3;">🔏 PAdES (.p12)</span>';
      }

      const btnBase = 'display:inline-flex;align-items:center;gap:5px;padding:0.4rem 0.78rem;border-radius:8px;font-size:0.76rem;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap;';
      const fechaCreadaTxt = (r.created_at || '').slice(0, 16).replace('T', ' ') || '-';
      const fechaFirmadaTxt = r.firmado_en ? r.firmado_en.slice(0, 16).replace('T', ' ') : '';

      return `
        <tr style="border-bottom:1px solid #e2e8f0;vertical-align:middle;">
          <td style="padding:0.8rem 0.65rem;font-size:0.82rem;">
            <div style="font-weight:800;color:#0f172a;">${escHtml(r.nombre_solicitante || '-')}</div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">DNI ${escHtml(r.dni_solicitante || '-')} · Exp: ${escHtml(r.expediente_id || '-')}</div>
          </td>
          <td style="padding:0.8rem 0.65rem;font-size:0.8rem;color:#1e293b;max-width:270px;line-height:1.35;">${escHtml(r.plantilla_nombre || '-')}</td>
          <td style="padding:0.8rem 0.65rem;text-align:center;">
            <span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:0.71rem;font-weight:800;background:${bg};color:${col};white-space:nowrap;">${escHtml(est)}</span>
          </td>
          <td style="padding:0.8rem 0.65rem;font-size:0.73rem;color:#475569;white-space:nowrap;line-height:1.5;">
            <div>Creada: <strong>${escHtml(fechaCreadaTxt)}</strong></div>
            ${fechaFirmadaTxt ? `<div style="color:#166534;font-weight:700;">Firmada: ${escHtml(fechaFirmadaTxt)}</div>` : ''}
          </td>
          <td style="padding:0.8rem 0.65rem;font-size:0.72rem;">
            <div class="font-mono" style="color:#334155;" title="${escHtml(shaFull)}">SHA256: ${escHtml(shaShort)}…</div>
            <div style="margin-top:2px;">IP: ${escHtml(r.ip_origen || '-')} · ${gpsHtml}</div>
            ${badgesHtml ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">${badgesHtml}</div>` : ''}
          </td>
          <td style="padding:0.8rem 0.65rem;text-align:right;white-space:nowrap;">
            <div style="display:inline-flex;gap:6px;align-items:center;justify-content:flex-end;">
              <button type="button" onclick="window.abrirFichaSolicitudFirma('${escHtml(r.id)}')" title="Ver ficha completa: previsualización del PDF, fotos DNI/Selfie, validaciones, historial y acciones" style="${btnBase}border:1px solid #0284c7;background:#eff6ff;color:#0369a1;font-weight:800;">
                📋 Ver Ficha
              </button>
              <button type="button" onclick="window.descargarPdfSolicitudFirma('${escHtml(r.id)}', '${tipoDescarga}')" title="${escHtml(labelDescarga)}" style="${btnBase}border:1px solid #0f2744;background:#0f2744;color:#ffffff;">
                📥 Descargar PDF
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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
        btn.style.background = act ? '#0f2744' : '#f8fafc';
        btn.style.color = act ? '#ffffff' : '#1e293b';
        btn.style.borderColor = act ? '#0f2744' : '#cbd5e1';
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
      <div style="background:#ffffff;border-radius:16px;max-width:1080px;width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(15,23,42,0.35);overflow:hidden;">
        <div style="padding:0.95rem 1.25rem;background:linear-gradient(135deg,#0f2744 0%,#1e3a8a 100%);color:#ffffff;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:0.98rem;">📋 Cargando Ficha Completa de Firma y Evidencia...</div>
          <button type="button" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'" style="border:none;background:rgba(255,255,255,0.18);color:#ffffff;border-radius:7px;padding:4px 10px;font-weight:800;cursor:pointer;">✕</button>
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
        <div style="background:#ffffff;border-radius:14px;max-width:520px;width:94vw;padding:1.5rem;text-align:center;">
          <div style="font-weight:800;color:#b91c1c;margin-bottom:0.5rem;">Error cargando Ficha</div>
          <div style="font-size:0.84rem;color:#475569;margin-bottom:1rem;">${escHtml(err.message)}</div>
          <button type="button" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'" style="padding:0.45rem 1rem;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;cursor:pointer;">Cerrar</button>
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
    const btnCls = 'display:inline-flex;align-items:center;gap:5px;padding:0.38rem 0.72rem;border-radius:8px;font-size:0.75rem;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap;';

    const driveBtn = r.drive_file_url
      ? `<a href="${escHtml(r.drive_file_url)}" target="_blank" rel="noopener" style="${btnCls}border:1px solid #16a34a;background:#f0fdf4;color:#15803d;">☁️ Abrir en Drive</a>`
      : (est === 'FIRMADO' && r.expediente_id
        ? `<button type="button" onclick="window.respaldarSolicitudEnDrive('${escHtml(r.id)}').then(()=>window.abrirFichaSolicitudFirma('${escHtml(r.id)}'))" style="${btnCls}border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;">☁️ Subir a Drive</button>`
        : '');
    const tsrBtn = r.tiene_tsr
      ? `<button type="button" onclick="window.descargarTsrSolicitudFirma('${escHtml(r.id)}')" style="${btnCls}border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;">⏱️ Sello Hora (.tsr)</button>`
      : '';
    const recordarWaBtn = (r.telefono_whatsapp && est !== 'FIRMADO' && est !== 'ANULADO')
      ? `<button type="button" onclick="window.notificarWhatsappSolicitud('${escHtml(r.id)}', 'recordatorio')" style="${btnCls}border:1px solid #86efac;background:#f0fdf4;color:#15803d;">📲 Recordar WhatsApp</button>`
      : '';
    const renovarBtn = est !== 'FIRMADO'
      ? `<button type="button" onclick="window.renovarEnlaceSolicitudFirma('${escHtml(r.id)}')" style="${btnCls}border:1px solid #fcd34d;background:#fffbeb;color:#b45309;">🔄 Renovar Enlace</button>`
      : '';
    const revocarBtn = (est !== 'FIRMADO' && est !== 'ANULADO')
      ? `<button type="button" onclick="window.revocarSolicitudFirma('${escHtml(r.id)}').then(()=>document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none')" style="${btnCls}border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;">🚫 Anular Enlace</button>`
      : '';

    const renGuia = r.datos_renaper_guia || {};
    const renArgs = JSON.stringify({
      nombre: r.nombre_solicitante || '-',
      dni: renGuia.dni || r.dni_solicitante || '',
      sexo: renGuia.sexo || '',
      fecha_nacimiento: renGuia.fecha_nacimiento || '',
      ejemplar: renGuia.ejemplar || '',
    }).replace(/"/g, '&quot;');

    // Fotos y firma
    const fotoCard = (titulo, b64, mimeDef, sinMsg) => {
      if (!b64) {
        return `
          <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:1rem;text-align:center;">
            <div style="font-size:0.75rem;font-weight:800;color:#334155;margin-bottom:0.35rem;">${escHtml(titulo)}</div>
            <div style="font-size:0.74rem;color:#94a3b8;padding:1.2rem 0;">${escHtml(sinMsg || 'No requerida / No capturada')}</div>
          </div>
        `;
      }
      const src = b64.startsWith('data:') ? b64 : `data:${mimeDef};base64,${b64}`;
      return `
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:0.65rem;display:flex;flex-direction:column;gap:0.4rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.75rem;font-weight:800;color:#0f172a;">${escHtml(titulo)}</span>
            <button type="button" data-ampliar-foto="${escHtml(src)}" data-ampliar-titulo="${escHtml(titulo)}" style="padding:2px 7px;border-radius:5px;border:1px solid #cbd5e1;background:#f8fafc;font-size:0.69rem;font-weight:700;cursor:pointer;">🔍 Ampliar</button>
          </div>
          <img src="${src}" alt="${escHtml(titulo)}" style="width:100%;height:175px;object-fit:contain;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;cursor:pointer;" data-ampliar-foto="${escHtml(src)}" data-ampliar-titulo="${escHtml(titulo)}"/>
        </div>
      `;
    };

    const dniEx = (ek && ek.dni_extraido) || {};
    const bo = (ek && ek.boletin_oficial_er) || {};
    const cj = (ek && ek.cajajper) || {};
    const p417 = (ek && ek.pdf417) || {};
    const tsa = r.tsa_resumen || {};
    const pades = r.pades_resumen || {};
    const gpsLink = (r.geo_latitud != null && r.geo_longitud != null)
      ? `<a href="https://maps.google.com/?q=${r.geo_latitud},${r.geo_longitud}" target="_blank" rel="noopener" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">📍 ${r.geo_latitud}, ${r.geo_longitud} (Abrir en Google Maps)</a>`
      : 'No informada / Denegada';

    const kpiItem = (lbl, val, bgK, colK) => `
      <div style="background:${bgK || '#f8fafc'};border:1px solid #e2e8f0;border-radius:9px;padding:0.55rem 0.75rem;">
        <div style="font-size:0.67rem;font-weight:700;color:#64748b;text-transform:uppercase;">${escHtml(lbl)}</div>
        <div style="font-size:0.86rem;font-weight:800;color:${colK || '#0f172a'};margin-top:2px;word-break:break-word;">${escHtml(val || '-')}</div>
      </div>
    `;

    const evHtml = evs.length === 0
      ? '<div style="padding:1.5rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay eventos registrados aún para esta solicitud.</div>'
      : evs.map((ev) => `
        <div style="border-left:3px solid #1d4ed8;background:#f8fafc;border-radius:8px;padding:0.6rem 0.85rem;margin-bottom:0.55rem;">
          <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
            <strong style="color:#0f2744;font-size:0.82rem;">${escHtml(ev.evento || '-')}</strong>
            <span style="font-size:0.72rem;color:#475569;">${escHtml((ev.created_at || '').slice(0, 19).replace('T', ' '))} UTC</span>
          </div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">IP: ${escHtml(ev.ip_origen || '-')} · Navegador: ${escHtml((ev.user_agent || '-').slice(0, 90))}</div>
          ${ev.detalle_json ? `<details style="margin-top:0.3rem;"><summary style="cursor:pointer;font-size:0.71rem;color:#1d4ed8;font-weight:700;">Ver detalle técnico</summary><pre style="margin:0.35rem 0 0;padding:0.45rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;font-size:0.68rem;overflow-x:auto;color:#334155;">${escHtml(JSON.stringify(ev.detalle_json, null, 2))}</pre></details>` : ''}
        </div>
      `).join('');

    ov.innerHTML = `
      <div style="background:#ffffff;border-radius:16px;max-width:1080px;width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(15,23,42,0.35);overflow:hidden;">
        <!-- HEADER -->
        <div style="padding:0.95rem 1.25rem;background:linear-gradient(135deg,#0f2744 0%,#1e3a8a 100%);color:#ffffff;display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;">
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:1.05rem;font-weight:800;">📋 Ficha de Firma: ${escHtml(r.nombre_solicitante || '-')}</span>
              <span style="padding:2px 10px;border-radius:9999px;font-size:0.72rem;font-weight:800;background:${bg};color:${col};">${escHtml(est)}</span>
              ${r.es_paquete ? `<span style="padding:2px 8px;border-radius:9999px;font-size:0.71rem;font-weight:700;background:#e0e7ff;color:#1e3a8a;">📦 Paquete (${r.paquete_cantidad} docs)</span>` : ''}
            </div>
            <div style="font-size:0.78rem;color:#cbd5e1;margin-top:4px;">
              DNI ${escHtml(r.dni_solicitante || '-')} · Expediente: <strong>${escHtml(r.expediente_id || '-')}</strong> · Documento: <strong>${escHtml(r.plantilla_nombre || '-')}</strong>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('modalFichaSolicitudFirmaOverlay').style.display='none'" style="border:none;background:rgba(255,255,255,0.18);color:#ffffff;border-radius:8px;padding:5px 11px;font-weight:800;cursor:pointer;font-size:0.9rem;">✕</button>
        </div>

        <!-- BARRA DE ACCIONES -->
        <div style="padding:0.7rem 1.2rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">
          <button type="button" onclick="window.descargarPdfSolicitudFirma('${escHtml(r.id)}', '${tipoDescarga}')" style="${btnCls}border:1px solid #0f2744;background:#0f2744;color:#ffffff;font-weight:800;">📥 ${labelDescarga}</button>
          ${tsrBtn}
          ${driveBtn}
          <button type="button" onclick="window.abrirAsistenteRenaperMiEjemplar(${renArgs})" style="${btnCls}border:1px solid #bae6fd;background:#f0f9ff;color:#0369a1;">🪪 Validar DNI (RENAPER)</button>
          <a href="${verifyUrl}" target="_blank" rel="noopener" style="${btnCls}border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;">🔍 Validar Firma (Público)</a>
          ${recordarWaBtn}
          ${renovarBtn}
          ${revocarBtn}
        </div>

        <!-- PESTAÑAS INTERNAS DE LA FICHA -->
        <div style="padding:0.55rem 1.2rem;background:#ffffff;border-bottom:1px solid #e2e8f0;display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">
          <button type="button" id="btnFichaModalTab_pdf" onclick="window.cambiarTabFichaSolicitudModal('pdf')" style="${btnCls}border:1px solid #0f2744;background:#0f2744;color:#ffffff;">📑 Previsualización PDF</button>
          <button type="button" id="btnFichaModalTab_ekyc" onclick="window.cambiarTabFichaSolicitudModal('ekyc')" style="${btnCls}border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;">🪪 Identidad, Fotos y Cruces</button>
          <button type="button" id="btnFichaModalTab_evidencia" onclick="window.cambiarTabFichaSolicitudModal('evidencia')" style="${btnCls}border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;">🔐 Evidencia Técnica y Legal</button>
          <button type="button" id="btnFichaModalTab_eventos" onclick="window.cambiarTabFichaSolicitudModal('eventos')" style="${btnCls}border:1px solid #cbd5e1;background:#f8fafc;color:#1e293b;">📜 Historial (${evs.length})</button>
        </div>

        <!-- CUERPO SCROLLEABLE -->
        <div style="padding:1rem 1.25rem;overflow-y:auto;flex:1;min-height:360px;">
          <!-- TAB 1: PDF PREVIEW -->
          <div id="pnlFichaModalTab_pdf" style="display:block;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
              <div style="font-size:0.78rem;font-weight:700;color:#334155;">
                Visualizando: <strong style="color:#0f2744;">${pdfRes && pdfRes.tipo === 'firmado' ? 'PDF Firmado con Evidencia y Audit Trail' : 'PDF Original de la Solicitud'}</strong>
              </div>
              <div style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:7px;padding:2px 6px;">
                <button type="button" onclick="window.zoomFichaPdfModal(-0.2)" style="padding:1px 8px;border-radius:5px;border:1px solid #cbd5e1;background:#ffffff;font-weight:800;cursor:pointer;">➖</button>
                <span id="lblFichaModalPdfZoom" style="font-size:0.75rem;font-weight:800;min-width:44px;text-align:center;">100%</span>
                <button type="button" onclick="window.zoomFichaPdfModal(0.2)" style="padding:1px 8px;border-radius:5px;border:1px solid #cbd5e1;background:#ffffff;font-weight:800;cursor:pointer;">➕</button>
              </div>
            </div>
            <div id="fichaModalPdfPagesWrap" style="background:#cbd5e1;border-radius:10px;padding:0.85rem;overflow:auto;max-height:60vh;"></div>
          </div>

          <!-- TAB 2: IDENTIDAD, FOTOS & CRUCES -->
          <div id="pnlFichaModalTab_ekyc" style="display:none;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.55rem;margin-bottom:1rem;">
              ${kpiItem('Dictamen eKYC', (ek && ek.estado_ekyc) || 'Sin captura eKYC', (ek && ek.estado_ekyc === 'APROBADO') ? '#f0fdf4' : '#f8fafc', (ek && ek.estado_ekyc === 'APROBADO') ? '#166534' : '#334155')}
              ${kpiItem('Cotejo Facial (Selfie vs DNI)', ek && ek.face_match_pct != null ? `${ek.face_match_pct}% coincidencia` : 'No ejecutado', '#eff6ff', '#1d4ed8')}
              ${kpiItem('Prueba de Vida (Liveness)', ek && ek.liveness_ok === true ? 'Aprobada' : (ek && ek.liveness_ok === false ? 'Observada' : 'No ejecutada'))}
              ${kpiItem('Código PDF417 DNI Dorso', p417.ok ? `Válido · Ejemplar ${p417.ejemplar || '-'}` : 'Sin lectura PDF417')}
              ${kpiItem('Boletín Oficial Entre Ríos', bo.consultado ? (bo.tiene_alerta_critica ? `⚠️ ${bo.total_resultados || 0} alerta(s)` : `Limpio (${bo.total_resultados || 0} menc.)`) : 'No consultado', bo.tiene_alerta_critica ? '#fef2f2' : '#f0fdf4', bo.tiene_alerta_critica ? '#b91c1c' : '#166534')}
              ${kpiItem('CajaJPER Entre Ríos', cj.consultado ? `${cj.cantidad_expedientes || 0} expediente(s)` : 'No consultado')}
            </div>

            ${(dniEx.dni || dniEx.nombre || dniEx.fecha_nacimiento) ? `
              <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.65rem 0.85rem;margin-bottom:1rem;font-size:0.78rem;color:#334155;">
                <strong>Datos leídos del DNI:</strong> Nombre: ${escHtml(dniEx.nombre || '-')} · DNI: ${escHtml(dniEx.dni || '-')} · Sexo: ${escHtml(dniEx.sexo || '-')} · F. Nac.: ${escHtml(dniEx.fecha_nacimiento || '-')} · Ejemplar: ${escHtml(dniEx.ejemplar || '-')} · Trámite: ${escHtml(dniEx.nro_tramite || '-')}
              </div>
            ` : ''}

            <div style="font-size:0.8rem;font-weight:800;color:#0f172a;margin-bottom:0.5rem;">Capturas Documentales y Firma Ológrafa (clic para ampliar)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.75rem;">
              ${fotoCard('🪪 DNI Frente', imgs.dni_frente_b64, 'image/jpeg', 'Sin foto DNI frente')}
              ${fotoCard('🪪 DNI Dorso (PDF417)', imgs.dni_dorso_b64, 'image/jpeg', 'Sin foto DNI dorso')}
              ${fotoCard('🤳 Selfie Biométrica', imgs.selfie_b64, 'image/jpeg', 'Sin captura de selfie')}
              ${fotoCard('✍️ Firma Ológrafa Capturada', imgs.firma_png_b64, 'image/png', 'Aún sin firma manuscrita')}
            </div>
          </div>

          <!-- TAB 3: EVIDENCIA TÉCNICA Y LEGAL -->
          <div id="pnlFichaModalTab_evidencia" style="display:none;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.65rem;">
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
            <div style="margin-top:0.85rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.75rem 0.9rem;font-size:0.76rem;color:#334155;display:flex;flex-direction:column;gap:0.4rem;">
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
      notify('Subiendo PDF firmado al Legajo en Google Drive...', 'info');
      const res = await apiFetchJson(`/api/firmas/solicitudes/${encodeURIComponent(solId)}/respaldar-drive`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      notify('PDF respaldado correctamente en Google Drive.', 'success');
      if (res && res.drive_file_url) {
        const target = state.solicitudesFirma.find((x) => String(x.id) === String(solId));
        if (target) target.drive_file_url = res.drive_file_url;
        renderBandejaFirmas();
      } else {
        await cargarBandejaFirmas();
      }
    } catch (err) {
      notify('No se pudo respaldar en Drive: ' + err.message, 'error');
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
      state.editor.selectedFieldId = null;

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
      state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;

      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
      setVal('inpEditPlantillaNombre', tpl.nombre);
      setVal('selEditPlantillaCategoria', tpl.categoria || 'GENERAL');
      setVal('inpEditPlantillaDesc', tpl.descripcion || '');
      const vals = tpl.validaciones_json || {};
      setChk('chkValFirmaOlografa', vals.firma_olografa !== false);
      setChk('chkValTaparResaltados', vals.tapar_resaltados !== false);
      setChk('chkValRequiereSelloPng', vals.requiere_sello_png);
      setChk('chkValGpsObligatorio', vals.gps_obligatorio);
      setChk('chkValDniFrenteDorso', vals.dni_frente_dorso);
      setChk('chkValSelfieLiveness', vals.selfie_liveness);
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
      btn.style.outline = activo ? '2.5px solid #1d4ed8' : 'none';
      btn.style.outlineOffset = activo ? '1px' : '0';
      btn.style.transform = activo ? 'translateY(-1px)' : 'none';
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
            c.w_pct = Math.max(0.03, Math.min(1 - c.x_pct, Number((origWPct + dx).toFixed(4))));
            c.h_pct = Math.max(0.015, Math.min(1 - c.y_pct, Number((origHPct + dy).toFixed(4))));
            el.style.width = `${c.w_pct * 100}%`;
            el.style.height = `${c.h_pct * 100}%`;
          } else {
            c.x_pct = Math.max(0, Math.min(1 - c.w_pct, Number((origXPct + dx).toFixed(4))));
            c.y_pct = Math.max(0, Math.min(1 - c.h_pct, Number((origYPct + dy).toFixed(4))));
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
      document.addEventListener('keydown', (ev) => {
        const pnl = document.getElementById('panelFirmas_editor');
        if (!pnl || pnl.style.display === 'none') return;
        const tag = (ev.target && ev.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

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

        const step = ev.shiftKey ? 0.01 : 0.0025;
        let moved = false;
        if (ev.key === 'ArrowLeft') { c.x_pct = Math.max(0, Number((c.x_pct - step).toFixed(4))); moved = true; }
        else if (ev.key === 'ArrowRight') { c.x_pct = Math.min(1 - c.w_pct, Number((c.x_pct + step).toFixed(4))); moved = true; }
        else if (ev.key === 'ArrowUp') { c.y_pct = Math.max(0, Number((c.y_pct - step).toFixed(4))); moved = true; }
        else if (ev.key === 'ArrowDown') { c.y_pct = Math.min(1 - c.h_pct, Number((c.y_pct + step).toFixed(4))); moved = true; }
        else if (ev.key === 'Delete' || ev.key === 'Backspace') {
          ev.preventDefault();
          eliminarCampoEditor(c.id);
          return;
        }
        if (moved) {
          ev.preventDefault();
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
      lista.innerHTML = state.editor.campos.length === 0
        ? '<span style="font-size:0.76rem;color:#64748b;">Sin campos marcados aún.</span>'
        : state.editor.campos.map((item) => {
          const act = item.id === state.editor.selectedFieldId;
          const ico = (item.tipo === 'borrador' || item.origen_campo === 'campo_vacio')
            ? '🧹 '
            : (item.tipo === 'firma' ? '✍️ ' : (item.tipo === 'sello' ? '🏛️ ' : ''));
          return `<button type="button" data-pill-id="${escHtml(item.id)}" onclick="window.seleccionarCampoEditor('${escHtml(item.id)}')" style="padding:3px 8px;border-radius:6px;border:1px solid ${act ? '#1d4ed8' : '#cbd5e1'};background:${act ? '#dbeafe' : '#ffffff'};color:${act ? '#1e3a8a' : '#334155'};font-size:0.72rem;font-weight:700;cursor:pointer;">${ico}P${item.pagina || 1}: ${escHtml(item.etiqueta || item.id)}</button>`;
        }).join(' ');
    }

    if (!cont) return;
    if (!c) {
      cont.innerHTML = '<div style="padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1;font-size:0.8rem;color:#64748b;">Hacé clic sobre un cuadro en el PDF (o agregá un campo nuevo) para configurar qué dato o firmante se estampa ahí. Podés usar las flechas del teclado para ajustar posición con precisión o <strong>Ctrl + rueda</strong> para hacer zoom.</div>';
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
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:0.55rem;display:flex;flex-direction:column;gap:0.45rem;">
          <div>
            <label style="font-size:0.71rem;font-weight:800;color:#065f46;">Persona asignada a esta caja de firma:</label>
            <select onchange="window.actualizarPropCampoEditor('firmante_clave', this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #6ee7b7;border-radius:6px;font-size:0.79rem;background:#ffffff;">${fOpts}</select>
          </div>
          <div>
            <label style="font-size:0.71rem;font-weight:800;color:#065f46;">Etiqueta visible del firmante:</label>
            <input type="text" value="${escHtml(c.firmante_etiqueta || c.etiqueta || 'Titular / Asociado')}" oninput="window.actualizarPropCampoEditor('firmante_etiqueta', this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #6ee7b7;border-radius:6px;font-size:0.79rem;"/>
          </div>
        </div>
      `;
    }

    const fuenteBadge = c.fuente === 'ia_gemini'
      ? '<span style="font-size:0.66rem;padding:1px 6px;border-radius:9999px;background:#e0e7ff;color:#3730a3;font-weight:700;">✨ IA</span>'
      : (c.fuente === 'regla' ? '<span style="font-size:0.66rem;padding:1px 6px;border-radius:9999px;background:#fef3c7;color:#92400e;font-weight:700;">📐 Regla PDF</span>' : '');

    const textoPrevBox = c.texto_referencia
      ? `<div style="font-size:0.71rem;color:#64748b;background:#fffbeb;padding:4px 6px;border-radius:5px;border:1px solid #fde68a;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
           <span>Texto previo detectado: "${escHtml(c.texto_referencia)}"</span>
           ${!esBorrador ? `<button type="button" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', true)" style="padding:2px 6px;border-radius:5px;border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;font-size:0.69rem;font-weight:700;cursor:pointer;">🧹 Borrar y dejar vacío</button>` : ''}
         </div>`
      : '';

    cont.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.8rem;display:flex;flex-direction:column;gap:0.55rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;flex-wrap:wrap;">
          <strong style="font-size:0.82rem;color:#0f172a;">Campo: ${escHtml(c.id)} (Pág. ${c.pagina || 1}) ${fuenteBadge}</strong>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
            ${esBorrador
              ? `<button type="button" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', false)" style="padding:2px 8px;border-radius:6px;border:1px solid #d97706;background:#fffbeb;color:#b45309;font-size:0.72rem;font-weight:700;cursor:pointer;">✏️ Hacer rellenable</button>`
              : `<button type="button" onclick="window.convertirCampoSoloBorradorEditor('${escHtml(c.id)}', true)" title="Elimina el texto previo del PDF sin pedir texto nuevo" style="padding:2px 8px;border-radius:6px;border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;font-size:0.72rem;font-weight:700;cursor:pointer;">🧹 Dejar vacío</button>`}
            <button type="button" onclick="window.duplicarCampoEditor('${escHtml(c.id)}')" style="padding:2px 8px;border-radius:6px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-size:0.72rem;font-weight:700;cursor:pointer;">📋 Duplicar</button>
            <button type="button" onclick="window.eliminarCampoEditor('${escHtml(c.id)}')" style="padding:2px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:0.72rem;font-weight:700;cursor:pointer;">🗑️ Quitar</button>
          </div>
        </div>
        <div id="lblEditorCampoCoords" style="font-size:0.69rem;color:#475569;font-family:monospace;background:#ffffff;padding:3px 6px;border-radius:5px;border:1px solid #e2e8f0;">
          X: ${(Number(c.x_pct || 0) * 100).toFixed(1)}% · Y: ${(Number(c.y_pct || 0) * 100).toFixed(1)}% · Ancho: ${(Number(c.w_pct || 0) * 100).toFixed(1)}% · Alto: ${(Number(c.h_pct || 0) * 100).toFixed(1)}%
        </div>
        ${textoPrevBox}
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:#475569;">Etiqueta visible</label>
          <input type="text" id="editCampoEtiqueta" value="${escHtml(c.etiqueta || '')}" oninput="window.actualizarPropCampoEditor('etiqueta', this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;"/>
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:#475569;">Tipo / Dato del expediente a estampar</label>
          <select id="editCampoOrigen" onchange="window.actualizarOrigenCampoEditor(this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;background:#ffffff;">${optHtml}</select>
        </div>
        ${extraFirmaHtml}
        ${esBorrador ? `
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:0.55rem 0.65rem;font-size:0.74rem;color:#0369a1;line-height:1.4;">
            🧹 <strong>Modo Campo Vacío activo:</strong> al generar o firmar el PDF, todo texto precompleto (o campo previo) cubierto por este recuadro se borrará en blanco sin escribir nada encima. Podés convertirlo en rellenable en cualquier momento.
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
            <div>
              <label style="font-size:0.72rem;font-weight:700;color:#475569;">Tamaño fuente</label>
              <input type="number" min="6" max="18" step="0.5" value="${Number(c.font_size || 10)}" oninput="window.actualizarPropCampoEditor('font_size', parseFloat(this.value) || 10)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;"/>
            </div>
            <div style="display:flex;align-items:flex-end;padding-bottom:4px;">
              <label style="display:flex;align-items:center;gap:5px;font-size:0.75rem;font-weight:600;color:#334155;cursor:pointer;" title="Blanquea el texto previo que hubiera debajo en el PDF base">
                <input type="checkbox" ${c.cubrir_fondo !== false ? 'checked' : ''} onchange="window.actualizarPropCampoEditor('cubrir_fondo', this.checked)"/>
                🧹 Eliminar texto previo (fondo blanco)
              </label>
            </div>
          </div>
          <div>
            <label style="font-size:0.72rem;font-weight:700;color:#475569;">Valor por defecto / texto fijo (opcional)</label>
            <div style="display:flex;gap:4px;align-items:center;">
              <input type="text" id="editCampoValorManual" value="${escHtml(c.valor_manual || '')}" oninput="window.actualizarPropCampoEditor('valor_manual', this.value)" style="flex:1;min-width:0;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;" placeholder="Se usa si el dato es manual"/>
              <button type="button" onclick="window.vaciarValorCampoEditor('${escHtml(c.id)}')" title="Borrar texto precompleto y dejar este campo vacío para completar" style="padding:0.35rem 0.55rem;border-radius:6px;border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;font-size:0.73rem;font-weight:700;cursor:pointer;white-space:nowrap;">🧹 Vaciar</button>
            </div>
          </div>
        `}
      </div>
    `;
  }

  function vaciarValorCampoEditor(cid) {
    const c = state.editor.campos.find((x) => x.id === (cid || state.editor.selectedFieldId));
    if (!c) return;
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
    state.editor.campos = state.editor.campos.filter((x) => x.id !== cid);
    state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;
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
    state.editor.archivoNombre = '';
    state.editor.totalPages = 1;
    state.editor.currentPage = 1;
    state.editor.campos = [];
    state.editor.selectedFieldId = null;
    state.editor.addModeTipo = null;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setVal('inpPlantillaPdfFile', '');
    setVal('selEditarPlantillaExistente', '');
    setVal('inpEditPlantillaNombre', '');
    setVal('selEditPlantillaCategoria', 'AUTORIZACION');
    setVal('inpEditPlantillaDesc', '');
    setChk('chkValFirmaOlografa', true);
    setChk('chkValTaparResaltados', true);
    setChk('chkValRequiereSelloPng', false);
    setChk('chkValGpsObligatorio', false);
    setChk('chkValDniFrenteDorso', false);
    setChk('chkValSelfieLiveness', false);
    setChk('chkValRequierePinOtp', false);
    setChk('chkEditorVistaLimpia', false);
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
    }
    actualizarBotonesModoEditor();
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
        tapar_resaltados: chk('chkValTaparResaltados', true),
        requiere_sello_png: chk('chkValRequiereSelloPng', false),
        gps_obligatorio: chk('chkValGpsObligatorio', false),
        dni_frente_dorso: chk('chkValDniFrenteDorso', false),
        selfie_liveness: chk('chkValSelfieLiveness', false),
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
      notify('Plantilla PDF guardada correctamente.', 'success');
    } catch (err) {
      notify('Error guardando plantilla: ' + err.message, 'error');
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
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(ev) {
      const r = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      return {
        x: ((clientX - r.left) / r.width) * canvas.width,
        y: ((clientY - r.top) / r.height) * canvas.height,
      };
    }

    function start(ev) {
      ev.preventDefault();
      state.canvasFirmaPrueba.drawing = true;
      const p = getPos(ev);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(ev) {
      if (!state.canvasFirmaPrueba.drawing) return;
      ev.preventDefault();
      const p = getPos(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      state.canvasFirmaPrueba.hasInk = true;
      state.canvasFirmaPrueba.points++;
    }

    function stop() {
      state.canvasFirmaPrueba.drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
  }

  function limpiarCanvasFirmaPrueba() {
    const canvas = document.getElementById('canvasFirmaPruebaPresencial');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
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

  function abrirAsistenteRenaperMiEjemplar(datos) {
    bindRenaperBridgeListeners();
    const info = datos || {};
    const dniClean = String(info.dni || '').replace(/\D/g, '');
    const sexoLabel = normalizarSexoRenaper(info.sexo);
    const fechaNac = normalizarFechaDdMmAaaa(info.fecha_nacimiento);
    const ejemplar = String(info.ejemplar || '').trim().toUpperCase();
    const nombre = String(info.nombre || 'Asociado').trim();

    const payloadExt = {
      nombre,
      dni: dniClean,
      sexo: sexoLabel,
      fecha_nacimiento: fechaNac,
      ejemplar,
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
      modal.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;max-width:405px;width:calc(100vw - 32px);background:#ffffff;border:2px solid #0284c7;border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,0.28);padding:1rem;font-family:inherit;';
      document.body.appendChild(modal);
    }

    const rowFn = (lbl, val, copyId, copiedAuto) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.45rem 0.6rem;margin-bottom:0.4rem;">
        <div style="min-width:0;">
          <div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">${escHtml(lbl)}</div>
          <div style="font-size:0.86rem;font-weight:800;color:#0f172a;word-break:break-word;">${escHtml(val || 'No informado')}${copiedAuto ? ' <span style="font-size:0.68rem;color:#059669;">(Copiado)</span>' : ''}</div>
        </div>
        ${copyId && val ? `<button type="button" data-copy-renaper="${escHtml(val)}" style="padding:0.28rem 0.55rem;border-radius:6px;border:1px solid #0284c7;background:#ffffff;color:#0369a1;font-size:0.71rem;font-weight:700;cursor:pointer;flex-shrink:0;">📋 Copiar</button>` : ''}
      </div>
    `;

    const extHintHtml = tieneExt
      ? ''
      : `
        <details style="margin-top:0.5rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:0.45rem 0.6rem;font-size:0.71rem;color:#334155;">
          <summary style="cursor:pointer;font-weight:700;color:#0f2744;">🧩 ¿Querés usar Pestaña Dividida nativa de Chrome + Autocompletado?</summary>
          <div style="margin-top:0.4rem;line-height:1.4;">
            1. <a href="downloads/ammer-renaper-split-view-ext.zip" download style="color:#1d4ed8;font-weight:700;text-decoration:underline;">Descargá la extensión AMMER (.zip)</a> y descomprimila.<br/>
            2. En Chrome abrí <code>chrome://extensions</code>, activá <strong>Modo de desarrollador</strong> y tocá <strong>Cargar descomprimida</strong>.<br/>
            3. Recargá esta página (<code>F5</code>). Desde Chrome 155 abre RENAPER en pestaña dividida real y completa el formulario solo.
          </div>
        </details>
      `;

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.45rem;">
        <div style="font-size:0.88rem;font-weight:800;color:#0f2744;">🪪 Asistente RENAPER Mi Ejemplar</div>
        <button type="button" onclick="document.getElementById('modalGuiaRenaperEjemplar').style.display='none'" title="Ocultar asistente" style="border:none;background:#f1f5f9;color:#334155;border-radius:6px;padding:2px 8px;font-weight:800;cursor:pointer;">✕</button>
      </div>
      <div id="boxEstadoVentanaRenaper" style="font-size:0.73rem;border:1px solid #86efac;border-radius:8px;padding:0.42rem 0.6rem;margin-bottom:0.5rem;line-height:1.35;"></div>
      <div style="font-size:0.75rem;color:#475569;margin-bottom:0.5rem;">Titular: <strong>${escHtml(nombre)}</strong></div>
      ${rowFn('1. DNI (solo dígitos)', dniClean, true, Boolean(dniClean))}
      ${rowFn('2. Sexo en DNI', sexoLabel, false, false)}
      ${rowFn('3. Fecha de Nacimiento (DD/MM/AAAA)', fechaNac, Boolean(fechaNac), false)}
      ${ejemplar ? rowFn('Ejemplar impreso leído (para comparar)', 'Ejemplar ' + ejemplar, false, false) : ''}
      <div style="display:flex;gap:0.45rem;margin-top:0.55rem;flex-wrap:wrap;">
        <button type="button" id="btnCerrarVentanaRenaperModal" onclick="window.cerrarVentanaRenaperMiEjemplar()" style="flex:1;justify-content:center;align-items:center;gap:5px;padding:0.5rem 0.8rem;border-radius:8px;border:1px solid #dc2626;background:#dc2626;color:#ffffff;font-size:0.78rem;font-weight:800;cursor:pointer;">✕ Cerrar RENAPER y terminar</button>
        <button type="button" id="btnReabrirVentanaRenaperModal" onclick="window.abrirAsistenteRenaperMiEjemplar(window._ultimoPayloadRenaperModal)" style="display:none;flex:1;justify-content:center;align-items:center;gap:5px;padding:0.5rem 0.8rem;border-radius:8px;border:1px solid #0284c7;background:#0284c7;color:#ffffff;font-size:0.78rem;font-weight:800;cursor:pointer;">↗️ Reabrir RENAPER</button>
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
      nombre: r.nombre_solicitante || '-',
      dni: guia.dni || r.dni_solicitante || '',
      sexo: guia.sexo || '',
      fecha_nacimiento: guia.fecha_nacimiento || '',
      ejemplar: guia.ejemplar || '',
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
    });
  }

  // ==================== FASE 4: BITÁCORA, RENOVAR, REVOCAR, FICHA & PADES ====================
  function ensureModalFase4Firmas(titleHtml, bodyHtml) {
    let ov = document.getElementById('modalFase4FirmasOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'modalFase4FirmasOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div style="background:#ffffff;border-radius:14px;max-width:660px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 50px rgba(15,23,42,0.3);overflow:hidden;">
        <div style="padding:0.9rem 1.1rem;background:#0f2744;color:#ffffff;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:0.95rem;">${titleHtml}</div>
          <button type="button" onclick="document.getElementById('modalFase4FirmasOverlay').style.display='none'" style="border:none;background:rgba(255,255,255,0.16);color:#ffffff;border-radius:6px;padding:3px 9px;font-weight:800;cursor:pointer;">✕</button>
        </div>
        <div style="padding:1rem 1.1rem;overflow-y:auto;">${bodyHtml}</div>
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
          <div style="border-left:3px solid #1d4ed8;background:#f8fafc;border-radius:6px;padding:0.55rem 0.75rem;margin-bottom:0.55rem;">
            <div style="display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
              <strong style="color:#0f2744;font-size:0.82rem;">${escHtml(ev.evento || '-')}</strong>
              <span style="font-size:0.72rem;color:#475569;">${escHtml((ev.created_at || '').slice(0, 19).replace('T', ' '))} UTC</span>
            </div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">IP: ${escHtml(ev.ip_origen || '-')} · UA: ${escHtml((ev.user_agent || '-').slice(0, 75))}</div>
            ${ev.detalle_json ? `<pre style="margin:0.35rem 0 0;padding:0.4rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:5px;font-size:0.68rem;overflow-x:auto;color:#334155;">${escHtml(JSON.stringify(ev.detalle_json, null, 2))}</pre>` : ''}
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
      const pinNote = res.pin_otp ? `\n\n🔐 Tu nuevo PIN de seguridad para confirmar la firma es: *${res.pin_otp}*` : '';
      const msg = `Hola ${res.nombre_solicitante || 'Estimado/a'}, te reenviamos desde Asociación Mutual Modelo de Entre Ríos (AMMER) el nuevo enlace seguro para firmar "${res.plantilla_nombre || 'Documento'}":\n\n${res.url_firma}${pinNote}\n\nVigencia: 24 horas.`;
      ensureModalFase4Firmas('🔄 Enlace Renovado (24hs)', `
        <div style="font-size:0.82rem;color:#166534;background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:0.75rem;font-weight:700;">
          ✅ Enlace anterior invalidado. Ya podés compartir el nuevo link por WhatsApp.
        </div>
        ${res.pin_otp ? `<div style="margin-bottom:0.6rem;padding:0.45rem 0.7rem;border-radius:8px;background:#f5f3ff;border:1px solid #ddd6fe;color:#5b21b6;font-weight:800;font-size:0.84rem;">🔐 Nuevo PIN 2FA: <span class="font-mono">${escHtml(res.pin_otp)}</span></div>` : ''}
        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-bottom:0.5rem;">
          <input type="text" id="txtEnlaceRenovadoModal" readonly value="${escHtml(res.url_firma)}" style="flex:1;min-width:220px;padding:0.45rem 0.6rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.78rem;"/>
          <button type="button" onclick="window.copiarInputPorId('txtEnlaceRenovadoModal', 'Nuevo enlace')" style="padding:0.45rem 0.8rem;border-radius:7px;border:1px solid #047857;background:#ffffff;color:#047857;font-size:0.76rem;font-weight:700;cursor:pointer;">📋 Copiar</button>
        </div>
        <textarea id="txtMsgWaRenovadoModal" rows="4" style="width:100%;padding:0.45rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.78rem;margin-bottom:0.6rem;">${escHtml(msg)}</textarea>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" onclick="window.copiarInputPorId('txtMsgWaRenovadoModal', 'Mensaje WhatsApp')" style="padding:0.45rem 0.85rem;border-radius:7px;border:1px solid #0f2744;background:#ffffff;color:#0f2744;font-size:0.78rem;font-weight:700;cursor:pointer;">📋 Copiar Mensaje</button>
          <button type="button" onclick="window.abrirWhatsAppFirmante('${escHtml(res.telefono_whatsapp || '')}', 'txtMsgWaRenovadoModal')" style="padding:0.45rem 0.9rem;border-radius:7px;border:1px solid #16a34a;background:#16a34a;color:#ffffff;font-size:0.78rem;font-weight:700;cursor:pointer;">💬 Abrir WhatsApp</button>
        </div>
      `);
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
        <div style="font-size:0.82rem;color:#334155;margin-bottom:0.85rem;line-height:1.45;">
          Cada documento completado recibe un sello criptográfico <strong>PAdES (.p12)</strong> embebido dentro del PDF para detectar alteraciones en Adobe Reader.
          Hoy está operando en modo: <strong style="color:#3730a3;">${escHtml(st.modo || '-')}</strong>
        </div>
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.75rem;font-size:0.78rem;margin-bottom:0.85rem;">
          <div><strong>Titular (CN):</strong> ${escHtml(c.subject_cn || '-')}</div>
          <div><strong>Emisor:</strong> ${escHtml(c.issuer_cn || '-')}</div>
          <div><strong>Tipo:</strong> ${c.autofirmado ? 'Autofirmado institucional gratuito' : 'Certificado externo / Autoridad Certificante'}</div>
          <div class="font-mono" style="margin-top:4px;word-break:break-all;"><strong>Huella SHA-256:</strong> ${escHtml(c.fingerprint_sha256 || '-')}</div>
        </div>
        <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:0.75rem;margin-bottom:0.75rem;">
          <div style="font-size:0.78rem;font-weight:800;color:#3730a3;margin-bottom:4px;">Generar .p12 autofirmado estable para fijar en Render</div>
          <div style="font-size:0.73rem;color:#4338ca;margin-bottom:0.55rem;">Si querés mantener exactamente la misma huella entre reinicios o cuando contrates un certificado AATL/licenciado, configurá <code>PADES_P12_BASE64</code> y <code>PADES_P12_PASSWORD</code> en Render.</div>
          <button type="button" id="btnGenerarP12Modal" style="padding:0.45rem 0.9rem;border-radius:8px;border:1px solid #4338ca;background:#4338ca;color:#ffffff;font-size:0.78rem;font-weight:700;cursor:pointer;">🔐 Generar y Descargar .p12 + Base64</button>
          <div id="boxResultadoGenP12" style="display:none;margin-top:0.65rem;"></div>
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
                <div style="font-size:0.74rem;color:#166534;font-weight:700;margin-bottom:4px;">✅ Descargado AMMER_PAdES_Institucional.p12 (Clave: <code>ammer-pades-2026</code>)</div>
                <textarea id="txtP12Base64Out" rows="3" readonly style="width:100%;font-size:0.68rem;padding:0.4rem;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:4px;">${escHtml(g.p12Base64)}</textarea>
                <button type="button" onclick="window.copiarInputPorId('txtP12Base64Out', 'PADES_P12_BASE64')" style="padding:0.3rem 0.7rem;border-radius:6px;border:1px solid #0f2744;background:#ffffff;color:#0f2744;font-size:0.72rem;font-weight:700;cursor:pointer;">📋 Copiar PADES_P12_BASE64</button>
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
  global.copiarInputPorId = copiarInputPorId;
  global.abrirWhatsAppFirmante = abrirWhatsAppFirmante;
  global.descargarUltimoPreviewPdfFirma = () => {
    if (!state.ultimoPdfPreviewB64) { notify('Generá una vista previa primero.', 'warning'); return; }
    descargarBase64Pdf(state.ultimoPdfPreviewB64, 'Documento_AMMER_Completado.pdf');
  };
  global.limpiarCanvasFirmaPrueba = limpiarCanvasFirmaPrueba;
  global.cargarBandejaFirmas = cargarBandejaFirmas;
  global.renderBandejaFirmas = renderBandejaFirmas;
  global.descargarPdfSolicitudFirma = descargarPdfSolicitudFirma;
  global.descargarTsrSolicitudFirma = descargarTsrSolicitudFirma;
  global.respaldarSolicitudEnDrive = respaldarSolicitudEnDrive;
  global.verBitacoraEventosFirma = verBitacoraEventosFirma;
  global.renovarEnlaceSolicitudFirma = renovarEnlaceSolicitudFirma;
  global.abrirFichaSolicitudFirma = abrirFichaSolicitudFirma;
  global.cambiarTabFichaSolicitudModal = cambiarTabFichaSolicitudModal;
  global.zoomFichaPdfModal = zoomFichaPdfModal;
  global.revocarSolicitudFirma = revocarSolicitudFirma;
  global.enviarAFirmaDesdeFicha = enviarAFirmaDesdeFicha;
  global.abrirModalCertificadoPades = abrirModalCertificadoPades;
  global.abrirAsistenteRenaperMiEjemplar = abrirAsistenteRenaperMiEjemplar;
  global.cerrarVentanaRenaperMiEjemplar = cerrarVentanaRenaperMiEjemplar;
  global.abrirAsistenteRenaperPorId = abrirAsistenteRenaperPorId;
  global.abrirAsistenteRenaperDesdeFicha = abrirAsistenteRenaperDesdeFicha;
  global.onArchivoPdfPlantillaSeleccionado = onArchivoPdfPlantillaSeleccionado;
  global.reanalizarPdfConIaEditor = reanalizarPdfConIaEditor;
  global.cargarPlantillaEnEditor = cargarPlantillaEnEditor;
  global.cambiarPaginaEditor = cambiarPaginaEditor;
  global.setZoomEditorPdf = setZoomEditorPdf;
  global.zoomEditorPdf = zoomEditorPdf;
  global.ajustarZoomEditorPdf = ajustarZoomEditorPdf;
  global.toggleVistaLimpiaEditor = toggleVistaLimpiaEditor;
  global.activarModoClickAgregarCampo = activarModoClickAgregarCampo;
  global.seleccionarCampoEditor = seleccionarCampoEditor;
  global.actualizarPropCampoEditor = actualizarPropCampoEditor;
  global.actualizarOrigenCampoEditor = actualizarOrigenCampoEditor;
  global.vaciarValorCampoEditor = vaciarValorCampoEditor;
  global.convertirCampoSoloBorradorEditor = convertirCampoSoloBorradorEditor;
  global.duplicarCampoEditor = duplicarCampoEditor;
  global.eliminarCampoEditor = eliminarCampoEditor;
  global.limpiarEditorPlantillaPdf = limpiarEditorPlantillaPdf;
  global.guardarPlantillaDesdeEditor = guardarPlantillaDesdeEditor;
  global.probarEstampadoEditor = probarEstampadoEditor;
  global.exportarExpedienteCompletoZip = exportarExpedienteCompletoZip;
})(window);
