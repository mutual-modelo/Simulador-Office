// ============================================================================
// MÓDULO ADMIN: CENTRO MULTI-LÍNEA DUAL (QR + META CLOUD API) Y MENSAJERÍA AMMER
// Exclusivo rol Admin: múltiples sesiones QR + líneas oficiales Meta Cloud API,
// historial completo sincronizado, votos de encuestas/botones en vivo,
// audios OGG/Opus, catálogo ampliado de emojis y pie de firma por asesor.
// ============================================================================
(function (global) {
  'use strict';

  const LS_RECENT_CHATS_KEY = 'AMMER_WA_RECENT_CHATS_V1';
  const LS_QUICK_REPLIES_KEY = 'AMMER_WA_QUICK_REPLIES_V1';
  const LS_LOCAL_MSGS_KEY = 'AMMER_WA_LOCAL_MSGS_V1';
  const STORAGE_WA_EMOJI_RECENTS = 'AMMER_WA_EMOJI_RECENTS_V1';
  const STORAGE_WA_FOOTER_CFG = 'AMMER_WA_FOOTER_CFG_V1';
  const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

  const DEFAULT_QUICK_REPLIES = [
    {
      id: 'qr_saludo',
      title: 'Saludo AMMER',
      text: 'Hola {nombre}, te saludamos desde Asociación Mutual Modelo de Entre Ríos (AMMER). ¿En qué podemos ayudarte?'
    },
    {
      id: 'qr_recibo',
      title: 'Pedir Recibo',
      text: 'Hola {nombre}, para avanzar con tu evaluación necesitamos que nos envíes por acá tu último recibo de haberes en PDF o foto nítida.'
    },
    {
      id: 'qr_dni',
      title: 'Pedir DNI',
      text: 'Hola {nombre}, por favor envianos foto nítida del frente y dorso de tu DNI para completar la validación de identidad.'
    },
    {
      id: 'qr_firma',
      title: 'Recordar Firma',
      text: 'Hola {nombre}, te recordamos que tenés documentación pendiente de firma electrónica en AMMER. Avisanos si necesitás que te reenviemos el enlace.'
    },
    {
      id: 'qr_sidecreer',
      title: 'Saldo Sidecreer',
      text: 'Hola {nombre}, ¿podrías confirmarnos tu número de tarjeta Sidecreer o si querés que verifiquemos tu disponible actualizado?'
    },
    {
      id: 'qr_acreditado',
      title: 'Acreditación',
      text: '¡Buenas noticias {nombre}! Tu gestión en Mutual Modelo fue aprobada y acreditada correctamente. Ante cualquier consulta estamos a disposición.'
    },
    {
      id: 'qr_horarios',
      title: 'Horarios Sede',
      text: 'Te atendemos en Mutual Modelo de Entre Ríos de lunes a viernes de 8:00 a 16:00 hs. Podés respondernos directamente por este medio.'
    }
  ];

  // Catálogo ampliado de emojis organizados por categoría con tags en español para buscador
  const EMOJI_CATALOG = [
    // AMMER / Oficina / Documentación / Finanzas
    { e: '✅', c: 'oficina', k: 'ok listo aprobado check confirmado' },
    { e: '📄', c: 'oficina', k: 'documento pdf archivo recibo' },
    { e: '📃', c: 'oficina', k: 'pagina contrato hoja' },
    { e: '📑', c: 'oficina', k: 'expediente legajo' },
    { e: '🪪', c: 'oficina', k: 'dni documento identidad carnet' },
    { e: '💳', c: 'oficina', k: 'tarjeta sidecreer credito debito' },
    { e: '✍️', c: 'oficina', k: 'firma firmar lapicera' },
    { e: '🖊️', c: 'oficina', k: 'boligrafo firmar' },
    { e: '💰', c: 'oficina', k: 'dinero plata monto ayuda economica' },
    { e: '💵', c: 'oficina', k: 'pesos billete efectivo' },
    { e: '🏦', c: 'oficina', k: 'banco transferencia cbu alias' },
    { e: '🧾', c: 'oficina', k: 'comprobante recibo ticket' },
    { e: '📊', c: 'oficina', k: 'cuotas grafico tabla calculo' },
    { e: '📈', c: 'oficina', k: 'sube disponible margen' },
    { e: '📋', c: 'oficina', k: 'planilla solicitud formulario lista' },
    { e: '📎', c: 'oficina', k: 'adjunto clip archivo' },
    { e: '📁', c: 'oficina', k: 'carpeta expediente' },
    { e: '💼', c: 'oficina', k: 'trabajo oficina empleo' },
    { e: '🏢', c: 'oficina', k: 'sede mutual edificio' },
    { e: '📍', c: 'oficina', k: 'ubicacion direccion mapa' },
    { e: '📞', c: 'oficina', k: 'telefono llamar contacto' },
    { e: '📲', c: 'oficina', k: 'celular whatsapp enlace' },
    { e: '📧', c: 'oficina', k: 'mail correo electronico' },
    { e: '🔐', c: 'oficina', k: 'pin clave seguridad codigo' },
    { e: '🛡️', c: 'oficina', k: 'seguridad validacion proteccion' },
    { e: '📸', c: 'oficina', k: 'foto camara selfie captura' },
    { e: '🎙️', c: 'oficina', k: 'audio voz microfono' },
    { e: '📅', c: 'oficina', k: 'fecha calendario turno vencimiento' },
    { e: '⏰', c: 'oficina', k: 'hora horario reloj' },
    { e: '⏳', c: 'oficina', k: 'espera proceso pendiente' },
    { e: '🔍', c: 'oficina', k: 'buscar revisar auditar' },
    { e: '🖨️', c: 'oficina', k: 'imprimir copia' },
    // Caras y gestos
    { e: '👋', c: 'caras', k: 'hola saludo mano chau' },
    { e: '😊', c: 'caras', k: 'sonrisa amable feliz' },
    { e: '😄', c: 'caras', k: 'alegre sonrisa' },
    { e: '😃', c: 'caras', k: 'contento' },
    { e: '🙂', c: 'caras', k: 'cordial' },
    { e: '😉', c: 'caras', k: 'guiño' },
    { e: '😁', c: 'caras', k: 'alegria' },
    { e: '🤗', c: 'caras', k: 'abrazo cordial' },
    { e: '🫡', c: 'caras', k: 'recibido orden' },
    { e: '🤔', c: 'caras', k: 'duda consulta pensar' },
    { e: '🧐', c: 'caras', k: 'revisando detalle lupa' },
    { e: '😌', c: 'caras', k: 'tranquilo alivio' },
    { e: '🙏', c: 'caras', k: 'gracias por favor' },
    { e: '🤝', c: 'caras', k: 'acuerdo trato mutual' },
    { e: '👍', c: 'caras', k: 'ok bien pulgar' },
    { e: '👌', c: 'caras', k: 'perfecto' },
    { e: '👏', c: 'caras', k: 'aplauso felicitaciones' },
    { e: '🙌', c: 'caras', k: 'excelente celebrar' },
    { e: '💪', c: 'caras', k: 'fuerza avance' },
    { e: '🫶', c: 'caras', k: 'corazon cuidado' },
    { e: '👆', c: 'caras', k: 'arriba mirar' },
    { e: '👇', c: 'caras', k: 'abajo enlace link' },
    { e: '👉', c: 'caras', k: 'aqui ver esto' },
    { e: '✋', c: 'caras', k: 'esperar alto' },
    { e: '🎉', c: 'caras', k: 'festejo aprobado acreditado' },
    { e: '🥳', c: 'caras', k: 'aprobado celebracion' },
    { e: '🌟', c: 'caras', k: 'destacado estrella' },
    { e: '💯', c: 'caras', k: 'cien completo' },
    // Símbolos y alertas
    { e: '⚠️', c: 'simbolos', k: 'atencion alerta advertencia' },
    { e: '❗', c: 'simbolos', k: 'importante urgente' },
    { e: '❓', c: 'simbolos', k: 'pregunta consulta duda' },
    { e: 'ℹ️', c: 'simbolos', k: 'informacion ayuda' },
    { e: '❌', c: 'simbolos', k: 'no cancelar error rechazado' },
    { e: '⭕', c: 'simbolos', k: 'circulo' },
    { e: '🟢', c: 'simbolos', k: 'verde activo habilitado' },
    { e: '🟡', c: 'simbolos', k: 'amarillo pendiente proceso' },
    { e: '🔵', c: 'simbolos', k: 'azul info' },
    { e: '🔴', c: 'simbolos', k: 'rojo urgente' },
    { e: '☑️', c: 'simbolos', k: 'marcado completo' },
    { e: '🔘', c: 'simbolos', k: 'opcion elegir boton' },
    { e: '🔔', c: 'simbolos', k: 'notificacion aviso recordatorio' },
    { e: '📢', c: 'simbolos', k: 'anuncio comunicado' },
    { e: '🔗', c: 'simbolos', k: 'link enlace url' },
    { e: '➡️', c: 'simbolos', k: 'siguiente continuar flecha' },
    { e: '⬆️', c: 'simbolos', k: 'subir arriba' },
    { e: '⬇️', c: 'simbolos', k: 'descargar abajo' },
    { e: '🔄', c: 'simbolos', k: 'actualizar reenviar sincronizar' },
    { e: '1️⃣', c: 'simbolos', k: 'uno 1 opcion' },
    { e: '2️⃣', c: 'simbolos', k: 'dos 2 opcion' },
    { e: '3️⃣', c: 'simbolos', k: 'tres 3 opcion' },
    { e: '4️⃣', c: 'simbolos', k: 'cuatro 4 opcion' },
    { e: '5️⃣', c: 'simbolos', k: 'cinco 5 opcion' },
    { e: '✨', c: 'simbolos', k: 'nuevo brillo' },
    { e: '❤️', c: 'simbolos', k: 'corazon' },
    { e: '💚', c: 'simbolos', k: 'verde whatsapp' },
    { e: '💙', c: 'simbolos', k: 'azul mutual' }
  ];
  const DEFAULT_RECENT_EMOJIS = ['✅', '👋', '📄', '🪪', '💳', '✍️', '💰', '📞', '📍', '⏰', '🙏', '🤝', '⚠️', '🎉', '👍', '📎'];

  let pollTimer = null;
  let chatAutoSyncTimer = null;
  let waSseSource = null;
  let waSseConnected = false;
  let waSseReconnectTimer = null;
  let waSseDebounceTimer = null;
  let lastPanelData = null;
  let isFetching = false;
  let isSyncingChat = false;
  let activeTab = 'mensajeria';
  let userPickedTab = false;
  let searchDebounceTimer = null;

  let activeContact = null; // { phone, name, dni, organismo, window24h }
  let pendingAttachment = null; // { kind: 'image'|'document'|'audio', base64, mimetype, fileName, size, objectUrl, ptt }
  let buttonsBuilderOpen = false;
  let builderOptions = ['Sí, confirmo', 'Necesito asistencia'];
  let isSendingCustom = false;
  let currentEmojiCategory = 'oficina';
  let currentEmojiSearch = '';
  let selectedMetaTemplate = null;

  // Caché de mensajes en sesión (local + servidor + media blobs descargados)
  let remoteMessagesByPhone = new Map();
  let olderMessagesByPhone = new Map();
  let sessionMediaPreviewUrls = new Map(); // id -> objectUrl
  let downloadingMediaIds = new Set();

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

  function _getNombreAsesorActual() {
    const cfg = _getFooterConfig();
    if (cfg.asesorOverride) return cfg.asesorOverride;
    const ua = global.estadoApp?.usuarioActual || null;
    const nom = String((ua && (ua.nombre || ua.nombreCompleto || ua.usuario)) || '').trim();
    return nom || 'Asesor AMMER';
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

  // ============================================================================
  // PIE DE PÁGINA / FIRMA DEL ASESOR
  // ============================================================================
  function _getFooterConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_WA_FOOTER_CFG);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          return {
            enabled: p.enabled !== false,
            template: String(p.template || lastPanelData?.config?.footer_template || '— *{asesor}* · Mutual Modelo (AMMER)').trim(),
            asesorOverride: String(p.asesorOverride || '').trim()
          };
        }
      }
    } catch (_) {}
    return {
      enabled: lastPanelData?.config?.footer_enabled !== false,
      template: String(lastPanelData?.config?.footer_template || '— *{asesor}* · Mutual Modelo (AMMER)').trim(),
      asesorOverride: ''
    };
  }

  function _saveFooterConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_WA_FOOTER_CFG, JSON.stringify(cfg));
    } catch (_) {}
  }

  function _resolverPieFirmaTexto() {
    const cfg = _getFooterConfig();
    if (!cfg.enabled || !cfg.template) return '';
    return cfg.template.replace(/\{asesor\}/gi, _getNombreAsesorActual()).trim();
  }

  function _renderFooterConfigUI() {
    const cfg = _getFooterConfig();
    const chk = document.getElementById('chkWaUseFooter');
    const lblPrev = document.getElementById('lblWaFooterPreview');
    const inpTpl = document.getElementById('inpWaFooterTemplate');
    const inpAsesor = document.getElementById('inpWaFooterAsesorName');
    if (chk) chk.checked = cfg.enabled;
    if (inpTpl && !inpTpl.value) inpTpl.value = cfg.template;
    if (inpAsesor && !inpAsesor.value && cfg.asesorOverride) inpAsesor.value = cfg.asesorOverride;
    if (lblPrev) {
      const resolved = cfg.template.replace(/\{asesor\}/gi, _getNombreAsesorActual());
      lblPrev.textContent = cfg.enabled ? resolved : '(Desactivado para este envío)';
      lblPrev.style.opacity = cfg.enabled ? '1' : '0.6';
    }
  }

  function onToggleFooterWa(checked) {
    const cfg = _getFooterConfig();
    cfg.enabled = Boolean(checked);
    _saveFooterConfig(cfg);
    _renderFooterConfigUI();
  }

  function toggleEditarFooterWa(forceState) {
    const box = document.getElementById('waFooterEditBox');
    if (!box) return;
    const next = typeof forceState === 'boolean' ? forceState : !box.classList.contains('open');
    box.classList.toggle('open', next);
    if (next) {
      const cfg = _getFooterConfig();
      const inpTpl = document.getElementById('inpWaFooterTemplate');
      const inpAsesor = document.getElementById('inpWaFooterAsesorName');
      if (inpTpl) inpTpl.value = cfg.template;
      if (inpAsesor) inpAsesor.value = cfg.asesorOverride || _getNombreAsesorActual();
    }
  }

  async function guardarFooterAsesorWa() {
    const inpTpl = document.getElementById('inpWaFooterTemplate');
    const inpAsesor = document.getElementById('inpWaFooterAsesorName');
    const tpl = String(inpTpl?.value || '').trim().slice(0, 160) || '— *{asesor}* · Mutual Modelo (AMMER)';
    const asesorVal = String(inpAsesor?.value || '').trim().slice(0, 60);
    const cfg = _getFooterConfig();
    cfg.template = tpl;
    cfg.asesorOverride = asesorVal;
    _saveFooterConfig(cfg);
    _renderFooterConfigUI();
    toggleEditarFooterWa(false);

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (apiBase && fetchFn) {
      try {
        await fetchFn(`${apiBase}/api/admin/whatsapp/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            footer_enabled: cfg.enabled,
            footer_template: cfg.template,
            fallback_automatico: lastPanelData?.config?.fallback_automatico !== false
          })
        }, 12000);
      } catch (_) {}
    }
    _toast('✅ Pie de firma guardado.', 'success');
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
      localStorage.setItem(LS_RECENT_CHATS_KEY, JSON.stringify((list || []).slice(0, 45)));
    } catch (_) {}
  }

  function _upsertRecentChat(contact, lastPreview) {
    const phone = _normalizarTelefonoWa(contact?.phone || '');
    if (phone.length < 10) return;
    const all = _getRecentChats();
    const existing = all.find((c) => _normalizarTelefonoWa(c.phone) === phone) || {};
    const current = all.filter((c) => _normalizarTelefonoWa(c.phone) !== phone);
    const nameClean = String(contact?.name || existing.name || `+${phone}`).trim();
    const updated = {
      phone,
      name: (nameClean.startsWith('+') && existing.name && !existing.name.startsWith('+')) ? existing.name : nameClean,
      dni: String(contact?.dni || existing.dni || '').trim(),
      organismo: String(contact?.organismo || existing.organismo || '').trim(),
      lastText: lastPreview !== undefined ? String(lastPreview).slice(0, 90) : (existing.lastText || ''),
      window24h: contact?.window24h || existing.window24h || null,
      pipelineStage: contact?.pipelineStage || existing.pipelineStage || 'nuevo_lead',
      botPaused: contact?.botPaused !== undefined ? Boolean(contact.botPaused) : Boolean(existing.botPaused),
      needsHuman: contact?.needsHuman !== undefined ? Boolean(contact.needsHuman) : Boolean(existing.needsHuman),
      updatedAt: contact?.updatedAt || new Date().toISOString()
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
      status: msgObj.status || 'sent',
      timestamp: msgObj.timestamp || new Date().toISOString()
    });
    all[tel] = arr.slice(-60);
    const keys = Object.keys(all);
    if (keys.length > 35) {
      keys.slice(0, keys.length - 35).forEach((k) => delete all[k]);
    }
    try {
      localStorage.setItem(LS_LOCAL_MSGS_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function _getAuthToken() {
    if (typeof global.getApiAuthToken === 'function') {
      return String(global.getApiAuthToken() || '').trim();
    }
    try {
      if (typeof getApiAuthToken === 'function') return String(getApiAuthToken() || '').trim();
    } catch (_) {}
    return '';
  }

  function _detenerSseWhatsappBotAdmin() {
    if (waSseReconnectTimer) {
      clearTimeout(waSseReconnectTimer);
      waSseReconnectTimer = null;
    }
    if (waSseDebounceTimer) {
      clearTimeout(waSseDebounceTimer);
      waSseDebounceTimer = null;
    }
    if (waSseSource) {
      try { waSseSource.close(); } catch (_) {}
      waSseSource = null;
    }
    waSseConnected = false;
  }

  function _manejarEventoSseWhatsapp() {
    if (waSseDebounceTimer) clearTimeout(waSseDebounceTimer);
    waSseDebounceTimer = setTimeout(() => {
      const v = document.getElementById('view-whatsapp-bot');
      if (!v || !v.classList.contains('active')) return;
      cargarConversacionesServidorWa(true);
      if (activeTab === 'mensajeria' && activeContact?.phone) {
        cargarMensajesChatWhatsappAdmin(true);
      }
    }, 280);
  }

  function _iniciarSseWhatsappBotAdmin() {
    if (typeof global.EventSource !== 'function') return;
    if (!_esAdmin()) return;
    const v = document.getElementById('view-whatsapp-bot');
    if (!v || !v.classList.contains('active')) return;
    if (waSseSource && waSseSource.readyState !== 2) return;

    const apiBase = _getApiBase();
    const tok = _getAuthToken();
    if (!apiBase || !tok) return;

    try {
      const url = `${apiBase}/api/whatsapp/stream?token=${encodeURIComponent(tok)}`;
      const es = new global.EventSource(url);
      waSseSource = es;

      es.addEventListener('ready', () => {
        waSseConnected = true;
        // Con SSE conectado, reducimos la frecuencia de polling fallback a 25s
        if (chatAutoSyncTimer) {
          clearInterval(chatAutoSyncTimer);
          chatAutoSyncTimer = null;
          _iniciarChatAutoPoll();
        }
      });
      es.addEventListener('message', _manejarEventoSseWhatsapp);
      es.addEventListener('status', _manejarEventoSseWhatsapp);
      es.addEventListener('wa_event', _manejarEventoSseWhatsapp);
      es.addEventListener('conversation_updated', (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          if (global.WaArm360?.handleSseEvent) global.WaArm360.handleSseEvent('conversation_updated', data);
        } catch (_) {}
        _manejarEventoSseWhatsapp();
      });
      es.addEventListener('handoff_alert', (ev) => {
        try {
          const data = JSON.parse(ev.data || '{}');
          if (global.WaArm360?.handleSseEvent) global.WaArm360.handleSseEvent('handoff_alert', data);
        } catch (_) {}
        _manejarEventoSseWhatsapp();
      });
      es.onerror = () => {
        waSseConnected = false;
        try { es.close(); } catch (_) {}
        if (waSseSource === es) waSseSource = null;
        if (!waSseReconnectTimer) {
          waSseReconnectTimer = setTimeout(() => {
            waSseReconnectTimer = null;
            const viewCheck = document.getElementById('view-whatsapp-bot');
            if (viewCheck && viewCheck.classList.contains('active')) {
              _iniciarSseWhatsappBotAdmin();
            }
          }, 8000);
        }
      };
    } catch (_) {
      waSseConnected = false;
    }
  }

  function detenerPollingWhatsappBotAdmin() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (chatAutoSyncTimer) {
      clearInterval(chatAutoSyncTimer);
      chatAutoSyncTimer = null;
    }
    _detenerSseWhatsappBotAdmin();
  }

  function _iniciarChatAutoPoll() {
    if (chatAutoSyncTimer) return;
    const intervalMs = waSseConnected ? 25000 : 8000;
    chatAutoSyncTimer = setInterval(() => {
      const v = document.getElementById('view-whatsapp-bot');
      if (!v || !v.classList.contains('active')) {
        clearInterval(chatAutoSyncTimer);
        chatAutoSyncTimer = null;
        return;
      }
      if (document.hidden || activeTab !== 'mensajeria' || !activeContact?.phone) return;
      cargarMensajesChatWhatsappAdmin(true);
    }, intervalMs);
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
    if (st === 'PENDING_CREDENTIALS') {
      return {
        text: '🟡 Esperando variables Render',
        bg: '#fffbeb',
        fg: '#b45309',
        border: '#fde68a'
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

  function _accionesAsignadasASesion(sid, rutas, acciones, desactivadasSet) {
    const mapAcc = new Map((acciones || []).map((a) => [a.key, a.label]));
    const res = [];
    Object.keys(rutas || {}).forEach((k) => {
      if (desactivadasSet && desactivadasSet.has(k)) return;
      if (rutas[k] && rutas[k] === sid) {
        res.push(mapAcc.get(k) || k);
      }
    });
    return res;
  }

  function _getSelectedSessionObj() {
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || '';
    const sesiones = Array.isArray(lastPanelData?.sesiones) ? lastPanelData.sesiones : [];
    return sesiones.find((s) => s.sessionId === sid) || null;
  }

  function _actualizarPillVentana24h(winInfo) {
    const pill = document.getElementById('wa24hWindowPill');
    const btnTpl = document.getElementById('btnWaMetaTemplates');
    const ses = _getSelectedSessionObj();
    const isMeta = ses?.provider === 'meta_cloud_api';

    if (btnTpl) {
      btnTpl.style.display = isMeta ? 'inline-flex' : 'none';
    }
    if (!pill) return;
    if (!isMeta) {
      pill.style.display = 'none';
      return;
    }

    pill.style.display = 'block';
    const win = winInfo || activeContact?.window24h || null;
    if (win && win.open) {
      pill.style.background = '#ecfdf5';
      pill.style.color = '#15803d';
      pill.style.border = '1px solid #86efac';
      pill.textContent = `🟢 Ventana 24h Meta abierta (${win.hoursRemaining}h restantes) · Texto, media y botones libres`;
    } else if (activeContact?.phone) {
      pill.style.background = '#fffbeb';
      pill.style.color = '#92400e';
      pill.style.border = '1px solid #fde68a';
      pill.textContent = '🟡 Ventana 24h cerrada en API Meta · Usá "📋 Plantillas Meta" para iniciar o cambiá a Línea QR';
    } else {
      pill.style.background = '#eff6ff';
      pill.style.color = '#1e40af';
      pill.style.border = '1px solid #bfdbfe';
      pill.textContent = '☁️ Línea API Oficial Meta activa (Botones interactivos y Plantillas)';
    }
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

  function abrirConfigApiOficialMetaWa() {
    cambiarTabWhatsappBotAdmin('lineas', true);
    const card = document.getElementById('waMetaAddCard');
    if (card) card.style.display = 'block';
    const banner = document.getElementById('waMetaReadinessBanner');
    if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      _actualizarPillVentana24h(null);
      return;
    }
    const provTag = ses.provider === 'meta_cloud_api' ? '☁️ API Meta' : '📱 QR';
    if (ses.connected || ses.status === 'READY') {
      badgeEl.textContent = `🟢 ${provTag}${ses.phoneMasked ? ' · ' + ses.phoneMasked : ''}`;
      badgeEl.style.color = '#15803d';
    } else if (ses.status === 'WAITING_QR') {
      badgeEl.textContent = '🟡 Esperando QR';
      badgeEl.style.color = '#b45309';
    } else if (ses.status === 'PENDING_CREDENTIALS') {
      badgeEl.textContent = '🟡 Falta Render Env';
      badgeEl.style.color = '#b45309';
    } else {
      badgeEl.textContent = '🔴 Desconectada';
      badgeEl.style.color = '#b91c1c';
    }
    _actualizarPillVentana24h(null);
    if (activeContact && activeContact.phone) {
      cargarMensajesChatWhatsappAdmin(true);
    }
  }

  function _renderMetaReadinessBanner(metaStatus) {
    const box = document.getElementById('waMetaReadinessBanner');
    if (!box) return;
    const st = metaStatus || {};
    const apiBase = _getApiBase() || 'https://ammer-auditor-api.onrender.com';
    const webhookUrl = `${apiBase.replace(/\/+$/, '')}${st.webhookPath || '/api/whatsapp/meta/webhook'}`;
    const envVars = [
      { key: 'META_WA_ACCESS_TOKEN', ok: Boolean(st.hasAccessToken), label: 'System User Token' },
      { key: 'META_WA_PHONE_NUMBER_ID', ok: Boolean(st.hasPhoneNumberId), label: 'Phone Number ID' },
      { key: 'META_WA_WABA_ID', ok: Boolean(st.hasWabaId), label: 'WhatsApp Business Account ID' },
      { key: 'META_APP_SECRET', ok: Boolean(st.hasAppSecret), label: 'App Secret (firma HMAC)' },
      { key: 'META_WEBHOOK_VERIFY_TOKEN', ok: Boolean(st.hasVerifyToken), label: 'Webhook Verify Token' }
    ];

    const chips = envVars.map((v) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:7px;font-size:0.71rem;font-weight:700;background:${v.ok ? '#ecfdf5' : '#fffbeb'};color:${v.ok ? '#15803d' : '#92400e'};border:1px solid ${v.ok ? '#86efac' : '#fde68a'};">` +
        `${v.ok ? '✅' : '⏳'} <code>${_esc(v.key)}</code>` +
      `</span>`
    ).join('');

    const title = st.fullyConfigured
      ? '☁️ WhatsApp Cloud API Oficial Meta: Conectada y lista'
      : '☁️ WhatsApp Cloud API Oficial Meta (Modo Dual listo — esperando variables en Render)';

    box.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">` +
        `<div style="flex:1;min-width:260px;">` +
          `<div style="font-size:0.9rem;font-weight:800;color:#1e3a8a;">${title}</div>` +
          `<div style="font-size:0.75rem;color:#475569;margin-top:3px;line-height:1.45;">` +
            (st.fullyConfigured
              ? 'Tus credenciales en Render están activas. Podés operar líneas Meta junto con tus líneas QR desde la misma bandeja y asignarlas por acción abajo.'
              : 'El backend, webhooks HMAC, plantillas, botones nativos y Coexistence ya están desplegados. Cuando cargues estas variables en <strong>Render → Environment</strong> y pegues la URL de Webhook en Meta, la línea oficial aparecerá lista automáticamente:') +
          `</div>` +
        `</div>` +
        `<div style="display:flex;gap:6px;flex-wrap:wrap;">` +
          `<button type="button" onclick="window.copiarWebhookUrlMetaWa('${_esc(webhookUrl)}')" style="padding:0.42rem 0.78rem;border-radius:8px;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;font-size:0.73rem;font-weight:800;cursor:pointer;">📋 Copiar URL Webhook</button>` +
          `<button type="button" onclick="document.getElementById('waMetaAddCard').style.display='block'" style="padding:0.42rem 0.78rem;border-radius:8px;border:none;background:#1d4ed8;color:#ffffff;font-size:0.73rem;font-weight:800;cursor:pointer;">➕ Línea Meta Extra</button>` +
        `</div>` +
      `</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:0.65rem;">${chips}</div>` +
      `<div style="margin-top:0.55rem;font-size:0.71rem;color:#334155;">` +
        `<strong>Webhook Callback URL para Meta:</strong> <code>${_esc(webhookUrl)}</code> · Suscribir campos: <code>messages</code>` +
        (st.coexistenceDefault ? ' · <code>smb_message_echoes</code> · <code>history</code> (Coexistence activo)' : ' (opcional Coexistence: <code>smb_message_echoes</code>, <code>history</code>)') +
      `</div>`;
  }

  function copiarWebhookUrlMetaWa(url) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => _toast('📋 URL de Webhook Meta copiada.', 'success'));
    } else {
      _toast(url, 'info');
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
    const desactivadasSet = new Set(Array.isArray(cfg.acciones_desactivadas) ? cfg.acciones_desactivadas : []);

    _renderMetaReadinessBanner(data?.metaStatus);
    _renderSidebarIndicator(sesiones);
    _renderFooterConfigUI();

    const readyCount = sesiones.filter((s) => s.connected || s.status === 'READY').length;
    const qrCount = sesiones.filter((s) => s.status === 'WAITING_QR' || s.status === 'CONNECTING').length;
    const metaCount = sesiones.filter((s) => s.provider === 'meta_cloud_api').length;

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
        (metaCount > 0
          ? `<span style="padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:rgba(59,130,246,0.28);color:#dbeafe;border:1px solid rgba(147,197,253,0.45);">☁️ ${metaCount} API Oficial Meta</span>`
          : '') +
        (qrCount > 0
          ? `<span style="padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:rgba(245,158,11,0.24);color:#fef3c7;border:1px solid rgba(253,230,138,0.45);">📷 ${qrCount} esperando QR</span>`
          : '');
    }

    if (warnBox) {
      if (data && data.configured === false) {
        warnBox.style.display = 'block';
        warnBox.style.background = '#fff7ed';
        warnBox.style.borderColor = '#fed7aa';
        warnBox.style.color = '#9a3412';
        warnBox.innerHTML = '⚙️ <strong>WhatsApp Worker no configurado en Render:</strong> cargá <code>WHATSAPP_WORKER_URL</code> o configurá las variables de <strong>Meta Cloud API</strong> para habilitar líneas.';
      } else if (data && data.ok === false) {
        warnBox.style.display = 'block';
        warnBox.style.background = '#fef2f2';
        warnBox.style.borderColor = '#fecaca';
        warnBox.style.color = '#991b1b';
        warnBox.innerHTML = '⚠️ <strong>Worker temporalmente inaccesible:</strong> ' + _esc(data.mensaje || 'Verificá el servicio en Northflank.');
      } else {
        warnBox.style.display = 'none';
      }
    }

    if (sesiones.length === 0) {
      gridEl.innerHTML =
        '<div style="grid-column:1 / -1;padding:1.5rem;border-radius:12px;border:1px dashed #cbd5e1;background:#f8fafc;text-align:center;color:#64748b;font-size:0.84rem;">' +
          'No hay líneas WhatsApp disponibles todavía. Usá <strong>“➕ Nueva Línea QR”</strong> o configurá <strong>API Oficial Meta</strong>.' +
        '</div>';
    } else {
      gridEl.innerHTML = sesiones.map((s) => {
        const sid = String(s.sessionId || '');
        const isMeta = s.provider === 'meta_cloud_api';
        const aliasVal = aliases[sid] || s.alias || (s.isDefault ? 'Línea Principal' : sid);
        const badge = _badgeEstado(s);
        const isReady = Boolean(s.connected || s.status === 'READY');
        const isClosed = !isMeta && (s.status === 'CLOSED' || s.status === 'DISCONNECTED' || s.status === 'LOGGED_OUT');
        const hasQr = !isMeta && s.status === 'WAITING_QR' && s.qrDataUrl;
        const asigList = _accionesAsignadasASesion(sid, rutas, acciones, desactivadasSet);
        const chipsHtml = asigList.length > 0
          ? asigList.map((lbl) => `<span style="display:inline-flex;padding:2px 7px;border-radius:6px;background:#eef2ff;color:#3730a3;font-size:0.68rem;font-weight:700;">${_esc(lbl)}</span>`).join(' ')
          : '<span style="font-size:0.7rem;color:#94a3b8;">Sin acciones asignadas</span>';

        const safeSid = _esc(sid);
        const safeSidJs = sid.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const modePill = isMeta
          ? `<span style="padding:2px 7px;border-radius:9999px;background:#1d4ed8;color:#ffffff;font-size:0.64rem;font-weight:800;">☁️ API META${s.coexistence ? ' · COEX' : ''}</span>`
          : `<span style="padding:2px 7px;border-radius:9999px;background:#0f2744;color:#ffffff;font-size:0.64rem;font-weight:800;">${s.isDefault ? '📱 QR PRINCIPAL' : '📱 MODO QR'}</span>`;

        return (
          `<div style="background:#ffffff;border:1px solid ${isReady ? (isMeta ? '#93c5fd' : '#86efac') : '#cbd5e1'};border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.72rem;box-shadow:0 2px 10px rgba(15,23,42,0.05);">` +
            `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">` +
              `<div style="flex:1;min-width:170px;">` +
                `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">` +
                  `<input type="text" data-wa-alias-sid="${safeSid}" value="${_esc(aliasVal)}" maxlength="60" placeholder="Nombre de la línea" style="font-size:0.88rem;font-weight:800;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;width:100%;max-width:210px;background:#f8fafc;"/>` +
                  modePill +
                `</div>` +
                `<div style="font-size:0.71rem;color:#64748b;font-family:var(--font-mono,monospace);">ID: ${safeSid}${s.phoneNumberId ? ' · PhoneID ' + _esc(s.phoneNumberId) : ''}${s.displayName ? ' · ' + _esc(s.displayName) : ''}</div>` +
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
                ? `<button type="button" onclick="window.usarLineaEnMensajeriaWa('${safeSidJs}')" style="flex:1;min-width:140px;padding:0.46rem 0.75rem;border-radius:8px;border:none;background:${isMeta ? '#1d4ed8' : '#16a34a'};color:#ffffff;font-size:0.74rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;"><span>💬 Escribir desde acá</span></button>`
                : '') +
              (!isMeta
                ? (isClosed
                    ? `<button type="button" onclick="window.abrirSesionWhatsappBotAdmin('${safeSidJs}')" style="flex:1;min-width:130px;padding:0.48rem 0.75rem;border-radius:8px;border:none;background:#16a34a;color:#ffffff;font-size:0.75rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;"><span>Abrir Sesión / QR</span></button>`
                    : `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'cerrar')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:0.74rem;font-weight:700;cursor:pointer;">Cerrar</button>` +
                      `<button type="button" onclick="window.cerrarSesionWhatsappBotAdmin('${safeSidJs}', 'desvincular_nuevo_qr')" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-size:0.74rem;font-weight:700;cursor:pointer;">Nuevo QR</button>`
                  )
                : `<button type="button" onclick="window.usarLineaEnMensajeriaWa('${safeSidJs}');window.toggleMetaTemplatesDrawerWa(true);window.cargarPlantillasMetaWa();" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;font-size:0.73rem;font-weight:700;cursor:pointer;">📋 Plantillas</button>`
              ) +
              ((!isMeta && !s.isDefault) || (isMeta && !s.isMetaDefault)
                ? `<button type="button" onclick="window.${isMeta ? 'eliminarLineaMetaWhatsappAdmin' : 'eliminarSesionWhatsappBotAdmin'}('${safeSidJs}')" title="Eliminar línea adicional" style="padding:0.45rem 0.65rem;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#64748b;font-size:0.74rem;font-weight:700;cursor:pointer;">🗑️</button>`
                : '') +
            `</div>` +
          `</div>`
        );
      }).join('');
    }

    const optsHtml = (selectedSid, forActionKey = '', includeEmptyOption = false) => {
      const seen = new Set();
      const allSids = [];
      sesiones.forEach((s) => {
        if (s.sessionId && !seen.has(s.sessionId)) {
          seen.add(s.sessionId);
          allSids.push(s);
        }
      });
      if (selectedSid && !seen.has(selectedSid)) {
        allSids.push({ sessionId: selectedSid, provider: 'baileys_qr', status: 'DISCONNECTED', alias: aliases[selectedSid] || selectedSid });
      }
      if (!includeEmptyOption && allSids.length === 0) {
        allSids.push({ sessionId: 'sidecreer_default', provider: 'baileys_qr', status: 'DISCONNECTED', alias: 'Línea Principal' });
      }
      const emptyOpt = includeEmptyOption
        ? `<option value=""${selectedSid === '' ? ' selected' : ''}>— Sin asignar (vacío) —</option>`
        : '';
      return emptyOpt + allSids.map((s) => {
        const sid = s.sessionId;
        const lbl = aliases[sid] || s.alias || sid;
        const prov = s.provider === 'meta_cloud_api' ? '☁️ API' : '📱 QR';
        const stTag = s.connected ? `🟢 ${s.phoneMasked || 'Lista'}` : (s.status || 'Sin conexión');
        const sel = sid === selectedSid ? ' selected' : '';
        const disabled = (forActionKey === 'sidecreer_consulta' && s.provider === 'meta_cloud_api') ? ' disabled' : '';
        return `<option value="${_esc(sid)}"${sel}${disabled}>[${prov}] ${_esc(lbl)} (${_esc(stTag)})</option>`;
      }).join('');
    };

    rutasEl.innerHTML = acciones.map((acc) => {
      const aKey = String(acc.key || '');
      const hasExplicitRoute = Object.prototype.hasOwnProperty.call(rutas, aKey);
      const selected = hasExplicitRoute ? String(rutas[aKey] || '') : (data?.defaultSessionId || 'sidecreer_default');
      const isEnabled = !desactivadasSet.has(aKey);
      const hintTxt = !isEnabled
        ? '⏸️ Envío de mensajes desactivado para esta acción.'
        : (!selected
            ? (aKey === 'general_fallback'
                ? '⚪ Sin línea predeterminada asignada.'
                : '⚪ Sin línea asignada (usará Respaldo / Uso General si tiene línea, o enlace manual).')
            : '');
      return (
        `<div data-wa-action-card="${_esc(aKey)}" style="display:flex;flex-direction:column;gap:8px;padding:0.8rem 0.95rem;border:1px solid ${isEnabled ? '#e2e8f0' : '#fecaca'};border-radius:11px;background:${isEnabled ? '#f8fafc' : '#fef2f2'};transition:all .15s;">` +
          `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">` +
            `<div style="flex:1;min-width:0;">` +
              `<div style="font-size:0.83rem;font-weight:800;color:#0f172a;">${_esc(acc.label || aKey)}</div>` +
              `<div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${_esc(acc.description || '')}</div>` +
            `</div>` +
            `<label title="Activar o desactivar envío automático para esta acción" style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:9999px;font-size:0.7rem;font-weight:800;cursor:pointer;white-space:nowrap;border:1px solid ${isEnabled ? '#bbf7d0' : '#fca5a5'};background:${isEnabled ? '#dcfce7' : '#fee2e2'};color:${isEnabled ? '#166534' : '#991b1b'};">` +
              `<input type="checkbox" data-wa-action-enabled="${_esc(aKey)}"${isEnabled ? ' checked' : ''} onchange="window._onWaAccionVisualUpdate('${_esc(aKey)}')" style="width:14px;height:14px;accent-color:#16a34a;margin:0;cursor:pointer;"/>` +
              `<span data-wa-action-badge="${_esc(aKey)}">${isEnabled ? 'Envío activo' : 'Desactivado'}</span>` +
            `</label>` +
          `</div>` +
          `<select data-wa-route-action="${_esc(aKey)}" onchange="window._onWaAccionVisualUpdate('${_esc(aKey)}')" style="width:100%;padding:0.46rem 0.65rem;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;font-size:0.79rem;font-weight:700;opacity:${isEnabled ? '1' : '0.68'};">` +
            optsHtml(selected, aKey, true) +
          `</select>` +
          `<div data-wa-action-hint="${_esc(aKey)}" style="font-size:0.7rem;font-weight:600;color:${!isEnabled ? '#991b1b' : '#64748b'};display:${hintTxt ? 'block' : 'none'};">${_esc(hintTxt)}</div>` +
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
    } else if (pollTimer && (!enVista || qrCount === 0)) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (enVista && activeContact?.phone) {
      _iniciarChatAutoPoll();
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
    _renderFooterConfigUI();
    _renderRecentChatsList();
    _renderButtonsOptions();
    if (!activeContact) {
      const recents = _getRecentChats();
      if (recents.length > 0) {
        seleccionarContactoWhatsappAdmin(recents[0], false);
      }
    }
    cargarConversacionesServidorWa(true);
  }

  function initWhatsappBotPanelAdmin() {
    if (!_esAdmin()) {
      _toast('⛔ Solo usuarios Admin pueden acceder a WhatsApp Bot.', 'error');
      return;
    }
    _initComposerUI();
    cargarPanelWhatsappBotAdmin(false);
    _iniciarSseWhatsappBotAdmin();
    if (activeContact?.phone) {
      _iniciarChatAutoPoll();
    }
  }

  // ============================================================================
  // BUSCADOR DE CONTACTOS Y CONVERSACIONES DEL SERVIDOR
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
      _actualizarPillVentana24h(activeContact.window24h);
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
      organismo: String(contact?.organismo || '').trim(),
      window24h: contact?.window24h || null
    };

    const inpPhone = document.getElementById('inpWaBotTestPhone');
    if (inpPhone) inpPhone.value = phone;
    const inpSearch = document.getElementById('inpWaComposerBuscar');
    if (inpSearch && contact?.name && !contact.name.startsWith('+')) {
      inpSearch.value = '';
    }

    _upsertRecentChat(activeContact);
    _updateChatHeader();
    _actualizarPillVentana24h(activeContact.window24h);
    _renderWaChatThread();
    _iniciarChatAutoPoll();
    if (global.WaArm360 && typeof global.WaArm360.cargarContexto360Wa === 'function') {
      const selLine = document.getElementById('selWaBotTestSession');
      global.WaArm360.cargarContexto360Wa(selLine?.value || '', phone);
    }
    if (shouldSync) {
      cargarMensajesChatWhatsappAdmin(true);
    }
  }

  async function cargarConversacionesServidorWa(silencioso = false) {
    if (!_esAdmin()) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || '';
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (sid) qs.set('sessionId', sid);
      const armParams = global.WaArm360 && typeof global.WaArm360.buildFilterQueryParams === 'function'
        ? global.WaArm360.buildFilterQueryParams()
        : {};
      const hasArmFilter = Object.keys(armParams).length > 0;
      Object.entries(armParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/conversaciones?${qs.toString()}`, { method: 'GET' }, 12000);
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      const list = Array.isArray(data?.conversaciones) ? data.conversaciones : [];
      if (hasArmFilter) {
        const filteredMapped = list.filter((c) => c?.phone).map((c) => ({
          phone: _normalizarTelefonoWa(c.phone),
          name: c.name || `+${c.phone}`,
          dni: c.dni || '',
          window24h: c.window24h || null,
          pipelineStage: c.pipelineStage || 'nuevo_lead',
          botPaused: Boolean(c.botPaused),
          needsHuman: Boolean(c.needsHuman),
          lastText: String(c.lastMessageText || '').slice(0, 90),
          updatedAt: c.lastMessageAt
        }));
        _saveRecentChats(filteredMapped);
        _renderRecentChatsList();
      } else {
        for (let i = list.length - 1; i >= 0; i--) {
          const c = list[i];
          if (!c?.phone) continue;
          _upsertRecentChat({
            phone: c.phone,
            name: c.name || `+${c.phone}`,
            dni: c.dni || '',
            window24h: c.window24h || null,
            pipelineStage: c.pipelineStage || 'nuevo_lead',
            botPaused: Boolean(c.botPaused),
            needsHuman: Boolean(c.needsHuman),
            updatedAt: c.lastMessageAt
          }, c.lastMessageText || '');
        }
      }
      if (!silencioso) {
        _toast(`🔄 ${list.length} conversaciones sincronizadas desde el servidor.`, 'info');
      }
    } catch (_) {
      if (!silencioso) _toast('⚠️ No se pudieron sincronizar conversaciones.', 'warning');
    }
  }

  function _updateChatHeader() {
    const av = document.getElementById('waChatActiveAvatar');
    const nm = document.getElementById('waChatActiveName');
    const mt = document.getElementById('waChatActiveMeta');
    const btnOlder = document.getElementById('btnWaLoadOlder');
    if (btnOlder) btnOlder.style.display = activeContact?.phone ? 'inline-flex' : 'none';
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
    const stageMetaMap = (global.WaArm360 && global.WaArm360.STAGE_META) || {};
    box.innerHTML = list.map((c, idx) => {
      const isActive = activeContact && _normalizarTelefonoWa(activeContact.phone) === _normalizarTelefonoWa(c.phone);
      const stInfo = c.pipelineStage ? (stageMetaMap[c.pipelineStage] || { label: c.pipelineStage, cls: '' }) : null;
      const badgesHtml =
        (c.needsHuman ? '<span class="wa-stage-pill danger">🙋 Asesor</span>' : '') +
        (c.botPaused && !c.needsHuman ? '<span class="wa-stage-pill warn">⏸️ Pausado</span>' : '') +
        (stInfo ? `<span class="wa-stage-pill ${stInfo.cls || ''}">${_esc(stInfo.label)}</span>` : '');
      return (
        `<button type="button" class="wa-recent-item${isActive ? ' active' : ''}" data-wa-recent-idx="${idx}">` +
          `<span class="wa-avatar">${_esc(_initials(c.name, c.phone))}</span>` +
          `<span style="min-width:0;flex:1;">` +
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">` +
              `<span style="font-size:0.79rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.name || ('+' + c.phone))}</span>` +
              `<span style="font-size:0.65rem;color:#64748b;flex-shrink:0;">${_esc(_formatHora(c.updatedAt))}</span>` +
            `</div>` +
            `<div style="font-size:0.71rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(c.lastText || ('+' + c.phone))}</div>` +
            (badgesHtml ? `<div class="wa-recent-badges">${badgesHtml}</div>` : '') +
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
    olderMessagesByPhone.clear();
    activeContact = null;
    _updateChatHeader();
    _renderRecentChatsList();
    _renderWaChatThread();
  }

  // ============================================================================
  // DESCARGA ON-DEMAND DE MEDIA ENTRANTE Y HILO DE MENSAJES
  // ============================================================================
  async function cargarMediaMensajeWa(msgId, mediaId = '', kind = 'image', fileName = '') {
    if (!msgId || downloadingMediaIds.has(msgId)) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || 'sidecreer_default';
    if (!apiBase || !fetchFn) return;
    downloadingMediaIds.add(msgId);
    try {
      const qs = mediaId ? `?media_id=${encodeURIComponent(mediaId)}` : '';
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/media/${encodeURIComponent(sid)}/${encodeURIComponent(msgId)}${qs}`, { method: 'GET' }, 25000);
      if (!resp || !resp.ok) {
        throw new Error('Archivo no disponible en el servidor.');
      }
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      sessionMediaPreviewUrls.set(msgId, objUrl);
      if (kind === 'document') {
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = fileName || 'archivo_whatsapp';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      _renderWaChatThread();
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'No se pudo descargar el archivo.'), 'warning');
    } finally {
      downloadingMediaIds.delete(msgId);
    }
  }

  function _renderStatusTicks(m) {
    if (!m.fromMe) return '';
    const st = String(m.status || 'sent').toLowerCase();
    if (st === 'failed') {
      return `<span class="wa-checks err" title="${_esc(m.statusDetail || 'Error de entrega')}">⚠️</span>`;
    }
    if (st === 'read') {
      return '<span class="wa-checks read" title="Leído">✓✓</span>';
    }
    if (st === 'delivered') {
      return '<span class="wa-checks" title="Entregado">✓✓</span>';
    }
    return '<span class="wa-checks" title="Enviado">✓</span>';
  }

  function _renderWaChatThread(preserveScrollTop = false) {
    const threadEl = document.getElementById('waChatThread');
    if (!threadEl) return;
    const wasAtBottom = (threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight) < 80;
    const prevScroll = threadEl.scrollTop;

    if (!activeContact || !activeContact.phone) {
      threadEl.innerHTML =
        '<div style="margin:auto;text-align:center;max-width:410px;background:rgba(255,255,255,0.9);border:1px solid rgba(203,213,225,0.8);border-radius:14px;padding:1.25rem;box-shadow:0 2px 10px rgba(15,23,42,0.06);">' +
          '<div style="font-size:1.4rem;margin-bottom:6px;">💬</div>' +
          '<div style="font-size:0.86rem;font-weight:800;color:#0f2744;">WhatsApp Directo AMMER</div>' +
          '<div style="font-size:0.76rem;color:#475569;margin-top:4px;line-height:1.45;">Elegí un asociado o ingresá un número en el panel izquierdo para enviar mensajes, fotos, documentos PDF, audios o encuestas/botones.</div>' +
        '</div>';
      return;
    }

    const tel = _normalizarTelefonoWa(activeContact.phone);
    const localMap = _getLocalMessagesMap();
    const localMsgs = Array.isArray(localMap[tel]) ? localMap[tel] : [];
    const olderMsgs = Array.isArray(olderMessagesByPhone.get(tel)) ? olderMessagesByPhone.get(tel) : [];
    const remoteMsgs = Array.isArray(remoteMessagesByPhone.get(tel)) ? remoteMessagesByPhone.get(tel) : [];

    // Deduplicar por id priorizando la versión más reciente del servidor (pollVotes y status actualizados)
    const byId = new Map();
    for (const m of [...localMsgs, ...olderMsgs, ...remoteMsgs]) {
      const key = m.id || `${m.timestamp}_${m.text}`;
      const prev = byId.get(key);
      if (!prev) {
        byId.set(key, m);
      } else {
        byId.set(key, {
          ...prev,
          ...m,
          pollOptions: m.pollOptions || prev.pollOptions,
          pollVotes: m.pollVotes || prev.pollVotes
        });
      }
    }
    const merged = Array.from(byId.values()).sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    // Mapear votos provenientes de mensajes kind === 'poll_vote' hacia su encuesta original por pollMessageId
    const pollVotesByParentId = new Map();
    for (const m of merged) {
      if (m.kind === 'poll_vote' && m.pollMessageId && Array.isArray(m.selectedOptions)) {
        pollVotesByParentId.set(m.pollMessageId, m.selectedOptions);
      }
    }

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
        mediaHtml = `<img src="${_esc(previewUrl)}" alt="Imagen" class="wa-msg-media-thumb"/>`;
      } else if (previewUrl && m.kind === 'audio') {
        mediaHtml = `<audio controls src="${_esc(previewUrl)}" style="max-width:250px;height:36px;margin-bottom:4px;display:block;"></audio>`;
      } else if (m.hasMedia && m.id && (m.kind === 'image' || m.kind === 'audio' || m.kind === 'document')) {
        const lblBtn = m.kind === 'audio' ? '🎧 Escuchar audio' : (m.kind === 'image' ? '🖼️ Ver foto' : `⬇️ Descargar ${m.fileName || 'archivo'}`);
        mediaHtml = `<button type="button" onclick="window.cargarMediaMensajeWa('${_esc(m.id)}', '${_esc(m.mediaId || '')}', '${_esc(m.kind)}', '${_esc(m.fileName || '')}')" style="margin-bottom:5px;padding:4px 9px;border-radius:8px;border:1px solid #cbd5e1;background:rgba(255,255,255,0.85);color:#0f2744;font-size:0.72rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">${lblBtn}</button>`;
      } else if (m.kind === 'document' && m.fileName) {
        mediaHtml = `<div class="wa-msg-doc-pill">📄 ${_esc(m.fileName)}</div>`;
      }

      let pollHtml = '';
      if (Array.isArray(m.pollOptions) && m.pollOptions.length > 0) {
        const counts = (m.pollVotes && m.pollVotes.counts) || {};
        const lastSelected = (m.pollVotes && Array.isArray(m.pollVotes.selectedOptions) && m.pollVotes.selectedOptions) ||
          (m.id && pollVotesByParentId.get(m.id)) ||
          [];
        pollHtml = '<div class="wa-msg-poll-box">' +
          m.pollOptions.map((opt) => {
            const cnt = Number(counts[opt] || 0);
            const isVoted = cnt > 0 || lastSelected.includes(opt);
            const badge = isVoted
              ? `<span class="wa-poll-vote-badge">✅ Elegido${cnt > 1 ? ' (' + cnt + ')' : ''}</span>`
              : '';
            return `<div class="wa-msg-poll-opt${isVoted ? ' voted' : ''}"><span>🔘 ${_esc(opt)}</span>${badge}</div>`;
          }).join('') +
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
              _renderStatusTicks(m) +
              (isOut && m.id
                ? `<span class="wa-msg-feedback-row">` +
                    `<button type="button" class="wa-msg-fb-btn${m.aiFeedback === 'up' ? ' active' : ''}" title="Buena respuesta" onclick="window.enviarFeedbackMensajeWa('${_esc(m.id)}', '${m.aiFeedback === 'up' ? '' : 'up'}')">👍</button>` +
                    `<button type="button" class="wa-msg-fb-btn${m.aiFeedback === 'down' ? ' active' : ''}" title="Corregir respuesta" onclick="window.enviarFeedbackMensajeWa('${_esc(m.id)}', '${m.aiFeedback === 'down' ? '' : 'down'}')">👎</button>` +
                  `</span>`
                : '') +
            `</div>` +
          `</div>` +
        `</div>`
      );
    }).join('');

    if (preserveScrollTop) {
      threadEl.scrollTop = prevScroll;
    } else if (wasAtBottom || prevScroll === 0) {
      threadEl.scrollTop = threadEl.scrollHeight;
    }
  }

  async function cargarMensajesChatWhatsappAdmin(silencioso = false) {
    if (!_esAdmin() || !activeContact || !activeContact.phone || isSyncingChat) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || '';
    const tel = _normalizarTelefonoWa(activeContact.phone);
    isSyncingChat = true;
    try {
      const qs = new URLSearchParams({ telefono: tel, limit: '150' });
      if (sid) qs.set('sessionId', sid);
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/mensajes?${qs.toString()}`, { method: 'GET' }, 12000);
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (data && Array.isArray(data.mensajes)) {
        remoteMessagesByPhone.set(tel, data.mensajes);
        if (data.window24h) {
          activeContact.window24h = data.window24h;
          _actualizarPillVentana24h(data.window24h);
        }
        _renderWaChatThread();
        if (!silencioso) {
          _toast(data.supported === false ? 'ℹ️ Worker pendiente de actualización para sincronizar respuestas entrantes.' : '🔄 Conversación y encuestas sincronizadas.', 'info');
        }
      }
    } catch (_) {
      if (!silencioso) _toast('⚠️ No se pudieron consultar mensajes recientes.', 'warning');
    } finally {
      isSyncingChat = false;
    }
  }

  async function cargarMensajesAnterioresWa() {
    if (!_esAdmin() || !activeContact || !activeContact.phone) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    const tel = _normalizarTelefonoWa(activeContact.phone);
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || '';

    const currentAll = [...(olderMessagesByPhone.get(tel) || []), ...(remoteMessagesByPhone.get(tel) || [])]
      .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    const oldestTs = currentAll[0]?.timestamp || '';

    try {
      await fetchFn(`${apiBase}/api/admin/whatsapp/sincronizar-historial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid || undefined, telefono: tel, count: 50 })
      }, 15000);

      if (oldestTs) {
        const qs = new URLSearchParams({ telefono: tel, limit: '100', before: oldestTs });
        if (sid) qs.set('sessionId', sid);
        const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/mensajes?${qs.toString()}`, { method: 'GET' }, 12000);
        const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
        if (data && Array.isArray(data.mensajes) && data.mensajes.length > 0) {
          const prevOld = olderMessagesByPhone.get(tel) || [];
          olderMessagesByPhone.set(tel, [...data.mensajes, ...prevOld]);
          _renderWaChatThread(true);
          _toast(`⬆️ Se cargaron ${data.mensajes.length} mensajes anteriores.`, 'success');
          return;
        }
      }
      _toast('🔄 Solicitud de historial enviada al teléfono; actualizando en segundos...', 'info');
      setTimeout(() => cargarMensajesChatWhatsappAdmin(true), 2200);
    } catch (_) {
      _toast('⚠️ No se pudo consultar historial previo.', 'warning');
    }
  }

  // ============================================================================
  // PLANTILLAS META CLOUD API
  // ============================================================================
  function toggleMetaTemplatesDrawerWa(forceState) {
    const drawer = document.getElementById('waMetaTemplatesDrawer');
    if (!drawer) return;
    const next = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', next);
    if (next && (!drawer.dataset.loadedOnce || drawer.dataset.loadedOnce === '0')) {
      cargarPlantillasMetaWa();
    }
  }

  async function cargarPlantillasMetaWa() {
    const listEl = document.getElementById('waMetaTemplatesList');
    const drawer = document.getElementById('waMetaTemplatesDrawer');
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!listEl || !apiBase || !fetchFn) return;
    const selLine = document.getElementById('selWaBotTestSession');
    const sid = selLine?.value || 'meta_default';
    listEl.innerHTML = '<span style="font-size:0.74rem;color:#475569;">Consultando plantillas aprobadas en Meta...</span>';
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/meta/templates?sessionId=${encodeURIComponent(sid)}`, { method: 'GET' }, 15000);
      const data = resp && resp.ok ? await resp.json().catch(() => null) : null;
      if (drawer) drawer.dataset.loadedOnce = '1';
      if (!data || !data.ok) {
        listEl.innerHTML = `<span style="font-size:0.74rem;color:#b45309;">⚠️ ${_esc(data?.error || 'Meta Cloud API aún no configurada en Render.')}</span>`;
        return;
      }
      const tpls = (data.templates || []).filter((t) => String(t.status || '').toUpperCase() === 'APPROVED');
      if (tpls.length === 0) {
        listEl.innerHTML = '<span style="font-size:0.74rem;color:#64748b;">No se encontraron plantillas en estado APPROVED en tu WABA.</span>';
        return;
      }
      listEl.innerHTML = tpls.map((t, idx) =>
        `<button type="button" class="wa-quick-chip" data-meta-tpl-idx="${idx}" title="${_esc(t.bodyText || '')}">📋 ${_esc(t.name)} (${_esc(t.language || 'es_AR')})</button>`
      ).join('');
      listEl.querySelectorAll('[data-meta-tpl-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-meta-tpl-idx'));
          selectedMetaTemplate = tpls[i] || null;
          const sendBox = document.getElementById('waMetaTemplateSendBox');
          const lblN = document.getElementById('lblWaSelectedTemplateName');
          const lblB = document.getElementById('lblWaSelectedTemplateBody');
          if (sendBox && selectedMetaTemplate) {
            sendBox.style.display = 'flex';
            if (lblN) lblN.textContent = `Plantilla: ${selectedMetaTemplate.name} (${selectedMetaTemplate.language || 'es_AR'})`;
            if (lblB) lblB.textContent = selectedMetaTemplate.bodyText || '(Sin vista previa de cuerpo)';
          }
        });
      });
    } catch (_) {
      listEl.innerHTML = '<span style="font-size:0.74rem;color:#b91c1c;">⚠️ Error consultando plantillas Meta.</span>';
    }
  }

  async function enviarPlantillaMetaSeleccionadaWa() {
    if (!selectedMetaTemplate || isSendingCustom) return;
    const inpTel = document.getElementById('inpWaBotTestPhone');
    const telNorm = _normalizarTelefonoWa(inpTel?.value || activeContact?.phone || '');
    if (telNorm.length < 10) {
      _toast('⚠️ Seleccioná o ingresá un teléfono válido.', 'warning');
      return;
    }
    const selLine = document.getElementById('selWaBotTestSession');
    const paramsRaw = String(document.getElementById('inpWaTemplateParams')?.value || '').trim();
    const params = paramsRaw ? paramsRaw.split('|').map((s) => s.trim()) : [];

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    isSendingCustom = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/enviar-personalizado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selLine?.value || 'meta_default',
          telefono: telNorm,
          mensaje: selectedMetaTemplate.bodyText || selectedMetaTemplate.name,
          templateName: selectedMetaTemplate.name,
          templateLanguage: selectedMetaTemplate.language || 'es_AR',
          templateParams: params
        })
      }, 30000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'Error enviando plantilla.');
      }
      _appendLocalMessage(telNorm, {
        id: data.messageId,
        kind: 'template',
        text: `📋 Plantilla Meta: ${selectedMetaTemplate.name}`,
        timestamp: new Date().toISOString()
      });
      _renderWaChatThread();
      toggleMetaTemplatesDrawerWa(false);
      _toast('✅ Plantilla oficial Meta enviada.', 'success');
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'No se pudo enviar la plantilla.'), 'error');
    } finally {
      isSendingCustom = false;
    }
  }

  // ============================================================================
  // RESPUESTAS PREDEFINIDAS (QUICK REPLIES) Y SELECTOR AMPLIO DE EMOJIS
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

  function _quickReplyIconSvg(id) {
    const s = 'width="13" height="13" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
    if (id === 'qr_saludo') return `<svg ${s} stroke="#0284c7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    if (id === 'qr_recibo') return `<svg ${s} stroke="#2563eb"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    if (id === 'qr_dni') return `<svg ${s} stroke="#7c3aed"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M15 8h2"></path><path d="M15 12h2"></path><path d="M7 16h10"></path></svg>`;
    if (id === 'qr_firma') return `<svg ${s} stroke="#d97706"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>`;
    if (id === 'qr_sidecreer') return `<svg ${s} stroke="#0d9488"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
    if (id === 'qr_acreditado') return `<svg ${s} stroke="#16a34a"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    if (id === 'qr_horarios') return `<svg ${s} stroke="#dc2626"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    return `<svg ${s} stroke="#16a34a"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
  }

  function _renderQuickReplies() {
    const bar = document.getElementById('waQuickRepliesContainer');
    const adminList = document.getElementById('waQuickRepliesAdminList');
    const list = _getQuickReplies();

    if (bar) {
      bar.innerHTML = list.map((item, idx) =>
        `<button type="button" class="wa-quick-chip" data-wa-qr-idx="${idx}" title="${_esc(item.text)}">${_quickReplyIconSvg(item.id)}<span>${_esc(item.title)}</span></button>`
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

  function _getRecentEmojis() {
    try {
      const raw = localStorage.getItem(STORAGE_WA_EMOJI_RECENTS);
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch (_) {}
    return DEFAULT_RECENT_EMOJIS.slice();
  }

  function _pushRecentEmoji(emoji) {
    const prev = _getRecentEmojis().filter((x) => x !== emoji);
    prev.unshift(emoji);
    try {
      localStorage.setItem(STORAGE_WA_EMOJI_RECENTS, JSON.stringify(prev.slice(0, 24)));
    } catch (_) {}
  }

  function _renderEmojiGridOnly() {
    const grid = document.getElementById('waEmojiGridBox');
    if (!grid) return;
    const q = String(currentEmojiSearch || '').trim().toLowerCase();
    let list = [];
    if (q) {
      list = EMOJI_CATALOG.filter((item) => item.k.includes(q) || item.e === q).map((item) => item.e);
    } else if (currentEmojiCategory === 'recientes') {
      list = _getRecentEmojis();
    } else if (currentEmojiCategory === 'todos') {
      list = EMOJI_CATALOG.map((item) => item.e);
    } else {
      list = EMOJI_CATALOG.filter((item) => item.c === currentEmojiCategory).map((item) => item.e);
    }
    grid.innerHTML = list.length > 0
      ? list.map((em) => `<button type="button" class="wa-emoji-btn" onclick="window.insertarEmojiWa('${em}')">${em}</button>`).join('')
      : '<div style="grid-column:1 / -1;text-align:center;padding:0.75rem;font-size:0.74rem;color:#64748b;">Sin emojis coincidentes</div>';
  }

  function _renderEmojiPopover() {
    const pop = document.getElementById('waEmojiPopover');
    if (!pop) return;
    const tabs = [
      { id: 'recientes', label: '🕒 Recientes' },
      { id: 'oficina', label: '💼 AMMER' },
      { id: 'caras', label: '😊 Gestos' },
      { id: 'simbolos', label: '✅ Símbolos' },
      { id: 'todos', label: '🌐 Todos' }
    ];
    pop.innerHTML =
      `<input type="search" id="inpWaEmojiSearch" value="${_esc(currentEmojiSearch)}" placeholder="🔎 Buscar emoji (ej: dni, plata, ok, firma...)" oninput="window.buscarEmojiWa(this.value)" style="width:100%;padding:0.35rem 0.55rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.74rem;box-sizing:border-box;"/>` +
      `<div class="wa-emoji-tabs">` +
        tabs.map((t) => `<button type="button" class="wa-emoji-tab${currentEmojiCategory === t.id ? ' active' : ''}" onclick="window.cambiarCategoriaEmojiWa('${t.id}')">${t.label}</button>`).join('') +
      `</div>` +
      `<div id="waEmojiGridBox" class="wa-emoji-grid"></div>`;
    _renderEmojiGridOnly();
  }

  function cambiarCategoriaEmojiWa(catId) {
    currentEmojiCategory = catId || 'oficina';
    currentEmojiSearch = '';
    const inp = document.getElementById('inpWaEmojiSearch');
    if (inp) inp.value = '';
    _renderEmojiPopover();
  }

  function buscarEmojiWa(query) {
    currentEmojiSearch = String(query || '');
    _renderEmojiGridOnly();
  }

  function toggleEmojiPopoverWa(forceState) {
    const pop = document.getElementById('waEmojiPopover');
    if (!pop) return;
    const next = typeof forceState === 'boolean' ? forceState : !pop.classList.contains('open');
    if (next) _renderEmojiPopover();
    pop.classList.toggle('open', next);
    if (next) {
      setTimeout(() => document.getElementById('inpWaEmojiSearch')?.focus(), 40);
    }
  }

  function insertarEmojiWa(emoji) {
    const inp = document.getElementById('inpWaBotTestMsg');
    if (!inp) return;
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
    inp.focus();
    inp.selectionStart = inp.selectionEnd = start + emoji.length;
    _pushRecentEmoji(emoji);
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
            `<span>Enviar como nota de voz (OGG/Opus)</span>` +
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
  // ENVÍO PERSONALIZADO MULTIMEDIA / TEXTO / AUDIO / BOTONES / PIE DE FIRMA
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
    let msg = String(inpMsg?.value || '').trim();

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

    // Agregar pie de página / firma del asesor si está habilitado y hay texto o caption
    const footerTxt = _resolverPieFirmaTexto();
    if (footerTxt && msg && !msg.includes(footerTxt)) {
      msg = `${msg}\n\n${footerTxt}`;
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
        status: 'sent',
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
  // GESTIÓN DE SESIONES QR, LÍNEAS META CLOUD API Y ENRUTAMIENTO
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

  async function crearLineaMetaWhatsappAdmin() {
    if (!_esAdmin()) return;
    const alias = String(document.getElementById('inpWaMetaAlias')?.value || '').trim() || 'Línea Oficial Meta';
    const phoneId = String(document.getElementById('inpWaMetaPhoneId')?.value || '').replace(/\D/g, '');
    const wabaId = String(document.getElementById('inpWaMetaWabaId')?.value || '').replace(/\D/g, '');
    const dispPhone = String(document.getElementById('inpWaMetaDisplayPhone')?.value || '').trim();
    const tokenKey = String(document.getElementById('inpWaMetaTokenEnvKey')?.value || 'META_WA_ACCESS_TOKEN').trim();
    const coex = Boolean(document.getElementById('chkWaMetaCoexistence')?.checked);

    if (phoneId.length < 6) {
      _toast('⚠️ Ingresá un Phone Number ID válido de Meta.', 'warning');
      return;
    }

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/meta/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alias,
          phone_number_id: phoneId,
          waba_id: wabaId || undefined,
          display_phone: dispPhone || undefined,
          token_env_key: tokenKey || 'META_WA_ACCESS_TOKEN',
          coexistence_enabled: coex
        })
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok || !data?.ok) {
        throw new Error((data && (data.detail || data.error)) || 'No se pudo registrar la línea Meta.');
      }
      document.getElementById('waMetaAddCard').style.display = 'none';
      _toast('✅ Línea Meta Cloud API registrada.', 'success');
      await cargarPanelWhatsappBotAdmin(false);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error guardando línea Meta.'), 'error');
    }
  }

  async function eliminarLineaMetaWhatsappAdmin(sessionId) {
    if (!_esAdmin()) return;
    if (!global.confirm(`¿Eliminar la línea Meta "${sessionId}"?`)) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/meta/lineas/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }, 15000);
      if (!resp || !resp.ok) throw new Error('No se pudo eliminar');
      _toast('🗑️ Línea Meta eliminada.', 'success');
      await cargarPanelWhatsappBotAdmin(false);
    } catch (err) {
      _toast('⚠️ ' + (err?.message || 'Error eliminando línea Meta'), 'error');
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

  function _onWaAccionVisualUpdate(aKey) {
    const safeKey = String(aKey || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const card = document.querySelector(`[data-wa-action-card="${safeKey}"]`);
    const chk = document.querySelector(`[data-wa-action-enabled="${safeKey}"]`);
    const badge = document.querySelector(`[data-wa-action-badge="${safeKey}"]`);
    const sel = document.querySelector(`[data-wa-route-action="${safeKey}"]`);
    const hint = document.querySelector(`[data-wa-action-hint="${safeKey}"]`);
    const isEnabled = chk ? Boolean(chk.checked) : true;
    const selected = sel ? String(sel.value || '') : '';

    if (card) {
      card.style.borderColor = isEnabled ? '#e2e8f0' : '#fecaca';
      card.style.background = isEnabled ? '#f8fafc' : '#fef2f2';
    }
    if (badge) {
      badge.textContent = isEnabled ? 'Envío activo' : 'Desactivado';
      const lbl = badge.parentElement;
      if (lbl) {
        lbl.style.borderColor = isEnabled ? '#bbf7d0' : '#fca5a5';
        lbl.style.background = isEnabled ? '#dcfce7' : '#fee2e2';
        lbl.style.color = isEnabled ? '#166534' : '#991b1b';
      }
    }
    if (sel) {
      sel.style.opacity = isEnabled ? '1' : '0.68';
    }
    if (hint) {
      const hintTxt = !isEnabled
        ? '⏸️ Envío de mensajes desactivado para esta acción.'
        : (!selected
            ? (aKey === 'general_fallback'
                ? '⚪ Sin línea predeterminada asignada.'
                : '⚪ Sin línea asignada (usará Respaldo / Uso General si tiene línea, o enlace manual).')
            : '');
      hint.textContent = hintTxt;
      hint.style.color = !isEnabled ? '#991b1b' : '#64748b';
      hint.style.display = hintTxt ? 'block' : 'none';
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
      if (act) rutas[act] = String(sel.value || '');
    });

    const accionesDesactivadas = [];
    document.querySelectorAll('[data-wa-action-enabled]').forEach((chk) => {
      const act = chk.getAttribute('data-wa-action-enabled');
      if (act && !chk.checked) accionesDesactivadas.push(act);
    });

    const chkFallback = document.getElementById('chkWaBotFallbackAuto');
    const fallbackAuto = chkFallback ? Boolean(chkFallback.checked) : true;
    const footerCfg = _getFooterConfig();

    const btn = document.getElementById('btnWaBotGuardarConfig');
    if (btn) btn.disabled = true;
    try {
      const resp = await fetchFn(`${apiBase}/api/admin/whatsapp/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aliases,
          rutas,
          acciones_desactivadas: accionesDesactivadas,
          fallback_automatico: fallbackAuto,
          footer_enabled: footerCfg.enabled,
          footer_template: footerCfg.template
        })
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
      if (data && data.disabled) {
        _toast('ℹ️ ' + (data.motivo || 'El envío automático por WhatsApp está desactivado para Propuestas y Simulaciones.'), 'info');
        return { ok: false, disabled: true, fallback: false };
      }
      if (data && data.wa_link) {
        _toast(data.unassigned ? 'ℹ️ Sin línea WhatsApp asignada para propuestas; abriendo WhatsApp Web...' : 'ℹ️ Bot desconectado para propuestas; abriendo WhatsApp Web...', 'info');
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
  global.abrirConfigApiOficialMetaWa = abrirConfigApiOficialMetaWa;
  global.copiarWebhookUrlMetaWa = copiarWebhookUrlMetaWa;
  global.usarLineaEnMensajeriaWa = usarLineaEnMensajeriaWa;
  global.onWaComposerSessionChange = onWaComposerSessionChange;
  global.buscarContactoWhatsappAdmin = buscarContactoWhatsappAdmin;
  global.handleWaBuscarKeydown = handleWaBuscarKeydown;
  global.onWaDirectPhoneInput = onWaDirectPhoneInput;
  global.abrirChatPorTelefonoAdmin = abrirChatPorTelefonoAdmin;
  global.seleccionarContactoWhatsappAdmin = seleccionarContactoWhatsappAdmin;
  global.cargarConversacionesServidorWa = cargarConversacionesServidorWa;
  global.limpiarHistorialChatsWhatsappAdmin = limpiarHistorialChatsWhatsappAdmin;
  global.cargarMensajesChatWhatsappAdmin = cargarMensajesChatWhatsappAdmin;
  global.cargarMensajesAnterioresWa = cargarMensajesAnterioresWa;
  global.cargarMediaMensajeWa = cargarMediaMensajeWa;
  global.toggleMetaTemplatesDrawerWa = toggleMetaTemplatesDrawerWa;
  global.cargarPlantillasMetaWa = cargarPlantillasMetaWa;
  global.enviarPlantillaMetaSeleccionadaWa = enviarPlantillaMetaSeleccionadaWa;
  global.onToggleFooterWa = onToggleFooterWa;
  global.toggleEditarFooterWa = toggleEditarFooterWa;
  global.guardarFooterAsesorWa = guardarFooterAsesorWa;
  global.toggleEditorRespuestasRapidasWa = toggleEditorRespuestasRapidasWa;
  global.agregarRespuestaRapidaWa = agregarRespuestaRapidaWa;
  global.eliminarRespuestaRapidaWa = eliminarRespuestaRapidaWa;
  global.cambiarCategoriaEmojiWa = cambiarCategoriaEmojiWa;
  global.buscarEmojiWa = buscarEmojiWa;
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
  global.crearLineaMetaWhatsappAdmin = crearLineaMetaWhatsappAdmin;
  global.eliminarLineaMetaWhatsappAdmin = eliminarLineaMetaWhatsappAdmin;
  global.abrirSesionWhatsappBotAdmin = abrirSesionWhatsappBotAdmin;
  global.cerrarSesionWhatsappBotAdmin = cerrarSesionWhatsappBotAdmin;
  global.eliminarSesionWhatsappBotAdmin = eliminarSesionWhatsappBotAdmin;
  global._onWaAccionVisualUpdate = _onWaAccionVisualUpdate;
  global.guardarConfigWhatsappBotAdmin = guardarConfigWhatsappBotAdmin;
  global.probarEnvioWhatsappBotAdmin = probarEnvioWhatsappBotAdmin;
  global.enviarMensajeViaBotAmmerConFallback = enviarMensajeViaBotAmmerConFallback;
})(window);
