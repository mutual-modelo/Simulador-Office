// ============================================================================
// MÓDULO FRONTEND: WIDGET CONSULTA DISPONIBLE SIDECREER + PANEL ADMIN QR WHATSAPP
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  const SIDECREER_CHAT_URL = 'https://web.central.chat/5493435309272?lang=es';
  let qrPollTimer = null;

  function _copiarTarjetaSincrono(texto) {
    let ok = false;
    try {
      const aux = document.createElement('textarea');
      aux.value = texto;
      aux.setAttribute('readonly', '');
      aux.style.position = 'fixed';
      aux.style.top = '-9999px';
      aux.style.opacity = '0';
      document.body.appendChild(aux);
      aux.select();
      ok = document.execCommand('copy');
      document.body.removeChild(aux);
    } catch (_) {
      ok = false;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).catch(() => {});
    }
    return ok;
  }

  function _mostrarResultadoSidecreer(tipo, html) {
    const resBox = document.getElementById('sidecreer-resultado-box');
    if (!resBox) return;
    resBox.style.display = 'block';
    if (tipo === 'ok') {
      resBox.style.background = '#ecfdf5';
      resBox.style.border = '1px solid #86efac';
      resBox.style.color = '#14532d';
    } else if (tipo === 'warn') {
      resBox.style.background = '#fffbeb';
      resBox.style.border = '1px solid #fde68a';
      resBox.style.color = '#78350f';
    } else {
      resBox.style.background = '#fef2f2';
      resBox.style.border = '1px solid #fecaca';
      resBox.style.color = '#991b1b';
    }
    resBox.innerHTML = html;
  }

  function _formatearPesos(val) {
    if (typeof global.formatMoney === 'function') {
      return global.formatMoney(Number(val || 0));
    }
    const n = Number(val || 0);
    return '$ ' + (Number.isFinite(n) ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
  }

  function _esc(str) {
    if (typeof global.sanitizeHTML === 'function') return global.sanitizeHTML(str);
    return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _getApiBase() {
    if (typeof global.RENDER_API_URL === 'string' && global.RENDER_API_URL.startsWith('http')) {
      return global.RENDER_API_URL;
    }
    if (global.CONFIG && typeof global.CONFIG.RENDER_API_URL === 'string' && global.CONFIG.RENDER_API_URL.startsWith('http')) {
      return global.CONFIG.RENDER_API_URL;
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

  function _abrirFallbackChatWeb(formateada, copiadoOk, motivoAviso) {
    const aviso = motivoAviso
      ? '<div style="font-size:0.71rem;color:#92400e;margin-bottom:4px;">' + _esc(motivoAviso) + '</div>'
      : '';
    _mostrarResultadoSidecreer(
      'warn',
      aviso +
      '<div style="font-weight:700;">📋 Tarjeta ' + _esc(formateada) + (copiadoOk ? ' copiada al portapapeles' : '') + '.</div>' +
      '<div style="margin-top:6px;"><a href="' + SIDECREER_CHAT_URL + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:0.38rem 0.75rem;border-radius:7px;background:#2563eb;color:#ffffff;font-weight:700;font-size:0.74rem;text-decoration:none;">💬 Abrir Chat Oficial Sidecreer ↗</a></div>'
    );
  }

  async function ejecutarConsultaSidecreerSimulador() {
    const inputTarjeta = document.getElementById('input-tarjeta-sidecreer');
    const btnConsultar = document.getElementById('btn-consultar-sidecreer');
    if (!inputTarjeta) return;

    const soloDigitos = (inputTarjeta.dataset.valorLimpio || inputTarjeta.value || '').replace(/\D/g, '').trim();
    if (soloDigitos.length < 12 || soloDigitos.length > 16) {
      _mostrarResultadoSidecreer('warn', '⚠️ Ingresá entre <strong>12 y 16 dígitos</strong> del Nro de Tarjeta Sidecreer.');
      inputTarjeta.focus();
      return;
    }

    const formateada = (soloDigitos.match(/.{1,4}/g) || [soloDigitos]).join(' ');
    const copiadoOk = _copiarTarjetaSincrono(soloDigitos);

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();

    if (!apiBase || !fetchFn) {
      let chatWin = null;
      try { chatWin = global.open(SIDECREER_CHAT_URL, '_blank', 'noopener,noreferrer'); } catch (_) {}
      _abrirFallbackChatWeb(formateada, copiadoOk, chatWin ? '' : 'Abrí el chat desde el enlace:');
      return;
    }

    const origHtml = btnConsultar ? btnConsultar.innerHTML : '';
    if (btnConsultar) {
      btnConsultar.disabled = true;
      btnConsultar.style.opacity = '0.75';
      btnConsultar.innerHTML = '<span>⏳ Consultando disponible...</span>';
    }
    _mostrarResultadoSidecreer('warn', '⏳ Consultando saldo automático para tarjeta <strong>' + _esc(formateada) + '</strong>...');

    try {
      const resp = await fetchFn(`${apiBase}/api/sidecreer/consultar-saldo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero_tarjeta: soloDigitos })
      }, 45000);

      if (!resp || !resp.ok) {
        _abrirFallbackChatWeb(formateada, copiadoOk, 'No se pudo consultar en automático. Usá el chat web oficial:');
        return;
      }

      const data = await resp.json().catch(() => null);
      if (!data) {
        _abrirFallbackChatWeb(formateada, copiadoOk, 'Respuesta inválida del servidor. Usá el chat web oficial:');
        return;
      }

      if (data.ok === true) {
        const cuotasTxt = _formatearPesos(data.saldo_cuotas);
        const contadoTxt = _formatearPesos(data.saldo_contado);
        const notaCache = data.cached ? ' · caché reciente' : '';

        const saldoCuotasNum = (data.saldo_cuotas !== null && data.saldo_cuotas !== undefined)
          ? Number(data.saldo_cuotas)
          : 0;
        const saldoSinDecimales = Math.floor(Number.isFinite(saldoCuotasNum) && saldoCuotasNum > 0 ? saldoCuotasNum : 0);

        let notaAutocompletado = '';
        if (saldoSinDecimales > 0) {
          try {
            if (typeof global.setModo === 'function') global.setModo('cuota');
            if (typeof global.setQuickAmount === 'function') global.setQuickAmount(saldoSinDecimales);
            notaAutocompletado = '<div style="font-size:0.68rem;font-weight:700;color:#065f46;margin-top:4px;">⚡ Modo cambiado a <strong>Por Cuota Objetivo</strong> y cargado con <strong>$ ' + saldoSinDecimales.toLocaleString('es-AR') + '</strong> (sin decimales).</div>';
          } catch (_) {}
        }

        _mostrarResultadoSidecreer(
          'ok',
          '<div style="font-weight:800;font-size:0.77rem;color:#065f46;margin-bottom:6px;">✅ Disponible Tarjeta ' + _esc(formateada) + '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
            '<div style="background:#ffffff;border:1px solid #86efac;border-radius:8px;padding:0.45rem 0.55rem;">' +
              '<div style="font-size:0.65rem;font-weight:700;color:#475569;text-transform:uppercase;">En Cuotas</div>' +
              '<div style="font-size:0.88rem;font-weight:800;color:#047857;font-variant-numeric:tabular-nums;">' + _esc(cuotasTxt) + '</div>' +
            '</div>' +
            '<div style="background:#ffffff;border:1px solid #86efac;border-radius:8px;padding:0.45rem 0.55rem;">' +
              '<div style="font-size:0.65rem;font-weight:700;color:#475569;text-transform:uppercase;">Contado</div>' +
              '<div style="font-size:0.88rem;font-weight:800;color:#047857;font-variant-numeric:tabular-nums;">' + _esc(contadoTxt) + '</div>' +
            '</div>' +
          '</div>' +
          notaAutocompletado +
          '<div style="font-size:0.67rem;color:#047857;margin-top:4px;">Consulta automática vía línea institucional' + notaCache + '.</div>'
        );
        if (typeof global.showToast === 'function') {
          global.showToast(saldoSinDecimales > 0
            ? '✅ Disponible Sidecreer recuperado y cargado en Cuota Objetivo.'
            : '✅ Disponible Sidecreer recuperado.');
        }
        return;
      }

      if (data.fallback_chat === true) {
        _abrirFallbackChatWeb(formateada, copiadoOk, data.mensaje || 'Línea automática aguardando vinculación QR.');
        return;
      }

      _mostrarResultadoSidecreer(
        'err',
        '<div style="font-weight:700;">⚠️ ' + _esc(data.mensaje || 'Sin saldo disponible o tarjeta inhabilitada.') + '</div>' +
        '<div style="margin-top:5px;font-size:0.71rem;">También podés verificar manualmente: <a href="' + SIDECREER_CHAT_URL + '" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">Abrir chat Sidecreer ↗</a></div>'
      );
    } catch (_) {
      _abrirFallbackChatWeb(formateada, copiadoOk, 'Tiempo de espera agotado. Usá el chat web oficial:');
    } finally {
      if (btnConsultar) {
        btnConsultar.disabled = false;
        btnConsultar.style.opacity = '1';
        btnConsultar.innerHTML = origHtml || '<span>🔍 Consultar</span>';
      }
    }
  }

  function actualizarVisibilidadAdminSidecreerWA() {
    const btn = document.getElementById('btnAdminConfigWhatsAppSidecreer');
    if (!btn) return;
    const esAdmin = (typeof global.esAdminAuditoria === 'function') && global.esAdminAuditoria();
    btn.style.display = esAdmin ? 'inline-flex' : 'none';
  }

  function _detenerPollingQR() {
    if (qrPollTimer) {
      clearInterval(qrPollTimer);
      qrPollTimer = null;
    }
  }

  async function consultarEstadoAdminWhatsAppSidecreer() {
    const badgeEl = document.getElementById('waSidecreerStatusBadge');
    const infoEl = document.getElementById('waSidecreerStatusMsg');
    const qrBox = document.getElementById('waSidecreerQrBox');
    const qrImg = document.getElementById('imgQrWhatsAppSidecreer');
    const btnDesvincular = document.getElementById('btnDesvincularWaSidecreer');

    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) {
      if (badgeEl) {
        badgeEl.textContent = '🔴 Error de configuración';
        badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;';
      }
      if (infoEl) infoEl.textContent = 'No se encontró la URL del servidor API. Recargá la página con Ctrl+F5.';
      if (qrBox) qrBox.style.display = 'none';
      _detenerPollingQR();
      return;
    }

    try {
      const resp = await fetchFn(`${apiBase}/api/admin/sidecreer/whatsapp/estado`, {
        method: 'GET'
      }, 20000);
      const data = resp ? await resp.json().catch(() => null) : null;
      if (!resp || !resp.ok) {
        throw new Error((data && (data.detail || data.mensaje)) || ('El servidor API devolvió HTTP ' + (resp ? resp.status : 'sin respuesta')));
      }
      if (!data) throw new Error('Sin respuesta del servidor.');

      if (data.configured === false || data.status === 'NOT_CONFIGURED') {
        if (badgeEl) {
          badgeEl.textContent = '⚙️ Falta configurar en Render';
          badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;';
        }
        if (infoEl) infoEl.textContent = data.mensaje || 'Configurá WHATSAPP_WORKER_URL y WHATSAPP_WORKER_SECRET en Render.';
        if (qrBox) qrBox.style.display = 'none';
        if (btnDesvincular) btnDesvincular.style.display = 'none';
        _detenerPollingQR();
        return;
      }

      if (data.connected === true || data.status === 'READY') {
        if (badgeEl) {
          badgeEl.textContent = '🟢 Conectado ' + (data.phoneMasked ? '(' + data.phoneMasked + ')' : '');
          badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#ecfdf5;color:#15803d;border:1px solid #86efac;';
        }
        if (infoEl) infoEl.textContent = 'La línea secundaria está vinculada y lista para responder consultas de Sidecreer automáticamente.';
        if (qrBox) qrBox.style.display = 'none';
        if (btnDesvincular) btnDesvincular.style.display = 'inline-flex';
        _detenerPollingQR();
        return;
      }

      if (data.status === 'WAITING_QR' && data.qrDataUrl) {
        if (badgeEl) {
          badgeEl.textContent = '🟡 Esperando escaneo de QR';
          badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#fffbeb;color:#b45309;border:1px solid #fde68a;';
        }
        if (infoEl) infoEl.textContent = 'Abrí WhatsApp en tu teléfono secundario → Dispositivos vinculados → Vincular un dispositivo y escaneá el código.';
        if (qrImg) qrImg.src = data.qrDataUrl;
        if (qrBox) qrBox.style.display = 'flex';
        if (btnDesvincular) btnDesvincular.style.display = 'inline-flex';
        return;
      }

      if (badgeEl) {
        badgeEl.textContent = '🔄 ' + _esc(data.status || 'CONECTANDO');
        badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;';
      }
      if (infoEl) infoEl.textContent = data.mensaje || data.lastError || 'Conectando con el servicio WhatsApp en Northflank...';
      if (qrBox) qrBox.style.display = 'none';
      if (btnDesvincular) btnDesvincular.style.display = data.configured ? 'inline-flex' : 'none';
    } catch (err) {
      if (badgeEl) {
        badgeEl.textContent = '🔴 Error de conexión';
        badgeEl.style.cssText = 'display:inline-flex;padding:4px 10px;border-radius:9999px;font-size:0.74rem;font-weight:700;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;';
      }
      if (infoEl) infoEl.textContent = (err && err.message) ? err.message : 'No se pudo consultar el estado del worker.';
      if (qrBox) qrBox.style.display = 'none';
    }
  }

  function abrirModalAdminWhatsAppSidecreer() {
    if (typeof global.esAdminAuditoria === 'function' && !global.esAdminAuditoria()) {
      if (typeof global.showToast === 'function') global.showToast('⛔ Solo usuarios Admin pueden gestionar la vinculación WhatsApp.');
      return;
    }
    if (typeof global.abrirModal === 'function') {
      global.abrirModal('modalAdminWhatsAppSidecreer');
    }
    consultarEstadoAdminWhatsAppSidecreer();
    _detenerPollingQR();
    qrPollTimer = setInterval(() => {
      const mod = document.getElementById('modalAdminWhatsAppSidecreer');
      if (!mod || !mod.classList.contains('open')) {
        _detenerPollingQR();
        return;
      }
      consultarEstadoAdminWhatsAppSidecreer();
    }, 4500);
  }

  function cerrarModalAdminWhatsAppSidecreer() {
    _detenerPollingQR();
    if (typeof global.cerrarModal === 'function') {
      global.cerrarModal('modalAdminWhatsAppSidecreer');
    }
  }

  async function desvincularWhatsAppSidecreerAdmin() {
    if (!confirm('¿Confirmás desvincular la línea WhatsApp actual y generar un nuevo código QR?')) return;
    const apiBase = _getApiBase();
    const fetchFn = _getFetchFn();
    if (!apiBase || !fetchFn) return;

    const btn = document.getElementById('btnDesvincularWaSidecreer');
    if (btn) btn.disabled = true;
    try {
      await fetchFn(`${apiBase}/api/admin/sidecreer/whatsapp/desvincular`, {
        method: 'POST'
      }, 20000);
      if (typeof global.showToast === 'function') global.showToast('🔄 Regenerando código QR...');
      setTimeout(() => abrirModalAdminWhatsAppSidecreer(), 1200);
    } catch (err) {
      if (typeof global.showToast === 'function') global.showToast('⚠️ Error desvinculando: ' + (err?.message || 'Error'));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initConsultaSidecreerSimulador() {
    const inputTarjeta = document.getElementById('input-tarjeta-sidecreer');
    const btnConsultar = document.getElementById('btn-consultar-sidecreer');
    actualizarVisibilidadAdminSidecreerWA();
    if (!inputTarjeta || !btnConsultar) return;
    if (btnConsultar.dataset.sidecreerBound === '1') return;
    btnConsultar.dataset.sidecreerBound = '1';

    inputTarjeta.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        const cursor = inputTarjeta.selectionStart;
        if (cursor > 0 && inputTarjeta.selectionStart === inputTarjeta.selectionEnd) {
          if (inputTarjeta.value[cursor - 1] === ' ') {
            e.preventDefault();
            const val = inputTarjeta.value;
            inputTarjeta.value = val.slice(0, cursor - 2) + val.slice(cursor);
            inputTarjeta.setSelectionRange(cursor - 2, cursor - 2);
            inputTarjeta.dispatchEvent(new Event('input'));
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        ejecutarConsultaSidecreerSimulador();
      }
    });

    inputTarjeta.addEventListener('input', () => {
      const valOrig = inputTarjeta.value;
      const cursorOrig = inputTarjeta.selectionStart || 0;
      const digitosAntes = (valOrig.slice(0, cursorOrig).match(/\d/g) || []).length;
      const soloNum = valOrig.replace(/\D/g, '').slice(0, 16);

      const partes = soloNum.match(/.{1,4}/g);
      const formateado = partes ? partes.join(' ') : '';
      inputTarjeta.value = formateado;
      inputTarjeta.dataset.valorLimpio = soloNum;

      let nuevoCursor = 0;
      let cont = 0;
      for (let i = 0; i < formateado.length; i++) {
        if (formateado[i] !== ' ') cont++;
        if (cont === digitosAntes) {
          nuevoCursor = i + 1;
          break;
        }
      }
      if (digitosAntes === 0) nuevoCursor = 0;
      if (digitosAntes >= soloNum.length) nuevoCursor = formateado.length;
      try {
        inputTarjeta.setSelectionRange(nuevoCursor, nuevoCursor);
      } catch (_) {}
    });

    btnConsultar.addEventListener('click', (e) => {
      e.preventDefault();
      ejecutarConsultaSidecreerSimulador();
    });
  }

  global.initConsultaSidecreerSimulador = initConsultaSidecreerSimulador;
  global.ejecutarConsultaSidecreerSimulador = ejecutarConsultaSidecreerSimulador;
  global.actualizarVisibilidadAdminSidecreerWA = actualizarVisibilidadAdminSidecreerWA;
  global.abrirModalAdminWhatsAppSidecreer = abrirModalAdminWhatsAppSidecreer;
  global.cerrarModalAdminWhatsAppSidecreer = cerrarModalAdminWhatsAppSidecreer;
  global.consultarEstadoAdminWhatsAppSidecreer = consultarEstadoAdminWhatsAppSidecreer;
  global.desvincularWhatsAppSidecreerAdmin = desvincularWhatsAppSidecreerAdmin;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initConsultaSidecreerSimulador);
    } else {
      initConsultaSidecreerSimulador();
    }
  }
})(window);
