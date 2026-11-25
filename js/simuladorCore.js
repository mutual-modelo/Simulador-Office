    const FINANCIAL_DATA = {
      fedem: { name: "FEDEM Provincial", short: "FEDEM", plazosValidos: [6, 12, 18, 24, 36, 48] },
      muni: { name: "Municipales QUAD", short: "Municipales", plazosValidos: [12, 24] },
      sidecreer: { name: "Tarjeta Sidecreer", short: "Sidecreer", plazosValidos: [6, 12, 18, 24, 36, 48] }
    };
    FINANCIAL_DATA.municipales = FINANCIAL_DATA.muni;

    function pmt(rate, nper, pv) {
      return pv * (rate / (1.0 - Math.pow(1.0 + rate, -nper)));
    }
    const calcularPMT = pmt;

    // MOTOR_FINANCIERO_EXACTO provisto por js/motorFinanciero.js

    const WA_CUSTOM_TEMPLATE_STORAGE_KEY = 'ammer_custom_wa_template';
    const WA_DEFAULT_VERSION_STORAGE_KEY = 'ammer_default_wa_version';

    const PLANTILLA_PERSONALIZADA_DEFAULT = {
      intro: '¡Hola {nombre_asociado}! 👋 Te compartimos la simulación oficial de la Mutual Modelo ({linea}):',
      cierre: 'Aguardo su respuesta. Muchas gracias.\n{contacto}',
      raw: `¡Hola {nombre_asociado}! 👋 Te compartimos la simulación oficial de la Mutual Modelo ({linea}):

{planes}

En caso de estar interesado y *para poder avanzar con la gestión* online, por favor indique el plan y *envíe* lo que se le solicita a continuación:
{requisitos}

Aguardo su respuesta. Muchas gracias.
{contacto}`
    };

    function normalizarCodigoLineaWA(lineaAyuda) {
      const raw = String(lineaAyuda || '').trim().toUpperCase();
      if (raw.includes('SIDE')) return 'CONVENIO_SIDECREER';
      if (raw.includes('MUNI') || raw.includes('QUAD') || raw.includes('VIKINGO')) return 'QUAD_MUNICIPALES';
      return 'FEDEM_PROVINCIAL';
    }

    function obtenerNombreLineaLegibleWA(lineaAyuda) {
      const cod = normalizarCodigoLineaWA(lineaAyuda);
      if (cod === 'CONVENIO_SIDECREER') return 'Convenio Sidecreer';
      if (cod === 'QUAD_MUNICIPALES') return 'QUAD Municipales';
      return 'FEDEM Provincial';
    }

    function obtenerRequisitosPorLinea(lineaAyuda) {
      const cod = normalizarCodigoLineaWA(lineaAyuda);
      const comunes = [
        '✅ Recibo de sueldo en formato PDF (último período emitido).',
        '✅ Foto DNI frente y dorso (legible).',
        '✅ Número de celular propio y número alternativo de contacto.',
        '✅ Número de CUIL.',
        '✅ Correo electrónico activo.',
        '✅ Constancia de CBU / Certificado de cuenta bancaria.'
      ];
      if (cod === 'CONVENIO_SIDECREER') {
        return [
          ...comunes,
          '✅ Foto de frente y dorso de la Tarjeta Sidecreer.',
          '✅ Último resumen de cuenta de la Tarjeta Sidecreer (se toma directamente como comprobante de servicio/domicilio).'
        ].join('\n');
      }
      return [
        ...comunes,
        '✅ Foto o archivo PDF de SERVICIO a su nombre o CERTIFICADO DE VECINDAD (fecha de emisión no mayor a 2 meses de antigüedad).'
      ].join('\n');
    }

    function formatearMontoWA(valor) {
      if (typeof valor === 'string' && valor.trim() !== '' && /[.,]/.test(valor)) {
        return valor.replace(/^\$\s*/, '').trim();
      }
      const num = Number(valor);
      return formatNumberDecimals(isNaN(num) ? 0 : num);
    }

    function obtenerContactoAsesorWA() {
      try {
        const sess = typeof getSession === 'function' ? getSession() : null;
        if (sess && sess.nombre) {
          const org = sess.nombreOrganizacion || sess.nombre_organizacion || 'Mutual Modelo (AMMER)';
          return `👤 *Asesor/a:* ${sess.nombre} — ${org}`;
        }
      } catch (_) {}
      return '🏛️ *Asociación Mutual Modelo de Entre Ríos (AMMER)*';
    }

    /**
     * Función constructora modular del mensaje de WhatsApp del Simulador.
     * @param {Object} params
     * @param {'neto'|'monto'|'cuota'} params.modo - Modalidad de simulación ('neto'/'monto' o 'cuota')
     * @param {number|string} params.monto - Monto solicitado (en modo neto)
     * @param {number|string} params.cuota - Cuota objetivo (en modo cuota)
     * @param {Array<Object>|string} params.planes - Lista de planes [{ plazo, monto, cuota }] o texto preformateado
     * @param {string} params.lineaAyuda - Código o clave de la línea ('fedem', 'muni', 'sidecreer', 'FEDEM_PROVINCIAL', 'QUAD_MUNICIPALES', 'CONVENIO_SIDECREER')
     * @param {string|Object} [params.customTemplate] - Plantilla personalizada (con etiquetas {nombre_asociado}, {linea}, {planes}, {requisitos}, {contacto})
     * @param {string} [params.versionPlantilla] - 'oficial' | 'resumida' | 'personalizada'
     * @param {string} [params.nombreAsociado] - Nombre opcional del socio
     * @param {string} [params.contacto] - Firma o datos de contacto del asesor
     */
    function generarMensajeWhatsApp({
      modo = 'neto',
      monto = 0,
      cuota = 0,
      planes = [],
      lineaAyuda = 'FEDEM_PROVINCIAL',
      customTemplate = null,
      versionPlantilla = 'oficial',
      nombreAsociado = '',
      contacto = ''
    } = {}) {
      const esModoCuota = String(modo || '').toLowerCase().includes('cuota');
      const montoStr = formatearMontoWA(monto);
      const cuotaStr = formatearMontoWA(cuota);

      const encabezadoModalidad = esModoCuota
        ? `🎯 *Cuota Objetivo:* $ ${cuotaStr}`
        : `💰 *Monto Solicitado:* $ ${montoStr}`;

      let listaPlanesTexto = '';
      if (typeof planes === 'string' && planes.trim() !== '') {
        listaPlanesTexto = planes.trim();
      } else if (Array.isArray(planes) && planes.length > 0) {
        listaPlanesTexto = planes.map(p => {
          const nCuotas = p.plazo || p.cuotas || p.cantidadCuotas || 12;
          const mPlan = formatearMontoWA(p.neto !== undefined ? p.neto : (p.montoOtorgable !== undefined ? p.montoOtorgable : (p.monto !== undefined ? p.monto : monto)));
          const cPlan = formatearMontoWA(p.cuota !== undefined ? p.cuota : (p.valorCuota !== undefined ? p.valorCuota : cuota));
          return `💰 $ ${mPlan} en ${nCuotas} cuotas fijas de $ ${cPlan}`;
        }).join('\n');
      }

      const bloquePlanesConEncabezado = listaPlanesTexto.trim();
      const requisitosCondicionales = obtenerRequisitosPorLinea(lineaAyuda);
      const lineaLegible = obtenerNombreLineaLegibleWA(lineaAyuda);
      const nombreLimpio = String(nombreAsociado || '').trim();
      const saludoInicial = nombreLimpio ? `¡Hola ${nombreLimpio}! 👋` : '¡Hola! 👋';
      const firmaContacto = String(contacto || '').trim() || obtenerContactoAsesorWA();

      const verNorm = (versionPlantilla === 'estandar' || !versionPlantilla) ? 'oficial' : versionPlantilla;

      if (verNorm === 'personalizada' || customTemplate) {
        let rawTpl = '';
        const origenTpl = customTemplate || GestorPlantillas.obtenerConfigPersonalizada();
        if (typeof origenTpl === 'string') {
          rawTpl = origenTpl;
        } else if (origenTpl && typeof origenTpl === 'object') {
          rawTpl = origenTpl.raw || '';
        }
        if (!rawTpl || !rawTpl.trim()) {
          rawTpl = PLANTILLA_PERSONALIZADA_DEFAULT.raw;
        }

        let interpolado = rawTpl
          .replace(/\{nombre_asociado\}/gi, nombreLimpio)
          .replace(/\{linea\}/gi, lineaLegible)
          .replace(/\{encabezado_modalidad\}/gi, encabezadoModalidad)
          .replace(/\{lista_planes\}/gi, listaPlanesTexto)
          .replace(/\{planes\}/gi, bloquePlanesConEncabezado)
          .replace(/\{requisitos\}/gi, requisitosCondicionales)
          .replace(/\{contacto\}/gi, firmaContacto);

        // Limpiar espacios sobrantes cuando {nombre_asociado} está vacío (ej. "¡Hola ! " -> "¡Hola! ")
        interpolado = interpolado
          .replace(/¡Hola\s+!/g, '¡Hola!')
          .replace(/Hola\s+,/g, 'Hola,')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        return interpolado;
      }

      if (verNorm === 'resumida') {
        return `${saludoInicial} Te compartimos la cotización de *Mutual Modelo* (${lineaLegible}):

${listaPlanesTexto}

📌 *Requisitos para avanzar:*
${requisitosCondicionales}`;
      }

      // Plantilla Base Oficial AMMER (por defecto)
      return `${saludoInicial} Te compartimos la simulación oficial de la Mutual Modelo:

${listaPlanesTexto}

En caso de estar interesado y *para poder avanzar con la gestión* online, por favor indique el plan y *envíe* lo que se le solicita a continuación:
${requisitosCondicionales}

Aguardo su respuesta. Muchas gracias.`;
    }

    const GestorPlantillas = {
      plantillas: {
        oficial: (datos) => generarMensajeWhatsApp({ ...datos, versionPlantilla: 'oficial' }),
        estandar: (datos) => generarMensajeWhatsApp({ ...datos, versionPlantilla: 'oficial' }),
        resumida: (datos) => generarMensajeWhatsApp({ ...datos, versionPlantilla: 'resumida' }),
        personalizada: (datos) => generarMensajeWhatsApp({ ...datos, versionPlantilla: 'personalizada' })
      },
      guardarPersonalizada: function(configOTexto) {
        let objGuardar = null;
        if (typeof configOTexto === 'string') {
          objGuardar = {
            intro: document.getElementById('inpWaCustomIntro')?.value || PLANTILLA_PERSONALIZADA_DEFAULT.intro,
            cierre: document.getElementById('inpWaCustomCierre')?.value || PLANTILLA_PERSONALIZADA_DEFAULT.cierre,
            raw: configOTexto,
            updatedAt: new Date().toISOString()
          };
        } else if (configOTexto && typeof configOTexto === 'object') {
          objGuardar = {
            intro: configOTexto.intro || PLANTILLA_PERSONALIZADA_DEFAULT.intro,
            cierre: configOTexto.cierre || PLANTILLA_PERSONALIZADA_DEFAULT.cierre,
            raw: configOTexto.raw || PLANTILLA_PERSONALIZADA_DEFAULT.raw,
            updatedAt: new Date().toISOString()
          };
        }
        if (objGuardar) {
          localStorage.setItem(WA_CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(objGuardar));
          localStorage.setItem('AMMER_PLANTILLA_CUSTOM', objGuardar.raw);
          localStorage.setItem(WA_DEFAULT_VERSION_STORAGE_KEY, 'personalizada');
        }
      },
      obtenerConfigPersonalizada: function() {
        try {
          const guardado = localStorage.getItem(WA_CUSTOM_TEMPLATE_STORAGE_KEY) || localStorage.getItem('AMMER_PLANTILLA_CUSTOM');
          if (!guardado) return { ...PLANTILLA_PERSONALIZADA_DEFAULT };
          if (guardado.trim().startsWith('{')) {
            const parsed = JSON.parse(guardado);
            if (parsed && typeof parsed === 'object' && parsed.raw) {
              return {
                intro: parsed.intro || PLANTILLA_PERSONALIZADA_DEFAULT.intro,
                cierre: parsed.cierre || PLANTILLA_PERSONALIZADA_DEFAULT.cierre,
                raw: parsed.raw
              };
            }
          }
          return {
            intro: PLANTILLA_PERSONALIZADA_DEFAULT.intro,
            cierre: PLANTILLA_PERSONALIZADA_DEFAULT.cierre,
            raw: guardado
          };
        } catch (_) {
          return { ...PLANTILLA_PERSONALIZADA_DEFAULT };
        }
      },
      obtenerPersonalizada: function() {
        return this.obtenerConfigPersonalizada().raw;
      },
      restablecerPorDefecto: function() {
        localStorage.removeItem(WA_CUSTOM_TEMPLATE_STORAGE_KEY);
        localStorage.removeItem('AMMER_PLANTILLA_CUSTOM');
        localStorage.setItem(WA_DEFAULT_VERSION_STORAGE_KEY, 'oficial');
      }
    };

    const versionGuardadaInicial = (() => {
      try {
        const pref = localStorage.getItem(WA_DEFAULT_VERSION_STORAGE_KEY);
        if (pref && ['oficial', 'resumida', 'personalizada'].includes(pref)) return pref;
        if (localStorage.getItem(WA_CUSTOM_TEMPLATE_STORAGE_KEY)) return 'personalizada';
      } catch (_) {}
      return 'oficial';
    })();

    const state = {
      linea: 'fedem',
      modo: 'neto',
      montoInputRaw: 100000,
      plazo: 12,
      plantillaVersion: versionGuardadaInicial,
      waPlazosSeleccionados: [6, 12, 18, 24, 36, 48],
      waNombreAsociado: ''
    };
    const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

    function formatMoney(num) { return (isNaN(num) || !isFinite(num)) ? '$ 0,00' : currencyFormatter.format(num); }
    function formatNumberDecimals(num) { return (isNaN(num) || !isFinite(num)) ? '0,00' : currencyFormatter.format(num).replace(/[^0-9,.-]/g, '').trim(); }

    function calculateSimulation(lineaKey, plazo, modo, montoInput) {
      const plazosValidos = (lineaKey === 'muni' || lineaKey === 'municipales') ? [12, 24] : [6, 12, 18, 24, 36, 48];
      if (!plazosValidos.includes(plazo)) return null;
      let res = null, capitalQuad = 0;
      if (lineaKey === 'fedem') {
        res = (modo === 'neto') ? MOTOR_FINANCIERO_EXACTO.calcularFEDEM(montoInput, plazo) : MOTOR_FINANCIERO_EXACTO.calcularFEDEMDesdeCuota(montoInput, plazo);
      } else if (lineaKey === 'muni' || lineaKey === 'municipales') {
        res = (modo === 'neto') ? MOTOR_FINANCIERO_EXACTO.calcularMunicipales(montoInput, plazo) : MOTOR_FINANCIERO_EXACTO.calcularMunicipalesDesdeCuota(montoInput, plazo);
        capitalQuad = res.capitalQuad;
      } else if (lineaKey === 'sidecreer') {
        res = (modo === 'neto') ? MOTOR_FINANCIERO_EXACTO.calcularSidecreer(montoInput, plazo) : MOTOR_FINANCIERO_EXACTO.calcularSidecreerDesdeCuota(montoInput, plazo);
      }
      if (!res) return null;
      return {
        lineaKey, plazo, modo,
        neto: res.neto !== undefined ? res.neto : montoInput,
        cuota: res.cuotaFinal,
        totalAyuda: res.totalPagar,
        capital: res.capitalBruto,
        capitalQuad
      };
    }

    function obtenerTasaCostoTexto(lineaKey, plazo) {
      if (lineaKey === 'fedem') {
        const p = MOTOR_FINANCIERO_EXACTO.fedem && MOTOR_FINANCIERO_EXACTO.fedem[plazo];
        return p ? ('TEM: ' + (p.tem * 100).toFixed(2) + '% | TNA: ' + (p.tna * 100).toFixed(2) + '%') : 'Tasa Oficial FEDEM';
      }
      if (lineaKey === 'sidecreer') {
        const p = MOTOR_FINANCIERO_EXACTO.sidecreer && MOTOR_FINANCIERO_EXACTO.sidecreer[plazo];
        return p ? ('TEM: ' + (p.tem * 100).toFixed(2) + '% | TNA: ' + (p.tna * 100).toFixed(2) + '%') : 'Tasa Oficial Sidecreer';
      }
      if (lineaKey === 'muni' || lineaKey === 'municipales') {
        return 'TEM: 3.30% | TNA: 39.60% (Convenio VIKINGO / QUAD)';
      }
      return 'Tasas y gastos vigentes Mutual';
    }

    function renderApp() {
      const lineaObj = FINANCIAL_DATA[state.linea];
      if (!lineaObj.plazosValidos.includes(state.plazo)) state.plazo = lineaObj.plazosValidos[0];

      document.querySelectorAll('.line-option-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('lineBtn-' + state.linea)?.classList.add('active');
      if (typeof actualizarBannerFechaCobroSimulador === 'function') actualizarBannerFechaCobroSimulador();

      document.getElementById('modeBtn-neto')?.classList.toggle('active', state.modo === 'neto');
      document.getElementById('modeBtn-cuota')?.classList.toggle('active', state.modo === 'cuota');
      const label = document.getElementById('amountInputLabel');
      if (label) label.textContent = (state.modo === 'neto') ? "Monto Neto a Entregar" : "Cuota Mensual Objetivo";

      const muniNotice = document.getElementById('muniNotice');
      if (muniNotice) muniNotice.style.display = (state.linea === 'muni') ? 'flex' : 'none';

      const sidecreerCard = document.getElementById('sidecreerConsultaCard');
      if (sidecreerCard) sidecreerCard.style.display = (state.linea === 'sidecreer') ? 'block' : 'none';
      if (typeof window.actualizarVisibilidadAdminSidecreerWA === 'function') window.actualizarVisibilidadAdminSidecreerWA();

      const sidecreerDecimalesNotice = document.getElementById('sidecreerDecimalesNotice');
      if (sidecreerDecimalesNotice) sidecreerDecimalesNotice.style.display = (state.linea === 'sidecreer') ? 'flex' : 'none';

      const ctxBadge = document.getElementById('waSimContextBadge');
      if (ctxBadge) {
        const nomLin = obtenerNombreLineaLegibleWA(state.linea);
        const nomMod = (state.modo === 'cuota') ? '🎯 Por Cuota Objetivo' : '💰 Por Monto Solicitado';
        ctxBadge.textContent = `${nomLin} • ${nomMod}`;
      }

      const selTpl = document.getElementById('sel-version-plantilla');
      if (selTpl && selTpl.value !== state.plantillaVersion) {
        selTpl.value = ['oficial', 'resumida', 'personalizada'].includes(state.plantillaVersion) ? state.plantillaVersion : 'oficial';
      }

      [6, 12, 18, 24, 36, 48].forEach(p => {
        const btn = document.getElementById('btnPlazo-' + p);
        if (!btn) return;
        const isSupported = lineaObj.plazosValidos.includes(p);
        btn.disabled = !isSupported;
        btn.classList.toggle('active', isSupported && state.plazo === p);
      });

      const result = calculateSimulation(state.linea, state.plazo, state.modo, state.montoInputRaw);
      if (!result) return;

      const totalLabel = document.getElementById('kpiTotalLabel'), totalBadge = document.getElementById('kpiTotalBadge');
      const capitalLabel = document.getElementById('kpiCapitalLabel'), capitalBadge = document.getElementById('kpiCapitalBadge');

      if (state.linea === 'muni' || state.linea === 'sidecreer') {
        if (totalLabel) totalLabel.textContent = "TOTAL A PAGAR";
        if (totalBadge) totalBadge.textContent = (state.linea === 'sidecreer') ? "Importe ($) en Sidecreer" : "Total a Devolver";
        if (capitalLabel) capitalLabel.textContent = "IMPORTE SOLICITADO";
        if (capitalBadge) capitalBadge.textContent = "Capital Computable";
      } else {
        if (totalLabel) totalLabel.textContent = "TOTAL AYUDA ECONÓMICA";
        if (totalBadge) totalBadge.textContent = "Total a Devolver";
        if (capitalLabel) capitalLabel.textContent = "CAPITAL";
        if (capitalBadge) capitalBadge.textContent = "Capital Computable";
      }

      document.getElementById('kpiCuotaVal').textContent = formatMoney(result.cuota);
      document.getElementById('kpiCuotaBadge').textContent = result.plazo + " cuotas fijas";
      document.getElementById('kpiNetoVal').textContent = formatMoney(result.neto);
      document.getElementById('kpiTotalVal').textContent = formatMoney(result.totalAyuda);
      document.getElementById('kpiCapitalVal').textContent = formatMoney(result.capital);

      renderMatrixTable();
      actualizarBannerFechaCobroSimulador();
      const adminDesgloseAcc = document.getElementById('simuladorDesgloseAdminAccordion');
      const adminDesgloseBody = document.getElementById('simuladorDesgloseAdminBody');
      if (adminDesgloseAcc && adminDesgloseBody) {
        const esAdminSim = (typeof esAdminAuditoria === 'function') && esAdminAuditoria();
        if (esAdminSim) {
          adminDesgloseAcc.style.display = '';
          const gastosAdmin = Math.max(0, Number(result.capital || 0) - Number(result.neto || 0));
          const tasaTxt = (typeof obtenerTasaCostoTexto === 'function') ? obtenerTasaCostoTexto(state.linea, state.plazo) : '—';
          adminDesgloseBody.innerHTML =
            '<div class="sim-admin-desglose-grid">' +
              '<div class="sim-admin-desglose-item"><span>Tasa / Costo Ref.</span><strong class="tabular-nums">' + sanitizeHTML(tasaTxt) + '</strong></div>' +
              '<div class="sim-admin-desglose-item"><span>Capital Computable</span><strong class="tabular-nums">' + formatMoney(result.capital) + '</strong></div>' +
              '<div class="sim-admin-desglose-item"><span>Gastos Administrativos</span><strong class="tabular-nums">' + formatMoney(gastosAdmin) + '</strong></div>' +
              '<div class="sim-admin-desglose-item"><span>Total a Devolver</span><strong class="tabular-nums">' + formatMoney(result.totalAyuda) + '</strong></div>' +
            '</div>';
        } else {
          adminDesgloseAcc.style.display = 'none';
          adminDesgloseAcc.removeAttribute('open');
          adminDesgloseBody.innerHTML = '';
        }
      }
      renderWaPlazosSelector();
      updateWhatsAppPreview();
    }

    const STORAGE_KEY_FECHAS_CORTE = 'ammer_fechas_corte_config_v1';
    const STORAGE_KEY_HISTORIAL_CORTE = 'ammer_fechas_corte_historial_v1';
    const LINEAS_CORTE_LISTA = [
      { key: 'fedem', label: 'FEDEM Provincial', defaultDay: 15 },
      { key: 'muni', label: 'Municipales QUAD', defaultDay: 15 },
      { key: 'sidecreer', label: 'Tarjeta Sidecreer', defaultDay: 15 }
    ];

    function normalizarLineaCorteKey(lineaRaw) {
      const k = String(lineaRaw || 'fedem').toLowerCase();
      if (k === 'municipales' || k === 'muni' || k.includes('muni') || k.includes('quad')) return 'muni';
      if (k.includes('sidecreer')) return 'sidecreer';
      return 'fedem';
    }

    function obtenerConfigFechasCorte() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_FECHAS_CORTE);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }

    function obtenerHistorialFechasCorte() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_HISTORIAL_CORTE);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function formatearFechaDMY(yyyy, mm, dd) {
      return String(dd).padStart(2, '0') + '/' + String(mm).padStart(2, '0') + '/' + String(yyyy);
    }

    function sumarMeses(yyyy, mm, offsetMeses) {
      const totalMeses = (yyyy * 12) + (mm - 1) + offsetMeses;
      const nuevoAnio = Math.floor(totalMeses / 12);
      const nuevoMes = (totalMeses % 12) + 1;
      return { anio: nuevoAnio, mes: nuevoMes };
    }

    function obtenerFechaCorteParaMes(lineaKey, anio, mes) {
      const key = normalizarLineaCorteKey(lineaKey);
      const mesKey = anio + '-' + String(mes).padStart(2, '0');
      const cfg = obtenerConfigFechasCorte();
      const fechaGuardada = cfg[key] && cfg[key][mesKey];
      if (fechaGuardada && /^\d{4}-\d{2}-\d{2}$/.test(fechaGuardada)) {
        return fechaGuardada;
      }
      const def = LINEAS_CORTE_LISTA.find(l => l.key === key)?.defaultDay || 15;
      const ultimoDiaMes = new Date(anio, mes, 0).getDate();
      const dia = Math.min(def, ultimoDiaMes);
      return mesKey + '-' + String(dia).padStart(2, '0');
    }

    function calcularVencimientosPorCorte(lineaKey, cAnio, cMes) {
      const key = normalizarLineaCorteKey(lineaKey);
      if (key === 'muni') {
        // Municipales QUAD: Pre-corte -> último día del mismo mes; Pos-corte -> último día del mes siguiente
        const preMes = sumarMeses(cAnio, cMes, 0);
        const ultimoDiaPre = new Date(preMes.anio, preMes.mes, 0).getDate();
        const posMes = sumarMeses(cAnio, cMes, 1);
        const ultimoDiaPos = new Date(posMes.anio, posMes.mes, 0).getDate();
        return {
          preCorteStr: formatearFechaDMY(preMes.anio, preMes.mes, ultimoDiaPre),
          posCorteStr: formatearFechaDMY(posMes.anio, posMes.mes, ultimoDiaPos)
        };
      }
      // FEDEM / Sidecreer: Pre-corte -> día 10 del mes siguiente; Pos-corte -> día 10 del mes subsiguiente
      const preMes = sumarMeses(cAnio, cMes, 1);
      const posMes = sumarMeses(cAnio, cMes, 2);
      return {
        preCorteStr: formatearFechaDMY(preMes.anio, preMes.mes, 10),
        posCorteStr: formatearFechaDMY(posMes.anio, posMes.mes, 10)
      };
    }

    function calcularFechaCobroPrimerCuota(lineaKey, fechaGestionDate) {
      const hoy = fechaGestionDate instanceof Date ? fechaGestionDate : new Date();
      const gAnio = hoy.getFullYear();
      const gMes = hoy.getMonth() + 1;
      const gDia = hoy.getDate();

      const fechaCorteIso = obtenerFechaCorteParaMes(lineaKey, gAnio, gMes);
      const [cAnio, cMes, cDia] = fechaCorteIso.split('-').map(n => parseInt(n, 10));

      const gestionNum = (gAnio * 10000) + (gMes * 100) + gDia;
      const corteNum = (cAnio * 10000) + (cMes * 100) + cDia;
      const superoCorte = gestionNum > corteNum;

      const vencs = calcularVencimientosPorCorte(lineaKey, cAnio, cMes);

      return {
        fechaCobroStr: superoCorte ? vencs.posCorteStr : vencs.preCorteStr,
        preCorteStr: vencs.preCorteStr,
        posCorteStr: vencs.posCorteStr,
        fechaCorteStr: formatearFechaDMY(cAnio, cMes, cDia),
        fechaCorteIso: fechaCorteIso,
        superoCorte: superoCorte
      };
    }

    async function sincronizarFechasCorteDesdeNube() {
      try {
        const resp = await fetch(`${RENDER_API_URL}/api/config/fechas-corte`, {
          method: 'GET',
          cache: 'no-store'
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        if (!data || !data.ok) return false;

        if (data.config && typeof data.config === 'object') {
          localStorage.setItem(STORAGE_KEY_FECHAS_CORTE, JSON.stringify(data.config));
        }
        if (Array.isArray(data.historial)) {
          localStorage.setItem(STORAGE_KEY_HISTORIAL_CORTE, JSON.stringify(data.historial));
        }

        actualizarBannerFechaCobroSimulador();
        const modal = document.getElementById('modalFechaCorteAdmin');
        if (modal && modal.classList.contains('active')) {
          const selMes = document.getElementById('fcMesSelector');
          cargarInputsFechaCortePorMes(selMes ? selMes.value : undefined);
          renderHistorialFechasCorte();
        }
        return true;
      } catch (e) {
        console.warn('No se pudo sincronizar fechas de corte desde la nube:', e);
        return false;
      }
    }

    function actualizarBannerFechaCobroSimulador() {
      const valEl = document.getElementById('simuladorFechaCobroVal');
      const metaEl = document.getElementById('simuladorFechaCobroMeta');
      const btnAdmin = document.getElementById('btnAdminFechaCorte');
      const lineaKey = normalizarLineaCorteKey(typeof state !== 'undefined' ? state.linea : 'fedem');
      const lineaNombre = (FINANCIAL_DATA[lineaKey] && FINANCIAL_DATA[lineaKey].name) || 'FEDEM Provincial';

      if (valEl) {
        const calc = calcularFechaCobroPrimerCuota(lineaKey, new Date());
        valEl.textContent = calc.fechaCobroStr;
        if (metaEl) {
          const estadoHtml = calc.superoCorte
            ? '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:9999px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:0.68rem;font-weight:700;margin-left:4px;">Cerrado (' + sanitizeHTML(calc.fechaCorteStr) + ')</span>'
            : '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:9999px;background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;font-size:0.68rem;font-weight:700;margin-left:4px;">Abierto · Cierra ' + sanitizeHTML(calc.fechaCorteStr) + '</span>';
          metaEl.innerHTML = '(' + sanitizeHTML(lineaNombre) + ') ' + estadoHtml;
        }
      }

      if (btnAdmin) {
        const session = (typeof getSession === 'function') ? getSession() : null;
        const esAdmin = Boolean(session && String(session.rol || '').toLowerCase().includes('admin'));
        btnAdmin.style.display = esAdmin ? 'inline-flex' : 'none';
      }
    }

    function cargarInputsFechaCortePorMes(mesKeyParam) {
      const hoy = new Date();
      const mesDefault = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
      const mesKey = (mesKeyParam && /^\d{4}-\d{2}$/.test(mesKeyParam)) ? mesKeyParam : mesDefault;
      const [anio, mes] = mesKey.split('-').map(n => parseInt(n, 10));

      const selMes = document.getElementById('fcMesSelector');
      if (selMes && selMes.value !== mesKey) selMes.value = mesKey;

      LINEAS_CORTE_LISTA.forEach(item => {
        const inp = document.getElementById('fcInput-' + item.key);
        if (inp) {
          inp.value = obtenerFechaCorteParaMes(item.key, anio, mes);
        }
      });
    }

    function renderHistorialFechasCorte() {
      const tbody = document.getElementById('tbodyHistorialFechasCorte');
      if (!tbody) return;
      const hist = obtenerHistorialFechasCorte();
      if (hist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:0.85rem;text-align:center;color:#64748b;">Aún no hay fechas de corte registradas en el historial.</td></tr>';
        return;
      }
      const hoy = new Date();
      const hoyNum = (hoy.getFullYear() * 10000) + ((hoy.getMonth() + 1) * 100) + hoy.getDate();

      tbody.innerHTML = hist.map(reg => {
        const parts = String(reg.fechaCorte || '').split('-').map(n => parseInt(n, 10));
        let preCorteHtml = '<span style="color:#64748b;">--/--/----</span>';
        let posCorteHtml = '<span style="color:#64748b;">--/--/----</span>';
        let estadoHtml = '<span style="color:#64748b;">—</span>';
        let corteFmt = reg.fechaCorte || '—';
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          corteFmt = formatearFechaDMY(parts[0], parts[1], parts[2]);
          const corteNum = (parts[0] * 10000) + (parts[1] * 100) + parts[2];
          const cerrado = hoyNum > corteNum;
          const vencs = calcularVencimientosPorCorte(reg.linea || reg.lineaNombre || 'fedem', parts[0], parts[1]);
          preCorteHtml = '<span style="' + (!cerrado ? 'font-weight:800;color:#15803d;' : 'color:#64748b;') + '">' + sanitizeHTML(vencs.preCorteStr) + '</span>';
          posCorteHtml = '<span style="' + (cerrado ? 'font-weight:800;color:#c2410c;' : 'color:#0f172a;') + '">' + sanitizeHTML(vencs.posCorteStr) + '</span>';
          estadoHtml = cerrado
            ? '<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:1px 6px;border-radius:9999px;font-size:0.65rem;font-weight:700;">Cerrado</span>'
            : '<span style="background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;padding:1px 6px;border-radius:9999px;font-size:0.65rem;font-weight:700;">Abierto</span>';
        }
        return '<tr style="border-bottom:1px solid #f1f5f9;">' +
          '<td style="padding:0.45rem 0.55rem;font-weight:700;font-family:monospace;">' + sanitizeHTML(reg.periodo || '—') + '</td>' +
          '<td style="padding:0.45rem 0.55rem;font-weight:600;color:#0f172a;">' + sanitizeHTML(reg.lineaNombre || reg.linea || '—') + '</td>' +
          '<td style="padding:0.45rem 0.55rem;font-family:monospace;font-weight:700;color:#1d4ed8;">' + sanitizeHTML(corteFmt) + '</td>' +
          '<td style="padding:0.45rem 0.55rem;font-family:monospace;">' + preCorteHtml + '</td>' +
          '<td style="padding:0.45rem 0.55rem;font-family:monospace;">' + posCorteHtml + '</td>' +
          '<td style="padding:0.45rem 0.55rem;">' + estadoHtml + '</td>' +
          '<td style="padding:0.45rem 0.55rem;color:#64748b;">' + sanitizeHTML(reg.usuario || 'Admin') + ' · ' + sanitizeHTML(reg.fechaCarga || '') + '</td>' +
        '</tr>';
      }).join('');
    }

    function abrirModalFechaCorte() {
      const session = (typeof getSession === 'function') ? getSession() : null;
      if (!session || !String(session.rol || '').toLowerCase().includes('admin')) {
        if (typeof showToast === 'function') showToast('⛔ Solo el rol Admin puede configurar fechas de corte.');
        return;
      }
      const hoy = new Date();
      const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
      cargarInputsFechaCortePorMes(mesActual);
      renderHistorialFechasCorte();
      abrirModal('modalFechaCorteAdmin');
      sincronizarFechasCorteDesdeNube();
    }

    async function guardarFechasCorteAdmin() {
      const selMes = document.getElementById('fcMesSelector');
      const btnGuardar = document.getElementById('btnGuardarFechasCorte');
      const hoy = new Date();
      const mesKey = (selMes && selMes.value) ? selMes.value : (hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0'));
      const cfg = obtenerConfigFechasCorte();
      const hist = obtenerHistorialFechasCorte();
      const session = (typeof getSession === 'function') ? getSession() : null;
      const usuarioStr = (session && session.nombre) ? session.nombre : 'Admin';
      const ahoraStr = formatearFechaDMY(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()) + ' ' +
        String(hoy.getHours()).padStart(2, '0') + ':' + String(hoy.getMinutes()).padStart(2, '0');

      let cambios = 0;
      LINEAS_CORTE_LISTA.forEach(item => {
        const inp = document.getElementById('fcInput-' + item.key);
        const val = inp ? String(inp.value || '').trim() : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return;
        if (!cfg[item.key]) cfg[item.key] = {};
        const anterior = cfg[item.key][mesKey];
        cfg[item.key][mesKey] = val;
        if (anterior !== val) {
          cambios++;
          hist.unshift({
            periodo: mesKey,
            linea: item.key,
            lineaNombre: item.label,
            fechaCorte: val,
            usuario: usuarioStr,
            fechaCarga: ahoraStr
          });
        }
      });

      const histRecortado = hist.slice(0, 120);
      try {
        localStorage.setItem(STORAGE_KEY_FECHAS_CORTE, JSON.stringify(cfg));
        localStorage.setItem(STORAGE_KEY_HISTORIAL_CORTE, JSON.stringify(histRecortado));
      } catch (e) {
        console.warn('No se pudo guardar fechas de corte en localStorage:', e);
      }

      renderHistorialFechasCorte();
      actualizarBannerFechaCobroSimulador();

      if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = '⏳ Sincronizando...';
      }

      let syncOk = false;
      try {
        const resp = await fetchConTimeout(`${RENDER_API_URL}/api/config/fechas-corte`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: cfg, historial: histRecortado })
        }, 25000);
        if (resp.ok) {
          const resJson = await resp.json();
          syncOk = Boolean(resJson && resJson.ok);
        }
      } catch (e) {
        console.warn('Error sincronizando fechas de corte con la nube:', e);
      } finally {
        if (btnGuardar) {
          btnGuardar.disabled = false;
          btnGuardar.textContent = '💾 Guardar Fechas de Corte';
        }
      }

      if (typeof showToast === 'function') {
        if (syncOk) {
          showToast(cambios > 0 ? '✅ Fechas de corte guardadas y sincronizadas para todos los usuarios.' : '✅ Fechas de corte confirmadas y sincronizadas en la nube.');
        } else {
          showToast('⚠️ Guardado local únicamente; no se pudo sincronizar con el servidor.');
        }
      }
    }

    window.abrirModalFechaCorte = abrirModalFechaCorte;
    window.cargarInputsFechaCortePorMes = cargarInputsFechaCortePorMes;
    window.guardarFechasCorteAdmin = guardarFechasCorteAdmin;
    window.actualizarBannerFechaCobroSimulador = actualizarBannerFechaCobroSimulador;
    window.sincronizarFechasCorteDesdeNube = sincronizarFechasCorteDesdeNube;

    function renderMatrixTable() {
      const tbody = document.getElementById('matrixTableBody');
      if (!tbody) return;
      const lineaObj = FINANCIAL_DATA[state.linea];
      let html = '';
      lineaObj.plazosValidos.forEach(p => {
        const sim = calculateSimulation(state.linea, p, state.modo, state.montoInputRaw);
        if (!sim) return;
        const isActive = (p === state.plazo);
        html += '<tr class="clickable-row ' + (isActive ? 'active-matrix-row' : '') + '" onclick="setPlazo(' + p + ')">' +
          '<td>' + formatMoney(sim.neto) + '</td>' +
          '<td><strong>' + p + ' Cuotas</strong></td>' +
          '<td>' + formatMoney(sim.cuota) + '</td></tr>';
      });
      tbody.innerHTML = html;
    }

    let isWhatsAppCustomEdited = false;
    let _ultimoCampoEditorWA = null;

    function renderWaPlazosSelector() {
      const container = document.getElementById('waPlazosSelectorContainer');
      if (!container) return;
      const lineaObj = FINANCIAL_DATA[state.linea];
      const plazosDisponibles = lineaObj.plazosValidos || [6, 12, 18, 24, 36, 48];
      const todosPlazos = [6, 12, 18, 24, 36, 48];

      container.innerHTML = todosPlazos.map(p => {
        const isValido = plazosDisponibles.includes(p);
        const isChecked = isValido && (!state.waPlazosSeleccionados || state.waPlazosSeleccionados.length === 0 || state.waPlazosSeleccionados.includes(p));
        return '<label style="display:inline-flex;align-items:center;gap:3px;background:#fff;padding:2px 7px;border-radius:4px;border:1px solid ' + (isChecked ? '#10b981' : '#cbd5e1') + ';cursor:' + (isValido ? 'pointer' : 'not-allowed') + ';opacity:' + (isValido ? '1' : '0.45') + ';font-size:0.72rem;font-weight:600;">' +
          '<input type="checkbox" value="' + p + '" ' + (isChecked ? 'checked' : '') + ' ' + (isValido ? '' : 'disabled') + ' onchange="toggleWaPlazo(' + p + ', this.checked)"/> ' +
          p + 'c' +
        '</label>';
      }).join('');
    }

    function toggleWaPlazo(plazo, checked) {
      if (!state.waPlazosSeleccionados) state.waPlazosSeleccionados = [6, 12, 18, 24, 36, 48];
      if (checked) {
        if (!state.waPlazosSeleccionados.includes(plazo)) {
          state.waPlazosSeleccionados.push(plazo);
          state.waPlazosSeleccionados.sort((a,b)=>a-b);
        }
      } else {
        state.waPlazosSeleccionados = state.waPlazosSeleccionados.filter(p => p !== plazo);
      }
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
      renderWaPlazosSelector();
    }

    function buildTemplateData() {
      const sim = calculateSimulation(state.linea, state.plazo, state.modo, state.montoInputRaw);
      if (!sim) return null;
      const lineaObj = FINANCIAL_DATA[state.linea];
      const plazosDisponibles = lineaObj.plazosValidos;

      let plazosAOfrecer = plazosDisponibles.filter(p => {
        return !state.waPlazosSeleccionados || state.waPlazosSeleccionados.length === 0 || state.waPlazosSeleccionados.includes(p);
      });
      if (plazosAOfrecer.length === 0) plazosAOfrecer = [state.plazo];

      const planesCalculados = [];
      let planesTexto = '';
      plazosAOfrecer.forEach(p => {
        // Calcula respetando la modalidad activa ('neto' o 'cuota')
        const s = calculateSimulation(state.linea, p, state.modo, state.montoInputRaw);
        if (s) {
          planesCalculados.push({
            plazo: s.plazo,
            neto: s.neto,
            montoOtorgable: s.neto,
            cuota: s.cuota,
            totalAyuda: s.totalAyuda
          });
          planesTexto += `💰 $ ${formatNumberDecimals(s.neto)} en ${s.plazo} cuotas fijas de $ ${formatNumberDecimals(s.cuota)}\n`;
        }
      });

      const nombreInput = document.getElementById('inp-whatsapp-nombre')?.value || state.waNombreAsociado || '';

      return {
        modo: state.modo,
        monto: sim.neto,
        cuota: sim.cuota,
        planes: planesCalculados,
        lineaAyuda: state.linea,
        nombreAsociado: nombreInput,
        contacto: obtenerContactoAsesorWA(),
        neto: formatNumberDecimals(sim.neto),
        plazoDestacado: sim.plazo,
        cuotaDestacada: formatNumberDecimals(sim.cuota),
        totalDestacado: formatNumberDecimals(sim.totalAyuda),
        planesTexto: planesTexto.trimEnd()
      };
    }

    function generateCurrentTemplateMessage() {
      const datos = buildTemplateData();
      if (!datos) return '';
      const version = (state.plantillaVersion === 'estandar' || !state.plantillaVersion) ? 'oficial' : state.plantillaVersion;
      if (version === 'personalizada') {
        const rawEditor = document.getElementById('txtWaCustomTemplateRaw')?.value;
        const customTpl = (rawEditor && rawEditor.trim() !== '') ? rawEditor : GestorPlantillas.obtenerPersonalizada();
        return generarMensajeWhatsApp({
          ...datos,
          versionPlantilla: 'personalizada',
          customTemplate: customTpl
        });
      }
      return generarMensajeWhatsApp({
        ...datos,
        versionPlantilla: version
      });
    }

    function cargarValoresEnEditorPlantillaWA() {
      const cfg = GestorPlantillas.obtenerConfigPersonalizada();
      const inpIntro = document.getElementById('inpWaCustomIntro');
      const inpCierre = document.getElementById('inpWaCustomCierre');
      const txtRaw = document.getElementById('txtWaCustomTemplateRaw');
      if (inpIntro) inpIntro.value = cfg.intro || PLANTILLA_PERSONALIZADA_DEFAULT.intro;
      if (inpCierre) inpCierre.value = cfg.cierre || PLANTILLA_PERSONALIZADA_DEFAULT.cierre;
      if (txtRaw) txtRaw.value = cfg.raw || PLANTILLA_PERSONALIZADA_DEFAULT.raw;

      [inpIntro, inpCierre, txtRaw].forEach(el => {
        if (el && !el.dataset.focusBound) {
          el.dataset.focusBound = '1';
          el.addEventListener('focus', () => { _ultimoCampoEditorWA = el; });
        }
      });
    }

    function toggleEditorPlantillaWhatsApp(forzarEstado) {
      const panel = document.getElementById('waCustomTemplateEditorPanel');
      const btn = document.getElementById('btnToggleWaTemplateEditor');
      if (!panel) return;
      const abrir = typeof forzarEstado === 'boolean' ? forzarEstado : !panel.classList.contains('open');
      if (abrir) {
        cargarValoresEnEditorPlantillaWA();
      }
      panel.classList.toggle('open', abrir);
      if (btn) btn.classList.toggle('active', abrir);
    }

    function sincronizarEditorPlantillaPersonalizada(origen) {
      const inpIntro = document.getElementById('inpWaCustomIntro');
      const inpCierre = document.getElementById('inpWaCustomCierre');
      const txtRaw = document.getElementById('txtWaCustomTemplateRaw');
      if (!txtRaw) return;

      if (origen === 'partes') {
        const introTxt = (inpIntro?.value || '').trim() || PLANTILLA_PERSONALIZADA_DEFAULT.intro;
        const cierreTxt = (inpCierre?.value || '').trim() || PLANTILLA_PERSONALIZADA_DEFAULT.cierre;
        txtRaw.value = `${introTxt}

{planes}

En caso de estar interesado y *para poder avanzar con la gestión* online, por favor indique el plan y *envíe* lo que se le solicita a continuación:
{requisitos}

${cierreTxt}`;
      }

      state.plantillaVersion = 'personalizada';
      const sel = document.getElementById('sel-version-plantilla');
      if (sel) sel.value = 'personalizada';
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
    }

    function insertarVariablePlantillaWA(tag) {
      const txtRaw = document.getElementById('txtWaCustomTemplateRaw');
      const target = (_ultimoCampoEditorWA && document.body.contains(_ultimoCampoEditorWA)) ? _ultimoCampoEditorWA : txtRaw;
      if (!target) return;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const antes = target.value.slice(0, start);
      const despues = target.value.slice(end);
      target.value = antes + tag + despues;
      target.focus();
      const nuevaPos = start + tag.length;
      target.setSelectionRange(nuevaPos, nuevaPos);
      sincronizarEditorPlantillaPersonalizada(target.id === 'txtWaCustomTemplateRaw' ? 'raw' : 'partes');
    }

    function handleWaRecipientNameInput(val) {
      state.waNombreAsociado = String(val || '');
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
    }

    function handleTemplateVersionChange(version) {
      state.plantillaVersion = version;
      localStorage.setItem(WA_DEFAULT_VERSION_STORAGE_KEY, version);
      if (version === 'personalizada') {
        cargarValoresEnEditorPlantillaWA();
      }
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
      showToast("Formato de plantilla actualizado.");
    }

    function previsualizarPlantillaWhatsApp() {
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
      showToast("👁️ Vista previa de WhatsApp actualizada.");
    }

    function updateWhatsAppPreview(force = false) {
      const textarea = document.getElementById('txt-plantilla-whatsapp'); if (!textarea) return;
      if (!isWhatsAppCustomEdited || force) {
        textarea.value = generateCurrentTemplateMessage();
        const notice = document.getElementById('waCustomNotice'); if (notice) notice.style.display = 'none';
      }
      const now = new Date();
      const tDisp = document.getElementById('waTimeDisplay');
      if (tDisp) tDisp.textContent = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    }

    function guardarMiFormato() {
      const panelAbierto = document.getElementById('waCustomTemplateEditorPanel')?.classList.contains('open');
      const txtRaw = document.getElementById('txtWaCustomTemplateRaw');
      const textarea = document.getElementById('txt-plantilla-whatsapp');

      if (panelAbierto && txtRaw && txtRaw.value.trim()) {
        GestorPlantillas.guardarPersonalizada({
          intro: document.getElementById('inpWaCustomIntro')?.value || PLANTILLA_PERSONALIZADA_DEFAULT.intro,
          cierre: document.getElementById('inpWaCustomCierre')?.value || PLANTILLA_PERSONALIZADA_DEFAULT.cierre,
          raw: txtRaw.value.trim()
        });
      } else {
        const text = textarea ? textarea.value.trim() : '';
        if (!text) { showToast("El texto de la plantilla está vacío."); return; }
        GestorPlantillas.guardarPersonalizada(text);
        if (txtRaw) txtRaw.value = text;
      }

      state.plantillaVersion = 'personalizada';
      const sel = document.getElementById('sel-version-plantilla'); if (sel) sel.value = 'personalizada';
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
      showToast("💾 ¡Plantilla guardada como predeterminada en este navegador!");
    }

    function restablecerPlantillaPorDefecto() {
      GestorPlantillas.restablecerPorDefecto();
      state.plantillaVersion = 'oficial';
      const sel = document.getElementById('sel-version-plantilla'); if (sel) sel.value = 'oficial';
      cargarValoresEnEditorPlantillaWA();
      isWhatsAppCustomEdited = false;
      updateWhatsAppPreview(true);
      showToast("🔄 Plantilla restablecida al formato Oficial AMMER por defecto.");
    }

    function restoreOriginalTemplate() {
      restablecerPlantillaPorDefecto();
    }

    function copyWhatsAppText() {
      const textarea = document.getElementById('txt-plantilla-whatsapp');
      const text = textarea ? textarea.value : ''; if (!text) return;
      navigator.clipboard.writeText(text).then(() => showToast("📋 ¡Mensaje de WhatsApp copiado al portapapeles!")).catch(() => { textarea.select(); document.execCommand('copy'); showToast("📋 ¡Mensaje de WhatsApp copiado al portapapeles!"); });
    }

    function sendWhatsApp() {
      const text = document.getElementById('txt-plantilla-whatsapp')?.value || '';
      const phoneInput = (document.getElementById('inp-whatsapp-telefono')?.value || '').trim().replace(/[^0-9]/g, '');
      const phoneClean = phoneInput ? (phoneInput.startsWith('54') ? phoneInput : '549' + phoneInput) : '';
      const url = phoneClean
        ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    function sendWhatsAppViaBot() {
      if (typeof tieneAccesoBotWhatsapp === 'function' && !tieneAccesoBotWhatsapp()) {
        showToast('⛔ Acceso restringido: el botón Bot solo está habilitado para rol Admin y Analista.', 'warning');
        return;
      }
      const text = document.getElementById('txt-plantilla-whatsapp')?.value || '';
      const phoneInput = (document.getElementById('inp-whatsapp-telefono')?.value || '').trim().replace(/[^0-9]/g, '');
      if (phoneInput.length < 8) {
        showToast('⚠️ Ingresá el número de teléfono destino antes de enviar por Bot WhatsApp.', 'warning');
        document.getElementById('inp-whatsapp-telefono')?.focus();
        return;
      }
      if (typeof window.enviarMensajeViaBotAmmerConFallback === 'function') {
        window.enviarMensajeViaBotAmmerConFallback(phoneInput, text, sendWhatsApp);
      } else {
        sendWhatsApp();
      }
    }

    function setLinea(lineaKey) { if (!FINANCIAL_DATA[lineaKey]) return; state.linea = lineaKey; renderApp(); }
    function setModo(modoKey) {
      if (modoKey !== 'neto' && modoKey !== 'cuota') return;
      state.modo = modoKey;
      if (modoKey === 'cuota' && state.montoInputRaw > 100000) {
        state.montoInputRaw = 25000; document.getElementById('amountInput').value = integerFormatter.format(25000);
      } else if (modoKey === 'neto' && state.montoInputRaw < 30000) {
        state.montoInputRaw = 100000; document.getElementById('amountInput').value = integerFormatter.format(100000);
      }
      renderApp();
    }
    function setPlazo(plazoNum) { state.plazo = parseInt(plazoNum, 10); renderApp(); }
    function setQuickAmount(amount) {
      state.montoInputRaw = amount; document.getElementById('amountInput').value = integerFormatter.format(amount);
      document.querySelectorAll('.chip-btn').forEach(btn => {
        const txt = btn.textContent.replace(/[^0-9]/g, '');
        btn.classList.toggle('active', parseInt(txt, 10) === amount);
      });
      renderApp();
    }
    function sanitizarNumeroInput(valorRaw) {
      if (typeof valorRaw === 'number') return isNaN(valorRaw) ? 0 : valorRaw;
      if (!valorRaw) return 0;
      let limpio = String(valorRaw).trim().replace(/\$/g, '').replace(/\s/g, '');
      if (limpio.includes('.') && limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.');
      else if (limpio.includes(',')) limpio = limpio.replace(',', '.');
      else if ((limpio.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(limpio)) limpio = limpio.replace(/\./g, '');
      const resultado = parseFloat(limpio); return isNaN(resultado) ? 0 : resultado;
    }
    function handleAmountInput(val) {
      const num = sanitizarNumeroInput(val); state.montoInputRaw = num;
      document.querySelectorAll('.chip-btn').forEach(btn => {
        const txt = btn.textContent.replace(/[^0-9]/g, '');
        btn.classList.toggle('active', parseInt(txt, 10) === num);
      });
      renderApp();
    }
    function resetDefaults() {
      state.linea = 'fedem'; state.modo = 'neto'; state.montoInputRaw = 100000; state.plazo = 12; state.plantillaVersion = 'oficial'; state.waPlazosSeleccionados = [6, 12, 18, 24, 36, 48]; state.waNombreAsociado = '';
      const inp = document.getElementById('amountInput'); if (inp) inp.value = '100.000';
      const phoneEl = document.getElementById('inp-whatsapp-telefono'); if (phoneEl) phoneEl.value = '';
      const nameEl = document.getElementById('inp-whatsapp-nombre'); if (nameEl) nameEl.value = '';
      const selVersion = document.getElementById('sel-version-plantilla'); if (selVersion) selVersion.value = 'oficial';
      isWhatsAppCustomEdited = false;
      renderApp(); updateWhatsAppPreview(true); showToast("Valores restablecidos a predeterminados.");
    }

