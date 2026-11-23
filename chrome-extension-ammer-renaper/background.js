const RENAPER_URL = 'https://tramites.renaper.gob.ar/mi_ejemplar/';
const SESSION_KEY = 'ammerSplitTabPairs';
const ALLOWED_SPLIT_HOSTS = [
  'tramites.renaper.gob.ar',
  'drive.google.com',
  'docs.google.com',
  'accounts.google.com',
  'mutual-modelo.github.io',
  'prestamos-v504.gya.com.ar',
  'servicios.entrerios.gov.ar',
  'entrerios.gov.ar',
  'localhost',
  '127.0.0.1'
];

function esUrlSplitPermitida(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_SPLIT_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch (_e) {
    return false;
  }
}

async function getTabPairs() {
  try {
    const data = await chrome.storage.session.get(SESSION_KEY);
    return (data && data[SESSION_KEY]) || {};
  } catch (_e) {
    return {};
  }
}

async function saveTabPairs(pairs) {
  try {
    await chrome.storage.session.set({ [SESSION_KEY]: pairs });
  } catch (_e) {}
}

async function abrirEnSplitView(senderTab, payload, targetUrl) {
  const openerTabId = senderTab && senderTab.id;
  if (!openerTabId) {
    throw new Error('No se pudo identificar la pestaña de Simulador-Office.');
  }
  const destUrl = String(targetUrl || (payload && payload.url) || RENAPER_URL).trim();
  if (!/^https?:\/\//i.test(destUrl) || !esUrlSplitPermitida(destUrl)) {
    throw new Error('Dominio no autorizado para abrir desde la extensión AMMER.');
  }

  if (destUrl.includes('tramites.renaper.gob.ar')) {
    await chrome.storage.local.set({
      ammerPendingRenaper: {
        ...(payload || {}),
        openerTabId,
        ts: Date.now(),
      },
    });
  }

  const pairs = await getTabPairs();
  const prevRenaperId = pairs[String(openerTabId)];
  if (prevRenaperId) {
    try {
      const existing = await chrome.tabs.get(prevRenaperId);
      if (existing && existing.id) {
        await chrome.tabs.update(existing.id, { url: destUrl, active: true });
        return { ok: true, tabId: existing.id, splitUsed: Boolean(existing.splitViewId && existing.splitViewId > 0), reused: true };
      }
    } catch (_e) {
      delete pairs[String(openerTabId)];
    }
  }

  let newTab = null;
  let splitUsed = false;

  // Chrome 155+: intentar abrir directamente en Split View nativo a la derecha
  try {
    newTab = await chrome.tabs.create({
      url: destUrl,
      splitWithTabId: openerTabId,
      index: (senderTab.index || 0) + 1,
      active: true,
    });
    splitUsed = true;
  } catch (_errSplitCreate) {
    // Fallback: crear pestaña adyacente y probar chrome.tabs.createSplit si existe
    newTab = await chrome.tabs.create({
      url: destUrl,
      index: (senderTab.index || 0) + 1,
      active: true,
    });
    if (chrome.tabs && typeof chrome.tabs.createSplit === 'function') {
      try {
        await chrome.tabs.createSplit([openerTabId, newTab.id]);
        splitUsed = true;
      } catch (_errPair) {
        splitUsed = false;
      }
    }
  }

  if (newTab && newTab.id) {
    pairs[String(openerTabId)] = newTab.id;
    await saveTabPairs(pairs);
  }

  return {
    ok: true,
    tabId: newTab ? newTab.id : null,
    splitUsed,
    reused: false,
  };
}

async function cerrarRenaperTab(targetTabId, senderTab) {
  const pairs = await getTabPairs();
  let renaperTabId = targetTabId || null;
  let openerTabId = null;

  if (!renaperTabId && senderTab && senderTab.id) {
    // Si viene desde Simulador-Office, buscar su pareja abierta
    const mapped = pairs[String(senderTab.id)];
    if (mapped) {
      renaperTabId = mapped;
      openerTabId = senderTab.id;
    } else {
      // Si viene desde la propia pestaña RENAPER
      renaperTabId = senderTab.id;
    }
  }

  for (const [opId, rId] of Object.entries(pairs)) {
    if (Number(rId) === Number(renaperTabId)) {
      openerTabId = Number(opId);
      delete pairs[opId];
    }
  }
  await saveTabPairs(pairs);

  if (renaperTabId) {
    try {
      await chrome.tabs.remove(Number(renaperTabId));
    } catch (_e) {}
  }
  if (openerTabId) {
    try {
      await chrome.tabs.update(openerTabId, { active: true });
      await chrome.tabs.sendMessage(openerTabId, { action: 'RENAPER_TAB_CLOSED', tabId: renaperTabId });
    } catch (_e) {}
  }
  return { ok: true, closedTabId: renaperTabId };
}

chrome.tabs.onRemoved.addListener(async (closedId) => {
  const pairs = await getTabPairs();
  let changed = false;
  for (const [opId, rId] of Object.entries(pairs)) {
    if (Number(rId) === Number(closedId)) {
      delete pairs[opId];
      changed = true;
      try {
        await chrome.tabs.sendMessage(Number(opId), { action: 'RENAPER_TAB_CLOSED', tabId: closedId });
      } catch (_e) {}
    }
  }
  if (changed) {
    await saveTabPairs(pairs);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  if (msg.action === 'OPEN_RENAPER_SPLIT' || msg.action === 'OPEN_SPLIT_URL') {
    abrirEnSplitView(sender.tab, msg.payload, msg.url)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }));
    return true;
  }

  if (msg.action === 'CLOSE_RENAPER_SPLIT' || msg.action === 'CLOSE_SPLIT_URL') {
    cerrarRenaperTab(msg.tabId || null, sender.tab)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }));
    return true;
  }

  if (msg.action === 'CLOSE_SELF_TAB') {
    cerrarRenaperTab(sender && sender.tab ? sender.tab.id : null, sender.tab)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }));
    return true;
  }

  return false;
});
