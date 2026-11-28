import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

test('index.html contiene la pestaña Pipeline & Ops y sus contenedores W3', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  for (const id of [
    'btnWaTabPipeline',
    'waTabPanelPipeline',
    'waPipelineBoard',
    'waPipelineTotalBadge',
    'waAdvisorsListBox',
    'waAutomationsListBox',
    'txtWaCampanaCsv',
    'waCampanaPreviewBox',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Falta #${id} en index.html`);
  }
  assert.ok(html.includes('whatsappBotPipeline.js'), 'Falta carga lazy de whatsappBotPipeline.js');
});

test('WaPipelineUI exporta las 8 etapas y funciones de Kanban, Horarios, Automatizaciones y CSV', async () => {
  await import('../js/whatsappBotPipeline.js');
  const ui = globalThis.WaPipelineUI;
  assert.ok(ui);
  assert.equal(ui.PIPELINE_ORDER.length, 8);
  assert.ok(ui.PIPELINE_ORDER.includes('esperando_firma'));
  for (const fn of [
    'cargarPanelPipelineWa',
    'onWaKanbanDragStart',
    'onWaKanbanDrop',
    'abrirChatDesdeKanbanWa',
    'agregarAsesorHorarioWa',
    'toggleReglaAutomatizacionWa',
    'ejecutarBarridoAutomatizacionesWa',
    'previsualizarCampanaCsvWa',
    'enviarCampanaCsvWa',
  ]) {
    assert.equal(typeof ui[fn], 'function', `Falta función ${fn}`);
  }
});
