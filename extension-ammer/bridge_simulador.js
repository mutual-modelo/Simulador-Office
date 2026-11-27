(function () {
  'use strict';

  const EXT_VERSION = '2.5.1';

  function marcarDisponible() {
    if (document.documentElement) {
      document.documentElement.dataset.ammerSplitExt = EXT_VERSION;
    }
    try {
      window.dispatchEvent(new CustomEvent('ammer-split-ext-ready', { detail: { version: EXT_VERSION } }));
    } catch (_e) {}
  }

  function sincronizarAuthExtension() {
    try {
      const tok = sessionStorage.getItem('ammer_session_token') || localStorage.getItem('ammer_session_token') || localStorage.getItem('AMMER_SESSION_TOKEN') || '';
      const rawSess = sessionStorage.getItem('session') || localStorage.getItem('session') || '{}';
      let usr = '';
      try {
        const s = JSON.parse(rawSess);
        usr = (s && (s.usuario || s.username || s.email || s.nombre)) || '';
      } catch (_e) {}
      if (tok) {
        chrome.runtime.sendMessage({
          accion: 'SYNC_AUTH_CONTEXT',
          authToken: tok,
          usuario: usr,
          apiBase: 'https://ammer-auditor-api.onrender.com',
        });
      }
    } catch (_e) {}
  }

  marcarDisponible();
  sincronizarAuthExtension();
  setInterval(sincronizarAuthExtension, 8000);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      marcarDisponible();
      sincronizarAuthExtension();
    }, { once: true });
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || typeof ev.data !== 'object') return;
    const t = ev.data.type;
    if (t === 'AMMER_PING_EXT') {
      marcarDisponible();
      window.postMessage({ type: 'AMMER_PONG_EXT', version: EXT_VERSION }, window.location.origin);
      return;
    }

    if (t === 'AMMER_OPEN_RENAPER_SPLIT' || t === 'AMMER_OPEN_SPLIT_URL') {
      chrome.runtime.sendMessage(
        {
          action: t === 'AMMER_OPEN_SPLIT_URL' ? 'OPEN_SPLIT_URL' : 'OPEN_RENAPER_SPLIT',
          url: ev.data.url || null,
          payload: ev.data.payload || {},
        },
        (resp) => {
          const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
          window.postMessage(
            {
              type: 'AMMER_RENAPER_OPENED',
              requestId: ev.data.requestId || null,
              ...(resp || { ok: false, error: err || 'Sin respuesta de extensión' }),
            },
            window.location.origin
          );
        }
      );
      return;
    }

    if (t === 'AMMER_CLOSE_RENAPER_SPLIT' || t === 'AMMER_CLOSE_SPLIT_URL') {
      chrome.runtime.sendMessage(
        { action: 'CLOSE_RENAPER_SPLIT', tabId: ev.data.tabId || null },
        (resp) => {
          window.postMessage(
            {
              type: 'AMMER_RENAPER_CLOSED',
              ...(resp || { ok: true }),
            },
            window.location.origin
          );
        }
      );
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'RENAPER_TAB_CLOSED') {
      window.postMessage({ type: 'AMMER_RENAPER_CLOSED', tabId: msg.tabId || null }, window.location.origin);
    }
  });
})();
