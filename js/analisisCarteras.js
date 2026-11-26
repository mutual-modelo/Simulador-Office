(function () {
  const API_BASE =
    (typeof window.RENDER_API_URL === 'string' && window.RENDER_API_URL) ||
    'https://ammer-auditor-api.onrender.com';
  const LS_CARTERA_BASE_KEY = 'AMMER_CARTERA_BASE_LOCAL_V1';

  let colaArchivos = [];
  let auditoriasCache = [];
  let carteraBaseCache = [];
  let auditoriaSeleccionadaId = null;

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getAuthHeaders() {
    let token = '';
    try {
      if (typeof window.getApiAuthToken === 'function') {
        token = window.getApiAuthToken() || '';
      }
      if (!token) {
        token =
          sessionStorage.getItem('AMMER_API_TOKEN') ||
          localStorage.getItem('AMMER_API_TOKEN') ||
          sessionStorage.getItem('AMMER_AUTH_TOKEN') ||
          localStorage.getItem('AMMER_AUTH_TOKEN') ||
          '';
      }
      if (!token) {
        const raw =
          sessionStorage.getItem('sesion_mutual') ||
          sessionStorage.getItem('AMMER_AUTH_SESSION') ||
          localStorage.getItem('sesion_mutual') ||
          localStorage.getItem('AMMER_AUTH_SESSION') ||
          '{}';
        const parsed = JSON.parse(raw);
        token = parsed.token || parsed.access_token || parsed.authToken || '';
      }
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function detectarIdOperacionDesdeNombre(nombre) {
    const s = String(nombre || '');
    const mPref = s.match(/(?:EXP|SOL|OP|ID)[-_ ]?(\d{3,10})/i);
    if (mPref) return mPref[1];
    const mNum = s.match(/\b(\d{4,8})\b/);
    return mNum ? mNum[1] : '';
  }

  function sincronizarIdOperacionDesdeCola() {
    const inp = document.getElementById('carterasIdOperacion');
    const badge = document.getElementById('carterasIdAutoBadge');
    if (!inp) return '';
    if (inp.value.trim()) return inp.value.trim();
    for (const f of colaArchivos) {
      const det = detectarIdOperacionDesdeNombre(f.nombre);
      if (det) {
        inp.value = det;
        if (badge) badge.style.display = 'inline-block';
        return det;
      }
    }
    return '';
  }

  function initDropZone() {
    const dz = document.getElementById('carterasDropZone');
    if (!dz || dz.dataset.dzBound === '1') return;
    dz.dataset.dzBound = '1';
    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.style.borderColor = '#0284c7';
      dz.style.background = '#e0f2fe';
    });
    dz.addEventListener('dragleave', () => {
      dz.style.borderColor = '#93c5fd';
      dz.style.background = '#f8fafc';
    });
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.style.borderColor = '#93c5fd';
      dz.style.background = '#f8fafc';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        window.manejarArchivosCarteras(e.dataTransfer.files);
      }
    });
  }

  function renderCola() {
    initDropZone();
    const cont = document.getElementById('carterasColaLista');
    if (!cont) return;
    if (!colaArchivos.length) {
      cont.innerHTML =
        '<div style="font-size:0.82rem;color:#64748b;padding:8px 0;">No hay archivos seleccionados.</div>';
      return;
    }
    cont.innerHTML = colaArchivos
      .map(
        (f, idx) =>
          `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;background:#f8fafc;">
            <span style="font-size:0.82rem;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📄 ${escHtml(f.nombre)}</span>
            <button type="button" onclick="window.quitarArchivoCartera(${idx})" style="border:none;background:transparent;color:#ef4444;cursor:pointer;font-weight:700;font-size:0.85rem;">✕</button>
          </div>`
      )
      .join('');
  }

  window.quitarArchivoCartera = function (idx) {
    colaArchivos.splice(idx, 1);
    renderCola();
  };

  window.limpiarColaCarteras = function () {
    colaArchivos = [];
    const input = document.getElementById('carterasFileInput');
    if (input) input.value = '';
    const badge = document.getElementById('carterasIdAutoBadge');
    if (badge) badge.style.display = 'none';
    renderCola();
  };

  window.manejarArchivosCarteras = async function (fileList) {
    if (!fileList || !fileList.length) return;
    for (const file of Array.from(fileList)) {
      const b64 = await fileToBase64(file);
      colaArchivos.push({
        nombre: file.name,
        mimeType: file.type || 'application/pdf',
        base64: b64,
      });
    }
    sincronizarIdOperacionDesdeCola();
    renderCola();
  };

  window.cambiarTabCarteras = function (tab) {
    const pAud = document.getElementById('panelCarterasAuditoria');
    const pBase = document.getElementById('panelCarterasBase');
    const bAud = document.getElementById('tabBtnCarterasAuditoria');
    const bBase = document.getElementById('tabBtnCarterasBase');
    const esBase = tab === 'base';
    if (pAud) pAud.style.display = esBase ? 'none' : 'block';
    if (pBase) pBase.style.display = esBase ? 'block' : 'none';
    if (bAud) {
      bAud.style.background = esBase ? '#fff' : '#0284c7';
      bAud.style.color = esBase ? '#334155' : '#fff';
      bAud.style.borderColor = esBase ? '#cbd5e1' : '#0284c7';
    }
    if (bBase) {
      bBase.style.background = esBase ? '#0284c7' : '#fff';
      bBase.style.color = esBase ? '#fff' : '#334155';
      bBase.style.borderColor = esBase ? '#0284c7' : '#cbd5e1';
    }
    if (esBase) window.cargarCarteraBase();
  };

  window.ejecutarAnalisisCartera = async function () {
    const idOpInput = document.getElementById('carterasIdOperacion');
    let idOp = (idOpInput ? idOpInput.value : '').trim();
    if (!idOp) idOp = sincronizarIdOperacionDesdeCola();
    const statusEl = document.getElementById('carterasEstadoProceso');

    if (!colaArchivos.length) {
      alert('Adjunta al menos un documento (PDF o imagen) para analizar.');
      return;
    }
    if (!idOp) {
      alert('No se pudo detectar el ID Operación desde los archivos. Ingresalo manualmente.');
      if (idOpInput) idOpInput.focus();
      return;
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML =
        '<span style="color:#0284c7;font-weight:600;">⏳ Analizando documentación con IA y cruzando contra Cartera Base...</span>';
    }

    try {
      const resp = await fetch(`${API_BASE}/api/carteras/auditar-legajo`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id_operacion: idOp,
          archivos: colaArchivos,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Error al auditar legajo');
      }
      if (statusEl) {
        const aud = data.auditoria || {};
        statusEl.innerHTML = `<span style="color:#15803d;font-weight:700;">✅ Auditoría completada: ${escHtml(aud.estado || 'OK')} (Score ${aud.score ?? 0}/100)</span>`;
      }
      window.limpiarColaCarteras();
      await window.cargarAuditoriasCarteras();
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">❌ Error: ${escHtml(err.message)}</span>`;
      }
    }
  };

  function badgeEstado(estado) {
    const up = String(estado || '').toUpperCase();
    const map = {
      APROBADO: { label: 'Aprobado', style: 'background:#dcfce7;color:#166534;' },
      OBSERVADO: { label: 'Observado', style: 'background:#ffedd5;color:#9a3412;' },
      RECHAZADO: { label: 'Rechazado', style: 'background:#fee2e2;color:#991b1b;' },
      PENDIENTE_REVISION: { label: 'Pendiente Revisión', style: 'background:#e0f2fe;color:#075985;' },
    };
    const cfg = map[up] || { label: estado || '-', style: 'background:#f1f5f9;color:#334155;' };
    return `<span style="padding:3px 9px;border-radius:9999px;font-size:0.72rem;font-weight:700;${cfg.style}">${escHtml(cfg.label)}</span>`;
  }

  window.cargarAuditoriasCarteras = async function () {
    initDropZone();
    const tbody = document.getElementById('carterasTablaBody');
    const filtroEstado = (document.getElementById('carterasFiltroEstado') || {}).value || 'TODOS';
    const filtroTexto = ((document.getElementById('carterasFiltroTexto') || {}).value || '').trim();

    try {
      const params = new URLSearchParams();
      if (filtroEstado && filtroEstado !== 'TODOS') params.set('estado', filtroEstado);
      if (filtroTexto) params.set('q', filtroTexto);

      const resp = await fetch(`${API_BASE}/api/carteras/auditorias?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'No se pudo cargar el listado');

      auditoriasCache = data.items || [];
      const kpis = data.kpis || {};
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? 0);
      };
      setTxt('carterasKpiTotal', kpis.total || 0);
      setTxt('carterasKpiAprobados', kpis.aprobados || 0);
      setTxt('carterasKpiObservados', kpis.observados || 0);
      setTxt('carterasKpiRechazados', kpis.rechazados || 0);

      if (!tbody) return;
      if (!auditoriasCache.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;">Sin auditorías registradas.</td></tr>';
        return;
      }

      tbody.innerHTML = auditoriasCache
        .map((item) => {
          const alertasCount =
            (item.discrepancias || []).length +
            (item.faltantes || []).length +
            (item.alertas_forenses || []).length;
          const resumenCorto = String(item.resumen_ia || item.resolucion_manual || '').trim();
          return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 12px;font-weight:700;color:#0f172a;">${escHtml(item.id_operacion || '-')}</td>
            <td style="padding:10px 12px;color:#334155;">${escHtml(item.apellido_nombre || '-')}</td>
            <td style="padding:10px 12px;">${badgeEstado(item.estado)}</td>
            <td style="padding:10px 12px;font-weight:700;">${item.score ?? 0}/100</td>
            <td style="padding:10px 12px;max-width:300px;">
              ${resumenCorto ? `<div style="font-size:0.78rem;color:#334155;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(resumenCorto)}">${escHtml(resumenCorto)}</div>` : ''}
              ${
                alertasCount > 0
                  ? `<span style="color:#b45309;font-weight:700;font-size:0.76rem;">⚠️ ${alertasCount} alerta(s)</span>`
                  : '<span style="color:#15803d;font-size:0.76rem;font-weight:600;">✓ Sin diferencias</span>'
              }
            </td>
            <td style="padding:10px 12px;text-align:right;">
              <button type="button" onclick="window.abrirDetalleCartera('${escHtml(item.id)}')" style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-size:0.78rem;font-weight:600;">📋 Ficha</button>
            </td>
          </tr>`;
        })
        .join('');
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">${escHtml(err.message)}</td></tr>`;
      }
    }
  };

  window.abrirDetalleCartera = function (id) {
    const item = auditoriasCache.find((x) => String(x.id) === String(id));
    if (!item) return;
    auditoriaSeleccionadaId = item.id;

    const modal = document.getElementById('modalDetalleCartera');
    const body = document.getElementById('modalDetalleCarteraBody');
    const selEstado = document.getElementById('modalCarteraEstado');
    const txtObs = document.getElementById('modalCarteraResolucion');

    if (selEstado) selEstado.value = item.estado || 'OBSERVADO';
    if (txtObs) txtObs.value = item.resolucion_manual || '';

    if (body) {
      const discs = (item.discrepancias || []).map((d) => `<li>${escHtml(d)}</li>`).join('') || '<li>Ninguna</li>';
      const falts = (item.faltantes || []).map((f) => `<li>${escHtml(f)}</li>`).join('') || '<li>Ninguno</li>';
      const forenses = (item.alertas_forenses || []).map((a) => `<li>${escHtml(a)}</li>`).join('') || '<li>Sin alertas forenses</li>';
      const score = Number(item.score ?? 0);
      const scoreColor = score >= 80 ? '#16a34a' : (score >= 55 ? '#d97706' : '#dc2626');
      body.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;">
          <div>
            <div style="font-size:0.72rem;color:#64748b;font-weight:700;text-transform:uppercase;">Operación #${escHtml(item.id_operacion)}</div>
            <div style="font-size:1.02rem;font-weight:800;color:#0f172a;">${escHtml(item.apellido_nombre || 'Titular sin nombre')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${badgeEstado(item.estado)}
            <span style="font-weight:800;color:${scoreColor};font-size:0.9rem;">Score ${score}/100</span>
          </div>
        </div>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin-bottom:10px;">
          <div style="font-size:0.75rem;font-weight:800;color:#0f2744;margin-bottom:4px;">📝 Comentario / Resumen del Análisis</div>
          <div style="font-size:0.84rem;color:#1e293b;line-height:1.45;">${escHtml(item.resumen_ia || 'Sin resumen automático registrado.')}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <div style="background:#fff;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;">
            <strong style="font-size:0.78rem;color:#991b1b;">⚠️ Diferencias / Discrepancias</strong>
            <ul style="margin:4px 0 0 16px;padding:0;font-size:0.8rem;color:#b91c1c;">${discs}</ul>
          </div>
          <div style="background:#fff;border:1px solid #fed7aa;border-radius:8px;padding:8px 10px;">
            <strong style="font-size:0.78rem;color:#9a3412;">📄 Documentos Faltantes</strong>
            <ul style="margin:4px 0 0 16px;padding:0;font-size:0.8rem;color:#b45309;">${falts}</ul>
          </div>
          <div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;">
            <strong style="font-size:0.78rem;color:#334155;">🔎 Alertas Forenses</strong>
            <ul style="margin:4px 0 0 16px;padding:0;font-size:0.8rem;color:#475569;">${forenses}</ul>
          </div>
        </div>
      `;
    }
    if (modal) modal.style.display = 'flex';
  };

  window.cerrarDetalleCartera = function () {
    const modal = document.getElementById('modalDetalleCartera');
    if (modal) modal.style.display = 'none';
    auditoriaSeleccionadaId = null;
  };

  window.guardarResolucionCartera = async function () {
    if (!auditoriaSeleccionadaId) return;
    const estado = (document.getElementById('modalCarteraEstado') || {}).value || 'OBSERVADO';
    const resolucion_manual = (document.getElementById('modalCarteraResolucion') || {}).value || '';

    try {
      const resp = await fetch(`${API_BASE}/api/carteras/auditorias/${auditoriaSeleccionadaId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ estado, resolucion_manual }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Error al guardar resolución');
      window.cerrarDetalleCartera();
      await window.cargarAuditoriasCarteras();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  function leerCarteraBaseLocal() {
    try {
      return JSON.parse(localStorage.getItem(LS_CARTERA_BASE_KEY) || '[]') || [];
    } catch (_) {
      return [];
    }
  }

  function guardarCarteraBaseLocal(lista) {
    try {
      localStorage.setItem(LS_CARTERA_BASE_KEY, JSON.stringify(lista || []));
    } catch (_) {}
  }

  window.cargarCarteraBase = async function () {
    try {
      const resp = await fetch(`${API_BASE}/api/carteras/base`, { headers: getAuthHeaders() });
      if (resp.ok) {
        const data = await resp.json();
        carteraBaseCache = Array.isArray(data.items) ? data.items : [];
        guardarCarteraBaseLocal(carteraBaseCache);
      } else {
        carteraBaseCache = leerCarteraBaseLocal();
      }
    } catch (_) {
      carteraBaseCache = leerCarteraBaseLocal();
    }
    window.renderCarteraBaseTabla();
  };

  window.renderCarteraBaseTabla = function () {
    const tbody = document.getElementById('carteraBaseTablaBody');
    if (!tbody) return;
    const q = ((document.getElementById('carteraBaseFiltro') || {}).value || '').trim().toLowerCase();
    const filtrados = q
      ? carteraBaseCache.filter((r) =>
          [r.id_operacion, r.dni, r.apellido_nombre, r.linea].some((v) =>
            String(v || '').toLowerCase().includes(q)
          )
        )
      : carteraBaseCache;
    if (!filtrados.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748b;">No hay registros en la cartera base.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados
      .map(
        (r, idx) => `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px 10px;font-weight:700;">${escHtml(r.id_operacion || '-')}</td>
          <td style="padding:8px 10px;font-family:monospace;">${escHtml(r.dni || '-')}</td>
          <td style="padding:8px 10px;">${escHtml(r.apellido_nombre || '-')}</td>
          <td style="padding:8px 10px;">${escHtml(r.linea || '-')}</td>
          <td style="padding:8px 10px;font-family:monospace;">$${Number(r.monto || 0).toLocaleString('es-AR')}</td>
          <td style="padding:8px 10px;text-align:right;">
            <button type="button" onclick="window.eliminarRegistroCarteraBase('${escHtml(r.id || r.id_operacion)}', ${idx})" style="padding:4px 9px;border-radius:6px;border:1px solid #fecaca;background:#fff1f2;color:#be123c;font-size:0.76rem;font-weight:700;cursor:pointer;">Eliminar</button>
          </td>
        </tr>`
      )
      .join('');
  };

  window.agregarRegistroCarteraBase = async function (e) {
    if (e) e.preventDefault();
    const reg = {
      id: 'cb_' + Date.now(),
      id_operacion: (document.getElementById('cbIdOp') || {}).value.trim(),
      dni: (document.getElementById('cbDni') || {}).value.trim(),
      apellido_nombre: (document.getElementById('cbNombre') || {}).value.trim(),
      linea: (document.getElementById('cbLinea') || {}).value.trim() || 'FEDEM',
      monto: Number((document.getElementById('cbMonto') || {}).value || 0),
    };
    if (!reg.id_operacion || !reg.dni || !reg.apellido_nombre) return;
    try {
      const resp = await fetch(`${API_BASE}/api/carteras/base`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(reg),
      });
      if (resp.ok) {
        await window.cargarCarteraBase();
      } else {
        carteraBaseCache.unshift(reg);
        guardarCarteraBaseLocal(carteraBaseCache);
        window.renderCarteraBaseTabla();
      }
    } catch (_) {
      carteraBaseCache.unshift(reg);
      guardarCarteraBaseLocal(carteraBaseCache);
      window.renderCarteraBaseTabla();
    }
    ['cbIdOp', 'cbDni', 'cbNombre', 'cbLinea', 'cbMonto'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  };

  window.eliminarRegistroCarteraBase = async function (id, idx) {
    if (!confirm('¿Eliminar este registro de la Cartera Base?')) return;
    try {
      await fetch(`${API_BASE}/api/carteras/base/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch (_) {}
    carteraBaseCache = carteraBaseCache.filter((r, i) => String(r.id || r.id_operacion) !== String(id) && i !== idx);
    guardarCarteraBaseLocal(carteraBaseCache);
    window.renderCarteraBaseTabla();
  };

  function setImportStatus(msg, isError) {
    const el = document.getElementById('cbImportStatus');
    if (!el) return;
    el.style.display = msg ? 'block' : 'none';
    el.style.color = isError ? '#dc2626' : '#0369a1';
    el.textContent = msg || '';
  }

  function parsearMonedaAr(val) {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    const s = String(val || '').replace(/[$\s]/g, '').trim();
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
      return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (s.includes(',')) {
      return Number(s.replace(',', '.')) || 0;
    }
    return Number(s) || 0;
  }

  function parsearLineaCsv(linea, sep) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (inQuotes && linea[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function normalizarFilaCartera(obj, idx) {
    const lower = {};
    Object.keys(obj || {}).forEach((k) => {
      lower[String(k).trim().toLowerCase().replace(/\s+/g, '_')] = obj[k];
    });
    const idOp = String(
      lower.id_operacion || lower.id_op || lower.operacion || lower.expediente || lower.id || ''
    ).trim();
    const cuitRaw = String(lower.cuit || lower.cuil || '').replace(/\D/g, '');
    let dni = String(lower.dni || lower.documento || lower.nro_dni || '').replace(/\D/g, '');
    if (!dni && cuitRaw.length === 11) {
      dni = cuitRaw.slice(2, 10);
    }
    const nombre = String(
      lower.apellido_nombre || lower.titular || lower.nombre || lower.asociado || ''
    ).trim();
    const linea = String(
      lower.linea || lower.linea_ayuda || lower.origen_fondos || lower.tipo_de_descuento || lower.producto || 'FEDEM'
    ).trim() || 'FEDEM';
    const monto = parsearMonedaAr(
      lower.capital_original || lower.monto || lower.transferencia || lower.capital_a_ceder || lower.monto_pagare || lower.importe || 0
    );
    const cuota = parsearMonedaAr(lower.cuota || 0);
    const plazo = parseInt(lower.plazo || lower.cuotas_a_ceder || lower.cuotas || 0, 10) || 0;
    if (!idOp && !dni && !nombre) return null;
    return {
      id: 'cb_' + Date.now() + '_' + idx,
      id_operacion: idOp || dni || String(idx + 1),
      dni: dni || '-',
      cuit: cuitRaw || '',
      apellido_nombre: nombre || 'Sin nombre',
      linea,
      monto,
      cuota,
      plazo,
    };
  }

  function parsearTextoDelimitado(texto) {
    const lines = String(texto || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const firstCols = parsearLineaCsv(lines[0], sep);
    const looksLikeHeader = firstCols.some((c) => /id|dni|cuit|nombre|titular|monto|capital|linea|operacion/i.test(c));
    const headers = looksLikeHeader ? firstCols : ['id_operacion', 'dni', 'apellido_nombre', 'linea', 'monto'];
    const startIdx = looksLikeHeader ? 1 : 0;
    const out = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = parsearLineaCsv(lines[i], sep);
      const obj = {};
      headers.forEach((h, j) => {
        const key = String(h || '').trim();
        if (key && !(key in obj)) obj[key] = cols[j] || '';
      });
      const norm = normalizarFilaCartera(obj, i);
      if (norm) out.push(norm);
    }
    return out;
  }

  async function guardarLoteCarteraBase(nuevos) {
    if (!nuevos.length) {
      setImportStatus('No se encontraron registros válidos para importar.', true);
      return;
    }
    let syncBackend = false;
    try {
      const resp = await fetch(`${API_BASE}/api/carteras/base/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: nuevos }),
      });
      if (resp.ok) syncBackend = true;
    } catch (_) {}

    const existentes = new Set(carteraBaseCache.map((r) => String(r.id_operacion)));
    const filtrados = nuevos.filter((r) => !existentes.has(String(r.id_operacion)));
    carteraBaseCache = [...filtrados, ...carteraBaseCache];
    guardarCarteraBaseLocal(carteraBaseCache);
    window.renderCarteraBaseTabla();
    setImportStatus(
      `✅ Se importaron ${filtrados.length} registro(s) nuevos (${nuevos.length - filtrados.length} ya existentes).` +
        (syncBackend ? ' Sincronizado con servidor.' : ' Guardado en almacenamiento local.'),
      false
    );
  }

  function cargarSheetJsSiFalta() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel (SheetJS).'));
      document.head.appendChild(s);
    });
  }

  window.importarArchivoCarteraBase = async function (fileList) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setImportStatus(`⏳ Procesando "${file.name}"...`, false);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let registros = [];
      if (ext === 'json') {
        const parsed = JSON.parse(await file.text());
        const arr = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
        registros = arr.map((r, i) => normalizarFilaCartera(r, i)).filter(Boolean);
      } else if (ext === 'csv' || ext === 'txt') {
        registros = parsearTextoDelimitado(await file.text());
      } else {
        const XLSX = await cargarSheetJsSiFalta();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        registros = rows.map((r, i) => normalizarFilaCartera(r, i)).filter(Boolean);
      }
      await guardarLoteCarteraBase(registros);
    } catch (err) {
      setImportStatus('❌ Error al importar archivo: ' + err.message, true);
    } finally {
      const inp = document.getElementById('cbFileImport');
      if (inp) inp.value = '';
    }
  };

  window.sincronizarGoogleSheetCarteraBase = async function () {
    const inp = document.getElementById('cbGoogleSheetUrl');
    const rawUrl = (inp ? inp.value : '').trim();
    if (!rawUrl) {
      setImportStatus('Pegá la URL o ID del Google Sheet primero.', true);
      return;
    }
    setImportStatus('⏳ Sincronizando desde Google Sheets...', false);
    try {
      let csvUrl = rawUrl;
      const mId = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (mId) {
        const gidMatch = rawUrl.match(/gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        csvUrl = `https://docs.google.com/spreadsheets/d/${mId[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
      } else if (/^[a-zA-Z0-9-_]{25,}$/.test(rawUrl)) {
        csvUrl = `https://docs.google.com/spreadsheets/d/${rawUrl}/gviz/tq?tqx=out:csv&gid=0`;
      }
      const resp = await fetch(csvUrl);
      if (!resp.ok) throw new Error('Asegurate de que el Google Sheet esté compartido como "Cualquier persona con el enlace (Lector)".');
      const csvText = await resp.text();
      const registros = parsearTextoDelimitado(csvText);
      await guardarLoteCarteraBase(registros);
    } catch (err) {
      setImportStatus('❌ ' + err.message, true);
    }
  };

  window.pegarDesdeExcelCarteraBase = async function () {
    const texto = prompt('Pegá aquí las filas copiadas desde Excel o Google Sheets (formato: ID_OPERACION, DNI, TITULAR, LINEA, MONTO):');
    if (!texto) return;
    const registros = parsearTextoDelimitado(texto);
    await guardarLoteCarteraBase(registros);
  };

  window.vaciarCarteraBase = function () {
    if (!confirm('¿Vaciar todos los registros locales de la Cartera Base?')) return;
    carteraBaseCache = [];
    guardarCarteraBaseLocal([]);
    window.renderCarteraBaseTabla();
    setImportStatus('🗑️ Cartera Base vaciada.', false);
  };
})();
