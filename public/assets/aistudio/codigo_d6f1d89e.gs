/**
 * ============================================================================
 * SISTEMA DE AUDITORÍA Y CRM DE CARTERA - MUTUAL MODELO DE ENTRE RÍOS (AMMER)
 * MÓDULO 1: Codigo.gs V2.0 (Backend Core, Base de Datos, Menú Sheet y Tokens)
 * ============================================================================
 */

const CONFIG_SISTEMA = {
  HOJA_CARTERA: 'Cartera_Base',
  HOJA_CRM: 'CRM_Validaciones',
  HOJA_REGLAS: 'Config_Reglas',
  API_KEY_DEFAULT: '',
  LIMITE_TOKENS_PLAN: 1000000,
  FOLDER_LEGAJOS_ID: '',
  FOLDER_REPORTES_ID: ''
};

/**
 * Menú contextual superior nativo en Google Sheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ AMMER Auditoría IA')
    .addItem('🚀 Inicializar / Actualizar Estructura V2', 'inicializarSistemaAMMER')
    .addItem('🔑 Cargar API Key Predefinida', 'menuConfigurarApiKey')
    .addSeparator()
    .addItem('📊 Ver Consumo de Tokens Actual', 'menuVerConsumoTokens')
    .addItem('🔄 Reiniciar Contador de Tokens', 'menuReiniciarTokens')
    .addToUi();
}

/**
 * Sirve la Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AMMER - Auditoría IA de Cartera y Legajos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inclusión modular de scripts HTML (App_JS)
 */
function incluir(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

/**
 * INICIALIZACIÓN / ACTUALIZACIÓN V2.0:
 * Crea o actualiza encabezados en CRM_Validaciones y Config_Reglas con los nuevos checks solicitados.
 */
function inicializarSistemaAMMER() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Hoja CRM_Validaciones con las nuevas columnas V2.0
  let hojaCRM = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CRM);
  if (!hojaCRM) {
    hojaCRM = ss.insertSheet(CONFIG_SISTEMA.HOJA_CRM);
  }

  const headersCRM = [
    'ID_OPERACION',
    'Fecha_Auditoria',
    'Apellido_Nombre',
    'CUIT_Base',
    'DNI_Extraido',
    'Tipo_Agente',
    'Estado_Global',                // APROBADO | OBSERVADO | RECHAZADO
    'Score_Validacion',             // 0 a 100%
    'Calidad_Nitidez_Firma',        // OPTIMA | ILEGIBLE_BORROSA | CORRUPTA_RECUPERADA
    'Check_Fecha_Nac',              // OK | ALERTA_FECHA (con fechas contrastadas)
    'Check_Identidad_DNI',          // OK | DISCREPANCIA | NO_PRESENTADO
    'Check_Recibo_Titular',         // OK | NO_COINCIDE_TITULAR | NO_PRESENTADO
    'Check_Recibo_Margen50',        // OK | EXCEDE_50_PORC | NO_PRESENTADO
    'Domicilio_Servicio',           // Extraído de la factura de servicio
    'Check_Domicilio_Servicio',     // OK | DISCREPANCIA_DOMICILIO | NO_PRESENTADO
    'Check_Antiguedad_Servicio',    // OK (<=2 meses) | VENCIDO (>2 meses) | NO_PRESENTADO
    'Check_Transferencia_Monto',    // OK | DISCREPANCIA | NO_PRESENTADO
    'Check_Capital_Solicitud',      // OK | DISCREPANCIA | NO_PRESENTADO
    'Check_Percibir_Transf',        // OK | DISCREPANCIA | NO_PRESENTADO
    'Docs_Detectados',
    'Docs_Faltantes',
    'Discrepancias_Detalladas',
    'Resumen_Ejecutivo_IA',
    'Carpeta_Drive_URL',
    'JSON_Datos_Extraidos',
    'Auditor_Revision_Manual',      // PENDIENTE | APROBADO | RECHAZADO
    'Notas_Seguimiento'
  ];

  hojaCRM.getRange(1, 1, 1, headersCRM.length).setValues([headersCRM])
    .setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');
  hojaCRM.setFrozenRows(1);

  // 2. Hoja Config_Reglas
  let hojaReglas = ss.getSheetByName(CONFIG_SISTEMA.HOJA_REGLAS);
  if (!hojaReglas) {
    hojaReglas = ss.insertSheet(CONFIG_SISTEMA.HOJA_REGLAS);
  }

  const reglasIniciales = [
    ['PARAMETRO', 'VALOR', 'DESCRIPCION'],
    ['GEMINI_API_KEY', CONFIG_SISTEMA.API_KEY_DEFAULT, 'API Key para motor multimodal de visión y análisis'],
    ['LIMITE_TOKENS_PLAN', String(CONFIG_SISTEMA.LIMITE_TOKENS_PLAN), 'Tope máximo de tokens mensual para emitir alerta'],
    ['TOLERANCIA_PESOS', '100', 'Tolerancia en pesos para comparaciones numéricas por redondeo'],
    ['MAX_MESES_ANTIGUEDAD_SERVICIO', '2', 'Máximo de meses entre factura de servicio y fecha del crédito (62 días)'],
    ['TOPE_AFECTACION_HABERES', '0.50', 'Tope del 50% de afectación del haber neto (Cláusula 18 inc. e)'],
    ['PROVINCIA_OBLIGATORIA', 'ENTRE RIOS', 'Provincia requerida para domicilio y jurisdicción'],
    ['GEMINI_MODEL', 'gemini-3.8-flash', 'Modelo optimizado de visión y OCR multimodal']
  ];

  hojaReglas.getRange(1, 1, reglasIniciales.length, 3).setValues(reglasIniciales);
  hojaReglas.getRange(1, 1, 1, 3).setBackground('#0f766e').setFontColor('#ffffff').setFontWeight('bold');
  hojaReglas.setFrozenRows(1);

  // Inicializar contador de tokens si no existe
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKENS_CONSUMIDOS_TOTAL')) {
    props.setProperty('TOKENS_CONSUMIDOS_TOTAL', '0');
  }

  return 'Estructura AMMER V2.0 configurada correctamente.';
}

