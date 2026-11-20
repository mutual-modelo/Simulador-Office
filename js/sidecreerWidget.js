// ============================================================================
// MÓDULO FRONTEND: WIDGET CONSULTA DISPONIBLE SIDECREER
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  function initConsultaSidecreerSimulador() {
    const inputTarjeta = document.getElementById('input-tarjeta-sidecreer');
    const btnConsultar = document.getElementById('btn-consultar-sidecreer');
    const resBox = document.getElementById('sidecreer-resultado-box');
    if (!inputTarjeta || !btnConsultar) return;

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
        btnConsultar.click();
      }
    });

    inputTarjeta.addEventListener('input', () => {
      const valOrig = inputTarjeta.value;
      const cursorOrig = inputTarjeta.selectionStart;
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
      inputTarjeta.setSelectionRange(nuevoCursor, nuevoCursor);
    });

    const mostrarResultadoSidecreer = (tipo, html) => {
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
    };

    btnConsultar.addEventListener('click', async () => {
      const tarjetaLimpia = (inputTarjeta.dataset.valorLimpio || inputTarjeta.value.replace(/\D/g, '')).trim();
      if (tarjetaLimpia.length < 12 || tarjetaLimpia.length > 16) {
        mostrarResultadoSidecreer('warn', '⚠️ Ingresá entre <strong>12 y 16 dígitos</strong> del Nro de Tarjeta Sidecreer.');
        inputTarjeta.focus();
        return;
      }

      let copiadoOk = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(tarjetaLimpia);
          copiadoOk = true;
        }
      } catch (e) {
        copiadoOk = false;
      }

      if (!copiadoOk) {
        try {
          const aux = document.createElement('textarea');
          aux.value = tarjetaLimpia;
          aux.style.position = 'fixed';
          aux.style.opacity = '0';
          document.body.appendChild(aux);
          aux.select();
          copiadoOk = document.execCommand('copy');
          document.body.removeChild(aux);
        } catch (e) {
          copiadoOk = false;
        }
      }

      if (resBox) resBox.style.display = 'none';
      const chatUrl = 'https://web.central.chat/5493435309272?lang=es';
      window.open(chatUrl, '_blank', 'noopener,noreferrer');

      if (typeof showToast === 'function') {
        showToast(copiadoOk ? '📋 Nro de tarjeta copiado y chat Sidecreer abierto.' : '💬 Chat Sidecreer abierto.');
      }
    });
  }

  global.initConsultaSidecreerSimulador = initConsultaSidecreerSimulador;
})(window);
