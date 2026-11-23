// ============================================================================
// MÓDULO ADMIN: CENTRO MULTI-LÍNEA Y MENSAJERÍA WHATSAPP COMPLETA AMMER
// Exclusivo rol Admin: múltiples sesiones QR, apertura/cierre de sesión,
// enrutamiento por acción y mensajería directa con fotos, archivos, audio y
// botones de acción / respuestas predefinidas.
// ============================================================================
(function (global) {
  'use strict';

  const LS_RECENT_CHATS_KEY = 'AMMER_WA_RECENT_CHATS_V1';
  const LS_QUICK_REPLIES_KEY = 'AMMER_WA_QUICK_REPLIES_V1';
  const LS_LOCAL_MSGS_KEY = 'AMMER_WA_LOCAL_MSGS_V1';
  const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

  const DEFAULT_QUICK_REPLIES = [
    {
      id: 'qr_saludo',
      title: '👋 Saludo AMMER',
      text: 'Hola {nombre}, te saludamos desde Asociación Mutual Modelo de Entre Ríos (AMMER). ¿En qué podemos ayudarte?'
    },
    {
      id: 'qr_recibo',
      title: '📄 Pedir Recibo',
      text: 'Hola {nombre}, para avanzar con tu evaluación necesitamos que nos envíes por acá tu último recibo de haberes en PDF o foto nítida.'
    },
    {
      id: 'qr_dni',
      title: '🪪 Pedir DNI',
      text: 'Hola {nombre}, por favor envianos foto nítida del frente y dorso de tu DNI para completar la validación de identidad.'
    },
    {
      id: 'qr_firma',
      title: '✍️ Recordar Firma',
      text: 'Hola {nombre}, te recordamos que tenés documentación pendiente de firma electrónica en AMMER. Avisanos si necesitás que te reenviemos el enlace.'
    },
    {
      id: 'qr_sidecreer',
      title: '💳 Saldo Sidecreer',
      text: 'Hola {nombre}, ¿podrías confirmarnos tu número de tarjeta Sidecreer o si querés que verifiquemos tu disponible actualizado?'
    },
    {
      id: 'qr_acreditado',
      title: '✅ Acreditación',
      text: '¡Buenas noticias {nombre}! Tu gestión en Mutual Modelo fue aprobada y acreditada correctamente. Ante cualquier consulta estamos a disposición.'
    },
    {
      id: 'qr_horarios',
      title: '📍 Horarios Sede',
      text: 'Te atendemos en Mutual Modelo de Entre Ríos de lunes a viernes de 8:00 a 16:00 hs. Podés respondernos directamente por este medio.'
    }
  ];

  const QUICK_EMOJIS = ['✅', '👋', '📄', '🪪', '💳', '✍️', '💰', '📞', '📍', '⏰', '🙏', '🤝', '⚠️', '🎉', '👍', '📎'];

  let pollTimer = null;
  let lastPanelData = null;
  let isFetching = false;
  let activeTab = 'mensajeria';
  let userPickedTab = false;
  let searchDebounceTimer = null;

  let activeContact = null; // { phone, name, dni, organismo }
  let pendingAttachment = null; // { kind: 'image'|'document'|'audio', base64, mimetype, fileName, size, objectUrl, ptt }
  let buttonsBuilderOpen = false;
  let builderOptions = ['Sí, confirmo', 'Necesito asistencia'];
  let isSendingCustom = false;

  // Caché de mensajes en sesión (incluye previsualizaciones locales y mensajes sincronizados del worker)
  let remoteMessagesByPhone = new Map();
  let sessionMediaPreviewUrls = new Map(); // id -> objectUrl para fotos/audios enviados en la sesión actual

  // Estado de grabación de audio
  let mediaRecorder = null;
  let recordingStream = null;
  let recordingChunks = [];
  let recordingTimerId = null;
  let recordingStartedAt = 0;
  let recordingAnimId = null;
  let recordingAudioCtx = null;
  let recordingMimeType = '';

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

  function _normalizarTelefonoWa(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    digits = digits.replace(/^0+/, '');
    if (!digits.startsWith('54') && digits.length >= 10 && digits.length <= 11) {
      digits = '549' + digits;
    } else if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
      digits = '549' + digits.slice(2);
    }
    return digits;
  }

  function _formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function _formatHora(isoStr) {
    try {
      const d = isoStr ? new Date(isoStr) : new Date();
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function _initials(name, phone) {
    const clean = String(name || '').trim();
    if (clean && !/^\+?\d+$/.test(clean)) {
      const parts = clean.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return clean.slice(0, 2).toUpperCase();
    }
    const dig = String(phone || '').replace(/\D/g, '');
    return dig ? dig.slice(-2) : 'WA';
  }

  function _getQuickReplies() {
    try {
      const raw = localStorage.getItem(LS_QUICK_REPLIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_QUICK_REPLIES.slice();
  }

  function _saveQuickReplies(list) {
    try {
      localStorage.setItem(LS_QUICK_REPLIES_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function _getRecentChats() {
    try {
      const raw = localStorage.getItem(LS_RECENT_CHATS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function _saveRecentChats(list) {
    try {
      localStorage.setItem(LS_RECENT_CHATS_KEY, JSON.stringify((list || []).slice(0, 25)));
    } catch (_) {}
  }

  function _upsertRecentChat(contact, lastPreview) {
    const phone = _normalizarTelefonoWa(contact?.phone || '');
    if (phone.length < 10) return;
    const current = _getRecentChats().filter((c) => _normalizarTelefonoWa(c.phone) !== phone);
    const existing = _getRecentChats().find((c) => _normalizarTelefonoWa(c.phone) === phone) || {};
    const updated = {
      phone,
      name: String(contact?.name || existing.name || `+${phone}`).trim(),
      dni: String(contact?.dni || existing.dni || '').trim(),
      organismo: String(contact?.organismo || existing.organismo || '').trim(),
      lastText: lastPreview !== undefined ? String(lastPreview).slice(0, 90) : (existing.lastText || ''),
      updatedAt: new Date().toISOString()
    };
    current.unshift(updated);
    _saveRecentChats(current);
    _renderRecentChatsList();
  }

  function _getLocalMessagesMap() {
    try {
      const raw = localStorage.getItem(LS_LOCAL_MSGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function _appendLocalMessage(phone, msgObj) {
    const tel = _normalizarTelefonoWa(phone);
    if (!tel) return;
    const all = _getLocalMessagesMap();
    const arr = Array.isArray(all[tel]) ? all[tel] : [];
    arr.push({
      id: msgObj.id || `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromMe: true,
      kind: msgObj.kind || 'text',
      text: String(msgObj.text || ''),
      fileName: msgObj.fileName || null,
      mimetype: msgObj.mimetype || null,
      pollOptions: Array.isArray(msgObj.pollOptions) ? msgObj.pollOptions : null,
      sessionAlias: msgObj.sessionAlias || null,
      timestamp: msgObj.timestamp || new Date().toISOString()
    });
    all[tel] = arr.slice(-40);
    // Limitar llaves guardadas a los últimos 25 chats
    const keys = Object.keys(all);
    if (keys.length > 25) {
      keys.slice(0, keys.length - 25).forEach((k) => delete all[k]);
    }
    try {
      localStorage.setItem(LS_LOCAL_MSGS_KEY, JSON.stringify(all));
    } catch (_) {}
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

  function cambiarTabWhatsappBotAdmin(tabKey, manual = true) {
    const next = tabKey === 'lineas' ? 'lineas' : 'mensajeria';
    if (manual) userPickedTab = true;
    activeTab = next;

    const btnMsg = document.getElementById('btnWaTabMensajeria');
    const btnLin = document.getElementById('btnWaTabLineas');
    const panelMsg = document.getElementById('waTabPanelMensajeria');
    const panelLin = document.getElementById('waTabPanelLineas');

    if (btnMsg) {
      btnMsg.classList.toggle('active', next === 'mensajeria');
      btnMsg.setAttribute('aria-selected', next === 'mensajeria' ? 'true' : 'false');
    }
    if (btnLin) {
      btnLin.classList.toggle('active', next === 'lineas');
      btnLin.setAttribute('aria-selected', next === 'lineas' ? 'true' : 'false');
    }
    if (panelMsg) panelMsg.classList.toggle('active', next === 'mensajeria');
    if (panelLin) panelLin.classList.toggle('active', next === 'lineas');
  }

  function usarLineaEnMensajeriaWa(sessionId) {
    const selLine = document.getElementById('selWaBotTestSession');
    if (selLine && sessionId) {
      selLine.value = sessionId;
    }
    onWaComposerSessionChange();
    cambiarTabWhatsappBotAdmin('mensajeria', true);
    const inpMsg = document.getElementById('inpWaBotTestMsg');
    if (inpMsg) inpMsg.focus();
  }

  function onWaComposerSessionChange() {
    const selLine = document.getElementById('selWaBotTestSession');
    const badgeEl = document.getElementById('waComposerLineStatusBadge');
    if (!selLine || !badgeEl) return;
    const sid = selLine.value;
    const sesiones = Array.isArray(lastPanelData?.sesiones) ? lastPanelData.sesiones : [];
    const ses = sesiones.find((s) => s.sessionId === sid);
    if (!ses) {
      badgeEl.textContent = 'Sin datos';
      badgeEl.style.color = '#64748b';
      return;
    }
    if (ses.connected || ses.status === 'READY') {
      badgeEl.textContent = `🟢 Lista${ses.phoneMasked ? ' · ' + ses.phoneMasked : ''}`;
      badgeEl.style.color = '#15803d';
    } else if (ses.status === 'WAITING_QR') {
      badgeEl.textContent = '🟡 Esperando QR';
      badgeEl.style.color = '#b45309';
    } else {
      badgeEl.textContent = '🔴 Desconectada';
      badgeEl.style.color = '#b91c1c';
    }
    if (activeContact && activeContact.phone) {
      cargarMensajesChatWhatsappAdmin(true);
    }
  }

  function renderPanelWhatsappBot(data) {
    lastPanelData = data || null;
    const kpiBox = document.getElementById('waBotSummaryKpis');
    const warnBox = document.getElementById('waBotWorkerNotice');
    const gridEl = document.getElementById('waBotSessionsGrid');
    const rutasEl = document.getElementById('waBotRoutingContainer');
    const chkFallback = document.getElementById('chkWaBotFallbackAuto');
    const selTestLine = document.getElementById('selWaBotTestSession');
    const tabBadge = document.getElementById('waBotTabLineasBadge');
    if (!gridEl || !rutasEl) return;

    const sesiones = Array.isArray(data?.sesiones) ? data.sesiones : [];
    const acciones = Array.isArray(data?.acciones) ? data.acciones : [];
    const cfg = data?.config || {};
    const rutas = cfg.rutas || {};
    const aliases = cfg.aliases || {};

    _renderSidebarIndicator(sesiones);

    const readyCount = sesiones.filter((s) => s.connected || s.status === 'READY').length;
    const qrCount = sesiones.filter((s) => s.status === 'WAITING_QR' || s.status === 'CONNECTING').length;

    if (!userPickedTab) {
      cambiarTabWhatsappBotAdmin(readyCount === 0 ? 'lineas' : 'mensajeria', false);
    }

    if (tabBadge) {
      if (qrCount > 0) {
        tabBadge.textContent = `${qrCount} QR`;
        tabBadge.classList.add('warn');
        tabBadge.style.display = 'inline-flex';
      } else if (sesiones.length > 0) {
        tabBadge.textContent = `${readyCount}/${sesiones.length}`;
        tabBadge.classList.toggle('warn', readyCount === 0);
        tabBadge.style.display = 'inline-flex';
      } else {
        tabBadge.style.display = 'none';
      }
    }

    if (kpiBox) {
      kpiBox.innerHTML =
        `<span style="padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:800;background:${readyCount > 0 ? 'rgba(22,163,74,0.22)' : 'rgba(239,68,68,0.24)'};color:#ffffff;border:1px solid ${readyCount > 0 ? 'rgba(134,239,172,0.5)' : 'rgba(254,202,202,0.5)'};">` +
          `${readyCount > 0 ? '🟢' : '🔴'} ${readyCount} de ${sesiones.length} líneas conectadas` +
        `</span>` +
        (qrCount > 0
          ? `<span style="padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:rgba(245,158,11,0.24);color:#fef3c7;border:1px solid rgba(253,230,138,0.45);">📷 ${qrCount} esperando QR</span>`
          : '') +
        `<span style="padding:4px 10px;border-radius:9999px;font-size:0.73rem;font-weight:700;background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.92);border:1px solid rgba(255,255,255,0.2);">Máx. ${Number(data?.maxSessions || 8)} líneas</span>`;
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
          'No hay líneas WhatsApp disponibles todavía. Usá <strong>“➕ Nueva Línea QR”</strong> o verificá la conexión con el worker.' +
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
          `<div style="background:#ffffff;border:1px solid ${isReady ? '#86efac' : '#cbd5e1'};border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.72rem;box-shadow:0 2px 10px rgba(15,23,42,0.05);">` +
            `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">` +
              `<div style="flex:1;min-width:170px;">` +
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">` +
                  `<input type="text" data-wa-alias-sid="${safeSid}" value="${_esc(aliasVal)}" maxlength="60" placeholder="Nombre de la línea" style="font-size:0.88rem;font-weight:800;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;width:100%;max-width:230px;background:#f8fafc;"/>` +
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
                  `<img src="${_esc(s.qrDataUrl)}" alt="Código QR ${_esc(aliasVal)}" style="width:200px;height:200px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;"/>` +
                  `<div style="font-size:0.72rem;color:#334155;text-align:center;line-height:1.4;">Abrí WhatsApp en el teléfono → <strong>Dispositivos vinculados → Vincular dispositivo</strong> y escaneá este QR.</div>` +
                `</div>`
              : '') +

            (s.lastError && !isReady
              ? `<div style="font-size:0.72rem;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:0.45rem 0.6rem;">⚠️ ${_esc(s.lastError)}</div>`
              : '') +

            `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:6px;border-top:1px solid #f1f5f9;">` +
              (isReady
                ? `<button type="button" onclick="window.usarLineaEnMensajeriaWa('${safeSidJs}')" style="flex:1;min-width:140px;padding:0.46rem 0.75rem;border-radius:8px;border:none;background:#16a34a;color:#ffffff;font-size:0.74rem;font-weight:800;cursor:pointer;">💬 Escribir desde acá</button>`
                : '') +
              (isClosed
                ? `<button type="button" onclick="window.abrirSesionWhatsappBotAdmin('${safeSidJs}')" style="flex:1;min-width:130px;padding:0.48rem 0.75rem;border-radius:8px;border:none;background:#16a34a;color:#ffffff;font-size:0.75rem;font-weight:800;cursor:pointer;">🔓 Abrir Sesión / Escanear QR</button>`
                : `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'cerrar')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:0.74rem;font-weight:700;cursor:pointer;">⏸️ Cerrar</button>` +
                  `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'desvincular_nuevo_qr')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:0.74rem;font-weight:700;cursor:pointer;">🔄 Nuevo QR</button>`
              ) +
              (!s.isDefault
                ? `<button type="button" onclick="window.eliminarSesionWhatsappBotAdmin('${safeSidJs}')" title="Eliminar línea adicional" style="padding:0.45rem 0.65rem;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:0.74rem;font-weight:700;cursor:pointer;">🗑️</button>`
                : '') +
            `</div>` +
          `</div>`
        );
      }).join('');
    }

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
        `<div style="display:flex;flex-direction:column;gap:8px;padding:0.8rem 0.95rem;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;">` +
          `<div>` +
            `<div style="font-size:0.83rem;font-weight:800;color:#0f172a;">${_esc(acc.label || aKey)}</div>` +
            `<div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${_esc(acc.description || '')}</div>` +
          `</div>` +
          `<select data-wa-route-action="${_esc(aKey)}" style="width:100%;padding:0.46rem 0.65rem;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-size:0.79rem;font-weight:700;">` +
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
      const firstReady = sesiones.find((s) => s.connected || s.status === 'READY')?.sessionId;
      selTestLine.innerHTML = optsHtml(prevVal || firstReady || data?.defaultSessionId || 'sidecreer_default');
      onWaComposerSessionChange();
    }

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

  function _initComposerUI() {
    _renderQuickReplies();
    _renderEmojiPopover();
    _renderRecentChatsList();
    _renderButtonsOptions();
    if (!activeContact) {
      const recents = _getRecentChats();
      if (recents.length > 0) {
        seleccionarContactoWhatsappAdmin(recents[0], false);
      }
    }
  }

  function initWhatsappBotPanelAdmin() {
    if (!_esAdmin()) {
      _toast('⛔ Solo usuarios Admin pueden acceder a WhatsApp Bot.', 'error');
      return;
    }
    _initComposerUI();
    cargarPanelWhatsappBotAdmin(false);
  }

  // ============================================================================
  // BUSCADOR DE CONTACTOS (SOLICITUDES + PADRÓN ASOCIADOS + TELÉFONO DIRECTO)
  // ============================================================================
  function _collectLocalContacts(term) {
    const q = String(term || '').trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const seenPhones = new Set();
    const results = [];

    const addCandidate = (c) => {
      const tel = _normalizarTelefonoWa(c.phone);
      if (tel.length < 10 || seenPhones.has(tel)) return;
      seenPhones.add(tel);
      results.push({
        phone: tel,
        name: String(c.name || `+${tel}`).trim(),
        dni: String(c.dni || '').trim(),
        organismo: String(c.organismo || '').trim(),
        source: c.source || 'Solicitud'
      });
    };

    const solicitudes = Array.isArray(global.estadoApp?.solicitudes) ? global.estadoApp.solicitudes : [];
    for (const s of solicitudes) {
      const phone = s?.telefono || s?.telefono_whatsapp || s?.celular || '';
      const name = s?.nombre || s?.apellido_nombres || s?.titular || '';
      const dni = s?.dni || '';
      if (!phone) continue;
      const hayMatch = !q ||
        String(name).toLowerCase().includes(q) ||
        String(dni).toLowerCase().includes(q) ||
        (qDigits && String(phone).replace(/\D/g, '').includes(qDigits));
      if (hayMatch) {
        addCandidate({ phone, name, dni, organismo: s?.organismo || '', source: 'Solicitud' });
      }
      if (results.length >= 8) break;
    }

    return results;
  }

  function _renderSearchResults(items, rawQuery) {
    const box = document.getElementById('waComposerSearchResults');
    if (!box) return;
    const q = String(rawQuery || '').trim();
    const digits = q.replace(/\D/g, '');

    if (!q) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    let html = (items || []).map((c, idx) => {
      const safeName = _esc(c.name);
      const safePhone = _esc(c.phone);
      const safeDni = _esc(c.dni || '');
      const safeOrg = _esc(c.organismo || c.source || '');
      return (
        `<button type="button" class="wa-search-item" data-wa-pick-idx="${idx}">` +
          `<span class="wa-avatar" style="width:30px;height:30px;font-size:0.7rem;">${_esc(_initials(c.name, c.phone))}</span>` +
          `<span style="min-width:0;flex:1;">` +
            `<div style="font-size:0.78rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>` +
            `<div style="font-size:0.69rem;color:#64748b;">+${safePhone}${safeDni ? ' · DNI ' + safeDni : ''}${safeOrg ? ' · ' + safeOrg : ''}</div>` +
          `</span>` +
        `</button>`
      );
    }).join('');

    if (digits.length >= 8) {
      const norm = _normalizarTelefonoWa(digits);
      html +=
        `<button type="button" class="wa-search-item" data-wa-pick-raw="${_esc(norm)}" style="border-style:dashed;border-color:#16a34a;background:#f0fdf4;">` +
          `<span style="font-size:1rem;">📲</span>` +
          `<span style="min-width:0;flex:1;">` +
            `<div style="font-size:0.77rem;font-weight:800;color:#15803d;">Abrir chat con +${_esc(norm)}</div>` +
            `<div style="font-size:0.68rem;color:#166534;">Número directo ingresado</div>` +
          `</span>` +
        `</button>`;
    }

    if (!html) {
      html = '<div style="padding:0.45rem 0.6rem;font-size:0.74rem;color:#64748b;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">Sin coincidencias. Podés escribir el número abajo y presionar Abrir.</div>';
    }

    box.innerHTML = html;
    box.style.display = 'flex';

    box.querySelectorAll('[data-wa-pick-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-wa-pick-idx'));
        if (items[i]) {
          seleccionarContactoWhatsappAdmin(items[i], true);
          box.style.display = 'none';
        }
      });
    });
    box.querySelectorAll('[data-wa-pick-raw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tel = btn.getAttribute('data-wa-pick-raw');
        seleccionarContactoWhatsappAdmin({ phone: tel, name: `+${tel}`, dni: '' }, true);
        box.style.display = 'none';
      });
    });
  }

  function buscarContactoWhatsappAdmin(query) {
    const localHits = _collectLocalContacts(query);
    _renderSearchResults(localHits, query);

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const qTrim = String(query || '').trim();
    if (qTrim.length < 2) return;

    searchDebounceTimer = setTimeout(async () => {
      const apiBase = _getApiBase();
      const fetchFn = _getFetchFn();
      if (!apiBase || !fetchFn) return;
      try {
        const resp = await fetchFn(`${apiBase}/api/asociados/buscar?q=${encodeURIComponent(qTrim)}&limit=10`, { method: 'GET' }, 10000);
        const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
        const rows = Array.isArray(data?.asociados) ? data.asociados : [];
        const merged = localHits.slice();
        const seen = new Set(merged.map((m) => m.phone));
        for (const r of rows) {
          const tel = _normalizarTelefonoWa(r.telefono_whatsapp || r.telefono || '');
          if (tel.length < 10 || seen.has(tel)) continue;
          seen.add(tel);
          merged.push({
            phone: tel,
            name: String(r.apellido_nombres || r.nombre || `+${tel}`).trim(),
            dni: String(r.dni || '').trim(),
            organismo: String(r.organismo || '').trim(),
            source: 'Padrón AMMER'
          });
        }
        const currentInput = document.getElementById('inpWaComposerBuscar')?.value || '';
        if (currentInput.trim() === qTrim) {
          _renderSearchResults(merged.slice(0, 12), qTrim);
        }
      } catch (_) {}
    }, 280);
  }

  function handleWaBuscarKeydown(event) {
    if (event.key === 'Escape') {
      const box = document.getElementById('waComposerSearchResults');
      if (box) box.style.display = 'none';
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const q = String(event.target?.value || '').trim();
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 8) {
        const norm = _normalizarTelefonoWa(digits);
        seleccionarContactoWhatsappAdmin({ phone: norm, name: `+${norm}`, dni: '' }, true);
        const box = document.getElementById('waComposerSearchResults');
        if (box) box.style.display = 'none';
      }
    }
  }

  function onWaDirectPhoneInput(val) {
    const digits = _normalizarTelefonoWa(val);
    if (digits.length >= 10 && (!activeContact || activeContact.phone !== digits)) {
      const existing = _getRecentChats().find((c) => _normalizarTelefonoWa(c.phone) === digits);
      activeContact = existing || { phone: digits, name: `+${digits}`, dni: '', organismo: '' };
      _updateChatHeader();
      _renderWaChatThread();
    }
  }

  function abrirChatPorTelefonoAdmin() {
    const inpPhone = document.getElementById('inpWaBotTestPhone');
    const raw = inpPhone ? inpPhone.value : '';
    const norm = _normalizarTelefonoWa(raw);
    if (norm.length < 10) {
      _toast('⚠️ Ingresá un número de WhatsApp válido (mínimo 10 dígitos, ej: 549343...).', 'warning');
      if (inpPhone) inpPhone.focus();
      return;
    }
    const existing = _getRecentChats().find((c) => _normalizarTelefonoWa(c.phone) === norm);
    seleccionarContactoWhatsappAdmin(existing || { phone: norm, name: `+${norm}`, dni: '' }, true);
  }

  function seleccionarContactoWhatsappAdmin(contact, shouldSync = true) {
    const phone = _normalizarTelefonoWa(contact?.phone || '');
    if (phone.length < 10) return;

    activeContact = {
      phone,
      name: String(contact?.name || `+${phone}`).trim(),
      dni: String(contact?.dni || '').trim(),
      organismo: String(contact?.organismo || '').trim()
    };

    const inpPhone = document.getElementById('inpWaBotTestPhone');
    if (inpPhone) inpPhone.value = phone;
    const inpSearch = document.getElementById('inpWaComposerBuscar');
    if (inpSearch && contact?.name && !contact.name.startsWith('+')) {
      inpSearch.value = '';
    }

    _upsertRecentChat(activeContact);
    _updateChatHeader();
    _renderWaChatThread();
    if (shouldSync) {
      cargarMensajesChatWhatsappAdmin(true);
    }
  }

  function _updateChatHeader() {
    const av = document.getElementById('waChatActiveAvatar');
    const nm = document.getElementById('waChatActiveName');
    const mt = document.getElementById('waChatActiveMeta');
    if (!activeContact) {
      if (av) av.textContent = 'WA';
      if (nm) nm.textContent = 'Seleccioná un destinatario';
      if (mt) mt.textContent = 'Ingresá un número o elegí un asociado del padrón/solicitudes';
      return;
    }
    if (av) av.textContent = _initials(activeContact.name, activeContact.phone);
    if (nm) nm.textContent = activeContact.name || `+${activeContact.phone}`;
    if (mt) {
      mt.innerHTML =
        `<span>📲 +${_esc(activeContact.phone)}</span>` +
        (activeContact.dni ? `<span style="padding:1px 6px;border-radius:9999px;background:#e0e7ff;color:#3730a3;font-weight:700;font-size:0.67rem;">DNI ${_esc(activeContact.dni)}</span>` : '') +
        (activeContact.organismo ? `<span style="color:#64748b;">· ${_esc(activeContact.organismo)}</span>` : '');
    }
  }

  function _renderRecentChatsList() {
    const box = document.getElementById('waComposerRecentList');
    if (!box) return;
    const list = _getRecentChats();
    if (list.length === 0) {
      box.innerHTML =
        '<div style="padding:1.1rem 0.75rem;text-align:center;color:#64748b;font-size:0.77rem;">' +
          'Buscá un asociado arriba o ingresá un teléfono para comenzar una conversación.' +
        '</div>';
      return;
    }
    box.innerHTML = list.map((c, idx) => {
      const isActive = activeContact && _normalizarTelefonoWa(activeContact.phone) === _normalizarTelefonoWa(c.phone);
      return (
        `<button type="button" class="wa-recent-item${isActive ? ' active' : ''}" data-wa-recent-idx="${idx}">` +
          `<span class="wa-avatar">${_esc(_initials(c.name, c.phone))}</span>` +
          `<span style="min-width:0;flex:1;">` +
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">` +
              `<span style="font-size:0.79rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.name || ('+' + c.phone))}</span>` +
              `<span style="font-size:0.65rem;color:#64748b;flex-shrink:0;">${_esc(_formatHora(c.updatedAt))}</span>` +
            `</div>` +
            `<div style="font-size:0.71rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.lastText || ('+' + c.phone))}</div>` +
          `</span>` +
        `</button>`
      );
    }).join('');

    box.querySelectorAll('[data-wa-recent-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-wa-recent-idx'));
        if (list[i]) seleccionarContactoWhatsappAdmin(list[i], true);
      });
    });
  }

  function limpiarHistorialChatsWhatsappAdmin() {
    if (!global.confirm('¿Limpiar la lista de chats recientes y mensajes guardados localmente en este navegador? (No borra nada de WhatsApp real.)')) return;
    localStorage.removeItem(LS_RECENT_CHATS_KEY);
    localStorage.removeItem(LS_LOCAL_MSGS_KEY);
    remoteMessagesByPhone.clear();
    activeContact = null;
    _updateChatHeader();
    _renderRecentChatsList();
    _renderWaChatThread();
  }

  // ============================================================================
  // HILO DE MENSAJES (FUSIÓN LOCAL + WORKER EN VIVO)
  // ============================================================================
  function _renderWaChatThread() {
    const threadEl = document.getElementById('waChatThread');
    if (!threadEl) return;

    if (!activeContact || !activeContact.phone) {
      threadEl.innerHTML =
        '<div style="margin:auto;text-align:center;max-width:410px;background:rgba(255,255,255,0.9);border:1px solid rgba(203,213,225,0.8);border-radius:14px;padding:1.25rem;box-shadow:0 2px 10px rgba(15,23,42,0.06);">' +
          '<div style="font-size:1.4rem;margin-bottom:6px;">💬</div>' +
          '<div style="font-size:0.86rem;font-weight:800;color:#0f2744;">WhatsApp Directo AMMER</div>' +
          '<div style="font-size:0.76rem;color:#475569;margin-top:4px;line-height:1.45;">Elegí un asociado o ingresá un número en el panel izquierdo para enviar mensajes de texto, fotos, documentos PDF, audios grabados al instante o botones de respuesta rápida.</div>' +
        '</div>';
      return;
    }

    const tel = _normalizarTelefonoWa(activeContact.phone);
    const localMap = _getLocalMessagesMap();
    const localMsgs = Array.isArray(localMap[tel]) ? localMap[tel] : [];
    const remoteMsgs = Array.isArray(remoteMessagesByPhone.get(tel)) ? remoteMessagesByPhone.get(tel) : [];

    // Deduplicar por id manteniendo orden cronológico
    const byId = new Map();
    for (const m of [...localMsgs, ...remoteMsgs]) {
      const key = m.id || `${m.timestamp}_${m.text}`;
      if (!byId.has(key)) byId.set(key, m);
    }
    const merged = Array.from(byId.values()).sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    if (merged.length === 0) {
      threadEl.innerHTML =
        `<div style="margin:auto;text-align:center;max-width:390px;background:rgba(255,255,255,0.92);border:1px solid #e2e8f0;border-radius:14px;padding:1.1rem;">` +
          `<div style="font-size:0.84rem;font-weight:800;color:#0f2744;">Chat listo con ${_esc(activeContact.name)}</div>` +
          `<div style="font-size:0.74rem;color:#475569;margin-top:4px;">Escribí tu mensaje abajo, usá una respuesta rápida ⚡, adjuntá una foto/PDF o grabá una nota de voz 🎙️.</div>` +
        `</div>`;
      return;
    }

    threadEl.innerHTML = merged.map((m) => {
      const isOut = Boolean(m.fromMe);
      const previewUrl = m.id ? sessionMediaPreviewUrls.get(m.id) : null;
      let mediaHtml = '';
      if (previewUrl && m.kind === 'image') {
        mediaHtml = `<img src="${_esc(previewUrl)}" alt="Imagen enviada" class="wa-msg-media-thumb"/>`;
      } else if (previewUrl && m.kind === 'audio') {
        mediaHtml = `<audio controls src="${_esc(previewUrl)}" style="max-width:250px;height:36px;margin-bottom:4px;display:block;"></audio>`;
      } else if (m.kind === 'document' && m.fileName) {
        mediaHtml = `<div class="wa-msg-doc-pill">📄 ${_esc(m.fileName)}</div>`;
      }

      let pollHtml = '';
      if (Array.isArray(m.pollOptions) && m.pollOptions.length > 0) {
        pollHtml = '<div class="wa-msg-poll-box">' +
          m.pollOptions.map((opt) => `<div class="wa-msg-poll-opt">🔘 ${_esc(opt)}</div>`).join('') +
        '</div>';
      }

      const textClean = String(m.text || '');
      const senderTag = !isOut && m.pushName
        ? `<div style="font-size:0.68rem;font-weight:800;color:#0d9488;margin-bottom:2px;">${_esc(m.pushName)}</div>`
        : '';

      return (
        `<div class="wa-msg-row ${isOut ? 'out' : 'in'}">` +
          `<div class="wa-msg-bubble">` +
            senderTag +
            mediaHtml +
            (textClean ? `<div>${_esc(textClean)}</div>` : '') +
            pollHtml +
            `<div class="wa-msg-meta">` +
              (isOut && m.sessionAlias ? `<span>via ${_esc(m.sessionAlias)}</span>` : '') +
              `<span>${_esc(_formatHora(m.timestamp))}</span>` +
              (isOut ? '<span class="wa-checks">✓✓</span>' : '') +
            `</div>` +
          `</div>` +
        `</div>`
      );
    }).join('');

    threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function cargarMensajesChatWhatsappAdmin(silencioso = false) {
    if (!_esAdmin() || !activeContact || !activeContact.phone) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || '';
    const tel = _normalizarTelefonoWa(activeContact.phone);
    try {
      const qs = new URLSearchParams({ telefono: tel, limit: '80' });
      if (sid) qs.set('sessionId', sid);
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/mensajes?${qs.toString()}`, { method: 'GET' }, 12000);
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && Array.isArray(data.mensajes)) {
        remoteMessagesByPhone.set(tel, data.mensajes);
        _renderWaChatThread();
        if (!silencioso) {
          _toast(data.supported === false ? 'ℹ️ Worker pendiente de actualización para sincronizar respuestas entrantes.' : '🔄 Conversación sincronizada.', 'info');
        }
      }
    } catch (_) {
      if (!silencioso) _toast('⚠️ No se pudieron consultar mensajes recientes.', 'warning');
    }
  }

  // ============================================================================
  // RESPUESTAS PREDEFINIDAS (QUICK REPLIES) Y EMOJIS
  // ============================================================================
  function _personalizarPlantilla(tplText) {
    const nombreRaw = activeContact?.name && !activeContact.name.startsWith('+')
      ? activeContact.name.split(/\s+/)[0]
      : 'asociado/a';
    const dniRaw = activeContact?.dni || '';
    return String(tplText || '')
      .replace(/\{nombre\}/gi, nombreRaw)
      .replace(/\{dni\}/gi, dniRaw);
  }

  function _renderQuickReplies() {
    const bar = document.getElementById('waQuickRepliesContainer');
    const adminList = document.getElementById('waQuickRepliesAdminList');
    const list = _getQuickReplies();

    if (bar) {
      bar.innerHTML = list.map((item, idx) =>
        `<button type="button" class="wa-quick-chip" data-wa-qr-idx="${idx}" title="${_esc(item.text)}">${_esc(item.title)}</button>`
      ).join('');
      bar.querySelectorAll('[data-wa-qr-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-wa-qr-idx'));
          const tpl = list[i];
          if (!tpl) return;
          const inp = document.getElementById('inpWaBotTestMsg');
          if (!inp) return;
          const resolved = _personalizarPlantilla(tpl.text);
          inp.value = inp.value.trim() ? `${inp.value.trim()}\n${resolved}` : resolved;
          autoResizeWaTextarea(inp);
          inp.focus();
        });
      });
    }

    if (adminList) {
      adminList.innerHTML = list.map((item, idx) =>
        `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:9999px;background:#ffffff;border:1px solid #cbd5e1;font-size:0.72rem;font-weight:700;color:#0f172a;">` +
          `<span>${_esc(item.title)}</span>` +
          `<button type="button" onclick="window.eliminarRespuestaRapidaWa(${idx})" style="border:none;background:transparent;color:#dc2626;font-weight:800;cursor:pointer;padding:0 2px;">✕</button>` +
        `</span>`
      ).join('');
    }
  }

  function toggleEditorRespuestasRapidasWa(forceState) {
    const drawer = document.getElementById('waQuickRepliesDrawer');
    if (!drawer) return;
    const next = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', next);
  }

  function agregarRespuestaRapidaWa() {
    const inpT = document.getElementById('inpWaNewQuickTitle');
    const inpB = document.getElementById('inpWaNewQuickText');
    const title = String(inpT?.value || '').trim().slice(0, 36);
    const text = String(inpB?.value || '').trim().slice(0, 800);
    if (!title || !text) {
      _toast('⚠️ Completá el título del botón y el texto de la respuesta rápida.', 'warning');
      return;
    }
    const list = _getQuickReplies();
    list.push({ id: `qr_${Date.now()}`, title, text });
    _saveQuickReplies(list);
    if (inpT) inpT.value = '';
    if (inpB) inpB.value = '';
    _renderQuickReplies();
    _toast('✅ Respuesta rápida guardada.', 'success');
  }

  function eliminarRespuestaRapidaWa(idx) {
    const list = _getQuickReplies();
    if (idx < 0 || idx >= list.length) return;
    list.splice(idx, 1);
    if (list.length === 0) {
      _saveQuickReplies(DEFAULT_QUICK_REPLIES.slice());
    } else {
      _saveQuickReplies(list);
    }
    _renderQuickReplies();
  }

  function _renderEmojiPopover() {
    const pop = document.getElementById('waEmojiPopover');
    if (!pop) return;
    pop.innerHTML = QUICK_EMOJIS.map((em) =>
      `<button type="button" class="wa-emoji-btn" onclick="window.insertarEmojiWa('${em}')">${em}</button>`
    ).join('');
  }

  function toggleEmojiPopoverWa(forceState) {
    const pop = document.getElementById('waEmojiPopover');
    if (!pop) return;
    const next = typeof forceState === 'boolean' ? forceState : !pop.classList.contains('open');
    pop.classList.toggle('open', next);
  }

  function insertarEmojiWa(emoji) {
    const inp = document.getElementById('inpWaBotTestMsg');
    if (!inp) return;
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
    inp.focus();
    inp.selectionStart = inp.selectionEnd = start + emoji.length;
    autoResizeWaTextarea(inp);
    toggleEmojiPopoverWa(false);
  }

  // ============================================================================
  // CONSTRUCTOR DE BOTONES DE RESPUESTA INTERACTIVA PARA EL DESTINATARIO
  // ============================================================================
  function _renderButtonsOptions() {
    const container = document.getElementById('waButtonsOptionsList');
    const drawer = document.getElementById('waButtonsBuilderDrawer');
    const toggleBtn = document.getElementById('btnWaToggleButtonsBuilder');
    if (drawer) drawer.classList.toggle('open', buttonsBuilderOpen);
    if (toggleBtn) toggleBtn.classList.toggle('active', buttonsBuilderOpen);
    if (!container) return;

    const optsHtml = builderOptions.map((opt, idx) =>
      `<div style="display:inline-flex;align-items:center;gap:4px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:3px 6px;">` +
        `<span style="font-size:0.7rem;font-weight:800;color:#16a34a;">${idx + 1}.</span>` +
        `<input type="text" value="${_esc(opt)}" maxlength="80" oninput="window.actualizarOpcionBotonWa(${idx}, this.value)" placeholder="Opción ${idx + 1}" style="border:none;outline:none;font-size:0.74rem;font-weight:700;color:#0f172a;width:140px;background:transparent;"/>` +
        (builderOptions.length > 2
          ? `<button type="button" onclick="window.eliminarOpcionBotonWa(${idx})" style="border:none;background:transparent;color:#94a3b8;font-weight:800;cursor:pointer;font-size:0.75rem;">✕</button>`
          : '') +
      `</div>`
    ).join('');

    const addBtn = builderOptions.length < 6
      ? `<button type="button" onclick="window.agregarOpcionBotonWa()" style="padding:0.32rem 0.65rem;border-radius:8px;border:1px dashed #16a34a;background:#f0fdf4;color:#15803d;font-size:0.73rem;font-weight:800;cursor:pointer;">➕ Opción</button>`
      : '';

    container.innerHTML = optsHtml + addBtn;
  }

  function toggleBotonesBuilderWa(forceState) {
    buttonsBuilderOpen = typeof forceState === 'boolean' ? forceState : !buttonsBuilderOpen;
    if (buttonsBuilderOpen && builderOptions.length < 2) {
      builderOptions = ['Sí, confirmo', 'Necesito asistencia'];
    }
    _renderButtonsOptions();
  }

  function limpiarBotonesInteractivosWa() {
    buttonsBuilderOpen = false;
    const inpT = document.getElementById('inpWaButtonsTitle');
    if (inpT) inpT.value = '';
    _renderButtonsOptions();
  }

  function aplicarPresetBotonesWa(preset) {
    buttonsBuilderOpen = true;
    const inpT = document.getElementById('inpWaButtonsTitle');
    if (preset === 'confirmacion') {
      if (inpT && !inpT.value.trim()) inpT.value = '¿Confirmás los datos para continuar?';
      builderOptions = ['✅ Sí, confirmo', '✏️ Corregir datos', '📞 Hablar con asesor'];
    } else {
      if (inpT && !inpT.value.trim()) inpT.value = '¿Cuándo podés enviarnos el comprobante?';
      builderOptions = ['📤 Lo envío ahora', '🕒 Lo envío más tarde', '❓ Tengo una consulta'];
    }
    _renderButtonsOptions();
  }

  function agregarOpcionBotonWa() {
    if (builderOptions.length >= 6) return;
    builderOptions.push(`Opción ${builderOptions.length + 1}`);
    _renderButtonsOptions();
  }

  function eliminarOpcionBotonWa(idx) {
    if (builderOptions.length <= 2) return;
    builderOptions.splice(idx, 1);
    _renderButtonsOptions();
  }

  function actualizarOpcionBotonWa(idx, val) {
    builderOptions[idx] = String(val || '');
  }

  // ============================================================================
  // ADJUNTOS (FOTOS, ARCHIVOS, DRAG & DROP, PORTAPAPELES)
  // ============================================================================
  function _clearPendingAttachment() {
    if (pendingAttachment?.objectUrl) {
      try { URL.revokeObjectURL(pendingAttachment.objectUrl); } catch (_) {}
    }
    pendingAttachment = null;
    const strip = document.getElementById('waAttachmentPreviewStrip');
    if (strip) {
      strip.classList.remove('open');
      strip.innerHTML = '';
    }
    const fPhoto = document.getElementById('inpWaFilePhoto');
    const fDoc = document.getElementById('inpWaFileDoc');
    if (fPhoto) fPhoto.value = '';
    if (fDoc) fDoc.value = '';
  }

  function _renderAttachmentStrip() {
    const strip = document.getElementById('waAttachmentPreviewStrip');
    if (!strip) return;
    if (!pendingAttachment) {
      strip.classList.remove('open');
      strip.innerHTML = '';
      return;
    }

    let previewHtml = '';
    if (pendingAttachment.kind === 'image') {
      previewHtml =
        `<div style="display:flex;align-items:center;gap:10px;">` +
          `<img src="${_esc(pendingAttachment.objectUrl)}" alt="Vista previa" style="width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #86efac;"/>` +
          `<div>` +
            `<div style="font-size:0.79rem;font-weight:800;color:#14532d;">📷 ${_esc(pendingAttachment.fileName)}</div>` +
            `<div style="font-size:0.7rem;color:#166534;">Imagen lista · ${_esc(_formatBytes(pendingAttachment.size))}</div>` +
          `</div>` +
        `</div>`;
    } else if (pendingAttachment.kind === 'audio') {
      previewHtml =
        `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:1;">` +
          `<span style="font-size:1.25rem;">🎙️</span>` +
          `<audio controls src="${_esc(pendingAttachment.objectUrl)}" style="height:34px;max-width:260px;"></audio>` +
          `<label style="display:inline-flex;align-items:center;gap:5px;font-size:0.72rem;font-weight:700;color:#14532d;cursor:pointer;">` +
            `<input type="checkbox" ${pendingAttachment.ptt !== false ? 'checked' : ''} onchange="window.toggleWaAudioPtt(this.checked)" style="accent-color:#16a34a;"/>` +
            `<span>Enviar como nota de voz</span>` +
          `</label>` +
        `</div>`;
    } else {
      previewHtml =
        `<div style="display:flex;align-items:center;gap:10px;">` +
          `<span style="font-size:1.35rem;">📄</span>` +
          `<div>` +
            `<div style="font-size:0.79rem;font-weight:800;color:#0f2744;">${_esc(pendingAttachment.fileName)}</div>` +
            `<div style="font-size:0.7rem;color:#475569;">Archivo adjunto · ${_esc(_formatBytes(pendingAttachment.size))}</div>` +
          `</div>` +
        `</div>`;
    }

    strip.innerHTML =
      previewHtml +
      `<button type="button" onclick="window.quitarAdjuntoWa()" style="padding:0.35rem 0.7rem;border-radius:8px;border:1px solid #fecdd3;background:#ffffff;color:#be123c;font-size:0.73rem;font-weight:800;cursor:pointer;">✕ Quitar</button>`;
    strip.classList.add('open');
  }

  function quitarAdjuntoWa() {
    _clearPendingAttachment();
  }

  function toggleWaAudioPtt(checked) {
    if (pendingAttachment) {
      pendingAttachment.ptt = Boolean(checked);
    }
  }

  function _attachFileObject(file, forceKind = 'auto') {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      _toast('⚠️ El archivo supera el máximo permitido de 16 MB.', 'warning');
      return;
    }
    const mime = String(file.type || 'application/octet-stream').toLowerCase();
    const isImg = (forceKind === 'image' || mime.startsWith('image/')) && !mime.includes('svg');
    const isAud = mime.startsWith('audio/');
    const kind = isImg ? 'image' : (isAud ? 'audio' : 'document');

    const reader = new FileReader();
    reader.onload = () => {
      _clearPendingAttachment();
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      pendingAttachment = {
        kind,
        base64,
        mimetype: mime,
        fileName: file.name || (kind === 'image' ? 'imagen.png' : 'archivo'),
        size: file.size,
        objectUrl: URL.createObjectURL(file),
        ptt: kind === 'audio'
      };
      _renderAttachmentStrip();
    };
    reader.onerror = () => {
      _toast('⚠️ No se pudo leer el archivo seleccionado.', 'error');
    };
    reader.readAsDataURL(file);
  }

  function onWaFileSelected(inputEl, mode) {
    const file = inputEl?.files?.[0];
    if (file) _attachFileObject(file, mode);
  }

  function handleWaDragOver(event) {
    event.preventDefault();
    const zone = document.getElementById('waChatDropZone');
    if (zone) zone.classList.add('drag-over');
  }

  function handleWaDragLeave(event) {
    event.preventDefault();
    const zone = document.getElementById('waChatDropZone');
    if (zone) zone.classList.remove('drag-over');
  }

  function handleWaDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('waChatDropZone');
    if (zone) zone.classList.remove('drag-over');
    const file = event.dataTransfer?.files?.[0];
    if (file) _attachFileObject(file, 'auto');
  }

  function handleWaComposerPaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && String(item.type || '').startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          const ext = (file.type.split('/')[1] || 'png').split(';')[0];
          const named = new File([file], `captura_${Date.now()}.${ext}`, { type: file.type });
          _attachFileObject(named, 'image');
          _toast('📷 Imagen pegada del portapapeles.', 'info');
          break;
        }
      }
    }
  }

  // ============================================================================
  // GRABACIÓN DE AUDIO EN VIVO (NOTA DE VOZ)
  // ============================================================================
  function _cleanupRecordingResources() {
    if (recordingTimerId) {
      clearInterval(recordingTimerId);
      recordingTimerId = null;
    }
    if (recordingAnimId) {
      cancelAnimationFrame(recordingAnimId);
      recordingAnimId = null;
    }
    if (recordingAudioCtx) {
      try { recordingAudioCtx.close(); } catch (_) {}
      recordingAudioCtx = null;
    }
    if (recordingStream) {
      recordingStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      recordingStream = null;
    }
    const bar = document.getElementById('waRecordingBar');
    const btn = document.getElementById('btnWaRecordAudio');
    if (bar) bar.classList.remove('active');
    if (btn) btn.classList.remove('recording');
  }

  async function iniciarGrabacionAudioWa() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      detenerGrabacionAudioWa(false);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof global.MediaRecorder === 'undefined') {
      _toast('⚠️ Tu navegador no soporta grabación de audio directa. Podés adjuntar un archivo de audio con 📎.', 'warning');
      return;
    }

    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ];
      recordingMimeType = candidates.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
      mediaRecorder = recordingMimeType
        ? new MediaRecorder(recordingStream, { mimeType: recordingMimeType })
        : new MediaRecorder(recordingStream);

      recordingChunks = [];
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordingChunks.push(ev.data);
      };

      const bar = document.getElementById('waRecordingBar');
      const btn = document.getElementById('btnWaRecordAudio');
      const timerEl = document.getElementById('waRecordingTimer');
      if (bar) bar.classList.add('active');
      if (btn) btn.classList.add('recording');

      recordingStartedAt = Date.now();
      if (timerEl) timerEl.textContent = '00:00';
      recordingTimerId = setInterval(() => {
        const secs = Math.floor((Date.now() - recordingStartedAt) / 1000);
        const mm = String(Math.floor(secs / 60)).padStart(2, '0');
        const ss = String(secs % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mm}:${ss}`;
        if (secs >= 300) detenerGrabacionAudioWa(false);
      }, 250);

      // Visualizador simple en canvas
      try {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          recordingAudioCtx = new AudioCtx();
          const source = recordingAudioCtx.createMediaStreamSource(recordingStream);
          const analyser = recordingAudioCtx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const canvas = document.getElementById('waRecordingWave');
          const ctx2d = canvas ? canvas.getContext('2d') : null;
          const drawWave = () => {
            if (!ctx2d || !recordingAudioCtx) return;
            analyser.getByteFrequencyData(dataArr);
            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            ctx2d.fillStyle = '#e11d48';
            const barW = 4;
            const gap = 3;
            for (let i = 0; i < 16; i++) {
              const val = dataArr[i % dataArr.length] || 8;
              const h = Math.max(3, Math.round((val / 255) * (canvas.height - 4)));
              const y = Math.round((canvas.height - h) / 2);
              ctx2d.fillRect(i * (barW + gap) + 4, y, barW, h);
            }
            recordingAnimId = requestAnimationFrame(drawWave);
          };
          drawWave();
        }
      } catch (_) {}

      mediaRecorder.start(250);
    } catch (err) {
      _cleanupRecordingResources();
      _toast('🎙️ No se pudo acceder al micrófono: ' + (err?.message || 'Permiso denegado'), 'error');
    }
  }

  function cancelarGrabacionAudioWa() {
    try {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
        mediaRecorder.stop();
      }
    } catch (_) {}
    mediaRecorder = null;
    recordingChunks = [];
    _cleanupRecordingResources();
  }

  function detenerGrabacionAudioWa(enviarInmediato = false) {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      _cleanupRecordingResources();
      return;
    }
    const rec = mediaRecorder;
    rec.onstop = () => {
      const mime = rec.mimeType || recordingMimeType || 'audio/webm';
      const blob = new Blob(recordingChunks, { type: mime });
      recordingChunks = [];
      mediaRecorder = null;
      _cleanupRecordingResources();

      if (blob.size < 200) {
        _toast('⚠️ Audio demasiado corto.', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        _clearPendingAttachment();
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const ext = mime.includes('ogg') ? 'ogg' : (mime.includes('mp4') ? 'm4a' : 'webm');
        pendingAttachment = {
          kind: 'audio',
          base64,
          mimetype: mime,
          fileName: `nota_voz_${Date.now()}.${ext}`,
          size: blob.size,
          objectUrl: URL.createObjectURL(blob),
          ptt: true
        };
        _renderAttachmentStrip();
        if (enviarInmediato) {
          enviarMensajePersonalizadoWhatsappAdmin();
        }
      };
      reader.readAsDataURL(blob);
    };
    try {
      rec.stop();
    } catch (_) {
      _cleanupRecordingResources();
    }
  }

  // ============================================================================
  // ENVÍO PERSONALIZADO MULTIMEDIA / TEXTO / AUDIO / BOTONES
  // ============================================================================
  function autoResizeWaTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(130, Math.max(38, el.scrollHeight)) + 'px';
  }

  function handleWaComposerKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      enviarMensajePersonalizadoWhatsappAdmin();
    }
  }

  async function enviarMensajePersonalizadoWhatsappAdmin() {
    if (!_esAdmin() || isSendingCustom) return;

    const selLine = document.getElementById('selWaBotTestSession');
    const inpTel = document.getElementById('inpWaBotTestPhone');
    const inpMsg = document.getElementById('inpWaBotTestMsg');
    const telRaw = String(inpTel?.value || activeContact?.phone || '').trim();
    const telNorm = _normalizarTelefonoWa(telRaw);
    const msg = String(inpMsg?.value || '').trim();

    if (telNorm.length < 10) {
      _toast('⚠️ Ingresá o seleccioná un destinatario con número válido (ej: 549343...).', 'warning');
      if (inpTel) inpTel.focus();
      return;
    }

    const activeButtons = buttonsBuilderOpen
      ? builderOptions.map((b) => String(b || '').trim()).filter(Boolean)
      : [];
    if (buttonsBuilderOpen && activeButtons.length < 2) {
      _toast('⚠️ Agregá al menos 2 opciones para enviar botones interactivos, o cerrá el panel de botones.', 'warning');
      return;
    }

    if (!msg && !pendingAttachment && activeButtons.length < 2) {
      _toast('⚠️ Escribí un mensaje, adjuntá una foto/archivo, grabá un audio o agregá botones.', 'warning');
      if (inpMsg) inpMsg.focus();
      return;
    }

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;

    const sessionId = selLine?.value || undefined;
    const botonesTitulo = String(document.getElementById('inpWaButtonsTitle')?.value || '').trim();
    const modoBotones = String(document.getElementById('selWaButtonsMode')?.value || 'encuesta');

    const payload = {
      sessionId,
      telefono: telNorm,
      mensaje: msg
    };

    const currentAttachment = pendingAttachment ? Object.assign({}, pendingAttachment) : null;
    if (currentAttachment) {
      payload.tipo = currentAttachment.kind;
      payload.mediaBase64 = currentAttachment.base64;
      payload.mimeType = currentAttachment.mimetype;
      payload.fileName = currentAttachment.fileName;
      payload.ptt = currentAttachment.ptt !== false;
    }
    if (activeButtons.length >= 2) {
      payload.botones = activeButtons;
      payload.botonesTitulo = botonesTitulo;
      payload.modoBotones = modoBotones;
    }

    const btn = document.getElementById('btnWaBotProbarEnvio');
    isSendingCustom = true;
    if (btn) btn.disabled = true;

    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/enviar-personalizado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 45000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'No se pudo enviar el mensaje.');
      }

      const sesiones = Array.isArray(lastPanelData?.sesiones) ? lastPanelData.sesiones : [];
      const sesObj = sesiones.find((s) => s.sessionId === (data.sessionId || sessionId));
      const sessionAlias = sesObj?.alias || data.sessionId || 'Bot';

      const msgId = data.messageId || `sent_${Date.now()}`;
      if (currentAttachment?.objectUrl) {
        // Transferir ownership del objectUrl al historial de la sesión para mostrar preview en la burbuja
        sessionMediaPreviewUrls.set(msgId, currentAttachment.objectUrl);
        pendingAttachment.objectUrl = null;
      }

      const summaryText = msg ||
        (currentAttachment
          ? (currentAttachment.kind === 'audio' ? '🎙️ Nota de voz' : (currentAttachment.kind === 'image' ? `📷 ${currentAttachment.fileName}` : `📄 ${currentAttachment.fileName}`))
          : (botonesTitulo || 'Opciones rápidas'));

      if (!activeContact || _normalizarTelefonoWa(activeContact.phone) !== telNorm) {
        activeContact = { phone: telNorm, name: `+${telNorm}`, dni: '', organismo: '' };
      }

      _appendLocalMessage(telNorm, {
        id: msgId,
        kind: currentAttachment ? currentAttachment.kind : (activeButtons.length >= 2 ? 'poll' : 'text'),
        text: summaryText,
        fileName: currentAttachment?.fileName || null,
        mimetype: currentAttachment?.mimetype || null,
        pollOptions: activeButtons.length >= 2 ? activeButtons : null,
        sessionAlias,
        timestamp: new Date().toISOString()
      });

      _upsertRecentChat(activeContact, summaryText);
      _updateChatHeader();
      _renderWaChatThread();

      if (inpMsg) {
        inpMsg.value = '';
        autoResizeWaTextarea(inpMsg);
      }
      _clearPendingAttachment();
      if (buttonsBuilderOpen) {
        limpiarBotonesInteractivosWa();
      }
      _toast(`✅ Enviado vía ${sessionAlias}.`, 'success');
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error enviando mensaje por WhatsApp.'), 'error');
    } finally {
      isSendingCustom = false;
      if (btn) btn.disabled = false;
    }
  }

  // ============================================================================
  // GESTIÓN DE SESIONES QR Y ENRUTAMIENTO
  // ============================================================================
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
      cambiarTabWhatsappBotAdmin('lineas', true);
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
    return enviarMensajePersonalizadoWhatsappAdmin();
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

  // Exports públicos
  global.initWhatsappBotPanelAdmin = initWhatsappBotPanelAdmin;
  global.cargarPanelWhatsappBotAdmin = cargarPanelWhatsappBotAdmin;
  global.detenerPollingWhatsappBotAdmin = detenerPollingWhatsappBotAdmin;
  global.cambiarTabWhatsappBotAdmin = cambiarTabWhatsappBotAdmin;
  global.usarLineaEnMensajeriaWa = usarLineaEnMensajeriaWa;
  global.onWaComposerSessionChange = onWaComposerSessionChange;
  global.buscarContactoWhatsappAdmin = buscarContactoWhatsappAdmin;
  global.handleWaBuscarKeydown = handleWaBuscarKeydown;
  global.onWaDirectPhoneInput = onWaDirectPhoneInput;
  global.abrirChatPorTelefonoAdmin = abrirChatPorTelefonoAdmin;
  global.seleccionarContactoWhatsappAdmin = seleccionarContactoWhatsappAdmin;
  global.limpiarHistorialChatsWhatsappAdmin = limpiarHistorialChatsWhatsappAdmin;
  global.cargarMensajesChatWhatsappAdmin = cargarMensajesChatWhatsappAdmin;
  global.toggleEditorRespuestasRapidasWa = toggleEditorRespuestasRapidasWa;
  global.agregarRespuestaRapidaWa = agregarRespuestaRapidaWa;
  global.eliminarRespuestaRapidaWa = eliminarRespuestaRapidaWa;
  global.toggleEmojiPopoverWa = toggleEmojiPopoverWa;
  global.insertarEmojiWa = insertarEmojiWa;
  global.toggleBotonesBuilderWa = toggleBotonesBuilderWa;
  global.limpiarBotonesInteractivosWa = limpiarBotonesInteractivosWa;
  global.aplicarPresetBotonesWa = aplicarPresetBotonesWa;
  global.agregarOpcionBotonWa = agregarOpcionBotonWa;
  global.eliminarOpcionBotonWa = eliminarOpcionBotonWa;
  global.actualizarOpcionBotonWa = actualizarOpcionBotonWa;
  global.onWaFileSelected = onWaFileSelected;
  global.quitarAdjuntoWa = quitarAdjuntoWa;
  global.toggleWaAudioPtt = toggleWaAudioPtt;
  global.handleWaDragOver = handleWaDragOver;
  global.handleWaDragLeave = handleWaDragLeave;
  global.handleWaDrop = handleWaDrop;
  global.handleWaComposerPaste = handleWaComposerPaste;
  global.iniciarGrabacionAudioWa = iniciarGrabacionAudioWa;
  global.cancelarGrabacionAudioWa = cancelarGrabacionAudioWa;
  global.detenerGrabacionAudioWa = detenerGrabacionAudioWa;
  global.autoResizeWaTextarea = autoResizeWaTextarea;
  global.handleWaComposerKeydown = handleWaComposerKeydown;
  global.enviarMensajePersonalizadoWhatsappAdmin = enviarMensajePersonalizadoWhatsappAdmin;
  global.crearNuevaLineaWhatsappBotAdmin = crearNuevaLineaWhatsappBotAdmin;
  global.abrirSesionWhatsappBotAdmin = abrirSesionWhatsappBotAdmin;
  global.cerrarSesionWhatsappBotAdmin = cerrarSesionWhatsappBotAdmin;
  global.eliminarSesionWhatsappBotAdmin = eliminarSesionWhatsappBotAdmin;
  global.guardarConfigWhatsappBotAdmin = guardarConfigWhatsappBotAdmin;
  global.probarEnvioWhatsappBotAdmin = probarEnvioWhatsappBotAdmin;
  global.enviarMensajeViaBotAmmerConFallback = enviarMensajeViaBotAmmerConFallback;
})(window);
