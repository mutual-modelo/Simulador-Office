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

REGLAS DE CALIBRACIÓN EQUILIBRADA (LECTURA EXHAUSTIVA SIN INVENTAR NI BLOQUEAR):
1. EXTRACCIÓN ACTIVA Y LITERAL:
   - Lee y extrae con precisión todos los conceptos impresos visibles en el comprobante: Sueldo Bruto Total, Descuentos de Ley, consumos BERSA, consumos SIDECREER, otras mutuales, Códigos FEDEM (366, 368, 1115, 1117), embargos, Total Descuentos, Sueldo Líquido, titular, DNI, CUIL, período y organismo empleador.
   - Si el documento es legible, NUNCA bloquees la auditoría ni devuelvas todo "ILEGIBLE" por ausencia de campos secundarios o por falta de carátula previa.
2. CERO ALUCINACIÓN SIN FALSOS POSITIVOS:
   - Prohibido inventar, redondear o estimar importes, fechas o nombres.
   - Si un concepto de descuento OPCIONAL (consumos BERSA, SIDECREER, otras mutuales, códigos FEDEM o embargos) NO aparece descontado en el recibo, coloca 0 (y embargoDetectado: false). NUNCA lo marques como "ILEGIBLE".
   - Solo coloca null (y agrega a camposIlegibles / "ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO") en un campo OBLIGATORIO (Sueldo Bruto Total, Total Descuentos, Sueldo Líquido, Titular o Período) si dicho número/texto está físicamente cortado, tapado o borroso en la imagen/PDF.
   - Si un dato no corresponde al tipo de documento subido (ej. fechaVencimientoDni cuando solo se subió un recibo de sueldo), escribe "No consta en este comprobante" sin penalizar el puntaje.
3. PRIVACIDAD Y SECRETO OPERATIVO:
   - Evalúa únicamente los documentos adjuntos y la carátula actual.

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

DIRECTIVAS DE EXTRACCIÓN Y LECTURA FORENSE:

1. DATOS PERSONALES Y COINCIDENCIA DE IDENTIDAD:
   - Extraer Apellido y Nombres completos, DNI, CUIL (o "No consta en recibo" si el comprobante no lo imprime), Fecha de Nacimiento (YYYY-MM-DD si consta literalmente, sino "No consta en este comprobante"), Vencimiento del DNI si se adjuntó DNI (sino "No consta en este comprobante").
   - Contrastar DNI y Apellido/Nombre contra la carátula cuando exista: marcar estadoCotejoCaratula = "COINCIDE" o "DISCREPANCIA DETECTADA" (o "VERIFICADO EN DOCUMENTO (SIN CARÁTULA PREVIA)" si no hay carátula previa).

2. DATOS LABORALES Y CONDICIÓN DE REVISTA:
   - Organismo / Empleador exacto: identificar si pertenece a CGE (Docentes), Ministerio de Salud, Policía, Administración Central, Municipios o Caja de Jubilaciones de Entre Ríos.
   - Fecha de Ingreso / Antigüedad: extraer fecha exacta de ingreso y computar años/meses si figura impresa. Validar requisito operativo de MÍNIMO 1 AÑO DE ANTIGÜEDAD COMPROBABLE (cumpleAntiguedadMinima: true/false o null si no figura impreso en el recibo).
   - Situación de Revista: clasificar en "ACTIVO TITULAR" (Planta Permanente), "ACTIVO SUPLENTE", o "PASIVO" (Jubilado/Pensionado), o "ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO" solo si está borroso.
   - En Ministerio de Salud: verificar si es suplente (cobro día 19) para chequear vigencia del período.
   - En CGE (Docentes): indicar en observacionesEspeciales si requiere situación de revista de SAGE por múltiples cargos o suplencias.

