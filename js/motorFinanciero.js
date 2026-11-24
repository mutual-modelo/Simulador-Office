/**
 * MOTOR_FINANCIERO_EXACTO — Motor de cálculo oficial AMMER (FEDEM, Sidecreer, Municipales QUAD/Vikingo).
 * Extraído del monolito index.html para reutilización en navegador y tests unitarios automatizados.
 */
const MOTOR_FINANCIERO_EXACTO = {
  fedem: {
    6:  { tna: 0.48940000000000, tem: 0.04078333370000, gastos: 0.25000000000000, seguro: 0.00500000000000, coef: 1.56999000000000 },
    12: { tna: 0.53690000000000, tem: 0.04474173010000, gastos: 0.25000000000000, seguro: 0.00500000000000, coef: 1.83207000000000 },
    18: { tna: 0.44670000000000, tem: 0.03722500030000, gastos: 0.34000000000000, seguro: 0.00500000000000, coef: 2.24242000000000 },
    24: { tna: 0.53390000000000, tem: 0.04449166620000, gastos: 0.34000000000000, seguro: 0.00500000000000, coef: 2.67773000000000 },
    36: { tna: 0.61450000000000, tem: 0.05120833300000, gastos: 0.34000000000000, seguro: 0.00500000000000, coef: 3.62048000000000 },
    48: { tna: 0.64850000000000, tem: 0.05404166540000, gastos: 0.34000000000000, seguro: 0.00500000000000, coef: 4.63548000000000 }
  },
  sidecreer: {
    6:  { tna: 0.58534514000000, tem: 0.04877876170000, gastos: 0.25000000000000, seguro: 0.00000000000000, coef: 1.56999000000000 },
    12: { tna: 0.63154362000000, tem: 0.05262863500000, gastos: 0.25000000000000, seguro: 0.00000000000000, coef: 1.83207000000000 },
    18: { tna: 0.53972734000000, tem: 0.04497727830000, gastos: 0.34000000000000, seguro: 0.00000000000000, coef: 2.24242000000000 },
    24: { tna: 0.61978356000000, tem: 0.05164863000000, gastos: 0.34000000000000, seguro: 0.00000000000000, coef: 2.67773000000000 },
    36: { tna: 0.69009744000000, tem: 0.05750812000000, gastos: 0.34000000000000, seguro: 0.00000000000000, coef: 3.62048000000000 },
    48: { tna: 0.71781259000000, tem: 0.05981771580000, gastos: 0.34000000000000, seguro: 0.00000000000000, coef: 4.63548000000000 }
  },
  municipales: {
    factorVikingo: 0.85000028330000,
    tnaQuad: 0.39595561510000,
    temQuad: 0.03299630130000,
    12: { coefCuota: 0.15970100000000, coefTotal: 1.91640000000000 },
    24: { coefCuota: 0.11279800000000, coefTotal: 2.70710000000000 }
  },
  pmt: function(rate, nper, pv) {
    return pv * (rate / (1.0 - Math.pow(1.0 + rate, -nper)));
  },
  calcularFEDEM: function(neto, plazo) {
    const p = this.fedem[plazo];
    const capitalBruto = neto / (1.0 - p.gastos);
    const cuotaPura = this.pmt(p.tem, plazo, capitalBruto);
    const seguroMensual = capitalBruto * p.seguro;
    const cuotaFinal = cuotaPura + seguroMensual;
    const totalPagar = cuotaFinal * plazo;
    return { capitalBruto, cuotaPura, seguroMensual, cuotaFinal, totalPagar, gastosAdmin: capitalBruto * p.gastos, interesesFinancieros: totalPagar - capitalBruto - (seguroMensual * plazo) };
  },
  calcularFEDEMDesdeCuota: function(cuotaObjetivo, plazo) {
    const p = this.fedem[plazo];
    const factorPmt = p.tem / (1.0 - Math.pow(1.0 + p.tem, -plazo));
    const factorTotal = factorPmt + p.seguro;
    const capitalBruto = cuotaObjetivo / factorTotal;
    const neto = capitalBruto * (1.0 - p.gastos);
    const seguroMensual = capitalBruto * p.seguro;
    const cuotaPura = cuotaObjetivo - seguroMensual;
    const totalPagar = cuotaObjetivo * plazo;
    return { neto, capitalBruto, cuotaPura, seguroMensual, cuotaFinal: cuotaObjetivo, totalPagar, gastosAdmin: capitalBruto * p.gastos, interesesFinancieros: totalPagar - capitalBruto - (seguroMensual * plazo) };
  },
  calcularSidecreer: function(neto, plazo) {
    const p = this.sidecreer[plazo];
    const capitalBruto = neto / (1.0 - p.gastos);
    const cuotaFinal = this.pmt(p.tem, plazo, capitalBruto);
    const totalPagar = cuotaFinal * plazo;
    return { capitalBruto, cuotaPura: cuotaFinal, seguroMensual: 0.0, cuotaFinal, totalPagar, gastosAdmin: capitalBruto * p.gastos, interesesFinancieros: totalPagar - capitalBruto };
  },
  calcularSidecreerDesdeCuota: function(cuotaObjetivo, plazo) {
    const p = this.sidecreer[plazo];
    const factorPmt = p.tem / (1.0 - Math.pow(1.0 + p.tem, -plazo));
    const capitalBruto = cuotaObjetivo / factorPmt;
    const neto = capitalBruto * (1.0 - p.gastos);
    const totalPagar = cuotaObjetivo * plazo;
    return { neto, capitalBruto, cuotaPura: cuotaObjetivo, seguroMensual: 0.0, cuotaFinal: cuotaObjetivo, totalPagar, gastosAdmin: capitalBruto * p.gastos, interesesFinancieros: totalPagar - capitalBruto };
  },
  calcularMunicipales: function(neto, plazo) {
    const p = this.municipales[plazo];
    const cuotaFinal = neto * p.coefCuota;
    const totalPagar = cuotaFinal * plazo;
    const capitalVikingo = neto / this.municipales.factorVikingo;
    const capitalQuad = cuotaFinal * ((1.0 - Math.pow(1.0 + this.municipales.temQuad, -plazo)) / this.municipales.temQuad);
    return { capitalBruto: capitalVikingo, capitalVikingo, capitalQuad, cuotaPura: cuotaFinal, seguroMensual: 0.0, cuotaFinal, totalPagar, gastosAdmin: capitalVikingo - neto };
  },
  calcularMunicipalesDesdeCuota: function(cuotaObjetivo, plazo) {
    const p = this.municipales[plazo];
    const neto = cuotaObjetivo / p.coefCuota;
    const totalPagar = cuotaObjetivo * plazo;
    const capitalVikingo = neto / this.municipales.factorVikingo;
    const capitalQuad = cuotaObjetivo * ((1.0 - Math.pow(1.0 + this.municipales.temQuad, -plazo)) / this.municipales.temQuad);
    return { neto, capitalBruto: capitalVikingo, capitalVikingo, capitalQuad, cuotaPura: cuotaObjetivo, seguroMensual: 0.0, cuotaFinal: cuotaObjetivo, totalPagar, gastosAdmin: capitalVikingo - neto };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.MOTOR_FINANCIERO_EXACTO = MOTOR_FINANCIERO_EXACTO;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOTOR_FINANCIERO_EXACTO };
}
