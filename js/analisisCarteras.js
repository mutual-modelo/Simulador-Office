(function () {
  const API_BASE =
    (typeof window.RENDER_API_URL === 'string' && window.RENDER_API_URL) ||
    'https://ammer-auditor-api.onrender.com';

  let colaArchivos = [];
  let auditoriasCache = [];
  let auditoriaSeleccionadaId = null;

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

  function renderCola() {
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
          `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;background:#f8fafc;">
            <span style="font-size:0.82rem;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.nombre}</span>
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
    renderCola();
  };

  window.ejecutarAnalisisCartera = async function () {
    const idOpInput = document.getElementById('carterasIdOperacion');
    const idOp = (idOpInput ? idOpInput.value : '').trim();
    const statusEl = document.getElementById('carterasEstadoProceso');

    if (!idOp) {
      alert('Ingresa un ID_OPERACION válido.');
      return;
    }
    if (!colaArchivos.length) {
      alert('Adjunta al menos un documento (PDF o imagen) para analizar.');
      return;
    }

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML =
        '<span style="color:#0284c7;font-weight:600;">Analizando documentación con IA y cruzando contra Cartera Base...</span>';
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
        statusEl.innerHTML = `<span style="color:#15803d;font-weight:700;">Auditoría completada: ${aud.estado || 'OK'} (Score ${aud.score ?? 0}/100)</span>`;
      }
      window.limpiarColaCarteras();
      await window.cargarAuditoriasCarteras();
    } catch (err) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">Error: ${err.message}</span>`;
      }
    }
  };

  function badgeEstado(estado) {
    const map = {
      APROBADO: 'background:#dcfce7;color:#166534;',
      OBSERVADO: 'background:#fef9c3;color:#854d0e;',
      RECHAZADO: 'background:#fee2e2;color:#991b1b;',
      PENDIENTE_REVISION: 'background:#e0f2fe;color:#075985;',
    };
    const style = map[estado] || 'background:#f1f5f9;color:#334155;';
    return `<span style="padding:3px 9px;border-radius:9999px;font-size:0.72rem;font-weight:700;${style}">${estado || '-'}</span>`;
  }

  window.cargarAuditoriasCarteras = async function () {
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
          return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 12px;font-weight:700;color:#0f172a;">${item.id_operacion || '-'}</td>
            <td style="padding:10px 12px;color:#334155;">${item.apellido_nombre || '-'}</td>
            <td style="padding:10px 12px;">${badgeEstado(item.estado)}</td>
            <td style="padding:10px 12px;font-weight:700;">${item.score ?? 0}/100</td>
            <td style="padding:10px 12px;">${
              alertasCount > 0
                ? `<span style="color:#b45309;font-weight:700;">${alertasCount} alerta(s)</span>`
                : '<span style="color:#15803d;">Sin diferencias</span>'
            }</td>
            <td style="padding:10px 12px;text-align:right;">
              <button type="button" onclick="window.abrirDetalleCartera('${item.id}')" style="padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-size:0.78rem;font-weight:600;">Ver / Resolver</button>
            </td>
          </tr>`;
        })
        .join('');
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">${err.message}</td></tr>`;
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
      const discs = (item.discrepancias || []).map((d) => `<li>${d}</li>`).join('') || '<li>Ninguna</li>';
      const falts = (item.faltantes || []).map((f) => `<li>${f}</li>`).join('') || '<li>Ninguno</li>';
      body.innerHTML = `
        <div style="margin-bottom:10px;"><strong>Operación:</strong> ${item.id_operacion} — ${item.apellido_nombre || ''}</div>
        <div style="margin-bottom:10px;"><strong>Resumen IA:</strong> ${item.resumen_ia || '-'}</div>
        <div style="margin-bottom:10px;"><strong>Diferencias / Alertas:</strong><ul style="margin:4px 0 0 18px;color:#b91c1c;">${discs}</ul></div>
        <div><strong>Faltantes:</strong><ul style="margin:4px 0 0 18px;color:#b45309;">${falts}</ul></div>
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
})();
