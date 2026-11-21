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
      archivoNombre: '',
      totalPages: 1,
      currentPage: 1,
      campos: [],
      selectedFieldId: null,
      addModeTipo: null, // 'texto' | 'firma' | 'sello' | null
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

  async function apiFetchJson(path, opts) {
    const url = getApiBase() + path;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      typeof getAuthHeaders === 'function' ? getAuthHeaders() : {},
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
      if (cid) ctx.manuales[cid] = inp.value;
    });
    return ctx;
  }

  function resolverPreviewLocal(campo, ctx) {
    if (!campo) return '';
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

  // ==================== GENERAR / ENVIAR A FIRMA ====================
  async function cargarPlantillas() {
    const selGen = document.getElementById('selFirmaPlantilla');
    const selEdit = document.getElementById('selEditarPlantillaExistente');
    try {
      const data = await apiFetchJson('/api/firmas/plantillas', { method: 'GET' });
      state.plantillas = Array.isArray(data.plantillas) ? data.plantillas : [];
    } catch (err) {
      console.warn('Error cargando plantillas de firma:', err);
      state.plantillas = [];
    }

    if (selGen) {
      const prev = selGen.value;
      selGen.innerHTML = '<option value="">-- Seleccionar plantilla PDF AMMER --</option>' +
        state.plantillas.map((p) => `<option value="${escHtml(p.id)}">${escHtml(p.nombre)} (${escHtml(p.categoria || 'GENERAL')} · ${(p.campos_json || []).length} campos)</option>`).join('');
      if (prev && state.plantillas.some((p) => p.id === prev)) selGen.value = prev;
      else if (state.plantillas.length > 0 && !selGen.value) selGen.value = state.plantillas[0].id;
      onPlantillaGenerarChange();
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

  function derivarFirmantesDePlantilla(tpl) {
    const campos = (tpl && Array.isArray(tpl.campos_json)) ? tpl.campos_json : [];
    const encontrados = [];
    const vistos = new Set();
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
      });
    });
    if (encontrados.length === 0) {
      encontrados.push({ clave: 'firmante_1', etiqueta: 'Titular / Asociado', nombre: '', dni: '', telefono: '' });
    }
    return encontrados;
  }

  function onPlantillaGenerarChange() {
    const sel = document.getElementById('selFirmaPlantilla');
    const pid = sel ? sel.value : '';
    state.selectedPlantillaGenerar = state.plantillas.find((p) => p.id === pid) || null;
    if (state.selectedPlantillaGenerar) {
      state.firmantesGenerar = derivarFirmantesDePlantilla(state.selectedPlantillaGenerar);
    } else {
      state.firmantesGenerar = [{ clave: 'firmante_1', etiqueta: 'Titular / Asociado', nombre: '', dni: '', telefono: '' }];
    }
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
    });
    renderFirmantesGenerar();
  }

  function eliminarFirmanteGenerador(idx) {
    if (state.firmantesGenerar.length <= 1) return;
    state.firmantesGenerar.splice(idx, 1);
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
      <div style="display:grid;grid-template-columns:minmax(130px,1fr) minmax(150px,1.2fr) minmax(110px,0.8fr) minmax(120px,0.9fr) auto;gap:0.45rem;align-items:end;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem;">
        <div>
          <label style="display:block;font-size:0.68rem;font-weight:700;color:#475569;">Rol / Etiqueta (${escHtml(f.clave)})</label>
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
        <div>
          ${state.firmantesGenerar.length > 1
            ? `<button type="button" onclick="window.eliminarFirmanteGenerador(${idx})" title="Quitar firmante" style="padding:0.35rem 0.55rem;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:0.75rem;cursor:pointer;">🗑️</button>`
            : '<span style="font-size:0.72rem;color:#94a3b8;padding:0 4px;">#1</span>'}
        </div>
      </div>
    `).join('');
  }

  function renderCamposCompletarFormulario() {
    const cont = document.getElementById('firmaCamposGenerarContainer');
    const badgeVal = document.getElementById('firmaValidacionesResumen');
    const selloWrap = document.getElementById('firmaSelloInstitucionalWrap');
    if (!cont) return;

    const tpl = state.selectedPlantillaGenerar;
    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    renderFirmantesGenerar(ctx);

    if (!tpl) {
      if (selloWrap) selloWrap.style.display = 'none';
      cont.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.84rem;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1;">Seleccioná una plantilla arriba (o cargá tus PDFs en el <strong>Editor Visual de Plantillas PDF</strong> si todavía no creaste ninguna).</div>';
      if (badgeVal) badgeVal.innerHTML = '';
      return;
    }

    const campos = Array.isArray(tpl.campos_json) ? tpl.campos_json : [];
    const vals = tpl.validaciones_json || {};
    const usaSello = Boolean(vals.requiere_sello_png) || campos.some((c) => String(c.tipo || '').toLowerCase() === 'sello');
    if (selloWrap) selloWrap.style.display = usaSello ? 'block' : 'none';
    renderPreviewSelloPng();

    if (badgeVal) {
      const chips = [];
      chips.push(`👥 ${state.firmantesGenerar.length} ${state.firmantesGenerar.length === 1 ? 'firmante' : 'firmantes requeridos'}`);
      if (usaSello) chips.push('🏛️ Sello Institucional PNG');
      if (vals.firma_olografa !== false) chips.push('✍️ Firma manuscrita');
      if (vals.gps_obligatorio) chips.push('📍 GPS');
      if (vals.tapar_resaltados !== false) chips.push('🧹 Limpia resaltados amarillos');
      if (vals.dni_frente_dorso) chips.push('🪪 DNI (Fase 2)');
      if (vals.selfie_liveness) chips.push('🤳 Selfie Liveness (Fase 2)');
      badgeVal.innerHTML = chips.map((c) => `<span style="font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:9999px;background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe;">${escHtml(c)}</span>`).join(' ');
    }

    const inpWa = document.getElementById('inpFirmaTelefonoWa');
    if (inpWa && ctx.solicitante.telefono) inpWa.value = ctx.solicitante.telefono;

    const camposEditables = campos.filter((c) => c.tipo !== 'firma' && c.tipo !== 'sello');
    if (camposEditables.length === 0) {
      cont.innerHTML = '<div style="padding:0.85rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.82rem;color:#475569;">Esta plantilla no tiene campos de texto editables (solo cajas de firma/sello).</div>';
      return;
    }

    cont.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:0.65rem;">' +
      camposEditables.map((c) => {
        const val = resolverPreviewLocal(c, ctx);
        return `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.65rem;">
            <label style="display:block;font-size:0.71rem;font-weight:700;color:#475569;margin-bottom:3px;">
              ${escHtml(c.etiqueta || c.id)} <span style="font-weight:500;color:#94a3b8;">(Pág.${c.pagina || 1})</span>
            </label>
            <input type="text" data-firma-campo-valor="${escHtml(c.id)}" value="${escHtml(val)}" placeholder="Ingresar valor..." style="width:100%;padding:0.38rem 0.55rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.82rem;background:#ffffff;color:#0f172a;"/>
          </div>
        `;
      }).join('') +
      '</div>';
  }

  async function previsualizarPdfGenerado(usarFirmaPrueba) {
    const tpl = state.selectedPlantillaGenerar;
    if (!tpl) {
      notify('Seleccioná una plantilla PDF primero.', 'warning');
      return;
    }
    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    const firmaPrueba = usarFirmaPrueba && state.canvasFirmaPrueba.hasInk
      ? document.getElementById('canvasFirmaPruebaPresencial').toDataURL('image/png')
      : null;

    notify('Generando vista previa del PDF estampado...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/generar-preview', {
        method: 'POST',
        body: JSON.stringify({
          plantilla_id: tpl.id,
          contexto: ctx,
          firmaPngBase64: firmaPrueba,
          selloPngBase64: state.selloPngBase64 || null,
          incluir_hoja_evidencia: Boolean(firmaPrueba),
          quitar_resaltados: (tpl.validaciones_json || {}).tapar_resaltados !== false,
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
    const tpl = state.selectedPlantillaGenerar;
    if (!tpl) {
      notify('Seleccioná una plantilla PDF primero.', 'warning');
      return;
    }
    const vals = tpl.validaciones_json || {};
    if (vals.requiere_sello_png && !state.selloPngBase64) {
      notify('Esta plantilla requiere subir la imagen PNG del Sello Oficial Institucional antes de generar el enlace.', 'warning');
      return;
    }

    const exp = getExpedienteSeleccionadoEnGenerador();
    const ctx = construirContextoDesdeExpediente(exp);
    const inpWa = document.getElementById('inpFirmaTelefonoWa');
    const telWa = (inpWa && inpWa.value.trim()) || ctx.solicitante.telefono || '';
    const baseFirma = new URL('firmar.html', window.location.href).href.split('?')[0];

    const firmantesPayload = state.firmantesGenerar.map((f, idx) => ({
      clave: f.clave || `firmante_${idx + 1}`,
      etiqueta: f.etiqueta || `Firmante ${idx + 1}`,
      nombre: f.nombre || (idx === 0 ? (ctx.solicitante.nombre || 'Asociado/a') : `Firmante ${idx + 1}`),
      dni: f.dni || (idx === 0 ? (ctx.solicitante.dni || '') : ''),
      telefono: f.telefono || (idx === 0 ? telWa : ''),
    }));

    notify('Generando enlace(s) seguro(s) de firma 24hs...', 'info');
    try {
      const res = await apiFetchJson('/api/firmas/solicitudes', {
        method: 'POST',
        body: JSON.stringify({
          plantilla_id: tpl.id,
          plantilla_nombre: tpl.nombre,
          expediente_id: exp ? String(exp.id_definitivo || exp.id_provisorio || exp.id) : null,
          dni_solicitante: firmantesPayload[0].dni || ctx.solicitante.dni || '',
          nombre_solicitante: firmantesPayload[0].nombre || ctx.solicitante.nombre || 'Asociado/a',
          telefono_whatsapp: firmantesPayload[0].telefono || telWa,
          contexto: ctx,
          selloPngBase64: state.selloPngBase64 || null,
          firmantes: firmantesPayload,
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
        : [{ etiqueta: 'Firmante 1', nombre: firmantesPayload[0].nombre, telefono: telWa, url_firma: res.url_firma }];

      if (listCont) {
        listCont.innerHTML = enlaces.map((item, idx) => {
          const msg = `Hola ${item.nombre || 'Estimado/a'}, te compartimos desde Asociación Mutual Modelo de Entre Ríos (AMMER) el enlace seguro para revisar y firmar "${tpl.nombre}" (${item.etiqueta || 'Firmante'}):\n\n${item.url_firma}\n\nEste enlace es personal y tiene vigencia de 24 horas.`;
          return `
            <div style="background:#ffffff;border:1px solid #a7f3d0;border-radius:10px;padding:0.8rem;">
              <div style="font-size:0.8rem;font-weight:800;color:#065f46;margin-bottom:0.4rem;">
                👤 ${escHtml(item.etiqueta || `Firmante ${idx + 1}`)}: ${escHtml(item.nombre || '-')}
                ${item.dni ? `<span style="font-weight:500;color:#047857;">(DNI ${escHtml(item.dni)})</span>` : ''}
              </div>
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

  // ==================== BANDEJA DE FIRMAS ====================
  async function cargarBandejaFirmas() {
    const tbody = document.getElementById('tbodyBandejaFirmas');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.25rem;text-align:center;color:#64748b;">Cargando solicitudes de firma...</td></tr>';
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

      const gpsHtml = (r.geo_latitud != null && r.geo_longitud != null)
        ? `<a href="https://maps.google.com/?q=${r.geo_latitud},${r.geo_longitud}" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline;font-size:0.72rem;">📍 Ver GPS</a>`
        : '<span style="color:#94a3b8;font-size:0.72rem;">Sin GPS</span>';

      const shaShort = (r.hash_sha256_firmado || r.hash_sha256_original || '').slice(0, 14);
      const tipoDescarga = (est === 'FIRMADO' || est === 'PARCIAL') ? 'firmado' : 'original';
      const labelDescarga = est === 'FIRMADO' ? 'Firmado + Evidencia' : (est === 'PARCIAL' ? 'PDF Parcial' : 'Original');

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:0.65rem 0.6rem;font-size:0.8rem;">
            <strong>${escHtml(r.nombre_solicitante || '-')}</strong>
            <div style="font-size:0.72rem;color:#64748b;">DNI ${escHtml(r.dni_solicitante || '-')} · Exp: ${escHtml(r.expediente_id || '-')}</div>
          </td>
          <td style="padding:0.65rem 0.6rem;font-size:0.8rem;">${escHtml(r.plantilla_nombre || '-')}</td>
          <td style="padding:0.65rem 0.6rem;">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:0.71rem;font-weight:700;background:${bg};color:${col};">${escHtml(est)}</span>
          </td>
          <td style="padding:0.65rem 0.6rem;font-size:0.73rem;color:#475569;">
            <div>Creada: ${escHtml((r.created_at || '').slice(0, 16).replace('T', ' '))}</div>
            ${r.firmado_en ? `<div style="color:#166534;font-weight:700;">Firmada: ${escHtml(r.firmado_en.slice(0, 16).replace('T', ' '))}</div>` : ''}
          </td>
          <td style="padding:0.65rem 0.6rem;font-size:0.72rem;">
            <div class="font-mono" style="color:#334155;" title="${escHtml(r.hash_sha256_firmado || r.hash_sha256_original || '')}">SHA256: ${escHtml(shaShort)}…</div>
            <div>IP: ${escHtml(r.ip_origen || '-')} · ${gpsHtml}</div>
          </td>
          <td style="padding:0.65rem 0.6rem;text-align:right;white-space:nowrap;">
            <button type="button" onclick="window.descargarPdfSolicitudFirma('${escHtml(r.id)}', '${tipoDescarga}')" style="padding:0.32rem 0.65rem;border-radius:6px;border:1px solid #0f2744;background:#0f2744;color:#ffffff;font-size:0.74rem;font-weight:700;cursor:pointer;">
              ⬇️ ${labelDescarga}
            </button>
          </td>
        </tr>
      `;
    }).join('');
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

  // ==================== EDITOR VISUAL DE PLANTILLAS PDF ====================
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
      setEstadoEditorPdf(`📄 PDF renderizado (${state.editor.totalPages} pág.). Buscando resaltados amarillos automáticamente en el servidor...`, 'info');
    } catch (errRender) {
      setEstadoEditorPdf(`⚠️ No se pudo renderizar vista previa en canvas (${errRender.message}).`, 'err');
      notify('Error renderizando PDF local: ' + errRender.message, 'error');
      return;
    }

    // 2. Detectar resaltados amarillos en segundo plano sin bloquear el canvas si el PDF es en blanco o falla red
    try {
      const analisis = await apiFetchJson('/api/firmas/plantillas/analizar-pdf', {
        method: 'POST',
        body: JSON.stringify({ pdfBase64: b64 }),
      });
      const detectados = Array.isArray(analisis.campos_detectados) ? analisis.campos_detectados : [];
      state.editor.campos = detectados;
      state.editor.totalPages = analisis.paginas || state.editor.totalPages || 1;
      state.editor.selectedFieldId = detectados[0] ? detectados[0].id : null;
      renderCajasOverlayEditor();
      renderInspectorCamposEditor();

      if (detectados.length > 0) {
        setEstadoEditorPdf(`✅ Se detectaron ${detectados.length} campos resaltados automáticamente. También podés agregar cajas de Texto, Firma o Sello PNG arriba del lienzo.`, 'ok');
        notify(`PDF listo: se detectaron ${detectados.length} campos resaltados.`, 'success');
      } else {
        setEstadoEditorPdf('ℹ️ Este PDF no tiene resaltados amarillos (campos en blanco). Usá los botones "➕ Marcar Campo Texto", "✍️ Marcar Caja Firma" y "🏛️ Marcar Caja Sello PNG" para hacer clic donde quieras estampar.', 'warn');
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

      await cargarPdfEnCanvasEditor(res.pdfBase64, 1);
      renderInspectorCamposEditor();
      setEstadoEditorPdf(`✅ Plantilla "${tpl.nombre}" cargada para edición (${state.editor.campos.length} campos).`, 'ok');
    } catch (err) {
      setEstadoEditorPdf(`❌ Error cargando plantilla: ${err.message}`, 'err');
      notify('Error cargando plantilla: ' + err.message, 'error');
    }
  }

  async function cargarPdfEnCanvasEditor(b64, pageNum) {
    const canvas = document.getElementById('canvasEditorPlantillaPdf');
    const lblPag = document.getElementById('lblEditorPaginaActual');
    if (!canvas || !b64) return;
    if (!state.editor.pdfDoc || state.editor._loadedB64 !== b64) {
      state.editor.pdfDoc = await cargarDocumentoPdfJs(base64ToUint8Array(b64));
      state.editor._loadedB64 = b64;
      state.editor.totalPages = state.editor.pdfDoc.numPages || 1;
    }
    const pag = Math.max(1, Math.min(pageNum, state.editor.totalPages));
    state.editor.currentPage = pag;
    if (lblPag) lblPag.textContent = `Página ${pag} de ${state.editor.totalPages}`;

    const page = await state.editor.pdfDoc.getPage(pag);
    const vp = page.getViewport({ scale: 1.25 });
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    renderCajasOverlayEditor();
  }

  function cambiarPaginaEditor(delta) {
    if (!state.editor.pdfBase64) return;
    const next = Math.max(1, Math.min(state.editor.totalPages, state.editor.currentPage + delta));
    if (next !== state.editor.currentPage) {
      cargarPdfEnCanvasEditor(state.editor.pdfBase64, next);
    }
  }

  function activarModoClickAgregarCampo(tipo) {
    if (!state.editor.pdfBase64) {
      notify('Primero subí o seleccioná un PDF plantilla arriba para visualizarlo.', 'warning');
      return;
    }
    state.editor.addModeTipo = tipo;
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (overlay) overlay.style.cursor = tipo ? 'crosshair' : 'default';
    if (tipo === 'firma') notify('Hacé clic en el PDF donde querés ubicar la caja de Firma Manuscrita.', 'info');
    else if (tipo === 'sello') notify('Hacé clic en el PDF donde querés estampar el Sello Oficial PNG.', 'info');
    else if (tipo === 'texto') notify('Hacé clic en el PDF donde querés colocar el nuevo campo.', 'info');
  }

  function agregarCampoEnCoords(xPct, yPct, tipo) {
    const id = 'cmp_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 100);
    const esFirma = tipo === 'firma';
    const esSello = tipo === 'sello';
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
    if (overlay) overlay.style.cursor = 'default';
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function renderCajasOverlayEditor() {
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (!overlay) return;
    overlay.innerHTML = '';

    const camposPag = state.editor.campos.filter((c) => Number(c.pagina || 1) === state.editor.currentPage);
    camposPag.forEach((c) => {
      const el = document.createElement('div');
      const selected = c.id === state.editor.selectedFieldId;
      const esFirma = c.tipo === 'firma';
      const esSello = c.tipo === 'sello' || c.origen_campo === 'sello_institucional';
      el.style.position = 'absolute';
      el.style.left = `${(c.x_pct || 0) * 100}%`;
      el.style.top = `${(c.y_pct || 0) * 100}%`;
      el.style.width = `${(c.w_pct || 0.2) * 100}%`;
      el.style.height = `${(c.h_pct || 0.03) * 100}%`;

      let borderCol = '#d97706', bgCol = 'rgba(245, 158, 11, 0.22)', tagBg = '#b45309';
      if (esFirma) { borderCol = '#059669'; bgCol = 'rgba(16, 185, 129, 0.16)'; tagBg = '#047857'; }
      else if (esSello) { borderCol = '#7c3aed'; bgCol = 'rgba(124, 58, 237, 0.16)'; tagBg = '#6d28d9'; }
      if (selected) { borderCol = '#2563eb'; bgCol = 'rgba(37, 99, 235, 0.20)'; tagBg = '#1d4ed8'; }

      el.style.border = `${esFirma || esSello ? '2px dashed' : (selected ? '2px solid' : '1.5px solid')} ${borderCol}`;
      el.style.background = bgCol;
      el.style.borderRadius = '3px';
      el.style.cursor = 'move';
      el.style.boxSizing = 'border-box';
      el.style.userSelect = 'none';
      el.style.zIndex = selected ? '20' : '10';
      el.title = `${c.etiqueta} (${c.origen_campo})`;

      const lbl = document.createElement('span');
      if (esFirma) {
        const fc = String(c.firmante_clave || 'firmante_1').replace('firmante_', 'F');
        lbl.textContent = `✍️ [${fc}] ${c.etiqueta || 'Firma'}`;
      } else if (esSello) {
        lbl.textContent = `🏛️ ${c.etiqueta || 'Sello PNG'}`;
      } else {
        lbl.textContent = c.etiqueta || c.origen_campo;
      }
      lbl.style.position = 'absolute';
      lbl.style.top = '-16px';
      lbl.style.left = '0';
      lbl.style.fontSize = '10px';
      lbl.style.fontWeight = '700';
      lbl.style.padding = '1px 4px';
      lbl.style.borderRadius = '3px';
      lbl.style.whiteSpace = 'nowrap';
      lbl.style.background = tagBg;
      lbl.style.color = '#ffffff';
      lbl.style.pointerEvents = 'none';
      el.appendChild(lbl);

      const handle = document.createElement('div');
      handle.style.position = 'absolute';
      handle.style.right = '-4px';
      handle.style.bottom = '-4px';
      handle.style.width = '10px';
      handle.style.height = '10px';
      handle.style.background = '#1d4ed8';
      handle.style.border = '1.5px solid #ffffff';
      handle.style.borderRadius = '2px';
      handle.style.cursor = 'nwse-resize';
      el.appendChild(handle);

      el.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        state.editor.selectedFieldId = c.id;
        renderCajasOverlayEditor();
        renderInspectorCamposEditor();

        const rect = overlay.getBoundingClientRect();
        const isResize = ev.target === handle;
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origXPct = c.x_pct;
        const origYPct = c.y_pct;
        const origWPct = c.w_pct;
        const origHPct = c.h_pct;

        function onMove(mv) {
          const dx = (mv.clientX - startX) / rect.width;
          const dy = (mv.clientY - startY) / rect.height;
          if (isResize) {
            c.w_pct = Math.max(0.03, Math.min(1 - c.x_pct, Number((origWPct + dx).toFixed(4))));
            c.h_pct = Math.max(0.015, Math.min(1 - c.y_pct, Number((origHPct + dy).toFixed(4))));
          } else {
            c.x_pct = Math.max(0, Math.min(1 - c.w_pct, Number((origXPct + dx).toFixed(4))));
            c.y_pct = Math.max(0, Math.min(1 - c.h_pct, Number((origYPct + dy).toFixed(4))));
          }
          el.style.left = `${c.x_pct * 100}%`;
          el.style.top = `${c.y_pct * 100}%`;
          el.style.width = `${c.w_pct * 100}%`;
          el.style.height = `${c.h_pct * 100}%`;
        }

        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          renderInspectorCamposEditor();
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      overlay.appendChild(el);
    });
  }

  function setupOverlayClickListener() {
    const overlay = document.getElementById('overlayCamposPlantilla');
    if (!overlay || overlay.dataset.boundClick) return;
    overlay.dataset.boundClick = '1';
    overlay.addEventListener('mousedown', (ev) => {
      if (!state.editor.addModeTipo || ev.target !== overlay) return;
      const rect = overlay.getBoundingClientRect();
      const xPct = (ev.clientX - rect.left) / rect.width;
      const yPct = (ev.clientY - rect.top) / rect.height;
      agregarCampoEnCoords(xPct, yPct, state.editor.addModeTipo);
    });
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
          const ico = item.tipo === 'firma' ? '✍️ ' : (item.tipo === 'sello' ? '🏛️ ' : '');
          return `<button type="button" onclick="window.seleccionarCampoEditor('${escHtml(item.id)}')" style="padding:3px 8px;border-radius:6px;border:1px solid ${act ? '#1d4ed8' : '#cbd5e1'};background:${act ? '#dbeafe' : '#ffffff'};color:${act ? '#1e3a8a' : '#334155'};font-size:0.72rem;font-weight:700;cursor:pointer;">${ico}P${item.pagina || 1}: ${escHtml(item.etiqueta || item.id)}</button>`;
        }).join(' ');
    }

    if (!cont) return;
    if (!c) {
      cont.innerHTML = '<div style="padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1;font-size:0.8rem;color:#64748b;">Hacé clic sobre un cuadro en el PDF (o agregá un campo nuevo) para configurar qué dato o firmante se estampa ahí.</div>';
      return;
    }

    const optHtml = ORIGENES_CAMPO.map((o) =>
      `<option value="${escHtml(o.value)}" ${c.origen_campo === o.value ? 'selected' : ''}>${escHtml(o.label)}</option>`
    ).join('');

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

    cont.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.8rem;display:flex;flex-direction:column;gap:0.55rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:0.82rem;color:#0f172a;">Campo: ${escHtml(c.id)} (Pág. ${c.pagina || 1})</strong>
          <button type="button" onclick="window.eliminarCampoEditor('${escHtml(c.id)}')" style="padding:2px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:0.72rem;font-weight:700;cursor:pointer;">🗑️ Quitar</button>
        </div>
        ${c.texto_referencia ? `<div style="font-size:0.71rem;color:#64748b;background:#fffbeb;padding:4px 6px;border-radius:5px;border:1px solid #fde68a;">Texto detectado en plantilla: "${escHtml(c.texto_referencia)}"</div>` : ''}
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:#475569;">Etiqueta visible</label>
          <input type="text" id="editCampoEtiqueta" value="${escHtml(c.etiqueta || '')}" oninput="window.actualizarPropCampoEditor('etiqueta', this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;"/>
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:#475569;">Tipo / Dato del expediente a estampar</label>
          <select id="editCampoOrigen" onchange="window.actualizarOrigenCampoEditor(this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;background:#ffffff;">${optHtml}</select>
        </div>
        ${extraFirmaHtml}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <div>
            <label style="font-size:0.72rem;font-weight:700;color:#475569;">Tamaño fuente</label>
            <input type="number" min="6" max="18" step="0.5" value="${Number(c.font_size || 10)}" oninput="window.actualizarPropCampoEditor('font_size', parseFloat(this.value) || 10)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;"/>
          </div>
          <div style="display:flex;align-items:flex-end;padding-bottom:4px;">
            <label style="display:flex;align-items:center;gap:5px;font-size:0.75rem;font-weight:600;color:#334155;cursor:pointer;">
              <input type="checkbox" ${c.cubrir_fondo !== false ? 'checked' : ''} onchange="window.actualizarPropCampoEditor('cubrir_fondo', this.checked)"/>
              Tapar fondo en blanco
            </label>
          </div>
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:#475569;">Valor por defecto / texto fijo (opcional)</label>
          <input type="text" value="${escHtml(c.valor_manual || '')}" oninput="window.actualizarPropCampoEditor('valor_manual', this.value)" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.8rem;" placeholder="Se usa si el dato es manual"/>
        </div>
      </div>
    `;
  }

  function seleccionarCampoEditor(cid) {
    const c = state.editor.campos.find((x) => x.id === cid);
    if (!c) return;
    state.editor.selectedFieldId = cid;
    if (Number(c.pagina || 1) !== state.editor.currentPage && state.editor.pdfBase64) {
      cargarPdfEnCanvasEditor(state.editor.pdfBase64, Number(c.pagina || 1));
    } else {
      renderCajasOverlayEditor();
    }
    renderInspectorCamposEditor();
  }

  function actualizarPropCampoEditor(prop, val) {
    const c = state.editor.campos.find((x) => x.id === state.editor.selectedFieldId);
    if (!c) return;
    c[prop] = val;
    renderCajasOverlayEditor();
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
    } else if (origen.startsWith('fecha.')) {
      c.tipo = 'fecha';
    } else {
      c.tipo = 'texto';
    }
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
  }

  function eliminarCampoEditor(cid) {
    state.editor.campos = state.editor.campos.filter((x) => x.id !== cid);
    state.editor.selectedFieldId = state.editor.campos[0] ? state.editor.campos[0].id : null;
    renderCajasOverlayEditor();
    renderInspectorCamposEditor();
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
        typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
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
    await cargarPlantillas();
    if (!state.initialized) {
      state.initialized = true;
      cambiarTabFirmas('generar');
    }
  }

  // Exportar API global
  global.initFirmasAmmerView = initFirmasAmmerView;
  global.cambiarTabFirmas = cambiarTabFirmas;
  global.onPlantillaGenerarChange = onPlantillaGenerarChange;
  global.renderCamposCompletarFormulario = renderCamposCompletarFormulario;
  global.agregarFirmanteGenerador = agregarFirmanteGenerador;
  global.eliminarFirmanteGenerador = eliminarFirmanteGenerador;
  global.actualizarDatoFirmanteGenerador = actualizarDatoFirmanteGenerador;
  global.onArchivoSelloPngSeleccionado = onArchivoSelloPngSeleccionado;
  global.limpiarSelloPngOficial = limpiarSelloPngOficial;
  global.previsualizarPdfGenerado = previsualizarPdfGenerado;
  global.generarEnlaceFirmaMovil = generarEnlaceFirmaMovil;
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
  global.onArchivoPdfPlantillaSeleccionado = onArchivoPdfPlantillaSeleccionado;
  global.cargarPlantillaEnEditor = cargarPlantillaEnEditor;
  global.cambiarPaginaEditor = cambiarPaginaEditor;
  global.activarModoClickAgregarCampo = activarModoClickAgregarCampo;
  global.seleccionarCampoEditor = seleccionarCampoEditor;
  global.actualizarPropCampoEditor = actualizarPropCampoEditor;
  global.actualizarOrigenCampoEditor = actualizarOrigenCampoEditor;
  global.eliminarCampoEditor = eliminarCampoEditor;
  global.guardarPlantillaDesdeEditor = guardarPlantillaDesdeEditor;
  global.probarEstampadoEditor = probarEstampadoEditor;
  global.exportarExpedienteCompletoZip = exportarExpedienteCompletoZip;
})(window);
