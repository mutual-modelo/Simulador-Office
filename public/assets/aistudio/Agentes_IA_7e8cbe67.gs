/**
 * ============================================================================
 * SISTEMA DE AUDITORÍA Y CRM DE CARTERA - MUTUAL MODELO DE ENTRE RÍOS (AMMER)
 * MÓDULO 2: Agentes_IA.gs V4.5 (Checklist 6 Docs, Antigüedad Sueldo, Venc. DNI,
 * Anti-503, Criterio Flexible de Rúbricas y Optimización Anti-Timeout)
 * ============================================================================
 */

/**
 * Obtiene la API Key activa (ScriptProperties, Config_Reglas o Default)
 */
function obtenerGeminiApiKey() {
  const propKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (propKey && propKey.trim() !== '') return propKey.trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaReglas = ss.getSheetByName(CONFIG_SISTEMA.HOJA_REGLAS);
  if (hojaReglas) {
    const datos = hojaReglas.getDataRange().getValues();
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim().toUpperCase() === 'GEMINI_API_KEY') {
        const val = String(datos[i][1]).trim();
        if (val) return val;
      }
    }
  }
  return CONFIG_SISTEMA.API_KEY_DEFAULT;
}

/**
 * Guarda o actualiza la API Key en ScriptProperties
 */
function guardarGeminiApiKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') throw new Error('La API Key no puede estar vacía.');
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey.trim());
  return 'API Key configurada exitosamente.';
}

/**
 * ENDPOINT PRINCIPAL: Audita el legajo completo mediante visión artificial.
 */
function auditarLegajoCompletoIA(idOperacion, archivos, apiKeyOpcional) {
  if (!idOperacion) throw new Error('Se requiere un ID_OPERACION válido.');
  if (!archivos || archivos.length === 0) throw new Error('No se enviaron archivos para auditar.');

  const apiKey = apiKeyOpcional || obtenerGeminiApiKey();
  if (!apiKey) throw new Error('No se encuentra configurada la GEMINI_API_KEY.');

  const carteraMap = obtenerDiccionarioCartera();
  const carteraData = carteraMap[String(idOperacion).trim()] || null;
  const reglas = obtenerReglasNegocio();

  const resultadoIA = invocarGeminiMultimodalRapido(archivos, carteraData, reglas, apiKey);
  const datosExtraidos = resultadoIA.datos;

  if (resultadoIA.tokensConsumidos > 0) {
    registrarConsumoTokens(resultadoIA.tokensConsumidos);
  }

  const apellidoCarpeta = carteraData ? carteraData.Apellido_Nombre : 'No_Registrado';
  const resultadoDrive = guardarArchivosEnDrive(idOperacion, apellidoCarpeta, archivos);

  const dictamenAuditoria = cruzarYCalificarLegajoV2(idOperacion, carteraData, datosExtraidos, reglas, resultadoDrive.carpetaUrl);

  registrarEnCRM(dictamenAuditoria);

  return dictamenAuditoria;
}

/**
 * Guarda cada archivo procesado en la subcarpeta correspondiente de Google Drive
 */
function guardarArchivosEnDrive(idOperacion, apellidoNombre, archivos) {
  try {
    const carpetaLegajo = obtenerCarpetaLegajoDrive(idOperacion, apellidoNombre);
    const urlsArchivos = [];

    for (let i = 0; i < archivos.length; i++) {
      const item = archivos[i];
      try {
        const decodedBytes = Utilities.base64Decode(item.base64);
        const blob = Utilities.newBlob(decodedBytes, item.mimeType || 'application/pdf', item.nombre);
        const fileCreado = carpetaLegajo.createFile(blob);
        urlsArchivos.push(fileCreado.getUrl());
      } catch (e) {
        console.warn('Error al guardar archivo en Drive: ' + item.nombre, e);
      }
    }

    return {
      carpetaUrl: carpetaLegajo.getUrl(),
      archivosUrls: urlsArchivos
    };
  } catch (errDrive) {
    console.warn('Advertencia en Drive: ' + errDrive.message);
    return { carpetaUrl: '', archivosUrls: [] };
  }
}