/**
 * Extrae el ID_OPERACION respetando separación por espacio o carpeta contenedora
 */
function extraerIdOperacionDeNombre(nombreArchivo) {
  if (!nombreArchivo) return null;
  const partesRuta = String(nombreArchivo).split(/[\/\\]/);
  const nombreBase = partesRuta[partesRuta.length - 1].trim();

  const matchConSeparador = nombreBase.match(/^(\d{3,8})(?:\s+|[-_.])/);
  if (matchConSeparador && matchConSeparador[1]) return matchConSeparador[1];

  const matchSoloNumero = nombreBase.match(/^(\d{3,8})\.[a-zA-Z0-9]+$/);
  if (matchSoloNumero && matchSoloNumero[1]) return matchSoloNumero[1];

  for (let i = partesRuta.length - 2; i >= 0; i--) {
    const folderMatch = partesRuta[i].trim().match(/^(\d{3,8})(?:\s+|[-_.]|$)/);
    if (folderMatch && folderMatch[1]) return folderMatch[1];
  }

  return null;
}

/**
 * Normaliza valores monetarios argentinos a Float nativo
 */
function limpiarMontoArgentino(valor) {
  if (typeof valor === 'number') return Math.round(valor * 100) / 100;
  if (!valor) return 0;
  let limpio = String(valor).replace(/[^0-9.,-]/g, '').trim();
  if (!limpio) return 0;

  if (limpio.includes(',')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = limpio.split('.');
    if (partes.length > 2) limpio = partes.join('');
  }
  const num = parseFloat(limpio);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Extrae DNI numérico desde el CUIT (ej: 27272099494 -> 27209949)
 */
function extraerDniDesdeCuit(cuitValor) {
  const soloNumeros = String(cuitValor || '').replace(/\D/g, '');
  if (soloNumeros.length === 11) {
    return soloNumeros.substring(2, 10).replace(/^0+/, '');
  }
  return soloNumeros;
}

/**
 * Formatea fechas a string DD/MM/YYYY
 */
function formatearFecha(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(valor).trim();
}

/**
 * Convierte cualquier fecha (DD/MM/YYYY o Date) a objeto Date nativo
 */
function parsearFechaAObjeto(fechaVal) {
  if (!fechaVal) return null;
  if (Object.prototype.toString.call(fechaVal) === '[object Date]' && !isNaN(fechaVal)) return fechaVal;
  const str = String(fechaVal).trim();
  const partes = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (partes) {
    return new Date(parseInt(partes[3], 10), parseInt(partes[2], 10) - 1, parseInt(partes[1], 10));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Indexa las 26 columnas de Cartera_Base en memoria
 */
function obtenerDiccionarioCartera() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CARTERA);
  if (!hoja) throw new Error(`No se encontró la hoja "${CONFIG_SISTEMA.HOJA_CARTERA}".`);

  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return {};

  const diccionario = {};

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const idOp = String(fila[0] || '').trim();
    if (!idOp) continue;

    const cuitLimpio = String(fila[3] || '').replace(/\D/g, '');

    diccionario[idOp] = {
      filaSheet: i + 1,
      ID_OPERACION: idOp,
      origen_ayuda: String(fila[1] || '').trim(),
      mutual: String(fila[2] || '').trim(),
      cuit: cuitLimpio,
      dni_deducido: extraerDniDesdeCuit(cuitLimpio),
      Fecha_Nacimiento: formatearFecha(fila[4]),
      Apellido_Nombre: String(fila[5] || '').trim(),
      tipo: String(fila[6] || '').trim(),
      Fecha_arreglo: formatearFecha(fila[7]),
      Fecha_primer_pago: formatearFecha(fila[8]),
      vto_final: formatearFecha(fila[9]),
      Plazo: parseInt(fila[10], 10) || 0,
      cuotas_a_ceder: parseInt(fila[11], 10) || 0,
      capital_original: limpiarMontoArgentino(fila[12]),
      capital_a_ceder: limpiarMontoArgentino(fila[13]),
      interes_a_ceder: limpiarMontoArgentino(fila[14]),
      cuota: limpiarMontoArgentino(fila[15]),
      total_a_ceder: limpiarMontoArgentino(fila[16]),
      Tipo_de_descuento: String(fila[17] || '').trim(),
      CP: String(fila[18] || '').trim(),
      domicilio: String(fila[19] || '').trim(),
      localidad: String(fila[20] || '').trim(),
      provincia: String(fila[21] || '').trim(),
      Transferencia: limpiarMontoArgentino(fila[22]),
      estado_convenio: String(fila[23] || '').trim(),
      origen_fondos: String(fila[24] || '').trim(),
      monto_pagare: limpiarMontoArgentino(fila[25])
    };
  }

  return diccionario;
}