3. VIGENCIA DEL PERÍODO DEL RECIBO:
   - Extraer mes y año liquidado en formato MM/YYYY (ej. "10/2026").
   - Validar si corresponde al último o anteúltimo mes inmediato exigible respecto a ${String(mesActual).padStart(2, '0')}/${anioActual} (estadoVigencia: "VIGENTE" | "DESACTUALIZADO" | "ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO").

4. ESTRUCTURA SALARIAL Y LIQUIDACIÓN EXACTA (RECIBOS PROVINCIALES DE ENTRE RÍOS — CIFRAS LITERALES SIN REDONDEO):
   - sueldoBrutoTotal: Suma exclusiva de todos los conceptos remunerativos y no remunerativos (asignación, adicionales y plus — ej. Códigos 1 al 286 en recibos provinciales de Policía/Administración/CGE/Salud). NO confundir con el líquido de bolsillo ni subtotales parciales.
   - descuentosLey: Suma de Jubilación (ej. Cód. 502), Obra Social IOSPER (Cód. 505), Seguros obligatorios (Códs. 510, 524, 327) y Ley 4035.
   - consumosBersa: Retenciones BERSA / Entidades Financieras (0.00 si no figura).
   - consumosSidecreer: Retenciones SIDECREER (0.00 si no figura).
   - otrasMutuales: Cuotas de otras Mutuales, Cooperativas y Proveeduría (ej. MUPER Cód. 491) (0.00 si no figura).
   - codigosFedemMonto: Suma de Códigos Oficiales FEDEM detectados: Código 366 (Cuota Social Activos), 368 (Consumos FEDEM Activos), 1115 (Cuota Social Pasivos) o 1117 (Consumos FEDEM Pasivos) (0.00 si no figura). Listar literalmente los códigos detectados en codigosFedemDetectados.
   - Embargos Judiciales: Rastrear embargos ejecutivos, retenciones comerciales o alimentos (embargoDetectado: true/false, embargoMonto = 0.00 si no hay, embargoConcepto).
   - totalDescuentosRecibo: Total de descuentos consolidados impresos en el recibo (si el recibo no muestra una celda totalizada pero muestra Bruto y Líquido claros, informar el valor consolidado de deducciones).
   - sueldoLiquido: Importe final neto de bolsillo a percibir en cuenta bancaria.

5. CÁLCULO DE AFECTACIÓN LEGAL (TOPE 50% DEL BRUTO):
   - cupoMaximoLegal = Sueldo Bruto Total * 0.50.
   - margenDisponibleMensual = Cupo Máximo Legal - Total de Descuentos Actuales del Recibo.
   - estadoAfectacion: "MARGEN DISPONIBLE" si cubre la cuota o queda saldo positivo, o "SALDO NEGATIVO / AFECTACIÓN EXCEDIDA" si es negativo o inferior a la cuota simulada.

6. REGLA PREVISIONAL DE TOPE DE EDAD (80 AÑOS) Y EXCLUSIONES:
   - En pasivos: verificar que no corresponda a Jubilación por Invalidez ni Pensión por Discapacidad (esInvalidezODiscapacidad: true => no viable).
   - Constatar que la edad al finalizar el plan (edad actual + plazo/12) sea estrictamente menor a 80 años (cumpleTopeEdad80).

