/* ============================================================================
 * AMMER - Módulo Fase W4: Dashboard de Métricas Operativas,
 *         Skeletons, Empty States Accionables y Pulido fintech-vanilla-ui
 * ============================================================================ */
(function (global) {
  'use strict';

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

  function _renderSkeletons() {
    const kpis = global.document?.getElementById('waMetricsKpisGrid');
    const body = global.document?.getElementById('waMetricsBodyGrid');
    if (kpis) {
      kpis.innerHTML =
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:48px;"></div></div>' +
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:48px;"></div></div>' +
        '<div class="wa-agent-kpi-card"><div class="ui-skeleton" style="height:48px;"></div></div>';
    }
    if (body) {
      body.innerHTML =
        '<div class="wa-360-card"><div class="ui-skeleton" style="height:170px;"></div></div>' +
        '<div class="wa-360-card"><div class="ui-skeleton" style="height:170px;"></div></div>';
    }
  }

  function _renderMetrics(data) {
    const kpis = global.document?.getElementById('waMetricsKpisGrid');
    const body = global.document?.getElementById('waMetricsBodyGrid');
    if (!kpis || !body) return;

    if (!data || Number(data.leadsTotales || 0) === 0) {
      kpis.innerHTML = '';
      body.innerHTML =
        '<div class="wa-360-empty" style="grid-column:1/-1;padding:1.75rem 1.25rem;">' +
          '<div style="font-size:1.6rem;margin-bottom:6px;">📈</div>' +
          '<div style="font-size:0.9rem;font-weight:800;color:#0f2744;">Todavía no hay conversaciones en este rango</div>' +
          '<div style="font-size:0.76rem;color:#64748b;margin-top:4px;max-width:460px;margin-inline:auto;line-height:1.45;">' +
            'Iniciá un chat en Mensajería Directa, probá el Simulador de Agente o ajustá las fechas arriba para visualizar las métricas de conversión.' +
          '</div>' +
          '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;">' +
            '<button type="button" class="wa-360-btn primary" onclick="window.cambiarTabWhatsappBotAdmin(\'mensajeria\', true)">💬 Ir a Mensajería</button>' +
            '<button type="button" class="wa-360-btn" onclick="window.cambiarTabWhatsappBotAdmin(\'agente\', true)">🧪 Ir al Simulador</button>' +
          '</div>' +
        '</div>';
      return;
    }

    const s24 = data.sesiones24h || {};
    kpis.innerHTML =
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">Leads Únicos / Totales</span>` +
        `<span class="wa-agent-kpi-value tabular-nums">${_esc(data.leadsUnicos)} <span style="font-size:0.75rem;color:#64748b;font-weight:700;">/ ${_esc(data.leadsTotales)} chats</span></span>` +
        `<span style="font-size:0.7rem;color:#475569;">Calificados: <strong class="tabular-nums">${_esc(data.calificados)}</strong> · Cerrados: <strong class="tabular-nums">${_esc(data.cerrados)}</strong></span>` +
      `</div>` +
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">Ventanas 24h Meta / WA</span>` +
        `<span class="wa-agent-kpi-value tabular-nums" style="color:#15803d;">${_esc(s24.abiertas || 0)} abiertas</span>` +
        `<span style="font-size:0.7rem;color:${(s24.porVencer || 0) > 0 ? '#b45309' : '#64748b'};font-weight:700;">⏳ Por vencer (&le;4h): <span class="tabular-nums">${_esc(s24.porVencer || 0)}</span> · Cerradas: <span class="tabular-nums">${_esc(s24.cerradas || 0)}</span></span>` +
      `</div>` +
      `<div class="wa-agent-kpi-card">` +
        `<span class="wa-agent-kpi-label">Resolución Bot vs Handoff</span>` +
        `<span class="wa-agent-kpi-value tabular-nums">${_esc(data.resueltosBotPct || 0)}% <span style="font-size:0.74rem;color:#64748b;font-weight:700;">autónomo</span></span>` +
        `<span style="font-size:0.7rem;color:#475569;">🙋 Escalados: <strong class="tabular-nums">${_esc(data.escalados)}</strong> · 📣 Recuperados: <strong class="tabular-nums">${_esc(data.recuperados)}</strong></span>` +
      `</div>`;

    const stages = Array.isArray(data.porEtapa) ? data.porEtapa : [];
    const funnelHtml = stages.map((st) =>
      `<div style="display:flex;flex-direction:column;gap:3px;">` +
        `<div style="display:flex;justify-content:space-between;font-size:0.73rem;">` +
          `<span style="font-weight:700;color:#0f172a;">${_esc(st.label)}</span>` +
          `<span class="tabular-nums" style="font-weight:800;color:#0f2744;">${_esc(st.count)} (${_esc(st.pct)}%)</span>` +
        `</div>` +
        `<div class="wa-agent-progress"><div class="wa-agent-progress-fill" style="width:${Math.min(100, Number(st.pct || 0))}%;background:#0f2744;"></div></div>` +
      `</div>`
    ).join('');

    const advisors = Array.isArray(data.porAsesor) ? data.porAsesor : [];
    const advisorsHtml = advisors.length === 0
      ? '<div style="font-size:0.73rem;color:#64748b;">Todavía no hay conversaciones asignadas a asesores.</div>'
      : advisors.map((a) =>
          `<div class="wa-360-doc-item">` +
            `<span style="font-size:0.74rem;font-weight:800;color:#0f2744;">👤 ${_esc(a.advisor)}</span>` +
            `<span class="tabular-nums" style="font-size:0.71rem;color:#475569;">Total: <strong>${_esc(a.total)}</strong> · Escalados: <strong>${_esc(a.escalados)}</strong> · Cerrados: <strong>${_esc(a.cerrados)}</strong></span>` +
          `</div>`
        ).join('');

    const channels = Array.isArray(data.porCanal) ? data.porCanal : [];
    const channelsHtml = channels.map((ch) =>
      `<div class="wa-360-doc-item">` +
        `<span style="font-size:0.74rem;font-weight:800;color:#0f2744;">${ch.provider === 'meta_cloud_api' ? '☁️ API Oficial Meta' : '📱 Línea QR (Baileys)'}</span>` +
        `<span class="tabular-nums" style="font-size:0.71rem;color:#475569;">${_esc(ch.total)} chats (${_esc(ch.abiertas24h)} en 24h)</span>` +
      `</div>`
    ).join('');

    body.innerHTML =
      `<div class="wa-360-card" style="gap:8px;">` +
        `<span class="wa-360-label">Embudo de Conversión (8 Etapas)</span>` +
        funnelHtml +
      `</div>` +
      `<div style="display:flex;flex-direction:column;gap:10px;">` +
        `<div class="wa-360-card">` +
          `<span class="wa-360-label">Desempeño por Asesor</span>` +
          advisorsHtml +
        `</div>` +
        `<div class="wa-360-card">` +
          `<span class="wa-360-label">Volumen por Canal</span>` +
          channelsHtml +
        `</div>` +
      `</div>`;
  }

  async function cargarPanelMetricasWa() {
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    _renderSkeletons();

    const desde = String(global.document?.getElementById('inpWaMetDesde')?.value || '').trim();
    const hasta = String(global.document?.getElementById('inpWaMetHasta')?.value || '').trim();
    const qs = new URLSearchParams();
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);

    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/metricas?${qs.toString()}`, { method: 'GET' }, 12000);
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && data.ok) {
        _renderMetrics(data);
      } else {
        _renderMetrics(null);
      }
    } catch (_) {
      _toast('⚠️ No se pudieron cargar las métricas de WhatsApp.', 'warning');
      _renderMetrics(null);
    }
  }

  const api = {
    cargarPanelMetricasWa
  };

  global.WaMetricsUI = api;
  global.cargarPanelMetricasWa = cargarPanelMetricasWa;
})(typeof window !== 'undefined' ? window : globalThis);
