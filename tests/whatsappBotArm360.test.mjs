import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

test('index.html contiene los contenedores del Panel 360°, filtros ARM y controles Handoff', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  for (const id of [
    'waChatWorkspace',
    'waArmFilterChips',
    'selWaArmStageFilter',
    'waChatBotStateBadge',
    'btnWaToggleBotPause',
    'btnWaResolveHandoff',
    'btnWaToggle360',
    'waContext360Panel',
    'waContext360Body',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Falta elemento #${id} en index.html`);
  }
  assert.ok(html.includes('whatsappBotArm360.js'), 'Falta carga lazy de whatsappBotArm360.js');
});

test('WaArm360 exporta todas las etapas (8) y construye filtros de query correctamente', async () => {
  await import('../js/whatsappBotArm360.js');
  const arm = globalThis.WaArm360;
  assert.equal(Object.keys(arm.STAGE_META).length, 8);
  assert.ok(arm.STAGE_META.esperando_firma);

  assert.deepEqual(arm.buildFilterQueryParams(), {});
  arm.setWaArmFilter('needs_human');
  arm.setWaArmStageFilter('esperando_firma');
  assert.deepEqual(arm.buildFilterQueryParams(), {
    needsHuman: 'true',
    stage: 'esperando_firma',
  });

  arm.setWaArmFilter('hoy');
  arm.setWaArmStageFilter('');
  assert.deepEqual(arm.buildFilterQueryParams(), { filter: 'hoy' });
});