/**
 * Obtiene parámetros de Config_Reglas
 */
function obtenerReglasNegocio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG_SISTEMA.HOJA_REGLAS);
  const reglas = {
    GEMINI_API_KEY: CONFIG_SISTEMA.API_KEY_DEFAULT,
    LIMITE_TOKENS_PLAN: CONFIG_SISTEMA.LIMITE_TOKENS_PLAN,
    TOLERANCIA_PESOS: 100,
    MAX_MESES_ANTIGUEDAD_SERVICIO: 2,
    TOPE_AFECTACION_HABERES: 0.50,
    PROVINCIA_OBLIGATORIA: 'ENTRE RIOS',
    GEMINI_MODEL: 'gemini-3.8-flash'
  };

  if (!hoja) return reglas;
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    const clave = String(datos[i][0] || '').trim();
    const valor = String(datos[i][1] || '').trim();
    if (clave) reglas[clave] = valor;
  }
  return reglas;
}

/**
 * Acumula tokens consumidos desde usageMetadata de Gemini
 */
function registrarConsumoTokens(cantidadTokens) {
  if (!cantidadTokens || isNaN(cantidadTokens)) return;
  const props = PropertiesService.getScriptProperties();
  const actual = parseInt(props.getProperty('TOKENS_CONSUMIDOS_TOTAL') || '0', 10);
  const nuevoTotal = actual + parseInt(cantidadTokens, 10);
  props.setProperty('TOKENS_CONSUMIDOS_TOTAL', String(nuevoTotal));
  return nuevoTotal;
}

/**
 * Devuelve el estado actual de consumo de tokens vs límite
 */
function obtenerMetricasTokens() {
  const props = PropertiesService.getScriptProperties();
  const consumidos = parseInt(props.getProperty('TOKENS_CONSUMIDOS_TOTAL') || '0', 10);
  const reglas = obtenerReglasNegocio();
  const limite = parseInt(reglas.LIMITE_TOKENS_PLAN || CONFIG_SISTEMA.LIMITE_TOKENS_PLAN, 10);
  const porcentaje = limite > 0 ? Math.min(100, Math.round((consumidos / limite) * 100)) : 0;

  return {
    consumidos: consumidos,
    limite: limite,
    porcentaje: porcentaje,
    alertaExceso: porcentaje >= 90,
    alertaPreventiva: porcentaje >= 75
  };
}

