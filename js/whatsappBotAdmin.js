// ============================================================================
// MÓDULO ADMIN: CENTRO MULTI-LÍNEA WHATSAPP BOT AMMER
// Exclusivo rol Admin: múltiples sesiones QR, apertura/cierre de sesión y
// configuración de enrutamiento por tipo de acción.
// ============================================================================
(function (global) {
  'use strict';

  let pollTimer = null;
  let lastPanelData = null;
  let isFetching = false;

  function _esc(str) {
    if (typeof global.sanitizeHTML === 'function') return global.sanitizeHTML(str);
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function _toast(msg, tipo) {
    if (typeof global.showToast === 'function') {
      global.showToast(msg, tipo || 'info');
    }
  }

  function _getApiBase() {
    if (typeof global.RENDER_API_URL === 'string' && global.RENDER_API_URL.startsWith('http')) {
      return global.RENDER_API_URL;
    }
    try {
      if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
        return RENDER_API_URL;
      }
    } catch (_) {}
    return '';
  }

  function _getFetchFn() {
    if (typeof global.fetchConTimeout === 'function') return global.fetchConTimeout;
    try {
      if (typeof fetchConTimeout === 'function') return fetchConTimeout;
    } catch (_) {}
    return null;
  }

  function _esAdmin() {
    return typeof global.esAdminAuditoria === 'function' && global.esAdminAuditoria();
  }

  function detenerPollingWhatsappBotAdmin() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function _badgeEstado(sesion) {
    const st = String((sesion && sesion.status) || 'DISCONNECTED').toUpperCase();
    if (sesion && (sesion.connected || st === 'READY')) {
      const tel = sesion.phoneMasked ? ` (${_esc(sesion.phoneMasked)})` : '';
      return {
        text: `🟢 Conectado${tel}`,
        bg: '#ecfdf5',
        fg: '#15803d',
        border: '#86efac'
      };
    }
    if (st === 'WAITING_QR') {
      return {
        text: '🟡 Esperando escaneo QR',
        bg: '#fffbeb',
        fg: '#b45309',
        border: '#fde68a'
      };
    }
    if (st === 'CONNECTING') {
      return {
        text: '🔄 Conectando / Generando QR...',
        bg: '#eff6ff',
        fg: '#1d4ed8',
        border: '#bfdbfe'
      };
    }
    if (st === 'CLOSED' || st === 'LOGGED_OUT') {
      return {
        text: '⚪ Sesión cerrada',
        bg: '#f8fafc',
        fg: '#475569',
        border: '#cbd5e1'
      };
    }
    return {
      text: `🔴 ${_esc(st || 'DESCONECTADO')}`,
      bg: '#fef2f2',
      fg: '#b91c1c',
      border: '#fecaca'
    };
  }

  function _renderSidebarIndicator(sesiones) {
    const dot = document.getElementById('navWaBotStatusDot');
    if (!dot) return;
    const list = Array.isArray(sesiones) ? sesiones : [];
    const connectedCount = list.filter((s) => s && (s.connected || s.status === 'READY')).length;
    if (connectedCount > 0) {
      dot.textContent = String(connectedCount);
      dot.style.display = 'inline-flex';
      dot.style.background = '#16a34a';
      dot.style.color = '#ffffff';
    } else if (list.length > 0) {
      dot.textContent = '0';
      dot.style.display = 'inline-flex';
      dot.style.background = '#f59e0b';
      dot.style.color = '#ffffff';
    } else {
      dot.style.display = 'none';
    }
  }

  function _accionesAsignadasASesion(sid, rutas, acciones) {
    const mapAcc = new Map((acciones || []).map((a) => [a.key, a.label]));
    const res = [];
    Object.keys(rutas || {}).forEach((k) => {
      if (rutas[k] === sid) {
        res.push(mapAcc.get(k) || k);
      }
    });
    return res;
  }

  function renderPanelWhatsappBot(data) {
    lastPanelData = data || null;
    const kpiBox = document.getElementById('waBotSummaryKpis');
    const warnBox = document.getElementById('waBotWorkerNotice');
    const gridEl = document.getElementById('waBotSessionsGrid');
    const rutasEl = document.getElementById('waBotRoutingContainer');
    const chkFallback = document.getElementById('chkWaBotFallbackAuto');
    const selTestLine = document.getElementById('selWaBotTestSession');
    if (!gridEl || !rutasEl) return;

    const sesiones = Array.isArray(data?.sesiones) ? data.sesiones : [];
    const acciones = Array.isArray(data?.acciones) ? data.acciones : [];
    const cfg = data?.config || {};
    const rutas = cfg.rutas || {};
    const aliases = cfg.aliases || {};

    _renderSidebarIndicator(sesiones);

    const readyCount = sesiones.filter((s) => s.connected || s.status === 'READY').length;
    const qrCount = sesiones.filter((s) => s.status === 'WAITING_QR' || s.status === 'CONNECTING').length;
    if (kpiBox) {
      kpiBox.innerHTML =
        `<span style="padding:4px 10px;border-radius:9999px;font-size:0.75rem;font-weight:800;background:${readyCount > 0 ? '#ecfdf5' : '#fef2f2'};color:${readyCount > 0 ? '#15803d' : '#b91c1c'};border:1px solid ${readyCount > 0 ? '#86efac' : '#fecaca'};">` +
          `${readyCount > 0 ? '🟢' : '🔴'} ${readyCount} de ${sesiones.length} líneas conectadas` +
        `</span>` +
        (qrCount > 0
          ? `<span style="padding:4px 10px;border-radius:9999px;font-size:0.75rem;font-weight:700;background:#fffbeb;color:#b45309;border:1px solid #fde68a;">📷 ${qrCount} esperando QR</span>`
          : '') +
        `<span style="padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;">Máx. ${Number(data?.maxSessions || 8)} sesiones</span>`;
    }

    if (warnBox) {
      if (data && data.configured === false) {
        warnBox.style.display = 'block';
        warnBox.style.background = '#fff7ed';
        warnBox.style.borderColor = '#fed7aa';
        warnBox.style.color = '#9a3412';
        warnBox.innerHTML = '⚙️ <strong>Worker WhatsApp no configurado en Render:</strong> cargá <code>WHATSAPP_WORKER_URL</code> y <code>WHATSAPP_WORKER_SECRET</code> en Environment para habilitar la gestión de sesiones.';
      } else if (data && data.ok === false) {
        warnBox.style.display = 'block';
        warnBox.style.background = '#fef2f2';
        warnBox.style.borderColor = '#fecaca';
        warnBox.style.color = '#991b1b';
        warnBox.innerHTML = '⚠️ <strong>Worker temporalmente inaccesible:</strong> ' + _esc(data.mensaje || 'Verificá el servicio en Northflank.');
      } else if (data && data.multiSessionSupported === false) {
        warnBox.style.display = 'block';
        warnBox.style.background = '#eff6ff';
        warnBox.style.borderColor = '#bfdbfe';
        warnBox.style.color = '#1e40af';
        warnBox.innerHTML = 'ℹ️ <strong>Modo compatibilidad de 1 línea activo:</strong> la línea principal funciona normalmente. Cuando se actualice el servicio en Northflank con la nueva versión de <code>sidecreer-whatsapp-worker</code>, se habilitará automáticamente la creación de múltiples líneas QR simultáneas.';
      } else {
        warnBox.style.display = 'none';
      }
    }

    if (sesiones.length === 0) {
      gridEl.innerHTML =
        '<div style="grid-column:1 / -1;padding:1.5rem;border-radius:12px;border:1px dashed #cbd5e1;background:#f8fafc;text-align:center;color:#64748b;font-size:0.84rem;">' +
          'No hay líneas WhatsApp disponibles todavía. Usá <strong>“➕ Agregar Nueva Línea QR”</strong> o verificá la conexión con el worker.' +
        '</div>';
    } else {
      gridEl.innerHTML = sesiones.map((s) => {
        const sid = String(s.sessionId || '');
        const aliasVal = aliases[sid] || s.alias || (s.isDefault ? 'Línea Principal' : sid);
        const badge = _badgeEstado(s);
        const isReady = Boolean(s.connected || s.status === 'READY');
        const isClosed = s.status === 'CLOSED' || s.status === 'DISCONNECTED' || s.status === 'LOGGED_OUT';
        const hasQr = s.status === 'WAITING_QR' && s.qrDataUrl;
        const asigList = _accionesAsignadasASesion(sid, rutas, acciones);
        const chipsHtml = asigList.length > 0
          ? asigList.map((lbl) => `<span style="display:inline-flex;padding:2px 7px;border-radius:6px;background:#eef2ff;color:#3730a3;font-size:0.68rem;font-weight:700;">${_esc(lbl)}</span>`).join(' ')
          : '<span style="font-size:0.7rem;color:#94a3b8;">Sin acciones asignadas</span>';

        const safeSid = _esc(sid);
        const safeSidJs = sid.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return (
          `<div style="background:#ffffff;border:1px solid ${isReady ? '#86efac' : '#cbd5e1'};border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.7rem;box-shadow:0 2px 8px rgba(15,23,42,0.05);">` +
            `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">` +
              `<div style="flex:1;min-width:170px;">` +
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">` +
                  `<input type="text" data-wa-alias-sid="${safeSid}" value="${_esc(aliasVal)}" maxlength="60" placeholder="Nombre de la línea" style="font-size:0.88rem;font-weight:800;color:#0f172a;border:1px solid #e2e8f0;border-radius:7px;padding:4px 8px;width:100%;max-width:230px;background:#f8fafc;"/>` +
                  (s.isDefault ? '<span style="padding:2px 7px;border-radius:9999px;background:#0f2744;color:#ffffff;font-size:0.65rem;font-weight:800;">PRINCIPAL</span>' : '') +
                `</div>` +
                `<div style="font-size:0.71rem;color:#64748b;font-family:var(--font-mono,monospace);">ID: ${safeSid}${s.displayName ? ' · ' + _esc(s.displayName) : ''}</div>` +
              `</div>` +
              `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:9999px;font-size:0.72rem;font-weight:800;background:${badge.bg};color:${badge.fg};border:1px solid ${badge.border};">${badge.text}</span>` +
            `</div>` +

            `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">` +
              `<span style="font-size:0.7rem;font-weight:700;color:#475569;margin-right:2px;">Acciones:</span>${chipsHtml}` +
            `</div>` +

            (hasQr
              ? `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:0.85rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">` +
                  `<img src="${_esc(s.qrDataUrl)}" alt="Código QR ${_esc(aliasVal)}" style="width:210px;height:210px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;"/>` +
                  `<div style="font-size:0.72rem;color:#334155;text-align:center;line-height:1.4;">Abrí WhatsApp en el teléfono → <strong>Dispositivos vinculados → Vincular dispositivo</strong> y escaneá este QR.</div>` +
                `</div>`
              : '') +

            (s.lastError && !isReady
              ? `<div style="font-size:0.72rem;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:0.45rem 0.6rem;">⚠️ ${_esc(s.lastError)}</div>`
              : '') +

            `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:4px;border-top:1px solid #f1f5f9;">` +
              (isClosed
                ? `<button type="button" onclick="window.abrirSesionWhatsappBotAdmin('${safeSidJs}')" style="flex:1;min-width:130px;padding:0.48rem 0.75rem;border-radius:8px;border:none;background:#16a34a;color:#ffffff;font-size:0.75rem;font-weight:800;cursor:pointer;">🔓 Abrir Sesión / Escanear QR</button>`
                : `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'cerrar')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:0.74rem;font-weight:700;cursor:pointer;">⏸️ Cerrar Sesión</button>` +
                  `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'desvincular_nuevo_qr')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:0.74rem;font-weight:700;cursor:pointer;">🔄 Cambiar Nro / Nuevo QR</button>`
              ) +
              (!s.isDefault
                ? `<button type="button" onclick="window.eliminarSesionWhatsappBotAdmin('${safeSidJs}')" title="Eliminar línea adicional" style="padding:0.45rem 0.65rem;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:0.74rem;font-weight:700;cursor:pointer;">🗑️</button>`
                : '') +
            `</div>` +
          `</div>`
        );
      }).join('');
    }

    // Construir opciones de líneas para selects
    const optsHtml = (selectedSid) => {
      const seen = new Set();
      const allSids = [];
      sesiones.forEach((s) => {
        if (s.sessionId && !seen.has(s.sessionId)) {
          seen.add(s.sessionId);
          allSids.push(s);
        }
      });
      if (selectedSid && !seen.has(selectedSid)) {
        allSids.push({ sessionId: selectedSid, status: 'DISCONNECTED', alias: aliases[selectedSid] || selectedSid });
      }
      if (allSids.length === 0) {
        allSids.push({ sessionId: 'sidecreer_default', status: 'DISCONNECTED', alias: 'Línea Principal' });
      }
      return allSids.map((s) => {
        const sid = s.sessionId;
        const lbl = aliases[sid] || s.alias || sid;
        const stTag = s.connected ? `🟢 ${s.phoneMasked || 'Conectado'}` : (s.status || 'Sin conexión');
        const sel = sid === selectedSid ? ' selected' : '';
        return `<option value="${_esc(sid)}"${sel}>${_esc(lbl)} (${_esc(stTag)})</option>`;
      }).join('');
    };

    rutasEl.innerHTML = acciones.map((acc) => {
      const aKey = String(acc.key || '');
      const selected = rutas[aKey] || data?.defaultSessionId || 'sidecreer_default';
      return (
        `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0.75rem 0.9rem;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">` +
          `<div style="flex:1;min-width:220px;">` +
            `<div style="font-size:0.83rem;font-weight:800;color:#0f172a;">${_esc(acc.label || aKey)}</div>` +
            `<div style="font-size:0.73rem;color:#64748b;margin-top:2px;">${_esc(acc.description || '')}</div>` +
          `</div>` +
          `<select data-wa-route-action="${_esc(aKey)}" style="min-width:240px;max-width:100%;padding:0.48rem 0.65rem;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-size:0.8rem;font-weight:700;">` +
            optsHtml(selected) +
          `</select>` +
        `</div>`
      );
    }).join('');

    if (chkFallback) {
      chkFallback.checked = cfg.fallback_automatico !== false;
    }

    if (selTestLine) {
      const prevVal = selTestLine.value;
      selTestLine.innerHTML = optsHtml(prevVal || data?.defaultSessionId || 'sidecreer_default');
    }

    // Activar auto-refresh si alguna línea está generando QR o conectando y seguimos en esta vista
    const viewEl = document.getElementById('view-whatsapp-bot');
    const enVista = viewEl && viewEl.classList.contains('active');
    if (enVista && qrCount > 0) {
      if (!pollTimer) {
        pollTimer = setInterval(() => {
          const v = document.getElementById('view-whatsapp-bot');
          if (!v || !v.classList.contains('active')) {
            detenerPollingWhatsappBotAdmin();
            return;
          }
          cargarPanelWhatsappBotAdmin(true);
        }, 4200);
      }
    } else if (!enVista || qrCount === 0) {
      detenerPollingWhatsappBotAdmin();
    }
  }

  async function cargarPanelWhatsappBotAdmin(silencioso = false) {
    if (!_esAdmin()) return;
    if (isFetching) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) {
      renderPanelWhatsappBot({ ok: false, configured: false, sesiones: [], acciones: [], mensaje: 'Falta RENDER_API_URL.' });
      return;
    }
    isFetching = true;
    const btnRefresh = document.getElementById('btnWaBotRefresh');
    if (btnRefresh && !silencioso) btnRefresh.disabled = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/panel`, { method: 'GET' }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data) {
        throw new Error((data && (data.detail || data.mensaje)) || `HTTP ${resp ? resp.status : 'sin respuesta'}`);
      }
      renderPanelWhatsappBot(data);
    } catch (err) {
      if (!silencioso) {
        _toast('⚠️ No se pudo consultar WhatsApp Bot: ' + (err?.message || 'Error'), 'warning');
      }
    } finally {
      isFetching = false;
      if (btnRefresh) btnRefresh.disabled = false;
    }
  }

  function initWhatsappBotPanelAdmin() {
    if (!_esAdmin()) {
      _toast('⛔ Solo usuarios Admin pueden acceder a WhatsApp Bot.', 'error');
      return;
    }
    cargarPanelWhatsappBotAdmin(false);
  }

  async function crearNuevaLineaWhatsappBotAdmin() {
    if (!_esAdmin()) return;
    const inpAlias = document.getElementById('inpWaBotNuevoAlias');
    const alias = String(inpAlias?.value || '').trim();
    const slug = alias
      ? alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32)
      : '';
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;

    const btn = document.getElementById('btnWaBotCrearLinea');
    if (btn) btn.disabled = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/sesiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: slug || undefined, alias: alias || undefined })
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'No se pudo crear la nueva línea');
      }
      if (inpAlias) inpAlias.value = '';
      _toast('✅ Nueva línea iniciada. Aguardá unos segundos a que aparezca el código QR.', 'success');
      await cargarPanelWhatsappBotAdmin(false);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'No se pudo crear la línea WhatsApp.'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function abrirSesionWhatsappBotAdmin(sessionId) {
    if (!_esAdmin()) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/sesiones/${encodeURIComponent(sessionId)}/conectar`, {
        method: 'POST'
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok) {
        throw new Error((data && (data.detail || data.error)) || 'Error iniciando sesión');
      }
      _toast('🔄 Abriendo sesión y generando código QR...', 'info');
      setTimeout(() => cargarPanelWhatsappBotAdmin(false), 900);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error abriendo sesión'), 'error');
    }
  }

  async function cerrarSesionWhatsappBotAdmin(sessionId, modo) {
    if (!_esAdmin()) return;
    const msgConfirm = modo === 'cerrar'
      ? `¿Confirmás cerrar la sesión de la línea "${sessionId}"? Quedará desconectada hasta que vuelvas a abrirla escaneando el QR.`
      : `¿Confirmás desvincular el número actual de "${sessionId}" y generar un nuevo código QR para vincular otro (o el mismo) teléfono?`;
    if (!global.confirm(msgConfirm)) return;

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/sesiones/${encodeURIComponent(sessionId)}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: modo || 'cerrar', cerrarSolo: modo === 'cerrar' })
      }, 22000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok) {
        throw new Error((data && (data.detail || data.error)) || 'Error cerrando sesión');
      }
      _toast(modo === 'cerrar' ? '⏸️ Sesión cerrada.' : '🔄 Desvinculada. Generando nuevo código QR...', 'success');
      setTimeout(() => cargarPanelWhatsappBotAdmin(false), 1000);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'No se pudo cerrar la sesión.'), 'error');
    }
  }

  async function eliminarSesionWhatsappBotAdmin(sessionId) {
    if (!_esAdmin()) return;
    if (!global.confirm(`¿Eliminar permanentemente la línea adicional "${sessionId}"?`)) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/sesiones/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok) {
        throw new Error((data && (data.detail || data.error)) || 'No se pudo eliminar');
      }
      _toast('🗑️ Línea eliminada.', 'success');
      await cargarPanelWhatsappBotAdmin(false);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error eliminando línea'), 'error');
    }
  }

  async function guardarConfigWhatsappBotAdmin() {
    if (!_esAdmin()) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;

    const aliases = Object.assign({}, lastPanelData?.config?.aliases || {});
    document.querySelectorAll('[data-wa-alias-sid]').forEach((inp) => {
      const sid = inp.getAttribute('data-wa-alias-sid');
      const val = String(inp.value || '').trim();
      if (sid && val) aliases[sid] = val;
    });

    const rutas = Object.assign({}, lastPanelData?.config?.rutas || {});
    document.querySelectorAll('[data-wa-route-action]').forEach((sel) => {
      const act = sel.getAttribute('data-wa-route-action');
      if (act && sel.value) rutas[act] = sel.value;
    });

    const chkFallback = document.getElementById('chkWaBotFallbackAuto');
    const fallbackAuto = chkFallback ? Boolean(chkFallback.checked) : true;

    const btn = document.getElementById('btnWaBotGuardarConfig');
    if (btn) btn.disabled = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliases, rutas, fallback_automatico: fallbackAuto })
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'Error guardando configuración');
      }
      _toast('✅ Configuración de líneas y acciones guardada.', 'success');
      await cargarPanelWhatsappBotAdmin(false);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'No se pudo guardar la configuración'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function probarEnvioWhatsappBotAdmin() {
    if (!_esAdmin()) return;
    const selLine = document.getElementById('selWaBotTestSession');
    const inpTel = document.getElementById('inpWaBotTestPhone');
    const inpMsg = document.getElementById('inpWaBotTestMsg');
    const tel = String(inpTel?.value || '').trim();
    const msg = String(inpMsg?.value || '').trim() || 'Mensaje de prueba desde AMMER WhatsApp Bot.';
    if (tel.replace(/\D/g, '').length < 10) {
      _toast('⚠️ Ingresá un número de WhatsApp válido (ej: 549343...).', 'warning');
      if (inpTel) inpTel.focus();
      return;
    }
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;

    const btn = document.getElementById('btnWaBotProbarEnvio');
    if (btn) btn.disabled = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/probar-envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selLine?.value || undefined, telefono: tel, mensaje: msg })
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'No se pudo enviar la prueba');
      }
      _toast(`✅ Mensaje de prueba enviado vía ${data.sessionId || 'bot'}.`, 'success');
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error enviando prueba'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function enviarMensajeViaBotAmmerConFallback(telefonoRaw, mensaje, fallbackCallback) {
    const telDigits = String(telefonoRaw || '').replace(/\D/g, '');
    if (telDigits.length < 8 || !String(mensaje || '').trim()) {
      if (typeof fallbackCallback === 'function') fallbackCallback();
      return { ok: false, fallback: true };
    }
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) {
      if (typeof fallbackCallback === 'function') fallbackCallback();
      return { ok: false, fallback: true };
    }
    try {
      const resp = await fetchFn(`${apiBase}/api/whatsapp/enviar-propuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: telefonoRaw, mensaje })
      }, 15000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (resp && resp.ok && data && data.enviado_por_bot) {
        _toast(`✅ Enviado automáticamente por Bot WhatsApp (${data.sessionId || 'línea comercial'}).`, 'success');
        return { ok: true, data };
      }
      if (data && data.wa_link) {
        _toast('ℹ️ Bot desconectado para propuestas; abriendo WhatsApp Web...', 'info');
        global.open(data.wa_link, '_blank', 'noopener,noreferrer');
        return { ok: false, fallback: true };
      }
    } catch (_) {}
    if (typeof fallbackCallback === 'function') fallbackCallback();
    return { ok: false, fallback: true };
  }

  global.initWhatsappBotPanelAdmin = initWhatsappBotPanelAdmin;
  global.cargarPanelWhatsappBotAdmin = cargarPanelWhatsappBotAdmin;
  global.detenerPollingWhatsappBotAdmin = detenerPollingWhatsappBotAdmin;
  global.crearNuevaLineaWhatsappBotAdmin = crearNuevaLineaWhatsappBotAdmin;
  global.abrirSesionWhatsappBotAdmin = abrirSesionWhatsappBotAdmin;
  global.cerrarSesionWhatsappBotAdmin = cerrarSesionWhatsappBotAdmin;
  global.eliminarSesionWhatsappBotAdmin = eliminarSesionWhatsappBotAdmin;
  global.guardarConfigWhatsappBotAdmin = guardarConfigWhatsappBotAdmin;
  global.probarEnvioWhatsappBotAdmin = probarEnvioWhatsappBotAdmin;
  global.enviarMensajeViaBotAmmerConFallback = enviarMensajeViaBotAmmerConFallback;
})(window);
