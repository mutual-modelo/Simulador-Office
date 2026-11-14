/**
 * ============================================================================
 * BACKEND CENTRALIZADO - SIMULADOR-OFFICE (MUTUAL MODELO DE ENTRE RÍOS)
 * Google Apps Script V8 | Google Sheets + Google Drive + Auditoría IA
 * ============================================================================
 */

const CONFIG_AMMER = {
  SHEET_SOLICITUDES: 'Solicitudes_Ayudas',
  SHEET_USUARIOS: 'Usuarios',
  SHEET_ASOCIADOS: 'Padron_Asociados',
  DRIVE_ROOT_NAME: 'Mutual Modelo - Legajos Digitales',
  SPREADSHEET_NAME: 'Mutual_Modelo_Simulador_Office_DB'
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
  'Activo'
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
        return crearRespuestaJSON(actualizarEstadoSolicitudBackend(payload));

      case 'reasignarAnalista':
        return crearRespuestaJSON(reasignarAnalistaBackend(payload));

      case 'agregarComentario':
        return crearRespuestaJSON(agregarComentarioBackend(payload));

      case 'guardarAuditoriaEnHistorial':
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
  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (_) {}
  }

  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {}

  if (!ss) {
    const files = DriveApp.getFilesByName(CONFIG_AMMER.SPREADSHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.openById(files.next().getId());
    } else {
      ss = SpreadsheetApp.create(CONFIG_AMMER.SPREADSHEET_NAME);
    }
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
  const nombreSeguro = String(apellidoNombre || 'Socio').replace(/[\\/:*?"<>|]/g, '').trim();
  const prefijo = String(idSolicitud || '').trim();
  const alt = String(idAlternativo || '').trim();
  const nombreCarpeta = prefijo + ' - ' + nombreSeguro + (dni ? (' (' + dni + ')') : '');

  const coincidePrefijo = (fname, p) => {
    if (!p) return false;
    return fname === p || fname.indexOf(p + ' -') === 0 || fname.indexOf(p + ' ') === 0;
  };

  let folderAlt = null;
  const iter = root.getFolders();
  while (iter.hasNext()) {
    const f = iter.next();
    const fname = f.getName();
    if (fname === nombreCarpeta || coincidePrefijo(fname, prefijo)) {
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
   3. AUTENTICACIÓN Y USUARIOS
   ============================================================================ */
function autenticarUsuario(payload) {
  const userInput = String(payload.usuario || payload.email || '').trim().toLowerCase();
  const passInput = String(payload.password || payload.clave || '').trim();
  if (!userInput || !passInput) {
    return { ok: false, error: 'Debe ingresar usuario y contraseña.' };
  }

  const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_USUARIOS, HEADERS_USUARIOS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { ok: false, error: 'No hay usuarios configurados en la hoja Usuarios.' };
  }

  const { map } = obtenerHeaderMap_(sheet);
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const uLogin = String(row[map['Usuario']] || '').trim().toLowerCase();
    const uEmail = String(row[map['Email']] || '').trim().toLowerCase();
    const uPass = String(row[map['Password']] || '').trim();
    const activo = String(row[map['Activo']] === undefined ? 'SI' : row[map['Activo']]).trim().toLowerCase();

    if ((uLogin === userInput || uEmail === userInput) && uPass === passInput) {
      if (activo === 'no' || activo === 'false' || activo === '0') {
        return { ok: false, error: 'El usuario se encuentra inactivo.' };
      }
      const esTitular = ['si', 'sí', 'true', '1', 'x'].indexOf(String(row[map['Es_Titular']] || '').trim().toLowerCase()) !== -1;
      const usuarioObj = {
        id: String(row[map['ID_Usuario']] || ('USR-' + i)),
        usuario: uLogin || uEmail,
        email: uEmail || uLogin,
        nombre: String(row[map['Nombre']] || uLogin),
        rol: String(row[map['Rol']] || 'Comercializador'),
        idOrganizacion: String(row[map['ID_Organizacion']] || 'org_parana_centro'),
        organizacion_id: String(row[map['ID_Organizacion']] || 'org_parana_centro'),
        nombreOrganizacion: String(row[map['Nombre_Organizacion']] || 'Organización Paraná Centro'),
        nombre_organizacion: String(row[map['Nombre_Organizacion']] || 'Organización Paraná Centro'),
        esTitular: esTitular,
        es_titular_organizacion: esTitular
      };
      return { ok: true, usuario: usuarioObj };
    }
  }

  return { ok: false, error: 'Usuario o contraseña incorrectos.' };
}

function obtenerListaAnalistas() {
  const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_USUARIOS, HEADERS_USUARIOS);
  const data = sheet.getDataRange().getValues();
  const { map } = obtenerHeaderMap_(sheet);
  const analistas = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rol = String(row[map['Rol']] || '').toLowerCase();
    const activo = String(row[map['Activo']] === undefined ? 'SI' : row[map['Activo']]).trim().toLowerCase();
    if (activo === 'no' || activo === 'false' || activo === '0') continue;
    if (rol.indexOf('analista') !== -1 || rol.indexOf('admin') !== -1 || rol.indexOf('mutual') !== -1) {
      analistas.push({
        id: String(row[map['ID_Usuario']] || ''),
        nombre: String(row[map['Nombre']] || ''),
        usuario: String(row[map['Usuario']] || ''),
        rol: String(row[map['Rol']] || '')
      });
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
      // Filas antiguas sin idAsesor se conservan visibles para auditoría
      if (!itemAsesorId || itemAsesorId === 'USR-000') return true;

      const esOriginador = Boolean(
        (userId && itemAsesorId === userId) ||
        (miNombre && (itemNombreAsesor === miNombre || itemNombreRaw === miNombre))
      );
      const estaAsignadoAMi = Boolean(miNombre && itemAnalista === miNombre);
      const esDeComercializador =
        itemCanal.indexOf('comercial') !== -1 ||
        itemCanal.indexOf('externo') !== -1 ||
        (itemOrgId !== '' && itemOrgId.indexOf('mutual') === -1 && itemOrgId.indexOf('central') === -1);

      return esOriginador || estaAsignadoAMi || esDeComercializador;
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

    const nowStr = obtenerFechaHora24Argentina_();
    if (map['Estado_Tramite'] !== undefined && payload.estado) {
      sheet.getRange(rowNum, map['Estado_Tramite'] + 1).setValue(String(payload.estado));
    }
    if (map['Analista_Asignado'] !== undefined && payload.analista) {
      sheet.getRange(rowNum, map['Analista_Asignado'] + 1).setValue(String(payload.analista));
    }
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    if (payload.comentario && map['Historial_Comentarios_JSON'] !== undefined) {
      const cell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(cell.getValue(), []);
      hist.push({
        autor: payload.analista || (payload.usuarioActivo && payload.usuarioActivo.nombre) || 'Analista Mutual',
        rol: 'Analista Mutual',
        fecha: nowStr,
        texto: String(payload.comentario)
      });
      cell.setValue(JSON.stringify(hist));
    }

    SpreadsheetApp.flush();
    return { ok: true, id: idTarget, estado: payload.estado };
  } finally {
    lock.releaseLock();
  }
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
    if (map['Historial_Comentarios_JSON'] !== undefined) {
      const cell = sheet.getRange(rowNum, map['Historial_Comentarios_JSON'] + 1);
      const hist = parseJSONSafe_(cell.getValue(), []);
      hist.push({
        autor: payload.autor || 'Usuario',
        rol: payload.rol || 'Analista',
        fecha: nowStr,
        texto: String(payload.texto || '')
      });
      cell.setValue(JSON.stringify(hist));
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

    if (map['Dictamen_IA_JSON'] !== undefined && resumenObj) {
      const prevDictamen = parseJSONSafe_(sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).getValue(), null);
      sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).setValue(JSON.stringify({
        estado: 'completado',
        fechaFin: nowStr,
        usuarioOperador: operador,
        resumenAuditoria: resumenObj,
        resultado: (prevDictamen && prevDictamen.resultado) ? prevDictamen.resultado : resumenObj
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
        resultado: resultadoAudit
      }));
      SpreadsheetApp.flush();
    }
  } catch (_) {}
}

