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

// Soporte para payloads con documentos e imágenes en Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const { archivos, datosDeclarados } = req.body;

    if (!archivos || !Array.isArray(archivos) || archivos.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debe enviar al menos un archivo (Recibo de Haberes, DNI o Constancia) en formato Base64.'
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({
        ok: false,
        error: 'La clave de análisis documental del servidor (GEMINI_API_KEY) no está configurada.'
      });
    }

    // Preparar las partes multimodales para Gemini
    const parts: any[] = [];

    for (const arch of archivos) {
      if (!arch || !arch.base64) continue;
      let mimeType = String(arch.mimeType || 'application/pdf').toLowerCase();
      if (mimeType.includes('pdf')) mimeType = 'application/pdf';
      else if (mimeType.includes('png')) mimeType = 'image/png';
      else if (mimeType.includes('webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';

      const rawB64 = String(arch.base64 || '');
      const base64Pure = (rawB64.includes(',') ? rawB64.split(',').pop() || '' : rawB64).trim();

      parts.push({
        inlineData: {
          mimeType,
          data: base64Pure
        }
      });
    }

    if (parts.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No se encontraron contenidos binarios válidos en los archivos enviados.'
      });
    }

    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1;
    const anioActual = fechaActual.getFullYear();
    const fechaActualStr = `${String(fechaActual.getDate()).padStart(2, '0')}/${String(mesActual).padStart(2, '0')}/${anioActual}`;

    const promptAuditor = `
Actúa como Auditor Crediticio Senior y Especialista en Verificación Documental Forense de la Asociación Mutual Modelo de Entre Ríos (AMMER).
FECHA DE AUDITORÍA: ${fechaActualStr} (Mes ${mesActual}/${anioActual})

OBJETIVO DE EXTRACCIÓN DUAL:
Analiza el comprobante adjunto (recibo de haberes oficial de Entre Ríos, DNI y/o constancias) y extrae con fidelidad literal toda la información necesaria para construir DOS BLOQUES ESTRUCTURADOS:
1. "resumenDecision": Datos ejecutivos para definir en 5 segundos si se aprueba por planilla, se rechaza o aplica alternativa condicionada por CBU (Titular, DNI, Organismo, Antigüedad, Bruto, Descuentos, Líquido, Cupo 50%, Margen Planilla, Estado de Afectación, Embargos, Códigos FEDEM previos, Decisión Planilla, Decisión Alternativa CBU y Scoring).
2. "detalleCompletoRecibo": Transcripción literal renglón por renglón de CADA código, concepto/descripción e importe impreso en el recibo (columnas Haberes y Descuentos), junto con el período, escalafón/cargo y subtotales/líquido exactos.

REGLAS INVIOLABLES DE CALIBRACIÓN EQUILIBRADA Y CERO ALUCINACIÓN:
1. EXTRACCIÓN LITERAL COMPLETA:
   - Transcribe en "detalleCompletoRecibo.conceptos" TODOS los renglones impresos en el recibo en su orden exacto: cada fila con su "codigo" (ej. "001", "502", "491", o "" si no tiene código numérico), "descripcion" literal impresa, "haberes" (monto numérico o 0 si corresponde a descuento) y "descuentos" (monto numérico o 0 si corresponde a haber).
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
- sueldoBrutoTotal: Suma total de Haberes (remunerativos + no remunerativos impresos en el recibo).
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
        identidad: {
          type: Type.OBJECT,
          properties: {
            titularDetectado: { type: Type.STRING },
            dni: { type: Type.STRING },
            cuil: { type: Type.STRING },
            fechaNacimiento: { type: Type.STRING },
            domicilio: { type: Type.STRING },
            fechaVencimientoDni: { type: Type.STRING },
            dniVigente: { type: Type.BOOLEAN },
            estadoCotejoCaratula: { type: Type.STRING, description: 'COINCIDE | VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA) | DISCREPANCIA DETECTADA | ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO' },
            detalleDiscrepancias: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['titularDetectado', 'dni', 'cuil', 'estadoCotejoCaratula']
        },
        datosLaborales: {
          type: Type.OBJECT,
          properties: {
            organismoEmpleador: { type: Type.STRING },
            dependencia: { type: Type.STRING },
            legajo: { type: Type.STRING },
            escalafonCargo: { type: Type.STRING, description: 'Escalafón, categoría o cargo literal impreso en el recibo' },
            situacionRevista: { type: Type.STRING, description: 'ACTIVO TITULAR | ACTIVO SUPLENTE | PASIVO | ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO' },
            fechaIngreso: { type: Type.STRING },
            antiguedadDetalle: { type: Type.STRING },
            antiguedadAnios: { type: Type.NUMBER },
            cumpleAntiguedadMinima: { type: Type.BOOLEAN },
            esSaludSuplenteDia19: { type: Type.BOOLEAN },
            requiereSituacionSage: { type: Type.BOOLEAN },
            esInvalidezODiscapacidad: { type: Type.BOOLEAN },
            cumpleTopeEdad80: { type: Type.BOOLEAN },
            observacionesEspeciales: { type: Type.STRING }
          },
          required: ['organismoEmpleador', 'escalafonCargo', 'situacionRevista', 'antiguedadDetalle', 'observacionesEspeciales']
        },
        vigenciaRecibo: {
          type: Type.OBJECT,
          properties: {
            periodoLiquidado: { type: Type.STRING, description: 'MM/YYYY o ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO' },
            estadoVigencia: { type: Type.STRING, description: 'VIGENTE | DESACTUALIZADO | ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO' },
            esVigente: { type: Type.BOOLEAN }
          },
          required: ['periodoLiquidado', 'estadoVigencia', 'esVigente']
        },
        radiografiaSalarial: {
          type: Type.OBJECT,
          properties: {
            sueldoBrutoTotal: { type: Type.NUMBER },
            descuentosLey: { type: Type.NUMBER },
            consumosBersa: { type: Type.NUMBER },
            consumosSidecreer: { type: Type.NUMBER },
            otrasMutuales: { type: Type.NUMBER },
            codigosFedemMonto: { type: Type.NUMBER },
            codigosFedemDetectados: { type: Type.ARRAY, items: { type: Type.STRING } },
            embargoDetectado: { type: Type.BOOLEAN },
            embargoMonto: { type: Type.NUMBER },
            embargoConcepto: { type: Type.STRING },
            totalDescuentosRecibo: { type: Type.NUMBER },
            sueldoLiquido: { type: Type.NUMBER }
          },
          required: ['sueldoBrutoTotal', 'descuentosLey', 'totalDescuentosRecibo', 'sueldoLiquido', 'embargoDetectado', 'codigosFedemDetectados']
        },
        detalleCompletoRecibo: {
          type: Type.OBJECT,
          properties: {
            periodo: { type: Type.STRING },
            escalafonCargo: { type: Type.STRING },
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
            },
            totales: {
              type: Type.OBJECT,
              properties: {
                totalHaberes: { type: Type.NUMBER },
                totalDescuentos: { type: Type.NUMBER },
                liquidoAPagar: { type: Type.NUMBER }
              },
              required: ['totalHaberes', 'totalDescuentos', 'liquidoAPagar']
            }
          },
          required: ['periodo', 'escalafonCargo', 'conceptos', 'totales']
        },
        scoringAmmer: {
          type: Type.OBJECT,
          properties: {
            puntajeTotal: { type: Type.NUMBER },
            calificacionLetra: { type: Type.STRING, description: 'A (Riesgo Bajo) | B (Riesgo Moderado) | C (Riesgo Crítico / No Viable)' },
            dictamen: { type: Type.STRING, description: 'APTO_OTORGAMIENTO | OBSERVADO | RECHAZADO' },
            decisionPlanilla: { type: Type.STRING, description: 'APTO POR PLANILLA | OBSERVADO POR PLANILLA | RECHAZADO / CUPO EXCEDIDO' },
            decisionAlternativaCBU: { type: Type.STRING },
            nivelConfianza: { type: Type.STRING, description: 'ALTO | MEDIO | BAJO' },
            dictamenAuditor: { type: Type.STRING },
            alertasCriticas: { type: Type.ARRAY, items: { type: Type.STRING } },
            camposIlegibles: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['puntajeTotal', 'calificacionLetra', 'dictamen', 'decisionPlanilla', 'decisionAlternativaCBU', 'dictamenAuditor', 'alertasCriticas', 'camposIlegibles']
        }
      },
      required: ['identidad', 'datosLaborales', 'vigenciaRecibo', 'radiografiaSalarial', 'detalleCompletoRecibo', 'scoringAmmer']
    };

    const modelosActivos = ['gemini-2.5-flash', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let textOutput = '';
    let ultimoErrorModelo: any = null;

    for (const modelo of modelosActivos) {
      try {
        const response = await ai.models.generateContent({
          model: modelo,
          contents: [{ parts }],
          config: {
            systemInstruction: 'Eres Auditor Crediticio Senior y Especialista en Verificación Documental Forense de AMMER. Transcribe literalmente todos los códigos, conceptos, haberes y descuentos impresos en el recibo sin inventar cifras ni redondear. Coloca 0 cuando un descuento opcional no figure en el comprobante. Solo marca "ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO" si un dato obligatorio está físicamente cortado o borroso. Devuelve exclusivamente JSON conforme al schema.',
            responseMimeType: 'application/json',
            responseSchema
          }
        });
        if (response.text && response.text.trim()) {
          textOutput = response.text;
          break;
        }
      } catch (errMod: any) {
        console.warn(`[AMMER Audit] Modelo ${modelo} no disponible o con error:`, errMod?.message || errMod);
        ultimoErrorModelo = errMod;
      }
    }

    if (!textOutput) {
      const statusErr = Number(ultimoErrorModelo?.status) || 502;
      return res.status(statusErr >= 400 && statusErr < 600 ? statusErr : 502).json({
        ok: false,
        error: ultimoErrorModelo?.message || 'No se recibió respuesta válida de los modelos de auditoría documental.'
      });
    }
    const dataParsed: any = (() => {
      let cleaned = String(textOutput).replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstIdx = cleaned.indexOf('{');
      const lastIdx = cleaned.lastIndexOf('}');
      if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
        cleaned = cleaned.substring(firstIdx, lastIdx + 1);
      }
      try {
        return JSON.parse(cleaned);
      } catch (_) {
        try {
          return JSON.parse(cleaned.replace(/[\r\n\t]/g, ' '));
        } catch (__) {
          return {};
        }
      }
    })();

    const auditModelOutput = mapearEstructuraAuditoria(dataParsed, datosDeclarados);

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
    return 'ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO';
  }
  return '$' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clasificarConceptosRecibo_(conceptosRaw: any[]) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rows = Array.isArray(conceptosRaw) ? conceptosRaw.map((c: any) => ({
    codigo: String(c?.codigo ?? '').trim(),
    descripcion: String(c?.descripcion ?? c?.concepto ?? '').trim(),
    haberes: Number.isFinite(Number(c?.haberes)) ? round2(Math.max(0, Number(c.haberes))) : 0,
    descuentos: Number.isFinite(Number(c?.descuentos)) ? round2(Math.max(0, Number(c.descuentos))) : 0
  })).filter(r => r.codigo || r.descripcion || r.haberes > 0 || r.descuentos > 0) : [];

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
  const ILEGIBLE_LBL = 'ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO';
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
  } : {}));

  const lab = rawIn.datosLaborales || (rawIn.datosAgente ? {
    organismoEmpleador: rawIn.datosAgente.organismo,
    escalafonCargo: rawIn.datosAgente.escalafonCargo || detRecIn.escalafonCargo || '',
    situacionRevista: rawIn.datosAgente.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: rawIn.datosAgente.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: rawIn.datosAgente.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: rawIn.datosAgente.cumpleAntiguedadMinima
  } : (resDecIn.organismo || resDecIn.antiguedad ? {
    organismoEmpleador: resDecIn.organismo,
    escalafonCargo: detRecIn.escalafonCargo || '',
    situacionRevista: resDecIn.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: resDecIn.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: resDecIn.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: resDecIn.antiguedadApta
  } : {}));

  const vig = rawIn.vigenciaRecibo || (rawIn.liquidacion ? {
    periodoLiquidado: rawIn.liquidacion.periodo || rawIn.liquidacion.periodoLiquidado || rawIn.datosAgente?.periodoLiquidado,
    estadoVigencia: rawIn.liquidacion.estadoVigencia || 'VIGENTE',
    esVigente: rawIn.liquidacion.esVigente !== false
  } : (detRecIn.periodo ? {
    periodoLiquidado: detRecIn.periodo,
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
    descuentosLey: desgloseConceptos.calcLey,
    consumosBersa: desgloseConceptos.calcBersa,
    consumosSidecreer: desgloseConceptos.calcSidecreer,
    otrasMutuales: desgloseConceptos.calcMutuales,
    codigosFedemMonto: desgloseConceptos.calcFedem,
    codigosFedemDetectados: desgloseConceptos.fedemCodes,
    embargoDetectado: Boolean(resDecIn.embargosJudiciales) || desgloseConceptos.calcEmbargo > 0,
    embargoMonto: desgloseConceptos.calcEmbargo,
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
  const toNumOrNull = (v: any): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) ? null : round2(Number(v));

  let sueldoBruto = toNumOrNull(sal.sueldoBrutoTotal ?? detRecIn.totales?.totalHaberes);
  if (sueldoBruto === null && desgloseConceptos.sumHaberes !== null) sueldoBruto = desgloseConceptos.sumHaberes;

  let descuentosLey = toNumOrNull(sal.descuentosLey);
  if ((descuentosLey === null || descuentosLey === 0) && desgloseConceptos.calcLey > 0) descuentosLey = desgloseConceptos.calcLey;

  let consumosBersa = toNumOrNull(sal.consumosBersa);
  if ((consumosBersa === null || consumosBersa === 0) && desgloseConceptos.calcBersa > 0) consumosBersa = desgloseConceptos.calcBersa;

  let consumosSidecreer = toNumOrNull(sal.consumosSidecreer);
  if ((consumosSidecreer === null || consumosSidecreer === 0) && desgloseConceptos.calcSidecreer > 0) consumosSidecreer = desgloseConceptos.calcSidecreer;

  let otrasMutuales = toNumOrNull(sal.otrasMutuales);
  if ((otrasMutuales === null || otrasMutuales === 0) && desgloseConceptos.calcMutuales > 0) otrasMutuales = desgloseConceptos.calcMutuales;

  let codigosFedemMonto = toNumOrNull(sal.codigosFedemMonto);
  if ((codigosFedemMonto === null || codigosFedemMonto === 0) && desgloseConceptos.calcFedem > 0) codigosFedemMonto = desgloseConceptos.calcFedem;

  let embargoMonto = toNumOrNull(sal.embargoMonto);
  if ((embargoMonto === null || embargoMonto === 0) && desgloseConceptos.calcEmbargo > 0) embargoMonto = desgloseConceptos.calcEmbargo;

  let totalDescuentosRecibo = toNumOrNull(sal.totalDescuentosRecibo ?? detRecIn.totales?.totalDescuentos);
  if (totalDescuentosRecibo === null && desgloseConceptos.sumDescuentos !== null) totalDescuentosRecibo = desgloseConceptos.sumDescuentos;

  let sueldoLiquido = toNumOrNull(sal.sueldoLiquido ?? detRecIn.totales?.liquidoAPagar);
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
  } else if (!estadoCotejo) {
    estadoCotejo = ILEGIBLE_LBL;
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
    estadoAfectacion = ILEGIBLE_LBL;
    estadoAfectacionPlanilla = ILEGIBLE_LBL;
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

  const escalafonCargoStr = String(detRecIn.escalafonCargo || lab.escalafonCargo || lab.situacionRevista || 'No especificado en recibo').trim();

  const resumenDecision = {
    titular: idObj.titularDetectado || ILEGIBLE_LBL,
    dni: dniExtraido || idObj.dni || ILEGIBLE_LBL,
    organismo: lab.organismoEmpleador || ILEGIBLE_LBL,
    antiguedad: lab.antiguedadDetalle || ILEGIBLE_LBL,
    antiguedadApta: cumpleAntig,
    sueldoBrutoTotal: sueldoBruto,
    totalDescuentos: totalDescuentosRecibo,
    sueldoLiquido,
    cupoMaximo50: cupoMaximoLegal,
    margenDisponiblePlanilla: margenDisponibleMensual,
    estadoAfectacion: estadoAfectacionPlanilla,
    embargosJudiciales: embargoDetectadoBool,
    codigosFedemPrevios,
    decisionPlanilla,
    decisionAlternativaCBU,
    scoringSugerido: scoreTotal
  };

  const detalleCompletoRecibo = {
    periodo: vig.periodoLiquidado || detRecIn.periodo || ILEGIBLE_LBL,
    escalafonCargo: escalafonCargoStr,
    conceptos: desgloseConceptos.rows,
    totales: {
      totalHaberes: sueldoBruto,
      totalDescuentos: totalDescuentosRecibo,
      liquidoAPagar: sueldoLiquido
    }
  };

  const cotejoBadgeMd = estadoCotejo === 'COINCIDE'
    ? '🟢 COINCIDENCIA TOTAL'
    : (estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO')
      ? '🟢 LECTURA DIRECTA DEL DOCUMENTO'
      : (estadoCotejo === 'DISCREPANCIA DETECTADA' ? '🔴 DISCREPANCIA DETECTADA' : `⚠️ ${estadoCotejo}`));
  const vigenciaBadgeMd = vigenciaBool
    ? '🟢 VIGENTE'
    : (vig.estadoVigencia === 'DESACTUALIZADO' ? '⚠️ DESACTUALIZADO' : `⚠️ ${vig.estadoVigencia || ILEGIBLE_LBL}`);
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
    `* **Titular Detectado:** ${idObj.titularDetectado || ILEGIBLE_LBL}`,
    `* **DNI / CUIL:** ${idObj.dni || ILEGIBLE_LBL} / ${idObj.cuil || ILEGIBLE_LBL}`,
    `* **Cotejo con Carátula:** ${cotejoBadgeMd}`,
    `* **Período Liquidado:** ${vig.periodoLiquidado || ILEGIBLE_LBL} • ${vigenciaBadgeMd}`,
    '',
    '#### 🏢 2. Datos Laborales y Situación de Revista',
    `* **Organismo Empleador:** ${lab.organismoEmpleador || ILEGIBLE_LBL}`,
    `* **Escalafón / Cargo:** ${escalafonCargoStr}`,
    `* **Condición de Revista:** ${lab.situacionRevista || ILEGIBLE_LBL}`,
    `* **Antigüedad Registrada:** ${lab.antiguedadDetalle || ILEGIBLE_LBL} • ${antigBadgeMd}`,
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
        calidadDocumental: { puntaje: pCalidad, maximo: 20, detalle: camposIlegibles.length ? `Campos ilegibles: ${camposIlegibles.join(', ')}` : 'Lectura literal verificada sin campos cortados o borrosos.' },
        vigenciaYFormalidad: { puntaje: pVigencia, maximo: 20, detalle: vigenciaBool ? `Período ${vig.periodoLiquidado} vigente según calendario.` : `Período ${vig.periodoLiquidado || 'sin fecha'} observado.` },
        coincidenciaIdentidad: { puntaje: pIdentidad, maximo: 30, detalle: dniCoincideBool ? 'Coincidencia total entre documento y carátula.' : 'Discrepancia o ilegibilidad en cotejo de identidad.' },
        capacidadFinanciera: { puntaje: pFinanciera, maximo: 30, detalle: `Tope 50% Bruto (${formatCurrencyAuditAr_(cupoMaximoLegal)}) vs Descuentos (${formatCurrencyAuditAr_(totalDescuentosRecibo)}).` }
      }
    },
    reciboSueldo: {
      titular: idObj.titularDetectado || ILEGIBLE_LBL,
      dni: idObj.dni || ILEGIBLE_LBL,
      cuil: idObj.cuil || ILEGIBLE_LBL,
      legajo: lab.legajo || '—',
      organismo: lab.organismoEmpleador || ILEGIBLE_LBL,
      dependencia: lab.dependencia || '',
      escalafonCargo: escalafonCargoStr,
      cargo: escalafonCargoStr || lab.situacionRevista || ILEGIBLE_LBL,
      situacionRevista: lab.situacionRevista || ILEGIBLE_LBL,
      fechaIngreso: lab.fechaIngreso || ILEGIBLE_LBL,
      antiguedadDetalle: lab.antiguedadDetalle || ILEGIBLE_LBL,
      antiguedadAnios: lab.antiguedadAnios !== undefined ? lab.antiguedadAnios : null,
      cumpleAntiguedadMinima: cumpleAntig,
      esSaludSuplenteDia19: Boolean(lab.esSaludSuplenteDia19),
      requiereSituacionSage: Boolean(lab.requiereSituacionSage),
      esInvalidezODiscapacidad: Boolean(lab.esInvalidezODiscapacidad),
      cumpleTopeEdad80,
      observacionesEspeciales: lab.observacionesEspeciales || '',
      periodo: vig.periodoLiquidado || ILEGIBLE_LBL,
      estadoPeriodo: vig.estadoVigencia || ILEGIBLE_LBL,
      reciboVencido: !vigenciaBool,
      sueldoBruto,
      descuentosLey,
      consumosBersa,
      consumosSidecreer,
      otrasMutuales,
      codigosFedemMonto,
      codigosFedemDetectados: codigosFedemList,
      embargoDetectado: embargoDetectadoBool,
      embargoMonto,
      embargoConcepto: embargoConceptoStr,
      descuentosPrestamosYMutuales: descuentosVoluntariosTotal,
      totalDescuentosRecibo,
      sueldoNeto: sueldoLiquido,
      topeLegal50Porciento: cupoMaximoLegal,
      margenDisponibleCuota: margenDisponibleMensual,
      estadoAfectacion,
      estadoAfectacionPlanilla,
      decisionPlanilla,
      decisionAlternativaCBU,
      conceptos: desgloseConceptos.rows
    },
    dni: {
      numero: idObj.dni || ILEGIBLE_LBL,
      nombreCompleto: idObj.titularDetectado || ILEGIBLE_LBL,
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
      `Organismo: ${lab.organismoEmpleador || ILEGIBLE_LBL} (${lab.situacionRevista || ILEGIBLE_LBL}).`,
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
