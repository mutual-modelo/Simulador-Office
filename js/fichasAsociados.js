// ============================================================================
// MÓDULO FRONTEND: HISTORIAL INMUTABLE Y VISTA PADRÓN Y FICHAS DE ASOCIADOS
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  global._fichaPadronDniActivo = '';

  function _safeUrl(u) {
    if (typeof global.sanitizeSafeUrl === 'function') return global.sanitizeSafeUrl(u);
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? sanitizeHTML(s) : '';
  }

  function _obtenerDniActivoAuditoria20() {
    const st = global._auditoria20Estado || {};
    const candidatos = [
      st.dniSolicitante,
      (document.getElementById('inputDniEsperadoAudit20') || {}).value,
      (document.getElementById('inputDomDniAudit20') || {}).value,
      (document.getElementById('inputCajaJperDniAudit20') || {}).value,
      (document.getElementById('inputBoletinDniConsulta') || {}).value
    ];
    for (const c of candidatos) {
      const clean = String(c || '').replace(/\D/g, '').trim();
      if (clean.length === 11) return clean.slice(2, 10);
      if (clean.length >= 7) return clean;
    }
    return '';
  }

  async function guardarValidacionesEnFichaAsociado(tipoOpcional = null) {
    const st = global._auditoria20Estado || {};
    const dni = _obtenerDniActivoAuditoria20();
    if (!dni || dni.length < 7) {
      showToast('Se requiere un DNI válido (al menos 7 dígitos) para guardar en la ficha del asociado.');
      return false;
    }

    const nombre = String(
      st.nombreSolicitante ||
      (document.getElementById('inputDomNombreAudit20') || {}).value ||
      ''
    ).trim() || null;
    const sess = typeof getSession === 'function' ? getSession() : null;
    const analistaUsuario = sess ? String(sess.email || sess.id || '') : null;
    const analistaNombre = sess ? String(sess.nombre || sess.email || 'Analista') : null;

    const items = [];
    const agregar = (tipoVal, payloadObj) => {
      if (payloadObj && (!tipoOpcional || tipoOpcional === tipoVal)) {
        items.push({ tipoValidacion: tipoVal, resultado: payloadObj });
      }
    };

    agregar('DNI', st.dni);
    agregar('SERVICIO', st.domicilio);
    agregar('RECIBO', st.recibo);
    agregar('BOLETIN_ER', st.boletin);
    agregar('CAJAJPER', st.cajajper);
    agregar('INFORME_CONSOLIDADO', st.integral);

    if (items.length === 0) {
      showToast('Todavía no hay validaciones procesadas para guardar en la ficha.');
      return false;
    }

    const btnGuardar = document.getElementById('btnGuardarFichaAudit20');
    if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Guardando...'; }

    let guardados = 0;
    let ultimoError = '';
    try {
      for (const it of items) {
        const resp = await fetchConTimeout(`${RENDER_API_URL}/api/asociados/guardar-validacion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dni,
            tipoValidacion: it.tipoValidacion,
            resultado: it.resultado,
            nombreSolicitante: nombre,
            analistaUsuario,
            analistaNombre,
            crearAsociadoSiNoExiste: true
          })
        }, 25000);
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || data.ok === false) {
          ultimoError = data.detail || ('HTTP ' + resp.status);
        } else {
          guardados++;
        }
      }
      if (guardados > 0) {
        showToast('✅ Se guardaron ' + guardados + ' registro(s) en la ficha histórica del DNI ' + dni + '.');
        if (global._fichaPadronDniActivo === dni) {
          cargarFichaDetalleAsociado(dni);
        }
        return true;
      }
      throw new Error(ultimoError || 'No se pudo guardar la validación.');
    } catch (err) {
      showToast('⚠️ Error guardando ficha: ' + (err.message || String(err)));
      return false;
    } finally {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<span>💾 Guardar Auditoría en Ficha</span>'; }
    }
  }

  function abrirFichaHistoricaAsociado(dniOpcional = '') {
    const clean = String(dniOpcional || _obtenerDniActivoAuditoria20() || '').replace(/\D/g, '').trim();
    cambiarVistaPrincipal('ficha-asociado');
    const inp = document.getElementById('inputBuscarFichaPadron');
    if (clean && inp) {
      inp.value = clean;
    }
    buscarPadronFichasAsociados();
    if (clean.length >= 7) {
      cargarFichaDetalleAsociado(clean);
    }
  }

  function irAAuditoria20DesdeFicha(dni, nombre) {
    cambiarVistaPrincipal('auditoria-ia');
    if (typeof global._propagarContextoAsociadoAudit20 === 'function') {
      global._propagarContextoAsociadoAudit20({ dni, nombre });
    }
    if (typeof global.cambiarTabAuditoria20 === 'function') global.cambiarTabAuditoria20('recibo');
  }

  function _badgeEstadoFichaHtml(estadoRaw) {
    const up = String(estadoRaw || 'NO_VERIFICADO').toUpperCase();
    if (up === 'APTO' || up === 'APROBADO' || up === 'VIGENTE') {
      return '<span style="display:inline-flex;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">' + sanitizeHTML(up) + '</span>';
    }
    if (up === 'RECHAZADO' || up === 'VENCIDO') {
      return '<span style="display:inline-flex;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;">' + sanitizeHTML(up) + '</span>';
    }
    if (up === 'OBSERVADO') {
      return '<span style="display:inline-flex;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:800;background:#fffbeb;color:#92400e;border:1px solid #fde68a;">OBSERVADO</span>';
    }
    return '<span style="display:inline-flex;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">' + sanitizeHTML(up) + '</span>';
  }

  async function buscarPadronFichasAsociados() {
    const listEl = document.getElementById('padronFichasListaContainer');
    const q = String((document.getElementById('inputBuscarFichaPadron') || {}).value || '').trim();
    const est = String((document.getElementById('selectFiltroEstadoFichaPadron') || {}).value || 'TODOS').trim();
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding:1rem;text-align:center;color:#64748b;font-size:0.78rem;">⏳ Cargando padrón de asociados desde Supabase...</div>';
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (est && est !== 'TODOS') params.set('estado_perfil', est);
      params.set('limit', '60');
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/asociados/buscar?${params.toString()}`, { method: 'GET' }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.ok === false) {
        throw new Error(data.detail || ('HTTP ' + resp.status));
      }

      const rows = Array.isArray(data.asociados) ? data.asociados : [];
      if (rows.length === 0) {
        const cleanDig = q.replace(/\D/g, '');
        listEl.innerHTML = '<div style="padding:1rem;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:0.78rem;color:#64748b;">No se encontraron asociados con ese criterio.' +
          (cleanDig.length >= 7 ? (' <button type="button" onclick="cargarFichaDetalleAsociado(\'' + sanitizeHTML(cleanDig) + '\')" style="margin-top:6px;display:block;color:#135596;font-weight:700;background:transparent;border:none;cursor:pointer;padding:0;text-decoration:underline;">Consultar historial por DNI ' + sanitizeHTML(cleanDig) + ' →</button>') : '') +
          '</div>';
        return;
      }

      listEl.innerHTML = rows.map(a => {
        const activo = global._fichaPadronDniActivo === String(a.dni || '');
        const bord = activo ? 'border:2px solid #0f2744;background:#eff6ff;' : 'border:1px solid #e2e8f0;background:#ffffff;';
        const disp = a.ultimo_disponible !== null && a.ultimo_disponible !== undefined
          ? ('$' + Number(a.ultimo_disponible).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
          : '—';
        return '<button type="button" onclick="cargarFichaDetalleAsociado(\'' + sanitizeHTML(String(a.dni || '')) + '\')" style="width:100%;text-align:left;padding:0.7rem 0.8rem;border-radius:11px;' + bord + 'cursor:pointer;margin-bottom:0.45rem;transition:all .12s;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem;">' +
            '<div style="font-weight:800;font-size:0.8rem;color:#0f172a;">' + sanitizeHTML(a.apellido_nombres || ('DNI ' + (a.dni || '—'))) + '</div>' +
            _badgeEstadoFichaHtml(a.perfil_validacion_estado || 'PENDIENTE') +
          '</div>' +
          '<div style="font-size:0.72rem;color:#475569;margin-top:2px;font-family:monospace;">DNI ' + sanitizeHTML(a.dni || '—') + ' · ' + sanitizeHTML(a.organismo || 'SIN_ESPECIFICAR') + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:5px;font-size:10px;color:#64748b;">' +
            '<span>DNI: <strong>' + sanitizeHTML(a.dni_estado || 'N/V') + '</strong></span>' +
            '<span>· Dom: <strong>' + sanitizeHTML(a.servicio_estado || 'N/V') + '</strong></span>' +
            '<span>· Bol: <strong>' + sanitizeHTML(a.boletin_estado || 'N/V') + '</strong></span>' +
            '<span>· Disp.: <strong>' + sanitizeHTML(disp) + '</strong></span>' +
          '</div>' +
        '</button>';
      }).join('');
    } catch (err) {
      listEl.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.76rem;">⚠️ Error cargando padrón: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    }
  }

  async function cargarFichaDetalleAsociado(dni) {
    const dniClean = String(dni || '').replace(/\D/g, '').trim();
    const detEl = document.getElementById('fichaAsociadoDetalleContainer');
    if (!detEl || dniClean.length < 7) return;
    global._fichaPadronDniActivo = dniClean;

    detEl.innerHTML = '<div style="padding:1.25rem;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:0.8rem;font-weight:600;">⏳ Cargando ficha histórica e inmutable del DNI ' + sanitizeHTML(dniClean) + '...</div>';

    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/asociados/${encodeURIComponent(dniClean)}/ficha`, { method: 'GET' }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      if (!data.encontrado) {
        detEl.innerHTML =
          '<div style="padding:1.5rem;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;">' +
            '<div style="font-weight:800;color:#0f172a;font-size:0.9rem;">Sin registros previos para el DNI ' + sanitizeHTML(dniClean) + '</div>' +
            '<p style="font-size:0.78rem;color:#64748b;margin:6px 0 12px 0;">Podés iniciar la auditoría documental en Auditoría IA 2.0 y guardarla aquí para abrir su línea de tiempo inmutable.</p>' +
            '<button type="button" onclick="irAAuditoria20DesdeFicha(\'' + sanitizeHTML(dniClean) + '\', \'\')" style="padding:0.5rem 1rem;border-radius:10px;border:1px solid #0f2744;background:#0f2744;color:#ffffff;font-size:0.78rem;font-weight:700;cursor:pointer;">🔎 Auditar en IA 2.0</button>' +
          '</div>';
        return;
      }

      const asoc = data.asociado || {};
      const vig = data.vigentes_por_tipo || {};
      const hist = Array.isArray(data.historial_validaciones) ? data.historial_validaciones : [];
      const sols = Array.isArray(data.solicitudes) ? data.solicitudes : [];

      const pilaresOrden = ['DNI', 'SERVICIO', 'RECIBO', 'CAJAJPER', 'BOLETIN_ER', 'INFORME_CONSOLIDADO'];
      const pilaresHtml = pilaresOrden.map(tipo => {
        const ev = vig[tipo];
        return '<div style="padding:0.7rem 0.8rem;border-radius:11px;border:1px solid #e2e8f0;background:#f8fafc;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;">' +
            '<span style="font-size:11px;font-weight:800;color:#334155;">' + sanitizeHTML(tipo) + '</span>' +
            _badgeEstadoFichaHtml(ev ? ev.estado_resultado : 'NO_EVALUADO') +
          '</div>' +
          '<div style="font-size:0.72rem;color:#475569;margin-top:4px;">' + sanitizeHTML(ev ? (ev.resumen || 'Registrado') : 'Sin validación vigente') + '</div>' +
        '</div>';
      }).join('');

      const timelineHtml = hist.length > 0
        ? hist.map(ev => {
            const alertas = Array.isArray(ev.alertas_json) ? ev.alertas_json : [];
            const fechaTxt = ev.created_at ? new Date(ev.created_at).toLocaleString('es-AR') : '—';
            const badgeVig = ev.es_vigente
              ? '<span style="padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:800;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;">VIGENTE</span>'
              : '<span style="padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:700;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">HISTÓRICO</span>';
            const jsonTxt = JSON.stringify(ev.datos_extraidos_json || {}, null, 2);
            return '<div style="padding:0.75rem 0.9rem;border-radius:11px;border:1px solid #e2e8f0;background:#ffffff;margin-bottom:0.55rem;">' +
              '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.4rem;">' +
                '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">' +
                  '<span style="font-weight:800;font-size:0.78rem;color:#0f172a;">' + sanitizeHTML(ev.tipo_validacion || 'EVENTO') + '</span>' +
                  _badgeEstadoFichaHtml(ev.estado_resultado) +
                  badgeVig +
                '</div>' +
                '<span style="font-size:11px;color:#64748b;font-family:monospace;">' + sanitizeHTML(fechaTxt) + (ev.analista_nombre ? (' · ' + sanitizeHTML(ev.analista_nombre)) : '') + '</span>' +
              '</div>' +
              (ev.resumen ? ('<div style="font-size:0.76rem;color:#334155;margin-top:4px;">' + sanitizeHTML(ev.resumen) + '</div>') : '') +
              (alertas.length > 0 ? ('<ul style="margin:4px 0 0 1.1rem;padding:0;font-size:0.72rem;color:#9f1239;">' + alertas.map(a => '<li>' + sanitizeHTML(a) + '</li>').join('') + '</ul>') : '') +
              '<details style="margin-top:5px;"><summary style="font-size:11px;color:#135596;font-weight:600;cursor:pointer;">Ver evidencia JSON</summary><pre style="margin-top:4px;padding:0.5rem;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:10px;max-height:180px;overflow:auto;">' + sanitizeHTML(jsonTxt) + '</pre></details>' +
            '</div>';
          }).join('')
        : '<div style="padding:0.85rem;border-radius:10px;background:#f8fafc;color:#64748b;font-size:0.76rem;">No hay eventos en el historial inmutable aún.</div>';

      const solsHtml = sols.length > 0
        ? sols.map(s =>
            '<tr style="border-bottom:1px solid #f1f5f9;">' +
              '<td style="padding:0.45rem 0.6rem;font-family:monospace;font-weight:700;">' + sanitizeHTML(s.id_provisorio || String(s.id || '').slice(0, 8)) + '</td>' +
              '<td style="padding:0.45rem 0.6rem;">' + sanitizeHTML(s.linea_ayuda || '—') + '</td>' +
              '<td style="padding:0.45rem 0.6rem;font-family:monospace;">$' + Number(s.monto_solicitado || 0).toLocaleString('es-AR') + ' (' + sanitizeHTML(String(s.cuotas_pactadas || 0)) + 'c)</td>' +
              '<td style="padding:0.45rem 0.6rem;">' + sanitizeHTML(s.estado || 'INGRESADO') + '</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="4" style="padding:0.65rem;color:#64748b;text-align:center;">Sin solicitudes registradas en Supabase para este asociado.</td></tr>';

      const safeDriveUrl = _safeUrl(asoc.drive_folder_url);
      detEl.innerHTML =
        '<div style="padding:1rem 1.15rem;border-radius:14px;border:1px solid #cbd5e1;background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);margin-bottom:0.9rem;">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:0.65rem;">' +
            '<div>' +
              '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
                '<h4 style="margin:0;font-size:1.05rem;font-weight:800;color:#0f172a;">' + sanitizeHTML(asoc.apellido_nombres || ('Asociado DNI ' + dniClean)) + '</h4>' +
                _badgeEstadoFichaHtml(asoc.perfil_validacion_estado || 'PENDIENTE') +
              '</div>' +
              '<div style="font-size:0.77rem;color:#475569;margin-top:4px;">DNI: <strong class="font-mono">' + sanitizeHTML(dniClean) + '</strong>' + (asoc.cuil ? (' · CUIL: <strong class="font-mono">' + sanitizeHTML(asoc.cuil) + '</strong>') : '') + ' · Organismo: <strong>' + sanitizeHTML(asoc.organismo || 'SIN_ESPECIFICAR') + '</strong></div>' +
              '<div style="font-size:0.75rem;color:#475569;margin-top:2px;">Domicilio: ' + sanitizeHTML(asoc.domicilio || asoc.servicio_domicilio || 'No registrado') + (asoc.localidad ? (' (' + sanitizeHTML(asoc.localidad) + ')') : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' +
              '<button type="button" onclick="irAAuditoria20DesdeFicha(\'' + sanitizeHTML(dniClean) + '\', \'' + sanitizeHTML(String(asoc.apellido_nombres || '').replace(/'/g, '')) + '\')" style="padding:0.48rem 0.9rem;border-radius:9px;border:1px solid #0f2744;background:#0f2744;color:#ffffff;font-size:0.75rem;font-weight:700;cursor:pointer;">🔎 Auditar en IA 2.0</button>' +
              (safeDriveUrl ? ('<a href="' + safeDriveUrl + '" target="_blank" rel="noopener noreferrer" style="padding:0.48rem 0.85rem;border-radius:9px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;font-size:0.75rem;font-weight:600;text-decoration:none;">📁 Carpeta Drive ↗</a>') : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<h5 style="margin:0 0 0.5rem 0;font-size:0.82rem;font-weight:800;color:#0f172a;">📌 Último Estado Vigente por Pilar</h5>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:0.55rem;margin-bottom:1rem;">' + pilaresHtml + '</div>' +
        '<h5 style="margin:0 0 0.5rem 0;font-size:0.82rem;font-weight:800;color:#0f172a;">🕒 Línea de Tiempo Inmutable (' + hist.length + ' evento(s))</h5>' +
        '<div style="max-height:360px;overflow-y:auto;padding-right:4px;margin-bottom:1rem;">' + timelineHtml + '</div>' +
        '<h5 style="margin:0 0 0.5rem 0;font-size:0.82rem;font-weight:800;color:#0f172a;">📄 Solicitudes en Supabase (' + sols.length + ')</h5>' +
        '<div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.75rem;text-align:left;">' +
            '<thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;"><tr><th style="padding:0.45rem 0.6rem;">ID Provisorio</th><th style="padding:0.45rem 0.6rem;">Línea</th><th style="padding:0.45rem 0.6rem;">Monto / Cuotas</th><th style="padding:0.45rem 0.6rem;">Estado</th></tr></thead>' +
            '<tbody>' + solsHtml + '</tbody>' +
          '</table>' +
        '</div>';
    } catch (err) {
      detEl.innerHTML = '<div style="padding:0.9rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error consultando ficha: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    }
  }

  global.guardarValidacionesEnFichaAsociado = guardarValidacionesEnFichaAsociado;
  global.abrirFichaHistoricaAsociado = abrirFichaHistoricaAsociado;
  global.irAAuditoria20DesdeFicha = irAAuditoria20DesdeFicha;
  global.buscarPadronFichasAsociados = buscarPadronFichasAsociados;
  global.cargarFichaDetalleAsociado = cargarFichaDetalleAsociado;
})(window);
