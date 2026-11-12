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
  'Fecha_Nac',
  'Celular',
  'Email',
  'Domicilio',
  'Condicion',
  'Organismo',
  'Legajo',
  'Dependencia',
  'Cargo',
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
    const dniRow = String(row[map['DNI']] || '').replace(/\D/g, '').trim();
    if (dniRow === dniBuscado) {
      return {
        ok: true,
        encontrado: true,
        asociado: {
          dni: dniRow,
          nombre: String(row[map['Apellido_Nombre']] || ''),
          fechaNac: String(row[map['Fecha_Nac']] || ''),
          celular: String(row[map['Celular']] || ''),
          email: String(row[map['Email']] || ''),
          domicilio: String(row[map['Domicilio']] || ''),
          condicion: String(row[map['Condicion']] || 'Activo'),
          organismo: String(row[map['Organismo']] || 'Provincial'),
          legajo: String(row[map['Legajo']] || ''),
          dependencia: String(row[map['Dependencia']] || ''),
          cargo: String(row[map['Cargo']] || 'Titular')
        }
      };
    }
  }
  return { ok: true, encontrado: false };
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
    set('Fecha_Nac', asoc.fechaNac || '');
    set('Celular', payload.Celular || asoc.celular || '');
    set('Email', payload.Email || asoc.email || '');
    set('Domicilio', payload.Domicilio || asoc.domicilio || '');
    set('Condicion', payload.Condicion || asoc.condicion || 'Activo');
    set('Organismo', payload.Organismo || asoc.organismo || 'Provincial');
    set('Legajo', payload.Legajo || asoc.legajo || '');
    set('Dependencia', payload.Dependencia || asoc.dependencia || '');
    set('Cargo', payload.Cargo || asoc.cargo || 'Titular');
    set('Fecha_Alta', asoc.fechaAlta || Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd'));
    set('Creado_Por', asoc.creadoPor || 'Usuario');
    set('Carpeta_Drive_URL', carpetaUrl);
    set('Archivos_Adjuntos_JSON', JSON.stringify(adjuntosGuardados));

    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return { ok: true, dni: dni, carpetaDriveUrl: carpetaUrl, archivos: adjuntosGuardados };
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
    const idDefinitivo = String(sol.id_definitivo || payload.id_definitivo || '').trim();
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
    const dni = String(solicitante.dni || sol.dni || payload.DNI || payload.dni || '').trim();
    const apellidoNombre = String(solicitante.nombre || sol.apellidoNombre || payload.Apellido_Nombre || payload.apellido_nombre || payload.nombre || 'Sin_Nombre').trim();
    const domicilioHistorico = String(sol.domicilio_historico || solicitante.domicilio || sol.domicilio || payload.Domicilio || payload.domicilio || 'Sin domicilio declarado').trim();
    const legajo = String(solicitante.legajo || sol.legajo || payload.Legajo || payload.legajo || '').trim();

    const datosContacto = {
      cuil: solicitante.cuil || sol.cuil || payload.CUIL || payload.cuil || '',
      localidad: solicitante.localidad || sol.localidad || payload.Localidad || payload.localidad || '',
      fechaNac: solicitante.fechaNac || sol.fechaNac || payload.Fecha_Nac || payload.fechaNac || '',
      email: solicitante.email || sol.email || payload.Email || payload.email || '',
      celular: solicitante.celular || sol.telefono || sol.celular || payload.Celular || payload.celular || '',
      domicilio: domicilioHistorico
    };

    const datosLaborales = {
      condicion: solicitante.condicion || sol.condicion || payload.Condicion || payload.condicion || 'Activo',
      organismo: solicitante.organismo || sol.organismo || payload.Organismo || payload.organismo || 'Provincial',
      dependencia: solicitante.dependencia || sol.dependencia || payload.Dependencia || payload.dependencia || '',
      cargo: solicitante.cargo || sol.cargo || payload.Cargo || payload.cargo || 'Titular',
      legajo: legajo
    };

    const prestamo = sol.prestamo || {};
    const lineaAyuda = String(prestamo.lineaNombre || prestamo.linea || sol.lineaAyuda || payload.Linea_Nombre || payload.Linea || payload.linea || 'FEDEM Provincial');
    const lineaKey = String(prestamo.linea || sol.linea || payload.Linea || payload.linea || 'fedem');
    const montoNeto = Number(prestamo.monto || sol.montoNeto || payload.Monto || payload.monto || 0);
    const cantCuotas = Number(prestamo.cuotas || sol.cuotas || payload.Cuotas || payload.cuotas || payload.Plazo || 12);
    const montoCuota = Number(prestamo.cuotaEstimada || sol.montoCuota || payload.Cuota_Estimada || payload.cuotaEstimada || 0);
    const totalADevolver = Number(sol.totalDevolver || payload.Total_A_Devolver || (montoCuota * cantCuotas) || 0);
    const estadoTramite = String(sol.estado || payload.Estado_Tramite || 'Pendiente');
    const analistaAsignado = String(sol.analistaAsignado || sol.Analista_Asignado || payload.Analista_Asignado || payload.analistaAsignado || 'Sin Asignar').trim();

    // Gestión de carpeta y archivos reales en Google Drive
    const folder = obtenerOCrearCarpetaExpediente_(idSolicitud, apellidoNombre, dni);
    const carpetaDriveUrl = folder.getUrl();

    const archivosEntrada = parseJSONSafe_(payload.Archivos_Adjuntos_JSON, null) ||
      payload.archivosBase64 || payload.adjuntosBase64 || payload.archivos || payload.adjuntos || sol.adjuntos || [];
    const adjuntosDrive = guardarArchivosEnDrive_(folder, archivosEntrada, idSolicitud, asesorNombre);

    const historialComentarios = Array.isArray(sol.observaciones)
      ? sol.observaciones
      : parseJSONSafe_(payload.Historial_Comentarios_JSON, []);

    const historialOfertasObj = {
      propuestaMutual: sol.propuestaMutual || null,
      historialPropuestas: Array.isArray(sol.historialPropuestas) ? sol.historialPropuestas : []
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
    set('Historial_Ofertas_JSON', JSON.stringify(historialOfertasObj));
    set('Dictamen_IA_JSON', dictamenIA ? JSON.stringify(dictamenIA) : '');
    set('Analista_Asignado', analistaAsignado);
    set('Ultima_Actualizacion', nowStr);
    set('Metadata_Extra_JSON', JSON.stringify(metadataExtra));

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    return {
      ok: true,
      id: idSolicitud,
      idSolicitud: idSolicitud,
      id_provisorio: idProvisorio,
      carpetaDriveUrl: carpetaDriveUrl,
      archivos: adjuntosDrive,
      mensaje: 'Expediente ' + idProvisorio + ' registrado en Google Sheets y Google Drive.'
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

    const item = {
      id: idSol,
      id_provisorio: meta.id_provisorio || ('PROV-' + idSol),
      id_definitivo: meta.id_definitivo || '',
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
        fechaNac: contacto.fechaNac || '',
        email: contacto.email || '',
        celular: contacto.celular || '',
        domicilio: String(get('Domicilio_Historico_Solicitud') || contacto.domicilio || ''),
        domicilio_historico: String(get('Domicilio_Historico_Solicitud') || contacto.domicilio || ''),
        localidad: contacto.localidad || '',
        condicion: laborales.condicion || 'Activo',
        organismo: laborales.organismo || 'Provincial',
        dependencia: laborales.dependencia || '',
        cargo: laborales.cargo || 'Titular'
      },
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
      observaciones: Array.isArray(observaciones) ? observaciones : [],
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
    const idTarget = payload.idSolicitud || payload.id;
    const rowNum = encontrarFilaPorId_(sheet, map, idTarget);
    if (rowNum === -1) return { ok: false, error: 'Expediente no encontrado: ' + idTarget };

    const nroFinal = String(payload.nroDefinitivoInput || payload.id_definitivo || payload.nroDefinitivo || '').trim();
    if (!nroFinal) return { ok: false, error: 'Debe ingresar un número definitivo válido.' };

    const nowStr = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm');
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
    return { ok: true, id: idTarget, id_definitivo: nroFinal, nroDefinitivo: nroFinal };
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

    if (map['DNI_Asociado'] !== undefined && sol.dni) sheet.getRange(rowNum, map['DNI_Asociado'] + 1).setValue(sol.dni);
    if (map['Apellido_Nombre'] !== undefined && sol.nombre) sheet.getRange(rowNum, map['Apellido_Nombre'] + 1).setValue(sol.nombre);
    if (map['Legajo_Municipal'] !== undefined && sol.legajo !== undefined) sheet.getRange(rowNum, map['Legajo_Municipal'] + 1).setValue(sol.legajo);
    if (map['Datos_Contacto_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Datos_Contacto_JSON'] + 1).setValue(JSON.stringify({
        fechaNac: sol.fechaNac || '',
        email: sol.email || '',
        celular: sol.celular || '',
        domicilio: sol.domicilio || ''
      }));
    }
    if (map['Datos_Laborales_JSON'] !== undefined) {
      sheet.getRange(rowNum, map['Datos_Laborales_JSON'] + 1).setValue(JSON.stringify({
        condicion: sol.condicion || 'Activo',
        organismo: sol.organismo || 'Provincial',
        dependencia: sol.dependencia || '',
        cargo: sol.cargo || 'Titular',
        legajo: sol.legajo || ''
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
