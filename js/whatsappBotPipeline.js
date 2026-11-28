/* ============================================================================
 * AMMER - Módulo Fase W3: Pipeline Kanban (8 Etapas), Equipos/Horarios +
 *         Round-Robin, Automatizaciones y Campañas Masivas CSV
 * ============================================================================ */
(function (global) {
  'use strict';

  const PIPELINE_ORDER = [
    'nuevo_lead',
    'calificando',
    'docs_pendientes',
    'simulacion',
    'esperando_firma',
    'derivado_asesor',
    'cerrado',
    'descartado'
  ];

  let _advisors = [];
  let _rules = [];
  let _lastCsvPreview = null;
  let _draggedCard = null;

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

  function _fmtHoraCorta(iso) {
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

  function _renderKanbanBoard(data) {
    const board = global.document?.getElementById('waPipelineBoard');
    const lblTotal = global.document?.getElementById('waPipelineTotalBadge');
    if (!board) return;

    if (!data) {
      board.innerHTML =
        '<div class="wa-kanban-col"><div class="ui-skeleton" style="height:180px;"></div></div>' +
        '<div class="wa-kanban-col"><div class="ui-skeleton" style="height:180px;"></div></div>' +
        '<div class="wa-kanban-col"><div class="ui-skeleton" style="height:180px;"></div></div>';
      return;
    }

    if (lblTotal) lblTotal.textContent = `${Number(data.totalLeads || 0)} leads`;
    const stages = Array.isArray(data.stages) ? data.stages : [];

    board.innerHTML = stages.map((st) => {
      const items = Array.isArray(st.items) ? st.items : [];
      const cardsHtml = items.length === 0
        ? '<div class="wa-kanban-empty">Sin leads en esta etapa</div>'
        : items.map((c) => {
            const win = c.window24h || {};
            const winBadge = win.open
              ? `<span class="wa-stage-pill ${Number(win.hoursRemaining || 0) <= 4 ? 'warn' : 'ok'} tabular-nums">⏱️ ${Number(win.hoursRemaining || 0).toFixed(1)}h</span>`
              : '<span class="wa-stage-pill">24h cerrada</span>';
            const handoffBadge = c.needsHuman ? '<span class="wa-stage-pill danger">🙋 Asesor</span>' : '';
            return (
              `<div class="wa-kanban-card" draggable="true" ` +
                `ondragstart="window.onWaKanbanDragStart(event, '${_esc(c.sessionId)}', '${_esc(c.phone)}')" ` +
                `onclick="window.abrirChatDesdeKanbanWa('${_esc(c.sessionId)}', '${_esc(c.phone)}', '${_esc(c.name || '')}', '${_esc(c.dni || '')}')">` +
                `<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">` +
                  `<span style="font-size:0.78rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.name || '+' + c.phone)}</span>` +
                  `<span style="font-size:0.63rem;color:#64748b;flex-shrink:0;">${_esc(_fmtHoraCorta(c.lastMessageAt))}</span>` +
                `</div>` +
                `<div class="tabular-nums" style="font-size:0.69rem;color:#475569;">📲 +${_esc(c.phone)}${c.dni ? ' · DNI ' + _esc(c.dni) : ''}</div>` +
                `<div style="font-size:0.71rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.lastMessageText || 'Sin mensajes')}</div>` +
                `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:2px;">` +
                  winBadge + handoffBadge +
                  (c.assignedAdvisor ? `<span class="wa-stage-pill info">👤 ${_esc(c.assignedAdvisor)}</span>` : '') +
                `</div>` +
              `</div>`
            );
          }).join('');

      return (
        `<div class="wa-kanban-col" data-wa-stage="${_esc(st.key)}" ` +
          `ondragover="event.preventDefault();this.classList.add('drag-over')" ` +
          `ondragleave="this.classList.remove('drag-over')" ` +
          `ondrop="window.onWaKanbanDrop(event, '${_esc(st.key)}', this)">` +
          `<div class="wa-kanban-col-head">` +
            `<span>${_esc(st.label)}</span>` +
            `<span class="wa-kanban-count tabular-nums">${Number(st.count || 0)}</span>` +
          `</div>` +
          `<div class="wa-kanban-col-body">${cardsHtml}</div>` +
        `</div>`
      );
    }).join('');
  }

  function _renderAdvisorsList() {
    const box = global.document?.getElementById('waAdvisorsListBox');
    if (!box) return;
    if (_advisors.length === 0) {
      box.innerHTML = '<div style="font-size:0.74rem;color:#64748b;">Todavía no hay asesores configurados para Round-Robin. Agregá el primero arriba.</div>';
      return;
    }
    box.innerHTML = _advisors.map((a, idx) => {
      const slotMon = (a.schedule?.mon && a.schedule.mon[0]) ? a.schedule.mon[0].join('–') : 'Sin franja';
      return (
        `<div class="wa-360-doc-item" style="background:#ffffff;">` +
          `<div style="min-width:0;flex:1;">` +
            `<div style="font-size:0.76rem;font-weight:800;color:#0f2744;">👤 ${_esc(a.displayName)} <span style="color:#64748b;font-weight:600;">(${_esc(a.advisorId)})</span></div>` +
            `<div class="tabular-nums" style="font-size:0.69rem;color:#475569;">Equipo: ${_esc(a.team)} · L-V ${_esc(slotMon)} · ${a.acceptsRoundRobin ? '⚖️ Round-Robin ON' : '⏸️ Manual'}</div>` +
          `</div>` +
          `<button type="button" class="wa-360-btn" style="color:#b91c1c;" onclick="window.eliminarAsesorHorarioWa(${idx})">Quitar</button>` +
        `</div>`
      );
    }).join('');
  }

  function _renderAutomationsList() {
    const box = global.document?.getElementById('waAutomationsListBox');
    if (!box) return;
    if (_rules.length === 0) {
      box.innerHTML = '<div style="font-size:0.74rem;color:#64748b;">Sin reglas de automatización cargadas.</div>';
      return;
    }
    box.innerHTML = _rules.map((r) =>
      `<div class="wa-360-doc-item" style="background:#ffffff;padding:0.55rem 0.7rem;">` +
        `<div style="min-width:0;flex:1;">` +
          `<div style="font-size:0.77rem;font-weight:800;color:#0f2744;">⚡ ${_esc(r.name)}</div>` +
          `<div style="font-size:0.69rem;color:#475569;">Trigger: <code>${_esc(r.triggerEvent)}</code> · ${r.respectBusinessHours ? '🕒 Respeta horario laboral' : '🌐 24/7'}</div>` +
        `</div>` +
        `<label style="display:inline-flex;align-items:center;gap:6px;font-size:0.73rem;font-weight:800;cursor:pointer;">` +
          `<input type="checkbox" ${r.enabled ? 'checked' : ''} onchange="window.toggleReglaAutomatizacionWa('${_esc(r.ruleKey)}', this.checked)" style="width:16px;height:16px;accent-color:#16a34a;"/>` +
          `<span>${r.enabled ? 'Activa' : 'Apagada'}</span>` +
        `</label>` +
      `</div>`
    ).join('');
  }

  async function cargarPanelPipelineWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    _renderKanbanBoard(null);
    const q = String(global.document?.getElementById('inpWaPipelineSearch')?.value || '').trim();
    const qs = new URLSearchParams({ limit: '200' });
    if (q) qs.set('q', q);

    try {
      const [rPipe, rHor, rAuto] = await Promise.all([
        fetchFn(`${apiBase}/api/admin/whatsapp/pipeline?${qs.toString()}`, { method: 'GET' }, 12000),
        fetchFn(`${apiBase}/api/admin/whatsapp/equipo/horarios`, { method: 'GET' }, 12000),
        fetchFn(`${apiBase}/api/admin/whatsapp/automatizaciones`, { method: 'GET' }, 12000)
      ]);
      if (rPipe && rPipe.ok) {
        const dp = await rPipe.json().catch(() => null);
        if (dp && dp.ok) _renderKanbanBoard(dp);
      }
      if (rHor && rHor.ok) {
        const dh = await rHor.json().catch(() => null);
        if (dh && dh.ok) {
          _advisors = Array.isArray(dh.advisors) ? dh.advisors : [];
          _renderAdvisorsList();
        }
      }
      if (rAuto && rAuto.ok) {
        const da = await rAuto.json().catch(() => null);
        if (da && da.ok) {
          _rules = Array.isArray(da.rules) ? da.rules : [];
          _renderAutomationsList();
        }
      }
    } catch (_) {
      _toast('⚠️ No se pudo cargar el Pipeline Kanban.', 'warning');
    }
  }

  function onWaKanbanDragStart(ev, sessionId, phone) {
    _draggedCard = { sessionId, phone };
    if (ev?.dataTransfer) {
      ev.dataTransfer.setData('text/plain', `${sessionId}|${phone}`);
    }
  }

  async function onWaKanbanDrop(ev, targetStage, colEl) {
    ev?.preventDefault();
    colEl?.classList.remove('drag-over');
    const card = _draggedCard;
    _draggedCard = null;
    if (!card || !card.sessionId || !card.phone || !targetStage) return;

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/conversaciones/${encodeURIComponent(card.sessionId)}/${encodeURIComponent(card.phone)}/estado`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipelineStage: targetStage })
        },
        10000
      );
      if (resp && resp.ok) {
        _toast(`🔀 Lead movido a "${targetStage}".`, 'success');
        await cargarPanelPipelineWa();
      }
    } catch (_) {
      _toast('⚠️ No se pudo mover el lead.', 'warning');
    }
  }

  function abrirChatDesdeKanbanWa(sessionId, phone, name, dni) {
    if (typeof global.cambiarTabWhatsappBotAdmin === 'function') {
      global.cambiarTabWhatsappBotAdmin('mensajeria', true);
    }
    const sel = global.document?.getElementById('selWaBotTestSession');
    if (sel && sessionId && Array.from(sel.options).some((o) => o.value === sessionId)) {
      sel.value = sessionId;
    }
    if (typeof global.seleccionarContactoWhatsappAdmin === 'function') {
      global.seleccionarContactoWhatsappAdmin({ phone, name: name || `+${phone}`, dni: dni || '' }, true);
    }
  }

  async function _persistirHorariosWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const resp = await fetchFn(
      `${apiBase}/api/admin/whatsapp/equipo/horarios`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisors: _advisors })
      },
      10000
    );
    if (resp && resp.ok) {
      const d = await resp.json().catch(() => null);
      if (d?.ok) _advisors = d.advisors || _advisors;
      _renderAdvisorsList();
      _toast('⚖️ Horarios y Round-Robin guardados.', 'success');
    }
  }

  async function agregarAsesorHorarioWa() {
    const id = String(global.document?.getElementById('inpWaAdvId')?.value || '').trim();
    const name = String(global.document?.getElementById('inpWaAdvName')?.value || '').trim();
    const team = String(global.document?.getElementById('selWaAdvTeam')?.value || 'originacion');
    const desde = String(global.document?.getElementById('inpWaAdvFrom')?.value || '08:00');
    const hasta = String(global.document?.getElementById('inpWaAdvTo')?.value || '17:00');
    if (!id || !name) {
      _toast('Completá usuario y nombre del asesor.', 'warning');
      return;
    }
    const schedule = {
      mon: [[desde, hasta]],
      tue: [[desde, hasta]],
      wed: [[desde, hasta]],
      thu: [[desde, hasta]],
      fri: [[desde, hasta]]
    };
    _advisors = _advisors.filter((a) => a.advisorId !== id);
    _advisors.push({
      advisorId: id,
      displayName: name,
      team,
      active: true,
      acceptsRoundRobin: true,
      schedule
    });
    if (global.document?.getElementById('inpWaAdvId')) global.document.getElementById('inpWaAdvId').value = '';
    if (global.document?.getElementById('inpWaAdvName')) global.document.getElementById('inpWaAdvName').value = '';
    await _persistirHorariosWa();
  }

  async function eliminarAsesorHorarioWa(idx) {
    _advisors.splice(idx, 1);
    await _persistirHorariosWa();
  }

  async function toggleReglaAutomatizacionWa(ruleKey, enabled) {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const cur = _rules.find((r) => r.ruleKey === ruleKey);
    if (!apiBase || !fetchFn || !cur) return;
    const payload = { ...cur, enabled: Boolean(enabled) };
    const resp = await fetchFn(
      `${apiBase}/api/admin/whatsapp/automatizaciones/${encodeURIComponent(ruleKey)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      10000
    );
    if (resp && resp.ok) {
      const d = await resp.json().catch(() => null);
      if (d?.ok) _rules = d.rules || _rules;
      _renderAutomationsList();
      _toast(`⚡ Regla "${cur.name}" ${enabled ? 'activada' : 'pausada'}.`, 'info');
    }
  }

  async function ejecutarBarridoAutomatizacionesWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/automatizaciones/ejecutar-barrido`, { method: 'POST' }, 15000);
    const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
    if (data && data.ok) {
      _toast(`⚡ Barrido completado: ${data.accionesEjecutadas} acción(es) ejecutadas (${data.reglasActivas} reglas activas).`, 'success');
      await cargarPanelPipelineWa();
    } else {
      _toast('⚠️ No se pudo ejecutar el barrido de automatizaciones.', 'warning');
    }
  }

  function cargarArchivoCsvCampanaWa(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ta = global.document?.getElementById('txtWaCampanaCsv');
      if (ta) ta.value = String(reader.result || '');
      previsualizarCampanaCsvWa();
    };
    reader.readAsText(file);
  }

  async function previsualizarCampanaCsvWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const csvText = String(global.document?.getElementById('txtWaCampanaCsv')?.value || '').trim();
    const out = global.document?.getElementById('waCampanaPreviewBox');
    if (!csvText || !apiBase || !fetchFn) {
      _toast('Pegá o subí un archivo CSV primero.', 'warning');
      return;
    }
    const paramCols = String(global.document?.getElementById('inpWaCampanaParams')?.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const resp = await fetchFn(
      `${apiBase}/api/admin/whatsapp/campanas/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          phoneColumn: String(global.document?.getElementById('inpWaCampanaColTel')?.value || 'telefono').trim(),
          dniColumn: String(global.document?.getElementById('inpWaCampanaColDni')?.value || 'dni').trim(),
          nameColumn: String(global.document?.getElementById('inpWaCampanaColNombre')?.value || 'nombre').trim(),
          paramColumns: paramCols
        })
      },
      12000
    );
    const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
    if (data && data.ok) {
      _lastCsvPreview = data;
      if (out) {
        out.innerHTML =
          `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">` +
            `<span class="badge-status badge-ok tabular-nums">✅ Válidos: ${data.totalValidos}</span>` +
            `<span class="badge-status badge-warn tabular-nums">🔁 Duplicados Tel/DNI omitidos: ${data.duplicadosOmitidos}</span>` +
            `<span class="badge-status badge-danger tabular-nums">⚠️ Inválidos: ${data.invalidos}</span>` +
          `</div>` +
          `<div style="font-size:0.71rem;color:#475569;">Columnas detectadas: <code>${_esc((data.headers || []).join(', '))}</code></div>`;
      }
    }
  }

  async function enviarCampanaCsvWa(dryRun = false) {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const csvText = String(global.document?.getElementById('txtWaCampanaCsv')?.value || '').trim();
    const templateName = String(global.document?.getElementById('inpWaCampanaTemplate')?.value || '').trim();
    const workerRole = String(global.document?.getElementById('selWaCampanaRole')?.value || 'reactivacion');
    const sid = String(global.document?.getElementById('selWaBotTestSession')?.value || 'meta_default');
    if (!csvText || !templateName) {
      _toast('Completá el CSV y el nombre de plantilla Meta aprobada.', 'warning');
      return;
    }
    if (!dryRun && typeof global.confirm === 'function') {
      const total = _lastCsvPreview ? _lastCsvPreview.totalValidos : 'los';
      const ok2Step = global.confirm(`¿Confirmás enviar la plantilla "${templateName}" a ${total} contacto(s) desde la línea "${sid}"?`);
      if (!ok2Step) return;
    }
    const paramCols = String(global.document?.getElementById('inpWaCampanaParams')?.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const resp = await fetchFn(
      `${apiBase}/api/admin/whatsapp/campanas/enviar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          templateName,
          templateLanguage: 'es_AR',
          assignWorkerRole: workerRole,
          dryRun: Boolean(dryRun),
          csvText,
          phoneColumn: String(global.document?.getElementById('inpWaCampanaColTel')?.value || 'telefono').trim(),
          dniColumn: String(global.document?.getElementById('inpWaCampanaColDni')?.value || 'dni').trim(),
          nameColumn: String(global.document?.getElementById('inpWaCampanaColNombre')?.value || 'nombre').trim(),
          paramColumns: paramCols
        })
      },
      25000
    );
    const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
    if (data && data.ok) {
      _toast(
        `${dryRun ? '🧪 Simulación' : '📣 Campaña'}: ${data.enviados}/${data.totalValidos} procesados (duplicados omitidos: ${data.duplicadosOmitidos}).`,
        data.errores?.length ? 'warning' : 'success'
      );
    } else {
      _toast('⚠️ No se pudo ejecutar la campaña CSV.', 'warning');
    }
  }

  const api = {
    PIPELINE_ORDER,
    cargarPanelPipelineWa,
    onWaKanbanDragStart,
    onWaKanbanDrop,
    abrirChatDesdeKanbanWa,
    agregarAsesorHorarioWa,
    eliminarAsesorHorarioWa,
    toggleReglaAutomatizacionWa,
    ejecutarBarridoAutomatizacionesWa,
    cargarArchivoCsvCampanaWa,
    previsualizarCampanaCsvWa,
    enviarCampanaCsvWa
  };

  global.WaPipelineUI = api;
  global.cargarPanelPipelineWa = cargarPanelPipelineWa;
  global.onWaKanbanDragStart = onWaKanbanDragStart;
  global.onWaKanbanDrop = onWaKanbanDrop;
  global.abrirChatDesdeKanbanWa = abrirChatDesdeKanbanWa;
  global.agregarAsesorHorarioWa = agregarAsesorHorarioWa;
  global.eliminarAsesorHorarioWa = eliminarAsesorHorarioWa;
  global.toggleReglaAutomatizacionWa = toggleReglaAutomatizacionWa;
  global.ejecutarBarridoAutomatizacionesWa = ejecutarBarridoAutomatizacionesWa;
  global.cargarArchivoCsvCampanaWa = cargarArchivoCsvCampanaWa;
  global.previsualizarCampanaCsvWa = previsualizarCampanaCsvWa;
  global.enviarCampanaCsvWa = enviarCampanaCsvWa;
})(typeof window !== 'undefined' ? window : globalThis);