/**
 * Obtiene o crea la carpeta de un legajo en Google Drive
 */
function obtenerCarpetaLegajoDrive(idOperacion, apellidoNombre) {
  let carpetaRaiz;
  if (CONFIG_SISTEMA.FOLDER_LEGAJOS_ID) {
    carpetaRaiz = DriveApp.getFolderById(CONFIG_SISTEMA.FOLDER_LEGAJOS_ID);
  } else {
    const iterRaiz = DriveApp.getFoldersByName('AMMER_Legajos_Auditados');
    carpetaRaiz = iterRaiz.hasNext() ? iterRaiz.next() : DriveApp.createFolder('AMMER_Legajos_Auditados');
  }

  const nombreSub = `${idOperacion} - ${apellidoNombre || 'Sin_Nombre'}`.replace(/[\/\\:*?"<>|]/g, '');
  const iterSub = carpetaRaiz.getFoldersByName(nombreSub);
  return iterSub.hasNext() ? iterSub.next() : carpetaRaiz.createFolder(nombreSub);
}

/**
 * Registra o actualiza un expediente en CRM_Validaciones V2.0
 */
function registrarEnCRM(dictamen) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let hojaCRM = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CRM);
    if (!hojaCRM) {
      inicializarSistemaAMMER();
      hojaCRM = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CRM);
    }

    const datosCRM = hojaCRM.getDataRange().getValues();
    const idBuscado = String(dictamen.ID_OPERACION).trim();
    let filaExistente = -1;

    for (let i = 1; i < datosCRM.length; i++) {
      if (String(datosCRM[i][0]).trim() === idBuscado) {
        filaExistente = i + 1;
        break;
      }
    }

    const fechaActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

    const filaValores = [
      idBuscado,
      fechaActual,
      dictamen.Apellido_Nombre || 'NO ENCONTRADO EN BASE',
      dictamen.CUIT_Base || '',
      dictamen.DNI_Extraido || '',
      dictamen.Tipo_Agente || '',
      dictamen.Estado_Global || 'OBSERVADO',
      dictamen.Score_Validacion || 0,
      dictamen.Calidad_Nitidez_Firma || 'OPTIMA',
      dictamen.Check_Fecha_Nac || 'PENDIENTE',
      dictamen.Check_Identidad_DNI || 'PENDIENTE',
      dictamen.Check_Recibo_Titular || 'PENDIENTE',
      dictamen.Check_Recibo_Margen50 || 'PENDIENTE',
      dictamen.Domicilio_Servicio || 'NO_DETECTADO',
      dictamen.Check_Domicilio_Servicio || 'PENDIENTE',
      dictamen.Check_Antiguedad_Servicio || 'PENDIENTE',
      dictamen.Check_Transferencia_Monto || 'PENDIENTE',
      dictamen.Check_Capital_Solicitud || 'PENDIENTE',
      dictamen.Check_Percibir_Transf || 'PENDIENTE',
      (dictamen.Docs_Detectados || []).join(', '),
      (dictamen.Docs_Faltantes || []).join(', '),
      (dictamen.Discrepancias_Detalladas || []).join(' | '),
      dictamen.Resumen_Ejecutivo_IA || '',
      dictamen.Carpeta_Drive_URL || '',
      JSON.stringify(dictamen.JSON_Datos_Extraidos || {}),
      dictamen.Auditor_Revision_Manual || 'PENDIENTE',
      dictamen.Notas_Seguimiento || ''
    ];

    if (filaExistente > 0) {
      hojaCRM.getRange(filaExistente, 1, 1, filaValores.length).setValues([filaValores]);
    } else {
      hojaCRM.appendRow(filaValores);
    }

    return { exito: true, idOperacion: idBuscado, fecha: fechaActual };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint Dashboard: Devuelve Cartera, Validaciones V2 y Métricas de Tokens
 */
