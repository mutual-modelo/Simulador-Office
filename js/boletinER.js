// ============================================================================
// MÓDULO FRONTEND: BOLETÍN OFICIAL DE ENTRE RÍOS (AMMER)
// Extraído de index.html en Etapa 5 (sin alterar MOTOR_FINANCIERO_EXACTO)
// ============================================================================
(function (global) {
  'use strict';

  let _boletinPollTimer = null;

  function _safeUrl(u) {
    if (typeof global.sanitizeSafeUrl === 'function') return global.sanitizeSafeUrl(u);
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? sanitizeHTML(s) : '';
  }

  function actualizarLinkDateasBoletin() {
    return;
  }

  async function cargarEstadoBoletinOficialAuditoria() {
    const wrapAdmin = document.getElementById('wrapAdminSyncBoletin');
    if (wrapAdmin) {
      wrapAdmin.style.display = (typeof esAdminAuditoria === 'function' && esAdminAuditoria()) ? 'flex' : 'none';
    }
    const badge = document.getElementById('badgeEstadoIndiceBoletin');
    const progBox = document.getElementById('boletinSyncProgressBox');
    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/boletin/estado`, { method: 'GET' }, 30000);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (badge) {
        if (data.ok) {
          const tot = Number(data.total_boletines || 0);
          if (tot > 0) {
            badge.textContent = tot + ' ediciones (' + (data.fecha_primera || '') + ' → ' + (data.fecha_ultima || '') + ')';
            badge.style.background = '#ecfdf5';
            badge.style.color = '#065f46';
            badge.style.borderColor = '#a7f3d0';
          } else {
            badge.textContent = '0 ediciones indexadas';
            badge.style.background = '#fffbeb';
            badge.style.color = '#92400e';
            badge.style.borderColor = '#fde68a';
          }
        } else {
          badge.textContent = data.tablas_pendientes ? 'Requiere ejecutar SQL v2 en Supabase' : 'Índice no disponible';
          badge.style.background = '#fff1f2';
          badge.style.color = '#9f1239';
          badge.style.borderColor = '#fecdd3';
        }
      }
      const sync = data.sync || {};
      if (progBox) {
        if (sync.running) {
          const pendTot = Number(sync.total_pendientes || sync.total_objetivo || 0);
          progBox.style.display = 'block';
          progBox.innerHTML = '⏳ <strong>Indexación en curso:</strong> ' + sanitizeHTML(sync.mensaje || 'Procesando...') +
            ' <span style="font-family:monospace;color:#3730a3;">[Procesados: ' + sanitizeHTML(String(sync.procesados || 0)) + '/' + sanitizeHTML(String(pendTot)) +
            ' · Nuevos: ' + sanitizeHTML(String(sync.nuevos || 0)) +
            ' · Ya indexados: ' + sanitizeHTML(String(sync.saltados || 0)) +
            (sync.errores ? (' · Errores: ' + sanitizeHTML(String(sync.errores))) : '') + ']</span>';
          if (_boletinPollTimer) {
            clearTimeout(_boletinPollTimer);
            _boletinPollTimer = null;
          }
          _boletinPollTimer = setTimeout(() => {
            _boletinPollTimer = null;
            cargarEstadoBoletinOficialAuditoria();
          }, 2500);
        } else {
          if (_boletinPollTimer) {
            clearTimeout(_boletinPollTimer);
            _boletinPollTimer = null;
          }
          progBox.style.display = 'none';
        }
      }
    } catch (_) {
      if (badge) {
        badge.textContent = 'Conectando con Render...';
        badge.style.background = '#f1f5f9';
        badge.style.color = '#64748b';
        badge.style.borderColor = '#cbd5e1';
      }
      if (progBox && progBox.style.display === 'block') {
        progBox.textContent = '⏳ Render está reiniciando o completando un deploy. Reintentando conexión automáticamente...';
        if (!_boletinPollTimer) {
          _boletinPollTimer = setTimeout(() => {
            _boletinPollTimer = null;
            cargarEstadoBoletinOficialAuditoria();
          }, 5000);
        }
      }
    }
  }

  async function sincronizarBoletinOficialAuditoria(ultimosDias = 30) {
    if (typeof esAdminAuditoria !== 'function' || !esAdminAuditoria()) {
      showToast('Solo el rol Admin puede lanzar sincronizaciones del índice.');
      return;
    }
    const progBox = document.getElementById('boletinSyncProgressBox');
    if (progBox) {
      progBox.style.display = 'block';
      progBox.textContent = '⏳ Iniciando indexación de Boletines Oficiales en Render...';
    }
    try {
      const body = ultimosDias > 0
        ? { ultimos_dias: ultimosDias, solo_faltantes: true, concurrency: 2 }
        : { desde: '2003-12', solo_faltantes: true, concurrency: 2 };
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/boletin/sincronizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 35000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.ok === false) {
        throw new Error(data.detail || data.mensaje || ('HTTP ' + resp.status));
      }
      showToast(data.mensaje || 'Sincronización iniciada.');
      cargarEstadoBoletinOficialAuditoria();
    } catch (err) {
      if (progBox) {
        progBox.style.display = 'block';
        progBox.textContent = '⚠️ Render no respondió aún (puede estar reiniciando o despertando). Reintentá en 15 segundos.';
      }
    }
  }

  async function consultarBoletinOficialAuditoria(docOverride) {
    const inp = document.getElementById('inputBoletinDniConsulta');
    const resBox = document.getElementById('resultadoBoletinOficialER');
    const btn = document.getElementById('btnConsultarBoletinER');
    const rawVal = docOverride !== undefined ? String(docOverride) : String(inp ? inp.value : '');
    const cleanDigits = rawVal.replace(/\D/g, '');
    if (inp && docOverride !== undefined) inp.value = rawVal;
    actualizarLinkDateasBoletin();

    if (cleanDigits.length < 7) {
      showToast('Ingresá un DNI o CUIL válido (al menos 7 dígitos).');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Consultando...'; }
    if (resBox) {
      resBox.style.display = 'block';
      resBox.innerHTML = '<div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">⏳ Buscando DNI/CUIL ' + sanitizeHTML(cleanDigits) + ' en el índice del Boletín Oficial de Entre Ríos...</div>';
    }

    try {
      const resp = await fetchConTimeout(`${RENDER_API_URL}/api/boletin/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: cleanDigits, incluir_resumen_ia: true })
      }, 25000);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.detail || data.mensaje || ('HTTP ' + resp.status));
      }

      if (data.ok === false) {
        resBox.innerHTML =
          '<div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">' +
            '<strong>⚠️ ' + sanitizeHTML(data.mensaje || 'Índice no listo') + '</strong>' +
          '</div>';
        return;
      }

      const lista = Array.isArray(data.resultados) ? data.resultados : [];
      if (typeof global.registrarBoletinEnAuditoria20 === 'function') {
        try { global.registrarBoletinEnAuditoria20(data); } catch (_) {}
      }
      if (lista.length === 0) {
        resBox.innerHTML =
          '<div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">' +
            '<div><strong>✅ Sin menciones registradas</strong> · ' + sanitizeHTML(data.mensaje || '') + '</div>' +
          '</div>';
        return;
      }

      const headerCls = data.tiene_alerta_critica
        ? 'bg-rose-50 border-rose-200 text-rose-900'
        : 'bg-amber-50 border-amber-200 text-amber-900';
      const iconTxt = data.tiene_alerta_critica ? '🚨' : '📄';

      const resumenHtml = data.resumen_ia
        ? '<div class="mt-2 p-2.5 rounded-lg bg-white/80 border border-slate-200/80 text-xs text-slate-800 leading-relaxed"><strong>🤖 Resumen IA:</strong> ' + sanitizeHTML(data.resumen_ia) + '</div>'
        : '';

      const itemsHtml = lista.map(item => {
        const badgeCat = item.categoria && item.categoria.includes('Alerta')
          ? 'bg-rose-100 text-rose-800 border-rose-200'
          : (item.categoria && item.categoria.includes('Sucesor')
            ? 'bg-amber-100 text-amber-800 border-amber-200'
            : 'bg-indigo-50 text-indigo-800 border-indigo-200');
        const safePdfUrl = _safeUrl(item.url_pdf_pagina);
        return '<div class="p-3 rounded-xl border border-slate-200 bg-slate-50/70">' +
          '<div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              '<span class="font-mono text-xs font-bold text-slate-900">' + sanitizeHTML(item.fecha || '') + '</span>' +
              (item.numero_edicion ? ('<span class="text-[11px] font-mono text-slate-500">Boletín Nº ' + sanitizeHTML(item.numero_edicion) + '</span>') : '') +
              '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ' + badgeCat + '">' + sanitizeHTML(item.categoria || 'Mención') + '</span>' +
              '<span class="text-[11px] text-slate-500">Pág. ' + sanitizeHTML(String(item.pagina || 1)) + '</span>' +
            '</div>' +
            (safePdfUrl ? ('<a href="' + safePdfUrl + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-indigo-700 text-[11px] font-semibold no-underline">Abrir PDF oficial ↗</a>') : '') +
          '</div>' +
          '<p class="text-xs text-slate-700 m-0 leading-relaxed">...' + sanitizeHTML(item.fragmento || '') + '...</p>' +
        '</div>';
      }).join('');

      resBox.innerHTML =
        '<div class="p-3.5 rounded-xl border mb-3 ' + headerCls + '">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="text-xs font-bold">' + iconTxt + ' ' + sanitizeHTML(data.mensaje || '') + '</div>' +
          '</div>' +
          resumenHtml +
        '</div>' +
        '<div class="space-y-2.5 max-h-96 overflow-y-auto pr-1">' + itemsHtml + '</div>';
    } catch (err) {
      if (resBox) {
        resBox.innerHTML = '<div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">⚠️ Error consultando Boletín Oficial: ' + sanitizeHTML(err && err.message ? err.message : String(err)) + '</div>';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span>🔍 Buscar en Boletín</span>'; }
    }
  }

  global.actualizarLinkDateasBoletin = actualizarLinkDateasBoletin;
  global.cargarEstadoBoletinOficialAuditoria = cargarEstadoBoletinOficialAuditoria;
  global.sincronizarBoletinOficialAuditoria = sincronizarBoletinOficialAuditoria;
  global.consultarBoletinOficialAuditoria = consultarBoletinOficialAuditoria;
})(window);
