import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Soporte para payloads con documentos e imágenes en Base64 + CORS institucional para despliegues estáticos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Inicialización diferida de cliente Gemini API según estándares recomendados
// Telemetría oficial aistudio-build e inyección dinámica desde variables de entorno
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Normaliza cadenas de texto para comparaciones flexibles (del analizador histórico)
 */
function normalizarTexto(txt: string): string {
  if (!txt) return '';
  return String(txt)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica si los nombres guardan correspondencia (lógica del analizador de AMMER)
 */
function nombresSonCoincidentes(nombreA: string, nombreB: string): boolean {
  if (!nombreA || !nombreB) return false;
  const aNorm = normalizarTexto(nombreA);
  const bNorm = normalizarTexto(nombreB);
  if (aNorm === bNorm) return true;
  const tokensA = aNorm.split(' ').filter(t => t.length > 2);
  const tokensB = bNorm.split(' ').filter(t => t.length > 2);
  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) matches++;
  }
  return matches >= Math.min(2, Math.min(tokensA.length, tokensB.length));
}

// Endpoint de diagnóstico
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'AMMER AI Document Audit Service',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Endpoint principal: Auditoría Documental Forense y Crediticia AMMER (Multimodal)
app.post('/api/auditar-documentos', async (req, res) => {
  try {
    const { archivos, datosDeclarados, textoExtraido } = req.body || {};

    let listaArchivos: any[] = Array.isArray(archivos) ? archivos : [];
    if (listaArchivos.length === 0 && textoExtraido && String(textoExtraido).trim().length >= 50) {
      listaArchivos = [{
        nombre: 'recibo_markitdown.pdf',
        mimeType: 'application/pdf',
        textoExtraido: String(textoExtraido).trim()
      }];
    }

    if (listaArchivos.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe enviar al menos un archivo (Recibo de Haberes, DNI o Constancia) en formato Base64 o con capa de texto extraída.'
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        ok: false,
        error: 'La clave de análisis documental del servidor (GEMINI_API_KEY) no está configurada.'
      });
    }

    // Preparar las partes multimodales nativas con inlineData (camelCase oficial) para PDFs e imágenes
    const parts: any[] = [];

    for (const arch of listaArchivos) {
      if (!arch) continue;

      if (arch.base64) {
        let mimeType = String(arch.mimeType || 'application/pdf').toLowerCase();
        if (mimeType.includes('pdf')) mimeType = 'application/pdf';
        else if (mimeType.includes('png')) mimeType = 'image/png';
        else if (mimeType.includes('webp')) mimeType = 'image/webp';
        else mimeType = 'image/jpeg';

        const rawB64 = String(arch.base64 || '');
        const base64Pure = (rawB64.includes(',') ? rawB64.split(',').pop() || '' : rawB64).trim();
        if (base64Pure) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Pure
            }
          });
        }
      }

      const txtExtra = arch.textoExtraido ? String(arch.textoExtraido).trim() : '';
      if (txtExtra.length >= 40) {
        parts.push({
          text: `TEXTO COMPLEMENTARIO EXTRAÍDO (${arch.nombre || 'recibo.pdf'}):\n"""\n${txtExtra}\n"""`
        });
      }
    }

    if (parts.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No se encontraron capas de texto ni contenidos binarios válidos en los archivos enviados.'
      });
    }

    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();
    const fechaActualStr = `${String(fechaActual.getDate()).padStart(2, '0')}/${String(mesActual).padStart(2, '0')}/${anioActual}`;

    const promptAuditor = `
Actúa como Auditor Crediticio Forense y Especialista en Verificación Documental de la Asociación Mutual Modelo de Entre Ríos (AMMER).
FECHA DE AUDITORÍA: ${fechaActualStr} (Mes ${mesActual}/${anioActual})

OBJETIVO DE EXTRACCIÓN DUAL:
Analiza el recibo de haberes oficial de la Provincia de Entre Ríos (texto literal extraído y/o imagen adjunta) y extrae con rigor matemático estricto toda la información para construir DOS BLOQUES ESTRUCTURADOS:
1. "resumenDecision": Datos ejecutivos para definir en 5 segundos si se aprueba por planilla, se rechaza o aplica alternativa condicionada por CBU (Titular, DNI, CUIL, Organismo, Cargo, Período, Antigüedad, Bruto, Descuentos de Ley, BERSA, Sidecreer, Mutuales/Proveeduría, FEDEM, Total Descuentos, Líquido, Cupo 50%, Margen Planilla, Estado de Afectación, Embargos, Decisión Planilla, Decisión Alternativa CBU y Scoring).
2. "detalleCompletoRecibo": Transcripción literal renglón por renglón de CADA código, concepto/descripción e importe impreso en el recibo (columnas Haberes y Descuentos), sin omitir ningún código ni fila, junto con el período, escalafón/cargo y subtotales/líquido exactos.

REGLAS INVIOLABLES DE CALIBRACIÓN EQUILIBRADA Y CERO ALUCINACIÓN:
1. ANCLAS EXACTAS DE TOTALES Y LISTA COMPLETA DE CONCEPTOS:
   - Busca explícitamente las etiquetas impresas 'TOTAL HABERES' (asígnalo exactamente a sueldoBrutoTotal y detalleCompletoRecibo.totales.totalHaberes), 'TOTAL DESCUENTOS' (asígnalo exactamente a totalDescuentosRecibo y detalleCompletoRecibo.totales.totalDescuentos) y 'LÍQUIDO A PAGAR' o 'NETO A COBRAR' (asígnalo exactamente a sueldoLiquido y detalleCompletoRecibo.totales.liquidoAPagar).
   - Transcribe en "detalleCompletoRecibo.conceptos" la lista COMPLETA de todos los renglones impresos en el recibo en su orden exacto, sin omitir ninguno: cada fila con su "codigo" (ej. "001", "502", "491", o "" si no tiene código numérico), "descripcion" literal impresa, "haberes" (monto numérico o 0 si corresponde a descuento) y "descuentos" (monto numérico o 0 si corresponde a haber).
   - Prohibido inventar, redondear o estimar importes, códigos, fechas o nombres.
2. SIN BLOQUEOS NI FALSOS POSITIVOS:
   - Si un descuento opcional (consumos BERSA, SIDECREER, otras mutuales/proveedurías, códigos FEDEM 366/368/1115/1117 o embargos) NO figura en el recibo, consigna 0 (y embargoDetectado: false). NUNCA lo marques como "ILEGIBLE".
   - Solo coloca null (y regístralo en camposIlegibles) en un dato obligatorio (Sueldo Bruto Total, Total Descuentos, Sueldo Líquido, Titular o Período) si está físicamente cortado, tapado o borroso.
   - Si un dato no corresponde al documento adjunto (ej. vencimiento de DNI cuando solo se subió recibo), consigna "No consta en este comprobante" sin penalizar.
3. PRIVACIDAD OPERATIVA:
   - Circunscribe el análisis exclusivamente al documento adjunto y a la carátula actual.

CARÁTULA DE LA SOLICITUD ACTUAL (PARA CONTRASTAR):
${datosDeclarados && (datosDeclarados.nombre || datosDeclarados.dni) ? `
- Apellido y Nombre declarado: "${datosDeclarados.nombre || 'NO INFORMADO'}"
- DNI declarado: "${datosDeclarados.dni || 'NO INFORMADO'}"
- CUIL declarado: "${datosDeclarados.cuil || 'NO INFORMADO'}"
- Fecha Nacimiento declarada: "${datosDeclarados.fechaNacimiento || 'NO INFORMADA'}"
- Organismo declarado: "${datosDeclarados.organismo || 'NO INFORMADO'}"
- Cuota simulada del plan: $ ${datosDeclarados.cuota || 0}
- Plazo en cuotas del plan: ${datosDeclarados.plazoCuotas || datosDeclarados.cuotas || 0} meses
- Monto solicitado: $ ${datosDeclarados.monto || 0}
` : 'NO SE ENVIÓ CARÁTULA PREVIA (AUDITORÍA DIRECTA DE DOCUMENTO). Marca estadoCotejoCaratula como "VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)" y extrae todos los datos visibles del comprobante.'}

DIRECTIVAS DE CLASIFICACIÓN CONTABLE (ENTRE RÍOS):
- sueldoBrutoTotal: Valor exacto de 'TOTAL HABERES' (remunerativos + no remunerativos impresos en el recibo).
- descuentosLey: Jubilación (ej. Cód. 502), Obra Social IOSPER/OSER (Cód. 505), Seguros obligatorios (Códs. 510, 524, 327) y Ley 4035.
- consumosBersa: Retenciones Banco Entre Ríos / BERSA (0 si no figura).
- consumosSidecreer: Tarjeta Sidecreer (0 si no figura).
- otrasMutuales: Mutuales, cooperativas, sindicatos y proveedurías (ej. Proveeduría MUPER Cód. 491, Cód. 338, etc.) (0 si no figura).
- codigosFedemMonto: Suma de Códigos Oficiales FEDEM 366, 368 (Activos) o 1115, 1117 (Pasivos) (0 si no figura).
- Embargos Judiciales: Embargos ejecutivos, judiciales o cuota alimentaria (embargoDetectado: true/false).
- Regla de Decisión Dual:
  * cupoMaximo50 = Sueldo Bruto Total * 0.50.
  * margenDisponiblePlanilla = cupoMaximo50 - Total Descuentos.
  * Si margenDisponiblePlanilla > 0 (y cubre la cuota simulada si existe): decisionPlanilla = "APTO POR PLANILLA", decisionAlternativaCBU = "NO REQUIERE ALTERNATIVA (Viable por planilla)".
  * Si margenDisponiblePlanilla <= 0 por descuentos voluntarios/mutuales pero NO registra embargos judiciales, cumple antigüedad mínima (>= 1 año) y percibe sueldoLiquido relevante en cuenta: decisionPlanilla = "RECHAZADO / CUPO EXCEDIDO", decisionAlternativaCBU = "APTO CONDICIONADO (Posee $<sueldoLiquido> de neto en cuenta)".

Devuelve estrictamente JSON conforme al schema.
`;

    parts.push({ text: promptAuditor });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        titular: { type: Type.STRING, description: 'Apellido y Nombres literales impresos en el recibo' },
        dni: { type: Type.STRING, description: 'DNI numérico extraído (sin puntos) o extraído del CUIL' },
        cuil: { type: Type.STRING },
        organismo: { type: Type.STRING, description: 'Organismo o repartición oficial empleadora' },
        dependencia: { type: Type.STRING },
        legajo: { type: Type.STRING },
        cargo: { type: Type.STRING, description: 'Escalafón, categoría o cargo literal impreso en el recibo' },
        situacionRevista: { type: Type.STRING, description: 'ACTIVO TITULAR | ACTIVO SUPLENTE | PASIVO' },
        fechaIngreso: { type: Type.STRING },
        periodo: { type: Type.STRING, description: 'Mes y año liquidado (ej. 08/2026 o Agosto 2026)' },
        esVigente: { type: Type.BOOLEAN },
        antiguedad: { type: Type.STRING, description: 'Antigüedad computable impresa (ej. 9 años, 1 mes)' },
        antiguedadAnios: { type: Type.NUMBER },
        cumpleAntiguedadMinima: { type: Type.BOOLEAN },
        esInvalidezODiscapacidad: { type: Type.BOOLEAN },
        sueldoBrutoTotal: { type: Type.NUMBER, description: 'Valor exacto de TOTAL HABERES' },
        descuentosLey: { type: Type.NUMBER, description: 'Suma de Jubilación, Obra Social IOSPER/OSER, Seguros obligatorios y Ley 4035' },
        consumosBersa: { type: Type.NUMBER, description: 'Retenciones Banco Entre Ríos / BERSA (0 si no figura)' },
        consumosSidecreer: { type: Type.NUMBER, description: 'Tarjeta Sidecreer (0 si no figura)' },
        otrasMutuales: { type: Type.NUMBER, description: 'Proveedurías, mutuales, cooperativas y sindicatos ej. MUPER Cód. 491 (0 si no figura)' },
        consumosFedem: { type: Type.NUMBER, description: 'Suma de códigos oficiales FEDEM 366, 368, 1115 o 1117 (0 si no figura)' },
        codigosFedemDetectados: { type: Type.ARRAY, items: { type: Type.STRING } },
        embargosJudiciales: { type: Type.BOOLEAN },
        embargoMonto: { type: Type.NUMBER },
        embargoConcepto: { type: Type.STRING },
        totalDescuentos: { type: Type.NUMBER, description: 'Valor exacto de TOTAL DESCUENTOS' },
        sueldoLiquido: { type: Type.NUMBER, description: 'Valor exacto de LÍQUIDO A PAGAR / NETO A COBRAR' },
        observacionesEspeciales: { type: Type.STRING },
        conceptos: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              codigo: { type: Type.STRING },
              descripcion: { type: Type.STRING },
              haberes: { type: Type.NUMBER },
              descuentos: { type: Type.NUMBER }
            },
            required: ['codigo', 'descripcion', 'haberes', 'descuentos']
          }
        }
      },
      required: [
        'titular',
        'dni',
        'organismo',
        'periodo',
        'antiguedad',
        'sueldoBrutoTotal',
        'descuentosLey',
        'totalDescuentos',
        'sueldoLiquido',
        'embargosJudiciales',
        'conceptos'
      ]
    };

    const modelosActivos = ['gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
    let auditModelOutput: any = null;
    let ultimoErrorModelo: any = null;

    for (const modelo of modelosActivos) {
      try {
        const response = await ai.models.generateContent({
          model: modelo,
          contents: [{ parts }],
          config: {
            systemInstruction: 'Eres Auditor Crediticio Senior y Especialista en Verificación Documental Forense de AMMER. Extrae literalmente todos los datos personales, organismo, cargo, período, antigüedad, TOTAL HABERES (sueldoBrutoTotal), TOTAL DESCUENTOS (totalDescuentos), LÍQUIDO A PAGAR (sueldoLiquido) y todos los renglones de códigos, conceptos, haberes y descuentos impresos en el recibo de Entre Ríos sin inventar cifras ni redondear. Coloca 0 cuando un descuento opcional no figure en el comprobante y cadena vacía "" si un dato secundario no consta en el recibo. Devuelve exclusivamente JSON puro conforme al schema, sin bloques markdown.',
            responseMimeType: 'application/json',
            responseSchema
          }
        });

        const rawCandidate = response.text ? String(response.text).trim() : '';
        if (!rawCandidate) {
          ultimoErrorModelo = new Error(`El modelo ${modelo} devolvió respuesta vacía.`);
          continue;
        }

        const parsedCandidate = extraerJSONResilienteServidor_(rawCandidate);
        if (!parsedCandidate || typeof parsedCandidate !== 'object') {
          console.warn(`[AMMER Audit] Modelo ${modelo} devolvió JSON no parseable, probando siguiente modelo...`);
          ultimoErrorModelo = new Error(`El modelo ${modelo} devolvió formato JSON incompleto.`);
          continue;
        }

        const mappedCandidate = mapearEstructuraAuditoria(parsedCandidate, datosDeclarados);
        const resDecCand = mappedCandidate?.resumenDecision;
        const conceptsCand = mappedCandidate?.detalleCompletoRecibo?.conceptos || [];
        const conceptosConImporte = conceptsCand.filter((c: any) => Number(c?.haberes || 0) > 0 || Number(c?.descuentos || 0) > 0);

        const tieneDatosSalariales = Boolean(
          resDecCand &&
          (Number(resDecCand.sueldoBrutoTotal || 0) > 0 ||
            Number(resDecCand.sueldoLiquido || 0) > 0 ||
            conceptosConImporte.length > 0)
        );

        if (tieneDatosSalariales) {
          auditModelOutput = mappedCandidate;
          break;
        }

        console.warn(`[AMMER Audit] Modelo ${modelo} no extrajo importes > 0, intentando modelo de respaldo...`);
      } catch (errMod: any) {
        console.warn(`[AMMER Audit] Modelo ${modelo} no disponible o con error:`, errMod?.message || errMod);
        ultimoErrorModelo = errMod;
      }
    }

    if (!auditModelOutput) {
      if (ultimoErrorModelo && ultimoErrorModelo.status && Number(ultimoErrorModelo.status) >= 400 && Number(ultimoErrorModelo.status) < 600) {
        return res.status(Number(ultimoErrorModelo.status)).json({
          ok: false,
          success: false,
          error: ultimoErrorModelo?.message || 'Error en el servicio de modelos de auditoría documental.'
        });
      }
      return res.status(422).json({
        ok: false,
        success: false,
        error: 'No se pudieron extraer haberes ni conceptos legibles del comprobante adjunto. Verifique que el archivo corresponda a un recibo de sueldo nítido en PDF, PNG o JPG.'
      });
    }

    return res.json({
      ok: true,
      success: true,
      resultado: auditModelOutput,
      auditoria: auditModelOutput,
      resumenDecision: auditModelOutput.resumenDecision,
      detalleCompletoRecibo: auditModelOutput.detalleCompletoRecibo,
      resumenJson: auditModelOutput.resumenJson,
      informeMarkdown: auditModelOutput.informeMarkdown
    });

  } catch (error: any) {
    console.error('Error en /api/auditar-documentos:', error);
    return res.status(502).json({
      ok: false,
      error: error?.message || 'No fue posible auditar los documentos adjuntos. Verifique la nitidez de los archivos o intente nuevamente.'
    });
  }
});

