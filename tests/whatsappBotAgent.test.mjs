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

test('WaAgentUI resuelve RENDER_API_URL correctamente (regresión sin API_BASE)', async () => {
  const prevUrl = globalThis.RENDER_API_URL;
  const prevFetch = globalThis.fetchConTimeout;
  const calledUrls = [];
  globalThis.RENDER_API_URL = 'https://ammer-auditor-api.onrender.com/';
  globalThis.fetchConTimeout = async (url) => {
    calledUrls.push(url);
    return {
      ok: true,
      json: async () => ({ ok: true, configs: [], availableTools: [], totalTokensHoy: 0, limiteDiario: 500000, usoPct: 0, bloqueosGuardas: 0, conversacionesActivas: 0 }),
    };
  };
  try {
    await globalThis.WaAgentUI.cargarPanelAgenteWa();
    assert.ok(calledUrls.includes('https://ammer-auditor-api.onrender.com/api/admin/whatsapp/agente/config'));
    assert.ok(calledUrls.includes('https://ammer-auditor-api.onrender.com/api/admin/whatsapp/agente/presupuesto'));
  } finally {
    globalThis.RENDER_API_URL = prevUrl;
    globalThis.fetchConTimeout = prevFetch;
  }
});
