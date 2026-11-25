import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('UI Integrity: todos los scripts locales referenciados en index.html existen en disco', () => {
  const scriptMatches = [...indexHtml.matchAll(/<script\s+[^>]*src="([^"]+)"/gi)];
  const localScripts = scriptMatches
    .map((m) => m[1])
    .filter((src) => !/^https?:\/\//i.test(src) && !src.startsWith('data:'));

  assert.ok(localScripts.length > 0, 'Debe haber scripts locales en index.html');
  for (const src of localScripts) {
    const cleanPath = src.split('?')[0].replace(/^\.\//, '');
    const fullPath = path.join(ROOT, cleanPath);
    assert.ok(fs.existsSync(fullPath), `Falta el script referenciado: ${cleanPath}`);
  }
});

test('UI Integrity: funciones críticas de onclick en index.html están definidas', () => {
  const requiredGlobals = [
    'cambiarPestana',
    'cambiarVistaPrincipal',
    'verFichaCompleta',
    'abrirModalSubirLoteExpediente',
    'ejecutarValidacionDniAudit20',
    'abrirValidacionRenaperAudit20',
    'setLinea',
    'setModo',
    'setPlazo',
    'normalizarNombreArchivoDrive'
  ];

  const jsBundle = [
    indexHtml,
    ...fs.readdirSync(path.join(ROOT, 'js'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
  ].join('\n');

  for (const fnName of requiredGlobals) {
    const re = new RegExp(`(function\\s+${fnName}\\b|window\\.${fnName}\\s*=|global\\.${fnName}\\s*=)`);
    assert.match(jsBundle, re, `No se encontró definición o export para ${fnName}`);
  }
});

test('Reglamentación Drive: normalizarNombreArchivoDrive mantiene nomenclatura en MAYÚSCULAS', () => {
  const match = indexHtml.match(/function\s+normalizarNombreArchivoDrive\s*\([^)]*\)\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(match, 'Debe existir normalizarNombreArchivoDrive en index.html');
  assert.match(match[0], /\.toUpperCase\(\)/, 'normalizarNombreArchivoDrive debe forzar .toUpperCase()');
});