7. CALIFICACIÓN CREDITICIA AMMER (0-100):
   - puntajeTotal: 0 a 100.
   - calificacionLetra: "A (Riesgo Bajo)" | "B (Riesgo Moderado)" | "C (Riesgo Crítico / No Viable)".
   - dictamen: "APTO_OTORGAMIENTO" | "OBSERVADO" | "RECHAZADO".
   - dictamenAuditor: conclusión clara en exactamente 2 renglones sobre viabilidad, hallazgos del recibo y eventual documentación complementaria.

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
          required: ['organismoEmpleador', 'situacionRevista', 'antiguedadDetalle', 'observacionesEspeciales']
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
        scoringAmmer: {
          type: Type.OBJECT,
          properties: {
            puntajeTotal: { type: Type.NUMBER },
            calificacionLetra: { type: Type.STRING, description: 'A (Riesgo Bajo) | B (Riesgo Moderado) | C (Riesgo Crítico / No Viable)' },
            dictamen: { type: Type.STRING, description: 'APTO_OTORGAMIENTO | OBSERVADO | RECHAZADO' },
            nivelConfianza: { type: Type.STRING, description: 'ALTO | MEDIO | BAJO' },
            dictamenAuditor: { type: Type.STRING },
            alertasCriticas: { type: Type.ARRAY, items: { type: Type.STRING } },
            camposIlegibles: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['puntajeTotal', 'calificacionLetra', 'dictamen', 'dictamenAuditor', 'alertasCriticas', 'camposIlegibles']
        }
      },
      required: ['identidad', 'datosLaborales', 'vigenciaRecibo', 'radiografiaSalarial', 'scoringAmmer']
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
            systemInstruction: 'Eres Auditor Crediticio Senior y Especialista en Verificación Documental Forense de AMMER. Extrae todos los valores impresos en el comprobante de forma literal sin inventar números ni bloquear documentos legibles por ausencia de deducciones opcionales (coloca 0 cuando un descuento opcional no figure en el recibo). Solo marca "ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO" si un dato obligatorio del recibo está borroso o cortado. Devuelve exclusivamente JSON conforme al schema.',
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

