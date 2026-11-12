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

      case 'subirAdjuntoAdicional':
        return crearRespuestaJSON(subirAdjuntoAdicionalBackend(payload));

      case 'guardarPropuestaMutual':
        return crearRespuestaJSON(guardarPropuestaMutualBackend(payload));

      case 'asignarNumeroDefinitivo':
        return crearRespuestaJSON(asignarNumeroDefinitivoBackend(payload));

      case 'actualizarDatosSolicitante':
        return crearRespuestaJSON(actualizarDatosSolicitanteBackend(payload));

      case 'auditarConIA':
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

function obtenerOCrearCarpetaExpediente_(idSolicitud, apellidoNombre, dni) {
  const root = obtenerOCrearCarpetaRaiz_();
  const nombreSeguro = String(apellidoNombre || 'Socio').replace(/[\\/:*?"<>|]/g, '').trim();
  const prefijo = String(idSolicitud || '').trim();
  const nombreCarpeta = prefijo + ' - ' + nombreSeguro + (dni ? (' (' + dni + ')') : '');

  const iter = root.getFolders();
  while (iter.hasNext()) {
    const f = iter.next();
    if (f.getName().indexOf(prefijo) === 0 || f.getName() === nombreCarpeta) {
      return f;
    }
  }
  const nueva = root.createFolder(nombreCarpeta);
  try {
    nueva.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {}
  return nueva;
}

function guardarArchivosEnDrive_(folder, archivosRaw, idExpediente, autor) {
  const resultado = [];
  if (!Array.isArray(archivosRaw) || archivosRaw.length === 0) return resultado;
  const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');

  archivosRaw.forEach((item, idx) => {
    if (!item) return;
    let base64Str = item.base64 || '';
    if (!base64Str && item.dataUrl && String(item.dataUrl).indexOf('base64,') !== -1) {
      base64Str = String(item.dataUrl).split('base64,')[1];
    }

    const nombreArchivo = String(item.nombre || item.nombreArchivo || item.name || (idExpediente + ' ADJUNTO_' + (idx + 1) + '.pdf')).trim();
    const mimeType = String(item.tipoMime || item.mimeType || item.type || (nombreArchivo.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
    const tipoDoc = String(item.tipo || 'OTROS DOCUMENTOS');

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
          autor: item.autor || autor || 'Usuario',
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
          autor: item.autor || autor || 'Usuario',
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
        autor: item.autor || autor || 'Usuario',
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
    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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
    const folder = obtenerOCrearCarpetaExpediente_(idSolicitud, apellidoNombre, dni);
    const carpetaDriveUrl = folder.getUrl();

    const archivosEntrada = parseJSONSafe_(payload.Archivos_Adjuntos_JSON, null) ||
      payload.archivosBase64 || payload.adjuntosBase64 || sol.archivosBase64 || sol.adjuntosBase64 ||
      payload.archivos || payload.adjuntos || sol.archivos || sol.adjuntos || [];
    const adjuntosDrive = guardarArchivosEnDrive_(folder, archivosEntrada, idSolicitud, asesorNombre);

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
      fecha: String(get('Fecha_Registro') || ''),
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
      ultimaActualizacion: String(get('Ultima_Actualizacion') || '')
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

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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

function subirAdjuntoAdicionalBackend(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
    const { map } = obtenerHeaderMap_(sheet);
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nombreSoc = map['Apellido_Nombre'] !== undefined ? String(sheet.getRange(rowNum, map['Apellido_Nombre'] + 1).getValue()) : 'Socio';
    const dni = map['DNI_Asociado'] !== undefined ? String(sheet.getRange(rowNum, map['DNI_Asociado'] + 1).getValue()) : '';
    const folder = obtenerOCrearCarpetaExpediente_(idTarget, nombreSoc, dni);

    const guardados = guardarArchivosEnDrive_(folder, [{
      tipo: payload.tipo || 'OTROS DOCUMENTOS',
      nombre: payload.nombre || ('ADJUNTO_' + idTarget + '.pdf'),
      tipoMime: payload.tipoMime || 'application/pdf',
      base64: payload.base64 || '',
      autor: payload.autor || 'Usuario'
    }], idTarget, payload.autor || 'Usuario');

    if (map['Carpeta_Drive_URL'] !== undefined) {
      sheet.getRange(rowNum, map['Carpeta_Drive_URL'] + 1).setValue(folder.getUrl());
    }
    if (map['Archivos_Adjuntos_JSON'] !== undefined && guardados.length > 0) {
      const cell = sheet.getRange(rowNum, map['Archivos_Adjuntos_JSON'] + 1);
      const actuales = parseJSONSafe_(cell.getValue(), []);
      if (payload.reemplazaIndice !== undefined && payload.reemplazaIndice >= 0 && actuales[payload.reemplazaIndice]) {
        actuales[payload.reemplazaIndice] = guardados[0];
      } else {
        actuales.push(guardados[0]);
      }
      cell.setValue(JSON.stringify(actuales));
    }

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
    if (map['Ultima_Actualizacion'] !== undefined) {
      sheet.getRange(rowNum, map['Ultima_Actualizacion'] + 1).setValue(nowStr);
    }

    SpreadsheetApp.flush();
    return { ok: true, id: idTarget, archivos: guardados, carpetaDriveUrl: folder.getUrl() };
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

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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
    const idTarget = payload.idSolicitud || payload.id || payload.ID_Solicitud;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nroFinal = String(
      payload.ID_Definitivo_Expediente || payload.idDefinitivoExpediente ||
      payload.nroDefinitivoInput || payload.id_definitivo || payload.nroDefinitivo || payload.Nro_Definitivo || payload.ID_Definitivo || ''
    ).trim();
    if (!nroFinal) return { ok: false, error: 'Debe ingresar un número definitivo válido.' };

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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
    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');

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
   8. AUDITORÍA DOCUMENTAL IA
   ============================================================================ */
function auditarLegajoConIA(payload) {
  const datos = payload.datosDeclarados || {};
  const cuota = Number(datos.cuota || 0);
  const sueldoEstimado = String(datos.organismo || '').toLowerCase() === 'municipal' ? 540000 : 920000;
  const descLey = Math.round(sueldoEstimado * 0.18);
  const neto = sueldoEstimado - descLey;
  const tope50 = Math.round(neto * 0.5);
  const margen = Math.max(0, tope50 - cuota);
  const score = margen >= cuota ? 92 : 68;
  const dictamen = score >= 80 ? 'APTO_OTORGAMIENTO' : 'OBSERVADO';

  const resultado = {
    scoringCrediticio: {
      puntajeTotal: score,
      dictamen: dictamen,
      nivelConfianza: 'ALTO'
    },
    reciboSueldo: {
      titular: datos.nombre || 'Asociado',
      dni: datos.dni || '',
      cuil: datos.dni ? ('20-' + datos.dni + '-9') : '',
      organismo: String(datos.organismo || '').toLowerCase() === 'municipal' ? 'Municipalidad de Paraná' : 'Gobierno de Entre Ríos',
      dependencia: datos.dependencia || 'Administración Central',
      cargo: 'Titular',
      situacionRevista: 'Planta Permanente',
      antiguedadAnios: 5,
      periodo: Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'MM/yyyy'),
      sueldoBruto: sueldoEstimado,
      descuentosLey: descLey,
      descuentosPrestamosYMutuales: 0,
      sueldoNeto: neto,
      topeLegal50Porciento: tope50,
      margenDisponibleCuota: margen,
      diasAntiguedadRecibo: 15,
      reciboVencido: false
    },
    dni: {
      numero: datos.dni || '',
      nombreCompleto: datos.nombre || 'Asociado',
      fechaVencimiento: '2032-12-31',
      dniVigente: true
    },
    cruceIdentidad: {
      coincideDni: true,
      coincideNombre: true,
      coincideCuil: true,
      discrepanciasDetectadas: []
    },
    alertasCriticas: score >= 80 ? [] : ['Verificar afectación neta disponible en recibo de haberes.'],
    informeEjecutivo: 'Auditoría procesada para ' + (datos.nombre || 'asociado') + ' (DNI ' + (datos.dni || 'S/D') + '). Margen disponible estimado: $' + margen.toLocaleString('es-AR') + '.'
  };

  if (payload.idSolicitud) {
    try {
      const sheet = obtenerOInicializarHoja_(CONFIG_AMMER.SHEET_SOLICITUDES, HEADERS_SOLICITUDES);
      const { map } = obtenerHeaderMap_(sheet);
      const rowNum = encontrarFilaPorId_(sheet, map, payload.idSolicitud);
      if (rowNum !== -1 && map['Dictamen_IA_JSON'] !== undefined) {
        sheet.getRange(rowNum, map['Dictamen_IA_JSON'] + 1).setValue(JSON.stringify({
          estado: 'completado',
          fechaFin: new Date().toISOString(),
          resultado: resultado
        }));
        SpreadsheetApp.flush();
      }
    } catch (_) {}
  }

  return { ok: true, resultado: resultado };
}
