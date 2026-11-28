/* ============================================================================
 * AMMER - Módulo Fase W1 ARM: Panel 360°, Smart Fields, Resumen ACW,
 *         Handoff/Pausa, Actividades y Feedback in-thread
 * ============================================================================ */
(function (global) {
  'use strict';

  const STAGE_META = {
    nuevo_lead: { label: 'Nuevo Lead', cls: '' },
    calificando: { label: 'Calificando', cls: 'info' },
    docs_pendientes: { label: 'Docs Pendientes', cls: 'warn' },
    simulacion: { label: 'Simulación', cls: 'info' },
    esperando_firma: { label: 'Esperando Firma', cls: 'warn' },
    derivado_asesor: { label: 'Derivado', cls: 'danger' },
    cerrado: { label: 'Cerrado', cls: 'ok' },
    descartado: { label: 'Descartado', cls: '' }
  };

  let _filterMode = '';
  let _stageFilter = '';
  let _panelOpen = true;
  let _currentCtx = null;
  let _currentSessionId = '';
  let _currentPhone = '';

  function _esc(v) {
    if (typeof global.escHtml === 'function') return global.escHtml(v);
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _toast(msg, tipo = 'info') {
    if (typeof global.showToast === 'function') global.showToast(msg, tipo);
  }

  function _getApiBase() {
    if (typeof global.RENDER_API_URL === 'string' && global.RENDER_API_URL.startsWith('http')) {
      return global.RENDER_API_URL.replace(/\/+$/, '');
    }
    try {
      if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
        return RENDER_API_URL.replace(/\/+$/, '');
      }
    } catch (_) {}
    if (typeof global.API_BASE !== 'undefined' && global.API_BASE) return String(global.API_BASE).replace(/\/+$/, '');
    try { if (typeof API_BASE !== 'undefined' && API_BASE) return String(API_BASE).replace(/\/+$/, ''); } catch (_) {}
    return '';
  }

  function _getFetchFn() {
    if (typeof global.fetchConTimeout === 'function') return global.fetchConTimeout;
    try { if (typeof fetchConTimeout === 'function') return fetchConTimeout; } catch (_) {}
    return null;
  }

  function _getActiveSessionId() {
    const sel = global.document?.getElementById('selWaBotTestSession');
    return String(sel?.value || _currentSessionId || '').trim();
  }

  function _fmtFechaCorta(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function buildFilterQueryParams() {
    const params = {};
    if (_stageFilter) params.stage = _stageFilter;
    if (_filterMode === 'needs_human') params.needsHuman = 'true';
    else if (_filterMode) params.filter = _filterMode;
    return params;
  }

  function setWaArmFilter(mode, btnEl) {
    _filterMode = String(mode || '').trim();
    const bar = global.document?.getElementById('waArmFilterChips');
    if (bar) {
      bar.querySelectorAll('.wa-arm-filter-chip').forEach((b) => b.classList.remove('active'));
    }
    if (btnEl && btnEl.classList) btnEl.classList.add('active');
    if (typeof global.cargarConversacionesServidorWa === 'function') {
      global.cargarConversacionesServidorWa(true);
    }
  }

  function setWaArmStageFilter(stage) {
    _stageFilter = String(stage || '').trim();
    if (typeof global.cargarConversacionesServidorWa === 'function') {
      global.cargarConversacionesServidorWa(true);
    }
  }

  function togglePanel360Wa(forceOpen) {
    const ws = global.document?.getElementById('waChatWorkspace');
    if (!ws) return;
    _panelOpen = typeof forceOpen === 'boolean' ? forceOpen : !_panelOpen;
    ws.classList.toggle('with-360', _panelOpen);
  }

  function _renderBotHeaderControls(conv) {
    const badge = global.document?.getElementById('waChatBotStateBadge');
    const btnPause = global.document?.getElementById('btnWaToggleBotPause');
    const btnResolve = global.document?.getElementById('btnWaResolveHandoff');
    if (!conv || !conv.phone) {
      if (badge) badge.style.display = 'none';
      if (btnPause) btnPause.style.display = 'none';
      if (btnResolve) btnResolve.style.display = 'none';
      return;
    }

    const paused = Boolean(conv.botPaused);
    const needsHuman = Boolean(conv.needsHuman);
    if (badge) {
      badge.style.display = 'inline-flex';
      if (needsHuman) {
        badge.className = 'badge-status badge-danger';
        badge.textContent = '🙋 Requiere Asesor';
      } else if (paused) {
        badge.className = 'badge-status badge-warn';
        badge.textContent = '⏸️ Bot Pausado';
      } else {
        badge.className = 'badge-status badge-ok';
        badge.textContent = '🤖 Bot Activo';
      }
    }
    if (btnPause) {
      btnPause.style.display = 'inline-flex';
      btnPause.innerHTML = paused ? '<span>▶️ Reanudar Bot</span>' : '<span>⏸️ Pausar Bot</span>';
    }
    if (btnResolve) {
      btnResolve.style.display = needsHuman ? 'inline-flex' : 'none';
    }
  }

  function _renderSkeleton360() {
    const body = global.document?.getElementById('waContext360Body');
    if (!body) return;
    body.innerHTML =
      '<div class="wa-360-card"><div class="ui-skeleton" style="height:16px;width:65%;"></div><div class="ui-skeleton" style="height:30px;width:100%;"></div></div>' +
      '<div class="wa-360-card"><div class="ui-skeleton" style="height:14px;width:55%;"></div><div class="ui-skeleton" style="height:56px;width:100%;"></div></div>' +
      '<div class="wa-360-card"><div class="ui-skeleton" style="height:14px;width:70%;"></div><div class="ui-skeleton" style="height:72px;width:100%;"></div></div>';
  }

  function _renderContext360(ctx) {
    const body = global.document?.getElementById('waContext360Body');
    if (!body) return;
    if (!ctx || !ctx.conversacion) {
      body.innerHTML =
        '<div class="wa-360-empty">' +
          '<div style="font-size:1.3rem;margin-bottom:6px;">🧭</div>' +
          '<div style="font-size:0.8rem;font-weight:800;color:#0f2744;">Contexto 360° del Asociado</div>' +
          '<div style="font-size:0.73rem;color:#64748b;margin-top:4px;">Seleccioná una conversación para ver etapa, Smart Fields, resumen ACW y documentos.</div>' +
        '</div>';
      _renderBotHeaderControls(null);
      return;
    }

    const c = ctx.conversacion;
    _renderBotHeaderControls(c);

    const stages = Array.isArray(ctx.pipelineStages) && ctx.pipelineStages.length > 0
      ? ctx.pipelineStages
      : Object.keys(STAGE_META).map((k) => ({ key: k, label: STAGE_META[k].label }));

    const stageOptionsHtml = stages.map((st) =>
      `<option value="${_esc(st.key)}"${c.pipelineStage === st.key ? ' selected' : ''}>${_esc(st.label)}</option>`
    ).join('');

    const sentBadge = c.sentiment
      ? `<span class="wa-stage-pill ${c.sentiment === 'urgente' || c.sentiment === 'negativo' ? 'danger' : (c.sentiment === 'positivo' ? 'ok' : 'info')}">${_esc(String(c.sentiment).toUpperCase())}</span>`
      : '';

    const sfDefs = Array.isArray(ctx.smartFieldDefs) ? ctx.smartFieldDefs : [];
    const sfVals = c.smartFields && typeof c.smartFields === 'object' ? c.smartFields : {};
    const sfHtml = sfDefs.length === 0
      ? '<div style="font-size:0.72rem;color:#64748b;">Sin Smart Fields configurados.</div>'
      : sfDefs.map((def) => {
          const entry = sfVals[def.fieldKey] || {};
          const val = entry.value;
          const src = entry.source === 'manual' ? 'manual' : (entry.source === 'ai' ? 'ai' : '');
          const srcTag = src ? `<span class="wa-360-source-tag ${src === 'manual' ? 'manual' : ''}">${src === 'manual' ? 'Manual' : 'IA'}</span>` : '';
          let inputHtml = '';
          if (def.dataType === 'boolean') {
            const cur = val === true ? 'true' : (val === false ? 'false' : '');
            inputHtml =
              `<select class="wa-360-select" data-wa-sf-key="${_esc(def.fieldKey)}">` +
                `<option value="">—</option>` +
                `<option value="true"${cur === 'true' ? ' selected' : ''}>Sí</option>` +
                `<option value="false"${cur === 'false' ? ' selected' : ''}>No</option>` +
              `</select>`;
          } else {
            const inpType = def.dataType === 'number' ? 'number' : 'text';
            const clsNum = def.dataType === 'number' ? ' tabular-nums' : '';
            inputHtml = `<input type="${inpType}" class="wa-360-input${clsNum}" data-wa-sf-key="${_esc(def.fieldKey)}" value="${_esc(val != null ? val : '')}" placeholder="${_esc(def.label)}"/>`;
          }
          return (
            `<div class="wa-360-sf-row">` +
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">` +
                `<label class="wa-360-label" style="margin:0;">${_esc(def.label)}</label>` +
                srcTag +
              `</div>` +
              inputHtml +
            `</div>`
          );
        }).join('');

    const ficha = ctx.fichaAsociado;
    const sols = Array.isArray(ctx.solicitudesRecientes) ? ctx.solicitudesRecientes : [];
    const cartera = Array.isArray(ctx.padronCartera) ? ctx.padronCartera : [];
    const fichaHtml = !c.dni
      ? '<div style="font-size:0.72rem;color:#64748b;">Vinculá un DNI arriba para cruzar Padrón, Cartera y Solicitudes.</div>'
      : (
        `<div style="font-size:0.74rem;color:#0f172a;font-weight:700;">${_esc(ficha?.apellido_nombres || cartera[0]?.apellido_nombre || c.name || 'Asociado')}</div>` +
        `<div class="tabular-nums" style="font-size:0.71rem;color:#475569;">DNI ${_esc(c.dni)}${ficha?.perfil_validacion_estado ? ' · Estado: ' + _esc(ficha.perfil_validacion_estado) : ''}</div>` +
        (cartera.length > 0 ? `<div style="font-size:0.71rem;color:#0369a1;margin-top:2px;">📁 Cartera: ${_esc(cartera[0].situacion || cartera[0].clasificacion || 'Registrado')}</div>` : '') +
        (sols.length > 0 ? `<div style="font-size:0.71rem;color:#15803d;margin-top:2px;">📄 ${sols.length} solicitud(es) reciente(s)</div>` : '<div style="font-size:0.71rem;color:#64748b;margin-top:2px;">Sin solicitudes vinculadas aún.</div>') +
        `<button type="button" class="wa-360-btn" style="margin-top:6px;width:100%;" onclick="window.abrirFichaDesdeWa360('${_esc(c.dni)}')">🔎 Ver Ficha Completa</button>`
      );

    const docs = Array.isArray(ctx.documentosRecibidos) ? ctx.documentosRecibidos : [];
    const docsHtml = docs.length === 0
      ? '<div style="font-size:0.72rem;color:#64748b;">Sin PDFs ni imágenes recibidas en este chat.</div>'
      : docs.slice(0, 8).map((d) =>
          `<div class="wa-360-doc-item">` +
            `<div style="min-width:0;flex:1;">` +
              `<div style="font-size:0.72rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.kind === 'image' ? '🖼️' : '📄'} ${_esc(d.fileName)}</div>` +
              `<div style="font-size:0.64rem;color:#64748b;">${_esc(_fmtFechaCorta(d.timestamp))}</div>` +
            `</div>` +
            `<button type="button" class="wa-360-btn primary" style="padding:3px 7px;font-size:0.67rem;flex-shrink:0;" onclick="window.auditarDocumentoWa('${_esc(d.mediaUrl)}', '${_esc(d.fileName)}')">🔍 Auditar</button>` +
          `</div>`
        ).join('');

    const acts = Array.isArray(ctx.actividades) ? ctx.actividades : [];
    const actsHtml = acts.length === 0
      ? '<div style="font-size:0.72rem;color:#64748b;">Sin actividades registradas.</div>'
      : acts.slice(0, 12).map((a) => {
          const isTask = a.kind === 'task';
          const checked = Boolean(a.doneAt);
          return (
            `<div class="wa-360-act-item">` +
              (isTask
                ? `<input type="checkbox" ${checked ? 'checked' : ''} onchange="window.completarActividadWa('${_esc(a.id)}', this.checked)" title="Marcar tarea"/>`
                : `<span>${a.kind === 'handoff' ? '🙋' : (a.kind === 'stage_change' ? '🔀' : (a.kind === 'call' ? '📞' : '📝'))}</span>`) +
              `<div style="min-width:0;flex:1;${checked ? 'text-decoration:line-through;opacity:0.6;' : ''}">` +
                `<div style="color:#0f172a;font-weight:600;">${_esc(a.body)}</div>` +
                `<div style="font-size:0.63rem;color:#64748b;">${_esc(a.createdBy)} · ${_esc(_fmtFechaCorta(a.createdAt))}${a.dueAt ? ' · Vence ' + _esc(_fmtFechaCorta(a.dueAt)) : ''}</div>` +
              `</div>` +
            `</div>`
          );
        }).join('');

    body.innerHTML =
      `<div class="wa-360-card">` +
        `<div>` +
          `<label class="wa-360-label" for="selWa360Stage">Etapa del Pipeline</label>` +
          `<select id="selWa360Stage" class="wa-360-select" onchange="window.cambiarEtapaPipelineWa(this.value)">${stageOptionsHtml}</select>` +
        `</div>` +
        `<div style="display:flex;gap:6px;align-items:flex-end;">` +
          `<div style="flex:1;">` +
            `<label class="wa-360-label" for="inpWa360Dni">DNI Vinculado</label>` +
            `<input type="text" id="inpWa360Dni" class="wa-360-input tabular-nums" maxlength="11" value="${_esc(c.dni || '')}" placeholder="Ej: 32111222"/>` +
          `</div>` +
          `<button type="button" class="wa-360-btn" onclick="window.vincularDniConversacionWa()">Vincular</button>` +
        `</div>` +
      `</div>` +

      `<details class="ui-accordion" open>` +
        `<summary>📝 Resumen ACW ${sentBadge}</summary>` +
        `<div class="ui-accordion-body" style="display:flex;flex-direction:column;gap:8px;">` +
          `<div style="font-size:0.74rem;color:#1e293b;line-height:1.45;">${c.aiSummary ? _esc(c.aiSummary) : '<span style="color:#64748b;">Todavía no se generó resumen para esta charla.</span>'}</div>` +
          `<button type="button" id="btnWaGenResumenAcw" class="wa-360-btn primary" onclick="window.generarResumenAcwWa()">✨ Generar / Actualizar Resumen</button>` +
        `</div>` +
      `</details>` +

      `<details class="ui-accordion" open>` +
        `<summary>🧩 Smart Fields (${sfDefs.length})</summary>` +
        `<div class="ui-accordion-body">` +
          `<div id="wa360SmartFieldsList">${sfHtml}</div>` +
          `<button type="button" class="wa-360-btn success" style="width:100%;margin-top:8px;" onclick="window.guardarSmartFieldsWa()">💾 Guardar Smart Fields</button>` +
        `</div>` +
      `</details>` +

      `<details class="ui-accordion">` +
        `<summary>🪪 Ficha, Padrón & Solicitudes</summary>` +
        `<div class="ui-accordion-body">${fichaHtml}</div>` +
      `</details>` +

      `<details class="ui-accordion">` +
        `<summary>📎 Documentos WA (${docs.length})</summary>` +
        `<div class="ui-accordion-body" style="display:flex;flex-direction:column;gap:6px;">${docsHtml}</div>` +
      `</details>` +

      `<details class="ui-accordion">` +
        `<summary>📅 Actividades (${acts.length})</summary>` +
        `<div class="ui-accordion-body" style="display:flex;flex-direction:column;gap:8px;">` +
          `<div style="display:flex;gap:4px;">` +
            `<select id="selWa360ActKind" class="wa-360-select" style="width:92px;">` +
              `<option value="note">📝 Nota</option>` +
              `<option value="call">📞 Llamada</option>` +
              `<option value="task">✅ Tarea</option>` +
            `</select>` +
            `<input type="text" id="inpWa360ActBody" class="wa-360-input" placeholder="Anotar seguimiento..."/>` +
          `</div>` +
          `<button type="button" class="wa-360-btn primary" onclick="window.crearActividadWa()">+ Agregar Actividad</button>` +
          `<div style="display:flex;flex-direction:column;gap:5px;">${actsHtml}</div>` +
        `</div>` +
      `</details>`;
  }

  async function cargarContexto360Wa(sessionId, phone, opts = {}) {
    const sid = String(sessionId || _getActiveSessionId()).trim();
    const tel = String(phone || '').replace(/\D+/g, '');
    if (!sid || tel.length < 8) {
      _currentCtx = null;
      _renderContext360(null);
      return null;
    }
    _currentSessionId = sid;
    _currentPhone = tel;
    if (!opts.silent) _renderSkeleton360();

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return null;

    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(sid)}/${encodeURIComponent(tel)}/context360`,
        { method: 'GET' },
        12000
      );
      if (!resp || !resp.ok) return null;
      const data = await resp.json().catch(() => null);
      if (data && data.ok) {
        _currentCtx = data;
        _renderContext360(data);
        return data;
      }
    } catch (_) {}
    return null;
  }

  async function _patchEstadoWa(payload, okMsg) {
    const sid = _getActiveSessionId();
    const tel = _currentPhone;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!sid || !tel || !apiBase || !fetchFn) return null;

    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(sid)}/${encodeURIComponent(tel)}/estado`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        10000
      );
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && data.ok) {
        if (okMsg) _toast(okMsg, 'success');
        await cargarContexto360Wa(sid, tel, { silent: true });
        if (typeof global.cargarConversacionesServidorWa === 'function') {
          global.cargarConversacionesServidorWa(true);
        }
        return data.conversacion;
      }
      _toast('⚠️ No se pudo actualizar el estado de la conversación.', 'warning');
    } catch (_) {
      _toast('⚠️ Error de red actualizando conversación.', 'warning');
    }
    return null;
  }

  async function togglePausaBotWa() {
    const paused = Boolean(_currentCtx?.conversacion?.botPaused);
    await _patchEstadoWa(
      { botPaused: !paused },
      !paused ? '⏸️ Bot pausado en esta conversación.' : '▶️ Bot reanudado en esta conversación.'
    );
  }

  async function resolverHandoffWa() {
    await _patchEstadoWa(
      { needsHuman: false, botPaused: true, handoffReason: '' },
      '✅ Derivación tomada. El bot quedó pausado para atención humana.'
    );
  }

  async function cambiarEtapaPipelineWa(stage) {
    if (!stage) return;
    const label = STAGE_META[stage]?.label || stage;
    await _patchEstadoWa({ pipelineStage: stage }, `🔀 Etapa actualizada a "${label}".`);
  }

  async function vincularDniConversacionWa() {
    const inp = global.document?.getElementById('inpWa360Dni');
    const dni = String(inp?.value || '').replace(/\D+/g, '');
    if (dni.length < 7) {
      _toast('Ingresá un DNI válido (mínimo 7 dígitos).', 'warning');
      return;
    }
    await _patchEstadoWa({ dni }, `🪪 DNI ${dni} vinculado.`);
  }

  async function generarResumenAcwWa() {
    const sid = _getActiveSessionId();
    const tel = _currentPhone;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!sid || !tel || !apiBase || !fetchFn) return;
    const btn = global.document?.getElementById('btnWaGenResumenAcw');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Analizando...';
    }
    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(sid)}/${encodeURIComponent(tel)}/resumen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extraerSmartFields: true })
        },
        18000
      );
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && data.ok) {
        _toast(`✨ Resumen ACW actualizado (${data.engine === 'gemini' ? 'Gemini' : 'Motor local'}).`, 'success');
        await cargarContexto360Wa(sid, tel, { silent: true });
      } else {
        _toast('⚠️ No se pudo generar el resumen ACW.', 'warning');
      }
    } catch (_) {
      _toast('⚠️ Error generando resumen ACW.', 'warning');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function guardarSmartFieldsWa() {
    const sid = _getActiveSessionId();
    const tel = _currentPhone;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const listEl = global.document?.getElementById('wa360SmartFieldsList');
    if (!sid || !tel || !apiBase || !fetchFn || !listEl) return;

    const fields = {};
    listEl.querySelectorAll('[data-wa-sf-key]').forEach((el) => {
      const key = el.getAttribute('data-wa-sf-key');
      if (!key) return;
      const val = String(el.value ?? '').trim();
      fields[key] = val === '' ? null : val;
    });

    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(sid)}/${encodeURIComponent(tel)}/smart-fields`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields, source: 'manual' })
        },
        10000
      );
      const data = await resp?.json().catch(() => null);
      if (resp && resp.ok && data?.ok) {
        _toast('💾 Smart Fields guardados.', 'success');
        await cargarContexto360Wa(sid, tel, { silent: true });
      } else {
        _toast(`⚠️ ${data?.detail || 'Error guardando Smart Fields.'}`, 'warning');
      }
    } catch (_) {
      _toast('⚠️ Error de red guardando Smart Fields.', 'warning');
    }
  }

  async function crearActividadWa() {
    const sid = _getActiveSessionId();
    const tel = _currentPhone;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const kind = global.document?.getElementById('selWa360ActKind')?.value || 'note';
    const inp = global.document?.getElementById('inpWa360ActBody');
    const body = String(inp?.value || '').trim();
    if (!sid || !tel || !apiBase || !fetchFn) return;
    if (!body) {
      _toast('Escribí una nota o tarea antes de agregar.', 'warning');
      return;
    }
    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(sid)}/${encodeURIComponent(tel)}/actividades`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, body })
        },
        10000
      );
      if (resp && resp.ok) {
        if (inp) inp.value = '';
        _toast('📅 Actividad registrada.', 'success');
        await cargarContexto360Wa(sid, tel, { silent: true });
      }
    } catch (_) {
      _toast('⚠️ No se pudo registrar la actividad.', 'warning');
    }
  }

  async function completarActividadWa(actId, done) {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!actId || !apiBase || !fetchFn) return;
    try {
      await fetchFn(
        `${apiBase}/api/admin/whatsapp/actividades/${encodeURIComponent(actId)}/completar`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: Boolean(done) })
        },
        10000
      );
      await cargarContexto360Wa(_getActiveSessionId(), _currentPhone, { silent: true });
    } catch (_) {}
  }

  async function enviarFeedbackMensajeWa(msgId, feedback) {
    const sid = _getActiveSessionId();
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!sid || !msgId || !apiBase || !fetchFn) return;
    let note = null;
    if (feedback === 'down' && typeof global.prompt === 'function') {
      note = global.prompt('¿Qué debería haber respondido el bot? (opcional)') || null;
    }
    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/mensajes/${encodeURIComponent(sid)}/${encodeURIComponent(msgId)}/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback, note })
        },
        10000
      );
      if (resp && resp.ok) {
        _toast(feedback === 'up' ? '👍 Feedback positivo guardado.' : '👎 Corrección registrada para entrenamiento.', 'info');
        if (typeof global.cargarMensajesChatWhatsappAdmin === 'function') {
          global.cargarMensajesChatWhatsappAdmin(true);
        }
      }
    } catch (_) {}
  }

  function abrirFichaDesdeWa360(dni) {
    const clean = String(dni || '').replace(/\D+/g, '');
    if (!clean) return;
    if (typeof global.cambiarVistaPrincipal === 'function') {
      global.cambiarVistaPrincipal('fichas');
    }
    setTimeout(() => {
      const inp = global.document?.getElementById('inpBuscarFichaAsociado');
      if (inp) {
        inp.value = clean;
        if (typeof global.buscarPadronFichasAsociados === 'function') {
          global.buscarPadronFichasAsociados();
        }
      }
    }, 250);
  }

  async function auditarDocumentoWa(mediaUrl, fileName) {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!mediaUrl || !apiBase || !fetchFn) return;
    try {
      _toast(`⬇️ Descargando ${fileName || 'documento'} para Auditoría IA...`, 'info');
      const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${apiBase}${mediaUrl}`;
      const resp = await fetchFn(fullUrl, { method: 'GET' }, 20000);
      if (!resp || !resp.ok) {
        _toast('⚠️ No se pudo descargar el archivo desde WhatsApp.', 'warning');
        return;
      }
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = global.document.createElement('a');
      a.href = objUrl;
      a.download = String(fileName || 'DOCUMENTO_WA').toUpperCase();
      global.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      if (typeof global.cambiarVistaPrincipal === 'function') {
        global.cambiarVistaPrincipal('auditor-ia');
      }
    } catch (_) {
      _toast('⚠️ Error descargando documento para Auditoría IA.', 'warning');
    }
  }

  function handleSseEvent(eventType, payload) {
    if (!payload) return;
    if (eventType === 'handoff_alert') {
      _toast(`🙋 Derivación a Asesor: ${payload.contactName || '+' + payload.phone} (${payload.reason || 'Requiere atención'})`, 'warning');
    }
    if (eventType === 'conversation_updated' || eventType === 'handoff_alert') {
      if (_currentPhone && String(payload.phone || '') === _currentPhone) {
        cargarContexto360Wa(payload.sessionId || _getActiveSessionId(), _currentPhone, { silent: true });
      }
    }
  }

  const api = {
    STAGE_META,
    buildFilterQueryParams,
    cargarContexto360Wa,
    handleSseEvent,
    setWaArmFilter,
    setWaArmStageFilter,
    togglePanel360Wa,
    togglePausaBotWa,
    resolverHandoffWa,
    cambiarEtapaPipelineWa,
    vincularDniConversacionWa,
    generarResumenAcwWa,
    guardarSmartFieldsWa,
    crearActividadWa,
    completarActividadWa,
    enviarFeedbackMensajeWa,
    abrirFichaDesdeWa360,
    auditarDocumentoWa
  };

  global.WaArm360 = api;
  global.setWaArmFilter = setWaArmFilter;
  global.setWaArmStageFilter = setWaArmStageFilter;
  global.togglePanel360Wa = togglePanel360Wa;
  global.togglePausaBotWa = togglePausaBotWa;
  global.resolverHandoffWa = resolverHandoffWa;
  global.cambiarEtapaPipelineWa = cambiarEtapaPipelineWa;
  global.vincularDniConversacionWa = vincularDniConversacionWa;
  global.generarResumenAcwWa = generarResumenAcwWa;
  global.guardarSmartFieldsWa = guardarSmartFieldsWa;
  global.crearActividadWa = crearActividadWa;
  global.completarActividadWa = completarActividadWa;
  global.enviarFeedbackMensajeWa = enviarFeedbackMensajeWa;
  global.abrirFichaDesdeWa360 = abrirFichaDesdeWa360;
  global.auditarDocumentoWa = auditarDocumentoWa;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