function obtenerDatosDashboardCRM() {
  inicializarSistemaAMMER();
  const carteraMap = obtenerDiccionarioCartera();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaCRM = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CRM);
  const datosCRM = hojaCRM.getDataRange().getValues();

  const listaValidaciones = [];
  const auditadosIds = new Set();

  for (let i = 1; i < datosCRM.length; i++) {
    const f = datosCRM[i];
    const idOp = String(f[0]).trim();
    if (!idOp) continue;
    auditadosIds.add(idOp);

    listaValidaciones.push({
      ID_OPERACION: idOp,
      Fecha_Auditoria: formatearFecha(f[1]),
      Apellido_Nombre: f[2],
      CUIT_Base: f[3],
      DNI_Extraido: f[4],
      Tipo_Agente: f[5],
      Estado_Global: f[6],
      Score_Validacion: f[7],
      Calidad_Nitidez_Firma: f[8],
      Check_Fecha_Nac: f[9],
      Check_Identidad_DNI: f[10],
      Check_Recibo_Titular: f[11],
      Check_Recibo_Margen50: f[12],
      Domicilio_Servicio: f[13],
      Check_Domicilio_Servicio: f[14],
      Check_Antiguedad_Servicio: f[15],
      Check_Transferencia_Monto: f[16],
      Check_Capital_Solicitud: f[17],
      Check_Percibir_Transf: f[18],
      Docs_Detectados: f[19],
      Docs_Faltantes: f[20],
      Discrepancias_Detalladas: f[21],
      Resumen_Ejecutivo_IA: f[22],
      Carpeta_Drive_URL: f[23],
      JSON_Datos_Extraidos: f[24],
      Auditor_Revision_Manual: f[25],
      Notas_Seguimiento: f[26],
      datosBase: carteraMap[idOp] || null
    });
  }

  const pendientesSinLegajo = Object.keys(carteraMap)
    .filter(id => !auditadosIds.has(id))
    .map(id => carteraMap[id]);

  return {
    totalCartera: Object.keys(carteraMap).length,
    totalAuditados: listaValidaciones.length,
    totalPendientes: pendientesSinLegajo.length,
    validaciones: listaValidaciones.reverse(),
    pendientes: pendientesSinLegajo,
    diccionarioCartera: carteraMap,
    metricasTokens: obtenerMetricasTokens()
  };
}

/**
 * ABM Manual de Auditoría
 */
function actualizarEstadoManualABM(idOperacion, nuevoEstado, auditorNombre, notaSeguimiento) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaCRM = ss.getSheetByName(CONFIG_SISTEMA.HOJA_CRM);
  const datos = hojaCRM.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(idOperacion).trim()) {
      hojaCRM.getRange(i + 1, 7).setValue(nuevoEstado);
      hojaCRM.getRange(i + 1, 26).setValue(auditorNombre || 'AUDITOR_MANUAL');
      hojaCRM.getRange(i + 1, 27).setValue(notaSeguimiento || '');
      return { exito: true, mensaje: `Expediente #${idOperacion} actualizado a ${nuevoEstado}.` };
    }
  }
  throw new Error(`No se encontró el ID_OPERACION ${idOperacion} en CRM_Validaciones.`);
}

/**
 * Funciones ejecutables desde el menú del Sheet
 */
function menuConfigurarApiKey() {
  const ui = SpreadsheetApp.getUi();
  const respuesta = ui.prompt('Configurar Gemini API Key', 'Ingresa la clave de API (o presiona Aceptar para cargar la clave predeterminada):', ui.ButtonSet.OK_CANCEL);
  if (respuesta.getSelectedButton() === ui.Button.OK) {
    const key = respuesta.getResponseText().trim() || CONFIG_SISTEMA.API_KEY_DEFAULT;
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
    ui.alert('Éxito', 'API Key guardada correctamente.', ui.ButtonSet.OK);
  }
}

function menuVerConsumoTokens() {
  const m = obtenerMetricasTokens();
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Consumo de Tokens del Plan',
    `Tokens consumidos: ${m.consumidos.toLocaleString('es-AR')}\nLímite mensual: ${m.limite.toLocaleString('es-AR')}\nPorcentaje usado: ${m.porcentaje}%`,
    ui.ButtonSet.OK
  );
}

function menuReiniciarTokens() {
  const ui = SpreadsheetApp.getUi();
  const conf = ui.alert('Confirmación', '¿Deseas reiniciar el contador mensual de tokens a cero?', ui.ButtonSet.YES_NO);
  if (conf === ui.Button.YES) {
    PropertiesService.getScriptProperties().setProperty('TOKENS_CONSUMIDOS_TOTAL', '0');
    ui.alert('Contador de tokens restablecido a 0.');
  }
}