/**
 * Motor de Análisis de Recibos de Haberes y Cálculo de Capacidad de Endeudamiento AMMER.
 * Basado en el Padrón Oficial de Códigos de Descuento (2.076 registros) y topes Activos/Pasivos.
 * NO modifica las fórmulas de amortización francesa de MOTOR_FINANCIERO_EXACTO.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const PORCENTAJE_TOPE_ACTIVOS = 0.20; // Máximo afectable 80% sobre Subtotal1
export const PORCENTAJE_TOPE_PASIVOS = 0.35; // Máximo afectable 65% sobre Subtotal1

export const MULTIPLICADORES_ENDEUDAMIENTO: Record<number, number> = {
  6: 2.5,
  12: 5.0,
  18: 7.5,
  24: 10.0,
  36: 15.0,
  48: 20.0,
};

export const PLAZOS_POR_LINEA: Record<string, number[]> = {
  fedem: [6, 12, 18, 24, 36, 48],
  sidecreer: [6, 12, 18, 24, 36, 48],
  muni: [12, 24],
  quad: [12, 24],
};

// Coeficientes espejados (solo lectura) de MOTOR_FINANCIERO_EXACTO
export const MOTOR_FINANCIERO_REF = {
  fedem: {
    6: { tna: 0.48940000000000, tem: 0.04078333370000, gastos: 0.25000000000000, seguro: 0.00500000000000 },
    12: { tna: 0.53690000000000, tem: 0.04474173010000, gastos: 0.25000000000000, seguro: 0.00500000000000 },
    18: { tna: 0.44670000000000, tem: 0.03722500030000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    24: { tna: 0.53390000000000, tem: 0.04449166620000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    36: { tna: 0.61450000000000, tem: 0.05120833300000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
    48: { tna: 0.64850000000000, tem: 0.05404166540000, gastos: 0.34000000000000, seguro: 0.00500000000000 },
  } as Record<number, { tna: number; tem: number; gastos: number; seguro: number }>,
  sidecreer: {
    6: { tna: 0.58534514000000, tem: 0.04877876170000, gastos: 0.25000000000000, seguro: 0.0 },
    12: { tna: 0.63154362000000, tem: 0.05262863500000, gastos: 0.25000000000000, seguro: 0.0 },
    18: { tna: 0.53972734000000, tem: 0.04497727830000, gastos: 0.34000000000000, seguro: 0.0 },
    24: { tna: 0.61978356000000, tem: 0.05164863000000, gastos: 0.34000000000000, seguro: 0.0 },
    36: { tna: 0.69009744000000, tem: 0.05750812000000, gastos: 0.34000000000000, seguro: 0.0 },
    48: { tna: 0.71781259000000, tem: 0.05981771580000, gastos: 0.34000000000000, seguro: 0.0 },
  } as Record<number, { tna: number; tem: number; gastos: number; seguro: number }>,
  municipales: {
    factorVikingo: 0.85000028330000,
    temQuad: 0.03299630130000,
    12: { coefCuota: 0.15970100000000 },
    24: { coefCuota: 0.11279800000000 },
  } as {
    factorVikingo: number;
    temQuad: number;
    12: { coefCuota: number };
    24: { coefCuota: number };
    [k: number]: any;
  },
};

const LUGARES_PASIVOS = ['JU_', 'JU', 'JUB_'];
const LUGARES_ACTIVOS = ['GE_', 'GE', 'SG_', 'SG', 'PO_', 'SA_', 'SAL_', 'VI_'];

const CODIGOS_VACIOS = new Set([
  '', '-', '—', '–', '--', 'N/A', 'NA', 'S/C', 'SC', 'S/COD',
  'SIN CODIGO', 'SIN_CODIGO', 'SIN CÓDIGO', 'NULL', 'NONE', 'S/N', '0',
]);

const ALIAS_LUGAR_TRABAJO: Record<string, string> = {
  PO: 'PO_',
  POLICIA: 'PO_',
  SA: 'SA_',
  SAL: 'SAL_',
  SALUD: 'SA_',
  VI: 'VI_',
  VIALIDAD: 'VI_',
  JUB: 'JUB_',
  JUBILADO: 'JU_',
  JUBILADOS: 'JU_',
  PASIVO: 'JU_',
  PASIVOS: 'JU_',
  ACTIVO: 'GE_',
  ACTIVOS: 'GE_',
  DOCENTE: 'SG_',
  DOCENTES: 'SG_',
  EDUCACION: 'SG_',
};

const SIDECREER_RE = /SIDECREER|SIDE\s*CRE(?:\s*E?\s*R)?|SI\s*DE\s*CRE(?:\s*E?\s*R)?|DE\s*CREER/;

export interface RegistroPadron {
  lugar: string;
  codigo: string;
  nombre: string;
  nombreNorm: string;
  clasificacion: string;
}

export interface ItemReciboClasificado {
  codigo: string;
  descripcion: string;
  tipo: 'HABER' | 'DESCUENTO';
  haberes: number;
  descuentos: number;
  importe: number;
  clasificacion: string;
  metodoClasificacion: string;
  lugarPadronMatch: string;
}

export interface SegmentoBeneficiario {
  esPasivo: boolean;
  tipoBeneficiario: 'ACTIVO' | 'PASIVO';
  etiquetaBeneficiario: string;
  porcentajeTope: number;
  porcentajeAfectableMaximo: number;
  lugarPrincipal: string;
  lugaresOrden: string[];
  lugaresFallback: string[];
}

export function round2Margen(n: any): number {
  const val = Number(n ?? 0);
  if (!Number.isFinite(val) || val === 0) return 0;
  const rounded = Math.round((Math.abs(val) + 1e-11) * 100) / 100;
  if (rounded === 0) return 0;
  return val < 0 ? -rounded : rounded;
}

export function normalizarClasificacion(clasif: any): string {
  if (clasif === null || clasif === undefined) return '';
  const s = String(clasif).trim().toUpperCase().replace(/\s+/g, ' ');
  const compact = s.replace(/[\s_]+/g, '_').replace(/^_+|_+$/g, '');

  if (
    compact === 'SUBTOTAL_1' ||
    compact === 'SUB_TOTAL' ||
    compact === 'SUBTOTAL' ||
    compact === 'SUBTOTAL1' ||
    compact === 'SUB_TOTAL_1' ||
    /^SUB_?TOTAL(_?1)?$/.test(compact)
  ) {
    return 'SUBTOTAL_1';
  }
  if (
    compact === 'NO_COMPUTABLE' ||
    compact === 'NO_COMPUTAABLE' ||
    compact === 'NO_COMPUTBALE' ||
    compact === 'NOCOMPUTABLE' ||
    /^NO_?COMPUT[A-Z]*B[A-Z]*$/.test(compact)
  ) {
    return 'NO_COMPUTABLE';
  }
  if (
    compact === 'AFECTADO' ||
    compact === 'AFECTABLE' ||
    compact === 'AFECTABLES' ||
    compact === 'AFECATDO' ||
    compact === 'AFECTADOS' ||
    compact === 'AFECATDOS' ||
    /^AFEC[A-Z]*$/.test(compact)
  ) {
    return 'AFECTADO';
  }
  if (compact === 'COMPUTABLE' || compact === 'HABER_COMPUTABLE' || compact === 'HABERES_COMPUTABLES') {
    return 'COMPUTABLE';
  }
  return '';
}

export function normalizarDescripcionPadron(txt: any): string {
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

export function esCodigoVacioPadron(cod: any): boolean {
  if (cod === null || cod === undefined) return true;
  const s = String(cod).trim().toUpperCase();
  if (CODIGOS_VACIOS.has(s)) return true;
  if (/^[-_.\s/—–]+$/.test(s)) return true;
  return false;
}

function normalizarCodigoLookup(cod: any): string {
  if (esCodigoVacioPadron(cod)) return '';
  const s = String(cod).trim().toUpperCase().replace(/\s+/g, '_');
  return CODIGOS_VACIOS.has(s) ? '' : s;
}

function quitarSufijoCodigo(codUp: string): string {
  if (!codUp) return '';
  const sinSuf = codUp.replace(/(?:_|-|\s)+(R|A|D)$/i, '').replace(/^_+|_+$/g, '');
  return sinSuf || codUp;
}

export function limpiarNumeroPadron(val: any): number {
  if (val === null || val === undefined || typeof val === 'boolean') return 0;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? round2Margen(val) : 0;
  }
  let s = String(val).trim().replace(/[^0-9.,-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return 0;
  const lc = s.lastIndexOf(',');
  const ld = s.lastIndexOf('.');
  if (lc !== -1 && ld !== -1) {
    if (lc > ld) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lc !== -1) {
    if ((s.match(/,/g) || []).length > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2Margen(n) : 0;
}

function stripZeros(c: string): string {
  return c.replace(/^0+/, '') || c;
}

function cargarPadronDesdeDisco(): RegistroPadron[] {
  const dirActual = path.dirname(fileURLToPath(import.meta.url));
  const posiblesRutas = [
    path.join(dirActual, 'padron_codigos_descuentos_normalizado.json'),
    path.join(process.cwd(), 'padron_codigos_descuentos_normalizado.json'),
    '/home/antigravity/mutual-modelo/Simulador-Office/padron_codigos_descuentos_normalizado.json',
  ];
  for (const ruta of posiblesRutas) {
    try {
      if (fs.existsSync(ruta)) {
        const rawText = fs.readFileSync(ruta, 'utf-8');
        const data = JSON.parse(rawText);
        const regs = Array.isArray(data?.registros) ? data.registros : (Array.isArray(data) ? data : []);
        const out: RegistroPadron[] = [];
        for (const r of regs) {
          const lugar = Array.isArray(r) ? r[0] : r?.lugar_de_trabajo;
          const codigo = Array.isArray(r) ? r[1] : r?.codigo;
          const nombre = Array.isArray(r) ? r[2] : r?.nombre;
          const clasifRaw = Array.isArray(r) ? r[3] : r?.clasificacion;
          const clasif = normalizarClasificacion(clasifRaw);
          if (!clasif) continue;
          const nomStr = String(nombre || '').trim();
          out.push({
            lugar: String(lugar || '').trim().toUpperCase(),
            codigo: String(codigo || '').trim().toUpperCase(),
            nombre: nomStr,
            nombreNorm: normalizarDescripcionPadron(nomStr),
            clasificacion: clasif,
          });
        }
        return out;
      }
    } catch (_) {
      // Continuar con ruta alternativa
    }
  }
  return [];
}

class IndicePadron {
  registros: RegistroPadron[];
  porLugarCodigo = new Map<string, RegistroPadron[]>();
  porLugarCodigoStrip = new Map<string, RegistroPadron[]>();
  porCodigo = new Map<string, RegistroPadron[]>();
  porNombreNorm = new Map<string, RegistroPadron[]>();
  porNombreTokens: Array<{ toks: Set<string>; r: RegistroPadron }> = [];

  constructor(registros: RegistroPadron[]) {
    this.registros = registros;
    for (const r of registros) {
      const cod = r.codigo;
      const lug = r.lugar;
      const nn = r.nombreNorm;
      if (cod) {
        const variantes = new Set<string>([cod]);
        if (cod.includes(' ')) {
          variantes.add(cod.replace(/\s+/g, '_'));
          variantes.add(cod.replace(/\s+/g, ''));
        }
        for (const vc of Array.from(variantes)) {
          variantes.add(stripZeros(vc));
        }
        for (const vc of variantes) {
          const k = `${lug}|${vc}`;
          const arr = this.porLugarCodigo.get(k);
          if (arr) arr.push(r);
          else this.porLugarCodigo.set(k, [r]);

          const arrCod = this.porCodigo.get(vc);
          if (arrCod) arrCod.push(r);
          else this.porCodigo.set(vc, [r]);
        }

        const codStrip = cod.replace(/^_+|_+$/g, '');
        if (codStrip) {
          const vStrip = new Set<string>([codStrip, stripZeros(codStrip)]);
          for (const vcs of vStrip) {
            const ks = `${lug}|${vcs}`;
            const arrs = this.porLugarCodigoStrip.get(ks);
            if (arrs) arrs.push(r);
            else this.porLugarCodigoStrip.set(ks, [r]);
          }
        }
      }
      if (nn && nn !== 'NAME' && nn.length >= 4) {
        const arrN = this.porNombreNorm.get(nn);
        if (arrN) arrN.push(r);
        else this.porNombreNorm.set(nn, [r]);

        const toks = new Set(nn.split(' ').filter(t => t.length >= 2));
        if (toks.size > 0) {
          this.porNombreTokens.push({ toks, r });
        }
      }
    }
  }
}

const PADRON_IDX = new IndicePadron(cargarPadronDesdeDisco());

export function getPadronRegistrosCount(): number {
  return PADRON_IDX.registros.length;
}

function mostCommonClasif(items: string[]): string {
  const counts = new Map<string, number>();
  let best = items[0] || '';
  let bestCount = -1;
  for (const c of items) {
    const nxt = (counts.get(c) || 0) + 1;
    counts.set(c, nxt);
    if (nxt > bestCount) {
      bestCount = nxt;
      best = c;
    }
  }
  return best;
}

export function resolverSegmentoBeneficiario(meta?: Record<string, any> | null): SegmentoBeneficiario {
  const m = meta || {};
  const lugRaw = String(m.lugar_de_trabajo || m.lugarTrabajo || '').trim().toUpperCase();
  const lugNorm = ALIAS_LUGAR_TRABAJO[lugRaw] || lugRaw;
  const textoCtx = [
    lugRaw,
    lugNorm,
    String(m.tipoRecibo || ''),
    String(m.formatoRecibo || m.formato || ''),
    String(m.organismo || ''),
    String(m.situacionRevista || ''),
    String(m.condicion || ''),
    String(m.cargo || m.escalafonCargo || ''),
  ].join(' ').toUpperCase();

  const sitRev = String(m.situacionRevista || '').toUpperCase();
  const orgStr = String(m.organismo || '').toUpperCase();
  const esActivoExplicito = /\bACTIVO\b/.test(sitRev) && !orgStr.includes('CAJA DE JUB') && !LUGARES_PASIVOS.includes(lugNorm);
  const esPasivo = LUGARES_PASIVOS.includes(lugNorm) || (
    /(?:JU_|JUB_|CAJA\s+DE\s+JUB|RECIBOS?\s+JUBILAD|\bJUBILAD|\bPENSIONAD|\bPASIV)/.test(textoCtx) &&
    !esActivoExplicito
  );

  if (esPasivo) {
    const lugarPrincipal = LUGARES_PASIVOS.includes(lugNorm) ? lugNorm : 'JU_';
    const pares = lugarPrincipal !== 'JUB_' ? ['JU_', 'JU', 'JUB_'] : ['JUB_', 'JU_', 'JU'];
    const orden: string[] = [];
    for (const l of [lugarPrincipal, ...pares, ...LUGARES_PASIVOS]) {
      if (l && !orden.includes(l)) orden.push(l);
    }
    return {
      esPasivo: true,
      tipoBeneficiario: 'PASIVO',
      etiquetaBeneficiario: 'Pasivos / Jubilados (65% afectable · Tope 35%)',
      porcentajeTope: PORCENTAJE_TOPE_PASIVOS,
      porcentajeAfectableMaximo: 0.65,
      lugarPrincipal,
      lugaresOrden: orden,
      lugaresFallback: LUGARES_ACTIVOS,
    };
  }

  let lugarPrincipal = 'GE_';
  if (LUGARES_ACTIVOS.includes(lugNorm)) {
    lugarPrincipal = lugNorm;
  } else if (/POLIC|SEGURID|PENITENCIAR|\bPO_/.test(textoCtx)) {
    lugarPrincipal = 'PO_';
  } else if (/SALUD|HOSPITAL|ENFERM|MEDICO|\bSA_|SAL_/.test(textoCtx)) {
    lugarPrincipal = 'SA_';
  } else if (/EDUCAC|\bCGE\b|DOCENT|ESCUEL|UADER|\bSG_/.test(textoCtx)) {
    lugarPrincipal = 'SG_';
  } else if (/VIALIDAD|\bVI_/.test(textoCtx)) {
    lugarPrincipal = 'VI_';
  }

  let paresPref: string[] = [];
  if (lugarPrincipal === 'SA_' || lugarPrincipal === 'SAL_') {
    paresPref = ['SA_', 'SAL_'];
  } else if (lugarPrincipal === 'GE_' || lugarPrincipal === 'GE') {
    paresPref = ['GE_', 'GE'];
  } else if (lugarPrincipal === 'SG_' || lugarPrincipal === 'SG') {
    paresPref = ['SG_', 'SG'];
  }

  const orden: string[] = [];
  for (const l of [lugarPrincipal, ...paresPref, ...LUGARES_ACTIVOS]) {
    if (l && !orden.includes(l)) orden.push(l);
  }
  return {
    esPasivo: false,
    tipoBeneficiario: 'ACTIVO',
    etiquetaBeneficiario: 'Activos (80% afectable · Tope 20%)',
    porcentajeTope: PORCENTAJE_TOPE_ACTIVOS,
    porcentajeAfectableMaximo: 0.80,
    lugarPrincipal,
    lugaresOrden: orden,
    lugaresFallback: LUGARES_PASIVOS,
  };
}

function resolverConflictoFilas(
  filas: RegistroPadron[],
  codigoNorm: string,
  descNorm: string,
  side: 'HABER' | 'DESCUENTO' | null,
): string | null {
  if (!filas || filas.length === 0) return null;

  const codSinSuf = quitarSufijoCodigo(codigoNorm);
  const codBase = codSinSuf.replace(/^0+/, '') || codigoNorm.replace(/^_+|_+$/g, '');

  // Desambiguación explícita antes de filtrar por lado o clase única
  if (side !== 'HABER') {
    if (/EMBARGO|LITIS|JUDICIAL|OFICIO/.test(descNorm)) {
      return 'AFECTADO';
    }
    if (codBase === '136' && descNorm.includes('DEUDA')) {
      return 'AFECTADO';
    }
    if (
      ['366', '368', '412', '491', '960', '1117'].includes(codBase) &&
      (!descNorm || SIDECREER_RE.test(descNorm) || /BERSA|FEDEM|MUPER/.test(descNorm))
    ) {
      return 'AFECTADO';
    }
    if (codBase === '812' && SIDECREER_RE.test(descNorm)) {
      return 'AFECTADO';
    }
    if (codBase === '829' && (descNorm.includes('MUPER') || !descNorm)) {
      return 'AFECTADO';
    }
    if (codBase === '1115' && descNorm.includes('FEDEM')) {
      return 'AFECTADO';
    }
    if (codBase === '480' && descNorm.includes('BERSA')) {
      return 'AFECTADO';
    }
    if (codBase === '339' && (descNorm.includes('CREDITO') || descNorm.includes('PREST'))) {
      return 'AFECTADO';
    }
    if (codBase === '339' && (descNorm.includes('SOCIET') || descNorm.includes('APORTE'))) {
      return 'SUBTOTAL_1';
    }
    if (codBase === '502' && (descNorm.includes('JUB') || descNorm.includes('APORTE') || !descNorm)) {
      return 'SUBTOTAL_1';
    }
  }
  if (side !== 'DESCUENTO' && codBase === '100') {
    if (/ANUAL|SAC|AGUINALDO/.test(descNorm)) {
      return 'NO_COMPUTABLE';
    }
    if (descNorm.includes('BASICO')) {
      return 'COMPUTABLE';
    }
  }

  let candidatas = filas;
  if (side === 'HABER') {
    const soloHab = filas.filter(r => r.clasificacion === 'COMPUTABLE' || r.clasificacion === 'NO_COMPUTABLE');
    if (soloHab.length === 0) return null;
    candidatas = soloHab;
  } else if (side === 'DESCUENTO') {
    const soloDesc = filas.filter(r => r.clasificacion !== 'COMPUTABLE');
    if (soloDesc.length === 0) return null;
    candidatas = soloDesc;
  }

  const clasesUnicas = new Set(candidatas.map(r => r.clasificacion));
  if (clasesUnicas.size === 1) {
    return candidatas[0].clasificacion;
  }

  const dtok = new Set(descNorm.split(' ').filter(t => t.length >= 2));
  if (dtok.size > 0) {
    const scored: Array<{ sim: number; clasif: string }> = [];
    for (const r of candidatas) {
      const rn = r.nombreNorm;
      if (!rn || rn === 'NAME') {
        scored.push({ sim: 0, clasif: r.clasificacion });
        continue;
      }
      const rtok = new Set(rn.split(' ').filter(t => t.length >= 2));
      let inter = 0;
      for (const t of dtok) {
        if (rtok.has(t)) inter++;
      }
      const union = dtok.size + rtok.size - inter || 1;
      let sim = inter / union;
      if (descNorm === rn) {
        sim = 1.5;
      } else if ((descNorm.includes(rn) || rn.includes(descNorm)) && dtok.size >= 1 && rtok.size >= 1) {
        sim = Math.max(sim, 0.55 + 0.35 * (Math.min(dtok.size, rtok.size) / Math.max(dtok.size, rtok.size)));
      }
      scored.push({ sim, clasif: r.clasificacion });
    }

    const maxSim = scored.reduce((m, x) => (x.sim > m ? x.sim : m), 0);
    if (maxSim >= 0.35) {
      const top = scored.filter(x => x.sim >= maxSim * 0.85).map(x => x.clasif);
      return mostCommonClasif(top);
    }
  }

  return mostCommonClasif(candidatas.map(r => r.clasificacion));
}

function buscarPorDescripcion(
  descNorm: string,
  side: 'HABER' | 'DESCUENTO' | null,
  seg: SegmentoBeneficiario,
): { clasif: string | null; metodo: string } {
  if (!descNorm) return { clasif: null, metodo: '' };

  const exactas = PADRON_IDX.porNombreNorm.get(descNorm) || [];
  if (exactas.length > 0) {
    const filtradas = exactas.filter(r => seg.lugaresOrden.includes(r.lugar));
    const prioridad = filtradas.length > 0 ? filtradas : exactas;
    const cls = resolverConflictoFilas(prioridad, '', descNorm, side);
    if (cls) return { clasif: cls, metodo: 'DESCRIPCION_EXACTA_PADRON' };
  }

  const dtok = new Set(descNorm.split(' ').filter(t => t.length >= 2));
  if (dtok.size >= 2) {
    const mejores: Array<{ sim: number; r: RegistroPadron }> = [];
    let mejorSim = 0;
    for (const { toks: rtok, r } of PADRON_IDX.porNombreTokens) {
      if (side === 'HABER' && r.clasificacion !== 'COMPUTABLE' && r.clasificacion !== 'NO_COMPUTABLE') continue;
      if (side === 'DESCUENTO' && r.clasificacion === 'COMPUTABLE') continue;
      let inter = 0;
      for (const t of dtok) {
        if (rtok.has(t)) inter++;
      }
      if (inter === 0) continue;
      const sim = inter / (dtok.size + rtok.size - inter);
      if (sim >= 0.65) {
        if (sim > mejorSim) mejorSim = sim;
        mejores.push({ sim, r });
      }
    }
    if (mejores.length > 0) {
      const top = mejores.filter(x => x.sim >= mejorSim * 0.90).map(x => x.r.clasificacion);
      return { clasif: mostCommonClasif(top), metodo: 'DESCRIPCION_SIMILITUD_PADRON' };
    }
  }

  if (side !== 'HABER') {
    if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descNorm)) {
      return { clasif: 'AFECTADO', metodo: 'DESCRIPCION_PATRON_EMBARGO' };
    }
    if (
      SIDECREER_RE.test(descNorm) ||
      /FEDEM|BERSA|BANCO ENTRE RIOS|MUPER.*CRED|PROVEED.*MUPER|PRESTAMO|MUTUAL MODELO.*AYUD|CUOTA CRED/.test(descNorm)
    ) {
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

export function clasificarItemsRecibo(
  items: any[],
  lugarTrabajo?: string | null,
  metaRecibo?: Record<string, any> | null,
): ItemReciboClasificado[] {
  const meta: Record<string, any> = { ...(metaRecibo || {}) };
  if (lugarTrabajo) meta.lugar_de_trabajo = lugarTrabajo;
  const seg = resolverSegmentoBeneficiario(meta);
  const out: ItemReciboClasificado[] = [];

  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    const codigoRaw = String(item.codigo !== undefined && item.codigo !== null ? item.codigo : '').trim();
    const codigoVacio = esCodigoVacioPadron(codigoRaw);
    const codigo = codigoVacio ? '' : codigoRaw;
    const desc = String(item.descripcion || item.concepto || item.detalle || item.nombre || '').trim();

    const habRaw = item.haberes !== undefined ? item.haberes : (item.montoHaber !== undefined ? item.montoHaber : item.importeHaber);
    const descRaw = item.descuentos !== undefined ? item.descuentos : (item.retenciones !== undefined ? item.retenciones : (item.montoDescuento !== undefined ? item.montoDescuento : item.importeDescuento));

    let habNum = habRaw !== undefined && habRaw !== null ? Math.abs(limpiarNumeroPadron(habRaw)) : 0;
    let descNum = descRaw !== undefined && descRaw !== null ? Math.abs(limpiarNumeroPadron(descRaw)) : 0;

    const montoUnicoRaw = item.importe !== undefined ? item.importe : item.monto;
    const montoUnico = montoUnicoRaw !== undefined && montoUnicoRaw !== null ? limpiarNumeroPadron(montoUnicoRaw) : null;

    const clasifExplicita = normalizarClasificacion(item.clasificacion);
    const tipoIn = String(item.tipo || item.columna || '').trim().toUpperCase();

    let side: 'HABER' | 'DESCUENTO' | null = null;
    if (habNum > 0 && descNum === 0) {
      side = 'HABER';
    } else if (descNum > 0 && habNum === 0) {
      side = 'DESCUENTO';
    } else if (tipoIn.includes('DESC') || tipoIn.includes('RETEN') || tipoIn.includes('DEDU')) {
      side = 'DESCUENTO';
    } else if (tipoIn.includes('HAB') || tipoIn.includes('REMUN')) {
      side = 'HABER';
    } else if (montoUnico !== null && montoUnico < 0) {
      side = 'DESCUENTO';
    }

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
      ? round2Margen(Math.abs(montoUnico))
      : round2Margen(habNum + descNum);

    const codigoUp = normalizarCodigoLookup(codigo);
    const descNorm = normalizarDescripcionPadron(desc);
    let clasifFinal = clasifExplicita;
    let metodo = clasifExplicita ? 'EXPLICITA_NORMALIZADA' : '';
    let lugarMatch = '';

    if (!clasifFinal && codigoUp) {
      const codNz = stripZeros(codigoUp);
      const codStrip = codigoUp.replace(/^_+|_+$/g, '');
      const codStripNz = stripZeros(codStrip);
      const codSinSuf = quitarSufijoCodigo(codigoUp);
      const codSinSufNz = stripZeros(codSinSuf);

      const buscarListaLugares = (
        lugaresLista: string[],
        cands: string[],
        idxMap: Map<string, RegistroPadron[]>,
        met: string,
      ): boolean => {
        for (const lug of lugaresLista) {
          for (const codCand of cands) {
            if (!codCand) continue;
            const filas = idxMap.get(`${lug}|${codCand}`);
            if (filas && filas.length > 0) {
              const c = resolverConflictoFilas(filas, codCand, descNorm, side);
              if (c) {
                clasifFinal = c;
                metodo = met;
                lugarMatch = lug;
                return true;
              }
            }
          }
        }
        return false;
      };

      // 1) Exacta en grupo primario antes de limpiar sufijos
      if (!buscarListaLugares(seg.lugaresOrden, [codigoUp, codNz], PADRON_IDX.porLugarCodigo, 'PADRON_CODIGO_EXACTO')) {
        if (!codigoUp.endsWith('_')) {
          buscarListaLugares(seg.lugaresOrden, [codStrip, codStripNz], PADRON_IDX.porLugarCodigoStrip, 'PADRON_CODIGO_EXACTO');
        }
      }

      // 2) Cross-pool exacto si viene con sufijo especial (ej. 136_, 132__)
      if (!clasifFinal && (codigoUp.includes('_') || codigoUp !== codSinSuf)) {
        buscarListaLugares(seg.lugaresFallback, [codigoUp, codNz], PADRON_IDX.porLugarCodigo, 'PADRON_CODIGO_CROSS');
      }

      // 3) Limpiando sufijos _R, _A, _D
      if (!clasifFinal && (codSinSuf !== codigoUp || codSinSufNz !== codNz)) {
        buscarListaLugares(seg.lugaresOrden, [codSinSuf, codSinSufNz], PADRON_IDX.porLugarCodigoStrip, 'PADRON_CODIGO_SIN_SUFIJO');
      }

      // 4) Fallback cross-pool limpio y sin sufijo
      if (!clasifFinal) {
        if (!buscarListaLugares(seg.lugaresFallback, [codStrip, codStripNz], PADRON_IDX.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS')) {
          if (codSinSuf !== codigoUp || codSinSufNz !== codNz) {
            buscarListaLugares(seg.lugaresFallback, [codSinSuf, codSinSufNz], PADRON_IDX.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS_SIN_SUFIJO');
          }
        }
      }
    }

    // 4) Fallback por descripción normalizada
    if (!clasifFinal && descNorm) {
      const resDesc = buscarPorDescripcion(descNorm, side, seg);
      if (resDesc.clasif) {
        clasifFinal = resDesc.clasif;
        metodo = resDesc.metodo;
      }
    }

    // 5) Default haberes computables
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

    let tipoFinal: 'HABER' | 'DESCUENTO' = side || ((clasifFinal === 'SUBTOTAL_1' || clasifFinal === 'AFECTADO' || clasifFinal === 'SIN_CLASIFICAR') ? 'DESCUENTO' : 'HABER');
    if (side === null) {
      if (tipoFinal === 'DESCUENTO' && descNum === 0 && importeAbs > 0) descNum = importeAbs;
      if (tipoFinal === 'HABER' && habNum === 0 && importeAbs > 0) habNum = importeAbs;
    }

    out.push({
      codigo,
      descripcion: desc,
      tipo: tipoFinal,
      haberes: round2Margen(habNum),
      descuentos: round2Margen(descNum),
      importe: round2Margen(importeAbs),
      clasificacion: clasifFinal,
      metodoClasificacion: metodo,
      lugarPadronMatch: lugarMatch || seg.lugarPrincipal,
    });
  }

  return out;
}

function sumaAbs(items: ItemReciboClasificado[]): number {
  let total = 0;
  for (const it of items) {
    let val = Number(it.importe || 0);
    if (!val) val = Number(it.descuentos || 0) || Number(it.haberes || 0);
    total += Math.abs(val);
  }
  return round2Margen(total);
}

function fmtAr(val: number): string {
  const num = Number(val || 0);
  const sign = num < 0 ? '-' : '';
  const fixed = Math.abs(num).toFixed(2);
  const [ent, dec] = fixed.split('.');
  return `${sign}$${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

export function calcularMargenRecibo(datosRecibo: Record<string, any> | null | undefined) {
  const d = datosRecibo || {};
  const seg = resolverSegmentoBeneficiario(d);
  const porcentajeTope = seg.porcentajeTope;

  const itemsRaw = Array.isArray(d.items) ? d.items : (Array.isArray(d.conceptos) ? d.conceptos : []);
  const itemsClasif = clasificarItemsRecibo(itemsRaw, seg.lugarPrincipal, d);

  const sumItemsHab = round2Margen(
    itemsClasif.reduce((acc, i) => acc + Math.abs(i.haberes || (i.tipo === 'HABER' ? i.importe : 0)), 0),
  );
  const sumItemsDesc = round2Margen(
    itemsClasif.reduce((acc, i) => acc + Math.abs(i.descuentos || (i.tipo === 'DESCUENTO' ? i.importe : 0)), 0),
  );

  const sinHeaderHab = d.total_haberes === undefined && d.total_haberes === null && d.sueldoBrutoTotal === undefined && d.sueldoBruto === undefined
    ? true
    : (d.total_haberes == null && d.sueldoBrutoTotal == null && d.sueldoBruto == null);
  const sinHeaderDesc = d.total_descuentos == null && d.totalDescuentos == null && d.totalDescuentosRecibo == null;
  const sinHeaderLiq = d.liquido == null && d.sueldoLiquido == null && d.sueldoNeto == null;

  const totalHaberes = (sinHeaderHab && itemsClasif.length > 0)
    ? sumItemsHab
    : round2Margen(limpiarNumeroPadron(d.total_haberes ?? d.sueldoBrutoTotal ?? d.sueldoBruto ?? 0));
  const totalDescuentosIn = (sinHeaderDesc && itemsClasif.length > 0)
    ? sumItemsDesc
    : round2Margen(limpiarNumeroPadron(d.total_descuentos ?? d.totalDescuentos ?? d.totalDescuentosRecibo ?? 0));
  const liquido = (sinHeaderLiq && (totalHaberes > 0 || itemsClasif.length > 0))
    ? round2Margen(totalHaberes - Math.abs(totalDescuentosIn))
    : round2Margen(limpiarNumeroPadron(d.liquido ?? d.sueldoLiquido ?? d.sueldoNeto ?? 0));
  const cuotaFutura2 = round2Margen(Math.abs(limpiarNumeroPadron(d.cuota_futura_2 ?? d.cuotaFutura2 ?? 0)));

  // PASO 1: Validaciones de consistencia de cabecera
  const liquidoEsperado = round2Margen(totalHaberes - Math.abs(totalDescuentosIn));
  const diferenciaCabecera = round2Margen(liquido - liquidoEsperado);
  const cabeceraConsistente = Math.abs(diferenciaCabecera) <= 0.01;

  const diffHab = itemsClasif.length > 0 ? round2Margen(totalHaberes - sumItemsHab) : 0;
  const diffDesc = itemsClasif.length > 0 ? round2Margen(Math.abs(totalDescuentosIn) - sumItemsDesc) : 0;

  const itemsCero = itemsClasif.filter(i => round2Margen(i.importe || 0) === 0);
  const itemsSinCodigo = itemsClasif.filter(i => esCodigoVacioPadron(i.codigo));
  const itemsSinClasif = itemsClasif.filter(i => i.clasificacion === 'SIN_CLASIFICAR');

  const alertas: string[] = [];
  if (totalHaberes > 0 && !cabeceraConsistente) {
    alertas.push(
      `Diferencia en cabecera del recibo: Total Haberes - Total Descuentos = ${fmtAr(liquidoEsperado)} vs Líquido informado ${fmtAr(liquido)} (diferencia: ${fmtAr(diferenciaCabecera)}).`,
    );
  }
  if (itemsClasif.length > 0 && totalHaberes > 0 && Math.abs(diffHab) > 0.01) {
    alertas.push(
      `La suma de ítems de Haberes (${fmtAr(sumItemsHab)}) difiere del Total Haberes de cabecera (${fmtAr(totalHaberes)}) en ${fmtAr(diffHab)}.`,
    );
  }
  if (itemsClasif.length > 0 && Math.abs(totalDescuentosIn) > 0 && Math.abs(diffDesc) > 0.01) {
    alertas.push(
      `La suma de ítems de Descuentos (${fmtAr(sumItemsDesc)}) difiere del Total Descuentos de cabecera (${fmtAr(Math.abs(totalDescuentosIn))}) en ${fmtAr(diffDesc)}.`,
    );
  }
  if (itemsCero.length > 0) {
    alertas.push(`Se detectaron ${itemsCero.length} ítem(s) con importe $0,00 en el detalle.`);
  }
  if (itemsSinCodigo.length > 0) {
    alertas.push(`Se detectaron ${itemsSinCodigo.length} ítem(s) sin código numérico asignado (clasificados por descripción).`);
  }
  if (itemsSinClasif.length > 0) {
    alertas.push(`Hay ${itemsSinClasif.length} descuento(s) sin código registrado en el padrón oficial.`);
  }

  // PASO 2: Subtotal1
  const totalSubtotal1Desc = sumaAbs(itemsClasif.filter(i => i.clasificacion === 'SUBTOTAL_1' && i.tipo !== 'HABER'));
  const subtotal1 = round2Margen(totalHaberes - totalSubtotal1Desc);

  // PASO 3: Subtotal_tope y Subtotal2
  const subtotalTope = round2Margen(subtotal1 * porcentajeTope);
  const subtotal2 = round2Margen(subtotal1 - subtotalTope);

  // PASO 4: Total_no_computable y Afectable
  const totalNoComputable = sumaAbs(itemsClasif.filter(i => i.clasificacion === 'NO_COMPUTABLE' && i.tipo !== 'DESCUENTO'));
  const afectable = round2Margen(subtotal2 - totalNoComputable);

  // PASO 5: Afectado y Margen Disponible del Recibo
  const totalAfectado = sumaAbs(itemsClasif.filter(i => i.clasificacion === 'AFECTADO' && i.tipo !== 'HABER'));
  const margenSinFutura2 = round2Margen(afectable - totalAfectado);
  const disponibleRecibo = round2Margen(afectable - totalAfectado - cuotaFutura2);

  const sinDisponible = (margenSinFutura2 <= 0) || (disponibleRecibo <= 0);
  const estado = sinDisponible ? 'SIN_DISPONIBLE' : 'DISPONIBLE';
  const estadoLabel = sinDisponible ? 'SIN Disponible' : 'DISPONIBLE';

  const topeEndeud4167 = round2Margen((5.0 * Math.max(0, liquido)) / 12.0);
  const cuotaSeguraGeneral = sinDisponible ? 0 : round2Margen(Math.min(disponibleRecibo, topeEndeud4167));

  const resumenClasificaciones: Record<string, number> = {};
  for (const it of itemsClasif) {
    resumenClasificaciones[it.clasificacion] = (resumenClasificaciones[it.clasificacion] || 0) + 1;
  }

  return {
    estado,
    estadoLabel,
    puedeOfrecerCuotas: !sinDisponible,
    tipoBeneficiario: seg.tipoBeneficiario,
    etiquetaBeneficiario: seg.etiquetaBeneficiario,
    lugarTrabajo: seg.lugarPrincipal,
    porcentajeTope,
    porcentajeAfectableMaximo: seg.porcentajeAfectableMaximo,
    totalHaberes,
    totalDescuentos: Math.abs(totalDescuentosIn),
    netoLiquido: liquido,
    liquido,
    totalSubtotal1Desc,
    subtotal1,
    subtotalTope,
    subtotal_tope: subtotalTope,
    subtotal2,
    totalNoComputable,
    total_no_computable: totalNoComputable,
    afectable,
    totalAfectado,
    cuotaFutura2,
    margenSinFutura2,
    disponibleRecibo,
    margen: disponibleRecibo,
    topeEndeudamientoMensual4167: topeEndeud4167,
    cuotaMaximaSeguraGeneral: cuotaSeguraGeneral,
    limitadoPor: sinDisponible
      ? 'SIN_DISPONIBLE'
      : (disponibleRecibo <= topeEndeud4167 ? 'MARGEN_RECIBO' : 'TOPE_ENDEUDAMIENTO_LIQUIDO'),
    validaciones: {
      cabeceraConsistente,
      liquidoEsperado,
      liquidoInformado: liquido,
      diferenciaCabecera,
      tieneDesgloseItems: itemsClasif.length > 0,
      sumaItemsHaberes: sumItemsHab,
      diferenciaHaberes: diffHab,
      sumaItemsDescuentos: sumItemsDesc,
      diferenciaDescuentos: diffDesc,
      cantidadItemsImporteCero: itemsCero.length,
      cantidadItemsSinCodigo: itemsSinCodigo.length,
      cantidadItemsSinClasificar: itemsSinClasif.length,
    },
    alertas,
    resumenClasificaciones,
    items: itemsClasif,
  };
}

function simularDesdeCuotaRef(cuotaObjetivo: number, plazo: number, lineaKey: string) {
  if (cuotaObjetivo <= 0) return null;
  if (lineaKey === 'muni' || lineaKey === 'quad' || lineaKey === 'municipales') {
    const p = MOTOR_FINANCIERO_REF.municipales[plazo];
    if (!p) return null;
    const neto = cuotaObjetivo / p.coefCuota;
    const capVik = neto / MOTOR_FINANCIERO_REF.municipales.factorVikingo;
    return {
      neto: round2Margen(neto),
      capitalBruto: round2Margen(capVik),
      cuotaFinal: round2Margen(cuotaObjetivo),
      totalPagar: round2Margen(cuotaObjetivo * plazo),
    };
  }
  if (lineaKey === 'sidecreer') {
    const p = MOTOR_FINANCIERO_REF.sidecreer[plazo];
    if (!p) return null;
    const factorPmt = p.tem / (1 - Math.pow(1 + p.tem, -plazo));
    const capBruto = cuotaObjetivo / factorPmt;
    const neto = capBruto * (1 - p.gastos);
    return {
      neto: round2Margen(neto),
      capitalBruto: round2Margen(capBruto),
      cuotaFinal: round2Margen(cuotaObjetivo),
      totalPagar: round2Margen(cuotaObjetivo * plazo),
    };
  }
  const p = MOTOR_FINANCIERO_REF.fedem[plazo];
  if (!p) return null;
  const factorPmt = p.tem / (1 - Math.pow(1 + p.tem, -plazo));
  const factorTotal = factorPmt + p.seguro;
  const capBruto = cuotaObjetivo / factorTotal;
  const neto = capBruto * (1 - p.gastos);
  return {
    neto: round2Margen(neto),
    capitalBruto: round2Margen(capBruto),
    cuotaFinal: round2Margen(cuotaObjetivo),
    totalPagar: round2Margen(cuotaObjetivo * plazo),
  };
}

export function calcularOfertasPorPlazo(
  disponibleRecibo: number,
  liquido: number,
  lineaCredito = 'fedem',
) {
  if (disponibleRecibo <= 0 || liquido <= 0) return [];
  const lineaNorm = String(lineaCredito || 'fedem').trim().toLowerCase();
  const key = (lineaNorm.includes('muni') || lineaNorm.includes('quad'))
    ? 'muni'
    : (lineaNorm.includes('side') ? 'sidecreer' : 'fedem');

  const plazos = PLAZOS_POR_LINEA[key];
  const ofertas: Array<Record<string, any>> = [];
  for (const plazo of plazos) {
    const mult = MULTIPLICADORES_ENDEUDAMIENTO[plazo];
    const topeCuota = round2Margen((mult * liquido) / plazo);
    const topeCompromiso = round2Margen(mult * liquido);
    const cuotaMaxReal = round2Margen(Math.min(disponibleRecibo, topeCuota));
    if (cuotaMaxReal <= 0) continue;
    const sim = simularDesdeCuotaRef(cuotaMaxReal, plazo, key);
    if (!sim || sim.neto <= 0) continue;
    ofertas.push({
      plazo,
      linea: key,
      multiplicador: mult,
      porcentajeNetoLiquido: 41.67,
      topeEndeudamientoCuota: topeCuota,
      topeCompromisoTotal: topeCompromiso,
      disponibleRecibo: round2Margen(disponibleRecibo),
      cuotaMaximaReal: cuotaMaxReal,
      limitadoPor: disponibleRecibo <= topeCuota ? 'MARGEN_RECIBO' : 'TOPE_ENDEUDAMIENTO',
      neto: sim.neto,
      capitalMaximoPrestar: sim.neto,
      capitalBruto: sim.capitalBruto,
      cuotaResultante: sim.cuotaFinal,
      totalPagar: sim.totalPagar,
    });
  }
  return ofertas;
}

export function calcularOfertasDisponibles(
  datosRecibo: Record<string, any> | null | undefined,
  lineaCredito = 'fedem',
) {
  const margenInfo = calcularMargenRecibo(datosRecibo);
  if (margenInfo.disponibleRecibo <= 0 || margenInfo.estado === 'SIN_DISPONIBLE') {
    return {
      estado: 'SIN_DISPONIBLE',
      estadoLabel: 'SIN Disponible',
      margen: margenInfo.disponibleRecibo,
      disponibleRecibo: margenInfo.disponibleRecibo,
      analisisMargen: margenInfo,
      ofertas: [],
    };
  }
  const ofertas = calcularOfertasPorPlazo(margenInfo.disponibleRecibo, margenInfo.netoLiquido, lineaCredito);
  return {
    estado: 'DISPONIBLE',
    estadoLabel: 'DISPONIBLE',
    margen: margenInfo.disponibleRecibo,
    disponibleRecibo: margenInfo.disponibleRecibo,
    analisisMargen: margenInfo,
    ofertas,
  };
}

export function enriquecerResultadoAuditoria(
  rawDict: Record<string, any> | null | undefined,
  cuotaFutura2?: number | null,
) {
  const res: Record<string, any> = { ...(rawDict || {}) };
  const conceptosIn = Array.isArray(res.conceptos)
    ? res.conceptos
    : (Array.isArray(res.items) ? res.items : []);

  const cf2 = limpiarNumeroPadron(
    cuotaFutura2 !== undefined && cuotaFutura2 !== null
      ? cuotaFutura2
      : (res.cuota_futura_2 ?? res.cuotaFutura2 ?? 0),
  );

  const analisis = calcularMargenRecibo({
    total_haberes: res.total_haberes ?? res.sueldoBrutoTotal ?? res.sueldoBruto,
    total_descuentos: res.total_descuentos ?? res.totalDescuentos ?? res.totalDescuentosRecibo,
    liquido: res.liquido ?? res.sueldoLiquido ?? res.sueldoNeto,
    cuota_futura_2: cf2,
    items: conceptosIn,
    lugar_de_trabajo: res.lugar_de_trabajo || res.lugarTrabajo || '',
    tipoRecibo: res.tipoRecibo || '',
    formatoRecibo: res.formatoRecibo || res.formato || '',
    organismo: res.organismo || '',
    situacionRevista: res.situacionRevista || '',
    condicion: res.condicion || '',
    cargo: res.cargo || res.escalafonCargo || '',
  });

  const itemsClasif = analisis.items;
  let descLeyCalc = 0;
  let fedemCalc = 0;
  let bersaCalc = 0;
  let sidecreerCalc = 0;
  let mutualesCalc = 0;
  let embargoCalc = 0;
  const fedemCodes: string[] = [];
  const embargoDescs: string[] = [];

  for (const it of itemsClasif) {
    if (it.tipo !== 'DESCUENTO' && (it.clasificacion === 'COMPUTABLE' || it.clasificacion === 'NO_COMPUTABLE')) {
      continue;
    }
    const imp = Math.abs(it.descuentos || it.importe || 0);
    if (imp <= 0) continue;
    const descNorm = normalizarDescripcionPadron(it.descripcion || '');
    const codBase = stripZeros(quitarSufijoCodigo(normalizarCodigoLookup(it.codigo)));
    if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descNorm)) {
      embargoCalc = round2Margen(embargoCalc + imp);
      if (it.descripcion) embargoDescs.push(String(it.descripcion));
    } else if (it.clasificacion === 'SUBTOTAL_1') {
      descLeyCalc = round2Margen(descLeyCalc + imp);
    } else if (it.clasificacion === 'AFECTADO') {
      if (['366', '368', '369', '1115', '1117'].includes(codBase) || descNorm.includes('FEDEM')) {
        fedemCalc = round2Margen(fedemCalc + imp);
        const lbl = it.codigo ? `${it.codigo} (${it.descripcion})` : (it.descripcion || 'FEDEM');
        if (!fedemCodes.includes(lbl)) fedemCodes.push(lbl);
      } else if (SIDECREER_RE.test(descNorm) || codBase === '412' || codBase === '812') {
        sidecreerCalc = round2Margen(sidecreerCalc + imp);
      } else if (descNorm.includes('BERSA') || descNorm.includes('BANCO ENTRE RIOS') || codBase === '480' || codBase === '960') {
        bersaCalc = round2Margen(bersaCalc + imp);
      } else {
        mutualesCalc = round2Margen(mutualesCalc + imp);
      }
    }
  }

  const ofertasPorPlazo = analisis.puedeOfrecerCuotas
    ? {
        fedem: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'fedem'),
        muni: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'muni'),
        sidecreer: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'sidecreer'),
      }
    : { fedem: [], muni: [], sidecreer: [] };

  return {
    analisis,
    itemsClasif,
    ofertasPorPlazo,
    desgloseDescuentos: {
      descLeyCalc,
      fedemCalc,
      bersaCalc,
      sidecreerCalc,
      mutualesCalc,
      embargoCalc,
      fedemCodes,
      embargoConcepto: embargoDescs.join('; '),
    },
  };
}