function formatCurrencyAuditAr_(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(Number(val))) {
    return '$0,00';
  }
  return '$' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function limpiarMontoServidor_(val: any): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.round(val * 100) / 100 : null;
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
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function repararJSONTruncadoServidor_(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) return null;
  let s = input.substring(start).trim();
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastSafePos = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
        lastSafePos = i;
      }
    }
  }

  if (stack.length === 0 && !inString) return s;
  if (lastSafePos > 0) {
    const cut = s.substring(0, lastSafePos + 1).replace(/,\s*$/, '');
    const remStack: string[] = [];
    let strMode = false;
    let escMode = false;
    for (let j = 0; j < cut.length; j++) {
      const c = cut[j];
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

function extraerJSONResilienteServidor_(str: any): any {
  if (!str) return null;
  if (typeof str === 'object') return str;
  // Capa 1: Limpieza de bloques markdown y parseo directo
  const limpio = String(str).replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(limpio);
  } catch (_) {
    // Capa 2: Substring entre primera '{' y última '}' + limpieza de comas colgantes y saltos
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio !== -1 && fin > inicio) {
      const candidato = limpio.substring(inicio, fin + 1).replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(candidato);
      } catch (__) {
        try {
          return JSON.parse(candidato.replace(/[\r\n\t]/g, ' '));
        } catch (___) {
          // Continúa a Capa 3
        }
      }
    }
    // Capa 3: Reparación automática de llaves/corchetes si una grilla extensa se truncó
    const reparado = repararJSONTruncadoServidor_(limpio);
    if (reparado) {
      try {
        return JSON.parse(reparado.replace(/,\s*([}\]])/g, '$1'));
      } catch (____) {
        console.error('Fallo parseo secundario/terciario JSON en servidor.');
      }
    }
  }
  return null;
}

