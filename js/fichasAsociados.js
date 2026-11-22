// ============================================================================
// MÓDULO FRONTEND: PADRÓN Y FICHAS HISTÓRICAS DE ASOCIADOS
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  global._fichaPadronDniActivo = '';

  const PILARES_CONFIG = [
    { key: 'DNI', label: 'Documento (DNI)', icon: '🪪' },
    { key: 'SERVICIO', label: 'Domicilio / Policial', icon: '🏠' },
    { key: 'RECIBO', label: 'Recibo de Haberes', icon: '🧾' },
    { key: 'CAJAJPER', label: 'CajaJper', icon: '🏛️' },
    { key: 'BOLETIN_ER', label: 'Boletín Oficial ER', icon: '📰' },
    { key: 'INFORME_CONSOLIDADO', label: 'Dictamen Integral', icon: '🛡️' }
  ];

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

  function _limpiarTextoFicha(val, fallback) {
    const s = String(val || '').trim();
    if (!s || s === 'SIN_ESPECIFICAR' || s === 'No consta en recibo') return fallback;
    return s;
  }

  function _etiquetaEstadoHumano(estadoRaw) {
    const up = String(estadoRaw || 'NO_EVALUADO').trim().toUpperCase();
    const map = {
      APTO: 'Apto',
      APROBADO: 'Aprobado',
      VIGENTE: 'Vigente',
      RECHAZADO: 'Rechazado',
      VENCIDO: 'Vencido',
      OBSERVADO: 'Observado',
      PENDIENTE: 'Pendiente',
      NO_EVALUADO: 'Sin evaluar',
      NO_VERIFICADO: 'Sin evaluar'
    };
    return map[up] || sCapitalize(up);
  }

  function sCapitalize(txt) {
    const t = String(txt || '').replace(/_/g, ' ').toLowerCase();
    return t ? (t.charAt(0).toUpperCase() + t.slice(1)) : '';
  }

  function _nombrePilar(tipoRaw) {
    const up = String(tipoRaw || '').toUpperCase();
    const found = PILARES_CONFIG.find(p => p.key === up);
    return found ? (found.icon + ' ' + found.label) : sCapitalize(up);
  }

  function _badgeEstadoFichaHtml(estadoRaw, compacto = false) {
    const up = String(estadoRaw || 'NO_VERIFICADO').trim().toUpperCase();
    const label = _etiquetaEstadoHumano(up);
    const pad = compacto ? '1px 7px' : '2px 9px';
    const fs = compacto ? '10px' : '11px';

    if (up === 'APTO' || up === 'APROBADO' || up === 'VIGENTE') {
      return '<span style="display:inline-flex;align-items:center;padding:' + pad + ';border-radius:9999px;font-size:' + fs + ';font-weight:700;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;white-space:nowrap;">' + sanitizeHTML(label) + '</span>';
    }
    if (up === 'RECHAZADO' || up === 'VENCIDO') {
      return '<span style="display:inline-flex;align-items:center;padding:' + pad + ';border-radius:9999px;font-size:' + fs + ';font-weight:700;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;white-space:nowrap;">' + sanitizeHTML(label) + '</span>';
    }
    if (up === 'OBSERVADO') {
      return '<span style="display:inline-flex;align-items:center;padding:' + pad + ';border-radius:9999px;font-size:' + fs + ';font-weight:700;background:#fffbeb;color:#92400e;border:1px solid #fde68a;white-space:nowrap;">' + sanitizeHTML(label) + '</span>';
    }
    if (up === 'PENDIENTE') {
      return '<span style="display:inline-flex;align-items:center;padding:' + pad + ';border-radius:9999px;font-size:' + fs + ';font-weight:700;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;white-space:nowrap;">' + sanitizeHTML(label) + '</span>';
    }
    return '<span style="display:inline-flex;align-items:center;padding:' + pad + ';border-radius:9999px;font-size:' + fs + ';font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;white-space:nowrap;">' + sanitizeHTML(label) + '</span>';
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

  function _usuarioPuedeVerPadronFichas() {
    if (typeof global.tieneAccesoPadronFichas === 'function') {
      return global.tieneAccesoPadronFichas();
    }
    const sess = typeof global.getSession === 'function' ? global.getSession() : null;
    const rol = String((sess && (sess.rol || sess.role)) || '').trim().toLowerCase();
    return rol === 'analista' || rol === 'admin' || rol === 'administrador';
  }

  function _esAdminActual() {
    if (typeof global.esAdminAuditoria === 'function') return global.esAdminAuditoria();
    const sess = typeof global.getSession === 'function' ? global.getSession() : null;
    const rol = String((sess && (sess.rol || sess.role)) || '').trim().toLowerCase();
    return rol === 'admin' || rol === 'administrador';
  }

  function abrirFichaHistoricaAsociado(dniOpcional = '') {
    if (!_usuarioPuedeVerPadronFichas()) {
      if (typeof showToast === 'function') showToast('⛔ Acceso restringido: Padrón y Fichas es exclusivo para Analista o Admin.');
      return;
    }
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

  async function eliminarAsociadoPadron(dni, nombre) {
    if (!_usuarioPuedeVerPadronFichas()) return;
    const dniClean = String(dni || '').replace(/\D/g, '').trim();
    if (!dniClean) return;
    const nomTxt = nombre ? (' (' + nombre + ')') : '';
    if (!confirm('¿Eliminar la ficha del asociado DNI ' + dniClean + nomTxt + ' y su historial del padrón? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/asociados/${encodeURIComponent(dniClean)}`, {
        method: 'DELETE'
      }, 20000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.ok === false) {
        throw new Error(data.detail || ('HTTP ' + resp.status));
      }
      if (global._fichaPadronDniActivo === dniClean) {
        global._fichaPadronDniActivo = '';
        const detEl = document.getElementById('fichaAsociadoDetalleContainer');
        if (detEl) {
          detEl.innerHTML = '<div style="padding:2.5rem 1.25rem;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:0.84rem;">Seleccioná un asociado del listado para visualizar su ficha histórica y solicitudes.</div>';
        }
      }
      showToast('🗑️ Ficha del asociado DNI ' + dniClean + ' eliminada.');
      buscarPadronFichasAsociados();
    } catch (err) {
      showToast('⚠️ No se pudo eliminar la ficha: ' + (err.message || String(err)));
    }
  }

  async function buscarPadronFichasAsociados() {
    if (!_usuarioPuedeVerPadronFichas()) return;
    const btnLimpiarPadron = document.getElementById('btnLimpiarPadronPruebasAdmin');
    if (btnLimpiarPadron) {
      btnLimpiarPadron.style.display = _esAdminActual() ? 'inline-flex' : 'none';
    }

    const listEl = document.getElementById('padronFichasListaContainer');
    const countEl = document.getElementById('padronResultadosCountBadge');
    const q = String((document.getElementById('inputBuscarFichaPadron') || {}).value || '').trim();
    const est = String((document.getElementById('selectFiltroEstadoFichaPadron') || {}).value || 'TODOS').trim();
    if (!listEl) return;

    listEl.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.8rem;">⏳ Cargando padrón de asociados...</div>';
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
      if (countEl) {
        countEl.textContent = rows.length + ' asociado' + (rows.length === 1 ? '' : 's');
      }

      if (rows.length === 0) {
        const cleanDig = q.replace(/\D/g, '');
        listEl.innerHTML =
          '<div style="padding:1.75rem 1rem;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;">' +
            '<div style="font-size:1.4rem;margin-bottom:0.35rem;">🗂️</div>' +
            '<div style="font-weight:700;color:#334155;font-size:0.84rem;">No hay asociados registrados' + (q ? ' para esa búsqueda' : '') + '</div>' +
            '<div style="font-size:0.75rem;color:#64748b;margin-top:4px;">Cuando registres o audites documentación de un asociado aparecerá listado aquí.</div>' +
            (cleanDig.length >= 7
              ? ('<button type="button" onclick="cargarFichaDetalleAsociado(\'' + sanitizeHTML(cleanDig) + '\')" style="margin-top:0.75rem;padding:0.42rem 0.85rem;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#135596;font-size:0.76rem;font-weight:700;cursor:pointer;">Consultar DNI ' + sanitizeHTML(cleanDig) + ' →</button>')
              : '') +
          '</div>';
        return;
      }

      listEl.innerHTML = rows.map(a => {
        const dniVal = String(a.dni || '');
        const activo = global._fichaPadronDniActivo === dniVal;
        const bord = activo
          ? 'border:2px solid #135596;background:#eff6ff;box-shadow:0 3px 10px rgba(19,85,150,0.10);'
          : 'border:1px solid #e2e8f0;background:#ffffff;';
        const disp = a.ultimo_disponible !== null && a.ultimo_disponible !== undefined
          ? ('$' + Number(a.ultimo_disponible).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
          : '—';
        const orgLabel = _limpiarTextoFicha(a.organismo, 'Organismo sin especificar');

        return '<button type="button" onclick="cargarFichaDetalleAsociado(\'' + sanitizeHTML(dniVal) + '\')" class="padron-card-item" style="width:100%;text-align:left;padding:0.85rem 0.95rem;border-radius:12px;' + bord + 'cursor:pointer;margin-bottom:0.55rem;transition:all .15s ease;display:block;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
            '<div style="font-weight:800;font-size:0.86rem;color:#0f172a;line-height:1.25;">' + sanitizeHTML(a.apellido_nombres || ('Asociado DNI ' + (dniVal || '—'))) + '</div>' +
            _badgeEstadoFichaHtml(a.perfil_validacion_estado || 'PENDIENTE', true) +
          '</div>' +
          '<div style="font-size:0.75rem;color:#475569;margin-top:4px;display:flex;align-items:center;justify-content:space-between;gap:0.4rem;">' +
            '<span>DNI <strong style="color:#0f172a;">' + sanitizeHTML(dniVal || '—') + '</strong> · ' + sanitizeHTML(orgLabel) + '</span>' +
            (disp !== '—' ? ('<span style="font-weight:700;color:#047857;">Disp. ' + sanitizeHTML(disp) + '</span>') : '') +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:6px;">' +
            '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;">DNI: <strong>' + sanitizeHTML(_etiquetaEstadoHumano(a.dni_estado)) + '</strong></span>' +
            '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;">Dom.: <strong>' + sanitizeHTML(_etiquetaEstadoHumano(a.servicio_estado)) + '</strong></span>' +
            '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;color:#475569;">Bol.: <strong>' + sanitizeHTML(_etiquetaEstadoHumano(a.boletin_estado)) + '</strong></span>' +
          '</div>' +
        '</button>';
      }).join('');
    } catch (err) {
      listEl.innerHTML = '<div style="padding:0.9rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error cargando padrón: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    }
  }

  async function cargarFichaDetalleAsociado(dni) {
    if (!_usuarioPuedeVerPadronFichas()) return;
    const dniClean = String(dni || '').replace(/\D/g, '').trim();
    const detEl = document.getElementById('fichaAsociadoDetalleContainer');
    if (!detEl || dniClean.length < 7) return;
    global._fichaPadronDniActivo = dniClean;

    detEl.innerHTML = '<div style="padding:1.5rem;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:0.82rem;font-weight:600;">⏳ Cargando ficha del asociado DNI ' + sanitizeHTML(dniClean) + '...</div>';

    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/asociados/${encodeURIComponent(dniClean)}/ficha`, { method: 'GET' }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      if (!data.encontrado) {
        detEl.innerHTML =
          '<div style="padding:2rem 1.25rem;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;">' +
            '<div style="font-weight:800;color:#0f172a;font-size:0.95rem;">Sin registros previos para el DNI ' + sanitizeHTML(dniClean) + '</div>' +
            '<p style="font-size:0.8rem;color:#64748b;margin:6px 0 14px 0;">Podés iniciar la auditoría documental en Auditoría IA y guardarla aquí para registrar su historial.</p>' +
            '<button type="button" onclick="irAAuditoria20DesdeFicha(\'' + sanitizeHTML(dniClean) + '\', \'\')" class="audit20-btn audit20-btn--navy">🔎 Auditar en IA</button>' +
          '</div>';
        return;
      }

      const asoc = data.asociado || {};
      const vig = data.vigentes_por_tipo || {};
      const hist = Array.isArray(data.historial_validaciones) ? data.historial_validaciones : [];
      const sols = Array.isArray(data.solicitudes) ? data.solicitudes : [];

      const pilaresHtml = PILARES_CONFIG.map(p => {
        const ev = vig[p.key];
        return '<div style="padding:0.8rem 0.9rem;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;box-shadow:0 1px 2px rgba(15,23,42,0.03);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">' +
            '<span style="font-size:0.76rem;font-weight:700;color:#1e293b;">' + p.icon + ' ' + sanitizeHTML(p.label) + '</span>' +
            _badgeEstadoFichaHtml(ev ? ev.estado_resultado : 'NO_EVALUADO', true) +
          '</div>' +
          '<div style="font-size:0.74rem;color:#64748b;margin-top:6px;line-height:1.35;">' + sanitizeHTML(ev ? (ev.resumen || 'Validación registrada') : 'Sin evaluación vigente') + '</div>' +
        '</div>';
      }).join('');

      const mostrarJsonTecnico = _esAdminActual();
      const timelineHtml = hist.length > 0
        ? hist.map(ev => {
            const alertas = Array.isArray(ev.alertas_json) ? ev.alertas_json : [];
            const fechaTxt = ev.created_at ? new Date(ev.created_at).toLocaleString('es-AR') : '—';
            const badgeVig = ev.es_vigente
              ? '<span style="padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:700;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;">Vigente</span>'
              : '<span style="padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">Histórico</span>';
            const jsonBlock = mostrarJsonTecnico
              ? ('<details style="margin-top:6px;"><summary style="font-size:11px;color:#135596;font-weight:600;cursor:pointer;">Ver detalle técnico</summary><pre style="margin-top:4px;padding:0.5rem;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:10px;max-height:180px;overflow:auto;">' + sanitizeHTML(JSON.stringify(ev.datos_extraidos_json || {}, null, 2)) + '</pre></details>')
              : '';
            return '<div style="padding:0.85rem 1rem;border-radius:12px;border:1px solid #e2e8f0;background:#ffffff;margin-bottom:0.55rem;">' +
              '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.4rem;">' +
                '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">' +
                  '<span style="font-weight:800;font-size:0.8rem;color:#0f172a;">' + sanitizeHTML(_nombrePilar(ev.tipo_validacion)) + '</span>' +
                  _badgeEstadoFichaHtml(ev.estado_resultado, true) +
                  badgeVig +
                '</div>' +
                '<span style="font-size:11px;color:#64748b;">' + sanitizeHTML(fechaTxt) + (ev.analista_nombre ? (' · ' + sanitizeHTML(ev.analista_nombre)) : '') + '</span>' +
              '</div>' +
              (ev.resumen ? ('<div style="font-size:0.78rem;color:#334155;margin-top:5px;">' + sanitizeHTML(ev.resumen) + '</div>') : '') +
              (alertas.length > 0 ? ('<ul style="margin:5px 0 0 1.1rem;padding:0;font-size:0.74rem;color:#9f1239;">' + alertas.map(a => '<li>' + sanitizeHTML(a) + '</li>').join('') + '</ul>') : '') +
              jsonBlock +
            '</div>';
          }).join('')
        : '<div style="padding:1rem;border-radius:10px;background:#f8fafc;border:1px dashed #e2e8f0;color:#64748b;font-size:0.78rem;text-align:center;">Aún no hay validaciones registradas en el historial.</div>';

      const solsHtml = sols.length > 0
        ? sols.map(s =>
            '<tr style="border-bottom:1px solid #f1f5f9;">' +
              '<td style="padding:0.55rem 0.75rem;font-weight:700;color:#0f172a;">' + sanitizeHTML(s.id_definitivo || s.id_provisorio || String(s.id || '').slice(0, 8)) + '</td>' +
              '<td style="padding:0.55rem 0.75rem;color:#334155;">' + sanitizeHTML(sCapitalize(s.linea_ayuda || '—')) + '</td>' +
              '<td style="padding:0.55rem 0.75rem;font-weight:700;color:#0f172a;">$' + Number(s.monto_solicitado || 0).toLocaleString('es-AR') + ' <span style="font-weight:500;color:#64748b;">(' + sanitizeHTML(String(s.cuotas_pactadas || 0)) + ' cuotas)</span></td>' +
              '<td style="padding:0.55rem 0.75rem;">' + _badgeEstadoFichaHtml(s.estado || 'INGRESADO', true) + '</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="4" style="padding:1rem;color:#64748b;text-align:center;font-size:0.78rem;">No hay solicitudes registradas para este asociado.</td></tr>';

      const safeDriveUrl = _safeUrl(asoc.drive_folder_url);
      const cuilLimpio = _limpiarTextoFicha(asoc.cuil, '');
      const orgLimpia = _limpiarTextoFicha(asoc.organismo, 'Sin especificar');
      const domLimpio = _limpiarTextoFicha(asoc.domicilio || asoc.servicio_domicilio, 'No registrado');
      const nombreEsc = String(asoc.apellido_nombres || '').replace(/'/g, '');

      detEl.innerHTML =
        '<div style="padding:1.15rem 1.25rem;border-radius:14px;border:1px solid #bfdbfe;background:linear-gradient(135deg,#ffffff 0%,#eff6ff 100%);margin-bottom:1.1rem;box-shadow:0 2px 6px rgba(15,39,68,0.04);">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:0.85rem;">' +
            '<div style="flex:1 1 280px;">' +
              '<div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">' +
                '<h4 style="margin:0;font-size:1.1rem;font-weight:800;color:#0f172a;">' + sanitizeHTML(asoc.apellido_nombres || ('Asociado DNI ' + dniClean)) + '</h4>' +
                _badgeEstadoFichaHtml(asoc.perfil_validacion_estado || 'PENDIENTE') +
              '</div>' +
              '<div style="font-size:0.8rem;color:#334155;margin-top:6px;display:flex;flex-wrap:wrap;gap:0.75rem;">' +
                '<span>DNI: <strong>' + sanitizeHTML(dniClean) + '</strong></span>' +
                (cuilLimpio ? ('<span>CUIL: <strong>' + sanitizeHTML(cuilLimpio) + '</strong></span>') : '') +
                (asoc.dni_ejemplar ? ('<span>Ejemplar: <strong>' + sanitizeHTML(asoc.dni_ejemplar) + '</strong></span>') : '') +
                (asoc.dni_fecha_emision ? ('<span>F. Emisión: <strong>' + sanitizeHTML(asoc.dni_fecha_emision) + '</strong></span>') : '') +
                (asoc.dni_vigencia_hasta ? ('<span>Vencimiento: <strong>' + sanitizeHTML(asoc.dni_vigencia_hasta) + '</strong></span>') : '') +
                '<span>Organismo: <strong>' + sanitizeHTML(orgLimpia) + '</strong></span>' +
              '</div>' +
              '<div style="font-size:0.78rem;color:#475569;margin-top:4px;">Domicilio: ' + sanitizeHTML(domLimpio) + (asoc.localidad ? (' (' + sanitizeHTML(asoc.localidad) + ')') : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;">' +
              '<button type="button" onclick="irAAuditoria20DesdeFicha(\'' + sanitizeHTML(dniClean) + '\', \'' + sanitizeHTML(nombreEsc) + '\')" class="audit20-btn audit20-btn--navy">🔎 Auditar en IA</button>' +
              (safeDriveUrl ? ('<a href="' + safeDriveUrl + '" target="_blank" rel="noopener noreferrer" class="audit20-btn audit20-btn--secondary">📁 Carpeta Drive ↗</a>') : '') +
              '<button type="button" onclick="eliminarAsociadoPadron(\'' + sanitizeHTML(dniClean) + '\', \'' + sanitizeHTML(nombreEsc) + '\')" class="audit20-btn audit20-btn--secondary" style="color:#be123c;border-color:#fecdd3;background:#fff1f2;" title="Eliminar ficha del padrón">🗑️ Eliminar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<h5 style="margin:0 0 0.6rem 0;font-size:0.84rem;font-weight:800;color:#0f172a;">📌 Estado Documental por Pilar</h5>' +
        '<div class="padron-pilares-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.65rem;margin-bottom:1.15rem;">' + pilaresHtml + '</div>' +
        '<h5 style="margin:0 0 0.6rem 0;font-size:0.84rem;font-weight:800;color:#0f172a;">🕒 Historial de Validaciones (' + hist.length + ')</h5>' +
        '<div style="max-height:360px;overflow-y:auto;padding-right:4px;margin-bottom:1.15rem;">' + timelineHtml + '</div>' +
        '<h5 style="margin:0 0 0.6rem 0;font-size:0.84rem;font-weight:800;color:#0f172a;">📄 Solicitudes Registradas (' + sols.length + ')</h5>' +
        '<div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;text-align:left;">' +
            '<thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;text-transform:uppercase;"><tr><th style="padding:0.55rem 0.75rem;">Expediente</th><th style="padding:0.55rem 0.75rem;">Línea</th><th style="padding:0.55rem 0.75rem;">Monto / Cuotas</th><th style="padding:0.55rem 0.75rem;">Estado</th></tr></thead>' +
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
  global.eliminarAsociadoPadron = eliminarAsociadoPadron;
})(window);
