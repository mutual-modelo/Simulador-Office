/**
 * ============================================================================
 * BACKEND CENTRALIZADO - SIMULADOR-OFFICE (MUTUAL MODELO DE ENTRE RÍOS)
 * Google Apps Script V8 | Google Sheets + Google Drive + Auditoría IA
 * ============================================================================
 */

const CONFIG_AMMER = {
  SHEET_SOLICITUDES: 'Solicitudes_Ayudas',
  SHEET_USUARIOS: 'Usuarios',
  SHEET_USUARIOS_ROLES: 'Usuarios_Roles',
  SHEET_ASOCIADOS: 'Padron_Asociados',
  DRIVE_ROOT_NAME: 'Mutual Modelo - Legajos Digitales',
  SPREADSHEET_ID: '1YYKQiKvLpMVFeunrbYP3Rbzdgjt2MVsn89r9wEn7P6U',
  SPREADSHEET_NAME: 'BD_Mutual_Modelo_SimuladorOffice'
};

const HEADERS_SOLICITUDES = [
  'ID_Solicitud',
  'Fecha_Registro',
  'ID_Usuario_Asesor',
  'Nombre_Asesor',
  'ID_Organizacion',
  'Nombre_Organizacion',
  'Origen_Canal',
  'DNI_Asociado',
  'Apellido_Nombre',
  'Domicilio_Historico_Solicitud',
  'Legajo_Municipal',
  'Datos_Contacto_JSON',
  'Datos_Laborales_JSON',
  'Linea_Ayuda',
  'Monto_Solicitado_Neto',
  'Cantidad_Cuotas',
  'Monto_Cuota',
  'Total_A_Devolver',
  'Estado_Tramite',
  'Carpeta_Drive_URL',
  'Archivos_Adjuntos_JSON',
  'Historial_Comentarios_JSON',
  'Nro_Definitivo',
  'Historial_Ofertas_JSON',
  'Dictamen_IA_JSON',
  'Analista_Asignado',
  'Ultima_Actualizacion',
  'Metadata_Extra_JSON'
];

const HEADERS_USUARIOS = [
  'ID_Usuario',
  'Usuario',
  'Email',
  'Password',
  'Nombre',
  'Rol',
  'ID_Organizacion',
  'Nombre_Organizacion',
  'Es_Titular',
  'Activo',
  'Salt'
];

const HEADERS_ASOCIADOS = [
  'DNI',
  'Apellido_Nombre',
  'CUIL',
  'Fecha_Nac',
  'Sexo',
  'Estado_Civil',
  'Celular',
  'Email',
  'Domicilio',
  'Localidad',
  'Condicion',
  'Organismo',
  'Legajo',
  'Dependencia',
  'Cargo',
  'Situacion_Revista',
  'Fecha_Ingreso_Laboral',
  'Antiguedad',
  'Fecha_Alta',
  'Creado_Por',
  'Carpeta_Drive_URL',
  'Archivos_Adjuntos_JSON'
];

/* ============================================================================
   1. PUNTOS DE ENTRADA HTTP (CORS SAFE JSON)
   ============================================================================ */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : 'ping';
  if (action === 'ping' || action === 'health') {
    return crearRespuestaJSON({
      ok: true,
      servicio: 'Simulador-Office API AMMER',
      version: '2.0-cloud-sync',
      timestamp: new Date().toISOString()
    });
  }
  return crearRespuestaJSON({
    ok: true,
    mensaje: 'Endpoint operativo. Utilice método POST con payload JSON.'
  });
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const action = String(payload.action || '').trim();

    switch (action) {
      case 'login':
        return crearRespuestaJSON(autenticarUsuario(payload));

      case 'obtenerAnalistas':
        return crearRespuestaJSON(obtenerListaAnalistas());

      case 'buscarAsociadoPorDNI':
        return crearRespuestaJSON(buscarAsociadoPorDNI(payload.dni));

      case 'crearAsociado':
        return crearRespuestaJSON(registrarNuevoAsociado(payload));

      case 'crearSolicitud':
        return crearRespuestaJSON(registrarNuevaSolicitud(payload));

      case 'obtenerSolicitudes':
      case 'listarSolicitudes':
        return crearRespuestaJSON(listarSolicitudes(payload.usuarioActivo || payload));

      case 'actualizarEstado':
      case 'cambiarEstado':
      case 'desestimarGestion':
        return crearRespuestaJSON(actualizarEstadoSolicitudBackend(payload));

      case 'eliminarSolicitud':
        return crearRespuestaJSON(eliminarSolicitudBackend(payload));

      case 'reasignarAnalista':
        return crearRespuestaJSON(reasignarAnalistaBackend(payload));

      case 'agregarComentario':
        return crearRespuestaJSON(agregarComentarioBackend(payload));

      case 'editarComentario':
      case 'editarComentarioBitacora':
        return crearRespuestaJSON(editarComentarioBitacoraBackend(payload));

      case 'eliminarComentario':
      case 'eliminarComentarioBitacora':
        return crearRespuestaJSON(eliminarComentarioBitacoraBackend(payload));

      case 'guardarAuditoriaEnHistorial':
      case 'guardarAuditoriaIA':
        return crearRespuestaJSON(guardarAuditoriaEnHistorialBackend(payload));

      case 'subirAdjuntoAdicional':
        return crearRespuestaJSON(subirAdjuntoAdicionalBackend(payload));

      case 'eliminarDocumento':
      case 'eliminarAdjunto':
        return crearRespuestaJSON(eliminarDocumentoBackend(payload));

      case 'guardarPropuestaMutual':
        return crearRespuestaJSON(guardarPropuestaMutualBackend(payload));

      case 'asignarNumeroDefinitivo':
        return crearRespuestaJSON(asignarNumeroDefinitivoBackend(payload));

      case 'actualizarDatosSolicitante':
        return crearRespuestaJSON(actualizarDatosSolicitanteBackend(payload));

      case 'auditarConIA':
      case 'auditarReciboIA':
      case 'analizarRecibo':
        return crearRespuestaJSON(auditarLegajoConIA(payload));

      case 'calcularMargenRecibo':
        return crearRespuestaJSON(calcularOfertasDisponiblesBackendGs_(payload));

      case 'limpiarDatosPrueba':
        return crearRespuestaJSON(limpiarDatosPruebaBackend(payload));

      default:
        return crearRespuestaJSON({
          ok: false,
          error: 'Acción no reconocida por el servidor: ' + action
        });
    }
  } catch (err) {
    return crearRespuestaJSON({
      ok: false,
      error: 'Error procesando solicitud en Apps Script: ' + (err && err.message ? err.message : String(err))
    });
  }
}

function crearRespuestaJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================================
   2. INFRAESTRUCTURA GOOGLE SHEETS & GOOGLE DRIVE
   ============================================================================ */
function obtenerSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();

  // 1. Priorizar siempre la planilla oficial configurada o vinculada al contenedor
  if (CONFIG_AMMER.SPREADSHEET_ID) {
    try {
      const ssOficial = SpreadsheetApp.openById(CONFIG_AMMER.SPREADSHEET_ID);
      if (ssOficial) {
        props.setProperty('SPREADSHEET_ID', ssOficial.getId());
        return ssOficial;
      }
    } catch (_) {}
  }

  try {
    const ssActiva = SpreadsheetApp.getActiveSpreadsheet();
    if (ssActiva) {
      props.setProperty('SPREADSHEET_ID', ssActiva.getId());
      return ssActiva;
    }
  } catch (_) {}

  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (_) {}
  }

  let ss = null;
  const candidatosNombres = [CONFIG_AMMER.SPREADSHEET_NAME, 'BD_Mutual_Modelo_SimuladorOffice', 'Mutual_Modelo_Simulador_Office_DB'];
  for (let i = 0; i < candidatosNombres.length && !ss; i++) {
    const files = DriveApp.getFilesByName(candidatosNombres[i]);
    if (files.hasNext()) {
      ss = SpreadsheetApp.openById(files.next().getId());
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG_AMMER.SPREADSHEET_NAME);
  }

  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function obtenerOInicializarHoja_(nombreHoja, headersRequeridos) {
  const ss = obtenerSpreadsheet_();
  let sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = ss.insertSheet(nombreHoja);
    sheet.getRange(1, 1, 1, headersRequeridos.length).setValues([headersRequeridos]);
    sheet.getRange(1, 1, 1, headersRequeridos.length).setFontWeight('bold').setBackground('#0f2744').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  if (currentHeaders.filter(Boolean).length === 0) {
    sheet.getRange(1, 1, 1, headersRequeridos.length).setValues([headersRequeridos]);
    sheet.getRange(1, 1, 1, headersRequeridos.length).setFontWeight('bold').setBackground('#0f2744').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    headersRequeridos.forEach(reqHeader => {
      if (currentHeaders.indexOf(reqHeader) === -1) {
        const nextCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextCol).setValue(reqHeader).setFontWeight('bold').setBackground('#0f2744').setFontColor('#ffffff');
        currentHeaders.push(reqHeader);
      }
    });
  }
  return sheet;
}

function obtenerHeaderMap_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((h, idx) => {
    const key = String(h || '').trim();
    if (key) map[key] = idx;
  });
  return { map: map, totalCols: headers.length };
}

function obtenerOCrearCarpetaRaiz_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_ROOT_FOLDER_ID');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (_) {}
  }

  const folders = DriveApp.getFoldersByName(CONFIG_AMMER.DRIVE_ROOT_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(CONFIG_AMMER.DRIVE_ROOT_NAME);
  }
  props.setProperty('DRIVE_ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function obtenerOCrearCarpetaExpediente_(idSolicitud, apellidoNombre, dni, idAlternativo) {
  const root = obtenerOCrearCarpetaRaiz_();
  const nombreSeguro = String(apellidoNombre || 'SOCIO')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const prefijo = String(idSolicitud || '').trim().toUpperCase();
  const alt = String(idAlternativo || '').trim().toUpperCase();
  const nombreCarpeta = prefijo ? (prefijo + ' - ' + nombreSeguro) : nombreSeguro;

  const coincidePrefijo = (fname, p) => {
    if (!p) return false;
    const up = String(fname || '').toUpperCase();
    return up === p || up.indexOf(p + ' -') === 0 || up.indexOf(p + ' ') === 0;
  };

  let folderAlt = null;
  const iter = root.getFolders();
  while (iter.hasNext()) {
    const f = iter.next();
    const fname = f.getName();
    if (fname === nombreCarpeta || coincidePrefijo(fname, prefijo)) {
      if (fname !== nombreCarpeta) {
        try { f.setName(nombreCarpeta); } catch (_) {}
      }
      return f;
    }
    if (!folderAlt && alt && alt !== prefijo && coincidePrefijo(fname, alt)) {
      folderAlt = f;
    }
  }
  if (folderAlt) {
    try {
      folderAlt.setName(nombreCarpeta);
    } catch (_) {}
    return folderAlt;
  }
  const nueva = root.createFolder(nombreCarpeta);
  try {
    nueva.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {}
  return nueva;
}

function resolverNumeroDefinitivoFila_(sheet, rowNum, map, payload) {
  const leerCol = (col) => (map[col] !== undefined ? String(sheet.getRange(rowNum, map[col] + 1).getValue() || '').trim() : '');
  const rawMeta = map['Metadata_Extra_JSON'] !== undefined
    ? parseJSONSafe_(sheet.getRange(rowNum, map['Metadata_Extra_JSON'] + 1).getValue(), {})
    : {};
  const candidatos = [
    leerCol('ID_Definitivo_Expediente'),
    leerCol('Nro_Definitivo'),
    leerCol('ID_Definitivo'),
    rawMeta && rawMeta.id_definitivo ? String(rawMeta.id_definitivo).trim() : '',
    payload && payload.idDefinitivoExpediente ? String(payload.idDefinitivoExpediente).trim() : '',
    payload && payload.ID_Definitivo_Expediente ? String(payload.ID_Definitivo_Expediente).trim() : '',
    payload && payload.id_definitivo ? String(payload.id_definitivo).trim() : '',
    payload && payload.Nro_Definitivo ? String(payload.Nro_Definitivo).trim() : '',
    payload && payload.nroDefinitivo ? String(payload.nroDefinitivo).trim() : ''
  ];
  for (let i = 0; i < candidatos.length; i++) {
    const v = candidatos[i];
    if (v && v !== 'undefined' && v !== 'null' && v !== 'Pendiente' && v !== 'S/N') {
      return v;
    }
  }
  return '';
}

function normalizarNombreArchivoConPrefijo_(nombreRaw, tipoDoc, prefijoOficial, idProvisorio) {
  const prefijo = String(prefijoOficial || '').trim();
  const base = String(nombreRaw || '').trim();
  let tipoUpper = String(tipoDoc || 'OTROS DOCUMENTOS').toUpperCase().trim();
  if (tipoUpper.indexOf('DNI') !== -1) tipoUpper = 'DNI';
  else if (tipoUpper.indexOf('RECIBO') !== -1) tipoUpper = 'RECIBO DE SUELDO';
  else if (tipoUpper.indexOf('SERVICIO') !== -1 || tipoUpper.indexOf('DOMICILIO') !== -1) tipoUpper = 'SERVICIO';
  else if (tipoUpper.indexOf('CBU') !== -1) tipoUpper = 'CONSTANCIA DE CBU';
  else if (tipoUpper.indexOf('SAGE') !== -1) tipoUpper = 'CERTIFICADO SAGE';
  else if (tipoUpper.indexOf('MOVIMIENTO') !== -1 || tipoUpper.indexOf('BANCARIO') !== -1) tipoUpper = 'COMPROBANTE DE MOVIMIENTOS BANCARIOS';
  else if (tipoUpper.indexOf('SIDECREER') !== -1) tipoUpper = 'TARJETA SIDECREER';
  else if (tipoUpper.indexOf('TRANSFERENCIA') !== -1) tipoUpper = 'TRANSFERENCIA';
  else if (tipoUpper.indexOf('SOLICITUD') !== -1 || tipoUpper.indexOf('AYUDA') !== -1) tipoUpper = 'SOLICITUD DE AYUDA ECONOMICA';
  else if (tipoUpper.indexOf('DESCUENTO') !== -1 || tipoUpper.indexOf('HABERES') !== -1) tipoUpper = 'AUTORIZACION PARA DESCUENTO DE HABERES';
  else if (tipoUpper.indexOf('OTRO') !== -1) tipoUpper = 'OTROS DOCUMENTOS';

  const baseSinExt = base.replace(/\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|tif|tiff|jfif|pdf)$/i, '').replace(/\.[^.]{2,5}$/, '').trim();
  const ext = 'PDF';
  if (!prefijo) return (baseSinExt ? baseSinExt.toUpperCase() : tipoUpper) + '.' + ext;

  if (baseSinExt && baseSinExt.toUpperCase().indexOf(prefijo.toUpperCase() + ' ') === 0) {
    return baseSinExt.toUpperCase() + '.' + ext;
  }
  return prefijo + ' ' + tipoUpper + '.' + ext;
}

function obtenerFechaHora24Argentina_(fechaObj) {
  const d = (fechaObj instanceof Date && !isNaN(fechaObj.getTime())) ? fechaObj : new Date();
  return Utilities.formatDate(d, 'GMT-3', "dd/MM/yyyy · HH:mm 'hs'");
}

function formatearFecha24Backend_(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'GMT-3', "dd/MM/yyyy · HH:mm 'hs'");
  }
  return String(val);
}

function guardarArchivosEnDrive_(folder, archivosRaw, idExpediente, autor) {
  const resultado = [];
  if (!Array.isArray(archivosRaw) || archivosRaw.length === 0) return resultado;
  const nowStr = obtenerFechaHora24Argentina_();

  archivosRaw.forEach((item, idx) => {
    if (!item) return;
    let base64Str = item.base64 || '';
    if (!base64Str && item.dataUrl && String(item.dataUrl).indexOf('base64,') !== -1) {
      base64Str = String(item.dataUrl).split('base64,')[1];
    }

    const tipoDoc = String(item.tipo || 'OTROS DOCUMENTOS');
    let nombreArchivo = String(item.nombre || item.nombreArchivo || item.name || (idExpediente + ' ADJUNTO_' + (idx + 1) + '.PDF')).trim();
    const rawMime = String(item.tipoMime || item.mimeType || item.type || '').toLowerCase();
    const esPdfEnBase64 = base64Str.indexOf('JVBERi0') === 0 || rawMime === 'application/pdf';
    if (esPdfEnBase64 || /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|tif|tiff|jfif|pdf)$/i.test(nombreArchivo) || !/\.[a-z0-9]{2,5}$/i.test(nombreArchivo)) {
      nombreArchivo = normalizarNombreArchivoConPrefijo_(nombreArchivo, tipoDoc, idExpediente, idExpediente);
    }
    const mimeType = esPdfEnBase64 ? 'application/pdf' : String(item.tipoMime || item.mimeType || item.type || 'application/pdf');

    const autorResuelto = String(item.cargadoPor || item.usuarioOperador || item.autor || autor || 'Operador').trim() || 'Operador';

    if (base64Str) {
      try {
        const bytes = Utilities.base64Decode(base64Str);
        const blob = Utilities.newBlob(bytes, mimeType, nombreArchivo);
        const file = folder.createFile(blob);
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (_) {}
        const fileId = file.getId();
        resultado.push({
          tipo: tipoDoc,
          nombre: nombreArchivo,
          tipoMime: mimeType,
          fecha: item.fecha || nowStr,
          cargadoPor: autorResuelto,
          autor: autorResuelto,
          fileId: fileId,
          urlDrive: 'https://drive.google.com/file/d/' + fileId + '/view',
          previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
          observado: Boolean(item.observado)
        });
      } catch (errFile) {
        resultado.push({
          tipo: tipoDoc,
          nombre: nombreArchivo,
          tipoMime: mimeType,
          fecha: item.fecha || nowStr,
          cargadoPor: autorResuelto,
          autor: autorResuelto,
          urlDrive: item.urlDrive || '',
          errorSubida: errFile && errFile.message ? errFile.message : String(errFile)
        });
      }
    } else {
      resultado.push({
        tipo: tipoDoc,
        nombre: nombreArchivo,
        tipoMime: mimeType,
        fecha: item.fecha || nowStr,
        cargadoPor: autorResuelto,
        autor: autorResuelto,
        fileId: item.fileId || '',
        urlDrive: item.urlDrive || '',
        previewUrl: item.previewUrl || '',
        observado: Boolean(item.observado)
      });
    }
  });

  return resultado;
}

function parseJSONSafe_(raw, fallback) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/* ============================================================================
   3. AUTENTICACIÓN Y USUARIOS (TOLERANTE A 'Usuarios' Y 'Usuarios_Roles')
   ============================================================================ */
function obtenerColUsuario_(row, map, aliases, defVal) {
  for (let k = 0; k < aliases.length; k++) {
    const colName = aliases[k];
    if (map[colName] !== undefined && row[map[colName]] !== undefined && String(row[map[colName]]).trim() !== '') {
      return String(row[map[colName]]).trim();
    }
  }
  const keys = Object.keys(map);
  for (let k = 0; k < aliases.length; k++) {
    const targetLow = String(aliases[k]).toLowerCase();
    for (let j = 0; j < keys.length; j++) {
      if (keys[j].toLowerCase() === targetLow) {
        const val = row[map[keys[j]]];
        if (val !== undefined && String(val).trim() !== '') return String(val).trim();
      }
    }
  }
  return defVal !== undefined ? defVal : '';
}

function obtenerHojasCandidatasUsuarios_() {
  const ss = obtenerSpreadsheet_();
  const nombres = [CONFIG_AMMER.SHEET_USUARIOS, CONFIG_AMMER.SHEET_USUARIOS_ROLES, 'Usuarios', 'Usuarios_Roles'];
  const vistas = {};
  const hojas = [];
  for (let i = 0; i < nombres.length; i++) {
    const nom = nombres[i];
    if (!nom || vistas[nom]) continue;
    vistas[nom] = true;
    const sh = ss.getSheetByName(nom);
    if (sh && sh.getLastRow() > 1) {
      hojas.push(sh);
    }
  }
  if (hojas.length === 0) {
    hojas.push(obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_USUARIOS, HEADERS_USUARIOS));
  }
  return hojas;
}

/**
 * Utilidad manual (ejecutar desde Apps Script): unifica Usuarios_Roles dentro de Usuarios
 * asegurando que todos los usuarios, IDs (USR-001...) y organizaciones queden en una sola hoja 'Usuarios',
 * y elimina la hoja duplicada 'Usuarios_Roles' si ya están todos migrados.
 */
function unificarHojasUsuarios() {
  const ss = obtenerSpreadsheet_();
  const shUsuarios = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_USUARIOS, HEADERS_USUARIOS);
  const shRoles = ss.getSheetByName('Usuarios_Roles');
  if (!shRoles) return 'Solo existe la hoja Usuarios (Usuarios_Roles ya no existe).';

  const { map: mapU, totalCols: colsU } = obtenerHeaderMap_(shUsuarios);
  const dataU = shUsuarios.getDataRange().getValues();
  const existentes = {};
  for (let i = 1; i < dataU.length; i++) {
    const uKey = obtenerColUsuario_(dataU[i], mapU, ['Usuario', 'Email', 'ID_Usuario'], '').toLowerCase();
    if (uKey) existentes[uKey] = i + 1;
  }

  const { map: mapR } = obtenerHeaderMap_(shRoles);
  const dataR = shRoles.getDataRange().getValues();
  let agregados = 0;
  for (let i = 1; i < dataR.length; i++) {
    const r = dataR[i];
    const idU = obtenerColUsuario_(r, mapR, ['ID_Usuario', 'ID', 'Id_Usuario', 'Usuario_ID'], '');
    const loginU = obtenerColUsuario_(r, mapR, ['Usuario', 'Username', 'Login'], '');
    const emailU = obtenerColUsuario_(r, mapR, ['Email', 'Correo', 'Mail'], '');
    const passU = obtenerColUsuario_(r, mapR, ['Password', 'Clave', 'Contraseña', 'Contrasena', 'Pass', 'Hash'], '');
    const nomU = obtenerColUsuario_(r, mapR, ['Nombre', 'Apellido_Nombre', 'Nombre_Completo', 'Asesor'], '');
    const rolU = obtenerColUsuario_(r, mapR, ['Rol', 'Role', 'Perfil'], 'Comercializador');
    const orgIdU = obtenerColUsuario_(r, mapR, ['ID_Organizacion', 'Organizacion_ID', 'Id_Organizacion'], 'MUTUAL-CENTRAL');
    const orgNomU = obtenerColUsuario_(r, mapR, ['Nombre_Organizacion', 'Organizacion', 'Sucursal'], 'AMMER');
    const titU = obtenerColUsuario_(r, mapR, ['Es_Titular', 'Titular', 'Es_Titular_Org'], 'NO');
    const actU = obtenerColUsuario_(r, mapR, ['Activo', 'Estado'], 'Activo');

    const claveBusqueda = (loginU || emailU || idU).toLowerCase();
    if (!claveBusqueda) continue;
    if (!existentes[claveBusqueda]) {
      const nuevaFila = new Array(colsU).fill('');
      const setCol = (c, v) => { if (mapU[c] !== undefined) nuevaFila[mapU[c]] = v; };
      setCol('ID_Usuario', idU || ('USR-' + String(dataU.length + agregados).padStart(3, '0')));
      setCol('Usuario', loginU || emailU);
      setCol('Email', emailU);
      setCol('Password', passU);
      setCol('Nombre', nomU || loginU);
      setCol('Rol', rolU);
      setCol('ID_Organizacion', orgIdU);
      setCol('Nombre_Organizacion', orgNomU);
      setCol('Es_Titular', titU);
      setCol('Activo', actU);
      shUsuarios.appendRow(nuevaFila);
      existentes[claveBusqueda] = true;
      agregados++;
    }
  }
  return 'Unificación completada: ' + agregados + ' usuario(s) copiados de Usuarios_Roles a Usuarios.';
}

function autenticarUsuario(payload) {
  const userInput = String(payload.usuario || payload.email || '').trim().toLowerCase();
  const passInput = String(payload.password || payload.clave || '').trim();
  if (!userInput || !passInput) {
    return { ok: false, error: 'Debe ingresar usuario y contraseña.' };
  }

  const hojas = obtenerHojasCandidatasUsuarios_();
  for (let h = 0; h < hojas.length; h++) {
    const sheet = hojas[h];
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    const { map } = obtenerHeaderMap_(sheet);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const uId = obtenerColUsuario_(row, map, ['ID_Usuario', 'ID', 'Id_Usuario', 'Usuario_ID'], 'USR-' + String(i).padStart(3, '0'));
      const uLogin = obtenerColUsuario_(row, map, ['Usuario', 'Username', 'Login'], '').toLowerCase();
      const uEmail = obtenerColUsuario_(row, map, ['Email', 'Correo', 'Mail'], '').toLowerCase();
      const uPass = obtenerColUsuario_(row, map, ['Password', 'Clave', 'Contraseña', 'Contrasena', 'Pass', 'Hash'], '');
      const uSalt = obtenerColUsuario_(row, map, ['Salt'], '');
      const activo = obtenerColUsuario_(row, map, ['Activo', 'Estado'], 'SI').toLowerCase();

      if (!uPass) continue;
      if ((uLogin === userInput || uEmail === userInput || uId.toLowerCase() === userInput) &&
          passwordCoincide_(uPass, passInput, uSalt, { id: uId, login: uLogin })) {
        if (activo === 'no' || activo === 'false' || activo === '0' || activo === 'inactivo') {
          return { ok: false, error: 'El usuario se encuentra inactivo.' };
        }
        // Si la clave en la celda estaba en texto plano o aún no tenía sal, la convierte automáticamente a SHA-256 + Sal
        if (!uSalt || !/^[a-f0-9]{64}$/i.test(uPass)) {
          try { guardarPasswordConSal_(sheet, i + 1, passInput); } catch (eSalt) { Logger.log('No se pudo salar clave: ' + eSalt); }
        }
        const rawTit = obtenerColUsuario_(row, map, ['Es_Titular', 'Titular', 'Es_Titular_Org'], 'NO').toLowerCase();
        const esTitular = ['si', 'sí', 'true', '1', 'x'].indexOf(rawTit) !== -1;
        const rawRol = obtenerColUsuario_(row, map, ['Rol', 'Role', 'Perfil'], 'Comercializador');
        const rawNombre = obtenerColUsuario_(row, map, ['Nombre', 'Apellido_Nombre', 'Nombre_Completo', 'Asesor'], uLogin || uEmail);
        const rawOrgId = obtenerColUsuario_(row, map, ['ID_Organizacion', 'Organizacion_ID', 'Id_Organizacion'], 'MUTUAL-CENTRAL');
        const rawOrgNom = obtenerColUsuario_(row, map, ['Nombre_Organizacion', 'Organizacion', 'Sucursal'], 'AMMER');

        const usuarioObj = {
          id: uId,
          idUsuario: uId,
          usuario_id: uId,
          usuario: uLogin || uEmail,
          email: uEmail || uLogin,
          nombre: rawNombre,
          rol: rawRol,
          idOrganizacion: rawOrgId,
          organizacion_id: rawOrgId,
          nombreOrganizacion: rawOrgNom,
          nombre_organizacion: rawOrgNom,
          esTitular: esTitular,
          esTitularOrg: esTitular,
          es_titular_organizacion: esTitular
        };
        return { ok: true, usuario: usuarioObj };
      }
    }
  }

  return { ok: false, error: 'Usuario o contraseña incorrectos.' };
}

/**
 * Compara la clave ingresada contra la guardada en la hoja 'Usuarios' o 'Usuarios_Roles'.
 * Soporta todos los formatos posibles para no bloquear jamás el acceso:
 * 1. Texto plano directo (si escribiste una clave normal y aún no se ejecutó onEdit)
 * 2. SHA-256 con sal de la columna 'Salt' (salt + clave o clave + salt)
 * 3. SHA-256 sin sal (64 caracteres hexadecimales)
 * 4. SHA-256 con sal de ID_Usuario o Usuario (por si los hashes previos se generaron con ID/Usuario)
 */
function passwordCoincide_(guardada, ingresada, salt, userContext) {
  const g = String(guardada || '').trim();
  const i = String(ingresada || '').trim();
  if (!g || !i) return false;

  // 1. Texto plano directo (siempre permitir si coincide exacto, incluso si la columna Salt quedó con valor viejo)
  if (g === i) return true;

  // 2. Hash SHA-256 (64 hex)
  if (/^[a-f0-9]{64}$/i.test(g)) {
    const gLow = g.toLowerCase();
    // 2a. Con Salt explícita de la columna Salt
    if (salt) {
      const s = String(salt).trim();
      if (hashSha256Hex_(s + i) === gLow) return true;
      if (hashSha256Hex_(i + s) === gLow) return true;
      if (hashSha256Hex_(s + ':' + i) === gLow) return true;
      if (hashSha256Hex_(i + ':' + s) === gLow) return true;
    }
    // 2b. SHA-256 directo sin sal
    if (hashSha256Hex_(i) === gLow) return true;

    // 2c. SHA-256 con variantes de contexto (ID_Usuario, Usuario) o sal fija institucional
    const ctx = userContext || {};
    const candidatosSal = [
      ctx.id || '',
      String(ctx.id || '').toLowerCase(),
      ctx.login || '',
      'AMMER',
      'MUTUAL_MODELO',
      'SIMULADOR_OFFICE'
    ];
    for (let k = 0; k < candidatosSal.length; k++) {
      const cs = candidatosSal[k];
      if (!cs) continue;
      if (hashSha256Hex_(cs + i) === gLow || hashSha256Hex_(i + cs) === gLow ||
          hashSha256Hex_(cs + ':' + i) === gLow || hashSha256Hex_(i + ':' + cs) === gLow) {
        return true;
      }
    }
  }
  return false;
}

function generarSalt_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function asegurarColumnaSalt_(sheet) {
  let { map } = obtenerHeaderMap_(sheet);
  if (map['Salt'] === undefined) {
    const col = Math.max(sheet.getLastColumn(), 1) + 1;
    sheet.getRange(1, col).setValue('Salt').setFontWeight('bold').setBackground('#0f2744').setFontColor('#ffffff');
    map = obtenerHeaderMap_(sheet).map;
  }
  return map;
}

function guardarPasswordConSal_(sheet, filaSheet, passwordPlano) {
  const map = asegurarColumnaSalt_(sheet);
  const colPass = map['Password'] !== undefined ? map['Password'] : (map['Clave'] !== undefined ? map['Clave'] : map['Contraseña']);
  if (colPass === undefined) return;
  const salt = generarSalt_();
  sheet.getRange(filaSheet, map['Salt'] + 1).setValue(salt);
  sheet.getRange(filaSheet, colPass + 1).setValue(hashSha256Hex_(salt + String(passwordPlano).trim()));
}

/**
 * TRIGGER AUTOMÁTICO DE GOOGLE SHEETS (onEdit):
 * Cuando escribís una contraseña normal en la columna 'Password' de la hoja 'Usuarios' (o 'Usuarios_Roles'),
 * automáticamente genera una nueva Sal aleatoria en la columna 'Salt' y convierte la celda 'Password'
 * en su hash SHA-256(Salt + Password).
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (!sheet) return;
    const sheetName = String(sheet.getName() || '').trim();
    if (sheetName !== CONFIG_AMMER.SHEET_USUARIOS && sheetName !== CONFIG_AMMER.SHEET_USUARIOS_ROLES &&
        sheetName !== 'Usuarios' && sheetName !== 'Usuarios_Roles') {
      return;
    }

    const rowStart = e.range.getRow();
    const numRows = e.range.getNumRows();
    if (rowStart <= 1 && numRows === 1) return; // Ignorar edición de encabezados

    const map = asegurarColumnaSalt_(sheet);
    const colPassIdx = map['Password'] !== undefined ? map['Password'] : (map['Clave'] !== undefined ? map['Clave'] : map['Contraseña']);
    if (colPassIdx === undefined) return;
    const colPass1Based = colPassIdx + 1;

    const colStart = e.range.getColumn();
    const colEnd = colStart + e.range.getNumColumns() - 1;
    if (colPass1Based < colStart || colPass1Based > colEnd) return;

    for (let r = Math.max(2, rowStart); r < rowStart + numRows; r++) {
      const val = String(sheet.getRange(r, colPass1Based).getValue() || '').trim();
      if (!val) continue;
      // Si el valor escrito NO es ya un hash SHA-256 de 64 caracteres hexadecimales, lo convierte automáticamente con nueva sal
      if (!/^[a-f0-9]{64}$/i.test(val)) {
        const nuevaSal = generarSalt_();
        const nuevoHash = hashSha256Hex_(nuevaSal + val);
        sheet.getRange(r, map['Salt'] + 1).setValue(nuevaSal);
        sheet.getRange(r, colPass1Based).setValue(nuevoHash);
      }
    }
  } catch (errOnEdit) {
    Logger.log('Error en onEdit Password SHA-256 + Salt: ' + errOnEdit);
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🔐 Seguridad AMMER')
      .addItem('Encriptar claves en texto plano (SHA-256 + Sal)', 'convertirPasswordsUsuariosAHash')
      .addItem('Unificar Usuarios_Roles en Usuarios', 'unificarHojasUsuarios')
      .addToUi();
  } catch (_) {}
}

/**
 * Utilidad manual (editor de Apps Script): fija una nueva clave con sal para un usuario.
 * Ej.: establecerPasswordUsuario('nfussoni', 'NuevaClave2026')
 */
function establecerPasswordUsuario(usuario, nuevaClave) {
  const hojas = obtenerHojasCandidatasUsuarios_();
  const u = String(usuario || '').trim().toLowerCase();
  if (!u || !String(nuevaClave || '').trim()) throw new Error('Usuario y clave son obligatorios.');
  let actualizados = 0;
  for (let h = 0; h < hojas.length; h++) {
    const sheet = hojas[h];
    const data = sheet.getDataRange().getValues();
    const { map } = obtenerHeaderMap_(sheet);
    for (let i = 1; i < data.length; i++) {
      const uLogin = obtenerColUsuario_(data[i], map, ['Usuario', 'Username', 'Login'], '').toLowerCase();
      const uId = obtenerColUsuario_(data[i], map, ['ID_Usuario', 'ID'], '').toLowerCase();
      if (uLogin === u || uId === u) {
        guardarPasswordConSal_(sheet, i + 1, nuevaClave);
        actualizados++;
      }
    }
  }
  if (actualizados > 0) return 'OK: clave actualizada con sal para ' + u + ' (' + actualizados + ' hoja/s)';
  throw new Error('Usuario no encontrado: ' + u);
}

function hashSha256Hex_(texto) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

/**
 * Convierte todas las claves en TEXTO PLANO de 'Usuarios' (y 'Usuarios_Roles' si existe)
 * generando una nueva Sal en la columna 'Salt' y guardando SHA-256(Salt + Password).
 */
function convertirPasswordsUsuariosAHash() {
  const hojas = obtenerHojasCandidatasUsuarios_();
  let n = 0;
  for (let h = 0; h < hojas.length; h++) {
    const sheet = hojas[h];
    const map = asegurarColumnaSalt_(sheet);
    const colPass = map['Password'] !== undefined ? map['Password'] : (map['Clave'] !== undefined ? map['Clave'] : map['Contraseña']);
    if (colPass === undefined) continue;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const v = String(data[i][colPass] || '').trim();
      if (v && !/^[a-f0-9]{64}$/i.test(v)) {
        guardarPasswordConSal_(sheet, i + 1, v);
        n++;
      }
    }
  }
  return n;
}

function obtenerListaAnalistas() {
  const hojas = obtenerHojasCandidatasUsuarios_();
  const analistas = [];
  const vistos = {};

  for (let h = 0; h < hojas.length; h++) {
    const sheet = hojas[h];
    const data = sheet.getDataRange().getValues();
    const { map } = obtenerHeaderMap_(sheet);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rol = obtenerColUsuario_(row, map, ['Rol', 'Role', 'Perfil'], '').toLowerCase();
      const activo = obtenerColUsuario_(row, map, ['Activo', 'Estado'], 'SI').toLowerCase();
      if (activo === 'no' || activo === 'false' || activo === '0' || activo === 'inactivo') continue;
      if (rol.indexOf('analista') !== -1 || rol.indexOf('admin') !== -1 || rol.indexOf('mutual') !== -1) {
        const idU = obtenerColUsuario_(row, map, ['ID_Usuario', 'ID', 'Id_Usuario'], '');
        const uLog = obtenerColUsuario_(row, map, ['Usuario', 'Username', 'Login'], '');
        const key = (idU || uLog).toLowerCase();
        if (key && vistos[key]) continue;
        if (key) vistos[key] = true;
        analistas.push({
          id: idU,
          nombre: obtenerColUsuario_(row, map, ['Nombre', 'Apellido_Nombre', 'Nombre_Completo'], ''),
          usuario: uLog,
          rol: obtenerColUsuario_(row, map, ['Rol', 'Role', 'Perfil'], '')
        });
      }
    }
  }
  return { ok: true, analistas: analistas };
}

/* ============================================================================
   4. PADRÓN DE ASOCIADOS
   ============================================================================ */
function buscarAsociadoPorDNI(dniRaw) {
  const dniBuscado = String(dniRaw || '').replace(/\D/g, '').trim();
  if (!dniBuscado) return { ok: true, encontrado: false };

  const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_ASOCIADOS, HEADERS_ASOCIADOS);
  const data = sheet.getDataRange().getValues();
  const { map } = obtenerHeaderMap_(sheet);

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const getCol = (colName, defVal) => (map[colName] !== undefined && row[map[colName]] !== undefined && row[map[colName]] !== '') ? String(row[map[colName]]) : (defVal || '');
    const dniRow = String(getCol('DNI', '')).replace(/\D/g, '').trim();
    if (dniRow === dniBuscado) {
      const fechaNacVal = getCol('Fecha_Nac', '');
      const archivosRaw = getCol('Archivos_Adjuntos_JSON', '[]');
      const archivosArr = parseJSONSafe_(archivosRaw, []);
      return {
        ok: true,
        encontrado: true,
        asociado: {
          dni: dniRow,
          nombre: getCol('Apellido_Nombre', ''),
          cuil: getCol('CUIL', ''),
          fechaNac: fechaNacVal,
          fechaNacimiento: fechaNacVal,
          sexo: getCol('Sexo', ''),
          estadoCivil: getCol('Estado_Civil', ''),
          celular: getCol('Celular', ''),
          email: getCol('Email', ''),
          domicilio: getCol('Domicilio', ''),
          localidad: getCol('Localidad', ''),
          condicion: getCol('Condicion', 'Activo'),
          organismo: getCol('Organismo', 'Provincial'),
          legajo: getCol('Legajo', ''),
          dependencia: getCol('Dependencia', ''),
          cargo: getCol('Cargo', ''),
          situacionRevista: getCol('Situacion_Revista', ''),
          fechaIngresoLaboral: getCol('Fecha_Ingreso_Laboral', ''),
          Fecha_Ingreso_Laboral: getCol('Fecha_Ingreso_Laboral', ''),
          antiguedad: getCol('Antiguedad', ''),
          carpetaDriveUrl: getCol('Carpeta_Drive_URL', ''),
          archivosLegajo: Array.isArray(archivosArr) ? archivosArr : [],
          Archivos_Legajo_JSON: archivosRaw,
          archivos: Array.isArray(archivosArr) ? archivosArr : []
        }
      };
    }
  }
  return { ok: true, encontrado: false };
}

function sincronizarAsociadoEnPadron_(datos) {
  if (!datos || !datos.dni) return;
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_ASOCIADOS, HEADERS_ASOCIADOS);
    const { map, totalCols } = obtenerHeaderMap_(sheet);
    const data = sheet.getDataRange().getValues();
    const dniTarget = String(datos.dni || '').replace(/\D/g, '').trim();
    if (!dniTarget) return;

    let rowIdx = -1;
    for (let i = data.length - 1; i >= 1; i--) {
      const dniRow = String((map['DNI'] !== undefined ? data[i][map['DNI']] : '') || '').replace(/\D/g, '').trim();
      if (dniRow === dniTarget) {
        rowIdx = i + 1;
        break;
      }
    }

    const existingRow = (rowIdx !== -1) ? data[rowIdx - 1] : new Array(totalCols).fill('');
    const row = existingRow.slice(0, totalCols);
    while (row.length < totalCols) row.push('');

    const pick = (colName, newVal, fallbackVal) => {
      if (map[colName] === undefined) return;
      const prev = row[map[colName]];
      const cleaned = (newVal !== undefined && newVal !== null && String(newVal).trim() !== '') ? newVal : (prev || fallbackVal || '');
      row[map[colName]] = cleaned;
    };

    pick('DNI', dniTarget, '');
    pick('Apellido_Nombre', datos.nombre, '');
    pick('CUIL', datos.cuil, '');
    pick('Fecha_Nac', datos.fechaNac || datos.fechaNacimiento, '');
    pick('Sexo', datos.sexo, '');
    pick('Estado_Civil', datos.estadoCivil, '');
    pick('Celular', datos.celular, '');
    pick('Email', datos.email, '');
    pick('Domicilio', datos.domicilio, '');
    pick('Localidad', datos.localidad, '');
    pick('Condicion', datos.condicion, 'Activo');
    pick('Organismo', datos.organismo, 'Provincial');
    pick('Legajo', datos.legajo, '');
    pick('Dependencia', datos.dependencia, '');
    pick('Cargo', datos.cargo, '');
    if (map['Situacion_Revista'] !== undefined && datos.situacionRevista !== undefined) {
      row[map['Situacion_Revista']] = String(datos.situacionRevista || '');
    }
    pick('Fecha_Ingreso_Laboral', datos.fechaIngresoLaboral || datos.fechaIngreso, '');
    pick('Antiguedad', datos.antiguedad, '');
    pick('Fecha_Alta', datos.fechaAlta || Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'), '');
    pick('Creado_Por', datos.creadoPor, 'Sistema');
    pick('Carpeta_Drive_URL', datos.carpetaDriveUrl, '');

    if (map['Archivos_Adjuntos_JSON'] !== undefined && Array.isArray(datos.archivos) && datos.archivos.length > 0) {
      const prevArchivos = parseJSONSafe_(row[map['Archivos_Adjuntos_JSON']], []);
      const merged = Array.isArray(prevArchivos) ? prevArchivos.slice() : [];
      datos.archivos.forEach(a => {
        if (!a) return;
        const exists = merged.some(m => (a.fileId && m.fileId === a.fileId) || (a.nombre && m.nombre === a.nombre));
        if (!exists) merged.push(a);
      });
      row[map['Archivos_Adjuntos_JSON']] = JSON.stringify(merged);
    }

    if (rowIdx !== -1) {
      sheet.getRange(rowIdx, 1, 1, totalCols).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  } catch (errSync) {
    // No bloquear el alta de solicitud si falla sincronización secundaria
  }
}

function registrarNuevoAsociado(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_ASOCIADOS, HEADERS_ASOCIADOS);
    const { map, totalCols } = obtenerHeaderMap_(sheet);
    const asoc = payload.asociado || payload;
    const dni = String(payload.DNI || payload.dni || asoc.dni || '').trim();
    const nombre = String(payload.Apellido_Nombre || payload.nombre || asoc.nombre || '').trim();

    let carpetaUrl = '';
    let adjuntosGuardados = [];
    const archivosRaw = payload.adjuntosBase64 || payload.archivos || payload.adjuntos || [];
    if (Array.isArray(archivosRaw) && archivosRaw.length > 0) {
      const folder = obtenerOCrearCarpetaExpediente_('ASOC-' + dni, nombre, dni);
      carpetaUrl = folder.getUrl();
      adjuntosGuardados = guardarArchivosEnDrive_(folder, archivosRaw, dni, asoc.creadoPor || 'Mutual');
    }

    const row = new Array(totalCols).fill('');
    const set = (colName, val) => { if (map[colName] !== undefined) row[map[colName]] = val; };
    set('DNI', dni);
    set('Apellido_Nombre', nombre);
    set('CUIL', payload.CUIL || payload.cuil || asoc.cuil || '');
    set('Fecha_Nac', payload.Fecha_Nacimiento || payload.fechaNacimiento || asoc.fechaNacimiento || asoc.fechaNac || '');
    set('Sexo', payload.Sexo || payload.sexo || asoc.sexo || '');
    set('Estado_Civil', payload.Estado_Civil || payload.estadoCivil || asoc.estadoCivil || '');
    set('Celular', payload.Celular || asoc.celular || '');
    set('Email', payload.Email || asoc.email || '');
    set('Domicilio', payload.Domicilio || asoc.domicilio || '');
    set('Localidad', payload.Localidad || payload.localidad || asoc.localidad || '');
    set('Condicion', payload.Condicion || asoc.condicion || 'Activo');
    set('Organismo', payload.Organismo || asoc.organismo || 'Provincial');
    set('Legajo', payload.Legajo || asoc.legajo || '');
    set('Dependencia', payload.Dependencia || asoc.dependencia || '');
    set('Cargo', payload.Cargo || asoc.cargo || '');
    set('Situacion_Revista', payload.Situacion_Revista !== undefined ? payload.Situacion_Revista : (payload.situacionRevista !== undefined ? payload.situacionRevista : (asoc.situacionRevista || '')));
    set('Fecha_Ingreso_Laboral', payload.Fecha_Ingreso_Laboral || payload.fechaIngresoLaboral || payload.fechaIngreso || asoc.fechaIngresoLaboral || asoc.fechaIngreso || '');
    set('Antiguedad', payload.Antiguedad || payload.antiguedad || asoc.antiguedad || '');
    set('Fecha_Alta', asoc.fechaAlta || Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'));
    set('Creado_Por', asoc.creadoPor || 'Usuario');
    set('Carpeta_Drive_URL', carpetaUrl);
    set('Archivos_Adjuntos_JSON', JSON.stringify(adjuntosGuardados));

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return { ok: true, dni: dni, carpetaDriveUrl: carpetaUrl, archivos: adjuntosGuardados, archivosLegajo: adjuntosGuardados };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================================
   5. REGISTRO EXHAUSTIVO Y PERSISTENCIA EN SOLICITUDES_AYUDAS
   ============================================================================ */
function registrarNuevaSolicitud(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map, totalCols } = obtenerHeaderMap_(sheet);

    const usuarioActivo = payload.usuarioActivo || {};
    const sol = payload.solicitud || payload || {};

    const idSolicitud = String(
      sol.id || payload.ID_Solicitud || payload.ID_OPERACION || payload.id || Math.floor(10000 + Math.random() * 90000)
    ).trim();
    const idProvisorio = String(sol.id_provisorio || payload.id_provisorio || ('PROV-' + idSolicitud)).trim();
    const idDefinitivo = String(
      sol.id_definitivo || sol.ID_Definitivo_Expediente || payload.ID_Definitivo_Expediente || payload.Nro_Definitivo || payload.nroDefinitivo || payload.id_definitivo || ''
    ).trim();
    const nowStr = obtenerFechaHora24Argentina_();
    const fechaRegistro = String(sol.fecha || payload.Fecha_Registro || payload.fecha || payload.Fecha || nowStr);

    // Captura garantizada de identidad de origen y organización para RBAC multiplataforma
    const asesorId = String(
      sol.idUsuarioAsesor || sol.usuario_id || payload.ID_Usuario_Asesor || payload.idUsuarioAsesor || payload.usuario_id ||
      (usuarioActivo && (usuarioActivo.id || usuarioActivo.usuario_id)) || 'USR-000'
    ).trim();

    const asesorNombre = String(
      sol.nombreAsesor || sol.comercializador || payload.Nombre_Asesor || payload.nombreAsesor || payload.Comercializador || payload.comercializador ||
      (usuarioActivo && usuarioActivo.nombre) || 'Asesor'
    ).trim();

    const orgId = String(
      sol.idOrganizacion || sol.organizacion_id || payload.ID_Organizacion || payload.idOrganizacion || payload.Organizacion_Id || payload.organizacion_id ||
      (usuarioActivo && (usuarioActivo.idOrganizacion || usuarioActivo.organizacion_id)) || 'ORG-GENERAL'
    ).trim();

    const orgNombre = String(
      sol.nombreOrganizacion || sol.nombre_organizacion || payload.Nombre_Organizacion || payload.nombreOrganizacion || payload.nombre_organizacion ||
      (usuarioActivo && (usuarioActivo.nombreOrganizacion || usuarioActivo.nombre_organizacion)) || 'General'
    ).trim();

    const canal = String(
      sol.origenCanal || sol.origen_canal || payload.Origen_Canal || payload.origenCanal || payload.Canal_Ingreso || payload.origen_canal ||
      (usuarioActivo && usuarioActivo.rol === 'Comercializador' ? 'Comercializador Externo' : 'Sede Central Mutual')
    ).trim();

    const solicitante = sol.solicitante || {};
    const dni = String(
      solicitante.dni || sol.dni || payload.DNI_Asociado || payload.DNI || payload.dni || ''
    ).trim();
    const apellidoNombre = String(
      solicitante.nombre || sol.apellidoNombre || payload.Apellido_Nombre || payload.apellido_nombre || payload.apellidoNombre || payload.nombre || 'Sin_Nombre'
    ).trim();
    const domicilioHistorico = String(
      sol.domicilio_historico || solicitante.domicilio || sol.domicilio || payload.Domicilio_Historico_Solicitud || payload.Domicilio || payload.domicilio || 'Sin domicilio declarado'
    ).trim();
    const legajo = String(
      solicitante.legajo || sol.legajo || payload.Legajo_Municipal || payload.Legajo || payload.legajo || ''
    ).trim();

    const contactoExtra = parseJSONSafe_(payload.Datos_Contacto_JSON, {});
    const laboralesExtra = parseJSONSafe_(payload.Datos_Laborales_JSON, {});
    const solContacto = sol.datosContacto || {};
    const solLaborales = sol.datosLaborales || {};

    const datosContacto = {
      cuil: solicitante.cuil || solContacto.cuil || sol.cuil || payload.CUIL || payload.cuil || contactoExtra.cuil || '',
      localidad: solicitante.localidad || solContacto.localidad || sol.localidad || payload.Localidad || payload.localidad || contactoExtra.localidad || '',
      fechaNac: solicitante.fechaNac || solicitante.fechaNacimiento || solContacto.fechaNacimiento || solContacto.fechaNac || sol.fechaNacimiento || sol.fechaNac || payload.Fecha_Nacimiento || payload.Fecha_Nac || payload.fechaNacimiento || payload.fechaNac || contactoExtra.fechaNac || contactoExtra.fechaNacimiento || '',
      fechaNacimiento: solicitante.fechaNacimiento || solicitante.fechaNac || solContacto.fechaNacimiento || solContacto.fechaNac || sol.fechaNacimiento || sol.fechaNac || payload.Fecha_Nacimiento || payload.Fecha_Nac || payload.fechaNacimiento || payload.fechaNac || contactoExtra.fechaNacimiento || contactoExtra.fechaNac || '',
      sexo: solicitante.sexo || solContacto.sexo || sol.sexo || payload.Sexo || payload.sexo || contactoExtra.sexo || '',
      estadoCivil: solicitante.estadoCivil || solContacto.estadoCivil || sol.estadoCivil || payload.Estado_Civil || payload.estadoCivil || contactoExtra.estadoCivil || '',
      email: solicitante.email || solContacto.email || sol.email || payload.Email || payload.email || contactoExtra.email || '',
      celular: solicitante.celular || solContacto.celular || solContacto.telefono || sol.telefono || sol.celular || payload.Celular || payload.celular || contactoExtra.celular || '',
      domicilio: domicilioHistorico
    };

    const fechaIngresoLab = solicitante.fechaIngresoLaboral || solicitante.fechaIngreso || solLaborales.fechaIngresoLaboral || solLaborales.fechaIngreso || sol.fechaIngresoLaboral || sol.fechaIngreso || payload.Fecha_Ingreso_Laboral || payload.fechaIngresoLaboral || payload.fechaIngreso || laboralesExtra.fechaIngresoLaboral || '';
    const datosLaborales = {
      condicion: solicitante.condicion || solLaborales.condicion || sol.condicion || payload.Condicion || payload.condicion || laboralesExtra.condicion || 'Activo',
      organismo: solicitante.organismo || solLaborales.organismo || sol.organismo || payload.Organismo || payload.organismo || laboralesExtra.organismo || 'Provincial',
      dependencia: solicitante.dependencia || solLaborales.dependencia || sol.dependencia || payload.Dependencia || payload.dependencia || laboralesExtra.dependencia || '',
      cargo: solicitante.cargo || solLaborales.cargo || sol.cargo || payload.Cargo || payload.cargo || laboralesExtra.cargo || '',
      situacionRevista: (solicitante.situacionRevista !== undefined ? solicitante.situacionRevista : (solLaborales.situacionRevista !== undefined ? solLaborales.situacionRevista : (sol.situacionRevista !== undefined ? sol.situacionRevista : (payload.Situacion_Revista !== undefined ? payload.Situacion_Revista : (payload.situacionRevista !== undefined ? payload.situacionRevista : (laboralesExtra.situacionRevista || '')))))),
      fechaIngresoLaboral: fechaIngresoLab,
      Fecha_Ingreso_Laboral: fechaIngresoLab,
      antiguedad: solicitante.antiguedad || solLaborales.antiguedad || sol.antiguedad || payload.Antiguedad || payload.antiguedad || laboralesExtra.antiguedad || '',
      legajo: legajo
    };

    const parseNumSafe = (v, defVal) => {
      if (typeof v === 'number') return isNaN(v) ? defVal : v;
      if (v === null || v === undefined || v === '') return defVal;
      let s = String(v).replace(/[$\s]/g, '');
      if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) s = s.replace(/\./g, '').replace(',', '.');
      else if (s.indexOf(',') !== -1) s = s.replace(',', '.');
      else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
      const n = Number(s);
      return isNaN(n) ? defVal : n;
    };

    const prestamo = sol.prestamo || {};
    const lineaAyuda = String(
      prestamo.lineaNombre || prestamo.linea || sol.lineaAyuda || payload.Linea_Ayuda || payload.Linea_Nombre || payload.Linea || payload.linea || 'FEDEM Provincial'
    );
    const lineaKey = String(prestamo.linea || sol.linea || payload.Linea || payload.linea || 'fedem');
    const montoNeto = parseNumSafe(
      prestamo.monto !== undefined ? prestamo.monto : (sol.montoNeto !== undefined ? sol.montoNeto : (payload.Monto_Solicitado_Neto !== undefined ? payload.Monto_Solicitado_Neto : (payload.Monto !== undefined ? payload.Monto : payload.monto))),
      0
    );
    const cantCuotas = parseNumSafe(
      prestamo.cuotas !== undefined ? prestamo.cuotas : (sol.cuotas !== undefined ? sol.cuotas : (payload.Cantidad_Cuotas !== undefined ? payload.Cantidad_Cuotas : (payload.Cuotas !== undefined ? payload.Cuotas : (payload.cuotas !== undefined ? payload.cuotas : payload.Plazo)))),
      12
    );
    const montoCuota = parseNumSafe(
      prestamo.cuotaEstimada !== undefined ? prestamo.cuotaEstimada : (sol.montoCuota !== undefined ? sol.montoCuota : (payload.Monto_Cuota !== undefined ? payload.Monto_Cuota : (payload.Cuota_Estimada !== undefined ? payload.Cuota_Estimada : payload.cuotaEstimada))),
      0
    );
    const totalADevolver = parseNumSafe(
      prestamo.totalADevolver !== undefined ? prestamo.totalADevolver : (sol.totalDevolver !== undefined ? sol.totalDevolver : payload.Total_A_Devolver),
      Number((montoCuota * cantCuotas).toFixed(2)) || 0
    );
    const estadoTramite = String(sol.estado || payload.Estado_Tramite || 'Pendiente');
    const analistaAsignado = String(sol.analistaAsignado || sol.Analista_Asignado || payload.Analista_Asignado || payload.analistaAsignado || 'Sin Asignar').trim();

    // Gestión de carpeta y archivos reales en Google Drive
    const prefijoInicial = (idDefinitivo && idDefinitivo !== 'undefined' && idDefinitivo !== 'null') ? idDefinitivo : idSolicitud;
    const folder = obtenerOCrearCarpetaExpediente_(prefijoInicial, apellidoNombre, dni, idSolicitud);
    const carpetaDriveUrl = folder.getUrl();

    const archivosEntrada = parseJSONSafe_(payload.Archivos_Adjuntos_JSON, null) ||
      payload.archivosBase64 || payload.adjuntosBase64 || sol.archivosBase64 || sol.adjuntosBase64 ||
      payload.archivos || payload.adjuntos || sol.archivos || sol.adjuntos || [];
    const operadorCargaInicial = String(
      payload.usuarioOperador ||
      (usuarioActivo && usuarioActivo.nombre) ||
      asesorNombre ||
      'Operador'
    ).trim();
    const adjuntosDrive = guardarArchivosEnDrive_(folder, archivosEntrada, prefijoInicial, operadorCargaInicial);

    const historialComentarios = Array.isArray(sol.observaciones)
      ? sol.observaciones
      : parseJSONSafe_(payload.Historial_Comentarios_JSON, []);

    const ofertasParsed = parseJSONSafe_(payload.Historial_Ofertas_JSON, null);
    const historialOfertasObj = {
      propuestaMutual: sol.propuestaMutual || (ofertasParsed && ofertasParsed.propuestaMutual) || null,
      historialPropuestas: Array.isArray(sol.historialPropuestas) ? sol.historialPropuestas : ((ofertasParsed && Array.isArray(ofertasParsed.historialPropuestas)) ? ofertasParsed.historialPropuestas : [])
    };

    const dictamenIA = sol.auditoriaIA || parseJSONSafe_(payload.Dictamen_IA_JSON, null);

    const metadataExtra = {
      id_provisorio: idProvisorio,
      id_definitivo: idDefinitivo,
      lineaKey: lineaKey,
      requerimientosDocumentales: Array.isArray(sol.requerimientosDocumentales) ? sol.requerimientosDocumentales : [],
      ultimaDerivacion: sol.ultimaDerivacion || null
    };

    const row = new Array(totalCols).fill('');
    const set = (colName, val) => { if (map[colName] !== undefined) row[map[colName]] = val; };

    set('ID_Solicitud', idSolicitud);
    set('Fecha_Registro', fechaRegistro);
    set('ID_Usuario_Asesor', asesorId);
    set('Nombre_Asesor', asesorNombre);
    set('ID_Organizacion', orgId);
    set('Nombre_Organizacion', orgNombre);
    set('Origen_Canal', canal);
    set('DNI_Asociado', dni);
    set('Apellido_Nombre', apellidoNombre);
    set('Domicilio_Historico_Solicitud', domicilioHistorico);
    set('Legajo_Municipal', legajo);
    set('Datos_Contacto_JSON', JSON.stringify(datosContacto));
    set('Datos_Laborales_JSON', JSON.stringify(datosLaborales));
    set('Linea_Ayuda', lineaAyuda);
    set('Monto_Solicitado_Neto', montoNeto);
    set('Cantidad_Cuotas', cantCuotas);
    set('Monto_Cuota', montoCuota);
    set('Total_A_Devolver', totalADevolver);
    set('Estado_Tramite', estadoTramite);
    set('Carpeta_Drive_URL', carpetaDriveUrl);
    set('Archivos_Adjuntos_JSON', JSON.stringify(adjuntosDrive));
    set('Historial_Comentarios_JSON', JSON.stringify(historialComentarios));
    set('Nro_Definitivo', idDefinitivo);
    set('ID_Definitivo_Expediente', idDefinitivo);
    set('Fecha_Ingreso_Laboral', datosLaborales.fechaIngresoLaboral);
    set('Historial_Ofertas_JSON', JSON.stringify(historialOfertasObj));
    set('Dictamen_IA_JSON', dictamenIA ? JSON.stringify(dictamenIA) : '');
    set('Analista_Asignado', analistaAsignado);
    set('Ultima_Actualizacion', nowStr);
    set('Metadata_Extra_JSON', JSON.stringify(metadataExtra));

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    sincronizarAsociadoEnPadron_({
      dni: dni,
      nombre: apellidoNombre,
      cuil: datosContacto.cuil,
      fechaNac: datosContacto.fechaNacimiento || datosContacto.fechaNac,
      sexo: datosContacto.sexo,
      estadoCivil: datosContacto.estadoCivil,
      celular: datosContacto.celular,
      email: datosContacto.email,
      domicilio: domicilioHistorico,
      localidad: datosContacto.localidad,
      condicion: datosLaborales.condicion,
      organismo: datosLaborales.organismo,
      legajo: legajo,
      dependencia: datosLaborales.dependencia,
      cargo: datosLaborales.cargo,
      situacionRevista: datosLaborales.situacionRevista,
      fechaIngresoLaboral: datosLaborales.fechaIngresoLaboral,
      antiguedad: datosLaborales.antiguedad,
      creadoPor: asesorNombre,
      carpetaDriveUrl: carpetaDriveUrl,
      archivos: adjuntosDrive
    });

    return {
      ok: true,
      id: idSolicitud,
      idSolicitud: idSolicitud,
      id_provisorio: idProvisorio,
      carpetaDriveUrl: carpetaDriveUrl,
      archivos: adjuntosDrive,
      archivosLegajo: adjuntosDrive,
      mensaje: 'Expediente ' + idProvisorio + ' registrado en Google Sheets, Padrón de Asociados y Google Drive.'
    };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================================
   6. LISTADO TOLERANTE MULTIPLATAFORMA Y FILTRADO RBAC
   ============================================================================ */
function listarSolicitudes(usuarioActivoInput) {
  const usuarioActivo = (usuarioActivoInput && usuarioActivoInput.usuarioActivo)
    ? usuarioActivoInput.usuarioActivo
    : (usuarioActivoInput || {});

  const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { ok: true, solicitudes: [], total: 0 };
  }

  const { map } = obtenerHeaderMap_(sheet);
  const todas = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const get = (col) => (map[col] !== undefined ? row[map[col]] : '');

    const idSol = String(get('ID_Solicitud') || '').trim();
    const dni = String(get('DNI_Asociado') || '').trim();
    const nombreSoc = String(get('Apellido_Nombre') || '').trim();
    if (!idSol && !dni && !nombreSoc) continue;

    const contacto = parseJSONSafe_(get('Datos_Contacto_JSON'), {});
    const laborales = parseJSONSafe_(get('Datos_Laborales_JSON'), {});
    const adjuntos = parseJSONSafe_(get('Archivos_Adjuntos_JSON'), []);
    const observaciones = parseJSONSafe_(get('Historial_Comentarios_JSON'), []);
    const ofertasData = parseJSONSafe_(get('Historial_Ofertas_JSON'), {});
    const dictamenIA = parseJSONSafe_(get('Dictamen_IA_JSON'), null);
    const meta = parseJSONSafe_(get('Metadata_Extra_JSON'), {});

    const lineaNombre = String(get('Linea_Ayuda') || 'FEDEM Provincial');
    const lineaLow = lineaNombre.toLowerCase();
    const lineaKey = meta.lineaKey || (
      (lineaLow.indexOf('muni') !== -1 || lineaLow.indexOf('quad') !== -1) ? 'muni' :
      (lineaLow.indexOf('sidecreer') !== -1) ? 'sidecreer' : 'fedem'
    );

    const idAsesor = String(get('ID_Usuario_Asesor') || '').trim();
    const nombreAsesor = String(get('Nombre_Asesor') || '').trim();
    const idOrg = String(get('ID_Organizacion') || '').trim();
    const nombreOrg = String(get('Nombre_Organizacion') || '').trim();
    const origenCanal = String(get('Origen_Canal') || '').trim();
    const analistaAsig = String(get('Analista_Asignado') || '').trim();
    const montoNeto = Number(get('Monto_Solicitado_Neto') || 0);
    const cuotas = Number(get('Cantidad_Cuotas') || 12);
    const montoCuota = Number(get('Monto_Cuota') || 0);
    const totalDevolver = Number(get('Total_A_Devolver') || (montoCuota * cuotas) || 0);

    let propMutual = (ofertasData && !Array.isArray(ofertasData) && ofertasData.propuestaMutual)
      ? ofertasData.propuestaMutual
      : null;
    let histPropuestas = (ofertasData && !Array.isArray(ofertasData) && Array.isArray(ofertasData.historialPropuestas))
      ? ofertasData.historialPropuestas
      : (Array.isArray(ofertasData) ? ofertasData : []);

    const nroDefVal = String(get('ID_Definitivo_Expediente') || get('Nro_Definitivo') || get('ID_Definitivo') || meta.id_definitivo || '').trim();
    const fechaIngresoRow = String(laborales.fechaIngresoLaboral || laborales.Fecha_Ingreso_Laboral || get('Fecha_Ingreso_Laboral') || '').trim();
    const item = {
      id: idSol,
      filaSheet: i + 1,
      id_provisorio: meta.id_provisorio || ('PROV-' + idSol),
      id_definitivo: nroDefVal,
      Nro_Definitivo: nroDefVal,
      ID_Definitivo_Expediente: nroDefVal,
      fecha: formatearFecha24Backend_(get('Fecha_Registro')),
      usuario_id: idAsesor,
      idAsesor: idAsesor,
      idUsuarioAsesor: idAsesor,
      ID_Usuario_Asesor: idAsesor,
      comercializador: nombreAsesor,
      nombreAsesor: nombreAsesor,
      Nombre_Asesor: nombreAsesor,
      organizacion_id: idOrg,
      idOrganizacion: idOrg,
      ID_Organizacion: idOrg,
      nombre_organizacion: nombreOrg,
      nombreOrganizacion: nombreOrg,
      Nombre_Organizacion: nombreOrg,
      origen_canal: origenCanal,
      origenCanal: origenCanal,
      Origen_Canal: origenCanal,
      domicilio_historico: String(get('Domicilio_Historico_Solicitud') || contacto.domicilio || ''),
      solicitante: {
        dni: dni,
        cuil: contacto.cuil || '',
        legajo: String(get('Legajo_Municipal') || laborales.legajo || ''),
        nombre: nombreSoc,
        fechaNac: contacto.fechaNac || contacto.fechaNacimiento || '',
        fechaNacimiento: contacto.fechaNacimiento || contacto.fechaNac || '',
        sexo: contacto.sexo || '',
        estadoCivil: contacto.estadoCivil || '',
        email: contacto.email || '',
        celular: contacto.celular || '',
        domicilio: String(get('Domicilio_Historico_Solicitud') || contacto.domicilio || ''),
        domicilio_historico: String(get('Domicilio_Historico_Solicitud') || contacto.domicilio || ''),
        localidad: contacto.localidad || '',
        condicion: laborales.condicion || 'Activo',
        organismo: laborales.organismo || 'Provincial',
        dependencia: laborales.dependencia || '',
        cargo: laborales.cargo || '',
        situacionRevista: laborales.situacionRevista !== undefined ? laborales.situacionRevista : '',
        fechaIngresoLaboral: fechaIngresoRow,
        Fecha_Ingreso_Laboral: fechaIngresoRow,
        antiguedad: laborales.antiguedad || ''
      },
      datosContacto: contacto,
      datosLaborales: Object.assign({}, laborales, { fechaIngresoLaboral: fechaIngresoRow, Fecha_Ingreso_Laboral: fechaIngresoRow }),
      prestamo: {
        linea: lineaKey,
        lineaNombre: lineaNombre,
        monto: montoNeto,
        cuotas: cuotas,
        cuotaEstimada: montoCuota,
        totalADevolver: totalDevolver
      },
      propuestaMutual: propMutual,
      historialPropuestas: histPropuestas,
      requerimientosDocumentales: Array.isArray(meta.requerimientosDocumentales) ? meta.requerimientosDocumentales : [],
      ultimaDerivacion: meta.ultimaDerivacion || null,
      carpetaDriveUrl: String(get('Carpeta_Drive_URL') || ''),
      Carpeta_Drive_URL: String(get('Carpeta_Drive_URL') || ''),
      adjuntos: Array.isArray(adjuntos) ? adjuntos : [],
      archivosAdjuntos: Array.isArray(adjuntos) ? adjuntos : [],
      archivosLegajo: Array.isArray(adjuntos) ? adjuntos : [],
      archivos: Array.isArray(adjuntos) ? adjuntos : [],
      Archivos_Adjuntos_JSON: String(get('Archivos_Adjuntos_JSON') || '[]'),
      observaciones: Array.isArray(observaciones) ? observaciones : [],
      historialComentarios: Array.isArray(observaciones) ? observaciones : [],
      comentarios: Array.isArray(observaciones) ? observaciones : [],
      Historial_Comentarios_JSON: String(get('Historial_Comentarios_JSON') || '[]'),
      auditoriaIA: dictamenIA || null,
      estado: String(get('Estado_Tramite') || 'Pendiente'),
      analistaAsignado: analistaAsig || 'Sin Asignar',
      Analista_Asignado: analistaAsig || 'Sin Asignar',
      ultimaActualizacion: formatearFecha24Backend_(get('Ultima_Actualizacion'))
    };

    todas.push(item);
  }

  // Ordenar más recientes primero
  todas.reverse();

  // Filtrado RBAC tolerante en servidor
  const rol = String(usuarioActivo.rol || '').toLowerCase().trim();
  const userId = String(usuarioActivo.id || usuarioActivo.usuario_id || usuarioActivo.idUsuario || '').trim();
  const miNombre = String(usuarioActivo.nombre || '').toLowerCase().trim();
  const userOrgId = String(usuarioActivo.idOrganizacion || usuarioActivo.organizacion_id || '').toLowerCase().trim();
  const userOrgNombre = String(usuarioActivo.nombreOrganizacion || usuarioActivo.nombre_organizacion || '').toLowerCase().trim();
  const esTitular = Boolean(usuarioActivo.esTitular === true || usuarioActivo.es_titular_organizacion === true || usuarioActivo.es_titular === true || rol.indexOf('titular') !== -1);

  if (!rol || rol === 'admin' || rol === 'administrador') {
    return { ok: true, solicitudes: todas, total: todas.length };
  }

  const filtradas = todas.filter(item => {
    const itemAsesorId = String(item.idAsesor || item.idUsuarioAsesor || '').trim();
    const itemNombreAsesor = String(item.nombreAsesor || '').toLowerCase().replace(/\s*\(sede central\)\s*/gi, '').trim();
    const itemNombreRaw = String(item.nombreAsesor || '').toLowerCase().trim();
    const itemOrgId = String(item.idOrganizacion || '').toLowerCase().trim();
    const itemOrgNombre = String(item.nombreOrganizacion || '').toLowerCase().trim();
    const itemCanal = String(item.origenCanal || '').toLowerCase();
    const itemAnalista = String(item.analistaAsignado || '').toLowerCase().trim();

    if (rol === 'analista' || rol.indexOf('analista') !== -1 || rol.indexOf('asesor mutual') !== -1) {
      // Personal interno de Mutual (Analistas) ve toda la cartera de Sede Central y Red Comercial
      return true;
    }

    if (esTitular) {
      const matchOrgId = Boolean(userOrgId && itemOrgId === userOrgId);
      const matchOrgNombre = Boolean(userOrgNombre && itemOrgNombre === userOrgNombre);
      return matchOrgId || matchOrgNombre;
    }

    // Asesor Comercial
    return Boolean(
      (userId && (item.idAsesor === userId || item.idUsuarioAsesor === userId)) ||
      (miNombre && (itemNombreAsesor === miNombre || itemNombreRaw === miNombre))
    );
  });

  return { ok: true, solicitudes: filtradas, total: filtradas.length };
}

/* ============================================================================
   7. OPERACIONES DE ACTUALIZACIÓN SOBRE EXPEDIENTE EXISTENTE
   ============================================================================ */
function encontrarFilaPorId_(sheet, map, idSolicitud) {
  const idTarget = String(idSolicitud || '').trim();
  if (!idTarget) return -1;
  const colIdx = map['ID_Solicitud'];
  if (colIdx === undefined) return -1;
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colIdx] || '').trim() === idTarget) {
      return i + 1; // 1-based row number
    }
  }
  const cleanTarget = idTarget.replace(/^(PROV|AYU)-/i, '').trim();
  if (cleanTarget) {
    for (let i = 1; i < values.length; i++) {
      const rowId = String(values[i][colIdx] || '').trim();
      if (rowId.replace(/^(PROV|AYU)-/i, '').trim() === cleanTarget) {
        return i + 1;
      }
    }
  }
  return -1;
}

function actualizarEstadoSolicitudBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const estadoFinal = payload.nuevoEstado || payload.estado;
    const nowStr = obtenerFechaHora24Argentina_();
    if (map['Estado_Tramite'] !== undefined && estadoFinal) {
      sheet.getRange(rowNum, map['Estado_Tramite'] + 1).setValue(String(estadoFinal));
    }
    const operador = payload.analista || payload.usuarioOperador || (payload.usuarioActivo && payload.usuarioActivo.nombre) || 'Analista Mutual';
    if (map['Analista_Asignado'] !== undefined && (payload.analista || payload.usuarioOperador)) {
      sheet.getRange(rowNum, map['Analista_Asignado'] + 1).setValue(String(operador));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    const comentarioTexto = payload.comentario || (payload.motivo ? ('Gestión Desestimada. Motivo: ' + payload.motivo) : '');
    if (comentarioTexto && map['Historial_Comentarios_JSON'] !== undefined) {
      const cell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(cell.getValue(), []);
      hist.push({
        autor: operador,
        rol: (payload.usuarioActivo && payload.usuarioActivo.rol) || 'Analista Mutual',
        fecha: nowStr,
        texto: String(comentarioTexto)
      });
      cell.setValue(JSON.stringify(hist));
    }

    SpreadsheetApp.flush();
    return { ok: true, id: idTarget, estado: estadoFinal };
  } finally {
    lock.releaseLock();
  }
}

function eliminarSolicitudBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    sheet.deleteRow(rowNum);
    SpreadsheetApp.flush();
    return { ok: true, id: idTarget, mensaje: 'Solicitud inicial eliminada permanentemente' };
  } finally {
    lock.releaseLock();
  }
}

const CLEANUP_KEY_SALT_DEFAULT_ = '7e4a1ad11cf627a2b016ac8ab626e12e';
const CLEANUP_KEY_HASH_DEFAULT_ = '9362828837d52f41da1f9e50b956912c0475216b27c1fc251d2acde79c555a9d';
const CLEANUP_KEY_ROUNDS_ = 2500;

function timingSafeEqualHex_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return diff === 0;
}

function verificarClaveLimpiezaGas_(claveIngresada) {
  const clave = String(claveIngresada || '').trim();
  if (!clave) return false;
  const props = PropertiesService.getScriptProperties();
  const customHash = String(props.getProperty('CLEANUP_KEY_HASH') || '').trim().toLowerCase();
  const customSalt = String(props.getProperty('CLEANUP_KEY_SALT') || CLEANUP_KEY_SALT_DEFAULT_).trim();
  const expectedHash = customHash || CLEANUP_KEY_HASH_DEFAULT_;
  const rounds = Number(props.getProperty('CLEANUP_KEY_ROUNDS') || CLEANUP_KEY_ROUNDS_) || CLEANUP_KEY_ROUNDS_;

  let actual = hashSha256Hex_(customSalt + ':' + clave);
  for (let r = 1; r < rounds; r++) {
    actual = hashSha256Hex_(customSalt + ':' + actual);
  }
  return timingSafeEqualHex_(actual.toLowerCase(), expectedHash);
}

function limpiarDatosPruebaBackend(payload, omitirClavePorEditor) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const usuarioActivo = (payload && payload.usuarioActivo) || {};
    const rol = String(usuarioActivo.rol || (payload && payload.rol) || '').trim().toLowerCase();
    if (rol && rol !== 'admin' && rol !== 'administrador') {
      return { ok: false, error: 'Acceso restringido: esta acción requiere rol Admin.' };
    }
    if (omitirClavePorEditor !== true) {
      const clave = (payload && (payload.securityKey || payload.claveSeguridad || payload.clave)) || '';
      if (!verificarClaveLimpiezaGas_(clave)) {
        return { ok: false, error: 'Clave de seguridad incorrecta o faltante para limpiar datos de prueba.' };
      }
    }

    const limpiarSolicitudes = !payload || payload.limpiarSolicitudes !== false;
    const limpiarPadron = !payload || payload.limpiarPadron !== false;
    const incluirDrive = !payload || payload.incluirDrive !== false;

    const ss = obtenerSpreadsheet_();
    let solicitudesBorradas = 0;
    let asociadosBorrados = 0;
    let carpetasDrivePapelera = 0;

    if (limpiarSolicitudes && ss) {
      const sheetSol = ss.getSheetByName(CONFIG_AMMER.SHEET_SOLICITUDES);
      if (sheetSol && sheetSol.getLastRow() > 1) {
        solicitudesBorradas = sheetSol.getLastRow() - 1;
        sheetSol.deleteRows(2, solicitudesBorradas);
      }
    }

    if (limpiarPadron && ss) {
      const sheetAsoc = ss.getSheetByName(CONFIG_AMMER.SHEET_ASOCIADOS);
      if (sheetAsoc && sheetAsoc.getLastRow() > 1) {
        asociadosBorrados = sheetAsoc.getLastRow() - 1;
        sheetAsoc.deleteRows(2, asociadosBorrados);
      }
    }

    if (incluirDrive) {
      try {
        const root = obtenerOCrearCarpetaRaiz_();
        const protegidas = {
          'TUTORIAL SIDECREER_': true,
          'BD_MUTUAL_MODELO_SIMULADOROFFICE': true
        };
        const iter = root.getFolders();
        while (iter.hasNext()) {
          const f = iter.next();
          const up = String(f.getName() || '').trim().toUpperCase();
          if (protegidas[up]) continue;
          try {
            f.setTrashed(true);
            carpetasDrivePapelera++;
          } catch (_) {}
        }
      } catch (_) {}
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      solicitudesBorradas: solicitudesBorradas,
      asociadosBorrados: asociadosBorrados,
      carpetasDrivePapelera: carpetasDrivePapelera
    };
  } finally {
    lock.releaseLock();
  }
}

function limpiarDatosPruebaCompleto() {
  return limpiarDatosPruebaBackend({
    usuarioActivo: { rol: 'Admin' },
    limpiarSolicitudes: true,
    limpiarPadron: true,
    incluirDrive: true
  }, true);
}

function reasignarAnalistaBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nowStr = obtenerFechaHora24Argentina_();
    const nuevoAnalista = String(payload.nuevoAnalista || payload.Analista_Asignado || '').trim();
    const motivo = String(payload.motivo || '').trim();
    const autor = String(payload.autor || (payload.usuarioActivo && payload.usuarioActivo.nombre) || 'Analista').trim();

    if (map['Analista_Asignado'] !== undefined && nuevoAnalista) {
      sheet.getRange(rowNum, map['Analista_Asignado'] + 1).setValue(nuevoAnalista);
    }
    if (map['Historial_Comentarios_JSON'] !== undefined) {
      if (payload.Historial_Comentarios_JSON) {
        sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1).setValue(String(payload.Historial_Comentarios_JSON));
      } else {
        const cell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
        const hist = parseJSONSafe_(cell.getValue(), []);
        hist.push({
          fecha: nowStr,
          autor: autor,
          rol: 'Analista',
          texto: 'Caso derivado a ' + nuevoAnalista + '. Motivo: ' + motivo
        });
        cell.setValue(JSON.stringify(hist));
      }
    }
    if (map['Metadata_Extra_JSON'] !== undefined) {
      const metaCell = sheet.getRange(rowNum, map['Metadata_Extra_JSON'] + 1);
      const meta = parseJSONSafe_(metaCell.getValue(), {});
      meta.ultimaDerivacion = {
        autor: autor,
        analistaAnterior: payload.analistaAnterior || 'Sin Asignar',
        destinatario: nuevoAnalista,
        motivo: motivo,
        fecha: nowStr
      };
      metaCell.setValue(JSON.stringify(meta));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return { ok: true, idSolicitud: idTarget, nuevoAnalista: nuevoAnalista };
  } finally {
    lock.releaseLock();
  }
}

function agregarComentarioBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nowStr = obtenerFechaHora24Argentina_();
    const nowTime = new Date().getTime();
    const commentId = String(payload.idComentario || payload.idMsg || payload.id || ('msg_' + nowTime + '_' + Math.floor(Math.random() * 10000)));
    const textoMsg = String(payload.texto || payload.contenido || '');

    const nuevoNodo = {
      id: commentId,
      autor: payload.autor || 'Usuario',
      rol: payload.rol || 'Analista',
      fecha: nowStr,
      timestamp: payload.timestamp ? Number(payload.timestamp) : nowTime,
      texto: textoMsg,
      contenido: textoMsg,
      editado: false,
      eliminado: false
    };

    let histActualizado = [];
    if (map['Historial_Comentarios_JSON'] !== undefined) {
      const cell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(cell.getValue(), []);
      histActualizado = Array.isArray(hist) ? hist.slice() : [];
      histActualizado.push(nuevoNodo);
      cell.setValue(JSON.stringify(histActualizado));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return { ok: true, id: idTarget, idComentario: commentId, comentario: nuevoNodo, comentarios: histActualizado };
  } finally {
    lock.releaseLock();
  }
}

function editarComentarioBitacoraBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = String(payload.idSolicitud || payload.id || '').trim();
    if (!idTarget) return { ok: false, error: 'ID de expediente no especificado.' };

    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const colHistorialIdx = (map['Historial_Comentarios_JSON'] !== undefined) ? map['Historial_Comentarios_JSON'] : 21;
    const cellHistorial = sheet.getRange(rowNum, colHistorialIdx + 1);
    const hist = parseJSONSafe_(cellHistorial.getValue(), []);
    if (!Array.isArray(hist) || hist.length === 0) {
      return { ok: false, error: 'El expediente no posee comentarios registrados.' };
    }

    const idComentario = String(payload.idComentario || payload.idMsg || '').trim();
    const reqTimestamp = payload.timestamp ? Number(payload.timestamp) : 0;
    const nuevoTexto = String(payload.nuevoContenido || payload.texto || payload.contenido || '').trim();
    if (!nuevoTexto) return { ok: false, error: 'El contenido del comentario no puede estar vacío.' };

    let msgIndex = -1;
    if (idComentario) {
      msgIndex = hist.findIndex(m => m && (String(m.id || '').trim() === idComentario));
    }
    if (msgIndex === -1 && reqTimestamp) {
      msgIndex = hist.findIndex(m => m && (Number(m.timestamp || 0) === reqTimestamp));
    }
    if (msgIndex === -1 && payload.textoAnterior) {
      msgIndex = hist.findIndex(m => m && (m.texto === payload.textoAnterior || m.contenido === payload.textoAnterior));
    }

    if (msgIndex === -1) {
      return { ok: false, error: 'No se encontró el mensaje especificado en la bitácora.' };
    }

    const msg = hist[msgIndex];

    if (msg.tipo === 'AUDITORIA_INICIAL' || msg.tipo === 'AUDITORIA_IA_DOCUMENTAL' || (msg.autor && String(msg.autor).includes('[Auditoría IA]'))) {
      return { ok: false, error: 'Los dictámenes oficiales de auditoría documental no son editables.' };
    }

    const nowTime = new Date().getTime();
    let msgTime = Number(msg.timestamp || 0);
    if (!msgTime && msg.fecha) {
      msgTime = parsearFechaATimestampBackend_(msg.fecha);
    }
    if (msgTime && (nowTime - msgTime > 300000)) {
      return { ok: false, error: 'La ventana de 5 minutos para editar este mensaje ha expirado.' };
    }

    const nowStr = obtenerFechaHora24Argentina_();
    msg.texto = nuevoTexto;
    msg.contenido = nuevoTexto;
    msg.editado = true;
    msg.fechaEdicion = nowStr;

    cellHistorial.setValue(JSON.stringify(hist));

    const colUltimaActIdx = (map['Ultima_Actualizacion'] !== undefined) ? map['Ultima_Actualizacion'] : 23;
    sheet.getRange(rowNum, colUltimaActIdx + 1).setValue(nowStr);

    SpreadsheetApp.flush();
    return {
      ok: true,
      success: true,
      idSolicitud: idTarget,
      idComentario: msg.id || idComentario,
      mensajeActualizado: msg,
      comentarios: hist
    };
  } finally {
    lock.releaseLock();
  }
}

function eliminarComentarioBitacoraBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = String(payload.idSolicitud || payload.id || '').trim();
    if (!idTarget) return { ok: false, error: 'ID de expediente no especificado.' };

    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const colHistorialIdx = (map['Historial_Comentarios_JSON'] !== undefined) ? map['Historial_Comentarios_JSON'] : 21;
    const cellHistorial = sheet.getRange(rowNum, colHistorialIdx + 1);
    const hist = parseJSONSafe_(cellHistorial.getValue(), []);
    if (!Array.isArray(hist) || hist.length === 0) {
      return { ok: false, error: 'El expediente no posee comentarios registrados.' };
    }

    const idComentario = String(payload.idComentario || payload.idMsg || '').trim();
    const reqTimestamp = payload.timestamp ? Number(payload.timestamp) : 0;

    let msgIndex = -1;
    if (idComentario) {
      msgIndex = hist.findIndex(m => m && (String(m.id || '').trim() === idComentario));
    }
    if (msgIndex === -1 && reqTimestamp) {
      msgIndex = hist.findIndex(m => m && (Number(m.timestamp || 0) === reqTimestamp));
    }
    if (msgIndex === -1 && payload.textoAnterior) {
      msgIndex = hist.findIndex(m => m && (m.texto === payload.textoAnterior || m.contenido === payload.textoAnterior));
    }

    if (msgIndex === -1) {
      return { ok: false, error: 'No se encontró el mensaje a eliminar en la bitácora.' };
    }

    const msg = hist[msgIndex];

    if (msg.tipo === 'AUDITORIA_INICIAL' || msg.tipo === 'AUDITORIA_IA_DOCUMENTAL' || (msg.autor && String(msg.autor).includes('[Auditoría IA]'))) {
      return { ok: false, error: 'Los dictámenes oficiales de auditoría documental no se pueden eliminar.' };
    }

    const nowTime = new Date().getTime();
    let msgTime = Number(msg.timestamp || 0);
    if (!msgTime && msg.fecha) {
      msgTime = parsearFechaATimestampBackend_(msg.fecha);
    }
    if (msgTime && (nowTime - msgTime > 300000)) {
      return { ok: false, error: 'La ventana de 5 minutos para eliminar este mensaje ha expirado.' };
    }

    const nowStr = obtenerFechaHora24Argentina_();
    msg.eliminado = true;
    msg.texto = '🚫 Este mensaje fue eliminado';
    msg.contenido = '🚫 Este mensaje fue eliminado';
    msg.fechaEliminacion = nowStr;

    cellHistorial.setValue(JSON.stringify(hist));

    const colUltimaActIdx = (map['Ultima_Actualizacion'] !== undefined) ? map['Ultima_Actualizacion'] : 23;
    sheet.getRange(rowNum, colUltimaActIdx + 1).setValue(nowStr);

    SpreadsheetApp.flush();
    return {
      ok: true,
      success: true,
      idSolicitud: idTarget,
      idComentario: msg.id || idComentario,
      mensajeActualizado: msg,
      comentarios: hist
    };
  } finally {
    lock.releaseLock();
  }
}

function parsearFechaATimestampBackend_(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str).trim();
  if (/^\d{12,14}$/.test(s)) return parseInt(s, 10);
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[^\d]*(\d{1,2}):(\d{1,2})/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), parseInt(m[4], 10), parseInt(m[5], 10)).getTime();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function guardarAuditoriaEnHistorialBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idInput = String(payload.idSolicitud || payload.id || payload.ID_Solicitud || '').trim();
    let rowNum = (idInput && idInput !== 'DOCUMENTOS_SUELTOS') ? encontrarFilaPorId_(sheet, map, idInput) : -1;

    if (rowNum === -1) {
      const dniCandidato = String(
        payload.dniAsociado ||
        (payload.resumenAuditoria && payload.resumenAuditoria.dni) ||
        ''
      ).replace(/\D/g, '');
      if (dniCandidato && map['DNI_Asociado'] !== undefined) {
        const values = sheet.getDataRange().getValues();
        const colDni = map['DNI_Asociado'];
        for (let r = values.length - 1; r >= 1; r--) {
          const dniFila = String(values[r][colDni] || '').replace(/\D/g, '');
          if (dniFila && dniFila === dniCandidato) {
            rowNum = r + 1;
            break;
          }
        }
      }
    }

    if (rowNum === -1) {
      return {
        ok: false,
        error: 'Expediente no encontrado en Solicitudes_Ayudas para registrar el dictamen de auditoría: ' + (idInput || 'sin ID')
      };
    }

    const idResuelto = map['ID_Solicitud'] !== undefined
      ? String(sheet.getRange(rowNum, map['ID_Solicitud'] + 1).getValue() || idInput).trim()
      : idInput;

    const nowStr = obtenerFechaHora24Argentina_();
    const operador = String(
      payload.usuarioOperador ||
      payload.autor ||
      (payload.usuarioActivo && payload.usuarioActivo.nombre) ||
      'Analista Mutual'
    ).trim() || 'Analista Mutual';
    const rolOperador = String(
      payload.rol ||
      (payload.usuarioActivo && payload.usuarioActivo.rol) ||
      'Analista'
    ).trim() || 'Analista';

    const resumenObj = (payload.resumenAuditoria && typeof payload.resumenAuditoria === 'object')
      ? payload.resumenAuditoria
      : parseJSONSafe_(payload.resumenAuditoria, null);

    const textoFormateado = String(
      payload.textoFormateado ||
      payload.texto ||
      '[INFORME DE AUDITORÍA DOCUMENTAL IA REGISTRADO]'
    ).trim();

    // Columna 21 (0-based index 21 -> 'Historial_Comentarios_JSON')
    const colHistorialIdx = (map['Historial_Comentarios_JSON'] !== undefined) ? map['Historial_Comentarios_JSON'] : 21;
    const cellHistorial = sheet.getRange(rowNum, colHistorialIdx + 1);
    const histPrevio = parseJSONSafe_(cellHistorial.getValue(), []);
    const historial = Array.isArray(histPrevio) ? histPrevio.slice() : [];

    const nodoAuditoria = {
      tipo: 'AUDITORIA_IA_DOCUMENTAL',
      autor: operador.indexOf('[Auditoría') !== -1 ? operador : (operador + ' [Auditoría IA]'),
      usuarioOperador: operador,
      rol: rolOperador,
      fecha: nowStr,
      texto: textoFormateado,
      resumenAuditoria: resumenObj
    };
    historial.push(nodoAuditoria);
    cellHistorial.setValue(JSON.stringify(historial));

    if (map['Dictamen_IA_JSON'] !== undefined && (resumenObj || payload.resultado)) {
      const prevDictamen = parseJSONSafe_(sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).getValue(), null);
      const resultadoCompleto = (payload.resultado && typeof payload.resultado === 'object')
        ? payload.resultado
        : ((resumenObj && resumenObj.analisisMargen)
          ? resumenObj
          : ((prevDictamen && prevDictamen.resultado) ? prevDictamen.resultado : resumenObj));
      sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).setValue(JSON.stringify({
        estado: 'completado',
        fechaFin: nowStr,
        usuarioOperador: operador,
        resumenAuditoria: resumenObj || resultadoCompleto,
        analisisMargen: (resumenObj && resumenObj.analisisMargen) || (resultadoCompleto && resultadoCompleto.analisisMargen) || null,
        ofertasPorPlazo: (resumenObj && resumenObj.ofertasPorPlazo) || (resultadoCompleto && resultadoCompleto.ofertasPorPlazo) || null,
        resultado: resultadoCompleto
      }));
    }

    // Columna Ultima_Actualizacion con estampa 24 hs ('dd/MM/yyyy, HH:mm hs')
    const colUltimaActIdx = (map['Ultima_Actualizacion'] !== undefined) ? map['Ultima_Actualizacion'] : 23;
    sheet.getRange(rowNum, colUltimaActIdx + 1).setValue(nowStr);

    SpreadsheetApp.flush();
    return {
      ok: true,
      success: true,
      idSolicitud: idResuelto,
      ultimaActualizacion: nowStr,
      nodoAuditoria: nodoAuditoria,
      totalComentarios: historial.length
    };
  } finally {
    lock.releaseLock();
  }
}

function subirAdjuntoAdicionalBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = String(payload.idSolicitud || payload.id || '').trim();
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nombreSoc = map['Apellido_Nombre'] !== undefined ? String(sheet.getRange(rowNum, map['Apellido_Nombre'] + 1).getValue()) : 'Socio';
    const dni = map['DNI_Asociado'] !== undefined ? String(sheet.getRange(rowNum, map['DNI_Asociado'] + 1).getValue()) : '';
    const expDef = resolverNumeroDefinitivoFila_(sheet, rowNum, map, payload);
    const prefijoOficial = expDef || idTarget;
    const folder = obtenerOCrearCarpetaExpediente_(prefijoOficial, nombreSoc, dni, idTarget);

    const tipoDoc = String(payload.tipo || 'OTROS DOCUMENTOS');
    const nombreNormalizado = normalizarNombreArchivoConPrefijo_(payload.nombre, tipoDoc, prefijoOficial, idTarget);
    const operadorActivo = String(
      payload.usuarioOperador ||
      payload.cargadoPor ||
      (payload.usuarioActivo && payload.usuarioActivo.nombre) ||
      payload.autor ||
      'Operador'
    ).trim() || 'Operador';

    const guardados = guardarArchivosEnDrive_(folder, [{
      tipo: tipoDoc,
      nombre: nombreNormalizado,
      tipoMime: payload.tipoMime || 'application/pdf',
      base64: payload.base64 || '',
      cargadoPor: operadorActivo,
      usuarioOperador: operadorActivo,
      autor: operadorActivo
    }], prefijoOficial, operadorActivo);

    if (map['Carpeta_Drive_URL'] !== undefined) {
      sheet.getRange(rowNum, map['Carpeta_Drive_URL'] + 1).setValue(folder.getUrl());
    }

    const colArchivosIdx = (map['Archivos_Adjuntos_JSON'] !== undefined) ? map['Archivos_Adjuntos_JSON'] : 20;
    const cell = sheet.getRange(rowNum, colArchivosIdx + 1);
    const actuales = parseJSONSafe_(cell.getValue(), []);
    const listaActualizada = Array.isArray(actuales) ? actuales.slice() : [];
    if (guardados.length > 0) {
      const repIdx = (payload.reemplazaIndice !== undefined && payload.reemplazaIndice !== null && payload.reemplazaIndice !== '')
        ? Number(payload.reemplazaIndice)
        : -1;
      if (!isNaN(repIdx) && repIdx >= 0 && repIdx < listaActualizada.length) {
        listaActualizada[repIdx] = guardados[0];
      } else {
        listaActualizada.push(guardados[0]);
      }
      cell.setValue(JSON.stringify(listaActualizada));
    }

    const nowStr = obtenerFechaHora24Argentina_();
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      id: idTarget,
      id_definitivo: expDef,
      prefijoOficial: prefijoOficial,
      archivos: listaActualizada,
      archivoSubido: guardados[0] || null,
      cargadoPor: operadorActivo,
      carpetaDriveUrl: folder.getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}

function eliminarDocumentoBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = String(payload.idSolicitud || payload.id || payload.ID_Solicitud || '').trim();
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    // Columna 20 (0-based) = Columna 21 (1-based) 'Archivos_Adjuntos_JSON'
    const colArchivosIdx = (map['Archivos_Adjuntos_JSON'] !== undefined) ? map['Archivos_Adjuntos_JSON'] : 20;
    const cellArchivos = sheet.getRange(rowNum, colArchivosIdx + 1);
    const actuales = parseJSONSafe_(cellArchivos.getValue(), []);
    const lista = Array.isArray(actuales) ? actuales.slice() : [];

    const reqFileId = String(payload.fileId || '').trim();
    const reqUrlDrive = String(payload.urlDrive || '').trim();
    const reqNombre = String(payload.nombre || '').trim().toUpperCase();
    const reqTipo = String(payload.tipo || '').trim().toUpperCase();
    const reqIdx = (payload.adjuntoIndex !== undefined && payload.adjuntoIndex !== null && payload.adjuntoIndex !== '')
      ? Number(payload.adjuntoIndex)
      : -1;

    let matchIdx = -1;
    if (reqFileId) {
      matchIdx = lista.findIndex(a => a && String(a.fileId || '').trim() === reqFileId);
    }
    if (matchIdx === -1 && reqUrlDrive) {
      matchIdx = lista.findIndex(a => a && String(a.urlDrive || '').trim() === reqUrlDrive);
    }
    if (matchIdx === -1 && !isNaN(reqIdx) && reqIdx >= 0 && reqIdx < lista.length) {
      matchIdx = reqIdx;
    }
    if (matchIdx === -1 && reqNombre) {
      matchIdx = lista.findIndex(a => a && String(a.nombre || '').trim().toUpperCase() === reqNombre);
    }
    if (matchIdx === -1 && reqTipo) {
      matchIdx = lista.findIndex(a => a && String(a.tipo || '').trim().toUpperCase() === reqTipo);
    }

    let docEliminado = null;
    if (matchIdx !== -1) {
      docEliminado = lista[matchIdx];
      lista.splice(matchIdx, 1);
      cellArchivos.setValue(JSON.stringify(lista));
    }

    // Enviar archivo físico en Google Drive a la papelera mediante setTrashed(true)
    const rawUrlParaId = (docEliminado && (docEliminado.urlDrive || docEliminado.previewUrl)) || reqUrlDrive || '';
    const matchDriveId = String(rawUrlParaId).match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
    const driveFileId = (docEliminado && docEliminado.fileId) || reqFileId || (matchDriveId ? (matchDriveId[1] || matchDriveId[2]) : '');
    let driveTrashed = false;
    if (driveFileId) {
      try {
        const driveFile = DriveApp.getFileById(driveFileId);
        if (driveFile) {
          driveFile.setTrashed(true);
          driveTrashed = true;
        }
      } catch (_) {}
    }

    const nowStr = obtenerFechaHora24Argentina_();
    if (map['Historial_Comentarios_JSON'] !== undefined) {
      const histCell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(histCell.getValue(), []);
      const nombreReg = (docEliminado && docEliminado.nombre) || payload.nombre || 'Documento';
      const tipoReg = (docEliminado && docEliminado.tipo) || payload.tipo || 'LEGAJO';
      hist.push({
        autor: payload.autor || 'Operador',
        rol: payload.rol || 'Operador',
        fecha: nowStr,
        texto: '🗑️ Documento eliminado del legajo: ' + tipoReg + ' (' + nombreReg + ')'
      });
      histCell.setValue(JSON.stringify(hist));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      id: idTarget,
      archivos: lista,
      eliminado: docEliminado,
      driveTrashed: driveTrashed
    };
  } finally {
    lock.releaseLock();
  }
}

function guardarPropuestaMutualBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nowStr = obtenerFechaHora24Argentina_();
    if (map['Historial_Ofertas_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Historial_Ofertas_JSON'] + 1).setValue(JSON.stringify({
        propuestaMutual: payload.propuesta || null,
        historialPropuestas: Array.isArray(payload.historial) ? payload.historial : []
      }));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return { ok: true, id: idTarget };
  } finally {
    lock.releaseLock();
  }
}

function asignarNumeroDefinitivoBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = String(payload.idSolicitud || payload.ID_Solicitud || payload.id || payload.id_solicitud || payload.id_provisorio || '').trim();
    if (!idTarget || idTarget === 'undefined' || idTarget === 'null') {
      return { ok: false, error: 'ID de solicitud inválido o no recibido.' };
    }
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'No se encontró la solicitud ' + idTarget + ' en la base de datos.' };

    const nroFinal = String(
      payload.ID_Definitivo_Expediente || payload.idDefinitivoExpediente ||
      payload.nroDefinitivoInput || payload.id_definitivo || payload.nroDefinitivo || payload.Nro_Definitivo || payload.ID_Definitivo || ''
    ).trim();
    if (!nroFinal) return { ok: false, error: 'Debe ingresar un número definitivo válido.' };

    const nowStr = obtenerFechaHora24Argentina_();
    const colNroDefIdx = (map['Nro_Definitivo'] !== undefined)
      ? map['Nro_Definitivo']
      : ((map['ID_Definitivo_Expediente'] !== undefined) ? map['ID_Definitivo_Expediente']
        : ((map['ID_Definitivo'] !== undefined) ? map['ID_Definitivo'] : 22)); // Columna 23 (1-based)
    sheet.getRange(rowNum, colNroDefIdx + 1).setValue(nroFinal);
    if (map['ID_Definitivo_Expediente'] !== undefined && map['ID_Definitivo_Expediente'] !== colNroDefIdx) {
      sheet.getRange(rowNum, map['ID_Definitivo_Expediente'] + 1).setValue(nroFinal);
    }

    if (map['Metadata_Extra_JSON'] !== undefined) {
      const cell = sheet.getRange(rowNum, map['Metadata_Extra_JSON'] + 1);
      const meta = parseJSONSafe_(cell.getValue(), {});
      meta.id_definitivo = nroFinal;
      cell.setValue(JSON.stringify(meta));
    }
    if (map['Historial_Comentarios_JSON'] !== undefined) {
      const histCell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(histCell.getValue(), []);
      hist.push({
        autor: (payload.usuarioActivo && payload.usuarioActivo.nombre) || 'Analista Mutual',
        rol: 'Analista Mutual',
        fecha: nowStr,
        texto: 'N° formal definitivo asignado: ' + nroFinal
      });
      histCell.setValue(JSON.stringify(hist));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    try {
      const nombreSoc = map['Apellido_Nombre'] !== undefined ? String(sheet.getRange(rowNum, map['Apellido_Nombre'] + 1).getValue()) : 'Socio';
      const dni = map['DNI_Asociado'] !== undefined ? String(sheet.getRange(rowNum, map['DNI_Asociado'] + 1).getValue()) : '';
      const folder = obtenerOCrearCarpetaExpediente_(nroFinal, nombreSoc, dni, idTarget);
      if (map['Carpeta_Drive_URL'] !== undefined) {
        sheet.getRange(rowNum, map['Carpeta_Drive_URL'] + 1).setValue(folder.getUrl());
      }
    } catch (_) {}

    SpreadsheetApp.flush();
    return {
      ok: true,
      id: idTarget,
      id_definitivo: nroFinal,
      nroDefinitivo: nroFinal,
      Nro_Definitivo: nroFinal,
      ID_Definitivo_Expediente: nroFinal,
      columna: colNroDefIdx + 1
    };
  } finally {
    lock.releaseLock();
  }
}

function actualizarDatosSolicitanteBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const sol = payload.solicitante || {};
    const nowStr = obtenerFechaHora24Argentina_();

    const prevContacto = (map['Datos_Contacto_JSON'] !== undefined)
      ? parseJSONSafe_(sheet.getRange(rowNum, map['Datos_Contacto_JSON'] + 1).getValue(), {})
      : {};
    const prevLaborales = (map['Datos_Laborales_JSON'] !== undefined)
      ? parseJSONSafe_(sheet.getRange(rowNum, map['Datos_Laborales_JSON'] + 1).getValue(), {})
      : {};

    if (map['DNI_Asociado'] !== undefined && sol.dni) sheet.getRange(rowNum, map['DNI_Asociado'] + 1).setValue(sol.dni);
    if (map['Apellido_Nombre'] !== undefined && sol.nombre) sheet.getRange(rowNum, map['Apellido_Nombre'] + 1).setValue(sol.nombre);
    if (map['Legajo_Municipal'] !== undefined && sol.legajo !== undefined) sheet.getRange(rowNum, map['Legajo_Municipal'] + 1).setValue(sol.legajo);

    const nuevoContacto = {
      cuil: sol.cuil !== undefined ? sol.cuil : (prevContacto.cuil || ''),
      fechaNac: sol.fechaNac || sol.fechaNacimiento || prevContacto.fechaNac || '',
      fechaNacimiento: sol.fechaNacimiento || sol.fechaNac || prevContacto.fechaNacimiento || prevContacto.fechaNac || '',
      sexo: sol.sexo !== undefined ? sol.sexo : (prevContacto.sexo || ''),
      estadoCivil: sol.estadoCivil !== undefined ? sol.estadoCivil : (prevContacto.estadoCivil || ''),
      localidad: sol.localidad !== undefined ? sol.localidad : (prevContacto.localidad || ''),
      email: sol.email !== undefined ? sol.email : (prevContacto.email || ''),
      celular: sol.celular !== undefined ? sol.celular : (prevContacto.celular || ''),
      domicilio: sol.domicilio !== undefined ? sol.domicilio : (prevContacto.domicilio || '')
    };
    if (map['Datos_Contacto_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Datos_Contacto_JSON'] + 1).setValue(JSON.stringify(nuevoContacto));
    }

    const fechaIngresoUpd = sol.fechaIngresoLaboral || sol.Fecha_Ingreso_Laboral || sol.fechaIngreso || prevLaborales.fechaIngresoLaboral || '';
    const nuevosLaborales = {
      condicion: sol.condicion || prevLaborales.condicion || 'Activo',
      organismo: sol.organismo || prevLaborales.organismo || 'Provincial',
      dependencia: sol.dependencia !== undefined ? sol.dependencia : (prevLaborales.dependencia || ''),
      cargo: sol.cargo !== undefined ? sol.cargo : (prevLaborales.cargo || ''),
      situacionRevista: sol.situacionRevista !== undefined ? sol.situacionRevista : (prevLaborales.situacionRevista || ''),
      fechaIngresoLaboral: fechaIngresoUpd,
      Fecha_Ingreso_Laboral: fechaIngresoUpd,
      antiguedad: sol.antiguedad !== undefined ? sol.antiguedad : (prevLaborales.antiguedad || ''),
      legajo: sol.legajo !== undefined ? sol.legajo : (prevLaborales.legajo || '')
    };
    if (map['Datos_Laborales_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Datos_Laborales_JSON'] + 1).setValue(JSON.stringify(nuevosLaborales));
    }
    if (map['Fecha_Ingreso_Laboral'] !== undefined && fechaIngresoUpd) {
      sheet.getRange(rowNum, map['Fecha_Ingreso_Laboral'] + 1).setValue(fechaIngresoUpd);
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    sincronizarAsociadoEnPadron_({
      dni: sol.dni || '',
      nombre: sol.nombre || '',
      cuil: nuevoContacto.cuil,
      fechaNac: nuevoContacto.fechaNac,
      sexo: nuevoContacto.sexo,
      estadoCivil: nuevoContacto.estadoCivil,
      celular: nuevoContacto.celular,
      email: nuevoContacto.email,
      domicilio: nuevoContacto.domicilio,
      localidad: nuevoContacto.localidad,
      condicion: nuevosLaborales.condicion,
      organismo: nuevosLaborales.organismo,
      legajo: nuevosLaborales.legajo,
      dependencia: nuevosLaborales.dependencia,
      cargo: nuevosLaborales.cargo,
      situacionRevista: nuevosLaborales.situacionRevista,
      fechaIngresoLaboral: nuevosLaborales.fechaIngresoLaboral,
      antiguedad: nuevosLaborales.antiguedad
    });
    return { ok: true, id: idTarget };
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================================
   8. AUDITORÍA DOCUMENTAL IA (FORENSE EQUILIBRADA — CERO ALUCINACIÓN)
   ============================================================================ */
function persistirDictamenAuditoriaEnHoja_(idSolicitud, resultadoAudit) {
  if (!idSolicitud || !resultadoAudit) return;
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const rowNum = encontrarFilaPorId_(sheet, map, idSolicitud);
    if (rowNum !== -1 && map['Dictamen_IA_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).setValue(JSON.stringify({
        estado: 'completado',
        fechaFin: obtenerFechaHora24Argentina_(),
        analisisMargen: resultadoAudit.analisisMargen || null,
        ofertasPorPlazo: resultadoAudit.ofertasPorPlazo || null,
        resultado: resultadoAudit
      }));
      SpreadsheetApp.flush();
    }
  } catch (_) {}
}

// Padrón Oficial Normalizado (2.076 registros): [lugar_de_trabajo, codigo, nombre, clasificacion]
const PADRON_CODIGOS_AMMER = [["GE","188","RIESGO Y PELIGROSID","NO_COMPUTABLE"],["GE","17","ASIG, ESP.ART.03 DC","COMPUTABLE"],["GE","264","ADICIONAL U. PRODUCTIVIDAD VARIABLE RES 591/21","COMPUTABLE"],["GE_","661_D","#NAME?","SUBTOTAL_1"],["GE_","606","A. SOLIDARIO ART 92 LEY 9755/07","SUBTOTAL_1"],["GE_","699","REDONDEO EN MENOS (-)","SUBTOTAL_1"],["GE_","336","SUTSER","SUBTOTAL_1"],["GE_","406","R. S/COD.342","SUBTOTAL_1"],["GE_","378","Aportes SEOSPER","SUBTOTAL_1"],["GE_","332","APORTE SIND.AGMER","SUBTOTAL_1"],["GE_","650","O.S.VARIAS","SUBTOTAL_1"],["GE_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["GE_","326","SIND.ASOC.MAG.Y F.JU","SUBTOTAL_1"],["GE_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["GE_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["GE_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["GE_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["GE_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["GE_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["GE_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["GE_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["GE_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONAL LIBERTAD","SUBTOTAL_1"],["GE_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["GE_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONALSONALN","SUBTOTAL_1"],["GE_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["GE_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["GE_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["GE_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["GE_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["GE_","327","SEG.SEP.P/ADH. LAPS","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISERAER LIBERTAD","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISERGraord","SUBTOTAL_1"],["GE_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["GE_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["GE_","524","NUEVO SEG.VIDA IAPSRAL CON","SUBTOTAL_1"],["GE_","532","ADHERENTE SEC.IOSPERSAL.FLIAR HIJO","SUBTOTAL_1"],["GE_","507","CALIDAD DE VIDA","SUBTOTAL_1"],["GE_","507","APORTE PERS. IVAOS","SUBTOTAL_1"],["GE_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["GE_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["GE_","358","S.E.P.E.R.","SUBTOTAL_1"],["GE_","325","SIND.ASOC.JUD.ARGEN.","SUBTOTAL_1"],["GE_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["GE_","365","ADHERENTE I.V.A.O.S.","SUBTOTAL_1"],["GE_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["GE_","370","APORTE SIND. UEJN","SUBTOTAL_1"],["GE_","342","REAJ P/MIN.AP IOSPER","SUBTOTAL_1"],["GE_","285","PLUS D.G.R. REM. NO","NO_COMPUTABLE"],["GE_","113","BONIF. PERMANENCIA E","NO_COMPUTABLE"],["GE_","264","ADIC REM DCTO 4780","NO_COMPUTABLE"],["GE_","38","NUEVO ADIC. HS. CAT.","NO_COMPUTABLE"],["GE_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["GE_","563","ADHER. IOSPER RES.","NO_COMPUTABLE"],["GE_","202","ARANC.IAPV CERT.OBRA","NO_COMPUTABLE"],["GE_","203","COMPENS.IAPV C.ADJUD","NO_COMPUTABLE"],["GE_","282","MAYOR DEDICACION","NO_COMPUTABLE"],["GE_","186_R","S.A.C.S/CODIG.NO RE","NO_COMPUTABLE"],["GE_","219","ADIC. INFORMATICA","NO_COMPUTABLE"],["GE_","19","ADICIONAL S.C.D.","NO_COMPUTABLE"],["GE_","58","ADICIONAL DCRTO. 14","NO_COMPUTABLE"],["GE_","3","GASTOS DE REPRESENT","NO_COMPUTABLE"],["GE_","29","TRASLADO POR KM","NO_COMPUTABLE"],["GE_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["GE_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["GE_","76","DESARRAIGO","NO_COMPUTABLE"],["GE_","1014","PRENATAL","NO_COMPUTABLE"],["GE_","246","INCREM ADIC CAJA JUB","NO_COMPUTABLE"],["GE_","1024_R","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["GE_","1025_R","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["GE_","72","SUBROGANCIA VIALIDAD","NO_COMPUTABLE"],["GE_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["GE_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["GE_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["GE_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["GE_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["GE_","1025_R","AYUDA ESC.MEDIA, SUP.","NO_COMPUTABLE"],["GE_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["GE_","120","BONIF.PERM.EN OBRA","NO_COMPUTABLE"],["GE_","68","PRESENTISMO","NO_COMPUTABLE"],["GE_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["GE_","146","ADICIONAL ESP.CAJA","NO_COMPUTABLE"],["GE_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["GE_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["GE_","50_R","BONIF. POR TITULO","NO_COMPUTABLE"],["GE_","13","HORAS EXTRAS","NO_COMPUTABLE"],["GE_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["GE_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["GE_","30_R","HABERES REM","NO_COMPUTABLE"],["GE_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["GE_","264","RECON DE GASTOS XN","NO_COMPUTABLE"],["GE_","102","Suma Fija No Remunerativa - Paritaria","NO_COMPUTABLE"],["GE_","408","Reajuste sobre haberes no remunerativo","NO_COMPUTABLE"],["GE_","13_R","HORAS EXTRAS","NO_COMPUTABLE"],["GE_","312_D","IMP.A LAS GANANCIAS","NO_COMPUTABLE"],["GE_","1028","AYUDA ESC.SEC.DIF","NO_COMPUTABLE"],["GE_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["GE_","1027","AYUDA ESC.PRI.DIF","NO_COMPUTABLE"],["GE_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["GE_","1001_R","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","133","ADICIONAL REM.NO BON","NO_COMPUTABLE"],["GE_","212","ADICIONAL DECRETO 7","NO_COMPUTABLE"],["GE_","599","COMPLEMENTO PARA REDONDEO EN \"-\"","NO_COMPUTABLE"],["GE_","34_R","HABERES NO REM","NO_COMPUTABLE"],["GE_","110","ANTIGÃœEDAD COD 25","NO_COMPUTABLE"],["GE_","122","DISTRIBUCION SOBRANTE CAJA RES.1039/17 DIR.IAFAS","NO_COMPUTABLE"],["GE_","251","REDISTRIB. INASIST AD. IAFAS RES 730/21","NO_COMPUTABLE"],["GE_","1010","SALARIO POR ESPOSA","NO_COMPUTABLE"],["GE_","247","REAJUSTE COD. 248 Y 246","NO_COMPUTABLE"],["GE_","105","DEDIC.INTENSIVA","NO_COMPUTABLE"],["GE_","34","AJUSTE CÃ“D.35 REFRIGERIO","NO_COMPUTABLE"],["GE_","1003","FAMILIA NUMEROSA","NO_COMPUTABLE"],["GE_","87","MONTO FIJO NO REMUNERATIVO","NO_COMPUTABLE"],["GE_","92","FALLA DE CAJA","NO_COMPUTABLE"],["GE_","1001_A","SAL.FLIAR HIJO","AFECTADO"],["GE_","576","DIAS DE PARO NO REM","AFECTADO"],["GE_","1014_A","PRENATAL","AFECTADO"],["GE_","575","DESC. DIAS DE PARO","AFECTADO"],["GE_","317_A","AJUSTE F. VOLUNTARIO","AFECTADO"],["GE_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["GE_","412_A","AJUSTE COD 412","AFECTADO"],["GE_","1025_A","AYUDA ESC.MEDIA,SUP.","AFECTADO"],["GE_","503","DESC. DIAS NT NO RE","AFECTADO"],["GE_","68_A","PRESENTISMO","AFECTADO"],["GE_","243_A","ADIC.SERV.ADM.CONT","AFECTADO"],["GE_","118_A","PRESE DCTO 5315","AFECTADO"],["GE_","369","Descuentos Varios FEDEM","AFECTADO"],["GE_","480","DCTO N.BERSA DEC.","AFECTADO"],["GE_","480","DCTO, N.BERSA DEC","AFECTADO"],["GE_","339","CREDITO MUPER","AFECTADO"],["GE_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["GE_","368","CONSUMOS F.E.D.E RON","AFECTADO"],["GE_","480","DCTO. N.BERSA DEC.","AFECTADO"],["GE_","480","DCTO. N.BERSA DEC.NO.","AFECTADO"],["GE_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["GE_","595","DIV TESORERIA","AFECTADO"],["GE_","595","DIV. TESORERIA","AFECTADO"],["GE_","366","F.E.D.E.M.","AFECTADO"],["GE_","412","SI.DE CREER","AFECTADO"],["GE_","412","SI.DE.CREER","AFECTADO"],["GE_","412","SIDE CREER","AFECTADO"],["GE_","412","SIDE.CREER","AFECTADO"],["GE_","412","SILDE CREER","AFECTADO"],["GE_","491","PROVEEDURIA MUPER","AFECTADO"],["GE_","1023_A","AYUDA ESC.PREESCOLAR","AFECTADO"],["GE_","1100_A","PAGO UNICO AYUDA ESC","AFECTADO"],["GE_","188_A","PLUS PRODUCTIVIDAD","AFECTADO"],["GE_","68_A","PRESENTISMO","AFECTADO"],["GE_","500","DESC. DIAS NT REM.","AFECTADO"],["GE_","477","CRED.ASIST.IOSPER","AFECTADO"],["GE_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["GE_","302_A","AJUSTE CUOTA ALIM.","AFECTADO"],["GE_","316_A","AJUSTE CUOTA ALIM.","AFECTADO"],["GE_","312","IMP A LAS GANANCIAS","AFECTADO"],["GE_","370_A","APORTE SIND. UEJN","AFECTADO"],["GE_","181_A","RIESGO Y PELIGROSID","AFECTADO"],["GE_","347","DESCUENTO ORDEN JUDI","AFECTADO"],["GE_","1028_A","AYUDA ESC.SEC.DIF.","AFECTADO"],["GE_","136","Adicional OSER Bonif. 100% (134) - Ant.","COMPUTABLE"],["GE_","105_A","DEDIC.INTENSIVA","COMPUTABLE"],["GE_","1","ASIGNAC.DE LA CATEG","COMPUTABLE"],["GE_","643","O.S.P.J.B.O.N.","COMPUTABLE"],["GE_","20","ADIC DCTO 2933/22","COMPUTABLE"],["GE_","74","BONIFICADOR PAGADOR","COMPUTABLE"],["GE_","233","ADIC.ESP.SEC. DE CUL","COMPUTABLE"],["GE_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["GE_","260","DCTO 634/23 ART 56","COMPUTABLE"],["GE_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["GE_","7018","COMP. MAYOR HORARIO","COMPUTABLE"],["GE_","7192","ADICIONAL ESP. DCTO","COMPUTABLE"],["GE_","242","ADIC DCTO 4071","COMPUTABLE"],["GE_","178","ADIC.D.747/11-COPNAF","COMPUTABLE"],["GE_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["GE_","25","PTO4 AC.PAR.06-03-25","COMPUTABLE"],["GE_","18","ADICIONAL REM.","COMPUTABLE"],["GE_","226","ADIC.RIESGO.PROF.S.M","COMPUTABLE"],["GE_","228","ADIC.DED.EXC.SALUD M","COMPUTABLE"],["GE_","96","JERARQUIA OPERATIVA S/RESOL. 284/15 Y 591/21.","COMPUTABLE"],["GE_","232","ADIC.ESP.CONSEJO DE","COMPUTABLE"],["GE_","59","BONIFICACION POR TITULO - C.BASICO","COMPUTABLE"],["GE_","248","BONIFICACION ESPECIAL IAFAS RES NÂ° 591/21","COMPUTABLE"],["GE_","265","ADICIONAL U. PRODUCTIVIDAD FIJA RES 591/21","COMPUTABLE"],["GE_","298","REDONDEO EN MAS ( )","COMPUTABLE"],["GE_","444","AMEIAFAS","COMPUTABLE"],["GE_","225","COMPL.REM.DTO 834/22","COMPUTABLE"],["GE_","134","ADICIONAL PROD. Y PRESENT.","COMPUTABLE"],["GE_","191","ADICIONAL DCTO. NÂº 5.248/08 - REM.","COMPUTABLE"],["GE_","128","AJUSTE  COD. 312","COMPUTABLE"],["GE_","57","ADICIONAL SVCA","COMPUTABLE"],["GE_","118","PRESE DCTO 5315","COMPUTABLE"],["GE_","8","ADICIONAL ESP. DCRT","COMPUTABLE"],["GE_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["GE_","60","ADIC.GOBERNACION","COMPUTABLE"],["GE_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["GE_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["GE_","288","ADIC.CONTR.OBRAS PUB","COMPUTABLE"],["GE_","4","HORAS CATEDRA","COMPUTABLE"],["GE_","184","F.O.P.I.D.","COMPUTABLE"],["GE_","204","COMP.PROV.CONECT.","COMPUTABLE"],["GE_","2","COMP. JERARQUICA","COMPUTABLE"],["GE_","1","ASIGNACION BASICA","COMPUTABLE"],["GE_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["GE_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["GE_","117","SUMA FIJA REM","COMPUTABLE"],["GE_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["GE_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["GE_","220","ADIC DCTO 2941/23","COMPUTABLE"],["GE_","221","ADIC NO REM 2941/23","COMPUTABLE"],["GE_","280","INCOMPATIBILIDAD NO","COMPUTABLE"],["GE_","36","ASIGNACION LEY 9775","COMPUTABLE"],["GE_","170","ADICIONAL DTO.CA","COMPUTABLE"],["GE_","185","NUEVO MIN","COMPUTABLE"],["GE_","2","CATEGORIA VIAL","COMPUTABLE"],["GE_","66","ADICIONAL MAYOR HOR","COMPUTABLE"],["GE_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["GE_","1","DELET","COMPUTABLE"],["GE_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["GE_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["GE_","54","ADICIONAL LEY 9897","COMPUTABLE"],["GE_","185","COMPL. REM. MINIMO","COMPUTABLE"],["GE_","170","ADICIONAL DTO.CIA","COMPUTABLE"],["GE_","11","PERMANENCIA CATEG.","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV S 2","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV,SEG","COMPUTABLE"],["GE_","181","PLUS MAYOR SERV. SEG","COMPUTABLE"],["GE_","130","PLUS MAYOR SERV.SEG","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["GE_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["GE_","176","RIESGO Y PELIGROSID","COMPUTABLE"],["GE_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["GE_","105","DEDIC.EXCL.C","COMPUTABLE"],["GE_","105","DEDIC.EXCL.CHOFERES","COMPUTABLE"],["GE_","50","BONIF POR TITULOA","COMPUTABLE"],["GE_","50","BONIF. POR TITULO","COMPUTABLE"],["GE_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["GE_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["GE_","41","ASIG ESP.ART.03 DC","COMPUTABLE"],["GE_","17","ASIG, ESP.ART 03 DC","COMPUTABLE"],["GE_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["GE_","41","ASIG. ESP.ART.03 DC","COMPUTABLE"],["GE_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["GE_","41","ASIG. ESPART.03 DC","COMPUTABLE"],["GE_","86","BONIF NO ASIG.DE VI","COMPUTABLE"],["GE_","50","BONIF POR TITULO","COMPUTABLE"],["GE_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["GE_","130","ADICIONAL REM,NO","COMPUTABLE"],["GE_","130","ADICIONAL REM,NO BON","COMPUTABLE"],["GE_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["GE_","17","ADICIONAL REM.NO BON","COMPUTABLE"],["GE_","176","ADICIONAL REM NO BON","COMPUTABLE"],["GE_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["GE_","130","ADICIONAL/REM,NO BO","COMPUTABLE"],["GE_","10","ANTIGUEDAD","COMPUTABLE"],["GE_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["GE_","130","ADICIONAL ESPECIAL","COMPUTABLE"],["GE_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["GE_","41","ADIC.DTO 772/04NO R","COMPUTABLE"],["GE_","41","ADIC.DTO,772/04NO R","COMPUTABLE"],["GE_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["GE_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NO RA","COMPUTABLE"],["GE_","50","ADIC.DTO.772/04NO RIABONIF. POR TITULO","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NOR","COMPUTABLE"],["GE_","130","ADIC.DTO.772/04NO R","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["GE_","201","ADICIONAL DTO 3509","COMPUTABLE"],["JU","1362","ADIC. $ 150 - IBICUY","COMPUTABLE"],["JU_","342","DESARR.AL 60%-VIALID","SUBTOTAL_1"],["JU_","913","CENTRO VET.GUER.CDIA","SUBTOTAL_1"],["JU_","717","SEGURO SEPELIO POLI","SUBTOTAL_1"],["JU_","993","S.E.O.S.P.E.R","SUBTOTAL_1"],["JU_","755","CUOTA SOC. A.T.E.","SUBTOTAL_1"],["JU_","749","CUOTA SOC.S.LUZ Y F.","SUBTOTAL_1"],["JU_","756","REAJUSTE COD. 755","SUBTOTAL_1"],["JU_","718","REAJUSTE COD. 717","SUBTOTAL_1"],["JU_","705","SUELDO BASICO-SEG.","SUBTOTAL_1"],["JU_","709","SISER LEY 11049","SUBTOTAL_1"],["JU_","336","SUTSER","SUBTOTAL_1"],["JU_","835","TITULO","SUBTOTAL_1"],["JU_","900","TITULO","SUBTOTAL_1"],["JU_","717","TITULO SEGURIDAD.","SUBTOTAL_1"],["JU_","112","TITULO SEGURIDAD. SEGURO SEPELIO POLIC","SUBTOTAL_1"],["JU_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["JU_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["JU_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["JU_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["JU_","330","SEGURO DE RETIRO IAPSER","SUBTOTAL_1"],["JU_","327","SEGURO DE SEPELIO ADH. IAPSER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA","SUBTOTAL_1"],["JU_","524","SEGURO DE VIDA IAPSER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISE","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["JU_","717","SEGURO SEPELIO POLIC","SUBTOTAL_1"],["JU_","785","SEGURO VIDA I.A.P.S.","SUBTOTAL_1"],["JU_","358","SEP.E.R.","SUBTOTAL_1"],["JU_","358","SEPER","SUBTOTAL_1"],["JU_","829","SERV MUPER.","SUBTOTAL_1"],["JU_","713","SERV. SEPELIO IAPS","SUBTOTAL_1"],["JU_","824","S.O.E.V.E.R.","SUBTOTAL_1"],["JU_","988","SALARIO FAMILIAR","SUBTOTAL_1"],["JU_","703","SUELDO BASICO","SUBTOTAL_1"],["JU_","707","SUELDO BASICO","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL.","SUBTOTAL_1"],["JU_","817","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["JU_","134","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","982","DTO. CASA IAPV","SUBTOTAL_1"],["JU_","817C","DTO.1107/05-771/12BBB","SUBTOTAL_1"],["JU_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["JU_","524","NUEVO SEGVIDA TAPS","SUBTOTAL_1"],["JU_","757","O.S.P.A. VIAL.","SUBTOTAL_1"],["JU_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["JU_","812","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","829","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","835","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","812","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","829","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","835","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","510","LEY 11049","SUBTOTAL_1"],["JU_","900","REDONDEO EN MENOS","SUBTOTAL_1"],["JU_","900","REDONDEO EN MENOS.","SUBTOTAL_1"],["JU_","358","S.E.P.E.R.","SUBTOTAL_1"],["JU_","705","CIRCULO RET. POLICIA","SUBTOTAL_1"],["JU_","185","COMPE REM MINIMO","SUBTOTAL_1"],["JU_","185","COMPL REM MINIMO","SUBTOTAL_1"],["JU_","185","COMPL REM. MINIMO","SUBTOTAL_1"],["JU_","120_A","BONIF.PERM.EN OBRA","SUBTOTAL_1"],["JU_","339","C. SOCIETARIA - MUPER -","SUBTOTAL_1"],["JU_","93","ADIC.I.A.F.A.S. ESP.","SUBTOTAL_1"],["JU_","835","ADICIONAL X FUNCION","SUBTOTAL_1"],["JU_","771","ANTIGUEDAD","SUBTOTAL_1"],["JU_","785","ANTIGUEDAD","SUBTOTAL_1"],["JU_","988","ANTIGUEDAD","SUBTOTAL_1"],["JU_","707","ANTIGUEDAD-SEGURID.","SUBTOTAL_1"],["JU_","707","APORTE 1.0.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE 1.O.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE 10 SPER","SUBTOTAL_1"],["JU_","720","AP.ADHERENTES IOSPER","SUBTOTAL_1"],["JU_","102","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["JU_","302","CUOTA ALIMENT EXTRA","SUBTOTAL_1"],["JU_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["JU_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["JU_","779","CUOTA ALIMENTARIA","SUBTOTAL_1"],["JU_","111555","CUOTA SIND ADM PER","SUBTOTAL_1"],["JU_","988","CUOTA SIND ADM.P.ER.","SUBTOTAL_1"],["JU_","988","CUOTA SIND. ADM.P.ER.","SUBTOTAL_1"],["JU_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["JU_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["JU_","355","CUOTA SINDICAL S.E.D.A.P.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC M.U.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC MUPER","SUBTOTAL_1"],["JU_","755","CUOTA SOC. A.T.E","SUBTOTAL_1"],["JU_","841","CUOTA SOC.CENTRO JUB","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","118","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","592","COOTAVIVENDA JAPV","SUBTOTAL_1"],["JU_","787","CUOTA A.G.M.E.R.","SUBTOTAL_1"],["JU_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["JU_","487","DESC ESPECIAL SOEVER","SUBTOTAL_1"],["JU_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["JU_","1115","DTO 629/13 ART 3","SUBTOTAL_1"],["JU_","829","DTO. 1327/00-771/12","SUBTOTAL_1"],["JU_","812","DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["JU_","1115","DTO. 629/13 ART. 3","SUBTOTAL_1"],["JU_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","874","ADH.IOSPER MENOR A/C","SUBTOTAL_1"],["JU_","842","SERVICIOS U.D.A","SUBTOTAL_1"],["JU_","737","JERARQUICOS SALUD","SUBTOTAL_1"],["JU_","786","REAJUSTE DE COD.785","SUBTOTAL_1"],["JU_","936","A.J.E.R.-CUOTA SIND.","SUBTOTAL_1"],["JU_","937","REAJUSTE COD. 936","SUBTOTAL_1"],["JU_","31","PAGADOR-COBR.-IOSPER","SUBTOTAL_1"],["JU_","711","SERV. SOC. BANCARIOS","SUBTOTAL_1"],["JU_","794","APORTE ASOC.BANCARIA","SUBTOTAL_1"],["JU_","712","REAJUSTE COD. 711.","SUBTOTAL_1"],["JU_","795","REAJUSTE CODIGO 794.","SUBTOTAL_1"],["JU_","754","REAJUSTE COD. 753.","SUBTOTAL_1"],["JU_","747","CUOTA SOC.CIR.OF.POL","SUBTOTAL_1"],["JU_","919","APORTE DTO. 1576/24","SUBTOTAL_1"],["JU_","715","OBRA SOC.LUZ Y FUER.","SUBTOTAL_1"],["JU_","998","SERV.CIRC.RET.POLIC.","SUBTOTAL_1"],["JU_","956","SERVIC.CIRC.RET.POL.","SUBTOTAL_1"],["JU_","947","SERV. CIRC.RET.POLIC","SUBTOTAL_1"],["JU_","861","CUOTA ALIMENTO(FIJA)","SUBTOTAL_1"],["JU_","723","APORTE O.S.P.L.A.D.","SUBTOTAL_1"],["JU_","753","CUOTA SOC. U.P.C.N.","SUBTOTAL_1"],["JU_","707","APORTE O.S.E.R.","SUBTOTAL_1"],["JU_","985","IMP. INGR.PERSONALES","SUBTOTAL_1"],["JU_","721","REAJUSTE COD. 720","SUBTOTAL_1"],["JU_","780","REAJUSTE COD. 779","SUBTOTAL_1"],["JU_","792","CUOTA A.P.S.MUN.PNA.","SUBTOTAL_1"],["JU_","1116","REAJUSTE 1115","SUBTOTAL_1"],["JU_","704","REAJUSTE COD. 703.","SUBTOTAL_1"],["JU_","710","REAJUSTE COD. 709.","SUBTOTAL_1"],["JU_","704","REAJUSTE COD. 713","SUBTOTAL_1"],["JU_","719","REAJUSTE COD.707","SUBTOTAL_1"],["JU_","510","0.15% SEGURO DE VIDA SISE","SUBTOTAL_1"],["JU_","900","AD REMUNERATIVO","SUBTOTAL_1"],["JU_","988","AD REMUNERATIVO","SUBTOTAL_1"],["JU_","84111","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","900","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","988","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["JU_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["JU_","771","/// ADICIONAL 5% SEGURID","SUBTOTAL_1"],["JU_","707","APORTE IO.S.P.E.R.","SUBTOTAL_1"],["JU_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["JU_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["JU_","502","APORTE JUBILATORIO","SUBTOTAL_1"],["JU_","707","APORTE LO.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE LOS.P.E.R","SUBTOTAL_1"],["JU_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["JU_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["JU_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["JU_","505","APORTE PERSOSPER","SUBTOTAL_1"],["JU_","332","APORTE SIND AGMER","SUBTOTAL_1"],["JU_","338","APORTE SIND MUPER","SUBTOTAL_1"],["JU_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["JU_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["JU_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["JU_","307","APORTE SIND. UPCN?","SUBTOTAL_1"],["JU_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["JU_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["JU_","338","APORTE SIND.MUPER?","SUBTOTAL_1"],["JU_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["JU_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["JU_","505","APORTES IOSPER","SUBTOTAL_1"],["JU_","758","REAJUSTE COD. 757.","SUBTOTAL_1"],["JU_","1522","RETRO POR JULIO/25","NO_COMPUTABLE"],["JU_","1525","A  CTA.RETROACTIVOS","NO_COMPUTABLE"],["JU_","555","HABER PROVISORIO","NO_COMPUTABLE"],["JU_","658","DEV.FEDERACION JUB","NO_COMPUTABLE"],["JU_","660","DEV. IOSPER","NO_COMPUTABLE"],["JU_","662","DEV.SERV SEPEL.IAPS","NO_COMPUTABLE"],["JU_","122","INCOMPATIBILIDAD PAR","NO_COMPUTABLE"],["JU_","1523","RETRO POR FEBRERO/26","NO_COMPUTABLE"],["JU_","552","SALARIO FAMILIAR","NO_COMPUTABLE"],["JU_","714","REAJUSTE COD.713","NO_COMPUTABLE"],["JU_","1526","RETRO POR MAYO/25","NO_COMPUTABLE"],["JU_","1650","SUMA NO REMUNERATIVA","NO_COMPUTABLE"],["JU_","654","DEV GCIA RECT.2024","NO_COMPUTABLE"],["JU_","1250","RETRO X JUNIO 2025","NO_COMPUTABLE"],["JU_","1501","CUOTA INTERES","NO_COMPUTABLE"],["JU_","1511","INTERES","NO_COMPUTABLE"],["JU_","1530","RETROACTIVOS","NO_COMPUTABLE"],["JU_","1604","SUMA FIJA DTO. 14/20","NO_COMPUTABLE"],["JU_","1509","INTERESES RESOL. 44/05","NO_COMPUTABLE"],["JU_","554","AYUDA ESCOLAR","NO_COMPUTABLE"],["JU_","1527","DIF. X DICIEMBRE/25","NO_COMPUTABLE"],["JU_","1528","RETx02-03-04-05y062","NO_COMPUTABLE"],["JU_","1529","RETRO A OCTUBRE/24","NO_COMPUTABLE"],["JU_","1531","RET MAYO JUNIO/25","NO_COMPUTABLE"],["JU_","544","RETROACTIVO HABERES","NO_COMPUTABLE"],["JU_","545","RETROACTIVO HABERES","NO_COMPUTABLE"],["JU_","553","RETROACTIVO SALARIO","NO_COMPUTABLE"],["JU_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["JU_","105","DEDIC INTENSANCIA","NO_COMPUTABLE"],["JU_","1255","DIF POR MARZO/24","NO_COMPUTABLE"],["JU_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["JU_","552","CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["JU_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["JU_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["JU_","219","ADIO, INFORMATICA","NO_COMPUTABLE"],["JU_","444","AMEIAFAS","NO_COMPUTABLE"],["JU_","222","ADICESPRHORATIP","NO_COMPUTABLE"],["JU_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["JU_","174","BONIF.EXCEP DTO 359","NO_COMPUTABLE"],["JU_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["JU_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["JU_","1025","AYUDA ESC.MEDIA,SUP","NO_COMPUTABLE"],["JU_","174","BONIF EXCEP. OTO","NO_COMPUTABLE"],["JU_","19_R","COME RIESGO Y PELIG","NO_COMPUTABLE"],["JU_","911","CENTRO VET.GUER.PNA.","NO_COMPUTABLE"],["JU_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","599","REDONDEO EN MAS","NO_COMPUTABLE"],["JU_","1250","RETRO X MOVIEMBRE/24","NO_COMPUTABLE"],["JU_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["JU_","188","PLOS PRODUCTIVIDAD","NO_COMPUTABLE"],["JU_","13","HORAS EXTRAS","NO_COMPUTABLE"],["JU_","30_R","HABERES REM","NO_COMPUTABLE"],["JU_","552","SALARIO FAMILIAR CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["JU_","105","DEDIC.EXCL.C","NO_COMPUTABLE"],["JU_","105","DEDIC.EXCL.CHOFERES","NO_COMPUTABLE"],["JU_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["JU_","264","RECON.DE GASTOS XN","NO_COMPUTABLE"],["JU_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["JU_","86_R","BONIF.NO ASIG.DE VI","NO_COMPUTABLE"],["JU_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["JU_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["JU_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["JU_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["JU_","222","ADIC ESP PHORATIP","NO_COMPUTABLE"],["JU_","557","COMPLE ANUAL X VACA.","NO_COMPUTABLE"],["JU_","1536","A CTA.DE RETROACTIVO","NO_COMPUTABLE"],["JU_","882","DEUDA CAJA JUB.Y PEN","AFECTADO"],["JU_","738","RETR. JERARQUICOS SA","AFECTADO"],["JU_","892","CRED.ASIST. IOSPER.","AFECTADO"],["JU_","917","CENTRO VET.G.CECIMER","AFECTADO"],["JU_","802","EMBARGOS","AFECTADO"],["JU_","477","CRED.ASIST.IOSPER","AFECTADO"],["JU_","812","SI DE CRE ER","AFECTADO"],["JU_","412","SI DE CREER","AFECTADO"],["JU_","412","SI.DE CREER","AFECTADO"],["JU_","812","SI.DE.CRE.E.R.","AFECTADO"],["JU_","412","SI.DE.CREER","AFECTADO"],["JU_","812","SIDE CRE.E.R.","AFECTADO"],["JU_","412","SIDE CREER","AFECTADO"],["JU_","812","SIDE.CRE.E.R.","AFECTADO"],["JU_","412","SIDECREER","AFECTADO"],["JU_","132__","SERV. M.U.P.E.R.","AFECTADO"],["JU_","829","SERV. M.U.P.E.R.","AFECTADO"],["JU_","829","SERV. M.U.PER","AFECTADO"],["JU_","829","SERV. M.U.PER","AFECTADO"],["JU_","1117","DTO: 629/13 ART, 3","AFECTADO"],["JU_","491","PREST. Y/O PROVEDURIA - MUPER -","AFECTADO"],["JU_","431","PROVEEDURIA MUPER","AFECTADO"],["JU_","491","PROVEEDURIA MUPER","AFECTADO"],["JU_","491","PROVEEDURIA MUPER ASON ON","AFECTADO"],["JU_","491","PROVEEDURIA MURER","AFECTADO"],["JU_","1117","REDONDEO EN MAS","AFECTADO"],["JU_","1117","RIESGO Y PELIGROSIDA","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M. P","AFECTADO"],["JU_","368","CONSUMOS FE.D.E.M","AFECTADO"],["JU_","368","CONSUMOS FE.D.E.M.","AFECTADO"],["JU_","368","CONSUMOS FED.E.M.","AFECTADO"],["JU_","368","CONSUMOS FEDEM","AFECTADO"],["JU_","960","AD.REMUNERATIVO","AFECTADO"],["JU_","812","ANTIGUEDAD","AFECTADO"],["JU_","960","ANTIGUEDAD","AFECTADO"],["JU_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["JU_","1117","CONSUMO FEDEM","AFECTADO"],["JU_","339","CREDITO MUPER","AFECTADO"],["JU_","366","CTA. SOCIETARIA FEDEM","AFECTADO"],["JU_","849","CUOTA ALBERGUE POLI","AFECTADO"],["JU_","849","CUOTA ALBERGUE POLIC","AFECTADO"],["JU_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["JU_","1117","CUOTA SOCIAL FEDEM","AFECTADO"],["JU_","480","DCTO. N. BERSA DEC.","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC.","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC. REON","AFECTADO"],["JU_","480","DCTON BERSA DEC.","AFECTADO"],["JU_","595","DIV TESORERIA","AFECTADO"],["JU_","595","DIV. TESORERIA","AFECTADO"],["JU_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["JU_","368","DESCTO. CONSUMO FEDEM","AFECTADO"],["JU_","136_","DEUDA SALARIO FLIAR.","AFECTADO"],["JU_","366","F.E.D.E.M.","AFECTADO"],["JU_","366","FE.D.E.M.","AFECTADO"],["JU_","366","FED.E.M.PR","AFECTADO"],["JU_","366","FEDEM","AFECTADO"],["JU_","366","FEDEM OS","AFECTADO"],["JU_","366","FEDEM R","AFECTADO"],["JU_","366","FEDEMR","AFECTADO"],["JU_","366","FEDEMROS","AFECTADO"],["JU_","1117","DTO. 629/13 ART. 3","AFECTADO"],["JU_","960","PRESTAMO NVO. BERSA","AFECTADO"],["JU_","829","SERV M.U.P.E.R.","AFECTADO"],["JU_","832","ANTICIPO CAJA JUBIL.","AFECTADO"],["JU_","877","HABER PROVISORIO PA","AFECTADO"],["JU_","878","HABER PROVISORIO PA","AFECTADO"],["JU_","594","LAVADO TUNEL","COMPUTABLE"],["JU_","128","DTO 1107/05-771/12","COMPUTABLE"],["JU_","136","DCTOS.772/04-1855/04","COMPUTABLE"],["JU_","134","ADICIONAL X FUNCION","COMPUTABLE"],["JU_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["JU_","546","PAGO SAL.FLIA.3RA.P.","COMPUTABLE"],["JU_","1292","PRODUCTIVIDAD RENTAS","COMPUTABLE"],["JU_","132","DTO. 1327/00-771/12","COMPUTABLE"],["JU_","1220","IAFAS PROD. VARIABLE","COMPUTABLE"],["JU_","112","TITULO SEGURIDAD.","COMPUTABLE"],["JU_","1368","ADIC. REGISTRO CIVIL","COMPUTABLE"],["JU_","546","","COMPUTABLE"],["JU_","1300","ADC. OCTO 6114","COMPUTABLE"],["JU_","950","AD.REMUNERATIVO","COMPUTABLE"],["JU_","1354","AD. ESP DEC.5245/08","COMPUTABLE"],["JU_","1354","AD. ESP DEC.5248/08","COMPUTABLE"],["JU_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["JU_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["JU_","344","AD.FUNCION VIALIDAD","COMPUTABLE"],["JU_","546","AD.REMUNERATIVO","COMPUTABLE"],["JU_","326","#NAME?","COMPUTABLE"],["JU_","111555","AD REMUNERATIVO ///","COMPUTABLE"],["JU_","536","AD REMUNERATIVO","COMPUTABLE"],["JU_","546","AD REMUNERATIVO","COMPUTABLE"],["JU_","1308","ADIC OCTO 613/14","COMPUTABLE"],["JU_","130","ADIC OTO 191690","COMPUTABLE"],["JU_","130","ADIC, DTO.1916.50","COMPUTABLE"],["JU_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["JU_","130","ADIC. DTO 1916/90","COMPUTABLE"],["JU_","130","ADIC. DTO.1916/90","COMPUTABLE"],["JU_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["JU_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["JU_","179","ADIC.D.747/11-","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SA","COMPUTABLE"],["JU_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["JU_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["JU_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["JU_","298","ADIC ACT RIESGO REM","COMPUTABLE"],["JU_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["JU_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["JU_","20","ADIC DCTO 2933/22","COMPUTABLE"],["JU_","130","ADIC DTO 1916/90-","COMPUTABLE"],["JU_","130","ADIC DTO 1916/90 CA","COMPUTABLE"],["JU_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["JU_","130","ADIC DTO.1916/90","COMPUTABLE"],["JU_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["JU_","170","ADICIONAL DO 1471","COMPUTABLE"],["JU_","201","ADICIONAL DTO 3509","COMPUTABLE"],["JU_","170","ADICIONAL DTO 747/11","COMPUTABLE"],["JU_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["JU_","170","ADICIONAL DTO.74711","COMPUTABLE"],["JU_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["JU_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC.S","COMPUTABLE"],["JU_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["JU_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["JU_","102","ADICIONAL ESPECS","COMPUTABLE"],["JU_","75","ADICIONAL IOSPER","COMPUTABLE"],["JU_","54","ADICIONAL LEY 9897","COMPUTABLE"],["JU_","130","ADICIONAL REM NO BON","COMPUTABLE"],["JU_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["JU_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["JU_","19","ADICIONAL S.G.D","COMPUTABLE"],["JU_","424","ART 6TO, DTO. 627/13","COMPUTABLE"],["JU_","424","ART 6TO. DTO, 627/13","COMPUTABLE"],["JU_","424","ART 6TO. DTO. 627/13","COMPUTABLE"],["JU_","1","ASIG. CAT.","COMPUTABLE"],["JU_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["JU_","5","ASIGNA DE LA CATEG","COMPUTABLE"],["JU_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["JU_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["JU_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["JU_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["JU_","1624","Ad.Ext.hs.Sec 1y2cat","COMPUTABLE"],["JU_","1342","ZONA DESFAVORABLE","COMPUTABLE"],["JU_","334","DEST.OBRA 100%-VIAL.","COMPUTABLE"],["JU_","340","DESARR.AL 40%-VIALID","COMPUTABLE"],["JU_","352","DED.FUNCIONAL EXLUSI","COMPUTABLE"],["JU_","138","COMPL. TITULO UNIVER","COMPUTABLE"],["JU_","644","TITULO - ENFERMERIA","COMPUTABLE"],["JU_","1840","BASICO - CONTADURIA","COMPUTABLE"],["JU_","1842","ANTIGUEDAD - CONTADU","COMPUTABLE"],["JU_","1844","ADIC. DTO 2933/22","COMPUTABLE"],["JU_","1360","BONIF. TITULO UNIVER","COMPUTABLE"],["JU_","1496","AD. HORAS CATEDRAS","COMPUTABLE"],["JU_","628","AD.FUNCION-ENFERMERA","COMPUTABLE"],["JU_","116","ACTIV.ORQUESTAL SEG.","COMPUTABLE"],["JU_","161","SUELDO BAS.-AUT.SUP","COMPUTABLE"],["JU_","163","ANTIG.-DEC.1053/14","COMPUTABLE"],["JU_","190","DTO. 9186 M.E.H.F.","COMPUTABLE"],["JU_","29","FALLA DE CAJA","COMPUTABLE"],["JU_","1221","IAFAS PROD. FIJA","COMPUTABLE"],["JU_","1286","TAREAS RIESGOSAS","COMPUTABLE"],["JU_","636","FUNCION-SUPERVISOR","COMPUTABLE"],["JU_","1458","ADIC. 18 HS.CATEDRA","COMPUTABLE"],["JU_","142","PLUS CUSTODIA GUBER.","COMPUTABLE"],["JU_","31","PAGADOR-COBR.-IOSPE","COMPUTABLE"],["JU_","9","RESPONS. PROFESIONA","COMPUTABLE"],["JU_","646","COMP.TITULO UNIVERSI","COMPUTABLE"],["JU_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["JU_","161","SUELDO BAS.-AUT.SUP.","COMPUTABLE"],["JU_","191","DEDICACION FULL TIME","COMPUTABLE"],["JU_","280","SUELDO BASICO-BANCO","COMPUTABLE"],["JU_","296","TIT.HAB.RECON.-BANCO","COMPUTABLE"],["JU_","492","ADIC. VOLUNTARIO BCO","COMPUTABLE"],["JU_","83","ADIC. CAJA DE JUBIL.","COMPUTABLE"],["JU_","84","COMPL. CODIGO 083","COMPUTABLE"],["JU_","626","ZONA DESF. - ENFERME","COMPUTABLE"],["JU_","422","ZONA INHOSPITA 120%","COMPUTABLE"],["JU_","87","BONIF.ASIST.MUNICIP","COMPUTABLE"],["JU_","670","PRESENTISMO I.A.P.V.","COMPUTABLE"],["JU_","672","MAYOR DEDICAC. IAPV.","COMPUTABLE"],["JU_","1420","ADICIONAL SCVA -IAPV","COMPUTABLE"],["JU_","844","SADOP","COMPUTABLE"],["JU_","1261","RETROACTIVOS","COMPUTABLE"],["JU_","410","CASA-HABIT.-DOCENTE","COMPUTABLE"],["JU_","1276","HORARIO ATIPICO","COMPUTABLE"],["JU_","620","ADIC. POR FUNCION","COMPUTABLE"],["JU_","614","BON.TAREA RIESG.ENF.","COMPUTABLE"],["JU_","370","TITULO LEGISLATURA","COMPUTABLE"],["JU_","440","SUELDO BAS.-JUSTICIA","COMPUTABLE"],["JU_","360","SUELDO BASICO-LEGISL","COMPUTABLE"],["JU_","362","ANTIGUEDAD-LEGISLAT","COMPUTABLE"],["JU_","384","AD. LEGISLATIVO","COMPUTABLE"],["JU_","362","ANTIGUEDAD-LEGISLAT.","COMPUTABLE"],["JU_","430","ADIC. ESCUELAS NINA","COMPUTABLE"],["JU_","480","HABER BAS.-AUTONOMOS","COMPUTABLE"],["JU_","49","TRABAJO INSALUBRE","COMPUTABLE"],["JU_","5","RESP.JERAQ. O FUNC.","COMPUTABLE"],["JU_","43","GUARD.ROTAT.","COMPUTABLE"],["JU_","200","SUELDO BASICO-EPEER","COMPUTABLE"],["JU_","202","B. POR FUNCION-EPEER","COMPUTABLE"],["JU_","204","BON.JERARQUICA-EPEER","COMPUTABLE"],["JU_","210","REFRIGERIO - EPEER","COMPUTABLE"],["JU_","212","PRESENTISMO - EPEER","COMPUTABLE"],["JU_","214","ANTIGUEDAD - EPEER","COMPUTABLE"],["JU_","220","BON. CHOFERES-EPEER","COMPUTABLE"],["JU_","228","MOVILIDAD - EPEER","COMPUTABLE"],["JU_","230","GAS - EPEER","COMPUTABLE"],["JU_","236","TURNO 13 % - EPEER","COMPUTABLE"],["JU_","238","TAREA PELIGR.-EPEER","COMPUTABLE"],["JU_","242","ESPECIL.ART.12-EPEER","COMPUTABLE"],["JU_","1520","INTERES CODIGO 1513","COMPUTABLE"],["JU_","706","REAJUSTE COD. 705.","COMPUTABLE"],["JU_","416","PROLONG.JORN.-DOCENT","COMPUTABLE"],["JU_","87","BONIF.ASIST.MUNICIPA","COMPUTABLE"],["JU_","608","AD.SALUD MENTAL-ENF.","COMPUTABLE"],["JU_","612","DEDIC.EXCLUS.-ENFERM","COMPUTABLE"],["JU_","548","DIF.MIN.GAR.MUN.PNA.","COMPUTABLE"],["JU_","408","BON.ZONA ESC.-DOCENT","COMPUTABLE"],["JU_","1378","GASTOS FUNCIONAMIENT","COMPUTABLE"],["JU_","1392","DEDICACION EXCLUSIVA","COMPUTABLE"],["JU_","1428","FALLA DE CAJA - PNA.","COMPUTABLE"],["JU_","1444","ORDENANZA 9014/12","COMPUTABLE"],["JU_","1352","DTO. 1101/08 - ART 4","COMPUTABLE"],["JU_","1464","ADIC. INFORMATICA","COMPUTABLE"],["JU_","482","DIF. A $ 470 - AUT.","COMPUTABLE"],["JU_","1304","PRESENTISMO","COMPUTABLE"],["JU_","1306","PROLONG. DE JORNADA","COMPUTABLE"],["JU_","57","GUARDIAS ROTAT-M.PNA","COMPUTABLE"],["JU_","69","ADIC.MAY.TAREA-M.PNA","COMPUTABLE"],["JU_","79","SALUD MENTAL","COMPUTABLE"],["JU_","81","DEDIC.EXCL.","COMPUTABLE"],["JU_","428","ART.4 - DTO. 751/11","COMPUTABLE"],["JU_","81","DEDIC.EXC.","COMPUTABLE"],["JU_","404","FUNCION DIFEREN.DOC.","COMPUTABLE"],["JU_","146","A.CHOFERES/SEGURIDAD","COMPUTABLE"],["JU_","146","A.CHOFERES/SEGURIDAD","COMPUTABLE"],["JU_","600","SUELDO BASICO-ENFERM","COMPUTABLE"],["JU_","604","ANTIGUEDAD-ENFERMERI","COMPUTABLE"],["JU_","606","PERM.CATEG.-ENFERMER","COMPUTABLE"],["JU_","618","HORARIO ATIPICO ENF.","COMPUTABLE"],["JU_","624","COMP. MAYOR HORARIO","COMPUTABLE"],["JU_","630","DTO. 5248/08-765/12","COMPUTABLE"],["JU_","642","RIESGO - ENFERMERIA","COMPUTABLE"],["JU_","1622","SUMA REM Y BONIF.","COMPUTABLE"],["JU_","1228","AD.DCION.PRESUPUESTO","COMPUTABLE"],["JU_","1618","AD. DECRETO 6/23","COMPUTABLE"],["JU_","442","ANTIGUEDAD-JUSTICIA","COMPUTABLE"],["JU_","21","DED.EXC.CHOFERES","COMPUTABLE"],["JU_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["JU_","108","TIEMPO MINIMO-SEGUR.","COMPUTABLE"],["JU_","7","TITULO","COMPUTABLE"],["JU_","100","SUELDO ANUAL COMPLE","COMPUTABLE"],["JU_","1","SUELDO BASICO","COMPUTABLE"],["JU_","100","SUELDO BASICO-SEG. CIRCULO RET. POLICIA","COMPUTABLE"],["JU_","320","SUELDO BASICO-VIAL.","COMPUTABLE"],["JU_","117","SUMA FIJA REM","COMPUTABLE"],["JU_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["JU_","NO_COMPUTBALE","PTO.4-A.PAR-18-12-24","COMPUTABLE"],["JU_","1288","BONIF. ESP. GOBERNAC","COMPUTABLE"],["JU_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["JU_","41","ADIC.DTO.772/04NO R ENTRE","COMPUTABLE"],["JU_","548","DIF.MIN.CAR.MUN.PNA.","COMPUTABLE"],["JU_","1268","PRESENTISMO M.PARANA","COMPUTABLE"],["JU_","1278","REFRIGERIO M. PARANA","COMPUTABLE"],["JU_","1386","ADIC. ORDENANZA 8817","COMPUTABLE"],["JU_","1426","ASISTENCIA-MUNIC.PNA","COMPUTABLE"],["JU_","1430","AD.CHOFERES MUNICIPA","COMPUTABLE"],["JU_","104","NO ASIG.VIV.-SEGURID","COMPUTABLE"],["JU_","17","SA ESPARTO DE","COMPUTABLE"],["JU_","709","SUELDO BASICO","COMPUTABLE"],["JU_","400","SUELDO BASICO-DOCENT","COMPUTABLE"],["JU_","100","SUELDO BASICO-SEG.","COMPUTABLE"],["JU_","402","HS.DE CATEDRA-DOCENT","COMPUTABLE"],["JU_","437","DTO. N1462/18 DOCENT","COMPUTABLE"],["JU_","41","HOC DTO 77204NORP","COMPUTABLE"],["JU_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["JU_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["JU_","178","PLUS MAYOR SERV.SEG","COMPUTABLE"],["JU_","188_A","PLUS PRODUCTIVIVIDAD","COMPUTABLE"],["JU_","3.787.82 829","PERMANENCIA CATED","COMPUTABLE"],["JU_","11","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","30","PERMANENCIA CATEG","COMPUTABLE"],["JU_","326","OITULO VIALIDAD","COMPUTABLE"],["JU_","185","NUEVO MIN","COMPUTABLE"],["JU_","728","PREST.COMP.OSPA-VIAL","COMPUTABLE"],["JU_","14","PRODUCT, DCRTO, 586","COMPUTABLE"],["JU_","434","PRODUCTIVIDAD DOCENT","COMPUTABLE"],["JU_","5","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","5","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["JU_","140","RIESGO Y PELIGROSIDA","COMPUTABLE"],["JU_","552","SALARIO FAMILIAR","COMPUTABLE"],["JU_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["JU_","9","REDONDEO EN MAS","COMPUTABLE"],["JU_","1218","RESGO AGROSIDA","COMPUTABLE"],["JU_","1216","RESGOY PELIGROSIDA","COMPUTABLE"],["JU_","76","RESOLUCION 436/08","COMPUTABLE"],["JU_","507","CALIDAD DE VIDA","COMPUTABLE"],["JU_","2","CATEGORIA VIAL","COMPUTABLE"],["JU_","322","CATEGORIA VIAL","COMPUTABLE"],["JU_","53","BONIF.POR FUNCION","COMPUTABLE"],["JU_","50","BONIF. POR TITULO","COMPUTABLE"],["JU_","50","BONIF. POR TITULO NCIAENTRE","COMPUTABLE"],["JU_","50","BONIF. PORTITULOA","COMPUTABLE"],["JU_","408","BON ZONA ESC.-DOCENT","COMPUTABLE"],["JU_","408","BON ZONA ESC-DOCENT","COMPUTABLE"],["JU_","705","CIRCULO RET. POLICI","COMPUTABLE"],["JU_","2","COMP. JERARQUICA","COMPUTABLE"],["JU_","185","COMPL. REM MINIMO","COMPUTABLE"],["JU_","185","COMPL. REM. MINIMO","COMPUTABLE"],["JU_","1584","AD. DTO. 173/21","COMPUTABLE"],["JU_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["JU_","707","APORTE IO.S.P.E.R.","COMPUTABLE"],["JU_","707","APORTE 1.0.S.P.E.R.","COMPUTABLE"],["JU_","3000","ANTIGUEDAD","COMPUTABLE"],["JU_","753","ANTIGUEDAD","COMPUTABLE"],["JU_","324","ANTIGUEDAD-VIALIDAD","COMPUTABLE"],["JU_","10","ANTIQUEDAD","COMPUTABLE"],["JU_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["JU_","10","ANTIGUEDAD INCIA","COMPUTABLE"],["JU_","10","ANTIGUEDADM","COMPUTABLE"],["JU_","406","ANTIGUEDAD-DOCENTE","COMPUTABLE"],["JU_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["JU_","118","ADICIONAL 5% SEGURI","COMPUTABLE"],["JU_","10","ANTIGUEDAD","COMPUTABLE"],["JU_","302_A","AJUSTE CUOTA ALIM","COMPUTABLE"],["JU_","886","DCTOS.772/04-1855/04","COMPUTABLE"],["JU_","108","DEDIC EXCLCHORERES","COMPUTABLE"],["JU_","771","CUOTA SOC.M.U.PER","COMPUTABLE"],["JU_","432","DTO 770/12 ART. 5","COMPUTABLE"],["JU_","12","DTO, 626/10 ART. 5","COMPUTABLE"],["JU_","432","DTO, 770/12 ART. 5","COMPUTABLE"],["JU_","437","DTO, N1462/18 DOCENT","COMPUTABLE"],["JU_","346","DEDIC. EXCLUS. DPV","COMPUTABLE"],["JU_","1248","DTO","COMPUTABLE"],["JU_","246","INCREM ADIC CAJA JUB","COMPUTABLE"],["JU_","432","DTO. 770/12 ART, 5","COMPUTABLE"],["JU_","432","DTO. 770/12 ART. 5","COMPUTABLE"],["JU_","42","DTO. 625/10 ART. 5","COMPUTABLE"],["JU_","542","DTO. 626/10 ART. 5","COMPUTABLE"],["JU_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["JU_","120","DTO. 622/10 M.E.H.F.","COMPUTABLE"],["JU_","596","SUMA REM. DTO.292/22","COMPUTABLE"],["JU_","560","SUELDO BASICO-TUNEL","COMPUTABLE"],["JU_","562","ANTIGUEDAD - TUNEL","COMPUTABLE"],["JU_","572","CAMBIO ESC.35%-TUNEL","COMPUTABLE"],["JU_","574","ADIC. ESPECIAL-TUNEL","COMPUTABLE"],["JU_","582","PRESENTISMO - TUNEL","COMPUTABLE"],["JU_","588","PREM. ANUAL ESTIMULO","COMPUTABLE"],["JU_","354","ZONA INHOSPITA","COMPUTABLE"],["JU_","1364","ADIC. $ 62,19 IBICUY","COMPUTABLE"],["JU_","1448","ZONA DESFAV. IBICUY","COMPUTABLE"],["JU_","1494","ADIC. REM. IBICUY","COMPUTABLE"],["JU_","446","INTANGIB.ANTIG.JUSTI","COMPUTABLE"],["JU_","1362","ADIC. $ 150 - IBICUY","COMPUTABLE"],["JU_","500","SUELDO BASICO-MEDICO","COMPUTABLE"],["JU_","504","PERMAN.CATEG.-MEDICO","COMPUTABLE"],["JU_","508","BON.POR FUNC.-MEDICO","COMPUTABLE"],["JU_","528","DTO. 1264/08-76412","COMPUTABLE"],["JU_","526","DTO.4223/04- 764/12","COMPUTABLE"],["JU_","1328","ART. 1 - LEY 9775/07","COMPUTABLE"],["JU_","1442","ADICIONAL NOTARIADO","COMPUTABLE"],["JU_","444","INTANGIB.BASICO JUST","COMPUTABLE"],["JU_","268","PRESENTISMO M.PARANA","COMPUTABLE"],["JU_","106","RIESGO PROF.BRIG.EXP","COMPUTABLE"],["JU_","1222","MAYO DEDICACION","COMPUTABLE"],["JU_","1282","PLUS DTO. 105/04 OSP","COMPUTABLE"],["JU_","108","TIEMPO MINIMO-SEGUR","COMPUTABLE"],["JU_","547","AD.REM.NO BONIF","COMPUTABLE"],["JU_","216","TITULO - EPEER","COMPUTABLE"],["JU_","252","BONF.ART.69 70 72 EP","COMPUTABLE"],["JU_","1616","AD. DECRETO 3198/22","COMPUTABLE"],["JU_","606","PERM.CATEG.-ENFERME","COMPUTABLE"],["JU_","1274","DEDICACION FUNCIONAL","COMPUTABLE"],["JU_","600","SUELDO BASICO-ENFER","COMPUTABLE"],["JU_","604","ANTIGUEDAD-ENFERMER","COMPUTABLE"],["JU_","614","BON.TAREA RIESG.ENF","COMPUTABLE"],["JU_","163","ANTIG.-DEC.105314/","COMPUTABLE"],["JU_","328","MAYOR JOR.HOR.-VIAL.","COMPUTABLE"],["JU_","634","FUNC.-JEFE UNIDAD","COMPUTABLE"],["JU_","93","ADIC.I.A.F.A.S. ESP","COMPUTABLE"],["JUB_","45","RESP.JERAQ. O FUNC","COMPUTABLE"],["PO_","100","SUELDO BASICO-SEG.","COMPUTABLE"],["PO_","705","SUELDO BASICO-SEG.","SUBTOTAL_1"],["PO_","336","SUTSER","SUBTOTAL_1"],["PO_","112","TITULO SEGURIDAD.","SUBTOTAL_1"],["PO_","717","TITULO SEGURIDAD.","SUBTOTAL_1"],["PO_","835","TITULO","SUBTOTAL_1"],["PO_","900","TITULO","SUBTOTAL_1"],["PO_","829","SERV. M.U.P.E.R.","SUBTOTAL_1"],["PO_","717","SEGURO SEPELIO POLIC","SUBTOTAL_1"],["PO_","785","SEGURO VIDA I.A.P.S.","SUBTOTAL_1"],["PO_","358","SEP.E.R.","SUBTOTAL_1"],["PO_","358","SEPER","SUBTOTAL_1"],["PO_","829","SERV. M.U.PER","SUBTOTAL_1"],["PO_","104","SERV. SEPELIO IAPS","SUBTOTAL_1"],["PO_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["PO_","524","SEGURO DE VIDA IAPSER","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISE","SUBTOTAL_1"],["PO_","709","SISER LEY 11049","SUBTOTAL_1"],["PO_","703","SUELDO BASICO","SUBTOTAL_1"],["PO_","707","SUELDO BASICO","SUBTOTAL_1"],["PO_","713","SUELDO BASICO","SUBTOTAL_1"],["PO_","900","REDONDEO EN MENOS","SUBTOTAL_1"],["PO_","900","REDONDEO EN MENOS.","SUBTOTAL_1"],["PO_","358","S.E.P.E.R.","SUBTOTAL_1"],["PO_","824","S.O.E.V.E.R.","SUBTOTAL_1"],["PO_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["PO_","330","SEGURO DE RETIRO IAPSER","SUBTOTAL_1"],["PO_","327","SEGURO DE SEPELIO ADH. IAPSER","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA","SUBTOTAL_1"],["PO_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["PO_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["PO_","988","SALARIO FAMILIAR","SUBTOTAL_1"],["PO_","812","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","829","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","835","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["PO_","812","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","829","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","835","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","434","PRODUCTIVIDAD DOCENT","SUBTOTAL_1"],["PO_","1292","PRODUCTIVIDAD RENTAS","SUBTOTAL_1"],["PO_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["PO_","510","LEY 11049","SUBTOTAL_1"],["PO_","104","NO ASIG.VIV.-SEGURID","SUBTOTAL_1"],["PO_","524","NUEVO SEGVIDA TAPS","SUBTOTAL_1"],["PO_","757","O.S.P.A. VIAL.","SUBTOTAL_1"],["PO_","134","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL.","SUBTOTAL_1"],["PO_","128","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["PO_","817","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["PO_","93","ADIC.I.A.F.A.S. ESP.","SUBTOTAL_1"],["PO_","118","ADICIONAL 5% SEGURI","SUBTOTAL_1"],["PO_","771","ADICIONAL 5% SEGURID","SUBTOTAL_1"],["PO_","532","ADHERENTE SEC. OSPER","SUBTOTAL_1"],["PO_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["PO_","988","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","510","0.15% SEGURO DE VIDA SISE","SUBTOTAL_1"],["PO_","1115","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","900","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","988","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","841","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","900","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","134","ADICIONAL X FUNCION","SUBTOTAL_1"],["PO_","835","ADICIONAL X FUNCION","SUBTOTAL_1"],["PO_","771","ANTIGUEDAD","SUBTOTAL_1"],["PO_","785","ANTIGUEDAD","SUBTOTAL_1"],["PO_","812","ANTIGUEDAD","SUBTOTAL_1"],["PO_","988","ANTIGUEDAD","SUBTOTAL_1"],["PO_","713","ANTIGUEDAD","SUBTOTAL_1"],["PO_","102","ADICIONAL ESPECS","SUBTOTAL_1"],["PO_","707","ANTIGUEDAD-SEGURID.","SUBTOTAL_1"],["PO_","707","APORTE 1.0.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE 1.O.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE 10 SPER","SUBTOTAL_1"],["PO_","102","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["PO_","502","APORTE JUBILATORIO","SUBTOTAL_1"],["PO_","707","APORTE LO.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE LOS.P.E.R","SUBTOTAL_1"],["PO_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["PO_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["PO_","707","APORTE IO.S.P.E.R.","SUBTOTAL_1"],["PO_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["PO_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["PO_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["PO_","338","APORTE SIND MUPER","SUBTOTAL_1"],["PO_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["PO_","505","APORTE PERSOSPER","SUBTOTAL_1"],["PO_","332","APORTE SIND AGMER","SUBTOTAL_1"],["PO_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["PO_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["PO_","505","APORTES IOSPER","SUBTOTAL_1"],["PO_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["PO_","338","APORTE SIND.MUPER?","SUBTOTAL_1"],["PO_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["PO_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["PO_","307","APORTE SIND. UPCN?","SUBTOTAL_1"],["PO_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["PO_","339","C. SOCIETARIA - MUPER -","SUBTOTAL_1"],["PO_","120","// BONIF.PERM.EN OBRA","SUBTOTAL_1"],["PO_","593","CIRCULO POLICIA","SUBTOTAL_1"],["PO_","705","CIRCULO RET. POLICIA","SUBTOTAL_1"],["PO_","185","COMPE REM MINIMO","SUBTOTAL_1"],["PO_","185","COMPL REM MINIMO","SUBTOTAL_1"],["PO_","185","COMPL REM. MINIMO","SUBTOTAL_1"],["PO_","487","DESC ESPECIAL SOEVER","SUBTOTAL_1"],["PO_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["PO_","982","DTO. CASA IAPV","SUBTOTAL_1"],["PO_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","128","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","128","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","817","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","128","DTO 1107/05-771/12","SUBTOTAL_1"],["PO_","1115","DTO 629/13 ART 3","SUBTOTAL_1"],["PO_","829","DTO. 1327/00-771/12","SUBTOTAL_1"],["PO_","120","// DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["PO_","812","DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["PO_","1115","DTO. 629/13 ART. 3","SUBTOTAL_1"],["PO_","592","COOTAVIVENDA JAPV","SUBTOTAL_1"],["PO_","787","CUOTA A.G.M.E.R.","SUBTOTAL_1"],["PO_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["PO_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","118","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","1115","CUOTA SOCIAL FEDEM","SUBTOTAL_1"],["PO_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["PO_","779","CUOTA ALIMENTARIA","SUBTOTAL_1"],["PO_","1115","CUOTA SIND ADM PER","SUBTOTAL_1"],["PO_","988","CUOTA SIND ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND. ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["PO_","302","CUOTA ALIMENT EXTRA","SUBTOTAL_1"],["PO_","552","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["PO_","355","CUOTA SINDICAL S.E.D.A.P.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC M.U.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC MUPER","SUBTOTAL_1"],["PO_","755","CUOTA SOC. A.T.E","SUBTOTAL_1"],["PO_","841","CUOTA SOC.CENTRO JUB","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["PO_","312","IMP.A LAS GANANCIAS","SUBTOTAL_1"],["PO_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["PO_","3","SAL.FLIAR HIJO 1024 - AYUDA","NO_COMPUTABLE"],["PO_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["PO_","1014_R","PRENATAL","NO_COMPUTABLE"],["PO_","133","ADIC NO REM NO BONIF","NO_COMPUTABLE"],["PO_","1255","DIF POR MARZO/24","NO_COMPUTABLE"],["PO_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["PO_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["PO_","911","CENTRO VET.GUER.PNA.","NO_COMPUTABLE"],["PO_","19_R","COME RIESGO Y PELIG","NO_COMPUTABLE"],["PO_","174","BONIF.EXCEP DTO 359","NO_COMPUTABLE"],["PO_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["PO_","408","BON ZONA ESC-DOCENT","NO_COMPUTABLE"],["PO_","174","BONIF EXCEP. OTO","NO_COMPUTABLE"],["PO_","234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["PO_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["PO_","1025","AYUDA ESC.MEDIA,SUP","NO_COMPUTABLE"],["PO_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["PO_","2_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["PO_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["PO_","444","AMEIAFAS","NO_COMPUTABLE"],["PO_","219","ADIO, INFORMATICA","NO_COMPUTABLE"],["PO_","546","AD REMUNERATIVO","NO_COMPUTABLE"],["PO_","546","AD.REMUNERATIVO","NO_COMPUTABLE"],["PO_","546","AD.REMUNERATIVO PAGO SAL.FLIA.3RA.P.","NO_COMPUTABLE"],["PO_","222","ADIC ESP PHORATIP","NO_COMPUTABLE"],["PO_","222","ADICESPRHORATIP","NO_COMPUTABLE"],["PO_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["PO_","30_R","HABERES REM","NO_COMPUTABLE"],["PO_","13","HORAS EXTRAS","NO_COMPUTABLE"],["PO_","402","HS.DE CATEDRA-DOCENT","NO_COMPUTABLE"],["PO_","1220","IAFAS PROD. VARIABLE","NO_COMPUTABLE"],["PO_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["PO_","68","PRESENTISMO","NO_COMPUTABLE"],["PO_","546","PAGO SAL.FLIA.3RA.P.","NO_COMPUTABLE"],["PO_","188","PLOS PRODUCTIVIDAD","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1250","RETRO POR ABRIL/24","NO_COMPUTABLE"],["PO_","552","SALARIO FAMILIAR CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["PO_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["PO_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["PO_","552","SALARIO FAMILIAR","NO_COMPUTABLE"],["PO_","422","ZONA INHOSPITA 120%","NO_COMPUTABLE"],["PO_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["PO_","108","TIEMPO MINIMO-SEGUR.","NO_COMPUTABLE"],["PO_","100","SUELDO BASICO-SEG. CIRCULO RET. POLICIA","NO_COMPUTABLE"],["PO_","264","RECON.DE GASTOS XN","NO_COMPUTABLE"],["PO_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["PO_","86_R","BONIF.NO ASIG.DE VI","NO_COMPUTABLE"],["PO_","264","RECON.DE GASTOS X N","NO_COMPUTABLE"],["PO_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["PO_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["PO_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["PO_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["PO_","477","CRED.ASIST.IOSPER","AFECTADO"],["PO_","812","SI DE CRE ER","AFECTADO"],["PO_","412","SI DE CREER","AFECTADO"],["PO_","132","SERV. M.U.P.E.R.","AFECTADO"],["PO_","812","SIDE.CRE.E.R.","AFECTADO"],["PO_","412","SIDECREER","AFECTADO"],["PO_","812","SIDE CRE.E.R.","AFECTADO"],["PO_","412","SIDE CREER","AFECTADO"],["PO_","412","SI.DE.CREER","AFECTADO"],["PO_","412","SI.DE CREER","AFECTADO"],["PO_","120","SI.DE.CRE.E.R.","AFECTADO"],["PO_","812","SI.DE.CRE.E.R.","AFECTADO"],["PO_","1117","RIESGO Y PELIGROSIDA","AFECTADO"],["PO_","1117","REDONDEO EN MAS","AFECTADO"],["PO_","599","REDONDEO EN MAS","AFECTADO"],["PO_","599","REDONDEO EN MAS CONSUMO FEDEM","AFECTADO"],["PO_","491","PREST. Y/O PROVEDURIA - MUPER -","AFECTADO"],["PO_","960","PRESTAMO NVO, BERSA","AFECTADO"],["PO_","491","PROVEEDURIA MUPER ASON ON","AFECTADO"],["PO_","491","PROVEEDURIA MURER","AFECTADO"],["PO_","431","PROVEEDURIA MUPER","AFECTADO"],["PO_","491","PROVEEDURIA MUPER","AFECTADO"],["PO_","366","FE.D.E.M.","AFECTADO"],["PO_","366","FED.E.M.PR","AFECTADO"],["PO_","366","FEDEM","AFECTADO"],["PO_","366","FEDEM OS","AFECTADO"],["PO_","366","FEDEM R","AFECTADO"],["PO_","366","FEDEMR","AFECTADO"],["PO_","366","FEDEMROS","AFECTADO"],["PO_","960","AD.REMUNERATIVO","AFECTADO"],["PO_","960","AD REMUNERATIVO","AFECTADO"],["PO_","960","ANTIGUEDAD","AFECTADO"],["PO_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["PO_","132","DTO. 1327/00-771/12","AFECTADO"],["PO_","1117","DTO. 629/13 ART. 3","AFECTADO"],["PO_","1117","DTO: 629/13 ART, 3","AFECTADO"],["PO_","366","F.E.D.E.M.","AFECTADO"],["PO_","368","DESCTO. CONSUMO FEDEM","AFECTADO"],["PO_","136","DEUDA SALARIO FLIAR.","AFECTADO"],["PO_","595","DIV. TESORERIA","AFECTADO"],["PO_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["PO_","480","DCTON BERSA DEC.","AFECTADO"],["PO_","136","DCTOS.772/04-1855/0","AFECTADO"],["PO_","136","DCTOS.772/04-1855/04","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC.","AFECTADO"],["PO_","480","DCTO. N. BERSA DEC.","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC. REON","AFECTADO"],["PO_","849","CUOTA ALBERGUE POLIC","AFECTADO"],["PO_","1117","CUOTA SOCIAL FEDEM","AFECTADO"],["PO_","849","CUOTA ALBERGUE POLI","AFECTADO"],["PO_","339","CREDITO MUPER","AFECTADO"],["PO_","366","CTA. SOCIETARIA FEDEM","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["PO_","1117","CONSUMO FEDEM","AFECTADO"],["PO_","599","CONSUMO FEDEM","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M. P","AFECTADO"],["PO_","368","CONSUMOS FE.D.E.M","AFECTADO"],["PO_","368","CONSUMOS FE.D.E.M.","AFECTADO"],["PO_","368","CONSUMOS FED.E.M.","AFECTADO"],["PO_","368","CONSUMOS FEDEM","AFECTADO"],["PO_","208_A","ZONA DESFAVORABLE (","AFECTADO"],["PO_","500","DESC. DIAS NT REM.","AFECTADO"],["PO_","1025_A","AYUDA ESC.MEDIA,SUP.","AFECTADO"],["PO_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["PO_","347","DESCUENTO ORDEN JUDI","AFECTADO"],["PO_","180","MECANICO DE VUELO","COMPUTABLE"],["PO_","148","RECON.GTOS.LESIONES","COMPUTABLE"],["PO_","90","RIESGO PROF.BRIG.DE","COMPUTABLE"],["PO_","771","CUOTA SOC.M.U.PER","COMPUTABLE"],["PO_","886","DCTOS.772/04-1855/04","COMPUTABLE"],["PO_","105","DEDIC EXCLCHORERES","COMPUTABLE"],["PO_","105","DEDIC INTENSANCIA","COMPUTABLE"],["PO_","346","DEDIC. EXCLUS. DPV","COMPUTABLE"],["PO_","105","DEDIC.INTENSIVA","COMPUTABLE"],["PO_","1248","DTO","COMPUTABLE"],["PO_","437","DTO. N1462/18 DOCENT","COMPUTABLE"],["PO_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["PO_","432","DTO. 770/12 ART, 5","COMPUTABLE"],["PO_","432","DTO. 770/12 ART. 5","COMPUTABLE"],["PO_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["PO_","42","DTO. 625/10 ART. 5","COMPUTABLE"],["PO_","542","DTO. 626/10 ART. 5","COMPUTABLE"],["PO_","432","DTO 770/12 ART. 5","COMPUTABLE"],["PO_","12","DTO, 626/10 ART. 5","COMPUTABLE"],["PO_","432","DTO, 770/12 ART. 5","COMPUTABLE"],["PO_","437","DTO, N1462/18 DOCENT","COMPUTABLE"],["PO_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["PO_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["PO_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["PO_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["PO_","50","BONIF. POR TITULO","COMPUTABLE"],["PO_","424","ART 6TO, DTO. 627/13","COMPUTABLE"],["PO_","424","ART 6TO. DTO, 627/13","COMPUTABLE"],["PO_","424","ART 6TO. DTO. 627/13","COMPUTABLE"],["PO_","1","ASIG. CAT.","COMPUTABLE"],["PO_","5","ASIGNA DE LA CATEG","COMPUTABLE"],["PO_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["PO_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["PO_","50","BONIF. PORTITULOA","COMPUTABLE"],["PO_","507","CALIDAD DE VIDA","COMPUTABLE"],["PO_","50","BONIF. POR TITULO NCIAENTRE","COMPUTABLE"],["PO_","53","BONIF.POR FUNCION","COMPUTABLE"],["PO_","705","CIRCULO RET. POLICI","COMPUTABLE"],["PO_","2","CATEGORIA VIAL","COMPUTABLE"],["PO_","322","CATEGORIA VIAL","COMPUTABLE"],["PO_","2","COMP. JERARQUICA","COMPUTABLE"],["PO_","185","COMPL. REM MINIMO","COMPUTABLE"],["PO_","185","COMPL. REM. MINIMO","COMPUTABLE"],["PO_","753","ANTIGUEDAD","COMPUTABLE"],["PO_","10","ANTIGUEDADM","COMPUTABLE"],["PO_","406","ANTIGUEDAD-DOCENTE","COMPUTABLE"],["PO_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["PO_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["PO_","302_A","AJUSTE CUOTA ALIM","COMPUTABLE"],["PO_","10","ANTIGUEDAD","COMPUTABLE"],["PO_","3000","ANTIGUEDAD","COMPUTABLE"],["PO_","19","ADICIONAL S.G.D","COMPUTABLE"],["PO_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["PO_","75","ADICIONAL IOSPER","COMPUTABLE"],["PO_","54","ADICIONAL LEY 9897","COMPUTABLE"],["PO_","130","ADICIONAL REM NO BON","COMPUTABLE"],["PO_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["PO_","170","ADICIONAL DO 1471","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC.S","COMPUTABLE"],["PO_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["PO_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["PO_","707","APORTE IO.S.P.E.R.","COMPUTABLE"],["PO_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["PO_","10","ANTIGUEDAD INCIA","COMPUTABLE"],["PO_","324","ANTIGUEDAD-VIALIDAD","COMPUTABLE"],["PO_","10","ANTIQUEDAD","COMPUTABLE"],["PO_","720","AP.ADHERENTES IOSPER","COMPUTABLE"],["PO_","707","APORTE 1.0.S.P.E.R.","COMPUTABLE"],["PO_","536","AD REMUNERATIVO","COMPUTABLE"],["PO_","950","AD.REMUNERATIVO","COMPUTABLE"],["PO_","326","#NAME?","COMPUTABLE"],["PO_","344","AD.FUNCION VIALIDAD","COMPUTABLE"],["PO_","1354","AD. ESP DEC.5245/08","COMPUTABLE"],["PO_","1354","AD. ESP DEC.5248/08","COMPUTABLE"],["PO_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["PO_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["PO_","1300","ADC. OCTO 6114","COMPUTABLE"],["PO_","298","ADIC ACT RIESGO REM","COMPUTABLE"],["PO_","130","ADIC DTO.1916/90","COMPUTABLE"],["PO_","130","ADIC DTO 1916/90-","COMPUTABLE"],["PO_","130","ADIC DTO 1916/90 CA","COMPUTABLE"],["PO_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["PO_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["PO_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["PO_","20","ADIC DCTO 2933/22","COMPUTABLE"],["PO_","130","ADIC. DTO.1916/90","COMPUTABLE"],["PO_","130","ADIC. DTO 1916/90","COMPUTABLE"],["PO_","1308","ADIC OCTO 613/14","COMPUTABLE"],["PO_","130","ADIC OTO 191690","COMPUTABLE"],["PO_","130","ADIC, DTO.1916.50","COMPUTABLE"],["PO_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["PO_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["PO_","201","ADICIONAL DTO 3509","COMPUTABLE"],["PO_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["PO_","170","ADICIONAL DTO 747/11","COMPUTABLE"],["PO_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["PO_","170","ADICIONAL DTO.74711","COMPUTABLE"],["PO_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["PO_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["PO_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["PO_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["PO_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["PO_","179","ADIC.D.747/11-","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SA","COMPUTABLE"],["PO_","41","HOC DTO 77204NORP","COMPUTABLE"],["PO_","185","NUEVO MIN","COMPUTABLE"],["PO_","14","PRODUCT, DCRTO, 586","COMPUTABLE"],["PO_","728","PREST.COMP.OSPA-VIAL","COMPUTABLE"],["PO_","188_A","PLUS PRODUCTIVIVIDAD","COMPUTABLE"],["PO_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["PO_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["PO_","178","PLUS MAYOR SERV.SEG","COMPUTABLE"],["PO_","326","OITULO VIALIDAD","COMPUTABLE"],["PO_","5","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","5","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","3.787.82 829","PERMANENCIA CATED","COMPUTABLE"],["PO_","11","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","30","PERMANENCIA CATEG","COMPUTABLE"],["PO_","1218","RESGO AGROSIDA","COMPUTABLE"],["PO_","1216","RESGOY PELIGROSIDA","COMPUTABLE"],["PO_","76","RESOLUCION 436/08","COMPUTABLE"],["PO_","9","REDONDEO EN MAS","COMPUTABLE"],["PO_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["PO_","140","RIESGO Y PELIGROSIDA","COMPUTABLE"],["PO_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["PO_","17","SA ESPARTO DE","COMPUTABLE"],["PO_","552","SALARIO FAMILIAR","COMPUTABLE"],["PO_","709","SUELDO BASICO","COMPUTABLE"],["PO_","829","SERV. M.U.PER","COMPUTABLE"],["PO_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["PO_","320","SUELDO BASICO-VIAL.","COMPUTABLE"],["PO_","117","SUMA FIJA REM","COMPUTABLE"],["PO_","1","SUELDO BASICO","COMPUTABLE"],["PO_","400","SUELDO BASICO-DOCENT","COMPUTABLE"],["PO_","7","TITULO","COMPUTABLE"],["PO_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["PO_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["PO_","105","DEDIC.EXCL.C","COMPUTABLE"],["PO_","105","DEDIC.EXCL.CHOFERES","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["PO_","41","ADIC.DTO.772/04NO R ENTRE","COMPUTABLE"],["SA_","336","SUTSER","SUBTOTAL_1"],["SA_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["SA_","713","SERV. SEPELIO IAPS","SUBTOTAL_1"],["SA_","610","SEGURO DE VIDA SISE","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SA_","512","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDASISER","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDA SISERSISER","SUBTOTAL_1"],["SA_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["SA_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["SA_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["SA_","358","S.E.P.E.R.","SUBTOTAL_1"],["SA_","988","PROVEEDURIA MUPER","SUBTOTAL_1"],["SA_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["SA_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["SA_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["SA_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["SA_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC IOSPER","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.SPER","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSP","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSPEERACIO LIBERTAD","SUBTOTAL_1"],["SA_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["SA_","502","APORTE JUB. PERSON N","SUBTOTAL_1"],["SA_","502","APORTE JUB PERSONAL","SUBTOTAL_1"],["SA_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["SA_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["SA_","505","APORTE PERS IOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS JOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["SA_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["SA_","307","APORTE SIND UPCN","SUBTOTAL_1"],["SA_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["SA_","307","APORTE SIND, UPCN","SUBTOTAL_1"],["SA_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["SA_","201","APORTE SIND. UPCN","SUBTOTAL_1"],["SA_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["SA_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["SA_","505","APORTE PERS. IOSPER?","SUBTOTAL_1"],["SA_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SA_","338","APORTE SIND. MUPER","SUBTOTAL_1"],["SA_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["SA_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["SA_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["SA_","592","CUOTA VIVIENDA","SUBTOTAL_1"],["SA_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["SA_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["SA_","342","REAJ P/MIN.AP OSER","SUBTOTAL_1"],["SA_","344","APORTE SIND. CHOFER","SUBTOTAL_1"],["SA_","347","DESCUENTO ORDEN JUDI","SUBTOTAL_1"],["SA_","312_D","IMP.A LAS GANANCIAS","NO_COMPUTABLE"],["SA_","7081_R","PROLONG. DE JORNADA","NO_COMPUTABLE"],["SA_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SA_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["SA_","136","NAFTA DISCAPACITADOS","NO_COMPUTABLE"],["SA_","186","S.A.C.S/CODIG.NO RE","NO_COMPUTABLE"],["SA_","7210_R","RESP. FUNCIONAL ENF","NO_COMPUTABLE"],["SA_","7185_R","COMPLEMENTO MINIMO","NO_COMPUTABLE"],["SA_","1014_R","PRENATAL","NO_COMPUTABLE"],["SA_","7192_R","ADICIONAL ESP. DCTO","NO_COMPUTABLE"],["SA_","7234_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["SA_","185_R","COMPL. MINIMO SALUD","NO_COMPUTABLE"],["SA_","226_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","228_R","ADIC.DED.EXC.SALUD M","NO_COMPUTABLE"],["SA_","1028","AYUDA ESC.SEC.DIF","NO_COMPUTABLE"],["SA_","7001_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SA_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","7214_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","7018_R","COMP. MAYOR HORARIO","NO_COMPUTABLE"],["SA_","7234","CLARANC OTO 255/10","NO_COMPUTABLE"],["SA_","78","BONIF.UBICACION ESC..","NO_COMPUTABLE"],["SA_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["SA_","234","CARANC DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","CARANC DTO 4255/10","NO_COMPUTABLE"],["SA_","234","CARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","CARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7224","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","3434_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7130_R","ADICIONAL REM.NO BON","NO_COMPUTABLE"],["SA_","222","ADIC ESP.PHOR ATIP.","NO_COMPUTABLE"],["SA_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","222","ADIC.ESP.P/HOR ATIP.","NO_COMPUTABLE"],["SA_","92","FALLA DE CAJA","NO_COMPUTABLE"],["SA_","240","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","7214","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","7224","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","30 R","HABERES REM","NO_COMPUTABLE"],["SA_","30_R","HABERES REM","NO_COMPUTABLE"],["SA_","13","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","40","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","7013","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SA_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SA_","1001","SALFLIAR HIJO","NO_COMPUTABLE"],["SA_","1001","SAL FLIAR HIJO","NO_COMPUTABLE"],["SA_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SA_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","7100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","7100_R","SUELDO ANUAL COMPLEM","NO_COMPUTABLE"],["SA_","7010","ANTIGUEDAD M","NO_COMPUTABLE"],["SA_","64","ADIC. MEDICO INT. G","NO_COMPUTABLE"],["SA_","70","ADIC. MED. INT GDA","NO_COMPUTABLE"],["SA_","29","TRASLADO POR KM","NO_COMPUTABLE"],["SA_","219","ADIC. INFORMATICA","NO_COMPUTABLE"],["SA_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["SA_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["SA_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["SA_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SA_","7029","TRASLADO POR KM","NO_COMPUTABLE"],["SA_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SA_","7234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","RIOS C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["SA_","7208","ZONA DESFAVORABLE","NO_COMPUTABLE"],["SA_","222_A","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","1002_R","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SA_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","101_R","M.FIJO N.REM.","NO_COMPUTABLE"],["SA_","179_R","ADIC.D.747/11-SALUD","NO_COMPUTABLE"],["SA_","222_R","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","234_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SA_","5_R","ASIGNAC.DE LA CATEG","NO_COMPUTABLE"],["SA_","130_R","ADIC. DTO.1916/90","NO_COMPUTABLE"],["SA_","192_R","ADICIONAL ESP.DEC.5","NO_COMPUTABLE"],["SA_","576","DIAS DE PARO NO REM","NO_COMPUTABLE"],["SA_","125","AYUDA ESC.MEDIA, SUP.","NO_COMPUTABLE"],["SA_","491","PROVEEDURIA MUPER SONON","AFECTADO"],["SA_","353","DESCUENTO HABERES IN","AFECTADO"],["SA_","412","SI.DE.CREERDCTO. N.BERSA DEC.","AFECTADO"],["SA_","412","SIDE.CREER","AFECTADO"],["SA_","812","SI.DE.CRE.E.R.","AFECTADO"],["SA_","412","SI.DE CREER","AFECTADO"],["SA_","412","SI.DE.CREER","AFECTADO"],["SA_","412","SIDE CREER","AFECTADO"],["SA_","829","SERV. M.U.P.E.R.","AFECTADO"],["SA_","491","PROVEEDURIA MUPER ON","AFECTADO"],["SA_","491","PROVEEDURIA MUPERSONON","AFECTADO"],["SA_","491","PROVEEDURIA MUPER","AFECTADO"],["SA_","480","OCTON BERSA DEC.","AFECTADO"],["SA_","480","OCTO. N.BERSA DEC.","AFECTADO"],["SA_","480","OCTO. N.BERSA DEO.","AFECTADO"],["SA_","366","FEDEM.","AFECTADO"],["SA_","368","FEDEM.","AFECTADO"],["SA_","366","FEDEMP","AFECTADO"],["SA_","366","FEDEMPR","AFECTADO"],["SA_","366","FEDEM","AFECTADO"],["SA_","366","FE.D.E.M.","AFECTADO"],["SA_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["SA_","480","DCTO, N.BERSA DEC.","AFECTADO"],["SA_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["SA_","366","CONSUMOS FEDEM","AFECTADO"],["SA_","368","CONSUMOS FEDEM","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E. ACION","AFECTADO"],["SA_","366","F.E,D.E.M.","AFECTADO"],["SA_","366","F.E.D.E.M.","AFECTADO"],["SA_","503","DESC. DIAS NT NO RE.","AFECTADO"],["SA_","500","DESC. DIAS NT REM.","AFECTADO"],["SA_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["SA_","480","DCTO. N.BERSA DEC.","AFECTADO"],["SA_","575_A","AJUSTE DESC. PARO","AFECTADO"],["SA_","575","DESC. DIAS DE PARO","AFECTADO"],["SA_","477","CRED.ASIST.IOSPER","AFECTADO"],["SA_","1001_A","SAL.FLIAR HIJO","AFECTADO"],["SA_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["SA_","7192","ADICIONAL ESP. DCTO","COMPUTABLE"],["SA_","272","PLUS ADIC ESPECIAL","COMPUTABLE"],["SA_","17","COMP.DTO.5736/07 NO","COMPUTABLE"],["SA_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["SA_","7214","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7","TITULO","COMPUTABLE"],["SA_","185","COMPL MINIMO SALUD","COMPUTABLE"],["SA_","185","COMPL. MINIMO","COMPUTABLE"],["SA_","117","SUMA FIJA REM","COMPUTABLE"],["SA_","238","FUNCION RIESGOSA Y","COMPUTABLE"],["SA_","4","HORAS CATEDRA","COMPUTABLE"],["SA_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC R","COMPUTABLE"],["SA_","14","PRODUCT, DCRTO. 586","COMPUTABLE"],["SA_","11","PERMANENCIA CATEG","COMPUTABLE"],["SA_","5","PERMANENCIA CATEG","COMPUTABLE"],["SA_","11","PERMANENCIA CATEG.","COMPUTABLE"],["SA_","5","PERMANENCIA CATEG.","COMPUTABLE"],["SA_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","1","SUELDO BASICO","COMPUTABLE"],["SA_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["SA_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["SA_","900","REDONDEO EN MENOS.","COMPUTABLE"],["SA_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["SA_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["SA_","32","COMPL. TITULO UNIVER","COMPUTABLE"],["SA_","7032","COMPL. TITULO UNIVER","COMPUTABLE"],["SA_","1117","CONSUMO FEDEM","COMPUTABLE"],["SA_","7185","COMPLEMENTO MINIMO","COMPUTABLE"],["SA_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","7001","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","50","BONIF POR TITULO","COMPUTABLE"],["SA_","16","ASIG.ESP. ART.02 DC","COMPUTABLE"],["SA_","1","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SA_","5","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SA_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["SA_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","10","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","7001","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","333","APORTE SIND. MUPER","COMPUTABLE"],["SA_","332","APORTE SIND.AGMER","COMPUTABLE"],["SA_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","7001","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","7000","CARANC.DTO 4255/10","COMPUTABLE"],["SA_","7018","COMP MAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPE REM MINIMO","COMPUTABLE"],["SA_","7018","COMPEMAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPL MINIMO SALUD","COMPUTABLE"],["SA_","7018","COMP. MAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPL. MINIMO SALUD","COMPUTABLE"],["SA_","185","COMPL REM MINIMO","COMPUTABLE"],["SA_","185","COMPL/REM. MINIMO","COMPUTABLE"],["SA_","185","COMPL. REM. MINIMO","COMPUTABLE"],["SA_","185","COMPL. REM MINIMO","COMPUTABLE"],["SA_","226","ADIC.RIESGO.PROF.S.M","COMPUTABLE"],["SA_","7214","ADICIONAL D","COMPUTABLE"],["SA_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["SA_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["SA_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["SA_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["SA_","210","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","212","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7192","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","271","ADICIONAL DECRETO N","COMPUTABLE"],["SA_","201","ADICIONAL DTO 3509","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SA","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALA","COMPUTABLE"],["SA_","179","ADIC.D.747/11-","COMPUTABLE"],["SA_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["SA_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["SA_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["SA_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALUDRA","COMPUTABLE"],["SA_","179","ADIC.D747/11-SALUD","COMPUTABLE"],["SA_","228","ADIC.DED.EXC.SALUD M","COMPUTABLE"],["SA_","176","ADIC.DTO 747/11-CGE","COMPUTABLE"],["SA_","130","ADIC DTO.1916/90","COMPUTABLE"],["SA_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["SA_","130","ADIC DTO 191690 CIA","COMPUTABLE"],["SA_","179","ADIC D.747/11-SALUD","COMPUTABLE"],["SA_","130","ADIC DTO 1916/90","COMPUTABLE"],["SA_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["SA_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["SA_","226","ADIC RIESGO.PROF.S.M","COMPUTABLE"],["SA_","130","ADIC. DTO 1916/90","COMPUTABLE"],["SA_","1308","ADIC. DCTO 613/14","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90-","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90","COMPUTABLE"],["SA_","546","AD.REMUNERATIVO","COMPUTABLE"],["SA_","179","ADIC 0.747/11-SALUD","COMPUTABLE"],["SA_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["SA_","546","AD REMUNERATIVO","COMPUTABLE"],["SA_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["SA_","7130","ADICIONAL REM.NO BON","COMPUTABLE"],["SA_","7130","ADICIONAL RELNO BON","COMPUTABLE"],["SA_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["SA_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["SA_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["SA_","192","ADICIONAL ESP.","COMPUTABLE"],["SA_","7192","ADICIONAL ESP. DCT","COMPUTABLE"],["SA_","192","ADICIONAL ESP. DEC.5","COMPUTABLE"],["SA_","192","ADICIONAL ESP.D","COMPUTABLE"],["SA_","192","ADICIONAL ESP.DA","COMPUTABLE"],["SA_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["SA_","231","ADICIONAL SALUD","COMPUTABLE"],["SA_","192","ADICIONAL/ESP.DEC.5","COMPUTABLE"],["SA_","7192","ADICIONALESP OCTO","COMPUTABLE"],["SA_","10","ANTIGUEDAD","COMPUTABLE"],["SA_","17","ANTIGUEDAD","COMPUTABLE"],["SA_","3","ANTIGUEDAD","COMPUTABLE"],["SA_","7010","ANTIGUEDAD","COMPUTABLE"],["SA_","7226","DIC.RIESGO.PROF.S.M","COMPUTABLE"],["SA_","7210","RESP. FUNCIONAL ENF","COMPUTABLE"],["SA_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["SA_","212","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7050","BONIF. POR TITULO","COMPUTABLE"],["SA_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["SAL_","336","SUTSER","NO_COMPUTABLE"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SG","1003","FAMILIA NUMEROSA","NO_COMPUTABLE"],["SG","191","ADICIONAL DCTO. NÂº 5.248/08 - REM.","COMPUTABLE"],["SG_","406","R. S/COD.342","SUBTOTAL_1"],["SG_","120_1","DTO. 622/10 ?.?.?.F.","SUBTOTAL_1"],["SG_","306","SINDICAL ATE","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL","SUBTOTAL_1"],["SG_","312","Ret.Imp. Ganancias","SUBTOTAL_1"],["SG_","312","GANANCIPACION IMP.A LAS","SUBTOTAL_1"],["SG_","325","SIND.ASOC.JUD.ARGEN","SUBTOTAL_1"],["SG_","327","SEG.SEP.P/ADH.JAPS","SUBTOTAL_1"],["SG_","333","MUPER","SUBTOTAL_1"],["SG_","358","S.?.?.E.R.","SUBTOTAL_1"],["SG_","502",". PERSOON APORTE JUB","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONA/","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL LIBERTAD Y FUERZA","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL LIBERTADY FUERZA","SUBTOTAL_1"],["SG_","502","Descuento aporte jubilatorio personal","SUBTOTAL_1"],["SG_","","CUOTA SOCIAL A.M. MODELO","SUBTOTAL_1"],["SG_","","OSER TIT. Y GRUPO FLIAR","SUBTOTAL_1"],["SG_","563_A","AJUSTE ADHER. IOSPER","SUBTOTAL_1"],["SG_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["SG_","508","APORTE PERS. OSPLAD","SUBTOTAL_1"],["SG_","512","FONDO COMP.C.JUB.Y P","SUBTOTAL_1"],["SG_","4306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SG_","502","PERSONAL","SUBTOTAL_1"],["SG_","502","PERSONAL APORTE JUB.","SUBTOTAL_1"],["SG_","502","PREST.CAJA JUBILACIONES","SUBTOTAL_1"],["SG_","505","PERS. IOSPER","SUBTOTAL_1"],["SG_","524","NUEVO SEG. VIDA IAPS","SUBTOTAL_1"],["SG_","524","NUEVO SEG. VIDA IAPS c","SUBTOTAL_1"],["SG_","525","ADH.SEG.VIDA (524","SUBTOTAL_1"],["SG_","527","APORTE SIND. A.?.?.?","SUBTOTAL_1"],["SG_","532","Desc.aporte personal O.S.E.R.","SUBTOTAL_1"],["SG_","532","IOSPER","SUBTOTAL_1"],["SG_","532","IOSPER APORTE PERS.","SUBTOTAL_1"],["SG_","532","OSER","SUBTOTAL_1"],["SG_","592","I.A.P.V. Cuota CrEdito","SUBTOTAL_1"],["SG_","600","A. SOLIDARIO ART 92 LEY 9755/07","SUBTOTAL_1"],["SG_","627","Aporte Solidario Art. 92 Ley 9755","SUBTOTAL_1"],["SG_","709","SEG.LEY 11049 SISER EXL3011","SUBTOTAL_1"],["SG_","713","COMPENS.SEG.SEPELIO IAPSER","SUBTOTAL_1"],["SG_","717","SEGURO POR SEPELIO","SUBTOTAL_1"],["SG_","755","Aporte sindical A.T.E.","SUBTOTAL_1"],["SG_","755","APORTE SINDICAL ATE ONERACION","SUBTOTAL_1"],["SG_","755","APORTE SINDICAL ATEN","SUBTOTAL_1"],["SG_","755","APORTE SINDICALATE","SUBTOTAL_1"],["SG_","755","ATE CUOTA SOCIETARIA","SUBTOTAL_1"],["SG_","757","VIAL","SUBTOTAL_1"],["SG_","812","PERMANENCIA EN LA CATEG.","SUBTOTAL_1"],["SG_","812","Permanencia en la categoria","SUBTOTAL_1"],["SG_","1002","Hijo con Capacidad Diferente","SUBTOTAL_1"],["SG_","","SEGURO","SUBTOTAL_1"],["SG_","","SEGURO DE SEPELIO","SUBTOTAL_1"],["SG_","","SEGURO LEY 13003","SUBTOTAL_1"],["SG_","120","Suma Fija No Remunerativa - Paritaria","SUBTOTAL_1"],["SG_","","A.P.L.E.R. Ap. Sindical","SUBTOTAL_1"],["SG_","","A.SOLID","SUBTOTAL_1"],["SG_","","APORTE U.C.R.","SUBTOTAL_1"],["SG_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["SG_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["SG_","527","APORTE SIND. A.M.E.T","SUBTOTAL_1"],["SG_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["SG_","355","APORTE SIND, GEDAPP","SUBTOTAL_1"],["SG_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","506","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","805","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["SG_","332","APORTE SIND AGMER","SUBTOTAL_1"],["SG_","338","APORTE SIND MUPER","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL.","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["SG_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["SG_","502","APORTE JUB.","SUBTOTAL_1"],["SG_","502","APORTE JUB PERSONAL","SUBTOTAL_1"],["SG_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["SG_","705","CIRCULO RET. POLICI","SUBTOTAL_1"],["SG_","332","APORTE SIND.AGMER","SUBTOTAL_1"],["SG_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SG_","363","APORTE SINDICAL UDA","SUBTOTAL_1"],["SG_","627","APORTE SOLIDARIO PAR","SUBTOTAL_1"],["SG_","627","APORTE SOLIDARIO PARFEDERACION","SUBTOTAL_1"],["SG_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["SG_","592","CUOTA VIVIENDA","SUBTOTAL_1"],["SG_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["SG_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["SG_","316","CUOTA ALIVENTARIA","SUBTOTAL_1"],["SG_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["SG_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["SG_","342","REAJ P/MIN.AP IOSPER","SUBTOTAL_1"],["SG_","358","S.E.P.E.R.","SUBTOTAL_1"],["SG_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA","SUBTOTAL_1"],["SG_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["SG_","327","SEG SEP RIADH, LAPS","SUBTOTAL_1"],["SG_","327","SEG. SEP.PYADH. IAPS","SUBTOTAL_1"],["SG_","709","SISER LEY 11049","SUBTOTAL_1"],["SG_","327","SEO SEP P/ADH IAPS","SUBTOTAL_1"],["SG_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["SG_","717","SEGURO SEPELIO POLI","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SG_","610","SEGURO DE VIDA SISE","SUBTOTAL_1"],["SG_","960","PRESTAMO NVO. BERSA","SUBTOTAL_1"],["SG_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["SG_","S17","FONDO VOLUNTARID","SUBTOTAL_1"],["SG_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["SG_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["SG_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL ATE RIOS","SUBTOTAL_1"],["SG_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["SG_","612","IMP. A LAS GCIAS CGE","SUBTOTAL_1"],["SG_","519","DESC. DIAS INAS HS","SUBTOTAL_1"],["SG_","625","DTO OBRA SOCIAL","SUBTOTAL_1"],["SG_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["SG_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["SG_","1027","AYUDA ESC.PRI.DIF.","NO_COMPUTABLE"],["SG_","355_D","APORTE SIND. SEDAPP","NO_COMPUTABLE"],["SG_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SG_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SG_","204_R","COMP.PROV.CONECT.","NO_COMPUTABLE"],["SG_","25_R","PTO4 AC.PAR.06-03-25","NO_COMPUTABLE"],["SG_","110","ANTIGÃœEDAD COD 25","NO_COMPUTABLE"],["SG_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["SG_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SG_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["SG_","117_R","SUMA FIJA REM","NO_COMPUTABLE"],["SG_","117","SUMA FUA REM","NO_COMPUTABLE"],["SG_","117","SUMA FUJA REM","NO_COMPUTABLE"],["SG_","28","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","29","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","29_R","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","16","FUNCION DIFERENCIAL","NO_COMPUTABLE"],["SG_","266_R","GUARDIAS ESC AGROTE","NO_COMPUTABLE"],["SG_","38","NUEVO ADIC. HS. CAT.","NO_COMPUTABLE"],["SG_","13","HORAS EXTRAS","NO_COMPUTABLE"],["SG_","30_R","HABERES REM","NO_COMPUTABLE"],["SG_","7224","HORARIO ATIPICO","NO_COMPUTABLE"],["SG_","14","PRODUCT DCRISCA","NO_COMPUTABLE"],["SG_","14","PRODUCT DCRTO 586","NO_COMPUTABLE"],["SG_","14","PRODUCT DORTO, ses","NO_COMPUTABLE"],["SG_","14","PRODUCT OORTO se","NO_COMPUTABLE"],["SG_","14","PRODUCT, DCRTO. 586","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO, 586","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO.","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO. 5","NO_COMPUTABLE"],["SG_","188_R","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","14","PRODUCT, DCRTO, 586","NO_COMPUTABLE"],["SG_","52","PROLONG. DE JORNADA","NO_COMPUTABLE"],["SG_","2","PIONAL ESPECIAL","NO_COMPUTABLE"],["SG_","1002","SFLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1_R","ASIGNAC DE LA CATEG.","NO_COMPUTABLE"],["SG_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SG_","2","COMP. DIR. SEC.","NO_COMPUTABLE"],["SG_","176","BONIF.EXCEP. DTO 359.","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["SG_","78","BONIF. UBICACION ESC.","NO_COMPUTABLE"],["SG_","8_R","ADIC. ESP. NIV. PRIM","NO_COMPUTABLE"],["SG_","14","ADIC. EXT. HORARIA","NO_COMPUTABLE"],["SG_","28","ADIC. EXT. HORARIA","NO_COMPUTABLE"],["SG_","6_R","ADIC.ART. 2 Y 3 DCR","NO_COMPUTABLE"],["SG_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SG_","2_R","ADICIONAL ESPECIAL","NO_COMPUTABLE"],["SG_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["SG_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["SG_","244","Conectividad Art2","NO_COMPUTABLE"],["SG_","284","COMPLEMENTO FOPID","NO_COMPUTABLE"],["SG_","1014","PRENATAL","NO_COMPUTABLE"],["SG_","500_D","DESC. DIAS NT REM.","NO_COMPUTABLE"],["SG_","4078_R","BONIF.UBICACION ESC.","NO_COMPUTABLE"],["SG_","4010_R","ANTIGUEDAD","NO_COMPUTABLE"],["SG_","4008_R","MAYOR CARGA DIRECTIV","NO_COMPUTABLE"],["SG_","4188_R","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","1001_R","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","4_R","HORAS CATEDRA","NO_COMPUTABLE"],["SG_","14_R","PRODUCT. DCRTO. 586","NO_COMPUTABLE"],["SG_","18_R","ADICIONAL REM.","NO_COMPUTABLE"],["SG_","515","DIAS NO TRAB REM","NO_COMPUTABLE"],["SG_","4188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO DIFE","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO DIFER","NO_COMPUTABLE"],["SG_","1010","SALARIO POR ESPOSA","NO_COMPUTABLE"],["SG_","1001","SALARIO POR HIJOS","NO_COMPUTABLE"],["SG_","29","TRASLADO POR","NO_COMPUTABLE"],["SG_","29","TRASLADO POR KM29-","NO_COMPUTABLE"],["SG_","68","ADICIONAL POR PRESENTISMO","NO_COMPUTABLE"],["SG_","101","M.FIJO N.REM","NO_COMPUTABLE"],["SG_","101","M.FUO N.REM.","NO_COMPUTABLE"],["SG_","101","MONTO FIJO NO REMUNERATIVO","NO_COMPUTABLE"],["SG_","105","DEDIC.INTENSIVA A","NO_COMPUTABLE"],["SG_","105","DEDICACION FUNC EXC","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP. DT? 359","NO_COMPUTABLE"],["SG_","174","BONIF EXCEP DTO 359","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP, DTO 359","NO_COMPUTABLE"],["SG_","174","BONIFEXCEP DTO 359","NO_COMPUTABLE"],["SG_","188","188 PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","188PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","PRODUCTIVIDAD PLUS","NO_COMPUTABLE"],["SG_","188","PLUS ADICIONAL","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E INH.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E I??.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E IN?.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E INH","NO_COMPUTABLE"],["SG_","208","????A MUY DESF E INH.","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E .INH","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E INH","NO_COMPUTABLE"],["SG_","222","HOR.ATIP ADIC.ESP.P/","NO_COMPUTABLE"],["SG_","234","C.ARANC.DTO","NO_COMPUTABLE"],["SG_","234","C.ARANC.DTO 4255/10 X","NO_COMPUTABLE"],["SG_","240","ADIC.ESP.P/HOR.ATIP","NO_COMPUTABLE"],["SG_","264","ADIC REM DCT? 4780","NO_COMPUTABLE"],["SG_","1001","1001SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","ASAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1002","1002_R - S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1013","S.FLIAR MENOR A 1013 CARG","NO_COMPUTABLE"],["SG_","7214","ADIC.ESPP/HOR.ATIP.","NO_COMPUTABLE"],["SG_","2_R","COMP. JERARQUICA10- ANTIGUEDAD","NO_COMPUTABLE"],["SG_","7192_R","ADICIONAL ESP. DCT?","NO_COMPUTABLE"],["SG_","","REDONDEO EN MAS (+)","NO_COMPUTABLE"],["SG_","","REDONDEO EN MENOS (-)","NO_COMPUTABLE"],["SG_","","REFRIGERIO","NO_COMPUTABLE"],["SG_","247","REAJUSTE COD. 248 Y 246","NO_COMPUTABLE"],["SG_","","Reajuste Pase Contrato LocaciOn de Servicio","NO_COMPUTABLE"],["SG_","","Reajuste s/responsabilidad profesional","NO_COMPUTABLE"],["SG_","","Reajuste sobre antiguedad","NO_COMPUTABLE"],["SG_","244_R","Conectividad Art2_R","NO_COMPUTABLE"],["SG_","234_R","FOPID_R","NO_COMPUTABLE"],["SG_","39","AJUSTE CÃ“D. 10 Y 110","NO_COMPUTABLE"],["SG_","103","AJUSTE COD. 100","NO_COMPUTABLE"],["SG_","212","ADICIONAL DECRETO 7","NO_COMPUTABLE"],["SG_","92","FALLA  DE CAJA (IAFAS","NO_COMPUTABLE"],["SG_","251","REDISTRIB. INASIST AD. IAFAS RES 730/21","NO_COMPUTABLE"],["SG_","366","F.E.D.?.?.","AFECTADO"],["SG_","368","CONSUMOS F.E.D.E.?.","AFECTADO"],["SG_","368","Aporte Cuota FEDEM","AFECTADO"],["SG_","368","F.E.DE.M","AFECTADO"],["SG_","368","FEDEM Cuota Social","AFECTADO"],["SG_","317_A","AJUSTE F. VOLUNTARIO","AFECTADO"],["SG_","369","F.E.D.E.M. CONSUMOS","AFECTADO"],["SG_","369","FEDEM Ayudas EconOmicas","AFECTADO"],["SG_","412","DESCUENTO SI.DE.CRE.ER","AFECTADO"],["SG_","431","PROVEEDURIA","AFECTADO"],["SG_","431","PROVEEDURIA MUPER .CO","AFECTADO"],["SG_","431","PROVEEDURIA MUPER OF","AFECTADO"],["SG_","431","PROVEEDURIAMUPER","AFECTADO"],["SG_","491","491PROVEEDURIA MUPER","AFECTADO"],["SG_","491","MUPER PROVEEDURIA","AFECTADO"],["SG_","502","JUB. PERSONAL","AFECTADO"],["SG_","502","JUBILACION","AFECTADO"],["SG_","960","480 DCTO. N.BERSA DEC.","AFECTADO"],["SG_","960","Cuota CrEdito Nuevo BERSA","AFECTADO"],["SG_","960","DCTO. N.BERSA","AFECTADO"],["SG_","960","DCTO. N.BERSA BERSA DEC","AFECTADO"],["SG_","",".DE.CREER","AFECTADO"],["SG_","","SI.DE.CRE. E.R.","AFECTADO"],["SG_","","SI.DE.CRE.E.R.S.A.","AFECTADO"],["SG_","","SI.DE.CRE.ER S.A.","AFECTADO"],["SG_","","DIAS DE PARO NO","AFECTADO"],["SG_","412_A","AJUSTE COD 412","AFECTADO"],["SG_","576","DIAS DE PARO NO REM","AFECTADO"],["SG_","503","DESC. DIAS NT NO RE.","AFECTADO"],["SG_","517","DESC. DIAS DE PARO H","AFECTADO"],["SG_","551","DESC. HAB. LIQUIDOS","AFECTADO"],["SG_","316_A","AJUSTE CUOTA ALIM.","AFECTADO"],["SG_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["SG_","849","CUOTA ALBERGUE POLI","AFECTADO"],["SG_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["SG_","1117","CONSUMO FEDEM","AFECTADO"],["SG_","368","CONSUMOS FEDEM","AFECTADO"],["SG_","368","CONSUMOS FEDEM.","AFECTADO"],["SG_","366","F.E.D.E.M.","AFECTADO"],["SG_","280","DCTO. N.BERSA DEC.","AFECTADO"],["SG_","480","DCTO. N.BERSA DEC.","AFECTADO"],["SG_","480","DCTO.N.BERSA DEC","AFECTADO"],["SG_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["SG_","569","DES HAB MAYOR JERQ","AFECTADO"],["SG_","412","Si DE CREER","AFECTADO"],["SG_","829","SERV. M.U.P.E.R.","AFECTADO"],["SG_","412","SIDE CREER","AFECTADO"],["SG_","412","SI.DE.CREER","AFECTADO"],["SG_","412","SI.DE CREER","AFECTADO"],["SG_","812","SI.DE.CRE.E.R.","AFECTADO"],["SG_","188_A","PLUS PRODUCTIVIVIDAD","AFECTADO"],["SG_","491","PROVEEDURIA MUPER","AFECTADO"],["SG_","491","PROVELOURIA MUPER","AFECTADO"],["SG_","188_A","PLUS PRODUCTIVIDAD","AFECTADO"],["SG_","480","OCTO. N.BERSA DEQ","AFECTADO"],["SG_","480","OCTON BERSA DEC.","AFECTADO"],["SG_","366","FEDE.M.","AFECTADO"],["SG_","356","FEDEM","AFECTADO"],["SG_","366","FEDEM","AFECTADO"],["SG_","368","FEDEM.","AFECTADO"],["SG_","29_A","TRASLADO POR KM","AFECTADO"],["SG_","500","DESC. DIAS NT REM.","AFECTADO"],["SG_","5754","DESC. DIAS DE PARO","AFECTADO"],["SG_","536","DESC. DIAS INAS CARG","AFECTADO"],["SG_","352","DEUDA CARGOS ANT","AFECTADO"],["SG_","6_A","ADIC.ART. 2 Y 3 DCR","AFECTADO"],["SG_","1028_A","AYUDA ESC.SEC.DIF.","AFECTADO"],["SG_","477","CRED.ASIST.IOSPER","AFECTADO"],["SG_","1","ASIGNAC DE LA CATEG TEG","COMPUTABLE"],["SG_","1","ASIGNAC. DE LA CATEG","COMPUTABLE"],["SG_","1","ASIGNAC.DE LA CATEG. CIA","COMPUTABLE"],["SG_","1","AsignaciOn de la Categoria","COMPUTABLE"],["SG_","5","Adicional Remunerativo y Bonificable","COMPUTABLE"],["SG_","5","ADICIONAL RESP.FUM","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG PROVINCIA.","COMPUTABLE"],["SG_","7","TITULO SECUNDARIO","COMPUTABLE"],["SG_","10","ANTIGUEDAD COD","COMPUTABLE"],["SG_","10","ANTIGUEDAD COD 25","COMPUTABLE"],["SG_","10","ANTIGUEDAD FUNC.","COMPUTABLE"],["SG_","10","ASIGNAC.DE LA CATEG10- ANTIGUEDAD","COMPUTABLE"],["SG_","11","BONIF.PERM.EN","COMPUTABLE"],["SG_","11","BONIF.PERMANENCIA","COMPUTABLE"],["SG_","23","ADIC.DTO. 1855/04??","COMPUTABLE"],["SG_","50","BONIF. POR TITULO A","COMPUTABLE"],["SG_","50","BONIF. POR TITULOA","COMPUTABLE"],["SG_","50","BonificaciOn por tItulo","COMPUTABLE"],["SG_","50","BonificaciOn TItulo","COMPUTABLE"],["SG_","118","PRESE DCT? 5315","COMPUTABLE"],["SG_","118","PRESE DCTO5315","COMPUTABLE"],["SG_","130","ADICIONAL RE?.?? BON","COMPUTABLE"],["SG_","130",". 1916/90130-ADIC. DTO","COMPUTABLE"],["SG_","130","ADIC DTO.1916/90 CA","COMPUTABLE"],["SG_","130","ADIC. DTO. 1916/90 IA","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90 IA","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90 IAM.FIJO N.REM.","COMPUTABLE"],["SG_","130","ADIC.DTO. 1916/90","COMPUTABLE"],["SG_","134","Adicional prod. y present.","COMPUTABLE"],["SG_","136","Adicional OSER Bonif. 100% (14) - Ant.","COMPUTABLE"],["SG_","170","ADIC.D.747/11-COP A","COMPUTABLE"],["SG_","170","ADIC.D.747/11-COPNA A","COMPUTABLE"],["SG_","170","ADIC.D.747/11-UADA","COMPUTABLE"],["SG_","170","ADICIONAL DTO.74711/","COMPUTABLE"],["SG_","176","ADIC D.747/11-","COMPUTABLE"],["SG_","176","ADICIONAL DTO. 7459/04","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747 A","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747/","COMPUTABLE"],["SG_","176","ADICIONAL DTO.74714 A","COMPUTABLE"],["SG_","176","ADICIONAL REM.NO","COMPUTABLE"],["SG_","176","ADICIONAL REM.NOBON","COMPUTABLE"],["SG_","176","ADICIONAL REM?.?? BON","COMPUTABLE"],["SG_","178","COPNAF178-ADIC.D.747/","COMPUTABLE"],["SG_","181","181 RIESGO Y PELIGROSID","COMPUTABLE"],["SG_","185","COMPL. REM. ??????","COMPUTABLE"],["SG_","185","COMPL. REM. M?????","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DE A","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DEC.5 CONADIC.SERV.ADM.COMRACION","COMPUTABLE"],["SG_","192","ADICIONAL ESPEC","COMPUTABLE"],["SG_","192","Adicional especial decreto 5248/08","COMPUTABLE"],["SG_","192","ESP.DEC.5","COMPUTABLE"],["SG_","220","ADIC NO REM 2941/23 Y","COMPUTABLE"],["SG_","244","RESP.FUMRACION - ADICIONAL","COMPUTABLE"],["SG_","244","RESP.FUNC.","COMPUTABLE"],["SG_","244","RESPONSABILIDAD FUNCIONAL","COMPUTABLE"],["SG_","280","INCOMPATIBILIDAD","COMPUTABLE"],["SG_","1216","RIESGO Y PELIGROSID181","COMPUTABLE"],["SG_","1354","ADICIONAL DCTO. N 5.248/08 - REM.","COMPUTABLE"],["SG_","7185","COMPLEMENTO DEL BASICO","COMPUTABLE"],["SG_","7214","ADICIONAL","COMPUTABLE"],["SG_","9","ADIC. DIRECTIVOS SUP","COMPUTABLE"],["SG_","513","SOEME","COMPUTABLE"],["SG_","178","ADIC.D.747/11-COPNAF","COMPUTABLE"],["SG_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["SG_","4001","COMPNTO CARGO 749","COMPUTABLE"],["SG_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["SG_","184","F.O.P.I.D.","COMPUTABLE"],["SG_","204","COMP.PROV.CONECT.","COMPUTABLE"],["SG_","236","TALLER ANTEQUEDA","COMPUTABLE"],["SG_","117","SUMA FIJA REM","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-9","COMPUTABLE"],["SG_","5","ADIC ESC NINA","COMPUTABLE"],["SG_","4","HORAS INHERENTES","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCRANTIGUEDAD","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCRANTIGUEDAD","COMPUTABLE"],["SG_","628","O.S.P.E.","COMPUTABLE"],["SG_","56","COMPLEMENTO DIF COD","COMPUTABLE"],["SG_","125","ANTIGUEDAD ADMINIST","COMPUTABLE"],["SG_","4008","ADICIONAL MAYOR CARGA - DIRECTIVOS","COMPUTABLE"],["SG_","25AAA","PTO4 AC.PAR.06-03-25","COMPUTABLE"],["SG_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["SG_","4008","MAYOR CARGA","COMPUTABLE"],["SG_","4008","MAYOR CARGA DIRECTIV","COMPUTABLE"],["SG_","4","HORAS CATEDRA","COMPUTABLE"],["SG_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["SG_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SG_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["SG_","11","PERMANENCIA CATEG.","COMPUTABLE"],["SG_","272","RIOS PLUS ADICIONAL ESPEC","COMPUTABLE"],["SG_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["SG_","900","REDONDEO EN MENOS.","COMPUTABLE"],["SG_","552","SALARIO FAMILIAR","COMPUTABLE"],["SG_","136","DCTOS.772/04-1855/0","COMPUTABLE"],["SG_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["SG_","132","DTO. 1327/00-771/12","COMPUTABLE"],["SG_","50","BONIF. POR TITULO","COMPUTABLE"],["SG_","550","BONIF. POR TITULO","COMPUTABLE"],["SG_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["SG_","3","COMP. DIR. SEC.","COMPUTABLE"],["SG_","7018","COMPEMAYOR HORARIO","COMPUTABLE"],["SG_","7234","CLARANC OTO 255/10","COMPUTABLE"],["SG_","3","COMP DIR. SEC","COMPUTABLE"],["SG_","185","COMPL. REM, MINIMO","COMPUTABLE"],["SG_","185","COMPL. REM. MINIMO","COMPUTABLE"],["SG_","185","COMPL/REM. MINIMO","COMPUTABLE"],["SG_","130","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SG_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SG_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["SG_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["SG_","7001","ASIGNAC DE LA CATEG","COMPUTABLE"],["SG_","15","ANTIGUEDAD","COMPUTABLE"],["SG_","60","ANTIGUEDAD","COMPUTABLE"],["SG_","10","ANTIGUEDAD","COMPUTABLE"],["SG_","7192","ADICIONALESP OCTO","COMPUTABLE"],["SG_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["SG_","206","ADICIONAL RESP.FUNC","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["SG_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DECS","COMPUTABLE"],["SG_","7130","ADICIONAL RELNO BON","COMPUTABLE"],["SG_","18","ADICIONAL REM.","COMPUTABLE"],["SG_","18","ADICIONAL REM.IA","COMPUTABLE"],["SG_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["SG_","206","ADICIONAL RESP FUNC","COMPUTABLE"],["SG_","4010","ANTIGUEDAD VINCIA","COMPUTABLE"],["SG_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["SG_","118","ADICIONAL 5% SEGURI","COMPUTABLE"],["SG_","201","ADICIONAL DTO 3509","COMPUTABLE"],["SG_","192","ADICIONAL ESP DEC 5","COMPUTABLE"],["SG_","__192","__ADICIONAL ESP,DEC.5","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["SG_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["SG_","6","ADIC.ART 2 Y 3 DCR","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["SG_","8","ADIC. ESP, NIV, PRIM","COMPUTABLE"],["SG_","8","ADIC. ESP. NIV. PRIM","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-CGGER","COMPUTABLE"],["SG_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["SG_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-0","COMPUTABLE"],["SG_","546","AD.REMUNERATIVO","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90","COMPUTABLE"],["SG_","__174","__ADIC. DTO.1916/90","COMPUTABLE"],["SG_","130","ADIC. DTO 1916/90","COMPUTABLE"],["SG_","130","ADIC, DTO 1916/90","COMPUTABLE"],["SG_","130","ADIC, DTO 1946/90","COMPUTABLE"],["SG_","130","ADIC, DTO.1916/90","COMPUTABLE"],["SG_","8","ADIC, ESP NIV PRIM","COMPUTABLE"],["SG_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["SG_","130","ADIC DTO 1016/00","COMPUTABLE"],["SG_","130","ADIC DTO 1916 P","COMPUTABLE"],["VI_","105","DEDIC.INTENSIVA","NO_COMPUTABLE"]];

const PORCENTAJE_TOPE_ACTIVOS_GS_ = 0.20;
const PORCENTAJE_TOPE_PASIVOS_GS_ = 0.35;
const MULTIPLICADORES_ENDEUDAMIENTO_GS_ = { 6: 2.5, 12: 5.0, 18: 7.5, 24: 10.0, 36: 15.0, 48: 20.0 };
const PLAZOS_POR_LINEA_GS_ = {
  fedem: [6, 12, 18, 24, 36, 48],
  sidecreer: [6, 12, 18, 24, 36, 48],
  muni: [12, 24],
  quad: [12, 24]
};
const MOTOR_FINANCIERO_REF_GS_ = {
  fedem: {
    6: { tna: 0.48940000000000, tem: 0.04078333370000, gastos: 0.25000000000000, seguro: 0.00500000000000 },
    12: { tna: 0.53690000000000, tem: 0.04474173010000, gastos: 0.25000000000000, seguro: 0.00500000000000 },
    18: { tna: 0.44670000000000, tem: 0.03722500030000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    24: { tna: 0.53390000000000, tem: 0.04449166620000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    36: { tna: 0.61450000000000, tem: 0.05120833300000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    48: { tna: 0.64850000000000, tem: 0.05404166540000, gastos: 0.34000000000000, seguro: 0.00500000000000 }
  },
  sidecreer: {
    6: { tna: 0.58534514000000, tem: 0.04877876170000, gastos: 0.25000000000000, seguro: 0.0 },
    12: { tna: 0.63154362000000, tem: 0.05262863500000, gastos: 0.25000000000000, seguro: 0.0 },
    18: { tna: 0.53972734000000, tem: 0.04497727830000, gastos: 0.34000000000000, seguro: 0.0 },
    24: { tna: 0.61978356000000, tem: 0.05164863000000, gastos: 0.34000000000000, seguro: 0.0 },
    36: { tna: 0.69009744000000, tem: 0.05750812000000, gastos: 0.34000000000000, seguro: 0.0 },
    48: { tna: 0.71781259000000, tem: 0.05981771580000, gastos: 0.34000000000000, seguro: 0.0 }
  },
  municipales: {
    factorVikingo: 0.85000028330000,
    temQuad: 0.03299630130000,
    12: { coefCuota: 0.15970100000000 },
    24: { coefCuota: 0.11279800000000 }
  }
};
const LUGARES_PASIVOS_GS_ = ['JU_', 'JU', 'JUB_'];
const LUGARES_ACTIVOS_GS_ = ['GE_', 'GE', 'SG_', 'SG', 'PO_', 'SA_', 'SAL_', 'VI_'];
const CODIGOS_VACIOS_GS_ = {
  '': true, '-': true, '—': true, '–': true, '--': true, 'N/A': true, 'NA': true,
  'S/C': true, 'SC': true, 'S/COD': true, 'SIN CODIGO': true, 'SIN_CODIGO': true,
  'SIN CÓDIGO': true, 'NULL': true, 'NONE': true, 'S/N': true, '0': true
};
const ALIAS_LUGAR_TRABAJO_GS_ = {
  PO: 'PO_', POLICIA: 'PO_', SA: 'SA_', SAL: 'SAL_', SALUD: 'SA_', VI: 'VI_', VIALIDAD: 'VI_',
  JUB: 'JUB_', JUBILADO: 'JU_', JUBILADOS: 'JU_', PASIVO: 'JU_', PASIVOS: 'JU_',
  ACTIVO: 'GE_', ACTIVOS: 'GE_', DOCENTE: 'SG_', DOCENTES: 'SG_', EDUCACION: 'SG_'
};
const SIDECREER_RE_GS_ = /SIDECREER|SIDE\s*CRE(?:\s*E?\s*R)?|SI\s*DE\s*CRE(?:\s*E?\s*R)?|DE\s*CREER/;
let _CACHE_PADRON_IDX_GS_ = null;

function round2Audit_(n) {
  const val = Number(n || 0);
  if (!isFinite(val) || val === 0) return 0;
  const rounded = Math.round((Math.abs(val) + 1e-11) * 100) / 100;
  return rounded === 0 ? 0 : (val < 0 ? -rounded : rounded);
}

function normalizarClasificacion(clasif) {
  if (clasif === null || clasif === undefined) return '';
  const s = String(clasif).trim().toUpperCase().replace(/\s+/g, ' ');
  const compact = s.replace(/[\s_]+/g, '_').replace(/^_+|_+$/g, '');
  if (
    compact === 'SUBTOTAL_1' || compact === 'SUB_TOTAL' || compact === 'SUBTOTAL' ||
    compact === 'SUBTOTAL1' || compact === 'SUB_TOTAL_1' || /^SUB_?TOTAL(_?1)?$/.test(compact)
  ) {
    return 'SUBTOTAL_1';
  }
  if (
    compact === 'NO_COMPUTABLE' || compact === 'NO_COMPUTAABLE' ||
    compact === 'NO_COMPUTBALE' || compact === 'NOCOMPUTABLE' ||
    /^NO_?COMPUT[A-Z]*B[A-Z]*$/.test(compact)
  ) {
    return 'NO_COMPUTABLE';
  }
  if (
    compact === 'AFECTADO' || compact === 'AFECTABLE' || compact === 'AFECTABLES' ||
    compact === 'AFECATDO' || compact === 'AFECTADOS' || compact === 'AFECATDOS' ||
    /^AFEC[A-Z]*$/.test(compact)
  ) {
    return 'AFECTADO';
  }
  if (compact === 'COMPUTABLE' || compact === 'HABER_COMPUTABLE' || compact === 'HABERES_COMPUTABLES') {
    return 'COMPUTABLE';
  }
  return '';
}

function normalizarDescripcionPadronGs_(txt) {
  if (!txt) return '';
  return String(txt)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esCodigoVacioPadronGs_(cod) {
  if (cod === null || cod === undefined) return true;
  const s = String(cod).trim().toUpperCase();
  if (CODIGOS_VACIOS_GS_[s]) return true;
  if (/^[-_.\s/—–]+$/.test(s)) return true;
  return false;
}

function normalizarCodigoLookupGs_(cod) {
  if (esCodigoVacioPadronGs_(cod)) return '';
  const s = String(cod).trim().toUpperCase().replace(/\s+/g, '_');
  return CODIGOS_VACIOS_GS_[s] ? '' : s;
}

function quitarSufijoCodigoGs_(codUp) {
  if (!codUp) return '';
  const sinSuf = codUp.replace(/(?:_|-|\s)+(R|A|D)$/i, '').replace(/^_+|_+$/g, '');
  return sinSuf || codUp;
}

function stripZerosGs_(c) {
  return c.replace(/^0+/, '') || c;
}

function formatCurrencyAuditGs_(val) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '$0,00';
  }
  const num = Number(val);
  const sign = num < 0 ? '-' : '';
  const absFixed = Math.abs(num).toFixed(2);
  const parts = absFixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + '$' + parts[0] + ',' + parts[1];
}

function fmtArAlertGs_(val) {
  const num = Number(val || 0);
  const sign = num < 0 ? '-' : '';
  const fixed = Math.abs(num).toFixed(2);
  const parts = fixed.split('.');
  return sign + '$' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
}

function limpiarMontoNullGs_(val) {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  if (typeof val === 'number') {
    return isFinite(val) ? round2Audit_(val) : null;
  }
  let s = String(val).replace(/[^0-9.,-]/g, '').trim();
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    if ((s.match(/,/g) || []).length > 1) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return (!isNaN(n) && isFinite(n)) ? round2Audit_(n) : null;
}

function obtenerIndicePadronGs_() {
  if (_CACHE_PADRON_IDX_GS_) return _CACHE_PADRON_IDX_GS_;
  const porLugarCodigo = Object.create(null);
  const porLugarCodigoStrip = Object.create(null);
  const porNombreNorm = Object.create(null);
  const porNombreTokens = [];
  const pushMap = function(mapObj, key, item) {
    if (!mapObj[key]) mapObj[key] = [item];
    else mapObj[key].push(item);
  };

  for (let i = 0; i < PADRON_CODIGOS_AMMER.length; i++) {
    const rawReg = PADRON_CODIGOS_AMMER[i];
    const lug = String((Array.isArray(rawReg) ? rawReg[0] : rawReg.lugar_de_trabajo) || '').trim().toUpperCase();
    const cod = String((Array.isArray(rawReg) ? rawReg[1] : rawReg.codigo) || '').trim().toUpperCase();
    const nom = String((Array.isArray(rawReg) ? rawReg[2] : rawReg.nombre) || '').trim();
    const clasif = normalizarClasificacion(Array.isArray(rawReg) ? rawReg[3] : rawReg.clasificacion);
    if (!clasif) continue;
    const nn = normalizarDescripcionPadronGs_(nom);
    const rec = { lugar: lug, codigo: cod, nombre: nom, nombreNorm: nn, clasificacion: clasif };

    if (cod) {
      const variantes = [cod];
      if (cod.indexOf(' ') !== -1) {
        const u = cod.replace(/\s+/g, '_');
        const n = cod.replace(/\s+/g, '');
        if (variantes.indexOf(u) === -1) variantes.push(u);
        if (variantes.indexOf(n) === -1) variantes.push(n);
      }
      const lenInit = variantes.length;
      for (let v = 0; v < lenInit; v++) {
        const vz = stripZerosGs_(variantes[v]);
        if (variantes.indexOf(vz) === -1) variantes.push(vz);
      }
      for (let v = 0; v < variantes.length; v++) {
        pushMap(porLugarCodigo, lug + '|' + variantes[v], rec);
      }
      const codStrip = cod.replace(/^_+|_+$/g, '');
      if (codStrip) {
        const csNz = stripZerosGs_(codStrip);
        pushMap(porLugarCodigoStrip, lug + '|' + codStrip, rec);
        if (csNz !== codStrip) pushMap(porLugarCodigoStrip, lug + '|' + csNz, rec);
      }
    }
    if (nn && nn !== 'NAME' && nn.length >= 4) {
      pushMap(porNombreNorm, nn, rec);
      const toks = {};
      const parts = nn.split(' ');
      let countT = 0;
      for (let t = 0; t < parts.length; t++) {
        if (parts[t].length >= 2 && !toks[parts[t]]) {
          toks[parts[t]] = true;
          countT++;
        }
      }
      if (countT > 0) porNombreTokens.push({ toks: toks, size: countT, r: rec });
    }
  }
  _CACHE_PADRON_IDX_GS_ = {
    porLugarCodigo: porLugarCodigo,
    porLugarCodigoStrip: porLugarCodigoStrip,
    porNombreNorm: porNombreNorm,
    porNombreTokens: porNombreTokens
  };
  return _CACHE_PADRON_IDX_GS_;
}

function mostCommonClasifGs_(arr) {
  const counts = Object.create(null);
  let best = arr[0] || '';
  let bestC = -1;
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    counts[c] = (counts[c] || 0) + 1;
    if (counts[c] > bestC) {
      bestC = counts[c];
      best = c;
    }
  }
  return best;
}

function resolverSegmentoBeneficiarioGs_(meta) {
  const m = meta || {};
  const lugRaw = String(m.lugar_de_trabajo || m.lugarTrabajo || '').trim().toUpperCase();
  const lugNorm = ALIAS_LUGAR_TRABAJO_GS_[lugRaw] || lugRaw;
  const textoCtx = [
    lugRaw, lugNorm,
    String(m.tipoRecibo || ''),
    String(m.formatoRecibo || m.formato || ''),
    String(m.organismo || ''),
    String(m.situacionRevista || ''),
    String(m.condicion || ''),
    String(m.cargo || m.escalafonCargo || '')
  ].join(' ').toUpperCase();

  const sitRev = String(m.situacionRevista || '').toUpperCase();
  const orgStr = String(m.organismo || '').toUpperCase();
  const esActivoExplicito = /\bACTIVO\b/.test(sitRev) && orgStr.indexOf('CAJA DE JUB') === -1 && LUGARES_PASIVOS_GS_.indexOf(lugNorm) === -1;
  const esPasivo = LUGARES_PASIVOS_GS_.indexOf(lugNorm) !== -1 || (
    /(?:JU_|JUB_|CAJA\s+DE\s+JUB|RECIBOS?\s+JUBILAD|\bJUBILAD|\bPENSIONAD|\bPASIV)/.test(textoCtx) &&
    !esActivoExplicito
  );

  if (esPasivo) {
    const lugarPrincipal = LUGARES_PASIVOS_GS_.indexOf(lugNorm) !== -1 ? lugNorm : 'JU_';
    const pares = lugarPrincipal !== 'JUB_' ? ['JU_', 'JU', 'JUB_'] : ['JUB_', 'JU_', 'JU'];
    const orden = [];
    const candOrd = [lugarPrincipal].concat(pares, LUGARES_PASIVOS_GS_);
    for (let i = 0; i < candOrd.length; i++) {
      if (candOrd[i] && orden.indexOf(candOrd[i]) === -1) orden.push(candOrd[i]);
    }
    return {
      esPasivo: true,
      tipoBeneficiario: 'PASIVO',
      etiquetaBeneficiario: 'Pasivos / Jubilados (65% afectable · Tope 35%)',
      porcentajeTope: PORCENTAJE_TOPE_PASIVOS_GS_,
      porcentajeAfectableMaximo: 0.65,
      lugarPrincipal: lugarPrincipal,
      lugaresOrden: orden,
      lugaresFallback: LUGARES_ACTIVOS_GS_
    };
  }

  let lugarPrincipal = 'GE_';
  if (LUGARES_ACTIVOS_GS_.indexOf(lugNorm) !== -1) lugarPrincipal = lugNorm;
  else if (/POLIC|SEGURID|PENITENCIAR|\bPO_/.test(textoCtx)) lugarPrincipal = 'PO_';
  else if (/SALUD|HOSPITAL|ENFERM|MEDICO|\bSA_|SAL_/.test(textoCtx)) lugarPrincipal = 'SA_';
  else if (/EDUCAC|\bCGE\b|DOCENT|ESCUEL|UADER|\bSG_/.test(textoCtx)) lugarPrincipal = 'SG_';
  else if (/VIALIDAD|\bVI_/.test(textoCtx)) lugarPrincipal = 'VI_';

  let paresPref = [];
  if (lugarPrincipal === 'SA_' || lugarPrincipal === 'SAL_') paresPref = ['SA_', 'SAL_'];
  else if (lugarPrincipal === 'GE_' || lugarPrincipal === 'GE') paresPref = ['GE_', 'GE'];
  else if (lugarPrincipal === 'SG_' || lugarPrincipal === 'SG') paresPref = ['SG_', 'SG'];

  const orden = [];
  const candOrd = [lugarPrincipal].concat(paresPref, LUGARES_ACTIVOS_GS_);
  for (let i = 0; i < candOrd.length; i++) {
    if (candOrd[i] && orden.indexOf(candOrd[i]) === -1) orden.push(candOrd[i]);
  }
  return {
    esPasivo: false,
    tipoBeneficiario: 'ACTIVO',
    etiquetaBeneficiario: 'Activos (80% afectable · Tope 20%)',
    porcentajeTope: PORCENTAJE_TOPE_ACTIVOS_GS_,
    porcentajeAfectableMaximo: 0.80,
    lugarPrincipal: lugarPrincipal,
    lugaresOrden: orden,
    lugaresFallback: LUGARES_PASIVOS_GS_
  };
}

function resolverConflictoFilasGs_(filas, codigoNorm, descNorm, side) {
  if (!filas || filas.length === 0) return null;
  const codSinSuf = quitarSufijoCodigoGs_(codigoNorm);
  const codBase = codSinSuf.replace(/^0+/, '') || codigoNorm.replace(/^_+|_+$/g, '');

  if (side !== 'HABER') {
    if (/EMBARGO|LITIS|JUDICIAL|OFICIO/.test(descNorm)) return 'AFECTADO';
    if (codBase === '136' && descNorm.indexOf('DEUDA') !== -1) return 'AFECTADO';
    if (
      ['366', '368', '412', '491', '960', '1117'].indexOf(codBase) !== -1 &&
      (!descNorm || SIDECREER_RE_GS_.test(descNorm) || /BERSA|FEDEM|MUPER/.test(descNorm))
    ) {
      return 'AFECTADO';
    }
    if (codBase === '812' && SIDECREER_RE_GS_.test(descNorm)) return 'AFECTADO';
    if (codBase === '829' && (descNorm.indexOf('MUPER') !== -1 || !descNorm)) return 'AFECTADO';
    if (codBase === '1115' && descNorm.indexOf('FEDEM') !== -1) return 'AFECTADO';
    if (codBase === '480' && descNorm.indexOf('BERSA') !== -1) return 'AFECTADO';
    if (codBase === '339' && (descNorm.indexOf('CREDITO') !== -1 || descNorm.indexOf('PREST') !== -1)) return 'AFECTADO';
    if (codBase === '339' && (descNorm.indexOf('SOCIET') !== -1 || descNorm.indexOf('APORTE') !== -1)) return 'SUBTOTAL_1';
    if (codBase === '502' && (descNorm.indexOf('JUB') !== -1 || descNorm.indexOf('APORTE') !== -1 || !descNorm)) return 'SUBTOTAL_1';
  }
  if (side !== 'DESCUENTO' && codBase === '100') {
    if (/ANUAL|SAC|AGUINALDO/.test(descNorm)) return 'NO_COMPUTABLE';
    if (descNorm.indexOf('BASICO') !== -1) return 'COMPUTABLE';
  }

  let candidatas = filas;
  if (side === 'HABER') {
    const soloHab = filas.filter(function(r) { return r.clasificacion === 'COMPUTABLE' || r.clasificacion === 'NO_COMPUTABLE'; });
    if (soloHab.length === 0) return null;
    candidatas = soloHab;
  } else if (side === 'DESCUENTO') {
    const soloDesc = filas.filter(function(r) { return r.clasificacion !== 'COMPUTABLE'; });
    if (soloDesc.length === 0) return null;
    candidatas = soloDesc;
  }

  const unicas = {};
  let numUnicas = 0;
  for (let i = 0; i < candidatas.length; i++) {
    if (!unicas[candidatas[i].clasificacion]) {
      unicas[candidatas[i].clasificacion] = true;
      numUnicas++;
    }
  }
  if (numUnicas === 1) return candidatas[0].clasificacion;

  if (descNorm) {
    const exactasDesc = candidatas
      .filter(function(r) { return r.nombreNorm === descNorm; })
      .map(function(r) { return r.clasificacion; });
    if (exactasDesc.length > 0) {
      return mostCommonClasifGs_(exactasDesc);
    }
  }

  const dtokList = descNorm.split(' ').filter(function(t) { return t.length >= 2; });
  const dtok = {};
  let dtokSize = 0;
  for (let i = 0; i < dtokList.length; i++) {
    if (!dtok[dtokList[i]]) {
      dtok[dtokList[i]] = true;
      dtokSize++;
    }
  }

  if (dtokSize > 0) {
    const scored = [];
    let maxSim = 0;
    for (let i = 0; i < candidatas.length; i++) {
      const r = candidatas[i];
      const rn = r.nombreNorm;
      if (!rn || rn === 'NAME') {
        scored.push({ sim: 0, clasif: r.clasificacion });
        continue;
      }
      const rParts = rn.split(' ').filter(function(t) { return t.length >= 2; });
      const rtok = {};
      let rtokSize = 0;
      for (let j = 0; j < rParts.length; j++) {
        if (!rtok[rParts[j]]) {
          rtok[rParts[j]] = true;
          rtokSize++;
        }
      }
      let inter = 0;
      for (const t in dtok) {
        if (rtok[t]) inter++;
      }
      const union = dtokSize + rtokSize - inter || 1;
      let sim = inter / union;
      if (descNorm === rn) sim = 1.5;
      else if ((descNorm.indexOf(rn) !== -1 || rn.indexOf(descNorm) !== -1) && dtokSize >= 1 && rtokSize >= 1) {
        sim = Math.max(sim, 0.55 + 0.35 * (Math.min(dtokSize, rtokSize) / Math.max(dtokSize, rtokSize)));
      }
      if (sim > maxSim) maxSim = sim;
      scored.push({ sim: sim, clasif: r.clasificacion });
    }
    if (maxSim >= 0.35) {
      const top = scored.filter(function(x) { return x.sim >= maxSim * 0.85; }).map(function(x) { return x.clasif; });
      return mostCommonClasifGs_(top);
    }
  }

  return mostCommonClasifGs_(candidatas.map(function(r) { return r.clasificacion; }));
}

function buscarPorDescripcionGs_(descNorm, side, seg) {
  if (!descNorm) return { clasif: null, metodo: '' };
  const idx = obtenerIndicePadronGs_();

  const exactas = idx.porNombreNorm[descNorm] || [];
  if (exactas.length > 0) {
    const filtradas = exactas.filter(function(r) { return seg.lugaresOrden.indexOf(r.lugar) !== -1; });
    const prioridad = filtradas.length > 0 ? filtradas : exactas;
    const cls = resolverConflictoFilasGs_(prioridad, '', descNorm, side);
    if (cls) return { clasif: cls, metodo: 'DESCRIPCION_EXACTA_PADRON' };
  }

  const dParts = descNorm.split(' ').filter(function(t) { return t.length >= 2; });
  const dtok = {};
  let dSize = 0;
  for (let i = 0; i < dParts.length; i++) {
    if (!dtok[dParts[i]]) {
      dtok[dParts[i]] = true;
      dSize++;
    }
  }
  if (dSize >= 2) {
    const mejores = [];
    let mejorSim = 0;
    for (let i = 0; i < idx.porNombreTokens.length; i++) {
      const entry = idx.porNombreTokens[i];
      const r = entry.r;
      if (side === 'HABER' && r.clasificacion !== 'COMPUTABLE' && r.clasificacion !== 'NO_COMPUTABLE') continue;
      if (side === 'DESCUENTO' && r.clasificacion === 'COMPUTABLE') continue;
      let inter = 0;
      for (const t in dtok) {
        if (entry.toks[t]) inter++;
      }
      if (inter === 0) continue;
      const sim = inter / (dSize + entry.size - inter);
      if (sim >= 0.65) {
        if (sim > mejorSim) mejorSim = sim;
        mejores.push({ sim: sim, r: r });
      }
    }
    if (mejores.length > 0) {
      const top = mejores.filter(function(x) { return x.sim >= mejorSim * 0.90; }).map(function(x) { return x.r.clasificacion; });
      return { clasif: mostCommonClasifGs_(top), metodo: 'DESCRIPCION_SIMILITUD_PADRON' };
    }
  }

  if (side !== 'HABER') {
    if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descNorm)) return { clasif: 'AFECTADO', metodo: 'DESCRIPCION_PATRON_EMBARGO' };
    if (SIDECREER_RE_GS_.test(descNorm) || /FEDEM|BERSA|BANCO ENTRE RIOS|MUPER.*CRED|PROVEED.*MUPER|PRESTAMO|MUTUAL MODELO.*AYUD|CUOTA CRED/.test(descNorm)) {
      return { clasif: 'AFECTADO', metodo: 'DESCRIPCION_PATRON_FINANCIERO' };
    }
    if (/JUBILAC|APORTE.*JUB|CAJA.*JUB|IOSPER|OSER|OBRA SOCIAL|SISER|IAPS|IAPV|ALIMENTARI|SINDICAL|GREMIAL|APORTE.*PERSON|SEGURO.*VIDA.*OBLIG|CUOTA SOCIAL.*MODELO|A\s*M\s*MODELO|APLER/.test(descNorm)) {
      return { clasif: 'SUBTOTAL_1', metodo: 'DESCRIPCION_PATRON_LEY' };
    }
  }
  if (side !== 'DESCUENTO') {
    if (/SALARIO FLIAR|SAL FLIAR|SALARIO FAMILIAR|ASIGNAC.*FAM|AYUDA ESCOLAR|PRENATAL|NACIMIENTO|MATRIMONIO|NO REMUN|SUMA FIJA NO REM|SUELDO ANUAL COMP|\bSAC\b|AGUINALDO/.test(descNorm)) {
      return { clasif: 'NO_COMPUTABLE', metodo: 'DESCRIPCION_PATRON_NO_COMP' };
    }
  }

  return { clasif: null, metodo: '' };
}

function clasificarItemsRecibo(items, lugarTrabajo, metaRecibo) {
  const meta = Object.assign({}, metaRecibo || {});
  if (lugarTrabajo) meta.lugar_de_trabajo = lugarTrabajo;
  const seg = resolverSegmentoBeneficiarioGs_(meta);
  const idx = obtenerIndicePadronGs_();
  const out = [];
  const lista = Array.isArray(items) ? items : [];

  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (!item || typeof item !== 'object') continue;
    const codigoRaw = String(item.codigo !== undefined && item.codigo !== null ? item.codigo : '').trim();
    const codigoVacio = esCodigoVacioPadronGs_(codigoRaw);
    const codigo = codigoVacio ? '' : codigoRaw;
    const desc = String(item.descripcion || item.concepto || item.detalle || item.nombre || '').trim();

    const habRaw = item.haberes !== undefined ? item.haberes : (item.montoHaber !== undefined ? item.montoHaber : item.importeHaber);
    const descRaw = item.descuentos !== undefined ? item.descuentos : (item.retenciones !== undefined ? item.retenciones : (item.montoDescuento !== undefined ? item.montoDescuento : item.importeDescuento));

    const habParsed = limpiarMontoNullGs_(habRaw);
    const descParsed = limpiarMontoNullGs_(descRaw);
    let habNum = habParsed !== null ? Math.abs(habParsed) : 0;
    let descNum = descParsed !== null ? Math.abs(descParsed) : 0;

    const montoUnicoRaw = item.importe !== undefined ? item.importe : item.monto;
    const montoUnico = montoUnicoRaw !== undefined && montoUnicoRaw !== null ? limpiarMontoNullGs_(montoUnicoRaw) : null;

    const clasifExplicita = normalizarClasificacion(item.clasificacion);
    const tipoIn = String(item.tipo || item.columna || '').trim().toUpperCase();

    let side = null;
    if (habNum > 0 && descNum === 0) side = 'HABER';
    else if (descNum > 0 && habNum === 0) side = 'DESCUENTO';
    else if (tipoIn.indexOf('DESC') !== -1 || tipoIn.indexOf('RETEN') !== -1 || tipoIn.indexOf('DEDU') !== -1) side = 'DESCUENTO';
    else if (tipoIn.indexOf('HAB') !== -1 || tipoIn.indexOf('REMUN') !== -1) side = 'HABER';
    else if (montoUnico !== null && montoUnico < 0) side = 'DESCUENTO';

    if (habNum === 0 && descNum === 0 && montoUnico !== null && montoUnico !== 0) {
      const absU = Math.abs(montoUnico);
      if (side === 'DESCUENTO' || clasifExplicita === 'SUBTOTAL_1' || clasifExplicita === 'AFECTADO') {
        descNum = absU;
        side = 'DESCUENTO';
      } else if (side === 'HABER' || clasifExplicita === 'COMPUTABLE' || clasifExplicita === 'NO_COMPUTABLE') {
        habNum = absU;
        side = 'HABER';
      }
    }

    const importeAbs = (montoUnico !== null && habNum === 0 && descNum === 0)
      ? round2Audit_(Math.abs(montoUnico))
      : round2Audit_(habNum + descNum);

    const codigoUp = normalizarCodigoLookupGs_(codigo);
    const descNorm = normalizarDescripcionPadronGs_(desc);
    let clasifFinal = clasifExplicita;
    let metodo = clasifExplicita ? 'EXPLICITA_NORMALIZADA' : '';
    let lugarMatch = '';

    if (!clasifFinal && codigoUp) {
      const codNz = stripZerosGs_(codigoUp);
      const codStrip = codigoUp.replace(/^_+|_+$/g, '');
      const codStripNz = stripZerosGs_(codStrip);
      const codSinSuf = quitarSufijoCodigoGs_(codigoUp);
      const codSinSufNz = stripZerosGs_(codSinSuf);

      const EQUIV_GRUPOS = [
        ['GE_', 'GE'],
        ['SG_', 'SG'],
        ['SA_', 'SAL_'],
        ['JU_', 'JU', 'JUB_']
      ];

      const agruparLugares = function(lugaresLista) {
        const grupos = [];
        const vistos = {};
        for (let li = 0; li < lugaresLista.length; li++) {
          const lug = lugaresLista[li];
          if (vistos[lug]) continue;
          const grupo = [lug];
          for (let ei = 0; ei < EQUIV_GRUPOS.length; ei++) {
            const eq = EQUIV_GRUPOS[ei];
            if (eq.indexOf(lug) >= 0) {
              for (let ej = 0; ej < eq.length; ej++) {
                const e = eq[ej];
                if (lugaresLista.indexOf(e) >= 0 && grupo.indexOf(e) < 0) {
                  grupo.push(e);
                }
              }
              break;
            }
          }
          for (let gi = 0; gi < grupo.length; gi++) vistos[grupo[gi]] = true;
          grupos.push(grupo);
        }
        return grupos;
      };

      const buscarListaLugares = function(lugaresLista, cands, idxMap, met) {
        const grupos = agruparLugares(lugaresLista);
        for (let gi = 0; gi < grupos.length; gi++) {
          const grupo = grupos[gi];
          for (let ci = 0; ci < cands.length; ci++) {
            const codCand = cands[ci];
            if (!codCand) continue;
            const filas = [];
            for (let li = 0; li < grupo.length; li++) {
              const f = idxMap[grupo[li] + '|' + codCand];
              if (f && f.length > 0) {
                for (let fi = 0; fi < f.length; fi++) filas.push(f[fi]);
              }
            }
            if (filas.length > 0) {
              const c = resolverConflictoFilasGs_(filas, codCand, descNorm, side);
              if (c) {
                clasifFinal = c;
                metodo = met;
                let mejorFila = null;
                for (let fi = 0; fi < filas.length; fi++) {
                  if (filas[fi].clasificacion === c && filas[fi].nombreNorm === descNorm) {
                    mejorFila = filas[fi];
                    break;
                  }
                  if (!mejorFila && filas[fi].clasificacion === c) {
                    mejorFila = filas[fi];
                  }
                }
                lugarMatch = mejorFila ? mejorFila.lugar : grupo[0];
                return true;
              }
            }
          }
        }
        return false;
      };

      if (!buscarListaLugares(seg.lugaresOrden, [codigoUp, codNz], idx.porLugarCodigo, 'PADRON_CODIGO_EXACTO')) {
        if (codigoUp.charAt(codigoUp.length - 1) !== '_') {
          buscarListaLugares(seg.lugaresOrden, [codStrip, codStripNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_EXACTO');
        }
      }
      if (!clasifFinal && (codigoUp.indexOf('_') !== -1 || codigoUp !== codSinSuf)) {
        buscarListaLugares(seg.lugaresFallback, [codigoUp, codNz], idx.porLugarCodigo, 'PADRON_CODIGO_CROSS');
      }
      if (!clasifFinal && (codSinSuf !== codigoUp || codSinSufNz !== codNz)) {
        buscarListaLugares(seg.lugaresOrden, [codSinSuf, codSinSufNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_SIN_SUFIJO');
      }
      if (!clasifFinal) {
        if (!buscarListaLugares(seg.lugaresFallback, [codStrip, codStripNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS')) {
          if (codSinSuf !== codigoUp || codSinSufNz !== codNz) {
            buscarListaLugares(seg.lugaresFallback, [codSinSuf, codSinSufNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS_SIN_SUFIJO');
          }
        }
      }
    }

    if (!clasifFinal && descNorm) {
      const resDesc = buscarPorDescripcionGs_(descNorm, side, seg);
      if (resDesc.clasif) {
        clasifFinal = resDesc.clasif;
        metodo = resDesc.metodo;
      }
    }

    if (!clasifFinal) {
      if (side === 'HABER' || (side === null && descNum === 0 && montoUnico !== null && montoUnico > 0 && habNum >= 0)) {
        clasifFinal = 'COMPUTABLE';
        metodo = 'HABER_DEFAULT_COMPUTABLE';
      } else if (side === 'DESCUENTO') {
        clasifFinal = 'SIN_CLASIFICAR';
        metodo = 'SIN_CLASIFICAR';
      } else {
        clasifFinal = 'COMPUTABLE';
        metodo = 'DEFAULT_COMPUTABLE';
      }
    }

    let tipoFinal = side || ((clasifFinal === 'SUBTOTAL_1' || clasifFinal === 'AFECTADO' || clasifFinal === 'SIN_CLASIFICAR') ? 'DESCUENTO' : 'HABER');
    if (side === null) {
      if (tipoFinal === 'DESCUENTO' && descNum === 0 && importeAbs > 0) descNum = importeAbs;
      if (tipoFinal === 'HABER' && habNum === 0 && importeAbs > 0) habNum = importeAbs;
    }

    out.push({
      codigo: codigo,
      descripcion: desc,
      tipo: tipoFinal,
      haberes: round2Audit_(habNum),
      descuentos: round2Audit_(descNum),
      importe: round2Audit_(importeAbs),
      clasificacion: clasifFinal,
      metodoClasificacion: metodo,
      lugarPadronMatch: lugarMatch || seg.lugarPrincipal
    });
  }
  return out;
}

function sumaAbsGs_(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let val = Number(it.importe || 0);
    if (!val) val = Number(it.descuentos || 0) || Number(it.haberes || 0);
    total += Math.abs(val);
  }
  return round2Audit_(total);
}

function calcularMargenRecibo(datosRecibo) {
  const d = datosRecibo || {};
  const seg = resolverSegmentoBeneficiarioGs_(d);
  const porcentajeTope = seg.porcentajeTope;

  const itemsRaw = Array.isArray(d.items) ? d.items : (Array.isArray(d.conceptos) ? d.conceptos : []);
  const itemsClasif = clasificarItemsRecibo(itemsRaw, seg.lugarPrincipal, d);

  let sumItemsHab = 0;
  let sumItemsDesc = 0;
  for (let i = 0; i < itemsClasif.length; i++) {
    const it = itemsClasif[i];
    sumItemsHab += Math.abs(it.haberes || (it.tipo === 'HABER' ? it.importe : 0));
    sumItemsDesc += Math.abs(it.descuentos || (it.tipo === 'DESCUENTO' ? it.importe : 0));
  }
  sumItemsHab = round2Audit_(sumItemsHab);
  sumItemsDesc = round2Audit_(sumItemsDesc);

  const sinHeaderHab = d.total_haberes == null && d.sueldoBrutoTotal == null && d.sueldoBruto == null;
  const sinHeaderDesc = d.total_descuentos == null && d.totalDescuentos == null && d.totalDescuentosRecibo == null;
  const sinHeaderLiq = d.liquido == null && d.sueldoLiquido == null && d.sueldoNeto == null;

  const totalHaberes = (sinHeaderHab && itemsClasif.length > 0)
    ? sumItemsHab
    : round2Audit_(limpiarMontoNullGs_(d.total_haberes ?? d.sueldoBrutoTotal ?? d.sueldoBruto ?? 0) || 0);
  const totalDescuentosIn = (sinHeaderDesc && itemsClasif.length > 0)
    ? sumItemsDesc
    : round2Audit_(limpiarMontoNullGs_(d.total_descuentos ?? d.totalDescuentos ?? d.totalDescuentosRecibo ?? 0) || 0);
  const liquido = (sinHeaderLiq && (totalHaberes > 0 || itemsClasif.length > 0))
    ? round2Audit_(totalHaberes - Math.abs(totalDescuentosIn))
    : round2Audit_(limpiarMontoNullGs_(d.liquido ?? d.sueldoLiquido ?? d.sueldoNeto ?? 0) || 0);
  const cuotaFutura2 = round2Audit_(Math.abs(limpiarMontoNullGs_(d.cuota_futura_2 ?? d.cuotaFutura2 ?? 0) || 0));
  const cuotaRefinanciarIn = round2Audit_(Math.abs(limpiarMontoNullGs_(d.cuota_refinanciar ?? d.cuotaRefinanciar ?? 0) || 0));
  const saldoCancelar = round2Audit_(Math.abs(limpiarMontoNullGs_(d.saldo_cancelar ?? d.saldoCancelar ?? 0) || 0));
  const saldoVigenteExterno = round2Audit_(Math.abs(limpiarMontoNullGs_(d.saldo_vigente_externo ?? d.saldoVigenteExterno ?? 0) || 0));
  const detalleRefinanciacion = String(d.detalle_refinanciacion ?? d.detalleRefinanciacion ?? '').trim();
  const factorMargenRaw = limpiarMontoNullGs_(d.factor_margen ?? d.factorMargen ?? 1.0);
  const factorMargen = (factorMargenRaw !== null && factorMargenRaw > 0 && factorMargenRaw <= 1.0)
    ? Number(factorMargenRaw.toFixed(4))
    : 1.0;

  const liquidoEsperado = round2Audit_(totalHaberes - Math.abs(totalDescuentosIn));
  const diferenciaCabecera = round2Audit_(liquido - liquidoEsperado);
  const cabeceraConsistente = Math.abs(diferenciaCabecera) <= 0.01;
  const diffHab = itemsClasif.length > 0 ? round2Audit_(totalHaberes - sumItemsHab) : 0;
  const diffDesc = itemsClasif.length > 0 ? round2Audit_(Math.abs(totalDescuentosIn) - sumItemsDesc) : 0;

  const itemsCero = itemsClasif.filter(function(x) { return round2Audit_(x.importe || 0) === 0; });
  const itemsSinCodigo = itemsClasif.filter(function(x) { return esCodigoVacioPadronGs_(x.codigo); });
  const itemsSinClasif = itemsClasif.filter(function(x) { return x.clasificacion === 'SIN_CLASIFICAR'; });

  const alertas = [];
  if (totalHaberes > 0 && !cabeceraConsistente) {
    alertas.push(
      'Diferencia en cabecera del recibo: Total Haberes - Total Descuentos = ' + fmtArAlertGs_(liquidoEsperado) +
      ' vs Líquido informado ' + fmtArAlertGs_(liquido) + ' (diferencia: ' + fmtArAlertGs_(diferenciaCabecera) + ').'
    );
  }
  if (itemsClasif.length > 0 && totalHaberes > 0 && Math.abs(diffHab) > 0.01) {
    alertas.push(
      'La suma de ítems de Haberes (' + fmtArAlertGs_(sumItemsHab) + ') difiere del Total Haberes de cabecera (' +
      fmtArAlertGs_(totalHaberes) + ') en ' + fmtArAlertGs_(diffHab) + '.'
    );
  }
  if (itemsClasif.length > 0 && Math.abs(totalDescuentosIn) > 0 && Math.abs(diffDesc) > 0.01) {
    alertas.push(
      'La suma de ítems de Descuentos (' + fmtArAlertGs_(sumItemsDesc) + ') difiere del Total Descuentos de cabecera (' +
      fmtArAlertGs_(Math.abs(totalDescuentosIn)) + ') en ' + fmtArAlertGs_(diffDesc) + '.'
    );
  }
  if (itemsCero.length > 0) {
    const detalleCero = itemsCero.map(function(it) {
      return (it.codigo ? ('Cód. ' + it.codigo) : 'S/C') + (it.descripcion ? (' (' + it.descripcion + ')') : '');
    }).join(', ');
    alertas.push('Se detectaron ' + itemsCero.length + ' ítem(s) con importe $0,00 en el detalle: ' + detalleCero + '.');
  }
  if (itemsSinCodigo.length > 0) {
    alertas.push('Se detectaron ' + itemsSinCodigo.length + ' ítem(s) sin código numérico asignado (clasificados por descripción).');
  }
  if (itemsSinClasif.length > 0) {
    alertas.push('Hay ' + itemsSinClasif.length + ' descuento(s) sin código registrado en el padrón oficial.');
  }

  // PASO 2: Subtotal1
  const totalSubtotal1Desc = sumaAbsGs_(itemsClasif.filter(function(x) { return x.clasificacion === 'SUBTOTAL_1' && x.tipo !== 'HABER'; }));
  const subtotal1 = round2Audit_(totalHaberes - totalSubtotal1Desc);

  // PASO 3: Subtotal_tope y Subtotal2
  const subtotalTope = round2Audit_(subtotal1 * porcentajeTope);
  const subtotal2 = round2Audit_(subtotal1 - subtotalTope);

  // PASO 4: Total_no_computable y Afectable
  const totalNoComputable = sumaAbsGs_(itemsClasif.filter(function(x) { return x.clasificacion === 'NO_COMPUTABLE' && x.tipo !== 'DESCUENTO'; }));
  const afectable = round2Audit_(subtotal2 - totalNoComputable);

  // PASO 5: Afectado, Refinanciación y Disponible
  const totalAfectado = sumaAbsGs_(itemsClasif.filter(function(x) { return x.clasificacion === 'AFECTADO' && x.tipo !== 'HABER'; }));
  const cuotaRefinanciarAplicada = round2Audit_(Math.min(totalAfectado, cuotaRefinanciarIn));
  const totalAfectadoEfectivo = round2Audit_(Math.max(0, totalAfectado - cuotaRefinanciarAplicada));
  const margenSinFutura2 = round2Audit_(afectable - totalAfectadoEfectivo);
  const disponibleReciboOriginal = round2Audit_(afectable - totalAfectado - cuotaFutura2);
  const disponibleBrutoRecibo = round2Audit_(margenSinFutura2 - cuotaFutura2);
  const disponibleRecibo = (factorMargen < 1 && disponibleBrutoRecibo > 0)
    ? round2Audit_(disponibleBrutoRecibo * factorMargen)
    : disponibleBrutoRecibo;

  const sinDisponible = (margenSinFutura2 <= 0) || (disponibleRecibo <= 0);
  const estado = sinDisponible ? 'SIN_DISPONIBLE' : 'DISPONIBLE';
  const estadoLabel = sinDisponible ? 'SIN Disponible' : 'DISPONIBLE';

  const topeEndeud4167 = round2Audit_((5.0 * Math.max(0, liquido)) / 12.0);
  const cuotaSeguraGeneral = sinDisponible ? 0 : round2Audit_(Math.min(disponibleRecibo, topeEndeud4167));

  const resumenClasificaciones = {};
  for (let i = 0; i < itemsClasif.length; i++) {
    const cl = itemsClasif[i].clasificacion;
    resumenClasificaciones[cl] = (resumenClasificaciones[cl] || 0) + 1;
  }

  return {
    estado: estado,
    estadoLabel: estadoLabel,
    puedeOfrecerCuotas: !sinDisponible,
    tipoBeneficiario: seg.tipoBeneficiario,
    etiquetaBeneficiario: seg.etiquetaBeneficiario,
    lugarTrabajo: seg.lugarPrincipal,
    porcentajeTope: porcentajeTope,
    porcentajeAfectableMaximo: seg.porcentajeAfectableMaximo,
    totalHaberes: totalHaberes,
    totalDescuentos: Math.abs(totalDescuentosIn),
    netoLiquido: liquido,
    liquido: liquido,
    totalSubtotal1Desc: totalSubtotal1Desc,
    subtotal1: subtotal1,
    subtotalTope: subtotalTope,
    subtotal_tope: subtotalTope,
    subtotal2: subtotal2,
    totalNoComputable: totalNoComputable,
    total_no_computable: totalNoComputable,
    afectable: afectable,
    totalAfectado: totalAfectado,
    totalAfectadoEfectivo: totalAfectadoEfectivo,
    cuotaRefinanciar: cuotaRefinanciarAplicada,
    cuotaRefinanciarSolicitada: cuotaRefinanciarIn,
    saldoCancelar: saldoCancelar,
    saldoVigenteExterno: saldoVigenteExterno,
    detalleRefinanciacion: detalleRefinanciacion,
    factorMargen: factorMargen,
    cuotaFutura2: cuotaFutura2,
    margenSinFutura2: margenSinFutura2,
    disponibleReciboOriginal: disponibleReciboOriginal,
    disponibleBrutoRecibo: disponibleBrutoRecibo,
    disponibleRecibo: disponibleRecibo,
    margen: disponibleRecibo,
    topeEndeudamientoMensual4167: topeEndeud4167,
    cuotaMaximaSeguraGeneral: cuotaSeguraGeneral,
    limitadoPor: sinDisponible ? 'SIN_DISPONIBLE' : (disponibleRecibo <= topeEndeud4167 ? 'MARGEN_RECIBO' : 'TOPE_ENDEUDAMIENTO_LIQUIDO'),
    validaciones: {
      cabeceraConsistente: cabeceraConsistente,
      liquidoEsperado: liquidoEsperado,
      liquidoInformado: liquido,
      diferenciaCabecera: diferenciaCabecera,
      tieneDesgloseItems: itemsClasif.length > 0,
      sumaItemsHaberes: sumItemsHab,
      diferenciaHaberes: diffHab,
      sumaItemsDescuentos: sumItemsDesc,
      diferenciaDescuentos: diffDesc,
      cantidadItemsImporteCero: itemsCero.length,
      cantidadItemsSinCodigo: itemsSinCodigo.length,
      cantidadItemsSinClasificar: itemsSinClasif.length
    },
    alertas: alertas,
    resumenClasificaciones: resumenClasificaciones,
    items: itemsClasif
  };
}

function simularDesdeCuotaRefGs_(cuotaObjetivo, plazo, lineaKey) {
  if (cuotaObjetivo <= 0) return null;
  if (lineaKey === 'muni' || lineaKey === 'quad' || lineaKey === 'municipales') {
    const p = MOTOR_FINANCIERO_REF_GS_.municipales[plazo];
    if (!p) return null;
    const neto = cuotaObjetivo / p.coefCuota;
    const capVik = neto / MOTOR_FINANCIERO_REF_GS_.municipales.factorVikingo;
    return {
      neto: round2Audit_(neto),
      capitalBruto: round2Audit_(capVik),
      cuotaFinal: round2Audit_(cuotaObjetivo),
      totalPagar: round2Audit_(cuotaObjetivo * plazo)
    };
  }
  if (lineaKey === 'sidecreer') {
    const p = MOTOR_FINANCIERO_REF_GS_.sidecreer[plazo];
    if (!p) return null;
    const factorPmt = p.tem / (1 - Math.pow(1 + p.tem, -plazo));
    const capBruto = cuotaObjetivo / factorPmt;
    const neto = capBruto * (1 - p.gastos);
    return {
      neto: round2Audit_(neto),
      capitalBruto: round2Audit_(capBruto),
      cuotaFinal: round2Audit_(cuotaObjetivo),
      totalPagar: round2Audit_(cuotaObjetivo * plazo)
    };
  }
  const p = MOTOR_FINANCIERO_REF_GS_.fedem[plazo];
  if (!p) return null;
  const factorPmt = p.tem / (1 - Math.pow(1 + p.tem, -plazo));
  const factorTotal = factorPmt + p.seguro;
  const capBruto = cuotaObjetivo / factorTotal;
  const neto = capBruto * (1 - p.gastos);
  return {
    neto: round2Audit_(neto),
    capitalBruto: round2Audit_(capBruto),
    cuotaFinal: round2Audit_(cuotaObjetivo),
    totalPagar: round2Audit_(cuotaObjetivo * plazo)
  };
}

function calcularOfertasPorPlazo(margen, liquido, linea, opts) {
  if (margen <= 0 || liquido <= 0) return [];
  const o = opts || {};
  const lineaNorm = String(linea || 'fedem').trim().toLowerCase();
  const key = (lineaNorm.indexOf('muni') !== -1 || lineaNorm.indexOf('quad') !== -1)
    ? 'muni'
    : (lineaNorm.indexOf('side') !== -1 ? 'sidecreer' : 'fedem');
  const saldoCanc = round2Audit_(Math.max(0, Number(o.saldoCancelar || 0)));
  const saldoExt = round2Audit_(Math.max(0, Number(o.saldoVigenteExterno || 0)));
  const cuotaRef = round2Audit_(Math.max(0, Number(o.cuotaRefinanciar || 0)));

  const plazos = PLAZOS_POR_LINEA_GS_[key];
  const ofertas = [];
  for (let i = 0; i < plazos.length; i++) {
    const plazo = plazos[i];
    const mult = MULTIPLICADORES_ENDEUDAMIENTO_GS_[plazo];
    const topeCuotaBase = round2Audit_((mult * liquido) / plazo);
    const topeCuotaConSaldo = saldoExt > 0 ? round2Audit_(Math.max(0, (mult * liquido - saldoExt) / plazo)) : topeCuotaBase;
    const topeCuota = Math.min(topeCuotaBase, topeCuotaConSaldo);
    const topeCompromiso = round2Audit_(mult * liquido);
    const cuotaMaxReal = round2Audit_(Math.min(margen, topeCuota));
    if (cuotaMaxReal <= 0) continue;
    const sim = simularDesdeCuotaRefGs_(cuotaMaxReal, plazo, key);
    if (!sim || sim.neto <= 0) continue;
    const limitadoPor = margen <= topeCuota
      ? 'MARGEN_RECIBO'
      : ((saldoExt > 0 && topeCuotaConSaldo < topeCuotaBase) ? 'TOPE_ENDEUDAMIENTO_CON_SALDO' : 'TOPE_ENDEUDAMIENTO');
    const netoBolsillo = round2Audit_(sim.neto - saldoCanc);
    const alivioMensual = cuotaRef > 0 ? round2Audit_(cuotaRef - sim.cuotaFinal) : 0;
    ofertas.push({
      plazo: plazo,
      linea: key,
      multiplicador: mult,
      porcentajeNetoLiquido: 41.67,
      topeEndeudamientoCuota: topeCuota,
      topeCompromisoTotal: topeCompromiso,
      disponibleRecibo: round2Audit_(margen),
      cuotaMaximaReal: cuotaMaxReal,
      limitadoPor: limitadoPor,
      neto: sim.neto,
      capitalMaximoPrestar: sim.neto,
      capitalBruto: sim.capitalBruto,
      cuotaResultante: sim.cuotaFinal,
      totalPagar: sim.totalPagar,
      saldoCancelar: saldoCanc,
      netoBolsillo: netoBolsillo,
      cubreCancelacion: saldoCanc > 0 ? (sim.neto >= saldoCanc) : true,
      alivioMensual: alivioMensual
    });
  }
  return ofertas;
}

function calcularOfertasDisponibles(datosRecibo, lineaCredito) {
  const margenInfo = calcularMargenRecibo(datosRecibo);
  if (margenInfo.disponibleRecibo <= 0 || margenInfo.estado === 'SIN_DISPONIBLE') {
    return {
      estado: 'SIN_DISPONIBLE',
      estadoLabel: 'SIN Disponible',
      margen: margenInfo.disponibleRecibo,
      disponibleRecibo: margenInfo.disponibleRecibo,
      analisisMargen: margenInfo,
      ofertas: []
    };
  }
  const ofertas = calcularOfertasPorPlazo(margenInfo.disponibleRecibo, margenInfo.netoLiquido, lineaCredito || 'fedem', {
    saldoCancelar: margenInfo.saldoCancelar,
    saldoVigenteExterno: margenInfo.saldoVigenteExterno,
    cuotaRefinanciar: margenInfo.cuotaRefinanciar
  });
  return {
    estado: 'DISPONIBLE',
    estadoLabel: 'DISPONIBLE',
    margen: margenInfo.disponibleRecibo,
    disponibleRecibo: margenInfo.disponibleRecibo,
    analisisMargen: margenInfo,
    ofertas: ofertas
  };
}

function fmtPesosSpGs_(val) {
  const num = Number(val || 0);
  const sign = num < 0 ? '-' : '';
  const absFixed = Math.abs(num).toFixed(2);
  const parts = absFixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + '$ ' + parts[0] + ',' + parts[1];
}

function generarConclusionesYRecomendacionesGs_(analisis, desglose, ofertasFedem, embargoBool) {
  const am = analisis || {};
  const desg = desglose || {};
  const ofertas = Array.isArray(ofertasFedem) ? ofertasFedem : [];
  const disp = Number(am.disponibleRecibo || 0);
  const dispOrig = Number(am.disponibleReciboOriginal !== undefined ? am.disponibleReciboOriginal : disp);
  const tope4167 = Number(am.topeEndeudamientoMensual4167 || 0);
  const cuotaSegura = Number(am.cuotaMaximaSeguraGeneral || 0);
  const afectable = Number(am.afectable || 0);
  const afectado = Number(am.totalAfectado || 0);
  const cuotaRef = Number(am.cuotaRefinanciar || 0);
  const saldoCanc = Number(am.saldoCancelar || 0);
  const saldoExt = Number(am.saldoVigenteExterno || 0);
  const detalleRef = String(am.detalleRefinanciacion || '').trim();
  const factorMargen = Number(am.factorMargen || 1.0);
  const puedeOfrecer = Boolean(am.puedeOfrecerCuotas) && disp > 0;

  const refActiva = Boolean(cuotaRef > 0 || saldoCanc > 0 || saldoExt > 0 || detalleRef);
  const escenarios = [];
  const pares = [
    ['FEDEM', Number(desg.calcFedem ?? desg.consumosFedem ?? 0)],
    ['Sidecreer', Number(desg.calcSidecreer ?? desg.consumosSidecreer ?? 0)],
    ['BERSA', Number(desg.calcBersa ?? desg.consumosBersa ?? 0)],
    ['Otras Mutuales', Number(desg.calcMutuales ?? desg.otrasMutuales ?? 0)]
  ];
  for (let i = 0; i < pares.length; i++) {
    const ent = pares[i][0];
    const monto = pares[i][1];
    if (monto > 0) {
      const brutoEsc = round2Audit_(dispOrig + monto);
      const nuevoDisp = (factorMargen < 1 && brutoEsc > 0) ? round2Audit_(brutoEsc * factorMargen) : brutoEsc;
      const nuevaCuota = nuevoDisp > 0 ? round2Audit_(Math.min(nuevoDisp, tope4167)) : 0;
      escenarios.push({
        entidad: ent,
        montoLiberable: round2Audit_(monto),
        nuevoDisponible: nuevoDisp,
        nuevaCuotaSegura: nuevaCuota
      });
    }
  }

  const recomendaciones = [];
  let escenario = 'DISPONIBLE_LIMITADO_TOPE_NETO';
  let titulo = '';
  let resumen = '';

  if (embargoBool) {
    escenario = 'EMBARGO';
    titulo = 'Rechazo preventivo por retención judicial / embargo activo';
    resumen = 'Se detectaron retenciones judiciales/embargos activos. Aun con Disponible Recibo de ' + fmtPesosSpGs_(disp) + ', corresponde bloqueo reglamentario hasta acreditar levantamiento.';
    recomendaciones.push('Solicitar oficio o certificado de levantamiento de embargo antes de avanzar con cualquier línea o refinanciación.');
  } else if (refActiva) {
    escenario = 'REFINANCIACION_ACTIVA';
    titulo = 'Escenario de Refinanciación simulado' + (detalleRef ? (' (' + detalleRef + ')') : '');
    const partes = [];
    if (cuotaRef > 0) {
      partes.push('Al liberar ' + fmtPesosSpGs_(cuotaRef) + '/mes de cuota vigente, el Disponible Recibo pasa de ' + fmtPesosSpGs_(dispOrig) + ' a ' + fmtPesosSpGs_(disp) + ' (Cuota Segura: ' + fmtPesosSpGs_(cuotaSegura) + '/mes).');
    } else {
      partes.push('Se evalúa cancelación/refinanciación sobre el margen actual de ' + fmtPesosSpGs_(disp) + '/mes.');
    }
    if (saldoCanc > 0 && ofertas.length > 0) {
      const cubren = ofertas.filter(function(x) { return x.neto >= saldoCanc; });
      if (cubren.length > 0) {
        const primera = cubren[0];
        const mejor = cubren[cubren.length - 1];
        partes.push('El Saldo a Cancelar (' + fmtPesosSpGs_(saldoCanc) + ') se cubre desde ' + primera.plazo + ' cuotas (bolsillo neto ' + fmtPesosSpGs_(primera.netoBolsillo) + '), alcanzando hasta ' + fmtPesosSpGs_(mejor.netoBolsillo) + ' en bolsillo en ' + mejor.plazo + ' cuotas.');
      } else {
        const maxO = ofertas[ofertas.length - 1];
        const faltante = round2Audit_(saldoCanc - maxO.neto);
        partes.push('El Saldo a Cancelar (' + fmtPesosSpGs_(saldoCanc) + ') supera el máximo entregable en ' + maxO.plazo + ' cuotas (' + fmtPesosSpGs_(maxO.neto) + '); requiere integrar ' + fmtPesosSpGs_(faltante) + ' o liberar más cuota.');
      }
    }
    resumen = partes.join(' ');
    if (cuotaRef > 0 && ofertas.length > 0) {
      const ref24 = ofertas.find(function(x) { return x.plazo === 24; }) || ofertas[ofertas.length - 1];
      const alivio = round2Audit_(cuotaRef - ref24.cuotaResultante);
      if (alivio > 0) {
        recomendaciones.push('Alivio financiero mensual en ' + ref24.plazo + ' cuotas: la cuota baja en ' + fmtPesosSpGs_(alivio) + '/mes respecto a la retención liberada (' + fmtPesosSpGs_(cuotaRef) + ' → ' + fmtPesosSpGs_(ref24.cuotaResultante) + ').');
      }
    }
    if (saldoExt > 0) {
      recomendaciones.push('Se descontó el Saldo Vigente Externo de ' + fmtPesosSpGs_(saldoExt) + ' del tope de endeudamiento acumulado (41,67% × N × Neto).');
    }
  } else if (!puedeOfrecer) {
    escenario = escenarios.length > 0 ? 'SIN_DISPONIBLE_REFINANCIABLE' : 'SIN_DISPONIBLE';
    titulo = 'Margen agotado en recibo: requiere refinanciación previa o canal alternativo';
    const deficit = disp < 0 ? round2Audit_(Math.abs(disp)) : 0;
    resumen = 'El Afectado real (' + fmtPesosSpGs_(afectado) + ') supera al Afectable (' + fmtPesosSpGs_(afectable) + '), dejando Disponible Recibo de ' + fmtPesosSpGs_(disp) + '.';
    if (escenarios.length > 0) {
      const mejorEsc = escenarios.reduce(function(a, b) { return b.montoLiberable > a.montoLiberable ? b : a; }, escenarios[0]);
      recomendaciones.push(
        'Para revertir el déficit (' + fmtPesosSpGs_(deficit) + ') y habilitar planilla, se requiere cancelar/refinanciar al menos ' + fmtPesosSpGs_(round2Audit_(deficit + 1)) +
        ' de cuota mensual. Refinanciando ' + mejorEsc.entidad + ' (' + fmtPesosSpGs_(mejorEsc.montoLiberable) + '/mes), el Disponible pasaría a ' + fmtPesosSpGs_(mejorEsc.nuevoDisponible) + ' (Cuota Segura: ' + fmtPesosSpGs_(mejorEsc.nuevaCuotaSegura) + '/mes).'
      );
    }
    recomendaciones.push('Si no se cancela deuda previa en planilla, evaluar línea alternativa por CBU / Convenio Sidecreer sujeta a scoring.');
  } else if (disp <= tope4167) {
    escenario = 'DISPONIBLE_LIMITADO_RECIBO';
    titulo = 'Apto por planilla — Oferta acotada por Margen del Recibo';
    resumen = 'Posee Disponible Recibo positivo de ' + fmtPesosSpGs_(disp) + ', por debajo del Tope 41,67% Neto (' + fmtPesosSpGs_(tope4167) + '). La cuota máxima segura es ' + fmtPesosSpGs_(cuotaSegura) + '/mes.';
    if (escenarios.length > 0) {
      const mejorEsc = escenarios.reduce(function(a, b) { return b.montoLiberable > a.montoLiberable ? b : a; }, escenarios[0]);
      recomendaciones.push('Oportunidad de ampliación por Refinanciación: liberando ' + mejorEsc.entidad + ' (' + fmtPesosSpGs_(mejorEsc.montoLiberable) + '/mes), la cuota segura subiría hasta el Tope 41,67% (' + fmtPesosSpGs_(mejorEsc.nuevaCuotaSegura) + '/mes).');
    }
  } else {
    escenario = 'DISPONIBLE_LIMITADO_TOPE_NETO';
    titulo = 'Apto por planilla — Capacidad plena hasta Tope 41,67% Neto';
    resumen = 'El Disponible Recibo (' + fmtPesosSpGs_(disp) + ') supera el Tope Reglamentario 41,67% Neto (' + fmtPesosSpGs_(tope4167) + '). Se habilita la cuota máxima segura reglamentaria de ' + fmtPesosSpGs_(cuotaSegura) + '/mes.';
  }

  if (escenarios.length > 0 || refActiva) {
    recomendaciones.push('Checklist Refinanciación: (1) adjuntar Certificado de Saldo Cancelatorio vigente, (2) cargar Cuota Futura 2 si hubiera retenciones en curso no liquidadas, y (3) confirmar que el Monto a Entregar cubra el saldo y deje bolsillo positivo.');
  }

  let plazoMinimoCobertura = null;
  if (saldoCanc > 0) {
    for (let k = 0; k < ofertas.length; k++) {
      if (ofertas[k].cubreCancelacion) {
        plazoMinimoCobertura = ofertas[k].plazo;
        break;
      }
    }
  }

  return {
    escenario: escenario,
    titulo: titulo,
    resumen: resumen,
    recomendaciones: recomendaciones,
    refinanciacionActiva: refActiva,
    escenariosSugeridos: escenarios,
    plazoMinimoCobertura: plazoMinimoCobertura
  };
}

function calcularOfertasDisponiblesBackendGs_(payload) {
  const p = payload || {};
  const datos = p.datosRecibo || p;
  const linea = p.lineaCredito || p.linea || 'fedem';
  const res = calcularOfertasDisponibles(datos, linea);
  const offerOpts = {
    saldoCancelar: res.analisisMargen.saldoCancelar,
    saldoVigenteExterno: res.analisisMargen.saldoVigenteExterno,
    cuotaRefinanciar: res.analisisMargen.cuotaRefinanciar
  };
  return Object.assign({ ok: true, success: true }, res, {
    ofertasPorPlazo: res.estado === 'DISPONIBLE' ? {
      fedem: calcularOfertasPorPlazo(res.disponibleRecibo, res.analisisMargen.netoLiquido, 'fedem', offerOpts),
      muni: calcularOfertasPorPlazo(res.disponibleRecibo, res.analisisMargen.netoLiquido, 'muni', offerOpts),
      sidecreer: calcularOfertasPorPlazo(res.disponibleRecibo, res.analisisMargen.netoLiquido, 'sidecreer', offerOpts)
    } : { fedem: [], muni: [], sidecreer: [] }
  });
}

function clasificarConceptosReciboGs_(conceptosRaw, metaRecibo) {
  const itemsClasif = clasificarItemsRecibo(
    Array.isArray(conceptosRaw) ? conceptosRaw : [],
    (metaRecibo && (metaRecibo.lugarTrabajo || metaRecibo.lugar_de_trabajo)) || '',
    metaRecibo || {}
  );
  let sumHaberes = 0;
  let sumDescuentos = 0;
  let calcLey = 0;
  let calcBersa = 0;
  let calcSidecreer = 0;
  let calcFedem = 0;
  let calcEmbargo = 0;
  let calcMutuales = 0;
  const fedemCodes = [];
  const embargoDescs = [];

  for (let i = 0; i < itemsClasif.length; i++) {
    const r = itemsClasif[i];
    sumHaberes = round2Audit_(sumHaberes + (r.haberes || 0));
    sumDescuentos = round2Audit_(sumDescuentos + (r.descuentos || 0));
    if (r.tipo !== 'DESCUENTO' && (r.clasificacion === 'COMPUTABLE' || r.clasificacion === 'NO_COMPUTABLE')) continue;
    const imp = Math.abs(r.descuentos || r.importe || 0);
    if (imp <= 0) continue;

    const descUp = normalizarDescripcionPadronGs_(r.descripcion || '');
    const codClean = stripZerosGs_(quitarSufijoCodigoGs_(normalizarCodigoLookupGs_(r.codigo)));

    if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descUp)) {
      calcEmbargo = round2Audit_(calcEmbargo + imp);
      if (r.descripcion) embargoDescs.push(r.descripcion);
    } else if (r.clasificacion === 'SUBTOTAL_1') {
      calcLey = round2Audit_(calcLey + imp);
    } else if (r.clasificacion === 'AFECTADO') {
      if (['366', '368', '369', '1115', '1117'].indexOf(codClean) !== -1 || descUp.indexOf('FEDEM') !== -1) {
        calcFedem = round2Audit_(calcFedem + imp);
        const lbl = r.codigo ? (r.codigo + ' (' + (r.descripcion || 'FEDEM') + ')') : (r.descripcion || 'FEDEM');
        if (fedemCodes.indexOf(lbl) === -1) fedemCodes.push(lbl);
      } else if (SIDECREER_RE_GS_.test(descUp) || codClean === '412' || codClean === '812') {
        calcSidecreer = round2Audit_(calcSidecreer + imp);
      } else if (descUp.indexOf('BERSA') !== -1 || descUp.indexOf('BANCO ENTRE RIOS') !== -1 || codClean === '480' || codClean === '960') {
        calcBersa = round2Audit_(calcBersa + imp);
      } else {
        calcMutuales = round2Audit_(calcMutuales + imp);
      }
    }
  }

  return {
    rows: itemsClasif,
    sumHaberes: itemsClasif.length > 0 ? sumHaberes : null,
    sumDescuentos: itemsClasif.length > 0 ? sumDescuentos : null,
    calcLey: calcLey,
    calcBersa: calcBersa,
    calcSidecreer: calcSidecreer,
    calcFedem: calcFedem,
    calcEmbargo: calcEmbargo,
    calcMutuales: calcMutuales,
    fedemCodes: fedemCodes,
    embargoConcepto: embargoDescs.join('; ')
  };
}

function mapearAuditoriaEnAppsScript_(raw, datosDeclarados) {
  const DEFAULT_TXT = 'No especificado';
  const rawIn = raw || {};
  const resDecIn = rawIn.resumenDecision || {};
  const detRecIn = rawIn.detalleCompletoRecibo || {};

  const idObj = rawIn.identidad || (rawIn.datosAgente ? {
    titularDetectado: rawIn.datosAgente.nombreTitular || rawIn.datosAgente.nombreApellido || rawIn.datosAgente.nombre,
    dni: rawIn.datosAgente.dni || rawIn.datosAgente.dniCuil,
    cuil: rawIn.datosAgente.cuil || 'No consta en recibo',
    estadoCotejoCaratula: rawIn.datosAgente.estadoCotejoCaratula || ''
  } : ((resDecIn.titular || resDecIn.dni || rawIn.titular || rawIn.dni) ? {
    titularDetectado: resDecIn.titular || rawIn.titular,
    dni: resDecIn.dni || rawIn.dni,
    cuil: resDecIn.cuil || rawIn.cuil || 'No consta en recibo',
    estadoCotejoCaratula: ''
  } : {}));

  const lab = rawIn.datosLaborales || (rawIn.datosAgente ? {
    organismoEmpleador: rawIn.datosAgente.organismo,
    escalafonCargo: rawIn.datosAgente.escalafonCargo || detRecIn.escalafonCargo || '',
    situacionRevista: rawIn.datosAgente.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: rawIn.datosAgente.fechaIngreso || '',
    antiguedadAnios: rawIn.datosAgente.antiguedadAnios,
    antiguedadDetalle: rawIn.datosAgente.antiguedad || (rawIn.datosAgente.antiguedadAnios !== undefined ? (rawIn.datosAgente.antiguedadAnios + ' años') : 'Verificar en carátula'),
    cumpleAntiguedadMinima: rawIn.datosAgente.cumpleAntiguedadMinima !== undefined
      ? rawIn.datosAgente.cumpleAntiguedadMinima
      : (rawIn.scoring && rawIn.scoring.cumpleAntiguedad1Anio !== undefined ? rawIn.scoring.cumpleAntiguedad1Anio : (rawIn.datosAgente.antiguedadAnios !== undefined ? Number(rawIn.datosAgente.antiguedadAnios) >= 1 : undefined)),
    cumpleTopeEdad80: rawIn.scoring && rawIn.scoring.cumpleEdadMax80 !== undefined ? rawIn.scoring.cumpleEdadMax80 : undefined
  } : ((resDecIn.organismo || resDecIn.antiguedad || resDecIn.cargo || rawIn.organismo || rawIn.antiguedad || rawIn.cargo) ? {
    organismoEmpleador: resDecIn.organismo || rawIn.organismo,
    escalafonCargo: resDecIn.cargo || detRecIn.escalafonCargo || rawIn.cargo || '',
    situacionRevista: resDecIn.situacionRevista || rawIn.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: resDecIn.fechaIngreso || rawIn.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: resDecIn.antiguedad || rawIn.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: resDecIn.antiguedadApta !== undefined ? resDecIn.antiguedadApta : rawIn.antiguedadApta
  } : {}));

  const metaReciboIn = {
    lugarTrabajo: rawIn.lugarTrabajo || rawIn.lugar_de_trabajo || (datosDeclarados && (datosDeclarados.lugarTrabajo || datosDeclarados.lugar_de_trabajo)) || '',
    tipoRecibo: rawIn.tipoRecibo || (datosDeclarados && datosDeclarados.tipoRecibo) || '',
    formatoRecibo: rawIn.formatoRecibo || rawIn.formato || '',
    organismo: lab.organismoEmpleador || rawIn.organismo || (datosDeclarados && datosDeclarados.organismo) || '',
    situacionRevista: lab.situacionRevista || rawIn.situacionRevista || '',
    condicion: lab.condicion || rawIn.condicion || '',
    cargo: lab.escalafonCargo || detRecIn.escalafonCargo || rawIn.cargo || ''
  };
  const desgloseConceptos = clasificarConceptosReciboGs_(detRecIn.conceptos || rawIn.conceptos, metaReciboIn);

  const vig = rawIn.vigenciaRecibo || (rawIn.liquidacion ? {
    periodoLiquidado: rawIn.liquidacion.periodo || rawIn.liquidacion.periodoLiquidado || (rawIn.datosAgente && rawIn.datosAgente.periodoLiquidado),
    estadoVigencia: rawIn.liquidacion.estadoVigencia || 'VIGENTE',
    esVigente: rawIn.liquidacion.esVigente !== false
  } : ((resDecIn.periodo || detRecIn.periodo || rawIn.periodo) ? {
    periodoLiquidado: resDecIn.periodo || detRecIn.periodo || rawIn.periodo,
    estadoVigencia: 'VIGENTE',
    esVigente: true
  } : {}));

  const totalesDet = detRecIn.totales || {};
  const sal = rawIn.radiografiaSalarial || (rawIn.liquidacion ? {
    sueldoBrutoTotal: rawIn.liquidacion.sueldoBrutoTotal ?? rawIn.liquidacion.sueldoBruto,
    descuentosLey: rawIn.liquidacion.descuentosLey,
    consumosBersa: rawIn.liquidacion.consumosBancariosBersa ?? rawIn.liquidacion.consumosBersa,
    consumosSidecreer: rawIn.liquidacion.consumosSidecreer,
    otrasMutuales: rawIn.liquidacion.otrasMutualesOProveeduria ?? rawIn.liquidacion.otrasMutuales ?? rawIn.liquidacion.consumosProveeduria,
    codigosFedemMonto: rawIn.liquidacion.consumosFedem ?? rawIn.liquidacion.codigosFedemMonto,
    codigosFedemDetectados: rawIn.liquidacion.codigosFedemDetectados || rawIn.liquidacion.codigosDetectados || [],
    embargoDetectado: Boolean(rawIn.liquidacion.embargosJudiciales ?? rawIn.liquidacion.embargoDetectado),
    embargoMonto: typeof rawIn.liquidacion.embargosJudiciales === 'number' ? rawIn.liquidacion.embargosJudiciales : (rawIn.liquidacion.embargoMonto ?? 0),
    totalDescuentosRecibo: rawIn.liquidacion.totalDescuentos ?? rawIn.liquidacion.totalDescuentosRecibo,
    sueldoLiquido: rawIn.liquidacion.sueldoLiquidoBolsillo ?? rawIn.liquidacion.sueldoLiquido ?? rawIn.liquidacion.sueldoNetoBolsillo ?? rawIn.liquidacion.sueldoNeto
  } : (resDecIn.sueldoBrutoTotal !== undefined || detRecIn.totales ? {
    sueldoBrutoTotal: resDecIn.sueldoBrutoTotal ?? totalesDet.totalHaberes,
    descuentosLey: desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcLey : (resDecIn.descuentosLey ?? desgloseConceptos.calcLey),
    consumosBersa: desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcBersa : (resDecIn.consumosBersa ?? desgloseConceptos.calcBersa),
    consumosSidecreer: desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcSidecreer : (resDecIn.consumosSidecreer ?? desgloseConceptos.calcSidecreer),
    otrasMutuales: desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcMutuales : (resDecIn.otrasMutualesOProveeduria ?? resDecIn.otrasMutuales ?? desgloseConceptos.calcMutuales),
    codigosFedemMonto: desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcFedem : (resDecIn.consumosFedem ?? resDecIn.codigosFedemMonto ?? desgloseConceptos.calcFedem),
    codigosFedemDetectados: desgloseConceptos.fedemCodes,
    embargoDetectado: Boolean(resDecIn.embargosJudiciales) || desgloseConceptos.calcEmbargo > 0,
    embargoMonto: typeof resDecIn.embargosJudiciales === 'number' ? resDecIn.embargosJudiciales : desgloseConceptos.calcEmbargo,
    embargoConcepto: desgloseConceptos.embargoConcepto,
    totalDescuentosRecibo: resDecIn.totalDescuentos ?? totalesDet.totalDescuentos,
    sueldoLiquido: resDecIn.sueldoLiquido ?? totalesDet.liquidoAPagar
  } : rawIn));

  const scRaw = rawIn.scoringAmmer || (rawIn.scoring ? {
    puntajeTotal: rawIn.scoring.puntaje ?? rawIn.scoring.puntajeTotal,
    calificacionLetra: rawIn.scoring.calificacion || rawIn.scoring.calificacionLetra,
    dictamen: (typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 60) ? 'RECHAZADO' : ((typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 80) ? 'OBSERVADO' : (String(rawIn.scoring.dictamen || '').toUpperCase().indexOf('RECHAZ') !== -1 ? 'RECHAZADO' : (String(rawIn.scoring.dictamen || '').toUpperCase().indexOf('OBSERV') !== -1 ? 'OBSERVADO' : 'APTO_OTORGAMIENTO'))),
    dictamenAuditor: rawIn.scoring.motivoDictamen || rawIn.scoring.dictamen || rawIn.scoring.dictamenAuditor
  } : (resDecIn.scoringSugerido !== undefined ? {
    puntajeTotal: resDecIn.scoringSugerido,
    decisionPlanilla: resDecIn.decisionPlanilla,
    decisionAlternativaCBU: resDecIn.decisionAlternativaCBU
  } : {}));

  const toNumOrNull = (v) => limpiarMontoNullGs_(v);

  let sueldoBruto = toNumOrNull(sal.sueldoBrutoTotal ?? sal.sueldoBruto ?? totalesDet.totalHaberes);
  if (sueldoBruto === null && desgloseConceptos.sumHaberes !== null) sueldoBruto = desgloseConceptos.sumHaberes;

  let descuentosLey = desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcLey : toNumOrNull(sal.descuentosLey);
  if ((descuentosLey === null || descuentosLey === 0) && desgloseConceptos.calcLey > 0) descuentosLey = desgloseConceptos.calcLey;

  let consumosBersa = desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcBersa : toNumOrNull(sal.consumosBersa ?? sal.consumosBancariosBersa);
  let consumosSidecreer = desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcSidecreer : toNumOrNull(sal.consumosSidecreer);
  let otrasMutuales = desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcMutuales : toNumOrNull(sal.otrasMutuales ?? sal.otrasMutualesOProveeduria);
  let codigosFedemMonto = desgloseConceptos.rows.length > 0 ? desgloseConceptos.calcFedem : toNumOrNull(sal.codigosFedemMonto ?? sal.consumosFedem);
  let embargoMonto = desgloseConceptos.rows.length > 0 ? Math.max(desgloseConceptos.calcEmbargo, toNumOrNull(sal.embargoMonto) || 0) : toNumOrNull(sal.embargoMonto);

  let totalDescuentosRecibo = toNumOrNull(sal.totalDescuentosRecibo ?? sal.totalDescuentos ?? totalesDet.totalDescuentos);
  if (totalDescuentosRecibo === null && desgloseConceptos.sumDescuentos !== null) totalDescuentosRecibo = desgloseConceptos.sumDescuentos;

  let sueldoLiquido = toNumOrNull(sal.sueldoLiquido ?? sal.sueldoNeto ?? totalesDet.liquidoAPagar);
  if (sueldoLiquido === null && sueldoBruto !== null && totalDescuentosRecibo !== null && sueldoBruto >= totalDescuentosRecibo) {
    sueldoLiquido = round2Audit_(sueldoBruto - totalDescuentosRecibo);
  }

  const lecturaSalarialPrincipalOk = (sueldoBruto !== null || sueldoLiquido !== null || totalDescuentosRecibo !== null);
  if (consumosBersa === null) consumosBersa = 0;
  if (consumosSidecreer === null) consumosSidecreer = 0;
  if (otrasMutuales === null) otrasMutuales = 0;
  if (codigosFedemMonto === null) codigosFedemMonto = 0;
  if (embargoMonto === null) embargoMonto = 0;

  if (totalDescuentosRecibo === null && sueldoBruto !== null && sueldoLiquido !== null && sueldoBruto >= sueldoLiquido) {
    totalDescuentosRecibo = round2Audit_(sueldoBruto - sueldoLiquido);
  } else if (totalDescuentosRecibo === null && descuentosLey !== null) {
    totalDescuentosRecibo = round2Audit_(
      descuentosLey + (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
    );
  }

  const cuotaFutura2In = limpiarMontoNullGs_(rawIn.cuota_futura_2 ?? rawIn.cuotaFutura2 ?? (datosDeclarados && (datosDeclarados.cuotaFutura2 ?? datosDeclarados.cuota_futura_2)) ?? 0) || 0;
  const cuotaRefinanciarIn = limpiarMontoNullGs_(rawIn.cuota_refinanciar ?? rawIn.cuotaRefinanciar ?? (datosDeclarados && (datosDeclarados.cuotaRefinanciar ?? datosDeclarados.cuota_refinanciar)) ?? 0) || 0;
  const saldoCancelarIn = limpiarMontoNullGs_(rawIn.saldo_cancelar ?? rawIn.saldoCancelar ?? (datosDeclarados && (datosDeclarados.saldoCancelar ?? datosDeclarados.saldo_cancelar)) ?? 0) || 0;
  const saldoVigenteExtIn = limpiarMontoNullGs_(rawIn.saldo_vigente_externo ?? rawIn.saldoVigenteExterno ?? (datosDeclarados && (datosDeclarados.saldoVigenteExterno ?? datosDeclarados.saldo_vigente_externo)) ?? 0) || 0;
  const detalleRefIn = String(rawIn.detalle_refinanciacion ?? rawIn.detalleRefinanciacion ?? (datosDeclarados && (datosDeclarados.detalleRefinanciacion ?? datosDeclarados.detalle_refinanciacion)) ?? '').trim();
  const factorMargenIn = limpiarMontoNullGs_(rawIn.factor_margen ?? rawIn.factorMargen ?? (datosDeclarados && (datosDeclarados.factorMargen ?? datosDeclarados.factor_margen)) ?? 1.0);
  const analisisMargen = calcularMargenRecibo(Object.assign({}, metaReciboIn, {
    total_haberes: sueldoBruto !== null ? sueldoBruto : 0,
    total_descuentos: totalDescuentosRecibo !== null ? totalDescuentosRecibo : 0,
    liquido: sueldoLiquido !== null ? sueldoLiquido : 0,
    cuota_futura_2: cuotaFutura2In,
    cuota_refinanciar: cuotaRefinanciarIn,
    saldo_cancelar: saldoCancelarIn,
    saldo_vigente_externo: saldoVigenteExtIn,
    detalle_refinanciacion: detalleRefIn,
    factor_margen: factorMargenIn !== null ? factorMargenIn : 1.0,
    items: desgloseConceptos.rows
  }));

  const offerOptsMap = {
    saldoCancelar: analisisMargen.saldoCancelar,
    saldoVigenteExterno: analisisMargen.saldoVigenteExterno,
    cuotaRefinanciar: analisisMargen.cuotaRefinanciar
  };
  const ofertasPorPlazo = analisisMargen.puedeOfrecerCuotas ? {
    fedem: calcularOfertasPorPlazo(analisisMargen.disponibleRecibo, analisisMargen.netoLiquido, 'fedem', offerOptsMap),
    muni: calcularOfertasPorPlazo(analisisMargen.disponibleRecibo, analisisMargen.netoLiquido, 'muni', offerOptsMap),
    sidecreer: calcularOfertasPorPlazo(analisisMargen.disponibleRecibo, analisisMargen.netoLiquido, 'sidecreer', offerOptsMap)
  } : { fedem: [], muni: [], sidecreer: [] };

  const cupoMaximoLegal = sueldoBruto !== null ? round2Audit_(sueldoBruto * 0.50) : null;
  const margenDisponibleMensual = lecturaSalarialPrincipalOk ? analisisMargen.disponibleRecibo : null;

  const cuotaSimulada = Number((datosDeclarados && datosDeclarados.cuota) || 0);
  const alertasCriticas = Array.isArray(scRaw.alertasCriticas) ? scRaw.alertasCriticas.slice() : [];
  for (let ai = 0; ai < analisisMargen.alertas.length; ai++) {
    if (alertasCriticas.indexOf(analisisMargen.alertas[ai]) === -1) {
      alertasCriticas.push(analisisMargen.alertas[ai]);
    }
  }
  const camposIlegibles = Array.isArray(scRaw.camposIlegibles) ? scRaw.camposIlegibles.slice() : [];

  if (sueldoBruto === null && camposIlegibles.indexOf('Sueldo Bruto Total') === -1) camposIlegibles.push('Sueldo Bruto Total');
  if (totalDescuentosRecibo === null && camposIlegibles.indexOf('Total Descuentos en Recibo') === -1) camposIlegibles.push('Total Descuentos en Recibo');
  if (sueldoLiquido === null && camposIlegibles.indexOf('Sueldo Líquido de Bolsillo') === -1) camposIlegibles.push('Sueldo Líquido de Bolsillo');

  const dniDeclarado = String((datosDeclarados && datosDeclarados.dni) || '').replace(/\D/g, '');
  const nombreDeclarado = String((datosDeclarados && datosDeclarados.nombre) || '').trim();
  const hayCaratulaPrevia = Boolean(dniDeclarado || nombreDeclarado);

  let estadoCotejo = String(idObj.estadoCotejoCaratula || '').trim();
  if (!hayCaratulaPrevia) {
    if (!estadoCotejo || estadoCotejo.indexOf('ILEGIBLE') !== -1 || estadoCotejo === 'COINCIDE') {
      estadoCotejo = 'VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)';
    }
  } else if (!estadoCotejo || estadoCotejo.indexOf('ILEGIBLE') !== -1) {
    estadoCotejo = 'VERIFICADO EN DOCUMENTO';
  }

  const dniExtraido = String(idObj.dni || '').replace(/\D/g, '');
  if (dniDeclarado && dniExtraido && dniDeclarado !== dniExtraido) {
    estadoCotejo = 'DISCREPANCIA DETECTADA';
    alertasCriticas.push('Discrepancia de DNI: carátula ' + dniDeclarado + ' vs documento ' + dniExtraido + '.');
  }

  const embargoDetectadoBool = Boolean(sal.embargoDetectado || sal.embargosJudiciales || resDecIn.embargosJudiciales) || (embargoMonto !== null && embargoMonto > 0);
  const embargoConceptoStr = sal.embargoConcepto || desgloseConceptos.embargoConcepto || '';

  if (lab.esInvalidezODiscapacidad) {
    alertasCriticas.push('Exclusión reglamentaria: Jubilación por Invalidez o Pensión por Discapacidad no viable.');
  }
  if (embargoDetectadoBool) {
    alertasCriticas.push('Presencia de embargo judicial/retención: ' + (embargoConceptoStr || 'Embargo') + ' (' + formatCurrencyAuditGs_(embargoMonto) + ').');
  }

  let estadoAfectacion = 'MARGEN DISPONIBLE';
  let estadoAfectacionPlanilla = 'MARGEN DISPONIBLE POR PLANILLA';
  if (margenDisponibleMensual === null) {
    estadoAfectacion = 'VERIFICAR MARGEN';
    estadoAfectacionPlanilla = 'VERIFICAR MARGEN';
  } else if (!analisisMargen.puedeOfrecerCuotas || margenDisponibleMensual <= 0) {
    estadoAfectacion = 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA';
    estadoAfectacionPlanilla = 'SIN Disponible';
    const msgSinDisp = 'SIN Disponible: Margen afectable real del recibo agotado (' + formatCurrencyAuditGs_(margenDisponibleMensual) + '). No se habilitan ofertas de cuotas.';
    if (alertasCriticas.indexOf(msgSinDisp) === -1) alertasCriticas.push(msgSinDisp);
  } else if (cuotaSimulada > 0 && analisisMargen.cuotaMaximaSeguraGeneral < cuotaSimulada) {
    estadoAfectacion = 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA';
    estadoAfectacionPlanilla = 'CUPO INSUFICIENTE PARA CUOTA SIMULADA';
    alertasCriticas.push(
      'Cuota máxima segura real (' + formatCurrencyAuditGs_(analisisMargen.cuotaMaximaSeguraGeneral) + ') inferior a la cuota simulada (' + formatCurrencyAuditGs_(cuotaSimulada) + ').'
    );
  }

  const cumpleTopeEdad80 = lab.cumpleTopeEdad80 !== undefined ? lab.cumpleTopeEdad80 : null;
  const esPasivo = analisisMargen.tipoBeneficiario === 'PASIVO' || String(lab.situacionRevista || '').toUpperCase().indexOf('PASIVO') !== -1;

  const tieneExclusionDura = Boolean(
    lab.esInvalidezODiscapacidad ||
    cumpleTopeEdad80 === false ||
    estadoCotejo === 'DISCREPANCIA DETECTADA' ||
    embargoDetectadoBool ||
    lab.cumpleAntiguedadMinima === false
  );

  const umbralNetoCbu = Math.max(150000, cuotaSimulada > 0 ? round2Audit_(cuotaSimulada * 2) : 150000);
  const aplicaAlternativaCbu = Boolean(
    !tieneExclusionDura &&
    estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA' &&
    sueldoLiquido !== null &&
    sueldoLiquido >= umbralNetoCbu
  );

  let decisionPlanilla = 'APTO POR PLANILLA';
  if (margenDisponibleMensual === null) {
    decisionPlanilla = 'OBSERVADO / VERIFICAR RECIBO';
  } else if (tieneExclusionDura) {
    decisionPlanilla = 'RECHAZADO / RESTRICCIÓN REGLAMENTARIA';
  } else if (!analisisMargen.puedeOfrecerCuotas || margenDisponibleMensual <= 0) {
    decisionPlanilla = 'SIN DISPONIBLE / CUPO EXCEDIDO';
  } else if (cuotaSimulada > 0 && analisisMargen.cuotaMaximaSeguraGeneral < cuotaSimulada) {
    decisionPlanilla = 'RECHAZADO / CUPO EXCEDIDO';
  }

  let decisionAlternativaCBU = 'NO REQUIERE ALTERNATIVA (Viable por planilla)';
  if (decisionPlanilla !== 'APTO POR PLANILLA') {
    if (aplicaAlternativaCbu) {
      decisionAlternativaCBU = 'APTO CONDICIONADO (Posee ' + formatCurrencyAuditGs_(sueldoLiquido) + ' de neto en cuenta)';
    } else if (tieneExclusionDura) {
      decisionAlternativaCBU = 'NO VIABLE POR CBU (Registra restricción excluyente / embargo / antigüedad)';
    } else {
      decisionAlternativaCBU = 'NO VIABLE POR CBU (Neto en cuenta insuficiente)';
    }
  }

  let scoreTotal = typeof scRaw.puntajeTotal === 'number' ? Math.max(0, Math.min(100, Math.round(scRaw.puntajeTotal))) : (lecturaSalarialPrincipalOk ? 88 : 55);
  let dictamen = String(scRaw.dictamen || (lecturaSalarialPrincipalOk ? 'APTO_OTORGAMIENTO' : 'OBSERVADO')).toUpperCase();
  if (dictamen.indexOf('APTO') === 0) dictamen = 'APTO_OTORGAMIENTO';

  if (tieneExclusionDura) {
    dictamen = 'RECHAZADO';
    scoreTotal = Math.min(scoreTotal, 42);
  } else if (estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA') {
    if (aplicaAlternativaCbu) {
      dictamen = 'OBSERVADO';
      scoreTotal = Math.max(60, Math.min(scoreTotal, 68));
    } else {
      dictamen = 'RECHAZADO';
      scoreTotal = Math.min(scoreTotal, 48);
    }
  } else if (lecturaSalarialPrincipalOk && analisisMargen.puedeOfrecerCuotas) {
    dictamen = 'APTO_OTORGAMIENTO';
    scoreTotal = Math.max(scoreTotal, 85);
  }

  if ((sueldoBruto === null || sueldoLiquido === null || totalDescuentosRecibo === null) && dictamen === 'APTO_OTORGAMIENTO') {
    dictamen = 'OBSERVADO';
    scoreTotal = Math.min(scoreTotal, 65);
  }

  const calificacionLetra = scoreTotal >= 80
    ? 'A (Riesgo Bajo)'
    : (scoreTotal >= 60 ? 'B (Riesgo Moderado)' : 'C (Riesgo Crítico / No Viable)');

  const codigosFedemList = (Array.isArray(sal.codigosFedemDetectados) && sal.codigosFedemDetectados.length > 0 && desgloseConceptos.fedemCodes.length === 0)
    ? sal.codigosFedemDetectados
    : desgloseConceptos.fedemCodes;
  const codigosFedemPrevios = Boolean(resDecIn.codigosFedemPrevios) || codigosFedemList.length > 0 || (codigosFedemMonto || 0) > 0;
  const fedemObs = codigosFedemList.length > 0
    ? ('Códigos detectados: ' + codigosFedemList.join(', '))
    : 'Sin códigos FEDEM (366/368/1115/1117) en recibo';

  const dniCoincideBool = estadoCotejo === 'COINCIDE' || estadoCotejo.indexOf('VERIFICADO EN DOCUMENTO') === 0;
  const vigenciaBool = vig.esVigente === true || vig.estadoVigencia === 'VIGENTE';
  const cumpleAntig = lab.cumpleAntiguedadMinima !== undefined
    ? Boolean(lab.cumpleAntiguedadMinima)
    : (esPasivo ? true : (typeof lab.antiguedadAnios === 'number' ? lab.antiguedadAnios >= 1 : true));

  const escalafonCargoStr = String(detRecIn.escalafonCargo || lab.escalafonCargo || lab.situacionRevista || 'Agente / Activo').trim();
  const periodoStr = String(vig.periodoLiquidado || detRecIn.periodo || 'Mes auditado').trim();
  const titularStr = String(idObj.titularDetectado || (datosDeclarados && datosDeclarados.nombre) || DEFAULT_TXT).trim();
  const dniStr = String(dniExtraido || idObj.dni || (datosDeclarados && datosDeclarados.dni) || DEFAULT_TXT).trim();
  const cuilStr = String(idObj.cuil || (datosDeclarados && datosDeclarados.cuil) || '').trim();
  const organismoStr = String(lab.organismoEmpleador || (datosDeclarados && datosDeclarados.organismo) || 'Organismo Provincial').trim();
  const antiguedadRawStr = String(lab.antiguedadDetalle || 'No registrada').trim();
  const antigMatchGs = antiguedadRawStr.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  const antiguedadStr = antigMatchGs
    ? (function() {
        const anios = parseInt(antigMatchGs[1], 10);
        const meses = parseInt(antigMatchGs[2], 10);
        if (anios === 0 && meses > 0) return meses + (meses === 1 ? ' mes' : ' meses');
        return anios + (anios === 1 ? ' año' : ' años') + (meses > 0 ? (', ' + meses + (meses === 1 ? ' mes' : ' meses')) : '');
      })()
    : antiguedadRawStr;

  const resumenDecision = {
    titular: titularStr,
    dni: dniStr,
    cuil: cuilStr,
    organismo: organismoStr,
    cargo: escalafonCargoStr,
    periodo: periodoStr,
    antiguedad: antiguedadStr,
    antiguedadApta: cumpleAntig,
    tipoBeneficiario: analisisMargen.tipoBeneficiario,
    lugarTrabajo: analisisMargen.lugarTrabajo,
    porcentajeTope: analisisMargen.porcentajeTope,
    sueldoBrutoTotal: sueldoBruto !== null ? sueldoBruto : 0,
    descuentosLey: descuentosLey !== null ? descuentosLey : 0,
    consumosBersa: consumosBersa || 0,
    consumosSidecreer: consumosSidecreer || 0,
    otrasMutualesOProveeduria: otrasMutuales || 0,
    consumosFedem: codigosFedemMonto || 0,
    totalDescuentos: totalDescuentosRecibo !== null ? totalDescuentosRecibo : 0,
    sueldoLiquido: sueldoLiquido !== null ? sueldoLiquido : 0,
    cupoMaximo50: cupoMaximoLegal !== null ? cupoMaximoLegal : 0,
    subtotal1: analisisMargen.subtotal1,
    subtotalTope: analisisMargen.subtotalTope,
    subtotal2: analisisMargen.subtotal2,
    totalNoComputable: analisisMargen.totalNoComputable,
    afectable: analisisMargen.afectable,
    totalAfectado: analisisMargen.totalAfectado,
    totalAfectadoEfectivo: analisisMargen.totalAfectadoEfectivo,
    cuotaRefinanciar: analisisMargen.cuotaRefinanciar,
    saldoCancelar: analisisMargen.saldoCancelar,
    saldoVigenteExterno: analisisMargen.saldoVigenteExterno,
    detalleRefinanciacion: analisisMargen.detalleRefinanciacion,
    factorMargen: analisisMargen.factorMargen,
    cuotaFutura2: analisisMargen.cuotaFutura2,
    disponibleRecibo: analisisMargen.disponibleRecibo,
    margenDisponiblePlanilla: analisisMargen.disponibleRecibo,
    cuotaMaximaSeguraGeneral: analisisMargen.cuotaMaximaSeguraGeneral,
    estadoMargen: analisisMargen.estado,
    estadoAfectacion: analisisMargen.estado === 'SIN_DISPONIBLE' ? 'SIN Disponible' : estadoAfectacionPlanilla,
    embargosJudiciales: embargoDetectadoBool,
    embargoMonto: embargoMonto || 0,
    embargoConcepto: embargoConceptoStr,
    codigosFedemPrevios: codigosFedemPrevios,
    codigosFedemDetectados: codigosFedemList,
    decisionPlanilla: decisionPlanilla,
    decisionAlternativaCBU: decisionAlternativaCBU,
    scoringSugerido: scoreTotal
  };

  const conclusionesRecomendaciones = generarConclusionesYRecomendacionesGs_(
    analisisMargen,
    {
      consumosFedem: codigosFedemMonto || 0,
      consumosSidecreer: consumosSidecreer || 0,
      consumosBersa: consumosBersa || 0,
      otrasMutuales: otrasMutuales || 0
    },
    ofertasPorPlazo.fedem,
    embargoDetectadoBool
  );

  const detalleCompletoRecibo = {
    periodo: periodoStr,
    escalafonCargo: escalafonCargoStr,
    conceptos: desgloseConceptos.rows,
    totales: {
      totalHaberes: sueldoBruto !== null ? sueldoBruto : 0,
      totalDescuentos: totalDescuentosRecibo !== null ? totalDescuentosRecibo : 0,
      liquidoAPagar: sueldoLiquido !== null ? sueldoLiquido : 0
    }
  };

  const cotejoBadgeMd = estadoCotejo === 'COINCIDE'
    ? '🟢 COINCIDENCIA TOTAL'
    : (estadoCotejo.indexOf('VERIFICADO EN DOCUMENTO') === 0
      ? '🟢 LECTURA DIRECTA DEL DOCUMENTO'
      : (estadoCotejo === 'DISCREPANCIA DETECTADA' ? '🔴 DISCREPANCIA DETECTADA' : '⚠️ ' + estadoCotejo));
  const vigenciaBadgeMd = vigenciaBool
    ? '🟢 VIGENTE'
    : (vig.estadoVigencia === 'DESACTUALIZADO' ? '⚠️ DESACTUALIZADO' : ('⚠️ ' + (vig.estadoVigencia || 'VERIFICAR')));
  const antigBadgeMd = cumpleAntig
    ? '🟢 CUMPLE REQUISITO (Mínimo 1 año)'
    : (lab.cumpleAntiguedadMinima === false ? '🔴 NO CUMPLE' : '⚠️ Verificar fecha de ingreso en carátula');
  const embargoMd = embargoDetectadoBool
    ? ('🔴 PRESENCIA DE EMBARGO DETECTADA: ' + formatCurrencyAuditGs_(embargoMonto) + ' / ' + (embargoConceptoStr || 'Retención judicial'))
    : '🟢 SIN EMBARGOS';
  const afectacionMd = analisisMargen.estado === 'SIN_DISPONIBLE'
    ? ('🔴 SIN Disponible (' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ')')
    : (estadoAfectacion === 'MARGEN DISPONIBLE'
      ? ('🟢 DISPONIBLE (' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ')')
      : ('⚠️ ' + estadoAfectacionPlanilla));

  const dictamenTextoFinal = scRaw.dictamenAuditor ||
    (decisionPlanilla === 'APTO POR PLANILLA'
      ? ('APTO POR PLANILLA (' + analisisMargen.etiquetaBeneficiario + '): Margen disponible real de ' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ' y cuota máxima segura de ' + formatCurrencyAuditGs_(analisisMargen.cuotaMaximaSeguraGeneral) + ' (tope 41,67% del Neto Líquido).')
      : (aplicaAlternativaCbu
        ? ('PLANILLA SIN DISPONIBLE (' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ') por afectaciones previas, sin embargos judiciales. ' + decisionAlternativaCBU + '.')
        : ('NO VIABLE: ' + (alertasCriticas[0] || 'SIN Disponible o restricción excluyente') + '. Revisar antes de otorgar.')));

  const lineasMd = [
    '### 📑 INFORME DE AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER',
    '---',
    '',
    '#### ⚡ Resumen Ejecutivo de Decisión (5 Segundos)',
    '* **Decisión Descuento por Planilla:** **' + decisionPlanilla + '** (' + afectacionMd + ')',
    '* **Régimen / Jurisdicción Padrón:** **' + analisisMargen.etiquetaBeneficiario + '** (`' + analisisMargen.lugarTrabajo + '`)',
    '* **Decisión Alternativa CBU / Cuenta:** **' + decisionAlternativaCBU + '**',
    '* **Scoring Sugerido AMMER:** **' + scoreTotal + ' / 100** • ' + calificacionLetra,
    '',
    '#### 👤 1. Verificación de Identidad y Coincidencias',
    '* **Titular Detectado:** ' + titularStr,
    '* **DNI / CUIL:** ' + dniStr + ' / ' + (cuilStr || 'No consta en recibo'),
    '* **Cotejo con Carátula:** ' + cotejoBadgeMd,
    '* **Período Liquidado:** ' + periodoStr + ' • ' + vigenciaBadgeMd,
    '',
    '#### 🏢 2. Datos Laborales y Situación de Revista',
    '* **Organismo Empleador:** ' + organismoStr,
    '* **Escalafón / Cargo:** ' + escalafonCargoStr,
    '* **Condición de Revista:** ' + (lab.situacionRevista || 'ACTIVO TITULAR'),
    '* **Antigüedad Registrada:** ' + antiguedadStr + ' • ' + antigBadgeMd,
    '* **Observaciones Especiales:** ' + (lab.observacionesEspeciales || 'Sin observaciones especiales registradas'),
    '',
    '#### 💵 3. Radiografía Salarial Consolidada',
    '| Concepto | Monto Detectado ($) | Observaciones / Estado |',
    '| :--- | :--- | :--- |',
    '| **Sueldo Bruto Total** | ' + formatCurrencyAuditGs_(sueldoBruto) + ' | Remunerativo + No Remunerativo |',
    '| **Descuentos de Ley / SUBTOTAL_1** | ' + formatCurrencyAuditGs_(analisisMargen.totalSubtotal1Desc) + ' | Jubilación, OSER, Seguros, Prioritarios |',
    '| **Consumos BERSA / Préstamos** | ' + formatCurrencyAuditGs_(consumosBersa) + ' | Retenciones bancarias (AFECTADO) |',
    '| **Consumos SIDECREER** | ' + formatCurrencyAuditGs_(consumosSidecreer) + ' | Descuento por tarjeta oficial (AFECTADO) |',
    '| **Otras Mutuales / Proveeduría** | ' + formatCurrencyAuditGs_(otrasMutuales) + ' | Descuentos por código mutual (AFECTADO) |',
    '| **Códigos FEDEM Activos** | ' + formatCurrencyAuditGs_(codigosFedemMonto) + ' | ' + fedemObs + ' |',
    '| **Total Descuentos en Recibo** | ' + formatCurrencyAuditGs_(totalDescuentosRecibo) + ' | Deducciones consolidadas |',
    '| **Sueldo Líquido de Bolsillo** | ' + formatCurrencyAuditGs_(sueldoLiquido) + ' | Neto final a cobrar |',
    '',
    '* **Embargos Judiciales / Inhibiciones:** ' + embargoMd,
    '',
    '#### 📊 4. Análisis de Margen Real y Capacidad de Endeudamiento (' + analisisMargen.tipoBeneficiario + ')',
    '| Paso del Pipeline | Monto ($) | Criterio Aplicado |',
    '| :--- | ---: | :--- |',
    '| Total Haberes (Bruto) | ' + formatCurrencyAuditGs_(analisisMargen.totalHaberes) + ' | Base de cabecera / suma haberes |',
    '| (-) Descuentos Prioritarios (`SUBTOTAL_1`) | ' + formatCurrencyAuditGs_(analisisMargen.totalSubtotal1Desc) + ' | Aportes ley, OSER, SISER, vivienda/alimentaria |',
    '| **(=) `Subtotal1` (Bruto Depurado)** | **' + formatCurrencyAuditGs_(analisisMargen.subtotal1) + '** | `total_haberes - SUBTOTAL_1` |',
    '| (-) Reserva Tope (`Subtotal_tope` ' + Math.round(analisisMargen.porcentajeTope * 100) + '%) | ' + formatCurrencyAuditGs_(analisisMargen.subtotalTope) + ' | Reserva intocable (' + analisisMargen.etiquetaBeneficiario + ') |',
    '| **(=) `Subtotal2` (' + Math.round(analisisMargen.porcentajeAfectableMaximo * 100) + '% Máximo)** | **' + formatCurrencyAuditGs_(analisisMargen.subtotal2) + '** | `Subtotal1 - Subtotal_tope` |',
    '| (-) Haberes `NO_COMPUTABLE` | ' + formatCurrencyAuditGs_(analisisMargen.totalNoComputable) + ' | Sumas fijas no remun., salario fliar., SAC |',
    '| **(=) `Afectable` Real del Recibo** | **' + formatCurrencyAuditGs_(analisisMargen.afectable) + '** | `Subtotal2 - total_no_computable` |',
    '| (-) Descuentos `AFECTADO` (Mutuales/FEDEM) | ' + formatCurrencyAuditGs_(analisisMargen.totalAfectado) + ' | Suma códigos comerciales/financieros |',
    '| (-) Cuota Futura 2 | ' + formatCurrencyAuditGs_(analisisMargen.cuotaFutura2) + ' | Reserva operativa opcional |',
    '| **(=) `Disponible` Real del Recibo** | **' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + '** | `' + analisisMargen.estadoLabel + '` |',
    '| **Tope Endeudamiento (41,67% Neto Líquido)** | **' + formatCurrencyAuditGs_(analisisMargen.topeEndeudamientoMensual4167) + '** | `(5 × Neto Líquido) / 12` |',
    '| **Cuota Máxima Segura Real** | **' + formatCurrencyAuditGs_(analisisMargen.cuotaMaximaSeguraGeneral) + '** | `min(Disponible, Tope Endeudamiento)` |'
  ];

  if (ofertasPorPlazo.fedem.length > 0) {
    lineasMd.push('');
    lineasMd.push('**Oferta Máxima Estimada por Plazo (Línea FEDEM):**');
    lineasMd.push('| Plazo | Mult. Neto | Tope Cuota (41,67%) | Cuota Máxima Segura | Capital Máximo a Prestar |');
    lineasMd.push('| :--- | :---: | ---: | ---: | ---: |');
    for (let oi = 0; oi < ofertasPorPlazo.fedem.length; oi++) {
      const of = ofertasPorPlazo.fedem[oi];
      lineasMd.push('| ' + of.plazo + ' cuotas | ' + of.multiplicador + 'x | ' + formatCurrencyAuditGs_(of.topeEndeudamientoCuota) + ' | ' + formatCurrencyAuditGs_(of.cuotaMaximaReal) + ' | **' + formatCurrencyAuditGs_(of.neto) + '** |');
    }
  } else {
    lineasMd.push('');
    lineasMd.push('* **Ofertas de Cuotas:** 🔴 **SIN Disponible** (' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ') — Ofertas deshabilitadas.');
  }

  if (analisisMargen.alertas.length > 0) {
    lineasMd.push('');
    lineasMd.push('**Validaciones y Alertas Automáticas:**');
    for (let ai = 0; ai < analisisMargen.alertas.length; ai++) {
      lineasMd.push('* ⚠️ ' + analisisMargen.alertas[ai]);
    }
  }

  lineasMd.push('');
  lineasMd.push('#### 🛡️ 5. Calificación Crediticia AMMER (Scoring)');
  lineasMd.push('* **Score AMMER:** ' + scoreTotal + ' / 100 • **Calificación:** ' + calificacionLetra);
  lineasMd.push('* **Dictamen del Auditor:** ' + dictamenTextoFinal);

  if (conclusionesRecomendaciones && conclusionesRecomendaciones.titulo) {
    lineasMd.push('');
    lineasMd.push('#### 💡 Conclusiones y Recomendaciones (Incl. Refinanciación)');
    lineasMd.push('* **' + conclusionesRecomendaciones.titulo + ':** ' + conclusionesRecomendaciones.resumen);
    for (let ri = 0; ri < (conclusionesRecomendaciones.recomendaciones || []).length; ri++) {
      lineasMd.push('* ' + conclusionesRecomendaciones.recomendaciones[ri]);
    }
  }

  if (desgloseConceptos.rows.length > 0) {
    lineasMd.push('');
    lineasMd.push('#### 🧾 6. Transcripción Literal del Recibo (Detalle Completo de Conceptos y Clasificación Padrón)');
    lineasMd.push('* **Período:** ' + detalleCompletoRecibo.periodo + ' • **Escalafón / Cargo:** ' + detalleCompletoRecibo.escalafonCargo);
    lineasMd.push('');
    lineasMd.push('| Código | Concepto / Descripción | Haberes ($) | Descuentos ($) | Clasificación |');
    lineasMd.push('| :--- | :--- | ---: | ---: | :--- |');
    for (let k = 0; k < desgloseConceptos.rows.length; k++) {
      const cr = desgloseConceptos.rows[k];
      lineasMd.push('| ' + (cr.codigo || '—') + ' | ' + (cr.descripcion || '—') + ' | ' + (cr.haberes > 0 ? formatCurrencyAuditGs_(cr.haberes) : '—') + ' | ' + (cr.descuentos > 0 ? formatCurrencyAuditGs_(cr.descuentos) : '—') + ' | `' + cr.clasificacion + '` |');
    }
    lineasMd.push('| **TOTALES** | **SUBTOTALES Y LÍQUIDO EXACTO** | **' + formatCurrencyAuditGs_(sueldoBruto) + '** | **' + formatCurrencyAuditGs_(totalDescuentosRecibo) + '** | — |');
    lineasMd.push('| **NETO** | **LÍQUIDO A PAGAR EN CUENTA** | **' + formatCurrencyAuditGs_(sueldoLiquido) + '** | — | — |');
  }

  const informeMarkdown = lineasMd.join('\n');

  const pCalidad = (sueldoBruto !== null && sueldoLiquido !== null && totalDescuentosRecibo !== null) ? 19 : 10;
  const pVigencia = vigenciaBool ? 19 : 9;
  const pIdentidad = dniCoincideBool ? 29 : 10;
  const pFinanciera = Math.max(0, Math.min(30, scoreTotal - (pCalidad + pVigencia + pIdentidad)));

  const resumenJson = {
    resumenDecision: resumenDecision,
    detalleCompletoRecibo: detalleCompletoRecibo,
    analisisMargen: analisisMargen,
    ofertasPorPlazo: ofertasPorPlazo,
    conclusionesRecomendaciones: conclusionesRecomendaciones
  };

  const descuentosVoluntariosTotal = round2Audit_(
    (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
  );

  return {
    resumenDecision: resumenDecision,
    detalleCompletoRecibo: detalleCompletoRecibo,
    analisisMargen: analisisMargen,
    ofertasPorPlazo: ofertasPorPlazo,
    conclusionesRecomendaciones: conclusionesRecomendaciones,
    validaciones: analisisMargen.validaciones,
    alertas: analisisMargen.alertas,
    tipoBeneficiario: analisisMargen.tipoBeneficiario,
    lugarTrabajo: analisisMargen.lugarTrabajo,
    porcentajeTope: analisisMargen.porcentajeTope,
    estado: analisisMargen.estado,
    estadoLabel: analisisMargen.estadoLabel,
    scoringCrediticio: {
      puntajeTotal: scoreTotal,
      calificacionLetra: calificacionLetra,
      dictamen: dictamen,
      decisionPlanilla: decisionPlanilla,
      decisionAlternativaCBU: decisionAlternativaCBU,
      nivelConfianza: scRaw.nivelConfianza || (scoreTotal >= 80 ? 'ALTO' : (scoreTotal >= 60 ? 'MEDIO' : 'BAJO')),
      pilares: {
        calidadDocumental: { puntaje: pCalidad, maximo: 20, detalle: camposIlegibles.length ? ('Campos a revisar: ' + camposIlegibles.join(', ')) : 'Lectura literal verificada sin campos cortados o borrosos.' },
        vigenciaYFormalidad: { puntaje: pVigencia, maximo: 20, detalle: vigenciaBool ? ('Período ' + (vig.periodoLiquidado || '') + ' vigente según calendario.') : ('Período ' + (vig.periodoLiquidado || 'sin fecha') + ' observado.') },
        coincidenciaIdentidad: { puntaje: pIdentidad, maximo: 30, detalle: dniCoincideBool ? 'Identidad verificada en el comprobante.' : 'Discrepancia o ilegibilidad en cotejo de identidad.' },
        capacidadFinanciera: { puntaje: pFinanciera, maximo: 30, detalle: 'Afectable ' + analisisMargen.tipoBeneficiario + ' (' + formatCurrencyAuditGs_(analisisMargen.afectable) + ') vs Afectado (' + formatCurrencyAuditGs_(analisisMargen.totalAfectado) + ') → Disponible: ' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + '.' }
      }
    },
    reciboSueldo: {
      titular: titularStr,
      dni: dniStr,
      cuil: cuilStr || 'No consta en recibo',
      legajo: lab.legajo || '—',
      organismo: organismoStr,
      dependencia: lab.dependencia || '',
      escalafonCargo: escalafonCargoStr,
      cargo: escalafonCargoStr,
      situacionRevista: lab.situacionRevista || 'ACTIVO TITULAR',
      tipoBeneficiario: analisisMargen.tipoBeneficiario,
      lugarTrabajo: analisisMargen.lugarTrabajo,
      fechaIngreso: lab.fechaIngreso || 'No consta en recibo',
      antiguedadDetalle: antiguedadStr,
      antiguedadAnios: lab.antiguedadAnios !== undefined ? lab.antiguedadAnios : null,
      cumpleAntiguedadMinima: cumpleAntig,
      esSaludSuplenteDia19: Boolean(lab.esSaludSuplenteDia19),
      requiereSituacionSage: Boolean(lab.requiereSituacionSage),
      esInvalidezODiscapacidad: Boolean(lab.esInvalidezODiscapacidad),
      cumpleTopeEdad80: cumpleTopeEdad80,
      observacionesEspeciales: lab.observacionesEspeciales || '',
      periodo: periodoStr,
      estadoPeriodo: vig.estadoVigencia || 'VIGENTE',
      reciboVencido: !vigenciaBool,
      sueldoBruto: sueldoBruto !== null ? sueldoBruto : 0,
      descuentosLey: descuentosLey !== null ? descuentosLey : 0,
      consumosBersa: consumosBersa,
      consumosSidecreer: consumosSidecreer,
      otrasMutuales: otrasMutuales,
      codigosFedemMonto: codigosFedemMonto,
      codigosFedemDetectados: codigosFedemList,
      embargoDetectado: embargoDetectadoBool,
      embargoMonto: embargoMonto,
      embargoConcepto: embargoConceptoStr,
      descuentosPrestamosYMutuales: descuentosVoluntariosTotal,
      totalDescuentosRecibo: totalDescuentosRecibo !== null ? totalDescuentosRecibo : 0,
      sueldoNeto: sueldoLiquido !== null ? sueldoLiquido : 0,
      topeLegal50Porciento: cupoMaximoLegal !== null ? cupoMaximoLegal : 0,
      margenDisponibleCuota: analisisMargen.disponibleRecibo,
      cuotaMaximaSeguraGeneral: analisisMargen.cuotaMaximaSeguraGeneral,
      estadoAfectacion: estadoAfectacion,
      estadoAfectacionPlanilla: estadoAfectacionPlanilla,
      decisionPlanilla: decisionPlanilla,
      decisionAlternativaCBU: decisionAlternativaCBU,
      conceptos: desgloseConceptos.rows
    },
    dni: {
      numero: dniStr,
      nombreCompleto: titularStr,
      fechaNacimiento: idObj.fechaNacimiento || '',
      domicilio: idObj.domicilio || '',
      fechaVencimiento: idObj.fechaVencimientoDni || 'No consta en este comprobante',
      dniVigente: idObj.dniVigente !== false
    },
    cruceIdentidad: {
      estadoCotejo: estadoCotejo,
      coincideDni: dniCoincideBool,
      coincideNombre: dniCoincideBool,
      coincideCuil: dniCoincideBool,
      discrepanciasDetectadas: Array.isArray(idObj.detalleDiscrepancias) ? idObj.detalleDiscrepancias : []
    },
    alertasCriticas: alertasCriticas,
    camposIlegibles: camposIlegibles,
    observacionesAuditor: [
      'Organismo: ' + organismoStr + ' · Régimen: ' + analisisMargen.etiquetaBeneficiario + '.',
      'Decisión Planilla: ' + decisionPlanilla + ' | Alternativa CBU: ' + decisionAlternativaCBU + '.',
      'Disponible Recibo: ' + formatCurrencyAuditGs_(analisisMargen.disponibleRecibo) + ' | Cuota Máxima Segura (41,67% Neto): ' + formatCurrencyAuditGs_(analisisMargen.cuotaMaximaSeguraGeneral) + '.',
      lab.observacionesEspeciales || ''
    ].filter(Boolean),
    informeEjecutivo: dictamenTextoFinal,
    informeMarkdown: informeMarkdown,
    resumenJson: resumenJson
  };
}

function repararJSONTruncadoGs_(input) {
  const start = input.indexOf('{');
  if (start === -1) return null;
  const s = input.substring(start).trim();
  const stack = [];
  let inString = false;
  let escaped = false;
  let lastSafePos = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
        lastSafePos = i;
      }
    }
  }
  if (stack.length === 0 && !inString) return s;
  if (lastSafePos > 0) {
    const cut = s.substring(0, lastSafePos + 1).replace(/,\s*$/, '');
    const remStack = [];
    let strMode = false;
    let escMode = false;
    for (let j = 0; j < cut.length; j++) {
      const c = cut.charAt(j);
      if (strMode) {
        if (escMode) escMode = false;
        else if (c === '\\') escMode = true;
        else if (c === '"') strMode = false;
        continue;
      }
      if (c === '"') strMode = true;
      else if (c === '{') remStack.push('}');
      else if (c === '[') remStack.push(']');
      else if ((c === '}' || c === ']') && remStack[remStack.length - 1] === c) remStack.pop();
    }
    return cut + remStack.reverse().join('');
  }
  return null;
}

function limpiarYParsearJSONAuditoria_(rawText) {
  if (!rawText) return null;
  if (typeof rawText === 'object' && rawText !== null) return rawText;
  const limpio = String(rawText).replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(limpio);
  } catch (e1) {
    const primerBrk = limpio.indexOf('{');
    const ultimoBrk = limpio.lastIndexOf('}');
    if (primerBrk !== -1 && ultimoBrk > primerBrk) {
      const candidato = limpio.substring(primerBrk, ultimoBrk + 1).replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(candidato);
      } catch (e2) {
        try {
          return JSON.parse(candidato.replace(/[\r\n\t]/g, ' '));
        } catch (_) {}
      }
    }
    const reparado = repararJSONTruncadoGs_(limpio);
    if (reparado) {
      try {
        return JSON.parse(reparado.replace(/,\s*([}\]])/g, '$1'));
      } catch (__) {}
    }
  }
  return null;
}

function auditarLegajoConIA(payload) {
  const dataIn = payload || {};
  const resultadoEntrante = (dataIn.resultado || dataIn.auditoria) ? (dataIn.resultado || dataIn.auditoria) : null;

  if (resultadoEntrante) {
    const parsedEntrante = (typeof resultadoEntrante === 'string') ? limpiarYParsearJSONAuditoria_(resultadoEntrante) : resultadoEntrante;
    if (parsedEntrante) {
      persistirDictamenAuditoriaEnHoja_(dataIn.idSolicitud, parsedEntrante);
      return { ok: true, success: true, auditoria: parsedEntrante, resultado: parsedEntrante };
    }
  }

  const b64Directo = String(dataIn.fileBase64 || dataIn.base64Archivo || dataIn.base64 || '').trim();
  const nombreDirecto = dataIn.fileName || dataIn.nombreArchivo || 'documento_auditoria.pdf';
  const mimeDirecto = dataIn.mimeType || dataIn.tipoMime || 'application/pdf';

  let archivos = Array.isArray(dataIn.archivos)
    ? dataIn.archivos.filter(function(a) { return a && (a.fileBase64 || a.base64Archivo || a.base64 || (a.textoExtraido && String(a.textoExtraido).trim().length >= 50)); })
    : [];
  if (archivos.length === 0 && (b64Directo || (dataIn.textoExtraido && String(dataIn.textoExtraido).trim().length >= 50))) {
    archivos = [{
      nombre: nombreDirecto,
      fileName: nombreDirecto,
      mimeType: mimeDirecto,
      base64: b64Directo,
      fileBase64: b64Directo,
      textoExtraido: dataIn.textoExtraido || ''
    }];
  }

  if (archivos.length === 0) {
    return {
      ok: false,
      success: false,
      error: 'No se recibió el archivo en Base64 (fileBase64) para ejecutar la auditoría OCR.'
    };
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      ok: false,
      success: false,
      error: 'Falta configurar GEMINI_API_KEY en Propiedades del Script de Google Apps Script o utilizar el servidor institucional (/api/auditar-documentos).'
    };
  }

  const datosDeclaradosBase = dataIn.datosDeclarados || dataIn.datosContexto || null;
  const datosDeclarados = Object.assign({}, datosDeclaradosBase || {}, {
    cuotaFutura2: (dataIn.cuotaFutura2 !== undefined ? dataIn.cuotaFutura2 : (dataIn.cuota_futura_2 !== undefined ? dataIn.cuota_futura_2 : (datosDeclaradosBase && (datosDeclaradosBase.cuotaFutura2 ?? datosDeclaradosBase.cuota_futura_2)))) || 0,
    lugarTrabajo: dataIn.lugarTrabajo || dataIn.lugar_de_trabajo || (datosDeclaradosBase && (datosDeclaradosBase.lugarTrabajo || datosDeclaradosBase.lugar_de_trabajo)) || ''
  });
  const parts = [];
  archivos.forEach(function(arch) {
    if (!arch) return;
    const rawB64 = String(arch.base64 || '');
    const base64Pure = (rawB64.indexOf(',') !== -1 ? rawB64.split(',').pop() : rawB64).trim();
    if (base64Pure) {
      let mimeType = String(arch.mimeType || 'application/pdf').toLowerCase();
      if (mimeType.indexOf('pdf') !== -1) mimeType = 'application/pdf';
      else if (mimeType.indexOf('png') !== -1) mimeType = 'image/png';
      else if (mimeType.indexOf('webp') !== -1) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';

      // Esquema oficial Gemini REST API en camelCase estricto
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Pure
        }
      });
    }

    const txtExtra = arch.textoExtraido ? String(arch.textoExtraido).trim() : '';
    if (txtExtra.length >= 40) {
      parts.push({
        text: 'TEXTO COMPLEMENTARIO EXTRAÍDO (' + (arch.nombre || 'recibo.pdf') + '):\n"""\n' + txtExtra + '\n"""'
      });
    }
  });

  if (parts.length === 0) {
    return {
      ok: false,
      success: false,
      error: 'No se encontraron archivos binarios Base64 válidos para auditar.'
    };
  }

  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth() + 1;
  const anioActual = fechaActual.getFullYear();
  const fechaActualStr = String(fechaActual.getDate()).padStart(2, '0') + '/' + String(mesActual).padStart(2, '0') + '/' + anioActual;

  const promptAuditor = dataIn.promptInstruccion ? String(dataIn.promptInstruccion) : [
    'Actúa como Auditor Crediticio Forense de la Asociación Mutual Modelo de Entre Ríos (AMMER).',
    'FECHA DE AUDITORÍA: ' + fechaActualStr + ' (Mes ' + mesActual + '/' + anioActual + ')',
    '',
    'Analiza el recibo de haberes oficial de Entre Ríos adjunto (PDF o imagen) y genera la extracción completa con rigor matemático estricto para los dos bloques operativos:',
    '1. "resumenDecision": Datos clave para definir en 5 segundos si se aprueba por planilla, se rechaza o aplica alternativa condicionada por CBU (titular, dni, cuil, organismo, cargo, periodo, antiguedad, antiguedadApta, tipoRecibo, lugarTrabajo, sueldoBrutoTotal, descuentosLey, consumosBersa, consumosSidecreer, otrasMutualesOProveeduria, consumosFedem, totalDescuentos, sueldoLiquido, cupoMaximo50, margenDisponiblePlanilla, estadoAfectacion, embargosJudiciales, codigosFedemPrevios, decisionPlanilla, decisionAlternativaCBU, scoringSugerido).',
    '2. "detalleCompletoRecibo": Transcripción literal de CADA código, concepto/descripción e importe impreso en el recibo en el arreglo conceptos: [{ codigo, descripcion, haberes, descuentos }] sin omitir ningún renglón, más periodo, escalafonCargo y totales: { totalHaberes, totalDescuentos, liquidoAPagar }.',
    '',
    'ANCLAS EXACTAS Y CALIBRACIÓN RECIBOS OFICIALES DE ENTRE RÍOS (Policía, CGE, Salud, Administración Central, Municipios, Caja de Jubilaciones):',
    '- Busca explícitamente las etiquetas "TOTAL HABERES" (asígnalo a sueldoBrutoTotal y totales.totalHaberes), "TOTAL DESCUENTOS" (asígnalo a totalDescuentosRecibo y totales.totalDescuentos) y "LÍQUIDO A PAGAR" / "NETO A COBRAR" (asígnalo a sueldoLiquido y totales.liquidoAPagar).',
    '- Identifica con exactitud "tipoRecibo" ("PASIVO" para Caja de Jubilaciones / Jubilados / Pensionados, "ACTIVO" para el resto), "lugarTrabajo" ("JU_" Jubilados, "PO_" Policía/Penitenciario, "SA_" Salud, "SG_" Educación/CGE, "VI_" Vialidad, "GE_" Escalafón General) y "formatoRecibo" ("Ultimo recibo SUELDO - Formato 2025", "Recibos Jubilados 2025" o "Municipal").',
    '- Extrae la lista COMPLETA de conceptos en detalleCompletoRecibo.conceptos sin omitir ni resumir ningún código.',
    '- Descuentos de Ley (descuentosLey): Jubilación (Cód. 502), Obra Social IOSPER/OSER (Cód. 505), Seguros obligatorios (Códs. 510, 524, 327) y Ley 4035.',
    '- Consumos / Proveeduría / Mutuales: MUPER (Cód. 491) u otras mutuales en otrasMutuales; códigos oficiales FEDEM (366/368 Activos o 1115/1117 Pasivos) en codigosFedemMonto; BERSA en consumosBersa; SIDECREER en consumosSidecreer.',
    '- CERO ALUCINACIÓN SIN FALSOS POSITIVOS: Prohibido inventar o redondear cifras. Si un concepto opcional no figura en el recibo, consigna 0.00 (y embargoDetectado: false).',
    '',
    datosDeclaradosBase
      ? ('CARÁTULA DECLARADA: Nombre="' + (datosDeclaradosBase.nombre || 'NO INFORMADO') + '", DNI="' + (datosDeclaradosBase.dni || 'NO INFORMADO') + '", Organismo="' + (datosDeclaradosBase.organismo || 'NO INFORMADO') + '", Cuota=' + (datosDeclaradosBase.cuota || 0) + ', Plazo=' + (datosDeclaradosBase.plazoCuotas || 0))
      : 'NO SE ENVIÓ CARÁTULA PREVIA. Indica estadoCotejoCaratula: "VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)" y extrae los datos literales del comprobante.',
    '',
    'Devuelve exclusivamente JSON puro (sin ```json ni texto extra) con la estructura: { tipoRecibo, lugarTrabajo, formatoRecibo, identidad: { titularDetectado, dni, cuil, fechaNacimiento, domicilio, fechaVencimientoDni, dniVigente, estadoCotejoCaratula, detalleDiscrepancias }, datosLaborales: { organismoEmpleador, dependencia, legajo, escalafonCargo, situacionRevista, fechaIngreso, antiguedadDetalle, antiguedadAnios, cumpleAntiguedadMinima, esSaludSuplenteDia19, requiereSituacionSage, esInvalidezODiscapacidad, cumpleTopeEdad80, observacionesEspeciales }, vigenciaRecibo: { periodoLiquidado, estadoVigencia, esVigente }, radiografiaSalarial: { sueldoBrutoTotal, descuentosLey, consumosBersa, consumosSidecreer, otrasMutuales, codigosFedemMonto, codigosFedemDetectados, embargoDetectado, embargoMonto, embargoConcepto, totalDescuentosRecibo, sueldoLiquido }, detalleCompletoRecibo: { periodo, escalafonCargo, conceptos: [{ codigo, descripcion, haberes, descuentos }], totales: { totalHaberes, totalDescuentos, liquidoAPagar } }, scoringAmmer: { puntajeTotal, calificacionLetra, dictamen, decisionPlanilla, decisionAlternativaCBU, nivelConfianza, dictamenAuditor, alertasCriticas, camposIlegibles } }.'
  ].join('\n');

  parts.push({ text: promptAuditor });

  try {
    const intentosEndpoints = [
      {
        nombre: 'gemini-2.5-flash (v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey)
      },
      {
        nombre: 'gemini-4-hydrogen (v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent?key=' + encodeURIComponent(apiKey)
      },
      {
        nombre: 'gemini-3.1-flash-lite (v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + encodeURIComponent(apiKey)
      },
      {
        nombre: 'gemini-2.5-pro (v1beta)',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + encodeURIComponent(apiKey)
      },
      {
        nombre: 'gemini-2.5-flash (v1)',
        url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey)
      }
    ];

    const payloadGemini = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    let mapped = null;
    let ultimoErrorHttp = '';

    for (let idxMod = 0; idxMod < intentosEndpoints.length; idxMod++) {
      const intento = intentosEndpoints[idxMod];
      const resp = UrlFetchApp.fetch(intento.url, {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify(payloadGemini)
      });

      const code = resp.getResponseCode();
      const rawRespText = resp.getContentText() || '{}';
      if (code >= 200 && code < 300) {
        const geminiJson = limpiarYParsearJSONAuditoria_(rawRespText);
        const partsResp = geminiJson && geminiJson.candidates && geminiJson.candidates[0] &&
          geminiJson.candidates[0].content && geminiJson.candidates[0].content.parts;
        const candidateText = Array.isArray(partsResp)
          ? partsResp.map(function(p) { return (p && p.text) ? String(p.text) : ''; }).join('\n').trim()
          : '';

        if (!candidateText) {
          ultimoErrorHttp = 'Modelo ' + intento.nombre + ' devolvió respuesta vacía.';
          continue;
        }

        const dataParsed = limpiarYParsearJSONAuditoria_(candidateText);
        if (!dataParsed) {
          ultimoErrorHttp = 'Modelo ' + intento.nombre + ' devolvió JSON incompleto.';
          continue;
        }

        const candidatoMapped = mapearAuditoriaEnAppsScript_(dataParsed, datosDeclarados);
        const conceptosCand = (candidatoMapped && candidatoMapped.detalleCompletoRecibo && Array.isArray(candidatoMapped.detalleCompletoRecibo.conceptos))
          ? candidatoMapped.detalleCompletoRecibo.conceptos
          : [];
        const conceptosConImporte = conceptosCand.filter(function(c) {
          return Number((c && c.haberes) || 0) > 0 || Number((c && c.descuentos) || 0) > 0;
        });
        const tieneDatosSalariales = Boolean(
          candidatoMapped && candidatoMapped.resumenDecision &&
          (Number(candidatoMapped.resumenDecision.sueldoBrutoTotal || 0) > 0 ||
           Number(candidatoMapped.resumenDecision.sueldoLiquido || 0) > 0 ||
           conceptosConImporte.length > 0)
        );

        if (tieneDatosSalariales) {
          mapped = candidatoMapped;
          break;
        }
        ultimoErrorHttp = 'No se detectaron importes salariales ni conceptos legibles en el comprobante enviado (' + intento.nombre + ').';
      } else {
        ultimoErrorHttp = 'Modelo ' + intento.nombre + ' devolvió HTTP ' + code + ': ' + rawRespText.slice(0, 220);
      }
    }

    if (!mapped) {
      return {
        ok: false,
        success: false,
        error: ultimoErrorHttp || 'No se detectaron importes salariales ni conceptos legibles en el comprobante enviado. Verifique que sea un recibo de sueldo nítido.'
      };
    }

    persistirDictamenAuditoriaEnHoja_(dataIn.idSolicitud, mapped);

    return {
      ok: true,
      success: true,
      data: mapped,
      auditoria: mapped,
      resultado: mapped,
      resumenDecision: mapped.resumenDecision,
      detalleCompletoRecibo: mapped.detalleCompletoRecibo,
      analisisMargen: mapped.analisisMargen,
      ofertasPorPlazo: mapped.ofertasPorPlazo,
      validaciones: mapped.validaciones,
      alertas: mapped.alertas,
      resumenJson: mapped.resumenJson,
      informeMarkdown: mapped.informeMarkdown
    };
  } catch (err) {
    return {
      ok: false,
      success: false,
      error: 'Error al auditar documentación en Apps Script: ' + (err && err.message ? err.message : String(err))
    };
  }
}
