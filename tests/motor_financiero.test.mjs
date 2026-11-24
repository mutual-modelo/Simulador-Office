import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const motorPath = path.resolve(import.meta.dirname, '../js/motorFinanciero.js');
const motorSource = fs.readFileSync(motorPath, 'utf8');
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(motorSource, sandbox, { filename: 'motorFinanciero.js' });
const MOTOR_FINANCIERO_EXACTO = sandbox.MOTOR_FINANCIERO_EXACTO;

const PLAZOS_LARGO = [6, 12, 18, 24, 36, 48];
const PLAZOS_MUNI = [12, 24];

test('MOTOR_FINANCIERO_EXACTO FEDEM: ida y vuelta cuota-neto exacta en todos los plazos', () => {
  for (const plazo of PLAZOS_LARGO) {
    const neto = 250000;
    const fwd = MOTOR_FINANCIERO_EXACTO.calcularFEDEM(neto, plazo);
    assert.ok(fwd.capitalBruto > neto, `FEDEM ${plazo}m capitalBruto debe superar neto`);
    assert.ok(fwd.cuotaFinal > fwd.cuotaPura, `FEDEM ${plazo}m incluye seguro mensual`);
    assert.ok(fwd.totalPagar > fwd.capitalBruto, `FEDEM ${plazo}m totalPagar debe superar capitalBruto`);

    const inv = MOTOR_FINANCIERO_EXACTO.calcularFEDEMDesdeCuota(fwd.cuotaFinal, plazo);
    assert.ok(Math.abs(inv.neto - neto) < 1e-6, `FEDEM ${plazo}m roundtrip neto=${inv.neto} != ${neto}`);
    assert.ok(Math.abs(inv.capitalBruto - fwd.capitalBruto) < 1e-6);
  }
});

test('MOTOR_FINANCIERO_EXACTO Sidecreer: ida y vuelta cuota-neto exacta en todos los plazos', () => {
  for (const plazo of PLAZOS_LARGO) {
    const neto = 180000;
    const fwd = MOTOR_FINANCIERO_EXACTO.calcularSidecreer(neto, plazo);
    assert.equal(fwd.seguroMensual, 0);
    assert.ok(fwd.capitalBruto > neto);
    assert.ok(Math.abs(fwd.totalPagar - fwd.cuotaFinal * plazo) < 1e-6);

    const inv = MOTOR_FINANCIERO_EXACTO.calcularSidecreerDesdeCuota(fwd.cuotaFinal, plazo);
    assert.ok(Math.abs(inv.neto - neto) < 1e-6, `Sidecreer ${plazo}m roundtrip neto=${inv.neto} != ${neto}`);
    assert.ok(Math.abs(inv.gastosAdmin - fwd.gastosAdmin) < 1e-6);
  }
});

test('MOTOR_FINANCIERO_EXACTO Municipales (Vikingo/QUAD): ida y vuelta cuota-neto exacta en 12 y 24 cuotas', () => {
  for (const plazo of PLAZOS_MUNI) {
    const neto = 300000;
    const fwd = MOTOR_FINANCIERO_EXACTO.calcularMunicipales(neto, plazo);
    assert.ok(fwd.capitalVikingo > neto);
    assert.ok(fwd.capitalQuad > 0);
    assert.ok(fwd.totalPagar > neto);

    const inv = MOTOR_FINANCIERO_EXACTO.calcularMunicipalesDesdeCuota(fwd.cuotaFinal, plazo);
    assert.ok(Math.abs(inv.neto - neto) < 1e-6, `Municipales ${plazo}m roundtrip neto=${inv.neto} != ${neto}`);
    assert.ok(Math.abs(inv.capitalQuad - fwd.capitalQuad) < 1e-6);
  }
});
