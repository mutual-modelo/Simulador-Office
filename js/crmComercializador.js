    /* ========================================================================
       4. ESTADO DE VISTAS CONMUTABLES (TABLA, KANBAN, CALENDARIO)
       ======================================================================== */
    const vistaModulosState = {
      comercializador: 'tabla', // 'tabla' | 'kanban' | 'calendario'
      mutualPropias: 'tabla',
      mutual: 'tabla',
      calDateComercializador: new Date(),
      calDateMutualPropias: new Date(),
      calDateMutual: new Date()
    };

    function setVistaModulo(moduloKey, modo) {
      if (modo === undefined && (moduloKey === 'auditoria' || moduloKey === 'tabla' || moduloKey === 'kanban' || moduloKey === 'calendario')) {
        modo = moduloKey;
        moduloKey = 'mutual';
      }
      if (modo === 'auditoria' || moduloKey === 'auditoria-ia') {
        cambiarVistaPrincipal('auditoria-ia');
        return;
      }
      vistaModulosState[moduloKey] = modo;
      if (moduloKey === 'comercializador') {
        document.querySelectorAll('#view-comercializador .view-switcher-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('btnViewCom-' + modo)?.classList.add('active');
        document.getElementById('wrapperComercialTabla').style.display = (modo === 'tabla') ? 'block' : 'none';
        document.getElementById('wrapperComercialKanban').style.display = (modo === 'kanban') ? 'block' : 'none';
        document.getElementById('wrapperComercialCalendario').style.display = (modo === 'calendario') ? 'block' : 'none';
        renderModuloComercializador();
      } else if (moduloKey === 'mutualPropias') {
        document.querySelectorAll('#view-mutual-propias .view-switcher-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('btnViewMutProp-' + modo)?.classList.add('active');
        document.getElementById('wrapperMutualPropiasTabla').style.display = (modo === 'tabla') ? 'block' : 'none';
        document.getElementById('wrapperMutualPropiasKanban').style.display = (modo === 'kanban') ? 'block' : 'none';
        document.getElementById('wrapperMutualPropiasCalendario').style.display = (modo === 'calendario') ? 'block' : 'none';
        renderModuloMutualPropias();
      } else {
        document.querySelectorAll('#view-mutual .view-switcher-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('btnViewMut-' + modo)?.classList.add('active');
        document.getElementById('wrapperMutualTabla').style.display = (modo === 'tabla') ? 'block' : 'none';
        document.getElementById('wrapperMutualKanban').style.display = (modo === 'kanban') ? 'block' : 'none';
        document.getElementById('wrapperMutualCalendario').style.display = (modo === 'calendario') ? 'block' : 'none';
        renderModuloMutual();
      }
    }

    function cambiarVista(moduloKey, modo) {
      setVistaModulo(moduloKey, modo);
    }

    function matchLineaFiltro(prestamo, filtroLinea) {
      if (!filtroLinea) return true;
      if (!prestamo) return false;
      const l = String(prestamo.linea || '').toLowerCase().trim();
      const ln = String(prestamo.lineaNombre || '').toLowerCase().trim();
      const f = String(filtroLinea).toLowerCase().trim();
      if (f.includes('fedem')) {
        return l.includes('fedem') || ln.includes('fedem') || l === 'fedem';
      }
      if (f.includes('quad') || f.includes('muni')) {
        return l.includes('muni') || l.includes('quad') || ln.includes('muni') || ln.includes('quad');
      }
      if (f.includes('sidecreer')) {
        return l.includes('sidecreer') || ln.includes('sidecreer');
      }
      return l === f || ln === f;
    }

    function limpiarFiltros(modulo) {
      if (modulo === 'comercializador') {
        const ids = ['filtroComercialTexto', 'filtroComercialLinea', 'filtroComercialEstado', 'filtroComercialAsesor', 'filtroComercialFechaDesde', 'filtroComercialFechaHasta'];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        filtrarGestionesComercializador();
      } else if (modulo === 'mutualPropias') {
        const ids = ['filtroMutualPropiasTexto', 'filtroMutualPropiasLinea', 'filtroMutualPropiasEstado', 'filtroMutualPropiasCanal', 'filtroMutualPropiasOrganismo', 'filtroMutualPropiasFechaDesde', 'filtroMutualPropiasFechaHasta'];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        filtrarGestionesMutualPropias();
      } else if (modulo === 'mutual') {
        const ids = ['filtroMutualTexto', 'filtroMutualLinea', 'filtroMutualEstado', 'filtroMutualOrganizacion', 'filtroMutualComercial', 'filtroMutualOrganismo', 'filtroMutualFechaDesde', 'filtroMutualFechaHasta'];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        filtrarGestionesMutual();
      }
    }

    function navegarCalendario(moduloKey, delta) {
      const prop = (moduloKey === 'comercializador') ? 'calDateComercializador' :
                   (moduloKey === 'mutualPropias') ? 'calDateMutualPropias' : 'calDateMutual';
      if (delta === 0) {
        vistaModulosState[prop] = new Date();
      } else {
        const d = new Date(vistaModulosState[prop]);
        d.setMonth(d.getMonth() + delta);
        vistaModulosState[prop] = d;
      }
      if (moduloKey === 'comercializador') renderCalendarioModulo('comercializador');
      else if (moduloKey === 'mutualPropias') renderCalendarioModulo('mutualPropias');
      else renderCalendarioModulo('mutual');
    }

    /* ========================================================================
       4.B REGLAS DE VISIBILIDAD Y PERMISOS (RBAC EN BANDEJAS)
       ======================================================================== */
    function filtrarSolicitudesParaBandeja(solicitudes, usuarioActual) {
      if (!Array.isArray(solicitudes) || !usuarioActual) return [];
      const rol = String(usuarioActual.rol || '').toLowerCase().trim();
      const userId = String(usuarioActual.id || usuarioActual.usuario_id || usuarioActual.idUsuario || '').trim();
      const miNombre = String(usuarioActual.nombre || '').toLowerCase().trim();
      const userOrgId = String(usuarioActual.organizacion_id || usuarioActual.idOrganizacion || '').trim();

      return solicitudes.filter(sol => {
        if (!sol) return false;
        // 1. El Admin ve el 100%
        if (rol === 'admin' || rol === 'administrador') {
          return true;
        }

        const solAsesorId = String(sol.usuario_id || sol.idAsesor || sol.idUsuarioAsesor || sol.ID_Usuario_Asesor || '').trim();
        const analistaAsignado = String(sol.analistaAsignado || sol.Analista_Asignado || '').toLowerCase().trim();
        const origenCanal = String(sol.origen_canal || sol.origenCanal || sol.Origen_Canal || '').toLowerCase();
        const orgIdSol = String(sol.organizacion_id || sol.idOrganizacion || sol.ID_Organizacion || '').toLowerCase();
        const comercializadorLower = String(sol.comercializador || '').toLowerCase().trim();

        // 2. El Analista / Personal Interno Mutual ve toda la cartera (Sede Central + Red Comercial)
        if (rol === 'analista' || rol.includes('analista') || rol.includes('asesor mutual')) {
          return true;
        }

        // 3. El Titular de Organización ve todas las de su Organización
        if (usuarioActual.esTitular === true || usuarioActual.es_titular_organizacion === true || rol.includes('titular')) {
          const rawOrgSol = String(sol.organizacion_id || sol.idOrganizacion || sol.ID_Organizacion || '').toLowerCase().trim();
          const rawOrgNomSol = String(sol.nombre_organizacion || sol.nombreOrganizacion || sol.Nombre_Organizacion || '').toLowerCase().trim();
          const userOrgNom = String(usuarioActual.nombre_organizacion || usuarioActual.nombreOrganizacion || '').toLowerCase().trim();
          return (userOrgId && rawOrgSol === userOrgId.toLowerCase()) || (userOrgNom && rawOrgNomSol === userOrgNom);
        }

        // 4. El Asesor Comercial solo ve sus propias solicitudes creadas
        const solNombreClean = comercializadorLower.replace(/\s*\(sede central\)\s*/gi, '').trim();
        return Boolean(
          (userId && solAsesorId && solAsesorId === userId) ||
          (miNombre && (comercializadorLower === miNombre || solNombreClean === miNombre))
        );
      });
    }

    /* ========================================================================
       5. GESTIONES DEL COMERCIALIZADOR (TAB 2)
       ======================================================================== */
    function getListaFiltradaComercializador() {
      const session = getSession(); if (!session) return [];
      const all = getStoredSolicitudes();
      const isTitular = !!session.es_titular_organizacion;
      const isAdmin = (session.rol === 'Admin');

      const list = filtrarSolicitudesParaBandeja(all, session);

      const q = (document.getElementById('filtroComercialTexto')?.value || '').toLowerCase().trim();
      const linea = document.getElementById('filtroComercialLinea')?.value || '';
      const fDesde = document.getElementById('filtroComercialFechaDesde')?.value || '';
      const fHasta = document.getElementById('filtroComercialFechaHasta')?.value || '';
      const est = document.getElementById('filtroComercialEstado')?.value || '';
      const cboAsesor = document.getElementById('filtroComercialAsesor');
      const filAsesor = (cboAsesor && (isTitular || isAdmin)) ? cboAsesor.value : '';

      return list.filter(s => {
        const idDef = (s.id_definitivo || '').toLowerCase();
        const idProv = (s.id_provisorio || '').toLowerCase();
        const matchQ = !q || String(s.id).includes(q) || idDef.includes(q) || idProv.includes(q) ||
          (s.solicitante?.dni && String(s.solicitante.dni).includes(q)) ||
          (s.solicitante?.nombre && s.solicitante.nombre.toLowerCase().includes(q)) ||
          (s.comercializador && s.comercializador.toLowerCase().includes(q));

        const matchLinea = matchLineaFiltro(s.prestamo, linea);
        const matchEst = !est || (s.estado === est || (est === 'En Análisis' && (s.estado === 'En Análisis' || s.estado === 'En Gestión' || s.estado === 'En Evaluación')));
        const matchAsesor = !filAsesor || s.comercializador === filAsesor;

        let matchFecha = true;
        if (fDesde || fHasta) {
          const sFecha = formatearFechaClaveLocal(obtenerFechaSolicitud(s));
          if (!sFecha || (fDesde && sFecha < fDesde) || (fHasta && sFecha > fHasta)) matchFecha = false;
        }

        return matchQ && matchLinea && matchEst && matchAsesor && matchFecha;
      });
    }

    function renderModuloComercializador() {
      const session = getSession(); if (!session) return;
      const isTitular = !!session.es_titular_organizacion;
      const isAdmin = (session.rol === 'Admin');

      const thAsesor = document.getElementById('colHeadAsesor');
      const cboAsesor = document.getElementById('filtroComercialAsesor');
      const wrapAsesor = document.getElementById('wrapFiltroComercialAsesor');
      const showAsesorCol = (isTitular || isAdmin);
      if (thAsesor) thAsesor.style.display = showAsesorCol ? '' : 'none';
      if (wrapAsesor) wrapAsesor.style.display = showAsesorCol ? 'flex' : 'none';

      const titMod = document.getElementById('lblTituloModuloComercial');
      const subMod = document.getElementById('lblSubtituloModuloComercial');
      if (titMod && subMod) {
        if (isTitular && !isAdmin) {
          titMod.innerHTML = '🏢 Gestiones de ' + (session.nombre_organizacion || 'la Organización') + ' <span style="font-size:0.75rem;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;font-weight:700;">Vista Titular</span>';
          subMod.textContent = 'Control de solicitudes propias y de todos los asesores asignados a tu organización.';
        } else {
          titMod.textContent = '📁 Mis Gestiones de Ayudas Económicas';
          subMod.textContent = 'Registro, carga de documentación y seguimiento de solicitudes originadas.';
        }
      }

      if (cboAsesor && showAsesorCol) {
        cboAsesor.style.display = '';
        const all = getStoredSolicitudes();
        const list = isAdmin ? all : all.filter(s => s.organizacion_id === session.organizacion_id);
        const currentVal = cboAsesor.value;
        const asesores = [...new Set(list.map(s => s.comercializador).filter(Boolean))];
        poblarSelectPorLotes(cboAsesor, asesores, 'Todos los Asesores (' + asesores.length + ')', currentVal);
      } else if (cboAsesor) {
        cboAsesor.style.display = 'none';
      }

      const filtered = getListaFiltradaComercializador();
      const lbl = document.getElementById('lblTotalComercializador');
      if (lbl) lbl.textContent = filtered.length + ' solicitudes registradas';

      const modo = vistaModulosState.comercializador;
      if (modo === 'tabla') renderTablaComercializador(filtered, showAsesorCol);
      else if (modo === 'kanban') renderKanbanModulo('comercializador', filtered);
      else if (modo === 'calendario') renderCalendarioModulo('comercializador', filtered);
    }

    function renderTablaComercializador(filtered, showAsesorCol) {
      const session = getSession();
      const tbody = document.getElementById('tablaComercializadorBody'); if (!tbody) return;
      if (!filtered.length) {
        const msgVacio = (getStoredSolicitudes().length === 0)
          ? 'No se registran solicitudes en el período seleccionado. Presione "+ Nueva Solicitud" para iniciar un trámite.'
          : 'No se registran solicitudes en el período seleccionado.';
        renderHtmlPorLotes(tbody, '<tr><td colspan="' + (showAsesorCol ? 7 : 6) + '" style="text-align:center;padding:1.5rem;color:var(--text-muted);">' + msgVacio + '</td></tr>');
        return;
      }

      const rowsHtml = filtered.map(s => {
        const esMio = (s.usuario_id === session.id || s.comercializador === session.nombre);
        const colAsesorHtml = showAsesorCol ?
          '<td><div style="font-weight:700;color:#0f172a;font-size:0.74rem;">' + sanitizeHTML(s.comercializador || '—') + (esMio ? ' <span style="font-size:0.65rem;color:var(--color-brand-blue);font-weight:700;">(Tú)</span>' : '') + '</div><span class="badge-org-tag" style="display:inline-block;margin-top:2px;">' + sanitizeHTML(s.nombre_organizacion || 'Paraná Centro') + '</span></td>' : '';
        const fechaStr = formatearFechaTabla24hs(s.fecha || s.Fecha_Registro);
        const idBadge = renderBadgeIdentificadorExpediente(s);

        const prop = s.propuestaMutual;
        const propHtml = prop && prop.activa ?
          '<div style="font-size:0.71rem;white-space:nowrap;"><span style="color:#166534;font-weight:700;">' + formatMoney(prop.monto) + '</span> (' + prop.cuotas + 'c)<div style="font-size:0.65rem;color:#0369a1;">' + sanitizeHTML(prop.estadoPropuesta || 'Oferta lista') + '</div></div>' :
          '<span style="font-size:0.69rem;color:var(--text-muted);">Sin oferta</span>';

        const domHistTxt = sanitizeHTML(s.domicilio_historico || s.solicitante?.domicilio || 'Sin domicilio declarado');
        const cantObsDocs = (s.adjuntos || []).filter(a => a && a.observado).length +
          (s.requerimientosDocumentales || []).filter(r => r && !r.resuelto).length;
        const alertaDocHtml = cantObsDocs > 0
          ? '<div style="font-size:0.65rem;color:#b45309;font-weight:700;margin-top:2px;">⚠️ ' + cantObsDocs + ' alerta doc.</div>'
          : '';
        const puedeVerDrive = esUsuarioMutualConAccesoDrive(session);
        const docsCount = (s.archivosAdjuntos ? s.archivosAdjuntos.length : (s.adjuntos ? s.adjuntos.length : 0));
        const driveLinkHtml = puedeVerDrive
          ? (s.carpetaDriveUrl
              ? '<a href="' + (sanitizeSafeUrl(s.carpetaDriveUrl) || '#') + '" target="_blank" rel="noopener noreferrer" class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Abrir Legajo Digital en Drive (' + docsCount + ' docs)" onclick="event.stopPropagation()">' +
                  '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>' +
                  '<span data-boveda-count="1">' + docsCount + '</span>' +
                '</a>'
              : '<span class="crm-btn-docs" data-boveda-id="' + sanitizeHTML(String(s.id)) + '" title="Legajo Digital (' + docsCount + ' docs)">' +
                  '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>' +
                  '<span data-boveda-count="1">' + docsCount + '</span>' +
                '</span>')
          : '';

        const sIdEsc = sanitizeHTML(String(s.id || ''));
        return '<tr ondragover="handleDragOverExpedienteRow(event, this)" ondragleave="handleDragLeaveExpedienteRow(this, event)" ondrop="handleDropEnExpedienteItem(event, this, \'' + sIdEsc + '\')">' +
          '<td>' + idBadge + '<div style="font-size:0.67rem;color:#64748b;margin-top:3px;white-space:nowrap;">' + fechaStr + '</div></td>' +
          colAsesorHtml +
          '<td><div class="text-sm font-semibold text-slate-900">' + sanitizeHTML(s.solicitante?.nombre || '—') + '</div><div class="text-xs text-slate-500" style="margin-top:2px;"><span class="font-mono text-slate-600">DNI ' + sanitizeHTML(s.solicitante?.dni || '—') + '</span> · <span class="cell-domicilio-hist" style="max-width:150px;" title="' + domHistTxt + '">📍 ' + domHistTxt + '</span></div></td>' +
          '<td><div class="text-xs font-mono font-bold text-slate-900" style="white-space:nowrap;">' + formatMoney(s.prestamo?.monto || 0) + ' <span class="font-semibold text-slate-500">(' + (s.prestamo?.cuotas || '—') + 'c)</span></div><div class="text-[11px] font-medium text-slate-500" style="margin-top:1px;">' + sanitizeHTML(s.prestamo?.lineaNombre || 'Ayuda Económica') + '</div></td>' +
          '<td>' + propHtml + '</td>' +
          '<td><span class="badge-status badge-' + String(s.estado || 'Pendiente').replace(/\s/g, '') + '">' + sanitizeHTML(s.estado || 'Pendiente') + '</span>' + alertaDocHtml + '</td>' +
          '<td style="text-align:center;"><div class="crm-actions-group">' +
            '<button type="button" class="btn-ver-expediente crm-btn-expediente" data-id="' + sIdEsc + '" data-id-provisorio="' + sanitizeHTML(String(s.id_provisorio || s.idProvisorio || s.id || '')) + '" title="Abrir Ficha del Expediente">' +
              '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' +
              '<span>Ver Ficha</span>' +
            '</button>' +
            renderMenuAccionesFilaCrm_(s, driveLinkHtml, '') +
          '</div></td>' +
          '</tr>';
      }).join('');
      renderHtmlPorLotes(tbody, rowsHtml);
    }

    function filtrarGestionesComercializador() { renderModuloComercializador(); }

    function esUsuarioRolMutualOAdmin(sessionObj) {
      const s = sessionObj || (typeof getSession === 'function' ? getSession() : null);
      if (!s || !s.rol) return false;
      const rolLow = String(s.rol).toLowerCase();
      return (
        rolLow.includes('admin') ||
        rolLow.includes('analista') ||
        rolLow.includes('asesor mutual') ||
        rolLow.includes('supervisor') ||
        (rolLow.includes('mutual') && !rolLow.includes('comercial'))
      );
    }

    window._origenModalAlta = 'comercializador';
    function abrirModalAltaSolicitud(origen = 'comercializador') {
      const session = getSession();
      const esMutualOAdmin = esUsuarioRolMutualOAdmin(session);
      const origenEfectivo = (origen === 'mutual_sede' && esMutualOAdmin) ? 'mutual_sede' : 'comercializador';
      window._origenModalAlta = origenEfectivo;
      document.getElementById('formAltaSolicitud')?.reset();
      window._bloqueoAntiguedadMinima = false;
      window._bloqueoEdadMaxima = false;
      calcularAntiguedadReactiva('');
      const bannerAud = document.getElementById('bannerResumenAuditoriaModalAlta');
      if (bannerAud) {
        bannerAud.style.display = 'none';
        bannerAud.innerHTML = '';
      }

      // Sincronizar con el simulador activo para no perder el Plan Deseado ni el Monto simulado
      const lineaSim = (typeof state !== 'undefined' && state.linea) ? state.linea : 'fedem';
      const selLinea = document.getElementById('solLinea');
      if (selLinea) selLinea.value = lineaSim;
      ajustarPlazosModalAlta(lineaSim);

      let plazoSim = (typeof state !== 'undefined' && state.plazo) ? state.plazo : 12;
      if (lineaSim === 'muni' && plazoSim !== 12 && plazoSim !== 24) plazoSim = 12;
      const selPlazo = document.getElementById('solPlazo');
      if (selPlazo) selPlazo.value = String(plazoSim);

      let montoNetoSim = 100000;
      if (typeof state !== 'undefined' && state.montoInputRaw > 0) {
        if (state.modo === 'cuota' && typeof calculateSimulation === 'function') {
          const calc = calculateSimulation(lineaSim, plazoSim, 'cuota', state.montoInputRaw);
          montoNetoSim = (calc && calc.neto > 0) ? Math.round(calc.neto) : state.montoInputRaw;
        } else {
          montoNetoSim = Math.round(state.montoInputRaw);
        }
      }
      const inpMonto = document.getElementById('solMonto');
      if (inpMonto) {
        inpMonto.value = String(montoNetoSim);
        inpMonto.dataset.lastValid = String(montoNetoSim);
      }

      handleOrganismoChange('Provincial', 'solLegajo');
      resetDocumentRows('formAltaSolicitud');
      recalcularValidacionesEdadYCuotas();
      const b = document.getElementById('badgePadronDni'); if (b) b.style.display = 'none';
      const groupCanal = document.getElementById('groupCanalIngresoModal');
      const titleSpan = document.getElementById('lblAltaModalTitle');
      const grpDocsMut = document.getElementById('groupDocsInternosMutual');
      if (grpDocsMut) grpDocsMut.style.display = (origenEfectivo === 'mutual_sede' || esMutualOAdmin) ? 'block' : 'none';
      if (origenEfectivo === 'mutual_sede') {
        if (groupCanal) groupCanal.style.display = 'block';
        if (titleSpan) titleSpan.textContent = '🏛️ Nueva Solicitud Mutual (Sede Central / WhatsApp)';
      } else {
        if (groupCanal) groupCanal.style.display = 'none';
        if (titleSpan) titleSpan.textContent = '📝 Nueva Solicitud de Ayuda Económica';
      }
      abrirModal('modalAltaSolicitud');
    }

    function ajustarPlazosModalAlta(linea) {
      const cbo = document.getElementById('solPlazo'); if (!cbo) return;
      cbo.innerHTML = (linea === 'muni') ? '<option value="12" selected>12 cuotas</option><option value="24">24 cuotas</option>' :
        '<option value="6">6 cuotas</option><option value="12" selected>12 cuotas</option><option value="18">18 cuotas</option><option value="24">24 cuotas</option><option value="36">36 cuotas</option><option value="48">48 cuotas</option>';
      if (typeof recalcularValidacionesEdadYCuotas === 'function') {
        recalcularValidacionesEdadYCuotas();
      }
    }

    function obtenerValorInput(listaIds, valorDefault = '') {
      if (!Array.isArray(listaIds)) listaIds = [listaIds];
      for (const id of listaIds) {
        if (!id) continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const raw = (el.value !== undefined && el.value !== null) ? String(el.value).trim() : String(el.textContent || '').trim();
        if (raw !== '') return raw;
      }
      return valorDefault;
    }

    function parsearNumeroTolerante(rawVal, fallback = 0) {
      if (typeof rawVal === 'number') return isFinite(rawVal) ? rawVal : fallback;
      if (rawVal === null || rawVal === undefined) return fallback;
      let str = String(rawVal).replace(/[$ARS\s]/gi, '').trim();
      if (!str) return fallback;
      if (str.includes(',') && str.includes('.')) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else if (str.includes(',')) {
        str = str.replace(',', '.');
      } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, '');
      }
      const num = parseFloat(str);
      return isFinite(num) ? num : fallback;
    }

    async function guardarNuevaSolicitud(e) {
      if (e && e.preventDefault) e.preventDefault();
      const session = getSession(); if (!session) return;

      // 1. Detección silenciosa de bots (Honeypot)
      const botTrap = document.getElementById('form-trap-field-alta')?.value;
      if (botTrap) {
        console.warn('Bot submission blocked.');
        return;
      }

      // 2. Cooldown local anti-spam (3 segundos)
      if (!checkSubmitCooldown('btnGuardarSolicitud', 3000) && !checkSubmitCooldown('btnSubmitAlta', 3000)) return;

      // 3. Extracción tolerante multi-ID de todos los datos del solicitante y simulación
      const dniVal = obtenerValorInput(['solDni', 'solicitud-dni', 'solicitud_dni', 'dni', 'modal-dni'], '').replace(/\D/g, '');
      if (!validarDni(dniVal)) {
        showToast('⚠️ Error: El DNI debe ser numérico y contener entre 7 y 8 dígitos.');
        return;
      }

      const nombreInputVal = obtenerValorInput(['solNombre', 'solicitud-nombre', 'solicitud_nombre', 'apellido_nombre', 'modal-nombre', 'nombre'], '');
      if (!nombreInputVal) {
        showToast('⚠️ Error: Ingrese el Apellido y Nombres del solicitante.');
        return;
      }
      const finalNombre = sanitizeHTML(nombreInputVal);

      const emailVal = obtenerValorInput(['solEmail', 'solicitud-email', 'solicitud_email', 'email'], '');
      if (emailVal && !validarEmail(emailVal)) {
        showToast('⚠️ Error: Ingrese una dirección de email válida.');
        return;
      }

      const celVal = obtenerValorInput(['solCelular', 'solicitud-telefono', 'solicitud_celular', 'telefono', 'celular'], '');
      if (!validarCelular(celVal)) {
        showToast('⚠️ Error: Ingrese un número de celular/teléfono válido (entre 8 y 15 dígitos).');
        return;
      }

      const localidadVal = obtenerValorInput(['solLocalidad', 'solicitud-localidad', 'solicitud_localidad', 'localidad'], 'Entre Ríos');
      const domVal = obtenerValorInput(['solDomicilio', 'solicitud-domicilio', 'solicitud_domicilio', 'domicilio'], '');
      const domHistVal = sanitizeHTML(domVal) || sanitizeHTML(localidadVal) || 'Sin domicilio declarado';
      const cuilVal = obtenerValorInput(['solCuil', 'solicitud-cuil', 'solicitud_cuil', 'cuil'], '');

      const legajoVal = obtenerValorInput(['solLegajo', 'solicitud-legajo', 'solicitud_legajo', 'legajo'], '');
      const categoriaMunicipalVal = obtenerValorInput(['solicitud-categoria-municipal', 'solCategoriaMunicipal', 'categoriaMunicipal'], '');
      const fechaNacVal = obtenerValorInput(['solicitud-fecha-nacimiento', 'solFechaNac', 'fecha_nacimiento', 'solicitud-fecha-nac', 'fecha_nac'], '');
      const sexoVal = obtenerValorInput(['solSexo', 'solicitud-sexo', 'sexo'], '');
      const estadoCivilVal = obtenerValorInput(['solEstadoCivil', 'solicitud-estado-civil', 'estado_civil', 'estadoCivil'], '');
      const condicionVal = obtenerValorInput(['solCondicion', 'solicitud-condicion', 'condicion'], 'Activo');
      const organismoVal = obtenerValorInput(['solOrganismo', 'solicitud-organismo', 'organismo'], 'Provincial');
      if (String(organismoVal).toLowerCase().includes('municipal')) {
        if (!legajoVal) {
          showToast('⚠️ Error: Ingrese el Legajo Municipal del solicitante.');
          return;
        }
        if (!categoriaMunicipalVal) {
          showToast('⚠️ Error: Ingrese la Categoría Municipal del solicitante.');
          return;
        }
      }
      const dependenciaVal = obtenerValorInput(['solDependencia', 'solicitud-dependencia', 'dependencia'], '');
      const cargoVal = obtenerValorInput(['solicitud-cargo', 'solCargo', 'cargo'], '');
      if (!cargoVal) {
        showToast('⚠️ Error: Seleccione el Cargo (Titular o Suplente).');
        return;
      }
      const situacionRevistaVal = '';
      const fechaIngresoVal = obtenerValorInput(['solicitud-fecha-ingreso', 'solFechaIngreso', 'Fecha_Ingreso_Laboral', 'fecha_ingreso_laboral'], '');
      const antiguedadVal = fechaIngresoVal
        ? calcularAntiguedadReactiva(fechaIngresoVal)
        : obtenerValorInput(['solicitud-antiguedad-formateada', 'solAntiguedad', 'solicitud-antiguedad', 'antiguedad'], '');

      if (window._bloqueoAntiguedadMinima) {
        showToast('⛔ El solicitante no cumple con la antigüedad laboral mínima requerida (10 meses).');
        return;
      }

      const lineaRaw = obtenerValorInput(['solLinea', 'solicitud-linea', 'linea_ayuda', 'simulador-linea', 'linea'], (typeof state !== 'undefined' && state.linea) ? state.linea : 'fedem');
      const lineaLow = lineaRaw.toLowerCase();
      const lineaKey = (lineaLow.includes('muni') || lineaLow.includes('quad') || lineaLow.includes('vikingo')) ? 'muni' :
                       lineaLow.includes('sidecreer') ? 'sidecreer' : 'fedem';
      const lineaNombre = (FINANCIAL_DATA[lineaKey] && FINANCIAL_DATA[lineaKey].name) || 'FEDEM Provincial';

      const cuotas = parseInt(obtenerValorInput(['solPlazo', 'solicitud-cuotas', 'cuotas', 'sim-cuotas', 'termSelect'], String((typeof state !== 'undefined' && state.plazo) ? state.plazo : 12)), 10) || 12;

      const edadSubmit = calcularEdadDesdeFecha(fechaNacVal);
      if (edadSubmit !== null && (edadSubmit + (cuotas / 12)) > 80) {
        showToast('⛔ La edad del solicitante (' + edadSubmit + ' años) más el plazo (' + cuotas + ' cuotas) supera el límite de 80 años al finalizar el plan.');
        return;
      }
      if (String(organismoVal).toLowerCase().includes('municipal') && categoriaMunicipalVal) {
        const catNumSubmit = parseInt(categoriaMunicipalVal, 10);
        if (!isNaN(catNumSubmit) && catNumSubmit >= 25 && cuotas > 12) {
          showToast('⛔ Por Categoría Municipal ' + catNumSubmit + ' (≥ 25), el plazo máximo autorizado es de 12 cuotas.');
          return;
        }
        if (!isNaN(catNumSubmit) && catNumSubmit <= 24 && cuotas > 24) {
          showToast('⛔ Por Categoría Municipal ' + catNumSubmit + ' (≤ 24), el plazo máximo autorizado es de 24 cuotas.');
          return;
        }
      }

      let monto = parsearNumeroTolerante(obtenerValorInput(['solMonto', 'solicitud-monto', 'monto_solicitado', 'sim-monto-neto'], '0'), 0);
      if (monto <= 0) {
        const lastValidModal = parsearNumeroTolerante(document.getElementById('solMonto')?.dataset?.lastValid || '0', 0);
        if (lastValidModal > 0) monto = lastValidModal;
      }
      if (monto <= 0) {
        const simRaw = parsearNumeroTolerante(obtenerValorInput(['amountInput'], '0'), 0);
        if (typeof state !== 'undefined' && state.modo === 'cuota' && simRaw > 0 && typeof calculateSimulation === 'function') {
          const calcSim = calculateSimulation(lineaKey, cuotas, 'cuota', simRaw);
          monto = (calcSim && calcSim.neto > 0) ? Math.round(calcSim.neto) : simRaw;
        } else {
          monto = simRaw || ((typeof state !== 'undefined' && state.montoInputRaw > 0) ? state.montoInputRaw : 0);
        }
      }
      if (isNaN(monto) || monto <= 0) {
        showToast('⚠️ Error: El monto solicitado debe ser mayor a $0.');
        return;
      }
      if (monto > 5000000) {
        showToast('⚠️ Error: El monto excede el tope operativo de $5.000.000 para la línea seleccionada.');
        return;
      }

      const sim = calculateSimulation(lineaKey, cuotas, 'neto', monto);
      const cuotaEstimada = (sim && sim.cuota > 0)
        ? Number(sim.cuota.toFixed(2))
        : parsearNumeroTolerante(obtenerValorInput(['solCuotaEstimada', 'solicitud-cuota', 'valor_cuota', 'sim-cuota-mensual'], '0'), 0);
      const totalADevolverCalc = (sim && sim.totalAyuda > 0)
        ? Number(sim.totalAyuda.toFixed(2))
        : (Number((cuotaEstimada * cuotas).toFixed(2)) ||
           parsearNumeroTolerante(obtenerValorInput(['solTotalDevolver', 'solicitud-total', 'total_devolver', 'sim-total-devolver'], '0'), 0));

      const rawRand = String(Math.floor(10000 + Math.random() * 90000));
      const provId = 'PROV-' + rawRand;
      const nowStr = obtenerFechaHora24hs();

      // 4. Mapeo exhaustivo de archivos: memoria reactiva + verificación DOM con Promise.all
      const fileInputs = [
        { el: document.getElementById('fileDni'), tipo: 'DNI', key: 'fileDni' },
        { el: document.getElementById('fileRecibo'), tipo: 'RECIBO DE SUELDO', key: 'fileRecibo' },
        { el: document.getElementById('fileMovimientos'), tipo: 'COMPROBANTE DE MOVIMIENTOS BANCARIOS', key: 'fileMovimientos' },
        { el: document.getElementById('fileSage'), tipo: 'CERTIFICADO SAGE', key: 'fileSage' },
        { el: document.getElementById('fileContrato'), tipo: 'CONTRATO DE SERVICIO', key: 'fileContrato' },
        { el: document.getElementById('fileNotaUniversidad'), tipo: 'NOTA DE SERVICIO OFICIAL', key: 'fileNotaUniversidad' },
        { el: document.getElementById('fileServicio'), tipo: 'SERVICIO', key: 'fileServicio' },
        { el: document.getElementById('fileCbu'), tipo: 'CONSTANCIA DE CBU', key: 'fileCbu' },
        { el: document.getElementById('fileSidecreer'), tipo: 'TARJETA SIDECREER', key: 'fileSidecreer' },
        { el: document.getElementById('fileOtros'), tipo: 'OTROS DOCUMENTOS', key: 'fileOtros' },
        { el: document.getElementById('fileTransferencia'), tipo: 'TRANSFERENCIA', key: 'fileTransferencia' },
        { el: document.getElementById('fileSolicitudAyuda'), tipo: 'SOLICITUD DE AYUDA ECONOMICA', key: 'fileSolicitudAyuda' },
        { el: document.getElementById('fileAutorizacionDescuento'), tipo: 'AUTORIZACION PARA DESCUENTO DE HABERES', key: 'fileAutorizacionDescuento' }
      ];

      // Pre-validar archivos físicos presentes
      for (const item of fileInputs) {
        if (item.el && item.el.files && item.el.files.length > 0) {
          for (let i = 0; i < item.el.files.length; i++) {
            const f = item.el.files[i];
            const check = validarArchivoAdjunto(f);
            if (!check.valido) {
              showToast('⚠️ ' + check.error);
              return;
            }
          }
        }
      }

      mostrarCargando('Codificando documentación...', 'Preparando archivos para transferencia al Legajo Digital');

      const adjuntosBase64 = [];
      const listaAdjuntosObj = [];

      const operadorActualSol = obtenerNombreOperadorActivo();
      for (const item of fileInputs) {
        // A. Verificar si ya fue procesado en memoria reactiva
        const memoriaArr = window.stateArchivosAdjuntos ? window.stateArchivosAdjuntos[item.key] : null;
        if (Array.isArray(memoriaArr) && memoriaArr.length > 0) {
          memoriaArr.forEach((m, idx) => {
            const nombreFormateado = normalizarNombreArchivoDrive(rawRand, item.tipo, 'PDF', idx);
            const tipoUpper = String(item.tipo || 'OTROS DOCUMENTOS').toUpperCase();
            adjuntosBase64.push({
              tipo: tipoUpper,
              nombre: nombreFormateado,
              nombreArchivo: nombreFormateado,
              name: nombreFormateado,
              nombreOriginal: m.nombreOriginal || m.nombre,
              tipoMime: m.tipoMime || m.mimeType || 'application/pdf',
              mimeType: m.mimeType || m.tipoMime || 'application/pdf',
              type: m.mimeType || m.tipoMime || 'application/pdf',
              tamanio: m.tamanio || m.size || 0,
              size: m.size || m.tamanio || 0,
              cargadoPor: operadorActualSol,
              usuarioOperador: operadorActualSol,
              autor: operadorActualSol,
              dataUrl: m.dataUrl || '',
              base64: m.base64
            });
            listaAdjuntosObj.push({
              tipo: tipoUpper,
              nombre: nombreFormateado,
              fecha: nowStr,
              cargadoPor: operadorActualSol,
              autor: operadorActualSol,
              dataUrl: m.dataUrl || '',
              urlDrive: ''
            });
          });
        } else if (item.el && item.el.files && item.el.files.length > 0) {
          // B. Lectura asíncrona robusta directa del input DOM
          for (let i = 0; i < item.el.files.length; i++) {
            const f = item.el.files[i];
            try {
              const b64 = await fileToBase64(f);
              if (b64) {
                const nombreFormateado = normalizarNombreArchivoDrive(rawRand, item.tipo, 'PDF', i);
                const tipoUpper = String(item.tipo || 'OTROS DOCUMENTOS').toUpperCase();
                adjuntosBase64.push({
                  tipo: tipoUpper,
                  nombre: nombreFormateado,
                  nombreArchivo: nombreFormateado,
                  name: nombreFormateado,
                  nombreOriginal: f.name,
                  tipoMime: b64.tipoMime,
                  mimeType: b64.tipoMime,
                  type: b64.tipoMime,
                  tamanio: b64.tamanio,
                  size: b64.tamanio,
                  cargadoPor: operadorActualSol,
                  usuarioOperador: operadorActualSol,
                  autor: operadorActualSol,
                  dataUrl: b64.dataUrl,
                  base64: b64.base64
                });
                listaAdjuntosObj.push({
                  tipo: tipoUpper,
                  nombre: nombreFormateado,
                  fecha: nowStr,
                  cargadoPor: operadorActualSol,
                  autor: operadorActualSol,
                  dataUrl: b64.dataUrl,
                  urlDrive: ''
                });
              }
            } catch (err) {
              console.warn('Error leyendo archivo:', f.name, err);
              ocultarCargando();
              showToast('⚠️ ' + (err.message || 'Error en archivo adjunto'));
              return;
            }
          }
        }
      }

      if (listaAdjuntosObj.length === 0) {
        listaAdjuntosObj.push(
          { tipo: 'DNI', nombre: rawRand + ' DNI.PDF', fecha: nowStr, cargadoPor: operadorActualSol, autor: operadorActualSol },
          { tipo: 'RECIBO DE SUELDO', nombre: rawRand + ' RECIBO DE SUELDO.PDF', fecha: nowStr, cargadoPor: operadorActualSol, autor: operadorActualSol },
          { tipo: 'SERVICIO', nombre: rawRand + ' SERVICIO.PDF', fecha: nowStr, cargadoPor: operadorActualSol, autor: operadorActualSol }
        );
      }

      const isSedeCentral = (window._origenModalAlta === 'mutual_sede') ||
        session.rol === 'Admin' || session.rol === 'Analista' || session.rol === 'Asesor Mutual';
      const canalIngreso = isSedeCentral ?
        (document.getElementById('solCanalIngreso')?.value || 'Presencial Sede Central') :
        'Comercializador Externo';

      const orgId = isSedeCentral ? (session.idOrganizacion || session.organizacion_id || 'org_sede_central') : (session.idOrganizacion || session.organizacion_id || 'org_parana_centro');
      const orgNombre = isSedeCentral ? (session.nombreOrganizacion || session.nombre_organizacion || 'Sede Central Mutual') : (session.nombreOrganizacion || session.nombre_organizacion || 'Organización Paraná Centro');
      const asesorNombre = (window._origenModalAlta === 'mutual_sede') ? (session.nombre + ' (Sede Central)') : session.nombre;
      const analistaAsig = isSedeCentral ? session.nombre : 'Sin Asignar';

      const totalADevolver = totalADevolverCalc;
      const datosContactoObj = {
        cuil: sanitizeHTML(cuilVal),
        localidad: sanitizeHTML(localidadVal),
        fechaNac: sanitizeHTML(fechaNacVal),
        fechaNacimiento: sanitizeHTML(fechaNacVal),
        sexo: sanitizeHTML(sexoVal),
        estadoCivil: sanitizeHTML(estadoCivilVal),
        email: sanitizeHTML(emailVal),
        celular: sanitizeHTML(celVal),
        telefono: sanitizeHTML(celVal),
        domicilio: domHistVal,
        banco: sanitizeHTML((document.getElementById('altaBanco')?.value || '').trim()),
        tipoCuenta: sanitizeHTML(document.getElementById('altaTipoCuenta')?.value || ''),
        nroCuenta: sanitizeHTML((document.getElementById('altaNroCuenta')?.value || '').trim()),
        cbu: sanitizeHTML((document.getElementById('altaCbu')?.value || '').trim()),
        alias: sanitizeHTML((document.getElementById('altaAlias')?.value || '').trim()),
        tarjetaSidecreerNumero: sanitizeHTML((document.getElementById('altaTarjetaSidecreerNumero')?.value || '').trim()),
        tarjetaSidecreerVencimiento: sanitizeHTML((document.getElementById('altaTarjetaSidecreerVencimiento')?.value || '').trim()),
        tarjetaSidecreerCvv: sanitizeHTML((document.getElementById('altaTarjetaSidecreerCvv')?.value || '').trim())
      };
      const datosLaboralesObj = {
        condicion: sanitizeHTML(condicionVal),
        organismo: sanitizeHTML(organismoVal),
        dependencia: sanitizeHTML(dependenciaVal),
        cargo: sanitizeHTML(cargoVal),
        situacionRevista: sanitizeHTML(situacionRevistaVal),
        fechaIngresoLaboral: sanitizeHTML(fechaIngresoVal),
        Fecha_Ingreso_Laboral: sanitizeHTML(fechaIngresoVal),
        antiguedad: sanitizeHTML(antiguedadVal),
        legajo: sanitizeHTML(legajoVal),
        categoriaMunicipal: sanitizeHTML(categoriaMunicipalVal)
      };

      const nueva = {
        id: rawRand,
        id_provisorio: provId,
        idProvisorio: provId,
        id_definitivo: '',
        Nro_Definitivo: '',
        ID_Definitivo_Expediente: '',
        fecha: nowStr,
        _createdAtMs: Date.now(),
        _localPendingSync: true,
        usuario_id: session.id,
        idUsuarioAsesor: session.id,
        idAsesor: session.id,
        comercializador: asesorNombre,
        nombreAsesor: asesorNombre,
        organizacion_id: orgId,
        idOrganizacion: orgId,
        nombre_organizacion: orgNombre,
        nombreOrganizacion: orgNombre,
        origen_canal: canalIngreso,
        origenCanal: canalIngreso,
        domicilio_historico: domHistVal,
        // Campos planos requeridos dentro de solicitud
        dni: sanitizeHTML(dniVal),
        apellidoNombre: finalNombre,
        domicilio: domHistVal,
        localidad: sanitizeHTML(localidadVal),
        montoNeto: monto,
        cuotas: cuotas,
        montoCuota: cuotaEstimada,
        valorCuota: cuotaEstimada,
        totalDevolver: totalADevolver,
        lineaAyuda: lineaNombre,
        organismo: sanitizeHTML(organismoVal),
        dependencia: sanitizeHTML(dependenciaVal),
        cargo: sanitizeHTML(cargoVal),
        situacionRevista: sanitizeHTML(situacionRevistaVal),
        fechaIngresoLaboral: sanitizeHTML(fechaIngresoVal),
        Fecha_Ingreso_Laboral: sanitizeHTML(fechaIngresoVal),
        antiguedad: sanitizeHTML(antiguedadVal),
        legajo: sanitizeHTML(legajoVal),
        categoriaMunicipal: sanitizeHTML(categoriaMunicipalVal),
        cuil: sanitizeHTML(cuilVal),
        fechaNac: sanitizeHTML(fechaNacVal),
        fechaNacimiento: sanitizeHTML(fechaNacVal),
        sexo: sanitizeHTML(sexoVal),
        estadoCivil: sanitizeHTML(estadoCivilVal),
        telefono: sanitizeHTML(celVal),
        email: sanitizeHTML(emailVal),
        datosContacto: datosContactoObj,
        datosLaborales: datosLaboralesObj,
        solicitante: {
          dni: sanitizeHTML(dniVal),
          cuil: sanitizeHTML(cuilVal),
          legajo: sanitizeHTML(legajoVal),
          categoriaMunicipal: sanitizeHTML(categoriaMunicipalVal),
          nombre: finalNombre,
          fechaNac: sanitizeHTML(fechaNacVal),
          fechaNacimiento: sanitizeHTML(fechaNacVal),
          sexo: sanitizeHTML(sexoVal),
          estadoCivil: sanitizeHTML(estadoCivilVal),
          email: sanitizeHTML(emailVal),
          celular: sanitizeHTML(celVal),
          domicilio: domHistVal,
          domicilio_historico: domHistVal,
          localidad: sanitizeHTML(localidadVal),
          condicion: sanitizeHTML(condicionVal),
          organismo: sanitizeHTML(organismoVal),
          dependencia: sanitizeHTML(dependenciaVal),
          cargo: sanitizeHTML(cargoVal),
          situacionRevista: sanitizeHTML(situacionRevistaVal),
          fechaIngresoLaboral: sanitizeHTML(fechaIngresoVal),
          Fecha_Ingreso_Laboral: sanitizeHTML(fechaIngresoVal),
          antiguedad: sanitizeHTML(antiguedadVal),
          banco: sanitizeHTML((document.getElementById('altaBanco')?.value || '').trim()),
          tipoCuenta: sanitizeHTML(document.getElementById('altaTipoCuenta')?.value || ''),
          nroCuenta: sanitizeHTML((document.getElementById('altaNroCuenta')?.value || '').trim()),
          cbu: sanitizeHTML((document.getElementById('altaCbu')?.value || '').trim()),
          alias: sanitizeHTML((document.getElementById('altaAlias')?.value || '').trim()),
          tarjetaSidecreerNumero: sanitizeHTML((document.getElementById('altaTarjetaSidecreerNumero')?.value || '').trim()),
          tarjetaSidecreerVencimiento: sanitizeHTML((document.getElementById('altaTarjetaSidecreerVencimiento')?.value || '').trim()),
          tarjetaSidecreerCvv: sanitizeHTML((document.getElementById('altaTarjetaSidecreerCvv')?.value || '').trim())
        },
        prestamo: {
          linea: lineaKey,
          lineaNombre: lineaNombre,
          monto,
          cuotas,
          cuotaEstimada,
          totalADevolver
        },
        propuestaMutual: {
          activa: false,
          linea: lineaKey,
          lineaNombre: lineaNombre,
          monto,
          cuotas,
          cuotaEstimada,
          estadoPropuesta: 'En Evaluación',
          detalle: isSedeCentral ? ('Ingresado por canal ' + canalIngreso) : 'Plan preliminar cargado por el asesor'
        },
        adjuntos: listaAdjuntosObj,
        estado: 'Pendiente',
        analistaAsignado: analistaAsig,
        Analista_Asignado: analistaAsig,
        observaciones: [
          {
            autor: session.nombre,
            rol: isSedeCentral ? 'Analista Mutual (Sede Central)' : (session.rol + (session.es_titular_organizacion ? ' - Titular' : ' - Asesor')),
            fecha: nowStr,
            texto: isSedeCentral ? ('Solicitud mutual originada vía ' + canalIngreso + ' con legajo digital inicial.') : 'Solicitud originada en plataforma con legajo digital inicial.'
          }
        ]
      };

      const dictamenAAsentar = window._dictamenAuditoriaParaNuevaSolicitud || (document.getElementById('solDictamenIA')?.value ? parseJSONCampoSeguro(document.getElementById('solDictamenIA').value, null) : null);
      if (dictamenAAsentar) {
        const payloadBit = construirPayloadBitacoraAuditoria(dictamenAAsentar);
        nueva.observaciones.push({
          tipo: 'AUDITORIA_IA_DOCUMENTAL',
          autor: operadorActualSol + ' [Auditoría IA]',
          usuarioOperador: operadorActualSol,
          rol: isSedeCentral ? 'Analista Mutual (Sede Central)' : 'Auditoría IA',
          fecha: nowStr,
          texto: payloadBit.textoFormateado,
          resumenAuditoria: payloadBit.resumenAuditoria
        });
        nueva.auditoriaIA = {
          estado: 'completado',
          fechaFin: nowStr,
          usuarioOperador: operadorActualSol,
          resumenAuditoria: payloadBit.resumenAuditoria,
          analisisMargen: dictamenAAsentar.analisisMargen || null,
          ofertasPorPlazo: dictamenAAsentar.ofertasPorPlazo || null,
          resultado: dictamenAAsentar
        };
      }

      // 5. Payload alineado exactamente a las 27 columnas de la Base Central + objeto completo
      const payloadParaBackend = {
        action: 'crearSolicitud',
        usuarioActivo: session,
        usuarioOperador: operadorActualSol,

        // 27 Columnas exactas de Solicitudes_Ayudas
        ID_Solicitud: rawRand,
        Fecha_Registro: nowStr,
        ID_Usuario_Asesor: session.id,
        Nombre_Asesor: asesorNombre,
        ID_Organizacion: orgId,
        Nombre_Organizacion: orgNombre,
        Origen_Canal: canalIngreso,
        DNI_Asociado: sanitizeHTML(dniVal),
        Apellido_Nombre: finalNombre,
        Domicilio_Historico_Solicitud: domHistVal,
        Legajo_Municipal: sanitizeHTML(legajoVal),
        Datos_Contacto_JSON: JSON.stringify(datosContactoObj),
        Datos_Laborales_JSON: JSON.stringify(datosLaboralesObj),
        Linea_Ayuda: lineaNombre,
        Monto_Solicitado_Neto: monto,
        Cantidad_Cuotas: cuotas,
        Monto_Cuota: cuotaEstimada,
        Total_A_Devolver: totalADevolver,
        Estado_Tramite: 'Pendiente',
        Carpeta_Drive_URL: '',
        Archivos_Adjuntos_JSON: JSON.stringify(adjuntosBase64),
        Historial_Comentarios_JSON: JSON.stringify(nueva.observaciones),
        Nro_Definitivo: '',
        Historial_Ofertas_JSON: JSON.stringify({ propuestaMutual: nueva.propuestaMutual, historialPropuestas: [] }),
        Dictamen_IA_JSON: dictamenAAsentar ? JSON.stringify(dictamenAAsentar) : '',
        Dictamen_Texto: window._dictamenAuditoriaTexto || (document.getElementById('solTextoDictamen')?.value || ''),
        Analista_Asignado: analistaAsig,
        Ultima_Actualizacion: nowStr,

        // Alias de compatibilidad y archivos Base64 para Bóveda Documental y Padron_Asociados
        ID_OPERACION: rawRand,
        id: rawRand,
        id_provisorio: provId,
        id_definitivo: '',
        fecha: nowStr,
        Fecha: nowStr,
        idUsuarioAsesor: session.id,
        usuario_id: session.id,
        nombreAsesor: asesorNombre,
        Comercializador: asesorNombre,
        comercializador: asesorNombre,
        idOrganizacion: orgId,
        organizacion_id: orgId,
        nombreOrganizacion: orgNombre,
        nombre_organizacion: orgNombre,
        origenCanal: canalIngreso,
        origen_canal: canalIngreso,
        analistaAsignado: analistaAsig,
        apellido_nombre: finalNombre,
        apellidoNombre: finalNombre,
        nombre: finalNombre,
        DNI: dniVal,
        dni: dniVal,
        CUIL: cuilVal,
        cuil: cuilVal,
        Legajo: legajoVal,
        legajo: legajoVal,
        Categoria_Municipal: categoriaMunicipalVal,
        categoriaMunicipal: categoriaMunicipalVal,
        Fecha_Nac: fechaNacVal,
        Fecha_Nacimiento: fechaNacVal,
        fechaNac: fechaNacVal,
        fechaNacimiento: fechaNacVal,
        Sexo: sexoVal,
        sexo: sexoVal,
        Estado_Civil: estadoCivilVal,
        estadoCivil: estadoCivilVal,
        Email: emailVal,
        email: emailVal,
        Celular: celVal,
        celular: celVal,
        Localidad: localidadVal,
        localidad: localidadVal,
        Domicilio: domHistVal,
        domicilio: domHistVal,
        domicilio_historico: domHistVal,
        Condicion: condicionVal,
        condicion: condicionVal,
        Organismo: organismoVal,
        organismo: organismoVal,
        Dependencia: dependenciaVal,
        dependencia: dependenciaVal,
        Cargo: cargoVal,
        cargo: cargoVal,
        Situacion_Revista: situacionRevistaVal,
        situacionRevista: situacionRevistaVal,
        Fecha_Ingreso_Laboral: fechaIngresoVal,
        fechaIngresoLaboral: fechaIngresoVal,
        fechaIngreso: fechaIngresoVal,
        Antiguedad: antiguedadVal,
        antiguedad: antiguedadVal,
        Monto: monto,
        monto: monto,
        montoNeto: monto,
        Cuotas: cuotas,
        cuotas: cuotas,
        Plazo: cuotas,
        plazo: cuotas,
        Cuota_Estimada: cuotaEstimada,
        cuotaEstimada: cuotaEstimada,
        montoCuota: cuotaEstimada,
        valorCuota: cuotaEstimada,
        cuota: cuotaEstimada,
        totalDevolver: totalADevolver,
        totalADevolver: totalADevolver,
        Linea: lineaKey,
        linea: lineaKey,
        Linea_Nombre: lineaNombre,
        lineaNombre: lineaNombre,
        lineaAyuda: lineaNombre,
        archivosBase64: adjuntosBase64,
        archivos: adjuntosBase64,
        adjuntos: adjuntosBase64,
        adjuntosBase64: adjuntosBase64,

        // Objeto anidado completo
        solicitud: nueva
      };

      const lineaCodigoApi = (lineaKey === 'muni' || lineaKey === 'quad')
        ? 'QUAD'
        : (lineaKey === 'sidecreer' ? 'SIDECREER' : 'FEDEM');
      const idAsesorReal = String((session && (session.id || session.idUsuario || session.usuario_id)) || 'USR-001').trim();
      const renderSolicitudPayload = {
        id_provisorio: provId || `SOL-${Date.now().toString().slice(-6)}`,
        asociado: {
          dni: String(dniVal || '').trim(),
          cuil: String(cuilVal || '').trim() || null,
          apellido_nombres: String(finalNombre || '').trim(),
          telefono: String(celVal || '').trim() || null,
          email: String(emailVal || '').trim() || null,
          organismo: String(organismoVal || 'POLICIA DE ENTRE RIOS').trim(),
          dependencia_laboral: String(dependenciaVal || '').trim() || null,
          tipo_empleo: String(organismoVal || '').toLowerCase().includes('municipal') ? 'MUNICIPAL' : 'PROVINCIAL',
          situacion_revista: String(situacionRevistaVal || 'TITULAR').trim(),
          antiguedad_anios: parseInt(antiguedadVal, 10) || 0,
          antiguedad_meses: 0,
          legajo: String(legajoVal || '').trim() || null,
          cargo: String(cargoVal || '').trim() || null,
          condicion: String(condicionVal || 'Activo').trim(),
          fecha_nacimiento: String(fechaNacVal || '').trim() || null,
          sexo: String(sexoVal || '').trim() || null,
          estado_civil: String(estadoCivilVal || '').trim() || null,
          fecha_ingreso_laboral: String(fechaIngresoVal || '').trim() || null,
          antiguedad_texto: String(antiguedadVal || '').trim() || null
        },
        linea_ayuda: lineaCodigoApi,
        monto_solicitado: Number(monto) || 0,
        cuotas_pactadas: parseInt(cuotas, 10) || 6,
        valor_cuota_estimada: Number(cuotaEstimada) || 0,
        total_a_devolver: Number(totalADevolver) || 0,
        tna_aplicada: 0,
        destino_fondos: 'Libre disponibilidad',
        asesor_id: idAsesorReal,
        asesor_codigo: idAsesorReal,
        asesor_nombre: asesorNombre,
        analista_asignado: analistaAsig,
        org_id: orgId,
        org_nombre: orgNombre,
        origen_canal: canalIngreso,
        domicilio: domHistVal,
        localidad: localidadVal
      };

      if (dictamenAAsentar) {
        const resDec = dictamenAAsentar.resumenDecision || dictamenAAsentar;
        const amAudit = dictamenAAsentar.analisisMargen || {};
        renderSolicitudPayload.auditoria = {
          periodo_recibo: String(resDec.periodo || '').trim() || null,
          sueldo_bruto_total: Number(amAudit.totalHaberes ?? resDec.sueldoBrutoTotal ?? resDec.sueldoBruto ?? 0) || 0,
          descuentos_ley: Number(amAudit.totalSubtotal1Desc ?? resDec.totalSubtotal1Desc ?? resDec.descuentosLey ?? 0) || 0,
          total_descuentos: Number(amAudit.totalDescuentos ?? resDec.totalDescuentos ?? 0) || 0,
          sueldo_liquido: Number(amAudit.netoLiquido ?? resDec.sueldoLiquido ?? resDec.sueldoNeto ?? 0) || 0,
          margen_computable: Number(amAudit.disponibleRecibo ?? resDec.disponibleRecibo ?? resDec.margenDisponiblePlanilla ?? resDec.margenDisponible ?? resDec.margen ?? 0) || 0,
          dictamen_canal: lineaCodigoApi === 'QUAD' ? 'PLANILLA_QUAD' : (lineaCodigoApi === 'SIDECREER' ? 'DEBITO_SIDECREER' : 'PLANILLA_FEDEM'),
          conceptos_detalle: Array.isArray(dictamenAAsentar.detalleCompletoRecibo?.conceptos) ? dictamenAAsentar.detalleCompletoRecibo.conceptos : (Array.isArray(dictamenAAsentar.conceptos) ? dictamenAAsentar.conceptos : []),
          raw_dictamen: dictamenAAsentar
        };
      }

      if (typeof mostrarCargando === 'function') {
        mostrarCargando('Guardando Solicitud...', 'Registrando expediente ' + provId + ' en Supabase y encolando réplica...');
      }

      let resData = null;
      try {
        const resp = await fetchConTimeout(`${RENDER_API_URL}/api/solicitudes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(renderSolicitudPayload)
        }, 45000);

        resData = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.error('Detalle error /api/solicitudes:', resp.status, resData);
          const errMsg = resData.detail || resData.error || ('Error HTTP ' + resp.status);
          showToast('⚠️ Error al guardar solicitud: ' + errMsg);
          mostrarNotificacionToast('Error al guardar solicitud: ' + errMsg, 'error');
          return;
        }
      } catch (errPost) {
        console.error('Error enviando solicitud a Render:', errPost);
        showToast('⚠️ Error de conexión con el servidor al guardar la solicitud.');
        mostrarNotificacionToast('Error de conexión con el servidor al guardar la solicitud.', 'error');
        return;
      } finally {
        if (typeof ocultarCargando === 'function') ocultarCargando();
      }

      const idConfirmado = (resData && (resData.id_provisorio || resData.solicitud_id)) || provId;
      if (resData && resData.solicitud_id) {
        nueva.supabase_id = resData.solicitud_id;
      }

      // Agregar inmediatamente al inicio de la tabla visible local
      const actuales = getStoredSolicitudes();
      actuales.unshift(nueva);
      saveStoredSolicitudes(actuales);

      window.stateArchivosAdjuntos = {};
      if (window.state && window.state.archivosAdjuntos) {
        window.state.archivosAdjuntos = {};
      }

      document.getElementById('formAltaSolicitud')?.reset();
      cerrarModal('modalAltaSolicitud');

      if (typeof renderModuloComercializador === 'function') renderModuloComercializador();
      if (typeof renderModuloMutualPropias === 'function') renderModuloMutualPropias();
      if (typeof renderModuloMutual === 'function') renderModuloMutual();
      actualizarCentroNotificaciones();

      showToast('✅ Solicitud guardada exitosamente (' + idConfirmado + ')');
      mostrarNotificacionToast('Solicitud guardada exitosamente (' + idConfirmado + ')', 'success');

      // Disparo automático e inteligente de Auditoría IA en segundo plano solo si no venía ya auditada
      if (!dictamenAAsentar) {
        ejecutarAuditoriaAutomaticaExpediente(nueva.id, adjuntosBase64);
      }
      window._dictamenAuditoriaParaNuevaSolicitud = null;
      window._dictamenAuditoriaTexto = null;

      // Cambiar a la pestaña de destino sin disparar la sincronización inmediata en frío (evita pisar localStorage antes de que el BackgroundTask de Render termine en Google Sheets)
      if (isSedeCentral) {
        cambiarPestana('view-mutual-propias', { skipCloudSync: true });
      } else {
        cambiarPestana('view-comercializador', { skipCloudSync: true });
      }

      if (typeof renderModuloComercializador === 'function') renderModuloComercializador();
      if (typeof renderModuloMutualPropias === 'function') renderModuloMutualPropias();
      if (typeof renderModuloMutual === 'function') renderModuloMutual();
      actualizarCentroNotificaciones();

      // Reconciliación diferida con Supabase / Google Sheets una vez confirmada la solicitud
      setTimeout(() => {
        cargarSolicitudesDesdeNube(true);
      }, 1500);
    }