/**
 * Invocación multimodal optimizada.
 */
function invocarGeminiMultimodalRapido(archivos, carteraData, reglas, apiKey) {
  const modelos = [
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash'
  ];

  const promptAuditor = armarPromptAuditorAMMERV2(carteraData, reglas);

  const parts = [];
  for (let i = 0; i < archivos.length; i++) {
    const arch = archivos[i];
    let mime = arch.mimeType || 'application/pdf';

    if (mime.includes('pdf')) mime = 'application/pdf';
    else if (mime.includes('png')) mime = 'image/png';
    else if (mime.includes('webp')) mime = 'image/webp';
    else mime = 'image/jpeg';

    parts.push({
      inline_data: {
        mime_type: mime,
        data: arch.base64
      }
    });
  }
  parts.push({ text: promptAuditor });

  const payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const opciones = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let jsonRes = null;
  let ultimoError = null;

  for (let m = 0; m < modelos.length; m++) {
    const modeloActual = modelos[m];
    const urlEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActual}:generateContent?key=${apiKey}`;

    const maxIntentos = 3;
    let esperaMs = 2500;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        const response = UrlFetchApp.fetch(urlEndpoint, opciones);
        const status = response.getResponseCode();
        const respText = response.getContentText();

        if (status === 200) {
          jsonRes = JSON.parse(respText);
          break;
        }

        if (status === 429) {
          let detalleMensaje = 'Límite de cuota diaria alcanzado en tu API Key (Free Tier: 20 peticiones/día). Habilita facturación (Pay-As-You-Go) en Google AI Studio o ingresa una nueva API Key.';
          try {
            const errJson = JSON.parse(respText);
            if (errJson.error && errJson.error.message) {
              detalleMensaje += ' Detalle de Google: ' + errJson.error.message;
            }
          } catch (_) {}
          throw new Error(`STATUS_429: ${detalleMensaje}`);
        }

        if (status === 503 && intento < maxIntentos) {
          console.warn(`[AMMER] Servidor saturado en ${modeloActual} (HTTP 503). Reintentando en ${esperaMs / 1000}s (${intento}/${maxIntentos})...`);
          Utilities.sleep(esperaMs);
          esperaMs *= 2;
          continue;
        }

        throw new Error(`STATUS_${status}: ${respText}`);
      } catch (err) {
        ultimoError = err;
        if (err.message && err.message.includes('STATUS_429')) {
          throw err;
        }
      }
    }

    if (jsonRes) break;
  }

  if (!jsonRes) {
    throw new Error(`Error en llamada IA: ${ultimoError ? ultimoError.message : 'Servidores no disponibles'}`);
  }

  if (!jsonRes.candidates || jsonRes.candidates.length === 0) {
    throw new Error('Gemini no generó respuesta para este legajo.');
  }

  let tokensUsados = 0;
  if (jsonRes.usageMetadata && jsonRes.usageMetadata.totalTokenCount) {
    tokensUsados = parseInt(jsonRes.usageMetadata.totalTokenCount, 10);
  }

  const textoGenerado = jsonRes.candidates[0].content.parts[0].text;
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(textoGenerado);
  } catch (err) {
    const match = textoGenerado.match(/\{[\s\S]*\}/);
    if (match) {
      parsedJson = JSON.parse(match[0]);
    } else {
      throw new Error('No se pudo interpretar el formato JSON del agente.');
    }
  }

  return {
    datos: parsedJson,
    tokensConsumidos: tokensUsados
  };
}

/**
 * Prompt auditor con Checklist Obligatorio de los 6 Documentos AMMER
 */
function armarPromptAuditorAMMERV2(carteraData, reglas) {
  const datosEsperados = carteraData ? `
DATOS REGISTRADOS EN CARTERA_BASE (A COMPARAR):
- ID_OPERACION: "${carteraData.ID_OPERACION}"
- Apellido y Nombre: "${carteraData.Apellido_Nombre}"
- CUIT Base: "${carteraData.cuit}" | DNI Base: "${carteraData.dni_deducido}"
- Fecha Nacimiento Base: "${carteraData.Fecha_Nacimiento}"
- Fecha Otorgamiento (Fecha_arreglo): "${carteraData.Fecha_arreglo}"
- Domicilio Base: "${carteraData.domicilio}", Localidad: "${carteraData.localidad}", Provincia: "${carteraData.provincia}"
- Capital Original (Importe Solicitado): $ ${carteraData.capital_original}
- Transferencia Neta (Monto a Percibir Desembolsado): $ ${carteraData.Transferencia}
- Plazo: ${carteraData.Plazo} | Cuota Mensual: $ ${carteraData.cuota} | Monto Pagaré: $ ${carteraData.monto_pagare}
` : 'NO EXISTEN DATOS REGISTRADOS EN LA BASE PARA ESTE ID_OPERACION.';

  return `
ERES UN AUDITOR SENIOR ESPECIALIZADO EN AYUDAS ECONÓMICAS DE LA ASOCIACIÓN MUTUAL MODELO DE ENTRE RÍOS (AMMER - MAT. INAES 230 ER) Y ANÁLISIS DOCUMENTAL DE ENTRE RÍOS.

REGLA FUNDAMENTAL DE CONTROL DOCUMENTAL:
CADA DOCUMENTO DEBE ESTAR EFECTIVAMENTE ADJUNTO EN LAS IMÁGENES O PÁGINAS PDF PROPORCIONADAS.
SI UN DOCUMENTO NO APARECE ENTRE LOS ARCHIVOS ENVIADOS, DEBES ASIGNAR SU CAMPO "presente": false.
NO ASUMAS QUE UN DOCUMENTO EXISTE O QUE SUS IMPORTES COINCIDEN SI NO ESTÁS VIENDO EL ARCHIVO FÍSICO CORRESPONDIENTE.

CHECKLIST DE LOS 6 DOCUMENTOS MÍNIMOS OBLIGATORIOS:
1. DNI: Imagen frente/dorso, documento unificado o reporte biométrico MetaMap (frente, dorso con código MRZ, selfie).
2. RECIBO DE SUELDO: Recibo de haberes oficial (IAFAS, Gobierno de Entre Ríos, Municipios, Caja de Jubilaciones de Entre Ríos).
3. FACTURA / SERVICIO / CONSTANCIA POLICIAL: Factura de servicio público (ENERSA, ATER, agua, telecomunicaciones) o constancia de domicilio policial.
4. CONSTANCIA DE TRANSFERENCIA BANCARIA: Comprobante oficial de desembolso bancario neto (i-Bica, Nuevo Banco de Entre Ríos - BERSA, etc.) transferido al asociado.
5. SOLICITUD DE AYUDA ECONÓMICA: Formulario de solicitud o Condiciones Particulares del Préstamo donde conste el Importe Solicitado, Pagaré y firmas.
6. AUTORIZACIÓN PARA DESCUENTO DE HABERES: Autorización firmada para retención por FEDEM, Caja de Jubilaciones o código de descuento de haberes.

CRITERIO DE NITIDEZ Y FIRMAS (FLEXIBLE Y PERMISIVO):
- Datos personales: Verifica que Apellido y Nombre, Número de DNI y Fecha de Nacimiento sean reconocibles.
- RÚBRICA Y FIRMA (TOLERANCIA ALTA): Es totalmente válido si la rúbrica sobrepasa el recuadro, pisa texto o si el borde corta una parte del trazo. Solo califica "firma_nitida: false" si el área de firma está completamente en blanco o tapada por flash al 100%.

${datosEsperados}

DEVUELVE EXCLUSIVAMENTE UN OBJETO JSON CON LA SIGUIENTE ESTRUCTURA ESTRICTA:
{
  "checklist_presencia": {
    "dni_presente": boolean,
    "recibo_sueldo_presente": boolean,
    "servicio_domicilio_presente": boolean,
    "transferencia_presente": boolean,
    "solicitud_ayuda_presente": boolean,
    "autorizacion_descuento_presente": boolean
  },
  "calidad_nitidez": {
    "datos_personales_legibles": boolean,
    "firma_nitida": boolean,
    "estado_calidad": "OPTIMA" | "REGULAR_LEGIBLE" | "ILEGIBLE_BORROSA",
    "observaciones_calidad": "string"
  },
  "identidad": {
    "apellido_nombre_doc": "string o null",
    "dni_extraido": "solo digitos o null",
    "fecha_nacimiento_doc": "DD/MM/YYYY o null",
    "vencimiento_dni": "DD/MM/YYYY o null"
  },
  "recibo_sueldo": {
    "titular_recibo": "string o null",
    "organismo_empleador": "string o null",
    "haber_neto_bolsillo": number,
    "periodo_liquidacion": "MM/YYYY o null"
  },
  "factura_servicio": {
    "titular_servicio": "string o null",
    "domicilio_servicio_extraido": "string completo o null",
    "fecha_emision_o_vencimiento": "DD/MM/YYYY o null"
  },
  "solicitud_prestamo": {
    "numero_solicitud": "string o null",
    "importe_solicitado": number,
    "monto_a_percibir": number,
    "cantidad_cuotas": number,
    "monto_cuota": number,
    "monto_pagare_total": number,
    "firmas_presentes": boolean
  },
  "transferencia_bancaria": {
    "monto_transferido": number,
    "banco_origen_destino": "string o null",
    "cbu_destino": "string o null"
  },
  "resumen_ia_auditor": "Resumen conciso."
}
`;
}

/**
 * Cruza los datos estructurados extraídos por Gemini contra la base de Cartera_Base,
 * aplicando el control estricto de los 6 documentos y el criterio flexible de rúbricas.
 * Añade controles de vencimiento de DNI y antigüedad de Recibo de Sueldo.
 */
function cruzarYCalificarLegajoV2(idOperacion, base, extraido, reglas, carpetaUrl) {
  const discrepancias = [];
  const faltantes = [];
  const docsDetectados = [];
  const tol = parseFloat(reglas.TOLERANCIA_PESOS) || 100;
  let score = 100;

  if (!base) {
    discrepancias.push(`ID_OPERACION ${idOperacion} no figura en Cartera_Base`);
    score -= 40;
  }

  const checkPresencia = extraido.checklist_presencia || {};
  const fechaArregloObj = base && base.Fecha_arreglo ? parsearFechaAObjeto(base.Fecha_arreglo) : null;

  // 1. Control DNI y Vencimiento
  let checkDni = 'NO_PRESENTADO';
  if (checkPresencia.dni_presente && extraido.identidad && extraido.identidad.dni_extraido) {
    docsDetectados.push('DNI');
    checkDni = 'OK';
    if (base && base.dni_deducido) {
      const dBase = String(base.dni_deducido).trim();
      const dDoc = String(extraido.identidad.dni_extraido).trim();
      if (!dDoc.includes(dBase) && !dBase.includes(dDoc)) {
        checkDni = 'DISCREPANCIA';
        discrepancias.push(`DNI discrepante: Base=${dBase} vs Doc=${dDoc}`);
        score -= 25;
      }
    }
    // Control de vencimiento DNI[cite: 5, 6]
    if (extraido.identidad.vencimiento_dni && fechaArregloObj) {
        const fVencimiento = parsearFechaAObjeto(extraido.identidad.vencimiento_dni);
        if (fVencimiento && fVencimiento.getTime() < fechaArregloObj.getTime()) {
             discrepancias.push(`DNI Vencido: El DNI venció el ${extraido.identidad.vencimiento_dni}, antes del otorgamiento (${base.Fecha_arreglo})`);
             score -= 20;
             checkDni = 'VENCIDO';
        }
    }

  } else {
    faltantes.push('DNI');
    discrepancias.push('Falta documento de DNI (Frente/Dorso o MetaMap)');
    score -= 20;
  }

  // 2. Control Fecha de Nacimiento
  let checkFechaNac = 'NO_PRESENTADO';
  const fechaNacDoc = extraido.identidad ? extraido.identidad.fecha_nacimiento_doc : null;
  if (fechaNacDoc && base && base.Fecha_Nacimiento) {
    const fDoc = parsearFechaAObjeto(fechaNacDoc);
    const fBase = parsearFechaAObjeto(base.Fecha_Nacimiento);
    if (fDoc && fBase && fDoc.getTime() === fBase.getTime()) {
      checkFechaNac = 'OK';
    } else {
      checkFechaNac = `ALERTA_FECHA (Base: ${base.Fecha_Nacimiento} vs Doc: ${fechaNacDoc})`;
      discrepancias.push(`Fecha Nacimiento no coincide: Base=${base.Fecha_Nacimiento} vs Doc=${fechaNacDoc}`);
      score -= 15;
    }
  } else if (!fechaNacDoc && checkPresencia.dni_presente) {
    checkFechaNac = 'ILEGIBLE_EN_DOC';
  }

  // 3. Control Recibo de Sueldo, 50% Haber y Antigüedad
  let checkReciboTitular = 'NO_PRESENTADO';
  let checkReciboMargen = 'NO_PRESENTADO';
  let checkAntiguedadRecibo = 'NO_PRESENTADO'; // Nuevo Check

  const rec = extraido.recibo_sueldo || {};
  if (checkPresencia.recibo_sueldo_presente) {
    docsDetectados.push('RECIBO_SUELDO');
    checkReciboTitular = 'OK';
    if (base && rec.titular_recibo) {
      const nomBaseLimpio = normalizarCadenaTexto(base.Apellido_Nombre);
      const nomRecLimpio = normalizarCadenaTexto(rec.titular_recibo);
      if (!nombresSonCoincidentes(nomBaseLimpio, nomRecLimpio)) {
        checkReciboTitular = 'NO_COINCIDE_TITULAR';
        discrepancias.push(`Titular de recibo difiere: Base="${base.Apellido_Nombre}" vs Recibo="${rec.titular_recibo}"`);
        score -= 20;
      }
    }
    if (rec.haber_neto_bolsillo > 0) {
      const cuotaControlar = (base && base.cuota > 0) ? base.cuota : 0;
      const topePermitido = rec.haber_neto_bolsillo * (parseFloat(reglas.TOPE_AFECTACION_HABERES) || 0.50);
      if (cuotaControlar > topePermitido) {
        checkReciboMargen = 'EXCEDE_50_PORC';
        discrepancias.push(`Cuota ($${cuotaControlar}) supera el 50% del haber neto ($${rec.haber_neto_bolsillo.toFixed(2)})`);
        score -= 20;
      } else {
        checkReciboMargen = 'OK';
      }
    } else {
      checkReciboMargen = 'OK';
    }

    // Control Antigüedad Recibo
    if (rec.periodo_liquidacion && fechaArregloObj) {
        // Asume formato MM/YYYY
        let mesLiq, anioLiq;
        if(rec.periodo_liquidacion.includes('/')) {
             [mesLiq, anioLiq] = rec.periodo_liquidacion.split('/').map(Number);
        } else if (rec.periodo_liquidacion.includes('-')) {
             [mesLiq, anioLiq] = rec.periodo_liquidacion.split('-').map(Number);
        }

        if (mesLiq && anioLiq) {
             const mesArreglo = fechaArregloObj.getMonth() + 1;
             const anioArreglo = fechaArregloObj.getFullYear();
             
             const mesesDiferencia = (anioArreglo - anioLiq) * 12 + (mesArreglo - mesLiq);

             if (mesesDiferencia <= 1 && mesesDiferencia >= 0) {
                 checkAntiguedadRecibo = 'OK';
             } else if (mesesDiferencia === 2) {
                 checkAntiguedadRecibo = 'OBSERVADO (2 Meses)';
                 discrepancias.push(`Recibo de Sueldo con 2 meses de antigüedad (Periodo: ${rec.periodo_liquidacion} vs Fecha Arreglo: ${base.Fecha_arreglo})`);
                 score -= 10;
             } else if (mesesDiferencia > 2) {
                 checkAntiguedadRecibo = 'VENCIDO (> 2 Meses)';
                 discrepancias.push(`Recibo de Sueldo vencido, mayor a 2 meses (Periodo: ${rec.periodo_liquidacion} vs Fecha Arreglo: ${base.Fecha_arreglo})`);
                 score -= 20;
             } else {
                 // Caso anomalo donde el recibo es futuro
                 checkAntiguedadRecibo = 'PERIODO FUTURO';
             }
        } else {
            checkAntiguedadRecibo = 'FORMATO INVALIDO';
        }
    }

  } else {
    faltantes.push('RECIBO_SUELDO');
    discrepancias.push('Falta Recibo de Sueldo del solicitante');
    score -= 20;
  }

  // 4. Control Factura de Servicio / Domicilio
  const fac = extraido.factura_servicio || {};
  let domServicioExtraido = fac.domicilio_servicio_extraido || 'NO_DETECTADO';
  let checkDomServicio = 'NO_PRESENTADO';
  let checkAntiguedad = 'NO_PRESENTADO';

  if (checkPresencia.servicio_domicilio_presente) {
    docsDetectados.push('FACTURA_SERVICIO');
    checkDomServicio = 'OK';
    if (domServicioExtraido && domServicioExtraido !== 'NO_DETECTADO' && base) {
      const domBaseLimpio = normalizarCadenaTexto(`${base.domicilio} ${base.localidad}`);
      const domDocLimpio = normalizarCadenaTexto(domServicioExtraido);
      if (!direccionesSonSimilares(domBaseLimpio, domDocLimpio)) {
        checkDomServicio = 'DISCREPANCIA_DOMICILIO';
        discrepancias.push(`Domicilio en Factura difiere del Sheet: Base="${base.domicilio}, ${base.localidad}" vs Doc="${domServicioExtraido}"`);
        score -= 10;
      }
    }
    if (fac.fecha_emision_o_vencimiento && base && base.Fecha_arreglo) {
      const fFactura = parsearFechaAObjeto(fac.fecha_emision_o_vencimiento);
      const fCredito = parsearFechaAObjeto(base.Fecha_arreglo);
      if (fFactura && fCredito) {
        const diffDias = Math.round(Math.abs(fCredito.getTime() - fFactura.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > 62) {
          checkAntiguedad = `VENCIDO (${diffDias} dias)`;
          discrepancias.push(`Factura de servicio supera los 2 meses de antigüedad (${diffDias} días)`);
          score -= 10;
        } else {
          checkAntiguedad = `OK (${diffDias} dias)`;
        }
      }
    }
  } else {
    faltantes.push('FACTURA_SERVICIO');
    discrepancias.push('Falta Factura de Servicio o Constancia Policial de Domicilio');
    score -= 15;
  }

  // 5. Control Constancia de Transferencia Bancaria
  const trans = extraido.transferencia_bancaria || {};
  let checkTransfMonto = 'NO_PRESENTADO';

  if (checkPresencia.transferencia_presente && trans.monto_transferido > 0) {
    docsDetectados.push('TRANSFERENCIA_BANCARIA');
    checkTransfMonto = 'OK';
    if (base && base.Transferencia > 0) {
      const diffTransf = Math.abs(base.Transferencia - trans.monto_transferido);
      if (diffTransf > tol) {
        checkTransfMonto = 'DISCREPANCIA';
        discrepancias.push(`Monto Transferencia difiere: Sheet=$${base.Transferencia} vs Comprobante=$${trans.monto_transferido} (Diff: $${diffTransf.toFixed(2)})`);
        score -= 25;
      }
    }
  } else {
    faltantes.push('CONSTANCIA_TRANSFERENCIA');
    checkTransfMonto = 'NO_PRESENTADO';
    discrepancias.push('FALTA COMPROBANTE DE TRANSFERENCIA BANCARIA: Imposible validar desembolso real contra el Sheet');
    score -= 25;
  }

  // 6. Control Solicitud de Ayuda Económica (Importe Solicitado y Monto a Percibir)
  const sol = extraido.solicitud_prestamo || {};
  let checkCapSolicitud = 'NO_PRESENTADO';
  let checkPercibirTransf = 'NO_PRESENTADO';

  if (checkPresencia.solicitud_ayuda_presente) {
    docsDetectados.push('SOLICITUD_AYUDA');
    if (sol.importe_solicitado > 0) {
      checkCapSolicitud = 'OK';
      if (base && base.capital_original > 0) {
        const diffCap = Math.abs(base.capital_original - sol.importe_solicitado);
        if (diffCap > tol) {
          checkCapSolicitud = 'DISCREPANCIA';
          discrepancias.push(`Capital Solicitud difiere: Sheet=$${base.capital_original} vs Solicitud=$${sol.importe_solicitado}`);
          score -= 15;
        }
      }
    }
    if (sol.monto_a_percibir > 0) {
      checkPercibirTransf = 'OK';
      if (base && base.Transferencia > 0) {
        const diffPerc = Math.abs(base.Transferencia - sol.monto_a_percibir);
        if (diffPerc > tol) {
          checkPercibirTransf = 'DISCREPANCIA';
          discrepancias.push(`Monto a Percibir en Solicitud difiere de Transferencia del Sheet: Sheet=$${base.Transferencia} vs Solicitud=$${sol.monto_a_percibir}`);
          score -= 15;
        }
      }
    }
  } else {
    faltantes.push('SOLICITUD_AYUDA_ECONOMICA');
    discrepancias.push('Falta Solicitud de Ayuda Económica / Condiciones Particulares');
    score -= 20;
  }

  // 7. Control Autorización de Descuento de Haberes
  if (checkPresencia.autorizacion_descuento_presente) {
    docsDetectados.push('AUTORIZACION_DESCUENTO');
  } else {
    faltantes.push('AUTORIZACION_DESCUENTO');
    discrepancias.push('Falta Autorización para Descuento de Haberes');
    score -= 10;
  }

  // Calidad visual y rúbrica
  const cal = extraido.calidad_nitidez || {};
  let calidadEstado = cal.estado_calidad || 'OPTIMA';

  if (cal.datos_personales_legibles) {
    if (cal.firma_nitida) {
      calidadEstado = 'OPTIMA';
    } else {
      calidadEstado = 'REGULAR_LEGIBLE';
      discrepancias.push(`Rúbrica con observación leve (Aceptada con reserva: ${cal.observaciones_calidad || 'Corte parcial tolerable'})`);
      score -= 5;
    }
  } else {
    calidadEstado = 'ILEGIBLE_BORROSA';
    discrepancias.push(`Calidad deficiente: ${cal.observaciones_calidad || 'Datos personales críticos ilegibles'}`);
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  // Clasificación de Estado Global
  let estadoGlobal = 'APROBADO';
  // Agregar checkAntiguedadRecibo a la condicion de rechazo/observado? Por ahora solo resta puntos.
  if (score < 50 || checkDni === 'DISCREPANCIA' || checkDni === 'VENCIDO' || checkTransfMonto === 'DISCREPANCIA' || faltantes.includes('CONSTANCIA_TRANSFERENCIA')) {
    estadoGlobal = 'RECHAZADO';
  } else if (score < 85 || faltantes.length > 0 || discrepancias.length > 0) {
    estadoGlobal = 'OBSERVADO';
  }

  return {
    ID_OPERACION: idOperacion,
    Apellido_Nombre: base ? base.Apellido_Nombre : (extraido.identidad.apellido_nombre_doc || 'SIN REGISTRO'),
    CUIT_Base: base ? base.cuit : '',
    DNI_Extraido: (extraido.identidad && extraido.identidad.dni_extraido) || '',
    Tipo_Agente: base ? base.tipo : '',
    Estado_Global: estadoGlobal,
    Score_Validacion: score,
    Calidad_Nitidez_Firma: calidadEstado,
    Check_Fecha_Nac: checkFechaNac,
    Check_Identidad_DNI: checkDni,
    Check_Recibo_Titular: checkReciboTitular,
    Check_Recibo_Margen50: checkReciboMargen,
    Domicilio_Servicio: domServicioExtraido,
    Check_Domicilio_Servicio: checkDomServicio,
    Check_Antiguedad_Servicio: checkAntiguedad,
    Check_Transferencia_Monto: checkTransfMonto,
    Check_Capital_Solicitud: checkCapSolicitud,
    Check_Percibir_Transf: checkPercibirTransf,
    Docs_Detectados: docsDetectados,
    Docs_Faltantes: faltantes,
    Discrepancias_Detalladas: discrepancias,
    Resumen_Ejecutivo_IA: extraido.resumen_ia_auditor || (faltantes.length > 0 ? `Faltan documentos obligatorios: ${faltantes.join(', ')}.` : 'Legajo completo verificado.'),
    Carpeta_Drive_URL: carpetaUrl,
    JSON_Datos_Extraidos: extraido,
    Auditor_Revision_Manual: 'PENDIENTE',
    Notas_Seguimiento: faltantes.length > 0 ? `FALTANTES: ${faltantes.join(', ')}` : 'Sin faltantes.'
  };
}

/**
 * Función auxiliar para parsear fechas robustamente (DD/MM/YYYY o DD-MM-YYYY)
 */
function parsearFechaAObjeto(fechaString) {
  if (!fechaString) return null;
  const match = fechaString.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) {
    return new Date(match[3], parseInt(match[2], 10) - 1, match[1]);
  }
  return null;
}

/**
 * Normaliza cadenas de texto para comparaciones flexibles
 */
function normalizarCadenaTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica si los apellidos y nombres guardan correspondencia
 */
function nombresSonCoincidentes(nombreA, nombreB) {
  if (!nombreA || !nombreB) return false;
  if (nombreA === nombreB) return true;
  const tokensA = nombreA.split(' ').filter(t => t.length > 2);
  const tokensB = nombreB.split(' ').filter(t => t.length > 2);
  let coincidencias = 0;
  for (let i = 0; i < tokensA.length; i++) {
    if (tokensB.includes(tokensA[i])) coincidencias++;
  }
  return coincidencias >= Math.min(2, Math.min(tokensA.length, tokensB.length));
}

/**
 * Compara similitud básica entre direcciones extraídas y la base
 */
function direccionesSonSimilares(domBase, domDoc) {
  if (!domBase || !domDoc) return false;
  const numBase = domBase.match(/\d+/g);
  const numDoc = domDoc.match(/\d+/g);
  if (numBase && numDoc) {
    const contieneNumero = numBase.some(n => numDoc.includes(n));
    if (!contieneNumero) return false;
  }
  const palabrasBase = domBase.split(' ').filter(p => p.length > 3);
  let coincidencias = 0;
  for (let i = 0; i < palabrasBase.length; i++) {
    if (domDoc.includes(palabrasBase[i])) coincidencias++;
  }
  return coincidencias >= 1;
}