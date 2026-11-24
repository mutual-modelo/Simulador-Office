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
    if (typeof sanitizeHTML === 'function') return sanitizeHTML(v == null ? '' : String(v));
    return String(v == null ? '' : v)
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
      const [liqRes, txRes] = await Promise.allSettled([
        apiMp('/liquidaciones/resumen'),
        apiMp('/transacciones'),
      ]);
      if (liqRes.status === 'fulfilled') st.liquidaciones = liqRes.value.liquidaciones || [];
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
        <td><button type="button" class="mp-btn mp-btn-primary" onclick="window.abrirFichaUnificadaMp('${esc(a.id)}', true)">Ver Ficha 360°</button></td>
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
        <td style="text-align:right;"><button type="button" class="mp-btn" onclick="window.abrirFichaUnificadaMp('${esc(a.id)}', false)">Revisar</button></td>
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
            ${canAuditIa ? `<button type="button" class="mp-btn mp-btn-indigo" onclick="window.auditarDocMutualPayConIA('${esc(assoc.id)}','${esc(docType)}','${sUrl}','${esc(assoc.dni || '')}','${esc(`${assoc.first_name || ''} ${assoc.last_name || ''}`.trim())}')">🤖 Auditar IA AMMER</button>` : ''}
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
          <button type="button" class="mp-btn" onclick="window.auditarDocMutualPayConIA('${esc(assoc.id)}','BOLETIN_ER','','${esc(assoc.dni || '')}','${esc(`${assoc.first_name || ''} ${assoc.last_name || ''}`.trim())}')">📰 Consultar Boletín ER</button>
        </div>
      </div>`;
    } else if (assoc.dni) {
      ammerHtml += `<div style="margin-top:6px;"><button type="button" class="mp-btn" onclick="window.auditarDocMutualPayConIA('${esc(assoc.id)}','BOLETIN_ER','','${esc(assoc.dni || '')}','${esc(`${assoc.first_name || ''} ${assoc.last_name || ''}`.trim())}')">📰 Verificar Boletín ER por DNI</button></div>`;
    }

    const isActiveAcc = assoc.is_active !== false;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;border-bottom:1px solid #e2e8f0;padding-bottom:0.75rem;margin-bottom:0.85rem;flex-wrap:wrap;">
        <div>
          <h4 style="margin:0;font-size:1rem;font-weight:800;color:#0f172a;">${esc(`${assoc.first_name || ''} ${assoc.last_name || ''}`.trim() || 'Asociado')}</h4>
          <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">DNI ${esc(assoc.dni || '—')} · CUIL ${esc(assoc.cuit_cuil || '—')} · ${esc(assoc.employment_condition || '')}</div>
          <div style="font-size:0.73rem;color:#64748b;">${esc(assoc.email || '')} · ${esc(assoc.phone || '')}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          ${badgeStatus(assoc.kyc_status)}
          <button type="button" class="mp-btn" onclick="window.resetAccesoAsociadoMp('${esc(assoc.id)}', false)">🔑 Blanquear Clave</button>
          <button type="button" class="mp-btn" onclick="window.resetAccesoAsociadoMp('${esc(assoc.id)}', true)">🔢 Clave + PIN</button>
          <button type="button" class="mp-btn ${isActiveAcc ? 'mp-btn-danger' : 'mp-btn-success'}" onclick="window.toggleEstadoAsociadoMp('${esc(assoc.id)}', ${!isActiveAcc})">${isActiveAcc ? 'Suspender' : 'Reactivar'}</button>
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
            <button type="button" class="mp-btn mp-btn-success" onclick="window.resolverKycMp('${esc(assoc.id)}','APPROVED', ${Number(assoc.net_salary_cents || 0)})">✅ Aprobar KYC</button>
            <button type="button" class="mp-btn mp-btn-danger" onclick="window.resolverKycMp('${esc(assoc.id)}','REJECTED', ${Number(assoc.net_salary_cents || 0)})">❌ Rechazar KYC</button>
            <button type="button" class="mp-btn mp-btn-primary" onclick="window.ajustarLimitesMp('${esc(assoc.id)}')">💾 Guardar Ajuste Límites</button>
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

  async function toggleEstadoAsociadoMp(associateId, nextActive) {
    const reason = prompt(nextActive ? 'Motivo de reactivación:' : 'Motivo de suspensión:') || 'Gestión Admin AMMER';
    try {
      await apiMp(`/asociados/${encodeURIComponent(associateId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive, reason }),
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
        <td>${pend ? `<div style="display:flex;gap:4px;"><button type="button" class="mp-btn mp-btn-success" onclick="window.resolverConvenioMp('${esc(c.id)}','APPROVED')">Aprobar</button><button type="button" class="mp-btn mp-btn-danger" onclick="window.resolverConvenioMp('${esc(c.id)}','REJECTED')">Rechazar</button></div>` : 'Resuelto'}</td>
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
      html += `<tr>
        <td>${fmtFecha(r.created_at)}</td>
        <td><strong>${esc(r.associate_full_name || r.associate_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(r.associate_cuit || '')}</div></td>
        <td><code>${esc(r.request_type || '')}</code></td>
        <td><strong>${fmtArsFromMinor(r.requested_amount_minor || 0)}</strong><div style="font-size:0.68rem;color:#64748b;">${Number(r.installments_plan || 1)} cuotas</div></td>
        <td><code>${esc(r.cbu_cvu_destination || '—')}</code><div style="font-size:0.68rem;color:#64748b;">${esc(r.bank_name || '')}</div></td>
        <td>${badgeAmmerCruce(r.ammer_cruce)}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${pend ? `<button type="button" class="mp-btn mp-btn-success" onclick="window.resolverAyudaMp('${esc(id)}','APPROVED')">Aprobar</button><button type="button" class="mp-btn mp-btn-danger" onclick="window.resolverAyudaMp('${esc(id)}','REJECTED')">Rechazar</button>` : ''}
            <button type="button" class="mp-btn" title="Precargar monto en Simulador" onclick="window.abrirEnSimuladorDesdeMp(${montoPesos})">🧮 Simular</button>
            <button type="button" class="mp-btn mp-btn-indigo" title="Ir a Firmas AMMER" onclick="cambiarVistaPrincipal('firmas-ammer')">✍️ Firmas</button>
          </div>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function resolverAyudaMp(requestId, statusVal) {
    const notes = prompt(statusVal === 'APPROVED' ? 'Referencia de transferencia / nota de aprobación:' : 'Motivo de rechazo:') || '';
    try {
      await apiMp(`/ayudas/${encodeURIComponent(requestId)}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusVal, resolution_notes: notes || `Resuelto (${statusVal}) desde Backoffice Admin AMMER` }),
      });
      toast(`Ayuda económica actualizada a ${statusVal}.`);
      await cargarTodoMutualPayBackoffice(false);
    } catch (err) {
      toast(`Error resolviendo ayuda: ${err.message}`);
    }
  }

  function abrirEnSimuladorDesdeMp(montoPesos) {
    if (typeof cambiarPestana === 'function') cambiarPestana('view-simulador');
    const inp = document.getElementById('inputMonto');
    if (inp && montoPesos > 0) {
      inp.value = String(montoPesos);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function renderTablaLiquidacionesMutualPay() {
    const box = document.getElementById('mpLiquidacionesTablaContainer');
    if (!box) return;
    if (!st.liquidaciones.length) {
      box.innerHTML = '<div style="padding:1rem;color:#64748b;font-size:0.78rem;">Sin liquidaciones pendientes registradas.</div>';
      return;
    }
    let html = '<div class="data-table-container"><table class="data-table"><thead><tr>' +
      '<th>Comercio</th><th>CUIT</th><th>CBU / Alias</th><th>Ops</th><th>Ventas Brutas</th><th>Arancel</th><th>Neto a Transferir</th><th>Acreditación Est.</th>' +
      '</tr></thead><tbody>';
    st.liquidaciones.forEach((m) => {
      html += `<tr>
        <td><strong>${esc(m.fantasy_name)}</strong><div style="font-size:0.68rem;color:#64748b;">${esc(m.business_name || '')}</div></td>
        <td><code>${esc(m.cuit || '')}</code></td>
        <td><code>${esc(m.bank_cbu || '—')}</code><div style="font-size:0.68rem;color:#64748b;">${esc(m.bank_alias || '')}</div></td>
        <td>${Number(m.transactions_count || 0)}</td>
        <td>${fmtArsFromMinor(m.gross_sales_minor || 0)}</td>
        <td>${fmtArsFromMinor(m.commission_deducted_minor || 0)} (${esc(m.commission_fee_pct || '0')}%)</td>
        <td><strong style="color:#059669;">${fmtArsFromMinor(m.net_payout_minor || 0)}</strong></td>
        <td>${esc(m.estimated_settlement_date || '24-48 hs')}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
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
        <td><div style="display:flex;gap:4px;flex-wrap:wrap;"><button type="button" class="mp-btn mp-btn-primary" onclick="window.guardarParamComercioMp('${esc(m.id)}', ${m.is_active !== false})">Guardar</button><button type="button" class="mp-btn" onclick="window.resetAccesoComercioMp('${esc(m.id)}')" title="Generar/blanquear clave temporal">🔑 Clave</button></div></td>
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
        <td>${canCancel ? `<button type="button" class="mp-btn mp-btn-danger" onclick="window.anularTxMp('${esc(txId)}')">Anular</button>` : '—'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function anularTxMp(txId) {
    const reason = prompt('Motivo de anulación / contra-asiento contable:');
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
        <td>${canVerify ? `<div style="display:flex;gap:5px;"><button type="button" class="mp-btn mp-btn-success" onclick="window.verificarCobranzaMp('${esc(id)}', true)">✅ Imputar</button><button type="button" class="mp-btn mp-btn-danger" onclick="window.verificarCobranzaMp('${esc(id)}', false)">❌ Rechazar</button></div>` : 'Verificado'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    box.innerHTML = html;
  }

  async function verificarCobranzaMp(settlementId, approved) {
    let rejection_reason = null;
    if (!approved) {
      rejection_reason = prompt('Motivo de rechazo del comprobante:') || 'Comprobante inválido o no acreditado.';
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
      if (!st.reglasFinancieras.length) {
        regBox.innerHTML = '<div style="color:#64748b;font-size:0.78rem;">Sin reglas financieras cargadas.</div>';
      } else {
        regBox.innerHTML = st.reglasFinancieras.map((r) => `
          <div style="padding:0.65rem;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <strong>${esc(r.rule_name)} (${esc(r.employment_condition)})</strong>
              ${badgeStatus(String(r.is_active).toUpperCase())}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:0.76rem;">
              <label>Tope Sueldo %: <input type="number" id="inpMpRuleDebt_${esc(r.id)}" value="${Number(r.max_debt_ratio_pct)}" step="0.5" style="width:65px;padding:3px;border:1px solid #cbd5e1;border-radius:6px;"/></label>
              <label>Comercios %: <input type="number" id="inpMpRuleMerch_${esc(r.id)}" value="${Number(r.default_merchant_line_pct)}" step="1" style="width:65px;padding:3px;border:1px solid #cbd5e1;border-radius:6px;"/></label>
              <button type="button" class="mp-btn mp-btn-primary" onclick="window.guardarReglaFinancieraMp('${esc(r.id)}', ${Boolean(r.is_active)})">Guardar</button>
            </div>
          </div>
        `).join('');
      }
    }

    const cbBox = document.getElementById('mpCashbackRulesContainer');
    if (cbBox) {
      if (!st.cashbackRules.length) {
        cbBox.innerHTML = '<div style="color:#64748b;font-size:0.78rem;">Sin reglas de cashback configuradas.</div>';
      } else {
        cbBox.innerHTML = st.cashbackRules.map((r) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0.5rem 0.7rem;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:6px;font-size:0.76rem;">
            <div>
              <strong>${esc(r.merchant_name || 'Global')}</strong> · ${Number(r.cashback_pct)}%
              <div style="font-size:0.68rem;color:#64748b;">Split Comercio ${Number(r.split_merchant_pct)}% / Mutual ${Number(r.split_mutual_pct)}%</div>
            </div>
            <button type="button" class="mp-btn" onclick="window.toggleCashbackMp('${esc(r.id)}')">${r.is_active ? '⏸️ Pausar' : '▶️ Activar'}</button>
          </div>
        `).join('');
      }
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
      msgLines.push(`• PIN transaccional temporal (4 dígitos): ${info.temporary_pin}`);
    }
    msgLines.push('Te recomendamos cambiar la clave/PIN luego del primer ingreso.');
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
          ${info.temporary_pin ? `<div><div style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;">PIN Transaccional Temporal</div><code style="font-size:0.86rem;font-weight:800;color:#0369a1;">${esc(info.temporary_pin)}</code></div>` : ''}
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
    if (info.temporary_pin) lines.push(`PIN temporal: ${info.temporary_pin}`);
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
          '<th>Asociado</th><th>DNI</th><th>Usuario / Email Login</th><th>Cuenta Auth</th><th>PIN App</th><th>Último Ingreso</th><th>Cruce AMMER</th><th>Acción</th>' +
          '</tr></thead><tbody>';
        asocs.forEach((a) => {
          const authBadge = a.has_auth_account
            ? `<span style="color:#059669;font-weight:700;font-size:0.74rem;">✅ Activa${a.email_confirmed ? ' (Verif.)' : ''}</span>`
            : '<span style="color:#b45309;font-weight:700;font-size:0.74rem;">⚠️ Sin Auth</span>';
          const pinBadge = a.has_transaction_pin
            ? '<span style="color:#0369a1;font-weight:700;font-size:0.74rem;">🔒 Configurado</span>'
            : '<span style="color:#94a3b8;font-size:0.74rem;">Sin PIN</span>';
          html += `<tr>
            <td><strong>${esc(a.full_name || '—')}</strong><div style="font-size:0.68rem;color:#64748b;">KYC: ${esc(a.kyc_status || '—')}</div></td>
            <td><code>${esc(a.dni || '—')}</code></td>
            <td><code>${esc(a.login_email || a.email || '—')}</code></td>
            <td>${authBadge}</td>
            <td>${pinBadge}</td>
            <td style="font-size:0.73rem;">${a.last_sign_in_at ? fmtFecha(a.last_sign_in_at) : 'Nunca'}</td>
            <td>${badgeAmmerCruce(a.ammer_cruce)}</td>
            <td><div style="display:flex;gap:4px;flex-wrap:wrap;">
              <button type="button" class="mp-btn mp-btn-primary" onclick="window.resetAccesoAsociadoMp('${esc(a.id)}', false)">🔑 Blanquear Clave</button>
              <button type="button" class="mp-btn" onclick="window.resetAccesoAsociadoMp('${esc(a.id)}', true)">🔢 + PIN</button>
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
            <td><button type="button" class="mp-btn mp-btn-primary" onclick="window.resetAccesoComercioMp('${esc(m.id)}')">🔑 ${m.has_auth_account ? 'Blanquear Clave' : 'Habilitar Acceso'}</button></td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        comBox.innerHTML = html;
      }
    }
  }

  async function resetAccesoAsociadoMp(associateId, generateTempPin = false) {
    const msg = generateTempPin
      ? '¿Generar nueva clave temporal y PIN de 4 dígitos temporal para este Asociado?'
      : '¿Habilitar o blanquear la clave temporal de acceso de este Asociado?';
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
        <div style="font-size:0.82rem;font-weight:800;color:#0f172a;">Alta de Asociado en Mutual Pay (con usuario Supabase Auth)</div>
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
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;color:#334155;font-weight:600;cursor:pointer;">
          <input type="checkbox" id="chkMpAsocPin" checked />
          Generar PIN transaccional QR temporal (4 dígitos)
        </label>
        <div style="display:flex;gap:8px;">
          <button type="button" id="btnMpCrearAsociadoSubmit" class="mp-btn mp-btn-success" onclick="window.crearAsociadoMp()">💾 Crear Asociado y Generar Clave</button>
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
        html += `<button type="button" class="mp-btn" style="background:#eff6ff;border-color:#93c5fd;color:#1e3a8a;font-size:0.72rem;" onclick="window.usarAsociadoAmmerEnFormMp(${idx})">` +
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
      toast('Asociado creado en Mutual Pay.');
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

  function initMutualPayBackoffice() {
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
  global.abrirEnSimuladorDesdeMp = abrirEnSimuladorDesdeMp;
  global.exportarLiquidacionesMutualPayCsv = exportarLiquidacionesMutualPayCsv;
  global.toggleFormNuevoComercioMp = toggleFormNuevoComercioMp;
  global.crearComercioMp = crearComercioMp;
  global.renderTablaComerciosMutualPay = renderTablaComerciosMutualPay;
  global.guardarParamComercioMp = guardarParamComercioMp;
  global.anularTxMp = anularTxMp;
  global.verificarCobranzaMp = verificarCobranzaMp;
  global.guardarReglaFinancieraMp = guardarReglaFinancieraMp;
  global.toggleCashbackMp = toggleCashbackMp;
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
