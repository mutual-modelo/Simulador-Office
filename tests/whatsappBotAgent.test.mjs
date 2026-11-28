import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

test('index.html contiene la pestaña Agente & Simulador y sus contenedores clave', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  for (const id of [
    'btnWaTabAgente',
    'waTabPanelAgente',
    'waAgentBudgetKpis',
    'selWaAgentSimRole',
    'waAgentSimThread',
    'inpWaAgentSimMsg',
    'waAgentSimInspector',
    'selWaAgentConfigKey',
    'waAgentConfigFormBody',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Falta #${id} en index.html`);
  }
  assert.ok(html.includes('whatsappBotAgent.js'), 'Falta carga lazy de whatsappBotAgent.js');
});

test('WaAgentUI exporta los 4 roles de AI Worker y funciones de Simulador/Config', async () => {
  await import('../js/whatsappBotAgent.js');
  const ui = globalThis.WaAgentUI;
  assert.ok(ui);
  assert.deepEqual(Object.keys(ui.WORKER_ROLE_LABELS).sort(), [
    'cobranzas',
    'docs_pendientes',
    'inbound_prestamos',
    'reactivacion',
  ]);
  for (const fn of [
    'cargarPanelAgenteWa',
    'seleccionarRolConfigAgenteWa',
    'guardarConfigAgenteWa',
    'reiniciarSimuladorAgenteWa',
    'enviarMensajeSimuladorAgenteWa',
    'cargarEjemploSimuladorWa',
  ]) {
    assert.equal(typeof ui[fn], 'function', `Falta función ${fn}`);
  }
});