function clasificarConceptosRecibo_(conceptosRaw: any[]) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rows = Array.isArray(conceptosRaw) ? conceptosRaw.map((c: any) => {
    let habParsed = limpiarMontoServidor_(c?.haberes ?? c?.montoHaber ?? c?.importeHaber);
    let descParsed = limpiarMontoServidor_(c?.descuentos ?? c?.retenciones ?? c?.montoDescuento ?? c?.importeDescuento);
    const montoUnico = limpiarMontoServidor_(c?.monto ?? c?.importe);
    if (habParsed === null && descParsed === null && montoUnico !== null && montoUnico > 0) {
      const tipoStr = String(c?.tipo ?? c?.columna ?? '').toUpperCase();
      if (tipoStr.includes('DESC') || tipoStr.includes('RETEN') || tipoStr.includes('DEDU')) {
        descParsed = montoUnico;
      } else {
        habParsed = montoUnico;
      }
    }
    return {
      codigo: String(c?.codigo ?? '').trim(),
      descripcion: String(c?.descripcion ?? c?.concepto ?? c?.detalle ?? '').trim(),
      haberes: habParsed !== null ? round2(Math.max(0, habParsed)) : 0,
      descuentos: descParsed !== null ? round2(Math.max(0, descParsed)) : 0
    };
  }).filter(r => r.codigo || r.descripcion || r.haberes > 0 || r.descuentos > 0) : [];

  let sumHaberes = 0;
  let sumDescuentos = 0;
  let calcLey = 0;
  let calcBersa = 0;
  let calcSidecreer = 0;
  let calcFedem = 0;
  let calcEmbargo = 0;
  let calcMutuales = 0;
  const fedemCodes: string[] = [];
  const embargoDescs: string[] = [];

  for (const r of rows) {
    sumHaberes = round2(sumHaberes + r.haberes);
    sumDescuentos = round2(sumDescuentos + r.descuentos);
    if (r.descuentos <= 0) continue;

    const codClean = r.codigo.replace(/^0+/, '') || r.codigo;
    const descUp = r.descripcion.toUpperCase();

    if (['366', '368', '1115', '1117'].includes(codClean) || descUp.includes('FEDEM')) {
      calcFedem = round2(calcFedem + r.descuentos);
      const lbl = r.codigo ? `${r.codigo} (${r.descripcion || 'FEDEM'})` : (r.descripcion || 'FEDEM');
      if (!fedemCodes.includes(lbl)) fedemCodes.push(lbl);
    } else if (/EMBARGO|JUDICIAL|ALIMENTO|LITIS|OFICIO/.test(descUp)) {
      calcEmbargo = round2(calcEmbargo + r.descuentos);
      if (r.descripcion) embargoDescs.push(r.descripcion);
    } else if (/SIDECREER/.test(descUp)) {
      calcSidecreer = round2(calcSidecreer + r.descuentos);
    } else if (/BERSA|BANCO ENTRE RIOS|NUEVO BANCO/.test(descUp)) {
      calcBersa = round2(calcBersa + r.descuentos);
    } else if (
      ['502', '505', '510', '524', '327'].includes(codClean) ||
      /JUBILAC|CAJA JUB|IOSPER|OSER|OBRA SOCIAL|LEY 4035|SEGURO.*OBLIG|APORTE PERSONAL|FONDO SOLIDARIO/.test(descUp)
    ) {
      calcLey = round2(calcLey + r.descuentos);
    } else {
      calcMutuales = round2(calcMutuales + r.descuentos);
    }
  }

  return {
    rows,
    sumHaberes: rows.length > 0 ? sumHaberes : null,
    sumDescuentos: rows.length > 0 ? sumDescuentos : null,
    calcLey,
    calcBersa,
    calcSidecreer,
    calcFedem,
    calcEmbargo,
    calcMutuales,
    fedemCodes,
    embargoConcepto: embargoDescs.join('; ')
  };
}

