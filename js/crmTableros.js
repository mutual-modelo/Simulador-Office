    /* ========================================================================
       6.B DERIVACIÓN, REASIGNACIÓN Y COLABORACIÓN ENTRE ANALISTAS MUTUAL
       ======================================================================== */
    const ANALISTAS_MUTUAL_CACHE_KEY = 'AMMER_ANALISTAS_MUTUAL_PROD_V2';
    try { localStorage.removeItem('AMMER_ANALISTAS_MUTUAL_V1'); } catch (_) {}

    function obtenerAnalistasMutualLocal() {
      const mapaUnico = new Map();
      const registrar = (nombreRaw, rolRaw) => {
        const clean = String(nombreRaw || '').replace(/\s*\(sede central\)\s*/gi, '').trim();
        if (!clean) return;
        const lower = clean.toLowerCase();
        if (lower === 'sin asignar' || lower === 'analista mutual' || lower === 'usuario' || lower === 'analista sede central') return;
        const rolClean = String(rolRaw || 'Sede Central').trim() || 'Sede Central';
        if (!mapaUnico.has(lower)) {
          mapaUnico.set(lower, { nombre: clean, rol: rolClean });
        }
      };

      // 1. Usuarios reales registrados en estadoApp.usuarios (Analista / Admin)
      if (Array.isArray(window.estadoApp?.usuarios)) {
        window.estadoApp.usuarios.forEach(u => {
          if (!u) return;
          if (typeof u === 'string') {
            registrar(u, 'Sede Central');
            return;
          }
          const rol = String(u.rol || '').toLowerCase();
          if (rol.includes('analista') || rol.includes('admin') || rol.includes('mutual')) {
            registrar(u.nombre || u.usuario, u.rol || 'Sede Central');
          }
        });
      }

      // 2. Analistas reales cacheados desde servidor
      try {
        const cached = JSON.parse(localStorage.getItem(ANALISTAS_MUTUAL_CACHE_KEY) || '[]');
        if (Array.isArray(cached)) {
          cached.forEach(a => {
            if (typeof a === 'string') registrar(a, 'Sede Central');
            else if (a && typeof a === 'object') registrar(a.nombre || a.usuario, a.rol || 'Sede Central');
          });
        }
      } catch (_) {}

      // 3. Usuario en sesión actual si pertenece a Sede Central / Mutual
      const session = getSession();
      if (session && (session.rol === 'Analista' || session.rol === 'Admin' || session.rol === 'Asesor Mutual')) {
        registrar(session.nombre, session.rol);
      }

      // 4. Analistas reales observados en expedientes cargados desde servidor
      getStoredSolicitudes().forEach(s => {
        if (s.analistaAsignado) registrar(s.analistaAsignado, 'Analista');
        if (s.Analista_Asignado) registrar(s.Analista_Asignado, 'Analista');
        if (s.organizacion_id === 'org_sede_central' && s.comercializador) {
          registrar(s.comercializador, 'Sede Central');
        }
      });

      return Array.from(mapaUnico.values());
    }

    function poblarSelectAnalistasDestino(analistaActualNombre, selectEl) {
      const select = selectEl || document.getElementById('select-analista-destino');
      if (!select) return;

      select.innerHTML = '<option value="" disabled selected>— Seleccionar analista de destino —</option>';

      const actualLower = String(analistaActualNombre || '').toLowerCase().trim();
      let listaAnalistas = [];

      if (Array.isArray(window.estadoApp?.usuarios) && window.estadoApp.usuarios.length > 0) {
        listaAnalistas = window.estadoApp.usuarios
          .filter(u => {
            if (!u) return false;
            const nombre = typeof u === 'string' ? u : (u.nombre || u.usuario || '');
            const rol = typeof u === 'string' ? 'analista' : String(u.rol || '').toLowerCase();
            return nombre && (rol.includes('analista') || rol.includes('admin') || rol.includes('mutual')) && nombre.toLowerCase().trim() !== actualLower;
          })
          .map(u => typeof u === 'string' ? { nombre: u, rol: 'Sede Central' } : { nombre: u.nombre || u.usuario, rol: u.rol || 'Sede Central' });
      }

      if (listaAnalistas.length === 0) {
        listaAnalistas = obtenerAnalistasMutualLocal().filter(u => u.nombre.toLowerCase().trim() !== actualLower);
      }

      if (listaAnalistas.length > 0) {
        listaAnalistas.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.nombre;
          opt.textContent = u.nombre + ' (' + (u.rol || 'Sede Central') + ')';
          select.appendChild(opt);
        });
      } else {
        const opt = document.createElement('option');
        opt.value = 'Mesa de Entradas Sede Central';
        opt.textContent = 'Mesa de Entradas / Auditoría General';
        select.appendChild(opt);
      }
    }

    async function obtenerAnalistasMutual(forzarRefresh = false) {
      const locales = obtenerAnalistasMutualLocal();
      if (forzarRefresh) {
        try {
          const res = await callApi({ action: 'obtenerAnalistas' });
          const rawList = res?.data?.analistas || res?.data?.usuarios || (Array.isArray(res?.data) ? res.data : null);
          if (res?.ok && Array.isArray(rawList) && rawList.length > 0) {
            const filtrados = rawList
              .filter(u => {
                if (typeof u === 'string') return Boolean(u.trim());
                const r = String(u?.rol || '').toLowerCase();
                return Boolean(u?.nombre || u?.usuario) && (!r || r.includes('analista') || r.includes('admin') || r.includes('mutual'));
              })
              .map(u => typeof u === 'string'
                ? { nombre: u.trim(), rol: 'Sede Central' }
                : { nombre: String(u.nombre || u.usuario).trim(), rol: u.rol || 'Sede Central' }
              );
            if (filtrados.length > 0) {
              window.estadoApp = window.estadoApp || { solicitudes: [], usuarios: [] };
              window.estadoApp.usuarios = filtrados;
              localStorage.setItem(ANALISTAS_MUTUAL_CACHE_KEY, JSON.stringify(filtrados));
            }
          }
        } catch (err) {
          console.warn('No se pudo refrescar padrón de analistas desde Servidor Central:', err);
        }
      }
      const actualizados = obtenerAnalistasMutualLocal();
      return actualizados.length ? actualizados : locales;
    }

    function abrirModalDerivarCaso(id) {
      const session = getSession();
      const isAnalistaOAdmin = (session && (session.rol === 'Analista' || session.rol === 'Admin' || session.rol === 'Asesor Mutual'));
      if (!isAnalistaOAdmin) {
        showToast('Acceso restringido: Solo Analistas de Mutual o Administradores pueden derivar casos.');
        return;
      }

      const all = getStoredSolicitudes();
      const sol = all.find(x => String(x.id) === String(id));
      if (!sol) return;

      const hidId = document.getElementById('derivarCasoIdSolicitud');
      const txtMotivo = document.getElementById('txtMotivoDerivacion');
      const selectEl = document.getElementById('select-analista-destino');

      if (hidId) hidId.value = String(sol.id);
      if (txtMotivo) txtMotivo.value = '';

      const nroExp = sol.id_definitivo || sol.idDefinitivoExpediente || sol.ID_Definitivo_Expediente || sol.id_provisorio || sol.idSolicitud || sol.ID_Solicitud || sol.id || '---';
      const nombreRaw = sol.solicitante?.nombre || sol.apellidoNombre || sol.Apellido_Nombre || '';
      const nombreTitular = (nombreRaw && nombreRaw !== 'Socio') ? nombreRaw : 'Sin nombre registrado';
      const analistaActual = sol.analistaAsignado || sol.Analista_Asignado || 'Sin Asignar';

      const expInfoEl = document.getElementById('derivar-expediente-info');
      const analistaInfoEl = document.getElementById('derivar-analista-actual');
      if (expInfoEl && analistaInfoEl) {
        expInfoEl.textContent = 'Expediente: ' + nroExp + ' — ' + nombreTitular;
        analistaInfoEl.textContent = analistaActual;
      } else {
        const metaEl = document.getElementById('derivarCasoMetaInfo');
        if (metaEl) {
          metaEl.innerHTML = '<div id="derivar-expediente-info" style="font-weight:700;color:#0f172a;">Expediente: ' + sanitizeHTML(nroExp) + ' — ' + sanitizeHTML(nombreTitular) + '</div>' +
            '<div style="margin-top:3px;"><strong>Analista Actual:</strong> <span id="derivar-analista-actual" style="color:#166534;font-weight:700;">' + sanitizeHTML(analistaActual) + '</span></div>';
        }
      }

      poblarSelectAnalistasDestino(analistaActual, selectEl);
      abrirModal('modal-derivar-caso');

      // Sincronización no bloqueante con Servidor Central por si hay nuevos analistas activos
      obtenerAnalistasMutual(true).then(() => {
        const modalEl = document.getElementById('modal-derivar-caso');
        if (modalEl && modalEl.classList.contains('open')) {
          poblarSelectAnalistasDestino(analistaActual, selectEl);
        }
      });
    }

    async function confirmarReasignacionCaso() {
      const session = getSession();
      const isAnalistaOAdmin = (session && (session.rol === 'Analista' || session.rol === 'Admin' || session.rol === 'Asesor Mutual'));
      if (!isAnalistaOAdmin) {
        showToast('Acceso restringido: Solo Analistas o Administradores pueden reasignar expedientes.');
        return;
      }

      const idSolicitud = document.getElementById('derivarCasoIdSolicitud')?.value;
      const nuevoAnalista = (document.getElementById('select-analista-destino')?.value || '').trim();
      const motivoRaw = (document.getElementById('txtMotivoDerivacion')?.value || '').trim();

      if (!idSolicitud) return;
      if (!nuevoAnalista) {
        showToast('⚠️ Seleccione el analista de destino para derivar el expediente.');
        return;
      }
      if (!motivoRaw) {
        showToast('⚠️ Ingrese el motivo de la derivación o instrucciones para el colega.');
        return;
      }
      if (!checkSubmitCooldown('btnConfirmarReasignacion', 2000)) return;

      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(idSolicitud));
      if (!s) return;

      const analistaAnterior = (s.analistaAsignado || s.Analista_Asignado || 'Sin Asignar').trim();
      if (analistaAnterior.toLowerCase() === nuevoAnalista.toLowerCase() && analistaAnterior.toLowerCase() !== 'sin asignar') {
        showToast('⚠️ El expediente ya se encuentra asignado a ' + nuevoAnalista + '. Elija otro analista destino.');
        return;
      }

      const motivoLimpio = sanitizeHTML(motivoRaw);
      const nowStr = obtenerFechaHora24hs();

      // 1. Actualizar propiedades analistaAsignado / Analista_Asignado y metadatos de derivación
      s.analistaAsignado = nuevoAnalista;
      s.Analista_Asignado = nuevoAnalista;
      s.ultimaDerivacion = {
        autor: session.nombre,
        analistaAnterior: analistaAnterior || 'Sin Asignar',
        destinatario: nuevoAnalista,
        motivo: motivoLimpio,
        fecha: nowStr
      };

      // 2. Registrar automáticamente entrada en observaciones / Historial_Comentarios_JSON
      if (!Array.isArray(s.observaciones)) s.observaciones = [];
      s.observaciones.push({
        fecha: nowStr,
        autor: session.nombre,
        rol: 'Analista',
        texto: 'Caso derivado a ' + nuevoAnalista + '. Motivo: ' + motivoLimpio
      });
      s.Historial_Comentarios_JSON = JSON.stringify(s.observaciones);

      saveStoredSolicitudes(all);

      // 3. Enviar petición de reasignación al Servidor Central
      const idDisplay = s.id_definitivo || s.id_provisorio || ('#' + s.id);
      const res = await callApi({
        action: 'reasignarAnalista',
        idSolicitud: s.id,
        id: s.id,
        id_provisorio: s.id_provisorio || '',
        id_definitivo: s.id_definitivo || '',
        nuevoAnalista: nuevoAnalista,
        Analista_Asignado: nuevoAnalista,
        analistaAnterior: analistaAnterior || 'Sin Asignar',
        motivo: motivoLimpio,
        autor: session.nombre,
        Historial_Comentarios_JSON: s.Historial_Comentarios_JSON
      }, {
        title: 'Derivando Expediente ' + idDisplay + '...',
        sub: 'Reasignando caso a ' + nuevoAnalista + ' y notificando al equipo'
      });

      cerrarModal('modal-derivar-caso');
      actualizarCentroNotificaciones();
      renderModuloMutualPropias();
      renderModuloMutual();
      renderModuloComercializador();
      actualizarContadorBoveda(s.id);
      verFichaCompleta(s.id);

      if (res && res.ok) {
        showToast('🔄 Expediente ' + idDisplay + ' derivado a ' + nuevoAnalista + ' con éxito ✓');
      } else {
        showToast('🔄 Expediente ' + idDisplay + ' reasignado a ' + nuevoAnalista + ' (Pendiente sync servidor)');
      }
    }

    /* ========================================================================
       7.A GESTIONES PROPIAS DE LA MUTUAL (SEDE CENTRAL, MOSTRADOR, WHATSAPP)
       ======================================================================== */
    function getListaFiltradaMutualPropias() {
      const session = getSession(); if (!session) return [];
      const all = getStoredSolicitudes();
      const visibles = filtrarSolicitudesParaBandeja(all, session);
      const miNombre = String(session.nombre || '').toLowerCase().trim();

      const q = (document.getElementById('filtroMutualPropiasTexto')?.value || '').toLowerCase().trim();
      const linea = document.getElementById('filtroMutualPropiasLinea')?.value || '';
      const fDesde = document.getElementById('filtroMutualPropiasFechaDesde')?.value || '';
      const fHasta = document.getElementById('filtroMutualPropiasFechaHasta')?.value || '';
      const est = document.getElementById('filtroMutualPropiasEstado')?.value || '';
      const canal = document.getElementById('filtroMutualPropiasCanal')?.value || '';
      const orgaTipo = document.getElementById('filtroMutualPropiasOrganismo')?.value || '';

      return visibles.filter(s => {
        const orgIdLow = String(s.organizacion_id || s.idOrganizacion || '').toLowerCase();
        const orgNomLow = String(s.nombre_organizacion || s.nombreOrganizacion || '').toLowerCase();
        const esSedeCentral = (
          orgIdLow === 'org_sede_central' ||
          orgIdLow === 'mutual-central' ||
          orgIdLow === 'ammer-central' ||
          orgNomLow === 'ammer' ||
          orgNomLow.includes('sede central') ||
          orgNomLow.includes('mutual modelo') ||
          s.origen_canal === 'Presencial Sede Central' ||
          s.origen_canal === 'WhatsApp Oficial' ||
          s.origen_canal === 'Telefónico' ||
          (s.comercializador && (s.comercializador.includes('Sede Central') || s.comercializador.includes('AMMER')))
        );
        const analistaAsig = String(s.analistaAsignado || s.Analista_Asignado || '').toLowerCase().trim();
        const estaAsignadoAMi = Boolean(miNombre && analistaAsig === miNombre);

        if (!esSedeCentral && !estaAsignadoAMi) return false;

        const idDef = (s.id_definitivo || '').toLowerCase();
        const idProv = (s.id_provisorio || '').toLowerCase();
        const matchQ = !q || String(s.id).includes(q) || idDef.includes(q) || idProv.includes(q) ||
          (s.solicitante?.dni && String(s.solicitante.dni).includes(q)) ||
          (s.solicitante?.nombre && s.solicitante.nombre.toLowerCase().includes(q)) ||
          (s.origen_canal && s.origen_canal.toLowerCase().includes(q)) ||
          (s.analistaAsignado && s.analistaAsignado.toLowerCase().includes(q));

        const matchLinea = matchLineaFiltro(s.prestamo, linea);
        const matchEst = !est || (s.estado === est || (est === 'En Análisis' && (s.estado === 'En Análisis' || s.estado === 'En Gestión' || s.estado === 'En Evaluación')));
        const matchCanal = !canal || (s.origen_canal === canal);
        const matchOrgaTipo = !orgaTipo || (s.solicitante?.organismo === orgaTipo);

        let matchFecha = true;
        if (fDesde || fHasta) {
          const sFecha = formatearFechaClaveLocal(obtenerFechaSolicitud(s));
          if (!sFecha || (fDesde && sFecha < fDesde) || (fHasta && sFecha > fHasta)) matchFecha = false;
        }

        return matchQ && matchLinea && matchEst && matchCanal && matchOrgaTipo && matchFecha;
      });
    }

    function renderModuloMutualPropias() {
      const filtered = getListaFiltradaMutualPropias();
      const lbl = document.getElementById('lblTotalMutualPropias');
      if (lbl) lbl.textContent = filtered.length + ' solicitudes sede central';
      const btnLimpiar = document.getElementById('btnLimpiarGestionesPruebasPropias');
      if (btnLimpiar) btnLimpiar.style.display = (typeof esAdminAuditoria === 'function' && esAdminAuditoria()) ? 'inline-flex' : 'none';

      const modo = vistaModulosState.mutualPropias || 'tabla';
      if (modo === 'tabla') renderTablaMutualPropias(filtered);
      else if (modo === 'kanban') renderKanbanModulo('mutualPropias', filtered);
      else if (modo === 'calendario') renderCalendarioModulo('mutualPropias', filtered);
    }

    function renderBotonVerValidacionExpediente(s) {
      if (typeof window.esAdminOAnalistaFirma !== 'function' || !window.esAdminOAnalistaFirma()) return '';
      if (typeof window.obtenerFirmaVinculadaAExpediente !== 'function') return '';
      const firma = window.obtenerFirmaVinculadaAExpediente(s);
      if (!firma) return '';
      const safeId = sanitizeHTML(String(s.id || s.id_provisorio || ''));
      const estFirma = String(firma.estado || 'PENDIENTE').toUpperCase();
      return '<button type="button" class="crm-btn-validacion" onclick="event.stopPropagation();if(typeof window.abrirValidacionFirmaExpediente===\'function\')window.abrirValidacionFirmaExpediente(\'' + safeId + '\');" title="Ver Ficha Completa de Firma y Evidencia (' + sanitizeHTML(estFirma) + ')">' +
        '<svg class="w-3.5 h-3.5 shrink-0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' +
        '<span>Ver Validación</span>' +
      '</button>';
    }

    function renderTablaMutualPropias(filtered) {
      const tbody = document.getElementById('tablaMutualPropiasBody'); if (!tbody) return;
      if (!filtered.length) {
        const msgVacio = (getStoredSolicitudes().length === 0)
          ? 'No se registran solicitudes en el período seleccionado. Presione "+ Nueva Solicitud" para iniciar un trámite.'
          : 'No se registran solicitudes en el período seleccionado.';
        renderHtmlPorLotes(tbody, '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);">' + msgVacio + '</td></tr>');
        return;
      }

      const rowsHtml = filtered.map(s => {
        const fechaStr = formatearFechaTabla24hs(s.fecha || s.Fecha_Registro);
        const idBadge = renderBadgeIdentificadorExpediente(s);

        const canalIcon = (s.origen_canal === 'WhatsApp Oficial') ? '💬 ' :
                          (s.origen_canal === 'Telefónico') ? '📞 ' : '🏛️ ';
        const canalTag = '<span style="display:inline-block;font-size:0.66rem;font-weight:700;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;padding:2px 7px;border-radius:5px;line-height:1.25;max-width:130px;">' +
          canalIcon + sanitizeHTML(s.origen_canal || 'Presencial Sede Central') + '</span>';

        const prop = s.propuestaMutual;
        const propHtml = prop && prop.activa ?
          '<div style="font-size:0.71rem;white-space:nowrap;"><span style="color:#166534;font-weight:700;">' + formatMoney(prop.monto) + '</span> (' + prop.cuotas + 'c) <span style="font-size:0.65rem;color:#0369a1;">· ' + sanitizeHTML(prop.estadoPropuesta || 'Oferta') + '</span></div>' :
          '<span style="font-size:0.69rem;color:var(--text-muted);">En evaluación</span>';

        const domHistTxt = sanitizeHTML(s.domicilio_historico || s.solicitante?.domicilio || 'Sin domicilio declarado');
        const cantObsDocs = (s.adjuntos || []).filter(a => a && a.observado).length +
          (s.requerimientosDocumentales || []).filter(r => r && !r.resuelto).length;
        const alertaDocHtml = cantObsDocs > 0
          ? '<div style="font-size:0.65rem;color:#b45309;font-weight:700;margin-top:2px;">⚠️ ' + cantObsDocs + ' alerta doc.</div>'
          : '';
        const docsCount = (s.archivosAdjuntos ? s.archivosAdjuntos.length : (s.adjuntos ? s.adjuntos.length : 0));
        const driveLinkHtml = (s.carpetaDriveUrl && esUsuarioMutualConAccesoDrive())
          ? '<a href="' + (sanitizeSafeUrl(s.carpetaDriveUrl) || '#') + '" target="_blank" rel="noopener noreferrer" class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Abrir Legajo Digital en Drive (' + docsCount + ' docs)" onclick="event.stopPropagation()">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>' +
              '<span data-boveda-count="1">' + docsCount + '</span>' +
            '</a>'
          : '<span class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Legajo Digital (' + docsCount + ' docs)">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>' +
              '<span data-boveda-count="1">' + docsCount + '</span>' +
            '</span>';

        return '<tr ondragover="handleDragOverExpedienteRow(event, this)" ondragleave="handleDragLeaveExpedienteRow(this, event)" ondrop="handleDropEnExpedienteItem(event, this, \'' + sanitizeHTML(String(s.id || '')) + '\')">' +
          '<td>' + idBadge + '<div style="font-size:0.67rem;color:#64748b;margin-top:3px;white-space:nowrap;">' + fechaStr + '</div></td>' +
          '<td>' + canalTag + '</td>' +
          '<td><div class="text-sm font-semibold text-slate-900">' + sanitizeHTML(s.solicitante?.nombre || '—') + '</div><div class="text-xs text-slate-500" style="margin-top:2px;"><span class="font-mono text-slate-600">DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + '</span> · <span class="cell-domicilio-hist" style="max-width:145px;" title="' + domHistTxt + '">📍 ' + domHistTxt + '</span></div></td>' +
          '<td><div class="text-xs font-mono font-bold text-slate-900" style="white-space:nowrap;">' + formatMoney(s.prestamo?.monto || 0) + ' <span class="font-semibold text-slate-500">(' + (s.prestamo?.cuotas || '—') + 'c)</span></div><div class="text-[11px] font-medium text-slate-500" style="margin-top:1px;">' + sanitizeHTML(s.prestamo?.lineaNombre || 'Ayuda') + ' · ' + sanitizeHTML(s.solicitante?.organismo || '—') + '</div></td>' +
          '<td>' + propHtml + '<div style="font-size:0.68rem;color:#64748b;margin-top:2px;">👤 ' + sanitizeHTML(s.analistaAsignado || 'Sin Asignar') + '</div></td>' +
          '<td><span class="badge-status badge-' + normalizarEstadoCanonico_(s.estado).replace(/\s/g, '') + '">' + sanitizeHTML(normalizarEstadoCanonico_(s.estado)) + '</span>' + alertaDocHtml + '</td>' +
          '<td style="text-align:center;"><div class="crm-actions-group">' +
            '<button type="button" class="btn-ver-expediente crm-btn-expediente" data-id="' + sanitizeHTML(String(s.id || '')) + '" data-id-provisorio="' + sanitizeHTML(String(s.id_provisorio || s.idProvisorio || s.id || '')) + '" title="Abrir Ficha del Expediente">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' +
              '<span>Ver Ficha</span>' +
            '</button>' +
            renderMenuAccionesFilaCrm_(s, driveLinkHtml, renderBotonVerValidacionExpediente(s)) +
          '</div></td>' +
          '</tr>';
      }).join('');
      renderHtmlPorLotes(tbody, rowsHtml);
    }

    function filtrarGestionesMutualPropias() {
      renderModuloMutualPropias();
    }

    /* ========================================================================
       7.B GESTIONES DE COMERCIALIZADORES & AUDITORÍA (TAB 3 - ANALISTAS & ADMIN)
       ======================================================================== */
    function getListaFiltradaMutual() {
      const session = getSession(); if (!session) return [];
      const all = getStoredSolicitudes();
      const visibles = filtrarSolicitudesParaBandeja(all, session);
      const q = (document.getElementById('filtroMutualTexto')?.value || '').toLowerCase().trim();
      const linea = document.getElementById('filtroMutualLinea')?.value || '';
      const fDesde = document.getElementById('filtroMutualFechaDesde')?.value || '';
      const fHasta = document.getElementById('filtroMutualFechaHasta')?.value || '';
      const est = document.getElementById('filtroMutualEstado')?.value || '';
      const org = document.getElementById('filtroMutualOrganizacion')?.value || '';
      const com = document.getElementById('filtroMutualComercial')?.value || '';
      const orgaTipo = document.getElementById('filtroMutualOrganismo')?.value || '';

      return visibles.filter(s => {
        // En Gestiones de Comercializadores mostramos las operaciones externas de comercializadores
        const esSedeCentral = (s.organizacion_id === 'org_sede_central' ||
          s.organizacion_id === 'MUTUAL-CENTRAL' ||
          s.organizacion_id === 'AMMER-CENTRAL' ||
          s.origen_canal === 'Presencial Sede Central' ||
          s.origen_canal === 'WhatsApp Oficial' ||
          s.origen_canal === 'Telefónico' ||
          (s.comercializador && s.comercializador.includes('Sede Central')));

        if (esSedeCentral && org !== 'Sede Central Mutual' && org !== 'Mutual Central' && org !== 'AMMER Central') {
          return false;
        }

        const idDef = (s.id_definitivo || '').toLowerCase();
        const idProv = (s.id_provisorio || '').toLowerCase();
        const matchQ = !q || String(s.id).includes(q) || idDef.includes(q) || idProv.includes(q) ||
          (s.solicitante?.dni && String(s.solicitante.dni).includes(q)) ||
          (s.solicitante?.nombre && s.solicitante.nombre.toLowerCase().includes(q)) ||
          (s.comercializador && s.comercializador.toLowerCase().includes(q)) ||
          (s.analistaAsignado && s.analistaAsignado.toLowerCase().includes(q));

        const matchLinea = matchLineaFiltro(s.prestamo, linea);
        const matchEst = !est || (s.estado === est || (est === 'En Análisis' && (s.estado === 'En Análisis' || s.estado === 'En Gestión' || s.estado === 'En Evaluación')));
        const matchOrg = !org || (s.nombre_organizacion || 'Organización Paraná Centro') === org;
        const matchCom = !com || s.comercializador === com;
        const matchOrgaTipo = !orgaTipo || (s.solicitante?.organismo === orgaTipo);

        let matchFecha = true;
        if (fDesde || fHasta) {
          const sFecha = formatearFechaClaveLocal(obtenerFechaSolicitud(s));
          if (!sFecha || (fDesde && sFecha < fDesde) || (fHasta && sFecha > fHasta)) matchFecha = false;
        }

        return matchQ && matchLinea && matchEst && matchOrg && matchCom && matchOrgaTipo && matchFecha;
      });
    }

    function renderModuloMutual() {
      const session = getSession();
      const all = session ? filtrarSolicitudesParaBandeja(getStoredSolicitudes(), session) : getStoredSolicitudes();
      const cboOrg = document.getElementById('filtroMutualOrganizacion');
      if (cboOrg && cboOrg.options.length <= 1) {
        const orgs = [...new Set(all.map(s => s.nombre_organizacion || 'Organización Paraná Centro').filter(Boolean))];
        poblarSelectPorLotes(cboOrg, orgs, cboOrg.options[0]?.textContent || 'Todas las Organizaciones', cboOrg.value);
      }
      const cboCom = document.getElementById('filtroMutualComercial');
      if (cboCom && cboCom.options.length <= 1) {
        const coms = [...new Set(all.map(s => s.comercializador).filter(Boolean))];
        poblarSelectPorLotes(cboCom, coms, cboCom.options[0]?.textContent || 'Todos los Asesores', cboCom.value);
      }

      const filtered = getListaFiltradaMutual();
      const lbl = document.getElementById('lblTotalMutual'); if (lbl) lbl.textContent = filtered.length + ' solicitudes en cartera';
      const btnLimpiar = document.getElementById('btnLimpiarGestionesPruebasComercial');
      if (btnLimpiar) btnLimpiar.style.display = (typeof esAdminAuditoria === 'function' && esAdminAuditoria()) ? 'inline-flex' : 'none';

      const modo = vistaModulosState.mutual;
      if (modo === 'tabla') renderTablaMutual(filtered);
      else if (modo === 'kanban') renderKanbanModulo('mutual', filtered);
      else if (modo === 'calendario') renderCalendarioModulo('mutual', filtered);
    }

    function renderTablaMutual(filtered) {
      const tbody = document.getElementById('tablaMutualBody'); if (!tbody) return;
      if (!filtered.length) {
        const msgVacio = (getStoredSolicitudes().length === 0)
          ? 'No se registran solicitudes en el período seleccionado. Presione "+ Nueva Solicitud" para iniciar un trámite.'
          : 'No se registran solicitudes en el período seleccionado.';
        renderHtmlPorLotes(tbody, '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);">' + msgVacio + '</td></tr>');
        return;
      }

      const rowsHtml = filtered.map(s => {
        const fechaStr = formatearFechaTabla24hs(s.fecha || s.Fecha_Registro);
        const idBadge = renderBadgeIdentificadorExpediente(s);

        const prop = s.propuestaMutual;
        const propHtml = prop && prop.activa ?
          '<div style="font-size:0.71rem;white-space:nowrap;"><span style="color:#166534;font-weight:700;">' + formatMoney(prop.monto) + '</span> (' + prop.cuotas + 'c) <span style="font-size:0.65rem;color:#0369a1;">· ' + sanitizeHTML(prop.estadoPropuesta || 'Oferta') + '</span></div>' :
          '<span style="font-size:0.69rem;color:var(--text-muted);">En evaluación</span>';

        const domHistTxt = sanitizeHTML(s.domicilio_historico || s.solicitante?.domicilio || 'Sin domicilio declarado');
        const cantObsDocs = (s.adjuntos || []).filter(a => a && a.observado).length +
          (s.requerimientosDocumentales || []).filter(r => r && !r.resuelto).length;
        const alertaDocHtml = cantObsDocs > 0
          ? '<div style="font-size:0.65rem;color:#b45309;font-weight:700;margin-top:2px;">⚠️ ' + cantObsDocs + ' alerta doc.</div>'
          : '';
        const docsCount = (s.archivosAdjuntos ? s.archivosAdjuntos.length : (s.adjuntos ? s.adjuntos.length : 0));
        const driveLinkHtml = (s.carpetaDriveUrl && esUsuarioMutualConAccesoDrive())
          ? '<a href="' + (sanitizeSafeUrl(s.carpetaDriveUrl) || '#') + '" target="_blank" rel="noopener noreferrer" class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Abrir Legajo Digital en Drive (' + docsCount + ' docs)" onclick="event.stopPropagation()">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>' +
              '<span data-boveda-count="1">' + docsCount + '</span>' +
            '</a>'
          : '<span class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Legajo Digital (' + docsCount + ' docs)">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>' +
              '<span data-boveda-count="1">' + docsCount + '</span>' +
            '</span>';

        return '<tr ondragover="handleDragOverExpedienteRow(event, this)" ondragleave="handleDragLeaveExpedienteRow(this, event)" ondrop="handleDropEnExpedienteItem(event, this, \'' + sanitizeHTML(String(s.id || '')) + '\')">' +
          '<td>' + idBadge + '<div style="font-size:0.67rem;color:#64748b;margin-top:3px;white-space:nowrap;">' + fechaStr + '</div></td>' +
          '<td><div style="font-weight:700;color:#0f172a;font-size:0.74rem;">' + sanitizeHTML(s.comercializador || '—') + '</div><span class="badge-org-tag" style="display:inline-block;margin-top:2px;white-space:nowrap;">' + sanitizeHTML(s.nombre_organizacion || 'Paraná Centro') + '</span></td>' +
          '<td><div class="text-sm font-semibold text-slate-900">' + sanitizeHTML(s.solicitante?.nombre || '—') + '</div><div class="text-xs text-slate-500" style="margin-top:2px;"><span class="font-mono text-slate-600">DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + '</span> · <span class="cell-domicilio-hist" style="max-width:145px;" title="' + domHistTxt + '">📍 ' + domHistTxt + '</span></div></td>' +
          '<td><div class="text-xs font-mono font-bold text-slate-900" style="white-space:nowrap;">' + formatMoney(s.prestamo?.monto || 0) + ' <span class="font-semibold text-slate-500">(' + (s.prestamo?.cuotas || '—') + 'c)</span></div><div class="text-[11px] font-medium text-slate-500" style="margin-top:1px;">' + sanitizeHTML(s.prestamo?.lineaNombre || 'Ayuda') + ' · ' + sanitizeHTML(s.solicitante?.organismo || '—') + '</div></td>' +
          '<td>' + propHtml + '<div style="font-size:0.68rem;color:#64748b;margin-top:2px;">👤 ' + sanitizeHTML(s.analistaAsignado || 'Sin Asignar') + '</div></td>' +
          '<td><span class="badge-status badge-' + normalizarEstadoCanonico_(s.estado).replace(/\s/g, '') + '">' + sanitizeHTML(normalizarEstadoCanonico_(s.estado)) + '</span>' + alertaDocHtml + '</td>' +
          '<td style="text-align:center;"><div class="crm-actions-group">' +
            '<button type="button" class="btn-ver-expediente crm-btn-expediente" data-id="' + sanitizeHTML(String(s.id || '')) + '" data-id-provisorio="' + sanitizeHTML(String(s.id_provisorio || s.idProvisorio || s.id || '')) + '" title="Abrir Ficha del Expediente">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' +
              '<span>Ver Ficha</span>' +
            '</button>' +
            renderMenuAccionesFilaCrm_(s, driveLinkHtml, renderBotonVerValidacionExpediente(s)) +
          '</div></td>' +
          '</tr>';
      }).join('');
      renderHtmlPorLotes(tbody, rowsHtml);
    }

    function filtrarGestionesMutual() { renderModuloMutual(); }

    function gestionarSolicitudMutual(id) {
      verFichaCompleta(id);
    }

    async function actualizarEstadoSolicitud(id) {
      const all = getStoredSolicitudes(); const s = all.find(x => String(x.id) === String(id)); if (!s) return;
      const nuevo = document.getElementById('cboNuevoEstado')?.value; if (!nuevo) return;
      const session = getSession();
      s.estado = nuevo;
      if (!s.analistaAsignado || s.analistaAsignado === 'Sin Asignar') {
        s.analistaAsignado = session?.nombre || 'Analista Sede Central';
        s.Analista_Asignado = s.analistaAsignado;
      }
      const now = obtenerFechaHora24hs();

      if (!s.observaciones) s.observaciones = [];
      s.observaciones.push({
        autor: session?.nombre || 'Analista Mutual', rol: 'Analista Mutual',
        fecha: now, texto: 'Estado de la solicitud actualizado a: ' + nuevo
      });

      const res = await _actualizarEstadoCanonicoConFallback(
        s.id,
        nuevo,
        s.analistaAsignado || session?.nombre || 'Analista Mutual',
        'Estado de la solicitud actualizado a: ' + nuevo
      );

      saveStoredSolicitudes(all);
      renderModuloMutualPropias();
      renderModuloMutual();
      renderModuloComercializador();
      actualizarCentroNotificaciones();
      actualizarContadorBoveda(s.id);
      showToast('Estado actualizado a ' + nuevo + ' en Servidor Central ✓');
      gestionarSolicitudMutual(id);
    }

    /* ========================================================================
       8. TABLERO KANBAN OPTIMIZADO (4 MACRO-ETAPAS, CERO SCROLL LATERAL)
       ======================================================================== */
    const MACRO_ETAPAS_KANBAN = [
      {
        id: 'solicitados',
        label: 'SOLICITADOS',
        emoji: '🟡',
        headerBg: '#fef9c3',
        headerColor: '#854d0e',
        border: '#fde047',
        match: (st) => st === 'Pendiente' || st === 'Ingresado'
      },
      {
        id: 'en_gestion',
        label: 'EN GESTIÓN',
        emoji: '🔵',
        headerBg: '#dbeafe',
        headerColor: '#1e40af',
        border: '#93c5fd',
        match: (st) => st === 'En Análisis' || st === 'Observado' || st === 'Propuesta Enviada'
      },
      {
        id: 'rechazados',
        label: 'RECHAZADOS',
        emoji: '🔴',
        headerBg: '#fee2e2',
        headerColor: '#991b1b',
        border: '#fca5a5',
        match: (st) => st === 'Rechazado'
      },
      {
        id: 'aprobados',
        label: 'APROBADOS',
        emoji: '🟢',
        headerBg: '#dcfce7',
        headerColor: '#166534',
        border: '#86efac',
        match: (st) => st === 'Aprobado' || st === 'Transferencia Pendiente' || st === 'Transferencia' || st === 'Liquidado'
      }
    ];

    function normalizarEstadoCanonico_(estado) {
      const raw = String(estado || 'Pendiente').trim();
      const up = raw.toUpperCase();
      if (up === 'APROBADO') return 'Aprobado';
      if (up === 'RECHAZADO') return 'Rechazado';
      if (up === 'PENDIENTE') return 'Pendiente';
      if (up === 'OBSERVADO') return 'Observado';
      if (up === 'LIQUIDADO') return 'Liquidado';
      if (up === 'EN ANÁLISIS' || up === 'EN ANALISIS') return 'En Análisis';
      if (up === 'TRANSFERENCIA PENDIENTE') return 'Transferencia Pendiente';
      return raw || 'Pendiente';
    }
    window.normalizarEstadoCanonico_ = normalizarEstadoCanonico_;

    function obtenerSubEstadoBadge(estado) {
      const e = normalizarEstadoCanonico_(estado);
      let cssClass = 'badge-Pendiente';
      if (e === 'En Análisis') cssClass = 'badge-EnAnalisis';
      else if (e === 'Observado') cssClass = 'badge-Observado';
      else if (e === 'Propuesta Enviada') cssClass = 'badge-EnAnalisis';
      else if (e === 'Aprobado') cssClass = 'badge-Aprobado';
      else if (e === 'Transferencia Pendiente' || e === 'Transferencia') cssClass = 'badge-Transferencia';
      else if (e === 'Liquidado') cssClass = 'badge-Liquidado';
      else if (e === 'Rechazado') cssClass = 'badge-Rechazado';
      return '<span class="badge-status ' + cssClass + '" style="font-size:0.62rem;padding:2px 6px;">' + e + '</span>';
    }

    function renderKanbanModulo(moduloKey, list) {
      const containerId = (moduloKey === 'comercializador') ? 'kanbanComercialBoard' :
                          (moduloKey === 'mutualPropias') ? 'kanbanMutualPropiasBoard' : 'kanbanMutualBoard';
      const board = document.getElementById(containerId); if (!board) return;

      board.innerHTML = MACRO_ETAPAS_KANBAN.map(etapa => {
        const cards = list.filter(s => etapa.match(s.estado));
        const cardsHtml = cards.length ? cards.map(s => {
          const idBadge = s.id_definitivo ?
            '<span class="badge-definitivo">' + sanitizeHTML(s.id_definitivo) + '</span>' :
            '<span class="badge-provisorio">' + sanitizeHTML(s.id_provisorio || ('#' + s.id)) + '</span>';
          const subBadge = obtenerSubEstadoBadge(s.estado);
          const lineaNombre = s.prestamo?.lineaNombre || 'Ayuda Económica';
          const asesorOrg = (s.comercializador || 'Asesor') + ' • ' + (s.nombre_organizacion || 'Paraná Centro');
          const domHistTxt = sanitizeHTML(s.domicilio_historico || s.solicitante?.domicilio || 'Sin domicilio declarado');
          const cantObsDocs = (s.adjuntos || []).filter(a => a && a.observado).length +
            (s.requerimientosDocumentales || []).filter(r => r && !r.resuelto).length;
          const docsCount = (s.archivosAdjuntos ? s.archivosAdjuntos.length : (s.adjuntos ? s.adjuntos.length : 0));
          const driveBtn = (s.carpetaDriveUrl && esUsuarioMutualConAccesoDrive())
            ? '<a href="' + (sanitizeSafeUrl(s.carpetaDriveUrl) || '#') + '" target="_blank" rel="noopener noreferrer" class="badge-drive-mini" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" onclick="event.stopPropagation()">📂 Bóveda Digital (' + docsCount + ')</a>'
            : '<span style="font-size:0.64rem;color:var(--text-muted);" data-boveda-id="' + sanitizeHTML(String(s.id)) + '">📎 ' + docsCount + ' docs</span>';

          return '<div class="kanban-card" onclick="verFichaCompleta(\'' + sanitizeHTML(String(s.id || '')) + '\')" ondragover="handleDragOverExpedienteRow(event, this)" ondragleave="handleDragLeaveExpedienteRow(this, event)" ondrop="handleDropEnExpedienteItem(event, this, \'' + sanitizeHTML(String(s.id || '')) + '\')">' +
            '<div class="kanban-card-top">' +
              idBadge +
              subBadge +
            '</div>' +
            '<div class="kanban-card-title">' + sanitizeHTML(s.solicitante?.nombre || 'Sin nombre registrado') + ' <span style="font-size:0.65rem;font-weight:500;color:var(--text-muted);">DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + '</span></div>' +
            '<div class="kanban-card-meta">' + sanitizeHTML(lineaNombre) + '</div>' +
            '<div class="cell-domicilio-hist" style="max-width:100%;" title="' + domHistTxt + '">📍 ' + domHistTxt + '</div>' +
            '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + sanitizeHTML(asesorOrg) + '">' +
              '👤 ' + sanitizeHTML(asesorOrg) +
            '</div>' +
            (cantObsDocs > 0 ? '<div style="font-size:0.64rem;color:#b45309;font-weight:700;margin-top:3px;">⚠️ ' + cantObsDocs + ' alerta documental</div>' : '') +
            '<div class="kanban-card-foot">' +
              '<span style="font-weight:700;color:var(--color-brand-blue);font-size:0.75rem;">' + formatMoney(s.prestamo?.monto || 0) + ' (' + (s.prestamo?.cuotas || '—') + 'c)</span>' +
              '<div style="display:flex;align-items:center;gap:0.35rem;">' +
                '<button type="button" class="crm-btn-upload-lote" style="padding:2px 6px;font-size:0.65rem;" onclick="event.stopPropagation();abrirModalSubirLoteExpediente(\'' + sanitizeHTML(String(s.id || '')) + '\')" title="Subir documentación por lote o arrastrar archivos a la tarjeta">📤 Docs</button>' +
                driveBtn +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') : '<div style="font-size:0.7rem;color:var(--text-muted);text-align:center;padding:1.5rem 0.5rem;font-style:italic;">Sin solicitudes en esta etapa</div>';

        return '<div class="kanban-col">' +
          '<div class="kanban-col-header" style="background:' + etapa.headerBg + ';color:' + etapa.headerColor + ';border-color:' + etapa.border + ';">' +
            '<span style="display:flex;align-items:center;gap:4px;">' + etapa.emoji + ' ' + etapa.label + '</span>' +
            '<span style="background:#fff;padding:1px 6px;border-radius:10px;font-size:0.68rem;border:1px solid ' + etapa.border + ';font-weight:800;color:var(--text-main);">' + cards.length + '</span>' +
          '</div>' +
          '<div class="kanban-cards-box">' + cardsHtml + '</div>' +
        '</div>';
      }).join('');
    }

    /* ========================================================================
       9. CALENDARIO MENSUAL CONMUTABLE
       ======================================================================== */
    const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    function parsearFechaGestion(fechaStr) {
      if (!fechaStr) return null;
      if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) return fechaStr;

      const str = String(fechaStr).trim();
      if (!str) return null;

      // Caso 1: Formato argentino "DD/MM/YYYY, HH:mm:ss", "DD/MM/YYYY HH:mm" o "DD/MM/YYYY"
      const soloFechaSlash = str.split(',')[0].trim().split(/\s+/)[0];
      const partesFecha = soloFechaSlash.split('/');
      if (partesFecha.length === 3) {
        const dia = parseInt(partesFecha[0], 10);
        const mes = parseInt(partesFecha[1], 10) - 1;
        let anio = parseInt(partesFecha[2], 10);
        if (anio > 0 && anio < 100) anio += 2000;
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio) && mes >= 0 && mes <= 11 && dia >= 1 && dia <= 31) {
          const d = new Date(anio, mes, dia);
          if (!isNaN(d.getTime()) && d.getFullYear() === anio && d.getMonth() === mes && d.getDate() === dia) {
            return d;
          }
        }
      }

      // Caso 2: Formato ISO local "YYYY-MM-DD" o "YYYY-MM-DD HH:mm(:ss)" sin zona horaria
      const isoLocalMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
      if (isoLocalMatch) {
        const anio = parseInt(isoLocalMatch[1], 10);
        const mes = parseInt(isoLocalMatch[2], 10) - 1;
        const dia = parseInt(isoLocalMatch[3], 10);
        const hh = isoLocalMatch[4] ? parseInt(isoLocalMatch[4], 10) : 0;
        const mm = isoLocalMatch[5] ? parseInt(isoLocalMatch[5], 10) : 0;
        const ss = isoLocalMatch[6] ? parseInt(isoLocalMatch[6], 10) : 0;
        const d = new Date(anio, mes, dia, hh, mm, ss);
        if (!isNaN(d.getTime())) return d;
      }

      // Caso 3: Formato ISO con Z/offset o Date.toString() devuelto por el Servidor Central
      const dIso = new Date(str);
      if (!isNaN(dIso.getTime())) return dIso;

      return null;
    }

    function obtenerFechaSolicitud(s) {
      if (!s || typeof s !== 'object') return null;
      const candidatos = [
        s.fecha,
        s.Fecha_Registro,
        s.fechaRegistro,
        s.Fecha,
        s.createdAt,
        s.fechaCreacion,
        s.ultimaActualizacion,
        s.Ultima_Actualizacion
      ];
      for (const cand of candidatos) {
        const parsed = parsearFechaGestion(cand);
        if (parsed) return parsed;
      }
      return null;
    }

    function formatearFechaClaveLocal(d) {
      if (!(d instanceof Date) || isNaN(d.getTime())) return '';
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function renderCalendarioModulo(moduloKey, listaOpcional) {
      let mod = moduloKey;
      if (mod === 'comercial') mod = 'comercializador';
      if (!mod) {
        if (document.getElementById('view-mutual-propias')?.classList.contains('active')) mod = 'mutualPropias';
        else if (document.getElementById('view-mutual')?.classList.contains('active')) mod = 'mutual';
        else mod = 'comercializador';
      }

      const prop = (mod === 'comercializador') ? 'calDateComercializador' :
                   (mod === 'mutualPropias') ? 'calDateMutualPropias' : 'calDateMutual';
      const curDate = vistaModulosState[prop] instanceof Date && !isNaN(vistaModulosState[prop].getTime())
        ? vistaModulosState[prop]
        : new Date();
      const year = curDate.getFullYear();
      const month = curDate.getMonth();

      const titleId = (mod === 'comercializador') ? 'calComMonthTitle' :
                      (mod === 'mutualPropias') ? 'calMutPropMonthTitle' : 'calMutMonthTitle';
      const gridId = (mod === 'comercializador') ? 'gridComercialCalendario' :
                     (mod === 'mutualPropias') ? 'gridMutualPropiasCalendario' : 'gridMutualCalendario';

      const titEl = document.getElementById(titleId);
      if (titEl) titEl.textContent = NOMBRES_MESES[month] + ' ' + year;

      const gridEl = document.getElementById(gridId); if (!gridEl) return;
      const solicitudes = Array.isArray(listaOpcional)
        ? listaOpcional
        : ((mod === 'comercializador') ? getListaFiltradaComercializador() :
           (mod === 'mutualPropias') ? getListaFiltradaMutualPropias() : getListaFiltradaMutual());

      const eventosPorDia = {};
      (solicitudes || []).forEach(s => {
        const d = obtenerFechaSolicitud(s);
        if (!d) return;
        const clave = formatearFechaClaveLocal(d);
        if (!clave) return;
        if (!eventosPorDia[clave]) eventosPorDia[clave] = [];
        eventosPorDia[clave].push(s);
      });

      const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      let html = daysOfWeek.map(d => '<div class="calendar-head-cell">' + d + '</div>').join('');

      const firstDayOfMonth = new Date(year, month, 1);
      const startingDay = (firstDayOfMonth.getDay() + 6) % 7; // Lunes = 0
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrevMonth = new Date(year, month, 0).getDate();

      const today = new Date();
      const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);

      // Días mes previo
      for (let i = 0; i < startingDay; i++) {
        const num = daysInPrevMonth - startingDay + i + 1;
        html += '<div class="calendar-day-cell other-month"><div class="calendar-day-num">' + num + '</div></div>';
      }

      // Días del mes
      for (let day = 1; day <= daysInMonth; day++) {
        const dayDateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const isToday = isCurrentMonth && (today.getDate() === day);
        const events = eventosPorDia[dayDateStr] || [];

        const evsHtml = events.map(s => {
          const st = String(s.estado || s.Estado_Tramite || 'Pendiente').trim();
          const bg = (st === 'Aprobado' || st === 'Liquidado') ? '#dcfce7' :
                     (st === 'Observado') ? '#ffedd5' :
                     (st === 'Rechazado') ? '#fee2e2' :
                     (st === 'En Análisis') ? '#dbeafe' : '#fef9c3';
          const fg = (st === 'Aprobado' || st === 'Liquidado') ? '#166534' :
                     (st === 'Observado') ? '#9a3412' :
                     (st === 'Rechazado') ? '#991b1b' :
                     (st === 'En Análisis') ? '#1e40af' : '#854d0e';
          const rawId = s.id || s.idSolicitud || s.ID_Solicitud || s.id_definitivo || s.id_provisorio || '';
          const idLabel = s.id_definitivo || s.ID_Definitivo || s.id_provisorio || s.ID_Solicitud || ('#' + rawId);
          const nombreFull = String((s.solicitante?.nombre && s.solicitante.nombre !== 'Socio' ? s.solicitante.nombre : '') || s.Apellido_Nombre || s.Nombre_Apellido || s.nombre || s.titular || s.solicitante?.nombre || 'Socio').trim();
          const nombreCorto = nombreFull.split(/\s+/)[0] || 'Socio';
          const titleTip = sanitizeHTML(nombreFull + ' - ' + st);
          return '<div class="calendar-event-chip" style="background:' + bg + ';color:' + fg + ';" onclick="verFichaCompleta(\'' + sanitizeHTML(String(rawId)) + '\')" title="' + titleTip + '">' +
            '<strong>' + sanitizeHTML(idLabel) + '</strong> ' + sanitizeHTML(nombreCorto) +
          '</div>';
        }).join('');

        html += '<div class="calendar-day-cell ' + (isToday ? 'is-today' : '') + '">' +
          '<div class="calendar-day-num"><span>' + day + '</span>' + (events.length ? '<span style="font-size:0.6rem;color:var(--text-muted);">' + events.length + ' sol.</span>' : '') + '</div>' +
          evsHtml +
        '</div>';
      }

      renderHtmlPorLotes(gridEl, html);
    }

    const renderizarCalendarioGestiones = renderCalendarioModulo;