function round2Audit_(n) {
  return Math.round(Number(n) * 100) / 100;
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
    s = s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return (!isNaN(n) && isFinite(n)) ? round2Audit_(n) : null;
}

function clasificarConceptosReciboGs_(conceptosRaw) {
  const rows = Array.isArray(conceptosRaw) ? conceptosRaw.map(function(c) {
    let habNum = limpiarMontoNullGs_(c && (c.haberes !== undefined ? c.haberes : (c.montoHaber !== undefined ? c.montoHaber : c.importeHaber)));
    let descNum = limpiarMontoNullGs_(c && (c.descuentos !== undefined ? c.descuentos : (c.retenciones !== undefined ? c.retenciones : c.montoDescuento)));
    const montoUnico = limpiarMontoNullGs_(c && (c.monto !== undefined ? c.monto : c.importe));
    if (habNum === null && descNum === null && montoUnico !== null && montoUnico > 0) {
      const tipoStr = String((c && (c.tipo || c.columna)) || '').toUpperCase();
      if (tipoStr.indexOf('DESC') !== -1 || tipoStr.indexOf('RETEN') !== -1 || tipoStr.indexOf('DEDU') !== -1) {
        descNum = montoUnico;
      } else {
        habNum = montoUnico;
      }
    }
    return {
      codigo: String((c && c.codigo !== undefined && c.codigo !== null) ? c.codigo : '').trim(),
      descripcion: String((c && (c.descripcion || c.concepto || c.detalle)) || '').trim(),
      haberes: habNum !== null ? round2Audit_(Math.max(0, habNum)) : 0,
      descuentos: descNum !== null ? round2Audit_(Math.max(0, descNum)) : 0
    };
  }).filter(function(r) {
    return Boolean(r.codigo || r.descripcion || r.haberes > 0 || r.descuentos > 0);
  }) : [];

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

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    sumHaberes = round2Audit_(sumHaberes + r.haberes);
    sumDescuentos = round2Audit_(sumDescuentos + r.descuentos);
    if (r.descuentos <= 0) continue;

    const codClean = r.codigo.replace(/^0+/, '') || r.codigo;
    const descUp = r.descripcion.toUpperCase();

    if (['366', '368', '1115', '1117'].indexOf(codClean) !== -1 || descUp.indexOf('FEDEM') !== -1) {
      calcFedem = round2Audit_(calcFedem + r.descuentos);
      const lbl = r.codigo ? (r.codigo + ' (' + (r.descripcion || 'FEDEM') + ')') : (r.descripcion || 'FEDEM');
      if (fedemCodes.indexOf(lbl) === -1) fedemCodes.push(lbl);
    } else if (/EMBARGO|JUDICIAL|ALIMENTO|LITIS|OFICIO/.test(descUp)) {
      calcEmbargo = round2Audit_(calcEmbargo + r.descuentos);
      if (r.descripcion) embargoDescs.push(r.descripcion);
    } else if (/SIDECREER/.test(descUp)) {
      calcSidecreer = round2Audit_(calcSidecreer + r.descuentos);
    } else if (/BERSA|BANCO ENTRE RIOS|NUEVO BANCO/.test(descUp)) {
      calcBersa = round2Audit_(calcBersa + r.descuentos);
    } else if (
      ['502', '505', '510', '524', '327'].indexOf(codClean) !== -1 ||
      /JUBILAC|CAJA JUB|IOSPER|OSER|OBRA SOCIAL|LEY 4035|SEGURO.*OBLIG|APORTE PERSONAL|FONDO SOLIDARIO/.test(descUp)
    ) {
      calcLey = round2Audit_(calcLey + r.descuentos);
    } else {
      calcMutuales = round2Audit_(calcMutuales + r.descuentos);
    }
  }

  return {
    rows: rows,
    sumHaberes: rows.length > 0 ? sumHaberes : null,
    sumDescuentos: rows.length > 0 ? sumDescuentos : null,
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
  const desgloseConceptos = clasificarConceptosReciboGs_(detRecIn.conceptos || rawIn.conceptos);

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
    descuentosLey: resDecIn.descuentosLey ?? desgloseConceptos.calcLey,
    consumosBersa: resDecIn.consumosBersa ?? desgloseConceptos.calcBersa,
    consumosSidecreer: resDecIn.consumosSidecreer ?? desgloseConceptos.calcSidecreer,
    otrasMutuales: resDecIn.otrasMutualesOProveeduria ?? resDecIn.otrasMutuales ?? desgloseConceptos.calcMutuales,
    codigosFedemMonto: resDecIn.consumosFedem ?? resDecIn.codigosFedemMonto ?? desgloseConceptos.calcFedem,
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

  let descuentosLey = toNumOrNull(sal.descuentosLey);
  if ((descuentosLey === null || descuentosLey === 0) && desgloseConceptos.calcLey > 0) descuentosLey = desgloseConceptos.calcLey;

  let consumosBersa = toNumOrNull(sal.consumosBersa ?? sal.consumosBancariosBersa);
  if ((consumosBersa === null || consumosBersa === 0) && desgloseConceptos.calcBersa > 0) consumosBersa = desgloseConceptos.calcBersa;

  let consumosSidecreer = toNumOrNull(sal.consumosSidecreer);
  if ((consumosSidecreer === null || consumosSidecreer === 0) && desgloseConceptos.calcSidecreer > 0) consumosSidecreer = desgloseConceptos.calcSidecreer;

  let otrasMutuales = toNumOrNull(sal.otrasMutuales ?? sal.otrasMutualesOProveeduria);
  if ((otrasMutuales === null || otrasMutuales === 0) && desgloseConceptos.calcMutuales > 0) otrasMutuales = desgloseConceptos.calcMutuales;

  let codigosFedemMonto = toNumOrNull(sal.codigosFedemMonto ?? sal.consumosFedem);
  if ((codigosFedemMonto === null || codigosFedemMonto === 0) && desgloseConceptos.calcFedem > 0) codigosFedemMonto = desgloseConceptos.calcFedem;

  let embargoMonto = toNumOrNull(sal.embargoMonto);
  if ((embargoMonto === null || embargoMonto === 0) && desgloseConceptos.calcEmbargo > 0) embargoMonto = desgloseConceptos.calcEmbargo;

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

  const cupoMaximoLegal = sueldoBruto !== null ? round2Audit_(sueldoBruto * 0.50) : null;
  const margenDisponibleMensual = (cupoMaximoLegal !== null && totalDescuentosRecibo !== null)
    ? round2Audit_(cupoMaximoLegal - totalDescuentosRecibo)
    : null;

  const cuotaSimulada = Number((datosDeclarados && datosDeclarados.cuota) || 0);
  const alertasCriticas = Array.isArray(scRaw.alertasCriticas) ? scRaw.alertasCriticas.slice() : [];
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
  } else if (margenDisponibleMensual <= 0 || (cuotaSimulada > 0 && margenDisponibleMensual < cuotaSimulada)) {
    estadoAfectacion = 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA';
    estadoAfectacionPlanilla = margenDisponibleMensual < 0
      ? 'SALDO NEGATIVO POR PLANILLA'
      : 'CUPO INSUFICIENTE POR PLANILLA';
    alertasCriticas.push(
      cuotaSimulada > 0
        ? ('Margen disponible por planilla (' + formatCurrencyAuditGs_(margenDisponibleMensual) + ') insuficiente para cuota simulada (' + formatCurrencyAuditGs_(cuotaSimulada) + ').')
        : ('Margen disponible por planilla negativo o agotado (' + formatCurrencyAuditGs_(margenDisponibleMensual) + ').')
    );
  }

  const cumpleTopeEdad80 = lab.cumpleTopeEdad80 !== undefined ? lab.cumpleTopeEdad80 : null;
  const esPasivo = String(lab.situacionRevista || '').toUpperCase().indexOf('PASIVO') !== -1;

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
  } else if (tieneExclusionDura || margenDisponibleMensual <= 0 || (cuotaSimulada > 0 && margenDisponibleMensual < cuotaSimulada)) {
    decisionPlanilla = 'RECHAZADO / CUPO EXCEDIDO';
    if (tieneExclusionDura && margenDisponibleMensual > 0) {
      decisionPlanilla = 'RECHAZADO / RESTRICCIÓN REGLAMENTARIA';
    }
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

  let scoreTotal = typeof scRaw.puntajeTotal === 'number' ? Math.max(0, Math.min(100, Math.round(scRaw.puntajeTotal))) : (lecturaSalarialPrincipalOk ? 85 : 55);
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
      scoreTotal = Math.min(scoreTotal, 45);
    }
  }

  if ((sueldoBruto === null || sueldoLiquido === null || totalDescuentosRecibo === null) && dictamen === 'APTO_OTORGAMIENTO') {
    dictamen = 'OBSERVADO';
    scoreTotal = Math.min(scoreTotal, 65);
  }

  const calificacionLetra = scoreTotal >= 80
    ? 'A (Riesgo Bajo)'
    : (scoreTotal >= 60 ? 'B (Riesgo Moderado)' : 'C (Riesgo Crítico / No Viable)');

  const codigosFedemList = (Array.isArray(sal.codigosFedemDetectados) && sal.codigosFedemDetectados.length > 0)
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
  const antiguedadStr = String(lab.antiguedadDetalle || 'No registrada').trim();

  const resumenDecision = {
    titular: titularStr,
    dni: dniStr,
    cuil: cuilStr,
    organismo: organismoStr,
    cargo: escalafonCargoStr,
    periodo: periodoStr,
    antiguedad: antiguedadStr,
    antiguedadApta: cumpleAntig,
    sueldoBrutoTotal: sueldoBruto !== null ? sueldoBruto : 0,
    descuentosLey: descuentosLey !== null ? descuentosLey : 0,
    consumosBersa: consumosBersa || 0,
    consumosSidecreer: consumosSidecreer || 0,
    otrasMutualesOProveeduria: otrasMutuales || 0,
    consumosFedem: codigosFedemMonto || 0,
    totalDescuentos: totalDescuentosRecibo !== null ? totalDescuentosRecibo : 0,
    sueldoLiquido: sueldoLiquido !== null ? sueldoLiquido : 0,
    cupoMaximo50: cupoMaximoLegal !== null ? cupoMaximoLegal : 0,
    margenDisponiblePlanilla: margenDisponibleMensual !== null ? margenDisponibleMensual : 0,
    estadoAfectacion: estadoAfectacionPlanilla,
    embargosJudiciales: embargoDetectadoBool,
    codigosFedemPrevios: codigosFedemPrevios,
    decisionPlanilla: decisionPlanilla,
    decisionAlternativaCBU: decisionAlternativaCBU,
    scoringSugerido: scoreTotal
  };

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
  const afectacionMd = estadoAfectacion === 'MARGEN DISPONIBLE'
    ? '🟢 MARGEN DISPONIBLE POR PLANILLA'
    : (estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA' ? ('🔴 ' + estadoAfectacionPlanilla) : ('⚠️ ' + estadoAfectacion));

  const dictamenTextoFinal = scRaw.dictamenAuditor ||
    (decisionPlanilla === 'APTO POR PLANILLA'
      ? ('APTO POR PLANILLA: Margen disponible de ' + formatCurrencyAuditGs_(margenDisponibleMensual) + ' dentro del tope legal del 50%. Legajo sin embargos ni observaciones excluyentes.')
      : (aplicaAlternativaCbu
        ? ('PLANILLA EXCEDIDA (' + formatCurrencyAuditGs_(margenDisponibleMensual) + ') por deducciones voluntarias, sin embargos judiciales. ' + decisionAlternativaCBU + ' para evaluar vía Débito CBU / Sidecreer o cancelación.')
        : ('NO VIABLE: ' + (alertasCriticas[0] || 'Restricción crediticia o margen agotado') + '. Revisar antes de otorgar.')));

  const lineasMd = [
    '### 📑 INFORME DE AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER',
    '---',
    '',
    '#### ⚡ Resumen Ejecutivo de Decisión (5 Segundos)',
    '* **Decisión Descuento por Planilla:** **' + decisionPlanilla + '** (' + afectacionMd + ')',
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
    '| **Descuentos de Ley** | ' + formatCurrencyAuditGs_(descuentosLey) + ' | Jubilación, IOSPER, Ley 4035 |',
    '| **Consumos BERSA / Préstamos** | ' + formatCurrencyAuditGs_(consumosBersa) + ' | Retenciones bancarias |',
    '| **Consumos SIDECREER** | ' + formatCurrencyAuditGs_(consumosSidecreer) + ' | Descuento por tarjeta oficial |',
    '| **Otras Mutuales / Proveeduría** | ' + formatCurrencyAuditGs_(otrasMutuales) + ' | Descuentos por código voluntario |',
    '| **Códigos FEDEM Activos** | ' + formatCurrencyAuditGs_(codigosFedemMonto) + ' | ' + fedemObs + ' |',
    '| **Total Descuentos en Recibo** | ' + formatCurrencyAuditGs_(totalDescuentosRecibo) + ' | Deducciones consolidadas |',
    '| **Sueldo Líquido de Bolsillo** | ' + formatCurrencyAuditGs_(sueldoLiquido) + ' | Neto final a cobrar |',
    '',
    '* **Embargos Judiciales / Inhibiciones:** ' + embargoMd,
    '',
    '#### 📊 4. Análisis de Afectación Salarial y Margen',
    '* **Cupo Máximo Legal (50% del Bruto):** ' + formatCurrencyAuditGs_(cupoMaximoLegal),
    '* **Margen Disponible por Planilla:** ' + formatCurrencyAuditGs_(margenDisponibleMensual),
    '* **Estado de Afectación:** ' + afectacionMd,
    '',
    '#### 🛡️ 5. Calificación Crediticia AMMER (Scoring)',
    '* **Score AMMER:** ' + scoreTotal + ' / 100 • **Calificación:** ' + calificacionLetra,
    '* **Dictamen del Auditor:** ' + dictamenTextoFinal
  ];

  if (desgloseConceptos.rows.length > 0) {
    lineasMd.push('');
    lineasMd.push('#### 🧾 6. Transcripción Literal del Recibo (Detalle Completo de Conceptos)');
    lineasMd.push('* **Período:** ' + detalleCompletoRecibo.periodo + ' • **Escalafón / Cargo:** ' + detalleCompletoRecibo.escalafonCargo);
    lineasMd.push('');
    lineasMd.push('| Código | Concepto / Descripción | Haberes ($) | Descuentos ($) |');
    lineasMd.push('| :--- | :--- | ---: | ---: |');
    for (let k = 0; k < desgloseConceptos.rows.length; k++) {
      const cr = desgloseConceptos.rows[k];
      lineasMd.push('| ' + (cr.codigo || '—') + ' | ' + (cr.descripcion || '—') + ' | ' + (cr.haberes > 0 ? formatCurrencyAuditGs_(cr.haberes) : '—') + ' | ' + (cr.descuentos > 0 ? formatCurrencyAuditGs_(cr.descuentos) : '—') + ' |');
    }
    lineasMd.push('| **TOTALES** | **SUBTOTALES Y LÍQUIDO EXACTO** | **' + formatCurrencyAuditGs_(sueldoBruto) + '** | **' + formatCurrencyAuditGs_(totalDescuentosRecibo) + '** |');
    lineasMd.push('| **NETO** | **LÍQUIDO A PAGAR EN CUENTA** | **' + formatCurrencyAuditGs_(sueldoLiquido) + '** | — |');
  }

  const informeMarkdown = lineasMd.join('\n');

  const pCalidad = (sueldoBruto !== null && sueldoLiquido !== null && totalDescuentosRecibo !== null) ? 19 : 10;
  const pVigencia = vigenciaBool ? 19 : 9;
  const pIdentidad = dniCoincideBool ? 29 : 10;
  const pFinanciera = Math.max(0, Math.min(30, scoreTotal - (pCalidad + pVigencia + pIdentidad)));

  const resumenJson = {
    resumenDecision: resumenDecision,
    detalleCompletoRecibo: detalleCompletoRecibo
  };

  const descuentosVoluntariosTotal = round2Audit_(
    (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
  );

  return {
    resumenDecision: resumenDecision,
    detalleCompletoRecibo: detalleCompletoRecibo,
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
        capacidadFinanciera: { puntaje: pFinanciera, maximo: 30, detalle: 'Tope 50% Bruto (' + formatCurrencyAuditGs_(cupoMaximoLegal) + ') vs Descuentos (' + formatCurrencyAuditGs_(totalDescuentosRecibo) + ').' }
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
      margenDisponibleCuota: margenDisponibleMensual !== null ? margenDisponibleMensual : 0,
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
      'Organismo: ' + organismoStr + ' (' + (lab.situacionRevista || 'ACTIVO TITULAR') + ').',
      'Decisión Planilla: ' + decisionPlanilla + ' | Alternativa CBU: ' + decisionAlternativaCBU + '.',
      'Cupo Máximo Legal (50% del Bruto): ' + formatCurrencyAuditGs_(cupoMaximoLegal) + ' | Margen Disponible: ' + formatCurrencyAuditGs_(margenDisponibleMensual) + '.',
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

  const datosDeclarados = dataIn.datosDeclarados || dataIn.datosContexto || null;
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
    '1. "resumenDecision": Datos clave para definir en 5 segundos si se aprueba por planilla, se rechaza o aplica alternativa condicionada por CBU (titular, dni, cuil, organismo, cargo, periodo, antiguedad, antiguedadApta, sueldoBrutoTotal, descuentosLey, consumosBersa, consumosSidecreer, otrasMutualesOProveeduria, consumosFedem, totalDescuentos, sueldoLiquido, cupoMaximo50, margenDisponiblePlanilla, estadoAfectacion, embargosJudiciales, codigosFedemPrevios, decisionPlanilla, decisionAlternativaCBU, scoringSugerido).',
    '2. "detalleCompletoRecibo": Transcripción literal de CADA código, concepto/descripción e importe impreso en el recibo en el arreglo conceptos: [{ codigo, descripcion, haberes, descuentos }] sin omitir ningún renglón, más periodo, escalafonCargo y totales: { totalHaberes, totalDescuentos, liquidoAPagar }.',
    '',
    'ANCLAS EXACTAS Y CALIBRACIÓN RECIBOS OFICIALES DE ENTRE RÍOS (Policía, CGE, Salud, Administración Central, Municipios, Caja de Jubilaciones):',
    '- Busca explícitamente las etiquetas "TOTAL HABERES" (asígnalo a sueldoBrutoTotal y totales.totalHaberes), "TOTAL DESCUENTOS" (asígnalo a totalDescuentosRecibo y totales.totalDescuentos) y "LÍQUIDO A PAGAR" / "NETO A COBRAR" (asígnalo a sueldoLiquido y totales.liquidoAPagar).',
    '- Extrae la lista COMPLETA de conceptos en detalleCompletoRecibo.conceptos sin omitir ni resumir ningún código.',
    '- Descuentos de Ley (descuentosLey): Jubilación (Cód. 502), Obra Social IOSPER/OSER (Cód. 505), Seguros obligatorios (Códs. 510, 524, 327) y Ley 4035.',
    '- Consumos / Proveeduría / Mutuales: MUPER (Cód. 491) u otras mutuales en otrasMutuales; códigos oficiales FEDEM (366/368 Activos o 1115/1117 Pasivos) en codigosFedemMonto; BERSA en consumosBersa; SIDECREER en consumosSidecreer.',
    '- CERO ALUCINACIÓN SIN FALSOS POSITIVOS: Prohibido inventar o redondear cifras. Si un concepto opcional no figura en el recibo, consigna 0.00 (y embargoDetectado: false).',
    '',
    datosDeclarados
      ? ('CARÁTULA DECLARADA: Nombre="' + (datosDeclarados.nombre || 'NO INFORMADO') + '", DNI="' + (datosDeclarados.dni || 'NO INFORMADO') + '", Organismo="' + (datosDeclarados.organismo || 'NO INFORMADO') + '", Cuota=' + (datosDeclarados.cuota || 0) + ', Plazo=' + (datosDeclarados.plazoCuotas || 0))
      : 'NO SE ENVIÓ CARÁTULA PREVIA. Indica estadoCotejoCaratula: "VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)" y extrae los datos literales del comprobante.',
    '',
    'Devuelve exclusivamente JSON puro (sin ```json ni texto extra) con la estructura: { identidad: { titularDetectado, dni, cuil, fechaNacimiento, domicilio, fechaVencimientoDni, dniVigente, estadoCotejoCaratula, detalleDiscrepancias }, datosLaborales: { organismoEmpleador, dependencia, legajo, escalafonCargo, situacionRevista, fechaIngreso, antiguedadDetalle, antiguedadAnios, cumpleAntiguedadMinima, esSaludSuplenteDia19, requiereSituacionSage, esInvalidezODiscapacidad, cumpleTopeEdad80, observacionesEspeciales }, vigenciaRecibo: { periodoLiquidado, estadoVigencia, esVigente }, radiografiaSalarial: { sueldoBrutoTotal, descuentosLey, consumosBersa, consumosSidecreer, otrasMutuales, codigosFedemMonto, codigosFedemDetectados, embargoDetectado, embargoMonto, embargoConcepto, totalDescuentosRecibo, sueldoLiquido }, detalleCompletoRecibo: { periodo, escalafonCargo, conceptos: [{ codigo, descripcion, haberes, descuentos }], totales: { totalHaberes, totalDescuentos, liquidoAPagar } }, scoringAmmer: { puntajeTotal, calificacionLetra, dictamen, decisionPlanilla, decisionAlternativaCBU, nivelConfianza, dictamenAuditor, alertasCriticas, camposIlegibles } }.'
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
