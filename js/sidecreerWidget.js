// ============================================================================
// MÓDULO FRONTEND: WIDGET CONSULTA DISPONIBLE SIDECREER
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  const SIDECREER_CHAT_URL = 'https://web.central.chat/5493435309272?lang=es';

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

  function ejecutarConsultaSidecreerSimulador() {
    const inputTarjeta = document.getElementById('input-tarjeta-sidecreer');
    if (!inputTarjeta) return;

    const soloDigitos = (inputTarjeta.dataset.valorLimpio || inputTarjeta.value || '').replace(/\D/g, '').trim();
    if (soloDigitos.length < 12 || soloDigitos.length > 16) {
      _mostrarResultadoSidecreer('warn', '⚠️ Ingresá entre <strong>12 y 16 dígitos</strong> del Nro de Tarjeta Sidecreer.');
      inputTarjeta.focus();
      return;
    }

    const formateada = (soloDigitos.match(/.{1,4}/g) || [soloDigitos]).join(' ');
    const copiadoOk = _copiarTarjetaSincrono(soloDigitos);

    // Abrir ventana de forma síncrona dentro del evento click para evitar bloqueos de popup
    let chatWin = null;
    try {
      chatWin = global.open(SIDECREER_CHAT_URL, '_blank', 'noopener,noreferrer');
    } catch (_) {
      chatWin = null;
    }

    if (chatWin) {
      _mostrarResultadoSidecreer(
        'ok',
        '<div style="font-weight:700;">✅ Tarjeta ' + sanitizeHTML(formateada) + ' lista' + (copiadoOk ? ' y copiada' : '') + '.</div>' +
        '<div style="font-size:0.7rem;margin-top:2px;">Si no se abrió la pestaña, <a href="' + SIDECREER_CHAT_URL + '" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;font-weight:700;text-decoration:underline;">abrí el chat acá ↗</a>.</div>'
      );
      if (typeof global.showToast === 'function') {
        global.showToast(copiadoOk ? '📋 Nro de tarjeta copiado y chat Sidecreer abierto.' : '💬 Chat Sidecreer abierto.');
      }
    } else {
      _mostrarResultadoSidecreer(
        'warn',
        '<div style="font-weight:700;">📋 Tarjeta ' + sanitizeHTML(formateada) + (copiadoOk ? ' copiada al portapapeles' : '') + '.</div>' +
        '<div style="margin-top:4px;"><a href="' + SIDECREER_CHAT_URL + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:0.35rem 0.7rem;border-radius:6px;background:#2563eb;color:#ffffff;font-weight:700;font-size:0.74rem;text-decoration:none;">💬 Abrir Chat Oficial Sidecreer ↗</a></div>'
      );
      if (typeof global.showToast === 'function') {
        global.showToast('📋 Tarjeta copiada. Abrí el chat desde el enlace mostrado.');
      }
    }
  }

  function initConsultaSidecreerSimulador() {
    const inputTarjeta = document.getElementById('input-tarjeta-sidecreer');
    const btnConsultar = document.getElementById('btn-consultar-sidecreer');
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

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initConsultaSidecreerSimulador);
    } else {
      initConsultaSidecreerSimulador();
    }
  }
})(window);
