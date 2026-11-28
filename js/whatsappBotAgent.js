/* ============================================================================
 * AMMER - Módulo Fase W2: Agente IA Multi-Rol, Guardas 3 Capas,
 *         Monitor de Presupuesto y Simulador Sandbox (Modo Borrador)
 * ============================================================================ */
(function (global) {
  'use strict';

  const WORKER_ROLE_LABELS = {
    inbound_prestamos: '💰 Inbound Préstamos (Calificador)',
    docs_pendientes: '📎 Seguimiento de Documentación',
    cobranzas: '🏦 Cobranzas y Regularización',
    reactivacion: '🔄 Reactivación de Leads'
  };

  let _configsByKey = {};
  let _availableTools = [];
  let _selectedConfigKey = 'role:inbound_prestamos';
  let _simSessionId = '';
  let _simMessages = [];
  let _lastSimResult = null;

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

  function _fmtNum(n) {
    return Number(n || 0).toLocaleString('es-AR');
  }

  function _renderBudgetKpis(bud) {
    const box = global.document?.getElementById('waAgentBudgetKpis');
    if (!box) return;
    if (!bud) {
      box.innerHTML =
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:44px;"></div></div>' +
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:44px;"></div></div>' +
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:44px;"></div></div>';
      return;
    }
    const pct = Math.min(100, Math.max(0, Number(bud.usoPct || 0)));
    const barColor = pct >= 85 ? '#dc2626' : (pct >= 60 ? '#d97706' : '#16a34a');
    box.innerHTML =
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">Tokens Hoy / Límite Diario</span>` +
        `<span class="wa-agent-kpi-value tabular-nums">${_esc(_fmtNum(bud.totalTokensHoy))} <span style="font-size:0.74rem;font-weight:700;color:#64748b;">/ ${_esc(_fmtNum(bud.limiteDiario))}</span></span>` +
        `<div class="wa-agent-progress"><div class="wa-agent-progress-fill" style="width:${pct}%;background:${barColor};"></div></div>` +
      `</div>` +
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">🛡️ Bloqueos Guardas Anti-Injection</span>` +
        `<span class="wa-agent-kpi-value tabular-nums" style="color:${bud.bloqueosGuardas > 0 ? '#b91c1c' : '#15803d'};">${_esc(_fmtNum(bud.bloqueosGuardas))}</span>` +
        `<span style="font-size:0.7rem;color:#64748b;">Capa 1 Input + Capa 2 Fence + Capa 3 Output</span>` +
      `</div>` +
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">Conversaciones Procesadas Hoy</span>` +
        `<span class="wa-agent-kpi-value tabular-nums">${_esc(_fmtNum(bud.conversacionesActivas))}</span>` +
        `<span style="font-size:0.7rem;color:#64748b;">Incluye sesiones de prueba en Simulador</span>` +
      `</div>`;
  }

  function _renderConfigForm(configKey) {
    const cfg = _configsByKey[configKey];
    const form = global.document?.getElementById('waAgentConfigFormBody');
    if (!form) return;
    if (!cfg) {
      form.innerHTML = '<div style="font-size:0.75rem;color:#64748b;">Seleccioná un rol de AI Worker para configurar.</div>';
      return;
    }
    const allowedSet = new Set(Array.isArray(cfg.allowedTools) ? cfg.allowedTools : []);
    const toolsHtml = (_availableTools.length ? _availableTools : [
      'consultar_padron', 'pre_simular_cuota', 'actualizar_ficha_lead', 'mover_etapa', 'derivar_asesor'
    ]).map((t) =>
      `<label><input type="checkbox" data-wa-agent-tool="${_esc(t)}" ${allowedSet.has(t) ? 'checked' : ''}/> <span>${_esc(t)}</span></label>`
    ).join('');

    form.innerHTML =
      `<div class="wa-agent-cfg-grid">` +
        `<div>` +
          `<label class="wa-360-label">Estado del AI Worker</label>` +
          `<label style="display:flex;align-items:center;gap:8px;padding:0.42rem 0.65rem;border:1px solid #cbd5e1;border-radius:8px;background:#ffffff;font-size:0.76rem;font-weight:700;cursor:pointer;">` +
            `<input type="checkbox" id="chkWaAgentEnabled" ${cfg.enabled ? 'checked' : ''} style="width:15px;height:15px;accent-color:#16a34a;"/>` +
            `<span>${cfg.enabled ? '🟢 Activo en producción' : '⏸️ Apagado (solo Simulador)'}</span>` +
          `</label>` +
        `</div>` +
        `<div>` +
          `<label class="wa-360-label" for="inpWaAgentModel">Modelo LLM</label>` +
          `<input type="text" id="inpWaAgentModel" class="wa-360-input" value="${_esc(cfg.model || 'gemini-2.5-flash')}"/>` +
        `</div>` +
        `<div>` +
          `<label class="wa-360-label" for="inpWaAgentDebounce">Debounce (segundos)</label>` +
          `<input type="number" id="inpWaAgentDebounce" class="wa-360-input tabular-nums" min="0" max="60" value="${_esc(cfg.debounceSeconds ?? 6)}"/>` +
        `</div>` +
        `<div>` +
          `<label class="wa-360-label" for="inpWaAgentBudgetConv">Tope Tokens / Conversación</label>` +
          `<input type="number" id="inpWaAgentBudgetConv" class="wa-360-input tabular-nums" min="0" max="500000" value="${_esc(cfg.budgetConvTokens ?? 12000)}"/>` +
        `</div>` +
        `<div>` +
          `<label class="wa-360-label" for="inpWaAgentBudgetDay">Tope Tokens / Día (Global)</label>` +
          `<input type="number" id="inpWaAgentBudgetDay" class="wa-360-input tabular-nums" min="0" max="50000000" value="${_esc(cfg.budgetDailyTokens ?? 500000)}"/>` +
        `</div>` +
      `</div>` +
      `<div style="margin-top:10px;">` +
        `<label class="wa-360-label">Herramientas (Tools) Habilitadas</label>` +
        `<div id="waAgentToolsChecks" class="wa-agent-tools-checks">${toolsHtml}</div>` +
      `</div>` +
      `<div style="margin-top:10px;">` +
        `<label class="wa-360-label" for="txtWaAgentPrompt">System Prompt del Rol</label>` +
        `<textarea id="txtWaAgentPrompt" class="wa-360-input" rows="4" style="resize:vertical;font-family:inherit;line-height:1.45;">${_esc(cfg.systemPrompt || '')}</textarea>` +
      `</div>` +
      `<div style="margin-top:8px;">` +
        `<label class="wa-360-label" for="inpWaAgentHandoffMsg">Mensaje automático al derivar a asesor</label>` +
        `<input type="text" id="inpWaAgentHandoffMsg" class="wa-360-input" value="${_esc(cfg.handoffMessage || '')}"/>` +
      `</div>` +
      `<div style="display:flex;justify-content:flex-end;margin-top:10px;">` +
        `<button type="button" class="wa-360-btn primary" onclick="window.guardarConfigAgenteWa()">💾 Guardar Configuración del Rol</button>` +
      `</div>`;
  }

  function _renderSimChat() {
    const thread = global.document?.getElementById('waAgentSimThread');
    if (!thread) return;
    if (_simMessages.length === 0) {
      thread.innerHTML =
        '<div style="margin:auto;text-align:center;max-width:340px;background:rgba(255,255,255,0.92);border:1px solid #cbd5e1;border-radius:12px;padding:1rem;">' +
          '<div style="font-size:1.3rem;margin-bottom:4px;">🧪</div>' +
          '<div style="font-size:0.82rem;font-weight:800;color:#0f2744;">Simulador Sandbox (Sin envíos reales)</div>' +
          '<div style="font-size:0.72rem;color:#475569;margin-top:4px;line-height:1.45;">Escribí como un asociado (ej: "Hola soy docente, DNI 32111222, necesito $500.000 en 12 cuotas") para probar Tools, Guardas y Handoff.</div>' +
        '</div>';
      return;
    }
    thread.innerHTML = _simMessages.map((m) =>
      `<div class="wa-msg-row ${m.fromMe ? 'out' : 'in'}" style="max-width:85%;">` +
        `<div class="wa-msg-bubble">` +
          `<div style="font-size:0.65rem;font-weight:800;color:${m.fromMe ? '#15803d' : '#0369a1'};margin-bottom:2px;">${m.fromMe ? '🤖 Agente IA' : '👤 Cliente Simulado'}</div>` +
          `<div>${_esc(m.text)}</div>` +
        `</div>` +
      `</div>`
    ).join('');
    thread.scrollTop = thread.scrollHeight;
  }

  function _renderSimInspector(res) {
    const el = global.document?.getElementById('waAgentSimInspector');
    if (!el) return;
    if (!res) {
      el.innerHTML =
        '<div class="wa-360-empty">' +
          '<div style="font-size:1.2rem;margin-bottom:4px;">🔬</div>' +
          '<div style="font-size:0.78rem;font-weight:800;color:#0f2744;">Inspector en Vivo</div>' +
          '<div style="font-size:0.71rem;color:#64748b;margin-top:4px;">Acá verás las Tools ejecutadas, Smart Fields capturados, etapa del pipeline, estado de Guardas 3 capas y tokens del turno.</div>' +
        '</div>';
      return;
    }

    const snap = res.conversationSnapshot || {};
    const guards = res.guardChecks || {};
    const tools = Array.isArray(res.toolCalls) ? res.toolCalls : [];
    const sf = snap.smartFields && typeof snap.smartFields === 'object' ? snap.smartFields : {};
    const sfKeys = Object.keys(sf);

    const guardBadge = guards.inputBlocked
      ? `<span class="badge-status badge-danger">🛡️ BLOQUEADO (${_esc(guards.inputReason || 'injection')})</span>`
      : (guards.outputModified
          ? `<span class="badge-status badge-warn">🛡️ SALIDA SANITIZADA (${_esc((guards.outputReasons || []).join(', '))})</span>`
          : '<span class="badge-status badge-ok">🛡️ 3 CAPAS OK</span>');

    const toolsHtml = tools.length === 0
      ? '<div style="font-size:0.72rem;color:#64748b;">No ejecutó herramientas en este turno.</div>'
      : tools.map((t) =>
          `<div class="wa-agent-tool-pill">` +
            `<div style="font-weight:800;color:#0f2744;">⚙️ ${_esc(t.tool)} ${t.ok ? '✅' : '⚠️'}</div>` +
            `<code style="font-size:0.66rem;color:#475569;word-break:break-all;">${_esc(JSON.stringify(t))}</code>` +
          `</div>`
        ).join('');

    const sfHtml = sfKeys.length === 0
      ? '<div style="font-size:0.72rem;color:#64748b;">Aún sin datos extraídos.</div>'
      : sfKeys.map((k) =>
          `<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:2px 0;border-bottom:1px dashed #e2e8f0;">` +
            `<span style="color:#475569;font-weight:700;">${_esc(k)}</span>` +
            `<span class="tabular-nums" style="color:#0f172a;font-weight:800;">${_esc(String(sf[k]?.value ?? ''))}</span>` +
          `</div>`
        ).join('');

    el.innerHTML =
      `<div class="wa-360-card">` +
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">` +
          `<span class="wa-360-label" style="margin:0;">Estado & Guardas</span>` +
          guardBadge +
        `</div>` +
        `<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:0.71rem;">` +
          `<span class="wa-stage-pill info">Etapa: ${_esc(snap.pipelineStage || 'nuevo_lead')}</span>` +
          `<span class="wa-stage-pill ${snap.botPaused ? 'danger' : 'ok'}">${snap.botPaused ? '⏸️ Bot Pausado (Handoff)' : '🤖 Bot Activo'}</span>` +
          `<span class="wa-stage-pill">Motor: ${_esc(res.engine || 'local')}</span>` +
          `<span class="wa-stage-pill tabular-nums">Tokens: ${_esc(String(res.budgetUsed?.totalTokens || 0))}</span>` +
        `</div>` +
      `</div>` +
      `<div class="wa-360-card">` +
        `<span class="wa-360-label">Tools Ejecutadas (${tools.length})</span>` +
        toolsHtml +
      `</div>` +
      `<div class="wa-360-card">` +
        `<span class="wa-360-label">Smart Fields & DNI (${sfKeys.length})</span>` +
        (snap.dni ? `<div class="tabular-nums" style="font-size:0.72rem;font-weight:800;color:#1e3a8a;">🪪 DNI: ${_esc(snap.dni)}</div>` : '') +
        sfHtml +
      `</div>`;
  }

  async function cargarPanelAgenteWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    _renderBudgetKpis(null);
    _renderSimChat();
    _renderSimInspector(_lastSimResult);

    try {
      const [rCfg, rBud] = await Promise.all([
        fetchFn(`${apiBase}/api/admin/whatsapp/agente/config`, { method: 'GET' }, 12000),
        fetchFn(`${apiBase}/api/admin/whatsapp/agente/presupuesto`, { method: 'GET' }, 12000)
      ]);
      if (rCfg && rCfg.ok) {
        const d = await rCfg.json().catch(() => null);
        if (d && d.ok) {
          _configsByKey = {};
          (d.configs || []).forEach((c) => { _configsByKey[c.configKey] = c; });
          _availableTools = Array.isArray(d.availableTools) ? d.availableTools : [];
          _renderConfigForm(_selectedConfigKey);
        }
      }
      if (rBud && rBud.ok) {
        const b = await rBud.json().catch(() => null);
        if (b && b.ok) _renderBudgetKpis(b);
      }
    } catch (_) {
      _toast('⚠️ No se pudo cargar la configuración del Agente IA.', 'warning');
    }
  }

  function seleccionarRolConfigAgenteWa(configKey) {
    _selectedConfigKey = String(configKey || 'role:inbound_prestamos');
    _renderConfigForm(_selectedConfigKey);
  }

  async function guardarConfigAgenteWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const cfgPrev = _configsByKey[_selectedConfigKey];
    if (!apiBase || !fetchFn || !cfgPrev) return;

    const allowedTools = [];
    global.document?.querySelectorAll('#waAgentToolsChecks [data-wa-agent-tool]').forEach((chk) => {
      if (chk.checked) allowedTools.push(chk.getAttribute('data-wa-agent-tool'));
    });

    const payload = {
      enabled: Boolean(global.document?.getElementById('chkWaAgentEnabled')?.checked),
      workerRole: cfgPrev.workerRole || 'inbound_prestamos',
      model: String(global.document?.getElementById('inpWaAgentModel')?.value || 'gemini-2.5-flash').trim(),
      systemPrompt: String(global.document?.getElementById('txtWaAgentPrompt')?.value || ''),
      handoffMessage: String(global.document?.getElementById('inpWaAgentHandoffMsg')?.value || ''),
      debounceSeconds: Number(global.document?.getElementById('inpWaAgentDebounce')?.value ?? 6),
      allowedTools,
      budgetConvTokens: Number(global.document?.getElementById('inpWaAgentBudgetConv')?.value ?? 12000),
      budgetDailyTokens: Number(global.document?.getElementById('inpWaAgentBudgetDay')?.value ?? 500000)
    };

    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/agente/config/${encodeURIComponent(_selectedConfigKey)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        12000
      );
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && data.ok) {
        _configsByKey[_selectedConfigKey] = data.config;
        _renderConfigForm(_selectedConfigKey);
        _toast('💾 Configuración del AI Worker guardada.', 'success');
      } else {
        _toast('⚠️ No se pudo guardar la configuración del rol.', 'warning');
      }
    } catch (_) {
      _toast('⚠️ Error de red guardando configuración.', 'warning');
    }
  }

  function reiniciarSimuladorAgenteWa() {
    _simSessionId = '';
    _simMessages = [];
    _lastSimResult = null;
    _renderSimChat();
    _renderSimInspector(null);
    _toast('🔄 Sesión de prueba reiniciada.', 'info');
  }

  async function enviarMensajeSimuladorAgenteWa() {
    const inp = global.document?.getElementById('inpWaAgentSimMsg');
    const roleSel = global.document?.getElementById('selWaAgentSimRole');
    const btn = global.document?.getElementById('btnWaAgentSimSend');
    const msg = String(inp?.value || '').trim();
    const role = String(roleSel?.value || 'inbound_prestamos');
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!msg || !apiBase || !fetchFn) return;

    _simMessages.push({ fromMe: false, text: msg });
    if (inp) inp.value = '';
    _renderSimChat();
    if (btn) btn.disabled = true;

    try {
      const resp = await fetchFn(
        `${apiBase}/api/admin/whatsapp/agente/simular`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerRole: role,
            message: msg,
            simSessionId: _simSessionId || null,
            reset: !_simSessionId
          })
        },
        20000
      );
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && data.ok) {
        _simSessionId = data.simSessionId || _simSessionId;
        _lastSimResult = data;
        if (data.reply) _simMessages.push({ fromMe: true, text: data.reply });
        else if (data.skipped) _simMessages.push({ fromMe: true, text: `[Sin respuesta automática: ${data.skipReason}]` });
        _renderSimChat();
        _renderSimInspector(data);
        // Refrescar KPIs de presupuesto
        const rBud = await fetchFn(`${apiBase}/api/admin/whatsapp/agente/presupuesto`, { method: 'GET' }, 8000);
        if (rBud && rBud.ok) {
          const b = await rBud.json().catch(() => null);
          if (b && b.ok) _renderBudgetKpis(b);
        }
      } else {
        _toast('⚠️ Error ejecutando simulación del agente.', 'warning');
      }
    } catch (_) {
      _toast('⚠️ Error de red en el Simulador de Agente.', 'warning');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function cargarEjemploSimuladorWa(texto) {
    const inp = global.document?.getElementById('inpWaAgentSimMsg');
    if (inp) {
      inp.value = texto;
      inp.focus();
    }
  }

  const api = {
    WORKER_ROLE_LABELS,
    cargarPanelAgenteWa,
    seleccionarRolConfigAgenteWa,
    guardarConfigAgenteWa,
    reiniciarSimuladorAgenteWa,
    enviarMensajeSimuladorAgenteWa,
    cargarEjemploSimuladorWa
  };

  global.WaAgentUI = api;
  global.cargarPanelAgenteWa = cargarPanelAgenteWa;
  global.seleccionarRolConfigAgenteWa = seleccionarRolConfigAgenteWa;
  global.guardarConfigAgenteWa = guardarConfigAgenteWa;
  global.reiniciarSimuladorAgenteWa = reiniciarSimuladorAgenteWa;
  global.enviarMensajeSimuladorAgenteWa = enviarMensajeSimuladorAgenteWa;
  global.cargarEjemploSimuladorWa = cargarEjemploSimuladorWa;
})(typeof window !== 'undefined' ? window : globalThis);