function mapearEstructuraAuditoria(raw: any, datosDeclarados: any) {
  const DEFAULT_TXT = 'No especificado';
  const rawIn = raw || {};
  const resDecIn = rawIn.resumenDecision || {};
  const detRecIn = rawIn.detalleCompletoRecibo || {};
  const desgloseConceptos = clasificarConceptosRecibo_(detRecIn.conceptos || rawIn.conceptos);

  const idObj = rawIn.identidad || (rawIn.datosAgente ? {
    titularDetectado: rawIn.datosAgente.nombreTitular || rawIn.datosAgente.nombreApellido || rawIn.datosAgente.nombre,
    dni: rawIn.datosAgente.dni || rawIn.datosAgente.dniCuil,
    cuil: rawIn.datosAgente.cuil || 'No consta en recibo',
    estadoCotejoCaratula: rawIn.datosAgente.estadoCotejoCaratula || ''
  } : (resDecIn.titular || resDecIn.dni ? {
    titularDetectado: resDecIn.titular,
    dni: resDecIn.dni,
    cuil: resDecIn.cuil || 'No consta en recibo',
    estadoCotejoCaratula: ''
  } : (rawIn.titular || rawIn.dni || rawIn.nombre ? {
    titularDetectado: rawIn.titular || rawIn.nombre,
    dni: rawIn.dni,
    cuil: rawIn.cuil || 'No consta en recibo',
    estadoCotejoCaratula: ''
  } : {})));

  const lab = rawIn.datosLaborales || (rawIn.datosAgente ? {
    organismoEmpleador: rawIn.datosAgente.organismo,
    escalafonCargo: rawIn.datosAgente.escalafonCargo || detRecIn.escalafonCargo || '',
    situacionRevista: rawIn.datosAgente.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: rawIn.datosAgente.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: rawIn.datosAgente.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: rawIn.datosAgente.cumpleAntiguedadMinima
  } : (resDecIn.organismo || resDecIn.antiguedad || resDecIn.cargo ? {
    organismoEmpleador: resDecIn.organismo,
    escalafonCargo: resDecIn.cargo || detRecIn.escalafonCargo || '',
    situacionRevista: resDecIn.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: resDecIn.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: resDecIn.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: resDecIn.antiguedadApta
  } : (rawIn.organismo || rawIn.antiguedad || rawIn.cargo ? {
    organismoEmpleador: rawIn.organismo,
    escalafonCargo: rawIn.cargo || detRecIn.escalafonCargo || '',
    situacionRevista: rawIn.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: rawIn.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: rawIn.antiguedad || 'No registrada',
    cumpleAntiguedadMinima: rawIn.antiguedadApta
  } : {})));

  const vig = rawIn.vigenciaRecibo || (rawIn.liquidacion ? {
    periodoLiquidado: rawIn.liquidacion.periodo || rawIn.liquidacion.periodoLiquidado || rawIn.datosAgente?.periodoLiquidado,
    estadoVigencia: rawIn.liquidacion.estadoVigencia || 'VIGENTE',
    esVigente: rawIn.liquidacion.esVigente !== false
  } : (resDecIn.periodo || detRecIn.periodo || rawIn.periodo ? {
    periodoLiquidado: resDecIn.periodo || detRecIn.periodo || rawIn.periodo,
    estadoVigencia: 'VIGENTE',
    esVigente: true
  } : {}));

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
    sueldoBrutoTotal: resDecIn.sueldoBrutoTotal ?? detRecIn.totales?.totalHaberes,
    descuentosLey: resDecIn.descuentosLey ?? desgloseConceptos.calcLey,
    consumosBersa: resDecIn.consumosBersa ?? desgloseConceptos.calcBersa,
    consumosSidecreer: resDecIn.consumosSidecreer ?? desgloseConceptos.calcSidecreer,
    otrasMutuales: resDecIn.otrasMutualesOProveeduria ?? resDecIn.otrasMutuales ?? desgloseConceptos.calcMutuales,
    codigosFedemMonto: resDecIn.consumosFedem ?? resDecIn.codigosFedemMonto ?? desgloseConceptos.calcFedem,
    codigosFedemDetectados: desgloseConceptos.fedemCodes,
    embargoDetectado: Boolean(resDecIn.embargosJudiciales) || desgloseConceptos.calcEmbargo > 0,
    embargoMonto: typeof resDecIn.embargosJudiciales === 'number' ? resDecIn.embargosJudiciales : desgloseConceptos.calcEmbargo,
    embargoConcepto: desgloseConceptos.embargoConcepto,
    totalDescuentosRecibo: resDecIn.totalDescuentos ?? detRecIn.totales?.totalDescuentos,
    sueldoLiquido: resDecIn.sueldoLiquido ?? detRecIn.totales?.liquidoAPagar
  } : rawIn));

  const scRaw = rawIn.scoringAmmer || (rawIn.scoring ? {
    puntajeTotal: rawIn.scoring.puntaje ?? rawIn.scoring.puntajeTotal,
    calificacionLetra: rawIn.scoring.calificacion || rawIn.scoring.calificacionLetra,
    dictamen: (typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 60) ? 'RECHAZADO' : ((typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 80) ? 'OBSERVADO' : 'APTO_OTORGAMIENTO'),
    dictamenAuditor: rawIn.scoring.dictamen || rawIn.scoring.dictamenAuditor
  } : (resDecIn.scoringSugerido !== undefined ? {
    puntajeTotal: resDecIn.scoringSugerido,
    decisionPlanilla: resDecIn.decisionPlanilla,
    decisionAlternativaCBU: resDecIn.decisionAlternativaCBU
  } : {}));

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const toNumOrNull = (v: any): number | null => limpiarMontoServidor_(v);

  let sueldoBruto = toNumOrNull(sal.sueldoBrutoTotal ?? sal.sueldoBruto ?? detRecIn.totales?.totalHaberes);
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

  let embargoMonto = toNumOrNull(sal.embargoMonto ?? (typeof sal.embargosJudiciales === 'number' ? sal.embargosJudiciales : null));
  if ((embargoMonto === null || embargoMonto === 0) && desgloseConceptos.calcEmbargo > 0) embargoMonto = desgloseConceptos.calcEmbargo;

  let totalDescuentosRecibo = toNumOrNull(sal.totalDescuentosRecibo ?? sal.totalDescuentos ?? detRecIn.totales?.totalDescuentos);
  if (totalDescuentosRecibo === null && desgloseConceptos.sumDescuentos !== null) totalDescuentosRecibo = desgloseConceptos.sumDescuentos;

  let sueldoLiquido = toNumOrNull(sal.sueldoLiquido ?? sal.sueldoNeto ?? detRecIn.totales?.liquidoAPagar);
  if (sueldoLiquido === null && sueldoBruto !== null && totalDescuentosRecibo !== null && sueldoBruto >= totalDescuentosRecibo) {
    sueldoLiquido = round2(sueldoBruto - totalDescuentosRecibo);
  }

  // Deducciones voluntarias ausentes representan $0,00 (nunca bloquear por ilegibilidad)
  const lecturaSalarialPrincipalOk = (sueldoBruto !== null || sueldoLiquido !== null || totalDescuentosRecibo !== null);
  if (consumosBersa === null) consumosBersa = 0;
  if (consumosSidecreer === null) consumosSidecreer = 0;
  if (otrasMutuales === null) otrasMutuales = 0;
  if (codigosFedemMonto === null) codigosFedemMonto = 0;
  if (embargoMonto === null) embargoMonto = 0;

  if (totalDescuentosRecibo === null && sueldoBruto !== null && sueldoLiquido !== null && sueldoBruto >= sueldoLiquido) {
    totalDescuentosRecibo = round2(sueldoBruto - sueldoLiquido);
  } else if (totalDescuentosRecibo === null && descuentosLey !== null) {
    totalDescuentosRecibo = round2(
      descuentosLey + (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
    );
  }

  // Regla matemática estricta AMMER:
  // Cupo Máximo Legal = Sueldo Bruto Total * 0.50
  // Margen Disponible Planilla = Cupo Máximo Legal - Total Descuentos Actuales del Recibo
  const cupoMaximoLegal = sueldoBruto !== null ? round2(sueldoBruto * 0.50) : null;
  const margenDisponibleMensual = (cupoMaximoLegal !== null && totalDescuentosRecibo !== null)
    ? round2(cupoMaximoLegal - totalDescuentosRecibo)
    : null;

  const cuotaSimulada = Number(datosDeclarados?.cuota || 0);
  const alertasCriticas: string[] = Array.isArray(scRaw.alertasCriticas) ? [...scRaw.alertasCriticas] : [];
  const camposIlegibles: string[] = Array.isArray(scRaw.camposIlegibles) ? [...scRaw.camposIlegibles] : [];

  if (sueldoBruto === null && !camposIlegibles.includes('Sueldo Bruto Total')) camposIlegibles.push('Sueldo Bruto Total');
  if (totalDescuentosRecibo === null && !camposIlegibles.includes('Total Descuentos en Recibo')) camposIlegibles.push('Total Descuentos en Recibo');
  if (sueldoLiquido === null && !camposIlegibles.includes('Sueldo Líquido de Bolsillo')) camposIlegibles.push('Sueldo Líquido de Bolsillo');

  // Control determinístico de coincidencia contra carátula cuando exista
  const dniDeclarado = String(datosDeclarados?.dni || '').replace(/\D/g, '');
  const nombreDeclarado = String(datosDeclarados?.nombre || '').trim();
  const hayCaratulaPrevia = Boolean(dniDeclarado || nombreDeclarado);

  let estadoCotejo = String(idObj.estadoCotejoCaratula || '').trim();
  if (!hayCaratulaPrevia) {
    if (!estadoCotejo || estadoCotejo.includes('ILEGIBLE') || estadoCotejo === 'COINCIDE') {
      estadoCotejo = 'VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)';
    }
  } else if (!estadoCotejo || estadoCotejo.includes('ILEGIBLE')) {
    estadoCotejo = 'VERIFICADO EN DOCUMENTO';
  }

  const dniExtraido = String(idObj.dni || '').replace(/\D/g, '');
  if (dniDeclarado && dniExtraido && dniDeclarado !== dniExtraido) {
    estadoCotejo = 'DISCREPANCIA DETECTADA';
    alertasCriticas.push(`Discrepancia de DNI: carátula ${dniDeclarado} vs documento ${dniExtraido}.`);
  }
  if (nombreDeclarado && idObj.titularDetectado && !String(idObj.titularDetectado).includes('ILEGIBLE')) {
    if (!nombresSonCoincidentes(nombreDeclarado, String(idObj.titularDetectado))) {
      estadoCotejo = 'DISCREPANCIA DETECTADA';
      alertasCriticas.push(`Discrepancia de Titular: carátula "${nombreDeclarado}" vs documento "${idObj.titularDetectado}".`);
    }
  }

  // Verificación de tope de edad 80 años para pasivos si hay fechaNacimiento y plazo
  let cumpleTopeEdad80: boolean | null = lab.cumpleTopeEdad80 !== undefined ? lab.cumpleTopeEdad80 : null;
  const esPasivo = String(lab.situacionRevista || '').toUpperCase().includes('PASIVO');
  const dobStr = String(idObj.fechaNacimiento || datosDeclarados?.fechaNacimiento || '').trim();
  const plazoMeses = Number(datosDeclarados?.plazoCuotas || datosDeclarados?.cuotas || 0);
  if (esPasivo && /^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
    const dob = new Date(dobStr + 'T00:00:00Z');
    if (!isNaN(dob.getTime())) {
      const hoy = new Date();
      let edadActual = hoy.getUTCFullYear() - dob.getUTCFullYear();
      const mDiff = hoy.getUTCMonth() - dob.getUTCMonth();
      if (mDiff < 0 || (mDiff === 0 && hoy.getUTCDate() < dob.getUTCDate())) edadActual--;
      const edadFinPlan = edadActual + (plazoMeses > 0 ? (plazoMeses / 12) : 0);
      cumpleTopeEdad80 = edadFinPlan < 80;
      if (!cumpleTopeEdad80) {
        alertasCriticas.push(`Supera tope previsional de 80 años al finalizar el plan (${edadFinPlan.toFixed(1)} años).`);
      }
    }
  }

  const embargoDetectadoBool = Boolean(sal.embargoDetectado || resDecIn.embargosJudiciales) || (embargoMonto !== null && embargoMonto > 0);
  const embargoConceptoStr = sal.embargoConcepto || desgloseConceptos.embargoConcepto || '';

  if (lab.esInvalidezODiscapacidad) {
    alertasCriticas.push('Exclusión reglamentaria: Jubilación por Invalidez o Pensión por Discapacidad no viable.');
  }
  if (embargoDetectadoBool) {
    alertasCriticas.push(`Presencia de embargo judicial/retención: ${embargoConceptoStr || 'Embargo'} (${formatCurrencyAuditAr_(embargoMonto)}).`);
  }

  // Diagnóstico de afectación por planilla y canal alternativo CBU
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
        ? `Margen disponible por planilla (${formatCurrencyAuditAr_(margenDisponibleMensual)}) insuficiente para cuota simulada (${formatCurrencyAuditAr_(cuotaSimulada)}).`
        : `Margen disponible por planilla negativo o agotado (${formatCurrencyAuditAr_(margenDisponibleMensual)}).`
    );
  }

  const tieneExclusionDura = Boolean(
    lab.esInvalidezODiscapacidad ||
    cumpleTopeEdad80 === false ||
    estadoCotejo === 'DISCREPANCIA DETECTADA' ||
    embargoDetectadoBool ||
    lab.cumpleAntiguedadMinima === false
  );

  const umbralNetoCbu = Math.max(150000, cuotaSimulada > 0 ? round2(cuotaSimulada * 2) : 150000);
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
      decisionAlternativaCBU = `APTO CONDICIONADO (Posee ${formatCurrencyAuditAr_(sueldoLiquido)} de neto en cuenta)`;
    } else if (tieneExclusionDura) {
      decisionAlternativaCBU = 'NO VIABLE POR CBU (Registra restricción excluyente / embargo / antigüedad)';
    } else {
      decisionAlternativaCBU = 'NO VIABLE POR CBU (Neto en cuenta insuficiente)';
    }
  }

  // Score y dictamen coherente con decisión dual (planilla vs alternativa CBU)
  let scoreTotal = typeof scRaw.puntajeTotal === 'number'
    ? Math.max(0, Math.min(100, Math.round(scRaw.puntajeTotal)))
    : (lecturaSalarialPrincipalOk ? 85 : 55);
  let dictamen = String(scRaw.dictamen || (lecturaSalarialPrincipalOk ? 'APTO_OTORGAMIENTO' : 'OBSERVADO')).toUpperCase();
  if (dictamen.startsWith('APTO')) dictamen = 'APTO_OTORGAMIENTO';

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

  const codigosFedemList = Array.isArray(sal.codigosFedemDetectados) && sal.codigosFedemDetectados.length > 0
    ? sal.codigosFedemDetectados
    : desgloseConceptos.fedemCodes;
  const codigosFedemPrevios = Boolean(resDecIn.codigosFedemPrevios) || codigosFedemList.length > 0 || (codigosFedemMonto || 0) > 0;
  const fedemObs = codigosFedemList.length > 0
    ? `Códigos detectados: ${codigosFedemList.join(', ')}`
    : 'Sin códigos FEDEM (366/368/1115/1117) en recibo';

  const dniCoincideBool = estadoCotejo === 'COINCIDE' || estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO');
  const vigenciaBool = vig.esVigente === true || vig.estadoVigencia === 'VIGENTE';
  const cumpleAntig = lab.cumpleAntiguedadMinima !== undefined
    ? Boolean(lab.cumpleAntiguedadMinima)
    : (esPasivo ? true : (typeof lab.antiguedadAnios === 'number' ? lab.antiguedadAnios >= 1 : true));

  const escalafonCargoStr = String(detRecIn.escalafonCargo || lab.escalafonCargo || lab.situacionRevista || 'Agente / Activo').trim();
  const periodoStr = String(vig.periodoLiquidado || detRecIn.periodo || 'Mes auditado').trim();
  const titularStr = String(idObj.titularDetectado || datosDeclarados?.nombre || DEFAULT_TXT).trim();
  const dniStr = String(dniExtraido || idObj.dni || datosDeclarados?.dni || DEFAULT_TXT).trim();
  const cuilStr = String(idObj.cuil || datosDeclarados?.cuil || '').trim();
  const organismoStr = String(lab.organismoEmpleador || datosDeclarados?.organismo || 'Organismo Provincial').trim();
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
    sueldoBrutoTotal: sueldoBruto ?? 0,
    descuentosLey: descuentosLey ?? 0,
    consumosBersa: consumosBersa ?? 0,
    consumosSidecreer: consumosSidecreer ?? 0,
    otrasMutualesOProveeduria: otrasMutuales ?? 0,
    consumosFedem: codigosFedemMonto ?? 0,
    totalDescuentos: totalDescuentosRecibo ?? 0,
    sueldoLiquido: sueldoLiquido ?? 0,
    cupoMaximo50: cupoMaximoLegal ?? 0,
    margenDisponiblePlanilla: margenDisponibleMensual ?? 0,
    estadoAfectacion: estadoAfectacionPlanilla,
    embargosJudiciales: embargoDetectadoBool,
    codigosFedemPrevios,
    decisionPlanilla,
    decisionAlternativaCBU,
    scoringSugerido: scoreTotal
  };

  const detalleCompletoRecibo = {
    periodo: periodoStr,
    escalafonCargo: escalafonCargoStr,
    conceptos: desgloseConceptos.rows,
    totales: {
      totalHaberes: sueldoBruto ?? 0,
      totalDescuentos: totalDescuentosRecibo ?? 0,
      liquidoAPagar: sueldoLiquido ?? 0
    }
  };

  const cotejoBadgeMd = estadoCotejo === 'COINCIDE'
    ? '🟢 COINCIDENCIA TOTAL'
    : (estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO')
      ? '🟢 LECTURA DIRECTA DEL DOCUMENTO'
      : (estadoCotejo === 'DISCREPANCIA DETECTADA' ? '🔴 DISCREPANCIA DETECTADA' : `⚠️ ${estadoCotejo}`));
  const vigenciaBadgeMd = vigenciaBool
    ? '🟢 VIGENTE'
    : (vig.estadoVigencia === 'DESACTUALIZADO' ? '⚠️ DESACTUALIZADO' : `⚠️ ${vig.estadoVigencia || 'VERIFICAR'}`);
  const antigBadgeMd = cumpleAntig
    ? '🟢 CUMPLE REQUISITO (Mínimo 1 año)'
    : (lab.cumpleAntiguedadMinima === false ? '🔴 NO CUMPLE' : '⚠️ Verificar fecha de ingreso en carátula');
  const embargoMd = embargoDetectadoBool
    ? `🔴 PRESENCIA DE EMBARGO DETECTADA: ${formatCurrencyAuditAr_(embargoMonto)} / ${embargoConceptoStr || 'Concepto judicial/retención'}`
    : '🟢 SIN EMBARGOS';
  const afectacionMd = estadoAfectacion === 'MARGEN DISPONIBLE'
    ? '🟢 MARGEN DISPONIBLE POR PLANILLA'
    : (estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA' ? `🔴 ${estadoAfectacionPlanilla}` : `⚠️ ${estadoAfectacion}`);

  const dictamenTextoFinal = scRaw.dictamenAuditor ||
    (decisionPlanilla === 'APTO POR PLANILLA'
      ? `APTO POR PLANILLA: Margen disponible de ${formatCurrencyAuditAr_(margenDisponibleMensual)} dentro del tope legal del 50%. Legajo sin embargos ni observaciones excluyentes.`
      : (aplicaAlternativaCbu
        ? `PLANILLA EXCEDIDA (${formatCurrencyAuditAr_(margenDisponibleMensual)}) por deducciones voluntarias, sin embargos judiciales. ${decisionAlternativaCBU} para evaluar vía Débito CBU / Sidecreer o cancelación.`
        : `NO VIABLE: ${alertasCriticas[0] || 'Restricción crediticia o margen agotado'}. Requiere revisión del comité antes de avanzar.`));

  const tablaConceptosMd = desgloseConceptos.rows.length > 0
    ? [
        '',
        '#### 🧾 6. Transcripción Literal del Recibo (Detalle Completo de Conceptos)',
        `* **Período:** ${detalleCompletoRecibo.periodo} • **Escalafón / Cargo:** ${detalleCompletoRecibo.escalafonCargo}`,
        '',
        '| Código | Concepto / Descripción | Haberes ($) | Descuentos ($) |',
        '| :--- | :--- | ---: | ---: |',
        ...desgloseConceptos.rows.map(r =>
          `| ${r.codigo || '—'} | ${r.descripcion || '—'} | ${r.haberes > 0 ? formatCurrencyAuditAr_(r.haberes) : '—'} | ${r.descuentos > 0 ? formatCurrencyAuditAr_(r.descuentos) : '—'} |`
        ),
        `| **TOTALES** | **SUBTOTALES Y LÍQUIDO EXACTO** | **${formatCurrencyAuditAr_(sueldoBruto)}** | **${formatCurrencyAuditAr_(totalDescuentosRecibo)}** |`,
        `| **NETO** | **LÍQUIDO A PAGAR EN CUENTA** | **${formatCurrencyAuditAr_(sueldoLiquido)}** | — |`
      ]
    : [];

  const informeMarkdown = [
    '### 📑 INFORME DE AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER',
    '---',
    '',
    '#### ⚡ Resumen Ejecutivo de Decisión (5 Segundos)',
    `* **Decisión Descuento por Planilla:** **${decisionPlanilla}** (${afectacionMd})`,
    `* **Decisión Alternativa CBU / Cuenta:** **${decisionAlternativaCBU}**`,
    `* **Scoring Sugerido AMMER:** **${scoreTotal} / 100** • ${calificacionLetra}`,
    '',
    '#### 👤 1. Verificación de Identidad y Coincidencias',
    `* **Titular Detectado:** ${titularStr}`,
    `* **DNI / CUIL:** ${dniStr}${cuilStr ? ' / ' + cuilStr : ''}`,
    `* **Cotejo con Carátula:** ${cotejoBadgeMd}`,
    `* **Período Liquidado:** ${periodoStr} • ${vigenciaBadgeMd}`,
    '',
    '#### 🏢 2. Datos Laborales y Situación de Revista',
    `* **Organismo Empleador:** ${organismoStr}`,
    `* **Escalafón / Cargo:** ${escalafonCargoStr}`,
    `* **Condición de Revista:** ${lab.situacionRevista || 'ACTIVO TITULAR'}`,
    `* **Antigüedad Registrada:** ${antiguedadStr} • ${antigBadgeMd}`,
    `* **Observaciones Especiales:** ${lab.observacionesEspeciales || 'Sin observaciones especiales registradas'}`,
    '',
    '#### 💵 3. Radiografía Salarial Consolidada',
    '| Concepto | Monto Detectado ($) | Observaciones / Estado |',
    '| :--- | :--- | :--- |',
    `| **Sueldo Bruto Total** | ${formatCurrencyAuditAr_(sueldoBruto)} | Remunerativo + No Remunerativo |`,
    `| **Descuentos de Ley** | ${formatCurrencyAuditAr_(descuentosLey)} | Jubilación, IOSPER, Ley 4035 |`,
    `| **Consumos BERSA / Préstamos** | ${formatCurrencyAuditAr_(consumosBersa)} | Retenciones bancarias |`,
    `| **Consumos SIDECREER** | ${formatCurrencyAuditAr_(consumosSidecreer)} | Descuento por tarjeta oficial |`,
    `| **Otras Mutuales / Proveeduría** | ${formatCurrencyAuditAr_(otrasMutuales)} | Descuentos por código voluntario |`,
    `| **Códigos FEDEM Activos** | ${formatCurrencyAuditAr_(codigosFedemMonto)} | ${fedemObs} |`,
    `| **Total Descuentos en Recibo** | ${formatCurrencyAuditAr_(totalDescuentosRecibo)} | Deducciones consolidadas |`,
    `| **Sueldo Líquido de Bolsillo** | ${formatCurrencyAuditAr_(sueldoLiquido)} | Neto final a cobrar |`,
    '',
    `* **Embargos Judiciales / Inhibiciones:** ${embargoMd}`,
    '',
    '#### 📊 4. Análisis de Afectación Salarial y Margen',
    `* **Cupo Máximo Legal (50% del Bruto):** ${formatCurrencyAuditAr_(cupoMaximoLegal)}`,
    `* **Margen Disponible por Planilla:** ${formatCurrencyAuditAr_(margenDisponibleMensual)}`,
    `* **Estado de Afectación:** ${afectacionMd}`,
    '',
    '#### 🛡️ 5. Calificación Crediticia AMMER (Scoring)',
    `* **Score AMMER:** ${scoreTotal} / 100 • **Calificación:** ${calificacionLetra}`,
    `* **Dictamen del Auditor:** ${dictamenTextoFinal}`,
    ...tablaConceptosMd
  ].join('\n');

  const pCalidad = camposIlegibles.length === 0 ? 19 : Math.max(6, 18 - camposIlegibles.length * 3);
  const pVigencia = vigenciaBool ? 19 : 9;
  const pIdentidad = dniCoincideBool ? 29 : 10;
  const pFinanciera = Math.max(0, Math.min(30, scoreTotal - (pCalidad + pVigencia + pIdentidad)));

  const resumenJson = {
    resumenDecision,
    detalleCompletoRecibo
  };

  const descuentosVoluntariosTotal = round2(
    (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
  );

  return {
    resumenDecision,
    detalleCompletoRecibo,
    scoringCrediticio: {
      puntajeTotal: scoreTotal,
      calificacionLetra,
      dictamen,
      decisionPlanilla,
      decisionAlternativaCBU,
      nivelConfianza: scRaw.nivelConfianza || (scoreTotal >= 80 ? 'ALTO' : (scoreTotal >= 60 ? 'MEDIO' : 'BAJO')),
      pilares: {
        calidadDocumental: { puntaje: pCalidad, maximo: 20, detalle: camposIlegibles.length ? `Campos faltantes: ${camposIlegibles.join(', ')}` : 'Lectura literal verificada sin campos cortados o borrosos.' },
        vigenciaYFormalidad: { puntaje: pVigencia, maximo: 20, detalle: vigenciaBool ? `Período ${periodoStr} vigente según calendario.` : `Período ${periodoStr} observado.` },
        coincidenciaIdentidad: { puntaje: pIdentidad, maximo: 30, detalle: dniCoincideBool ? 'Coincidencia total entre documento y carátula.' : 'Discrepancia en cotejo de identidad.' },
        capacidadFinanciera: { puntaje: pFinanciera, maximo: 30, detalle: `Tope 50% Bruto (${formatCurrencyAuditAr_(cupoMaximoLegal)}) vs Descuentos (${formatCurrencyAuditAr_(totalDescuentosRecibo)}).` }
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
      cumpleTopeEdad80,
      observacionesEspeciales: lab.observacionesEspeciales || '',
      periodo: periodoStr,
      estadoPeriodo: vig.estadoVigencia || 'VIGENTE',
      reciboVencido: !vigenciaBool,
      sueldoBruto: sueldoBruto ?? 0,
      descuentosLey: descuentosLey ?? 0,
      consumosBersa,
      consumosSidecreer,
      otrasMutuales,
      codigosFedemMonto,
      codigosFedemDetectados: codigosFedemList,
      embargoDetectado: embargoDetectadoBool,
      embargoMonto,
      embargoConcepto: embargoConceptoStr,
      descuentosPrestamosYMutuales: descuentosVoluntariosTotal,
      totalDescuentosRecibo: totalDescuentosRecibo ?? 0,
      sueldoNeto: sueldoLiquido ?? 0,
      topeLegal50Porciento: cupoMaximoLegal ?? 0,
      margenDisponibleCuota: margenDisponibleMensual ?? 0,
      estadoAfectacion,
      estadoAfectacionPlanilla,
      decisionPlanilla,
      decisionAlternativaCBU,
      conceptos: desgloseConceptos.rows
    },
    dni: {
      numero: dniStr,
      nombreCompleto: titularStr,
      fechaNacimiento: idObj.fechaNacimiento || '',
      domicilio: idObj.domicilio || '',
      fechaVencimiento: idObj.fechaVencimientoDni || 'No consta / Sin imagen DNI',
      dniVigente: idObj.dniVigente !== false
    },
    cruceIdentidad: {
      estadoCotejo,
      coincideDni: dniCoincideBool,
      coincideNombre: dniCoincideBool,
      coincideCuil: dniCoincideBool,
      discrepanciasDetectadas: Array.isArray(idObj.detalleDiscrepancias) ? idObj.detalleDiscrepancias : []
    },
    alertasCriticas,
    camposIlegibles,
    observacionesAuditor: [
      `Organismo: ${organismoStr} (${lab.situacionRevista || 'ACTIVO TITULAR'}).`,
      `Decisión Planilla: ${decisionPlanilla} | Alternativa CBU: ${decisionAlternativaCBU}.`,
      `Cupo Máximo Legal (50% del Bruto): ${formatCurrencyAuditAr_(cupoMaximoLegal)} | Margen Disponible: ${formatCurrencyAuditAr_(margenDisponibleMensual)}.`,
      lab.observacionesEspeciales || ''
    ].filter(Boolean),
    informeEjecutivo: dictamenTextoFinal,
    informeMarkdown,
    resumenJson
  };
}

// Montar Vite middlewares en desarrollo
async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {}
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AMMER Server] Servidor Full-Stack activo en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
