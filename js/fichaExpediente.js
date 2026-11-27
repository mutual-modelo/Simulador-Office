    /* ========================================================================
       6. FICHA INTEGRAL DE EXPEDIENTE (EDICIÓN, OFERTAS, DOCUMENTOS, CHAT)
       ======================================================================== */
    var solicitudSeleccionada = null;

    function obtenerIdSolicitudActiva() {
      // 1. Desde el objeto global en memoria si existe
      const memSol = solicitudSeleccionada || window.solicitudSeleccionada;
      if (memSol && typeof memSol === 'object') {
        const id = memSol.idSolicitud || memSol.ID_Solicitud || memSol.id || memSol.id_solicitud;
        if (id && String(id).trim() !== '' && String(id).trim() !== 'undefined' && String(id).trim() !== 'null') {
          return String(id).trim();
        }
      }

      // 2. Desde el atributo data-id del modal de detalle o controles internos
      const modal = document.getElementById('modalFichaCompleta') || document.getElementById('modal-detalle-solicitud') || document.getElementById('modal-expediente');
      if (modal && modal.dataset) {
        const mId = modal.dataset.idSolicitud || modal.dataset.solicitudId || modal.dataset.id;
        if (mId && String(mId).trim() !== '' && String(mId).trim() !== 'undefined' && String(mId).trim() !== 'null') {
          return String(mId).trim();
        }
      }
      const hidModalNro = document.getElementById('asignarNroDefIdSolicitud');
      if (hidModalNro && hidModalNro.value) {
        const hId = String(hidModalNro.value).trim();
        if (hId && hId !== 'undefined' && hId !== 'null') return hId;
      }
      const btnFicha = document.getElementById('btnAsignarNroDefinitivoFicha');
      if (btnFicha && btnFicha.dataset && btnFicha.dataset.solicitudId) {
        const bId = String(btnFicha.dataset.solicitudId).trim();
        if (bId && bId !== 'undefined' && bId !== 'null') return bId;
      }

      // 3. Desde algún elemento visible en la cabecera del expediente
      const spanId = document.getElementById('detalle-id-solicitud') || document.getElementById('expediente-id-texto') || document.getElementById('fichaModalTitle');
      if (spanId) {
        if (spanId.dataset && spanId.dataset.id && spanId.dataset.id !== 'undefined' && spanId.dataset.id !== 'null') {
          return String(spanId.dataset.id).trim();
        }
        if (spanId.textContent) {
          const txt = spanId.textContent.trim();
          const matchAyu = txt.match(/AYU-\d+/i);
          if (matchAyu) return matchAyu[0].toUpperCase();
          const matchProv = txt.match(/PROV-(\d+)/i);
          if (matchProv) return matchProv[1];
        }
      }

      return null;
    }

    function verFichaCompleta(id) {
      const all = getStoredSolicitudes();
      const targetId = String(id || '').trim();
      const s = all.find(x =>
        String(x.id || '') === targetId ||
        String(x.idSolicitud || '') === targetId ||
        String(x.ID_Solicitud || '') === targetId ||
        String(x.id_provisorio || '') === targetId ||
        String(x.idProvisorio || '') === targetId ||
        String(x.supabase_id || '') === targetId
      );
      if (!s) {
        console.warn('verFichaCompleta: No se encontró la solicitud con ID:', targetId);
        return;
      }
      normalizarSolicitud(s);
      const idActivo = String(s.idSolicitud || s.ID_Solicitud || s.id || targetId).trim();
      s.id = idActivo;
      s.idSolicitud = idActivo;
      s.ID_Solicitud = idActivo;
      solicitudSeleccionada = s;
      window.solicitudSeleccionada = s;

      const modalFichaEl = document.getElementById('modalFichaCompleta');
      if (modalFichaEl) {
        modalFichaEl.dataset.idSolicitud = idActivo;
      }

      const session = getSession();
      const rolLow = String(session?.rol || '').toLowerCase();
      const isAnalistaOAdmin = Boolean(session && (rolLow.includes('analista') || rolLow.includes('admin') || rolLow.includes('mutual') || rolLow.includes('supervisor')));

      const idDef = String(
        s.id_definitivo ||
        s.ID_Definitivo_Expediente ||
        s.idDefinitivoExpediente ||
        s.Nro_Definitivo ||
        s.nroDefinitivo ||
        s.ID_Definitivo ||
        (s.Metadata_Extra_JSON && parseJSONCampoSeguro(s.Metadata_Extra_JSON, {}).id_definitivo) ||
        ''
      ).trim();
      const idProv = String(s.id_provisorio || s.idProvisorio || s.ID_Solicitud || s.idSolicitud || s.id || idActivo).trim();
      const nombreSocio = String(s.solicitante?.nombre || s.Apellido_Nombre || s.nombre || 'Socio').trim();

      if (idDef) {
        s.id_definitivo = idDef;
        s.ID_Definitivo_Expediente = idDef;
        s.Nro_Definitivo = idDef;
      }
      window._fichaExpedienteActivoObj = s;
      window._fichaExpedienteActivoId = idActivo;

      const tituloExpediente = idDef ? ('Expediente ' + idDef) : ('Expediente ' + idProv);
      const tituloHtml = '<span class="text-lg font-bold font-mono text-slate-900">' + sanitizeHTML(tituloExpediente) + '</span> <span class="text-base font-semibold text-slate-800">— ' + sanitizeHTML(nombreSocio) + '</span>';

      const elModalTit = document.getElementById('modalFichaTitulo');
      if (elModalTit) {
        elModalTit.innerHTML = tituloHtml + '<span id="detalle-id-solicitud" data-id="' + sanitizeHTML(idActivo) + '" style="display:none;">' + sanitizeHTML(idActivo) + '</span>';
      }
      const elFichaTit = document.getElementById('fichaModalTitle');
      if (elFichaTit && elFichaTit !== elModalTit) {
        elFichaTit.innerHTML = tituloHtml;
      }

      const body = document.getElementById('fichaModalBody'); if (!body) return;
      const isObservado = (s.estado === 'Observado');

      // 1. BARRA SUPERIOR CON IDENTIFICADORES, CONTROL DIRECTO DE ESTADO Y DERIVACIÓN (MUTUAL / ADMIN)
      const analistaActualLabel = sanitizeHTML(s.analistaAsignado || s.Analista_Asignado || 'Sin Asignar');
      let estadoSelectorHtml = '';
      if (isAnalistaOAdmin) {
        const listaEstados = ['Pendiente', 'En Análisis', 'Observado', 'Propuesta Enviada', 'Aprobado', 'Transferencia Pendiente', 'Liquidado', 'Rechazado'];
        estadoSelectorHtml = '<div style="display:flex;align-items:center;gap:0.4rem;background:#eff6ff;padding:4px 8px;border-radius:8px;border:1px solid #bfdbfe;">' +
          '<label style="font-size:0.72rem;font-weight:700;color:var(--color-brand-blue);white-space:nowrap;">Estado del Expediente:</label>' +
          '<select id="cboFichaEstadoDirecto" class="input-text" style="padding:2px 8px;font-size:0.72rem;font-weight:700;width:auto;">' +
            listaEstados.map(st => '<option value="' + st + '" ' + (s.estado === st ? 'selected' : '') + '>' + st + '</option>').join('') +
          '</select>' +
          '<button type="button" class="btn-primary-action" style="width:auto;padding:3px 10px;font-size:0.7rem;white-space:nowrap;" onclick="actualizarEstadoDirectoFicha(\'' + s.id + '\')">Actualizar Estado ⚡</button>' +
        '</div>' +
        '<div class="ficha-asignacion-bar">' +
          '<span class="badge-analista-asignado">👤 Analista Asignado: <strong>' + analistaActualLabel + '</strong></span>' +
          '<button type="button" class="btn-derivar-caso" onclick="abrirModalDerivarCaso(\'' + s.id + '\')">🔄 Derivar / Reasignar Caso</button>' +
        '</div>';
      } else {
        estadoSelectorHtml = '<div style="display:flex;align-items:center;gap:0.4rem;">' +
          '<span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">Estado:</span>' +
          '<span class="badge-status badge-' + (window.normalizarEstadoCanonico_ ? window.normalizarEstadoCanonico_(s.estado) : String(s.estado || 'Pendiente')).replace(/\s/g, '') + '" style="font-size:.8rem;padding:.25rem .65rem;">' + (window.normalizarEstadoCanonico_ ? window.normalizarEstadoCanonico_(s.estado) : (s.estado || 'Pendiente')) + '</span>' +
        '</div>';
      }

      const dniSocioFicha = String((s.solicitante && s.solicitante.dni) || s.dni || s.DNI || '').replace(/\D/g, '').trim();
      const btnFichaHistHtml = (dniSocioFicha.length >= 7 && typeof tieneAccesoPadronFichas === 'function' && tieneAccesoPadronFichas())
        ? '<button type="button" onclick="cerrarModal(\'modalFichaCompleta\');abrirFichaHistoricaAsociado(\'' + sanitizeHTML(dniSocioFicha) + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:7px;border:1px solid #1e3a8a;background:#eef2ff;color:#1e3a8a;font-size:0.72rem;font-weight:700;cursor:pointer;">🗂️ Ver Ficha Histórica (Padrón)</button>'
        : '';

      const btnRespaldoExtHtml = '<button type="button" onclick="window.respaldarLegajoLocalExtension && window.respaldarLegajoLocalExtension(\'' + sanitizeHTML(String(s.id)) + '\', \'manual\')" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:7px;border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;font-size:0.72rem;font-weight:700;cursor:pointer;" title="Enviar adjuntos del legajo a la Extensión Chrome AMMER">📥 Respaldar Legajo Local</button>';

      try {
        window.postMessage(
          {
            tipo: 'AMMER_CONTEXTO_EXPEDIENTE',
            payload: {
              idExpediente: s.id_definitivo || s.id_provisorio || ('EXP-' + s.id),
              dni: String(s.solicitante?.dni || '').replace(/\D/g, ''),
              cuil: String(s.solicitante?.cuil || ''),
              nombre: String(s.solicitante?.nombre || ''),
              cbu: String(s.solicitante?.cbu || ''),
              monto: s.prestamo?.monto || '',
            },
          },
          window.location.origin
        );
      } catch (_) {}

      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.6rem;background:#f8fafc;padding:.75rem;border-radius:8px;border:1px solid var(--border-color);">' +
        '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">' +
          estadoSelectorHtml +
          btnFichaHistHtml +
          btnRespaldoExtHtml +
          (isObservado ? '<span style="font-size:0.7rem;color:#b45309;font-weight:700;background:#fffbeb;padding:2px 6px;border-radius:4px;border:1px solid #fef3c7;">⚠️ Observado por Auditoría</span>' : '') +
        '</div>' +
        '<div style="font-size:.72rem;color:var(--text-muted);">' +
          'Fecha: <strong>' + (s.fecha ? formatearFechaHoraChat(s.fecha) : '') + '</strong> | Asesor: <strong>' + s.comercializador + '</strong> | Org: <strong>' + (s.nombre_organizacion || 'Paraná Centro') + '</strong>' +
        '</div>' +
      '</div>';

      // 2. IDENTIFICACIÓN OFICIAL DEL EXPEDIENTE (DISEÑO PREMIUM MUTUAL MODELO)
      let idBoxHtml = '';
      if (idDef) {
        idBoxHtml = '<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:0.85rem 1.15rem;border-radius:10px;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">' +
          '<div style="display:flex;align-items:center;gap:0.85rem;flex-wrap:wrap;">' +
            '<div style="width:36px;height:36px;border-radius:8px;background:#0f2744;color:#38bdf8;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
            '</div>' +
            '<div>' +
              '<span style="font-size:0.67rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Identificación Oficial del Expediente</span>' +
              '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:2px;flex-wrap:wrap;">' +
                '<span style="font-size:0.82rem;font-weight:700;color:#0f172a;">N° Definitivo:</span>' +
                '<span id="lblNroDefinitivoActual" class="font-mono font-bold" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 8px;border-radius:6px;font-size:0.85rem;letter-spacing:0.02em;">' + sanitizeHTML(idDef) + '</span>' +
                '<span style="font-size:0.72rem;color:#94a3b8;">·</span>' +
                '<span style="font-size:0.74rem;color:#64748b;">N° Provisorio original: <strong class="font-mono" style="color:#475569;">' + sanitizeHTML(idProv) + '</strong></span>' +
              '</div>' +
            '</div>' +
          '</div>';

        if (isAnalistaOAdmin) {
          idBoxHtml += '<div style="display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;">' +
            '<button type="button" class="btn-table-action" style="padding:6px 14px;font-size:0.75rem;font-weight:700;display:inline-flex;align-items:center;gap:5px;border-color:#cbd5e1;color:#0f2744;border-radius:6px;" onclick="abrirModalAsignarNroDefinitivo(\'' + sanitizeHTML(idActivo) + '\')">' +
              '✏️ Modificar N° Definitivo' +
            '</button>' +
          '</div>';
        }
        idBoxHtml += '</div>';
      } else {
        idBoxHtml = '<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:0.85rem 1.15rem;border-radius:10px;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">' +
          '<div style="display:flex;align-items:center;gap:0.85rem;flex-wrap:wrap;">' +
            '<div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
            '</div>' +
            '<div>' +
              '<span style="font-size:0.67rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Identificación Oficial del Expediente</span>' +
              '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:2px;flex-wrap:wrap;">' +
                '<span style="font-size:0.82rem;font-weight:700;color:#0f172a;">N° Provisorio:</span>' +
                '<span class="font-mono font-bold" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:2px 7px;border-radius:5px;font-size:0.8rem;">' + sanitizeHTML(idProv) + '</span>' +
                '<span class="font-mono text-xs font-bold" style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:0.65rem;letter-spacing:0.04em;">PROVISORIO</span>' +
                '<span style="font-size:0.72rem;color:#94a3b8;">·</span>' +
                '<span id="lblNroDefinitivoActual" style="font-size:0.75rem;color:#b45309;font-weight:600;">Sin N° formal definitivo aún</span>' +
              '</div>' +
            '</div>' +
          '</div>';

        if (isAnalistaOAdmin) {
          idBoxHtml += '<div style="display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;">' +
            '<input type="text" id="inpNumDefinitivoModal" name="ID_Definitivo_Expediente" class="input-text font-mono" style="width:170px;font-size:0.75rem;font-weight:700;background:#ffffff;border:1.5px solid #cbd5e1;border-radius:6px;padding:4px 8px;" placeholder="Ej: EXP-' + sanitizeHTML(idActivo) + '" value="" onkeydown="if(event.key===\'Enter\'){event.preventDefault();guardarNumeroDefinitivo(\'' + sanitizeHTML(idActivo) + '\');}"/>' +
            '<button type="button" id="btnAsignarNroDefinitivoFicha" data-solicitud-id="' + sanitizeHTML(idActivo) + '" class="btn-action-primary" style="padding:5px 12px;font-size:0.74rem;font-weight:700;border-radius:6px;display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 5px rgba(19,85,150,0.2);" onclick="guardarNumeroDefinitivo(\'' + sanitizeHTML(idActivo) + '\')">' +
              '🏷️ Asignar N° Definitivo' +
            '</button>' +
          '</div>';
        }
        idBoxHtml += '</div>';
      }
      html += idBoxHtml;

      const docsCountFicha = (s.archivosAdjuntos ? s.archivosAdjuntos.length : (s.adjuntos ? s.adjuntos.length : 0));
      const bitacoraPreviewCount = normalizarBitacoraComentarios(s).length;
      if (!window._fichaTabActivaState || String(window._fichaTabActivaState.id || '') !== String(s.id)) {
        window._fichaTabActivaState = { id: String(s.id), tab: 'resumen' };
      }
      const tabFichaAct = window._fichaTabActivaState.tab || 'resumen';
      html += '<div class="ficha-tabs-bar" role="tablist" aria-label="Secciones de la ficha del expediente">' +
        '<button type="button" role="tab" class="ficha-tab-btn' + (tabFichaAct === 'resumen' ? ' is-active' : '') + '" data-ficha-tab="resumen" aria-selected="' + (tabFichaAct === 'resumen') + '" onclick="cambiarTabFichaCompleta(\'resumen\')">📋 Resumen y Oferta</button>' +
        '<button type="button" role="tab" class="ficha-tab-btn' + (tabFichaAct === 'solicitante' ? ' is-active' : '') + '" data-ficha-tab="solicitante" aria-selected="' + (tabFichaAct === 'solicitante') + '" onclick="cambiarTabFichaCompleta(\'solicitante\')">👤 Solicitante</button>' +
        '<button type="button" role="tab" class="ficha-tab-btn' + (tabFichaAct === 'legajo' ? ' is-active' : '') + '" data-ficha-tab="legajo" aria-selected="' + (tabFichaAct === 'legajo') + '" onclick="cambiarTabFichaCompleta(\'legajo\')">📁 Legajo (' + docsCountFicha + ')</button>' +
        '<button type="button" role="tab" class="ficha-tab-btn' + (tabFichaAct === 'bitacora' ? ' is-active' : '') + (function () { try { const map = JSON.parse(localStorage.getItem('AMMER_BITACORA_LEIDA_V1') || '{}'); return bitacoraPreviewCount > Number(map[String(s.id)] || 0) ? ' has-unread' : ''; } catch (_) { return bitacoraPreviewCount > 0 ? ' has-unread' : ''; } })() + '" data-ficha-tab="bitacora" aria-selected="' + (tabFichaAct === 'bitacora') + '" onclick="try{const m=JSON.parse(localStorage.getItem(\'AMMER_BITACORA_LEIDA_V1\')||\'{}\');m[\'' + String(s.id).replace(/'/g, '') + '\']=' + bitacoraPreviewCount + ';localStorage.setItem(\'AMMER_BITACORA_LEIDA_V1\',JSON.stringify(m));this.classList.remove(\'has-unread\');}catch(_){}cambiarTabFichaCompleta(\'bitacora\')">💬 Bitácora (' + bitacoraPreviewCount + ')</button>' +
      '</div>';

      // 3. SECCIÓN 1: FORMULARIO DE EDICIÓN INTEGRAL DE DATOS DEL ASOCIADO
      html += '<div class="ficha-tab-panel' + (tabFichaAct === 'solicitante' ? ' is-active' : '') + '" data-ficha-panel="solicitante">' +
        '<div class="section-title-divider">1. Datos Personales y Laborales del Asociado (Modificables)</div>' +
        '<form onsubmit="guardarEdicionSolicitante(event, \'' + s.id + '\')" id="formEditSolicitante">' +
          '<div class="grid-3-cols">' +
            '<div class="form-group"><label class="form-label">DNI *</label><input type="text" id="editDni" class="input-text" value="' + (s.solicitante?.dni || '') + '" required/></div>' +
            '<div class="form-group"><label class="form-label">CUIL</label><input type="text" id="editCuil" class="input-text" value="' + sanitizeHTML(s.solicitante?.cuil || '') + '" placeholder="Ej: 20-32111222-9"/></div>' +
            '<div class="form-group"><label class="form-label">Nombre y Apellido *</label><input type="text" id="editNombre" class="input-text" value="' + (s.solicitante?.nombre || '') + '" required/></div>' +
            '<div class="form-group"><label class="form-label">Fecha Nacimiento *</label><input type="date" id="editFechaNac" class="input-text" onchange="(function(v){var el=document.getElementById(\'editEdadAuto\');if(!el)return;if(!v){el.value=\'—\';return;}var d=new Date(v);if(isNaN(d.getTime())){el.value=\'—\';return;}var h=new Date(),ed=h.getFullYear()-d.getFullYear(),m=h.getMonth()-d.getMonth();if(m<0||(m===0&&h.getDate()<d.getDate()))ed--;el.value=ed>=0?(ed+\' años\'):\'—\';})(this.value)" value="' + sanitizeHTML(normalizarFechaInput(s.solicitante?.fechaNac || s.solicitante?.fechaNacimiento || '')) + '" required/></div>' +
            '<div class="form-group"><label class="form-label">Edad (Automático)</label><input type="text" id="editEdadAuto" class="input-text" readonly value="' + (function () { const fn = normalizarFechaInput(s.solicitante?.fechaNac || s.solicitante?.fechaNacimiento || ''); if (!fn) return '—'; const d = new Date(fn); if (isNaN(d.getTime())) return '—'; const h = new Date(); let ed = h.getFullYear() - d.getFullYear(); const m = h.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && h.getDate() < d.getDate())) ed--; return ed >= 0 ? (ed + ' años') : '—'; })() + '" style="background:#f1f5f9;font-weight:700;color:#0f2744;"/></div>' +
            '<div class="form-group"><label class="form-label">Sexo</label>' +
              '<select id="editSexo" class="input-text">' +
                ['', 'Masculino', 'Femenino', 'Otro'].map(sx => '<option value="' + sx + '" ' + (s.solicitante?.sexo === sx ? 'selected' : '') + '>' + (sx || 'Seleccionar...') + '</option>').join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Estado Civil</label>' +
              '<select id="editEstadoCivil" class="input-text" onchange="(function(v){var w=document.getElementById(\'editParejaWrap\');if(w)w.style.display=/casad|pareja|concub|uni[oó]n/i.test(String(v||\'\'))?\'\':\'none\';})(this.value)">' +
                ['', 'Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión Convivencial'].map(ec => '<option value="' + ec + '" ' + (s.solicitante?.estadoCivil === ec ? 'selected' : '') + '>' + (ec || 'Seleccionar...') + '</option>').join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Celular / Teléfono *</label><input type="tel" id="editCelular" class="input-text" value="' + (s.solicitante?.celular || '') + '" required/></div>' +
            '<div class="form-group"><label class="form-label">Email</label><input type="email" id="editEmail" class="input-text" value="' + (s.solicitante?.email || '') + '"/></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label class="form-label">Localidad</label><input type="text" id="editLocalidad" class="input-text" value="' + sanitizeHTML(s.solicitante?.localidad || '') + '"/></div>' +
            '<div class="form-group" style="margin-bottom:0;"><label class="form-label">Legajo Municipal</label><input type="text" id="editLegajo" class="input-text" value="' + (s.solicitante?.legajo || '') + '"/></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Domicilio Completo *</label><input type="text" id="editDomicilio" class="input-text" value="' + (s.solicitante?.domicilio || '') + '" required/></div>' +
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;margin-bottom:0.75rem;font-size:0.75rem;color:#166534;font-weight:700;">🏠 Domicilio al momento de la solicitud: <span style="font-weight:500;color:#1e293b;">' + (s.domicilio_historico || s.solicitante?.domicilio_historico || s.solicitante?.domicilio || 'No especificado') + '</span></div>' +
          '<div class="grid-3-cols">' +
            '<div class="form-group"><label class="form-label">Condición *</label>' +
              '<select id="editCondicion" class="input-text">' +
                ['Activo', 'Jubilado', 'Pensionado'].map(c => '<option value="' + c + '" ' + (s.solicitante?.condicion === c ? 'selected' : '') + '>' + c + '</option>').join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Organismo *</label>' +
              '<select id="editOrganismo" class="input-text" onchange="handleOrganismoChange(this.value, \'editLegajo\')">' +
                ['Provincial', 'Municipal'].map(o => '<option value="' + o + '" ' + (s.solicitante?.organismo === o ? 'selected' : '') + '>' + o + '</option>').join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Dependencia / Lugar *</label><input type="text" id="editDependencia" class="input-text" value="' + (s.solicitante?.dependencia || '') + '" required/></div>' +
            '<div class="form-group">' +
              '<label class="antiguedad-reactive-label" for="editCargo">Cargo <span style="color:#ef4444;">*</span></label>' +
              '<select id="editCargo" name="Cargo" class="antiguedad-reactive-input" required>' +
                (() => {
                  const cr = String(s.solicitante?.cargo || '').toLowerCase();
                  const ce = cr.includes('suplente') ? 'Suplente' : (cr.includes('titular') ? 'Titular' : '');
                  return '<option value="" disabled ' + (!ce ? 'selected' : '') + '>Seleccione condición...</option>' +
                    '<option value="Titular" ' + (ce === 'Titular' ? 'selected' : '') + '>Titular</option>' +
                    '<option value="Suplente" ' + (ce === 'Suplente' ? 'selected' : '') + '>Suplente</option>';
                })() +
              '</select>' +
            '</div>' +
            '<div class="form-group" style="grid-column:1 / -1;">' +
              '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                '<div>' +
                  '<label class="antiguedad-reactive-label" for="editFechaIngreso">Fecha de Ingreso Laboral</label>' +
                  '<input type="date" id="editFechaIngreso" name="Fecha_Ingreso_Laboral" class="antiguedad-reactive-input" value="' + sanitizeHTML(normalizarFechaInput(s.solicitante?.fechaIngresoLaboral || s.solicitante?.Fecha_Ingreso_Laboral || '')) + '" onchange="calcularAntiguedadReactiva(this.value, \'editTextoAntiguedad\', \'editAntiguedad\')" oninput="calcularAntiguedadReactiva(this.value, \'editTextoAntiguedad\', \'editAntiguedad\')"/>' +
                '</div>' +
                '<div>' +
                  '<label class="antiguedad-reactive-label">Antigüedad Calculada (AÑOS - MESES)</label>' +
                  '<div id="editBadgeAntiguedad" class="antiguedad-reactive-badge">' +
                    '<span id="editTextoAntiguedad">' + sanitizeHTML(s.solicitante?.antiguedad || '-- AÑOS - -- MESES') + '</span>' +
                    '<span class="antiguedad-auto-pill">Automático</span>' +
                  '</div>' +
                  '<input type="hidden" id="editAntiguedad" value="' + sanitizeHTML(s.solicitante?.antiguedad || '') + '"/>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:0.85rem;padding:0.85rem;border-radius:11px;background:#f8fafc;border:1px solid #e2e8f0;">' +
            '<div style="font-size:0.78rem;font-weight:800;color:#0f2744;margin-bottom:0.6rem;">🏦 Datos Bancarios del Asociado</div>' +
            '<div class="form-grid-12">' +
              '<div class="form-group col-12 col-sm-4"><label class="form-label">Banco</label><input type="text" id="editBanco" class="input-text" value="' + sanitizeHTML(s.solicitante?.banco || '') + '" placeholder="Ej: Banco de Entre Ríos"/></div>' +
              '<div class="form-group col-12 col-sm-4"><label class="form-label">Tipo de Cuenta</label>' +
                '<select id="editTipoCuenta" class="input-text">' +
                  ['', 'Caja de Ahorro', 'Cuenta Corriente', 'Cuenta Sueldo'].map(tc => '<option value="' + tc + '" ' + (s.solicitante?.tipoCuenta === tc ? 'selected' : '') + '>' + (tc || 'Seleccionar...') + '</option>').join('') +
                '</select>' +
              '</div>' +
              '<div class="form-group col-12 col-sm-4"><label class="form-label">N° de Cuenta</label><input type="text" id="editNroCuenta" class="input-text" value="' + sanitizeHTML(s.solicitante?.nroCuenta || '') + '"/></div>' +
              '<div class="form-group col-12 col-sm-7"><label class="form-label">CBU (22 dígitos)</label><input type="text" id="editCbu" class="input-text" maxlength="22" value="' + sanitizeHTML(s.solicitante?.cbu || '') + '"/></div>' +
              '<div class="form-group col-12 col-sm-5"><label class="form-label">Alias CBU</label><input type="text" id="editAlias" class="input-text" value="' + sanitizeHTML(s.solicitante?.alias || '') + '"/></div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:0.75rem;padding:0.85rem;border-radius:11px;background:#f8fafc;border:1px solid #e2e8f0;">' +
            '<div style="font-size:0.78rem;font-weight:800;color:#0f2744;margin-bottom:0.6rem;">💳 Datos Tarjeta Sidecreer</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.75rem;align-items:end;">' +
              '<div class="form-group" style="margin-bottom:0;"><label class="form-label">Número de Tarjeta</label><input type="text" id="editTarjetaSidecreerNumero" class="input-text" maxlength="24" placeholder="Ej: 4507 0000 0000 0000" value="' + sanitizeHTML(s.solicitante?.tarjetaSidecreerNumero || '') + '"/></div>' +
              '<div class="form-group" style="margin-bottom:0;"><label class="form-label">Fecha de Vencimiento</label><input type="text" id="editTarjetaSidecreerVencimiento" class="input-text" maxlength="7" placeholder="MM/AA" value="' + sanitizeHTML(s.solicitante?.tarjetaSidecreerVencimiento || '') + '"/></div>' +
              '<div class="form-group" style="margin-bottom:0;"><label class="form-label">Código de Seguridad</label><input type="text" id="editTarjetaSidecreerCvv" class="input-text" maxlength="4" placeholder="Ej: 123" value="' + sanitizeHTML(s.solicitante?.tarjetaSidecreerCvv || '') + '"/></div>' +
            '</div>' +
          '</div>' +
          '<div id="editParejaWrap" style="margin-top:0.75rem;padding:0.85rem;border-radius:11px;background:#f8fafc;border:1px solid #e2e8f0;' + ((/casad|pareja|concub/i.test(String(s.solicitante?.estadoCivil || ''))) ? '' : 'display:none;') + '">' +
            '<div style="font-size:0.78rem;font-weight:800;color:#0f2744;margin-bottom:0.6rem;">👥 Datos de la Pareja / Cónyuge (Opcional)</div>' +
            '<div class="grid-3-cols">' +
              '<div class="form-group"><label class="form-label">Apellido y Nombre</label><input type="text" id="editParejaNombre" class="input-text" value="' + sanitizeHTML(s.solicitante?.parejaNombre || '') + '"/></div>' +
              '<div class="form-group"><label class="form-label">DNI Pareja</label><input type="text" id="editParejaDni" class="input-text" value="' + sanitizeHTML(s.solicitante?.parejaDni || '') + '"/></div>' +
              '<div class="form-group"><label class="form-label">Email Pareja</label><input type="email" id="editParejaEmail" class="input-text" value="' + sanitizeHTML(s.solicitante?.parejaEmail || '') + '"/></div>' +
              '<div class="form-group"><label class="form-label">Teléfono Pareja</label><input type="text" id="editParejaTelefono" class="input-text" value="' + sanitizeHTML(s.solicitante?.parejaTelefono || '') + '"/></div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;margin-top:.65rem;margin-bottom:1rem;">' +
            '<button type="submit" class="btn-restore" style="border-color:#3b82f6;color:#1d4ed8;font-weight:700;">💾 Guardar Cambios del Solicitante</button>' +
          '</div>' +
        '</form>';

      // 4. SECCIÓN 2: CONDICIONES DESEADAS VS. PROPUESTA OFICIAL DE LA MUTUAL
      const prop = s.propuestaMutual || {};
      const tieneRefinanciacion = !!(prop.esRefinanciacion && prop.refinanciacion);
      const historial = s.historialPropuestas || [];

      // Normalización con fallback tolerante para el Monto Deseado del solicitante (Evita $ 0,00)
      const montoDeseadoSocio = limpiarNumero(
        s.montoSolicitado ||
        s.Monto_Solicitado_Neto ||
        s.netoDeseado ||
        s.capitalSolicitado ||
        s.montoNeto ||
        (s.prestamo ? s.prestamo.monto : 0) ||
        (s.planDeseado ? (s.planDeseado.monto || s.planDeseado.neto) : 0)
      );
      const cuotasDeseadasSocio = Number(
        (s.prestamo && s.prestamo.cuotas) ||
        s.Cantidad_Cuotas ||
        s.cuotas ||
        (s.planDeseado ? s.planDeseado.cuotas : 0) ||
        12
      );
      const cuotaEstimadaDeseadaSocio = limpiarNumero(
        (s.prestamo && s.prestamo.cuotaEstimada) ||
        s.Monto_Cuota ||
        s.cuotaEstimada ||
        s.cuota ||
        (s.planDeseado ? s.planDeseado.cuotaEstimada : 0)
      );
      const totalDeseadoShow = (s.prestamo && s.prestamo.totalADevolver) ||
        s.Total_A_Devolver ||
        ((cuotaEstimadaDeseadaSocio > 0 && cuotasDeseadasSocio > 0) ? (cuotaEstimadaDeseadaSocio * cuotasDeseadasSocio) : 0);
      const lineaDeseadaNombre = (s.prestamo && s.prestamo.lineaNombre) ||
        s.Linea_Ayuda ||
        (s.planDeseado ? s.planDeseado.lineaNombre : '') ||
        'Ayuda Económica';
      const lineaDeseadaKey = (s.prestamo && s.prestamo.linea) ||
        (s.planDeseado && s.planDeseado.linea) ||
        lineaDeseadaNombre;

      html += '</div><div class="ficha-tab-panel' + (tabFichaAct === 'resumen' ? ' is-active' : '') + '" data-ficha-panel="resumen">' +
        '<div class="section-title-divider">2. Condiciones Deseadas vs. Oferta Oficial Mutual</div>' +
        '<div class="compare-offers-grid">' +
          '<!-- Tarjeta 1: Plan Deseado Solicitante -->' +
          '<div class="offer-card offer-card-desired">' +
            '<div class="offer-card-title"><span style="color:#475569;">👤 Plan Deseado por el Socio</span><span class="badge-status" style="background:#e2e8f0;color:#334155;">Original</span></div>' +
            '<div><strong>Línea:</strong> ' + sanitizeHTML(lineaDeseadaNombre) + '</div>' +
            renderKpiRecuadrosOfertaHtml({
              linea: lineaDeseadaKey,
              cuotas: cuotasDeseadasSocio,
              monto: montoDeseadoSocio,
              cuota: cuotaEstimadaDeseadaSocio,
              total: totalDeseadoShow
            }) +
            '<p style="font-size:0.68rem;color:var(--text-muted);margin-top:4px;">Referencia inicial cargada en la originación del crédito.</p>' +
          '</div>' +

          '<!-- Tarjeta 2: Oferta Oficial de la Mutual -->' +
          '<div class="offer-card offer-card-mutual">' +
            '<div class="offer-card-title">' +
              '<span style="color:var(--color-brand-blue);display:flex;align-items:center;gap:4px;">🏢 Propuesta Oficial ' + (prop.version ? ('<span class="badge-status" style="background:#1d4ed8;color:#fff;font-size:0.62rem;">v' + prop.version + '</span>') : '') + '</span>' +
              '<span class="badge-status badge-EnAnalisis">' + (prop.estadoPropuesta || 'En Evaluación') + '</span>' +
            '</div>';

      if (isAnalistaOAdmin) {
        const lineaActual = prop.linea || s.prestamo?.linea || 'fedem';
        const cuotasActual = prop.cuotas || s.prestamo?.cuotas || 12;
        const tasaActual = prop.tasaCosto || obtenerTasaCostoTexto(lineaActual, cuotasActual);
        const montoActual = prop.monto || s.prestamo?.monto || 100000;
        const cuotaActual = prop.cuotaEstimada || s.prestamo?.cuotaEstimada || 0;
        const modoSimActual = prop.modoSimulacion === 'cuota' ? 'cuota' : 'neto';
        const valorInputSim = modoSimActual === 'cuota' ? (cuotaActual || montoActual) : montoActual;
        const labelInputSim = modoSimActual === 'cuota' ? 'Monto de Cuota Deseada ($)' : 'Monto Neto Ofrecido ($)';
        const valorResSim = modoSimActual === 'cuota' ? ('Neto: ' + formatMoney(montoActual)) : formatMoney(cuotaActual);
        const refObj = prop.refinanciacion || {};

        html += '<form onsubmit="guardarPropuestaMutual(event, \'' + s.id + '\')">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">' +
            '<div><label class="form-label" style="font-size:.65rem;">Línea Aprobada</label>' +
              '<select id="propLinea" class="input-text" style="font-size:.7rem;" onchange="recalcularOfertaCuotaModal()">' +
                '<option value="fedem" ' + (lineaActual === 'fedem' ? 'selected' : '') + '>FEDEM Provincial</option>' +
                '<option value="muni" ' + (lineaActual === 'muni' ? 'selected' : '') + '>Municipales QUAD</option>' +
                '<option value="sidecreer" ' + (lineaActual === 'sidecreer' ? 'selected' : '') + '>Tarjeta Sidecreer</option>' +
              '</select>' +
            '</div>' +
            '<div><label class="form-label" style="font-size:.65rem;">Simular por</label>' +
              '<select id="propModoSim" class="input-text" style="font-size:.7rem;" onchange="recalcularOfertaCuotaModal()">' +
                '<option value="neto" ' + (modoSimActual === 'neto' ? 'selected' : '') + '>💵 Monto Neto a Entregar</option>' +
                '<option value="cuota" ' + (modoSimActual === 'cuota' ? 'selected' : '') + '>📅 Monto de Cuota</option>' +
              '</select>' +
            '</div>' +
            '<div><label id="propMontoLabel" class="form-label" style="font-size:.65rem;">' + labelInputSim + '</label>' +
              '<input type="number" id="propMonto" class="input-text" style="font-size:.7rem;font-weight:700;" value="' + valorInputSim + '" min="0" step="any" oninput="recalcularOfertaCuotaModal()"/>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">' +
            '<div><label class="form-label" style="font-size:.65rem;">Cantidad de Cuotas</label>' +
              '<select id="propPlazo" class="input-text" style="font-size:.7rem;" onchange="recalcularOfertaCuotaModal()">' +
                [6, 12, 18, 24, 36, 48].map(p => '<option value="' + p + '" ' + (cuotasActual === p ? 'selected' : '') + '>' + p + ' cuotas</option>').join('') +
              '</select>' +
            '</div>' +
            '<div><label class="form-label" style="font-size:.65rem;">Monto de Cuota Resultante</label>' +
              '<input type="text" id="propCuotaEst" class="input-text" style="font-size:.7rem;font-weight:700;color:var(--cuota-color);" readonly value="' + valorResSim + '"/>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:3px 6px;border-radius:4px;border:1px solid #e2e8f0;">' +
            '<span style="font-size:.64rem;color:var(--text-muted);font-weight:600;">Tasa / Costo Financiero:</span>' +
            '<span id="propTasaCostoTexto" style="font-size:.66rem;font-weight:700;color:#0369a1;">' + tasaActual + '</span>' +
          '</div>' +
          renderKpiRecuadrosOfertaHtml({
            linea: lineaActual,
            cuotas: cuotasActual,
            monto: montoActual,
            cuota: cuotaActual,
            total: prop.totalAPagar,
            capital: prop.capitalComputable,
            ids: {
              cuotaBadge: 'propKpiCuotaBadge',
              cuotaVal: 'propKpiCuotaVal',
              netoVal: 'propKpiNetoVal',
              totalLabel: 'propKpiTotalLabel',
              totalBadge: 'propKpiTotalBadge',
              totalVal: 'propKpiTotalVal',
              capitalLabel: 'propKpiCapitalLabel',
              capitalVal: 'propKpiCapitalVal'
            }
          }) +
          '<div style="margin-bottom:4px;"><label class="form-label" style="font-size:.65rem;">Estado de la Propuesta</label>' +
            '<select id="propEstado" class="input-text" style="font-size:.7rem;font-weight:700;">' +
              ['En Evaluación', 'Propuesta Enviada al Comercializador', 'Aceptada por el Socio', 'Rechazada'].map(st => '<option value="' + st + '" ' + (prop.estadoPropuesta === st ? 'selected' : '') + '>' + st + '</option>').join('') +
            '</select>' +
          '</div>' +
          '<div style="margin-bottom:4px;"><label class="form-label" style="font-size:.65rem;">Observaciones / Fundamento de la Oferta</label>' +
            '<input type="text" id="propDetalle" class="input-text" style="font-size:.7rem;" placeholder="Ej: Se ajusta plazo por margen de afectación o scoring..." value="' + (prop.detalle || '') + '"/>' +
          '</div>' +

          '<!-- 2. MÓDULO DE REFINANCIACIÓN Y CANCELACIÓN DE AYUDAS PREVIAS -->' +
          '<label class="switch-label-wrap">' +
            '<input type="checkbox" id="propEsRefinanciacion" onchange="toggleBoxRefinanciacion()" ' + (prop.esRefinanciacion ? 'checked' : '') + '/>' +
            '<span>🔄 ¿Incluye Refinanciación / Cancelación de Ayudas Anteriores?</span>' +
          '</label>' +

          '<div id="boxRefinanciacion" class="box-refinanciacion" style="display:' + (prop.esRefinanciacion ? 'block' : 'none') + ';">' +
            '<div style="font-size:.68rem;font-weight:800;color:#92400e;margin-bottom:4px;display:flex;align-items:center;gap:4px;">' +
              '<span>💼 Liquidación y Cancelación de Deuda Previa</span>' +
            '</div>' +
            '<div style="margin-bottom:4px;">' +
              '<label class="form-label" style="font-size:.64rem;color:#78350f;">Ayudas Económicas a Cancelar</label>' +
              '<input type="text" id="propAyudasCancelar" class="input-text" style="font-size:.68rem;" placeholder="Ej: Cancela Ayuda N° 38920 saldo $120.000 y Sidecreer N° 41005..." value="' + (refObj.ayudasACancelar || '') + '"/>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">' +
              '<div>' +
                '<label class="form-label" style="font-size:.64rem;color:#78350f;">Total Deuda Previa a Cancelar ($)</label>' +
                '<input type="number" id="propDeudaPrevia" class="input-text" style="font-size:.68rem;font-weight:700;" min="0" step="any" placeholder="0" value="' + (refObj.montoDeudaPrevia || '') + '" oninput="recalcularRefinanciacion()"/>' +
              '</div>' +
              '<div>' +
                '<label class="form-label" style="font-size:.64rem;color:#166534;font-weight:700;">Neto de Bolsillo Efectivo ($)</label>' +
                '<input type="text" id="propNetoBolsillo" class="input-text" style="font-size:.68rem;font-weight:800;color:#166534;background:#f0fdf4;" readonly value="' + formatMoney(refObj.montoBolsillo || Math.max(0, montoActual - (refObj.montoDeudaPrevia || 0))) + '"/>' +
              '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">' +
              '<div>' +
                '<label class="form-label" style="font-size:.64rem;color:#78350f;">Cuota Anterior que pagaba ($)</label>' +
                '<input type="number" id="propCuotaAnterior" class="input-text" style="font-size:.68rem;" min="0" step="any" placeholder="0" value="' + (refObj.cuotaAnterior || '') + '" oninput="recalcularRefinanciacion()"/>' +
              '</div>' +
              '<div>' +
                '<label class="form-label" style="font-size:.64rem;color:#78350f;">Nueva Cuota Resultante ($)</label>' +
                '<input type="text" id="propNuevaCuotaComp" class="input-text" style="font-size:.68rem;font-weight:700;color:var(--cuota-color);" readonly value="' + formatMoney(cuotaActual) + '"/>' +
              '</div>' +
            '</div>' +
            '<div id="propAlivioCuota" style="font-size:0.67rem;margin-top:2px;padding:3px 6px;border-radius:4px;background:#fff;border:1px solid #fde68a;">' +
              calcularTextoAlivioHtml(refObj.cuotaAnterior, cuotaActual) +
            '</div>' +
            '<div style="margin-top:4px;">' +
              '<label class="form-label" style="font-size:.64rem;color:#78350f;">Observaciones de la Refinanciación</label>' +
              '<input type="text" id="propRefinanciacionNotas" class="input-text" style="font-size:.68rem;" placeholder="Notas de análisis o retención..." value="' + (refObj.observaciones || '') + '"/>' +
            '</div>' +
          '</div>' +

          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:4px;flex-wrap:wrap;">' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
              '<button type="button" class="btn-copy" style="font-size:0.68rem;padding:4px 7px;" onclick="copiarPropuestaWhatsApp(\'' + s.id + '\')">📋 Copiar Oferta</button>' +
              (tieneAccesoBotWhatsapp() ? ('<button type="button" class="btn-copy" style="font-size:0.68rem;padding:4px 7px;border-color:#15803d;color:#15803d;background:#f0fdf4;font-weight:700;" onclick="enviarPropuestaWhatsAppPorBot(\'' + s.id + '\')">🤖 Enviar por Bot</button>') : '') +
            '</div>' +
            '<button type="submit" class="btn-primary-action" style="width:auto;font-size:0.7rem;padding:5px 10px;font-weight:700;">Actualizar / Registrar Nueva Propuesta 💼</button>' +
          '</div>' +
        '</form>';
      } else {
        // Vista para comercializador (lectura de contrapropuesta + copiar WhatsApp)
        if (prop.activa) {
          html += '<div><strong>Línea Ofrecida:</strong> ' + sanitizeHTML(prop.lineaNombre || prop.linea) + '</div>' +
            renderKpiRecuadrosOfertaHtml({
              linea: prop.linea || prop.lineaNombre,
              cuotas: prop.cuotas,
              monto: prop.monto,
              cuota: prop.cuotaEstimada,
              total: prop.totalAPagar,
              capital: prop.capitalComputable
            }) +
            '<div style="font-size:0.68rem;color:#0369a1;margin-top:2px;"><strong>Costo:</strong> ' + sanitizeHTML(prop.tasaCosto || 'Tasas oficiales vigentes') + '</div>';

          if (tieneRefinanciacion) {
            const r = prop.refinanciacion;
            html += '<div class="box-refinanciacion" style="margin-top:6px;padding:6px 8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">' +
                '<span class="refinanciacion-active-badge">🔄 Incluye Refinanciación de Deuda Previa</span>' +
              '</div>' +
              '<div style="font-size:0.7rem;color:#78350f;"><strong>Cancela:</strong> ' + sanitizeHTML(r.ayudasACancelar || 'Créditos previos') + '</div>' +
              '<div style="font-size:0.7rem;color:#78350f;"><strong>Deuda previa absorbida:</strong> ' + formatMoney(r.montoDeudaPrevia || 0) + '</div>' +
              '<div style="font-size:0.8rem;font-weight:800;color:#166534;margin:2px 0;">Dinero Neto en Mano (Bolsillo): ' + formatMoney(r.montoBolsillo || 0) + '</div>' +
              '<div style="font-size:0.68rem;color:#475569;">Cuota previa: ' + formatMoney(r.cuotaAnterior || 0) + ' ➔ Nueva cuota: <strong>' + formatMoney(prop.cuotaEstimada) + '</strong></div>' +
              (r.alivioMensual > 0 ? ('<div style="font-size:0.68rem;font-weight:700;color:#15803d;margin-top:2px;">🎉 Alivio en recibo: Libera ' + formatMoney(r.alivioMensual) + '/mes</div>') : '') +
            '</div>';
          }

          html += '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">Nota Mutual: <em>"' + sanitizeHTML(prop.detalle || 'Propuesta crediticia lista') + '"</em></div>' +
            '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' +
              '<button type="button" class="btn-copy" style="font-size:0.7rem;padding:4px 8px;" onclick="copiarPropuestaWhatsApp(\'' + s.id + '\')">📲 Copiar Propuesta para WhatsApp</button>' +
              (tieneAccesoBotWhatsapp() ? ('<button type="button" class="btn-copy" style="font-size:0.7rem;padding:4px 8px;border-color:#15803d;color:#15803d;background:#f0fdf4;font-weight:700;" onclick="enviarPropuestaWhatsAppPorBot(\'' + s.id + '\')">🤖 Enviar por Bot</button>') : '') +
            '</div>';
        } else {
          html += '<p style="color:var(--text-muted);font-size:0.72rem;padding:0.75rem 0;">La mutual está auditando el legajo. Aún no se ha emitido una contraoferta formal.</p>';
        }
      }

      html += '</div></div>';

      // 4.B HISTORIAL COMPLETO DE OFERTAS PRESENTADAS (LINEA DE TIEMPO / VERSIONES EN ACORDEÓN)
      if (historial.length > 0) {
        html += '<details class="proposal-history-accordion" style="background:#fff;border:1px solid var(--border-color);border-radius:8px;padding:.65rem .75rem;margin-bottom:1rem;">' +
          '<summary style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;gap:8px;flex-wrap:wrap;">' +
            '<strong style="font-size:0.75rem;color:var(--color-primary);text-transform:uppercase;">📜 Historial de Ofertas Emitidas (' + historial.length + ' ' + (historial.length === 1 ? 'versión' : 'versiones') + ') ▾</strong>' +
            '<span style="font-size:0.65rem;color:var(--text-muted);">Clic para desplegar / contraer auditoría de contrapropuestas</span>' +
          '</summary>' +
          '<div class="proposal-timeline" style="margin-top:.6rem;border-top:1px solid var(--border-color);padding-top:.55rem;">';

        const reversedHistory = [...historial].reverse();
        reversedHistory.forEach((v) => {
          const isCurrent = prop.version ? (v.version === prop.version) : (v === historial[historial.length - 1]);
          html += '<details class="proposal-history-card ' + (isCurrent ? 'is-current' : '') + '" ' + (isCurrent ? 'open' : '') + ' style="padding:.5rem .65rem;">' +
            '<summary style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;flex-wrap:wrap;gap:6px;">' +
              '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                '<span class="version-pill">v' + (v.version || 1) + '</span>' +
                (isCurrent ? '<span class="badge-status badge-Aprobado" style="font-size:0.6rem;padding:1px 5px;">Versión Vigente</span>' : '') +
                '<strong style="font-size:0.72rem;color:#0f172a;">' + formatMoney(v.monto || 0) + '</strong>' +
                '<span style="font-size:0.68rem;color:#334155;">· ' + (v.cuotas || 0) + ' cuotas de <strong>' + formatMoney(v.cuotaEstimada || 0) + '</strong></span>' +
                '<span style="font-size:0.66rem;color:var(--text-muted);">(' + formatearFechaHoraChat(v.fecha) + ' · ' + sanitizeHTML(v.analista || 'Analista') + ')</span>' +
              '</div>' +
              '<span class="badge-status badge-' + String(v.estadoPropuesta || 'EnEvaluacion').replace(/\s/g, '') + '" style="font-size:0.62rem;">' + (v.estadoPropuesta || 'Emitida') + ' ▾</span>' +
            '</summary>' +
            '<div style="margin-top:.45rem;padding-top:.4rem;border-top:1px dashed #e2e8f0;">' +
              '<div style="font-size:0.72rem;margin-bottom:4px;">' +
                '<strong>' + sanitizeHTML(v.lineaNombre || v.linea) + '</strong> ' +
                '<span style="color:#0369a1;font-size:0.66rem;">• ' + sanitizeHTML(v.tasaCosto || '') + '</span>' +
                (v.modoSimulacion ? (' <span style="font-size:0.62rem;color:#475569;background:#f1f5f9;padding:1px 6px;border-radius:999px;">Modo: ' + (v.modoSimulacion === 'cuota' ? 'Por Cuota' : 'Por Neto') + '</span>') : '') +
              '</div>' +
              renderKpiRecuadrosOfertaHtml({
                linea: v.linea || v.lineaNombre,
                cuotas: v.cuotas,
                monto: v.monto,
                cuota: v.cuotaEstimada,
                total: v.totalAPagar,
                capital: v.capitalComputable
              });

          if (v.esRefinanciacion && v.refinanciacion) {
            html += '<div style="font-size:0.67rem;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-top:3px;display:inline-block;">' +
              '🔄 Refinancia ' + formatMoney(v.refinanciacion.montoDeudaPrevia || 0) + ' | Bolsillo neto: <strong>' + formatMoney(v.refinanciacion.montoBolsillo || 0) + '</strong>' +
              (v.refinanciacion.alivioMensual > 0 ? (' | Alivio: ' + formatMoney(v.refinanciacion.alivioMensual) + '/mes') : '') +
            '</div>';
          }

          if (v.diferenciaTexto) {
            html += '<div><span class="proposal-diff-tag">Diferencia vs versión anterior: ' + sanitizeHTML(v.diferenciaTexto) + '</span></div>';
          }

          if (v.detalle) {
            html += '<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;font-style:italic;">Nota: "' + sanitizeHTML(v.detalle) + '"</div>';
          }

          html += '<div style="margin-top:4px;text-align:right;">' +
              '<button type="button" class="btn-copy" style="font-size:0.64rem;padding:2px 6px;" onclick="copiarPropuestaWhatsApp(\'' + s.id + '\', ' + (v.version || 1) + ')">📋 Copiar v' + (v.version || 1) + ' para WhatsApp</button>' +
            '</div>' +
            '</div>' +
          '</details>';
        });

        html += '</div></details>';
      }

      // APARTADO EJECUTIVO EN LA FICHA DE LA MUTUAL (EXCLUSIVO ANALISTAS Y ADMIN)
      if (isAnalistaOAdmin) {
        html += renderApartadoEjecutivoAuditoriaFicha(s);
      }

      // 5. SECCIÓN 3: GESTOR Y VISOR DOCUMENTAL ONLINE (VER, DESCARGAR, REEMPLAZAR, OBSERVAR)
      html += '</div><div class="ficha-tab-panel' + (tabFichaAct === 'legajo' ? ' is-active' : '') + '" data-ficha-panel="legajo">' +
        '<div class="section-title-divider" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
        '<span>3. Legajo Documental Online (Ver, Descargar, Reemplazar)</span>' +
        (isAnalistaOAdmin ?
          '<button type="button" class="btn-doc-observe" onclick="abrirPanelObservarDocumento(\'' + s.id + '\', -1)">⚠️ Solicitar / Observar Documento</button>' : '') +
      '</div>';

      if (isAnalistaOAdmin) {
        html += '<div id="panelRequerirDocFicha" class="doc-req-panel" style="display:none;">' +
          '<div style="font-size:0.78rem;font-weight:800;color:#92400e;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;">' +
            '<span>⚠️ Solicitar / Observar Documentación al Comercializador</span>' +
            '<button type="button" onclick="cerrarPanelObservarDocumento()" style="background:none;border:none;color:#92400e;font-size:1.1rem;cursor:pointer;line-height:1;">&times;</button>' +
          '</div>' +
          '<input type="hidden" id="hidReqAdjIdx" value="-1"/>' +
          '<div style="display:grid;grid-template-columns:1fr;gap:0.55rem;margin-bottom:0.6rem;">' +
            '<div>' +
              '<label class="form-label" style="font-size:0.68rem;color:#78350f;">Comprobante requerido u observado:</label>' +
              '<select id="cboReqDocTipo" class="input-text" style="font-size:0.75rem;background:#ffffff;">' +
                '<option value="DNI (FRENTE Y DORSO)">DNI (FRENTE Y DORSO)</option>' +
                '<option value="RECIBO DE SUELDO">RECIBO DE SUELDO</option>' +
                '<option value="SERVICIO">SERVICIO / CONSTANCIA DE DOMICILIO</option>' +
                '<option value="CONSTANCIA DE CBU">CONSTANCIA DE CBU</option>' +
                '<option value="CERTIFICADO SAGE">CERTIFICADO SAGE</option>' +
                '<option value="COMPROBANTE DE MOVIMIENTOS BANCARIOS">COMPROBANTE DE MOVIMIENTOS BANCARIOS</option>' +
                '<option value="CONTRATO DE SERVICIO">CONTRATO DE SERVICIO</option>' +
                '<option value="NOTA DE SERVICIO OFICIAL">NOTA DE SERVICIO OFICIAL</option>' +
                '<option value="TARJETA SIDECREER">TARJETA SIDECREER</option>' +
                '<option value="OTROS DOCUMENTOS">OTROS DOCUMENTOS</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="form-label" style="font-size:0.68rem;color:#78350f;">Motivo específico para el asesor comercial:</label>' +
              '<input type="text" id="txtReqDocMotivo" class="input-text" style="font-size:0.75rem;background:#ffffff;" placeholder="Ej: DNI dorso borroso / Adjuntar último recibo de haberes con QR legible..."/>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:0.45rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-restore" onclick="cerrarPanelObservarDocumento()">Cancelar</button>' +
            '<button type="button" class="btn-doc-subsanar" onclick="confirmarRequerimientoDocumental(\'' + s.id + '\')">⚠️ Marcar Observado y Notificar</button>' +
          '</div>' +
        '</div>';
      }

      html += '<div class="document-rows-container" style="margin-bottom:.85rem;">';

      const reqsActivos = (s.requerimientosDocumentales || []).map((r, rIdx) => ({ r, rIdx })).filter(item => !item.r.resuelto);

      if (reqsActivos.length > 0) {
        reqsActivos.forEach(({ r, rIdx }) => {
          html += '<div class="document-row-card is-observed" style="margin-bottom:0.55rem;">' +
            '<div class="doc-row-left">' +
              '<div class="doc-row-icon">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' +
                '</svg>' +
              '</div>' +
              '<div class="doc-row-info">' +
                '<div class="doc-row-header-line">' +
                  '<span class="doc-row-title">' + sanitizeHTML(r.tipo) + '</span>' +
                  '<span class="doc-row-badge badge-requerido-sede">⚠️ Documentación requerida por Sede Central</span>' +
                '</div>' +
                '<div class="doc-obs-reason-box">' +
                  '<strong>Motivo indicado:</strong> ' + sanitizeHTML(r.motivo) +
                  ' <span style="font-size:0.63rem;opacity:0.8;">(' + formatearFechaHoraChat(r.fecha || s.fecha) + ' • ' + sanitizeHTML(r.autor || 'Sede Central') + ')</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="doc-row-actions">' +
              '<label class="btn-doc-subsanar" style="cursor:pointer;margin:0;" title="Adjuntar comprobante solicitado por Sede Central">' +
                '📤 Subsanar / Adjuntar <input type="file" accept="image/*,application/pdf" style="display:none;" onchange="subsanarRequerimientoDocumental(\'' + s.id + '\', ' + rIdx + ', this)"/>' +
              '</label>' +
            '</div>' +
          '</div>';
        });
      }

      const listaArchivosFicha = normalizarListaArchivos(s);
      s.adjuntos = listaArchivosFicha;
      s.archivosAdjuntos = listaArchivosFicha;

      if (listaArchivosFicha.length === 0 && reqsActivos.length === 0) {
        html += '<div style="font-size:0.75rem;color:var(--text-muted);padding:0.85rem;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;">No se registran archivos adjuntos cargados en este expediente.</div>';
      } else if (listaArchivosFicha.length > 0) {
        listaArchivosFicha.forEach((a, idx) => {
          const esObs = Boolean(a.observado);
          const rowCls = esObs ? 'doc-compact-card is-observed' : 'doc-compact-card';
          const nombreVisualRaw = String(a.nombre || 'DOCUMENTO.PDF');
          const nombreVisual = (String(a.tipoMime || '').toLowerCase() === 'application/pdf')
            ? nombreVisualRaw.replace(/\.(jpg|jpeg|png|webp|gif|bmp|heic|pdf)$/i, '.PDF')
            : nombreVisualRaw;
          const badgeEstadoHtml = esObs
            ? '<span class="doc-compact-pill-obs">⚠️ Requerido</span>'
            : '<span class="doc-compact-pill-ok">✓ Legajo</span>';
          const replaceTooltip = esObs ? 'Subsanar / Reemplazar Archivo' : 'Reemplazar Archivo';

          html += '<div class="' + rowCls + '">' +
            '<div class="doc-compact-left">' +
              '<div class="doc-compact-pdf-badge">' + (esObs ? 'OBS' : 'PDF') + '</div>' +
              '<div class="doc-compact-meta">' +
                '<div class="doc-compact-title-line">' +
                  '<h5 class="doc-compact-filename" title="' + sanitizeHTML(nombreVisual) + '">' + sanitizeHTML(nombreVisual) + '</h5>' +
                  badgeEstadoHtml +
                  '<span class="doc-compact-tipo-tag">' + sanitizeHTML(a.tipo || 'DOCUMENTO') + '</span>' +
                '</div>' +
                '<p class="doc-compact-sub">' +
                  formatearFechaHoraChat(a.fecha || s.fecha) + ' • por <span style="font-weight:600;color:#334155;">' + sanitizeHTML(a.cargadoPor || a.usuarioOperador || a.autor || 'Operador') + '</span>' +
                '</p>' +
                (esObs ? (
                  '<div class="doc-obs-reason-box">' +
                    '<strong>Motivo indicado por Sede Central:</strong> ' + sanitizeHTML(a.motivoObservacion || 'Por favor reemplazar por una copia legible y actualizada.') +
                  '</div>'
                ) : '') +
              '</div>' +
            '</div>' +
            '<div class="doc-toolbar-compact">' +
              '<button type="button" class="doc-tool-btn doc-tool-view" onclick="abrirVisorOnline(\'' + s.id + '\', ' + idx + ')" title="Ver Online" aria-label="Ver Online">' +
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' +
              '</button>' +
              '<button type="button" class="doc-tool-btn doc-tool-download" onclick="descargarDocumentoOnline(\'' + s.id + '\', ' + idx + ')" title="Descargar Archivo" aria-label="Descargar Archivo">' +
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>' +
              '</button>' +
              '<label class="doc-tool-btn doc-tool-replace' + (esObs ? ' is-urgent' : '') + '" title="' + replaceTooltip + '" aria-label="' + replaceTooltip + '">' +
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
                '<input type="file" accept="image/*,application/pdf" style="display:none;" onchange="reemplazarDocumentoExistente(\'' + s.id + '\', ' + idx + ', this)"/>' +
              '</label>' +
              (isAnalistaOAdmin ? (
                '<button type="button" class="doc-tool-btn doc-tool-observe" onclick="abrirPanelObservarDocumento(\'' + s.id + '\', ' + idx + ')" title="Observar o Solicitar Corrección" aria-label="Observar o Solicitar Corrección">' +
                  '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' +
                '</button>'
              ) : '') +
              '<button type="button" class="doc-tool-btn doc-tool-delete" onclick="solicitarEliminarDocumento(\'' + s.id + '\', ' + idx + ')" title="Eliminar Documento del Legajo" aria-label="Eliminar Documento del Legajo">' +
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>';
        });
      }

      html += '</div>';

      // Subir nuevo documento (Rediseño Corporativo Azul Institucional + Banner Destacado Frente y Dorso)
      const prefijoOficialFicha = obtenerPrefijoOficialExpediente(s);
      html += '<div class="doc-complementaria-card">' +
        '<div style="font-size:0.8rem;font-weight:700;color:#135596;display:flex;align-items:center;gap:6px;margin-bottom:0.55rem;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#135596" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<span>Documentación Complementaria del Legajo</span>' +
        '</div>' +
        '<button type="button" class="doc-frente-dorso-banner" style="margin-top:0;margin-bottom:0.75rem;" onclick="abrirAsistenteFrenteDorso(\'fileFichaAdicional\', null, \'ficha\', \'' + s.id + '\')" title="Combinar 2 fotos (Frente y Dorso) en un único PDF A4">' +
          '<span class="doc-frente-dorso-banner-left">' +
            '<span class="doc-frente-dorso-banner-icon" aria-hidden="true">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8.5" cy="11.5" r="2"/><path d="M5.5 16c.8-1.4 2-2 3-2s2.2.6 3 2"/><line x1="14" y1="10" x2="19" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/></svg>' +
            '</span>' +
            '<span>' +
              '<div class="doc-frente-dorso-banner-title">Unificar Frente y Dorso en PDF A4</div>' +
              '<div class="doc-frente-dorso-banner-sub">Fusioná dos fotos (DNI o Tarjeta) en un solo PDF A4 listo para archivar en el expediente #' + sanitizeHTML(prefijoOficialFicha) + '.</div>' +
            '</span>' +
          '</span>' +
          '<span class="doc-frente-dorso-banner-cta">' +
            '<span>Abrir Asistente</span>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
          '</span>' +
        '</button>' +
        '<div style="display:grid;grid-template-columns:minmax(200px,1fr) minmax(240px,1.5fr);gap:0.65rem;align-items:center;">' +
          '<select id="cboFichaDocTipo" class="doc-complementaria-select">' +
            '<option value="DNI (FRENTE Y DORSO)">DNI (FRENTE Y DORSO)</option>' +
            '<option value="RECIBO DE SUELDO">RECIBO DE SUELDO</option>' +
            '<option value="SERVICIO">SERVICIO</option>' +
            '<option value="CONSTANCIA DE CBU">CONSTANCIA DE CBU</option>' +
            '<option value="CERTIFICADO SAGE">CERTIFICADO SAGE</option>' +
            '<option value="COMPROBANTE DE MOVIMIENTOS BANCARIOS">COMPROBANTE DE MOVIMIENTOS BANCARIOS</option>' +
            '<option value="CONTRATO DE SERVICIO">CONTRATO DE SERVICIO</option>' +
            '<option value="NOTA DE SERVICIO OFICIAL">NOTA DE SERVICIO OFICIAL</option>' +
            '<option value="TARJETA SIDECREER">TARJETA SIDECREER</option>' +
            '<option value="OTROS DOCUMENTOS">OTROS DOCUMENTOS</option>' +
            (isAnalistaOAdmin ? (
              '<option value="TRANSFERENCIA">TRANSFERENCIA (Uso Interno)</option>' +
              '<option value="SOLICITUD DE AYUDA ECONOMICA">SOLICITUD DE AYUDA ECONOMICA (Uso Interno)</option>' +
              '<option value="AUTORIZACION PARA DESCUENTO DE HABERES">AUTORIZACION PARA DESCUENTO DE HABERES (Uso Interno)</option>'
            ) : '') +
          '</select>' +
          '<input type="file" id="fileFichaAdicional" multiple class="doc-row-native-input" accept="image/*,application/pdf" onchange="handleArchivoComplementarioSeleccionado(\'' + s.id + '\', this)"/>' +
          '<button type="button" class="btn-doc-complementaria-corp" onclick="document.getElementById(\'fileFichaAdicional\').click()">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#135596" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' +
            '<span id="lblBtnDocComplementaria">Adjuntar Documentación Complementaria al Legajo</span>' +
          '</button>' +
        '</div>' +
        '<div class="document-dropzone" id="dropzoneFichaLegajo" style="margin-top:0.75rem;padding:0.95rem 0.85rem;cursor:pointer;" onclick="document.getElementById(\'inpLoteFichaExpediente\').click()" ondragover="event.preventDefault(); this.classList.add(\'is-dragover\');" ondragleave="this.classList.remove(\'is-dragover\');" ondrop="handleDropzoneLoteExpediente(event, \'ficha\', \'' + s.id + '\')">' +
          '<input type="file" id="inpLoteFichaExpediente" multiple accept="image/*,application/pdf" style="display:none;" onchange="agregarArchivosLoteExpediente(this.files, \'ficha\', \'' + s.id + '\'); this.value=\'\';"/>' +
          '<div class="document-dropzone-text" style="font-size:0.8rem;">📂 Arrastrá varios archivos aquí o hacé clic para subir por Lote</div>' +
          '<div class="document-dropzone-sub" style="font-size:0.71rem;">Podés arrastrar múltiples PDFs o imágenes juntos, clasificarlos automáticamente o con IA y subirlos al expediente #' + sanitizeHTML(prefijoOficialFicha) + '</div>' +
        '</div>' +
        '<div id="loteFichaPanel" style="display:none;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:0.75rem 0.9rem;margin-top:0.65rem;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.55rem;">' +
            '<div style="font-size:0.8rem;font-weight:700;color:#0f172a;">📦 Lote listo para archivar (<span id="loteExpFichaCount">0</span>)</div>' +
            '<div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">' +
              '<select id="selLoteExpTipoMasivoFicha" onchange="aplicarTipoMasivoLoteExpediente(this.value, \'ficha\'); this.value=\'\';" style="font-size:0.72rem;padding:0.3rem 0.42rem;border:1px solid #cbd5e1;border-radius:6px;background:#ffffff;color:#334155;">' +
                '<option value="">🏷️ Asignar mismo tipo a todos...</option>' +
              '</select>' +
              '<button type="button" id="btnReconocerLoteExpIA_ficha" onclick="clasificarLoteExpedienteConIA(\'ficha\')" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:6px;padding:0.35rem 0.68rem;font-size:0.72rem;font-weight:600;cursor:pointer;">🤖 Reconocer con IA</button>' +
              '<button type="button" id="btnSubirLoteExp_ficha" onclick="subirLoteExpedienteConfirmar(\'ficha\')" style="background:#059669;color:#fff;border:none;border-radius:6px;padding:0.35rem 0.75rem;font-size:0.72rem;font-weight:700;cursor:pointer;">✅ Subir al Expediente</button>' +
              '<button type="button" onclick="limpiarLoteExpediente(\'ficha\')" style="background:#fff;color:#64748b;border:1px solid #cbd5e1;border-radius:6px;padding:0.34rem 0.6rem;font-size:0.72rem;font-weight:600;cursor:pointer;">Limpiar</button>' +
            '</div>' +
          '</div>' +
          '<div id="loteExpFichaLista" style="display:flex;flex-direction:column;gap:0.45rem;max-height:260px;overflow-y:auto;"></div>' +
        '</div>' +
        '<p id="lblArchivoComplementarioEstado" style="font-size:0.68rem;color:#475569;margin-top:0.5rem;margin-bottom:0;">Seleccione el tipo de comprobante o arrastre un lote de archivos para archivarlo automáticamente en el Legajo Digital Seguro con formato <code>' + sanitizeHTML(prefijoOficialFicha) + ' [TIPO].PDF</code>.</p>' +
      '</div>';

      // 6. SECCIÓN 4: CHAT DE AUDITORÍA Y LÍNEA DE TIEMPO (TÍTULO EXACTO)
      const listaBitacora = normalizarBitacoraComentarios(s);
      s.observaciones = listaBitacora;
      s.historialComentarios = listaBitacora;
      s.comentarios = listaBitacora;

      html += '</div><div class="ficha-tab-panel' + (tabFichaAct === 'bitacora' ? ' is-active' : '') + '" data-ficha-panel="bitacora">' +
        '<div class="section-title-divider">Chat de Auditoría y Línea de Tiempo (' + listaBitacora.length + ')</div>' +
        '<div class="chat-container" id="fichaChatContainer">';

      if (listaBitacora.length === 0) {
        html += '<div style="font-size:0.74rem;color:var(--text-muted);text-align:center;padding:1.5rem 1rem;">Sin movimientos ni observaciones registradas aún en la bitácora de auditoría.</div>';
      } else {
        const ahoraMs = Date.now();
        listaBitacora.forEach(o => {
          const msgTs = Number(o.timestamp || 0) || (o.fecha ? parsearFechaATimestampCliente(o.fecha) : 0);
          const transcurridoMs = msgTs ? (ahoraMs - msgTs) : Infinity;
          const dentroDe5Min = transcurridoMs >= 0 && transcurridoMs <= 300000;
          const esMio = Boolean(session && (
            o.autor === session.nombre ||
            o.usuarioOperador === session.nombre ||
            (session.nombre && o.autor && String(o.autor).includes(session.nombre))
          ));
          const esMutual = (o.rol && (o.rol.includes('Analista') || o.rol.includes('Mutual') || o.rol.includes('Admin') || o.rol.includes('Automático')));
          const bubbleClass = esMio ? 'chat-bubble-mio' : 'chat-bubble-otro';
          const tagClass = esMio ? 'chat-tag-mio' : 'chat-tag-otro';
          const tagText = esMio ? (session.rol || 'Mi Mensaje') : (esMutual ? 'Mutual Créditos' : 'Comercializador');

          const esAuditoriaInmutable = (
            o.tipo === 'AUDITORIA_INICIAL' ||
            o.tipo === 'AUDITORIA_IA_DOCUMENTAL' ||
            (o.autor && String(o.autor).includes('[Auditoría IA]'))
          );

          const puedeAccionar = esMio && dentroDe5Min && !o.eliminado && !esAuditoriaInmutable;

          let contenidoHtml = '';
          if (o.eliminado) {
            contenidoHtml = '<div style="display:flex;align-items:center;gap:5px;font-style:italic;color:#94a3b8;font-size:0.73rem;">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' +
              '<span>Este mensaje fue eliminado</span>' +
            '</div>';
          } else {
            contenidoHtml = '<div style="margin-top:2px;word-break:break-word;">' + sanitizeHTML(o.texto || o.contenido || '') + '</div>';
          }

          let estampaEditado = '';
          if (o.editado && !o.eliminado) {
            estampaEditado = ' <span class="chat-editado-tag" style="font-size:0.62rem;opacity:0.8;font-style:italic;margin-left:4px;">(editado)</span>';
          }

          let accionesBarHtml = '';
          if (puedeAccionar) {
            const minutosRestantes = Math.max(1, Math.ceil((300000 - transcurridoMs) / 60000));
            accionesBarHtml = '<div class="chat-actions-hover-bar">' +
              '<button type="button" class="btn-chat-bubble-action" title="Editar mensaje (' + minutosRestantes + 'm restantes)" onclick="iniciarEdicionComentario(\'' + sanitizeHTML(s.id) + '\', \'' + sanitizeHTML(o.id) + '\')">' +
                '✏️' +
              '</button>' +
              '<button type="button" class="btn-chat-bubble-action" title="Eliminar mensaje para todos" onclick="confirmarEliminarComentario(\'' + sanitizeHTML(s.id) + '\', \'' + sanitizeHTML(o.id) + '\')">' +
                '🗑️' +
              '</button>' +
            '</div>';
          }

          html += '<div class="chat-bubble ' + bubbleClass + '" data-msg-id="' + sanitizeHTML(o.id) + '">' +
            accionesBarHtml +
            '<div class="chat-meta">' +
              '<span><strong>' + sanitizeHTML(o.autor || 'Sistema') + '</strong> <span class="chat-tag ' + tagClass + '">' + tagText + '</span></span>' +
              '<span class="chat-timestamp">' + formatearFechaHoraChat(o.fecha) + estampaEditado + '</span>' +
            '</div>' +
            contenidoHtml +
          '</div>';
        });
      }

      html += '</div>';

      // Caja de envío rápida del chat (SIN checkbox de subsanación)
      html += '<div style="margin-top:.6rem;background:#f8fafc;padding:.65rem;border-radius:8px;border:1px solid var(--border-color);">' +
        '<label class="form-label">Escribir una aclaración, nota o resolución:</label>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;">' +
          '<input type="text" id="txtFichaComentario" class="input-text" placeholder="Escriba su mensaje aquí..." style="font-size:.75rem;" onkeydown="if(event.key===\'Enter\'){enviarComentarioComercializador(\'' + s.id + '\');}"/>' +
          '<button type="button" id="btnEnviarComentario" class="btn-primary-action" style="width:auto;padding:.45rem 1rem;font-size:.75rem;white-space:nowrap;" onclick="enviarComentarioComercializador(\'' + s.id + '\')">Enviar 💬</button>' +
        '</div>' +
      '</div>';

      html += '</div>';
      body.innerHTML = html;
      if (window.__loteExpedienteState && window.__loteExpedienteState.ficha) {
        if (String(window.__loteExpedienteState.ficha.id || '') !== String(s.id)) {
          window.__loteExpedienteState.ficha = { id: String(s.id), items: [] };
        }
        if (typeof renderLoteExpediente === 'function') renderLoteExpediente('ficha');
      }
      const footerCiclo = document.getElementById('footerCicloVidaFicha');
      if (footerCiclo) {
        footerCiclo.innerHTML = (typeof renderBotonCicloVida === 'function') ? renderBotonCicloVida(s, true) : '';
      }
      if (s.solicitante?.fechaIngresoLaboral || s.solicitante?.Fecha_Ingreso_Laboral) {
        calcularAntiguedadReactiva(
          String(s.solicitante.fechaIngresoLaboral || s.solicitante.Fecha_Ingreso_Laboral).slice(0, 10),
          'editTextoAntiguedad',
          'editAntiguedad'
        );
      }
      handleOrganismoChange(s.solicitante?.organismo || 'Provincial', 'editLegajo');
      abrirModal('modalFichaCompleta');

      // Scroll abajo chat
      setTimeout(() => {
        const ch = document.getElementById('fichaChatContainer');
        if (ch) ch.scrollTop = ch.scrollHeight;
      }, 50);
    }

    function formatearFechaHoraChat(fechaStr) {
      if (!fechaStr) return '';
      const formatted = formatearFechaHora24(fechaStr);
      return formatted === 'Fecha no registrada' ? sanitizeHTML(String(fechaStr)) : formatted;
    }

    /* EDICIÓN DE SOLICITANTE BLINDADA */
    async function guardarEdicionSolicitante(e, id) {
      e.preventDefault();
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const session = getSession();

      const editDniVal = document.getElementById('editDni')?.value?.trim();
      if (!validarDni(editDniVal)) {
        showToast('⚠️ Error: El DNI debe ser numérico y contener entre 7 y 8 dígitos.');
        return;
      }
      const editEmailVal = document.getElementById('editEmail')?.value?.trim();
      if (editEmailVal && !validarEmail(editEmailVal)) {
        showToast('⚠️ Error: Ingrese una dirección de email válida.');
        return;
      }
      const editCelVal = document.getElementById('editCelular')?.value?.trim();
      if (!validarCelular(editCelVal)) {
        showToast('⚠️ Error: Ingrese un número de celular/teléfono válido (entre 8 y 15 dígitos).');
        return;
      }

      s.solicitante.dni = sanitizeHTML(editDniVal);
      s.solicitante.cuil = sanitizeHTML(document.getElementById('editCuil')?.value?.trim() || '');
      s.solicitante.nombre = sanitizeHTML(document.getElementById('editNombre').value.trim());
      s.solicitante.fechaNac = sanitizeHTML(document.getElementById('editFechaNac').value);
      s.solicitante.fechaNacimiento = s.solicitante.fechaNac;
      s.solicitante.sexo = sanitizeHTML(document.getElementById('editSexo')?.value || '');
      s.solicitante.estadoCivil = sanitizeHTML(document.getElementById('editEstadoCivil')?.value || '');
      s.solicitante.banco = sanitizeHTML(document.getElementById('editBanco')?.value?.trim() || '');
      s.solicitante.tipoCuenta = sanitizeHTML(document.getElementById('editTipoCuenta')?.value || '');
      s.solicitante.nroCuenta = sanitizeHTML(document.getElementById('editNroCuenta')?.value?.trim() || '');
      s.solicitante.cbu = sanitizeHTML(document.getElementById('editCbu')?.value?.trim() || '');
      s.solicitante.alias = sanitizeHTML(document.getElementById('editAlias')?.value?.trim() || '');
      s.solicitante.tarjetaSidecreerNumero = sanitizeHTML(document.getElementById('editTarjetaSidecreerNumero')?.value?.trim() || '');
      s.solicitante.tarjetaSidecreerVencimiento = sanitizeHTML(document.getElementById('editTarjetaSidecreerVencimiento')?.value?.trim() || '');
      s.solicitante.tarjetaSidecreerCvv = sanitizeHTML(document.getElementById('editTarjetaSidecreerCvv')?.value?.trim() || '');
      s.solicitante.parejaNombre = sanitizeHTML(document.getElementById('editParejaNombre')?.value?.trim() || '');
      s.solicitante.parejaDni = sanitizeHTML(document.getElementById('editParejaDni')?.value?.trim() || '');
      s.solicitante.parejaEmail = sanitizeHTML(document.getElementById('editParejaEmail')?.value?.trim() || '');
      s.solicitante.parejaTelefono = sanitizeHTML(document.getElementById('editParejaTelefono')?.value?.trim() || '');
      s.solicitante.celular = sanitizeHTML(editCelVal);
      s.solicitante.email = sanitizeHTML(editEmailVal);
      s.solicitante.localidad = sanitizeHTML(document.getElementById('editLocalidad')?.value?.trim() || '');
      s.solicitante.legajo = sanitizeHTML(document.getElementById('editLegajo').value.trim());
      s.solicitante.domicilio = sanitizeHTML(document.getElementById('editDomicilio').value.trim());
      s.solicitante.condicion = sanitizeHTML(document.getElementById('editCondicion').value);
      s.solicitante.organismo = sanitizeHTML(document.getElementById('editOrganismo').value);
      s.solicitante.dependencia = sanitizeHTML(document.getElementById('editDependencia').value.trim());
      s.solicitante.cargo = sanitizeHTML(document.getElementById('editCargo')?.value?.trim() || '');
      s.solicitante.situacionRevista = '';
      const editFechaIngVal = sanitizeHTML(document.getElementById('editFechaIngreso')?.value?.trim() || '');
      s.solicitante.fechaIngresoLaboral = editFechaIngVal;
      s.solicitante.Fecha_Ingreso_Laboral = editFechaIngVal;
      s.solicitante.antiguedad = editFechaIngVal
        ? calcularAntiguedadReactiva(editFechaIngVal, 'editTextoAntiguedad', 'editAntiguedad')
        : sanitizeHTML(document.getElementById('editAntiguedad')?.value?.trim() || '');
      if (s.datosLaborales) {
        s.datosLaborales.cargo = s.solicitante.cargo;
        s.datosLaborales.situacionRevista = '';
        s.datosLaborales.fechaIngresoLaboral = editFechaIngVal;
        s.datosLaborales.Fecha_Ingreso_Laboral = editFechaIngVal;
        s.datosLaborales.antiguedad = s.solicitante.antiguedad;
      }

      const now = obtenerFechaHora24hs();
      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: session?.nombre || 'Usuario',
        rol: session?.rol || 'Comercializador',
        fecha: now,
        texto: 'Datos del solicitante actualizados en el expediente digital.'
      });

      saveStoredSolicitudes(all);
      callApi({ action: 'actualizarDatosSolicitante', id: s.id, solicitante: s.solicitante }).catch(console.warn);

      showToast('Datos del solicitante guardados correctamente 💾');
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(id);
    }

    /* ASIGNAR NÚMERO DEFINITIVO (MUTUAL) */
    function abrirModalAsignarNroDefinitivo(idSolicitud) {
      const rawId = (idSolicitud !== undefined && idSolicitud !== null && String(idSolicitud).trim() !== '' && String(idSolicitud).trim() !== 'undefined' && String(idSolicitud).trim() !== 'null')
        ? String(idSolicitud).trim()
        : (obtenerIdSolicitudActiva() || '');
      if (!rawId) {
        showToast('⚠️ No se encontró el ID del expediente activo.');
        return;
      }
      const all = getStoredSolicitudes();
      const s = all.find(x =>
        String(x.id || '') === rawId ||
        String(x.idSolicitud || '') === rawId ||
        String(x.ID_Solicitud || '') === rawId ||
        String(x.id_provisorio || '') === rawId
      );
      if (!s) {
        showToast('⚠️ No se encontró la solicitud ' + rawId + ' en la sesión.');
        return;
      }
      const idResuelto = String(s.idSolicitud || s.ID_Solicitud || s.id || rawId).trim();
      solicitudSeleccionada = s;
      window.solicitudSeleccionada = s;

      const inpInline = document.getElementById('inpNumDefinitivoModal')?.value?.trim();
      const sugerencia = inpInline || s.id_definitivo || ('EXP-' + idResuelto);

      const hid = document.getElementById('asignarNroDefIdSolicitud');
      const inp = document.getElementById('inpModalNroDefinitivo');
      const meta = document.getElementById('asignarNroDefMeta');

      if (hid) hid.value = idResuelto;
      if (inp) inp.value = sugerencia;
      if (meta) {
        meta.innerHTML = (s.id_definitivo
          ? 'Expediente: <strong>' + sanitizeHTML(s.id_definitivo) + '</strong>'
          : 'Expediente provisorio: <strong>' + sanitizeHTML(s.id_provisorio || ('PROV-' + idResuelto)) + '</strong>') +
          ' · Titular: <strong>' + sanitizeHTML(s.solicitante?.nombre || 'Socio') + '</strong> (DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + ')';
      }

      abrirModal('modal-asignar-nro-definitivo');
      setTimeout(() => { if (inp) inp.focus(); }, 60);
    }

    async function submitModalAsignarNroDefinitivo() {
      const rawHid = document.getElementById('asignarNroDefIdSolicitud')?.value?.trim();
      const idSolicitud = (rawHid && rawHid !== 'undefined' && rawHid !== 'null') ? rawHid : (obtenerIdSolicitudActiva() || '');
      const nroIngresado = document.getElementById('inpModalNroDefinitivo')?.value?.trim();
      if (!idSolicitud || !nroIngresado) {
        showToast('⚠️ Ingrese un número definitivo válido para el expediente.');
        return;
      }
      cerrarModal('modal-asignar-nro-definitivo');
      await confirmarAsignacionNroDefinitivo(idSolicitud, nroIngresado);
    }

    async function confirmarAsignacionNroDefinitivo(idSolicitud, nroIngresado) {
      const usuarioSesionActual = getSession();
      let idSolicitudSeleccionada = (idSolicitud !== undefined && idSolicitud !== null) ? String(idSolicitud).trim() : '';
      if (!idSolicitudSeleccionada || idSolicitudSeleccionada === 'undefined' || idSolicitudSeleccionada === 'null') {
        idSolicitudSeleccionada = obtenerIdSolicitudActiva() || '';
      }
      const val = sanitizeHTML(String(nroIngresado || '').trim());
      if (!idSolicitudSeleccionada || idSolicitudSeleccionada === 'undefined' || idSolicitudSeleccionada === 'null') {
        showToast('⚠️ Error: No se pudo determinar el ID de la solicitud activa.');
        return;
      }
      if (!val) {
        showToast('⚠️ Ingrese un número de expediente formal.');
        return;
      }
      const btnFicha = document.getElementById('btnAsignarNroDefinitivoFicha');
      const btnModal = document.getElementById('btnConfirmarNroDefinitivo');
      const prevBtnText = btnFicha ? btnFicha.innerHTML : '';
      const prevModalBtnText = btnModal ? btnModal.innerHTML : '';
      if (btnFicha) {
        btnFicha.disabled = true;
        btnFicha.innerHTML = '⏳ Guardando...';
      }
      if (btnModal) {
        btnModal.disabled = true;
        btnModal.innerHTML = '⏳ Guardando...';
      }
      try {
        const payload = {
          action: 'asignarNumeroDefinitivo',
          idSolicitud: idSolicitudSeleccionada,
          nroDefinitivoInput: val,
          usuarioActivo: usuarioSesionActual
        };
        const res = await callApi(payload, {
          title: 'Asignando número definitivo de expediente...',
          sub: 'Registrando código ' + val + ' en la Base Central de la Mutual'
        });

        if (res && res.ok && (!res.data || res.data.ok !== false)) {
          const nroFinal = (res.data && (res.data.ID_Definitivo_Expediente || res.data.Nro_Definitivo || res.data.nroDefinitivo || res.data.id_definitivo)) || val;
          const aplicarNumeroLocal = () => {
            const allLocal = getStoredSolicitudes();
            const idxLocal = allLocal.findIndex(x =>
              String(x.id || '') === idSolicitudSeleccionada ||
              String(x.idSolicitud || '') === idSolicitudSeleccionada ||
              String(x.ID_Solicitud || '') === idSolicitudSeleccionada
            );
            if (idxLocal !== -1) {
              allLocal[idxLocal].id_definitivo = nroFinal;
              allLocal[idxLocal].Nro_Definitivo = nroFinal;
              allLocal[idxLocal].ID_Definitivo_Expediente = nroFinal;
              solicitudSeleccionada = allLocal[idxLocal];
              window.solicitudSeleccionada = allLocal[idxLocal];
              saveStoredSolicitudes(allLocal);
            }
          };
          aplicarNumeroLocal();

          const nomSocioTit = (solicitudSeleccionada?.solicitante?.nombre || solicitudSeleccionada?.Apellido_Nombre || '').trim();
          const tituloExpedienteVivo = 'Expediente ' + nroFinal + (nomSocioTit ? (' — ' + nomSocioTit) : '');
          const elModalTit = document.getElementById('modalFichaTitulo');
          if (elModalTit) elModalTit.innerHTML = sanitizeHTML(tituloExpedienteVivo) + '<span id="detalle-id-solicitud" data-id="' + sanitizeHTML(idSolicitudSeleccionada) + '" style="display:none;">' + sanitizeHTML(idSolicitudSeleccionada) + '</span>';
          const elFichaTit = document.getElementById('fichaModalTitle');
          if (elFichaTit && elFichaTit !== elModalTit) elFichaTit.innerHTML = sanitizeHTML(tituloExpedienteVivo);

          const lblProvWrap = document.getElementById('lblNroProvisorioWrap');
          if (lblProvWrap) lblProvWrap.style.display = 'none';
          const lblActual = document.getElementById('lblNroDefinitivoActual');
          if (lblActual) lblActual.innerHTML = '<strong style="color:#166534;">' + sanitizeHTML(nroFinal) + '</strong>';
          const inpModal = document.getElementById('inpNumDefinitivoModal');
          if (inpModal) inpModal.value = nroFinal;

          showToast('N° Definitivo asignado en Base Central: ' + nroFinal);
          await sincronizarGestionesDesdeNube(true);
          const postSync = getStoredSolicitudes();
          const itemPost = postSync.find(x =>
            String(x.id || '') === idSolicitudSeleccionada ||
            String(x.idSolicitud || '') === idSolicitudSeleccionada ||
            String(x.ID_Solicitud || '') === idSolicitudSeleccionada
          );
          if (itemPost && !itemPost.id_definitivo) {
            itemPost.id_definitivo = nroFinal;
            itemPost.Nro_Definitivo = nroFinal;
            itemPost.ID_Definitivo_Expediente = nroFinal;
            saveStoredSolicitudes(postSync);
          }
          actualizarVistaDetalleExpediente(idSolicitudSeleccionada);
        } else {
          showToast('⚠️ ' + ((res && (res.error || (res.data && res.data.error))) || 'Error al asignar número'));
        }
      } catch (e) {
        console.error('Error asignando N° Definitivo:', e);
        showToast('⚠️ Error de conexión con el servidor central');
      } finally {
        if (btnFicha) {
          btnFicha.disabled = false;
          btnFicha.innerHTML = prevBtnText || '🏷️ Asignar N° Definitivo';
        }
        if (btnModal) {
          btnModal.disabled = false;
          btnModal.innerHTML = prevModalBtnText || 'Confirmar N° Definitivo';
        }
      }
    }

    function actualizarVistaDetalleExpediente(idSolicitud) {
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(idSolicitud);
      verFichaCompleta(idSolicitud);
    }

    async function guardarNumeroDefinitivo(id) {
      const idValido = (id !== undefined && id !== null && String(id).trim() !== '' && String(id).trim() !== 'undefined' && String(id).trim() !== 'null')
        ? String(id).trim()
        : (obtenerIdSolicitudActiva() || '');
      const inp = document.getElementById('inpNumDefinitivoModal');
      const rawVal = inp?.value?.trim();
      if (!rawVal) {
        abrirModalAsignarNroDefinitivo(idValido);
        return;
      }
      await confirmarAsignacionNroDefinitivo(idValido, rawVal);
    }

    const asignarNumeroDefinitivoModal = guardarNumeroDefinitivo;

    async function handleArchivoComplementarioSeleccionado(idSolicitud, inputEl) {
      if (!inputEl || !inputEl.files || inputEl.files.length === 0) return;
      if (inputEl.files.length > 1) {
        const tipoPreset = document.getElementById('cboFichaDocTipo')?.value || '';
        agregarArchivosLoteExpediente(inputEl.files, 'ficha', idSolicitud, tipoPreset);
        inputEl.value = '';
        const lbl = document.getElementById('lblArchivoComplementarioEstado');
        if (lbl) {
          lbl.textContent = 'Se agregaron ' + (window.__loteExpedienteState?.ficha?.items?.length || 0) + ' archivos al lote. Revisalos abajo y hacé clic en "✅ Subir al Expediente".';
        }
        return;
      }
      const lbl = document.getElementById('lblArchivoComplementarioEstado');
      if (lbl) {
        lbl.textContent = 'Subiendo archivo seleccionado: ' + inputEl.files[0].name + '...';
      }
      await adjuntarDocumentoAdicionalFicha(idSolicitud);
    }

    /* RECALCULAR Y GESTIONAR OFERTA MUTUAL Y REFINANCIACIÓN */
    function calcularTextoAlivioHtml(cuotaAnterior, nuevaCuota) {
      const cuotaAnt = parseFloat(cuotaAnterior) || 0;
      const cuotaNue = parseFloat(nuevaCuota) || 0;
      if (cuotaAnt <= 0) {
        return '<span style="color:var(--text-muted);">Ingrese la cuota anterior para proyectar el alivio mensual.</span>';
      }
      const dif = cuotaAnt - cuotaNue;
      if (dif > 0) {
        return '<span style="color:#15803d;font-weight:700;">🎉 Alivio financiero: El asociado libera ' + formatMoney(dif) + ' de afectación mensual en su recibo.</span>';
      }
      if (dif < 0) {
        return '<span style="color:#b45309;font-weight:700;">🟡 Variación mensual: Incremento de ' + formatMoney(Math.abs(dif)) + '/mes respecto a lo que venía pagando.</span>';
      }
      return '<span style="color:#475569;font-weight:600;">La nueva cuota es idéntica a la anterior.</span>';
    }

    function toggleBoxRefinanciacion() {
      const chk = document.getElementById('propEsRefinanciacion');
      const box = document.getElementById('boxRefinanciacion');
      if (box && chk) {
        box.style.display = chk.checked ? 'block' : 'none';
      }
      recalcularRefinanciacion();
    }

    function recalcularRefinanciacion() {
      const monto = parseFloat(document.getElementById('propMonto')?.value) || 0;
      const deuda = parseFloat(document.getElementById('propDeudaPrevia')?.value) || 0;
      const bolsillo = Math.max(0, monto - deuda);
      const inpBolsillo = document.getElementById('propNetoBolsillo');
      if (inpBolsillo) inpBolsillo.value = formatMoney(bolsillo);

      const cuotaAnt = parseFloat(document.getElementById('propCuotaAnterior')?.value) || 0;
      const linea = document.getElementById('propLinea')?.value || 'fedem';
      const plazo = parseInt(document.getElementById('propPlazo')?.value, 10) || 12;
      const sim = calculateSimulation(linea, plazo, 'neto', monto);
      const nuevaCuota = sim ? sim.cuota : 0;

      const inpNuevaComp = document.getElementById('propNuevaCuotaComp');
      if (inpNuevaComp) inpNuevaComp.value = formatMoney(nuevaCuota);

      const alivioEl = document.getElementById('propAlivioCuota');
      if (alivioEl) {
        alivioEl.innerHTML = calcularTextoAlivioHtml(cuotaAnt, nuevaCuota);
      }
    }

    function _normalizarLineaKeyOferta(lineaRaw) {
      const k = String(lineaRaw || 'fedem').toLowerCase();
      if (k.includes('muni') || k.includes('quad') || k.includes('vikingo')) return 'muni';
      if (k.includes('sidecreer')) return 'sidecreer';
      return 'fedem';
    }

    function renderKpiRecuadrosOfertaHtml(opts) {
      const o = opts || {};
      const lineaKey = _normalizarLineaKeyOferta(o.linea);
      const cuotas = Math.max(1, parseInt(o.cuotas, 10) || 12);
      const monto = Number(o.monto) || 0;
      const sim = (monto > 0 && typeof calculateSimulation === 'function')
        ? calculateSimulation(lineaKey, cuotas, 'neto', monto)
        : null;

      const cuotaVal = (Number(o.cuota) > 0) ? Number(o.cuota) : (sim ? sim.cuota : 0);
      const totalVal = (Number(o.total) > 0) ? Number(o.total) : (sim ? sim.totalAyuda : (cuotaVal * cuotas));
      const capitalVal = (Number(o.capital) > 0) ? Number(o.capital) : (sim ? sim.capital : 0);

      const isMuniOrSide = (lineaKey === 'muni' || lineaKey === 'sidecreer');
      const totalLabel = isMuniOrSide ? 'TOTAL A PAGAR' : 'TOTAL AYUDA ECONÓMICA';
      const totalBadge = (lineaKey === 'sidecreer') ? 'Importe ($) en Sidecreer' : 'Total a Devolver';
      const capLabel = isMuniOrSide ? 'IMPORTE SOLICITADO' : 'CAPITAL';
      const ids = o.ids || {};

      return (
        '<div class="kpi-cards-grid--compact">' +
          '<div class="kpi-card card-cuota-plazo">' +
            '<div class="kpi-card-header"><span class="kpi-label">MONTO DE LA CUOTA</span><span class="kpi-badge"' + (ids.cuotaBadge ? ' id="' + ids.cuotaBadge + '"' : '') + '>' + cuotas + ' cuotas fijas</span></div>' +
            '<div class="kpi-value tabular-nums"' + (ids.cuotaVal ? ' id="' + ids.cuotaVal + '"' : '') + '>' + formatMoney(cuotaVal) + '</div>' +
          '</div>' +
          '<div class="kpi-card card-neto">' +
            '<div class="kpi-card-header"><span class="kpi-label">MONTO A ENTREGAR</span><span class="kpi-badge">Neto</span></div>' +
            '<div class="kpi-value tabular-nums"' + (ids.netoVal ? ' id="' + ids.netoVal + '"' : '') + '>' + formatMoney(monto) + '</div>' +
          '</div>' +
          '<div class="kpi-card card-total">' +
            '<div class="kpi-card-header"><span class="kpi-label"' + (ids.totalLabel ? ' id="' + ids.totalLabel + '"' : '') + '>' + totalLabel + '</span><span class="kpi-badge"' + (ids.totalBadge ? ' id="' + ids.totalBadge + '"' : '') + '>' + totalBadge + '</span></div>' +
            '<div class="kpi-value tabular-nums"' + (ids.totalVal ? ' id="' + ids.totalVal + '"' : '') + '>' + formatMoney(totalVal) + '</div>' +
          '</div>' +
          '<div class="kpi-card card-capital">' +
            '<div class="kpi-card-header"><span class="kpi-label"' + (ids.capitalLabel ? ' id="' + ids.capitalLabel + '"' : '') + '>' + capLabel + '</span><span class="kpi-badge">Capital Computable</span></div>' +
            '<div class="kpi-value tabular-nums"' + (ids.capitalVal ? ' id="' + ids.capitalVal + '"' : '') + '>' + formatMoney(capitalVal) + '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function recalcularOfertaCuotaModal() {
      const linea = _normalizarLineaKeyOferta(document.getElementById('propLinea')?.value || 'fedem');
      const modo = document.getElementById('propModoSim')?.value === 'cuota' ? 'cuota' : 'neto';
      const montoParsed = parseFloat(document.getElementById('propMonto')?.value);
      const inputVal = (Number.isFinite(montoParsed) && montoParsed > 0) ? montoParsed : 0;
      const plazo = parseInt(document.getElementById('propPlazo')?.value, 10) || 12;
      const sim = (inputVal > 0) ? calculateSimulation(linea, plazo, modo, inputVal) : null;
      const neto = sim ? sim.neto : (modo === 'neto' ? inputVal : 0);
      const cuota = sim ? sim.cuota : (modo === 'cuota' ? inputVal : 0);
      const total = sim ? sim.totalAyuda : 0;
      const capital = sim ? sim.capital : 0;

      const lbl = document.getElementById('propMontoLabel');
      if (lbl) lbl.textContent = modo === 'cuota' ? 'Monto de Cuota Deseada ($)' : 'Monto Neto Ofrecido ($)';

      const inp = document.getElementById('propCuotaEst');
      if (inp) inp.value = modo === 'cuota' ? ('Neto: ' + formatMoney(neto)) : formatMoney(cuota);

      const propMontoEl = document.getElementById('propMonto');
      if (propMontoEl) propMontoEl.dataset.netoCalculado = String(Math.round(neto));

      const tasaEl = document.getElementById('propTasaCostoTexto');
      if (tasaEl) tasaEl.textContent = obtenerTasaCostoTexto(linea, plazo);

      const isMuniOrSide = (linea === 'muni' || linea === 'sidecreer');
      const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setTxt('propKpiCuotaBadge', plazo + ' cuotas fijas');
      setTxt('propKpiCuotaVal', formatMoney(cuota));
      setTxt('propKpiNetoVal', formatMoney(neto));
      setTxt('propKpiTotalLabel', isMuniOrSide ? 'TOTAL A PAGAR' : 'TOTAL AYUDA ECONÓMICA');
      setTxt('propKpiTotalBadge', (linea === 'sidecreer') ? 'Importe ($) en Sidecreer' : 'Total a Devolver');
      setTxt('propKpiTotalVal', formatMoney(total));
      setTxt('propKpiCapitalLabel', isMuniOrSide ? 'IMPORTE SOLICITADO' : 'CAPITAL');
      setTxt('propKpiCapitalVal', formatMoney(capital));

      recalcularRefinanciacion();
    }

    async function guardarPropuestaMutual(e, id) {
      e.preventDefault();
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const session = getSession();

      const linea = _normalizarLineaKeyOferta(document.getElementById('propLinea').value);
      const modoSim = document.getElementById('propModoSim')?.value === 'cuota' ? 'cuota' : 'neto';
      const inputValor = parseFloat(document.getElementById('propMonto').value);
      const plazo = parseInt(document.getElementById('propPlazo').value, 10) || 12;
      if (!Number.isFinite(inputValor) || inputValor <= 0) {
        showToast('⚠️ Ingresá un importe válido mayor a $ 0 para la propuesta.');
        return;
      }
      const sim = calculateSimulation(linea, plazo, modoSim, inputValor);
      if (!sim) {
        showToast('⚠️ El plazo de ' + plazo + ' cuotas no está habilitado para la línea seleccionada.');
        return;
      }
      const monto = Number((sim.neto || 0).toFixed(2));
      const cuota = Number((sim.cuota || 0).toFixed(2));
      const totalAPagar = Number((sim.totalAyuda || (cuota * plazo)).toFixed(2));
      const capitalComputable = Number((sim.capital || 0).toFixed(2));
      const tasaCosto = obtenerTasaCostoTexto(linea, plazo);
      const est = document.getElementById('propEstado').value;
      const detalle = sanitizeHTML(document.getElementById('propDetalle').value.trim());

      const esRef = document.getElementById('propEsRefinanciacion')?.checked || false;
      let refinanciacion = null;
      if (esRef) {
        const ayudas = sanitizeHTML(document.getElementById('propAyudasCancelar')?.value.trim() || '');
        const deuda = parseFloat(document.getElementById('propDeudaPrevia')?.value) || 0;
        const bolsillo = Math.max(0, monto - deuda);
        const cuotaAnt = parseFloat(document.getElementById('propCuotaAnterior')?.value) || 0;
        const alivio = cuotaAnt > 0 ? (cuotaAnt - cuota) : 0;
        const refNotas = sanitizeHTML(document.getElementById('propRefinanciacionNotas')?.value.trim() || '');

        refinanciacion = {
          ayudasACancelar: ayudas,
          montoDeudaPrevia: deuda,
          montoBolsillo: bolsillo,
          cuotaAnterior: cuotaAnt,
          nuevaCuota: cuota,
          alivioMensual: alivio,
          observaciones: refNotas
        };
      }

      if (!s.historialPropuestas) s.historialPropuestas = [];

      // Calcular diferencia respecto a la versión anterior
      const prev = s.propuestaMutual && s.propuestaMutual.activa ? s.propuestaMutual : (s.historialPropuestas.length > 0 ? s.historialPropuestas[s.historialPropuestas.length - 1] : null);
      let diffTexto = 'Versión inicial registrada';
      if (prev) {
        const diffM = monto - (prev.monto || 0);
        const diffP = plazo - (prev.cuotas || 0);
        const diffC = cuota - (prev.cuotaEstimada || 0);
        const partes = [];

        if (diffM > 0) partes.push('+' + formatMoney(diffM) + ' capital');
        else if (diffM < 0) partes.push('-' + formatMoney(Math.abs(diffM)) + ' capital');
        else partes.push('Mismo capital');

        if (diffP > 0) partes.push('+' + diffP + ' cuotas');
        else if (diffP < 0) partes.push(diffP + ' cuotas');

        if (diffC < 0) partes.push('Alivio de cuota: ' + formatMoney(Math.abs(diffC)) + '/mes');
        else if (diffC > 0) partes.push('Variación cuota: +' + formatMoney(diffC) + '/mes');

        if (esRef && !prev.esRefinanciacion) partes.push('Se incorporó refinanciación de deuda previa');
        diffTexto = partes.join(', ');
      }

      const nextVersion = (s.historialPropuestas.length > 0 ? Math.max(...s.historialPropuestas.map(v => v.version || 1)) : 0) + 1;
      const now = obtenerFechaHora24hs();

      const nuevaProp = {
        version: nextVersion,
        activa: true,
        modoSimulacion: modoSim,
        linea: linea,
        lineaNombre: FINANCIAL_DATA[linea].name,
        monto: monto,
        cuotas: plazo,
        cuotaEstimada: cuota,
        totalAPagar: totalAPagar,
        capitalComputable: capitalComputable,
        tasaCosto: tasaCosto,
        estadoPropuesta: est,
        detalle: detalle,
        esRefinanciacion: esRef,
        refinanciacion: refinanciacion,
        fecha: now,
        analista: session?.nombre || 'Analista Mutual',
        diferenciaTexto: diffTexto
      };

      s.propuestaMutual = nuevaProp;
      s.historialPropuestas.push(nuevaProp);

      let textoObs = '💼 Oferta oficial (v' + nextVersion + ') registrada: ' + formatMoney(monto) + ' en ' + plazo + ' cuotas de ' + formatMoney(cuota) + ' (' + est + ').';
      if (esRef && refinanciacion) {
        textoObs += ' [Refinanciación: Cancela ' + formatMoney(refinanciacion.montoDeudaPrevia) + ' | Bolsillo: ' + formatMoney(refinanciacion.montoBolsillo) + ']';
      }
      if (detalle) textoObs += ' Nota: ' + detalle;

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: session?.nombre || 'Analista Mutual',
        rol: 'Analista Mutual',
        fecha: now,
        texto: textoObs
      });

      saveStoredSolicitudes(all);
      callApi({ action: 'guardarPropuestaMutual', id: s.id, propuesta: s.propuestaMutual, historial: s.historialPropuestas }).catch(console.warn);

      showToast('Propuesta v' + nextVersion + ' registrada con éxito en el expediente 💼');
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(id);
    }

    function _armarTextoPropuestaWhatsApp(s, p) {
      let texto = `¡Hola ${s.solicitante.nombre}! 👋 Desde Mutual Modelo te informamos que hemos analizado tu legajo crediticio:

📋 *Propuesta Oficial de Ayuda Económica (Versión v${p.version || 1}):*
• Monto Otorgado: *${formatMoney(p.monto)}*
• Línea: ${p.lineaNombre || p.linea}
• Plan de Pago: *${p.cuotas} cuotas fijas de ${formatMoney(p.cuotaEstimada)}*
• Costo Financiero: ${p.tasaCosto || 'Tasas oficiales vigentes'}`;

      if (p.esRefinanciacion && p.refinanciacion) {
        const ref = p.refinanciacion;
        texto += `\n\n🔄 *Detalle de Refinanciación / Cancelación de Ayudas:*
• Créditos Previos a Cancelar: ${ref.ayudasACancelar || 'Deudas previas'}
• Deuda Previa Total Absorbida: *${formatMoney(ref.montoDeudaPrevia || 0)}*
• Dinero Limpio a Cobrar en Cuenta (Bolsillo): *${formatMoney(ref.montoBolsillo || 0)}*
• Impacto en Cuota Mensual: Venías abonando *${formatMoney(ref.cuotaAnterior || 0)}* y tu nueva cuota será de *${formatMoney(p.cuotaEstimada)}*.`;

        if (ref.alivioMensual > 0) {
          texto += `\n🎉 *Alivio financiero:* Liberás *${formatMoney(ref.alivioMensual)}* de afectación mensual en tu recibo de haberes.`;
        }
      }

      if (p.detalle) {
        texto += `\n• Observaciones: ${p.detalle}`;
      }

      texto += `\n\n📲 Respondé a este mensaje para coordinar la firma y acreditación bancaria inmediata.`;
      return texto;
    }

    function _resolverPropuestaParaWhatsApp(id, versionNum) {
      const s = getStoredSolicitudes().find(x => String(x.id) === String(id));
      if (!s) return null;
      let p = s.propuestaMutual;
      if (versionNum !== undefined && versionNum !== null && s.historialPropuestas) {
        const vMatch = s.historialPropuestas.find(v => Number(v.version) === Number(versionNum));
        if (vMatch) p = vMatch;
      }
      if (!p || !p.activa) return { s, p: null };
      return { s, p };
    }

    function copiarPropuestaWhatsApp(id, versionNum) {
      const res = _resolverPropuestaParaWhatsApp(id, versionNum);
      if (!res) return;
      if (!res.p) {
        showToast('No hay una propuesta activa para copiar ⚠️');
        return;
      }
      const texto = _armarTextoPropuestaWhatsApp(res.s, res.p);
      navigator.clipboard.writeText(texto).then(() => {
        showToast('Propuesta ' + (res.p.version ? ('v' + res.p.version + ' ') : '') + 'copiada para WhatsApp 📋');
      }).catch(() => {
        showToast('Propuesta copiada 📋');
      });
    }

    function enviarPropuestaWhatsAppPorBot(id, versionNum) {
      if (typeof tieneAccesoBotWhatsapp === 'function' && !tieneAccesoBotWhatsapp()) {
        showToast('⛔ Acceso restringido: el envío por Bot solo está habilitado para rol Admin y Analista.', 'warning');
        return;
      }
      const res = _resolverPropuestaParaWhatsApp(id, versionNum);
      if (!res) return;
      if (!res.p) {
        showToast('No hay una propuesta activa para enviar ⚠️');
        return;
      }
      const texto = _armarTextoPropuestaWhatsApp(res.s, res.p);
      const tel = String(res.s?.solicitante?.telefono || '').trim();
      const telPrompt = tel || String(window.prompt('Ingresá el número de WhatsApp destino (ej: 3435123456):', '') || '').trim();
      if (!telPrompt || telPrompt.replace(/\D/g, '').length < 8) {
        showToast('⚠️ No hay un número de WhatsApp válido en el expediente.', 'warning');
        return;
      }
      const fallbackWa = () => {
        const clean = telPrompt.replace(/\D/g, '');
        const waNum = clean.startsWith('54') ? clean : ('549' + clean.replace(/^0+/, ''));
        window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
      };
      if (typeof window.enviarMensajeViaBotAmmerConFallback === 'function') {
        window.enviarMensajeViaBotAmmerConFallback(telPrompt, texto, fallbackWa);
      } else {
        fallbackWa();
      }
    }

    /* VISOR DOCUMENTAL ONLINE IN-APP (SIN SALIR DEL LEGAJO DIGITAL) */
    let visorZoom = 1.0;
    let visorRotation = 0;

    function aplicarTransformVisor() {
      const img = document.getElementById('visorImageEl');
      const lbl = document.getElementById('visorZoomLevel');
      if (img) {
        img.style.transform = 'scale(' + visorZoom + ') rotate(' + visorRotation + 'deg)';
      }
      if (lbl) {
        lbl.textContent = Math.round(visorZoom * 100) + '%';
      }
    }

    function ajustarZoomVisor(delta) {
      visorZoom = Math.max(0.4, Math.min(3.5, visorZoom + delta));
      aplicarTransformVisor();
    }

    function rotarImagenVisor() {
      visorRotation = (visorRotation + 90) % 360;
      aplicarTransformVisor();
    }

    function resetearTransformVisor() {
      visorZoom = 1.0;
      visorRotation = 0;
      aplicarTransformVisor();
    }

    let _visorActiveObjectUrl = null;

    function limpiarObjectUrlVisor() {
      if (_visorActiveObjectUrl) {
        try { URL.revokeObjectURL(_visorActiveObjectUrl); } catch (e) { /* noop */ }
        _visorActiveObjectUrl = null;
      }
    }

    function registrarObjectUrlVisor(url) {
      _visorActiveObjectUrl = url || null;
    }

    function cerrarVisorDocumento() {
      resetearTransformVisor();
      limpiarObjectUrlVisor();
      const wrap = document.getElementById('docViewerContent');
      if (wrap) wrap.innerHTML = '';
      cerrarModal('modalVisorDocumento');
    }

    function normalizarUrlVisorDrive(url) {
      if (!url || typeof url !== 'string') return '';
      const raw = url.trim();
      if (!raw || raw === 'undefined' || raw === 'null' || raw === '#' || raw === 'about:blank') return '';
      if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;

      const match = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    raw.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                    raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return 'https://drive.google.com/file/d/' + match[1] + '/preview';
      }
      if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) {
        return 'https://drive.google.com/file/d/' + raw + '/preview';
      }
      if (/^https:\/\//i.test(raw)) {
        return raw;
      }
      return '';
    }

    function extraerDrivePreviewUrl(raw) {
      return normalizarUrlVisorDrive(raw);
    }

    function base64ToPdfObjectUrl(rawData) {
      if (!rawData || typeof rawData !== 'string') return '';
      try {
        let pureBase64 = rawData.trim();
        if (pureBase64.includes(',')) {
          pureBase64 = pureBase64.split(',')[1] || '';
        }
        pureBase64 = pureBase64.replace(/\s+/g, '');
        if (!pureBase64) return '';
        const binStr = atob(pureBase64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const objUrl = URL.createObjectURL(blob);
        registrarObjectUrlVisor(objUrl);
        return objUrl;
      } catch (err) {
        console.warn('Conversión Blob PDF fallback:', err);
        if (rawData.startsWith('data:application/pdf;base64,')) return rawData;
        return '';
      }
    }

    function extraerFileIdDrive_(docObj, rawUrl) {
      if (docObj && docObj.fileId && /^[a-zA-Z0-9_-]{10,120}$/.test(String(docObj.fileId).trim())) {
        return String(docObj.fileId).trim();
      }
      const s = String(rawUrl || '').trim();
      const m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                s.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) return m[1];
      if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
      return '';
    }

    async function cargarPdfJsSiHaceFalta_() {
      if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') {
        return window.pdfjsLib;
      }
      if (!window._ammerPdfJsPromise) {
        window._ammerPdfJsPromise = new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.integrity = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
          s.crossOrigin = 'anonymous';
          s.onload = () => {
            try {
              if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              }
              resolve(window.pdfjsLib || null);
            } catch (_) {
              resolve(null);
            }
          };
          s.onerror = () => resolve(null);
          document.head.appendChild(s);
        });
      }
      return window._ammerPdfJsPromise;
    }

    async function renderizarPdfEnVisor_(wrap, pdfUrl, nombreDoc, pdfBlob = null) {
      if (!wrap || !pdfUrl) return;
      const safeName = sanitizeHTML(nombreDoc || 'Documento.pdf');
      const safeUrl = sanitizeHTML(pdfUrl);

      let tieneFirmaPdf = false;
      try {
        const b = pdfBlob || (pdfUrl.startsWith('blob:') ? await fetch(pdfUrl).then(r => r.blob()) : null);
        if (b && b.size >= 5) {
          const headTxt = await b.slice(0, 16).text();
          tieneFirmaPdf = headTxt.includes('%PDF-');
        }
      } catch (_) {}

      const fallbackIframeHtml = tieneFirmaPdf
        ? '<iframe src="' + safeUrl + '" class="doc-viewer-frame" title="' + safeName + '"></iframe>'
        : '<iframe src="' + safeUrl + '" class="doc-viewer-frame" sandbox="allow-downloads" title="' + safeName + '"></iframe>';

      try {
        const pdfjs = await cargarPdfJsSiHaceFalta_();
        if (!pdfjs) {
          wrap.innerHTML = fallbackIframeHtml;
          return;
        }
        const ab = pdfBlob ? await pdfBlob.arrayBuffer() : await fetch(pdfUrl).then(r => r.arrayBuffer());
        const doc = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
        const numPages = doc.numPages || 1;

        wrap.innerHTML =
          '<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#1e293b;border-radius:10px;overflow:hidden;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#0f172a;color:#e2e8f0;font-size:12px;border-bottom:1px solid rgba(148,163,184,0.2);">' +
              '<span>📄 <strong>' + safeName + '</strong> • ' + numPages + (numPages === 1 ? ' página' : ' páginas') + '</span>' +
              '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;font-weight:600;">↗ Abrir en pestaña nueva</a>' +
            '</div>' +
            '<div id="pdfJsPagesContainer" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;align-items:center;gap:12px;"></div>' +
          '</div>';

        const pagesBox = wrap.querySelector('#pdfJsPagesContainer');
        if (!pagesBox) return;

        for (let pNum = 1; pNum <= numPages; pNum++) {
          if (!document.body.contains(pagesBox)) return;
          const page = await doc.getPage(pNum);
          const baseVp = page.getViewport({ scale: 1.0 });
          const targetWidth = Math.min(860, Math.max(320, (wrap.clientWidth || 760) - 44));
          const scale = targetWidth / (baseVp.width || 600);
          const vp = page.getViewport({ scale: Math.min(2.0, Math.max(1.1, scale)) });
          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(vp.width * dpr);
          canvas.height = Math.floor(vp.height * dpr);
          canvas.style.width = Math.floor(vp.width) + 'px';
          canvas.style.height = 'auto';
          canvas.style.maxWidth = '100%';
          canvas.style.background = '#ffffff';
          canvas.style.borderRadius = '6px';
          canvas.style.boxShadow = '0 4px 18px rgba(0,0,0,0.35)';

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            pagesBox.appendChild(canvas);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
          }
        }
      } catch (errPdf) {
        console.warn('Fallback de visor PDF nativo tras error PDF.js:', errPdf);
        wrap.innerHTML = fallbackIframeHtml;
      }
    }

    async function cargarBlobUrlDriveAutenticado_(fileId, downloadMode = false) {
      if (!fileId || !RENDER_API_URL || RENDER_API_URL.includes('[TU_API]') || typeof getApiAuthToken !== 'function' || !getApiAuthToken()) {
        return null;
      }
      const url = `${RENDER_API_URL}/api/drive/archivo/${encodeURIComponent(fileId)}${downloadMode ? '?download=true' : ''}`;
      const resp = await fetchConTimeout(url, { method: 'GET' }, 45000);
      if (!resp || !resp.ok) return null;
      const blob = await resp.blob();
      if (!blob || blob.size === 0) return null;
      const objUrl = URL.createObjectURL(blob);
      registrarObjectUrlVisor(objUrl);
      return { objUrl, mime: String(blob.type || '').toLowerCase(), blob };
    }

    function renderizarDocumento(docObj, expedienteLabel, solicitudId, adjuntoIndex) {
      const wrap = document.getElementById('docViewerContent');
      const toolbar = document.getElementById('visorImageToolbar');
      const nomEl = document.getElementById('visorDocNombre');
      const btnDescargar = document.getElementById('btnVisorDescargar');
      if (!wrap) return;

      limpiarObjectUrlVisor();
      resetearTransformVisor();

      const nombreDoc = (docObj && docObj.nombre) ? docObj.nombre : 'Comprobante Digital';
      if (nomEl) nomEl.textContent = nombreDoc;

      if (btnDescargar && solicitudId !== undefined && adjuntoIndex !== undefined) {
        btnDescargar.onclick = (e) => {
          e.preventDefault();
          descargarDocumentoOnline(solicitudId, adjuntoIndex);
        };
      }

      const rawBase64 = (docObj && (docObj.dataUrl || docObj.base64)) ? String(docObj.dataUrl || docObj.base64).trim() : '';
      const rawUrlDrive = (docObj && (docObj.urlDrive || docObj.url || docObj.previewUrl)) ? String(docObj.urlDrive || docObj.url || docObj.previewUrl).trim() : '';
      const mime = (docObj && (docObj.tipoMime || docObj.mimeType)) ? String(docObj.tipoMime || docObj.mimeType).toLowerCase() : '';

      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(nombreDoc) ||
                      mime.startsWith('image/') ||
                      rawBase64.startsWith('data:image/');

      // 1. Imagen en Base64 / DataURL
      if (rawBase64 && isImage) {
        const imgSrc = rawBase64.startsWith('data:') ? rawBase64 : ('data:' + (mime || 'image/jpeg') + ';base64,' + rawBase64);
        if (toolbar) toolbar.style.display = 'flex';
        wrap.innerHTML = '<div class="doc-viewer-img-container"><img id="visorImageEl" src="' + sanitizeHTML(imgSrc) + '" class="doc-viewer-img" alt="' + sanitizeHTML(nombreDoc) + '"/></div>';
        return;
      }

      // 2. PDF / Documento en Base64 -> renderizar con PDF.js (Desktop y Móvil)
      if (rawBase64 && !isImage) {
        if (toolbar) toolbar.style.display = 'none';
        const pdfBlobUrl = base64ToPdfObjectUrl(rawBase64);
        if (pdfBlobUrl) {
          renderizarPdfEnVisor_(wrap, pdfBlobUrl, nombreDoc);
          return;
        }
      }

      // 3. Archivo de Google Drive: intentar proxy autenticado privado primero, con fallback a visor Drive
      const fileIdDrive = extraerFileIdDrive_(docObj, rawUrlDrive);
      const previewUrl = normalizarUrlVisorDrive(rawUrlDrive);
      if (fileIdDrive && RENDER_API_URL && !RENDER_API_URL.includes('[TU_API]') && typeof getApiAuthToken === 'function' && getApiAuthToken()) {
        if (toolbar) toolbar.style.display = 'none';
        wrap.innerHTML = '<div class="doc-viewer-empty-state"><div style="font-size:2rem;margin-bottom:0.5rem;">🔒⏳</div><p style="font-size:0.86rem;color:var(--text-muted);">Descargando comprobante protegido desde bóveda privada AMMER...</p></div>';
        cargarBlobUrlDriveAutenticado_(fileIdDrive, false).then((resProxy) => {
          if (resProxy && resProxy.objUrl) {
            if (resProxy.mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(nombreDoc)) {
              if (toolbar) toolbar.style.display = 'flex';
              wrap.innerHTML = '<div class="doc-viewer-img-container"><img id="visorImageEl" src="' + sanitizeHTML(resProxy.objUrl) + '" class="doc-viewer-img" alt="' + sanitizeHTML(nombreDoc) + '"/></div>';
            } else if (resProxy.mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(nombreDoc)) {
              if (toolbar) toolbar.style.display = 'none';
              wrap.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#020617;border-radius:10px;overflow:hidden;"><video src="' + sanitizeHTML(resProxy.objUrl) + '" controls playsinline style="width:100%;height:100%;max-height:74vh;background:#020617;"></video></div>';
            } else if (resProxy.mime.includes('pdf') || /\.pdf$/i.test(nombreDoc)) {
              if (toolbar) toolbar.style.display = 'none';
              renderizarPdfEnVisor_(wrap, resProxy.objUrl, nombreDoc, resProxy.blob || null);
            } else {
              if (toolbar) toolbar.style.display = 'none';
              wrap.innerHTML = '<iframe src="' + sanitizeHTML(resProxy.objUrl) + '" class="doc-viewer-frame" sandbox="allow-downloads" title="' + sanitizeHTML(nombreDoc) + '"></iframe>';
            }
            return;
          }
          if (previewUrl) {
            wrap.innerHTML = '<iframe src="' + sanitizeHTML(previewUrl) + '" class="doc-viewer-frame" allow="storage-access; autoplay" referrerpolicy="no-referrer" title="' + sanitizeHTML(nombreDoc) + '"></iframe>';
          }
        }).catch(() => {
          if (previewUrl) {
            wrap.innerHTML = '<iframe src="' + sanitizeHTML(previewUrl) + '" class="doc-viewer-frame" allow="autoplay" referrerpolicy="no-referrer" title="' + sanitizeHTML(nombreDoc) + '"></iframe>';
          }
        });
        return;
      }

      if (previewUrl) {
        if (toolbar) toolbar.style.display = 'none';
        wrap.innerHTML = '<iframe src="' + sanitizeHTML(previewUrl) + '" class="doc-viewer-frame" allow="autoplay" referrerpolicy="no-referrer" title="' + sanitizeHTML(nombreDoc) + '"></iframe>';
        return;
      }

      // 4. Estado limpio sin iframe vacío (Cero violaciones CSP)
      if (toolbar) toolbar.style.display = 'none';
      const iconoDoc = isImage ? '🖼️' : '📄';
      wrap.innerHTML = '<div class="doc-viewer-empty-state">' +
        '<div style="font-size:3.2rem;margin-bottom:0.65rem;">' + iconoDoc + '</div>' +
        '<h3 style="font-size:1.08rem;color:var(--color-primary);font-weight:800;margin-bottom:0.35rem;">Comprobante pendiente de digitalización</h3>' +
        '<div style="display:inline-block;background:#eff6ff;color:#1d4ed8;font-size:0.73rem;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:0.85rem;border:1px solid #bfdbfe;">' +
          sanitizeHTML((docObj && docObj.tipo) || 'DOCUMENTACIÓN') + ' • ' + sanitizeHTML(nombreDoc) +
        '</div>' +
        '<p style="font-size:0.78rem;color:var(--text-muted);line-height:1.55;margin-bottom:1.25rem;">' +
          'El registro documental figura asociado al expediente <strong>' + sanitizeHTML(expedienteLabel || 'AMMER') + '</strong>, pero aún no cuenta con un archivo binario o enlace de vista previa sincronizado.' +
        '</p>' +
        '<div style="display:flex;justify-content:center;gap:0.5rem;">' +
          '<button type="button" class="btn-restore" onclick="cerrarVisorDocumento()">Cerrar Visor</button>' +
        '</div>' +
      '</div>';
    }

    function abrirVisorOnline(solicitudId, adjuntoIndex) {
      const s = getStoredSolicitudes().find(x => String(x.id) === String(solicitudId));
      if (!s) return;
      const listaArchivos = normalizarListaArchivos(s);
      const adj = listaArchivos[adjuntoIndex];
      if (!adj) {
        renderizarDocumento({ nombre: 'Sin archivo', tipo: 'Legajo' }, s.id_definitivo || s.id_provisorio || s.id);
        abrirModal('modalVisorDocumento');
        return;
      }
      renderizarDocumento(adj, s.id_definitivo || s.id_provisorio || s.id, solicitudId, adjuntoIndex);
      abrirModal('modalVisorDocumento');
    }

    const abrirVisorDocumental = abrirVisorOnline;

    async function descargarDocumentoOnline(solicitudId, adjuntoIndex) {
      const s = getStoredSolicitudes().find(x => String(x.id) === String(solicitudId)); if (!s) return;
      const listaArchivos = normalizarListaArchivos(s);
      const adj = listaArchivos[adjuntoIndex]; if (!adj) return;
      if (adj.dataUrl) {
        const a = document.createElement('a');
        a.href = adj.dataUrl;
        a.download = adj.nombre || 'documento';
        a.click();
        return;
      }
      const fileId = extraerFileIdDrive_(adj, adj.urlDrive || adj.previewUrl);
      if (fileId && RENDER_API_URL && !RENDER_API_URL.includes('[TU_API]') && typeof getApiAuthToken === 'function' && getApiAuthToken()) {
        try {
          const resProxy = await cargarBlobUrlDriveAutenticado_(fileId, true);
          if (resProxy && resProxy.objUrl) {
            const a = document.createElement('a');
            a.href = resProxy.objUrl;
            a.download = adj.nombre || ('documento_' + fileId);
            a.click();
            return;
          }
        } catch (_) {}
      }
      if (adj.fileId || adj.urlDrive || adj.previewUrl) {
        const dlUrl = fileId ? ('https://drive.google.com/uc?export=download&id=' + fileId) : (adj.urlDrive || normalizarUrlVisorDrive(adj.previewUrl));
        if (dlUrl) {
          const a = document.createElement('a');
          a.href = dlUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
        } else {
          showToast('Comprobante pendiente de digitalización.');
        }
      } else {
        showToast('Comprobante pendiente de digitalización.');
      }
    }

    /* --- REQUERIMIENTOS E INTERACCIÓN DOCUMENTAL ENTRE SEDE CENTRAL Y COMERCIALIZADORES --- */
    function abrirPanelObservarDocumento(solicitudId, adjIdx) {
      const panel = document.getElementById('panelRequerirDocFicha');
      const hidIdx = document.getElementById('hidReqAdjIdx');
      const cboTipo = document.getElementById('cboReqDocTipo');
      const txtMotivo = document.getElementById('txtReqDocMotivo');
      if (!panel) return;

      panel.style.display = 'block';
      if (hidIdx) hidIdx.value = String(typeof adjIdx === 'number' ? adjIdx : -1);

      const s = getStoredSolicitudes().find(x => String(x.id) === String(solicitudId));
      if (s && typeof adjIdx === 'number' && adjIdx >= 0 && s.adjuntos && s.adjuntos[adjIdx]) {
        const adj = s.adjuntos[adjIdx];
        if (cboTipo && adj.tipo) {
          const exists = Array.from(cboTipo.options).some(opt => opt.value === adj.tipo);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = adj.tipo;
            opt.textContent = adj.tipo;
            cboTipo.appendChild(opt);
          }
          cboTipo.value = adj.tipo;
        }
        if (txtMotivo) {
          txtMotivo.value = adj.motivoObservacion || '';
        }
      } else if (txtMotivo) {
        txtMotivo.value = '';
      }

      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (txtMotivo) setTimeout(() => txtMotivo.focus(), 120);
    }

    function cerrarPanelObservarDocumento() {
      const panel = document.getElementById('panelRequerirDocFicha');
      if (panel) panel.style.display = 'none';
    }

    function verificarSalidaEstadoObservado(s) {
      if (!s) return;
      const hayAdjObs = (s.adjuntos || []).some(a => Boolean(a.observado));
      const hayReqPend = (s.requerimientosDocumentales || []).some(r => !r.resuelto);
      if (!hayAdjObs && !hayReqPend && s.estado === 'Observado') {
        s.estado = 'En Análisis';
      }
    }

    async function confirmarRequerimientoDocumental(solicitudId) {
      const session = getSession();
      if (!session || (session.rol !== 'Admin' && session.rol !== 'Analista' && session.rol !== 'Asesor Mutual')) {
        showToast('Acción reservada a Sede Central.');
        return;
      }
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) return;

      const adjIdx = parseInt(document.getElementById('hidReqAdjIdx')?.value || '-1', 10);
      const tipoSel = document.getElementById('cboReqDocTipo')?.value || 'DOCUMENTACIÓN';
      const rawMotivo = document.getElementById('txtReqDocMotivo')?.value?.trim() || '';

      if (!rawMotivo) {
        showToast('⚠️ Indicá el motivo específico del documento requerido u observado.');
        const inp = document.getElementById('txtReqDocMotivo');
        if (inp) inp.focus();
        return;
      }

      const nowStr = obtenerFechaHora24hs();
      s.estado = 'Observado';

      if (adjIdx >= 0 && s.adjuntos && s.adjuntos[adjIdx]) {
        s.adjuntos[adjIdx].observado = true;
        s.adjuntos[adjIdx].motivoObservacion = rawMotivo;
        s.adjuntos[adjIdx].fechaObservacion = nowStr;
        s.adjuntos[adjIdx].autorObservacion = session.nombre;
      } else {
        if (!Array.isArray(s.requerimientosDocumentales)) s.requerimientosDocumentales = [];
        s.requerimientosDocumentales.push({
          id: 'req_' + Date.now(),
          tipo: tipoSel,
          motivo: rawMotivo,
          fecha: nowStr,
          autor: session.nombre,
          resuelto: false
        });
      }

      if (!s.observaciones) s.observaciones = [];
      const obsTexto = '⚠️ DOCUMENTACIÓN REQUERIDA POR SEDE CENTRAL [' + tipoSel + ']: ' + rawMotivo;
      s.observaciones.push({
        autor: session.nombre,
        rol: session.rol,
        fecha: nowStr,
        texto: obsTexto
      });

      saveStoredSolicitudes(all);

      callApi({
        action: 'actualizarEstado',
        id: s.id,
        estado: 'Observado',
        observacion: obsTexto,
        autor: session.nombre,
        rol: session.rol
      }).catch(console.warn);

      actualizarCentroNotificaciones();
      renderModuloMutual();
      renderModuloMutualPropias();
      renderModuloComercializador();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(solicitudId);
      showToast('⚠️ Documento requerido marcado y notificado al Comercializador');
    }

    async function subsanarRequerimientoDocumental(solicitudId, reqIdx, inputEl) {
      const file = inputEl && inputEl.files && inputEl.files[0];
      if (!file) return;
      const check = validarArchivoAdjunto(file);
      if (!check.valido) {
        showToast('⚠️ ' + check.error);
        inputEl.value = '';
        return;
      }

      const session = getSession();
      const operadorActual = obtenerNombreOperadorActivo();
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) return;

      const req = s.requerimientosDocumentales && s.requerimientosDocumentales[reqIdx];
      const tipo = req ? req.tipo : 'DOCUMENTO REQUERIDO';
      const nowStr = obtenerFechaHora24hs();

      mostrarCargando('Subsanando requerimiento documental...', 'Normalizando archivo a PDF A4...');
      let b64Data = null;
      try {
        b64Data = await fileToBase64(file);
      } catch (err) {
        ocultarCargando();
        showToast('⚠️ ' + (err.message || 'Error procesando archivo'));
        if (inputEl) inputEl.value = '';
        return;
      }
      const ext = 'PDF';
      const prefijoOficial = obtenerPrefijoOficialExpediente(s);
      const expDefinitivo = (s.idDefinitivoExpediente || s.ID_Definitivo_Expediente || s.id_definitivo || s.Nro_Definitivo || '').toString().trim();
      const generatedName = normalizarNombreArchivoDrive(prefijoOficial, tipo, ext);

      const resApi = await callApi({
        action: 'subirAdjuntoAdicional',
        id: s.id,
        idSolicitud: s.id,
        idDefinitivoExpediente: expDefinitivo,
        ID_Definitivo_Expediente: expDefinitivo,
        tipo: tipo,
        nombre: generatedName,
        base64: b64Data ? b64Data.base64 : '',
        tipoMime: 'application/pdf',
        usuarioOperador: operadorActual,
        cargadoPor: operadorActual,
        autor: operadorActual,
        rol: session?.rol || 'Comercializador'
      }, {
        title: '🔒 Subsanando requerimiento documental...',
        sub: 'Archivando ' + generatedName + ' en Legajo Digital'
      });

      const localItem = {
        tipo: tipo,
        nombre: generatedName,
        fecha: nowStr,
        cargadoPor: operadorActual,
        autor: operadorActual,
        dataUrl: b64Data ? b64Data.dataUrl : '',
        tipoMime: 'application/pdf',
        fileId: '',
        urlDrive: '',
        previewUrl: '',
        observado: false
      };
      const listaSync = sincronizarAdjuntosSolicitudLocal(s, resApi, localItem);
      const docSubido = (resApi && resApi.data && resApi.data.archivoSubido) ||
        (listaSync.length > 0 ? listaSync[listaSync.length - 1] : localItem);
      const nombreFinal = (docSubido && docSubido.nombre) || generatedName;

      if (req) {
        req.resuelto = true;
        req.fechaResolucion = nowStr;
      }

      verificarSalidaEstadoObservado(s);

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: operadorActual,
        rol: session?.rol || 'Comercializador',
        fecha: nowStr,
        texto: '✅ Subsanación documental completada: ' + tipo + ' (' + nombreFinal + ')'
      });

      saveStoredSolicitudes(all);
      if (inputEl) inputEl.value = '';

      ejecutarAuditoriaAutomaticaExpediente(s.id, b64Data ? [{ nombre: nombreFinal, mimeType: b64Data.tipoMime, base64: b64Data.base64 }] : null);

      actualizarCentroNotificaciones();
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(solicitudId);
      showToast('✅ Documentación requerida adjuntada como ' + nombreFinal);
    }

    async function reemplazarDocumentoExistente(solicitudId, adjuntoIndex, inputElement) {
      const file = inputElement.files && inputElement.files[0]; if (!file) return;
      const check = validarArchivoAdjunto(file);
      if (!check.valido) {
        showToast('⚠️ ' + check.error);
        inputElement.value = '';
        return;
      }

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId)); if (!s) return;
      const session = getSession();
      const operadorActual = obtenerNombreOperadorActivo();
      const nowStr = obtenerFechaHora24hs();
      const listaPrev = normalizarListaArchivos(s);
      const prevAdj = (s.adjuntos && s.adjuntos[adjuntoIndex]) || listaPrev[adjuntoIndex] || {};
      const prevTipo = prevAdj.tipo || 'DOCUMENTO';
      const estabaObservado = Boolean(prevAdj.observado);

      mostrarCargando('Reemplazando archivo en el legajo...', 'Normalizando a PDF A4 y actualizando legajo digital');
      let b64 = null;
      try {
        b64 = await fileToBase64(file);
      } catch(err) {
        console.warn(err);
        ocultarCargando();
        showToast('⚠️ ' + (err.message || 'Error procesando archivo'));
        if (inputElement) inputElement.value = '';
        return;
      }
      const ext = 'PDF';
      const prefijoOficial = obtenerPrefijoOficialExpediente(s);
      const expDefinitivo = (s.idDefinitivoExpediente || s.ID_Definitivo_Expediente || s.id_definitivo || s.Nro_Definitivo || '').toString().trim();
      const nuevoNombre = normalizarNombreArchivoDrive(prefijoOficial, prevTipo, ext);

      const resApi = await callApi({
        action: 'subirAdjuntoAdicional',
        id: s.id,
        idSolicitud: s.id,
        idDefinitivoExpediente: expDefinitivo,
        ID_Definitivo_Expediente: expDefinitivo,
        reemplazaIndice: adjuntoIndex,
        tipo: prevTipo,
        nombre: nuevoNombre,
        tipoMime: 'application/pdf',
        base64: b64 ? b64.base64 : '',
        usuarioOperador: operadorActual,
        cargadoPor: operadorActual,
        autor: operadorActual,
        rol: session?.rol || 'Comercializador'
      }, {
        title: '🔄 Actualizando documento en Legajo Digital...',
        sub: 'Guardando ' + nuevoNombre
      });

      const localItem = {
        tipo: prevTipo,
        nombre: nuevoNombre,
        fecha: nowStr,
        cargadoPor: operadorActual,
        autor: operadorActual,
        dataUrl: b64 ? b64.dataUrl : '',
        tipoMime: 'application/pdf',
        fileId: '',
        urlDrive: '',
        previewUrl: '',
        observado: false,
        motivoObservacion: ''
      };
      const listaSync = sincronizarAdjuntosSolicitudLocal(s, resApi, localItem, { reemplazaIndice: adjuntoIndex });
      const docReemplazado = (resApi && resApi.data && resApi.data.archivoSubido) ||
        (listaSync[adjuntoIndex]) || localItem;
      const nombreFinal = (docReemplazado && docReemplazado.nombre) || nuevoNombre;

      if (Array.isArray(s.requerimientosDocumentales)) {
        s.requerimientosDocumentales.forEach(r => {
          if (r.tipo === prevTipo) r.resuelto = true;
        });
      }
      verificarSalidaEstadoObservado(s);

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: operadorActual,
        rol: session?.rol || 'Comercializador',
        fecha: nowStr,
        texto: (estabaObservado ? '✅ Documento observado subsanado: ' : 'Documento reemplazado: ') + prevTipo + ' sustituido por ' + nombreFinal
      });

      saveStoredSolicitudes(all);
      if (inputElement) inputElement.value = '';
      // Disparo automático reactivo de Auditoría IA en segundo plano
      ejecutarAuditoriaAutomaticaExpediente(solicitudId, b64 ? [{ nombre: nombreFinal, mimeType: 'application/pdf', base64: b64.base64 }] : null);

      actualizarCentroNotificaciones();
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarContadorBoveda(s.id);
      showToast(estabaObservado ? '✅ Documento subsanado exitosamente como ' + nombreFinal : 'Documento sustituido exitosamente como ' + nombreFinal + ' 🔄');
      verFichaCompleta(solicitudId);
    }

    async function adjuntarDocumentoAdicionalFicha(id) {
      const session = getSession(); if (!session) return;
      const operadorActual = obtenerNombreOperadorActivo();
      const all = getStoredSolicitudes(); const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const tipo = document.getElementById('cboFichaDocTipo')?.value || 'Documento Adicional';
      const fileInput = document.getElementById('fileFichaAdicional');
      const file = fileInput?.files && fileInput.files[0];

      if (!file) {
        showToast('Por favor seleccione un archivo para subir al expediente');
        return;
      }

      const check = validarArchivoAdjunto(file);
      if (!check.valido) {
        showToast('⚠️ ' + check.error);
        fileInput.value = '';
        return;
      }

      const nowStr = obtenerFechaHora24hs();

      mostrarCargando('Normalizando y subiendo archivo...', 'Preparando documento PDF A4 para el Legajo Digital');
      let b64Data = null;
      try {
        b64Data = await fileToBase64(file);
      } catch (err) {
        console.warn(err);
        ocultarCargando();
        showToast('⚠️ ' + (err.message || 'Error codificando archivo'));
        if (fileInput) fileInput.value = '';
        return;
      }
      const extension = 'PDF';
      const prefijoOficial = obtenerPrefijoOficialExpediente(s);
      const expDefinitivo = (s.idDefinitivoExpediente || s.ID_Definitivo_Expediente || s.id_definitivo || s.Nro_Definitivo || '').toString().trim();
      const generatedName = normalizarNombreArchivoDrive(prefijoOficial, tipo, extension);

      const resApi = await callApi({
        action: 'subirAdjuntoAdicional',
        id: s.id,
        idSolicitud: s.id,
        idDefinitivoExpediente: expDefinitivo,
        ID_Definitivo_Expediente: expDefinitivo,
        tipo: tipo,
        nombre: generatedName,
        base64: b64Data ? b64Data.base64 : '',
        tipoMime: 'application/pdf',
        usuarioOperador: operadorActual,
        cargadoPor: operadorActual,
        autor: operadorActual,
        rol: session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor')
      }, {
        title: '🔒 Almacenando en Legajo Digital Seguro...',
        sub: 'Guardando ' + generatedName + ' en el expediente #' + prefijoOficial
      });

      const localItem = {
        tipo,
        nombre: generatedName,
        fecha: nowStr,
        cargadoPor: operadorActual,
        autor: operadorActual,
        dataUrl: b64Data ? b64Data.dataUrl : '',
        tipoMime: 'application/pdf',
        fileId: '',
        urlDrive: '',
        previewUrl: '',
        observado: false
      };
      const listaSync = sincronizarAdjuntosSolicitudLocal(s, resApi, localItem);
      const docSubido = (resApi && resApi.data && resApi.data.archivoSubido) ||
        (listaSync.length > 0 ? listaSync[listaSync.length - 1] : localItem);
      const nombreFinalGuardado = (docSubido && docSubido.nombre) || generatedName;

      if (Array.isArray(s.requerimientosDocumentales)) {
        s.requerimientosDocumentales.forEach(r => {
          if (r.tipo === tipo) r.resuelto = true;
        });
      }
      verificarSalidaEstadoObservado(s);

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: operadorActual,
        rol: session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor'),
        fecha: nowStr,
        texto: 'Documentación adicional adjuntada: ' + tipo + ' (' + nombreFinalGuardado + ')'
      });

      saveStoredSolicitudes(all);
      if (fileInput) fileInput.value = '';
      // Disparo automático reactivo de Auditoría IA en segundo plano
      ejecutarAuditoriaAutomaticaExpediente(s.id, b64Data ? [{ nombre: nombreFinalGuardado, mimeType: b64Data.tipoMime, base64: b64Data.base64 }] : null);

      actualizarCentroNotificaciones();
      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(id);
      showToast('Documento archivado exitosamente como ' + nombreFinalGuardado + ' 📄');
    }

    /* ========================================================================
       6.B CARGA POR LOTE Y DRAG & DROP EN EXPEDIENTES EXISTENTES (GESTIONES / RED / FICHA)
       ======================================================================== */
    window.__loteExpedienteState = {
      modal: { id: null, items: [] },
      ficha: { id: null, items: [] }
    };

    function obtenerOpcionesTipoDocLoteExpediente() {
      const base = [
        { value: 'DNI (FRENTE Y DORSO)', label: 'DNI (FRENTE Y DORSO)' },
        { value: 'RECIBO DE SUELDO', label: 'RECIBO DE SUELDO' },
        { value: 'SERVICIO', label: 'SERVICIO' },
        { value: 'CONSTANCIA DE CBU', label: 'CONSTANCIA DE CBU' },
        { value: 'CERTIFICADO SAGE', label: 'CERTIFICADO SAGE' },
        { value: 'COMPROBANTE DE MOVIMIENTOS BANCARIOS', label: 'COMPROBANTE DE MOVIMIENTOS BANCARIOS' },
        { value: 'CONTRATO DE SERVICIO', label: 'CONTRATO DE SERVICIO' },
        { value: 'NOTA DE SERVICIO OFICIAL', label: 'NOTA DE SERVICIO OFICIAL' },
        { value: 'TARJETA SIDECREER', label: 'TARJETA SIDECREER' },
        { value: 'OTROS DOCUMENTOS', label: 'OTROS DOCUMENTOS' }
      ];
      if (typeof esUsuarioRolMutualOAdmin === 'function' && esUsuarioRolMutualOAdmin()) {
        base.push(
          { value: 'TRANSFERENCIA', label: 'TRANSFERENCIA (Uso Interno)' },
          { value: 'SOLICITUD DE AYUDA ECONOMICA', label: 'SOLICITUD DE AYUDA ECONOMICA (Uso Interno)' },
          { value: 'AUTORIZACION PARA DESCUENTO DE HABERES', label: 'AUTORIZACION PARA DESCUENTO DE HABERES (Uso Interno)' }
        );
      }
      return base;
    }

    function resolverTipoCanonicoLoteExp(fileName, tipoForzado) {
      if (tipoForzado && String(tipoForzado).trim()) {
        return String(tipoForzado).trim();
      }
      if (typeof inferirTipoDocPorNombre === 'function') {
        const key = inferirTipoDocPorNombre(fileName);
        if (key && typeof MAPA_ID_TIPO_DOC === 'object' && MAPA_ID_TIPO_DOC[key]) {
          return MAPA_ID_TIPO_DOC[key];
        }
      }
      return 'OTROS DOCUMENTOS';
    }

    function poblarSelectTipoMasivoLoteExp(selectId) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      const opciones = obtenerOpcionesTipoDocLoteExpediente();
      sel.innerHTML = '<option value="">🏷️ Asignar mismo tipo a todos...</option>' +
        opciones.map(o => '<option value="' + sanitizeHTML(o.value) + '">' + sanitizeHTML(o.label) + '</option>').join('');
    }

    function abrirModalSubirLoteExpediente(idSolicitud, initialFilesOpt) {
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(idSolicitud));
      if (!s) {
        showToast('No se encontró el expediente seleccionado');
        return;
      }
      const idStr = String(s.id);
      const badgeEl = document.getElementById('lblLoteExpBadge');
      const infoEl = document.getElementById('lblLoteExpInfoCard');
      const prefijo = (typeof obtenerPrefijoOficialExpediente === 'function')
        ? obtenerPrefijoOficialExpediente(s)
        : (s.id_definitivo || s.id_provisorio || idStr);

      if (badgeEl) badgeEl.textContent = prefijo;
      if (infoEl) {
        infoEl.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">' +
            '<div>' +
              '<strong style="color:#0f172a;">' + sanitizeHTML(s.solicitante?.nombre || 'Sin nombre') + '</strong> · ' +
              '<span style="font-family:monospace;">DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + '</span> · ' +
              '<span>' + sanitizeHTML(s.solicitante?.organismo || '—') + '</span>' +
            '</div>' +
            '<span class="badge-status badge-' + (window.normalizarEstadoCanonico_ ? window.normalizarEstadoCanonico_(s.estado) : String(s.estado || 'Pendiente')).replace(/\s/g, '') + '">' + sanitizeHTML(window.normalizarEstadoCanonico_ ? window.normalizarEstadoCanonico_(s.estado) : (s.estado || 'Pendiente')) + '</span>' +
          '</div>' +
          '<div style="font-size:0.71rem;color:#64748b;margin-top:0.25rem;">Los archivos se renombrarán con el formato oficial <code>' + sanitizeHTML(prefijo) + ' [TIPO].PDF</code> en el Legajo Digital.</div>';
      }

      window.__loteExpedienteState.modal = { id: idStr, items: [] };
      const inp = document.getElementById('inpLoteExpedienteModal');
      if (inp) inp.value = '';
      poblarSelectTipoMasivoLoteExp('selLoteExpTipoMasivoModal');
      renderLoteExpediente('modal');
      abrirModal('modalSubirLoteExpediente');

      if (initialFilesOpt && initialFilesOpt.length > 0) {
        agregarArchivosLoteExpediente(initialFilesOpt, 'modal', idStr);
      }
    }

    function cerrarModalSubirLoteExpediente() {
      window.__loteExpedienteState.modal = { id: null, items: [] };
      const inp = document.getElementById('inpLoteExpedienteModal');
      if (inp) inp.value = '';
      renderLoteExpediente('modal');
      cerrarModal('modalSubirLoteExpediente');
    }

    function _esDragConArchivos(ev) {
      const types = ev?.dataTransfer?.types;
      if (!types) return false;
      return Array.from(types).includes('Files');
    }

    function handleDragOverExpedienteRow(ev, el) {
      if (!_esDragConArchivos(ev)) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      if (!el) return;
      if (el.tagName === 'TR') el.classList.add('row-drop-target-active');
      else el.classList.add('is-dragover');
    }

    function handleDragLeaveExpedienteRow(el, ev) {
      if (!el) return;
      if (ev && ev.relatedTarget && el.contains(ev.relatedTarget)) return;
      el.classList.remove('row-drop-target-active', 'is-dragover');
    }

    function handleDropEnExpedienteItem(ev, el, idSolicitud) {
      if (el) el.classList.remove('row-drop-target-active', 'is-dragover');
      const files = ev?.dataTransfer?.files;
      if (!files || files.length === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      abrirModalSubirLoteExpediente(idSolicitud, files);
    }

    function handleDropzoneLoteExpediente(ev, scope, idOpt) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.currentTarget) ev.currentTarget.classList.remove('is-dragover');
      const files = ev?.dataTransfer?.files;
      if (!files || files.length === 0) return;
      agregarArchivosLoteExpediente(files, scope, idOpt);
    }

    function agregarArchivosLoteExpediente(fileList, scope, idOpt, tipoForzadoOpt) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const state = window.__loteExpedienteState[key];
      if (!state) return;
      if (idOpt) state.id = String(idOpt);

      const files = Array.from(fileList || []);
      if (!files.length) return;

      let agregados = 0;
      let rechazados = 0;
      files.forEach(file => {
        const check = validarArchivoAdjunto(file);
        if (!check.valido) {
          rechazados++;
          showToast('⚠️ ' + file.name + ': ' + check.error);
          return;
        }
        state.items.push({
          file,
          tipo: resolverTipoCanonicoLoteExp(file.name, tipoForzadoOpt),
          iaDetectado: false,
          confianza: null
        });
        agregados++;
      });

      renderLoteExpediente(key);
      if (agregados > 0) {
        showToast('📦 ' + agregados + ' archivo(s) listos para subir al expediente' + (rechazados ? ' (' + rechazados + ' omitido/s)' : ''));
      }
    }

    function cambiarTipoLoteExpediente(scope, idx, tipo) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const item = window.__loteExpedienteState[key]?.items?.[idx];
      if (item) {
        item.tipo = tipo;
        item.iaDetectado = false;
        item.confianza = null;
      }
    }

    function aplicarTipoMasivoLoteExpediente(tipo, scope) {
      if (!tipo) return;
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const items = window.__loteExpedienteState[key]?.items || [];
      items.forEach(it => {
        it.tipo = tipo;
        it.iaDetectado = false;
        it.confianza = null;
      });
      renderLoteExpediente(key);
    }

    function quitarArchivoLoteExpediente(scope, idx) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const items = window.__loteExpedienteState[key]?.items;
      if (!Array.isArray(items)) return;
      items.splice(idx, 1);
      renderLoteExpediente(key);
    }

    function limpiarLoteExpediente(scope) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      if (window.__loteExpedienteState[key]) {
        window.__loteExpedienteState[key].items = [];
      }
      renderLoteExpediente(key);
    }

    function renderLoteExpediente(scope) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const panelId = key === 'ficha' ? 'loteFichaPanel' : 'loteExpModalPanel';
      const listaId = key === 'ficha' ? 'loteExpFichaLista' : 'loteExpModalLista';
      const countId = key === 'ficha' ? 'loteExpFichaCount' : 'loteExpModalCount';
      const selMasivoId = key === 'ficha' ? 'selLoteExpTipoMasivoFicha' : 'selLoteExpTipoMasivoModal';

      const panel = document.getElementById(panelId);
      const lista = document.getElementById(listaId);
      const countEl = document.getElementById(countId);
      if (!panel || !lista) return;

      poblarSelectTipoMasivoLoteExp(selMasivoId);
      const items = window.__loteExpedienteState[key]?.items || [];
      if (countEl) countEl.textContent = String(items.length);

      if (items.length === 0) {
        panel.style.display = 'none';
        lista.innerHTML = '';
        return;
      }

      const opciones = obtenerOpcionesTipoDocLoteExpediente();
      panel.style.display = 'block';
      lista.innerHTML = items.map((item, idx) => {
        const sizeKb = Math.max(1, Math.round(item.file.size / 1024));
        const optionsHtml = opciones.map(opt =>
          '<option value="' + sanitizeHTML(opt.value) + '"' + (item.tipo === opt.value ? ' selected' : '') + '>' + sanitizeHTML(opt.label) + '</option>'
        ).join('');
        const iaBadge = item.iaDetectado
          ? '<span style="background:#dbeafe;color:#1d4ed8;font-size:0.67rem;font-weight:700;padding:0.15rem 0.45rem;border-radius:999px;white-space:nowrap;">✨ IA' + (item.confianza ? ' ' + sanitizeHTML(String(item.confianza)) : '') + '</span>'
          : '';
        const safeName = sanitizeHTML(item.file.name);
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.6rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:0.45rem 0.65rem;flex-wrap:wrap;">' +
          '<div style="display:flex;align-items:center;gap:0.45rem;min-width:170px;flex:1;">' +
            '<span style="font-size:0.85rem;">📄</span>' +
            '<div style="min-width:0;">' +
              '<div style="font-size:0.78rem;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px;" title="' + safeName + '">' + safeName + '</div>' +
              '<div style="font-size:0.68rem;color:#64748b;">' + sizeKb + ' KB</div>' +
            '</div>' +
            iaBadge +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.4rem;">' +
            '<select onchange="cambiarTipoLoteExpediente(\'' + key + '\', ' + idx + ', this.value)" style="font-size:0.74rem;padding:0.32rem 0.48rem;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;color:#0f172a;max-width:230px;">' +
              optionsHtml +
            '</select>' +
            '<button type="button" onclick="quitarArchivoLoteExpediente(\'' + key + '\', ' + idx + ')" title="Quitar del lote" style="background:none;border:none;color:#94a3b8;font-size:1rem;font-weight:700;cursor:pointer;padding:0 0.25rem;line-height:1;">×</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function clasificarLoteExpedienteConIA(scope) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const items = window.__loteExpedienteState[key]?.items || [];
      if (!items.length) return;

      const btn = document.getElementById('btnReconocerLoteExpIA_' + key);
      const prevText = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Analizando lote con IA...';
      }

      let reconocidos = 0;
      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          try {
            const b64 = await archivoABase64Puro(item.file);
            const resp = await fetchConTimeout(RENDER_API_URL + '/api/clasificar-documento', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file_base64: b64,
                mime_type: item.file.type || 'application/octet-stream',
                filename: item.file.name
              })
            }, 30000);
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.tipo && typeof MAPA_ID_TIPO_DOC === 'object' && MAPA_ID_TIPO_DOC[data.tipo]) {
                item.tipo = MAPA_ID_TIPO_DOC[data.tipo];
                item.iaDetectado = true;
                item.confianza = data.confianza || null;
                reconocidos++;
              }
            }
          } catch (errItem) {
            console.warn('Error clasificando archivo del lote:', item.file.name, errItem);
          }
        }
        renderLoteExpediente(key);
        showToast('✨ IA clasificó ' + reconocidos + ' de ' + items.length + ' archivo(s)');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevText || '🤖 Reconocer con IA';
        }
      }
    }

    async function subirLoteExpedienteConfirmar(scope) {
      const key = (scope === 'ficha') ? 'ficha' : 'modal';
      const state = window.__loteExpedienteState[key];
      const items = state?.items || [];
      const id = state?.id || (typeof obtenerIdSolicitudActiva === 'function' ? obtenerIdSolicitudActiva() : null);
      if (!items.length || !id) {
        showToast('Agregá al menos un archivo para subir');
        return;
      }

      const session = getSession(); if (!session) return;
      const operadorActual = obtenerNombreOperadorActivo();
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id));
      if (!s) {
        showToast('No se encontró el expediente destino');
        return;
      }

      const btnSubir = document.getElementById('btnSubirLoteExp_' + key);
      const prevBtnText = btnSubir ? btnSubir.textContent : '';
      if (btnSubir) {
        btnSubir.disabled = true;
        btnSubir.textContent = '⏳ Subiendo...';
      }

      const prefijoOficial = obtenerPrefijoOficialExpediente(s);
      const expDefinitivo = (s.idDefinitivoExpediente || s.ID_Definitivo_Expediente || s.id_definitivo || s.Nro_Definitivo || '').toString().trim();
      const rolTxt = session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor');

      const fallidos = [];
      const nombresGuardados = [];
      const auditoriaPayload = [];
      let subidosOk = 0;

      try {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const progreso = '(' + (i + 1) + '/' + items.length + ')';
          mostrarCargando(
            'Subiendo documentación por lote ' + progreso + '...',
            'Procesando ' + item.file.name + ' hacia el Legajo #' + prefijoOficial
          );

          let b64Data = null;
          try {
            b64Data = await fileToBase64(item.file);
          } catch (errConv) {
            console.warn('Error convirtiendo archivo:', item.file.name, errConv);
            fallidos.push({ item, motivo: errConv?.message || 'Error procesando archivo' });
            continue;
          }

          const tipo = item.tipo || 'OTROS DOCUMENTOS';
          const generatedName = normalizarNombreArchivoDrive(prefijoOficial, tipo, 'PDF');
          const nowStr = obtenerFechaHora24hs();

          const resApi = await callApi({
            action: 'subirAdjuntoAdicional',
            id: s.id,
            idSolicitud: s.id,
            idDefinitivoExpediente: expDefinitivo,
            ID_Definitivo_Expediente: expDefinitivo,
            tipo: tipo,
            nombre: generatedName,
            base64: b64Data ? b64Data.base64 : '',
            tipoMime: 'application/pdf',
            usuarioOperador: operadorActual,
            cargadoPor: operadorActual,
            autor: operadorActual,
            rol: rolTxt
          }, {
            title: '🔒 Subiendo archivo ' + progreso + '...',
            sub: 'Archivando ' + generatedName + ' en Legajo #' + prefijoOficial
          });

          if (resApi && resApi.ok === false) {
            fallidos.push({ item, motivo: resApi.error || 'Error al guardar en backend' });
            continue;
          }

          const localItem = {
            tipo,
            nombre: generatedName,
            fecha: nowStr,
            cargadoPor: operadorActual,
            autor: operadorActual,
            dataUrl: b64Data ? b64Data.dataUrl : '',
            tipoMime: 'application/pdf',
            fileId: '',
            urlDrive: '',
            previewUrl: '',
            observado: false
          };
          const listaSync = sincronizarAdjuntosSolicitudLocal(s, resApi, localItem);
          const docSubido = (resApi && resApi.data && resApi.data.archivoSubido) ||
            (listaSync.length > 0 ? listaSync[listaSync.length - 1] : localItem);
          const nombreFinalGuardado = (docSubido && docSubido.nombre) || generatedName;

          if (Array.isArray(s.requerimientosDocumentales)) {
            s.requerimientosDocumentales.forEach(r => {
              if (r.tipo === tipo) r.resuelto = true;
            });
          }

          if (!s.observaciones) s.observaciones = [];
          s.observaciones.push({
            autor: operadorActual,
            rol: rolTxt,
            fecha: nowStr,
            texto: 'Documentación adicional adjuntada (lote): ' + tipo + ' (' + nombreFinalGuardado + ')'
          });

          subidosOk++;
          nombresGuardados.push(nombreFinalGuardado);
          if (b64Data) {
            auditoriaPayload.push({
              nombre: nombreFinalGuardado,
              mimeType: b64Data.tipoMime,
              base64: b64Data.base64
            });
          }
        }
      } finally {
        ocultarCargando();
        if (btnSubir) {
          btnSubir.disabled = false;
          btnSubir.textContent = prevBtnText || '✅ Subir al Expediente';
        }
      }

      if (subidosOk > 0) {
        verificarSalidaEstadoObservado(s);
        saveStoredSolicitudes(all);

        if (auditoriaPayload.length > 0) {
          ejecutarAuditoriaAutomaticaExpediente(s.id, auditoriaPayload);
        }

        actualizarCentroNotificaciones();
        renderModuloComercializador();
        renderModuloMutualPropias();
        renderModuloMutual();
        actualizarContadorBoveda(s.id);
      }

      state.items = fallidos.map(f => f.item);
      renderLoteExpediente(key);

      if (fallidos.length === 0 && subidosOk > 0) {
        showToast('✅ ' + subidosOk + ' documento(s) archivado(s) en el expediente #' + prefijoOficial + ' 📄');
        if (key === 'modal') {
          cerrarModalSubirLoteExpediente();
        }
        const modalFichaAbierto = document.getElementById('modalFichaCompleta')?.classList.contains('open');
        const activeId = (typeof obtenerIdSolicitudActiva === 'function') ? obtenerIdSolicitudActiva() : null;
        if (key === 'ficha' || (modalFichaAbierto && String(activeId) === String(s.id))) {
          verFichaCompleta(s.id);
        }
      } else if (subidosOk > 0) {
        showToast('⚠️ Se subieron ' + subidosOk + ' archivo(s), pero ' + fallidos.length + ' fallaron. Podés reintentarlos.');
        if (key === 'ficha') verFichaCompleta(s.id);
      } else if (fallidos.length > 0) {
        showToast('⚠️ No se pudieron subir los archivos: ' + (fallidos[0].motivo || 'Error de conexión'));
      }
    }

    let _docAEliminarPending = null;

    function solicitarEliminarDocumento(solicitudIdOrTipo, adjuntoIndexOrNombre) {
      let solicitudId = solicitudIdOrTipo;
      let adjuntoIndex = (typeof adjuntoIndexOrNombre === 'number') ? adjuntoIndexOrNombre : parseInt(adjuntoIndexOrNombre, 10);

      const all = getStoredSolicitudes();
      let s = all.find(x => String(x.id) === String(solicitudId));
      if (!s && typeof obtenerIdSolicitudActiva === 'function') {
        const activeId = obtenerIdSolicitudActiva();
        s = all.find(x => String(x.id) === String(activeId));
        if (s) {
          solicitudId = s.id;
          const lista = normalizarListaArchivos(s);
          adjuntoIndex = lista.findIndex(a =>
            String(a.tipo || '') === String(solicitudIdOrTipo || '') &&
            String(a.nombre || '') === String(adjuntoIndexOrNombre || '')
          );
          if (adjuntoIndex === -1) {
            adjuntoIndex = lista.findIndex(a => String(a.nombre || '') === String(adjuntoIndexOrNombre || ''));
          }
        }
      }
      if (!s || isNaN(adjuntoIndex) || adjuntoIndex < 0) return;

      const listaArchivos = normalizarListaArchivos(s);
      const adj = listaArchivos[adjuntoIndex];
      if (!adj) return;

      _docAEliminarPending = {
        solicitudId: s.id,
        adjuntoIndex: adjuntoIndex,
        tipo: adj.tipo || 'DOCUMENTO',
        nombre: adj.nombre || 'archivo.pdf',
        fileId: adj.fileId || '',
        urlDrive: adj.urlDrive || ''
      };

      const lblTipo = document.getElementById('lblEliminarDocTipo');
      const lblNom = document.getElementById('lblEliminarDocNombre');
      if (lblTipo) lblTipo.textContent = _docAEliminarPending.tipo;
      if (lblNom) lblNom.textContent = _docAEliminarPending.nombre;
      abrirModal('modalConfirmarEliminarDoc');
    }

    function cerrarConfirmarEliminarDoc() {
      _docAEliminarPending = null;
      cerrarModal('modalConfirmarEliminarDoc');
    }

    async function confirmarEliminarDocumento() {
      if (!_docAEliminarPending) return;
      const pending = _docAEliminarPending;
      const session = getSession();
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(pending.solicitudId));
      if (!s) {
        cerrarConfirmarEliminarDoc();
        return;
      }

      cerrarModal('modalConfirmarEliminarDoc');
      mostrarCargando('Eliminando documento del legajo...', 'Moviendo archivo a papelera en Bóveda Documental');

      let resApi = null;
      try {
        resApi = await callApi({
          action: 'eliminarDocumento',
          id: s.id,
          idSolicitud: s.id,
          adjuntoIndex: pending.adjuntoIndex,
          fileId: pending.fileId || '',
          urlDrive: pending.urlDrive || '',
          nombre: pending.nombre || '',
          tipo: pending.tipo || '',
          autor: session?.nombre || 'Operador',
          rol: session ? (session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor')) : 'Operador'
        });
      } catch (err) {
        console.warn('Error eliminando documento en backend:', err);
      }

      const listaAct = normalizarListaArchivos(s);
      let nuevaLista = listaAct;
      if (resApi && resApi.ok && resApi.data && Array.isArray(resApi.data.archivos)) {
        nuevaLista = resApi.data.archivos;
      } else if (pending.adjuntoIndex >= 0 && pending.adjuntoIndex < listaAct.length) {
        listaAct.splice(pending.adjuntoIndex, 1);
        nuevaLista = listaAct;
      }

      const jsonLista = JSON.stringify(nuevaLista);
      s.adjuntos = nuevaLista;
      s.archivosAdjuntos = nuevaLista;
      s.archivosLegajo = nuevaLista;
      s.archivos = nuevaLista;
      s.Archivos_Adjuntos_JSON = jsonLista;
      s.Archivos_Legajo_JSON = jsonLista;
      s.Archivos_JSON = jsonLista;
      const nowStr = obtenerFechaHora24hs();
      if (!Array.isArray(s.observaciones)) s.observaciones = [];
      s.observaciones.push({
        autor: session?.nombre || 'Operador',
        rol: session ? (session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor')) : 'Operador',
        fecha: nowStr,
        texto: '🗑️ Documento eliminado del legajo: ' + pending.tipo + ' (' + pending.nombre + ')'
      });
      verificarSalidaEstadoObservado(s);
      saveStoredSolicitudes(all);

      _docAEliminarPending = null;
      ocultarCargando();
      actualizarCentroNotificaciones();
      renderModuloComercializador();
      renderModuloMutual();
      renderModuloMutualPropias();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(s.id);
      showToast('🗑️ Documento "' + pending.nombre + '" eliminado del legajo');
    }

    async function enviarComentarioComercializador(id) {
      const session = getSession(); if (!session) return;
      if (!checkSubmitCooldown('btnEnviarComentario', 2000)) return;
      const inpTxt = document.getElementById('txtFichaComentario');
      const rawTxt = inpTxt?.value?.trim();
      if (!rawTxt) { showToast('Por favor escribe un mensaje o aclaración'); return; }
      const txt = sanitizeHTML(rawTxt);
      const all = getStoredSolicitudes(); const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const nowStr = obtenerFechaHora24hs();
      const nowTs = Date.now();
      const msgId = 'msg_' + nowTs + '_' + Math.floor(Math.random() * 10000);

      const nuevoComentario = {
        id: msgId,
        autor: session.nombre,
        rol: session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor'),
        fecha: nowStr,
        timestamp: nowTs,
        texto: txt,
        contenido: txt,
        editado: false,
        eliminado: false
      };

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push(nuevoComentario);
      s.historialComentarios = s.observaciones;
      s.comentarios = s.observaciones;

      saveStoredSolicitudes(all);
      if (inpTxt) inpTxt.value = '';
      verFichaCompleta(id);

      const res = await callApi({
        action: 'agregarComentario',
        id: s.id,
        idSolicitud: s.id,
        idComentario: msgId,
        timestamp: nowTs,
        texto: txt,
        contenido: txt,
        autor: session.nombre,
        rol: session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor')
      }, {
        title: 'Registrando observación...',
        sub: 'Actualizando historial en Servidor Central'
      });

      renderModuloComercializador();
      renderModuloMutualPropias();
      renderModuloMutual();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(s.id);
      showToast('Aclaración enviada y registrada en el expediente 💬');
    }

    /* EDICIÓN Y ELIMINACIÓN DE COMENTARIOS EN VENTANA DE 5 MINUTOS (WHATSAPP STYLE) */
    function iniciarEdicionComentario(solicitudId, comentarioId) {
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) { showToast('⚠️ No se encontró el expediente'); return; }
      const bitacora = normalizarBitacoraComentarios(s);
      const msg = bitacora.find(m => String(m.id) === String(comentarioId));
      if (!msg) { showToast('⚠️ No se encontró el mensaje seleccionado'); return; }

      const session = getSession();
      const esMio = Boolean(session && (
        msg.autor === session.nombre ||
        msg.usuarioOperador === session.nombre ||
        (session.nombre && msg.autor && String(msg.autor).includes(session.nombre))
      ));
      if (!esMio) {
        showToast('⚠️ Solo podés editar mensajes emitidos por tu usuario');
        return;
      }

      const ahoraMs = Date.now();
      const msgTs = Number(msg.timestamp || 0) || (msg.fecha ? parsearFechaATimestampCliente(msg.fecha) : 0);
      const transcurridoMs = msgTs ? (ahoraMs - msgTs) : Infinity;
      if (transcurridoMs > 300000) {
        showToast('⚠️ La ventana de 5 minutos para editar este mensaje ha expirado');
        return;
      }

      document.getElementById('editComentarioIdSolicitud').value = solicitudId;
      document.getElementById('editComentarioIdMsg').value = comentarioId;
      const txtArea = document.getElementById('txtEditarComentarioContenido');
      if (txtArea) {
        txtArea.value = msg.texto || msg.contenido || '';
      }
      abrirModal('modalEditarComentario');
      setTimeout(() => { if (txtArea) txtArea.focus(); }, 60);
    }

    async function guardarEdicionComentario() {
      const solicitudId = document.getElementById('editComentarioIdSolicitud')?.value;
      const comentarioId = document.getElementById('editComentarioIdMsg')?.value;
      const nuevoTextoRaw = document.getElementById('txtEditarComentarioContenido')?.value?.trim();
      if (!nuevoTextoRaw) {
        showToast('⚠️ El mensaje no puede quedar vacío');
        return;
      }
      const nuevoTexto = sanitizeHTML(nuevoTextoRaw);

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) { showToast('⚠️ Error: Expediente no encontrado'); return; }

      const bitacora = normalizarBitacoraComentarios(s);
      const msg = bitacora.find(m => String(m.id) === String(comentarioId));
      if (!msg) { showToast('⚠️ Error: Mensaje no encontrado'); return; }

      const ahoraMs = Date.now();
      const msgTs = Number(msg.timestamp || 0) || (msg.fecha ? parsearFechaATimestampCliente(msg.fecha) : 0);
      if (msgTs && (ahoraMs - msgTs > 300000)) {
        cerrarModal('modalEditarComentario');
        showToast('⚠️ La ventana de 5 minutos ha expirado');
        return;
      }

      // Optimistic update
      const nowStr = obtenerFechaHora24hs();
      msg.texto = nuevoTexto;
      msg.contenido = nuevoTexto;
      msg.editado = true;
      msg.fechaEdicion = nowStr;

      s.observaciones = bitacora;
      s.historialComentarios = bitacora;
      s.comentarios = bitacora;
      saveStoredSolicitudes(all);

      cerrarModal('modalEditarComentario');
      verFichaCompleta(solicitudId);
      showToast('Mensaje editado correctamente ✓');

      // Persistir en servidor central
      const session = getSession();
      try {
        await callApi({
          action: 'editarComentarioBitacora',
          idSolicitud: solicitudId,
          idComentario: comentarioId,
          nuevoContenido: nuevoTexto,
          usuarioActivo: session
        }, {
          title: 'Guardando edición...',
          sub: 'Actualizando historial en Google Sheets Columna 21'
        });
      } catch (err) {
        console.warn('Error sincronizando edición en backend:', err);
      }
    }

    function confirmarEliminarComentario(solicitudId, comentarioId) {
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) { showToast('⚠️ No se encontró el expediente'); return; }
      const bitacora = normalizarBitacoraComentarios(s);
      const msg = bitacora.find(m => String(m.id) === String(comentarioId));
      if (!msg) { showToast('⚠️ No se encontró el mensaje seleccionado'); return; }

      const session = getSession();
      const esMio = Boolean(session && (
        msg.autor === session.nombre ||
        msg.usuarioOperador === session.nombre ||
        (session.nombre && msg.autor && String(msg.autor).includes(session.nombre))
      ));
      if (!esMio) {
        showToast('⚠️ Solo podés eliminar mensajes propios');
        return;
      }

      const ahoraMs = Date.now();
      const msgTs = Number(msg.timestamp || 0) || (msg.fecha ? parsearFechaATimestampCliente(msg.fecha) : 0);
      const transcurridoMs = msgTs ? (ahoraMs - msgTs) : Infinity;
      if (transcurridoMs > 300000) {
        showToast('⚠️ La ventana de 5 minutos para eliminar este mensaje ha expirado');
        return;
      }

      document.getElementById('eliminarComentarioIdSolicitud').value = solicitudId;
      document.getElementById('eliminarComentarioIdMsg').value = comentarioId;
      const prevEl = document.getElementById('lblEliminarComentarioPreview');
      if (prevEl) {
        prevEl.textContent = '"' + (msg.texto || msg.contenido || '').slice(0, 100) + '..."';
      }
      abrirModal('modalEliminarComentario');
    }

    async function ejecutarEliminacionComentario() {
      const solicitudId = document.getElementById('eliminarComentarioIdSolicitud')?.value;
      const comentarioId = document.getElementById('eliminarComentarioIdMsg')?.value;

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s) { showToast('⚠️ Expediente no encontrado'); return; }

      const bitacora = normalizarBitacoraComentarios(s);
      const msg = bitacora.find(m => String(m.id) === String(comentarioId));
      if (!msg) { showToast('⚠️ Mensaje no encontrado'); return; }

      const ahoraMs = Date.now();
      const msgTs = Number(msg.timestamp || 0) || (msg.fecha ? parsearFechaATimestampCliente(msg.fecha) : 0);
      if (msgTs && (ahoraMs - msgTs > 300000)) {
        cerrarModal('modalEliminarComentario');
        showToast('⚠️ La ventana de 5 minutos ha expirado');
        return;
      }

      // Optimistic update
      const nowStr = obtenerFechaHora24hs();
      msg.eliminado = true;
      msg.texto = '🚫 Este mensaje fue eliminado';
      msg.contenido = '🚫 Este mensaje fue eliminado';
      msg.fechaEliminacion = nowStr;

      s.observaciones = bitacora;
      s.historialComentarios = bitacora;
      s.comentarios = bitacora;
      saveStoredSolicitudes(all);

      cerrarModal('modalEliminarComentario');
      verFichaCompleta(solicitudId);
      showToast('Mensaje eliminado para todos ✓');

      // Persistir en servidor central
      const session = getSession();
      try {
        await callApi({
          action: 'eliminarComentarioBitacora',
          idSolicitud: solicitudId,
          idComentario: comentarioId,
          usuarioActivo: session
        }, {
          title: 'Eliminando mensaje...',
          sub: 'Registrando estado eliminado en Google Sheets Columna 21'
        });
      } catch (err) {
        console.warn('Error sincronizando eliminación en backend:', err);
      }
    }

    async function _actualizarEstadoCanonicoConFallback(solicitudId, nuevoEstado, analista, comentario) {
      if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
        try {
          const resp = await fetchConTimeout(`${RENDER_API_URL.replace(/\/$/, '')}/api/solicitudes/${encodeURIComponent(solicitudId)}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estado: nuevoEstado,
              comentario: comentario || `Estado actualizado a ${nuevoEstado}`,
              replicar_gas: true
            })
          }, 20000);
          if (resp.ok) {
            return await resp.json().catch(() => ({ ok: true }));
          }
          if (resp.status !== 404 && resp.status !== 405) {
            const errJson = await resp.json().catch(() => ({}));
            throw new Error(errJson.detail || `HTTP ${resp.status}`);
          }
        } catch (errPatch) {
          console.warn('PATCH estado canónico fallback a GAS:', errPatch);
        }
      }
      return callApi({
        action: 'actualizarEstado',
        id: solicitudId,
        estado: nuevoEstado,
        analista: analista,
        comentario: comentario || ('Estado actualizado a ' + nuevoEstado)
      }, {
        title: 'Actualizando estado en servidor...',
        sub: 'Guardando estado "' + nuevoEstado + '" en Servidor Central'
      });
    }

    /* CAMBIO DIRECTO DE ESTADO (EXCLUSIVO ANALISTA / ADMIN) */
    async function actualizarEstadoDirectoFicha(id) {
      const all = getStoredSolicitudes(); const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const session = getSession();
      if (!session || (session.rol !== 'Analista' && session.rol !== 'Admin' && session.rol !== 'Asesor Mutual')) {
        showToast('Acceso restringido: Solo Analistas de Mutual o Administradores pueden cambiar estados.');
        return;
      }
      const nuevo = document.getElementById('cboFichaEstadoDirecto')?.value;
      if (!nuevo) return;

      const anterior = s.estado;
      s.estado = nuevo;
      if (!s.analistaAsignado || s.analistaAsignado === 'Sin Asignar') {
        s.analistaAsignado = session.nombre;
        s.Analista_Asignado = session.nombre;
      }
      const now = obtenerFechaHora24hs();

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: session.nombre,
        rol: session.rol === 'Admin' ? 'Administrador' : 'Analista Mutual',
        fecha: now,
        texto: 'Estado de gestión actualizado de "' + anterior + '" a "' + nuevo + '".'
      });

      saveStoredSolicitudes(all);
      _actualizarEstadoCanonicoConFallback(
        s.id,
        nuevo,
        s.analistaAsignado || session.nombre,
        'Estado actualizado a ' + nuevo
      ).catch(console.warn);

      showToast('Estado actualizado a "' + nuevo + '" exitosamente ⚡');
      renderModuloMutualPropias();
      renderModuloMutual();
      renderModuloComercializador();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(id);
    }

    /* ========================================================================
       6.A.1 ACCIONES DE CICLO DE VIDA: ELIMINAR VS. DESESTIMAR GESTIONES
       ======================================================================== */
    function esEtapaInicialEliminable(estadoRaw) {
      if (!estadoRaw) return true;
      const e = String(estadoRaw).trim().toUpperCase().replace(/[\s_-]+/g, '');
      const iniciales = [
        'INGRESADO',
        'INGRESADA',
        'PENDIENTEAUDITORIA',
        'SOLICITADO',
        'SOLICITADA',
        'PENDIENTE',
        'DOCUMENTACIONPENDIENTE',
        'ENCARGA',
        'BORRADOR',
        'NUEVASOLICITUD'
      ];
      return iniciales.some(i => e === i || e.startsWith('INGRES') || e.startsWith('SOLICIT') || e === 'PENDIENTE');
    }

    function puedeDesestimarGestion(estadoRaw) {
      if (!estadoRaw) return false;
      const e = String(estadoRaw).trim().toUpperCase().replace(/[\s_-]+/g, '');
      const finales = [
        'DESESTIMADO',
        'DESESTIMADA',
        'CANCELADO',
        'CANCELADA',
        'RECHAZADODEFINITIVO',
        'LIQUIDADO',
        'COBRADO',
        'TRANSFERIDO'
      ];
      if (finales.includes(e)) return false;
      return !esEtapaInicialEliminable(estadoRaw);
    }

    function renderBotonCicloVida(s, enFicha = false) {
      if (!s) return '';
      const id = sanitizeHTML(String(s.id || s.idSolicitud || s.ID_Solicitud || ''));
      if (!id) return '';
      const estado = s.estado || 'Pendiente';

      if (esEtapaInicialEliminable(estado)) {
        if (enFicha) {
          return '<button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer shadow-xs" title="Eliminar Solicitud Inicial" onclick="solicitarEliminarSolicitud(\'' + id + '\')">' +
            '<svg class="w-4 h-4 shrink-0 text-rose-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="3 6 5 6 21 6"></polyline>' +
              '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
              '<line x1="10" y1="11" x2="10" y2="17"></line>' +
              '<line x1="14" y1="11" x2="14" y2="17"></line>' +
            '</svg>' +
            '<span>Eliminar Solicitud</span>' +
          '</button>';
        } else {
          return '<button type="button" class="crm-btn-icon-danger" title="Eliminar solicitud preliminar" onclick="event.stopPropagation(); solicitarEliminarSolicitud(\'' + id + '\')">' +
            '<svg class="w-3.5 h-3.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="3 6 5 6 21 6"></polyline>' +
              '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
              '<line x1="10" y1="11" x2="10" y2="17"></line>' +
              '<line x1="14" y1="11" x2="14" y2="17"></line>' +
            '</svg>' +
          '</button>';
        }
      } else if (puedeDesestimarGestion(estado)) {
        if (enFicha) {
          return '<button type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors cursor-pointer shadow-xs" title="Desestimar Gestión" onclick="abrirModalDesestimarGestion(\'' + id + '\')">' +
            '<svg class="w-4 h-4 shrink-0 text-amber-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"></circle>' +
              '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>' +
            '</svg>' +
            '<span>Desestimar Gestión</span>' +
          '</button>';
        } else {
          return '<button type="button" class="crm-btn-icon-warn" title="Desestimar gestión" onclick="event.stopPropagation(); abrirModalDesestimarGestion(\'' + id + '\')">' +
            '<svg class="w-3.5 h-3.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"></circle>' +
              '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>' +
            '</svg>' +
          '</button>';
        }
      } else {
        const esDesestimado = String(estado).toUpperCase().includes('DESESTIMAD');
        if (enFicha && esDesestimado) {
          return '<span class="badge-status badge-DESESTIMADO" style="font-size:0.75rem;padding:3px 8px;">🚫 Gestión Desestimada</span>';
        }
        return '';
      }
    }

    function solicitarEliminarSolicitud(id) {
      if (!id) return;
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id) || String(x.idSolicitud) === String(id));
      if (!s) {
        showToast('⚠️ No se encontró la solicitud seleccionada.');
        return;
      }

      const expNombre = s.solicitante?.nombre || s.Apellido_Nombre || 'el asociado';
      const idTxt = s.id_definitivo || s.idSolicitud || s.id || id;

      const inpId = document.getElementById('eliminarIdSolicitud');
      const lblExp = document.getElementById('lblEliminarExpediente');
      if (inpId) inpId.value = String(s.id || id);
      if (lblExp) lblExp.textContent = idTxt + ' — ' + expNombre;

      abrirModal('modalEliminarSolicitud');
    }

    async function confirmarEliminarSolicitud() {
      const inpId = document.getElementById('eliminarIdSolicitud');
      const id = inpId ? String(inpId.value || '').trim() : '';
      if (!id) {
        cerrarModal('modalEliminarSolicitud');
        return;
      }

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id) || String(x.idSolicitud) === String(id));
      if (!s) {
        cerrarModal('modalEliminarSolicitud');
        showToast('⚠️ No se encontró la solicitud seleccionada.');
        return;
      }

      const session = getSession();
      const usuarioOperador = (session && session.nombre) ? session.nombre : 'Operador';

      try {
        const idSolDelete = s.idSolicitud || s.id || id;
        callApi({
          action: 'eliminarSolicitud',
          idSolicitud: idSolDelete,
          id: idSolDelete,
          usuarioOperador: usuarioOperador
        }, {
          title: 'Eliminando solicitud...',
          sub: 'Borrando expediente de la base central'
        }).catch(console.warn);

        if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
          const idParaSupa = s.id_provisorio || s.supabase_id || idSolDelete;
          fetchConTimeout(`${RENDER_API_URL}/api/solicitudes/${encodeURIComponent(idParaSupa)}`, {
            method: 'DELETE'
          }, 15000).catch(() => {});
        }

        const filtrados = all.filter(x => String(x.id) !== String(id) && String(x.idSolicitud) !== String(id));
        saveStoredSolicitudes(filtrados);

        cerrarModal('modalEliminarSolicitud');
        cerrarModal('modalFichaCompleta');

        if (typeof renderModuloComercializador === 'function') renderModuloComercializador();
        if (typeof renderModuloMutualPropias === 'function') renderModuloMutualPropias();
        if (typeof renderModuloMutual === 'function') renderModuloMutual();
        actualizarCentroNotificaciones();

        showToast('Solicitud eliminada exitosamente');
        mostrarNotificacionToast('Solicitud eliminada exitosamente', 'success');
      } catch (err) {
        console.error('Error al eliminar solicitud:', err);
        showToast('Error al procesar la eliminación de la solicitud');
      }
    }

    function toggleVisibilidadClaveLimpiarPruebas() {
      const inp = document.getElementById('inputClaveLimpiarPruebas');
      const btn = document.getElementById('btnToggleClaveLimpiar');
      if (!inp) return;
      const esPass = inp.type === 'password';
      inp.type = esPass ? 'text' : 'password';
      if (btn) btn.textContent = esPass ? '🙈' : '👁️';
    }

    function limpiarDatosPruebaSistema(scope = 'all') {
      const sess = (typeof getSession === 'function') ? getSession() : null;
      const rolLower = String((sess && (sess.rol || sess.role)) || '').trim().toLowerCase();
      if (rolLower !== 'admin' && rolLower !== 'administrador') {
        showToast('⛔ Solo usuarios con rol Admin pueden limpiar datos de prueba.');
        return;
      }

      window._limpiarPruebasScopePendiente = scope || 'all';
      const inp = document.getElementById('inputClaveLimpiarPruebas');
      const errBox = document.getElementById('limpiarPruebasErrorBox');
      const btn = document.getElementById('btnConfirmarLimpiarPruebas');
      const btnToggle = document.getElementById('btnToggleClaveLimpiar');
      if (inp) {
        inp.value = '';
        inp.type = 'password';
      }
      if (btnToggle) btnToggle.textContent = '👁️';
      if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
      }
      if (btn) btn.disabled = false;

      if (typeof abrirModal === 'function') {
        abrirModal('modalLimpiarPruebasSeguridad');
        setTimeout(() => { if (inp) inp.focus(); }, 80);
      }
    }

    async function ejecutarLimpiarDatosPruebaConfirmado() {
      const sess = (typeof getSession === 'function') ? getSession() : null;
      const rolLower = String((sess && (sess.rol || sess.role)) || '').trim().toLowerCase();
      if (rolLower !== 'admin' && rolLower !== 'administrador') {
        showToast('⛔ Solo usuarios con rol Admin pueden limpiar datos de prueba.');
        return;
      }

      const scope = window._limpiarPruebasScopePendiente || 'all';
      const inp = document.getElementById('inputClaveLimpiarPruebas');
      const errBox = document.getElementById('limpiarPruebasErrorBox');
      const btn = document.getElementById('btnConfirmarLimpiarPruebas');
      const claveIngresada = String((inp && inp.value) || '').trim();

      const mostrarErrorModal = (msg) => {
        if (errBox) {
          errBox.textContent = msg;
          errBox.style.display = 'block';
        }
        if (inp) {
          inp.focus();
          inp.select();
        }
      };

      if (!claveIngresada) {
        mostrarErrorModal('⚠️ Debés ingresar la clave de seguridad para habilitar la limpieza.');
        return;
      }

      if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
      }
      if (btn) btn.disabled = true;

      mostrarCargando('Validando clave y limpiando...', 'Verificando autorización y vaciando paneles');
      try {
        let verificadoBackend = false;

        if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
          const respSupa = await fetchConTimeout(`${RENDER_API_URL}/api/admin/limpiar-pruebas`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Cleanup-Key': claveIngresada
            },
            body: JSON.stringify({
              limpiarSolicitudes: scope === 'all' || scope === 'solicitudes',
              limpiarPadron: scope === 'all' || scope === 'padron',
              securityKey: claveIngresada
            })
          }, 45000).catch(() => null);

          if (!respSupa) {
            mostrarErrorModal('⚠️ No se pudo conectar con el servidor para verificar la clave de seguridad. Intentá nuevamente en unos segundos.');
            return;
          }

          if (!respSupa.ok) {
            const errJson = await respSupa.json().catch(() => ({}));
            const detalle = errJson.detail || (respSupa.status === 403 || respSupa.status === 401
              ? 'Clave de seguridad incorrecta o sesión no autorizada.'
              : ('Error HTTP ' + respSupa.status));
            if (inp) inp.value = '';
            mostrarErrorModal('❌ ' + detalle);
            return;
          }

          verificadoBackend = true;
        }

        if (RENDER_API_URL && !RENDER_API_URL.includes('[TU_API]')) {
          const resGas = await callApi({
            action: 'limpiarDatosPrueba',
            limpiarSolicitudes: scope === 'all' || scope === 'solicitudes',
            limpiarPadron: scope === 'all' || scope === 'padron',
            incluirDrive: true,
            securityKey: claveIngresada
          }).catch(() => null);

          if (resGas && !resGas.ok) {
            const gasJson = resGas.data;
            if (!verificadoBackend) {
              if (inp) inp.value = '';
              mostrarErrorModal('❌ ' + (resGas.error || (gasJson && gasJson.error) || 'Clave de seguridad incorrecta.'));
              return;
            }
            showToast('⚠️ Aviso Sheets/Drive: ' + (resGas.error || 'No se pudo completar limpieza en Apps Script'));
          } else if (resGas && resGas.ok && resGas.data) {
            const gasJson = resGas.data;
            if (gasJson && gasJson.ok === false) {
              if (!verificadoBackend) {
                if (inp) inp.value = '';
                mostrarErrorModal('❌ ' + (gasJson.error || 'Clave de seguridad incorrecta.'));
                return;
              }
              showToast('⚠️ Aviso Sheets/Drive: ' + (gasJson.error || 'No se pudo completar limpieza en Apps Script'));
            }
          } else if (!verificadoBackend) {
            mostrarErrorModal('⚠️ No se pudo verificar la clave en el servidor.');
            return;
          }
        } else if (!verificadoBackend) {
          mostrarErrorModal('⚠️ No hay servidor configurado para validar la clave.');
          return;
        }

        try { localStorage.removeItem(STORAGE_SOLICITUDES_KEY); } catch (_) {}
        if (window.estadoApp) window.estadoApp.solicitudes = [];
        saveStoredSolicitudes([]);
        window._fichaPadronDniActivo = '';
        if (inp) inp.value = '';
        if (typeof cerrarModal === 'function') cerrarModal('modalLimpiarPruebasSeguridad');

        if (typeof renderModuloComercializador === 'function') renderModuloComercializador();
        if (typeof renderModuloMutualPropias === 'function') renderModuloMutualPropias();
        if (typeof renderModuloMutual === 'function') renderModuloMutual();
        if (typeof buscarPadronFichasAsociados === 'function') buscarPadronFichasAsociados();
        const detEl = document.getElementById('fichaAsociadoDetalleContainer');
        if (detEl) {
          detEl.innerHTML = '<div style="padding:2.5rem 1.5rem;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:0.86rem;">Panel limpio. Seleccioná un asociado del listado cuando se registren nuevos trámites.</div>';
        }
        actualizarCentroNotificaciones();
        showToast('✅ Paneles de Gestiones y Padrón limpiados correctamente.');
      } catch (err) {
        console.error('Error en limpieza de datos de prueba:', err);
        mostrarErrorModal('⚠️ Error durante la limpieza: ' + (err && err.message ? err.message : String(err)));
      } finally {
        if (btn) btn.disabled = false;
        ocultarCargando();
      }
    }

    function abrirModalDesestimarGestion(id) {
      if (!id) return;
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id) || String(x.idSolicitud) === String(id));
      if (!s) {
        showToast('⚠️ No se encontró la gestión solicitada.');
        return;
      }

      const idInput = document.getElementById('desestimarIdSolicitud');
      const lblExp = document.getElementById('lblDesestimarExpediente');
      const cboMotivo = document.getElementById('cboMotivoDesestimacionPredefinido');
      const txtMotivo = document.getElementById('txtMotivoDesestimacion');

      const expTexto = (s.id_definitivo ? ('Expediente ' + s.id_definitivo) : ('Expediente ' + (s.idSolicitud || s.id))) + ' — ' + (s.solicitante?.nombre || s.Apellido_Nombre || 'Asociado');

      if (idInput) idInput.value = s.idSolicitud || s.id || id;
      if (lblExp) lblExp.textContent = expTexto;
      if (cboMotivo) cboMotivo.value = '';
      if (txtMotivo) txtMotivo.value = '';

      abrirModal('modalDesestimarGestion');
    }

    async function confirmarDesestimarGestion() {
      const idInput = document.getElementById('desestimarIdSolicitud');
      const txtMotivo = document.getElementById('txtMotivoDesestimacion');
      const id = idInput ? idInput.value : '';
      const motivoTexto = txtMotivo ? txtMotivo.value.trim() : '';

      if (!id) {
        showToast('⚠️ Error: ID de expediente no identificado.');
        return;
      }
      if (!motivoTexto) {
        showToast('⚠️ Por favor ingrese o seleccione el motivo de la desestimación.');
        if (txtMotivo) txtMotivo.focus();
        return;
      }

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(id) || String(x.idSolicitud) === String(id));
      if (!s) {
        showToast('⚠️ Expediente no encontrado en el sistema.');
        return;
      }

      const session = getSession();
      const usuarioOperador = (session && session.nombre) ? session.nombre : 'Analista Mutual';
      const now = (typeof obtenerFechaHora24hs === 'function') ? obtenerFechaHora24hs() : new Date().toLocaleString('es-AR');

      s.estado = 'DESESTIMADO';

      if (!s.observaciones) s.observaciones = [];
      const logComentario = 'Gestión Desestimada. Motivo: ' + motivoTexto;
      s.observaciones.push({
        autor: usuarioOperador,
        rol: (session && session.rol === 'Admin') ? 'Administrador' : 'Analista Mutual',
        fecha: now,
        texto: logComentario
      });
      s.Historial_Comentarios_JSON = JSON.stringify(s.observaciones);

      saveStoredSolicitudes(all);

      callApi({
        action: 'cambiarEstado',
        idSolicitud: s.idSolicitud || s.id || id,
        id: s.idSolicitud || s.id || id,
        nuevoEstado: 'DESESTIMADO',
        estado: 'DESESTIMADO',
        motivo: motivoTexto,
        comentario: logComentario,
        usuarioOperador: usuarioOperador,
        analista: usuarioOperador,
        Historial_Comentarios_JSON: s.Historial_Comentarios_JSON
      }, {
        title: 'Desestimando gestión...',
        sub: 'Registrando desestimación en la bitácora central'
      }).catch(console.warn);

      cerrarModal('modalDesestimarGestion');

      if (typeof renderModuloComercializador === 'function') renderModuloComercializador();
      if (typeof renderModuloMutualPropias === 'function') renderModuloMutualPropias();
      if (typeof renderModuloMutual === 'function') renderModuloMutual();
      actualizarCentroNotificaciones();

      const modalFicha = document.getElementById('modalFichaCompleta');
      if (modalFicha && modalFicha.classList.contains('active')) {
        verFichaCompleta(id);
      }

      showToast('Gestión desestimada correctamente');
      mostrarNotificacionToast('Gestión desestimada correctamente', 'success');
    }

    window.respaldarLegajoLocalExtension = function (id, disparador) {
      const s = (window.solicitudesNube || []).find((x) => String(x.id) === String(id));
      if (!s) return;
      const adj = Array.isArray(s.archivosAdjuntos) ? s.archivosAdjuntos : (Array.isArray(s.adjuntos) ? s.adjuntos : []);
      if (!adj.length) {
        if (disparador === 'manual' && typeof showToast === 'function') {
          showToast('Este expediente no tiene documentos adjuntos para respaldar.');
        }
        return;
      }
      const idExp = s.id_definitivo || s.id_provisorio || ('EXP-' + s.id);
      const dni = String(s.solicitante?.dni || '').replace(/\D/g, '');
      const apellido = String(s.solicitante?.nombre || 'SOCIO').trim().split(/\s+/)[0] || 'SOCIO';
      const org = String(s.nombre_organizacion || 'GENERAL').trim();
      const linea = String(s.prestamo?.lineaNombre || 'GENERAL').trim();

      let authTok = '';
      try {
        authTok = (typeof window.getApiAuthToken === 'function' ? window.getApiAuthToken() : '') ||
          sessionStorage.getItem('AMMER_API_TOKEN') || sessionStorage.getItem('AMMER_AUTH_TOKEN') || '';
      } catch (_) {}

      let enviados = 0;
      adj.forEach((doc, idx) => {
        const urlDrive = doc.url || doc.driveUrl || doc.webViewLink || '';
        const urlSup = doc.supabaseUrl || doc.urlSupabase || '';
        const urlRen = doc.renderUrl || doc.urlRender || '';
        if (!urlDrive && !urlSup && !urlRen) return;
        const nom = String(doc.nombre || doc.name || ('DOC_' + (idx + 1))).toUpperCase();
        const tipoDoc = nom.includes('DNI') ? 'dni'
          : (nom.includes('RECIBO') ? 'recibo'
          : (nom.includes('MUTUO') ? 'mutuo'
          : (nom.includes('PAGARE') || nom.includes('PAGARÉ') ? 'pagare'
          : (nom.includes('TRANSF') ? 'transferencia' : 'recibo'))));
        const ext = (nom.split('.').pop() || 'PDF').slice(0, 5);
        window.postMessage(
          {
            tipo: 'AMMER_SINCRONIZAR_EXPEDIENTE',
            requestId: 'exp_' + s.id + '_' + idx,
            payload: {
              idExpediente: idExp,
              dni: dni,
              apellido: apellido,
              nombreCompleto: String(s.solicitante?.nombre || 'SOCIO').trim(),
              organizacion: org,
              linea: linea,
              tipoDoc: tipoDoc,
              extension: ext,
              estado: s.estado || '',
              disparador: disparador || 'manual',
              urlSupabase: urlSup,
              urlRender: urlRen,
              urlDrive: urlDrive,
              authToken: authTok,
            },
          },
          window.location.origin
        );
        enviados += 1;
      });
      if (disparador === 'manual' && typeof showToast === 'function') {
        showToast('📥 ' + enviados + ' documento(s) enviado(s) a la Extensión AMMER.');
      }
    };


