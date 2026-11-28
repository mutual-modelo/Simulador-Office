import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

test('index.html contiene la pestaña Métricas y sus contenedores W4', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  for (const id of [
    'btnWaTabMetricas',
    'waTabPanelMetricas',
    'inpWaMetDesde',
    'inpWaMetHasta',
    'waMetricsKpisGrid',
    'waMetricsBodyGrid',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Falta #${id} en index.html`);
  }
  assert.ok(html.includes('whatsappBotMetrics.js'), 'Falta carga lazy de whatsappBotMetrics.js');
});

test('WaMetricsUI exporta cargarPanelMetricasWa', async () => {
  await import('../js/whatsappBotMetrics.js');
  const ui = globalThis.WaMetricsUI;
  assert.ok(ui);
  assert.equal(typeof ui.cargarPanelMetricasWa, 'function');
});
