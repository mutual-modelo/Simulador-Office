// ============================================================================
// MÓDULO FRONTEND: AUDITORÍA IA 2.0 — CONTROLADOR MULTI-MÓDULO DUAL-CONTROL
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  global._auditoria20Estado = {
    tabActiva: 'recibo',
    dniSolicitante: '',
    nombreSolicitante: '',
    domicilioDni: '',
    recibo: null,
    dni: null,
    domicilio: null,
    cajajper: null,
    boletin: null,
    integral: null
  };

  function _estiloBadgeSemaforoAudit20(estado) {
    const up = String(estado || '').toUpperCase();
    if (up === 'APROBADO' || up === 'VERDE' || up === 'BAJO' || up === 'SIN_EXPEDIENTES') {
      return { bg: '#ecfdf5', fg: '#065f46', bd: '#a7f3d0', txt: 'OK' };
    }
    if (up === 'RECHAZADO' || up === 'ROJO' || up === 'ALTO') {
      return { bg: '#fff1f2', fg: '#9f1239', bd: '#fecdd3', txt: up === 'ROJO' ? 'ALERTA' : up };
    }
    if (up === 'NO_EVALUADO' || up === 'SIN_DATOS' || !up) {
      return { bg: '#f1f5f9', fg: '#64748b', bd: '#cbd5e1', txt: '—' };
    }
    return { bg: '#fffbeb', fg: '#92400e', bd: '#fde68a', txt: 'OBS' };
  }

  function actualizarBadgesTabsAuditoria20() {
    const st = global._auditoria20Estado || {};
    const mapBadges = [
      {
        id: 'tabBadgeAuditRecibo',
        estado: st.recibo
          ? (st.recibo.embargosJudiciales ? 'AMARILLO' : (Number(st.recibo.sueldoLiquido || 0) > 0 ? 'APROBADO' : 'RECHAZADO'))
          : null,
        label: st.recibo ? (st.recibo.embargosJudiciales ? 'EMB' : 'OK') : '—'
      },
      {
        id: 'tabBadgeAuditDni',
        estado: st.dni ? st.dni.dictamen_final : null,
        label: st.dni ? (st.dni.es_valido ? 'OK' : 'RECH') : '—'
      },
      {
        id: 'tabBadgeAuditDomicilio',
        estado: st.domicilio ? st.domicilio.dictamen_final : null,
        label: st.domicilio ? (st.domicilio.es_valido ? 'OK' : 'RECH') : '—'
      },
      {
        id: 'tabBadgeAuditCajaJper',
        estado: st.cajajper
          ? ((st.cajajper.resumen_riesgo && st.cajajper.resumen_riesgo.nivel_alerta) || 'BAJO')
          : null,
        label: st.cajajper
          ? (st.cajajper.cantidad_expedientes > 0 ? (st.cajajper.cantidad_expedientes + ' EXP') : '0 EXP')
          : '—'
      },
      {
        id: 'tabBadgeAuditBoletin',
        estado: st.boletin
          ? (Number(st.boletin.total_menciones || 0) === 0 ? 'APROBADO' : (st.boletin.tiene_alerta_critica ? 'RECHAZADO' : 'OBSERVADO'))
          : null,
        label: st.boletin ? (Number(st.boletin.total_menciones || 0) + ' MENC') : '—'
      },
      {
        id: 'tabBadgeAuditIntegral',
        estado: st.integral ? st.integral.dictamen_maestro : null,
        label: st.integral ? (st.integral.dictamen_maestro || '—').replace('APROBADO_CON_OBSERVACIONES', 'OBS') : '—'
      }
    ];

    mapBadges.forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;
      const est = _estiloBadgeSemaforoAudit20(item.estado);
      el.textContent = item.label;
      el.style.background = est.bg;
      el.style.color = est.fg;
      el.style.border = '1px solid ' + est.bd;
    });

    const hdrBadge = document.getElementById('badgeResumenHeaderAuditoria20');
    if (hdrBadge) {
      const dm = st.integral ? st.integral.dictamen_maestro : 'SIN DATOS';
      const estHdr = _estiloBadgeSemaforoAudit20(st.integral ? st.integral.dictamen_maestro : 'NO_EVALUADO');
      hdrBadge.textContent = String(dm || 'SIN DATOS').replace(/_/g, ' ');
      hdrBadge.style.background = estHdr.bg;
      hdrBadge.style.color = estHdr.fg;
      hdrBadge.style.borderColor = estHdr.bd;
    }
  }

  function cambiarTabAuditoria20(tabKey) {
    const paneles = {
      recibo: 'audit20PanelRecibo',
      dni: 'audit20PanelDni',
      domicilio: 'audit20PanelDomicilio',
      cajajper: 'audit20PanelCajaJper',
      boletin: 'audit20PanelBoletin',
      integral: 'audit20PanelIntegral'
    };
    const key = paneles[tabKey] ? tabKey : 'recibo';
    global._auditoria20Estado.tabActiva = key;

    Object.keys(paneles).forEach(k => {
      const panel = document.getElementById(paneles[k]);
      if (panel) panel.style.display = (k === key) ? 'block' : 'none';
    });

    document.querySelectorAll('#audit20TabsNav .audit20-tab-btn').forEach(btn => {
      const activo = btn.getAttribute('data-audit-tab') === key;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', activo ? 'true' : 'false');
    });

    if (key === 'boletin' && typeof cargarEstadoBoletinOficialAuditoria === 'function') {
      cargarEstadoBoletinOficialAuditoria();
    }
    if (key === 'integral') {
      ejecutarAuditoriaIntegralAudit20(true);
    }
  }

  function _propagarContextoAsociadoAudit20(ctx = {}) {
    const st = global._auditoria20Estado;
    const dniClean = String(ctx.dni || '').replace(/\D/g, '').trim();
    const nombreClean = String(ctx.nombre || '').trim();
    const dirClean = String(ctx.domicilio || '').trim();

    if (dniClean.length >= 7) {
      st.dniSolicitante = dniClean;
      ['inputDniEsperadoAudit20', 'inputDomDniAudit20', 'inputCajaJperDniAudit20', 'inputBoletinDniConsulta'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value.trim()) el.value = dniClean;
      });
      if (typeof actualizarLinkDateasBoletin === 'function') actualizarLinkDateasBoletin();
    }
    if (nombreClean) {
      st.nombreSolicitante = nombreClean;
      const elNom = document.getElementById('inputDomNombreAudit20');
      if (elNom && !elNom.value.trim()) elNom.value = nombreClean;
    }
    if (dirClean) {
      st.domicilioDni = dirClean;
      const elDir = document.getElementById('inputDomDirDniAudit20');
      if (elDir && !elDir.value.trim()) elDir.value = dirClean;
    }
    if (ctx.tipoRecibo) {
      const selTipo = document.getElementById('selectCajaJperTipoReciboAudit20');
      const trUp = String(ctx.tipoRecibo).toUpperCase().trim();
      if (selTipo && !selTipo.value && (trUp === 'ACTIVO' || trUp === 'PASIVO')) {
        selTipo.value = trUp;
      }
    }
  }

  function registrarReciboEnAuditoria20(audit) {
    if (!audit || typeof audit !== 'object') return;
    const r = audit.resultado || audit;
    const d = r.datosPersonales || {};
    const rec = r.detalleCompletoRecibo || {};
    const res = r.resumen || {};
    const dniExt = String(r.dni || rec.dni || d.dni || '').replace(/\D/g, '').trim();
    const titularExt = String(r.titular || rec.titular || d.nombre || '').trim();
    const tipoRec = String(r.tipoRecibo || rec.tipoRecibo || r.regimen || '').toUpperCase().trim();
    const liquido = Number(r.sueldoLiquido ?? rec.sueldoLiquido ?? res.sueldoLiquido ?? 0);
    const embargos = Boolean(r.embargosJudiciales ?? rec.embargosJudiciales);

    global._auditoria20Estado.recibo = {
      titular: titularExt,
      dni: dniExt,
      tipoRecibo: tipoRec || 'ACTIVO',
      sueldoLiquido: liquido,
      embargosJudiciales: embargos
    };

    _propagarContextoAsociadoAudit20({
      dni: dniExt,
      nombre: titularExt,
      tipoRecibo: tipoRec
    });
    actualizarBadgesTabsAuditoria20();
    ejecutarAuditoriaIntegralAudit20(true);
  }

  function registrarBoletinEnAuditoria20(data) {
    if (!data || typeof data !== 'object') return;
    const lista = Array.isArray(data.resultados) ? data.resultados : [];
    global._auditoria20Estado.boletin = {
      total_menciones: lista.length,
      tiene_alerta_critica: Boolean(data.tiene_alerta_critica),
      menciones: lista
    };
    actualizarBadgesTabsAuditoria20();
    ejecutarAuditoriaIntegralAudit20(true);
  }

  function limpiarEstadoAuditoria20() {
    global._auditoria20Estado = {
      tabActiva: global._auditoria20Estado ? global._auditoria20Estado.tabActiva : 'recibo',
      dniSolicitante: '',
      nombreSolicitante: '',
      domicilioDni: '',
      recibo: null,
      dni: null,
      domicilio: null,
      cajajper: null,
      boletin: null,
      integral: null
    };
    [
      'inputDniEsperadoAudit20', 'fileInputDniAudit20',
      'inputDomNombreAudit20', 'inputDomDniAudit20', 'inputDomDirDniAudit20', 'fileInputDomAudit20',
      'inputCajaJperDniAudit20', 'inputCajaJperNucAudit20', 'selectCajaJperTipoReciboAudit20'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['resultadoDniAudit20', 'resultadoDomicilioAudit20', 'resultadoCajaJperAudit20'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });
    const elInt = document.getElementById('resultadoIntegralAudit20');
    if (elInt) {
      elInt.innerHTML = '<div style="padding:1.2rem;border-radius:12px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:0.82rem;">Evaluá al menos un pilar (Recibo, DNI, Domicilio, CajaJper o Boletín Oficial ER) para visualizar los semáforos y el cruce automático de identidad.</div>';
    }
    actualizarBadgesTabsAuditoria20();
  }

  function _renderBloqueForenseAudit20(forense) {
    if (!forense) return '';
    const alertas = Array.isArray(forense.alertas) ? forense.alertas : [];
    const meta = forense.metadatos || {};
    const swTxt = meta.producer || meta.creator || (meta.exif && meta.exif.Software) || 'Sin software registrado';
    return '<div style="margin-top:0.75rem;padding:0.75rem 0.9rem;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;font-size:0.75rem;">' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.4rem;font-weight:700;">' +
        '<span>🔬 Forense de Archivos (' + sanitizeHTML(forense.tipo_archivo || 'DOC') + ') · <span style="font-weight:600;color:#475569;">Comentario informativo (a criterio del asesor)</span></span>' +
        '<span style="font-family:monospace;font-weight:500;font-size:11px;color:#64748b;">SHA-256: ' + sanitizeHTML(String(forense.sha256 || '').slice(0, 14)) + '… · Generador: ' + sanitizeHTML(swTxt) + '</span>' +
      '</div>' +
      (alertas.length > 0
        ? ('<ul style="margin:0.4rem 0 0 1.1rem;padding:0;color:#334155;">' + alertas.map(a => '<li>' + sanitizeHTML(a) + '</li>').join('') + '</ul>' +
           '<div style="margin-top:0.35rem;font-size:11px;color:#64748b;">ℹ️ Las observaciones sobre metadatos tienen carácter meramente informativo; queda a criterio del asesor tomarlas como alerta o no.</div>')
        : '<div style="margin-top:3px;color:#475569;">Sin observaciones técnicas relevantes en metadatos EXIF/PDF.</div>') +
    '</div>';
  }

  async function _leerArchivoPayloadAudit20(file) {
    const b64 = await archivoABase64Puro(file);
    const name = String(file.name || 'documento.pdf');
    const mime = file.type || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    return { fileBase64: b64, mimeType: mime, fileName: name };
  }

  async function inspeccionarSoloForenseAudit20(origen) {
    const inputId = origen === 'domicilio' ? 'fileInputDomAudit20' : 'fileInputDniAudit20';
    const outId = origen === 'domicilio' ? 'resultadoDomicilioAudit20' : 'resultadoDniAudit20';
    const inp = document.getElementById(inputId);
    const file = inp && inp.files && inp.files[0];
    if (!file) {
      showToast('Seleccioná primero un archivo PDF o imagen.');
      return;
    }
    const out = document.getElementById(outId);
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="padding:0.75rem;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:0.78rem;">🔬 Inspeccionando estructura y metadatos EXIF/PDF...</div>';
    }
    try {
      const payload = await _leerArchivoPayloadAudit20(file);
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/forense-archivo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));
      if (out) out.innerHTML = _renderBloqueForenseAudit20(data);
    } catch (err) {
      if (out) out.innerHTML = '<div style="padding:0.75rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error forense: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    }
  }

  async function ejecutarValidacionDniAudit20(fileOverride) {
    const inpFile = document.getElementById('fileInputDniAudit20');
    const file = fileOverride || (inpFile && inpFile.files && inpFile.files[0]);
    if (!file) {
      showToast('Seleccioná una imagen o PDF del DNI para validar.');
      return;
    }
    const out = document.getElementById('resultadoDniAudit20');
    const btn = document.getElementById('btnValidarDniAudit20');
    const dniEsp = String((document.getElementById('inputDniEsperadoAudit20') || {}).value || '').replace(/\D/g, '').trim();

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Analizando DNI + MRZ...'; }
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:0.78rem;font-weight:600;">⏳ Ejecutando extracción IA Vision + verificación ICAO 9303 MRZ + análisis forense...</div>';
    }

    try {
      const basePayload = await _leerArchivoPayloadAudit20(file);
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/validar-dni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          dniEsperado: dniEsp || null,
          consultarRenaper: true
        })
      }, 65000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      global._auditoria20Estado.dni = data;
      const ext = data.datos_extraidos || {};
      const det = data.validacion_determinista || {};
      const mrz = det.mrz || {};
      const ren = data.renaper || {};
      const evIa = data.evaluacion_ia || {};
      const motivos = Array.isArray(data.motivos) ? data.motivos : [];

      _propagarContextoAsociadoAudit20({
        dni: ext.dni || det.dni_extraido,
        nombre: [ext.apellido, ext.nombres].filter(Boolean).join(' '),
        domicilio: ext.domicilio_dni
      });
      actualizarBadgesTabsAuditoria20();
      ejecutarAuditoriaIntegralAudit20(true);

      const ok = Boolean(data.es_valido);
      const hdrStyle = ok
        ? 'background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;'
        : 'background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;';

      const checksMrzHtml = mrz.mrz_presente
        ? Object.entries(mrz.checks || {}).map(([k, v]) =>
            '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;' +
            (v ? 'background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;' : 'background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;') + '">' +
            (v ? '✔' : '✖') + ' ' + sanitizeHTML(k) + '</span>'
          ).join(' ')
        : '<span style="font-size:0.74rem;color:#64748b;">MRZ no detectado (si subiste solo el frente, agregá el dorso para validar checksums ICAO 9303).</span>';

      out.innerHTML =
        '<div style="padding:0.9rem 1rem;border-radius:12px;' + hdrStyle + '">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;">' +
            '<div style="font-size:0.9rem;font-weight:800;">' + (ok ? '✅' : '⛔') + ' Dictamen DNI: ' + sanitizeHTML(data.dictamen_final || 'REVISION_MANUAL') + '</div>' +
            (data.discrepancia_ia_vs_reglas ? '<span style="padding:2px 9px;border-radius:9999px;font-size:11px;font-weight:800;background:#7f1d1d;color:#ffffff;">⚠️ Discrepancia IA vs. Reglas Python</span>' : '') +
          '</div>' +
          '<ul style="margin:0.45rem 0 0 1.15rem;padding:0;font-size:0.76rem;">' + motivos.map(m => '<li>' + sanitizeHTML(m) + '</li>').join('') + '</ul>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.6rem;margin-top:0.75rem;font-size:0.76rem;">' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Titular</div><div style="font-weight:800;color:#0f172a;">' + sanitizeHTML(([ext.apellido, ext.nombres].filter(Boolean).join(', ')) || 'No leído') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">DNI / CUIL</div><div style="font-weight:800;font-family:monospace;color:#0f172a;">' + sanitizeHTML(det.dni_extraido || '—') + (ext.cuil ? (' · ' + sanitizeHTML(ext.cuil)) : '') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Vencimiento / Vigencia</div><div style="font-weight:800;color:#0f172a;">' + sanitizeHTML(det.fecha_vencimiento_iso || 'No visible') + (det.dni_vigente === true ? ' (Vigente)' : (det.dni_vigente === false ? ' (VENCIDO)' : '')) + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Domicilio DNI</div><div style="font-weight:700;color:#0f172a;">' + sanitizeHTML(ext.domicilio_dni || 'No visible (requiere dorso)') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">RENAPER</div><div style="font-weight:700;color:#334155;">' + sanitizeHTML(ren.estado || 'PENDIENTE_CREDENCIALES') + '</div></div>' +
        '</div>' +
        '<div style="margin-top:0.75rem;padding:0.7rem 0.85rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">' +
          '<div style="font-size:0.74rem;font-weight:800;color:#0f172a;margin-bottom:5px;">🔐 Verificación Criptográfica MRZ ICAO 9303:</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' + checksMrzHtml + '</div>' +
          (evIa.observacionesIA ? ('<div style="margin-top:6px;font-size:0.73rem;color:#475569;"><strong>🤖 Visión IA:</strong> ' + sanitizeHTML(evIa.observacionesIA) + '</div>') : '') +
        '</div>' +
        _renderBloqueForenseAudit20(data.forense);
    } catch (err) {
      if (out) out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error validando DNI: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>🪪 Auditar DNI</span>'; }
    }
  }

  async function ejecutarValidacionDomicilioAudit20(fileOverride) {
    const inpFile = document.getElementById('fileInputDomAudit20');
    const file = fileOverride || (inpFile && inpFile.files && inpFile.files[0]);
    if (!file) {
      showToast('Seleccioná una boleta de servicio o constancia policial de domicilio.');
      return;
    }
    const out = document.getElementById('resultadoDomicilioAudit20');
    const btn = document.getElementById('btnValidarDomAudit20');
    const nomSol = String((document.getElementById('inputDomNombreAudit20') || {}).value || '').trim();
    const dniSol = String((document.getElementById('inputDomDniAudit20') || {}).value || '').replace(/\D/g, '').trim();
    const dirDni = String((document.getElementById('inputDomDirDniAudit20') || {}).value || '').trim();

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Validando domicilio...'; }
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:0.78rem;font-weight:600;">⏳ Analizando fecha de emisión (&le; 60 días), titularidad/terceros, constancia policial y metadatos...</div>';
    }

    try {
      const basePayload = await _leerArchivoPayloadAudit20(file);
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/validar-domicilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          nombreSolicitante: nomSol || null,
          dniSolicitante: dniSol || null,
          domicilioDni: dirDni || null
        })
      }, 65000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      global._auditoria20Estado.domicilio = data;
      actualizarBadgesTabsAuditoria20();
      ejecutarAuditoriaIntegralAudit20(true);

      const ext = data.datos_extraidos || {};
      const det = data.validacion_determinista || {};
      const evIa = data.evaluacion_ia || {};
      const motivos = Array.isArray(data.motivos) ? data.motivos : [];
      const ok = Boolean(data.es_valido);
      const hdrStyle = ok
        ? 'background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;'
        : 'background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;';

      const diasTxt = det.dias_antiguedad !== null && det.dias_antiguedad !== undefined
        ? (det.dias_antiguedad + ' días (máx. ' + (det.max_dias_permitidos || 60) + ')')
        : 'Fecha no legible';
      const vigenteEmision = Boolean(det.vigente_60_dias ?? det.vigente_45_dias);

      const titularStatus = det.es_constancia_policial
        ? 'Constancia Policial (certifica al interesado)'
        : (det.es_titular_solicitante === true
          ? 'Titular directo coincide con solicitante'
          : (det.tercero_autorizado_por_domicilio === true
            ? 'Tercero autorizado (domicilio coincide con DNI)'
            : (det.es_titular_solicitante === false ? 'Tercero NO validado con DNI' : 'Sin titular para contrastar')));

      out.innerHTML =
        '<div style="padding:0.9rem 1rem;border-radius:12px;' + hdrStyle + '">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;">' +
            '<div style="font-size:0.9rem;font-weight:800;">' + (ok ? '✅' : '⛔') + ' Dictamen Domicilio: ' + sanitizeHTML(data.dictamen_final || 'RECHAZADO') + ' · [' + sanitizeHTML(data.documento_tipo || 'DOMICILIO') + ']</div>' +
            (data.discrepancia_ia_vs_reglas ? '<span style="padding:2px 9px;border-radius:9999px;font-size:11px;font-weight:800;background:#7f1d1d;color:#ffffff;">⚠️ Discrepancia IA vs. Reglas Python</span>' : '') +
          '</div>' +
          '<ul style="margin:0.45rem 0 0 1.15rem;padding:0;font-size:0.76rem;">' + motivos.map(m => '<li>' + sanitizeHTML(m) + '</li>').join('') + '</ul>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.6rem;margin-top:0.75rem;font-size:0.76rem;">' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Ente / Empresa</div><div style="font-weight:800;color:#0f172a;">' + sanitizeHTML(ext.empresa_o_dependencia || ext.tipo_comprobante || '—') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Titular en Comprobante</div><div style="font-weight:800;color:#0f172a;">' + sanitizeHTML(ext.titular || '—') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Emisión y Antigüedad</div><div style="font-weight:800;color:' + (vigenteEmision ? '#065f46' : '#9f1239') + ';">' + sanitizeHTML((det.fecha_emision_iso || 'N/D') + ' · ' + diasTxt) + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Domicilio Detectado</div><div style="font-weight:700;color:#0f172a;">' + sanitizeHTML([ext.domicilio_completo, ext.localidad].filter(Boolean).join(', ') || '—') + '</div></div>' +
          '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><div style="color:#64748b;font-size:11px;">Regla Titularidad / 3ros</div><div style="font-weight:700;color:#0f172a;">' + sanitizeHTML(titularStatus) + '</div></div>' +
        '</div>' +
        (evIa.observacionesIA ? ('<div style="margin-top:0.65rem;padding:0.6rem 0.8rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:0.73rem;color:#475569;"><strong>🤖 Visión IA:</strong> ' + sanitizeHTML(evIa.observacionesIA) + '</div>') : '') +
        _renderBloqueForenseAudit20(data.forense);
    } catch (err) {
      if (out) out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error validando domicilio: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>🏠 Validar Domicilio</span>'; }
    }
  }

  async function consultarCajaJperAudit20() {
    const dni = String((document.getElementById('inputCajaJperDniAudit20') || {}).value || '').replace(/\D/g, '').trim();
    const nuc = String((document.getElementById('inputCajaJperNucAudit20') || {}).value || '').replace(/\D/g, '').trim();
    const selTipo = document.getElementById('selectCajaJperTipoReciboAudit20');
    const tipoRecibo = (selTipo && selTipo.value)
      ? selTipo.value
      : ((global._auditoria20Estado.recibo && global._auditoria20Estado.recibo.tipoRecibo) || '');

    if (!dni && !nuc) {
      showToast('Ingresá al menos el DNI o el NUC para consultar CajaJper.');
      return;
    }

    const out = document.getElementById('resultadoCajaJperAudit20');
    const btn = document.getElementById('btnConsultarCajaJperAudit20');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Consultando CajaJper...'; }
    if (out) {
      out.style.display = 'block';
      out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:0.78rem;font-weight:600;">⏳ Conectando con Caja de Jubilaciones de Entre Ríos (cajajper.gov.ar)...</div>';
    }

    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/cajajper/consultar-expediente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: dni || null,
          nuc: nuc || null,
          tipoRecibo: tipoRecibo || null,
          incluirResumenIA: true
        })
      }, 35000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      global._auditoria20Estado.cajajper = data;
      if (dni) _propagarContextoAsociadoAudit20({ dni });
      actualizarBadgesTabsAuditoria20();
      ejecutarAuditoriaIntegralAudit20(true);

      const exps = Array.isArray(data.expedientes) ? data.expedientes : [];
      const riesgo = data.resumen_riesgo || {};
      const nivel = String(riesgo.nivel_alerta || 'BAJO').toUpperCase();
      const alertas = Array.isArray(riesgo.alertas) ? riesgo.alertas : [];

      if (exps.length === 0) {
        out.innerHTML =
          '<div style="padding:0.9rem 1rem;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:0.8rem;">' +
            '<strong>✅ Sin trámites previsionales en curso</strong> · ' + sanitizeHTML(data.mensaje || 'No se registran expedientes iniciados.') +
          '</div>';
        return;
      }

      const boxCls = nivel === 'ALTO'
        ? 'background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;'
        : (nivel === 'MEDIO'
          ? 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;'
          : 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;');

      const filasHtml = exps.map(e => {
        const badgeEstado = e.estado_firma === 'FIRMADO'
          ? '<span style="padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:800;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;">FIRMADO</span>'
          : (e.estado_firma === 'CON_ORDEN_FIRMA'
            ? '<span style="padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:800;background:#fffbeb;color:#92400e;border:1px solid #fde68a;">CON ORDEN FIRMA</span>'
            : '<span style="padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:800;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;">EN TRÁMITE</span>');
        return '<tr style="border-bottom:1px solid #f1f5f9;">' +
          '<td style="padding:0.55rem 0.65rem;font-family:monospace;font-weight:700;">' + sanitizeHTML(e.nuc || '—') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;font-family:monospace;">' + sanitizeHTML(e.ru || '—') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;font-weight:700;">' + sanitizeHTML(e.beneficio || '—') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;">' + sanitizeHTML(e.fecha_inicio || '—') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;">' + sanitizeHTML(e.area_actual || '—') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;">' + sanitizeHTML(e.ultimo_movimiento || '—') + (e.dias_desde_ultimo_movimiento !== null && e.dias_desde_ultimo_movimiento !== undefined ? (' <span style="color:#64748b;font-size:11px;">(' + sanitizeHTML(String(e.dias_desde_ultimo_movimiento)) + 'd)</span>') : '') + '</td>' +
          '<td style="padding:0.55rem 0.65rem;">' + badgeEstado + '</td>' +
        '</tr>';
      }).join('');

      const sol = data.solicitante || {};
      out.innerHTML =
        '<div style="padding:0.9rem 1rem;border-radius:12px;' + boxCls + '">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;">' +
            '<div style="font-size:0.86rem;font-weight:800;">🏛️ ' + sanitizeHTML(((sol.nombre || '') + ' ' + (sol.apellido || '')).trim() || 'Titular') + ' (DNI ' + sanitizeHTML(sol.documento || dni || '—') + ') · ' + exps.length + ' expediente(s) · Alerta ' + sanitizeHTML(nivel) + '</div>' +
          '</div>' +
          (alertas.length > 0 ? ('<ul style="margin:0.4rem 0 0 1.15rem;padding:0;font-size:0.75rem;">' + alertas.map(a => '<li>' + sanitizeHTML(a) + '</li>').join('') + '</ul>') : '') +
          (data.evaluacion_ia && data.evaluacion_ia.observacion_ia ? ('<div style="margin-top:0.5rem;padding:0.45rem 0.65rem;border-radius:8px;background:rgba(255,255,255,0.7);font-size:0.74rem;color:#1e293b;"><strong>🤖 Análisis IA:</strong> ' + sanitizeHTML(data.evaluacion_ia.observacion_ia) + '</div>') : '') +
        '</div>' +
        '<div style="overflow-x:auto;margin-top:0.75rem;border:1px solid #e2e8f0;border-radius:10px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.76rem;text-align:left;">' +
            '<thead style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;text-transform:uppercase;">' +
              '<tr><th style="padding:0.55rem 0.65rem;">NUC</th><th style="padding:0.55rem 0.65rem;">RU</th><th style="padding:0.55rem 0.65rem;">Beneficio / Trámite</th><th style="padding:0.55rem 0.65rem;">Inicio</th><th style="padding:0.55rem 0.65rem;">Área Actual</th><th style="padding:0.55rem 0.65rem;">Último Mov.</th><th style="padding:0.55rem 0.65rem;">Estado</th></tr>' +
            '</thead>' +
            '<tbody>' + filasHtml + '</tbody>' +
          '</table>' +
        '</div>';
    } catch (err) {
      if (out) out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error consultando CajaJper: ' + sanitizeHTML(err.message || String(err)) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>🔍 Buscar Trámite</span>'; }
    }
  }

  async function ejecutarAuditoriaIntegralAudit20(silencioso = false) {
    const st = global._auditoria20Estado || {};
    const out = document.getElementById('resultadoIntegralAudit20');
    const tieneAlgunPilar = Boolean(st.recibo || st.dni || st.domicilio || st.boletin || st.cajajper);
    if (!tieneAlgunPilar) {
      actualizarBadgesTabsAuditoria20();
      return null;
    }

    const btn = document.getElementById('btnRecalcularConsolidadoAudit20');
    if (btn && !silencioso) { btn.disabled = true; btn.textContent = '⏳ Consolidando...'; }

    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/auditoria-integral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dniSolicitante: st.dniSolicitante || null,
          nombreSolicitante: st.nombreSolicitante || null,
          dniResultado: st.dni || null,
          domicilioResultado: st.domicilio || null,
          reciboResultado: st.recibo || null,
          boletinResultado: st.boletin || null,
          cajajperResultado: st.cajajper || null
        })
      }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || ('HTTP ' + resp.status));

      st.integral = data;
      actualizarBadgesTabsAuditoria20();

      if (!out) return data;

      const dm = String(data.dictamen_maestro || 'SIN_DATOS');
      const esApto = Boolean(data.apto_continuar);
      const bannerStyle = dm === 'APROBADO'
        ? 'background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;'
        : (dm === 'APROBADO_CON_OBSERVACIONES'
          ? 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;'
          : 'background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;');

      const nombresPilares = {
        recibo: '🧾 Recibo de Haberes',
        dni: '🪪 DNI & MRZ',
        domicilio: '🏠 Domicilio / Policial',
        cajajper: '🏛️ CajaJper (Jubilaciones)',
        boletin_er: '📰 Boletín Oficial ER'
      };
      const tabsMapa = {
        recibo: 'recibo',
        dni: 'dni',
        domicilio: 'domicilio',
        cajajper: 'cajajper',
        boletin_er: 'boletin'
      };

      const semHtml = Object.entries(data.semaforos || {}).map(([k, v]) => {
        const est = _estiloBadgeSemaforoAudit20(v);
        return '<button type="button" onclick="cambiarTabAuditoria20(\'' + sanitizeHTML(tabsMapa[k] || 'recibo') + '\')" style="text-align:left;padding:0.75rem 0.85rem;border-radius:12px;border:1px solid ' + est.bd + ';background:' + est.bg + ';color:' + est.fg + ';cursor:pointer;">' +
          '<div style="font-size:11px;font-weight:700;opacity:0.85;">' + sanitizeHTML(nombresPilares[k] || k) + '</div>' +
          '<div style="font-size:0.86rem;font-weight:800;margin-top:3px;">' + sanitizeHTML(v) + '</div>' +
        '</button>';
      }).join('');

      const crit = Array.isArray(data.alertas_criticas) ? data.alertas_criticas : [];
      const prev = Array.isArray(data.alertas_preventivas) ? data.alertas_preventivas : [];
      const cruces = data.cruces_identidad || {};
      const crucesHtml = Object.keys(cruces).length > 0
        ? Object.entries(cruces).map(([k, val]) => {
            const txtVal = typeof val === 'object' ? (val.coincide ? 'COINCIDE' : 'NO COINCIDE') : String(val);
            return '<span style="padding:3px 9px;border-radius:9999px;font-size:11px;font-weight:700;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;">' + sanitizeHTML(k + ': ' + txtVal) + '</span>';
          }).join(' ')
        : '<span style="font-size:0.75rem;color:#64748b;">Completá DNI + Recibo/CajaJper para visualizar los cruces automáticos de identidad.</span>';

      out.innerHTML =
        '<div style="padding:1rem 1.15rem;border-radius:12px;' + bannerStyle + '">' +
          '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;">' +
            '<div style="font-size:1rem;font-weight:800;">' + (esApto ? '✅' : '⛔') + ' DICTAMEN MAESTRO: ' + sanitizeHTML(dm.replace(/_/g, ' ')) + '</div>' +
            '<div style="font-size:0.78rem;font-weight:700;">DNI Ref.: ' + sanitizeHTML(data.dni_referencia || 'No informado') + (data.nombre_referencia ? (' · ' + sanitizeHTML(data.nombre_referencia)) : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.65rem;margin-top:0.85rem;">' + semHtml + '</div>' +
        '<div style="margin-top:0.85rem;padding:0.75rem 0.9rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">' +
          '<div style="font-size:0.75rem;font-weight:800;color:#0f172a;margin-bottom:5px;">🔗 Cruces de Identidad entre Documentos</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">' + crucesHtml + '</div>' +
        '</div>' +
        (crit.length > 0
          ? ('<div style="margin-top:0.85rem;padding:0.8rem 0.95rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.77rem;"><strong>⛔ Alertas Críticas:</strong><ul style="margin:0.35rem 0 0 1.1rem;padding:0;">' + crit.map(c => '<li>' + sanitizeHTML(c) + '</li>').join('') + '</ul></div>')
          : '') +
        (prev.length > 0
          ? ('<div style="margin-top:0.85rem;padding:0.8rem 0.95rem;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:0.77rem;"><strong>⚠️ Observaciones Preventivas:</strong><ul style="margin:0.35rem 0 0 1.1rem;padding:0;">' + prev.map(p => '<li>' + sanitizeHTML(p) + '</li>').join('') + '</ul></div>')
          : '');

      return data;
    } catch (err) {
      if (!silencioso && out) {
        out.innerHTML = '<div style="padding:0.85rem;border-radius:10px;background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;font-size:0.78rem;">⚠️ Error consolidando auditoría: ' + sanitizeHTML(err.message || String(err)) + '</div>';
      }
      return null;
    } finally {
      if (btn && !silencioso) { btn.disabled = false; btn.innerHTML = '<span>↻ Actualizar Dictamen</span>'; }
    }
  }

  global._propagarContextoAsociadoAudit20 = _propagarContextoAsociadoAudit20;
  global.actualizarBadgesTabsAuditoria20 = actualizarBadgesTabsAuditoria20;
  global.cambiarTabAuditoria20 = cambiarTabAuditoria20;
  global.ejecutarValidacionDniAudit20 = ejecutarValidacionDniAudit20;
  global.ejecutarValidacionDomicilioAudit20 = ejecutarValidacionDomicilioAudit20;
  global.inspeccionarSoloForenseAudit20 = inspeccionarSoloForenseAudit20;
  global.consultarCajaJperAudit20 = consultarCajaJperAudit20;
  global.ejecutarAuditoriaIntegralAudit20 = ejecutarAuditoriaIntegralAudit20;
  global.registrarReciboEnAuditoria20 = registrarReciboEnAuditoria20;
  global.registrarBoletinEnAuditoria20 = registrarBoletinEnAuditoria20;
  global.limpiarEstadoAuditoria20 = limpiarEstadoAuditoria20;
})(window);
