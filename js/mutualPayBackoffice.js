// ============================================================================
// MÓDULO ADMIN: BACKOFFICE UNIFICADO "MUTUAL PAY" & CRUCE CON CORE AMMER
// Exclusivo rol Admin en Simulador-Office. Toda operación pasa por
// ammer-auditor-api (/api/mutual-pay/*) con Bearer token HMAC-SHA256.
// ============================================================================
(function (global) {
  'use strict';

  const st = {
    initialized: false,
    tabActiva: 'resumen',
    loading: false,
    estadoS2S: null,
    resumen: null,
    asociados: [],
    asociadoSeleccionadoId: null,
    fichaUnificada: null,
    ayudas: [],
    comercios: [],
    liquidaciones: [],
    payoutHistorial: [],
    transacciones: [],
    cobranzas: [],
    convenios: [],
    reglasFinancieras: [],
    economiaCircular: null,
    cashbackRules: [],
    auditLogs: [],
    accesos: null,
    accesosError: null,
    ultimaCredencial: null,
    lastSyncAt: 0,
    formNuevoComercioAbierto: false,
    formNuevoAsociadoAbierto: false,
    ammerBusquedaResultados: [],
  };

  function getApiBase() {
    if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
      return RENDER_API_URL.replace(/\/$/, '');
    }
    return 'https://ammer-auditor-api.onrender.com';
  }

  function esc(v) {
    const raw = String(v == null ? '' : v);
    if (typeof sanitizeHTML === 'function') {
      return String(sanitizeHTML(raw)).replace(/'/g, '&#39;');
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(u) {
    const s = String(u || '').trim();
    return /^https:\/\//i.test(s) ? esc(s) : '';
  }

  function fmtArsFromMinor(minor) {
    const num = Number(minor || 0) / 100;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  }

  function fmtArs(pesos) {
    const num = Number(pesos || 0);
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  }

  function fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
  }

  function setNotice(htmlMsg, tone = 'info') {
    const box = document.getElementById('mpHubNotice');
    if (!box) return;
    if (!htmlMsg) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const styles = {
      info: 'background:#eff6ff;border-color:#93c5fd;color:#1e3a8a;',
      warn: 'background:#fffbeb;border-color:#fcd34d;color:#92400e;',
      err: 'background:#fff1f2;border-color:#fda4af;color:#9f1239;',
      ok: 'background:#ecfdf5;border-color:#6ee7b7;color:#065f46;',
    };
    box.setAttribute('style', 'display:block;padding:0.85rem 1.05rem;border-radius:12px;border:1px solid;font-size:0.8rem;line-height:1.5;' + (styles[tone] || styles.info));
    box.innerHTML = htmlMsg;
  }

  async function apiMp(path, opts = {}) {
    const url = `${getApiBase()}/api/mutual-pay${path}`;
    const headers = Object.assign({}, opts.headers || {});
    if (opts.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const reqOpts = Object.assign({}, opts, { headers });
    const resp = typeof fetchConTimeout === 'function'
      ? await fetchConTimeout(url, reqOpts, 40000)
      : await fetch(url, reqOpts);

    if (opts.rawResponse) return resp;

    let data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = null;
    }
    if (!resp.ok) {
      const detailObj = data && data.detail ? data.detail : null;
      const err = new Error(
        (detailObj && typeof detailObj === 'object' ? detailObj.detail : detailObj) ||
        (data && data.message) ||
        `Error HTTP ${resp.status}`
      );
      err.status = resp.status;
      err.code = detailObj && typeof detailObj === 'object' ? detailObj.code : null;
      throw err;
    }
    return data;
  }

  function badgeStatus(statusRaw) {
    const up = String(statusRaw || '').toUpperCase();
    if (['APPROVED', 'AUTHORIZED', 'VERIFIED', 'APTO', 'FIRMADO', 'ACTIVO', 'TRUE'].includes(up)) {
      return `<span class="mp-badge mp-badge-ok">${esc(up)}</span>`;
    }
    if (['UNDER_REVIEW', 'SUBMITTED', 'UNDER_EVALUATION', 'IN_ANALYSIS', 'PROOF_UPLOADED', 'PENDING_DOCUMENTATION', 'OBSERVADO', 'DATA_PROVIDED'].includes(up)) {
      return `<span class="mp-badge mp-badge-warn">${esc(up)}</span>`;
    }
    if (['REJECTED', 'CANCELLED', 'RECHAZADO', 'VENCIDO', 'FALSE'].includes(up)) {
      return `<span class="mp-badge mp-badge-err">${esc(up)}</span>`;
    }
    return `<span class="mp-badge mp-badge-neutral">${esc(up || 'N/D')}</span>`;
  }

  function badgeAmmerCruce(cruce) {
    if (!cruce || !cruce.en_padron_ammer) {
      return '<span class="mp-badge mp-badge-neutral">Solo en App</span>';
    }
    const asoc = cruce.asociado || {};
    const est = String(asoc.perfil_validacion_estado || 'PENDIENTE').toUpperCase();
    const cls = est === 'APTO' ? 'mp-badge-ok' : (est === 'RECHAZADO' ? 'mp-badge-err' : 'mp-badge-info');
    return `<span class="mp-badge ${cls}">AMMER: ${esc(est)} (${Number(cruce.solicitudes_count || 0)} sol.)</span>`;
  }

  function actualizarBadgeSidebar(totalPendientes) {
    const b = document.getElementById('navMutualPayPendingBadge');
    if (!b) return;
    const n = Number(totalPendientes || 0);
    if (n > 0) {
      b.style.display = 'inline-flex';
      b.textContent = n > 99 ? '99+' : String(n);
    } else {
      b.style.display = 'none';
      b.textContent = '';
    }
  }

  function setBadgeTab(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Number(count || 0);
    if (n > 0) {
      el.style.display = 'inline-flex';
      el.textContent = String(n);
    } else {
      el.style.display = 'none';
    }
  }

  function esperarMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function verificarEstadoMutualPay(mostrarToast = false) {
    try {
      const qs = mostrarToast ? '?force=true' : '';
      const info = await apiMp(`/estado${qs}`);
      st.estadoS2S = info;
      if (!info.s2s_configured) {
        setNotice(
          `<strong>Puente S2S pendiente de activación:</strong> ` +
          `<code>MUTUALPAY_S2S_SECRET</code> aún no está configurado en <strong>ammer-auditor-api</strong> (Render). ` +
          `API destino: <code>${esc(info.api_url)}</code> (${info.api_online ? 'Online' : esc(info.api_detail)}). ` +
          `Core AMMER Supabase: ${info.ammer_core_supabase_ready ? 'Listo' : 'No inicializado'}.`,
          'warn'
        );
      } else if (!info.api_online) {
        if (Number(info.api_status_code) === 429 || info.rate_limited) {
          setNotice(
            `<strong>Mutual Pay API limitada temporalmente por Render (HTTP 429):</strong> El proxy de <code>${esc(info.health_url)}</code> (plan Free de Render) frenó una ráfaga de consultas. ` +
            `Esperá 15–30 segundos y pulsá <strong>🔄 Actualizar Datos</strong>.`,
            'warn'
          );
        } else {
          setNotice(
            `<strong>Mutual Pay API sin respuesta en /health:</strong> ${esc(info.api_detail)} (${esc(info.health_url)}). ` +
            `Si está en plan Free de Render puede estar despertando; reintentá en unos segundos.`,
            'warn'
          );
        }
      } else {
        if (mostrarToast) {
          setNotice(
            `✅ Conexión S2S verificada: <code>${esc(info.api_url)}</code> Online · Core AMMER listo para cruce por DNI.`,
            'ok'
          );
        } else {
          setNotice(null);
        }
      }
      if (mostrarToast) toast('Estado S2S de Mutual Pay actualizado.');
      return info;
    } catch (err) {
      setNotice(`No se pudo consultar el estado de Mutual Pay: ${esc(err.message)}`, 'err');
      return null;
    }
  }

  const loadedTabs = { comercios: false, admin: false };

  async function cargarExtrasTabMutualPay(tabId, force = false) {
    if (tabId === 'comercios' && (!loadedTabs.comercios || force)) {
      loadedTabs.comercios = true;
      const [liqRes, histRes, txRes] = await Promise.allSettled([
        apiMp('/liquidaciones/resumen'),
        apiMp('/liquidaciones/historial'),
        apiMp('/transacciones'),
      ]);
      if (liqRes.status === 'fulfilled') st.liquidaciones = liqRes.value.liquidaciones || [];
      if (histRes.status === 'fulfilled') st.payoutHistorial = histRes.value.payouts || [];
      if (txRes.status === 'fulfilled') st.transacciones = txRes.value.transacciones || [];
      renderTablaLiquidacionesMutualPay();
      renderTablaTransaccionesMutualPay();
    } else if (tabId === 'admin' && (!loadedTabs.admin || force)) {
      loadedTabs.admin = true;
      const [regRes, cbRes, logRes] = await Promise.allSettled([
        apiMp('/admin/reglas-financieras'),
        apiMp('/backoffice/cashback-rules'),
        apiMp('/admin/audit-logs'),
      ]);
      if (regRes.status === 'fulfilled') st.reglasFinancieras = regRes.value.reglas || [];
      if (cbRes.status === 'fulfilled') st.cashbackRules = cbRes.value.reglas || [];
      if (logRes.status === 'fulfilled') st.auditLogs = logRes.value.logs || [];
      renderTabAdminCircular();
    }
  }

  function cambiarTabMutualPay(tabId) {
    st.tabActiva = tabId;
    const tabs = ['resumen', 'asociados', 'ayudas', 'comercios', 'cobranzas', 'admin', 'accesos'];
    tabs.forEach((t) => {
      const btn = document.getElementById(`btnMpTab_${t}`);
      const panel = document.getElementById(`mpPanel_${t}`);
      if (btn) btn.classList.toggle('active', t === tabId);
      if (panel) panel.classList.toggle('active', t === tabId);
    });
    if (tabId === 'comercios' || tabId === 'admin') {
      cargarExtrasTabMutualPay(tabId, false);
    }
  }

  async function cargarTodoMutualPayBackoffice(forceToast = false) {
    if (st.loading) return;
    st.loading = true;
    const btn = document.getElementById('btnMpRefreshAll');
    if (btn) btn.disabled = true;

    try {
      const [estadoRes, resumenRes, accRes, comRes] = await Promise.allSettled([
        verificarEstadoMutualPay(false),
        apiMp('/resumen'),
        apiMp('/admin/accesos'),
        apiMp('/comercios'),
      ]);

      const estado = estadoRes.status === 'fulfilled' ? estadoRes.value : null;
      if (estado && !estado.s2s_configured) {
        renderResumenVacio();
        return;
      }

      const fatalErr = [resumenRes, accRes, comRes].find(
        (r) =>
          r.status === 'rejected' &&
          r.reason &&
          (r.reason.code === 'MUTUALPAY_S2S_NOT_CONFIGURED' ||
            r.reason.code === 'MUTUALPAY_S2S_REJECTED' ||
            r.reason.code === 'MUTUALPAY_RATE_LIMITED' ||
            Number(r.reason.status) === 429)
      );
      if (fatalErr) {
        setNotice(`<strong>Atención Mutual Pay:</strong> ${esc(fatalErr.reason.message)}`, 'warn');
        if (fatalErr.reason.code !== 'MUTUALPAY_RATE_LIMITED' && Number(fatalErr.reason.status) !== 429) {
          renderResumenVacio();
        }
        return;
      }

      if (resumenRes.status === 'fulfilled') {
        const resVal = resumenRes.value || {};
        st.resumen = resVal;
        if (Array.isArray(resVal.asociados)) st.asociados = resVal.asociados;
        if (Array.isArray(resVal.ayudas)) st.ayudas = resVal.ayudas;
        if (Array.isArray(resVal.cobranzas)) st.cobranzas = resVal.cobranzas;
        if (Array.isArray(resVal.convenios)) st.convenios = resVal.convenios;
      }
      if (comRes.status === 'fulfilled') st.comercios = comRes.value.comercios || [];
      if (accRes.status === 'fulfilled') {
        st.accesos = accRes.value || null;
        st.accesosError = null;
      } else if (accRes.status === 'rejected') {
        st.accesosError = (accRes.reason && accRes.reason.message) || 'Error consultando padrón de accesos';
      }

      loadedTabs.comercios = false;
      loadedTabs.admin = false;
      st.lastSyncAt = Date.now();
      renderAllMutualPay();
      if (st.tabActiva === 'comercios' || st.tabActiva === 'admin') {
        await cargarExtrasTabMutualPay(st.tabActiva, true);
      }

      const lbl = document.getElementById('mpHubLastSyncLabel');
      if (lbl) lbl.textContent = `Última sincronización: ${new Date().toLocaleTimeString('es-AR')}`;
      if (forceToast) toast('Mutual Pay sincronizado con Core AMMER.');
    } catch (err) {
      setNotice(`Error cargando datos de Mutual Pay: ${esc(err.message)}`, 'err');
    } finally {
      st.loading = false;
      if (btn) btn.disabled = false;
    }
  }

  function renderResumenVacio() {
    const kpiCards = document.getElementById('mpResumenKpiCards');
    const cruceBox = document.getElementById('mpResumenCruceContainer');
    if (kpiCards) kpiCards.innerHTML = '';
    if (cruceBox) {
      cruceBox.innerHTML =
        '<div style="padding:1.5rem;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#475569;font-size:0.82rem;">' +
        '<strong>Puente S2S en espera de credenciales:</strong> Cuando <code>MUTUALPAY_S2S_SECRET</code> esté habilitado en <code>ammer-auditor-api</code> y <code>mutualpay-api</code>, verás aquí todos los asociados, KYC, ayudas, comercios y liquidaciones cruzadas con el Core AMMER.' +
        '</div>';
    }
  }

  function renderAllMutualPay() {
    const c = (st.resumen && st.resumen.contadores) || {};
    const ov = (st.resumen && st.resumen.overview) || {};
    const circ = (st.resumen && st.resumen.circular_economy) || {};

    actualizarBadgeSidebar(c.total_pendientes || 0);
    setBadgeTab('mpBadgeTabKyc', (c.kyc_pendientes || 0) + (c.convenios_pendientes || 0));
    setBadgeTab('mpBadgeTabAyudas', c.ayudas_pendientes || 0);
    setBadgeTab('mpBadgeTabCobranzas', c.cobranzas_pendientes || 0);

    const heroKpis = document.getElementById('mpHubKpis');
    if (heroKpis) {
      heroKpis.innerHTML =
        `<span class="mp-hub-kpi-pill">👥 Asociados App: <strong>${Number(c.asociados_total ?? ov.associates_count ?? 0)}</strong></span>` +
        `<span class="mp-hub-kpi-pill">🔗 Cruzados AMMER: <strong>${Number(c.asociados_en_ammer || 0)}</strong></span>` +
        `<span class="mp-hub-kpi-pill">🪪 KYC Pendientes: <strong>${Number(c.kyc_pendientes || 0)}</strong></span>` +
        `<span class="mp-hub-kpi-pill">🏪 Comercios Activos: <strong>${Number(ov.active_merchants_count || st.comercios.length || 0)}</strong></span>` +
        `<span class="mp-hub-kpi-pill">♻️ Retención Circular: <strong>${Number(circ.circular_retention_index_pct || 0)}%</strong></span>`;
    }

    const cards = document.getElementById('mpResumenKpiCards');
    if (cards) {
      cards.innerHTML =
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Crédito Otorgado</div><div class="mp-kpi-val">${fmtArsFromMinor(ov.total_credit_granted_minor || 0)}</div><div class="mp-kpi-sub">Líneas Comercios + Efectivo</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Saldo en la Calle</div><div class="mp-kpi-val">${fmtArsFromMinor(ov.balance_in_street_minor || 0)}</div><div class="mp-kpi-sub">Mora declarada: ${Number(ov.default_rate_pct || 0)}%</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Volumen QR Mensual</div><div class="mp-kpi-val">${fmtArsFromMinor(ov.monthly_qr_volume_minor || 0)}</div><div class="mp-kpi-sub">Operaciones autorizadas</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Pendientes Asesoría</div><div class="mp-kpi-val">${Number(c.total_pendientes || 0)}</div><div class="mp-kpi-sub">KYC: ${c.kyc_pendientes || 0} · Ayudas: ${c.ayudas_pendientes || 0} · Cobranzas: ${c.cobranzas_pendientes || 0}</div></div>`;
    }

    renderResumenCruce();
    renderTablaAsociadosMutualPay();
    renderTablaConveniosMutualPay();
    renderTablaAyudasMutualPay();
    renderTablaLiquidacionesMutualPay();
    renderTablaComerciosMutualPay();
    renderTablaTransaccionesMutualPay();
    renderTablaCobranzasMutualPay();
    renderTabAdminCircular();
    renderTabAccesosMutualPay();
  }

  function renderResumenCruce() {
    const box = document.getElementById('mpResumenCruceContainer');
    if (!box) return;
    const q = String((document.getElementById('inpMpResumenBuscar') || {}).value || '').trim().toLowerCase();
    const list = st.asociados.filter((a) => {
      if (!q) return true;
      const hay = `${a.first_name || ''} ${a.last_name || ''} ${a.dni || ''} ${a.cuit_cuil || ''} ${a.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
    if (!list.length) {
      box.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.82rem;">No se encontraron asociados con ese criterio.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Asociado (Mutual Pay)</th><th>DNI / CUIL</th><th>KYC App</th><th>Sueldo Neto App</th><th>Cruce Core AMMER</th><th>Disponible AMMER</th><th>Acción</th>' +
      '</tr></thead><tbody>';
    list.slice(0, 60).forEach((a) => {
      const cr = a.ammer_cruce || {};
      const asocA = cr.asociado || {};
      const disp = asocA.ultimo_disponible != null ? fmtArs(asocA.ultimo_disponible) : '—';
      html += `<tr>
        <td><strong>${esc(`${a.first_name || ''} ${a.last_name || ''}`.trim())}</strong><div style="font-size:0.7rem;color:#64748b;">${esc(a.email || '')}</div></td>
        <td><code>${esc(a.dni || '—')}</code><div style="font-size:0.68rem;color:#94a3b8;">${esc(a.cuit_cuil || '')}</div></td>
        <td>${badgeStatus(a.kyc_status)}</td>
        <td>${fmtArsFromMinor(a.net_salary_cents || 0)}</td>
        <td>${badgeAmmerCruce(cr)}</td>
        <td><strong>${disp}</strong></td>
        <td><button type="button" class="mp-btn mp-btn-primary" data-mp-action="ver-ficha" data-id="${esc(a.id)}" data-switch="1">Ver Ficha 360°</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function buscarAsociadosMutualPay() {
    const q = String((document.getElementById('inpMpResumenBuscar') || {}).value || '').trim();
    try {
      const res = await apiMp(`/asociados?q=${encodeURIComponent(q)}`);
      st.asociados = res.asociados || [];
      renderResumenCruce();
    } catch (err) {
      toast(`Error buscando asociados: ${err.message}`);
    }
  }

  function renderTablaAsociadosMutualPay() {
    const box = document.getElementById('mpAsociadosTablaContainer');
    if (!box) return;
    const q = String((document.getElementById('inpMpFiltroAsoc') || {}).value || '').trim().toLowerCase();
    const kyc = String((document.getElementById('selMpFiltroKyc') || {}).value || '').trim().toUpperCase();

    const filtered = st.asociados.filter((a) => {
      if (kyc && String(a.kyc_status || '').toUpperCase() !== kyc) return false;
      if (!q) return true;
      return `${a.first_name || ''} ${a.last_name || ''} ${a.dni || ''} ${a.email || ''}`.toLowerCase().includes(q);
    });

    if (!filtered.length) {
      box.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.8rem;">Sin asociados para los filtros seleccionados.</div>';
      return;
    }

    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Asociado</th><th>DNI</th><th>KYC</th><th>Cruce AMMER</th><th></th>' +
      '</tr></thead><tbody>';
    filtered.forEach((a) => {
      const sel = st.asociadoSeleccionadoId === a.id ? 'background:#eff6ff;' : '';
      html += `<tr style="${sel}">
        <td><strong>${esc(`${a.first_name || ''} ${a.last_name || ''}`.trim())}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(a.employment_condition || '')} · ${fmtArsFromMinor(a.net_salary_cents || 0)}</div></td>
        <td><code>${esc(a.dni || '—')}</code></td>
        <td>${badgeStatus(a.kyc_status)}</td>
        <td>${badgeAmmerCruce(a.ammer_cruce)}</td>
        <td style="text-align:right;"><button type="button" class="mp-btn" data-mp-action="ver-ficha" data-id="${esc(a.id)}" data-switch="0">Revisar</button></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function abrirFichaUnificadaMp(associateId, switchToTab = false) {
    st.asociadoSeleccionadoId = associateId;
    if (switchToTab) cambiarTabMutualPay('asociados');
    renderTablaAsociadosMutualPay();

    const panel = document.getElementById('mpAsociadoDetallePanel');
    if (panel) {
      panel.innerHTML = '<div style="padding:2rem;text-align:center;color:#64748b;font-size:0.82rem;">Cargando ficha unificada Mutual Pay + AMMER Core...</div>';
    }

    try {
      const data = await apiMp(`/asociados/${encodeURIComponent(associateId)}/ficha`);
      st.fichaUnificada = data;
      renderPanelDetalleAsociadoMp();
    } catch (err) {
      if (panel) {
        panel.innerHTML = `<div style="padding:1.2rem;color:#9f1239;background:#fff1f2;border-radius:10px;font-size:0.8rem;">Error cargando ficha: ${esc(err.message)}</div>`;
      }
    }
  }

  function renderPanelDetalleAsociadoMp() {
    const panel = document.getElementById('mpAsociadoDetallePanel');
    const data = st.fichaUnificada;
    if (!panel || !data) return;

    const mp = data.mutual_pay || {};
    const assoc = mp.associate || st.asociados.find((x) => x.id === st.asociadoSeleccionadoId) || {};
    const lines = mp.credit_lines || assoc.credit_lines || [];
    const docs = mp.documents || assoc.documents || [];
    const ammer = data.ammer_core || {};
    const ammerAsoc = ammer.asociado || (data.ammer_cruce && data.ammer_cruce.asociado) || null;

    const netSalaryPesos = Number(assoc.net_salary_cents || 0) / 100;
    const ratio = String(assoc.employment_condition || 'ACTIVO').toUpperCase() === 'ACTIVO' ? 0.35 : 0.20;
    const sugTotal = Math.round(netSalaryPesos * ratio * 6);
    const lineMerch = lines.find((l) => l.line_type === 'MERCHANT_PURCHASE');
    const lineCash = lines.find((l) => l.line_type === 'CASH_LOAN');
    const merchPesos = lineMerch ? Math.round(Number(lineMerch.total_credit_limit_minor || 0) / 100) : Math.round(sugTotal * 0.6);
    const cashPesos = lineCash ? Math.round(Number(lineCash.total_credit_limit_minor || 0) / 100) : Math.round(sugTotal * 0.4);
    const fullName = `${assoc.first_name || ''} ${assoc.last_name || ''}`.trim();

    let docsHtml = '';
    if (!docs.length) {
      docsHtml = '<div style="font-size:0.76rem;color:#64748b;">Sin documentos KYC adjuntos en Mutual Pay.</div>';
    } else {
      docsHtml = '<div style="display:flex;flex-direction:column;gap:6px;">';
      docs.forEach((d) => {
        const sUrl = safeUrl(d.signed_url);
        const docType = String(d.doc_type || 'OTHER').toUpperCase();
        const canAuditIa = ['DNI_FRONT', 'DNI_BACK', 'SALARY_RECEIPT'].includes(docType) && Boolean(sUrl);
        docsHtml += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0.45rem 0.65rem;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;flex-wrap:wrap;">
          <span style="font-size:0.75rem;font-weight:700;">📄 ${esc(docType)}</span>
          <div style="display:flex;gap:5px;">
            ${sUrl ? `<a href="${sUrl}" target="_blank" rel="noopener noreferrer" class="mp-btn">👁️ Ver</a>` : '<span style="font-size:0.7rem;color:#94a3b8;">Sin URL</span>'}
            ${canAuditIa ? `<button type="button" class="mp-btn mp-btn-indigo" data-mp-action="auditar-doc" data-assoc-id="${esc(assoc.id)}" data-doc-type="${esc(docType)}" data-signed-url="${sUrl}" data-dni="${esc(assoc.dni || '')}" data-nombre="${esc(fullName)}">🤖 Auditar IA AMMER</button>` : ''}
          </div>
        </div>`;
      });
      docsHtml += '</div>';
    }

    let ammerHtml = '<div style="padding:0.7rem;border-radius:10px;background:#f8fafc;border:1px dashed #cbd5e1;font-size:0.76rem;color:#64748b;">Sin legajo previo en Core AMMER para este DNI.</div>';
    if (ammerAsoc) {
      const driveLink = safeUrl(ammerAsoc.drive_folder_url);
      ammerHtml = `<div style="padding:0.75rem;border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;font-size:0.76rem;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <strong>🏛️ Antecedentes Core AMMER</strong>
          ${badgeStatus(ammerAsoc.perfil_validacion_estado || 'PENDIENTE')}
        </div>
        <div>Organismo: <strong>${esc(ammerAsoc.organismo || 'N/D')}</strong> · Disponible: <strong>${ammerAsoc.ultimo_disponible != null ? fmtArs(ammerAsoc.ultimo_disponible) : 'N/D'}</strong></div>
        <div>DNI: ${badgeStatus(ammerAsoc.dni_estado)} · Domicilio: ${badgeStatus(ammerAsoc.servicio_estado)} · Boletín ER: ${badgeStatus(ammerAsoc.boletin_estado)} (${Number(ammerAsoc.boletin_menciones_count || 0)} menc.)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
          ${driveLink ? `<a href="${driveLink}" target="_blank" rel="noopener noreferrer" class="mp-btn">📁 Carpeta Drive</a>` : ''}
          <button type="button" class="mp-btn" data-mp-action="auditar-doc" data-assoc-id="${esc(assoc.id)}" data-doc-type="BOLETIN_ER" data-signed-url="" data-dni="${esc(assoc.dni || '')}" data-nombre="${esc(fullName)}">📰 Consultar Boletín ER</button>
        </div>
      </div>`;
    } else if (assoc.dni) {
      ammerHtml += `<div style="margin-top:6px;"><button type="button" class="mp-btn" data-mp-action="auditar-doc" data-assoc-id="${esc(assoc.id)}" data-doc-type="BOLETIN_ER" data-signed-url="" data-dni="${esc(assoc.dni || '')}" data-nombre="${esc(fullName)}">📰 Verificar Boletín ER por DNI</button></div>`;
    }

    const isActiveAcc = assoc.is_active !== false;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;border-bottom:1px solid #e2e8f0;padding-bottom:0.75rem;margin-bottom:0.85rem;flex-wrap:wrap;">
        <div>
          <h4 style="margin:0;font-size:1rem;font-weight:800;color:#0f172a;">${esc(fullName || 'Asociado')}</h4>
          <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">DNI ${esc(assoc.dni || '—')} · CUIL ${esc(assoc.cuit_cuil || '—')} · ${esc(assoc.employment_condition || '')}</div>
          <div style="font-size:0.73rem;color:#64748b;">${esc(assoc.email || '')} · ${esc(assoc.phone || '')}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          ${badgeStatus(assoc.kyc_status)}
          <button type="button" class="mp-btn" data-mp-action="reset-asoc" data-id="${esc(assoc.id)}" data-pin="0">🔑 Blanquear Clave</button>
          <button type="button" class="mp-btn ${isActiveAcc ? 'mp-btn-danger' : 'mp-btn-success'}" data-mp-action="toggle-asoc" data-id="${esc(assoc.id)}" data-next-active="${isActiveAcc ? '0' : '1'}">${isActiveAcc ? 'Suspender' : 'Reactivar'}</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:0.8rem;">
        ${ammerHtml}

        <div>
          <div style="font-size:0.74rem;font-weight:800;color:#334155;margin-bottom:6px;text-transform:uppercase;">Documentación KYC en Mutual Pay</div>
          ${docsHtml}
          <div id="mpAuditIaResultBox" style="margin-top:8px;"></div>
        </div>

        <div style="padding:0.75rem;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
          <div style="font-size:0.74rem;font-weight:800;color:#334155;margin-bottom:6px;">LÍMITES DE CRÉDITO (Sueldo Neto App: ${fmtArs(netSalaryPesos)})</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
              <label style="display:block;font-size:0.7rem;font-weight:700;color:#475569;margin-bottom:3px;">Límite Comercios ($ ARS)</label>
              <input type="number" id="inpMpLimitMerch" value="${merchPesos}" min="0" style="width:100%;padding:0.4rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.8rem;"/>
            </div>
            <div>
              <label style="display:block;font-size:0.7rem;font-weight:700;color:#475569;margin-bottom:3px;">Límite Efectivo ($ ARS)</label>
              <input type="number" id="inpMpLimitCash" value="${cashPesos}" min="0" style="width:100%;padding:0.4rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.8rem;"/>
            </div>
          </div>
          <div style="margin-top:8px;">
            <label style="display:block;font-size:0.7rem;font-weight:700;color:#475569;margin-bottom:3px;">Observación / Motivo (rechazo o ajuste)</label>
            <input type="text" id="inpMpKycNotes" placeholder="Ej: Aprobado tras auditoría documental AMMER" style="width:100%;padding:0.4rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;"/>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <button type="button" class="mp-btn mp-btn-success" data-mp-action="resolver-kyc" data-id="${esc(assoc.id)}" data-status="APPROVED" data-salary="${Number(assoc.net_salary_cents || 0)}">✅ Aprobar KYC</button>
            <button type="button" class="mp-btn mp-btn-danger" data-mp-action="resolver-kyc" data-id="${esc(assoc.id)}" data-status="REJECTED" data-salary="${Number(assoc.net_salary_cents || 0)}">❌ Rechazar KYC</button>
            <button type="button" class="mp-btn mp-btn-primary" data-mp-action="ajustar-limites" data-id="${esc(assoc.id)}">💾 Guardar Ajuste Límites</button>
          </div>
        </div>
      </div>
    `;
  }

  async function auditarDocMutualPayConIA(associateId, docType, signedUrl, dni, nombre) {
    const out = document.getElementById('mpAuditIaResultBox');
    if (out) out.innerHTML = '<div style="padding:0.65rem;border-radius:8px;background:#eef2ff;color:#3730a3;font-size:0.76rem;">⏳ Ejecutando motor IA AMMER sobre documento de Mutual Pay...</div>';
    try {
      const res = await apiMp(`/kyc/${encodeURIComponent(associateId)}/auditar-ia`, {
        method: 'POST',
        body: JSON.stringify({ doc_type: docType, signed_url: signedUrl || null, dni: dni || null, nombre: nombre || null }),
      });
      const r = res.resultado || {};
      const dict = r.dictamen_final || (r.tiene_alerta_critica ? 'ALERTA CRÍTICA' : 'COMPLETADO');
      if (out) {
        out.innerHTML = `<div style="padding:0.7rem;border-radius:9px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:0.75rem;color:#065f46;">
          <strong>🤖 Resultado ${esc(res.tipo)}:</strong> ${esc(dict)} · Guardado en historial AMMER del asociado.
          ${r.sueldoLiquido != null ? `<div>Sueldo líquido detectado: <strong>${fmtArs(r.sueldoLiquido)}</strong></div>` : ''}
          ${r.mensaje ? `<div>${esc(r.mensaje)}</div>` : ''}
        </div>`;
      }
      toast(`Auditoría ${res.tipo} completada y vinculada al DNI.`);
    } catch (err) {
      if (out) {
        out.innerHTML = `<div style="padding:0.65rem;border-radius:8px;background:#fff1f2;color:#9f1239;font-size:0.76rem;">Error en auditoría IA: ${esc(err.message)}</div>`;
      }
    }
  }

  async function resolverKycMp(associateId, statusVal, netSalaryCents) {
    const merchPesos = Number((document.getElementById('inpMpLimitMerch') || {}).value || 0);
    const cashPesos = Number((document.getElementById('inpMpLimitCash') || {}).value || 0);
    const notes = String((document.getElementById('inpMpKycNotes') || {}).value || '').trim();
    const payload = {
      status: statusVal,
      net_salary_cents_verified: netSalaryCents,
      notes: notes || (statusVal === 'APPROVED' ? 'Aprobado desde Backoffice Admin AMMER' : 'Documentación rechazada por Administración'),
    };
    if (statusVal === 'APPROVED') {
      payload.merchant_limit_minor = Math.round(merchPesos * 100);
      payload.cash_limit_minor = Math.round(cashPesos * 100);
    }
    try {
      await apiMp(`/kyc/${encodeURIComponent(associateId)}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast(`KYC actualizado a ${statusVal}.`);
      await cargarTodoMutualPayBackoffice(false);
      await abrirFichaUnificadaMp(associateId, false);
    } catch (err) {
      toast(`Error al resolver KYC: ${err.message}`);
    }
  }

  async function ajustarLimitesMp(associateId) {
    const merchPesos = Number((document.getElementById('inpMpLimitMerch') || {}).value || 0);
    const cashPesos = Number((document.getElementById('inpMpLimitCash') || {}).value || 0);
    const notes = String((document.getElementById('inpMpKycNotes') || {}).value || '').trim() || 'Ajuste manual desde Backoffice Admin AMMER';
    try {
      await apiMp(`/asociados/${encodeURIComponent(associateId)}/limits`, {
        method: 'PATCH',
        body: JSON.stringify({
          merchant_limit_minor: Math.round(merchPesos * 100),
          cash_limit_minor: Math.round(cashPesos * 100),
          reason: notes,
        }),
      });
      toast('Límites actualizados en Mutual Pay.');
      await abrirFichaUnificadaMp(associateId, false);
    } catch (err) {
      toast(`Error ajustando límites: ${err.message}`);
    }
  }

  function abrirModalAccionMp({ title, description, label, placeholder, defaultValue = '', confirmLabel = 'Confirmar', confirmClass = 'mp-btn-primary', minLength = 0, checkboxLabel = '', checkboxDefaultChecked = false }) {
    return new Promise((resolve) => {
      const prev = document.getElementById('mpInlineActionModalOverlay');
      if (prev) prev.remove();

      const hasCheck = Boolean(checkboxLabel);
      const ov = document.createElement('div');
      ov.id = 'mpInlineActionModalOverlay';
      ov.setAttribute('style', 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;');
      ov.innerHTML = `
        <div style="width:100%;max-width:440px;background:#ffffff;border-radius:16px;padding:1.15rem 1.25rem;box-shadow:0 20px 50px rgba(15,23,42,0.28);border:1px solid #cbd5e1;">
          <h4 style="margin:0 0 6px;font-size:0.98rem;font-weight:800;color:#0f172a;">${esc(title || 'Confirmar acción')}</h4>
          ${description ? `<p style="margin:0 0 10px;font-size:0.78rem;color:#475569;line-height:1.45;">${esc(description)}</p>` : ''}
          <label style="display:block;font-size:0.72rem;font-weight:700;color:#334155;margin-bottom:4px;">${esc(label || 'Observación / Motivo')}</label>
          <textarea id="mpInlineModalInput" rows="3" placeholder="${esc(placeholder || '')}" style="width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border:1px solid #cbd5e1;border-radius:10px;font-size:0.8rem;resize:vertical;">${esc(defaultValue)}</textarea>
          ${hasCheck ? `<label style="display:flex;align-items:flex-start;gap:7px;margin-top:9px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:0.75rem;color:#1e293b;cursor:pointer;line-height:1.35;"><input type="checkbox" id="mpInlineModalCheck" ${checkboxDefaultChecked ? 'checked' : ''} style="margin-top:2px;"/><span>${esc(checkboxLabel)}</span></label>` : ''}
          <div id="mpInlineModalErr" style="display:none;color:#be123c;font-size:0.72rem;font-weight:600;margin-top:4px;"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
            <button type="button" id="mpInlineModalCancel" class="mp-btn">Cancelar</button>
            <button type="button" id="mpInlineModalConfirm" class="mp-btn ${esc(confirmClass)}">${esc(confirmLabel)}</button>
          </div>
        </div>
      `;
      document.body.appendChild(ov);
      const inp = ov.querySelector('#mpInlineModalInput');
      const chkEl = ov.querySelector('#mpInlineModalCheck');
      const errEl = ov.querySelector('#mpInlineModalErr');
      if (inp) inp.focus();

      const close = (val) => {
        ov.remove();
        resolve(val);
      };
      ov.querySelector('#mpInlineModalCancel').addEventListener('click', () => close(null));
      ov.addEventListener('click', (e) => { if (e.target === ov) close(null); });
      ov.querySelector('#mpInlineModalConfirm').addEventListener('click', () => {
        const val = String((inp && inp.value) || '').trim();
        if (minLength > 0 && val.length < minLength) {
          if (errEl) {
            errEl.textContent = `Ingresá al menos ${minLength} caracteres.`;
            errEl.style.display = 'block';
          }
          return;
        }
        if (hasCheck) {
          close({ text: val, checked: Boolean(chkEl && chkEl.checked) });
        } else {
          close(val);
        }
      });
    });
  }

  async function toggleEstadoAsociadoMp(associateId, nextActive) {
    const reason = await abrirModalAccionMp({
      title: nextActive ? 'Reactivar cuenta de Asociado' : 'Suspender cuenta de Asociado',
      description: nextActive
        ? 'El asociado volverá a operar compras QR y solicitudes en Mutual Pay.'
        : 'La cuenta quedará suspendida temporalmente para nuevas operaciones.',
      label: nextActive ? 'Motivo de reactivación' : 'Motivo de suspensión',
      defaultValue: 'Gestión Admin AMMER',
      confirmLabel: nextActive ? '✅ Reactivar' : '🚫 Suspender',
      confirmClass: nextActive ? 'mp-btn-success' : 'mp-btn-danger',
    });
    if (reason === null) return;
    try {
      await apiMp(`/asociados/${encodeURIComponent(associateId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive, reason: reason || 'Gestión Admin AMMER' }),
      });
      toast(nextActive ? 'Cuenta reactivada.' : 'Cuenta suspendida.');
      await cargarTodoMutualPayBackoffice(false);
      await abrirFichaUnificadaMp(associateId, false);
    } catch (err) {
      toast(`Error cambiando estado: ${err.message}`);
    }
  }

  function renderTablaConveniosMutualPay() {
    const box = document.getElementById('mpConveniosTablaContainer');
    if (!box) return;
    if (!st.convenios.length) {
      box.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">No hay solicitudes de convenios registradas.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Asociado</th><th>Convenio</th><th>Tarjeta</th><th>Imágenes</th><th>Estado</th><th>Cupo Comercios ($)</th><th>Cupo Efectivo ($)</th><th>Acción</th>' +
      '</tr></thead><tbody>';
    st.convenios.forEach((c) => {
      const fUrl = safeUrl(c.front_signed_url);
      const bUrl = safeUrl(c.back_signed_url);
      const pend = ['SUBMITTED', 'IN_ANALYSIS', 'PENDING'].includes(String(c.status || '').toUpperCase());
      html += `<tr>
        <td><strong>${esc(c.associate_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">DNI ${esc(c.associate_dni || '')}</div></td>
        <td>${esc(c.agreement_name || 'Sidecreer')}</td>
        <td>•••• ${esc(c.card_last_four || '----')} (${esc(c.card_expiry_date || '--/--')})</td>
        <td>${fUrl ? `<a href="${fUrl}" target="_blank" rel="noopener noreferrer">Frente</a>` : '—'} · ${bUrl ? `<a href="${bUrl}" target="_blank" rel="noopener noreferrer">Dorso</a>` : '—'}</td>
        <td>${badgeStatus(c.status)}</td>
        <td><input type="number" id="inpConvMerch_${esc(c.id)}" value="100000" style="width:95px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.75rem;"/></td>
        <td><input type="number" id="inpConvCash_${esc(c.id)}" value="50000" style="width:95px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.75rem;"/></td>
        <td>${pend ? `<div style="display:flex;gap:4px;"><button type="button" class="mp-btn mp-btn-success" data-mp-action="resolver-convenio" data-id="${esc(c.id)}" data-decision="APPROVED">Aprobar</button><button type="button" class="mp-btn mp-btn-danger" data-mp-action="resolver-convenio" data-id="${esc(c.id)}" data-decision="REJECTED">Rechazar</button></div>` : 'Resuelto'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function resolverConvenioMp(reqId, decision) {
    const merch = Number((document.getElementById(`inpConvMerch_${reqId}`) || {}).value || 0);
    const cash = Number((document.getElementById(`inpConvCash_${reqId}`) || {}).value || 0);
    try {
      await apiMp(`/convenios/${encodeURIComponent(reqId)}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          assigned_merchant_limit: decision === 'APPROVED' ? merch : 0,
          assigned_cash_limit: decision === 'APPROVED' ? cash : 0,
          review_notes: decision === 'APPROVED' ? 'Aprobado desde Backoffice Admin AMMER' : 'Rechazado por Administración',
        }),
      });
      toast(`Convenio ${decision}.`);
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error resolviendo convenio: ${err.message}`);
    }
  }

  function renderTablaAyudasMutualPay() {
    const box = document.getElementById('mpAyudasTablaContainer');
    if (!box) return;
    const f = String((document.getElementById('selMpFiltroAyudas') || {}).value || '').trim().toUpperCase();
    const list = st.ayudas.filter((r) => !f || String(r.status || '').toUpperCase() === f);
    if (!list.length) {
      box.innerHTML = '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.8rem;">Sin solicitudes de ayuda económica.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Fecha</th><th>Asociado / CUIT</th><th>Tipo</th><th>Monto / Cuotas</th><th>CBU Destino</th><th>Cruce AMMER</th><th>Estado</th><th>Acciones</th>' +
      '</tr></thead><tbody>';
    list.forEach((r) => {
      const id = r.id || r.request_id;
      const pend = ['SUBMITTED', 'UNDER_EVALUATION'].includes(String(r.status || '').toUpperCase());
      const montoPesos = Math.round(Number(r.requested_amount_minor || 0) / 100);
      const cuotas = Number(r.installments_plan || 1);
      const fullName = String(r.associate_full_name || r.associate_name || '');
      const dniRaw = String(r.associate_dni || r.dni || '').replace(/\D/g, '');
      const cbuRaw = String(r.cbu_cvu_destination || '');
      const phoneRaw = String((r.ammer_cruce && r.ammer_cruce.asociado && (r.ammer_cruce.asociado.telefono || r.ammer_cruce.asociado.celular)) || r.associate_phone || '');
      html += `<tr>
        <td>${fmtFecha(r.created_at)}</td>
        <td><strong>${esc(fullName || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(r.associate_cuit || '')}</div></td>
        <td><code>${esc(r.request_type || '')}</code></td>
        <td><strong>${fmtArsFromMinor(r.requested_amount_minor || 0)}</strong><div style="font-size:0.68rem;color:#64748b;">${cuotas} cuotas</div></td>
        <td><code>${esc(cbuRaw || '—')}</code><div style="font-size:0.68rem;color:#64748b;">${esc(r.bank_name || '')}</div></td>
        <td>${badgeAmmerCruce(r.ammer_cruce)}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${pend ? `<button type="button" class="mp-btn mp-btn-success" data-mp-action="resolver-ayuda" data-id="${esc(id)}" data-status="APPROVED" data-nombre="${esc(fullName)}" data-monto="${montoPesos}">Aprobar</button><button type="button" class="mp-btn mp-btn-danger" data-mp-action="resolver-ayuda" data-id="${esc(id)}" data-status="REJECTED" data-nombre="${esc(fullName)}" data-monto="${montoPesos}">Rechazar</button>` : ''}
            <button type="button" class="mp-btn" title="Precargar contexto completo en Simulador" data-mp-action="simular-ayuda" data-monto="${montoPesos}" data-cuotas="${cuotas}" data-dni="${esc(dniRaw)}" data-cbu="${esc(cbuRaw)}" data-nombre="${esc(fullName)}" data-id="${esc(id)}">🧮 Simular</button>
            <button type="button" class="mp-btn mp-btn-indigo" title="Ir a Firmas AMMER con datos precargados" data-mp-action="firmas-ayuda" data-monto="${montoPesos}" data-cuotas="${cuotas}" data-dni="${esc(dniRaw)}" data-nombre="${esc(fullName)}" data-phone="${esc(phoneRaw)}" data-id="${esc(id)}">✍️ Firmas</button>
            <button type="button" class="mp-btn" title="Generar sobre automático de firma AMMER" data-mp-action="generar-sobre-ayuda" data-id="${esc(id)}" data-nombre="${esc(fullName)}">📜 Sobre Firma</button>
          </div>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function resolverAyudaMp(requestId, statusVal, metaOpt = {}) {
    const isApprove = statusVal === 'APPROVED';
    const nombre = metaOpt.nombre ? ` (${metaOpt.nombre})` : '';
    const montoTxt = metaOpt.monto ? ` por ${fmtArs(metaOpt.monto)}` : '';
    const modalRes = await abrirModalAccionMp({
      title: `${isApprove ? '✅ Aprobar' : '❌ Rechazar'} Ayuda Económica${nombre}`,
      description: `Solicitud #${String(requestId).slice(0, 8)}${montoTxt}. Al confirmar, se actualizará Mutual Pay y se notificará al asociado por WhatsApp.`,
      label: isApprove ? 'Referencia de transferencia / nota de aprobación' : 'Motivo de rechazo',
      placeholder: isApprove ? 'Ej: Transferencia CBU #12345 o habilitado por comité' : 'Ingresá el motivo de rechazo...',
      confirmLabel: isApprove ? '✅ Confirmar Aprobación' : '❌ Confirmar Rechazo',
      confirmClass: isApprove ? 'mp-btn-success' : 'mp-btn-danger',
      minLength: isApprove ? 0 : 4,
      checkboxLabel: isApprove ? '✍️ Generar automáticamente sobre de firma electrónica AMMER y adjuntar enlace al WhatsApp' : '',
      checkboxDefaultChecked: isApprove,
    });
    if (modalRes === null) return;
    const notes = typeof modalRes === 'object' ? modalRes.text : modalRes;
    const crearSobreFirma = typeof modalRes === 'object' ? Boolean(modalRes.checked) : false;
    try {
      const resp = await apiMp(`/ayudas/${encodeURIComponent(requestId)}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusVal,
          resolution_notes: notes || `Resuelto (${statusVal}) desde Backoffice Admin AMMER`,
          crear_sobre_firma: isApprove ? crearSobreFirma : false,
        }),
      });
      if (resp && resp.sobre_firma && resp.sobre_firma.url_firma) {
        toast(`Ayuda aprobada y sobre de firma generado (${resp.sobre_firma.plantilla_nombre || 'AMMER'}).`);
      } else {
        toast(`Ayuda económica actualizada a ${statusVal}.`);
      }
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error resolviendo ayuda: ${err.message}`);
    }
  }

  async function generarSobreFirmaAyudaMp(requestId, nombreOpt = '') {
    const obs = await abrirModalAccionMp({
      title: `📜 Generar Sobre de Firma AMMER${nombreOpt ? ` (${nombreOpt})` : ''}`,
      description: `Creará un sobre digital en Firmas AMMER vinculado al expediente Mutual Pay #${String(requestId).slice(0, 8)}.`,
      label: 'Observaciones opcionales para el legajo',
      placeholder: 'Ej: Documentación de ayuda económica aprobada',
      confirmLabel: '📜 Generar Sobre de Firma',
      confirmClass: 'mp-btn-indigo',
      minLength: 0,
    });
    if (obs === null) return;
    try {
      const resp = await apiMp(`/ayudas/${encodeURIComponent(requestId)}/generar-sobre-firma`, {
        method: 'POST',
        body: JSON.stringify({ observaciones: obs || undefined }),
      });
      const urlFirma = resp && resp.url_firma ? String(resp.url_firma) : '';
      if (urlFirma && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlFirma).catch(() => {});
      }
      toast(urlFirma ? 'Sobre generado y enlace copiado al portapapeles.' : 'Sobre de firma generado.');
    } catch (err) {
      toast(`Error generando sobre de firma: ${err.message}`);
    }
  }

  function abrirEnSimuladorDesdeMp(ctxOrMonto) {
    const ctx = (typeof ctxOrMonto === 'object' && ctxOrMonto !== null)
      ? ctxOrMonto
      : { montoPesos: Number(ctxOrMonto || 0) };
    global._mpContextoParaSimulador = ctx;
    if (typeof cambiarPestana === 'function') cambiarPestana('view-simulador');
    const inp = document.getElementById('inputMonto');
    if (inp && Number(ctx.montoPesos || 0) > 0) {
      inp.value = String(ctx.montoPesos);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const selCuotas = document.getElementById('inputCuotas') || document.getElementById('selectCuotas');
    if (selCuotas && Number(ctx.cuotas || 0) > 1) {
      selCuotas.value = String(ctx.cuotas);
      selCuotas.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (ctx.fullName || ctx.dni) {
      toast(`Contexto precargado en Simulador: ${ctx.fullName || ''} ${ctx.dni ? `(DNI ${ctx.dni})` : ''}`.trim());
    }
  }

  function abrirFirmasDesdeMp(ctx = {}) {
    global._mpContextoParaFirmas = Object.assign({}, ctx, { _forceApply: true });
    if (typeof global.cambiarVistaPrincipal === 'function') {
      global.cambiarVistaPrincipal('firmas-ammer');
    }
    if (typeof global.renderFirmantesGenerar === 'function') {
      global.renderFirmantesGenerar();
    }
    toast(`Contexto transferido a Firmas AMMER (${ctx.fullName || ctx.dni || 'Asociado'}).`);
  }

  async function marcarLiquidacionTransferidaMp(merchantId, fantasyName = '', netoMinor = 0) {
    const montoFmt = fmtArsFromMinor(netoMinor || 0);
    const refTransfer = await abrirModalAccionMp({
      title: `💸 Marcar Liquidación Transferida`,
      description: `Comercio: ${fantasyName || merchantId}. Neto a liquidar: ${montoFmt}. Las transacciones autorizadas pendientes quedarán cerradas bajo este lote de pago.`,
      label: 'Número de comprobante / referencia bancaria (COELSA / CBU)',
      placeholder: 'Ej: TRF-BERSA-20261124-001',
      confirmLabel: '💸 Confirmar Transferencia',
      confirmClass: 'mp-btn-success',
      minLength: 3,
    });
    if (refTransfer === null) return;
    try {
      await apiMp('/liquidaciones/marcar-transferida', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchantId,
          transfer_reference: refTransfer,
          notes: `Liquidado desde Backoffice Admin AMMER (${montoFmt})`,
        }),
      });
      toast(`Liquidación marcada como transferida para ${fantasyName || 'el comercio'}.`);
      await cargarExtrasTabMutualPay('comercios', true);
    } catch (err) {
      toast(`Error marcando liquidación: ${err.message}`);
    }
  }

  function renderTablaLiquidacionesMutualPay() {
    const box = document.getElementById('mpLiquidacionesTablaContainer');
    if (!box) return;
    let html = '';
    if (!st.liquidaciones.length) {
      html += '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin liquidaciones pendientes registradas.</div>';
    } else {
      html += '<div class="data-table-container"><table class="data-table"><thead><tr>' +
        '<th>Comercio</th><th>CUIT</th><th>CBU / Alias</th><th>Ops</th><th>Ventas Brutas</th><th>Arancel</th><th>Neto a Transferir</th><th>Acreditación Est.</th><th>Acciones</th>' +
        '</tr></thead><tbody>';
      st.liquidaciones.forEach((m) => {
        const netoMinor = Number(m.net_payout_minor || 0);
        const mid = m.merchant_id || m.id || '';
        html += `<tr>
          <td><strong>${esc(m.fantasy_name)}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(m.business_name || '')}</div></td>
          <td><code>${esc(m.cuit || '')}</code></td>
          <td><code>${esc(m.bank_cbu || '—')}</code><div style="font-size:0.68rem;color:#64748b;">${esc(m.bank_alias || '')}</div></td>
          <td>${Number(m.transactions_count || 0)}</td>
          <td>${fmtArsFromMinor(m.gross_sales_minor || 0)}</td>
          <td>${fmtArsFromMinor(m.commission_deducted_minor || 0)} (${esc(m.commission_fee_pct || '0')}%)</td>
          <td><strong style="color:#059669;">${fmtArsFromMinor(netoMinor)}</strong></td>
          <td>${esc(m.estimated_settlement_date || '24-48 hs')}</td>
          <td>${netoMinor > 0 && mid ? `<button type="button" class="mp-btn mp-btn-success" data-mp-action="marcar-liquidacion" data-id="${esc(mid)}" data-nombre="${esc(m.fantasy_name || '')}" data-neto="${netoMinor}">💸 Marcar Transferida</button>` : '<span style="font-size:0.72rem;color:#64748b;">Al día</span>'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }
    if (Array.isArray(st.payoutHistorial) && st.payoutHistorial.length) {
      html += '<div style="margin-top:1rem;"><div style="font-size:0.76rem;font-weight:700;color:#334155;margin-bottom:6px;">Últimas transferencias registradas</div>' +
        '<div class="data-table-container"><table class="data-table"><thead><tr>' +
        '<th>Fecha</th><th>Comercio</th><th>Referencia</th><th>Ops</th><th>Bruto</th><th>Arancel</th><th>Neto Transferido</th>' +
        '</tr></thead><tbody>';
      st.payoutHistorial.slice(0, 15).forEach((p) => {
        html += `<tr>
          <td>${fmtFecha(p.created_at)}</td>
          <td><strong>${esc(p.merchant_fantasy_name || p.merchant_id || '—')}</strong></td>
          <td><code>${esc(p.transfer_reference || '')}</code></td>
          <td>${Number(p.transactions_count || 0)}</td>
          <td>${fmtArsFromMinor(p.gross_sales_minor || 0)}</td>
          <td>${fmtArsFromMinor(p.commission_deducted_minor || 0)}</td>
          <td><strong style="color:#0f766e;">${fmtArsFromMinor(p.net_payout_minor || 0)}</strong></td>
        </tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    box.innerHTML = html;
  }

  function exportarLiquidacionesMutualPayCsv() {
    if (!st.liquidaciones.length) {
      toast('No hay liquidaciones para exportar.');
      return;
    }
    const headers = ['Comercio', 'CUIT', 'CBU', 'Alias', 'Operaciones', 'Bruto_ARS', 'Comision_ARS', 'Neto_ARS', 'Fecha_Estimada'];
    const rows = st.liquidaciones.map((m) => [
      `"${String(m.fantasy_name || '').replace(/"/g, '""')}"`,
      m.cuit || '',
      `'${m.bank_cbu || ''}`,
      m.bank_alias || '',
      m.transactions_count || 0,
      ((m.gross_sales_minor || 0) / 100).toFixed(2),
      ((m.commission_deducted_minor || 0) / 100).toFixed(2),
      ((m.net_payout_minor || 0) / 100).toFixed(2),
      m.estimated_settlement_date || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidaciones_mutualpay_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleFormNuevoComercioMp() {
    st.formNuevoComercioAbierto = !st.formNuevoComercioAbierto;
    const wrap = document.getElementById('mpFormNuevoComercioWrap');
    if (!wrap) return;
    if (!st.formNuevoComercioAbierto) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <div style="font-size:0.8rem;font-weight:800;margin-bottom:8px;">Alta de Comercio Adherido</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
        <input type="text" id="inpMpNewCuit" placeholder="CUIT (30-XXXXXXXX-X)" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpNewBiz" placeholder="Razón Social" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpNewFan" placeholder="Nombre Fantasía" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpNewCat" placeholder="Rubro (Ej: Farmacia)" value="Comercio" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="email" id="inpMpNewEmail" placeholder="Email comercio" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="number" id="inpMpNewFee" placeholder="Comisión %" value="2.5" step="0.1" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpNewCbu" placeholder="CBU 22 dígitos" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpNewAddr" placeholder="Dirección sucursal" value="Paraná, Entre Ríos" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button type="button" class="mp-btn mp-btn-success" onclick="window.crearComercioMp()">💾 Crear Comercio</button>
        <button type="button" class="mp-btn" onclick="window.toggleFormNuevoComercioMp()">Cancelar</button>
      </div>
    `;
  }

  async function crearComercioMp() {
    const payload = {
      cuit: (document.getElementById('inpMpNewCuit') || {}).value || '',
      business_name: (document.getElementById('inpMpNewBiz') || {}).value || '',
      fantasy_name: (document.getElementById('inpMpNewFan') || {}).value || '',
      category: (document.getElementById('inpMpNewCat') || {}).value || 'Comercio',
      contact_email: (document.getElementById('inpMpNewEmail') || {}).value || '',
      commission_fee_pct: parseFloat((document.getElementById('inpMpNewFee') || {}).value || '2.5'),
      bank_cbu: (document.getElementById('inpMpNewCbu') || {}).value || null,
      branch_address: (document.getElementById('inpMpNewAddr') || {}).value || 'Paraná, Entre Ríos',
    };
    try {
      const res = await apiMp('/comercios', { method: 'POST', body: JSON.stringify(payload) });
      const com = (res && res.comercio) || {};
      toast('Comercio adherido creado en Mutual Pay.');
      toggleFormNuevoComercioMp();
      if (com.temporary_password) {
        mostrarCredencialesUnaVez({
          tipo: 'COMERCIO',
          nombre: com.fantasy_name || payload.fantasy_name,
          login_email: com.login_email || payload.contact_email,
          temporary_password: com.temporary_password,
          supabase_auth_ok: Boolean(com.supabase_auth_created),
        });
      }
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error creando comercio: ${err.message}`);
    }
  }

  async function verFichaComercioMp(merchantId) {
    try {
      const res = await apiMp(`/comercios/${encodeURIComponent(merchantId)}/ficha`);
      const f = (res && res.ficha) || {};
      const m = f.merchant || f || {};
      const branches = Array.isArray(f.branches) ? f.branches : (Array.isArray(m.branches) ? m.branches : []);
      const prev = document.getElementById('mpComercioFichaModalOverlay');
      if (prev) prev.remove();
      const ov = document.createElement('div');
      ov.id = 'mpComercioFichaModalOverlay';
      ov.setAttribute('style', 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;');
      ov.innerHTML = `
        <div style="width:100%;max-width:520px;background:#ffffff;border-radius:16px;padding:1.15rem 1.3rem;box-shadow:0 20px 50px rgba(15,23,42,0.28);border:1px solid #cbd5e1;max-height:86vh;overflow:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;font-size:1rem;font-weight:800;color:#0f172a;">🏪 ${esc(m.fantasy_name || 'Comercio')}</h4>
            <button type="button" class="mp-btn" id="btnCloseMpComFicha">✕</button>
          </div>
          <div style="font-size:0.78rem;color:#334155;line-height:1.6;">
            <div><strong>Razón Social:</strong> ${esc(m.business_name || '—')}</div>
            <div><strong>CUIT:</strong> <code>${esc(m.cuit || '—')}</code> · <strong>Rubro:</strong> ${esc(m.category || '—')}</div>
            <div><strong>CBU / Alias:</strong> <code>${esc(m.bank_cbu || '—')}</code> (${esc(m.bank_alias || '—')})</div>
            <div><strong>Comisión:</strong> ${Number(m.commission_fee_pct || 0)}% · <strong>Plazo:</strong> ${Number(m.settlement_timeframe_hours || 48)} hs</div>
            <div><strong>Saldo Wallet Comercio:</strong> ${fmtArsFromMinor(m.wallet_balance_minor || f.wallet_balance_minor || 0)}</div>
          </div>
          ${branches.length ? `<div style="margin-top:10px;border-top:1px solid #e2e8f0;padding-top:8px;"><div style="font-size:0.74rem;font-weight:800;color:#475569;margin-bottom:4px;">Sucursales (${branches.length})</div>${branches.map((b) => `<div style="font-size:0.75rem;padding:4px 0;border-bottom:1px dashed #f1f5f9;">📍 <strong>${esc(b.branch_name || 'Sucursal')}</strong> — ${esc(b.address || '')}</div>`).join('')}</div>` : ''}
        </div>
      `;
      document.body.appendChild(ov);
      ov.querySelector('#btnCloseMpComFicha').addEventListener('click', () => ov.remove());
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    } catch (err) {
      toast(`Error cargando ficha de comercio: ${err.message}`);
    }
  }

  function renderTablaComerciosMutualPay() {
    const box = document.getElementById('mpComerciosTablaContainer');
    if (!box) return;
    const q = String((document.getElementById('inpMpFiltroComercio') || {}).value || '').trim().toLowerCase();
    const list = st.comercios.filter((m) => {
      if (!q) return true;
      return `${m.fantasy_name || ''} ${m.business_name || ''} ${m.cuit || ''} ${m.category || ''}`.toLowerCase().includes(q);
    });
    if (!list.length) {
      box.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin comercios adheridos.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Comercio</th><th>CUIT / Rubro</th><th>Comisión %</th><th>Plazo</th><th>Estado</th><th>Acción</th>' +
      '</tr></thead><tbody>';
    list.forEach((m) => {
      html += `<tr>
        <td><strong>${esc(m.fantasy_name || '')}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(m.business_name || '')}</div></td>
        <td><code>${esc(m.cuit || '')}</code> · ${esc(m.category || '')}</td>
        <td><input type="number" step="0.1" id="inpMpComFee_${esc(m.id)}" value="${Number(m.commission_fee_pct || 0)}" style="width:72px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:6px;font-size:0.75rem;"/>%</td>
        <td>${Number(m.settlement_timeframe_hours || 48)} hs</td>
        <td>${badgeStatus(String(m.is_active !== false).toUpperCase())}</td>
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;">
          <button type="button" class="mp-btn" data-mp-action="ficha-comercio" data-id="${esc(m.id)}" title="Ver ficha completa y sucursales">👁️ Ficha</button>
          <button type="button" class="mp-btn mp-btn-primary" data-mp-action="guardar-comercio" data-id="${esc(m.id)}" data-active="${m.is_active !== false ? '1' : '0'}">Guardar</button>
          <button type="button" class="mp-btn" data-mp-action="reset-comercio" data-id="${esc(m.id)}" title="Generar/blanquear clave temporal">🔑 Clave</button>
        </div></td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function guardarParamComercioMp(merchantId, currentActive) {
    const fee = parseFloat((document.getElementById(`inpMpComFee_${merchantId}`) || {}).value || '0');
    try {
      await apiMp(`/comercios/${encodeURIComponent(merchantId)}/params`, {
        method: 'PATCH',
        body: JSON.stringify({ commission_fee_pct: fee, is_active: currentActive }),
      });
      toast('Parámetros del comercio actualizados.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error actualizando comercio: ${err.message}`);
    }
  }

  function renderTablaTransaccionesMutualPay() {
    const box = document.getElementById('mpTransaccionesTablaContainer');
    if (!box) return;
    if (!st.transacciones.length) {
      box.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin transacciones QR registradas.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Fecha</th><th>Asociado</th><th>Comercio</th><th>Bruto</th><th>Comisión</th><th>Neto</th><th>Cuotas</th><th>Estado</th><th>Acción</th>' +
      '</tr></thead><tbody>';
    st.transacciones.slice(0, 80).forEach((t) => {
      const txId = t.transaction_id || t.id;
      const canCancel = String(t.status || '').toUpperCase() === 'AUTHORIZED';
      html += `<tr>
        <td>${fmtFecha(t.created_at)}</td>
        <td><strong>${esc(t.associate_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">DNI ${esc(t.associate_dni || '')}</div></td>
        <td>${esc(t.merchant_name || '—')}</td>
        <td><strong>${fmtArsFromMinor(t.gross_amount_minor || 0)}</strong></td>
        <td>${fmtArsFromMinor(t.commission_minor || 0)}</td>
        <td>${fmtArsFromMinor(t.net_merchant_minor || 0)}</td>
        <td>${Number(t.installments_count || 1)}</td>
        <td>${badgeStatus(t.status)}</td>
        <td>${canCancel ? `<button type="button" class="mp-btn mp-btn-danger" data-mp-action="anular-tx" data-id="${esc(txId)}">Anular</button>` : '—'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function anularTxMp(txId) {
    const reason = await abrirModalAccionMp({
      title: 'Anular Transacción QR',
      description: 'Se generará un contra-asiento contable en Ledger, liberando el cupo del asociado y revirtiendo la acreditación al comercio.',
      label: 'Motivo de anulación',
      placeholder: 'Ej: Devolución de compra acordada con el comercio',
      confirmLabel: 'Confirmar Anulación',
      confirmClass: 'mp-btn-danger',
      minLength: 3,
    });
    if (!reason || reason.trim().length < 3) return;
    try {
      await apiMp(`/transacciones/${encodeURIComponent(txId)}/anular`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast('Transacción anulada con contra-asiento en Ledger.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error anulando transacción: ${err.message}`);
    }
  }

  function renderTablaCobranzasMutualPay() {
    const box = document.getElementById('mpCobranzasTablaContainer');
    if (!box) return;
    if (!st.cobranzas.length) {
      box.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin cobranzas manuales pendientes o históricas.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Fecha</th><th>ID Liquidación</th><th>Monto Declarado</th><th>Comprobante</th><th>Estado</th><th>Acción</th>' +
      '</tr></thead><tbody>';
    st.cobranzas.forEach((c) => {
      const id = c.id || c.settlement_id;
      const pUrl = safeUrl(c.transfer_proof_signed_url || c.proof_signed_url);
      const monto = c.total_to_pay_minor != null ? c.total_to_pay_minor : (c.declared_amount_minor || 0);
      const canVerify = String(c.status || '').toUpperCase() !== 'VERIFIED';
      html += `<tr>
        <td>${fmtFecha(c.created_at)}</td>
        <td><code>${esc(id)}</code></td>
        <td><strong>${fmtArsFromMinor(monto)}</strong></td>
        <td>${pUrl ? `<a href="${pUrl}" target="_blank" rel="noopener noreferrer" class="mp-btn">👁️ Ver Comprobante</a>` : '<span style="color:#94a3b8;">Sin archivo</span>'}</td>
        <td>${badgeStatus(c.status)}</td>
        <td>${canVerify ? `<div style="display:flex;gap:5px;"><button type="button" class="mp-btn mp-btn-success" data-mp-action="verificar-cobranza" data-id="${esc(id)}" data-approved="1">✅ Imputar</button><button type="button" class="mp-btn mp-btn-danger" data-mp-action="verificar-cobranza" data-id="${esc(id)}" data-approved="0">❌ Rechazar</button></div>` : 'Verificado'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function verificarCobranzaMp(settlementId, approved) {
    let rejection_reason = null;
    if (!approved) {
      const r = await abrirModalAccionMp({
        title: 'Rechazar Comprobante de Pago',
        label: 'Motivo de rechazo',
        defaultValue: 'Comprobante inválido o no acreditado.',
        confirmLabel: 'Confirmar Rechazo',
        confirmClass: 'mp-btn-danger',
        minLength: 4,
      });
      if (r === null) return;
      rejection_reason = r || 'Comprobante inválido o no acreditado.';
    }
    try {
      await apiMp(`/cobranzas-manuales/${encodeURIComponent(settlementId)}/verificar`, {
        method: 'POST',
        body: JSON.stringify({ approved, rejection_reason }),
      });
      toast(approved ? 'Cobranza imputada y cupo liberado.' : 'Comprobante rechazado.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error verificando cobranza: ${err.message}`);
    }
  }

  async function crearReglaCashbackMp() {
    const pct = parseFloat((document.getElementById('inpMpNewCbPct') || {}).value || '0');
    const maxPesos = parseFloat((document.getElementById('inpMpNewCbMax') || {}).value || '0');
    const merchId = String((document.getElementById('selMpNewCbMerchant') || {}).value || '').trim() || null;
    const splitMerch = parseFloat((document.getElementById('inpMpNewCbSplitMerch') || {}).value || '50');
    const splitMutual = Math.max(0, 100 - splitMerch);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 50) {
      toast('Ingresá un porcentaje de cashback válido (0.1% a 50%).');
      return;
    }
    try {
      await apiMp('/backoffice/cashback-rules', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: merchId,
          cashback_pct: pct,
          max_cashback_minor: maxPesos > 0 ? Math.round(maxPesos * 100) : null,
          split_merchant_pct: splitMerch,
          split_mutual_pct: splitMutual,
        }),
      });
      toast('Regla de cashback creada.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error creando regla de cashback: ${err.message}`);
    }
  }

  async function crearStaffMp() {
    const email = String((document.getElementById('inpMpStaffEmail') || {}).value || '').trim().toLowerCase();
    const role = String((document.getElementById('selMpStaffRole') || {}).value || 'ASESOR').trim();
    if (!email.includes('@')) {
      toast('Ingresá un email válido para el miembro de staff.');
      return;
    }
    try {
      const res = await apiMp('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      const r = (res && res.resultado) || {};
      toast(`Staff ${role} habilitado en Mutual Pay.`);
      if (r.temporary_password) {
        mostrarCredencialesUnaVez({
          tipo: `STAFF ${role}`,
          nombre: email,
          login_email: email,
          temporary_password: r.temporary_password,
          supabase_auth_ok: Boolean(r.supabase_auth_created),
        });
      }
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error habilitando staff: ${err.message}`);
    }
  }

  function renderTabAdminCircular() {
    const circ = (st.resumen && st.resumen.circular_economy) || {};
    const kpiBox = document.getElementById('mpCircularKpiCards');
    if (kpiBox) {
      kpiBox.innerHTML =
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Volumen Ecosistema</div><div class="mp-kpi-val">${fmtArsFromMinor(circ.ecosystem_volume_minor || 0)}</div><div class="mp-kpi-sub">QR + P2P interno</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Retenido en Red</div><div class="mp-kpi-val" style="color:#059669;">${fmtArsFromMinor(circ.retained_in_network_minor || 0)}</div><div class="mp-kpi-sub">Índice retención: ${Number(circ.circular_retention_index_pct || 0)}%</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Transferencias P2P</div><div class="mp-kpi-val">${fmtArsFromMinor(circ.total_p2p_volume_minor || 0)}</div><div class="mp-kpi-sub">Entre asociados</div></div>` +
        `<div class="mp-kpi-card"><div class="mp-kpi-label">Retiros a Bancos</div><div class="mp-kpi-val">${fmtArsFromMinor(circ.withdrawn_to_banks_minor || 0)}</div><div class="mp-kpi-sub">Egreso CBU comercios</div></div>`;
    }

    const regBox = document.getElementById('mpReglasFinancierasContainer');
    if (regBox) {
      let regHtml = '';
      if (!st.reglasFinancieras.length) {
        regHtml = '<div style="color:#64748b;font-size:0.78rem;">Sin reglas financieras cargadas.</div>';
      } else {
        regHtml = st.reglasFinancieras.map((r) => `
          <div style="padding:0.65rem;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <strong>${esc(r.rule_name)} (${esc(r.employment_condition)})</strong>
              ${badgeStatus(String(r.is_active).toUpperCase())}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:0.76rem;">
              <label>Tope Sueldo %: <input type="number" id="inpMpRuleDebt_${esc(r.id)}" value="${Number(r.max_debt_ratio_pct)}" step="0.5" style="width:65px;padding:3px;border:1px solid #cbd5e1;border-radius:6px;"/></label>
              <label>Comercios %: <input type="number" id="inpMpRuleMerch_${esc(r.id)}" value="${Number(r.default_merchant_line_pct)}" step="1" style="width:65px;padding:3px;border:1px solid #cbd5e1;border-radius:6px;"/></label>
              <button type="button" class="mp-btn mp-btn-primary" data-mp-action="guardar-regla" data-id="${esc(r.id)}" data-active="${r.is_active ? '1' : '0'}">Guardar</button>
            </div>
          </div>
        `).join('');
      }
      regHtml += `
        <div style="margin-top:12px;padding:0.75rem;border:1px dashed #cbd5e1;border-radius:10px;background:#ffffff;">
          <div style="font-size:0.74rem;font-weight:800;color:#0f172a;margin-bottom:6px;">👥 Alta de Staff Backoffice (Asesor / Admin Mutual Pay)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <input type="email" id="inpMpStaffEmail" placeholder="email@mutualmodelo.org.ar" style="flex:1;min-width:170px;padding:0.38rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.76rem;"/>
            <select id="selMpStaffRole" style="padding:0.38rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.76rem;">
              <option value="ASESOR">ASESOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button type="button" class="mp-btn mp-btn-indigo" data-mp-action="crear-staff">➕ Habilitar Staff</button>
          </div>
        </div>
      `;
      regBox.innerHTML = regHtml;
    }

    const cbBox = document.getElementById('mpCashbackRulesContainer');
    if (cbBox) {
      const merchantOpts = ['<option value="">Global (todos los comercios)</option>']
        .concat(st.comercios.map((m) => `<option value="${esc(m.id)}">${esc(m.fantasy_name || m.business_name)}</option>`))
        .join('');
      let cbHtml = `
        <div style="padding:0.65rem;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;margin-bottom:10px;">
          <div style="font-size:0.74rem;font-weight:800;color:#0f172a;margin-bottom:6px;">➕ Nueva Regla de Cashback</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;align-items:center;">
            <select id="selMpNewCbMerchant" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.74rem;">${merchantOpts}</select>
            <input type="number" id="inpMpNewCbPct" placeholder="% Cashback (ej: 5)" step="0.5" min="0.5" max="50" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.74rem;"/>
            <input type="number" id="inpMpNewCbMax" placeholder="Tope $ ARS (opc)" min="0" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.74rem;"/>
            <input type="number" id="inpMpNewCbSplitMerch" value="50" min="0" max="100" title="% a cargo del comercio" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:7px;font-size:0.74rem;"/>
            <button type="button" class="mp-btn mp-btn-success" data-mp-action="crear-cashback">💾 Crear Regla</button>
          </div>
        </div>
      `;
      if (!st.cashbackRules.length) {
        cbHtml += '<div style="color:#64748b;font-size:0.78rem;">Sin reglas de cashback configuradas.</div>';
      } else {
        cbHtml += st.cashbackRules.map((r) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0.5rem 0.7rem;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:6px;font-size:0.76rem;">
            <div>
              <strong>${esc(r.merchant_name || 'Global')}</strong> · ${Number(r.cashback_pct)}%
              <div style="font-size:0.68rem;color:#64748b;">Split Comercio ${Number(r.split_merchant_pct)}% / Mutual ${Number(r.split_mutual_pct)}%</div>
            </div>
            <button type="button" class="mp-btn" data-mp-action="toggle-cashback" data-id="${esc(r.id)}">${r.is_active ? '⏸️ Pausar' : '▶️ Activar'}</button>
          </div>
        `).join('');
      }
      cbBox.innerHTML = cbHtml;
    }

    const logBox = document.getElementById('mpAuditLogsContainer');
    if (logBox) {
      if (!st.auditLogs.length) {
        logBox.innerHTML = '<div style="color:#64748b;font-size:0.78rem;">Sin eventos recientes de auditoría.</div>';
      } else {
        let html = '<table class="data-table"><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>';
        st.auditLogs.slice(0, 50).forEach((l) => {
          html += `<tr>
            <td>${fmtFecha(l.created_at)}</td>
            <td>${esc(l.actor_email || 'Sistema')} <span style="font-size:0.68rem;color:#64748b;">(${esc(l.actor_role || '')})</span></td>
            <td><code>${esc(l.action || '')}</code></td>
            <td>${esc(l.target_entity || '')}</td>
            <td>${esc(l.details || '')}</td>
          </tr>`;
        });
        html += '</tbody></table>';
        logBox.innerHTML = html;
      }
    }
  }

  async function guardarReglaFinancieraMp(ruleId, isActive) {
    const debt = parseFloat((document.getElementById(`inpMpRuleDebt_${ruleId}`) || {}).value || '35');
    const merch = parseFloat((document.getElementById(`inpMpRuleMerch_${ruleId}`) || {}).value || '60');
    const cash = Math.max(0, 100 - merch);
    try {
      await apiMp(`/admin/reglas-financieras/${encodeURIComponent(ruleId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          max_debt_ratio_pct: debt,
          default_merchant_line_pct: merch,
          default_cash_loan_pct: cash,
          is_active: isActive,
        }),
      });
      toast('Regla financiera actualizada.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error guardando regla: ${err.message}`);
    }
  }

  async function toggleCashbackMp(ruleId) {
    try {
      await apiMp(`/backoffice/cashback-rules/${encodeURIComponent(ruleId)}/toggle`, { method: 'PATCH' });
      toast('Estado de regla de cashback actualizado.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error cambiando cashback: ${err.message}`);
    }
  }

  async function descargarComplianceMutualPay(reportType) {
    try {
      const resp = await apiMp(`/backoffice/compliance/export?report_type=${encodeURIComponent(reportType)}`, { rawResponse: true });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mutualpay_${reportType.toLowerCase()}_report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Reporte ${reportType} descargado.`);
    } catch (err) {
      toast(`Error exportando ${reportType}: ${err.message}`);
    }
  }

  function mostrarCredencialesUnaVez(info) {
    st.ultimaCredencial = info || null;
    const box = document.getElementById('mpCredencialesBox');
    if (!box) return;
    if (!info || !info.temporary_password) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const msgLines = [
      `Hola ${info.nombre || ''}, te compartimos tus credenciales temporales para ingresar a Mutual Pay (${info.tipo || 'APP'}):`,
      `• Usuario / Email: ${info.login_email || ''}`,
      `• Clave temporal: ${info.temporary_password}`,
    ];
    if (info.temporary_pin) {
      msgLines.push(`• PIN legado temporal (4 dígitos): ${info.temporary_pin}`);
    } else if (info.tipo === 'ASOCIADO') {
      msgLines.push('• Confirmación QR: Token único autogenerado enviado a tu WhatsApp al pagar.');
    }
    msgLines.push('Te recomendamos cambiar tu contraseña luego del primer ingreso.');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msgLines.join('\n'))}`;
    const authWarn = info.supabase_auth_ok === false
      ? '<div style="margin-top:6px;padding:6px 8px;border-radius:6px;background:#fef3c7;color:#92400e;font-size:0.72rem;">⚠️ <strong>Nota:</strong> <code>SUPABASE_SERVICE_ROLE_KEY</code> no estaba configurado en mutualpay-api; la clave se generó localmente pero verificá la sincronización en Supabase Auth.</div>'
      : '';

    box.style.display = 'block';
    box.innerHTML = `
      <div style="padding:0.95rem 1.1rem;border-radius:12px;border:2px solid #10b981;background:#ecfdf5;color:#064e3b;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:0.84rem;font-weight:800;">🔑 Credencial Temporal Única — ${esc(info.tipo || '')}: ${esc(info.nombre || '')}</div>
            <div style="font-size:0.73rem;color:#047857;margin-top:2px;">Mostrada por única vez en esta sesión (no se guarda en base de datos ni navegador).</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="mp-btn mp-btn-primary" onclick="window.copiarCredencialesMp()">📋 Copiar</button>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="mp-btn mp-btn-success" style="text-decoration:none;">💬 Enviar WhatsApp</a>
            <button type="button" class="mp-btn" onclick="window.cerrarCredencialesUnaVez()">Cerrar</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:10px;background:#ffffff;padding:0.7rem;border-radius:8px;border:1px solid #a7f3d0;">
          <div><div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">Usuario / Email Login</div><code style="font-size:0.82rem;font-weight:700;color:#0f172a;">${esc(info.login_email || '—')}</code></div>
          <div><div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">Clave Temporal</div><code style="font-size:0.86rem;font-weight:800;color:#047857;">${esc(info.temporary_password)}</code></div>
          ${info.temporary_pin ? `<div><div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">PIN Legado Temporal</div><code style="font-size:0.86rem;font-weight:800;color:#0369a1;">${esc(info.temporary_pin)}</code></div>` : '<div><div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">Autorización QR</div><span style="font-size:0.78rem;font-weight:700;color:#059669;">📲 Token OTP por WhatsApp</span></div>'}
        </div>
        ${authWarn}
      </div>
    `;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function cerrarCredencialesUnaVez() {
    mostrarCredencialesUnaVez(null);
  }

  function copiarCredencialesMp() {
    const info = st.ultimaCredencial;
    if (!info) return;
    const lines = [
      `Mutual Pay (${info.tipo || 'APP'}) - ${info.nombre || ''}`,
      `Usuario: ${info.login_email || ''}`,
      `Clave temporal: ${info.temporary_password || ''}`,
    ];
    if (info.temporary_pin) lines.push(`PIN legado: ${info.temporary_pin}`);
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Credenciales copiadas al portapapeles.')).catch(() => toast('No se pudo copiar automáticamente.'));
    } else {
      toast('Portapapeles no disponible en este navegador.');
    }
  }

  function renderTabAccesosMutualPay() {
    const asocBox = document.getElementById('mpAccesosAsociadosContainer');
    const comBox = document.getElementById('mpAccesosComerciosContainer');
    if (!asocBox && !comBox) return;

    const acc = st.accesos;
    if (!acc) {
      const emptyMsg = st.accesosError
        ? `<div style="padding:1rem;color:#9f1239;background:#fff1f2;border-radius:8px;font-size:0.78rem;">No se pudo cargar el padrón de accesos: ${esc(st.accesosError)} <button type="button" class="mp-btn" style="margin-left:8px;" onclick="window.cargarTodoMutualPayBackoffice(true)">Reintentar</button></div>`
        : '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sincronizá para consultar el padrón de accesos.</div>';
      if (asocBox) asocBox.innerHTML = emptyMsg;
      if (comBox) comBox.innerHTML = emptyMsg;
      return;
    }

    if (asocBox) {
      const qA = String((document.getElementById('inpMpFiltroAccesosAsoc') || {}).value || '').trim().toLowerCase();
      const fAuth = String((document.getElementById('selMpFiltroAccesosAsocAuth') || {}).value || '').trim().toUpperCase();
      const asocs = (acc.asociados || []).filter((a) => {
        if (fAuth === 'AUTH' && !a.has_auth_account) return false;
        if (fAuth === 'NO_AUTH' && a.has_auth_account) return false;
        if (fAuth === 'NO_PIN' && a.has_transaction_pin) return false;
        if (!qA) return true;
        return `${a.full_name || ''} ${a.dni || ''} ${a.cuit_cuil || ''} ${a.login_email || ''} ${a.email || ''}`.toLowerCase().includes(qA);
      });
      if (!asocs.length) {
        asocBox.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin asociados para el filtro seleccionado.</div>';
      } else {
        let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
          '<th>Asociado</th><th>DNI</th><th>Usuario / Email Login</th><th>Cuenta Auth</th><th>Autorización QR</th><th>Último Ingreso</th><th>Cruce AMMER</th><th>Acción</th>' +
          '</tr></thead><tbody>';
        asocs.forEach((a) => {
          const authBadge = a.has_auth_account
            ? `<span style="color:#059669;font-weight:700;font-size:0.74rem;">✅ Activa${a.email_confirmed ? ' (Verif.)' : ''}</span>`
            : '<span style="color:#b45309;font-weight:700;font-size:0.74rem;">⚠️ Sin Auth</span>';
          const pinBadge = '<span style="color:#059669;font-weight:700;font-size:0.74rem;">📲 Token WhatsApp</span>';
          html += `<tr>
            <td><strong>${esc(a.full_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">KYC: ${esc(a.kyc_status || '—')}</div></td>
            <td><code>${esc(a.dni || '—')}</code></td>
            <td><code>${esc(a.login_email || a.email || '—')}</code></td>
            <td>${authBadge}</td>
            <td>${pinBadge}</td>
            <td style="font-size:0.73rem;">${a.last_sign_in_at ? fmtFecha(a.last_sign_in_at) : 'Nunca'}</td>
            <td>${badgeAmmerCruce(a.ammer_cruce)}</td>
            <td><div style="display:flex;gap:4px;flex-wrap:wrap;">
              <button type="button" class="mp-btn mp-btn-primary" data-mp-action="reset-asoc" data-id="${esc(a.id)}" data-pin="0">🔑 Blanquear Clave</button>
            </div></td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        asocBox.innerHTML = html;
      }
    }

    if (comBox) {
      const qC = String((document.getElementById('inpMpFiltroAccesosCom') || {}).value || '').trim().toLowerCase();
      const coms = (acc.comercios || []).filter((m) => {
        if (!qC) return true;
        return `${m.fantasy_name || ''} ${m.business_name || ''} ${m.cuit || ''} ${m.login_email || ''} ${m.contact_email || ''}`.toLowerCase().includes(qC);
      });
      if (!coms.length) {
        comBox.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin comercios para el filtro seleccionado.</div>';
      } else {
        let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
          '<th>Comercio</th><th>CUIT</th><th>Usuario / Email Login</th><th>Cuenta Auth</th><th>Último Ingreso</th><th>Estado</th><th>Acción</th>' +
          '</tr></thead><tbody>';
        coms.forEach((m) => {
          const authBadge = m.has_auth_account
            ? `<span style="color:#059669;font-weight:700;font-size:0.74rem;">✅ Activa${m.email_confirmed ? ' (Verif.)' : ''}</span>`
            : '<span style="color:#b45309;font-weight:700;font-size:0.74rem;">⚠️ Sin Auth</span>';
          html += `<tr>
            <td><strong>${esc(m.fantasy_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(m.business_name || '')}</div></td>
            <td><code>${esc(m.cuit || '—')}</code></td>
            <td><code>${esc(m.login_email || m.contact_email || '—')}</code></td>
            <td>${authBadge}</td>
            <td style="font-size:0.73rem;">${m.last_sign_in_at ? fmtFecha(m.last_sign_in_at) : 'Nunca'}</td>
            <td>${badgeStatus(String(m.is_active !== false).toUpperCase())}</td>
            <td><button type="button" class="mp-btn mp-btn-primary" data-mp-action="reset-comercio" data-id="${esc(m.id)}">🔑 ${m.has_auth_account ? 'Blanquear Clave' : 'Habilitar Acceso'}</button></td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        comBox.innerHTML = html;
      }
    }
  }

  async function resetAccesoAsociadoMp(associateId, generateTempPin = false) {
    const msg = generateTempPin
      ? '¿Generar nueva clave temporal y PIN legado de 4 dígitos para este Asociado?'
      : '¿Habilitar o blanquear la clave temporal de acceso de este Asociado? Se le notificará por WhatsApp.';
    if (!confirm(msg)) return;
    try {
      const res = await apiMp(`/asociados/${encodeURIComponent(associateId)}/reset-access`, {
        method: 'POST',
        body: JSON.stringify({ generate_temp_pin: Boolean(generateTempPin) }),
      });
      const r = (res && res.resultado) || {};
      mostrarCredencialesUnaVez({
        tipo: 'ASOCIADO',
        nombre: r.full_name || 'Asociado Mutual Pay',
        login_email: r.login_email || '',
        temporary_password: r.temporary_password || '',
        temporary_pin: r.temporary_pin || null,
        supabase_auth_ok: Boolean(r.supabase_auth_updated),
      });
      toast('Credencial temporal generada para el Asociado.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error blanqueando acceso: ${err.message}`);
    }
  }

  async function resetAccesoComercioMp(merchantId) {
    if (!confirm('¿Habilitar o blanquear la clave temporal de acceso de este Comercio en Mutual Pay?')) return;
    try {
      const res = await apiMp(`/comercios/${encodeURIComponent(merchantId)}/reset-access`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const r = (res && res.resultado) || {};
      mostrarCredencialesUnaVez({
        tipo: 'COMERCIO',
        nombre: r.fantasy_name || 'Comercio Mutual Pay',
        login_email: r.login_email || '',
        temporary_password: r.temporary_password || '',
        supabase_auth_ok: Boolean(r.supabase_auth_updated),
      });
      toast('Credencial temporal generada para el Comercio.');
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error blanqueando acceso del comercio: ${err.message}`);
    }
  }

  function abrirAltaAsociadoDesdeTabMp() {
    cambiarTabMutualPay('accesos');
    if (!st.formNuevoAsociadoAbierto) {
      toggleFormNuevoAsociadoMp(true);
    }
    const wrap = document.getElementById('mpFormNuevoAsociadoWrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function toggleFormNuevoAsociadoMp(forceOpen = null) {
    st.formNuevoAsociadoAbierto = forceOpen === true ? true : !st.formNuevoAsociadoAbierto;
    const wrap = document.getElementById('mpFormNuevoAsociadoWrap');
    if (!wrap) return;
    if (!st.formNuevoAsociadoAbierto) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      st.ammerBusquedaResultados = [];
      return;
    }
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="font-size:0.82rem;font-weight:800;color:#0f172a;">Alta de Asociado en Mutual Pay (con usuario Supabase Auth + Token WhatsApp)</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="inpMpBuscarAmmerAlta" placeholder="Buscar DNI o Apellido en AMMER..." style="min-width:220px;padding:0.38rem 0.6rem;border:1px solid #93c5fd;border-radius:8px;font-size:0.76rem;background:#ffffff;"/>
          <button type="button" class="mp-btn mp-btn-primary" onclick="window.buscarEnAmmerParaAltaMp()">🔎 Traer de Padrón AMMER</button>
        </div>
      </div>
      <div id="mpAmmerAltaResultados" style="margin-bottom:8px;"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:8px;">
        <input type="text" id="inpMpAsocDni" placeholder="DNI (sin puntos, 8 dígitos)" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpAsocCuil" placeholder="CUIL (20-XXXXXXXX-X)" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpAsocFirst" placeholder="Nombre" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpAsocLast" placeholder="Apellido" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="email" id="inpMpAsocEmail" placeholder="Email de acceso a la App" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <input type="text" id="inpMpAsocPhone" placeholder="Teléfono / WhatsApp (+549...)" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <select id="selMpAsocCond" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;">
          <option value="ACTIVO">ACTIVO (35% ratio)</option>
          <option value="PASIVO">PASIVO / Jubilado (20% ratio)</option>
        </select>
        <input type="number" id="inpMpAsocSalary" placeholder="Sueldo / Haber Neto ($ ARS)" min="0" step="1000" value="800000" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;"/>
        <select id="selMpAsocKyc" style="padding:0.42rem 0.6rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.77rem;">
          <option value="APPROVED">KYC APPROVED (habilitado ya con cupo)</option>
          <option value="UNDER_REVIEW">KYC UNDER_REVIEW (pendiente)</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.74rem;color:#475569;font-weight:600;cursor:pointer;">
          <input type="checkbox" id="chkMpAsocPin" />
          Generar PIN legado opcional (por defecto usa Token OTP por WhatsApp)
        </label>
        <div style="display:flex;gap:8px;">
          <button type="button" id="btnMpCrearAsociadoSubmit" class="mp-btn mp-btn-success" onclick="window.crearAsociadoMp()">💾 Crear Asociado y Enviar Acceso</button>
          <button type="button" class="mp-btn" onclick="window.toggleFormNuevoAsociadoMp(false)">Cancelar</button>
        </div>
      </div>
    `;
  }

  async function buscarEnAmmerParaAltaMp() {
    const q = String((document.getElementById('inpMpBuscarAmmerAlta') || {}).value || '').trim();
    const out = document.getElementById('mpAmmerAltaResultados');
    if (q.length < 2) {
      toast('Ingresá al menos 2 caracteres (DNI o apellido).');
      return;
    }
    if (out) out.innerHTML = '<div style="font-size:0.74rem;color:#64748b;">Buscando en Padrón AMMER Core...</div>';
    try {
      const res = await apiMp(`/ammer-padron/buscar?q=${encodeURIComponent(q)}`);
      const list = (res && res.asociados) || [];
      st.ammerBusquedaResultados = list;
      if (!out) return;
      if (!list.length) {
        out.innerHTML = '<div style="font-size:0.74rem;color:#b45309;">Sin coincidencias en el padrón AMMER; podés completar los datos manualmente abajo.</div>';
        return;
      }
      let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      list.slice(0, 8).forEach((row, idx) => {
        html += `<button type="button" class="mp-btn" style="background:#eff6ff;border-color:#93c5fd;color:#1e3a8a;font-size:0.72rem;" data-mp-action="usar-ammer-alta" data-idx="${idx}">` +
          `Usar: <strong>${esc(row.nombre_completo || 'Asociado')}</strong> (DNI ${esc(row.dni || '—')}${row.organismo ? ` · ${esc(row.organismo)}` : ''})` +
          `</button>`;
      });
      html += '</div>';
      out.innerHTML = html;
    } catch (err) {
      if (out) out.innerHTML = `<div style="font-size:0.74rem;color:#9f1239;">Error buscando en AMMER: ${esc(err.message)}</div>`;
    }
  }

  function usarAsociadoAmmerEnFormMp(idx) {
    const row = (st.ammerBusquedaResultados || [])[idx];
    if (!row) return;
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el && v != null && String(v).trim() !== '') el.value = String(v).trim();
    };
    setVal('inpMpAsocDni', row.dni);
    setVal('inpMpAsocCuil', row.cuil);
    setVal('inpMpAsocFirst', row.first_name);
    setVal('inpMpAsocLast', row.last_name);
    setVal('inpMpAsocEmail', row.email);
    setVal('inpMpAsocPhone', row.telefono);
    if (row.ultimo_sueldo != null && Number(row.ultimo_sueldo) > 0) {
      setVal('inpMpAsocSalary', Math.round(Number(row.ultimo_sueldo)));
    }
    const orgUp = String(row.organismo || '').toUpperCase();
    const selCond = document.getElementById('selMpAsocCond');
    if (selCond && (orgUp.includes('CAJA') || orgUp.includes('PASIV') || orgUp.includes('JUB'))) {
      selCond.value = 'PASIVO';
    }
    toast(`Datos cargados desde AMMER (${row.dni || ''}). Completá email/CUIL si falta alguno y guardá.`);
  }

  async function crearAsociadoMp() {
    const dni = String((document.getElementById('inpMpAsocDni') || {}).value || '').replace(/\D/g, '');
    const cuitCuil = String((document.getElementById('inpMpAsocCuil') || {}).value || '').trim();
    const firstName = String((document.getElementById('inpMpAsocFirst') || {}).value || '').trim();
    const lastName = String((document.getElementById('inpMpAsocLast') || {}).value || '').trim();
    const email = String((document.getElementById('inpMpAsocEmail') || {}).value || '').trim().toLowerCase();
    const phone = String((document.getElementById('inpMpAsocPhone') || {}).value || '').trim();
    const employmentCondition = String((document.getElementById('selMpAsocCond') || {}).value || 'ACTIVO').trim();
    const salaryPesos = Number((document.getElementById('inpMpAsocSalary') || {}).value || 0);
    const kycStatus = String((document.getElementById('selMpAsocKyc') || {}).value || 'APPROVED').trim();
    const generateTempPin = Boolean((document.getElementById('chkMpAsocPin') || {}).checked);

    if (dni.length < 7 || !cuitCuil || !firstName || !lastName || !email.includes('@') || phone.length < 6) {
      toast('Completá DNI, CUIL (con guiones XX-XXXXXXXX-X), Nombre, Apellido, Email y Teléfono.');
      return;
    }

    const btn = document.getElementById('btnMpCrearAsociadoSubmit');
    if (btn) btn.disabled = true;
    try {
      const res = await apiMp('/asociados', {
        method: 'POST',
        body: JSON.stringify({
          dni,
          cuit_cuil: cuitCuil,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          employment_condition: employmentCondition,
          net_salary_cents: Math.max(0, Math.round(salaryPesos * 100)),
          kyc_status: kycStatus,
          generate_temp_pin: generateTempPin,
        }),
      });
      const asoc = (res && res.asociado) || {};
      toast('Asociado creado en Mutual Pay y notificado por WhatsApp.');
      toggleFormNuevoAsociadoMp(false);
      if (asoc.temporary_password) {
        mostrarCredencialesUnaVez({
          tipo: 'ASOCIADO',
          nombre: asoc.full_name || `${firstName} ${lastName}`,
          login_email: asoc.login_email || email,
          temporary_password: asoc.temporary_password,
          temporary_pin: asoc.temporary_pin || null,
          supabase_auth_ok: Boolean(asoc.supabase_auth_created),
        });
      }
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error creando asociado: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindMutualPayDelegatedEvents() {
    if (global.__mpBackofficeDelegatedBound || typeof document === 'undefined') return;
    global.__mpBackofficeDelegatedBound = true;
    document.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-mp-action]') : null;
      if (!btn) return;
      const act = btn.getAttribute('data-mp-action');
      const id = btn.getAttribute('data-id') || '';
      if (act === 'ver-ficha') {
        abrirFichaUnificadaMp(id, btn.getAttribute('data-switch') === '1');
      } else if (act === 'auditar-doc') {
        auditarDocMutualPayConIA(
          btn.getAttribute('data-assoc-id') || '',
          btn.getAttribute('data-doc-type') || '',
          btn.getAttribute('data-signed-url') || '',
          btn.getAttribute('data-dni') || '',
          btn.getAttribute('data-nombre') || ''
        );
      } else if (act === 'reset-asoc') {
        resetAccesoAsociadoMp(id, btn.getAttribute('data-pin') === '1');
      } else if (act === 'toggle-asoc') {
        toggleEstadoAsociadoMp(id, btn.getAttribute('data-next-active') === '1');
      } else if (act === 'resolver-kyc') {
        resolverKycMp(id, btn.getAttribute('data-status') || 'APPROVED', Number(btn.getAttribute('data-salary') || 0));
      } else if (act === 'ajustar-limites') {
        ajustarLimitesMp(id);
      } else if (act === 'resolver-convenio') {
        resolverConvenioMp(id, btn.getAttribute('data-decision') || 'APPROVED');
      } else if (act === 'resolver-ayuda') {
        resolverAyudaMp(id, btn.getAttribute('data-status') || 'APPROVED', {
          nombre: btn.getAttribute('data-nombre') || '',
          monto: Number(btn.getAttribute('data-monto') || 0),
        });
      } else if (act === 'simular-ayuda') {
        abrirEnSimuladorDesdeMp({
          requestId: id,
          montoPesos: Number(btn.getAttribute('data-monto') || 0),
          cuotas: Number(btn.getAttribute('data-cuotas') || 1),
          dni: btn.getAttribute('data-dni') || '',
          cbu: btn.getAttribute('data-cbu') || '',
          fullName: btn.getAttribute('data-nombre') || '',
        });
      } else if (act === 'firmas-ayuda') {
        abrirFirmasDesdeMp({
          requestId: id,
          montoPesos: Number(btn.getAttribute('data-monto') || 0),
          cuotas: Number(btn.getAttribute('data-cuotas') || 1),
          dni: btn.getAttribute('data-dni') || '',
          fullName: btn.getAttribute('data-nombre') || '',
          phone: btn.getAttribute('data-phone') || '',
        });
      } else if (act === 'generar-sobre-ayuda') {
        generarSobreFirmaAyudaMp(id, btn.getAttribute('data-nombre') || '');
      } else if (act === 'marcar-liquidacion') {
        marcarLiquidacionTransferidaMp(
          id,
          btn.getAttribute('data-nombre') || '',
          Number(btn.getAttribute('data-neto') || 0)
        );
      } else if (act === 'ficha-comercio') {
        verFichaComercioMp(id);
      } else if (act === 'guardar-comercio') {
        guardarParamComercioMp(id, btn.getAttribute('data-active') !== '0');
      } else if (act === 'reset-comercio') {
        resetAccesoComercioMp(id);
      } else if (act === 'anular-tx') {
        anularTxMp(id);
      } else if (act === 'verificar-cobranza') {
        verificarCobranzaMp(id, btn.getAttribute('data-approved') === '1');
      } else if (act === 'guardar-regla') {
        guardarReglaFinancieraMp(id, btn.getAttribute('data-active') !== '0');
      } else if (act === 'toggle-cashback') {
        toggleCashbackMp(id);
      } else if (act === 'crear-cashback') {
        crearReglaCashbackMp();
      } else if (act === 'crear-staff') {
        crearStaffMp();
      } else if (act === 'usar-ammer-alta') {
        usarAsociadoAmmerEnFormMp(Number(btn.getAttribute('data-idx') || 0));
      }
    });
  }

  function initMutualPayBackoffice() {
    bindMutualPayDelegatedEvents();
    if (!st.initialized) {
      st.initialized = true;
    }
    if (!st.lastSyncAt || (Date.now() - st.lastSyncAt) > 45000) {
      cargarTodoMutualPayBackoffice(false);
    }
  }

  global.initMutualPayBackoffice = initMutualPayBackoffice;
  global.verificarEstadoMutualPay = verificarEstadoMutualPay;
  global.cargarTodoMutualPayBackoffice = cargarTodoMutualPayBackoffice;
  global.cambiarTabMutualPay = cambiarTabMutualPay;
  global.buscarAsociadosMutualPay = buscarAsociadosMutualPay;
  global.renderTablaAsociadosMutualPay = renderTablaAsociadosMutualPay;
  global.abrirFichaUnificadaMp = abrirFichaUnificadaMp;
  global.auditarDocMutualPayConIA = auditarDocMutualPayConIA;
  global.resolverKycMp = resolverKycMp;
  global.ajustarLimitesMp = ajustarLimitesMp;
  global.toggleEstadoAsociadoMp = toggleEstadoAsociadoMp;
  global.resolverConvenioMp = resolverConvenioMp;
  global.renderTablaAyudasMutualPay = renderTablaAyudasMutualPay;
  global.resolverAyudaMp = resolverAyudaMp;
  global.generarSobreFirmaAyudaMp = generarSobreFirmaAyudaMp;
  global.marcarLiquidacionTransferidaMp = marcarLiquidacionTransferidaMp;
  global.abrirEnSimuladorDesdeMp = abrirEnSimuladorDesdeMp;
  global.abrirFirmasDesdeMp = abrirFirmasDesdeMp;
  global.exportarLiquidacionesMutualPayCsv = exportarLiquidacionesMutualPayCsv;
  global.toggleFormNuevoComercioMp = toggleFormNuevoComercioMp;
  global.crearComercioMp = crearComercioMp;
  global.verFichaComercioMp = verFichaComercioMp;
  global.renderTablaComerciosMutualPay = renderTablaComerciosMutualPay;
  global.guardarParamComercioMp = guardarParamComercioMp;
  global.anularTxMp = anularTxMp;
  global.verificarCobranzaMp = verificarCobranzaMp;
  global.guardarReglaFinancieraMp = guardarReglaFinancieraMp;
  global.toggleCashbackMp = toggleCashbackMp;
  global.crearReglaCashbackMp = crearReglaCashbackMp;
  global.crearStaffMp = crearStaffMp;
  global.descargarComplianceMutualPay = descargarComplianceMutualPay;
  global.renderTabAccesosMutualPay = renderTabAccesosMutualPay;
  global.resetAccesoAsociadoMp = resetAccesoAsociadoMp;
  global.resetAccesoComercioMp = resetAccesoComercioMp;
  global.cerrarCredencialesUnaVez = cerrarCredencialesUnaVez;
  global.copiarCredencialesMp = copiarCredencialesMp;
  global.abrirAltaAsociadoDesdeTabMp = abrirAltaAsociadoDesdeTabMp;
  global.toggleFormNuevoAsociadoMp = toggleFormNuevoAsociadoMp;
  global.buscarEnAmmerParaAltaMp = buscarEnAmmerParaAltaMp;
  global.usarAsociadoAmmerEnFormMp = usarAsociadoAmmerEnFormMp;
  global.crearAsociadoMp = crearAsociadoMp;
})(window);