function mapearEstructuraAuditoria(raw: any, datosDeclarados: any) {
  const ILEGIBLE_LBL = 'ILEGIBLE / REQUIERE RESUBIR DOCUMENTO NÍTIDO';
  const rawIn = raw || {};
  const idObj = rawIn.identidad || (rawIn.datosAgente ? {
    titularDetectado: rawIn.datosAgente.nombreTitular || rawIn.datosAgente.nombreApellido || rawIn.datosAgente.nombre,
    dni: rawIn.datosAgente.dni || rawIn.datosAgente.dniCuil,
    cuil: rawIn.datosAgente.cuil || 'No consta en recibo',
    estadoCotejoCaratula: rawIn.datosAgente.estadoCotejoCaratula || ''
  } : {});
  const lab = rawIn.datosLaborales || (rawIn.datosAgente ? {
    organismoEmpleador: rawIn.datosAgente.organismo,
    situacionRevista: rawIn.datosAgente.situacionRevista || 'ACTIVO TITULAR',
    fechaIngreso: rawIn.datosAgente.fechaIngreso || 'No consta en recibo',
    antiguedadDetalle: rawIn.datosAgente.antiguedad || 'Verificar en carátula',
    cumpleAntiguedadMinima: rawIn.datosAgente.cumpleAntiguedadMinima
  } : {});
  const vig = rawIn.vigenciaRecibo || (rawIn.liquidacion ? {
    periodoLiquidado: rawIn.liquidacion.periodo || rawIn.liquidacion.periodoLiquidado || rawIn.datosAgente?.periodoLiquidado,
    estadoVigencia: rawIn.liquidacion.estadoVigencia || 'VIGENTE',
    esVigente: rawIn.liquidacion.esVigente !== false
  } : {});
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
  } : rawIn);
  const scRaw = rawIn.scoringAmmer || (rawIn.scoring ? {
    puntajeTotal: rawIn.scoring.puntaje ?? rawIn.scoring.puntajeTotal,
    calificacionLetra: rawIn.scoring.calificacion || rawIn.scoring.calificacionLetra,
    dictamen: (typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 60) ? 'RECHAZADO' : ((typeof rawIn.scoring.puntaje === 'number' && rawIn.scoring.puntaje < 80) ? 'OBSERVADO' : 'APTO_OTORGAMIENTO'),
    dictamenAuditor: rawIn.scoring.dictamen || rawIn.scoring.dictamenAuditor
  } : {});

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const toNumOrNull = (v: any): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) ? null : round2(Number(v));

  const sueldoBruto = toNumOrNull(sal.sueldoBrutoTotal);
  const descuentosLey = toNumOrNull(sal.descuentosLey);
  let consumosBersa = toNumOrNull(sal.consumosBersa);
  let consumosSidecreer = toNumOrNull(sal.consumosSidecreer);
  let otrasMutuales = toNumOrNull(sal.otrasMutuales);
  let codigosFedemMonto = toNumOrNull(sal.codigosFedemMonto);
  let embargoMonto = toNumOrNull(sal.embargoMonto);
  let totalDescuentosRecibo = toNumOrNull(sal.totalDescuentosRecibo);
  const sueldoLiquido = toNumOrNull(sal.sueldoLiquido);

  // Deducciones voluntarias ausentes representan $0,00 (nunca bloquear por ilegibilidad)
  const lecturaSalarialPrincipalOk = (sueldoBruto !== null || sueldoLiquido !== null || totalDescuentosRecibo !== null);
  if (consumosBersa === null) consumosBersa = 0;
  if (consumosSidecreer === null) consumosSidecreer = 0;
  if (otrasMutuales === null) otrasMutuales = 0;
  if (codigosFedemMonto === null) codigosFedemMonto = 0;
  if (embargoMonto === null) embargoMonto = 0;

  // Fallback determinístico si el recibo no muestra explícitamente la celda "Total Descuentos" pero sí Bruto y Líquido (o Descuentos de Ley)
  if (totalDescuentosRecibo === null && sueldoBruto !== null && sueldoLiquido !== null && sueldoBruto >= sueldoLiquido) {
    totalDescuentosRecibo = round2(sueldoBruto - sueldoLiquido);
  } else if (totalDescuentosRecibo === null && descuentosLey !== null) {
    totalDescuentosRecibo = round2(
      descuentosLey + (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
    );
  }

  // Regla matemática estricta AMMER:
  // Cupo Máximo Legal = Sueldo Bruto Total * 0.50
  // Margen Disponible Mensual = Cupo Máximo Legal - Total Descuentos Actuales del Recibo
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

  if (lab.esInvalidezODiscapacidad) {
    alertasCriticas.push('Exclusión reglamentaria: Jubilación por Invalidez o Pensión por Discapacidad no viable.');
  }
  if (sal.embargoDetectado) {
    alertasCriticas.push(`Presencia de embargo judicial/retención: ${sal.embargoConcepto || 'Embargo'} (${formatCurrencyAuditAr_(embargoMonto)}).`);
  }

  // Diagnóstico afectación
  let estadoAfectacion = 'MARGEN DISPONIBLE';
  if (margenDisponibleMensual === null) {
    estadoAfectacion = ILEGIBLE_LBL;
  } else if (margenDisponibleMensual <= 0 || (cuotaSimulada > 0 && margenDisponibleMensual < cuotaSimulada)) {
    estadoAfectacion = 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA';
    alertasCriticas.push(
      cuotaSimulada > 0
        ? `Margen disponible (${formatCurrencyAuditAr_(margenDisponibleMensual)}) insuficiente para cuota simulada (${formatCurrencyAuditAr_(cuotaSimulada)}).`
        : `Margen disponible negativo o agotado (${formatCurrencyAuditAr_(margenDisponibleMensual)}).`
    );
  }

  // Score y dictamen coherente con reglas críticas (sin bloquear recibos legibles por campos opcionales)
  let scoreTotal = typeof scRaw.puntajeTotal === 'number'
    ? Math.max(0, Math.min(100, Math.round(scRaw.puntajeTotal)))
    : (lecturaSalarialPrincipalOk ? 82 : 55);
  let dictamen = String(scRaw.dictamen || (lecturaSalarialPrincipalOk ? 'APTO_OTORGAMIENTO' : 'OBSERVADO')).toUpperCase();
  if (dictamen.startsWith('APTO')) dictamen = 'APTO_OTORGAMIENTO';

  if (lab.esInvalidezODiscapacidad || cumpleTopeEdad80 === false || estadoCotejo === 'DISCREPANCIA DETECTADA' || sal.embargoDetectado || estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA') {
    if (lab.esInvalidezODiscapacidad || cumpleTopeEdad80 === false || estadoCotejo === 'DISCREPANCIA DETECTADA' || (margenDisponibleMensual !== null && margenDisponibleMensual < 0)) {
      dictamen = 'RECHAZADO';
      scoreTotal = Math.min(scoreTotal, 45);
    } else if (dictamen === 'APTO_OTORGAMIENTO') {
      dictamen = 'OBSERVADO';
      scoreTotal = Math.min(scoreTotal, 69);
    }
  }
  if ((sueldoBruto === null || sueldoLiquido === null || totalDescuentosRecibo === null) && dictamen === 'APTO_OTORGAMIENTO') {
    dictamen = 'OBSERVADO';
    scoreTotal = Math.min(scoreTotal, 65);
  }

  const calificacionLetra = scoreTotal >= 80
    ? 'A (Riesgo Bajo)'
    : (scoreTotal >= 60 ? 'B (Riesgo Moderado)' : 'C (Riesgo Crítico / No Viable)');

  const codigosFedemList = Array.isArray(sal.codigosFedemDetectados) ? sal.codigosFedemDetectados : [];
  const fedemObs = codigosFedemList.length > 0
    ? `Códigos detectados: ${codigosFedemList.join(', ')}`
    : 'Sin códigos FEDEM (366/368/1115/1117) en recibo';

  const dniCoincideBool = estadoCotejo === 'COINCIDE' || estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO');
  const vigenciaBool = vig.esVigente === true || vig.estadoVigencia === 'VIGENTE';
  const cumpleAntig = lab.cumpleAntiguedadMinima === true;

  const cotejoBadgeMd = estadoCotejo === 'COINCIDE'
    ? '🟢 COINCIDENCIA TOTAL'
    : (estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO')
      ? '🟢 LECTURA DIRECTA DEL DOCUMENTO'
      : (estadoCotejo === 'DISCREPANCIA DETECTADA' ? '🔴 DISCREPANCIA DETECTADA' : `⚠️ ${estadoCotejo}`));
  const vigenciaBadgeMd = vigenciaBool
    ? '🟢 VIGENTE'
    : (vig.estadoVigencia === 'DESACTUALIZADO' ? '⚠️ DESACTUALIZADO' : `⚠️ ${vig.estadoVigencia || ILEGIBLE_LBL}`);
  const antigBadgeMd = lab.cumpleAntiguedadMinima === true
    ? '🟢 CUMPLE REQUISITO (Mínimo 1 año)'
    : (lab.cumpleAntiguedadMinima === false ? '🔴 NO CUMPLE' : '⚠️ Verificar fecha de ingreso en carátula');
  const embargoMd = sal.embargoDetectado
    ? `🔴 PRESENCIA DE EMBARGO DETECTADA: ${formatCurrencyAuditAr_(embargoMonto)} / ${sal.embargoConcepto || 'Concepto judicial/retención'}`
    : '🟢 SIN EMBARGOS';
  const afectacionMd = estadoAfectacion === 'MARGEN DISPONIBLE'
    ? '🟢 MARGEN DISPONIBLE'
    : (estadoAfectacion === 'SALDO NEGATIVO / AFECTACIÓN EXCEDIDA' ? '🔴 SALDO NEGATIVO / CUPO EXCEDIDO' : `⚠️ ${estadoAfectacion}`);

  const dictamenTextoFinal = scRaw.dictamenAuditor ||
    (dictamen === 'APTO_OTORGAMIENTO'
      ? `Trámite viable conforme normativa AMMER con margen disponible de ${formatCurrencyAuditAr_(margenDisponibleMensual)}. Legajo completo y sin observaciones críticas.`
      : `Trámite con observaciones o restricciones crediticias (${alertasCriticas[0] || 'verificar legajo'}). Requiere revisión del analista antes de otorgar.`);

  const informeMarkdown = [
    '### 📑 INFORME DE AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER',
    '---',
    '',
    '#### 👤 1. Verificación de Identidad y Coincidencias',
    `* **Titular Detectado:** ${idObj.titularDetectado || ILEGIBLE_LBL}`,
    `* **DNI / CUIL:** ${idObj.dni || ILEGIBLE_LBL} / ${idObj.cuil || ILEGIBLE_LBL}`,
    `* **Cotejo con Carátula:** ${cotejoBadgeMd}`,
    `* **Período Liquidado:** ${vig.periodoLiquidado || ILEGIBLE_LBL} • ${vigenciaBadgeMd}`,
    '',
    '#### 🏢 2. Datos Laborales y Situación de Revista',
    `* **Organismo Empleador:** ${lab.organismoEmpleador || ILEGIBLE_LBL}`,
    `* **Condición de Revista:** ${lab.situacionRevista || ILEGIBLE_LBL}`,
    `* **Antigüedad Registrada:** ${lab.antiguedadDetalle || ILEGIBLE_LBL} • ${antigBadgeMd}`,
    `* **Observaciones Especiales:** ${lab.observacionesEspeciales || 'Sin observaciones especiales registradas'}`,
    '',
    '#### 💵 3. Radiografía Salarial y Descuentos',
    '| Concepto | Monto Detectado ($) | Observaciones / Estado |',
    '| :--- | :--- | :--- |',
    `| **Sueldo Bruto Total** | ${formatCurrencyAuditAr_(sueldoBruto)} | Remunerativo + No Remunerativo |`,
    `| **Descuentos de Ley** | ${formatCurrencyAuditAr_(descuentosLey)} | Jubilación, IOSPER, Ley 4035 |`,
    `| **Consumos BERSA / Préstamos** | ${formatCurrencyAuditAr_(consumosBersa)} | Retenciones bancarias |`,
    `| **Consumos SIDECREER** | ${formatCurrencyAuditAr_(consumosSidecreer)} | Descuento por tarjeta oficial |`,
    `| **Otras Mutuales / Cuotas** | ${formatCurrencyAuditAr_(otrasMutuales)} | Descuentos por código voluntario |`,
    `| **Códigos FEDEM Activos** | ${formatCurrencyAuditAr_(codigosFedemMonto)} | ${fedemObs} |`,
    `| **Total Descuentos en Recibo** | ${formatCurrencyAuditAr_(totalDescuentosRecibo)} | Deducciones consolidadas |`,
    `| **Sueldo Líquido de Bolsillo** | ${formatCurrencyAuditAr_(sueldoLiquido)} | Neto final a cobrar |`,
    '',
    `* **Embargos Judiciales / Inhibiciones:** ${embargoMd}`,
    '',
    '#### 📊 4. Análisis de Afectación Salarial y Margen',
    `* **Cupo Máximo Legal (50% del Bruto):** ${formatCurrencyAuditAr_(cupoMaximoLegal)}`,
    `* **Margen Disponible Estimado:** ${formatCurrencyAuditAr_(margenDisponibleMensual)}`,
    `* **Estado de Afectación:** ${afectacionMd}`,
    '',
    '#### 🛡️ 5. Calificación Crediticia AMMER (Scoring)',
    `* **Score AMMER:** ${scoreTotal} / 100 • **Calificación:** ${calificacionLetra}`,
    `* **Dictamen del Auditor:** ${dictamenTextoFinal}`
  ].join('\n');

  const pCalidad = camposIlegibles.length === 0 ? 19 : Math.max(6, 18 - camposIlegibles.length * 3);
  const pVigencia = vigenciaBool ? 19 : 9;
  const pIdentidad = dniCoincideBool ? 29 : 10;
  const pFinanciera = Math.max(0, Math.min(30, scoreTotal - (pCalidad + pVigencia + pIdentidad)));

  const resumenJson = {
    identidad: {
      titularDetectado: idObj.titularDetectado || ILEGIBLE_LBL,
      dni: idObj.dni || ILEGIBLE_LBL,
      cuil: idObj.cuil || ILEGIBLE_LBL,
      estadoCotejoCaratula: estadoCotejo,
      periodoLiquidado: vig.periodoLiquidado || ILEGIBLE_LBL,
      vigenciaPeriodo: vig.estadoVigencia || ILEGIBLE_LBL
    },
    laboral: {
      organismoEmpleador: lab.organismoEmpleador || ILEGIBLE_LBL,
      situacionRevista: lab.situacionRevista || ILEGIBLE_LBL,
      fechaIngreso: lab.fechaIngreso || ILEGIBLE_LBL,
      antiguedadDetalle: lab.antiguedadDetalle || ILEGIBLE_LBL,
      cumpleAntiguedadMinima: cumpleAntig,
      esSaludSuplenteDia19: Boolean(lab.esSaludSuplenteDia19),
      requiereSituacionSage: Boolean(lab.requiereSituacionSage),
      esInvalidezODiscapacidad: Boolean(lab.esInvalidezODiscapacidad),
      cumpleTopeEdad80,
      observacionesEspeciales: lab.observacionesEspeciales || ''
    },
    salarial: {
      sueldoBrutoTotal: sueldoBruto,
      descuentosLey,
      consumosBersa,
      consumosSidecreer,
      otrasMutuales,
      codigosFedemMonto,
      codigosFedemDetectados: codigosFedemList,
      embargoDetectado: Boolean(sal.embargoDetectado),
      embargoMonto,
      embargoConcepto: sal.embargoConcepto || '',
      totalDescuentosRecibo,
      sueldoLiquido
    },
    afectacion50: {
      formulaCupo: 'Sueldo Bruto Total * 0.50',
      cupoMaximoLegal,
      margenDisponibleMensual,
      cuotaSimulada: cuotaSimulada || null,
      estadoAfectacion
    },
    scoring: {
      scoreAmmer: scoreTotal,
      calificacion: calificacionLetra,
      dictamen,
      dictamenAuditor: dictamenTextoFinal,
      alertasCriticas,
      camposIlegibles
    }
  };

  const descuentosVoluntariosTotal = round2(
    (consumosBersa || 0) + (consumosSidecreer || 0) + (otrasMutuales || 0) + (codigosFedemMonto || 0) + (embargoMonto || 0)
  );

  return {
    scoringCrediticio: {
      puntajeTotal: scoreTotal,
      calificacionLetra,
      dictamen,
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
      cargo: lab.situacionRevista || ILEGIBLE_LBL,
      situacionRevista: lab.situacionRevista || ILEGIBLE_LBL,
      fechaIngreso: lab.fechaIngreso || ILEGIBLE_LBL,
      antiguedadDetalle: lab.antiguedadDetalle || ILEGIBLE_LBL,
      antiguedadAnios: lab.antiguedadAnios !== undefined ? lab.antiguedadAnios : null,
      cumpleAntiguedadMinima: lab.cumpleAntiguedadMinima !== undefined ? lab.cumpleAntiguedadMinima : null,
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
      embargoDetectado: Boolean(sal.embargoDetectado),
      embargoMonto,
      embargoConcepto: sal.embargoConcepto || '',
      descuentosPrestamosYMutuales: descuentosVoluntariosTotal,
      totalDescuentosRecibo,
      sueldoNeto: sueldoLiquido,
      topeLegal50Porciento: cupoMaximoLegal,
      margenDisponibleCuota: margenDisponibleMensual,
      estadoAfectacion
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
