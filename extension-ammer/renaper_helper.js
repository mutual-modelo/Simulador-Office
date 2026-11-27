(function () {
  'use strict';

  const MAX_AGE_MS = 5 * 60 * 1000;

  function setNativeValue(el, val) {
    if (!el) return;
    const proto = el.tagName === 'SELECT'
      ? HTMLSelectElement.prototype
      : (el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function getFieldHint(el) {
    const parts = [
      el.id || '',
      el.name || '',
      el.placeholder || '',
      el.getAttribute('aria-label') || '',
    ];
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent || '');
    }
    const parentLbl = el.closest('label, .form-group, .field, div');
    if (parentLbl) parts.push((parentLbl.textContent || '').slice(0, 120));
    return parts.join(' ').toLowerCase();
  }

  function formatIsoDate(ddmmyyyy) {
    const m = String(ddmmyyyy || '').match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function hayCaptchaActivo() {
    return Boolean(
      document.querySelector(
        'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .cf-turnstile, [id*="captcha" i], [class*="captcha" i]'
      )
    );
  }

  function clickConsultarRenaper() {
    const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    const btn = btns.find((el) => {
      if (el.disabled) return false;
      const txt = String(el.textContent || el.value || '').trim().toLowerCase();
      return /consultar/.test(txt);
    }) || document.querySelector('form button[type="submit"], form input[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
  }

  function autocompletarFormulario(data, autoConsultar) {
    if (!data) return false;
    const dni = String(data.dni || '').replace(/\D/g, '');
    const sexoRaw = String(data.sexo || '').toLowerCase();
    const fechaDdMm = String(data.fecha_nacimiento || '').trim();
    const fechaIso = formatIsoDate(fechaDdMm);

    let filledDni = false;
    let filledFecha = false;
    let filledSexo = false;

    // 1) DNI
    if (dni) {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'));
      const dniInp = inputs.find((el) => /\bdni\b|documento|nro.*doc/.test(getFieldHint(el)) && !/tramite|ejemplar|fecha|nac/.test(getFieldHint(el)));
      if (dniInp) {
        setNativeValue(dniInp, dni);
        filledDni = Boolean(String(dniInp.value || '').trim());
      }
    }

    // 2) Fecha de nacimiento
    if (fechaDdMm) {
      const dateInputs = Array.from(document.querySelectorAll('input[type="date"], input[type="text"], input:not([type])'));
      const nacInp = dateInputs.find((el) => /fecha|nac|birth/.test(getFieldHint(el)));
      if (nacInp) {
        const val = nacInp.type === 'date' && fechaIso ? fechaIso : fechaDdMm;
        setNativeValue(nacInp, val);
        filledFecha = Boolean(String(nacInp.value || '').trim());
      }
    }

    // 3) Sexo / Género
    if (sexoRaw) {
      const wantM = sexoRaw.startsWith('m');
      const wantF = sexoRaw.startsWith('f');
      const wantX = sexoRaw.includes('bin') || sexoRaw === 'x';

      const selects = Array.from(document.querySelectorAll('select'));
      const sexoSel = selects.find((el) => /sexo|g[eé]nero|gender/.test(getFieldHint(el)));
      if (sexoSel) {
        const opt = Array.from(sexoSel.options).find((o) => {
          const t = `${o.value} ${o.textContent}`.toLowerCase();
          if (wantM) return /\bm\b|masc/.test(t);
          if (wantF) return /\bf\b|fem/.test(t);
          if (wantX) return /\bx\b|bin/.test(t);
          return false;
        });
        if (opt) {
          setNativeValue(sexoSel, opt.value);
          filledSexo = Boolean(sexoSel.value);
        }
      } else {
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const matchRadio = radios.find((r) => {
          const t = getFieldHint(r) + ' ' + String(r.value || '').toLowerCase();
          if (wantM) return /\bm\b|masc/.test(t);
          if (wantF) return /\bf\b|fem/.test(t);
          if (wantX) return /\bx\b|bin/.test(t);
          return false;
        });
        if (matchRadio) {
          matchRadio.click();
          filledSexo = Boolean(matchRadio.checked);
        }
      }
    }

    const todosCompletos = filledDni && filledFecha && filledSexo;
    if (autoConsultar && todosCompletos && !hayCaptchaActivo()) {
      const yaResultado = /el ejemplar vigente para el documento/i.test((document.body && document.body.innerText) || '');
      const firmaEnvio = `${dni}|${sexoRaw}|${fechaDdMm}|${data.ts || ''}`;
      let yaEnviado = false;
      try { yaEnviado = sessionStorage.getItem('ammerRenaperAutoSent') === firmaEnvio; } catch (_e) {}
      if (!yaResultado && !yaEnviado) {
        try { sessionStorage.setItem('ammerRenaperAutoSent', firmaEnvio); } catch (_e) {}
        setTimeout(() => clickConsultarRenaper(), 250);
      }
    }

    return filledDni || filledFecha || filledSexo;
  }

  function renderBarraFlotante(data) {
    if (document.getElementById('ammer-renaper-split-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'ammer-renaper-split-bar';
    bar.style.cssText = 'position:fixed;top:10px;right:12px;z-index:2147483647;background:#0f2744;color:#ffffff;border:2px solid #38bdf8;border-radius:12px;padding:8px 12px;box-shadow:0 12px 28px rgba(15,23,42,0.35);font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:94vw;';

    const dniTxt = data && data.query
      ? String(data.query).slice(0, 32)
      : (data && data.dni ? `DNI ${data.dni}` : 'RENAPER');
    const nomTxt = data && data.nombre ? String(data.nombre).slice(0, 26) : 'Consulta AMMER';

    bar.innerHTML = `
      <div style="font-size:12px;line-height:1.25;">
        <div style="font-weight:800;color:#e0f2fe;">🪪 AMMER · ${nomTxt}</div>
        <div style="font-size:11px;color:#bae6fd;">${dniTxt}${data && data.sexo ? ' · ' + data.sexo : ''}${data && data.fecha_nacimiento ? ' · ' + data.fecha_nacimiento : ''}</div>
      </div>
      <button type="button" id="ammerBtnReAutocompletar" style="padding:5px 9px;border-radius:7px;border:1px solid #38bdf8;background:#0284c7;color:#ffffff;font-size:11px;font-weight:700;cursor:pointer;">✨ Completar y Consultar</button>
      <button type="button" id="ammerBtnCerrarSplitRenaper" style="padding:5px 10px;border-radius:7px;border:1px solid #fca5a5;background:#dc2626;color:#ffffff;font-size:11px;font-weight:800;cursor:pointer;">✕ Cerrar y volver</button>
    `;

    document.body.appendChild(bar);

    const btnAuto = document.getElementById('ammerBtnReAutocompletar');
    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        try { sessionStorage.removeItem('ammerRenaperAutoSent'); } catch (_e) {}
        const ok = autocompletarFormulario(data, true);
        btnAuto.textContent = ok ? '✓ Consultado' : '⚠️ Completar manual';
        setTimeout(() => { btnAuto.textContent = '✨ Completar y Consultar'; }, 2000);
      });
    }

    const btnClose = document.getElementById('ammerBtnCerrarSplitRenaper');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'CLOSE_SELF_TAB' });
      });
    }
  }

  function autocompletarDatuar(data) {
    const query = String((data && (data.query || data.dni || data.nombre)) || '').trim();
    if (!query) return false;
    const inputs = Array.from(
      document.querySelectorAll('input[type="search"], input[type="text"], input:not([type]), input[type="number"]')
    ).filter((el) => {
      if (el.disabled || el.readOnly) return false;
      const hint = getFieldHint(el);
      if (/cf-|turnstile|captcha|token|email|correo/.test(hint)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 60 && rect.height > 18;
    });
    const target = inputs.find((el) => /dni|cuil|nombre|buscar|person|search/.test(getFieldHint(el))) || inputs[0];
    if (!target) return false;
    target.focus();
    setNativeValue(target, query);
    const searchBtn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((b) =>
      /buscar|consultar/i.test(String(b.textContent || b.value || ''))
    );
    if (searchBtn) {
      searchBtn.style.outline = '2px solid #0284c7';
      searchBtn.style.outlineOffset = '2px';
    }
    return true;
  }

  const host = String(window.location.hostname || '');
  const isDrive = /drive\.google\.com/i.test(host);
  const isDatuar = /(^|\.)datuar\.com$/i.test(host);
  if (isDrive) {
    chrome.storage.local.get('ammerPendingUrlSplit', (res) => {
      const data = res && res.ammerPendingUrlSplit;
      if (!data || !data.ts || (Date.now() - Number(data.ts)) > MAX_AGE_MS) return;
      renderBarraFlotante({ nombre: 'Google Drive (3en1)', dni: 'Split View AMMER' });
      const btnAuto = document.getElementById('ammerBtnReAutocompletar');
      if (btnAuto) btnAuto.style.display = 'none';
    });
  } else if (isDatuar) {
    chrome.storage.local.get('ammerPendingDatuarSplit', (res) => {
      const data = res && res.ammerPendingDatuarSplit;
      if (!data || !data.ts || (Date.now() - Number(data.ts)) > MAX_AGE_MS) return;
      renderBarraFlotante({ nombre: 'Datuar', query: data.query || data.dni || data.nombre || '' });
      const btnAuto = document.getElementById('ammerBtnReAutocompletar');
      if (btnAuto) {
        btnAuto.textContent = '✨ Completar dato';
        const clone = btnAuto.cloneNode(true);
        btnAuto.parentNode.replaceChild(clone, btnAuto);
        clone.addEventListener('click', () => {
          const ok = autocompletarDatuar(data);
          clone.textContent = ok ? '✓ Completado' : '⚠️ Pegar con Ctrl+V';
          setTimeout(() => { clone.textContent = '✨ Completar dato'; }, 2000);
        });
      }
      setTimeout(() => autocompletarDatuar(data), 450);
      setTimeout(() => autocompletarDatuar(data), 1400);
    });
  } else {
    chrome.storage.local.get('ammerPendingRenaper', (res) => {
      const data = res && res.ammerPendingRenaper;
      if (!data || !data.ts || (Date.now() - Number(data.ts)) > MAX_AGE_MS) return;

      renderBarraFlotante(data);
      setTimeout(() => autocompletarFormulario(data, false), 350);
      setTimeout(() => autocompletarFormulario(data, true), 1100);
    });
  }
})();
