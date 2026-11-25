    /* ========================================================================
       10. MÓDULO DE AUDITORÍA DOCUMENTAL INTELIGENTE (OCR, SCORING & DUE DILIGENCE)
       ======================================================================== */
    let archivosAuditoriaCola = [];
    let ultimoResultadoAuditoria = null;
    let idExpedienteAuditadoActivo = null;
    let _auditRegimenOverride = null;
    let _auditCuotaFutura2 = 0;
    let _auditCuotaRefinanciar = 0;
    let _auditSaldoCancelar = 0;
    let _auditSaldoVigenteExterno = 0;
    let _auditDetalleRefinanciacion = '';
    let _auditFactorMargen = 1.0;
    let _auditCuotaPersonalizada = 0;
    function esAdminAuditoria() {
      try {
        const sess = (typeof getSession === 'function') ? getSession() : null;
        return Boolean(sess && String(sess.rol || '').toLowerCase().includes('admin'));
      } catch (e) { return false; }
    }

    function resetearParametrosRefinanciacionAuditoria() {
      _auditCuotaRefinanciar = 0;
      _auditSaldoCancelar = 0;
      _auditSaldoVigenteExterno = 0;
      _auditDetalleRefinanciacion = '';
      _auditFactorMargen = 1.0;
      _auditCuotaPersonalizada = 0;
    }

    /* --- MOTOR DE AUDITORÍA DOCUMENTAL FORENSE AMMER (CERO ALUCINACIÓN) --- */
    const TEXTO_ILEGIBLE_AMMER = 'No especificado';

    function parseNumeroSeguroAuditoria(val) {
      if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
      if (typeof val === 'number') {
        return Number.isFinite(val) ? Math.round(val * 100) / 100 : null;
      }
      let s = String(val).replace(/[^0-9.,-]/g, '').trim();
      if (!s || s === '-' || s === '.' || s === ',') return null;
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma !== -1 && lastDot !== -1) {
        if (lastComma > lastDot) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (lastComma !== -1) {
        s = s.replace(',', '.');
      } else if ((s.match(/\./g) || []).length > 1) {
        s = s.replace(/\./g, '');
      }
      const num = parseFloat(s);
      return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
    }

    function limpiarMonto(val) {
      const parsed = parseNumeroSeguroAuditoria(val);
      return parsed === null ? 0 : parsed;
    }

    function limpiarTextoAuditoria(val, fallback = 'No especificado') {
      if (val === null || val === undefined) return fallback;
      const str = String(val).trim();
      if (!str) return fallback;
      const up = str.toUpperCase();
      if (
        up.includes('ILEGIBLE') ||
        up.includes('REQUIERE RESUBIR') ||
        up === 'TITULAR DETECTADO EN DOCUMENTO' ||
        up === 'NO CONSTA EN COMPROBANTE' ||
        up === 'PERÍODO LIQUIDADO' ||
        up === 'ORGANISMO PÚBLICO'
      ) {
        return fallback;
      }
      return str;
    }

    function formatMontoAuditoriaExacto(val) {
      const n = parseNumeroSeguroAuditoria(val);
      if (n === null) {
        return '$0,00';
      }
      return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatMontoSinSimboloAr(val) {
      const n = parseNumeroSeguroAuditoria(val);
      const safe = n === null ? 0 : n;
      return safe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPesosMargen(val) {
      const n = parseNumeroSeguroAuditoria(val);
      const safe = n === null ? 0 : n;
      if (safe < 0) {
        return '-$ ' + formatMontoSinSimboloAr(Math.abs(safe));
      }
      return '$ ' + formatMontoSinSimboloAr(safe);
    }

    function renderBadgeClasificacionPadron(clasif, metodo, lugarMatch) {
      const c = String(clasif || '').trim().toUpperCase();
      let css = 'clasif-sin-clasif';
      let label = 'SIN CLASIF.';
      if (c === 'SUBTOTAL_1') {
        css = 'clasif-subtotal1';
        label = 'SUBTOTAL_1';
      } else if (c === 'NO_COMPUTABLE') {
        css = 'clasif-no-computable';
        label = 'NO COMPUTABLE';
      } else if (c === 'AFECTADO') {
        css = 'clasif-afectado';
        label = 'AFECTADO';
      } else if (c === 'COMPUTABLE') {
        css = 'clasif-computable';
        label = 'COMPUTABLE';
      }
      const metaParts = [];
      if (lugarMatch) metaParts.push('Padrón ' + String(lugarMatch));
      if (metodo) metaParts.push(String(metodo).replace(/_/g, ' '));
      const titleAttr = metaParts.length > 0 ? (' title="' + sanitizeHTML(metaParts.join(' · ')) + '"') : '';
      return '<span class="ai-clasif-badge ' + css + '"' + titleAttr + '>' + label + '</span>';
    }

    function repararJSONTruncadoAuditoria(input) {
      const start = String(input || '').indexOf('{');
      if (start === -1) return null;
      const s = String(input).substring(start).trim();
      const stack = [];
      let inString = false;
      let escaped = false;
      let lastSafePos = -1;

      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
            lastSafePos = i;
          }
        }
      }
      if (stack.length === 0 && !inString) return s;
      if (lastSafePos > 0) {
        const cut = s.substring(0, lastSafePos + 1).replace(/,\s*$/, '');
        const remStack = [];
        let strMode = false;
        let escMode = false;
        for (let j = 0; j < cut.length; j++) {
          const c = cut[j];
          if (strMode) {
            if (escMode) escMode = false;
            else if (c === '\\') escMode = true;
            else if (c === '"') strMode = false;
            continue;
          }
          if (c === '"') strMode = true;
          else if (c === '{') remStack.push('}');
          else if (c === '[') remStack.push(']');
          else if ((c === '}' || c === ']') && remStack[remStack.length - 1] === c) remStack.pop();
        }
        return cut + remStack.reverse().join('');
      }
      return null;
    }

    function extraerJSONResiliente(str) {
      if (!str) return null;
      if (typeof str === 'object') return str;

      // Capa 1: Limpieza de bloques markdown y parseo directo
      const limpio = String(str).replace(/```json/gi, '').replace(/```/gi, '').trim();
      try {
        return JSON.parse(limpio);
      } catch (e) {
        // Capa 2: Extracción entre primera '{' y última '}' + limpieza de comas finales y saltos
        const inicio = limpio.indexOf('{');
        const fin = limpio.lastIndexOf('}');
        if (inicio !== -1 && fin > inicio) {
          const candidato = limpio.substring(inicio, fin + 1).replace(/,\s*([}\]])/g, '$1');
          try {
            return JSON.parse(candidato);
          } catch (e2) {
            try {
              return JSON.parse(candidato.replace(/[\r\n\t]/g, ' '));
            } catch (e2b) {
              console.warn('Intento de parseo secundario JSON falló, probando reparación estructural...');
            }
          }
        }

        // Capa 3: Reparación automática de corchetes/llaves truncados en grillas extensas
        const reparado = repararJSONTruncadoAuditoria(limpio);
        if (reparado) {
          try {
            return JSON.parse(reparado.replace(/,\s*([}\]])/g, '$1'));
          } catch (e3) {
            console.error('Fallo parseo secundario/terciario JSON:', limpio.substring(0, 300));
          }
        } else {
          console.error('Fallo parseo JSON:', limpio.substring(0, 300));
        }
      }
      return null;
    }

    function limpiarYParsearJSONAuditoria(rawText) {
      return extraerJSONResiliente(rawText);
    }

    function limpiarBase64ParaAPI(raw) {
      let base64Limpio = String(raw || '');
      if (base64Limpio.includes(',')) {
        base64Limpio = base64Limpio.split(',').pop() || '';
      }
      return base64Limpio.trim();
    }

    // 1. Obtener el Base64 limpio sin el prefijo data:...;base64,
    async function obtenerBase64Limpio(file) {
      if (!file) return '';
      if (typeof file === 'string') {
        return limpiarBase64ParaAPI(file);
      }
      if (typeof file === 'object' && typeof file.fileBase64 === 'string' && file.fileBase64.trim()) {
        return limpiarBase64ParaAPI(file.fileBase64);
      }
      if (typeof file === 'object' && typeof file.base64 === 'string' && file.base64.trim()) {
        return limpiarBase64ParaAPI(file.base64);
      }
      if (typeof file === 'object' && typeof file.base64Archivo === 'string' && file.base64Archivo.trim()) {
        return limpiarBase64ParaAPI(file.base64Archivo);
      }
      if (typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || '');
            const b64 = res.includes(',') ? (res.split(',').pop() || '') : res;
            resolve(b64.trim());
          };
          reader.onerror = (e) => reject(e || new Error('No se pudo leer el archivo seleccionado con FileReader.'));
          reader.readAsDataURL(file);
        });
      }
      if (typeof file === 'object' && typeof file.arrayBuffer === 'function' && typeof btoa === 'function') {
        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }
      return '';
    }

    // Conversor nativo universal a Base64 puro (sin pdf.js ni workers externos)
    function archivoABase64Puro(file) {
      return obtenerBase64Limpio(file);
    }

    function limpiarNumero(val) {
      if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
      if (!val) return 0;
      let s = String(val).replace(/[^0-9,.-]/g, '').trim();
      if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      } else if ((s.match(/\./g) || []).length > 1) {
        s = s.replace(/\./g, '');
      }
      const n = parseFloat(s);
      return Number.isNaN(n) ? 0 : n;
    }

    async function convertirArchivoABase64(file) {
      const pure = await archivoABase64Puro(file);
      if (!pure) return '';
      const mime = (typeof file === 'object' && file && file.type)
        ? String(file.type)
        : ((typeof file === 'object' && file && String(file.name || '').toLowerCase().endsWith('.pdf')) ? 'application/pdf' : 'image/jpeg');
      return 'data:' + mime + ';base64,' + pure;
    }

    async function convertirArchivoABase64Limpio(file) {
      return archivoABase64Puro(file);
    }

    async function extraerTextoDigital() {
      return '';
    }

    async function extraerTextoDePDF() {
      return '';
    }

    async function renderizarPdfAJpegBase64() {
      return '';
    }

    // Padrón Oficial Normalizado (2076 registros): [lugar_de_trabajo, codigo, nombre, clasificacion]
    const PADRON_CODIGOS_AMMER = [["GE","188","RIESGO Y PELIGROSID","NO_COMPUTABLE"],["GE","17","ASIG, ESP.ART.03 DC","COMPUTABLE"],["GE","264","ADICIONAL U. PRODUCTIVIDAD VARIABLE RES 591/21","COMPUTABLE"],["GE_","661_D","#NAME?","SUBTOTAL_1"],["GE_","606","A. SOLIDARIO ART 92 LEY 9755/07","SUBTOTAL_1"],["GE_","699","REDONDEO EN MENOS (-)","SUBTOTAL_1"],["GE_","336","SUTSER","SUBTOTAL_1"],["GE_","406","R. S/COD.342","SUBTOTAL_1"],["GE_","378","Aportes SEOSPER","SUBTOTAL_1"],["GE_","332","APORTE SIND.AGMER","SUBTOTAL_1"],["GE_","650","O.S.VARIAS","SUBTOTAL_1"],["GE_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["GE_","326","SIND.ASOC.MAG.Y F.JU","SUBTOTAL_1"],["GE_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["GE_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["GE_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["GE_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["GE_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["GE_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["GE_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["GE_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["GE_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONAL LIBERTAD","SUBTOTAL_1"],["GE_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["GE_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["GE_","502","APORTE JUB. PERSONALSONALN","SUBTOTAL_1"],["GE_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["GE_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["GE_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["GE_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["GE_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["GE_","327","SEG.SEP.P/ADH. LAPS","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISERAER LIBERTAD","SUBTOTAL_1"],["GE_","510","SEGURO DE VIDA SISERGraord","SUBTOTAL_1"],["GE_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["GE_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["GE_","524","NUEVO SEG.VIDA IAPSRAL CON","SUBTOTAL_1"],["GE_","532","ADHERENTE SEC.IOSPERSAL.FLIAR HIJO","SUBTOTAL_1"],["GE_","507","CALIDAD DE VIDA","SUBTOTAL_1"],["GE_","507","APORTE PERS. IVAOS","SUBTOTAL_1"],["GE_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["GE_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["GE_","358","S.E.P.E.R.","SUBTOTAL_1"],["GE_","325","SIND.ASOC.JUD.ARGEN.","SUBTOTAL_1"],["GE_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["GE_","365","ADHERENTE I.V.A.O.S.","SUBTOTAL_1"],["GE_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["GE_","370","APORTE SIND. UEJN","SUBTOTAL_1"],["GE_","342","REAJ P/MIN.AP IOSPER","SUBTOTAL_1"],["GE_","285","PLUS D.G.R. REM. NO","NO_COMPUTABLE"],["GE_","113","BONIF. PERMANENCIA E","NO_COMPUTABLE"],["GE_","264","ADIC REM DCTO 4780","NO_COMPUTABLE"],["GE_","38","NUEVO ADIC. HS. CAT.","NO_COMPUTABLE"],["GE_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["GE_","563","ADHER. IOSPER RES.","NO_COMPUTABLE"],["GE_","202","ARANC.IAPV CERT.OBRA","NO_COMPUTABLE"],["GE_","203","COMPENS.IAPV C.ADJUD","NO_COMPUTABLE"],["GE_","282","MAYOR DEDICACION","NO_COMPUTABLE"],["GE_","186_R","S.A.C.S/CODIG.NO RE","NO_COMPUTABLE"],["GE_","219","ADIC. INFORMATICA","NO_COMPUTABLE"],["GE_","19","ADICIONAL S.C.D.","NO_COMPUTABLE"],["GE_","58","ADICIONAL DCRTO. 14","NO_COMPUTABLE"],["GE_","3","GASTOS DE REPRESENT","NO_COMPUTABLE"],["GE_","29","TRASLADO POR KM","NO_COMPUTABLE"],["GE_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["GE_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["GE_","76","DESARRAIGO","NO_COMPUTABLE"],["GE_","1014","PRENATAL","NO_COMPUTABLE"],["GE_","246","INCREM ADIC CAJA JUB","NO_COMPUTABLE"],["GE_","1024_R","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["GE_","1025_R","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["GE_","72","SUBROGANCIA VIALIDAD","NO_COMPUTABLE"],["GE_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["GE_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["GE_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["GE_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["GE_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["GE_","1025_R","AYUDA ESC.MEDIA, SUP.","NO_COMPUTABLE"],["GE_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["GE_","120","BONIF.PERM.EN OBRA","NO_COMPUTABLE"],["GE_","68","PRESENTISMO","NO_COMPUTABLE"],["GE_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["GE_","146","ADICIONAL ESP.CAJA","NO_COMPUTABLE"],["GE_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["GE_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["GE_","50_R","BONIF. POR TITULO","NO_COMPUTABLE"],["GE_","13","HORAS EXTRAS","NO_COMPUTABLE"],["GE_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["GE_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["GE_","30_R","HABERES REM","NO_COMPUTABLE"],["GE_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["GE_","264","RECON DE GASTOS XN","NO_COMPUTABLE"],["GE_","102","Suma Fija No Remunerativa - Paritaria","NO_COMPUTABLE"],["GE_","408","Reajuste sobre haberes no remunerativo","NO_COMPUTABLE"],["GE_","13_R","HORAS EXTRAS","NO_COMPUTABLE"],["GE_","312_D","IMP.A LAS GANANCIAS","NO_COMPUTABLE"],["GE_","1028","AYUDA ESC.SEC.DIF","NO_COMPUTABLE"],["GE_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["GE_","1027","AYUDA ESC.PRI.DIF","NO_COMPUTABLE"],["GE_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["GE_","1001_R","SAL.FLIAR HIJO","NO_COMPUTABLE"],["GE_","133","ADICIONAL REM.NO BON","NO_COMPUTABLE"],["GE_","212","ADICIONAL DECRETO 7","NO_COMPUTABLE"],["GE_","599","COMPLEMENTO PARA REDONDEO EN \"-\"","NO_COMPUTABLE"],["GE_","34_R","HABERES NO REM","NO_COMPUTABLE"],["GE_","110","ANTIGÃœEDAD COD 25","NO_COMPUTABLE"],["GE_","122","DISTRIBUCION SOBRANTE CAJA RES.1039/17 DIR.IAFAS","NO_COMPUTABLE"],["GE_","251","REDISTRIB. INASIST AD. IAFAS RES 730/21","NO_COMPUTABLE"],["GE_","1010","SALARIO POR ESPOSA","NO_COMPUTABLE"],["GE_","247","REAJUSTE COD. 248 Y 246","NO_COMPUTABLE"],["GE_","105","DEDIC.INTENSIVA","NO_COMPUTABLE"],["GE_","34","AJUSTE CÃ“D.35 REFRIGERIO","NO_COMPUTABLE"],["GE_","1003","FAMILIA NUMEROSA","NO_COMPUTABLE"],["GE_","87","MONTO FIJO NO REMUNERATIVO","NO_COMPUTABLE"],["GE_","92","FALLA DE CAJA","NO_COMPUTABLE"],["GE_","1001_A","SAL.FLIAR HIJO","AFECTADO"],["GE_","576","DIAS DE PARO NO REM","AFECTADO"],["GE_","1014_A","PRENATAL","AFECTADO"],["GE_","575","DESC. DIAS DE PARO","AFECTADO"],["GE_","317_A","AJUSTE F. VOLUNTARIO","AFECTADO"],["GE_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["GE_","412_A","AJUSTE COD 412","AFECTADO"],["GE_","1025_A","AYUDA ESC.MEDIA,SUP.","AFECTADO"],["GE_","503","DESC. DIAS NT NO RE","AFECTADO"],["GE_","68_A","PRESENTISMO","AFECTADO"],["GE_","243_A","ADIC.SERV.ADM.CONT","AFECTADO"],["GE_","118_A","PRESE DCTO 5315","AFECTADO"],["GE_","369","Descuentos Varios FEDEM","AFECTADO"],["GE_","480","DCTO N.BERSA DEC.","AFECTADO"],["GE_","480","DCTO, N.BERSA DEC","AFECTADO"],["GE_","339","CREDITO MUPER","AFECTADO"],["GE_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["GE_","368","CONSUMOS F.E.D.E RON","AFECTADO"],["GE_","480","DCTO. N.BERSA DEC.","AFECTADO"],["GE_","480","DCTO. N.BERSA DEC.NO.","AFECTADO"],["GE_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["GE_","595","DIV TESORERIA","AFECTADO"],["GE_","595","DIV. TESORERIA","AFECTADO"],["GE_","366","F.E.D.E.M.","AFECTADO"],["GE_","412","SI.DE CREER","AFECTADO"],["GE_","412","SI.DE.CREER","AFECTADO"],["GE_","412","SIDE CREER","AFECTADO"],["GE_","412","SIDE.CREER","AFECTADO"],["GE_","412","SILDE CREER","AFECTADO"],["GE_","491","PROVEEDURIA MUPER","AFECTADO"],["GE_","1023_A","AYUDA ESC.PREESCOLAR","AFECTADO"],["GE_","1100_A","PAGO UNICO AYUDA ESC","AFECTADO"],["GE_","188_A","PLUS PRODUCTIVIDAD","AFECTADO"],["GE_","68_A","PRESENTISMO","AFECTADO"],["GE_","500","DESC. DIAS NT REM.","AFECTADO"],["GE_","477","CRED.ASIST.IOSPER","AFECTADO"],["GE_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["GE_","302_A","AJUSTE CUOTA ALIM.","AFECTADO"],["GE_","316_A","AJUSTE CUOTA ALIM.","AFECTADO"],["GE_","312","IMP A LAS GANANCIAS","AFECTADO"],["GE_","370_A","APORTE SIND. UEJN","AFECTADO"],["GE_","181_A","RIESGO Y PELIGROSID","AFECTADO"],["GE_","347","DESCUENTO ORDEN JUDI","AFECTADO"],["GE_","1028_A","AYUDA ESC.SEC.DIF.","AFECTADO"],["GE_","136","Adicional OSER Bonif. 100% (134) - Ant.","COMPUTABLE"],["GE_","105_A","DEDIC.INTENSIVA","COMPUTABLE"],["GE_","1","ASIGNAC.DE LA CATEG","COMPUTABLE"],["GE_","643","O.S.P.J.B.O.N.","COMPUTABLE"],["GE_","20","ADIC DCTO 2933/22","COMPUTABLE"],["GE_","74","BONIFICADOR PAGADOR","COMPUTABLE"],["GE_","233","ADIC.ESP.SEC. DE CUL","COMPUTABLE"],["GE_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["GE_","260","DCTO 634/23 ART 56","COMPUTABLE"],["GE_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["GE_","7018","COMP. MAYOR HORARIO","COMPUTABLE"],["GE_","7192","ADICIONAL ESP. DCTO","COMPUTABLE"],["GE_","242","ADIC DCTO 4071","COMPUTABLE"],["GE_","178","ADIC.D.747/11-COPNAF","COMPUTABLE"],["GE_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["GE_","25","PTO4 AC.PAR.06-03-25","COMPUTABLE"],["GE_","18","ADICIONAL REM.","COMPUTABLE"],["GE_","226","ADIC.RIESGO.PROF.S.M","COMPUTABLE"],["GE_","228","ADIC.DED.EXC.SALUD M","COMPUTABLE"],["GE_","96","JERARQUIA OPERATIVA S/RESOL. 284/15 Y 591/21.","COMPUTABLE"],["GE_","232","ADIC.ESP.CONSEJO DE","COMPUTABLE"],["GE_","59","BONIFICACION POR TITULO - C.BASICO","COMPUTABLE"],["GE_","248","BONIFICACION ESPECIAL IAFAS RES NÂ° 591/21","COMPUTABLE"],["GE_","265","ADICIONAL U. PRODUCTIVIDAD FIJA RES 591/21","COMPUTABLE"],["GE_","298","REDONDEO EN MAS ( )","COMPUTABLE"],["GE_","444","AMEIAFAS","COMPUTABLE"],["GE_","225","COMPL.REM.DTO 834/22","COMPUTABLE"],["GE_","134","ADICIONAL PROD. Y PRESENT.","COMPUTABLE"],["GE_","191","ADICIONAL DCTO. NÂº 5.248/08 - REM.","COMPUTABLE"],["GE_","128","AJUSTE  COD. 312","COMPUTABLE"],["GE_","57","ADICIONAL SVCA","COMPUTABLE"],["GE_","118","PRESE DCTO 5315","COMPUTABLE"],["GE_","8","ADICIONAL ESP. DCRT","COMPUTABLE"],["GE_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["GE_","60","ADIC.GOBERNACION","COMPUTABLE"],["GE_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["GE_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["GE_","288","ADIC.CONTR.OBRAS PUB","COMPUTABLE"],["GE_","4","HORAS CATEDRA","COMPUTABLE"],["GE_","184","F.O.P.I.D.","COMPUTABLE"],["GE_","204","COMP.PROV.CONECT.","COMPUTABLE"],["GE_","2","COMP. JERARQUICA","COMPUTABLE"],["GE_","1","ASIGNACION BASICA","COMPUTABLE"],["GE_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["GE_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["GE_","117","SUMA FIJA REM","COMPUTABLE"],["GE_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["GE_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["GE_","220","ADIC DCTO 2941/23","COMPUTABLE"],["GE_","221","ADIC NO REM 2941/23","COMPUTABLE"],["GE_","280","INCOMPATIBILIDAD NO","COMPUTABLE"],["GE_","36","ASIGNACION LEY 9775","COMPUTABLE"],["GE_","170","ADICIONAL DTO.CA","COMPUTABLE"],["GE_","185","NUEVO MIN","COMPUTABLE"],["GE_","2","CATEGORIA VIAL","COMPUTABLE"],["GE_","66","ADICIONAL MAYOR HOR","COMPUTABLE"],["GE_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["GE_","1","DELET","COMPUTABLE"],["GE_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["GE_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["GE_","54","ADICIONAL LEY 9897","COMPUTABLE"],["GE_","185","COMPL. REM. MINIMO","COMPUTABLE"],["GE_","170","ADICIONAL DTO.CIA","COMPUTABLE"],["GE_","11","PERMANENCIA CATEG.","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV S 2","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV,SEG","COMPUTABLE"],["GE_","181","PLUS MAYOR SERV. SEG","COMPUTABLE"],["GE_","130","PLUS MAYOR SERV.SEG","COMPUTABLE"],["GE_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["GE_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["GE_","176","RIESGO Y PELIGROSID","COMPUTABLE"],["GE_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["GE_","105","DEDIC.EXCL.C","COMPUTABLE"],["GE_","105","DEDIC.EXCL.CHOFERES","COMPUTABLE"],["GE_","50","BONIF POR TITULOA","COMPUTABLE"],["GE_","50","BONIF. POR TITULO","COMPUTABLE"],["GE_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["GE_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["GE_","41","ASIG ESP.ART.03 DC","COMPUTABLE"],["GE_","17","ASIG, ESP.ART 03 DC","COMPUTABLE"],["GE_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["GE_","41","ASIG. ESP.ART.03 DC","COMPUTABLE"],["GE_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["GE_","41","ASIG. ESPART.03 DC","COMPUTABLE"],["GE_","86","BONIF NO ASIG.DE VI","COMPUTABLE"],["GE_","50","BONIF POR TITULO","COMPUTABLE"],["GE_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["GE_","130","ADICIONAL REM,NO","COMPUTABLE"],["GE_","130","ADICIONAL REM,NO BON","COMPUTABLE"],["GE_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["GE_","17","ADICIONAL REM.NO BON","COMPUTABLE"],["GE_","176","ADICIONAL REM NO BON","COMPUTABLE"],["GE_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["GE_","130","ADICIONAL/REM,NO BO","COMPUTABLE"],["GE_","10","ANTIGUEDAD","COMPUTABLE"],["GE_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["GE_","130","ADICIONAL ESPECIAL","COMPUTABLE"],["GE_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["GE_","41","ADIC.DTO 772/04NO R","COMPUTABLE"],["GE_","41","ADIC.DTO,772/04NO R","COMPUTABLE"],["GE_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["GE_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NO RA","COMPUTABLE"],["GE_","50","ADIC.DTO.772/04NO RIABONIF. POR TITULO","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NOR","COMPUTABLE"],["GE_","130","ADIC.DTO.772/04NO R","COMPUTABLE"],["GE_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["GE_","201","ADICIONAL DTO 3509","COMPUTABLE"],["JU","1362","ADIC. $ 150 - IBICUY","COMPUTABLE"],["JU_","342","DESARR.AL 60%-VIALID","SUBTOTAL_1"],["JU_","913","CENTRO VET.GUER.CDIA","SUBTOTAL_1"],["JU_","717","SEGURO SEPELIO POLI","SUBTOTAL_1"],["JU_","993","S.E.O.S.P.E.R","SUBTOTAL_1"],["JU_","755","CUOTA SOC. A.T.E.","SUBTOTAL_1"],["JU_","749","CUOTA SOC.S.LUZ Y F.","SUBTOTAL_1"],["JU_","756","REAJUSTE COD. 755","SUBTOTAL_1"],["JU_","718","REAJUSTE COD. 717","SUBTOTAL_1"],["JU_","705","SUELDO BASICO-SEG.","SUBTOTAL_1"],["JU_","709","SISER LEY 11049","SUBTOTAL_1"],["JU_","336","SUTSER","SUBTOTAL_1"],["JU_","835","TITULO","SUBTOTAL_1"],["JU_","900","TITULO","SUBTOTAL_1"],["JU_","717","TITULO SEGURIDAD.","SUBTOTAL_1"],["JU_","112","TITULO SEGURIDAD. SEGURO SEPELIO POLIC","SUBTOTAL_1"],["JU_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["JU_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["JU_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["JU_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["JU_","330","SEGURO DE RETIRO IAPSER","SUBTOTAL_1"],["JU_","327","SEGURO DE SEPELIO ADH. IAPSER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA","SUBTOTAL_1"],["JU_","524","SEGURO DE VIDA IAPSER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISE","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["JU_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["JU_","717","SEGURO SEPELIO POLIC","SUBTOTAL_1"],["JU_","785","SEGURO VIDA I.A.P.S.","SUBTOTAL_1"],["JU_","358","SEP.E.R.","SUBTOTAL_1"],["JU_","358","SEPER","SUBTOTAL_1"],["JU_","829","SERV MUPER.","SUBTOTAL_1"],["JU_","713","SERV. SEPELIO IAPS","SUBTOTAL_1"],["JU_","824","S.O.E.V.E.R.","SUBTOTAL_1"],["JU_","988","SALARIO FAMILIAR","SUBTOTAL_1"],["JU_","703","SUELDO BASICO","SUBTOTAL_1"],["JU_","707","SUELDO BASICO","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["JU_","703","FEDERACION DE JUBIL.","SUBTOTAL_1"],["JU_","817","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["JU_","134","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","982","DTO. CASA IAPV","SUBTOTAL_1"],["JU_","817C","DTO.1107/05-771/12BBB","SUBTOTAL_1"],["JU_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["JU_","524","NUEVO SEGVIDA TAPS","SUBTOTAL_1"],["JU_","757","O.S.P.A. VIAL.","SUBTOTAL_1"],["JU_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["JU_","812","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","829","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","835","PERMANENCIA CATEG.","SUBTOTAL_1"],["JU_","812","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","829","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","835","PERMANENCIA CATEG","SUBTOTAL_1"],["JU_","510","LEY 11049","SUBTOTAL_1"],["JU_","900","REDONDEO EN MENOS","SUBTOTAL_1"],["JU_","900","REDONDEO EN MENOS.","SUBTOTAL_1"],["JU_","358","S.E.P.E.R.","SUBTOTAL_1"],["JU_","705","CIRCULO RET. POLICIA","SUBTOTAL_1"],["JU_","185","COMPE REM MINIMO","SUBTOTAL_1"],["JU_","185","COMPL REM MINIMO","SUBTOTAL_1"],["JU_","185","COMPL REM. MINIMO","SUBTOTAL_1"],["JU_","120_A","BONIF.PERM.EN OBRA","SUBTOTAL_1"],["JU_","339","C. SOCIETARIA - MUPER -","SUBTOTAL_1"],["JU_","93","ADIC.I.A.F.A.S. ESP.","SUBTOTAL_1"],["JU_","835","ADICIONAL X FUNCION","SUBTOTAL_1"],["JU_","771","ANTIGUEDAD","SUBTOTAL_1"],["JU_","785","ANTIGUEDAD","SUBTOTAL_1"],["JU_","988","ANTIGUEDAD","SUBTOTAL_1"],["JU_","707","ANTIGUEDAD-SEGURID.","SUBTOTAL_1"],["JU_","707","APORTE 1.0.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE 1.O.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE 10 SPER","SUBTOTAL_1"],["JU_","720","AP.ADHERENTES IOSPER","SUBTOTAL_1"],["JU_","102","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["JU_","302","CUOTA ALIMENT EXTRA","SUBTOTAL_1"],["JU_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["JU_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["JU_","779","CUOTA ALIMENTARIA","SUBTOTAL_1"],["JU_","111555","CUOTA SIND ADM PER","SUBTOTAL_1"],["JU_","988","CUOTA SIND ADM.P.ER.","SUBTOTAL_1"],["JU_","988","CUOTA SIND. ADM.P.ER.","SUBTOTAL_1"],["JU_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["JU_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["JU_","355","CUOTA SINDICAL S.E.D.A.P.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC M.U.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC MUPER","SUBTOTAL_1"],["JU_","755","CUOTA SOC. A.T.E","SUBTOTAL_1"],["JU_","841","CUOTA SOC.CENTRO JUB","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","118","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["JU_","592","COOTAVIVENDA JAPV","SUBTOTAL_1"],["JU_","787","CUOTA A.G.M.E.R.","SUBTOTAL_1"],["JU_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["JU_","487","DESC ESPECIAL SOEVER","SUBTOTAL_1"],["JU_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["JU_","1115","DTO 629/13 ART 3","SUBTOTAL_1"],["JU_","829","DTO. 1327/00-771/12","SUBTOTAL_1"],["JU_","812","DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["JU_","1115","DTO. 629/13 ART. 3","SUBTOTAL_1"],["JU_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["JU_","874","ADH.IOSPER MENOR A/C","SUBTOTAL_1"],["JU_","842","SERVICIOS U.D.A","SUBTOTAL_1"],["JU_","737","JERARQUICOS SALUD","SUBTOTAL_1"],["JU_","786","REAJUSTE DE COD.785","SUBTOTAL_1"],["JU_","936","A.J.E.R.-CUOTA SIND.","SUBTOTAL_1"],["JU_","937","REAJUSTE COD. 936","SUBTOTAL_1"],["JU_","31","PAGADOR-COBR.-IOSPER","SUBTOTAL_1"],["JU_","711","SERV. SOC. BANCARIOS","SUBTOTAL_1"],["JU_","794","APORTE ASOC.BANCARIA","SUBTOTAL_1"],["JU_","712","REAJUSTE COD. 711.","SUBTOTAL_1"],["JU_","795","REAJUSTE CODIGO 794.","SUBTOTAL_1"],["JU_","754","REAJUSTE COD. 753.","SUBTOTAL_1"],["JU_","747","CUOTA SOC.CIR.OF.POL","SUBTOTAL_1"],["JU_","919","APORTE DTO. 1576/24","SUBTOTAL_1"],["JU_","715","OBRA SOC.LUZ Y FUER.","SUBTOTAL_1"],["JU_","998","SERV.CIRC.RET.POLIC.","SUBTOTAL_1"],["JU_","956","SERVIC.CIRC.RET.POL.","SUBTOTAL_1"],["JU_","947","SERV. CIRC.RET.POLIC","SUBTOTAL_1"],["JU_","861","CUOTA ALIMENTO(FIJA)","SUBTOTAL_1"],["JU_","723","APORTE O.S.P.L.A.D.","SUBTOTAL_1"],["JU_","753","CUOTA SOC. U.P.C.N.","SUBTOTAL_1"],["JU_","707","APORTE O.S.E.R.","SUBTOTAL_1"],["JU_","985","IMP. INGR.PERSONALES","SUBTOTAL_1"],["JU_","721","REAJUSTE COD. 720","SUBTOTAL_1"],["JU_","780","REAJUSTE COD. 779","SUBTOTAL_1"],["JU_","792","CUOTA A.P.S.MUN.PNA.","SUBTOTAL_1"],["JU_","1116","REAJUSTE 1115","SUBTOTAL_1"],["JU_","704","REAJUSTE COD. 703.","SUBTOTAL_1"],["JU_","710","REAJUSTE COD. 709.","SUBTOTAL_1"],["JU_","704","REAJUSTE COD. 713","SUBTOTAL_1"],["JU_","719","REAJUSTE COD.707","SUBTOTAL_1"],["JU_","510","0.15% SEGURO DE VIDA SISE","SUBTOTAL_1"],["JU_","900","AD REMUNERATIVO","SUBTOTAL_1"],["JU_","988","AD REMUNERATIVO","SUBTOTAL_1"],["JU_","84111","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","900","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","988","AD.REMUNERATIVO","SUBTOTAL_1"],["JU_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["JU_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["JU_","771","/// ADICIONAL 5% SEGURID","SUBTOTAL_1"],["JU_","707","APORTE IO.S.P.E.R.","SUBTOTAL_1"],["JU_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["JU_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["JU_","502","APORTE JUBILATORIO","SUBTOTAL_1"],["JU_","707","APORTE LO.S.P.E.R.","SUBTOTAL_1"],["JU_","707","APORTE LOS.P.E.R","SUBTOTAL_1"],["JU_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["JU_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["JU_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["JU_","505","APORTE PERSOSPER","SUBTOTAL_1"],["JU_","332","APORTE SIND AGMER","SUBTOTAL_1"],["JU_","338","APORTE SIND MUPER","SUBTOTAL_1"],["JU_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["JU_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["JU_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["JU_","307","APORTE SIND. UPCN?","SUBTOTAL_1"],["JU_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["JU_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["JU_","338","APORTE SIND.MUPER?","SUBTOTAL_1"],["JU_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["JU_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["JU_","505","APORTES IOSPER","SUBTOTAL_1"],["JU_","758","REAJUSTE COD. 757.","SUBTOTAL_1"],["JU_","1522","RETRO POR JULIO/25","NO_COMPUTABLE"],["JU_","1525","A  CTA.RETROACTIVOS","NO_COMPUTABLE"],["JU_","555","HABER PROVISORIO","NO_COMPUTABLE"],["JU_","658","DEV.FEDERACION JUB","NO_COMPUTABLE"],["JU_","660","DEV. IOSPER","NO_COMPUTABLE"],["JU_","662","DEV.SERV SEPEL.IAPS","NO_COMPUTABLE"],["JU_","122","INCOMPATIBILIDAD PAR","NO_COMPUTABLE"],["JU_","1523","RETRO POR FEBRERO/26","NO_COMPUTABLE"],["JU_","552","SALARIO FAMILIAR","NO_COMPUTABLE"],["JU_","714","REAJUSTE COD.713","NO_COMPUTABLE"],["JU_","1526","RETRO POR MAYO/25","NO_COMPUTABLE"],["JU_","1650","SUMA NO REMUNERATIVA","NO_COMPUTABLE"],["JU_","654","DEV GCIA RECT.2024","NO_COMPUTABLE"],["JU_","1250","RETRO X JUNIO 2025","NO_COMPUTABLE"],["JU_","1501","CUOTA INTERES","NO_COMPUTABLE"],["JU_","1511","INTERES","NO_COMPUTABLE"],["JU_","1530","RETROACTIVOS","NO_COMPUTABLE"],["JU_","1604","SUMA FIJA DTO. 14/20","NO_COMPUTABLE"],["JU_","1509","INTERESES RESOL. 44/05","NO_COMPUTABLE"],["JU_","554","AYUDA ESCOLAR","NO_COMPUTABLE"],["JU_","1527","DIF. X DICIEMBRE/25","NO_COMPUTABLE"],["JU_","1528","RETx02-03-04-05y062","NO_COMPUTABLE"],["JU_","1529","RETRO A OCTUBRE/24","NO_COMPUTABLE"],["JU_","1531","RET MAYO JUNIO/25","NO_COMPUTABLE"],["JU_","544","RETROACTIVO HABERES","NO_COMPUTABLE"],["JU_","545","RETROACTIVO HABERES","NO_COMPUTABLE"],["JU_","553","RETROACTIVO SALARIO","NO_COMPUTABLE"],["JU_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["JU_","105","DEDIC INTENSANCIA","NO_COMPUTABLE"],["JU_","1255","DIF POR MARZO/24","NO_COMPUTABLE"],["JU_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["JU_","552","CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["JU_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["JU_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["JU_","219","ADIO, INFORMATICA","NO_COMPUTABLE"],["JU_","444","AMEIAFAS","NO_COMPUTABLE"],["JU_","222","ADICESPRHORATIP","NO_COMPUTABLE"],["JU_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["JU_","174","BONIF.EXCEP DTO 359","NO_COMPUTABLE"],["JU_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["JU_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["JU_","1025","AYUDA ESC.MEDIA,SUP","NO_COMPUTABLE"],["JU_","174","BONIF EXCEP. OTO","NO_COMPUTABLE"],["JU_","19_R","COME RIESGO Y PELIG","NO_COMPUTABLE"],["JU_","911","CENTRO VET.GUER.PNA.","NO_COMPUTABLE"],["JU_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["JU_","599","REDONDEO EN MAS","NO_COMPUTABLE"],["JU_","1250","RETRO X MOVIEMBRE/24","NO_COMPUTABLE"],["JU_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["JU_","188","PLOS PRODUCTIVIDAD","NO_COMPUTABLE"],["JU_","13","HORAS EXTRAS","NO_COMPUTABLE"],["JU_","30_R","HABERES REM","NO_COMPUTABLE"],["JU_","552","SALARIO FAMILIAR CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["JU_","105","DEDIC.EXCL.C","NO_COMPUTABLE"],["JU_","105","DEDIC.EXCL.CHOFERES","NO_COMPUTABLE"],["JU_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["JU_","264","RECON.DE GASTOS XN","NO_COMPUTABLE"],["JU_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["JU_","86_R","BONIF.NO ASIG.DE VI","NO_COMPUTABLE"],["JU_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["JU_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["JU_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["JU_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["JU_","222","ADIC ESP PHORATIP","NO_COMPUTABLE"],["JU_","557","COMPLE ANUAL X VACA.","NO_COMPUTABLE"],["JU_","1536","A CTA.DE RETROACTIVO","NO_COMPUTABLE"],["JU_","882","DEUDA CAJA JUB.Y PEN","AFECTADO"],["JU_","738","RETR. JERARQUICOS SA","AFECTADO"],["JU_","892","CRED.ASIST. IOSPER.","AFECTADO"],["JU_","917","CENTRO VET.G.CECIMER","AFECTADO"],["JU_","802","EMBARGOS","AFECTADO"],["JU_","477","CRED.ASIST.IOSPER","AFECTADO"],["JU_","812","SI DE CRE ER","AFECTADO"],["JU_","412","SI DE CREER","AFECTADO"],["JU_","412","SI.DE CREER","AFECTADO"],["JU_","812","SI.DE.CRE.E.R.","AFECTADO"],["JU_","412","SI.DE.CREER","AFECTADO"],["JU_","812","SIDE CRE.E.R.","AFECTADO"],["JU_","412","SIDE CREER","AFECTADO"],["JU_","812","SIDE.CRE.E.R.","AFECTADO"],["JU_","412","SIDECREER","AFECTADO"],["JU_","132__","SERV. M.U.P.E.R.","AFECTADO"],["JU_","829","SERV. M.U.P.E.R.","AFECTADO"],["JU_","829","SERV. M.U.PER","AFECTADO"],["JU_","829","SERV. M.U.PER","AFECTADO"],["JU_","1117","DTO: 629/13 ART, 3","AFECTADO"],["JU_","491","PREST. Y/O PROVEDURIA - MUPER -","AFECTADO"],["JU_","431","PROVEEDURIA MUPER","AFECTADO"],["JU_","491","PROVEEDURIA MUPER","AFECTADO"],["JU_","491","PROVEEDURIA MUPER ASON ON","AFECTADO"],["JU_","491","PROVEEDURIA MURER","AFECTADO"],["JU_","1117","REDONDEO EN MAS","AFECTADO"],["JU_","1117","RIESGO Y PELIGROSIDA","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["JU_","368","CONSUMOS F.E.D.E.M. P","AFECTADO"],["JU_","368","CONSUMOS FE.D.E.M","AFECTADO"],["JU_","368","CONSUMOS FE.D.E.M.","AFECTADO"],["JU_","368","CONSUMOS FED.E.M.","AFECTADO"],["JU_","368","CONSUMOS FEDEM","AFECTADO"],["JU_","960","AD.REMUNERATIVO","AFECTADO"],["JU_","812","ANTIGUEDAD","AFECTADO"],["JU_","960","ANTIGUEDAD","AFECTADO"],["JU_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["JU_","1117","CONSUMO FEDEM","AFECTADO"],["JU_","339","CREDITO MUPER","AFECTADO"],["JU_","366","CTA. SOCIETARIA FEDEM","AFECTADO"],["JU_","849","CUOTA ALBERGUE POLI","AFECTADO"],["JU_","849","CUOTA ALBERGUE POLIC","AFECTADO"],["JU_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["JU_","1117","CUOTA SOCIAL FEDEM","AFECTADO"],["JU_","480","DCTO. N. BERSA DEC.","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC.","AFECTADO"],["JU_","480","DCTO. N.BERSA DEC. REON","AFECTADO"],["JU_","480","DCTON BERSA DEC.","AFECTADO"],["JU_","595","DIV TESORERIA","AFECTADO"],["JU_","595","DIV. TESORERIA","AFECTADO"],["JU_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["JU_","368","DESCTO. CONSUMO FEDEM","AFECTADO"],["JU_","136_","DEUDA SALARIO FLIAR.","AFECTADO"],["JU_","366","F.E.D.E.M.","AFECTADO"],["JU_","366","FE.D.E.M.","AFECTADO"],["JU_","366","FED.E.M.PR","AFECTADO"],["JU_","366","FEDEM","AFECTADO"],["JU_","366","FEDEM OS","AFECTADO"],["JU_","366","FEDEM R","AFECTADO"],["JU_","366","FEDEMR","AFECTADO"],["JU_","366","FEDEMROS","AFECTADO"],["JU_","1117","DTO. 629/13 ART. 3","AFECTADO"],["JU_","960","PRESTAMO NVO. BERSA","AFECTADO"],["JU_","829","SERV M.U.P.E.R.","AFECTADO"],["JU_","832","ANTICIPO CAJA JUBIL.","AFECTADO"],["JU_","877","HABER PROVISORIO PA","AFECTADO"],["JU_","878","HABER PROVISORIO PA","AFECTADO"],["JU_","594","LAVADO TUNEL","COMPUTABLE"],["JU_","128","DTO 1107/05-771/12","COMPUTABLE"],["JU_","136","DCTOS.772/04-1855/04","COMPUTABLE"],["JU_","134","ADICIONAL X FUNCION","COMPUTABLE"],["JU_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["JU_","546","PAGO SAL.FLIA.3RA.P.","COMPUTABLE"],["JU_","1292","PRODUCTIVIDAD RENTAS","COMPUTABLE"],["JU_","132","DTO. 1327/00-771/12","COMPUTABLE"],["JU_","1220","IAFAS PROD. VARIABLE","COMPUTABLE"],["JU_","112","TITULO SEGURIDAD.","COMPUTABLE"],["JU_","1368","ADIC. REGISTRO CIVIL","COMPUTABLE"],["JU_","546","","COMPUTABLE"],["JU_","1300","ADC. OCTO 6114","COMPUTABLE"],["JU_","950","AD.REMUNERATIVO","COMPUTABLE"],["JU_","1354","AD. ESP DEC.5245/08","COMPUTABLE"],["JU_","1354","AD. ESP DEC.5248/08","COMPUTABLE"],["JU_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["JU_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["JU_","344","AD.FUNCION VIALIDAD","COMPUTABLE"],["JU_","546","AD.REMUNERATIVO","COMPUTABLE"],["JU_","326","#NAME?","COMPUTABLE"],["JU_","111555","AD REMUNERATIVO ///","COMPUTABLE"],["JU_","536","AD REMUNERATIVO","COMPUTABLE"],["JU_","546","AD REMUNERATIVO","COMPUTABLE"],["JU_","1308","ADIC OCTO 613/14","COMPUTABLE"],["JU_","130","ADIC OTO 191690","COMPUTABLE"],["JU_","130","ADIC, DTO.1916.50","COMPUTABLE"],["JU_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["JU_","130","ADIC. DTO 1916/90","COMPUTABLE"],["JU_","130","ADIC. DTO.1916/90","COMPUTABLE"],["JU_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["JU_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["JU_","179","ADIC.D.747/11-","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SA","COMPUTABLE"],["JU_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["JU_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["JU_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["JU_","298","ADIC ACT RIESGO REM","COMPUTABLE"],["JU_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["JU_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["JU_","20","ADIC DCTO 2933/22","COMPUTABLE"],["JU_","130","ADIC DTO 1916/90-","COMPUTABLE"],["JU_","130","ADIC DTO 1916/90 CA","COMPUTABLE"],["JU_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["JU_","130","ADIC DTO.1916/90","COMPUTABLE"],["JU_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["JU_","170","ADICIONAL DO 1471","COMPUTABLE"],["JU_","201","ADICIONAL DTO 3509","COMPUTABLE"],["JU_","170","ADICIONAL DTO 747/11","COMPUTABLE"],["JU_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["JU_","170","ADICIONAL DTO.74711","COMPUTABLE"],["JU_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["JU_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["JU_","192","ADICIONAL ESP.DEC.S","COMPUTABLE"],["JU_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["JU_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["JU_","102","ADICIONAL ESPECS","COMPUTABLE"],["JU_","75","ADICIONAL IOSPER","COMPUTABLE"],["JU_","54","ADICIONAL LEY 9897","COMPUTABLE"],["JU_","130","ADICIONAL REM NO BON","COMPUTABLE"],["JU_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["JU_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["JU_","19","ADICIONAL S.G.D","COMPUTABLE"],["JU_","424","ART 6TO, DTO. 627/13","COMPUTABLE"],["JU_","424","ART 6TO. DTO, 627/13","COMPUTABLE"],["JU_","424","ART 6TO. DTO. 627/13","COMPUTABLE"],["JU_","1","ASIG. CAT.","COMPUTABLE"],["JU_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["JU_","5","ASIGNA DE LA CATEG","COMPUTABLE"],["JU_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["JU_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["JU_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["JU_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["JU_","1624","Ad.Ext.hs.Sec 1y2cat","COMPUTABLE"],["JU_","1342","ZONA DESFAVORABLE","COMPUTABLE"],["JU_","334","DEST.OBRA 100%-VIAL.","COMPUTABLE"],["JU_","340","DESARR.AL 40%-VIALID","COMPUTABLE"],["JU_","352","DED.FUNCIONAL EXLUSI","COMPUTABLE"],["JU_","138","COMPL. TITULO UNIVER","COMPUTABLE"],["JU_","644","TITULO - ENFERMERIA","COMPUTABLE"],["JU_","1840","BASICO - CONTADURIA","COMPUTABLE"],["JU_","1842","ANTIGUEDAD - CONTADU","COMPUTABLE"],["JU_","1844","ADIC. DTO 2933/22","COMPUTABLE"],["JU_","1360","BONIF. TITULO UNIVER","COMPUTABLE"],["JU_","1496","AD. HORAS CATEDRAS","COMPUTABLE"],["JU_","628","AD.FUNCION-ENFERMERA","COMPUTABLE"],["JU_","116","ACTIV.ORQUESTAL SEG.","COMPUTABLE"],["JU_","161","SUELDO BAS.-AUT.SUP","COMPUTABLE"],["JU_","163","ANTIG.-DEC.1053/14","COMPUTABLE"],["JU_","190","DTO. 9186 M.E.H.F.","COMPUTABLE"],["JU_","29","FALLA DE CAJA","COMPUTABLE"],["JU_","1221","IAFAS PROD. FIJA","COMPUTABLE"],["JU_","1286","TAREAS RIESGOSAS","COMPUTABLE"],["JU_","636","FUNCION-SUPERVISOR","COMPUTABLE"],["JU_","1458","ADIC. 18 HS.CATEDRA","COMPUTABLE"],["JU_","142","PLUS CUSTODIA GUBER.","COMPUTABLE"],["JU_","31","PAGADOR-COBR.-IOSPE","COMPUTABLE"],["JU_","9","RESPONS. PROFESIONA","COMPUTABLE"],["JU_","646","COMP.TITULO UNIVERSI","COMPUTABLE"],["JU_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["JU_","161","SUELDO BAS.-AUT.SUP.","COMPUTABLE"],["JU_","191","DEDICACION FULL TIME","COMPUTABLE"],["JU_","280","SUELDO BASICO-BANCO","COMPUTABLE"],["JU_","296","TIT.HAB.RECON.-BANCO","COMPUTABLE"],["JU_","492","ADIC. VOLUNTARIO BCO","COMPUTABLE"],["JU_","83","ADIC. CAJA DE JUBIL.","COMPUTABLE"],["JU_","84","COMPL. CODIGO 083","COMPUTABLE"],["JU_","626","ZONA DESF. - ENFERME","COMPUTABLE"],["JU_","422","ZONA INHOSPITA 120%","COMPUTABLE"],["JU_","87","BONIF.ASIST.MUNICIP","COMPUTABLE"],["JU_","670","PRESENTISMO I.A.P.V.","COMPUTABLE"],["JU_","672","MAYOR DEDICAC. IAPV.","COMPUTABLE"],["JU_","1420","ADICIONAL SCVA -IAPV","COMPUTABLE"],["JU_","844","SADOP","COMPUTABLE"],["JU_","1261","RETROACTIVOS","COMPUTABLE"],["JU_","410","CASA-HABIT.-DOCENTE","COMPUTABLE"],["JU_","1276","HORARIO ATIPICO","COMPUTABLE"],["JU_","620","ADIC. POR FUNCION","COMPUTABLE"],["JU_","614","BON.TAREA RIESG.ENF.","COMPUTABLE"],["JU_","370","TITULO LEGISLATURA","COMPUTABLE"],["JU_","440","SUELDO BAS.-JUSTICIA","COMPUTABLE"],["JU_","360","SUELDO BASICO-LEGISL","COMPUTABLE"],["JU_","362","ANTIGUEDAD-LEGISLAT","COMPUTABLE"],["JU_","384","AD. LEGISLATIVO","COMPUTABLE"],["JU_","362","ANTIGUEDAD-LEGISLAT.","COMPUTABLE"],["JU_","430","ADIC. ESCUELAS NINA","COMPUTABLE"],["JU_","480","HABER BAS.-AUTONOMOS","COMPUTABLE"],["JU_","49","TRABAJO INSALUBRE","COMPUTABLE"],["JU_","5","RESP.JERAQ. O FUNC.","COMPUTABLE"],["JU_","43","GUARD.ROTAT.","COMPUTABLE"],["JU_","200","SUELDO BASICO-EPEER","COMPUTABLE"],["JU_","202","B. POR FUNCION-EPEER","COMPUTABLE"],["JU_","204","BON.JERARQUICA-EPEER","COMPUTABLE"],["JU_","210","REFRIGERIO - EPEER","COMPUTABLE"],["JU_","212","PRESENTISMO - EPEER","COMPUTABLE"],["JU_","214","ANTIGUEDAD - EPEER","COMPUTABLE"],["JU_","220","BON. CHOFERES-EPEER","COMPUTABLE"],["JU_","228","MOVILIDAD - EPEER","COMPUTABLE"],["JU_","230","GAS - EPEER","COMPUTABLE"],["JU_","236","TURNO 13 % - EPEER","COMPUTABLE"],["JU_","238","TAREA PELIGR.-EPEER","COMPUTABLE"],["JU_","242","ESPECIL.ART.12-EPEER","COMPUTABLE"],["JU_","1520","INTERES CODIGO 1513","COMPUTABLE"],["JU_","706","REAJUSTE COD. 705.","COMPUTABLE"],["JU_","416","PROLONG.JORN.-DOCENT","COMPUTABLE"],["JU_","87","BONIF.ASIST.MUNICIPA","COMPUTABLE"],["JU_","608","AD.SALUD MENTAL-ENF.","COMPUTABLE"],["JU_","612","DEDIC.EXCLUS.-ENFERM","COMPUTABLE"],["JU_","548","DIF.MIN.GAR.MUN.PNA.","COMPUTABLE"],["JU_","408","BON.ZONA ESC.-DOCENT","COMPUTABLE"],["JU_","1378","GASTOS FUNCIONAMIENT","COMPUTABLE"],["JU_","1392","DEDICACION EXCLUSIVA","COMPUTABLE"],["JU_","1428","FALLA DE CAJA - PNA.","COMPUTABLE"],["JU_","1444","ORDENANZA 9014/12","COMPUTABLE"],["JU_","1352","DTO. 1101/08 - ART 4","COMPUTABLE"],["JU_","1464","ADIC. INFORMATICA","COMPUTABLE"],["JU_","482","DIF. A $ 470 - AUT.","COMPUTABLE"],["JU_","1304","PRESENTISMO","COMPUTABLE"],["JU_","1306","PROLONG. DE JORNADA","COMPUTABLE"],["JU_","57","GUARDIAS ROTAT-M.PNA","COMPUTABLE"],["JU_","69","ADIC.MAY.TAREA-M.PNA","COMPUTABLE"],["JU_","79","SALUD MENTAL","COMPUTABLE"],["JU_","81","DEDIC.EXCL.","COMPUTABLE"],["JU_","428","ART.4 - DTO. 751/11","COMPUTABLE"],["JU_","81","DEDIC.EXC.","COMPUTABLE"],["JU_","404","FUNCION DIFEREN.DOC.","COMPUTABLE"],["JU_","146","A.CHOFERES/SEGURIDAD","COMPUTABLE"],["JU_","146","A.CHOFERES/SEGURIDAD","COMPUTABLE"],["JU_","600","SUELDO BASICO-ENFERM","COMPUTABLE"],["JU_","604","ANTIGUEDAD-ENFERMERI","COMPUTABLE"],["JU_","606","PERM.CATEG.-ENFERMER","COMPUTABLE"],["JU_","618","HORARIO ATIPICO ENF.","COMPUTABLE"],["JU_","624","COMP. MAYOR HORARIO","COMPUTABLE"],["JU_","630","DTO. 5248/08-765/12","COMPUTABLE"],["JU_","642","RIESGO - ENFERMERIA","COMPUTABLE"],["JU_","1622","SUMA REM Y BONIF.","COMPUTABLE"],["JU_","1228","AD.DCION.PRESUPUESTO","COMPUTABLE"],["JU_","1618","AD. DECRETO 6/23","COMPUTABLE"],["JU_","442","ANTIGUEDAD-JUSTICIA","COMPUTABLE"],["JU_","21","DED.EXC.CHOFERES","COMPUTABLE"],["JU_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["JU_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["JU_","108","TIEMPO MINIMO-SEGUR.","COMPUTABLE"],["JU_","7","TITULO","COMPUTABLE"],["JU_","100","SUELDO ANUAL COMPLE","COMPUTABLE"],["JU_","1","SUELDO BASICO","COMPUTABLE"],["JU_","100","SUELDO BASICO-SEG. CIRCULO RET. POLICIA","COMPUTABLE"],["JU_","320","SUELDO BASICO-VIAL.","COMPUTABLE"],["JU_","117","SUMA FIJA REM","COMPUTABLE"],["JU_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["JU_","NO_COMPUTBALE","PTO.4-A.PAR-18-12-24","COMPUTABLE"],["JU_","1288","BONIF. ESP. GOBERNAC","COMPUTABLE"],["JU_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["JU_","41","ADIC.DTO.772/04NO R ENTRE","COMPUTABLE"],["JU_","548","DIF.MIN.CAR.MUN.PNA.","COMPUTABLE"],["JU_","1268","PRESENTISMO M.PARANA","COMPUTABLE"],["JU_","1278","REFRIGERIO M. PARANA","COMPUTABLE"],["JU_","1386","ADIC. ORDENANZA 8817","COMPUTABLE"],["JU_","1426","ASISTENCIA-MUNIC.PNA","COMPUTABLE"],["JU_","1430","AD.CHOFERES MUNICIPA","COMPUTABLE"],["JU_","104","NO ASIG.VIV.-SEGURID","COMPUTABLE"],["JU_","17","SA ESPARTO DE","COMPUTABLE"],["JU_","709","SUELDO BASICO","COMPUTABLE"],["JU_","400","SUELDO BASICO-DOCENT","COMPUTABLE"],["JU_","100","SUELDO BASICO-SEG.","COMPUTABLE"],["JU_","402","HS.DE CATEDRA-DOCENT","COMPUTABLE"],["JU_","437","DTO. N1462/18 DOCENT","COMPUTABLE"],["JU_","41","HOC DTO 77204NORP","COMPUTABLE"],["JU_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["JU_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["JU_","178","PLUS MAYOR SERV.SEG","COMPUTABLE"],["JU_","188_A","PLUS PRODUCTIVIVIDAD","COMPUTABLE"],["JU_","3.787.82 829","PERMANENCIA CATED","COMPUTABLE"],["JU_","11","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","30","PERMANENCIA CATEG","COMPUTABLE"],["JU_","326","OITULO VIALIDAD","COMPUTABLE"],["JU_","185","NUEVO MIN","COMPUTABLE"],["JU_","728","PREST.COMP.OSPA-VIAL","COMPUTABLE"],["JU_","14","PRODUCT, DCRTO, 586","COMPUTABLE"],["JU_","434","PRODUCTIVIDAD DOCENT","COMPUTABLE"],["JU_","5","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","5","PERMANENCIA CATEG.","COMPUTABLE"],["JU_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["JU_","140","RIESGO Y PELIGROSIDA","COMPUTABLE"],["JU_","552","SALARIO FAMILIAR","COMPUTABLE"],["JU_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["JU_","9","REDONDEO EN MAS","COMPUTABLE"],["JU_","1218","RESGO AGROSIDA","COMPUTABLE"],["JU_","1216","RESGOY PELIGROSIDA","COMPUTABLE"],["JU_","76","RESOLUCION 436/08","COMPUTABLE"],["JU_","507","CALIDAD DE VIDA","COMPUTABLE"],["JU_","2","CATEGORIA VIAL","COMPUTABLE"],["JU_","322","CATEGORIA VIAL","COMPUTABLE"],["JU_","53","BONIF.POR FUNCION","COMPUTABLE"],["JU_","50","BONIF. POR TITULO","COMPUTABLE"],["JU_","50","BONIF. POR TITULO NCIAENTRE","COMPUTABLE"],["JU_","50","BONIF. PORTITULOA","COMPUTABLE"],["JU_","408","BON ZONA ESC.-DOCENT","COMPUTABLE"],["JU_","408","BON ZONA ESC-DOCENT","COMPUTABLE"],["JU_","705","CIRCULO RET. POLICI","COMPUTABLE"],["JU_","2","COMP. JERARQUICA","COMPUTABLE"],["JU_","185","COMPL. REM MINIMO","COMPUTABLE"],["JU_","185","COMPL. REM. MINIMO","COMPUTABLE"],["JU_","1584","AD. DTO. 173/21","COMPUTABLE"],["JU_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["JU_","707","APORTE IO.S.P.E.R.","COMPUTABLE"],["JU_","707","APORTE 1.0.S.P.E.R.","COMPUTABLE"],["JU_","3000","ANTIGUEDAD","COMPUTABLE"],["JU_","753","ANTIGUEDAD","COMPUTABLE"],["JU_","324","ANTIGUEDAD-VIALIDAD","COMPUTABLE"],["JU_","10","ANTIQUEDAD","COMPUTABLE"],["JU_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["JU_","10","ANTIGUEDAD INCIA","COMPUTABLE"],["JU_","10","ANTIGUEDADM","COMPUTABLE"],["JU_","406","ANTIGUEDAD-DOCENTE","COMPUTABLE"],["JU_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["JU_","118","ADICIONAL 5% SEGURI","COMPUTABLE"],["JU_","10","ANTIGUEDAD","COMPUTABLE"],["JU_","302_A","AJUSTE CUOTA ALIM","COMPUTABLE"],["JU_","886","DCTOS.772/04-1855/04","COMPUTABLE"],["JU_","108","DEDIC EXCLCHORERES","COMPUTABLE"],["JU_","771","CUOTA SOC.M.U.PER","COMPUTABLE"],["JU_","432","DTO 770/12 ART. 5","COMPUTABLE"],["JU_","12","DTO, 626/10 ART. 5","COMPUTABLE"],["JU_","432","DTO, 770/12 ART. 5","COMPUTABLE"],["JU_","437","DTO, N1462/18 DOCENT","COMPUTABLE"],["JU_","346","DEDIC. EXCLUS. DPV","COMPUTABLE"],["JU_","1248","DTO","COMPUTABLE"],["JU_","246","INCREM ADIC CAJA JUB","COMPUTABLE"],["JU_","432","DTO. 770/12 ART, 5","COMPUTABLE"],["JU_","432","DTO. 770/12 ART. 5","COMPUTABLE"],["JU_","42","DTO. 625/10 ART. 5","COMPUTABLE"],["JU_","542","DTO. 626/10 ART. 5","COMPUTABLE"],["JU_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["JU_","120","DTO. 622/10 M.E.H.F.","COMPUTABLE"],["JU_","596","SUMA REM. DTO.292/22","COMPUTABLE"],["JU_","560","SUELDO BASICO-TUNEL","COMPUTABLE"],["JU_","562","ANTIGUEDAD - TUNEL","COMPUTABLE"],["JU_","572","CAMBIO ESC.35%-TUNEL","COMPUTABLE"],["JU_","574","ADIC. ESPECIAL-TUNEL","COMPUTABLE"],["JU_","582","PRESENTISMO - TUNEL","COMPUTABLE"],["JU_","588","PREM. ANUAL ESTIMULO","COMPUTABLE"],["JU_","354","ZONA INHOSPITA","COMPUTABLE"],["JU_","1364","ADIC. $ 62,19 IBICUY","COMPUTABLE"],["JU_","1448","ZONA DESFAV. IBICUY","COMPUTABLE"],["JU_","1494","ADIC. REM. IBICUY","COMPUTABLE"],["JU_","446","INTANGIB.ANTIG.JUSTI","COMPUTABLE"],["JU_","1362","ADIC. $ 150 - IBICUY","COMPUTABLE"],["JU_","500","SUELDO BASICO-MEDICO","COMPUTABLE"],["JU_","504","PERMAN.CATEG.-MEDICO","COMPUTABLE"],["JU_","508","BON.POR FUNC.-MEDICO","COMPUTABLE"],["JU_","528","DTO. 1264/08-76412","COMPUTABLE"],["JU_","526","DTO.4223/04- 764/12","COMPUTABLE"],["JU_","1328","ART. 1 - LEY 9775/07","COMPUTABLE"],["JU_","1442","ADICIONAL NOTARIADO","COMPUTABLE"],["JU_","444","INTANGIB.BASICO JUST","COMPUTABLE"],["JU_","268","PRESENTISMO M.PARANA","COMPUTABLE"],["JU_","106","RIESGO PROF.BRIG.EXP","COMPUTABLE"],["JU_","1222","MAYO DEDICACION","COMPUTABLE"],["JU_","1282","PLUS DTO. 105/04 OSP","COMPUTABLE"],["JU_","108","TIEMPO MINIMO-SEGUR","COMPUTABLE"],["JU_","547","AD.REM.NO BONIF","COMPUTABLE"],["JU_","216","TITULO - EPEER","COMPUTABLE"],["JU_","252","BONF.ART.69 70 72 EP","COMPUTABLE"],["JU_","1616","AD. DECRETO 3198/22","COMPUTABLE"],["JU_","606","PERM.CATEG.-ENFERME","COMPUTABLE"],["JU_","1274","DEDICACION FUNCIONAL","COMPUTABLE"],["JU_","600","SUELDO BASICO-ENFER","COMPUTABLE"],["JU_","604","ANTIGUEDAD-ENFERMER","COMPUTABLE"],["JU_","614","BON.TAREA RIESG.ENF","COMPUTABLE"],["JU_","163","ANTIG.-DEC.105314/","COMPUTABLE"],["JU_","328","MAYOR JOR.HOR.-VIAL.","COMPUTABLE"],["JU_","634","FUNC.-JEFE UNIDAD","COMPUTABLE"],["JU_","93","ADIC.I.A.F.A.S. ESP","COMPUTABLE"],["JUB_","45","RESP.JERAQ. O FUNC","COMPUTABLE"],["PO_","100","SUELDO BASICO-SEG.","COMPUTABLE"],["PO_","705","SUELDO BASICO-SEG.","SUBTOTAL_1"],["PO_","336","SUTSER","SUBTOTAL_1"],["PO_","112","TITULO SEGURIDAD.","SUBTOTAL_1"],["PO_","717","TITULO SEGURIDAD.","SUBTOTAL_1"],["PO_","835","TITULO","SUBTOTAL_1"],["PO_","900","TITULO","SUBTOTAL_1"],["PO_","829","SERV. M.U.P.E.R.","SUBTOTAL_1"],["PO_","717","SEGURO SEPELIO POLIC","SUBTOTAL_1"],["PO_","785","SEGURO VIDA I.A.P.S.","SUBTOTAL_1"],["PO_","358","SEP.E.R.","SUBTOTAL_1"],["PO_","358","SEPER","SUBTOTAL_1"],["PO_","829","SERV. M.U.PER","SUBTOTAL_1"],["PO_","104","SERV. SEPELIO IAPS","SUBTOTAL_1"],["PO_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["PO_","524","SEGURO DE VIDA IAPSER","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA SISE","SUBTOTAL_1"],["PO_","709","SISER LEY 11049","SUBTOTAL_1"],["PO_","703","SUELDO BASICO","SUBTOTAL_1"],["PO_","707","SUELDO BASICO","SUBTOTAL_1"],["PO_","713","SUELDO BASICO","SUBTOTAL_1"],["PO_","900","REDONDEO EN MENOS","SUBTOTAL_1"],["PO_","900","REDONDEO EN MENOS.","SUBTOTAL_1"],["PO_","358","S.E.P.E.R.","SUBTOTAL_1"],["PO_","824","S.O.E.V.E.R.","SUBTOTAL_1"],["PO_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["PO_","330","SEGURO DE RETIRO IAPSER","SUBTOTAL_1"],["PO_","327","SEGURO DE SEPELIO ADH. IAPSER","SUBTOTAL_1"],["PO_","510","SEGURO DE VIDA","SUBTOTAL_1"],["PO_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["PO_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["PO_","988","SALARIO FAMILIAR","SUBTOTAL_1"],["PO_","812","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","829","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","835","PERMANENCIA CATEG.","SUBTOTAL_1"],["PO_","530","PARITARIA NACIONAL","SUBTOTAL_1"],["PO_","812","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","829","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","835","PERMANENCIA CATEG","SUBTOTAL_1"],["PO_","434","PRODUCTIVIDAD DOCENT","SUBTOTAL_1"],["PO_","1292","PRODUCTIVIDAD RENTAS","SUBTOTAL_1"],["PO_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["PO_","510","LEY 11049","SUBTOTAL_1"],["PO_","104","NO ASIG.VIV.-SEGURID","SUBTOTAL_1"],["PO_","524","NUEVO SEGVIDA TAPS","SUBTOTAL_1"],["PO_","757","O.S.P.A. VIAL.","SUBTOTAL_1"],["PO_","134","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL.","SUBTOTAL_1"],["PO_","128","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["PO_","817","FONDO ASIST.C.POLIC.","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["PO_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["PO_","93","ADIC.I.A.F.A.S. ESP.","SUBTOTAL_1"],["PO_","118","ADICIONAL 5% SEGURI","SUBTOTAL_1"],["PO_","771","ADICIONAL 5% SEGURID","SUBTOTAL_1"],["PO_","532","ADHERENTE SEC. OSPER","SUBTOTAL_1"],["PO_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["PO_","988","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","510","0.15% SEGURO DE VIDA SISE","SUBTOTAL_1"],["PO_","1115","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","900","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","988","AD REMUNERATIVO","SUBTOTAL_1"],["PO_","841","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","900","AD.REMUNERATIVO","SUBTOTAL_1"],["PO_","134","ADICIONAL X FUNCION","SUBTOTAL_1"],["PO_","835","ADICIONAL X FUNCION","SUBTOTAL_1"],["PO_","771","ANTIGUEDAD","SUBTOTAL_1"],["PO_","785","ANTIGUEDAD","SUBTOTAL_1"],["PO_","812","ANTIGUEDAD","SUBTOTAL_1"],["PO_","988","ANTIGUEDAD","SUBTOTAL_1"],["PO_","713","ANTIGUEDAD","SUBTOTAL_1"],["PO_","102","ADICIONAL ESPECS","SUBTOTAL_1"],["PO_","707","ANTIGUEDAD-SEGURID.","SUBTOTAL_1"],["PO_","707","APORTE 1.0.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE 1.O.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE 10 SPER","SUBTOTAL_1"],["PO_","102","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["PO_","502","APORTE JUBILATORIO","SUBTOTAL_1"],["PO_","707","APORTE LO.S.P.E.R.","SUBTOTAL_1"],["PO_","707","APORTE LOS.P.E.R","SUBTOTAL_1"],["PO_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["PO_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["PO_","707","APORTE IO.S.P.E.R.","SUBTOTAL_1"],["PO_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["PO_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["PO_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["PO_","338","APORTE SIND MUPER","SUBTOTAL_1"],["PO_","520","APORTE PERS. IVAOS","SUBTOTAL_1"],["PO_","505","APORTE PERSOSPER","SUBTOTAL_1"],["PO_","332","APORTE SIND AGMER","SUBTOTAL_1"],["PO_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["PO_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["PO_","505","APORTES IOSPER","SUBTOTAL_1"],["PO_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["PO_","338","APORTE SIND.MUPER?","SUBTOTAL_1"],["PO_","310","APORTE SIND.SOEVER","SUBTOTAL_1"],["PO_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["PO_","307","APORTE SIND. UPCN?","SUBTOTAL_1"],["PO_","341","APORTE SIND.A.M.E.J.","SUBTOTAL_1"],["PO_","339","C. SOCIETARIA - MUPER -","SUBTOTAL_1"],["PO_","120","// BONIF.PERM.EN OBRA","SUBTOTAL_1"],["PO_","593","CIRCULO POLICIA","SUBTOTAL_1"],["PO_","705","CIRCULO RET. POLICIA","SUBTOTAL_1"],["PO_","185","COMPE REM MINIMO","SUBTOTAL_1"],["PO_","185","COMPL REM MINIMO","SUBTOTAL_1"],["PO_","185","COMPL REM. MINIMO","SUBTOTAL_1"],["PO_","487","DESC ESPECIAL SOEVER","SUBTOTAL_1"],["PO_","487","DESC.ESPECIAL SOEVER","SUBTOTAL_1"],["PO_","982","DTO. CASA IAPV","SUBTOTAL_1"],["PO_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["PO_","128","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","128","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","817","DTO.1107/05-771/12","SUBTOTAL_1"],["PO_","128","DTO 1107/05-771/12","SUBTOTAL_1"],["PO_","1115","DTO 629/13 ART 3","SUBTOTAL_1"],["PO_","829","DTO. 1327/00-771/12","SUBTOTAL_1"],["PO_","120","// DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["PO_","812","DTO. 622/10 M.E.H.F.","SUBTOTAL_1"],["PO_","1115","DTO. 629/13 ART. 3","SUBTOTAL_1"],["PO_","592","COOTAVIVENDA JAPV","SUBTOTAL_1"],["PO_","787","CUOTA A.G.M.E.R.","SUBTOTAL_1"],["PO_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["PO_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","118","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["PO_","1115","CUOTA SOCIAL FEDEM","SUBTOTAL_1"],["PO_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["PO_","779","CUOTA ALIMENTARIA","SUBTOTAL_1"],["PO_","1115","CUOTA SIND ADM PER","SUBTOTAL_1"],["PO_","988","CUOTA SIND ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND. ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["PO_","302","CUOTA ALIMENT EXTRA","SUBTOTAL_1"],["PO_","552","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["PO_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["PO_","355","CUOTA SINDICAL S.E.D.A.P.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC M.U.P.E.R.","SUBTOTAL_1"],["PO_","771","CUOTA SOC MUPER","SUBTOTAL_1"],["PO_","755","CUOTA SOC. A.T.E","SUBTOTAL_1"],["PO_","841","CUOTA SOC.CENTRO JUB","SUBTOTAL_1"],["PO_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["PO_","312","IMP.A LAS GANANCIAS","SUBTOTAL_1"],["PO_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["PO_","3","SAL.FLIAR HIJO 1024 - AYUDA","NO_COMPUTABLE"],["PO_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["PO_","1014_R","PRENATAL","NO_COMPUTABLE"],["PO_","133","ADIC NO REM NO BONIF","NO_COMPUTABLE"],["PO_","1255","DIF POR MARZO/24","NO_COMPUTABLE"],["PO_","2_R","COMP. JERARQUICA","NO_COMPUTABLE"],["PO_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["PO_","911","CENTRO VET.GUER.PNA.","NO_COMPUTABLE"],["PO_","19_R","COME RIESGO Y PELIG","NO_COMPUTABLE"],["PO_","174","BONIF.EXCEP DTO 359","NO_COMPUTABLE"],["PO_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["PO_","408","BON ZONA ESC-DOCENT","NO_COMPUTABLE"],["PO_","174","BONIF EXCEP. OTO","NO_COMPUTABLE"],["PO_","234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["PO_","1_R","ASIGNACION BASICA","NO_COMPUTABLE"],["PO_","1025","AYUDA ESC.MEDIA,SUP","NO_COMPUTABLE"],["PO_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["PO_","2_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["PO_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["PO_","444","AMEIAFAS","NO_COMPUTABLE"],["PO_","219","ADIO, INFORMATICA","NO_COMPUTABLE"],["PO_","546","AD REMUNERATIVO","NO_COMPUTABLE"],["PO_","546","AD.REMUNERATIVO","NO_COMPUTABLE"],["PO_","546","AD.REMUNERATIVO PAGO SAL.FLIA.3RA.P.","NO_COMPUTABLE"],["PO_","222","ADIC ESP PHORATIP","NO_COMPUTABLE"],["PO_","222","ADICESPRHORATIP","NO_COMPUTABLE"],["PO_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["PO_","30_R","HABERES REM","NO_COMPUTABLE"],["PO_","13","HORAS EXTRAS","NO_COMPUTABLE"],["PO_","402","HS.DE CATEDRA-DOCENT","NO_COMPUTABLE"],["PO_","1220","IAFAS PROD. VARIABLE","NO_COMPUTABLE"],["PO_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["PO_","68","PRESENTISMO","NO_COMPUTABLE"],["PO_","546","PAGO SAL.FLIA.3RA.P.","NO_COMPUTABLE"],["PO_","188","PLOS PRODUCTIVIDAD","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["PO_","1250","RETRO POR ABRIL/24","NO_COMPUTABLE"],["PO_","552","SALARIO FAMILIAR CUOTA SIND.ADM.P.ER.","NO_COMPUTABLE"],["PO_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["PO_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["PO_","552","SALARIO FAMILIAR","NO_COMPUTABLE"],["PO_","422","ZONA INHOSPITA 120%","NO_COMPUTABLE"],["PO_","208","ZONA DESFAVORABLE (","NO_COMPUTABLE"],["PO_","108","TIEMPO MINIMO-SEGUR.","NO_COMPUTABLE"],["PO_","100","SUELDO BASICO-SEG. CIRCULO RET. POLICIA","NO_COMPUTABLE"],["PO_","264","RECON.DE GASTOS XN","NO_COMPUTABLE"],["PO_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["PO_","86_R","BONIF.NO ASIG.DE VI","NO_COMPUTABLE"],["PO_","264","RECON.DE GASTOS X N","NO_COMPUTABLE"],["PO_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["PO_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["PO_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["PO_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["PO_","477","CRED.ASIST.IOSPER","AFECTADO"],["PO_","812","SI DE CRE ER","AFECTADO"],["PO_","412","SI DE CREER","AFECTADO"],["PO_","132","SERV. M.U.P.E.R.","AFECTADO"],["PO_","812","SIDE.CRE.E.R.","AFECTADO"],["PO_","412","SIDECREER","AFECTADO"],["PO_","812","SIDE CRE.E.R.","AFECTADO"],["PO_","412","SIDE CREER","AFECTADO"],["PO_","412","SI.DE.CREER","AFECTADO"],["PO_","412","SI.DE CREER","AFECTADO"],["PO_","120","SI.DE.CRE.E.R.","AFECTADO"],["PO_","812","SI.DE.CRE.E.R.","AFECTADO"],["PO_","1117","RIESGO Y PELIGROSIDA","AFECTADO"],["PO_","1117","REDONDEO EN MAS","AFECTADO"],["PO_","599","REDONDEO EN MAS","AFECTADO"],["PO_","599","REDONDEO EN MAS CONSUMO FEDEM","AFECTADO"],["PO_","491","PREST. Y/O PROVEDURIA - MUPER -","AFECTADO"],["PO_","960","PRESTAMO NVO, BERSA","AFECTADO"],["PO_","491","PROVEEDURIA MUPER ASON ON","AFECTADO"],["PO_","491","PROVEEDURIA MURER","AFECTADO"],["PO_","431","PROVEEDURIA MUPER","AFECTADO"],["PO_","491","PROVEEDURIA MUPER","AFECTADO"],["PO_","366","FE.D.E.M.","AFECTADO"],["PO_","366","FED.E.M.PR","AFECTADO"],["PO_","366","FEDEM","AFECTADO"],["PO_","366","FEDEM OS","AFECTADO"],["PO_","366","FEDEM R","AFECTADO"],["PO_","366","FEDEMR","AFECTADO"],["PO_","366","FEDEMROS","AFECTADO"],["PO_","960","AD.REMUNERATIVO","AFECTADO"],["PO_","960","AD REMUNERATIVO","AFECTADO"],["PO_","960","ANTIGUEDAD","AFECTADO"],["PO_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["PO_","132","DTO. 1327/00-771/12","AFECTADO"],["PO_","1117","DTO. 629/13 ART. 3","AFECTADO"],["PO_","1117","DTO: 629/13 ART, 3","AFECTADO"],["PO_","366","F.E.D.E.M.","AFECTADO"],["PO_","368","DESCTO. CONSUMO FEDEM","AFECTADO"],["PO_","136","DEUDA SALARIO FLIAR.","AFECTADO"],["PO_","595","DIV. TESORERIA","AFECTADO"],["PO_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["PO_","480","DCTON BERSA DEC.","AFECTADO"],["PO_","136","DCTOS.772/04-1855/0","AFECTADO"],["PO_","136","DCTOS.772/04-1855/04","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC.","AFECTADO"],["PO_","480","DCTO. N. BERSA DEC.","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC","AFECTADO"],["PO_","480","DCTO. N.BERSA DEC. REON","AFECTADO"],["PO_","849","CUOTA ALBERGUE POLIC","AFECTADO"],["PO_","1117","CUOTA SOCIAL FEDEM","AFECTADO"],["PO_","849","CUOTA ALBERGUE POLI","AFECTADO"],["PO_","339","CREDITO MUPER","AFECTADO"],["PO_","366","CTA. SOCIETARIA FEDEM","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["PO_","1117","CONSUMO FEDEM","AFECTADO"],["PO_","599","CONSUMO FEDEM","AFECTADO"],["PO_","368","CONSUMOS F.E.D.E.M. P","AFECTADO"],["PO_","368","CONSUMOS FE.D.E.M","AFECTADO"],["PO_","368","CONSUMOS FE.D.E.M.","AFECTADO"],["PO_","368","CONSUMOS FED.E.M.","AFECTADO"],["PO_","368","CONSUMOS FEDEM","AFECTADO"],["PO_","208_A","ZONA DESFAVORABLE (","AFECTADO"],["PO_","500","DESC. DIAS NT REM.","AFECTADO"],["PO_","1025_A","AYUDA ESC.MEDIA,SUP.","AFECTADO"],["PO_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["PO_","347","DESCUENTO ORDEN JUDI","AFECTADO"],["PO_","180","MECANICO DE VUELO","COMPUTABLE"],["PO_","148","RECON.GTOS.LESIONES","COMPUTABLE"],["PO_","90","RIESGO PROF.BRIG.DE","COMPUTABLE"],["PO_","771","CUOTA SOC.M.U.PER","COMPUTABLE"],["PO_","886","DCTOS.772/04-1855/04","COMPUTABLE"],["PO_","105","DEDIC EXCLCHORERES","COMPUTABLE"],["PO_","105","DEDIC INTENSANCIA","COMPUTABLE"],["PO_","346","DEDIC. EXCLUS. DPV","COMPUTABLE"],["PO_","105","DEDIC.INTENSIVA","COMPUTABLE"],["PO_","1248","DTO","COMPUTABLE"],["PO_","437","DTO. N1462/18 DOCENT","COMPUTABLE"],["PO_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["PO_","432","DTO. 770/12 ART, 5","COMPUTABLE"],["PO_","432","DTO. 770/12 ART. 5","COMPUTABLE"],["PO_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["PO_","42","DTO. 625/10 ART. 5","COMPUTABLE"],["PO_","542","DTO. 626/10 ART. 5","COMPUTABLE"],["PO_","432","DTO 770/12 ART. 5","COMPUTABLE"],["PO_","12","DTO, 626/10 ART. 5","COMPUTABLE"],["PO_","432","DTO, 770/12 ART. 5","COMPUTABLE"],["PO_","437","DTO, N1462/18 DOCENT","COMPUTABLE"],["PO_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["PO_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["PO_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["PO_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["PO_","50","BONIF. POR TITULO","COMPUTABLE"],["PO_","424","ART 6TO, DTO. 627/13","COMPUTABLE"],["PO_","424","ART 6TO. DTO, 627/13","COMPUTABLE"],["PO_","424","ART 6TO. DTO. 627/13","COMPUTABLE"],["PO_","1","ASIG. CAT.","COMPUTABLE"],["PO_","5","ASIGNA DE LA CATEG","COMPUTABLE"],["PO_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["PO_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["PO_","50","BONIF. PORTITULOA","COMPUTABLE"],["PO_","507","CALIDAD DE VIDA","COMPUTABLE"],["PO_","50","BONIF. POR TITULO NCIAENTRE","COMPUTABLE"],["PO_","53","BONIF.POR FUNCION","COMPUTABLE"],["PO_","705","CIRCULO RET. POLICI","COMPUTABLE"],["PO_","2","CATEGORIA VIAL","COMPUTABLE"],["PO_","322","CATEGORIA VIAL","COMPUTABLE"],["PO_","2","COMP. JERARQUICA","COMPUTABLE"],["PO_","185","COMPL. REM MINIMO","COMPUTABLE"],["PO_","185","COMPL. REM. MINIMO","COMPUTABLE"],["PO_","753","ANTIGUEDAD","COMPUTABLE"],["PO_","10","ANTIGUEDADM","COMPUTABLE"],["PO_","406","ANTIGUEDAD-DOCENTE","COMPUTABLE"],["PO_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["PO_","102","ANTIGUEDAD-SEGURID.","COMPUTABLE"],["PO_","302_A","AJUSTE CUOTA ALIM","COMPUTABLE"],["PO_","10","ANTIGUEDAD","COMPUTABLE"],["PO_","3000","ANTIGUEDAD","COMPUTABLE"],["PO_","19","ADICIONAL S.G.D","COMPUTABLE"],["PO_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["PO_","75","ADICIONAL IOSPER","COMPUTABLE"],["PO_","54","ADICIONAL LEY 9897","COMPUTABLE"],["PO_","130","ADICIONAL REM NO BON","COMPUTABLE"],["PO_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["PO_","170","ADICIONAL DO 1471","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC","COMPUTABLE"],["PO_","192","ADICIONAL ESP.DEC.S","COMPUTABLE"],["PO_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["PO_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["PO_","707","APORTE IO.S.P.E.R.","COMPUTABLE"],["PO_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["PO_","10","ANTIGUEDAD INCIA","COMPUTABLE"],["PO_","324","ANTIGUEDAD-VIALIDAD","COMPUTABLE"],["PO_","10","ANTIQUEDAD","COMPUTABLE"],["PO_","720","AP.ADHERENTES IOSPER","COMPUTABLE"],["PO_","707","APORTE 1.0.S.P.E.R.","COMPUTABLE"],["PO_","536","AD REMUNERATIVO","COMPUTABLE"],["PO_","950","AD.REMUNERATIVO","COMPUTABLE"],["PO_","326","#NAME?","COMPUTABLE"],["PO_","344","AD.FUNCION VIALIDAD","COMPUTABLE"],["PO_","1354","AD. ESP DEC.5245/08","COMPUTABLE"],["PO_","1354","AD. ESP DEC.5248/08","COMPUTABLE"],["PO_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["PO_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["PO_","1300","ADC. OCTO 6114","COMPUTABLE"],["PO_","298","ADIC ACT RIESGO REM","COMPUTABLE"],["PO_","130","ADIC DTO.1916/90","COMPUTABLE"],["PO_","130","ADIC DTO 1916/90-","COMPUTABLE"],["PO_","130","ADIC DTO 1916/90 CA","COMPUTABLE"],["PO_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["PO_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["PO_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["PO_","20","ADIC DCTO 2933/22","COMPUTABLE"],["PO_","130","ADIC. DTO.1916/90","COMPUTABLE"],["PO_","130","ADIC. DTO 1916/90","COMPUTABLE"],["PO_","1308","ADIC OCTO 613/14","COMPUTABLE"],["PO_","130","ADIC OTO 191690","COMPUTABLE"],["PO_","130","ADIC, DTO.1916.50","COMPUTABLE"],["PO_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["PO_","41","ADIC.DTO.772/04NO R","COMPUTABLE"],["PO_","201","ADICIONAL DTO 3509","COMPUTABLE"],["PO_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["PO_","170","ADICIONAL DTO 747/11","COMPUTABLE"],["PO_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["PO_","170","ADICIONAL DTO.74711","COMPUTABLE"],["PO_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["PO_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["PO_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["PO_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["PO_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["PO_","179","ADIC.D.747/11-","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SA","COMPUTABLE"],["PO_","41","HOC DTO 77204NORP","COMPUTABLE"],["PO_","185","NUEVO MIN","COMPUTABLE"],["PO_","14","PRODUCT, DCRTO, 586","COMPUTABLE"],["PO_","728","PREST.COMP.OSPA-VIAL","COMPUTABLE"],["PO_","188_A","PLUS PRODUCTIVIVIDAD","COMPUTABLE"],["PO_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["PO_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["PO_","178","PLUS MAYOR SERV.SEG","COMPUTABLE"],["PO_","326","OITULO VIALIDAD","COMPUTABLE"],["PO_","5","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","5","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","3.787.82 829","PERMANENCIA CATED","COMPUTABLE"],["PO_","11","PERMANENCIA CATEG.","COMPUTABLE"],["PO_","30","PERMANENCIA CATEG","COMPUTABLE"],["PO_","1218","RESGO AGROSIDA","COMPUTABLE"],["PO_","1216","RESGOY PELIGROSIDA","COMPUTABLE"],["PO_","76","RESOLUCION 436/08","COMPUTABLE"],["PO_","9","REDONDEO EN MAS","COMPUTABLE"],["PO_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["PO_","140","RIESGO Y PELIGROSIDA","COMPUTABLE"],["PO_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["PO_","17","SA ESPARTO DE","COMPUTABLE"],["PO_","552","SALARIO FAMILIAR","COMPUTABLE"],["PO_","709","SUELDO BASICO","COMPUTABLE"],["PO_","829","SERV. M.U.PER","COMPUTABLE"],["PO_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["PO_","320","SUELDO BASICO-VIAL.","COMPUTABLE"],["PO_","117","SUMA FIJA REM","COMPUTABLE"],["PO_","1","SUELDO BASICO","COMPUTABLE"],["PO_","400","SUELDO BASICO-DOCENT","COMPUTABLE"],["PO_","7","TITULO","COMPUTABLE"],["PO_","244","ADICIONAL RESP. FUN","COMPUTABLE"],["PO_","86","BONIF.NO ASIG.DE VI","COMPUTABLE"],["PO_","105","DEDIC.EXCL.C","COMPUTABLE"],["PO_","105","DEDIC.EXCL.CHOFERES","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["PO_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["PO_","41","ADIC.DTO.772/04NO R ENTRE","COMPUTABLE"],["SA_","336","SUTSER","SUBTOTAL_1"],["SA_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["SA_","713","SERV. SEPELIO IAPS","SUBTOTAL_1"],["SA_","610","SEGURO DE VIDA SISE","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SA_","512","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDASISER","SUBTOTAL_1"],["SA_","510","SEGURO DE VIDA SISERSISER","SUBTOTAL_1"],["SA_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["SA_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["SA_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["SA_","358","S.E.P.E.R.","SUBTOTAL_1"],["SA_","988","PROVEEDURIA MUPER","SUBTOTAL_1"],["SA_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["SA_","703","FEDERACION DE JUBIL","SUBTOTAL_1"],["SA_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["SA_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["SA_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC IOSPER","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.SPER","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSP","SUBTOTAL_1"],["SA_","532","ADHERENTE SEC.IOSPEERACIO LIBERTAD","SUBTOTAL_1"],["SA_","707","APORTE I.O.S.P.E.R.","SUBTOTAL_1"],["SA_","502","APORTE JUB. PERSON N","SUBTOTAL_1"],["SA_","502","APORTE JUB PERSONAL","SUBTOTAL_1"],["SA_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["SA_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["SA_","505","APORTE PERS IOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS JOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["SA_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["SA_","355","APORTE SIND SEDAPP","SUBTOTAL_1"],["SA_","307","APORTE SIND UPCN","SUBTOTAL_1"],["SA_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["SA_","307","APORTE SIND, UPCN","SUBTOTAL_1"],["SA_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["SA_","201","APORTE SIND. UPCN","SUBTOTAL_1"],["SA_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["SA_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["SA_","505","APORTE PERS. IOSPER?","SUBTOTAL_1"],["SA_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SA_","338","APORTE SIND. MUPER","SUBTOTAL_1"],["SA_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["SA_","771","CUOTA SOC.M.U.P.E.R.","SUBTOTAL_1"],["SA_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["SA_","592","CUOTA VIVIENDA","SUBTOTAL_1"],["SA_","988","CUOTA SIND.ADM.P.ER.","SUBTOTAL_1"],["SA_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["SA_","342","REAJ P/MIN.AP OSER","SUBTOTAL_1"],["SA_","344","APORTE SIND. CHOFER","SUBTOTAL_1"],["SA_","347","DESCUENTO ORDEN JUDI","SUBTOTAL_1"],["SA_","312_D","IMP.A LAS GANANCIAS","NO_COMPUTABLE"],["SA_","7081_R","PROLONG. DE JORNADA","NO_COMPUTABLE"],["SA_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SA_","1021_R","NACIMIENTO","NO_COMPUTABLE"],["SA_","136","NAFTA DISCAPACITADOS","NO_COMPUTABLE"],["SA_","186","S.A.C.S/CODIG.NO RE","NO_COMPUTABLE"],["SA_","7210_R","RESP. FUNCIONAL ENF","NO_COMPUTABLE"],["SA_","7185_R","COMPLEMENTO MINIMO","NO_COMPUTABLE"],["SA_","1014_R","PRENATAL","NO_COMPUTABLE"],["SA_","7192_R","ADICIONAL ESP. DCTO","NO_COMPUTABLE"],["SA_","7234_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["SA_","185_R","COMPL. MINIMO SALUD","NO_COMPUTABLE"],["SA_","226_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","228_R","ADIC.DED.EXC.SALUD M","NO_COMPUTABLE"],["SA_","1028","AYUDA ESC.SEC.DIF","NO_COMPUTABLE"],["SA_","7001_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SA_","201_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","7214_R","COMPL.RIES.DEC368/20","NO_COMPUTABLE"],["SA_","7018_R","COMP. MAYOR HORARIO","NO_COMPUTABLE"],["SA_","7234","CLARANC OTO 255/10","NO_COMPUTABLE"],["SA_","78","BONIF.UBICACION ESC..","NO_COMPUTABLE"],["SA_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["SA_","234","CARANC DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","CARANC DTO 4255/10","NO_COMPUTABLE"],["SA_","234","CARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","CARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7224","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","3434_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7130_R","ADICIONAL REM.NO BON","NO_COMPUTABLE"],["SA_","222","ADIC ESP.PHOR ATIP.","NO_COMPUTABLE"],["SA_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","222","ADIC.ESP.P/HOR ATIP.","NO_COMPUTABLE"],["SA_","92","FALLA DE CAJA","NO_COMPUTABLE"],["SA_","240","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","7214","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","7224","HORARIO ATIPICO","NO_COMPUTABLE"],["SA_","30 R","HABERES REM","NO_COMPUTABLE"],["SA_","30_R","HABERES REM","NO_COMPUTABLE"],["SA_","13","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","40","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","7013","HORAS EXTRAS","NO_COMPUTABLE"],["SA_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SA_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SA_","1001","SALFLIAR HIJO","NO_COMPUTABLE"],["SA_","1001","SAL FLIAR HIJO","NO_COMPUTABLE"],["SA_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SA_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","7100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","7100_R","SUELDO ANUAL COMPLEM","NO_COMPUTABLE"],["SA_","7010","ANTIGUEDAD M","NO_COMPUTABLE"],["SA_","64","ADIC. MEDICO INT. G","NO_COMPUTABLE"],["SA_","70","ADIC. MED. INT GDA","NO_COMPUTABLE"],["SA_","29","TRASLADO POR KM","NO_COMPUTABLE"],["SA_","219","ADIC. INFORMATICA","NO_COMPUTABLE"],["SA_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["SA_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["SA_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["SA_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SA_","7029","TRASLADO POR KM","NO_COMPUTABLE"],["SA_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SA_","7234","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","7234","RIOS C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["SA_","7208","ZONA DESFAVORABLE","NO_COMPUTABLE"],["SA_","222_A","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","1002_R","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SA_","100_R","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SA_","101_R","M.FIJO N.REM.","NO_COMPUTABLE"],["SA_","179_R","ADIC.D.747/11-SALUD","NO_COMPUTABLE"],["SA_","222_R","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SA_","234_R","C.ARANC.DTO 4255/10","NO_COMPUTABLE"],["SA_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SA_","5_R","ASIGNAC.DE LA CATEG","NO_COMPUTABLE"],["SA_","130_R","ADIC. DTO.1916/90","NO_COMPUTABLE"],["SA_","192_R","ADICIONAL ESP.DEC.5","NO_COMPUTABLE"],["SA_","576","DIAS DE PARO NO REM","NO_COMPUTABLE"],["SA_","125","AYUDA ESC.MEDIA, SUP.","NO_COMPUTABLE"],["SA_","491","PROVEEDURIA MUPER SONON","AFECTADO"],["SA_","353","DESCUENTO HABERES IN","AFECTADO"],["SA_","412","SI.DE.CREERDCTO. N.BERSA DEC.","AFECTADO"],["SA_","412","SIDE.CREER","AFECTADO"],["SA_","812","SI.DE.CRE.E.R.","AFECTADO"],["SA_","412","SI.DE CREER","AFECTADO"],["SA_","412","SI.DE.CREER","AFECTADO"],["SA_","412","SIDE CREER","AFECTADO"],["SA_","829","SERV. M.U.P.E.R.","AFECTADO"],["SA_","491","PROVEEDURIA MUPER ON","AFECTADO"],["SA_","491","PROVEEDURIA MUPERSONON","AFECTADO"],["SA_","491","PROVEEDURIA MUPER","AFECTADO"],["SA_","480","OCTON BERSA DEC.","AFECTADO"],["SA_","480","OCTO. N.BERSA DEC.","AFECTADO"],["SA_","480","OCTO. N.BERSA DEO.","AFECTADO"],["SA_","366","FEDEM.","AFECTADO"],["SA_","368","FEDEM.","AFECTADO"],["SA_","366","FEDEMP","AFECTADO"],["SA_","366","FEDEMPR","AFECTADO"],["SA_","366","FEDEM","AFECTADO"],["SA_","366","FE.D.E.M.","AFECTADO"],["SA_","1_A","ASIGNAC.DE LA CATEG.","AFECTADO"],["SA_","480","DCTO, N.BERSA DEC.","AFECTADO"],["SA_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E.M","AFECTADO"],["SA_","366","CONSUMOS FEDEM","AFECTADO"],["SA_","368","CONSUMOS FEDEM","AFECTADO"],["SA_","368","CONSUMOS F.E.D.E. ACION","AFECTADO"],["SA_","366","F.E,D.E.M.","AFECTADO"],["SA_","366","F.E.D.E.M.","AFECTADO"],["SA_","503","DESC. DIAS NT NO RE.","AFECTADO"],["SA_","500","DESC. DIAS NT REM.","AFECTADO"],["SA_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["SA_","480","DCTO. N.BERSA DEC.","AFECTADO"],["SA_","575_A","AJUSTE DESC. PARO","AFECTADO"],["SA_","575","DESC. DIAS DE PARO","AFECTADO"],["SA_","477","CRED.ASIST.IOSPER","AFECTADO"],["SA_","1001_A","SAL.FLIAR HIJO","AFECTADO"],["SA_","532_A","AJUSTE ADHER. IOSPER","AFECTADO"],["SA_","7192","ADICIONAL ESP. DCTO","COMPUTABLE"],["SA_","272","PLUS ADIC ESPECIAL","COMPUTABLE"],["SA_","17","COMP.DTO.5736/07 NO","COMPUTABLE"],["SA_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["SA_","7214","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7","TITULO","COMPUTABLE"],["SA_","185","COMPL MINIMO SALUD","COMPUTABLE"],["SA_","185","COMPL. MINIMO","COMPUTABLE"],["SA_","117","SUMA FIJA REM","COMPUTABLE"],["SA_","238","FUNCION RIESGOSA Y","COMPUTABLE"],["SA_","4","HORAS CATEDRA","COMPUTABLE"],["SA_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC R","COMPUTABLE"],["SA_","14","PRODUCT, DCRTO. 586","COMPUTABLE"],["SA_","11","PERMANENCIA CATEG","COMPUTABLE"],["SA_","5","PERMANENCIA CATEG","COMPUTABLE"],["SA_","11","PERMANENCIA CATEG.","COMPUTABLE"],["SA_","5","PERMANENCIA CATEG.","COMPUTABLE"],["SA_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","1","SUELDO BASICO","COMPUTABLE"],["SA_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["SA_","1216","RIESGO Y PELIGROSIDA","COMPUTABLE"],["SA_","900","REDONDEO EN MENOS.","COMPUTABLE"],["SA_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["SA_","1246","DTO. 629/13 ART. 3","COMPUTABLE"],["SA_","32","COMPL. TITULO UNIVER","COMPUTABLE"],["SA_","7032","COMPL. TITULO UNIVER","COMPUTABLE"],["SA_","1117","CONSUMO FEDEM","COMPUTABLE"],["SA_","7185","COMPLEMENTO MINIMO","COMPUTABLE"],["SA_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","7001","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SA_","50","BONIF POR TITULO","COMPUTABLE"],["SA_","16","ASIG.ESP. ART.02 DC","COMPUTABLE"],["SA_","1","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SA_","5","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SA_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["SA_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","10","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","7001","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SA_","333","APORTE SIND. MUPER","COMPUTABLE"],["SA_","332","APORTE SIND.AGMER","COMPUTABLE"],["SA_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","5","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","7001","ASIGNAC DE LA CATEG","COMPUTABLE"],["SA_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SA_","7000","CARANC.DTO 4255/10","COMPUTABLE"],["SA_","7018","COMP MAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPE REM MINIMO","COMPUTABLE"],["SA_","7018","COMPEMAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPL MINIMO SALUD","COMPUTABLE"],["SA_","7018","COMP. MAYOR HORARIO","COMPUTABLE"],["SA_","185","COMPL. MINIMO SALUD","COMPUTABLE"],["SA_","185","COMPL REM MINIMO","COMPUTABLE"],["SA_","185","COMPL/REM. MINIMO","COMPUTABLE"],["SA_","185","COMPL. REM. MINIMO","COMPUTABLE"],["SA_","185","COMPL. REM MINIMO","COMPUTABLE"],["SA_","226","ADIC.RIESGO.PROF.S.M","COMPUTABLE"],["SA_","7214","ADICIONAL D","COMPUTABLE"],["SA_","192","ADICIONAL ESP DEC.S","COMPUTABLE"],["SA_","192","ADICIONAL ESP DEC.5","COMPUTABLE"],["SA_","170","ADICIONAL DTO.747/11","COMPUTABLE"],["SA_","42","ADICIONAL DCRTO. 38","COMPUTABLE"],["SA_","210","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","212","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7192","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","271","ADICIONAL DECRETO N","COMPUTABLE"],["SA_","201","ADICIONAL DTO 3509","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SA","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALA","COMPUTABLE"],["SA_","179","ADIC.D.747/11-","COMPUTABLE"],["SA_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["SA_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["SA_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["SA_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["SA_","179","ADIC.D.747/11-SALUDRA","COMPUTABLE"],["SA_","179","ADIC.D747/11-SALUD","COMPUTABLE"],["SA_","228","ADIC.DED.EXC.SALUD M","COMPUTABLE"],["SA_","176","ADIC.DTO 747/11-CGE","COMPUTABLE"],["SA_","130","ADIC DTO.1916/90","COMPUTABLE"],["SA_","176","ADIC DTO 747/11-CGE","COMPUTABLE"],["SA_","130","ADIC DTO 191690 CIA","COMPUTABLE"],["SA_","179","ADIC D.747/11-SALUD","COMPUTABLE"],["SA_","130","ADIC DTO 1916/90","COMPUTABLE"],["SA_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["SA_","1308","ADIC. DCTO.613/14","COMPUTABLE"],["SA_","226","ADIC RIESGO.PROF.S.M","COMPUTABLE"],["SA_","130","ADIC. DTO 1916/90","COMPUTABLE"],["SA_","1308","ADIC. DCTO 613/14","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90-","COMPUTABLE"],["SA_","130","ADIC. DTO.1916/90","COMPUTABLE"],["SA_","546","AD.REMUNERATIVO","COMPUTABLE"],["SA_","179","ADIC 0.747/11-SALUD","COMPUTABLE"],["SA_","1354","AD. ESP. DEC.5248/08","COMPUTABLE"],["SA_","546","AD REMUNERATIVO","COMPUTABLE"],["SA_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["SA_","7130","ADICIONAL REM.NO BON","COMPUTABLE"],["SA_","7130","ADICIONAL RELNO BON","COMPUTABLE"],["SA_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["SA_","8","ADICIONAL ESPECIAL","COMPUTABLE"],["SA_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["SA_","192","ADICIONAL ESP.","COMPUTABLE"],["SA_","7192","ADICIONAL ESP. DCT","COMPUTABLE"],["SA_","192","ADICIONAL ESP. DEC.5","COMPUTABLE"],["SA_","192","ADICIONAL ESP.D","COMPUTABLE"],["SA_","192","ADICIONAL ESP.DA","COMPUTABLE"],["SA_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["SA_","231","ADICIONAL SALUD","COMPUTABLE"],["SA_","192","ADICIONAL/ESP.DEC.5","COMPUTABLE"],["SA_","7192","ADICIONALESP OCTO","COMPUTABLE"],["SA_","10","ANTIGUEDAD","COMPUTABLE"],["SA_","17","ANTIGUEDAD","COMPUTABLE"],["SA_","3","ANTIGUEDAD","COMPUTABLE"],["SA_","7010","ANTIGUEDAD","COMPUTABLE"],["SA_","7226","DIC.RIESGO.PROF.S.M","COMPUTABLE"],["SA_","7210","RESP. FUNCIONAL ENF","COMPUTABLE"],["SA_","22","COMPL.BONIF.TI.U.DC","COMPUTABLE"],["SA_","212","ADICIONAL DECRETO 7","COMPUTABLE"],["SA_","7050","BONIF. POR TITULO","COMPUTABLE"],["SA_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["SAL_","336","SUTSER","NO_COMPUTABLE"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SAL_","576","DIAS DE PARO NO REM","AFECTADO"],["SG","1003","FAMILIA NUMEROSA","NO_COMPUTABLE"],["SG","191","ADICIONAL DCTO. NÂº 5.248/08 - REM.","COMPUTABLE"],["SG_","406","R. S/COD.342","SUBTOTAL_1"],["SG_","120_1","DTO. 622/10 ?.?.?.F.","SUBTOTAL_1"],["SG_","306","SINDICAL ATE","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL","SUBTOTAL_1"],["SG_","312","Ret.Imp. Ganancias","SUBTOTAL_1"],["SG_","312","GANANCIPACION IMP.A LAS","SUBTOTAL_1"],["SG_","325","SIND.ASOC.JUD.ARGEN","SUBTOTAL_1"],["SG_","327","SEG.SEP.P/ADH.JAPS","SUBTOTAL_1"],["SG_","333","MUPER","SUBTOTAL_1"],["SG_","358","S.?.?.E.R.","SUBTOTAL_1"],["SG_","502",". PERSOON APORTE JUB","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONA/","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL LIBERTAD Y FUERZA","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL LIBERTADY FUERZA","SUBTOTAL_1"],["SG_","502","Descuento aporte jubilatorio personal","SUBTOTAL_1"],["SG_","","CUOTA SOCIAL A.M. MODELO","SUBTOTAL_1"],["SG_","","OSER TIT. Y GRUPO FLIAR","SUBTOTAL_1"],["SG_","563_A","AJUSTE ADHER. IOSPER","SUBTOTAL_1"],["SG_","330","SEG.RETIRO IAPS","SUBTOTAL_1"],["SG_","508","APORTE PERS. OSPLAD","SUBTOTAL_1"],["SG_","512","FONDO COMP.C.JUB.Y P","SUBTOTAL_1"],["SG_","4306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SG_","502","PERSONAL","SUBTOTAL_1"],["SG_","502","PERSONAL APORTE JUB.","SUBTOTAL_1"],["SG_","502","PREST.CAJA JUBILACIONES","SUBTOTAL_1"],["SG_","505","PERS. IOSPER","SUBTOTAL_1"],["SG_","524","NUEVO SEG. VIDA IAPS","SUBTOTAL_1"],["SG_","524","NUEVO SEG. VIDA IAPS c","SUBTOTAL_1"],["SG_","525","ADH.SEG.VIDA (524","SUBTOTAL_1"],["SG_","527","APORTE SIND. A.?.?.?","SUBTOTAL_1"],["SG_","532","Desc.aporte personal O.S.E.R.","SUBTOTAL_1"],["SG_","532","IOSPER","SUBTOTAL_1"],["SG_","532","IOSPER APORTE PERS.","SUBTOTAL_1"],["SG_","532","OSER","SUBTOTAL_1"],["SG_","592","I.A.P.V. Cuota CrEdito","SUBTOTAL_1"],["SG_","600","A. SOLIDARIO ART 92 LEY 9755/07","SUBTOTAL_1"],["SG_","627","Aporte Solidario Art. 92 Ley 9755","SUBTOTAL_1"],["SG_","709","SEG.LEY 11049 SISER EXL3011","SUBTOTAL_1"],["SG_","713","COMPENS.SEG.SEPELIO IAPSER","SUBTOTAL_1"],["SG_","717","SEGURO POR SEPELIO","SUBTOTAL_1"],["SG_","755","Aporte sindical A.T.E.","SUBTOTAL_1"],["SG_","755","APORTE SINDICAL ATE ONERACION","SUBTOTAL_1"],["SG_","755","APORTE SINDICAL ATEN","SUBTOTAL_1"],["SG_","755","APORTE SINDICALATE","SUBTOTAL_1"],["SG_","755","ATE CUOTA SOCIETARIA","SUBTOTAL_1"],["SG_","757","VIAL","SUBTOTAL_1"],["SG_","812","PERMANENCIA EN LA CATEG.","SUBTOTAL_1"],["SG_","812","Permanencia en la categoria","SUBTOTAL_1"],["SG_","1002","Hijo con Capacidad Diferente","SUBTOTAL_1"],["SG_","","SEGURO","SUBTOTAL_1"],["SG_","","SEGURO DE SEPELIO","SUBTOTAL_1"],["SG_","","SEGURO LEY 13003","SUBTOTAL_1"],["SG_","120","Suma Fija No Remunerativa - Paritaria","SUBTOTAL_1"],["SG_","","A.P.L.E.R. Ap. Sindical","SUBTOTAL_1"],["SG_","","A.SOLID","SUBTOTAL_1"],["SG_","","APORTE U.C.R.","SUBTOTAL_1"],["SG_","307","APORTE SIND. UPCN","SUBTOTAL_1"],["SG_","355","APORTE SIND. SEDAPP","SUBTOTAL_1"],["SG_","527","APORTE SIND. A.M.E.T","SUBTOTAL_1"],["SG_","355","APORTE SIND, SEDAPP","SUBTOTAL_1"],["SG_","355","APORTE SIND, GEDAPP","SUBTOTAL_1"],["SG_","505","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","506","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","805","APORTE PERS. IOSPER","SUBTOTAL_1"],["SG_","505","APORTE PERS, IOSPER","SUBTOTAL_1"],["SG_","332","APORTE SIND AGMER","SUBTOTAL_1"],["SG_","338","APORTE SIND MUPER","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL.","SUBTOTAL_1"],["SG_","502","APORTE JUB. PERSONAL","SUBTOTAL_1"],["SG_","502","APORTE JUB, PERSONAL","SUBTOTAL_1"],["SG_","502","APORTE JUB.","SUBTOTAL_1"],["SG_","502","APORTE JUB PERSONAL","SUBTOTAL_1"],["SG_","532","ADHERENTE SEC.IOSPER","SUBTOTAL_1"],["SG_","705","CIRCULO RET. POLICI","SUBTOTAL_1"],["SG_","332","APORTE SIND.AGMER","SUBTOTAL_1"],["SG_","338","APORTE SIND.MUPER","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL ATE","SUBTOTAL_1"],["SG_","363","APORTE SINDICAL UDA","SUBTOTAL_1"],["SG_","627","APORTE SOLIDARIO PAR","SUBTOTAL_1"],["SG_","627","APORTE SOLIDARIO PARFEDERACION","SUBTOTAL_1"],["SG_","302","CUOTA ALIMENT.EXTRA","SUBTOTAL_1"],["SG_","592","CUOTA VIVIENDA","SUBTOTAL_1"],["SG_","592","CUOTA VIVIENDA IAPV","SUBTOTAL_1"],["SG_","316","CUOTA ALIMENTARIA","SUBTOTAL_1"],["SG_","316","CUOTA ALIVENTARIA","SUBTOTAL_1"],["SG_","988","CUOTA SIND.ADM.P.ER","SUBTOTAL_1"],["SG_","771","CUOTA SOC.M.U.P.E.R","SUBTOTAL_1"],["SG_","342","REAJ P/MIN.AP IOSPER","SUBTOTAL_1"],["SG_","358","S.E.P.E.R.","SUBTOTAL_1"],["SG_","327","SEG.SEP.P/ADH. IAPS","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA","SUBTOTAL_1"],["SG_","327","SEG.SEP P/ADH. IAPS","SUBTOTAL_1"],["SG_","327","SEG SEP RIADH, LAPS","SUBTOTAL_1"],["SG_","327","SEG. SEP.PYADH. IAPS","SUBTOTAL_1"],["SG_","709","SISER LEY 11049","SUBTOTAL_1"],["SG_","327","SEO SEP P/ADH IAPS","SUBTOTAL_1"],["SG_","315","SEGURO COLECT. IAPS","SUBTOTAL_1"],["SG_","717","SEGURO SEPELIO POLI","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA SISERSISERN","SUBTOTAL_1"],["SG_","510","SEGURO DE VIDA SISER","SUBTOTAL_1"],["SG_","610","SEGURO DE VIDA SISE","SUBTOTAL_1"],["SG_","960","PRESTAMO NVO. BERSA","SUBTOTAL_1"],["SG_","524","NUEVO SEG.VIDA IAPS","SUBTOTAL_1"],["SG_","S17","FONDO VOLUNTARID","SUBTOTAL_1"],["SG_","835","FONDO VOLUNTARIO","SUBTOTAL_1"],["SG_","317","FONDO VOLUNTARIO","SUBTOTAL_1"],["SG_","525","ADH.SEG.VIDA (524)","SUBTOTAL_1"],["SG_","306","APORTE SINDICAL ATE RIOS","SUBTOTAL_1"],["SG_","600","A.SOLID. ART92 L9755","SUBTOTAL_1"],["SG_","612","IMP. A LAS GCIAS CGE","SUBTOTAL_1"],["SG_","519","DESC. DIAS INAS HS","SUBTOTAL_1"],["SG_","625","DTO OBRA SOCIAL","SUBTOTAL_1"],["SG_","1101","PTO.4-A.PAR-18-04-24","NO_COMPUTABLE"],["SG_","1024","AYUDA ESC.PRIMARIA","NO_COMPUTABLE"],["SG_","1027","AYUDA ESC.PRI.DIF.","NO_COMPUTABLE"],["SG_","355_D","APORTE SIND. SEDAPP","NO_COMPUTABLE"],["SG_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SG_","1025","AYUDA ESC.MEDIA,SUP.","NO_COMPUTABLE"],["SG_","204_R","COMP.PROV.CONECT.","NO_COMPUTABLE"],["SG_","25_R","PTO4 AC.PAR.06-03-25","NO_COMPUTABLE"],["SG_","110","ANTIGÃœEDAD COD 25","NO_COMPUTABLE"],["SG_","101","M.FIJO N.REM.","NO_COMPUTABLE"],["SG_","100","SUELDO ANUAL COMPLE","NO_COMPUTABLE"],["SG_","1013","S.FLIAR MENOR A CARG","NO_COMPUTABLE"],["SG_","117_R","SUMA FIJA REM","NO_COMPUTABLE"],["SG_","117","SUMA FUA REM","NO_COMPUTABLE"],["SG_","117","SUMA FUJA REM","NO_COMPUTABLE"],["SG_","28","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","29","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","29_R","TRASLADO POR KM","NO_COMPUTABLE"],["SG_","16","FUNCION DIFERENCIAL","NO_COMPUTABLE"],["SG_","266_R","GUARDIAS ESC AGROTE","NO_COMPUTABLE"],["SG_","38","NUEVO ADIC. HS. CAT.","NO_COMPUTABLE"],["SG_","13","HORAS EXTRAS","NO_COMPUTABLE"],["SG_","30_R","HABERES REM","NO_COMPUTABLE"],["SG_","7224","HORARIO ATIPICO","NO_COMPUTABLE"],["SG_","14","PRODUCT DCRISCA","NO_COMPUTABLE"],["SG_","14","PRODUCT DCRTO 586","NO_COMPUTABLE"],["SG_","14","PRODUCT DORTO, ses","NO_COMPUTABLE"],["SG_","14","PRODUCT OORTO se","NO_COMPUTABLE"],["SG_","14","PRODUCT, DCRTO. 586","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO, 586","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO.","NO_COMPUTABLE"],["SG_","14","PRODUCT. DCRTO. 5","NO_COMPUTABLE"],["SG_","188_R","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","14","PRODUCT, DCRTO, 586","NO_COMPUTABLE"],["SG_","52","PROLONG. DE JORNADA","NO_COMPUTABLE"],["SG_","2","PIONAL ESPECIAL","NO_COMPUTABLE"],["SG_","1002","SFLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1002","S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1_R","ASIGNAC DE LA CATEG.","NO_COMPUTABLE"],["SG_","1_R","ASIGNAC.DE LA CATEG.","NO_COMPUTABLE"],["SG_","2","COMP. DIR. SEC.","NO_COMPUTABLE"],["SG_","176","BONIF.EXCEP. DTO 359.","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP. DTO 359","NO_COMPUTABLE"],["SG_","78","BONIF. UBICACION ESC.","NO_COMPUTABLE"],["SG_","8_R","ADIC. ESP. NIV. PRIM","NO_COMPUTABLE"],["SG_","14","ADIC. EXT. HORARIA","NO_COMPUTABLE"],["SG_","28","ADIC. EXT. HORARIA","NO_COMPUTABLE"],["SG_","6_R","ADIC.ART. 2 Y 3 DCR","NO_COMPUTABLE"],["SG_","222","ADIC.ESP.P/HOR.ATIP.","NO_COMPUTABLE"],["SG_","2_R","ADICIONAL ESPECIAL","NO_COMPUTABLE"],["SG_","10_R","ANTIGUEDAD","NO_COMPUTABLE"],["SG_","1023","AYUDA ESC.PREESCOLAR","NO_COMPUTABLE"],["SG_","244","Conectividad Art2","NO_COMPUTABLE"],["SG_","284","COMPLEMENTO FOPID","NO_COMPUTABLE"],["SG_","1014","PRENATAL","NO_COMPUTABLE"],["SG_","500_D","DESC. DIAS NT REM.","NO_COMPUTABLE"],["SG_","4078_R","BONIF.UBICACION ESC.","NO_COMPUTABLE"],["SG_","4010_R","ANTIGUEDAD","NO_COMPUTABLE"],["SG_","4008_R","MAYOR CARGA DIRECTIV","NO_COMPUTABLE"],["SG_","4188_R","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","1001_R","SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","4_R","HORAS CATEDRA","NO_COMPUTABLE"],["SG_","14_R","PRODUCT. DCRTO. 586","NO_COMPUTABLE"],["SG_","18_R","ADICIONAL REM.","NO_COMPUTABLE"],["SG_","515","DIAS NO TRAB REM","NO_COMPUTABLE"],["SG_","4188","PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E INH.","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO DIFE","NO_COMPUTABLE"],["SG_","1001","S.FLIAR HIJO DIFER","NO_COMPUTABLE"],["SG_","1010","SALARIO POR ESPOSA","NO_COMPUTABLE"],["SG_","1001","SALARIO POR HIJOS","NO_COMPUTABLE"],["SG_","29","TRASLADO POR","NO_COMPUTABLE"],["SG_","29","TRASLADO POR KM29-","NO_COMPUTABLE"],["SG_","68","ADICIONAL POR PRESENTISMO","NO_COMPUTABLE"],["SG_","101","M.FIJO N.REM","NO_COMPUTABLE"],["SG_","101","M.FUO N.REM.","NO_COMPUTABLE"],["SG_","101","MONTO FIJO NO REMUNERATIVO","NO_COMPUTABLE"],["SG_","105","DEDIC.INTENSIVA A","NO_COMPUTABLE"],["SG_","105","DEDICACION FUNC EXC","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP. DT? 359","NO_COMPUTABLE"],["SG_","174","BONIF EXCEP DTO 359","NO_COMPUTABLE"],["SG_","174","BONIF.EXCEP, DTO 359","NO_COMPUTABLE"],["SG_","174","BONIFEXCEP DTO 359","NO_COMPUTABLE"],["SG_","188","188 PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","188PLUS PRODUCTIVIDAD","NO_COMPUTABLE"],["SG_","188","PRODUCTIVIDAD PLUS","NO_COMPUTABLE"],["SG_","188","PLUS ADICIONAL","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E INH.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E I??.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E IN?.","NO_COMPUTABLE"],["SG_","208","ZONA MUY DESF E INH","NO_COMPUTABLE"],["SG_","208","????A MUY DESF E INH.","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E .INH","NO_COMPUTABLE"],["SG_","208","???A MUY DESF E INH","NO_COMPUTABLE"],["SG_","222","HOR.ATIP ADIC.ESP.P/","NO_COMPUTABLE"],["SG_","234","C.ARANC.DTO","NO_COMPUTABLE"],["SG_","234","C.ARANC.DTO 4255/10 X","NO_COMPUTABLE"],["SG_","240","ADIC.ESP.P/HOR.ATIP","NO_COMPUTABLE"],["SG_","264","ADIC REM DCT? 4780","NO_COMPUTABLE"],["SG_","1001","1001SAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1001","ASAL.FLIAR HIJO","NO_COMPUTABLE"],["SG_","1002","1002_R - S.FLIAR HIJO DIFER,","NO_COMPUTABLE"],["SG_","1013","S.FLIAR MENOR A 1013 CARG","NO_COMPUTABLE"],["SG_","7214","ADIC.ESPP/HOR.ATIP.","NO_COMPUTABLE"],["SG_","2_R","COMP. JERARQUICA10- ANTIGUEDAD","NO_COMPUTABLE"],["SG_","7192_R","ADICIONAL ESP. DCT?","NO_COMPUTABLE"],["SG_","","REDONDEO EN MAS (+)","NO_COMPUTABLE"],["SG_","","REDONDEO EN MENOS (-)","NO_COMPUTABLE"],["SG_","","REFRIGERIO","NO_COMPUTABLE"],["SG_","247","REAJUSTE COD. 248 Y 246","NO_COMPUTABLE"],["SG_","","Reajuste Pase Contrato LocaciOn de Servicio","NO_COMPUTABLE"],["SG_","","Reajuste s/responsabilidad profesional","NO_COMPUTABLE"],["SG_","","Reajuste sobre antiguedad","NO_COMPUTABLE"],["SG_","244_R","Conectividad Art2_R","NO_COMPUTABLE"],["SG_","234_R","FOPID_R","NO_COMPUTABLE"],["SG_","39","AJUSTE CÃ“D. 10 Y 110","NO_COMPUTABLE"],["SG_","103","AJUSTE COD. 100","NO_COMPUTABLE"],["SG_","212","ADICIONAL DECRETO 7","NO_COMPUTABLE"],["SG_","92","FALLA  DE CAJA (IAFAS","NO_COMPUTABLE"],["SG_","251","REDISTRIB. INASIST AD. IAFAS RES 730/21","NO_COMPUTABLE"],["SG_","366","F.E.D.?.?.","AFECTADO"],["SG_","368","CONSUMOS F.E.D.E.?.","AFECTADO"],["SG_","368","Aporte Cuota FEDEM","AFECTADO"],["SG_","368","F.E.DE.M","AFECTADO"],["SG_","368","FEDEM Cuota Social","AFECTADO"],["SG_","317_A","AJUSTE F. VOLUNTARIO","AFECTADO"],["SG_","369","F.E.D.E.M. CONSUMOS","AFECTADO"],["SG_","369","FEDEM Ayudas EconOmicas","AFECTADO"],["SG_","412","DESCUENTO SI.DE.CRE.ER","AFECTADO"],["SG_","431","PROVEEDURIA","AFECTADO"],["SG_","431","PROVEEDURIA MUPER .CO","AFECTADO"],["SG_","431","PROVEEDURIA MUPER OF","AFECTADO"],["SG_","431","PROVEEDURIAMUPER","AFECTADO"],["SG_","491","491PROVEEDURIA MUPER","AFECTADO"],["SG_","491","MUPER PROVEEDURIA","AFECTADO"],["SG_","502","JUB. PERSONAL","AFECTADO"],["SG_","502","JUBILACION","AFECTADO"],["SG_","960","480 DCTO. N.BERSA DEC.","AFECTADO"],["SG_","960","Cuota CrEdito Nuevo BERSA","AFECTADO"],["SG_","960","DCTO. N.BERSA","AFECTADO"],["SG_","960","DCTO. N.BERSA BERSA DEC","AFECTADO"],["SG_","",".DE.CREER","AFECTADO"],["SG_","","SI.DE.CRE. E.R.","AFECTADO"],["SG_","","SI.DE.CRE.E.R.S.A.","AFECTADO"],["SG_","","SI.DE.CRE.ER S.A.","AFECTADO"],["SG_","","DIAS DE PARO NO","AFECTADO"],["SG_","412_A","AJUSTE COD 412","AFECTADO"],["SG_","576","DIAS DE PARO NO REM","AFECTADO"],["SG_","503","DESC. DIAS NT NO RE.","AFECTADO"],["SG_","517","DESC. DIAS DE PARO H","AFECTADO"],["SG_","551","DESC. HAB. LIQUIDOS","AFECTADO"],["SG_","316_A","AJUSTE CUOTA ALIM.","AFECTADO"],["SG_","1115","CUOTA SOCIAL FEDEM","AFECTADO"],["SG_","849","CUOTA ALBERGUE POLI","AFECTADO"],["SG_","368","CONSUMOS F.E.D.E.M.","AFECTADO"],["SG_","1117","CONSUMO FEDEM","AFECTADO"],["SG_","368","CONSUMOS FEDEM","AFECTADO"],["SG_","368","CONSUMOS FEDEM.","AFECTADO"],["SG_","366","F.E.D.E.M.","AFECTADO"],["SG_","280","DCTO. N.BERSA DEC.","AFECTADO"],["SG_","480","DCTO. N.BERSA DEC.","AFECTADO"],["SG_","480","DCTO.N.BERSA DEC","AFECTADO"],["SG_","313","DESC. ORDEN JUDICIAL","AFECTADO"],["SG_","569","DES HAB MAYOR JERQ","AFECTADO"],["SG_","412","Si DE CREER","AFECTADO"],["SG_","829","SERV. M.U.P.E.R.","AFECTADO"],["SG_","412","SIDE CREER","AFECTADO"],["SG_","412","SI.DE.CREER","AFECTADO"],["SG_","412","SI.DE CREER","AFECTADO"],["SG_","812","SI.DE.CRE.E.R.","AFECTADO"],["SG_","188_A","PLUS PRODUCTIVIVIDAD","AFECTADO"],["SG_","491","PROVEEDURIA MUPER","AFECTADO"],["SG_","491","PROVELOURIA MUPER","AFECTADO"],["SG_","188_A","PLUS PRODUCTIVIDAD","AFECTADO"],["SG_","480","OCTO. N.BERSA DEQ","AFECTADO"],["SG_","480","OCTON BERSA DEC.","AFECTADO"],["SG_","366","FEDE.M.","AFECTADO"],["SG_","356","FEDEM","AFECTADO"],["SG_","366","FEDEM","AFECTADO"],["SG_","368","FEDEM.","AFECTADO"],["SG_","29_A","TRASLADO POR KM","AFECTADO"],["SG_","500","DESC. DIAS NT REM.","AFECTADO"],["SG_","5754","DESC. DIAS DE PARO","AFECTADO"],["SG_","536","DESC. DIAS INAS CARG","AFECTADO"],["SG_","352","DEUDA CARGOS ANT","AFECTADO"],["SG_","6_A","ADIC.ART. 2 Y 3 DCR","AFECTADO"],["SG_","1028_A","AYUDA ESC.SEC.DIF.","AFECTADO"],["SG_","477","CRED.ASIST.IOSPER","AFECTADO"],["SG_","1","ASIGNAC DE LA CATEG TEG","COMPUTABLE"],["SG_","1","ASIGNAC. DE LA CATEG","COMPUTABLE"],["SG_","1","ASIGNAC.DE LA CATEG. CIA","COMPUTABLE"],["SG_","1","AsignaciOn de la Categoria","COMPUTABLE"],["SG_","5","Adicional Remunerativo y Bonificable","COMPUTABLE"],["SG_","5","ADICIONAL RESP.FUM","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG PROVINCIA.","COMPUTABLE"],["SG_","7","TITULO SECUNDARIO","COMPUTABLE"],["SG_","10","ANTIGUEDAD COD","COMPUTABLE"],["SG_","10","ANTIGUEDAD COD 25","COMPUTABLE"],["SG_","10","ANTIGUEDAD FUNC.","COMPUTABLE"],["SG_","10","ASIGNAC.DE LA CATEG10- ANTIGUEDAD","COMPUTABLE"],["SG_","11","BONIF.PERM.EN","COMPUTABLE"],["SG_","11","BONIF.PERMANENCIA","COMPUTABLE"],["SG_","23","ADIC.DTO. 1855/04??","COMPUTABLE"],["SG_","50","BONIF. POR TITULO A","COMPUTABLE"],["SG_","50","BONIF. POR TITULOA","COMPUTABLE"],["SG_","50","BonificaciOn por tItulo","COMPUTABLE"],["SG_","50","BonificaciOn TItulo","COMPUTABLE"],["SG_","118","PRESE DCT? 5315","COMPUTABLE"],["SG_","118","PRESE DCTO5315","COMPUTABLE"],["SG_","130","ADICIONAL RE?.?? BON","COMPUTABLE"],["SG_","130",". 1916/90130-ADIC. DTO","COMPUTABLE"],["SG_","130","ADIC DTO.1916/90 CA","COMPUTABLE"],["SG_","130","ADIC. DTO. 1916/90 IA","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90 IA","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90 IAM.FIJO N.REM.","COMPUTABLE"],["SG_","130","ADIC.DTO. 1916/90","COMPUTABLE"],["SG_","134","Adicional prod. y present.","COMPUTABLE"],["SG_","136","Adicional OSER Bonif. 100% (14) - Ant.","COMPUTABLE"],["SG_","170","ADIC.D.747/11-COP A","COMPUTABLE"],["SG_","170","ADIC.D.747/11-COPNA A","COMPUTABLE"],["SG_","170","ADIC.D.747/11-UADA","COMPUTABLE"],["SG_","170","ADICIONAL DTO.74711/","COMPUTABLE"],["SG_","176","ADIC D.747/11-","COMPUTABLE"],["SG_","176","ADICIONAL DTO. 7459/04","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747 A","COMPUTABLE"],["SG_","176","ADICIONAL DTO.747/","COMPUTABLE"],["SG_","176","ADICIONAL DTO.74714 A","COMPUTABLE"],["SG_","176","ADICIONAL REM.NO","COMPUTABLE"],["SG_","176","ADICIONAL REM.NOBON","COMPUTABLE"],["SG_","176","ADICIONAL REM?.?? BON","COMPUTABLE"],["SG_","178","COPNAF178-ADIC.D.747/","COMPUTABLE"],["SG_","181","181 RIESGO Y PELIGROSID","COMPUTABLE"],["SG_","185","COMPL. REM. ??????","COMPUTABLE"],["SG_","185","COMPL. REM. M?????","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DE A","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DEC.5 CONADIC.SERV.ADM.COMRACION","COMPUTABLE"],["SG_","192","ADICIONAL ESPEC","COMPUTABLE"],["SG_","192","Adicional especial decreto 5248/08","COMPUTABLE"],["SG_","192","ESP.DEC.5","COMPUTABLE"],["SG_","220","ADIC NO REM 2941/23 Y","COMPUTABLE"],["SG_","244","RESP.FUMRACION - ADICIONAL","COMPUTABLE"],["SG_","244","RESP.FUNC.","COMPUTABLE"],["SG_","244","RESPONSABILIDAD FUNCIONAL","COMPUTABLE"],["SG_","280","INCOMPATIBILIDAD","COMPUTABLE"],["SG_","1216","RIESGO Y PELIGROSID181","COMPUTABLE"],["SG_","1354","ADICIONAL DCTO. N 5.248/08 - REM.","COMPUTABLE"],["SG_","7185","COMPLEMENTO DEL BASICO","COMPUTABLE"],["SG_","7214","ADICIONAL","COMPUTABLE"],["SG_","9","ADIC. DIRECTIVOS SUP","COMPUTABLE"],["SG_","513","SOEME","COMPUTABLE"],["SG_","178","ADIC.D.747/11-COPNAF","COMPUTABLE"],["SG_","177","ADIC.D.747/11-UADER","COMPUTABLE"],["SG_","4001","COMPNTO CARGO 749","COMPUTABLE"],["SG_","12","RESPONS.PROFESIONAL","COMPUTABLE"],["SG_","184","F.O.P.I.D.","COMPUTABLE"],["SG_","204","COMP.PROV.CONECT.","COMPUTABLE"],["SG_","236","TALLER ANTEQUEDA","COMPUTABLE"],["SG_","117","SUMA FIJA REM","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-9","COMPUTABLE"],["SG_","5","ADIC ESC NINA","COMPUTABLE"],["SG_","4","HORAS INHERENTES","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCRANTIGUEDAD","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCRANTIGUEDAD","COMPUTABLE"],["SG_","628","O.S.P.E.","COMPUTABLE"],["SG_","56","COMPLEMENTO DIF COD","COMPUTABLE"],["SG_","125","ANTIGUEDAD ADMINIST","COMPUTABLE"],["SG_","4008","ADICIONAL MAYOR CARGA - DIRECTIVOS","COMPUTABLE"],["SG_","25AAA","PTO4 AC.PAR.06-03-25","COMPUTABLE"],["SG_","243","ADIC.SERV.ADM.CONT","COMPUTABLE"],["SG_","4008","MAYOR CARGA","COMPUTABLE"],["SG_","4008","MAYOR CARGA DIRECTIV","COMPUTABLE"],["SG_","4","HORAS CATEDRA","COMPUTABLE"],["SG_","14","PRODUCT. DCRTO. 586","COMPUTABLE"],["SG_","272","PLUS ADICIONAL ESPEC","COMPUTABLE"],["SG_","176","PLUS MAYOR SERV.SEG","COMPUTABLE"],["SG_","11","PERMANENCIA CATEG.","COMPUTABLE"],["SG_","272","RIOS PLUS ADICIONAL ESPEC","COMPUTABLE"],["SG_","181","RIESGO Y PELIGROSID","COMPUTABLE"],["SG_","900","REDONDEO EN MENOS.","COMPUTABLE"],["SG_","552","SALARIO FAMILIAR","COMPUTABLE"],["SG_","136","DCTOS.772/04-1855/0","COMPUTABLE"],["SG_","129","DTO. 622/10 M.E.H.F","COMPUTABLE"],["SG_","132","DTO. 1327/00-771/12","COMPUTABLE"],["SG_","50","BONIF. POR TITULO","COMPUTABLE"],["SG_","550","BONIF. POR TITULO","COMPUTABLE"],["SG_","234","C.ARANC.DTO 4255/10","COMPUTABLE"],["SG_","3","COMP. DIR. SEC.","COMPUTABLE"],["SG_","7018","COMPEMAYOR HORARIO","COMPUTABLE"],["SG_","7234","CLARANC OTO 255/10","COMPUTABLE"],["SG_","3","COMP DIR. SEC","COMPUTABLE"],["SG_","185","COMPL. REM, MINIMO","COMPUTABLE"],["SG_","185","COMPL. REM. MINIMO","COMPUTABLE"],["SG_","185","COMPL/REM. MINIMO","COMPUTABLE"],["SG_","130","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","1","ASIGNAC.DE LA CATEG.","COMPUTABLE"],["SG_","5","ASIGNAC.DE LA CATEG","COMPUTABLE"],["SG_","1","ASIGNAC DE LA CATEG.","COMPUTABLE"],["SG_","17","ASIG. ESP.ART.03 DC","COMPUTABLE"],["SG_","1","ASIGNAC DE LA CATEG","COMPUTABLE"],["SG_","7001","ASIGNAC DE LA CATEG","COMPUTABLE"],["SG_","15","ANTIGUEDAD","COMPUTABLE"],["SG_","60","ANTIGUEDAD","COMPUTABLE"],["SG_","10","ANTIGUEDAD","COMPUTABLE"],["SG_","7192","ADICIONALESP OCTO","COMPUTABLE"],["SG_","206","ADICIONAL RESP.FUNC.","COMPUTABLE"],["SG_","206","ADICIONAL RESP.FUNC","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DEC.5","COMPUTABLE"],["SG_","2","ADICIONAL ESPECIAL","COMPUTABLE"],["SG_","192","ADICIONAL ESP.DECS","COMPUTABLE"],["SG_","7130","ADICIONAL RELNO BON","COMPUTABLE"],["SG_","18","ADICIONAL REM.","COMPUTABLE"],["SG_","18","ADICIONAL REM.IA","COMPUTABLE"],["SG_","130","ADICIONAL REM.NO BON","COMPUTABLE"],["SG_","206","ADICIONAL RESP FUNC","COMPUTABLE"],["SG_","4010","ANTIGUEDAD VINCIA","COMPUTABLE"],["SG_","707","APORTE I.O.S.P.E.R.","COMPUTABLE"],["SG_","118","ADICIONAL 5% SEGURI","COMPUTABLE"],["SG_","201","ADICIONAL DTO 3509","COMPUTABLE"],["SG_","192","ADICIONAL ESP DEC 5","COMPUTABLE"],["SG_","__192","__ADICIONAL ESP,DEC.5","COMPUTABLE"],["SG_","6","ADIC.ART. 2 Y 3 DCR","COMPUTABLE"],["SG_","286","ADIC.ACT.RIESGO REM","COMPUTABLE"],["SG_","6","ADIC.ART 2 Y 3 DCR","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90.","COMPUTABLE"],["SG_","8","ADIC. ESP, NIV, PRIM","COMPUTABLE"],["SG_","8","ADIC. ESP. NIV. PRIM","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-CGE","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-CGGER","COMPUTABLE"],["SG_","179","ADIC.D.747/11-SALUD","COMPUTABLE"],["SG_","23","ADIC.DTO. 1855/04NO","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-","COMPUTABLE"],["SG_","176","ADIC.DTO.747/11-0","COMPUTABLE"],["SG_","546","AD.REMUNERATIVO","COMPUTABLE"],["SG_","130","ADIC. DTO.1916/90","COMPUTABLE"],["SG_","__174","__ADIC. DTO.1916/90","COMPUTABLE"],["SG_","130","ADIC. DTO 1916/90","COMPUTABLE"],["SG_","130","ADIC, DTO 1916/90","COMPUTABLE"],["SG_","130","ADIC, DTO 1946/90","COMPUTABLE"],["SG_","130","ADIC, DTO.1916/90","COMPUTABLE"],["SG_","8","ADIC, ESP NIV PRIM","COMPUTABLE"],["SG_","6","ADIC ART. 2 Y 3 DCR","COMPUTABLE"],["SG_","130","ADIC DTO 1016/00","COMPUTABLE"],["SG_","130","ADIC DTO 1916 P","COMPUTABLE"],["VI_","105","DEDIC.INTENSIVA","NO_COMPUTABLE"]];

    const PORCENTAJE_TOPE_ACTIVOS = 0.20; // Máximo afectable 80% sobre Subtotal1
    const PORCENTAJE_TOPE_PASIVOS = 0.35; // Máximo afectable 65% sobre Subtotal1

    const MULTIPLICADORES_ENDEUDAMIENTO = {
      6: 2.5,
      12: 5.0,
      18: 7.5,
      24: 10.0,
      36: 15.0,
      48: 20.0
    };

    const PLAZOS_POR_LINEA = {
      fedem: [6, 12, 18, 24, 36, 48],
      sidecreer: [6, 12, 18, 24, 36, 48],
      muni: [12, 24],
      quad: [12, 24]
    };

    const LUGARES_PASIVOS_PADRON = ['JU_', 'JU', 'JUB_'];
    const LUGARES_ACTIVOS_PADRON = ['GE_', 'GE', 'SG_', 'SG', 'PO_', 'SA_', 'SAL_', 'VI_'];

    const CODIGOS_VACIOS_PADRON = new Set([
      '', '-', '—', '–', '--', 'N/A', 'NA', 'S/C', 'SC', 'S/COD',
      'SIN CODIGO', 'SIN_CODIGO', 'SIN CÓDIGO', 'NULL', 'NONE', 'S/N', '0'
    ]);

    const ALIAS_LUGAR_TRABAJO_PADRON = {
      PO: 'PO_',
      POLICIA: 'PO_',
      SA: 'SA_',
      SAL: 'SAL_',
      SALUD: 'SA_',
      VI: 'VI_',
      VIALIDAD: 'VI_',
      JUB: 'JUB_',
      JUBILADO: 'JU_',
      JUBILADOS: 'JU_',
      PASIVO: 'JU_',
      PASIVOS: 'JU_',
      ACTIVO: 'GE_',
      ACTIVOS: 'GE_',
      DOCENTE: 'SG_',
      DOCENTES: 'SG_',
      EDUCACION: 'SG_'
    };

    const SIDECREER_RE_PADRON = /SIDECREER|SIDE\s*CRE(?:\s*E?\s*R)?|SI\s*DE\s*CRE(?:\s*E?\s*R)?|DE\s*CREER/;

    function round2Margen(n) {
      const val = Number(n ?? 0);
      if (!Number.isFinite(val) || val === 0) return 0;
      const rounded = Math.round((Math.abs(val) + 1e-11) * 100) / 100;
      if (rounded === 0) return 0;
      return val < 0 ? -rounded : rounded;
    }

    function normalizarClasificacion(clasif) {
      if (clasif === null || clasif === undefined) return '';
      const s = String(clasif).trim().toUpperCase().replace(/\s+/g, ' ');
      const compact = s.replace(/[\s_]+/g, '_').replace(/^_+|_+$/g, '');

      if (
        compact === 'SUBTOTAL_1' ||
        compact === 'SUB_TOTAL' ||
        compact === 'SUBTOTAL' ||
        compact === 'SUBTOTAL1' ||
        compact === 'SUB_TOTAL_1' ||
        /^SUB_?TOTAL(_?1)?$/.test(compact)
      ) {
        return 'SUBTOTAL_1';
      }
      if (
        compact === 'NO_COMPUTABLE' ||
        compact === 'NO_COMPUTAABLE' ||
        compact === 'NO_COMPUTBALE' ||
        compact === 'NOCOMPUTABLE' ||
        /^NO_?COMPUT[A-Z]*B[A-Z]*$/.test(compact)
      ) {
        return 'NO_COMPUTABLE';
      }
      if (
        compact === 'AFECTADO' ||
        compact === 'AFECTABLE' ||
        compact === 'AFECTABLES' ||
        compact === 'AFECATDO' ||
        compact === 'AFECTADOS' ||
        compact === 'AFECATDOS' ||
        /^AFEC[A-Z]*$/.test(compact)
      ) {
        return 'AFECTADO';
      }
      if (compact === 'COMPUTABLE' || compact === 'HABER_COMPUTABLE' || compact === 'HABERES_COMPUTABLES') {
        return 'COMPUTABLE';
      }
      return '';
    }

    function normalizarDescripcionPadron(txt) {
      if (!txt) return '';
      return String(txt)
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function esCodigoVacioPadron(cod) {
      if (cod === null || cod === undefined) return true;
      const s = String(cod).trim().toUpperCase();
      if (CODIGOS_VACIOS_PADRON.has(s)) return true;
      if (/^[-_.\s/—–]+$/.test(s)) return true;
      return false;
    }

    function normalizarCodigoLookupPadron(cod) {
      if (esCodigoVacioPadron(cod)) return '';
      const s = String(cod).trim().toUpperCase().replace(/\s+/g, '_');
      return CODIGOS_VACIOS_PADRON.has(s) ? '' : s;
    }

    function quitarSufijoCodigoPadron(codUp) {
      if (!codUp) return '';
      const sinSuf = codUp.replace(/(?:_|-|\s)+(R|A|D)$/i, '').replace(/^_+|_+$/g, '');
      return sinSuf || codUp;
    }

    function stripZerosPadron(c) {
      return String(c || '').replace(/^0+/, '') || String(c || '');
    }

    function limpiarNumeroPadron(val) {
      if (val === null || val === undefined || typeof val === 'boolean') return 0;
      if (typeof val === 'number') {
        return Number.isFinite(val) ? round2Margen(val) : 0;
      }
      let s = String(val).trim().replace(/[^0-9.,-]/g, '');
      if (!s || s === '-' || s === '.' || s === ',') return 0;
      const lc = s.lastIndexOf(',');
      const ld = s.lastIndexOf('.');
      if (lc !== -1 && ld !== -1) {
        if (lc > ld) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (lc !== -1) {
        if ((s.match(/,/g) || []).length > 1) {
          s = s.replace(/,/g, '');
        } else {
          s = s.replace(',', '.');
        }
      } else if ((s.match(/\./g) || []).length > 1) {
        s = s.replace(/\./g, '');
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? round2Margen(n) : 0;
    }

    let _INDICE_PADRON_AMMER_CACHE = null;

    function getIndicePadronAMMER() {
      if (_INDICE_PADRON_AMMER_CACHE) return _INDICE_PADRON_AMMER_CACHE;
      const registros = [];
      const porLugarCodigo = new Map();
      const porLugarCodigoStrip = new Map();
      const porCodigo = new Map();
      const porNombreNorm = new Map();
      const porNombreTokens = [];

      const rawList = (typeof PADRON_CODIGOS_AMMER !== 'undefined' && Array.isArray(PADRON_CODIGOS_AMMER))
        ? PADRON_CODIGOS_AMMER
        : [];

      for (let idx = 0; idx < rawList.length; idx++) {
        const entry = rawList[idx];
        const lugRaw = Array.isArray(entry) ? entry[0] : entry?.lugar_de_trabajo;
        const codRaw = Array.isArray(entry) ? entry[1] : entry?.codigo;
        const nomRaw = Array.isArray(entry) ? entry[2] : entry?.nombre;
        const clsRaw = Array.isArray(entry) ? entry[3] : entry?.clasificacion;
        const clasif = normalizarClasificacion(clsRaw);
        if (!clasif) continue;

        const lug = String(lugRaw || '').trim().toUpperCase();
        const cod = String(codRaw || '').trim().toUpperCase();
        const nomStr = String(nomRaw || '').trim();
        const nn = normalizarDescripcionPadron(nomStr);
        const reg = { lugar: lug, codigo: cod, nombre: nomStr, nombreNorm: nn, clasificacion: clasif };
        registros.push(reg);

        if (cod) {
          const variantes = new Set([cod]);
          if (cod.includes(' ')) {
            variantes.add(cod.replace(/\s+/g, '_'));
            variantes.add(cod.replace(/\s+/g, ''));
          }
          for (const vc of Array.from(variantes)) {
            variantes.add(stripZerosPadron(vc));
          }
          for (const vc of variantes) {
            const k = lug + '|' + vc;
            let arr = porLugarCodigo.get(k);
            if (arr) arr.push(reg);
            else porLugarCodigo.set(k, [reg]);

            let arrCod = porCodigo.get(vc);
            if (arrCod) arrCod.push(reg);
            else porCodigo.set(vc, [reg]);
          }

          const codStrip = cod.replace(/^_+|_+$/g, '');
          if (codStrip) {
            const vStrip = new Set([codStrip, stripZerosPadron(codStrip)]);
            for (const vcs of vStrip) {
              const ks = lug + '|' + vcs;
              let arrs = porLugarCodigoStrip.get(ks);
              if (arrs) arrs.push(reg);
              else porLugarCodigoStrip.set(ks, [reg]);
            }
          }
        }
        if (nn && nn !== 'NAME' && nn.length >= 4) {
          let arrN = porNombreNorm.get(nn);
          if (arrN) arrN.push(reg);
          else porNombreNorm.set(nn, [reg]);

          const toks = new Set(nn.split(' ').filter(t => t.length >= 2));
          if (toks.size > 0) {
            porNombreTokens.push({ toks, r: reg });
          }
        }
      }

      _INDICE_PADRON_AMMER_CACHE = {
        registros,
        porLugarCodigo,
        porLugarCodigoStrip,
        porCodigo,
        porNombreNorm,
        porNombreTokens
      };
      return _INDICE_PADRON_AMMER_CACHE;
    }

    function mostCommonClasifPadron(items) {
      const counts = new Map();
      let best = items[0] || '';
      let bestCount = -1;
      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        const nxt = (counts.get(c) || 0) + 1;
        counts.set(c, nxt);
        if (nxt > bestCount) {
          bestCount = nxt;
          best = c;
        }
      }
      return best;
    }

    function resolverSegmentoBeneficiario(meta) {
      const m = meta || {};
      const overrideRaw = String(m.regimenOverride || m.tipoBeneficiarioOverride || '').trim().toUpperCase();
      const lugRaw = String(m.lugar_de_trabajo || m.lugarTrabajo || '').trim().toUpperCase();
      const lugNorm = ALIAS_LUGAR_TRABAJO_PADRON[lugRaw] || lugRaw;
      const textoCtx = [
        lugRaw,
        lugNorm,
        String(m.tipoRecibo || ''),
        String(m.formatoRecibo || m.formato || ''),
        String(m.organismo || ''),
        String(m.situacionRevista || ''),
        String(m.condicion || ''),
        String(m.cargo || m.escalafonCargo || '')
      ].join(' ').toUpperCase();

      const sitRev = String(m.situacionRevista || '').toUpperCase();
      const orgStr = String(m.organismo || '').toUpperCase();
      const esActivoExplicito = /\bACTIVO\b/.test(sitRev) && !orgStr.includes('CAJA DE JUB') && !LUGARES_PASIVOS_PADRON.includes(lugNorm);

      let esPasivo;
      if (overrideRaw === 'PASIVO') {
        esPasivo = true;
      } else if (overrideRaw === 'ACTIVO') {
        esPasivo = false;
      } else {
        esPasivo = LUGARES_PASIVOS_PADRON.includes(lugNorm) || (
          /(?:JU_|JUB_|CAJA\s+DE\s+JUB|RECIBOS?\s+JUBILAD|\bJUBILAD|\bPENSIONAD|\bPASIV)/.test(textoCtx) &&
          !esActivoExplicito
        );
      }

      if (esPasivo) {
        const lugarPrincipal = LUGARES_PASIVOS_PADRON.includes(lugNorm) ? lugNorm : 'JU_';
        const pares = lugarPrincipal !== 'JUB_' ? ['JU_', 'JU', 'JUB_'] : ['JUB_', 'JU_', 'JU'];
        const orden = [];
        [lugarPrincipal].concat(pares, LUGARES_PASIVOS_PADRON).forEach(l => {
          if (l && !orden.includes(l)) orden.push(l);
        });
        return {
          esPasivo: true,
          tipoBeneficiario: 'PASIVO',
          etiquetaBeneficiario: 'Pasivos / Jubilados (65% afectable · Tope 35%)',
          porcentajeTope: PORCENTAJE_TOPE_PASIVOS,
          porcentajeAfectableMaximo: 0.65,
          lugarPrincipal,
          lugaresOrden: orden,
          lugaresFallback: LUGARES_ACTIVOS_PADRON
        };
      }

      let lugarPrincipal = 'GE_';
      if (LUGARES_ACTIVOS_PADRON.includes(lugNorm)) {
        lugarPrincipal = lugNorm;
      } else if (/POLIC|SEGURID|PENITENCIAR|\bPO_/.test(textoCtx)) {
        lugarPrincipal = 'PO_';
      } else if (/SALUD|HOSPITAL|ENFERM|MEDICO|\bSA_|SAL_/.test(textoCtx)) {
        lugarPrincipal = 'SA_';
      } else if (/EDUCAC|\bCGE\b|DOCENT|ESCUEL|UADER|\bSG_/.test(textoCtx)) {
        lugarPrincipal = 'SG_';
      } else if (/VIALIDAD|\bVI_/.test(textoCtx)) {
        lugarPrincipal = 'VI_';
      }

      let paresPref = [];
      if (lugarPrincipal === 'SA_' || lugarPrincipal === 'SAL_') {
        paresPref = ['SA_', 'SAL_'];
      } else if (lugarPrincipal === 'GE_' || lugarPrincipal === 'GE') {
        paresPref = ['GE_', 'GE'];
      } else if (lugarPrincipal === 'SG_' || lugarPrincipal === 'SG') {
        paresPref = ['SG_', 'SG'];
      }

      const orden = [];
      [lugarPrincipal].concat(paresPref, LUGARES_ACTIVOS_PADRON).forEach(l => {
        if (l && !orden.includes(l)) orden.push(l);
      });
      return {
        esPasivo: false,
        tipoBeneficiario: 'ACTIVO',
        etiquetaBeneficiario: 'Activos (80% afectable · Tope 20%)',
        porcentajeTope: PORCENTAJE_TOPE_ACTIVOS,
        porcentajeAfectableMaximo: 0.80,
        lugarPrincipal,
        lugaresOrden: orden,
        lugaresFallback: LUGARES_PASIVOS_PADRON
      };
    }

    function resolverConflictoFilasPadron(filas, codigoNorm, descNorm, side) {
      if (!filas || filas.length === 0) return null;

      const codSinSuf = quitarSufijoCodigoPadron(codigoNorm);
      const codBase = codSinSuf.replace(/^0+/, '') || codigoNorm.replace(/^_+|_+$/g, '');

      if (side !== 'HABER') {
        if (/EMBARGO|LITIS|JUDICIAL|OFICIO/.test(descNorm)) return 'AFECTADO';
        if (codBase === '136' && descNorm.includes('DEUDA')) return 'AFECTADO';
        if (
          ['366', '368', '412', '491', '960', '1117'].includes(codBase) &&
          (!descNorm || SIDECREER_RE_PADRON.test(descNorm) || /BERSA|FEDEM|MUPER/.test(descNorm))
        ) {
          return 'AFECTADO';
        }
        if (codBase === '812' && SIDECREER_RE_PADRON.test(descNorm)) return 'AFECTADO';
        if (codBase === '829' && (descNorm.includes('MUPER') || !descNorm)) return 'AFECTADO';
        if (codBase === '1115' && descNorm.includes('FEDEM')) return 'AFECTADO';
        if (codBase === '480' && descNorm.includes('BERSA')) return 'AFECTADO';
        if (codBase === '339' && (descNorm.includes('CREDITO') || descNorm.includes('PREST'))) return 'AFECTADO';
        if (codBase === '339' && (descNorm.includes('SOCIET') || descNorm.includes('APORTE'))) return 'SUBTOTAL_1';
        if (codBase === '502' && (descNorm.includes('JUB') || descNorm.includes('APORTE') || !descNorm)) return 'SUBTOTAL_1';
      }
      if (side !== 'DESCUENTO' && codBase === '100') {
        if (/ANUAL|SAC|AGUINALDO/.test(descNorm)) return 'NO_COMPUTABLE';
        if (descNorm.includes('BASICO')) return 'COMPUTABLE';
      }

      let candidatas = filas;
      if (side === 'HABER') {
        const soloHab = filas.filter(r => r.clasificacion === 'COMPUTABLE' || r.clasificacion === 'NO_COMPUTABLE');
        if (soloHab.length === 0) return null;
        candidatas = soloHab;
      } else if (side === 'DESCUENTO') {
        const soloDesc = filas.filter(r => r.clasificacion !== 'COMPUTABLE');
        if (soloDesc.length === 0) return null;
        candidatas = soloDesc;
      }

      const clasesUnicas = new Set(candidatas.map(r => r.clasificacion));
      if (clasesUnicas.size === 1) {
        return candidatas[0].clasificacion;
      }

      if (descNorm) {
        const exactasDesc = candidatas.filter(r => r.nombreNorm === descNorm).map(r => r.clasificacion);
        if (exactasDesc.length > 0) {
          return mostCommonClasifPadron(exactasDesc);
        }
      }

      const dtok = new Set(descNorm.split(' ').filter(t => t.length >= 2));
      if (dtok.size > 0) {
        const scored = [];
        for (let i = 0; i < candidatas.length; i++) {
          const r = candidatas[i];
          const rn = r.nombreNorm;
          if (!rn || rn === 'NAME') {
            scored.push({ sim: 0, clasif: r.clasificacion });
            continue;
          }
          const rtok = new Set(rn.split(' ').filter(t => t.length >= 2));
          let inter = 0;
          for (const t of dtok) {
            if (rtok.has(t)) inter++;
          }
          const union = dtok.size + rtok.size - inter || 1;
          let sim = inter / union;
          if (descNorm === rn) {
            sim = 1.5;
          } else if ((descNorm.includes(rn) || rn.includes(descNorm)) && dtok.size >= 1 && rtok.size >= 1) {
            sim = Math.max(sim, 0.55 + 0.35 * (Math.min(dtok.size, rtok.size) / Math.max(dtok.size, rtok.size)));
          }
          scored.push({ sim, clasif: r.clasificacion });
        }

        const maxSim = scored.reduce((m, x) => (x.sim > m ? x.sim : m), 0);
        if (maxSim >= 0.35) {
          const top = scored.filter(x => x.sim >= maxSim * 0.85).map(x => x.clasif);
          return mostCommonClasifPadron(top);
        }
      }

      return mostCommonClasifPadron(candidatas.map(r => r.clasificacion));
    }

    function buscarPorDescripcionPadron(descNorm, side, seg) {
      if (!descNorm) return { clasif: null, metodo: '' };
      const idx = getIndicePadronAMMER();

      const exactas = idx.porNombreNorm.get(descNorm) || [];
      if (exactas.length > 0) {
        const filtradas = exactas.filter(r => seg.lugaresOrden.includes(r.lugar));
        const prioridad = filtradas.length > 0 ? filtradas : exactas;
        const cls = resolverConflictoFilasPadron(prioridad, '', descNorm, side);
        if (cls) return { clasif: cls, metodo: 'DESCRIPCION_EXACTA_PADRON' };
      }

      const dtok = new Set(descNorm.split(' ').filter(t => t.length >= 2));
      if (dtok.size >= 2) {
        const mejores = [];
        let mejorSim = 0;
        for (let i = 0; i < idx.porNombreTokens.length; i++) {
          const entry = idx.porNombreTokens[i];
          const rtok = entry.toks;
          const r = entry.r;
          if (side === 'HABER' && r.clasificacion !== 'COMPUTABLE' && r.clasificacion !== 'NO_COMPUTABLE') continue;
          if (side === 'DESCUENTO' && r.clasificacion === 'COMPUTABLE') continue;
          let inter = 0;
          for (const t of dtok) {
            if (rtok.has(t)) inter++;
          }
          if (inter === 0) continue;
          const sim = inter / (dtok.size + rtok.size - inter);
          if (sim >= 0.65) {
            if (sim > mejorSim) mejorSim = sim;
            mejores.push({ sim, r });
          }
        }
        if (mejores.length > 0) {
          const top = mejores.filter(x => x.sim >= mejorSim * 0.90).map(x => x.r.clasificacion);
          return { clasif: mostCommonClasifPadron(top), metodo: 'DESCRIPCION_SIMILITUD_PADRON' };
        }
      }

      if (side !== 'HABER') {
        if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descNorm)) {
          return { clasif: 'AFECTADO', metodo: 'DESCRIPCION_PATRON_EMBARGO' };
        }
        if (
          SIDECREER_RE_PADRON.test(descNorm) ||
          /FEDEM|BERSA|BANCO ENTRE RIOS|MUPER.*CRED|PROVEED.*MUPER|PRESTAMO|MUTUAL MODELO.*AYUD|CUOTA CRED/.test(descNorm)
        ) {
          return { clasif: 'AFECTADO', metodo: 'DESCRIPCION_PATRON_FINANCIERO' };
        }
        if (/JUBILAC|APORTE.*JUB|CAJA.*JUB|IOSPER|OSER|OBRA SOCIAL|SISER|IAPS|IAPV|ALIMENTARI|SINDICAL|GREMIAL|APORTE.*PERSON|SEGURO.*VIDA.*OBLIG|CUOTA SOCIAL.*MODELO|A\s*M\s*MODELO|APLER/.test(descNorm)) {
          return { clasif: 'SUBTOTAL_1', metodo: 'DESCRIPCION_PATRON_LEY' };
        }
      }
      if (side !== 'DESCUENTO') {
        if (/SALARIO FLIAR|SAL FLIAR|SALARIO FAMILIAR|ASIGNAC.*FAM|AYUDA ESCOLAR|PRENATAL|NACIMIENTO|MATRIMONIO|NO REMUN|SUMA FIJA NO REM|SUELDO ANUAL COMP|\bSAC\b|AGUINALDO/.test(descNorm)) {
          return { clasif: 'NO_COMPUTABLE', metodo: 'DESCRIPCION_PATRON_NO_COMP' };
        }
      }

      return { clasif: null, metodo: '' };
    }

    function clasificarItemsRecibo(items, lugarTrabajo, metaRecibo) {
      const idx = getIndicePadronAMMER();
      const meta = Object.assign({}, metaRecibo || {});
      if (lugarTrabajo && !meta.regimenOverride) meta.lugar_de_trabajo = lugarTrabajo;
      const seg = resolverSegmentoBeneficiario(meta);
      const out = [];

      for (let k = 0; k < (items || []).length; k++) {
        const item = items[k];
        if (!item || typeof item !== 'object') continue;
        const codigoRaw = String(item.codigo !== undefined && item.codigo !== null ? item.codigo : '').trim();
        const codigoVacio = esCodigoVacioPadron(codigoRaw);
        const codigo = codigoVacio ? '' : codigoRaw;
        const desc = String(item.descripcion || item.concepto || item.detalle || item.nombre || '').trim();

        const habRaw = item.haberes !== undefined ? item.haberes : (item.montoHaber !== undefined ? item.montoHaber : item.importeHaber);
        const descRaw = item.descuentos !== undefined ? item.descuentos : (item.retenciones !== undefined ? item.retenciones : (item.montoDescuento !== undefined ? item.montoDescuento : item.importeDescuento));

        let habNum = (habRaw !== undefined && habRaw !== null) ? Math.abs(limpiarNumeroPadron(habRaw)) : 0;
        let descNum = (descRaw !== undefined && descRaw !== null) ? Math.abs(limpiarNumeroPadron(descRaw)) : 0;

        const montoUnicoRaw = item.importe !== undefined ? item.importe : item.monto;
        const montoUnico = (montoUnicoRaw !== undefined && montoUnicoRaw !== null) ? limpiarNumeroPadron(montoUnicoRaw) : null;

        const clasifExplicita = normalizarClasificacion(item.clasificacion);
        const tipoIn = String(item.tipo || item.columna || '').trim().toUpperCase();

        let side = null;
        if (habNum > 0 && descNum === 0) {
          side = 'HABER';
        } else if (descNum > 0 && habNum === 0) {
          side = 'DESCUENTO';
        } else if (tipoIn.includes('DESC') || tipoIn.includes('RETEN') || tipoIn.includes('DEDU')) {
          side = 'DESCUENTO';
        } else if (tipoIn.includes('HAB') || tipoIn.includes('REMUN')) {
          side = 'HABER';
        } else if (montoUnico !== null && montoUnico < 0) {
          side = 'DESCUENTO';
        }

        if (habNum === 0 && descNum === 0 && montoUnico !== null && montoUnico !== 0) {
          const absU = Math.abs(montoUnico);
          if (side === 'DESCUENTO' || clasifExplicita === 'SUBTOTAL_1' || clasifExplicita === 'AFECTADO') {
            descNum = absU;
            side = 'DESCUENTO';
          } else if (side === 'HABER' || clasifExplicita === 'COMPUTABLE' || clasifExplicita === 'NO_COMPUTABLE') {
            habNum = absU;
            side = 'HABER';
          }
        }

        const importeAbs = (montoUnico !== null && habNum === 0 && descNum === 0)
          ? round2Margen(Math.abs(montoUnico))
          : round2Margen(habNum + descNum);

        const codigoUp = normalizarCodigoLookupPadron(codigo);
        const descNorm = normalizarDescripcionPadron(desc);
        let clasifFinal = clasifExplicita;
        let metodo = clasifExplicita ? 'EXPLICITA_NORMALIZADA' : '';
        let lugarMatch = '';

        if (!clasifFinal && codigoUp) {
          const codNz = stripZerosPadron(codigoUp);
          const codStrip = codigoUp.replace(/^_+|_+$/g, '');
          const codStripNz = stripZerosPadron(codStrip);
          const codSinSuf = quitarSufijoCodigoPadron(codigoUp);
          const codSinSufNz = stripZerosPadron(codSinSuf);

          const EQUIV_GRUPOS = [
            ['GE_', 'GE'],
            ['SG_', 'SG'],
            ['SA_', 'SAL_'],
            ['JU_', 'JU', 'JUB_']
          ];

          const agruparLugares = (lugaresLista) => {
            const grupos = [];
            const vistos = new Set();
            for (let li = 0; li < lugaresLista.length; li++) {
              const lug = lugaresLista[li];
              if (vistos.has(lug)) continue;
              const grupo = [lug];
              for (let ei = 0; ei < EQUIV_GRUPOS.length; ei++) {
                const eq = EQUIV_GRUPOS[ei];
                if (eq.includes(lug)) {
                  for (let ej = 0; ej < eq.length; ej++) {
                    const e = eq[ej];
                    if (lugaresLista.includes(e) && !grupo.includes(e)) {
                      grupo.push(e);
                    }
                  }
                  break;
                }
              }
              for (let gi = 0; gi < grupo.length; gi++) vistos.add(grupo[gi]);
              grupos.push(grupo);
            }
            return grupos;
          };

          const buscarListaLugares = (lugaresLista, cands, idxMap, met) => {
            const grupos = agruparLugares(lugaresLista);
            for (let gi = 0; gi < grupos.length; gi++) {
              const grupo = grupos[gi];
              for (let ci = 0; ci < cands.length; ci++) {
                const codCand = cands[ci];
                if (!codCand) continue;
                const filas = [];
                for (let li = 0; li < grupo.length; li++) {
                  const f = idxMap.get(grupo[li] + '|' + codCand);
                  if (f && f.length > 0) {
                    for (let fi = 0; fi < f.length; fi++) filas.push(f[fi]);
                  }
                }
                if (filas.length > 0) {
                  const c = resolverConflictoFilasPadron(filas, codCand, descNorm, side);
                  if (c) {
                    clasifFinal = c;
                    metodo = met;
                    const mejorFila =
                      filas.find(r => r.clasificacion === c && r.nombreNorm === descNorm) ||
                      filas.find(r => r.clasificacion === c);
                    lugarMatch = mejorFila ? mejorFila.lugar : grupo[0];
                    return true;
                  }
                }
              }
            }
            return false;
          };

          if (!buscarListaLugares(seg.lugaresOrden, [codigoUp, codNz], idx.porLugarCodigo, 'PADRON_CODIGO_EXACTO')) {
            if (!codigoUp.endsWith('_')) {
              buscarListaLugares(seg.lugaresOrden, [codStrip, codStripNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_EXACTO');
            }
          }

          if (!clasifFinal && (codigoUp.includes('_') || codigoUp !== codSinSuf)) {
            buscarListaLugares(seg.lugaresFallback, [codigoUp, codNz], idx.porLugarCodigo, 'PADRON_CODIGO_CROSS');
          }

          if (!clasifFinal && (codSinSuf !== codigoUp || codSinSufNz !== codNz)) {
            buscarListaLugares(seg.lugaresOrden, [codSinSuf, codSinSufNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_SIN_SUFIJO');
          }

          if (!clasifFinal) {
            if (!buscarListaLugares(seg.lugaresFallback, [codStrip, codStripNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS')) {
              if (codSinSuf !== codigoUp || codSinSufNz !== codNz) {
                buscarListaLugares(seg.lugaresFallback, [codSinSuf, codSinSufNz], idx.porLugarCodigoStrip, 'PADRON_CODIGO_CROSS_SIN_SUFIJO');
              }
            }
          }
        }

        if (!clasifFinal && descNorm) {
          const resDesc = buscarPorDescripcionPadron(descNorm, side, seg);
          if (resDesc.clasif) {
            clasifFinal = resDesc.clasif;
            metodo = resDesc.metodo;
          }
        }

        if (!clasifFinal) {
          if (side === 'HABER' || (side === null && descNum === 0 && montoUnico !== null && montoUnico > 0 && habNum >= 0)) {
            clasifFinal = 'COMPUTABLE';
            metodo = 'HABER_DEFAULT_COMPUTABLE';
          } else if (side === 'DESCUENTO') {
            clasifFinal = 'SIN_CLASIFICAR';
            metodo = 'SIN_CLASIFICAR';
          } else {
            clasifFinal = 'COMPUTABLE';
            metodo = 'DEFAULT_COMPUTABLE';
          }
        }

        const tipoFinal = side || ((clasifFinal === 'SUBTOTAL_1' || clasifFinal === 'AFECTADO' || clasifFinal === 'SIN_CLASIFICAR') ? 'DESCUENTO' : 'HABER');
        if (side === null) {
          if (tipoFinal === 'DESCUENTO' && descNum === 0 && importeAbs > 0) descNum = importeAbs;
          if (tipoFinal === 'HABER' && habNum === 0 && importeAbs > 0) habNum = importeAbs;
        }

        out.push({
          codigo,
          descripcion: desc,
          tipo: tipoFinal,
          haberes: round2Margen(habNum),
          descuentos: round2Margen(descNum),
          importe: round2Margen(importeAbs),
          clasificacion: clasifFinal,
          metodoClasificacion: metodo,
          lugarPadronMatch: lugarMatch || seg.lugarPrincipal,
          origenRecibo: item.origenRecibo ? String(item.origenRecibo) : ''
        });
      }

      return out;
    }

    function sumaAbsPadron(items) {
      let total = 0;
      for (let i = 0; i < (items || []).length; i++) {
        const it = items[i];
        let val = Number(it.importe || 0);
        if (!val) val = Number(it.descuentos || 0) || Number(it.haberes || 0);
        total += Math.abs(val);
      }
      return round2Margen(total);
    }

    function calcularMargenRecibo(datosRecibo) {
      const d = datosRecibo || {};
      const seg = resolverSegmentoBeneficiario(d);
      const porcentajeTope = seg.porcentajeTope;

      const itemsRaw = Array.isArray(d.items) ? d.items : (Array.isArray(d.conceptos) ? d.conceptos : []);
      const itemsClasif = clasificarItemsRecibo(itemsRaw, d.regimenOverride ? null : seg.lugarPrincipal, d);

      const sumItemsHab = round2Margen(
        itemsClasif.reduce((acc, i) => acc + Math.abs(i.haberes || (i.tipo === 'HABER' ? i.importe : 0)), 0)
      );
      const sumItemsDesc = round2Margen(
        itemsClasif.reduce((acc, i) => acc + Math.abs(i.descuentos || (i.tipo === 'DESCUENTO' ? i.importe : 0)), 0)
      );

      const sinHeaderHab = d.total_haberes == null && d.sueldoBrutoTotal == null && d.sueldoBruto == null;
      const sinHeaderDesc = d.total_descuentos == null && d.totalDescuentos == null && d.totalDescuentosRecibo == null;
      const sinHeaderLiq = d.liquido == null && d.sueldoLiquido == null && d.sueldoNeto == null;

      const totalHaberes = (sinHeaderHab && itemsClasif.length > 0)
        ? sumItemsHab
        : round2Margen(limpiarNumeroPadron(d.total_haberes ?? d.sueldoBrutoTotal ?? d.sueldoBruto ?? 0));
      const totalDescuentosIn = (sinHeaderDesc && itemsClasif.length > 0)
        ? sumItemsDesc
        : round2Margen(limpiarNumeroPadron(d.total_descuentos ?? d.totalDescuentos ?? d.totalDescuentosRecibo ?? 0));
      const liquido = (sinHeaderLiq && (totalHaberes > 0 || itemsClasif.length > 0))
        ? round2Margen(totalHaberes - Math.abs(totalDescuentosIn))
        : round2Margen(limpiarNumeroPadron(d.liquido ?? d.sueldoLiquido ?? d.sueldoNeto ?? 0));
      const cuotaFutura2 = round2Margen(Math.abs(limpiarNumeroPadron(d.cuota_futura_2 ?? d.cuotaFutura2 ?? 0)));
      const cuotaRefinanciarIn = round2Margen(Math.abs(limpiarNumeroPadron(d.cuota_refinanciar ?? d.cuotaRefinanciar ?? 0)));
      const saldoCancelar = round2Margen(Math.abs(limpiarNumeroPadron(d.saldo_cancelar ?? d.saldoCancelar ?? 0)));
      const saldoVigenteExterno = round2Margen(Math.abs(limpiarNumeroPadron(d.saldo_vigente_externo ?? d.saldoVigenteExterno ?? 0)));
      const detalleRefinanciacion = String(d.detalle_refinanciacion ?? d.detalleRefinanciacion ?? '').trim();
      const factorMargenRaw = limpiarNumeroPadron(d.factor_margen ?? d.factorMargen ?? 1.0);
      const factorMargen = (factorMargenRaw > 0 && factorMargenRaw <= 1.0) ? Number(factorMargenRaw.toFixed(4)) : 1.0;

      // PASO 1: Validaciones de consistencia de cabecera
      const liquidoEsperado = round2Margen(totalHaberes - Math.abs(totalDescuentosIn));
      const diferenciaCabecera = round2Margen(liquido - liquidoEsperado);
      const cabeceraConsistente = Math.abs(diferenciaCabecera) <= 0.01;

      const diffHab = itemsClasif.length > 0 ? round2Margen(totalHaberes - sumItemsHab) : 0;
      const diffDesc = itemsClasif.length > 0 ? round2Margen(Math.abs(totalDescuentosIn) - sumItemsDesc) : 0;

      const itemsCero = itemsClasif.filter(i => round2Margen(i.importe || 0) === 0);
      const itemsSinCodigo = itemsClasif.filter(i => esCodigoVacioPadron(i.codigo));
      const itemsSinClasif = itemsClasif.filter(i => i.clasificacion === 'SIN_CLASIFICAR');

      const fmtP = (typeof formatPesosMargen === 'function') ? formatPesosMargen : (v => '$ ' + formatMontoSinSimboloAr(v));
      const alertas = [];
      if (totalHaberes > 0 && !cabeceraConsistente) {
        alertas.push(
          'Diferencia en cabecera del recibo: Total Haberes - Total Descuentos = ' + fmtP(liquidoEsperado) +
          ' vs Líquido informado ' + fmtP(liquido) + ' (diferencia: ' + fmtP(diferenciaCabecera) + ').'
        );
      }
      if (itemsClasif.length > 0 && totalHaberes > 0 && Math.abs(diffHab) > 0.01) {
        alertas.push(
          'La suma de ítems de Haberes (' + fmtP(sumItemsHab) + ') difiere del Total Haberes de cabecera (' + fmtP(totalHaberes) + ') en ' + fmtP(diffHab) + '.'
        );
      }
      if (itemsClasif.length > 0 && Math.abs(totalDescuentosIn) > 0 && Math.abs(diffDesc) > 0.01) {
        alertas.push(
          'La suma de ítems de Descuentos (' + fmtP(sumItemsDesc) + ') difiere del Total Descuentos de cabecera (' + fmtP(Math.abs(totalDescuentosIn)) + ') en ' + fmtP(diffDesc) + '.'
        );
      }
      if (itemsCero.length > 0) {
        const detalleCero = itemsCero.map(it => (it.codigo ? ('Cód. ' + it.codigo) : 'S/C') + (it.descripcion ? (' (' + it.descripcion + ')') : '')).join(', ');
        alertas.push('Se detectaron ' + itemsCero.length + ' ítem(s) con importe $0,00 en el detalle: ' + detalleCero + '.');
      }
      if (itemsSinCodigo.length > 0) {
        alertas.push('Se detectaron ' + itemsSinCodigo.length + ' ítem(s) sin código numérico asignado (clasificados por descripción).');
      }
      if (itemsSinClasif.length > 0) {
        alertas.push('Hay ' + itemsSinClasif.length + ' descuento(s) sin código registrado en el padrón oficial.');
      }

      // PASO 2: Subtotal1
      const totalSubtotal1Desc = sumaAbsPadron(itemsClasif.filter(i => i.clasificacion === 'SUBTOTAL_1' && i.tipo !== 'HABER'));
      const subtotal1 = round2Margen(totalHaberes - totalSubtotal1Desc);

      // PASO 3: Subtotal_tope y Subtotal2
      const subtotalTope = round2Margen(subtotal1 * porcentajeTope);
      const subtotal2 = round2Margen(subtotal1 - subtotalTope);

      // PASO 4: Total_no_computable y Afectable
      const totalNoComputable = sumaAbsPadron(itemsClasif.filter(i => i.clasificacion === 'NO_COMPUTABLE' && i.tipo !== 'DESCUENTO'));
      const afectable = round2Margen(subtotal2 - totalNoComputable);

      // PASO 5: Afectado, Refinanciación y Margen Disponible del Recibo
      const totalAfectado = sumaAbsPadron(itemsClasif.filter(i => i.clasificacion === 'AFECTADO' && i.tipo !== 'HABER'));
      const cuotaRefinanciarAplicada = round2Margen(Math.min(totalAfectado, cuotaRefinanciarIn));
      const totalAfectadoEfectivo = round2Margen(Math.max(0, totalAfectado - cuotaRefinanciarAplicada));
      const margenSinFutura2 = round2Margen(afectable - totalAfectadoEfectivo);
      const disponibleReciboOriginal = round2Margen(afectable - totalAfectado - cuotaFutura2);
      const disponibleBrutoRecibo = round2Margen(margenSinFutura2 - cuotaFutura2);
      const disponibleRecibo = (factorMargen < 1 && disponibleBrutoRecibo > 0)
        ? round2Margen(disponibleBrutoRecibo * factorMargen)
        : disponibleBrutoRecibo;

      const sinDisponible = (margenSinFutura2 <= 0) || (disponibleRecibo <= 0);
      const estado = sinDisponible ? 'SIN_DISPONIBLE' : 'DISPONIBLE';
      const estadoLabel = sinDisponible ? 'SIN Disponible' : 'DISPONIBLE';

      const topeEndeud4167 = round2Margen((5.0 * Math.max(0, liquido)) / 12.0);
      const cuotaSeguraGeneral = sinDisponible ? 0 : round2Margen(Math.min(disponibleRecibo, topeEndeud4167));

      const resumenClasificaciones = {};
      for (let i = 0; i < itemsClasif.length; i++) {
        const it = itemsClasif[i];
        resumenClasificaciones[it.clasificacion] = (resumenClasificaciones[it.clasificacion] || 0) + 1;
      }

      return {
        esCalculoPadron: true,
        estado,
        estadoLabel,
        puedeOfrecerCuotas: !sinDisponible,
        tipoBeneficiario: seg.tipoBeneficiario,
        etiquetaBeneficiario: seg.etiquetaBeneficiario,
        lugarTrabajo: seg.lugarPrincipal,
        porcentajeTope,
        porcentajeAfectableMaximo: seg.porcentajeAfectableMaximo,
        totalHaberes,
        totalDescuentos: Math.abs(totalDescuentosIn),
        netoLiquido: liquido,
        liquido,
        totalSubtotal1Desc,
        subtotal1,
        subtotalTope,
        subtotal_tope: subtotalTope,
        subtotal2,
        totalNoComputable,
        total_no_computable: totalNoComputable,
        afectable,
        totalAfectado,
        totalAfectadoEfectivo,
        cuotaRefinanciar: cuotaRefinanciarAplicada,
        cuotaRefinanciarSolicitada: cuotaRefinanciarIn,
        saldoCancelar,
        saldoVigenteExterno,
        detalleRefinanciacion,
        factorMargen,
        cuotaFutura2,
        margenSinFutura2,
        disponibleReciboOriginal,
        disponibleBrutoRecibo,
        disponibleRecibo,
        margen: disponibleRecibo,
        topeEndeudamientoMensual4167: topeEndeud4167,
        cuotaMaximaSeguraGeneral: cuotaSeguraGeneral,
        limitadoPor: sinDisponible
          ? 'SIN_DISPONIBLE'
          : (disponibleRecibo <= topeEndeud4167 ? 'MARGEN_RECIBO' : 'TOPE_ENDEUDAMIENTO_LIQUIDO'),
        validaciones: {
          cabeceraConsistente,
          liquidoEsperado,
          liquidoInformado: liquido,
          diferenciaCabecera,
          tieneDesgloseItems: itemsClasif.length > 0,
          sumaItemsHaberes: sumItemsHab,
          diferenciaHaberes: diffHab,
          sumaItemsDescuentos: sumItemsDesc,
          diferenciaDescuentos: diffDesc,
          cantidadItemsImporteCero: itemsCero.length,
          cantidadItemsSinCodigo: itemsSinCodigo.length,
          cantidadItemsSinClasificar: itemsSinClasif.length
        },
        alertas,
        resumenClasificaciones,
        items: itemsClasif
      };
    }

    function calcularOfertasPorPlazo(disponibleRecibo, liquido, lineaCredito = 'fedem', opts = {}) {
      if (disponibleRecibo <= 0 || liquido <= 0 || typeof MOTOR_FINANCIERO_EXACTO === 'undefined') return [];
      const o = opts || {};
      const lineaNorm = String(lineaCredito || 'fedem').trim().toLowerCase();
      const key = (lineaNorm.includes('muni') || lineaNorm.includes('quad'))
        ? 'muni'
        : (lineaNorm.includes('side') ? 'sidecreer' : 'fedem');

      const saldoCanc = round2Margen(Math.max(0, Number(o.saldoCancelar || 0)));
      const saldoExt = round2Margen(Math.max(0, Number(o.saldoVigenteExterno || 0)));
      const cuotaRef = round2Margen(Math.max(0, Number(o.cuotaRefinanciar || 0)));

      const plazos = PLAZOS_POR_LINEA[key] || [6, 12, 18, 24, 36, 48];
      const ofertas = [];
      for (let i = 0; i < plazos.length; i++) {
        const plazo = plazos[i];
        const mult = MULTIPLICADORES_ENDEUDAMIENTO[plazo];
        const topeCuotaBase = round2Margen((mult * liquido) / plazo);
        const topeCuotaConSaldo = saldoExt > 0 ? round2Margen(Math.max(0, (mult * liquido - saldoExt) / plazo)) : topeCuotaBase;
        const topeCuota = Math.min(topeCuotaBase, topeCuotaConSaldo);
        const topeCompromiso = round2Margen(mult * liquido);
        const cuotaMaxReal = round2Margen(Math.min(disponibleRecibo, topeCuota));
        if (cuotaMaxReal <= 0) continue;

        let calc = null;
        if (key === 'muni') {
          calc = MOTOR_FINANCIERO_EXACTO.calcularMunicipalesDesdeCuota(cuotaMaxReal, plazo);
        } else if (key === 'sidecreer') {
          calc = MOTOR_FINANCIERO_EXACTO.calcularSidecreerDesdeCuota(cuotaMaxReal, plazo);
        } else {
          calc = MOTOR_FINANCIERO_EXACTO.calcularFEDEMDesdeCuota(cuotaMaxReal, plazo);
        }
        if (!calc || !Number.isFinite(calc.neto) || calc.neto <= 0) continue;

        const netoR = round2Margen(calc.neto);
        const cuotaR = round2Margen(calc.cuotaFinal);
        const capBrutoR = round2Margen(calc.capitalBruto || 0);
        const totalR = round2Margen(calc.totalPagar || (calc.cuotaFinal * plazo));
        const limitadoPor = disponibleRecibo <= topeCuota
          ? 'MARGEN_RECIBO'
          : ((saldoExt > 0 && topeCuotaConSaldo < topeCuotaBase) ? 'TOPE_ENDEUDAMIENTO_CON_SALDO' : 'TOPE_ENDEUDAMIENTO');
        const netoBolsillo = round2Margen(netoR - saldoCanc);
        const alivioMensual = cuotaRef > 0 ? round2Margen(cuotaRef - cuotaR) : 0;

        ofertas.push({
          plazo,
          linea: key,
          multiplicador: mult,
          porcentajeNetoLiquido: 41.67,
          topeEndeudamientoCuota: topeCuota,
          topeCompromisoTotal: topeCompromiso,
          disponibleRecibo: round2Margen(disponibleRecibo),
          cuotaMaximaReal: cuotaMaxReal,
          limitadoPor,
          neto: netoR,
          capitalMaximoPrestar: netoR,
          capitalBruto: capBrutoR,
          cuotaResultante: cuotaR,
          totalPagar: totalR,
          saldoCancelar: saldoCanc,
          netoBolsillo,
          cubreCancelacion: saldoCanc > 0 ? (netoR >= saldoCanc) : true,
          alivioMensual
        });
      }
      return ofertas;
    }

    function calcularOfertasDisponibles(datosRecibo, lineaCredito = 'fedem') {
      const margenInfo = calcularMargenRecibo(datosRecibo);
      if (margenInfo.disponibleRecibo <= 0 || margenInfo.estado === 'SIN_DISPONIBLE') {
        return {
          estado: 'SIN_DISPONIBLE',
          estadoLabel: 'SIN Disponible',
          margen: margenInfo.disponibleRecibo,
          disponibleRecibo: margenInfo.disponibleRecibo,
          analisisMargen: margenInfo,
          ofertas: []
        };
      }
      const ofertas = calcularOfertasPorPlazo(margenInfo.disponibleRecibo, margenInfo.netoLiquido, lineaCredito, {
        saldoCancelar: margenInfo.saldoCancelar,
        saldoVigenteExterno: margenInfo.saldoVigenteExterno,
        cuotaRefinanciar: margenInfo.cuotaRefinanciar
      });
      return {
        estado: 'DISPONIBLE',
        estadoLabel: 'DISPONIBLE',
        margen: margenInfo.disponibleRecibo,
        disponibleRecibo: margenInfo.disponibleRecibo,
        analisisMargen: margenInfo,
        ofertas
      };
    }

    function enrichmentDesgloseDescuentosPadron(itemsClasif) {
      let descLeyCalc = 0;
      let fedemCalc = 0;
      let bersaCalc = 0;
      let sidecreerCalc = 0;
      let mutualesCalc = 0;
      let embargoCalc = 0;
      const fedemCodes = [];
      const embargoDescs = [];

      for (let i = 0; i < (itemsClasif || []).length; i++) {
        const it = itemsClasif[i];
        if (it.tipo !== 'DESCUENTO' && (it.clasificacion === 'COMPUTABLE' || it.clasificacion === 'NO_COMPUTABLE')) {
          continue;
        }
        const imp = Math.abs(it.descuentos || it.importe || 0);
        if (imp <= 0) continue;
        const descNorm = normalizarDescripcionPadron(it.descripcion || '');
        const codBase = stripZerosPadron(quitarSufijoCodigoPadron(normalizarCodigoLookupPadron(it.codigo)));
        if (/EMBARGO|JUDICIAL|LITIS|OFICIO/.test(descNorm)) {
          embargoCalc = round2Margen(embargoCalc + imp);
          if (it.descripcion) embargoDescs.push(String(it.descripcion));
        } else if (it.clasificacion === 'SUBTOTAL_1') {
          descLeyCalc = round2Margen(descLeyCalc + imp);
        } else if (it.clasificacion === 'AFECTADO') {
          if (['366', '368', '369', '1115', '1117'].includes(codBase) || descNorm.includes('FEDEM')) {
            fedemCalc = round2Margen(fedemCalc + imp);
            const lbl = it.codigo ? (it.codigo + ' (' + (it.descripcion || 'FEDEM') + ')') : (it.descripcion || 'FEDEM');
            if (!fedemCodes.includes(lbl)) fedemCodes.push(lbl);
          } else if (SIDECREER_RE_PADRON.test(descNorm) || codBase === '412' || codBase === '812') {
            sidecreerCalc = round2Margen(sidecreerCalc + imp);
          } else if (descNorm.includes('BERSA') || descNorm.includes('BANCO ENTRE RIOS') || codBase === '480' || codBase === '960') {
            bersaCalc = round2Margen(bersaCalc + imp);
          } else {
            mutualesCalc = round2Margen(mutualesCalc + imp);
          }
        }
      }

      return {
        descLeyCalc,
        fedemCalc,
        bersaCalc,
        sidecreerCalc,
        mutualesCalc,
        embargoCalc,
        fedemCodes,
        embargoConcepto: embargoDescs.join('; ')
      };
    }

    function generarConclusionesYRecomendaciones(analisis, desglose, ofertasFedem, embargoBool = false) {
      const am = analisis || {};
      const desg = desglose || {};
      const ofertas = Array.isArray(ofertasFedem) ? ofertasFedem : [];
      const fmtP = (typeof formatPesosMargen === 'function') ? formatPesosMargen : (v => '$ ' + formatMontoSinSimboloAr(v));

      const disp = Number(am.disponibleRecibo || 0);
      const dispOrig = Number(am.disponibleReciboOriginal !== undefined ? am.disponibleReciboOriginal : disp);
      const tope4167 = Number(am.topeEndeudamientoMensual4167 || 0);
      const cuotaSegura = Number(am.cuotaMaximaSeguraGeneral || 0);
      const afectable = Number(am.afectable || 0);
      const afectado = Number(am.totalAfectado || 0);
      const cuotaRef = Number(am.cuotaRefinanciar || 0);
      const saldoCanc = Number(am.saldoCancelar || 0);
      const saldoExt = Number(am.saldoVigenteExterno || 0);
      const detalleRef = String(am.detalleRefinanciacion || '').trim();
      const factorMargen = Number(am.factorMargen || 1.0);
      const puedeOfrecer = Boolean(am.puedeOfrecerCuotas) && disp > 0;

      const refActiva = Boolean(cuotaRef > 0 || saldoCanc > 0 || saldoExt > 0 || detalleRef);
      const escenarios = [];
      const pares = [
        ['FEDEM', Number(desg.fedemCalc ?? desg.calcFedem ?? desg.consumosFedem ?? 0)],
        ['Sidecreer', Number(desg.sidecreerCalc ?? desg.calcSidecreer ?? desg.consumosSidecreer ?? 0)],
        ['BERSA', Number(desg.bersaCalc ?? desg.calcBersa ?? desg.consumosBersa ?? 0)],
        ['Otras Mutuales', Number(desg.mutualesCalc ?? desg.calcMutuales ?? desg.otrasMutuales ?? 0)]
      ];
      for (let i = 0; i < pares.length; i++) {
        const ent = pares[i][0];
        const monto = pares[i][1];
        if (monto > 0) {
          const brutoEsc = round2Margen(dispOrig + monto);
          const nuevoDisp = (factorMargen < 1 && brutoEsc > 0) ? round2Margen(brutoEsc * factorMargen) : brutoEsc;
          const nuevaCuota = nuevoDisp > 0 ? round2Margen(Math.min(nuevoDisp, tope4167)) : 0;
          escenarios.push({
            entidad: ent,
            montoLiberable: round2Margen(monto),
            nuevoDisponible: nuevoDisp,
            nuevaCuotaSegura: nuevaCuota
          });
        }
      }

      const recomendaciones = [];
      let escenario = 'DISPONIBLE_LIMITADO_TOPE_NETO';
      let titulo = '';
      let resumen = '';

      if (embargoBool) {
        escenario = 'EMBARGO';
        titulo = 'Rechazo preventivo por retención judicial / embargo activo';
        resumen = 'Se detectaron retenciones judiciales/embargos activos. Aun con Disponible Recibo de ' + fmtP(disp) + ', corresponde bloqueo reglamentario hasta acreditar levantamiento.';
        recomendaciones.push('Solicitar oficio o certificado de levantamiento de embargo antes de avanzar con cualquier línea o refinanciación.');
      } else if (refActiva) {
        escenario = 'REFINANCIACION_ACTIVA';
        titulo = 'Escenario de Refinanciación simulado' + (detalleRef ? (' (' + detalleRef + ')') : '');
        const partes = [];
        if (cuotaRef > 0) {
          partes.push('Al liberar ' + fmtP(cuotaRef) + '/mes de cuota vigente, el Disponible Recibo pasa de ' + fmtP(dispOrig) + ' a ' + fmtP(disp) + ' (Cuota Segura: ' + fmtP(cuotaSegura) + '/mes).');
        } else {
          partes.push('Se evalúa cancelación/refinanciación sobre el margen actual de ' + fmtP(disp) + '/mes.');
        }
        if (saldoCanc > 0 && ofertas.length > 0) {
          const cubren = ofertas.filter(x => x.neto >= saldoCanc);
          if (cubren.length > 0) {
            const primera = cubren[0];
            const mejor = cubren[cubren.length - 1];
            partes.push('El Saldo a Cancelar (' + fmtP(saldoCanc) + ') se cubre desde ' + primera.plazo + ' cuotas (bolsillo neto ' + fmtP(primera.netoBolsillo) + '), alcanzando hasta ' + fmtP(mejor.netoBolsillo) + ' en bolsillo en ' + mejor.plazo + ' cuotas.');
          } else {
            const maxO = ofertas[ofertas.length - 1];
            const faltante = round2Margen(saldoCanc - maxO.neto);
            partes.push('El Saldo a Cancelar (' + fmtP(saldoCanc) + ') supera el máximo entregable en ' + maxO.plazo + ' cuotas (' + fmtP(maxO.neto) + '); requiere integrar ' + fmtP(faltante) + ' o liberar más cuota.');
          }
        }
        resumen = partes.join(' ');
        if (cuotaRef > 0 && ofertas.length > 0) {
          const ref24 = ofertas.find(x => x.plazo === 24) || ofertas[ofertas.length - 1];
          const alivio = round2Margen(cuotaRef - ref24.cuotaResultante);
          if (alivio > 0) {
            recomendaciones.push('Alivio financiero mensual en ' + ref24.plazo + ' cuotas: la cuota baja en ' + fmtP(alivio) + '/mes respecto a la retención liberada (' + fmtP(cuotaRef) + ' → ' + fmtP(ref24.cuotaResultante) + ').');
          }
        }
        if (saldoExt > 0) {
          recomendaciones.push('Se descontó el Saldo Vigente Externo de ' + fmtP(saldoExt) + ' del tope de endeudamiento acumulado (41,67% × N × Neto).');
        }
      } else if (!puedeOfrecer) {
        escenario = escenarios.length > 0 ? 'SIN_DISPONIBLE_REFINANCIABLE' : 'SIN_DISPONIBLE';
        titulo = 'Margen agotado en recibo: requiere refinanciación previa o canal alternativo';
        const deficit = disp < 0 ? round2Margen(Math.abs(disp)) : 0;
        resumen = 'El Afectado real (' + fmtP(afectado) + ') supera al Afectable (' + fmtP(afectable) + '), dejando Disponible Recibo de ' + fmtP(disp) + '.';
        if (escenarios.length > 0) {
          const mejorEsc = escenarios.reduce((a, b) => (b.montoLiberable > a.montoLiberable ? b : a), escenarios[0]);
          recomendaciones.push(
            'Para revertir el déficit (' + fmtP(deficit) + ') y habilitar planilla, se requiere cancelar/refinanciar al menos ' + fmtP(round2Margen(deficit + 1)) +
            ' de cuota mensual. Refinanciando ' + mejorEsc.entidad + ' (' + fmtP(mejorEsc.montoLiberable) + '/mes), el Disponible pasaría a ' + fmtP(mejorEsc.nuevoDisponible) + ' (Cuota Segura: ' + fmtP(mejorEsc.nuevaCuotaSegura) + '/mes).'
          );
        }
        recomendaciones.push('Si no se cancela deuda previa en planilla, evaluar línea alternativa por CBU / Convenio Sidecreer sujeta a scoring.');
      } else if (disp <= tope4167) {
        escenario = 'DISPONIBLE_LIMITADO_RECIBO';
        titulo = 'Apto por planilla — Oferta acotada por Margen del Recibo';
        resumen = 'Posee Disponible Recibo positivo de ' + fmtP(disp) + ', por debajo del Tope 41,67% Neto (' + fmtP(tope4167) + '). La cuota máxima segura es ' + fmtP(cuotaSegura) + '/mes.';
        if (escenarios.length > 0) {
          const mejorEsc = escenarios.reduce((a, b) => (b.montoLiberable > a.montoLiberable ? b : a), escenarios[0]);
          recomendaciones.push('Oportunidad de ampliación por Refinanciación: liberando ' + mejorEsc.entidad + ' (' + fmtP(mejorEsc.montoLiberable) + '/mes), la cuota segura subiría hasta el Tope 41,67% (' + fmtP(mejorEsc.nuevaCuotaSegura) + '/mes).');
        }
      } else {
        escenario = 'DISPONIBLE_LIMITADO_TOPE_NETO';
        titulo = 'Apto por planilla — Capacidad plena hasta Tope 41,67% Neto';
        resumen = 'El Disponible Recibo (' + fmtP(disp) + ') supera el Tope Reglamentario 41,67% Neto (' + fmtP(tope4167) + '). Se habilita la cuota máxima segura reglamentaria de ' + fmtP(cuotaSegura) + '/mes.';
      }

      if (escenarios.length > 0 || refActiva) {
        recomendaciones.push('Checklist Refinanciación: (1) adjuntar Certificado de Saldo Cancelatorio vigente, (2) cargar Cuota Futura 2 si hubiera retenciones en curso no liquidadas, y (3) confirmar que el Monto a Entregar cubra el saldo y deje bolsillo positivo.');
      }

      const plazoMinimoCobertura = saldoCanc > 0 ? ((ofertas.find(o => o.cubreCancelacion) || {}).plazo ?? null) : null;
      return {
        escenario,
        titulo,
        resumen,
        recomendaciones,
        refinanciacionActiva: refActiva,
        escenariosSugeridos: escenarios,
        plazoMinimoCobertura
      };
    }

    function enriquecerResultadoAuditoriaJS(rawDict, opts = {}) {
      const res = Object.assign({}, rawDict || {});
      const conceptosIn = Array.isArray(res.conceptos)
        ? res.conceptos
        : (Array.isArray(res.items) ? res.items : []);
      const cf2 = limpiarNumeroPadron(
        (opts && opts.cuotaFutura2 !== undefined && opts.cuotaFutura2 !== null)
          ? opts.cuotaFutura2
          : (res.cuota_futura_2 ?? res.cuotaFutura2 ?? 0)
      );
      const cuotaRef = limpiarNumeroPadron(
        (opts && opts.cuotaRefinanciar !== undefined && opts.cuotaRefinanciar !== null)
          ? opts.cuotaRefinanciar
          : (res.cuota_refinanciar ?? res.cuotaRefinanciar ?? 0)
      );
      const saldoCanc = limpiarNumeroPadron(
        (opts && opts.saldoCancelar !== undefined && opts.saldoCancelar !== null)
          ? opts.saldoCancelar
          : (res.saldo_cancelar ?? res.saldoCancelar ?? 0)
      );
      const saldoExt = limpiarNumeroPadron(
        (opts && opts.saldoVigenteExterno !== undefined && opts.saldoVigenteExterno !== null)
          ? opts.saldoVigenteExterno
          : (res.saldo_vigente_externo ?? res.saldoVigenteExterno ?? 0)
      );
      const detRef = String(
        (opts && opts.detalleRefinanciacion !== undefined && opts.detalleRefinanciacion !== null)
          ? opts.detalleRefinanciacion
          : (res.detalle_refinanciacion ?? res.detalleRefinanciacion ?? '')
      ).trim();
      const facMargen = limpiarNumeroPadron(
        (opts && opts.factorMargen !== undefined && opts.factorMargen !== null)
          ? opts.factorMargen
          : (res.factor_margen ?? res.factorMargen ?? 1.0)
      );

      const analisis = calcularMargenRecibo({
        total_haberes: res.total_haberes ?? res.sueldoBrutoTotal ?? res.sueldoBruto,
        total_descuentos: res.total_descuentos ?? res.totalDescuentos ?? res.totalDescuentosRecibo,
        liquido: res.liquido ?? res.sueldoLiquido ?? res.sueldoNeto,
        cuota_futura_2: cf2,
        cuota_refinanciar: cuotaRef,
        saldo_cancelar: saldoCanc,
        saldo_vigente_externo: saldoExt,
        detalle_refinanciacion: detRef,
        factor_margen: facMargen || 1.0,
        items: conceptosIn,
        lugar_de_trabajo: res.lugar_de_trabajo || res.lugarTrabajo || '',
        regimenOverride: (opts && opts.regimenOverride) || res.regimenOverride || '',
        tipoRecibo: res.tipoRecibo || '',
        formatoRecibo: res.formatoRecibo || res.formato || '',
        organismo: res.organismo || '',
        situacionRevista: res.situacionRevista || '',
        condicion: res.condicion || '',
        cargo: res.cargo || res.escalafonCargo || ''
      });

      const itemsClasif = analisis.items;
      const desgloseDescuentos = enrichmentDesgloseDescuentosPadron(itemsClasif);
      const offerOpts = {
        saldoCancelar: analisis.saldoCancelar,
        saldoVigenteExterno: analisis.saldoVigenteExterno,
        cuotaRefinanciar: analisis.cuotaRefinanciar
      };
      const ofertasPorPlazo = analisis.puedeOfrecerCuotas
        ? {
            fedem: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'fedem', offerOpts),
            muni: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'muni', offerOpts),
            sidecreer: calcularOfertasPorPlazo(analisis.disponibleRecibo, analisis.netoLiquido, 'sidecreer', offerOpts)
          }
        : { fedem: [], muni: [], sidecreer: [] };
      const embargoBool = Boolean(res.embargosJudiciales || desgloseDescuentos.embargoCalc > 0);
      const conclusionesRecomendaciones = generarConclusionesYRecomendaciones(
        analisis,
        desgloseDescuentos,
        ofertasPorPlazo.fedem,
        embargoBool
      );

      return {
        analisis,
        itemsClasif,
        ofertasPorPlazo,
        desgloseDescuentos,
        conclusionesRecomendaciones
      };
    }

    function clasificarConceptosReciboLocal(conceptosRaw, metaRecibo = null) {
      const itemsIn = Array.isArray(conceptosRaw) ? conceptosRaw : [];
      const rows = clasificarItemsRecibo(
        itemsIn,
        metaRecibo && (metaRecibo.lugarTrabajo || metaRecibo.lugar_de_trabajo),
        metaRecibo || {}
      );

      let sumHaberes = 0;
      let sumDescuentos = 0;
      let totalNoComputable = 0;
      let totalAfectado = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        sumHaberes = round2Margen(sumHaberes + (r.haberes || 0));
        sumDescuentos = round2Margen(sumDescuentos + (r.descuentos || 0));
        if (r.clasificacion === 'NO_COMPUTABLE' && r.tipo !== 'DESCUENTO') {
          totalNoComputable = round2Margen(totalNoComputable + Math.abs(r.importe || r.haberes || 0));
        }
        if (r.clasificacion === 'AFECTADO' && r.tipo !== 'HABER') {
          totalAfectado = round2Margen(totalAfectado + Math.abs(r.importe || r.descuentos || 0));
        }
      }

      const desg = enrichmentDesgloseDescuentosPadron(rows);

      return {
        rows,
        sumHaberes: rows.length > 0 ? sumHaberes : null,
        sumDescuentos: rows.length > 0 ? sumDescuentos : null,
        totalNoComputable,
        totalAfectado,
        calcLey: desg.descLeyCalc,
        calcBersa: desg.bersaCalc,
        calcSidecreer: desg.sidecreerCalc,
        calcFedem: desg.fedemCalc,
        calcEmbargo: desg.embargoCalc,
        calcMutuales: desg.mutualesCalc,
        fedemCodes: desg.fedemCodes,
        embargoConcepto: desg.embargoConcepto
      };
    }

    function esStubBitacoraSinOCR(obj) {
      if (!obj || typeof obj !== 'object') return false;
      const inner = (obj.auditoria && typeof obj.auditoria === 'object') ? obj.auditoria : obj;
      const esStub = inner.estadoAuditoria === 'REGISTRADA' &&
        inner.sueldoBrutoTotal === undefined &&
        inner.sueldoBruto === undefined &&
        !inner.resumenDecision &&
        !inner.detalleCompletoRecibo &&
        !inner.radiografiaSalarial &&
        !inner.reciboSueldo &&
        !Array.isArray(inner.conceptos);
      return Boolean(esStub);
    }

    function normalizarResultadoAuditoriaIA(auditRes, opts = {}) {
      let obj = auditRes;
      if (typeof obj === 'string') {
        obj = extraerJSONResiliente(obj);
      }
      if (!obj || typeof obj !== 'object') {
        return null;
      }

      if (esStubBitacoraSinOCR(obj)) {
        return null;
      }

      if (obj.auditoria && typeof obj.auditoria === 'object') obj = obj.auditoria;
      else if (obj.resultado && typeof obj.resultado === 'object') obj = obj.resultado;
      else if (obj.data && typeof obj.data === 'object') obj = obj.data;

      if (esStubBitacoraSinOCR(obj)) {
        return null;
      }

      const tieneBloquesDuales = Boolean(obj.resumenDecision || obj.detalleCompletoRecibo || obj.analisisMargen);
      const tieneFormaNormalizada = Boolean(obj.scoringCrediticio || obj.reciboSueldo || obj.resumenJson);
      const tieneFormaCompactaER = Boolean(obj.datosAgente || obj.liquidacion || (obj.scoring && typeof obj.scoring === 'object'));
      const tieneFormaCruda = Boolean(
        tieneBloquesDuales ||
        obj.identidad || obj.datosLaborales || obj.radiografiaSalarial || obj.scoringAmmer ||
        tieneFormaCompactaER ||
        obj.titular || obj.nombre || Array.isArray(obj.conceptos) || Array.isArray(obj.items) ||
        obj.sueldoBrutoTotal !== undefined || obj.sueldoBruto !== undefined ||
        obj.total_haberes !== undefined || obj.totalHaberes !== undefined ||
        obj.sueldoLiquido !== undefined || obj.sueldoNeto !== undefined
      );

      if (!tieneFormaNormalizada && !tieneFormaCruda) {
        return null;
      }

      obj = Object.assign({}, obj);
      const toNumOrNullLocal = (v) => parseNumeroSeguroAuditoria(v);
      const toNumZeroLocal = (v) => {
        const n = parseNumeroSeguroAuditoria(v);
        return n === null ? 0 : n;
      };

      const resDecIn = obj.resumenDecision || (obj.resumenJson && obj.resumenJson.resumenDecision) || {};
      const detRecIn = obj.detalleCompletoRecibo || (obj.resumenJson && obj.resumenJson.detalleCompletoRecibo) || {};
      const recIn = obj.reciboSueldo || {};
      const idIn = obj.identidad || {};
      const labIn = obj.datosLaborales || {};
      const agIn = obj.datosAgente || {};
      const vigIn = obj.vigenciaRecibo || {};
      const liqIn = obj.liquidacion || {};
      const salIn = obj.radiografiaSalarial || {};
      const amIn = obj.analisisMargen || {};
      const totDetIn = detRecIn.totales || obj.totales || {};

      const pickTxt = (candidates, fallback) => {
        for (let i = 0; i < candidates.length; i++) {
          const cleaned = limpiarTextoAuditoria(candidates[i], '');
          if (cleaned) return cleaned;
        }
        return fallback;
      };

      const pickNum = (candidates) => {
        for (let i = 0; i < candidates.length; i++) {
          const n = toNumOrNullLocal(candidates[i]);
          if (n !== null) return n;
        }
        return null;
      };

      const titularFinal = pickTxt([
        resDecIn.titular,
        idIn.titularDetectado,
        recIn.titular,
        agIn.nombreTitular,
        agIn.nombreApellido,
        agIn.nombre,
        obj.titular,
        obj.nombre,
        obj.dni && obj.dni.nombreCompleto
      ], 'No especificado');

      const dniRaw = pickTxt([
        resDecIn.dni,
        idIn.dni,
        recIn.dni,
        agIn.dni,
        agIn.dniCuil,
        typeof obj.dni === 'string' || typeof obj.dni === 'number' ? obj.dni : (obj.dni && obj.dni.numero)
      ], '');
      const dniDigits = dniRaw.replace(/\D/g, '');
      const dniFinal = dniDigits || dniRaw || 'No especificado';

      const cuilFinal = pickTxt([
        resDecIn.cuil,
        idIn.cuil,
        recIn.cuil,
        agIn.cuil,
        obj.cuil
      ], '');

      const organismoFinal = pickTxt([
        resDecIn.organismo,
        labIn.organismoEmpleador,
        recIn.organismo,
        agIn.organismo,
        obj.organismo,
        obj.empleador
      ], 'Organismo Provincial');

      const situacionRevFinal = pickTxt([
        labIn.situacionRevista,
        recIn.situacionRevista,
        resDecIn.situacionRevista,
        agIn.situacionRevista,
        obj.situacionRevista
      ], 'ACTIVO TITULAR');

      const cargoFinal = pickTxt([
        resDecIn.cargo,
        detRecIn.escalafonCargo,
        labIn.escalafonCargo,
        recIn.escalafonCargo,
        recIn.cargo,
        agIn.escalafonCargo,
        agIn.cargo,
        obj.cargo,
        obj.categoria,
        situacionRevFinal
      ], 'Agente / Activo');

      const periodoFinal = pickTxt([
        resDecIn.periodo,
        detRecIn.periodo,
        vigIn.periodoLiquidado,
        recIn.periodo,
        liqIn.periodo,
        liqIn.periodoLiquidado,
        agIn.periodoLiquidado,
        obj.periodo,
        obj.mesLiquidado
      ], 'Mes auditado');

      const antiguedadFinal = pickTxt([
        resDecIn.antiguedad,
        labIn.antiguedadDetalle,
        recIn.antiguedadDetalle,
        agIn.antiguedad,
        obj.antiguedad,
        labIn.antiguedadAnios !== undefined && labIn.antiguedadAnios !== null ? (labIn.antiguedadAnios + ' años') : ''
      ], 'No registrada');

      const condicionFinal = pickTxt([
        labIn.condicion,
        obj.condicion,
        recIn.condicion,
        resDecIn.condicion
      ], '');

      const regOverrideOpt = (opts && opts.regimenOverride !== undefined && opts.regimenOverride !== null)
        ? (opts.regimenOverride ? String(opts.regimenOverride).trim().toUpperCase() : '')
        : String(obj.regimenOverride || amIn.regimenOverride || '').trim().toUpperCase();

      const cf2Opt = (opts && opts.cuotaFutura2 !== undefined && opts.cuotaFutura2 !== null)
        ? Math.max(0, round2Margen(limpiarNumeroPadron(opts.cuotaFutura2)))
        : Math.max(0, round2Margen(limpiarNumeroPadron(amIn.cuotaFutura2 ?? obj.cuotaFutura2 ?? obj.cuota_futura_2 ?? 0)));

      const cuotaRefOpt = (opts && opts.cuotaRefinanciar !== undefined && opts.cuotaRefinanciar !== null)
        ? Math.max(0, round2Margen(limpiarNumeroPadron(opts.cuotaRefinanciar)))
        : Math.max(0, round2Margen(limpiarNumeroPadron(amIn.cuotaRefinanciar ?? obj.cuotaRefinanciar ?? obj.cuota_refinanciar ?? 0)));

      const saldoCancOpt = (opts && opts.saldoCancelar !== undefined && opts.saldoCancelar !== null)
        ? Math.max(0, round2Margen(limpiarNumeroPadron(opts.saldoCancelar)))
        : Math.max(0, round2Margen(limpiarNumeroPadron(amIn.saldoCancelar ?? obj.saldoCancelar ?? obj.saldo_cancelar ?? 0)));

      const saldoExtOpt = (opts && opts.saldoVigenteExterno !== undefined && opts.saldoVigenteExterno !== null)
        ? Math.max(0, round2Margen(limpiarNumeroPadron(opts.saldoVigenteExterno)))
        : Math.max(0, round2Margen(limpiarNumeroPadron(amIn.saldoVigenteExterno ?? obj.saldoVigenteExterno ?? obj.saldo_vigente_externo ?? 0)));

      const detalleRefOpt = (opts && opts.detalleRefinanciacion !== undefined && opts.detalleRefinanciacion !== null)
        ? String(opts.detalleRefinanciacion).trim()
        : String(amIn.detalleRefinanciacion ?? obj.detalleRefinanciacion ?? obj.detalle_refinanciacion ?? '').trim();

      const facRawOpt = (opts && opts.factorMargen !== undefined && opts.factorMargen !== null)
        ? limpiarNumeroPadron(opts.factorMargen)
        : limpiarNumeroPadron(amIn.factorMargen ?? obj.factorMargen ?? obj.factor_margen ?? 1.0);
      const factorMargenOpt = (facRawOpt > 0 && facRawOpt <= 1.0) ? Number(facRawOpt.toFixed(4)) : 1.0;

      const fuenteConceptosIn = Array.isArray(detRecIn.conceptos) && detRecIn.conceptos.length > 0
        ? detRecIn.conceptos
        : (Array.isArray(recIn.conceptos) && recIn.conceptos.length > 0
          ? recIn.conceptos
          : (Array.isArray(obj.conceptos) && obj.conceptos.length > 0
            ? obj.conceptos
            : (Array.isArray(obj.items) && obj.items.length > 0
              ? obj.items
              : (Array.isArray(liqIn.conceptos) ? liqIn.conceptos : []))));

      // Preservar copia cruda sin anotaciones previas del motor para alternar Activos/Pasivos limpiamente
      if (!Array.isArray(obj._rawConceptosOriginal) && fuenteConceptosIn.length > 0) {
        obj._rawConceptosOriginal = fuenteConceptosIn.map(c => {
          const cp = Object.assign({}, c);
          if (cp.metodoClasificacion && cp.metodoClasificacion !== 'EXPLICITA_NORMALIZADA') {
            delete cp.clasificacion;
            delete cp.metodoClasificacion;
            delete cp.lugarPadronMatch;
          }
          return cp;
        });
      }

      const conceptosParaCalculo = (opts && opts.forzarReclasificar && Array.isArray(obj._rawConceptosOriginal))
        ? obj._rawConceptosOriginal.map(c => Object.assign({}, c))
        : fuenteConceptosIn;

      const brutoHeader = pickNum([
        amIn.totalHaberes,
        resDecIn.sueldoBrutoTotal,
        salIn.sueldoBrutoTotal,
        recIn.sueldoBruto,
        liqIn.sueldoBrutoTotal,
        liqIn.sueldoBruto,
        totDetIn.totalHaberes,
        obj.total_haberes,
        obj.sueldoBrutoTotal,
        obj.sueldoBruto,
        obj.totalHaberes
      ]);

      const descHeader = pickNum([
        amIn.totalDescuentos,
        resDecIn.totalDescuentos,
        salIn.totalDescuentosRecibo,
        recIn.totalDescuentosRecibo,
        liqIn.totalDescuentos,
        liqIn.totalDescuentosRecibo,
        totDetIn.totalDescuentos,
        obj.total_descuentos,
        obj.totalDescuentos,
        obj.totalDescuentosRecibo
      ]);

      const liqHeader = pickNum([
        amIn.netoLiquido,
        amIn.liquido,
        resDecIn.sueldoLiquido,
        salIn.sueldoLiquido,
        recIn.sueldoNeto,
        liqIn.sueldoLiquidoBolsillo,
        liqIn.sueldoLiquido,
        liqIn.sueldoNetoBolsillo,
        liqIn.sueldoNeto,
        totDetIn.liquidoAPagar,
        obj.sueldoLiquido,
        obj.sueldoNeto,
        obj.liquidoAPagar,
        obj.liquido
      ]);

      const tieneConceptos = conceptosParaCalculo.length > 0;
      const tieneAmBackend = Boolean(amIn && (amIn.subtotal1 !== undefined || amIn.esCalculoPadron === true));
      const esLegacySoloResumen = !tieneConceptos && !tieneAmBackend && !(opts && opts.forzarReclasificar);

      let amFinal;
      let desgloseLocal;
      let ofertasPorPlazoFinal;

      if (esLegacySoloResumen) {
        const brutoLeg = brutoHeader !== null ? brutoHeader : 0;
        const descLeg = descHeader !== null ? Math.abs(descHeader) : 0;
        const liqLeg = liqHeader !== null ? liqHeader : round2Margen(brutoLeg - descLeg);
        const margenLeg = pickNum([
          resDecIn.disponibleRecibo,
          resDecIn.margenDisponiblePlanilla,
          resDecIn.margenDisponible,
          resDecIn.margen,
          recIn.margenDisponibleCuota,
          obj.margen
        ]) ?? 0;
        const descLeyLeg = pickNum([
          resDecIn.totalSubtotal1Desc,
          resDecIn.descuentosLey,
          salIn.descuentosLey,
          recIn.descuentosLey,
          obj.descuentosLey
        ]) ?? 0;
        const metaLeg = resolverSegmentoBeneficiario({
          regimenOverride: regOverrideOpt,
          lugar_de_trabajo: obj.lugar_de_trabajo || obj.lugarTrabajo || resDecIn.lugarTrabajo || '',
          organismo: organismoFinal,
          situacionRevista: situacionRevFinal,
          condicion: condicionFinal,
          cargo: cargoFinal
        });
        const topeEndLeg = round2Margen((5 * Math.max(0, liqLeg)) / 12);
        const puedeLeg = margenLeg > 0;
        const cuotaSegLeg = puedeLeg ? round2Margen(Math.min(margenLeg, topeEndLeg)) : 0;
        amFinal = {
          esCalculoPadron: false,
          estado: puedeLeg ? 'DISPONIBLE' : 'SIN_DISPONIBLE',
          estadoLabel: puedeLeg ? 'DISPONIBLE' : 'SIN Disponible',
          puedeOfrecerCuotas: puedeLeg,
          tipoBeneficiario: metaLeg.tipoBeneficiario,
          etiquetaBeneficiario: metaLeg.etiquetaBeneficiario,
          lugarTrabajo: metaLeg.lugarPrincipal,
          porcentajeTope: metaLeg.porcentajeTope,
          porcentajeAfectableMaximo: metaLeg.porcentajeAfectableMaximo,
          totalHaberes: brutoLeg,
          totalDescuentos: descLeg,
          netoLiquido: liqLeg,
          liquido: liqLeg,
          totalSubtotal1Desc: descLeyLeg,
          cuotaFutura2: cf2Opt,
          cuotaRefinanciar: cuotaRefOpt,
          saldoCancelar: saldoCancOpt,
          saldoVigenteExterno: saldoExtOpt,
          detalleRefinanciacion: detalleRefOpt,
          factorMargen: factorMargenOpt,
          disponibleReciboOriginal: margenLeg,
          disponibleBrutoRecibo: margenLeg,
          disponibleRecibo: margenLeg,
          margen: margenLeg,
          topeEndeudamientoMensual4167: topeEndLeg,
          cuotaMaximaSeguraGeneral: cuotaSegLeg,
          validaciones: obj.validaciones || { tieneDesgloseItems: false },
          alertas: Array.isArray(obj.alertas) ? obj.alertas : [],
          items: []
        };
        desgloseLocal = clasificarConceptosReciboLocal([], null);
        const legOpts = { saldoCancelar: saldoCancOpt, saldoVigenteExterno: saldoExtOpt, cuotaRefinanciar: cuotaRefOpt };
        ofertasPorPlazoFinal = obj.ofertasPorPlazo || (puedeLeg
          ? {
              fedem: calcularOfertasPorPlazo(margenLeg, liqLeg, 'fedem', legOpts),
              muni: calcularOfertasPorPlazo(margenLeg, liqLeg, 'muni', legOpts),
              sidecreer: calcularOfertasPorPlazo(margenLeg, liqLeg, 'sidecreer', legOpts)
            }
          : { fedem: [], muni: [], sidecreer: [] });
      } else {
        const metaCalc = {
          total_haberes: brutoHeader,
          total_descuentos: descHeader,
          liquido: liqHeader,
          cuota_futura_2: cf2Opt,
          cuota_refinanciar: cuotaRefOpt,
          saldo_cancelar: saldoCancOpt,
          saldo_vigente_externo: saldoExtOpt,
          detalle_refinanciacion: detalleRefOpt,
          factor_margen: factorMargenOpt,
          items: conceptosParaCalculo,
          lugar_de_trabajo: obj.lugar_de_trabajo || obj.lugarTrabajo || amIn.lugarTrabajo || resDecIn.lugarTrabajo || '',
          regimenOverride: regOverrideOpt,
          tipoRecibo: obj.tipoRecibo || resDecIn.tipoRecibo || '',
          formatoRecibo: obj.formatoRecibo || obj.formato || '',
          organismo: organismoFinal,
          situacionRevista: situacionRevFinal,
          condicion: condicionFinal,
          cargo: cargoFinal
        };

        const yaCalculadoMismoEstado = tieneAmBackend &&
          !opts.forzarReclasificar &&
          (!regOverrideOpt || regOverrideOpt === amIn.tipoBeneficiario) &&
          cf2Opt === round2Margen(amIn.cuotaFutura2 || 0) &&
          cuotaRefOpt === round2Margen(amIn.cuotaRefinanciar || 0) &&
          saldoCancOpt === round2Margen(amIn.saldoCancelar || 0) &&
          saldoExtOpt === round2Margen(amIn.saldoVigenteExterno || 0) &&
          detalleRefOpt === String(amIn.detalleRefinanciacion || '').trim() &&
          Math.abs(factorMargenOpt - Number(amIn.factorMargen || 1.0)) < 0.0001 &&
          Array.isArray(amIn.items || obj.conceptos || detRecIn.conceptos);

        if (yaCalculadoMismoEstado && !tieneConceptos) {
          amFinal = Object.assign({ esCalculoPadron: true }, amIn);
          desgloseLocal = clasificarConceptosReciboLocal([], metaCalc);
        } else {
          amFinal = calcularMargenRecibo(metaCalc);
          const desgP = enrichmentDesgloseDescuentosPadron(amFinal.items);
          desgloseLocal = {
            rows: amFinal.items,
            sumHaberes: amFinal.validaciones?.sumaItemsHaberes ?? amFinal.totalHaberes,
            sumDescuentos: amFinal.validaciones?.sumaItemsDescuentos ?? amFinal.totalDescuentos,
            totalNoComputable: amFinal.totalNoComputable,
            totalAfectado: amFinal.totalAfectado,
            calcLey: desgP.descLeyCalc,
            calcBersa: desgP.bersaCalc,
            calcSidecreer: desgP.sidecreerCalc,
            calcFedem: desgP.fedemCalc,
            calcEmbargo: desgP.embargoCalc,
            calcMutuales: desgP.mutualesCalc,
            fedemCodes: desgP.fedemCodes,
            embargoConcepto: desgP.embargoConcepto
          };
        }

        const normOfferOpts = {
          saldoCancelar: amFinal.saldoCancelar,
          saldoVigenteExterno: amFinal.saldoVigenteExterno,
          cuotaRefinanciar: amFinal.cuotaRefinanciar
        };
        ofertasPorPlazoFinal = amFinal.puedeOfrecerCuotas
          ? {
              fedem: calcularOfertasPorPlazo(amFinal.disponibleRecibo, amFinal.netoLiquido, 'fedem', normOfferOpts),
              muni: calcularOfertasPorPlazo(amFinal.disponibleRecibo, amFinal.netoLiquido, 'muni', normOfferOpts),
              sidecreer: calcularOfertasPorPlazo(amFinal.disponibleRecibo, amFinal.netoLiquido, 'sidecreer', normOfferOpts)
            }
          : { fedem: [], muni: [], sidecreer: [] };
      }

      const bruto = amFinal.totalHaberes ?? 0;
      const totalDesc = amFinal.totalDescuentos ?? 0;
      const liquido = amFinal.netoLiquido ?? round2Margen(bruto - totalDesc);

      const descLey = amFinal.totalSubtotal1Desc || toNumZeroLocal(resDecIn.descuentosLey ?? salIn.descuentosLey ?? recIn.descuentosLey ?? liqIn.descuentosLey ?? obj.descuentosLey) || desgloseLocal.calcLey;
      const bersa = desgloseLocal.calcBersa || toNumZeroLocal(resDecIn.consumosBersa ?? salIn.consumosBersa ?? recIn.consumosBersa ?? liqIn.consumosBancariosBersa ?? liqIn.consumosBersa ?? obj.consumosBersa);
      const sidecreer = desgloseLocal.calcSidecreer || toNumZeroLocal(resDecIn.consumosSidecreer ?? salIn.consumosSidecreer ?? recIn.consumosSidecreer ?? liqIn.consumosSidecreer ?? obj.consumosSidecreer);
      const mutuales = desgloseLocal.calcMutuales || toNumZeroLocal(resDecIn.otrasMutualesOProveeduria ?? resDecIn.otrasMutuales ?? salIn.otrasMutuales ?? recIn.otrasMutuales ?? liqIn.otrasMutualesOProveeduria ?? liqIn.otrasMutuales ?? liqIn.consumosProveeduria ?? obj.otrasMutualesOProveeduria ?? obj.otrasMutuales);
      const fedem = desgloseLocal.calcFedem || toNumZeroLocal(resDecIn.consumosFedem ?? resDecIn.codigosFedemMonto ?? salIn.codigosFedemMonto ?? recIn.codigosFedemMonto ?? liqIn.consumosFedem ?? liqIn.codigosFedemMonto ?? obj.consumosFedem ?? obj.codigosFedemMonto);
      const embargo = desgloseLocal.calcEmbargo || toNumZeroLocal(
        typeof resDecIn.embargosJudiciales === 'number'
          ? resDecIn.embargosJudiciales
          : (typeof salIn.embargosJudiciales === 'number'
            ? salIn.embargosJudiciales
            : (typeof obj.embargosJudiciales === 'number' ? obj.embargosJudiciales : (salIn.embargoMonto ?? recIn.embargoMonto ?? liqIn.embargoMonto ?? obj.embargoMonto)))
      );

      const cupo50 = round2Margen(bruto * 0.50);
      const disponibleRecibo = amFinal.disponibleRecibo ?? 0;
      const margen = disponibleRecibo;
      const puedeOfrecer = Boolean(amFinal.puedeOfrecerCuotas) && disponibleRecibo > 0;

      const fedemCodesFinal = (Array.isArray(desgloseLocal.fedemCodes) && desgloseLocal.fedemCodes.length > 0)
        ? desgloseLocal.fedemCodes
        : ((Array.isArray(salIn.codigosFedemDetectados) && salIn.codigosFedemDetectados.length > 0)
          ? salIn.codigosFedemDetectados
          : (Array.isArray(recIn.codigosFedemDetectados) ? recIn.codigosFedemDetectados : []));

      const embargoBool = Boolean(
        salIn.embargoDetectado || recIn.embargoDetectado || resDecIn.embargosJudiciales || liqIn.embargosJudiciales || obj.embargosJudiciales || embargo > 0
      );
      const embargoConceptoStr = pickTxt([desgloseLocal.embargoConcepto, salIn.embargoConcepto, recIn.embargoConcepto], '');

      const cumpleAntigBool = resDecIn.antiguedadApta !== undefined
        ? Boolean(resDecIn.antiguedadApta)
        : (labIn.cumpleAntiguedadMinima !== undefined
          ? Boolean(labIn.cumpleAntiguedadMinima)
          : (recIn.cumpleAntiguedadMinima !== undefined ? Boolean(recIn.cumpleAntiguedadMinima) : true));

      const tieneExcl = Boolean(
        labIn.esInvalidezODiscapacidad || recIn.esInvalidezODiscapacidad ||
        labIn.cumpleTopeEdad80 === false || recIn.cumpleTopeEdad80 === false ||
        embargoBool || cumpleAntigBool === false
      );

      const decPlanilla = (!tieneExcl && puedeOfrecer)
        ? 'APTO POR PLANILLA'
        : (tieneExcl && puedeOfrecer ? 'RECHAZADO / RESTRICCIÓN REGLAMENTARIA' : 'SIN DISPONIBLE');

      const decAltCbu = decPlanilla === 'APTO POR PLANILLA'
        ? 'NO REQUIERE ALTERNATIVA (Disponible por Padrón)'
        : (tieneExcl
          ? 'BLOQUEADO (Registra restricción excluyente / embargo)'
          : 'BLOQUEADO (SIN Disponible — Ofertas de cuotas deshabilitadas)');

      const estadoAfecPlanilla = puedeOfrecer ? 'DISPONIBLE' : 'SIN Disponible';

      let ptsTotal = pickNum([
        !opts.forzarReclasificar ? resDecIn.scoringSugerido : null,
        !opts.forzarReclasificar && obj.scoringCrediticio ? obj.scoringCrediticio.puntajeTotal : null,
        obj.scoringAmmer && obj.scoringAmmer.puntajeTotal,
        obj.scoring && (obj.scoring.puntaje ?? obj.scoring.puntajeTotal)
      ]);
      if (ptsTotal === null || opts.forzarReclasificar) {
        ptsTotal = decPlanilla === 'APTO POR PLANILLA' ? 88 : (embargoBool ? 30 : 42);
      }
      ptsTotal = Math.max(0, Math.min(100, Math.round(ptsTotal)));

      const dictamenFinal = decPlanilla === 'APTO POR PLANILLA' ? 'APTO_OTORGAMIENTO' : 'RECHAZADO';
      const calificacionLetra = ptsTotal >= 80
        ? 'A (Riesgo Bajo)'
        : (ptsTotal >= 60 ? 'B (Riesgo Moderado)' : 'C (Riesgo Crítico / No Viable)');

      const fechaIngresoFinal = pickTxt([
        resDecIn.fechaIngreso,
        labIn.fechaIngreso,
        labIn.fechaIngresoLaboral,
        recIn.fechaIngreso,
        agIn.fechaIngreso,
        obj.fechaIngreso,
        obj.fecha_ingreso
      ], '');

      const categoriaFinal = pickTxt([
        resDecIn.categoria,
        detRecIn.categoria,
        labIn.categoria,
        recIn.categoria,
        agIn.categoria,
        obj.categoria,
        obj.cat,
        obj.categoriaMunicipal
      ], '');

      const legajoFinal = pickTxt([
        resDecIn.legajo,
        detRecIn.legajo,
        labIn.legajo,
        labIn.legajoMunicipal,
        recIn.legajo,
        agIn.legajo,
        obj.legajo,
        obj.legajoMunicipal,
        obj.nroLegajo,
        obj.nro_legajo
      ], '');

      if (fechaIngresoFinal) obj.fechaIngreso = fechaIngresoFinal;
      if (categoriaFinal) obj.categoria = categoriaFinal;
      if (legajoFinal) obj.legajo = legajoFinal;
      obj.regimenOverride = regOverrideOpt || '';

      obj.analisisMargen = amFinal;
      obj.ofertasPorPlazo = ofertasPorPlazoFinal;
      obj.validaciones = amFinal.validaciones || {};
      obj.alertas = amFinal.alertas || [];
      obj.conceptos = desgloseLocal.rows;

      const conclusionesRecomendaciones = generarConclusionesYRecomendaciones(
        amFinal,
        {
          fedemCalc: fedem,
          sidecreerCalc: sidecreer,
          bersaCalc: bersa,
          mutualesCalc: mutuales
        },
        ofertasPorPlazoFinal.fedem,
        embargoBool
      );
      obj.conclusionesRecomendaciones = conclusionesRecomendaciones;

      obj.reciboSueldo = Object.assign({}, recIn, {
        titular: titularFinal,
        dni: dniFinal,
        cuil: cuilFinal || 'No consta en recibo',
        organismo: organismoFinal,
        escalafonCargo: cargoFinal,
        cargo: cargoFinal,
        situacionRevista: situacionRevFinal,
        fechaIngreso: fechaIngresoFinal || 'No consta en recibo',
        antiguedadDetalle: antiguedadFinal,
        categoria: categoriaFinal,
        legajo: legajoFinal,
        cumpleAntiguedadMinima: cumpleAntigBool,
        periodo: periodoFinal,
        estadoPeriodo: pickTxt([vigIn.estadoVigencia, recIn.estadoPeriodo], 'VIGENTE'),
        reciboVencido: vigIn.esVigente === false || recIn.reciboVencido === true,
        tipoBeneficiario: amFinal.tipoBeneficiario,
        lugarTrabajo: amFinal.lugarTrabajo,
        sueldoBruto: bruto,
        descuentosLey: descLey,
        consumosBersa: bersa,
        consumosSidecreer: sidecreer,
        otrasMutuales: mutuales,
        codigosFedemMonto: fedem,
        codigosFedemDetectados: fedemCodesFinal,
        embargoDetectado: embargoBool,
        embargoMonto: embargo,
        embargoConcepto: embargoConceptoStr,
        totalDescuentosRecibo: totalDesc,
        sueldoNeto: liquido,
        topeLegal50Porciento: cupo50,
        margenDisponibleCuota: margen,
        disponibleRecibo: disponibleRecibo,
        cuotaMaximaSeguraGeneral: amFinal.cuotaMaximaSeguraGeneral,
        estadoAfectacion: puedeOfrecer ? 'DISPONIBLE' : 'SIN Disponible',
        estadoAfectacionPlanilla: estadoAfecPlanilla,
        decisionPlanilla: decPlanilla,
        decisionAlternativaCBU: decAltCbu,
        conceptos: desgloseLocal.rows
      });

      obj.resumenDecision = {
        titular: titularFinal,
        dni: dniFinal,
        cuil: cuilFinal,
        organismo: organismoFinal,
        cargo: cargoFinal,
        periodo: periodoFinal,
        antiguedad: antiguedadFinal,
        fechaIngreso: fechaIngresoFinal,
        categoria: categoriaFinal,
        legajo: legajoFinal,
        antiguedadApta: cumpleAntigBool,
        tipoBeneficiario: amFinal.tipoBeneficiario,
        lugarTrabajo: amFinal.lugarTrabajo,
        porcentajeTope: amFinal.porcentajeTope,
        sueldoBrutoTotal: bruto,
        descuentosLey: descLey,
        totalSubtotal1Desc: amFinal.totalSubtotal1Desc,
        subtotal1: amFinal.subtotal1,
        subtotalTope: amFinal.subtotalTope,
        subtotal2: amFinal.subtotal2,
        totalNoComputable: amFinal.totalNoComputable,
        afectable: amFinal.afectable,
        totalAfectado: amFinal.totalAfectado,
        totalAfectadoEfectivo: amFinal.totalAfectadoEfectivo,
        cuotaFutura2: amFinal.cuotaFutura2,
        cuotaRefinanciar: amFinal.cuotaRefinanciar,
        saldoCancelar: amFinal.saldoCancelar,
        saldoVigenteExterno: amFinal.saldoVigenteExterno,
        detalleRefinanciacion: amFinal.detalleRefinanciacion,
        factorMargen: amFinal.factorMargen,
        disponibleReciboOriginal: amFinal.disponibleReciboOriginal,
        disponibleBrutoRecibo: amFinal.disponibleBrutoRecibo,
        disponibleRecibo: disponibleRecibo,
        topeEndeudamientoMensual4167: amFinal.topeEndeudamientoMensual4167,
        cuotaMaximaSeguraGeneral: amFinal.cuotaMaximaSeguraGeneral,
        puedeOfrecerCuotas: puedeOfrecer,
        estadoMargen: amFinal.estado,
        consumosBersa: bersa,
        consumosSidecreer: sidecreer,
        otrasMutualesOProveeduria: mutuales,
        consumosFedem: fedem,
        totalDescuentos: totalDesc,
        sueldoLiquido: liquido,
        cupoMaximo50: cupo50,
        margenDisponiblePlanilla: margen,
        estadoAfectacion: estadoAfecPlanilla,
        embargosJudiciales: embargoBool,
        codigosFedemPrevios: Boolean(resDecIn.codigosFedemPrevios) || fedemCodesFinal.length > 0 || fedem > 0,
        decisionPlanilla: decPlanilla,
        decisionAlternativaCBU: decAltCbu,
        scoringSugerido: ptsTotal
      };

      obj.detalleCompletoRecibo = {
        periodo: periodoFinal,
        escalafonCargo: cargoFinal,
        conceptos: desgloseLocal.rows,
        totales: {
          totalHaberes: bruto,
          totalDescuentos: totalDesc,
          liquidoAPagar: liquido
        }
      };

      if (Array.isArray(obj.recibosIndividuales) && obj.recibosIndividuales.length > 0) {
        obj.cantidadRecibos = obj.recibosIndividuales.length;
        obj.resumenDecision.cantidadRecibos = obj.recibosIndividuales.length;
      }

      obj.resumenJson = {
        resumenDecision: obj.resumenDecision,
        detalleCompletoRecibo: obj.detalleCompletoRecibo,
        analisisMargen: obj.analisisMargen,
        ofertasPorPlazo: obj.ofertasPorPlazo,
        conclusionesRecomendaciones: obj.conclusionesRecomendaciones,
        cantidadRecibos: obj.cantidadRecibos || 1,
        recibosIndividuales: Array.isArray(obj.recibosIndividuales) ? obj.recibosIndividuales : []
      };

      obj.scoringCrediticio = Object.assign({}, obj.scoringCrediticio || obj.scoringAmmer || {}, {
        puntajeTotal: ptsTotal,
        calificacionLetra: calificacionLetra,
        dictamen: dictamenFinal,
        decisionPlanilla: decPlanilla,
        decisionAlternativaCBU: decAltCbu
      });

      obj.cruceIdentidad = obj.cruceIdentidad || {
        estadoCotejo: pickTxt([idIn.estadoCotejoCaratula], 'VERIFICADO EN DOCUMENTO'),
        coincideDni: true,
        coincideNombre: true
      };

      const fmtMsg = (typeof formatPesosMargen === 'function') ? formatPesosMargen : formatMontoAuditoriaExacto;
      if (opts.forzarReclasificar || !obj.informeEjecutivo || String(obj.informeEjecutivo).toUpperCase().includes('ILEGIBLE')) {
        obj.informeEjecutivo = puedeOfrecer
          ? ('DISPONIBLE (' + amFinal.etiquetaBeneficiario + '): Disponible Recibo ' + fmtMsg(disponibleRecibo) +
             ' · Cuota Máxima Segura (Tope 41,67% Neto): ' + fmtMsg(amFinal.cuotaMaximaSeguraGeneral) + '.')
          : ('SIN Disponible (' + fmtMsg(disponibleRecibo) + ') en ' + amFinal.etiquetaBeneficiario + '. Simulación automática de cuotas bloqueada.');
      }

      return obj;
    }

    function construirInformeMarkdownAMMER(audit) {
      const norm = normalizarResultadoAuditoriaIA(audit) || audit || {};
      const resDec = norm.resumenDecision || {};
      const detRec = norm.detalleCompletoRecibo || {};
      const rec = norm.reciboSueldo || {};
      const sc = norm.scoringCrediticio || {};
      const am = norm.analisisMargen || {};
      const concl = norm.conclusionesRecomendaciones || null;
      const ofertasMap = norm.ofertasPorPlazo || { fedem: [], muni: [], sidecreer: [] };
      const fmtP = (typeof formatPesosMargen === 'function') ? formatPesosMargen : formatMontoAuditoriaExacto;
      const conceptosRows = Array.isArray(detRec.conceptos) ? detRec.conceptos : [];
      const esPasivo = am.tipoBeneficiario === 'PASIVO';
      const pctTopeLbl = esPasivo ? '35%' : '20%';
      const pctAfectLbl = esPasivo ? '65%' : '80%';
      const facMargen = Number(am.factorMargen || 1.0);
      const cuotaRef = Number(am.cuotaRefinanciar || 0);
      const saldoCanc = Number(am.saldoCancelar || 0);
      const saldoExt = Number(am.saldoVigenteExterno || 0);
      const detRef = String(am.detalleRefinanciacion || '').trim();

      const lineas = [
        '### INFORME DE AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER (MOTOR PADRÓN OFICIAL)',
        '* **Titular:** ' + (resDec.titular || rec.titular || 'No especificado'),
        '* **DNI / CUIL:** ' + (resDec.dni || rec.dni || 'No especificado') + (resDec.cuil ? ' / ' + resDec.cuil : ''),
        '* **Organismo / Cargo:** ' + (resDec.organismo || rec.organismo || 'Organismo Provincial') + ' (' + (resDec.cargo || detRec.escalafonCargo || 'Agente') + ')',
        '* **Régimen / Lugar de Trabajo:** ' + (am.etiquetaBeneficiario || 'Activos 80%') + ' [' + (am.lugarTrabajo || 'GE_') + ']',
        '* **Período / Antigüedad:** ' + (resDec.periodo || detRec.periodo || 'Mes auditado') + ' • ' + (resDec.antiguedad || rec.antiguedadDetalle || 'No registrada'),
        '* **Total Haberes:** ' + fmtP(am.totalHaberes ?? resDec.sueldoBrutoTotal ?? rec.sueldoBruto ?? 0),
        '* **(-) Descuentos SUBTOTAL_1:** ' + fmtP(am.totalSubtotal1Desc ?? resDec.totalSubtotal1Desc ?? rec.descuentosLey ?? 0),
        '* **(=) Subtotal1:** ' + fmtP(am.subtotal1 ?? 0),
        '* **(-) Tope Reserva (' + pctTopeLbl + '):** ' + fmtP(am.subtotalTope ?? 0),
        '* **(=) Subtotal2 (' + pctAfectLbl + '):** ' + fmtP(am.subtotal2 ?? 0),
        '* **(-) No Computable:** ' + fmtP(am.totalNoComputable ?? 0),
        '* **(=) Afectable:** ' + fmtP(am.afectable ?? 0),
        '* **(-) Afectado' + (am.cuotaFutura2 > 0 ? ' + Cuota Futura 2' : '') + ':** ' + fmtP((am.totalAfectado ?? 0) + (am.cuotaFutura2 ?? 0))
      ];
      if (cuotaRef > 0) {
        lineas.push('* **(+) Cuota a Liberar / Refinanciar' + (detRef ? ' (' + detRef + ')' : '') + ':** ' + fmtP(am.cuotaRefinanciarAplicada ?? cuotaRef) + ' (Afectado efectivo: ' + fmtP(am.totalAfectadoEfectivo ?? 0) + ')');
      }
      if (facMargen < 1) {
        lineas.push('* **Disponible Bruto Recibo (100%):** ' + fmtP(am.disponibleBrutoRecibo ?? 0) + ' → **Criterio Margen (' + Math.round(facMargen * 100) + '% c/ Gastos):** ' + fmtP(am.disponibleRecibo ?? 0));
      }
      lineas.push('* **(=) Disponible Recibo:** ' + (am.puedeOfrecerCuotas ? fmtP(am.disponibleRecibo) : ('SIN Disponible (' + fmtP(am.disponibleRecibo ?? 0) + ')')));
      if (saldoCanc > 0) {
        lineas.push('* **Saldo a Cancelar (Refinanciación):** ' + fmtP(saldoCanc));
      }
      if (saldoExt > 0) {
        lineas.push('* **Saldo en Préstamos Vigentes (Externo):** ' + fmtP(saldoExt));
      }
      lineas.push('* **Neto Líquido / Tope Endeudamiento (41,67%):** ' + fmtP(am.netoLiquido ?? resDec.sueldoLiquido ?? rec.sueldoNeto ?? 0) + ' / ' + fmtP(am.topeEndeudamientoMensual4167 ?? 0));
      lineas.push('* **Cuota Máxima Segura:** ' + (am.puedeOfrecerCuotas ? fmtP(am.cuotaMaximaSeguraGeneral ?? 0) : 'SIN Disponible'));
      lineas.push('* **Decisión Planilla:** ' + (resDec.decisionPlanilla || 'REVISAR'));
      lineas.push('* **Scoring AMMER:** ' + (sc.puntajeTotal ?? 0) + ' / 100 (' + (sc.calificacionLetra || '') + ')');

      if (Array.isArray(am.alertas) && am.alertas.length > 0) {
        lineas.push('');
        lineas.push('#### Alertas de Consistencia');
        am.alertas.forEach(a => lineas.push('* ⚠️ ' + a));
      }
      const ofertasFedem = Array.isArray(ofertasMap.fedem) ? ofertasMap.fedem : [];
      if (am.puedeOfrecerCuotas && ofertasFedem.length > 0) {
        lineas.push('');
        lineas.push('#### Oferta Máxima Sugerida por Plazo (FEDEM)');
        lineas.push('| Monto a Entregar | Cantidad de Cuotas | Monto de Cuota | Limitado Por / Refinanciación |');
        lineas.push('| ---: | :---: | ---: | :--- |');
        ofertasFedem.forEach(o => {
          const extras = [];
          if (saldoCanc > 0 && o.netoBolsillo !== undefined) {
            extras.push('Bolsillo: ' + fmtP(o.netoBolsillo));
          }
          if (cuotaRef > 0 && o.alivioMensual !== undefined && o.alivioMensual !== null) {
            extras.push('Alivio: ' + (o.alivioMensual >= 0 ? '+' : '') + fmtP(o.alivioMensual));
          }
          const limTxt = (o.limitadoPor || '—') + (extras.length > 0 ? (' · ' + extras.join(' · ')) : '');
          lineas.push('| ' + fmtP(o.neto) + ' | ' + o.plazo + ' cuotas (' + o.multiplicador + 'x Neto) | ' + fmtP(o.cuotaResultante) + ' | ' + limTxt + ' |');
        });
      }
      if (concl && concl.titulo) {
        lineas.push('');
        lineas.push('#### Conclusiones y Recomendaciones');
        lineas.push('* **' + concl.titulo + ':** ' + (concl.resumen || ''));
        (concl.recomendaciones || []).forEach(recLine => lineas.push('* ' + recLine));
        if (concl.plazoMinimoCobertura) {
          lineas.push('* **Plazo mínimo que cubre el saldo a cancelar:** ' + concl.plazoMinimoCobertura + ' cuotas');
        }
      }
      if (conceptosRows.length > 0) {
        lineas.push('');
        lineas.push('| Cód. | Descripción del Concepto | Haberes ($) | Descuentos ($) | Clasificación |');
        lineas.push('| :--- | :--- | ---: | ---: | :--- |');
        conceptosRows.forEach(c => {
          lineas.push('| ' + (c.codigo || '—') + ' | ' + (c.descripcion || '—') + ' | ' + (c.haberes > 0 ? fmtP(c.haberes) : '—') + ' | ' + (c.descuentos > 0 ? fmtP(c.descuentos) : '—') + ' | ' + (c.clasificacion || '—') + ' |');
        });
      }
      return lineas.join('\n');
    }

    async function realizarAuditoriaOCR(base64OArchivos, contexto = {}) {
      const tieneContenidoAuditable = (a) => Boolean(
        a && (a.base64 || (a.textoExtraido && String(a.textoExtraido).trim().length >= 50))
      );
      let archivos = [];
      if (Array.isArray(base64OArchivos) && base64OArchivos.length > 0) {
        archivos = base64OArchivos.filter(tieneContenidoAuditable);
      } else if (Array.isArray(contexto && contexto.archivos) && contexto.archivos.length > 0) {
        archivos = contexto.archivos.filter(tieneContenidoAuditable);
      } else if (typeof base64OArchivos === 'string' && base64OArchivos.trim()) {
        archivos = [{
          nombre: (contexto && contexto.nombre) || 'documento_auditoria.pdf',
          mimeType: (contexto && contexto.mimeType) || 'application/pdf',
          base64: base64OArchivos,
          textoExtraido: (contexto && contexto.textoExtraido) ? String(contexto.textoExtraido) : ''
        }];
      } else if (contexto && contexto.textoExtraido && String(contexto.textoExtraido).trim().length >= 50) {
        archivos = [{
          nombre: (contexto && contexto.nombre) || 'recibo_markitdown.pdf',
          mimeType: 'application/pdf',
          base64: '',
          textoExtraido: String(contexto.textoExtraido).trim()
        }];
      }

      archivos = archivos.map(a => Object.assign({}, a, {
        base64: a.base64 ? limpiarBase64ParaAPI(a.base64) : '',
        textoExtraido: a.textoExtraido ? String(a.textoExtraido).trim() : ''
      })).filter(a => Boolean(a.base64 || a.textoExtraido.length >= 50));

      if (archivos.length === 0) {
        window._ultimaErrorAuditoriaIA = 'No se encontró capa de texto ni contenido binario Base64 válido para auditar.';
        return null;
      }

      const SERVICIO_AUDITORIA_CLOUD_URL = (typeof AUDITOR_API_URL === 'string' && AUDITOR_API_URL.startsWith('http'))
        ? AUDITOR_API_URL
        : 'https://ammer-auditor-api.onrender.com/api/auditar-recibo';
      const hostName = (typeof window !== 'undefined' && window.location && window.location.hostname)
        ? String(window.location.hostname).toLowerCase()
        : '';
      const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? String(window.location.origin).toLowerCase()
        : '';
      const esHostEstatico = hostName.includes('script.google') ||
        hostName.includes('github.io') ||
        (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');

      const candidatosEndpoints = [];
      if (contexto && contexto.endpoint) {
        candidatosEndpoints.push(String(contexto.endpoint));
      } else if (esHostEstatico) {
        candidatosEndpoints.push(SERVICIO_AUDITORIA_CLOUD_URL);
      } else {
        // 1. Microservicio de auditoría forense con Gemini Pro en Render (Oficial AMMER)
        candidatosEndpoints.push(SERVICIO_AUDITORIA_CLOUD_URL);
        // 2. Proxy local Express Node.js
        candidatosEndpoints.push('/api/auditar-recibo');
        candidatosEndpoints.push('/api/auditar-documentos');
      }

      const ejecutarPeticionAuditoria = async (urlDestino) => {
        const esAppsScript = urlDestino === APPS_SCRIPT_URL || urlDestino.includes('script.google.com');
        const primerArchivo = archivos[0] || {};
        const b64Limpio = limpiarBase64ParaAPI(primerArchivo.fileBase64 || primerArchivo.base64Archivo || primerArchivo.base64 || '');
        const nombreArchivo = primerArchivo.fileName || primerArchivo.nombreArchivo || primerArchivo.nombre || 'recibo_sueldo.pdf';
        const mimeTypeArchivo = primerArchivo.mimeType || primerArchivo.tipoMime || 'application/pdf';
        const datosDecl = (contexto && contexto.datosDeclarados) || null;

        const archivosMapeados = archivos.map(a => {
          const b64Item = limpiarBase64ParaAPI(a.fileBase64 || a.base64Archivo || a.base64 || '');
          const nomItem = a.fileName || a.nombreArchivo || a.nombre || 'archivo.pdf';
          const mimeItem = a.mimeType || a.tipoMime || 'application/pdf';
          return {
            nombre: nomItem,
            fileName: nomItem,
            nombreArchivo: nomItem,
            mimeType: mimeItem,
            tipoMime: mimeItem,
            base64: b64Item,
            fileBase64: b64Item,
            base64Archivo: b64Item,
            textoExtraido: a.textoExtraido || ''
          };
        });

        const bodyPayload = esAppsScript
          ? {
              action: 'analizarRecibo',
              idSolicitud: (contexto && contexto.idSolicitud) || 'DOCUMENTOS_SUELTOS',
              archivos: archivosMapeados,
              fileBase64: b64Limpio,
              base64Archivo: b64Limpio,
              base64: b64Limpio,
              fileName: nombreArchivo,
              nombreArchivo: nombreArchivo,
              mimeType: mimeTypeArchivo,
              tipoMime: mimeTypeArchivo,
              textoExtraido: primerArchivo.textoExtraido || '',
              datosDeclarados: datosDecl,
              datosContexto: datosDecl
            }
          : {
              archivos: archivosMapeados,
              fileBase64: b64Limpio,
              base64Archivo: b64Limpio,
              base64: b64Limpio,
              fileName: nombreArchivo,
              nombreArchivo: nombreArchivo,
              mimeType: mimeTypeArchivo,
              tipoMime: mimeTypeArchivo,
              textoExtraido: primerArchivo.textoExtraido || '',
              datosDeclarados: datosDecl
            };

        const fetchOpts = {
          method: 'POST',
          headers: {
            'Content-Type': esAppsScript ? 'text/plain;charset=utf-8' : 'application/json'
          },
          redirect: 'follow',
          body: JSON.stringify(bodyPayload)
        };
        if (contexto && contexto.signal) {
          fetchOpts.signal = contexto.signal;
        }

        const timeoutMs = (contexto && Number(contexto.timeoutMs) > 0) ? Number(contexto.timeoutMs) : 90000;
        let resp = null;
        let data = null;
        let rawText = '';
        try {
          resp = await fetchConTimeout(urlDestino, fetchOpts, timeoutMs);
          if (resp && typeof resp.text === 'function') {
            rawText = await resp.text();
            if (rawText && String(rawText).trim()) {
              data = extraerJSONResiliente(rawText);
            }
          }
          if (!data && resp && typeof resp.json === 'function') {
            data = await resp.json();
          }
        } catch (errFetch) {
          return {
            resp,
            data: null,
            rawText,
            esAppsScript,
            error: errFetch && errFetch.message ? errFetch.message : String(errFetch)
          };
        }
        return { resp, data, rawText, esAppsScript, error: null };
      };

      let ultimoResultadoRed = null;
      let detectadoStubAppsScript = false;

      for (let idxEp = 0; idxEp < candidatosEndpoints.length; idxEp++) {
        const epUrl = candidatosEndpoints[idxEp];
        const resCandidato = await ejecutarPeticionAuditoria(epUrl);
        ultimoResultadoRed = resCandidato;

        const { resp, data } = resCandidato;
        const esRespuestaHtmlFallback = Boolean(
          resp && resp.ok && !data && rawStartsWithHtml(resCandidato.rawText)
        );
        const rutaNoDisponible = !resp || resp.status === 404 || resp.status === 405 || esRespuestaHtmlFallback;

        if (rutaNoDisponible) {
          continue;
        }

        if (data && esStubBitacoraSinOCR(data)) {
          detectadoStubAppsScript = true;
          continue;
        }

        const operacionExitosa = Boolean(resp && resp.ok && data && data.ok !== false && data.success !== false);
        if (operacionExitosa) {
          const rawAudit = data.auditoria ||
            data.resultado ||
            data.data ||
            ((data.resumenDecision || data.detalleCompletoRecibo || data.identidad || data.datosAgente || data.liquidacion || data.radiografiaSalarial || data.reciboSueldo || data.scoringCrediticio || data.scoringAmmer || data.sueldoBrutoTotal !== undefined || data.sueldoBruto !== undefined || Array.isArray(data.conceptos)) ? data : null);
          const normalized = normalizarResultadoAuditoriaIA(rawAudit || data);
          if (normalized) {
            return normalized;
          }
        }

        // Si el endpoint institucional respondió con error real (400/401/403/422/5xx), detener y mostrarlo directamente sin ocultar el status
        if (!resCandidato.esAppsScript && resp && !resp.ok && resp.status !== 404 && resp.status !== 405) {
          break;
        }
      }

      if (detectadoStubAppsScript && (!ultimoResultadoRed || esStubBitacoraSinOCR(ultimoResultadoRed.data))) {
        const msgStub = 'El Web App de Google Apps Script conectado aún ejecuta una versión anterior sin OCR activo. En Apps Script seleccione Implementar > Administrar implementaciones > Editar > Nueva versión con el Code.gs actualizado.';
        console.warn('Detectado stub sin OCR en Apps Script:', msgStub);
        window._ultimaErrorAuditoriaIA = msgStub;
        return null;
      }

      const { resp, data, rawText, error: errRed } = ultimoResultadoRed || {};
      const statusNum = resp ? resp.status : 0;
      const errSrvTexto = data && (data.error || data.detail || data.mensaje || data.message);
      let msgErr = '';
      if (statusNum === 401) {
        msgErr = 'Error 401: Tu sesión ante el servidor institucional expiró o falta token de autorización. Cerrá sesión desde el menú lateral y volvé a ingresar.';
      } else if (errSrvTexto) {
        msgErr = (statusNum && !String(errSrvTexto).includes(String(statusNum)))
          ? ('Error ' + statusNum + ': ' + errSrvTexto)
          : String(errSrvTexto);
      } else {
        msgErr = errRed || ('Error ' + (statusNum || 'de red') + ': ' + String(rawText || 'Sin respuesta del servidor documental').substring(0, 160));
      }
      console.warn('Servicio de auditoría devolvió error técnico:', msgErr);
      window._ultimaErrorAuditoriaIA = msgErr;
      return null;
    }

    function rawStartsWithHtml(txt) {
      const t = String(txt || '').trim().toLowerCase();
      return t.startsWith('<!doctype') || t.startsWith('<html');
    }

    async function procesarAuditoriaConTimeout(base64, contexto = {}) {
      const loader = document.getElementById('loader-auditoria-ia');
      const loadBar = document.getElementById('aiAuditLoadingBar');
      if (loader && (!loadBar || loadBar.style.display === 'none')) {
        loader.classList.remove('hidden');
      }
      window._ultimaErrorAuditoriaIA = null;

      let timeoutId = null;
      const abortController = (typeof AbortController === 'function') ? new AbortController() : null;
      const timeoutMs = (contexto && Number(contexto.timeoutMs) > 0) ? Number(contexto.timeoutMs) : 90000;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          if (abortController && !abortController.signal.aborted) {
            abortController.abort('TIMEOUT_EXCEDIDO');
          }
          reject(new Error('TIMEOUT_EXCEDIDO'));
        }, timeoutMs);
      });

      try {
        const ctxConSignal = Object.assign({}, contexto, { timeoutMs }, abortController ? { signal: abortController.signal } : {});
        const resultado = await Promise.race([
          realizarAuditoriaOCR(base64, ctxConSignal),
          timeoutPromise
        ]);
        return resultado;
      } catch (err) {
        const msgErr = err && err.message ? err.message : String(err);
        window._ultimaErrorAuditoriaIA = msgErr;
        console.warn('Auditoría documental no ejecutada:', msgErr);
        return null;
      } finally {
        if (timeoutId !== null) clearTimeout(timeoutId);
        // Garantizar que el spinner se oculte SIEMPRE
        if (loader) loader.classList.add('hidden');
        if (loadBar && !(contexto && contexto.preservarLoadingBar)) {
          loadBar.style.display = 'none';
        }
      }
    }

    window._auditoriasEnVuelo = window._auditoriasEnVuelo || {};

    async function ejecutarAuditoriaAutomaticaExpediente(solicitudId, archivosParam) {
      if (!solicitudId) return;
      const keySol = String(solicitudId);
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === keySol);
      if (!s) return;

      window._auditoriasEnVuelo[keySol] = Date.now();
      let finalizado = false;
      const resolverEstadoPendiente = (motivoError) => {
        if (finalizado) return;
        finalizado = true;
        delete window._auditoriasEnVuelo[keySol];
        const frescas = getStoredSolicitudes();
        const sFresca = frescas.find(x => String(x.id) === keySol);
        if (sFresca && (!sFresca.auditoriaIA || sFresca.auditoriaIA.estado === 'procesando')) {
          sFresca.auditoriaIA = {
            estado: 'pendiente_revision',
            fechaFin: obtenerFechaHora24hs(),
            error: motivoError || 'No se recibió lectura documental verificada. Ejecute la auditoría manualmente con los comprobantes nítidos.',
            resultado: null
          };
          saveStoredSolicitudes(frescas);
          const modalActivo = document.getElementById('modalVerFichaCompleta');
          if (modalActivo && modalActivo.classList.contains('open')) {
            const titActivo = document.getElementById('fichaModalTitle');
            const prefDef = obtenerPrefijoOficialExpediente(sFresca);
            if (titActivo && (titActivo.innerHTML.includes(prefDef) || titActivo.innerHTML.includes(sFresca.id_provisorio || '') || titActivo.innerHTML.includes(sFresca.id))) {
              verFichaCompleta(sFresca.id);
            }
          }
          renderModuloMutual();
        }
      };
      const watchdogTimer = setTimeout(() => resolverEstadoPendiente('Tiempo de espera agotado en análisis documental.'), 36000);

      // Marcar estado en segundo plano sin inventar resultados
      const resultadoPrevio = s.auditoriaIA && s.auditoriaIA.resultado ? s.auditoriaIA.resultado : null;
      s.auditoriaIA = {
        estado: 'procesando',
        fechaInicio: obtenerFechaHora24hs(),
        resultado: resultadoPrevio
      };
      saveStoredSolicitudes(all);

      // Preparar payload de documentos reales (prohibido enviar PDF vacío falso)
      let archivosAEnviar = [];
      if (archivosParam && Array.isArray(archivosParam) && archivosParam.length > 0) {
        archivosAEnviar = archivosParam.filter(a => a && a.base64);
      }
      if (archivosAEnviar.length === 0 && s.adjuntos && s.adjuntos.length > 0) {
        archivosAEnviar = s.adjuntos
          .filter(a => a && (a.base64 || a.dataUrl))
          .map(a => ({
            nombre: a.nombre,
            mimeType: a.tipoMime || (String(a.nombre || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            base64: a.base64 || a.dataUrl
          }));
      }

      if (archivosAEnviar.length === 0) {
        clearTimeout(watchdogTimer);
        resolverEstadoPendiente('No hay archivos binarios adjuntos en memoria para lectura documental automática.');
        return;
      }

      const datosDeclarados = {
        nombre: s.solicitante?.nombre || '',
        dni: s.solicitante?.dni || '',
        cuil: s.solicitante?.cuil || s.datosContacto?.cuil || '',
        fechaNacimiento: s.solicitante?.fechaNacimiento || s.solicitante?.fechaNac || '',
        organismo: s.solicitante?.organismo || '',
        cuota: s.propuestaMutual?.cuotaEstimada || s.prestamo?.cuotaEstimada || 0,
        plazoCuotas: s.propuestaMutual?.cuotas || s.prestamo?.cuotas || 0,
        monto: s.propuestaMutual?.monto || s.prestamo?.monto || 0,
        dependencia: s.solicitante?.dependencia || '',
        domicilio: s.solicitante?.domicilio || ''
      };

      try {
        for (let i = 0; i < archivosAEnviar.length; i++) {
          const itemAuto = archivosAEnviar[i];
          if (itemAuto && itemAuto.base64) {
            itemAuto.base64 = limpiarBase64ParaAPI(itemAuto.base64);
            const esPdfAuto = String(itemAuto.mimeType || '').toLowerCase().includes('pdf') ||
              String(itemAuto.nombre || '').toLowerCase().endsWith('.pdf');
            if (esPdfAuto) {
              itemAuto.mimeType = 'application/pdf';
            }
          }
        }

        const auditRes = await procesarAuditoriaConTimeout(archivosAEnviar, {
          idSolicitud: solicitudId,
          datosDeclarados: datosDeclarados,
          permitirBackendSinKey: true,
          preservarLoadingBar: true,
          timeoutMs: 90000
        });

        finalizado = true;
        clearTimeout(watchdogTimer);
        delete window._auditoriasEnVuelo[keySol];

        const frescas = getStoredSolicitudes();
        const sFresca = frescas.find(x => String(x.id) === keySol);
        if (!sFresca) return;

        if (auditRes) {
          sFresca.auditoriaIA = {
            estado: 'completado',
            fechaFin: obtenerFechaHora24hs(),
            resultado: auditRes
          };
          const sc = auditRes.scoringCrediticio || {};
          if ((sc.dictamen === 'OBSERVADO' || sc.dictamen === 'RECHAZADO') && (sFresca.estado === 'Pendiente' || sFresca.estado === 'En Análisis')) {
            sFresca.estado = 'Observado';
          }
          // Persistir dictamen real en nube vía proxy autenticado
          if (RENDER_API_URL && !RENDER_API_URL.includes('[TU_API]')) {
            callApi({ action: 'auditarConIA', idSolicitud: solicitudId, resultado: auditRes }).catch(() => {});
          }
        } else {
          sFresca.auditoriaIA = {
            estado: 'pendiente_revision',
            fechaFin: obtenerFechaHora24hs(),
            error: window._ultimaErrorAuditoriaIA || 'No se pudo completar la lectura documental automática.',
            resultado: resultadoPrevio
          };
        }

        saveStoredSolicitudes(frescas);

        const modalActivo = document.getElementById('modalVerFichaCompleta');
        if (modalActivo && modalActivo.classList.contains('open')) {
          const titActivo = document.getElementById('fichaModalTitle');
          const prefDef = obtenerPrefijoOficialExpediente(sFresca);
          if (titActivo && (titActivo.innerHTML.includes(prefDef) || titActivo.innerHTML.includes(sFresca.id_provisorio || '') || titActivo.innerHTML.includes(sFresca.id))) {
            verFichaCompleta(sFresca.id);
          }
        }
        renderModuloMutual();
      } catch (err) {
        console.warn('Auditoría documental automática interrumpida:', err.message || err);
        finalizado = false;
        resolverEstadoPendiente(err.message || 'Error de conexión con servicio documental.');
      } finally {
        clearTimeout(watchdogTimer);
        delete window._auditoriasEnVuelo[keySol];
      }
    }

    function generarResultadoContingencia() {
      // Prohibido inventar, redondear o estimar importes, fechas o nombres.
      return null;
    }

    /* --- RENDERIZADO DEL APARTADO EJECUTIVO EN FICHA (5 SECCIONES + CASCADA PADRÓN OFICIAL) --- */
    function renderApartadoEjecutivoAuditoriaFicha(s) {
      const aud = s.auditoriaIA;
      const res = (aud && aud.resultado) ? normalizarResultadoAuditoriaIA(aud.resultado, { usarEstadoAlmacenado: true }) : null;

      if (!res) {
        const msgPend = (aud && aud.estado === 'procesando')
          ? 'Auditoría documental en curso...'
          : ((aud && aud.error) ? ('Observación técnica: ' + sanitizeHTML(aud.error)) : 'Aún no se ejecutó la verificación documental sobre los comprobantes digitales de este expediente.');
        return '<div class="ai-executive-audit-card">' +
          '<div class="ai-executive-header">' +
            '<div>' +
              '<h4 style="font-size:0.85rem;font-weight:800;color:var(--color-primary);margin:0;">Auditoría Documental y Crediticia AMMER</h4>' +
              '<span style="font-size:0.68rem;color:var(--text-muted);">Evaluación Salarial y Capacidad de Ayuda Económica</span>' +
            '</div>' +
            '<span class="dictamen-pill dictamen-observado" style="font-size:0.68rem;padding:3px 10px;margin-top:0;">PENDIENTE DE AUDITORÍA</span>' +
          '</div>' +
          '<p style="font-size:0.75rem;color:var(--text-muted);margin:0.4rem 0 0.75rem 0;line-height:1.45;">' + msgPend + '</p>' +
          '<div style="display:flex;justify-content:flex-end;">' +
            '<button type="button" class="btn-primary-action" style="width:auto;padding:6px 14px;font-size:0.74rem;background:#1e3a8a;border-color:#172554;" onclick="abrirAuditoriaModalExpediente(\'' + s.id + '\')">' +
              '🔍 Auditar Documentación del Legajo' +
            '</button>' +
          '</div>' +
        '</div>';
      }

      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const fmtP = (typeof formatPesosMargen === 'function') ? formatPesosMargen : formatMontoAuditoriaExacto;
      const sc = res.scoringCrediticio || {};
      const rec = res.reciboSueldo || {};
      const resDec = res.resumenDecision || {};
      const am = res.analisisMargen || {};
      const cruce = res.cruceIdentidad || {};

      const esPasivo = (am.tipoBeneficiario || resDec.tipoBeneficiario || rec.tipoBeneficiario) === 'PASIVO';
      const lugarTrabajo = am.lugarTrabajo || resDec.lugarTrabajo || rec.lugarTrabajo || (esPasivo ? 'JU_' : 'GE_');
      const pctTopeLbl = esPasivo ? '35%' : '20%';
      const pctAfectLbl = esPasivo ? '65%' : '80%';
      const esPadron = am && am.esCalculoPadron !== false && am.subtotal1 !== undefined;

      const score = typeof sc.puntajeTotal === 'number' ? sc.puntajeTotal : 0;
      const periodoTxtHeader = (rec.periodo && rec.periodo !== TEXTO_ILEGIBLE_AMMER) ? (' • ' + sanitizeHTML(rec.periodo)) : '';
      const badgeHtml = '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe;font-weight:700;font-size:0.68rem;">📋 AUDITORÍA INFORMATIVA' + periodoTxtHeader + '</span>';

      let dictamen = sc.dictamen || 'INFORMATIVO';
      if (dictamen.startsWith('APTO_')) dictamen = 'APTO_OTORGAMIENTO';
      let dictamenClass = 'ai-score-green';
      let fillClass = 'ai-fill-green';
      let dictamenCesion = 'Con margen computable informado en recibo';
      if (score < 60 || dictamen === 'RECHAZADO') {
        dictamenClass = 'ai-score-amber';
        fillClass = 'ai-fill-amber';
        dictamenCesion = 'Margen acotado o sujeto a verificación de análisis';
      } else if (score < 80 || dictamen === 'OBSERVADO') {
        dictamenClass = 'ai-score-amber';
        fillClass = 'ai-fill-amber';
        dictamenCesion = 'Sujeto a revisión documental complementaria';
      }
      const califLetra = score >= 80 ? 'Lectura Completa' : (score >= 60 ? 'Lectura Parcial / Revisar' : 'Requiere Revisión Manual');

      // 1) Validación de Identidad
      const estadoCotejo = cruce.estadoCotejo || ((cruce.coincideDni && cruce.coincideNombre) ? 'COINCIDE' : 'DISCREPANCIA DETECTADA');
      const idOkCotejo = estadoCotejo === 'COINCIDE' || estadoCotejo.startsWith('VERIFICADO EN DOCUMENTO');
      const idBadge = idOkCotejo
        ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:#dcfce7;color:#166534;font-weight:700;font-size:0.67rem;">✅ ' + sanitizeHTML(estadoCotejo) + '</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:#fee2e2;color:#991b1b;font-weight:700;font-size:0.67rem;">🔴 ' + sanitizeHTML(estadoCotejo) + '</span>';
      const periodoVigBadge = (!rec.reciboVencido && rec.estadoPeriodo === 'VIGENTE')
        ? '<span style="padding:2px 7px;border-radius:6px;background:#dcfce7;color:#166534;font-weight:700;font-size:0.66rem;">🟢 VIGENTE</span>'
        : '<span style="padding:2px 7px;border-radius:6px;background:#fef3c7;color:#92400e;font-weight:700;font-size:0.66rem;">⚠️ ' + sanitizeHTML(rec.estadoPeriodo || 'VERIFICAR') + '</span>';

      // 2) Datos Laborales y Antigüedad
      const antBadge = rec.cumpleAntiguedadMinima === true
        ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:#dcfce7;color:#166534;font-weight:700;font-size:0.67rem;">✅ CUMPLE MÍNIMO 1 AÑO</span>'
        : (rec.cumpleAntiguedadMinima === false
          ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:#fee2e2;color:#991b1b;font-weight:700;font-size:0.67rem;">🔴 NO CUMPLE 1 AÑO</span>'
          : '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:#e0f2fe;color:#075985;font-weight:700;font-size:0.67rem;">ℹ️ VERIFICAR FECHA EN CARÁTULA</span>');

      // 3) Tabla de Radiografía Salarial Literal (resumen de aparición en recibo + importe)
      const totalHaberesVal = am.totalHaberes ?? resDec.sueldoBrutoTotal ?? rec.sueldoBruto;
      const totalDescVal = am.totalDescuentos ?? resDec.totalDescuentos ?? rec.totalDescuentosRecibo;
      const netLiquidoVal = am.netoLiquido ?? resDec.sueldoLiquido ?? rec.sueldoNeto;
      const totalSub1Val = am.totalSubtotal1Desc ?? resDec.totalSubtotal1Desc ?? rec.descuentosLey;
      const subtotal1Val = am.subtotal1 ?? resDec.subtotal1;
      const subtotalTopeVal = am.subtotalTope ?? resDec.subtotalTope;
      const subtotal2Val = am.subtotal2 ?? resDec.subtotal2;
      const totalNoCompVal = am.totalNoComputable ?? resDec.totalNoComputable ?? 0;
      const afectableVal = am.afectable ?? resDec.afectable;
      const totalAfectadoVal = am.totalAfectado ?? resDec.totalAfectado ?? 0;
      const cuotaFutura2Val = am.cuotaFutura2 ?? resDec.cuotaFutura2 ?? 0;

      const bersaVal = r2(Math.max(0, Number(rec.consumosBersa || 0)));
      const sidecreerVal = r2(Math.max(0, Number(rec.consumosSidecreer || 0)));
      const mutualesVal = r2(Math.max(0, Number(rec.otrasMutuales || 0)));
      const fedemTotalVal = r2(Math.max(0, Number(rec.codigosFedemMonto || 0)));
      const fedemList = Array.isArray(rec.codigosFedemDetectados) ? rec.codigosFedemDetectados : [];

      let cuotaSocialFedemVal = 0;
      let consumosFedemVal = 0;
      const conceptosRad = (
        (res.detalleCompletoRecibo && Array.isArray(res.detalleCompletoRecibo.conceptos) && res.detalleCompletoRecibo.conceptos) ||
        (Array.isArray(rec.conceptos) && rec.conceptos) ||
        (Array.isArray(res.conceptos) && res.conceptos) ||
        (Array.isArray(am.items) && am.items) ||
        []
      );

      for (let i = 0; i < conceptosRad.length; i++) {
        const it = conceptosRad[i] || {};
        const imp = Math.abs(Number(it.descuentos ?? it.importe ?? 0) || 0);
        if (imp <= 0) continue;
        const descNorm = (typeof normalizarDescripcionPadron === 'function')
          ? normalizarDescripcionPadron(it.descripcion || '')
          : String(it.descripcion || '').toUpperCase();
        const codRaw = String(it.codigo || '').trim();
        const codBase = (typeof stripZerosPadron === 'function' && typeof quitarSufijoCodigoPadron === 'function' && typeof normalizarCodigoLookupPadron === 'function')
          ? stripZerosPadron(quitarSufijoCodigoPadron(normalizarCodigoLookupPadron(codRaw)))
          : codRaw.replace(/^0+/, '');
        const esFedemItem = ['366', '368', '369', '1115', '1117'].includes(codBase) || descNorm.includes('FEDEM');
        if (!esFedemItem) continue;

        const esCuotaSocialDesc = /(CUOTA|CTA\.?)\s*(SOCIAL|SOCIETARIA|AFILIACION)/i.test(descNorm);
        const esConsumoDesc = /CONSUMO|DESCTO\.?\s*CONSUMO|PRESTAMO|AYUDA|VARIOS/i.test(descNorm);
        if (esCuotaSocialDesc || ((codBase === '366' || codBase === '1115') && !esConsumoDesc)) {
          cuotaSocialFedemVal = r2(cuotaSocialFedemVal + imp);
        } else {
          consumosFedemVal = r2(consumosFedemVal + imp);
        }
      }

      if (cuotaSocialFedemVal === 0 && consumosFedemVal === 0 && fedemTotalVal > 0) {
        const fedemListTxt = fedemList.join(' ').toUpperCase();
        const tieneCuotaCode = /\b(366|1115)\b|CUOTA|SOCIETARIA/.test(fedemListTxt);
        const tieneConsCode = /\b(368|369|1117)\b|CONSUMO|VARIOS/.test(fedemListTxt);
        if (tieneCuotaCode && !tieneConsCode) {
          cuotaSocialFedemVal = fedemTotalVal;
        } else {
          consumosFedemVal = fedemTotalVal;
        }
      }

      const sueldoBrutoTxt = fmtP(totalHaberesVal ?? 0);
      const descLeyTxt = fmtP(totalSub1Val ?? 0);
      const totalDescTxt = fmtP(totalDescVal ?? 0);
      const sueldoNetoTxt = fmtP(netLiquidoVal ?? 0);

      const renderFilaCodigoRadiografia = (nombreConcepto, montoVal, notaSutil = '') => {
        const aparece = Number(montoVal || 0) > 0;
        const badgeEstado = aparece
          ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:700;font-size:0.68rem;">✅ Aparece</span>'
          : '<span style="display:inline-flex;align-items:center;gap:3px;padding:1px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;font-weight:600;font-size:0.68rem;">No aparece</span>';
        const montoHtml = aparece
          ? '<span style="font-weight:700;color:#0f172a;">' + sanitizeHTML(fmtP(montoVal)) + '</span>'
          : '<span style="color:#94a3b8;">—</span>';
        const subHtml = notaSutil
          ? ' <span style="font-size:0.66rem;color:#64748b;font-weight:400;">(' + sanitizeHTML(notaSutil) + ')</span>'
          : '';
        return '<tr style="border-bottom:1px solid #f1f5f9;">' +
          '<td style="padding:5px 6px;">' + sanitizeHTML(nombreConcepto) + subHtml + '</td>' +
          '<td style="padding:5px 6px;text-align:center;">' + badgeEstado + '</td>' +
          '<td style="padding:5px 6px;text-align:right;">' + montoHtml + '</td>' +
        '</tr>';
      };

      // 4) Afectación Padrón, Endeudamiento 41,67% y Embargos (Semáforo)
      const disponibleVal = parseNumeroSeguroAuditoria(
        am.disponibleRecibo ?? resDec.disponibleRecibo ?? resDec.margenDisponiblePlanilla ?? rec.margenDisponibleCuota
      );
      const topeEndeudVal = parseNumeroSeguroAuditoria(am.topeEndeudamientoMensual4167) ?? (netLiquidoVal ? r2((5 * Math.max(0, Number(netLiquidoVal))) / 12) : 0);
      const puedeOfrecer = (am.puedeOfrecerCuotas !== undefined)
        ? (Boolean(am.puedeOfrecerCuotas) && (disponibleVal || 0) > 0)
        : ((disponibleVal || 0) > 0);
      const cuotaSeguraVal = parseNumeroSeguroAuditoria(am.cuotaMaximaSeguraGeneral ?? resDec.cuotaMaximaSeguraGeneral) ?? (puedeOfrecer ? r2(Math.min(disponibleVal || 0, topeEndeudVal || 0)) : 0);
      const cuotaSolicitada = Number(s.propuestaMutual?.cuotaEstimada || s.prestamo?.cuotaEstimada || 0);

      const capComputableTxt = fmtP(afectableVal ?? rec.topeLegal50Porciento ?? 0);
      const margenTxt = (disponibleVal === null) ? 'No disponible' : (puedeOfrecer ? fmtP(disponibleVal) : ('SIN Disponible (' + fmtP(disponibleVal) + ')'));
      const cuotaSeguraTxt = puedeOfrecer ? fmtP(cuotaSeguraVal) : 'SIN Disponible';

      let semaforoBg = '#dcfce7';
      let semaforoFg = '#166534';
      let semaforoLbl = '🟢 DISPONIBLE · ' + (esPasivo ? 'Pasivos 65%' : 'Activos 80%');
      if (disponibleVal === null || Number.isNaN(Number(disponibleVal))) {
        semaforoBg = '#fef3c7';
        semaforoFg = '#92400e';
        semaforoLbl = '🟡 VERIFICAR MARGEN';
      } else if (!puedeOfrecer || disponibleVal <= 0) {
        semaforoBg = '#fee2e2';
        semaforoFg = '#991b1b';
        semaforoLbl = '🔴 SIN Disponible (Oferta bloqueada)';
      } else if (cuotaSolicitada > 0 && cuotaSeguraVal < cuotaSolicitada) {
        semaforoBg = '#fee2e2';
        semaforoFg = '#991b1b';
        semaforoLbl = '🔴 CUOTA SOLICITADA EXCEDE TOPE';
      } else if (cuotaSolicitada > 0 && cuotaSeguraVal < cuotaSolicitada * 1.15) {
        semaforoBg = '#fef3c7';
        semaforoFg = '#92400e';
        semaforoLbl = '🟡 MARGEN AJUSTADO';
      }

      const alertasArr = Array.isArray(am.alertas) ? am.alertas : (Array.isArray(res.alertas) ? res.alertas : []);
      const alertasHtmlFicha = alertasArr.length > 0
        ? ('<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:6px 8px;margin-bottom:6px;font-size:0.69rem;color:#92400e;">' +
            '<strong>⚠️ Alertas de Cabecera / Padrón:</strong><ul style="margin:3px 0 0 14px;padding:0;">' +
            alertasArr.map(a => '<li>' + sanitizeHTML(a) + '</li>').join('') +
            '</ul></div>')
        : '';

      const cuotaRefFicha = Number(am.cuotaRefinanciar ?? resDec.cuotaRefinanciar ?? 0) || 0;
      const saldoCancFicha = Number(am.saldoCancelar ?? resDec.saldoCancelar ?? 0) || 0;
      const saldoExtFicha = Number(am.saldoVigenteExterno ?? resDec.saldoVigenteExterno ?? 0) || 0;
      const facMargenFicha = Number(am.factorMargen ?? resDec.factorMargen ?? 1.0) || 1.0;
      const conclFicha = res.conclusionesRecomendaciones || null;

      const waterfallFichaHtml = esPadron
        ? ('<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:0.69rem;color:#334155;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;">' +
            '<span><strong>Subtotal1:</strong> ' + sanitizeHTML(fmtP(subtotal1Val ?? 0)) + '</span>' +
            '<span><strong>Tope ' + pctTopeLbl + ':</strong> -' + sanitizeHTML(fmtP(subtotalTopeVal ?? 0)) + '</span>' +
            '<span><strong>Subtotal2 (' + pctAfectLbl + '):</strong> ' + sanitizeHTML(fmtP(subtotal2Val ?? 0)) + '</span>' +
            '<span><strong>No Comp.:</strong> -' + sanitizeHTML(fmtP(totalNoCompVal)) + '</span>' +
            '<span><strong>Afectado:</strong> -' + sanitizeHTML(fmtP(totalAfectadoVal)) + (cuotaFutura2Val > 0 ? (' · <strong>CF2:</strong> -' + sanitizeHTML(fmtP(cuotaFutura2Val))) : '') + '</span>' +
            (cuotaRefFicha > 0 ? ('<span><strong>Cuota Refinanciar:</strong> +' + sanitizeHTML(fmtP(cuotaRefFicha)) + '</span>') : '') +
            (saldoCancFicha > 0 ? ('<span><strong>Saldo Cancelar:</strong> ' + sanitizeHTML(fmtP(saldoCancFicha)) + '</span>') : '') +
            (saldoExtFicha > 0 ? ('<span><strong>Saldo Externo:</strong> ' + sanitizeHTML(fmtP(saldoExtFicha)) + '</span>') : '') +
            (facMargenFicha < 1 ? ('<span><strong>Criterio:</strong> ' + Math.round(facMargenFicha * 100) + '%</span>') : '') +
          '</div>')
        : '';

      const conclFichaHtml = (conclFicha && conclFicha.titulo)
        ? ('<div style="margin-top:8px;padding:6px 8px;border-radius:6px;background:#eef2ff;border:1px solid #c7d2fe;font-size:0.71rem;color:#1e293b;">' +
            '<div style="font-weight:800;color:#312e81;">💡 ' + sanitizeHTML(conclFicha.titulo) + '</div>' +
            (conclFicha.resumen ? ('<div style="margin-top:2px;">' + sanitizeHTML(conclFicha.resumen) + '</div>') : '') +
            ((Array.isArray(conclFicha.recomendaciones) && conclFicha.recomendaciones.length > 0)
              ? ('<ul style="margin:4px 0 0 14px;padding:0;">' + conclFicha.recomendaciones.map(rc => '<li>' + sanitizeHTML(rc) + '</li>').join('') + '</ul>')
              : '') +
          '</div>')
        : '';

      const memo = res.informeEjecutivo || 'Revisar detalle documental.';

      const catRawCard = String(rec.categoria || res.categoria || resDec.categoria || '').trim();
      const catValCard = (catRawCard && !/no consta|no especificada|n\/a/i.test(catRawCard)) ? catRawCard : '';
      const legajoRawCard = String(rec.legajo || res.legajo || resDec.legajo || '').trim();
      const legajoValCard = (legajoRawCard && !/no consta|no especificada|n\/a/i.test(legajoRawCard)) ? legajoRawCard : '';

      const catBadgeHtml = catValCard
        ? '<div><span style="color:#64748b;font-size:0.67rem;">🏷️ Categoría:</span><br/><span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:1px 7px;font-weight:700;font-size:0.72rem;">' + sanitizeHTML(/^cat/i.test(catValCard) ? catValCard : ('Cat. ' + catValCard)) + '</span></div>'
        : '';
      const legajoBadgeHtml = legajoValCard
        ? '<div><span style="color:#64748b;font-size:0.67rem;display:inline-flex;align-items:center;gap:3px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M15 10h3M15 14h3"/></svg> Legajo:</span><br/><span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:1px 7px;font-weight:700;font-size:0.72rem;font-family:monospace;">' + sanitizeHTML(legajoValCard) + '</span></div>'
        : '';

      const antigDetalleRawCard = String(rec.antiguedadDetalle || resDec.antiguedad || '').trim();
      const antigDetalleCard = (typeof formatearAntiguedadLegible === 'function')
        ? formatearAntiguedadLegible(antigDetalleRawCard)
        : antigDetalleRawCard;
      const fechaIngCard = String(rec.fechaIngreso || resDec.fechaIngreso || '').trim();
      const antigTextoCard = antigDetalleCard && !/no registrada|no especificada/i.test(antigDetalleCard)
        ? antigDetalleCard
        : (fechaIngCard && !/no consta|sin fecha/i.test(fechaIngCard) ? ('Ingreso ' + fechaIngCard) : 'No especificada');
      const fechaIngSubHtml = (fechaIngCard && !/no consta|sin fecha/i.test(fechaIngCard) && antigTextoCard !== ('Ingreso ' + fechaIngCard))
        ? ' <span style="color:#64748b;font-weight:500;">(Ing. ' + sanitizeHTML(fechaIngCard) + ')</span>'
        : '';

      return '<div class="ai-executive-audit-card" style="display:flex;flex-direction:column;gap:0.75rem;">' +
        '<div class="ai-executive-header">' +
          '<div>' +
            '<h4 style="font-size:0.86rem;font-weight:800;color:var(--color-primary);margin:0;">Auditoría Documental y Crediticia AMMER</h4>' +
            (esAdminAuditoria() ? '<span style="font-size:0.67rem;color:var(--text-muted);">Motor Padrón 2.076 códigos · ' + (esPasivo ? 'Pasivos 65%' : 'Activos 80%') + ' (' + sanitizeHTML(lugarTrabajo) + ')</span>' : '') +
          '</div>' +
          '<div>' + badgeHtml + '</div>' +
        '</div>' +

        // SECCIÓN 1: Validación de Identidad
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:0.65rem 0.85rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
            '<span style="font-size:0.7rem;font-weight:800;color:#1e3a8a;text-transform:uppercase;">1. Validación de Identidad (Recibo vs Carátula)</span>' +
            idBadge +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px;font-size:0.74rem;color:#0f172a;">' +
            '<div><span style="color:#64748b;font-size:0.67rem;">Titular en recibo:</span><br/><strong>' + sanitizeHTML(rec.titular || TEXTO_ILEGIBLE_AMMER) + '</strong></div>' +
            '<div><span style="color:#64748b;font-size:0.67rem;">DNI / CUIL extraído:</span><br/><strong>' + sanitizeHTML(rec.dni || TEXTO_ILEGIBLE_AMMER) + '</strong> • ' + sanitizeHTML(rec.cuil || 'No consta en recibo') + '</div>' +
            '<div><span style="color:#64748b;font-size:0.67rem;">📅 Período Liquidado:</span><br/><strong>' + sanitizeHTML(rec.periodo || TEXTO_ILEGIBLE_AMMER) + '</strong> ' + periodoVigBadge + '</div>' +
          '</div>' +
        '</div>' +

        // SECCIÓN 2: Datos Laborales y Antigüedad
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:0.65rem 0.85rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
            '<span style="font-size:0.7rem;font-weight:800;color:#1e3a8a;text-transform:uppercase;">2. Datos Laborales y Antigüedad</span>' +
            antBadge +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:8px;font-size:0.74rem;color:#0f172a;">' +
            '<div><span style="color:#64748b;font-size:0.67rem;">Organismo / Empleador:</span><br/><strong>' + sanitizeHTML(rec.organismo || TEXTO_ILEGIBLE_AMMER) + '</strong></div>' +
            '<div><span style="color:#64748b;font-size:0.67rem;">Situación de Revista:</span><br/><strong>' + sanitizeHTML(rec.situacionRevista || TEXTO_ILEGIBLE_AMMER) + '</strong></div>' +
            '<div><span style="color:#64748b;font-size:0.67rem;">⏳ Antigüedad / Ingreso:</span><br/><strong>' + sanitizeHTML(antigTextoCard) + '</strong>' + fechaIngSubHtml + '</div>' +
            catBadgeHtml +
            legajoBadgeHtml +
          '</div>' +
        '</div>' +

        // SECCIÓN 3: Tabla de Radiografía Salarial Literal (Resumida)
        '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:0.65rem 0.85rem;">' +
          '<div style="font-size:0.7rem;font-weight:800;color:#1e3a8a;text-transform:uppercase;margin-bottom:6px;">3. Radiografía Salarial Literal</div>' +
          '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.73rem;font-variant-numeric:tabular-nums;">' +
              '<thead>' +
                '<tr style="border-bottom:1px solid #cbd5e1;color:#475569;text-align:left;">' +
                  '<th style="padding:4px 6px;">Concepto / Código en Recibo</th>' +
                  '<th style="padding:4px 6px;text-align:center;">Estado en Recibo</th>' +
                  '<th style="padding:4px 6px;text-align:right;">Importe ($)</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody>' +
                '<tr style="border-bottom:1px solid #f1f5f9;">' +
                  '<td style="padding:5px 6px;font-weight:700;">Sueldo Bruto Total</td>' +
                  '<td style="padding:5px 6px;text-align:center;color:#64748b;font-size:0.68rem;">Haberes</td>' +
                  '<td style="padding:5px 6px;text-align:right;font-weight:700;">' + sanitizeHTML(sueldoBrutoTxt) + '</td>' +
                '</tr>' +
                '<tr style="border-bottom:1px solid #f1f5f9;">' +
                  '<td style="padding:5px 6px;">Total de Descuentos por Ley</td>' +
                  '<td style="padding:5px 6px;text-align:center;color:#64748b;font-size:0.68rem;">' + (Number(totalSub1Val || 0) > 0 ? 'Aplicado' : '—') + '</td>' +
                  '<td style="padding:5px 6px;text-align:right;color:#b91c1c;">' + sanitizeHTML(descLeyTxt) + '</td>' +
                '</tr>' +
                renderFilaCodigoRadiografia('Bancos / Consumos BERSA', bersaVal) +
                renderFilaCodigoRadiografia('Consumos Sidecreer', sidecreerVal) +
                renderFilaCodigoRadiografia('Otras Mutuales / Cooperativas', mutualesVal) +
                renderFilaCodigoRadiografia('Cuota Social FEDEM', cuotaSocialFedemVal, cuotaSocialFedemVal > 0 ? '366 / 1115' : '') +
                renderFilaCodigoRadiografia('Consumos FEDEM', consumosFedemVal, consumosFedemVal > 0 ? '368 / 1117' : '') +
                '<tr style="border-bottom:1px solid #cbd5e1;background:#fff7ed;">' +
                  '<td style="padding:5px 6px;font-weight:700;">Total Descuentos Recibo</td>' +
                  '<td style="padding:5px 6px;text-align:center;color:#c2410c;font-size:0.68rem;">Consolidado</td>' +
                  '<td style="padding:5px 6px;text-align:right;font-weight:700;color:#c2410c;">' + sanitizeHTML(totalDescTxt) + '</td>' +
                '</tr>' +
                '<tr style="background:#f0fdf4;">' +
                  '<td style="padding:5px 6px;font-weight:800;color:#166534;">Sueldo Líquido de Bolsillo</td>' +
                  '<td style="padding:5px 6px;text-align:center;color:#166534;font-size:0.68rem;font-weight:700;">Neto</td>' +
                  '<td style="padding:5px 6px;text-align:right;font-weight:800;color:#15803d;">' + sanitizeHTML(sueldoNetoTxt) + '</td>' +
                '</tr>' +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +

        ((res.detalleCompletoRecibo && Array.isArray(res.detalleCompletoRecibo.conceptos) && res.detalleCompletoRecibo.conceptos.length > 0) ? (
          '<details style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;">' +
            '<summary style="cursor:pointer;font-size:0.72rem;font-weight:800;color:#1e3a8a;">🧾 Ver Detalle Completo del Recibo (' + res.detalleCompletoRecibo.conceptos.length + ' conceptos literales extraídos)</summary>' +
            '<div style="font-size:0.68rem;color:#475569;margin:6px 0;"><strong>Período:</strong> ' + sanitizeHTML(res.detalleCompletoRecibo.periodo || rec.periodo || '—') + ' • <strong>Escalafón / Cargo:</strong> ' + sanitizeHTML(res.detalleCompletoRecibo.escalafonCargo || rec.escalafonCargo || '—') + '</div>' +
            '<div style="overflow-x:auto;">' +
              '<table style="width:100%;border-collapse:collapse;font-size:0.71rem;font-variant-numeric:tabular-nums;">' +
                '<thead><tr style="background:#f8fafc;border-bottom:1px solid #cbd5e1;"><th style="padding:4px 6px;text-align:left;">Cód.</th><th style="padding:4px 6px;text-align:left;">Concepto / Descripción</th><th style="padding:4px 6px;text-align:right;">Haberes ($)</th><th style="padding:4px 6px;text-align:right;">Descuentos ($)</th>' + (esAdminAuditoria() ? '<th style="padding:4px 6px;text-align:left;">Clasificación</th>' : '') + '</tr></thead>' +
                '<tbody>' +
                  res.detalleCompletoRecibo.conceptos.map(c => {
                    const bCls = (typeof renderBadgeClasificacionPadron === 'function')
                      ? renderBadgeClasificacionPadron(c.clasificacion, c.metodoClasificacion, c.lugarPadronMatch)
                      : sanitizeHTML(c.clasificacion || '—');
                    return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                      '<td style="padding:3px 6px;color:#475569;font-weight:600;">' + sanitizeHTML(c.codigo || '—') + '</td>' +
                      '<td style="padding:3px 6px;">' + sanitizeHTML(c.descripcion || '—') + '</td>' +
                      '<td style="padding:3px 6px;text-align:right;color:#166534;">' + (c.haberes > 0 ? sanitizeHTML(fmtP(c.haberes)) : '—') + '</td>' +
                      '<td style="padding:3px 6px;text-align:right;color:#b91c1c;">' + (c.descuentos > 0 ? sanitizeHTML(fmtP(c.descuentos)) : '—') + '</td>' +
                      (esAdminAuditoria() ? ('<td style="padding:3px 6px;text-align:left;">' + bCls + '</td>') : '') +
                    '</tr>';
                  }).join('') +
                  '<tr style="background:#f8fafc;border-top:2px solid #cbd5e1;font-weight:800;">' +
                    '<td colspan="2" style="padding:5px 6px;">SUBTOTALES HABERES / DESCUENTOS</td>' +
                    '<td style="padding:5px 6px;text-align:right;color:#1e3a8a;">' + sanitizeHTML(fmtP(res.detalleCompletoRecibo.totales?.totalHaberes ?? totalHaberesVal ?? 0)) + '</td>' +
                    '<td style="padding:5px 6px;text-align:right;color:#b91c1c;">' + sanitizeHTML(fmtP(res.detalleCompletoRecibo.totales?.totalDescuentos ?? totalDescVal ?? 0)) + '</td>' +
                    '<td></td>' +
                  '</tr>' +
                  '<tr style="background:#f0fdf4;font-weight:800;">' +
                    '<td colspan="2" style="padding:5px 6px;color:#166534;">LÍQUIDO EXACTO A PAGAR EN CUENTA</td>' +
                    '<td colspan="3" style="padding:5px 6px;text-align:right;color:#15803d;">' + sanitizeHTML(fmtP(res.detalleCompletoRecibo.totales?.liquidoAPagar ?? netLiquidoVal ?? 0)) + '</td>' +
                  '</tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
          '</details>'
        ) : '') +

        '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">' +
          '<button type="button" class="btn-copy" style="font-size:0.72rem;padding:5px 12px;" onclick="abrirAuditoriaModalExpediente(\'' + s.id + '\')">' +
            '🔍 Re-auditar Legajo' +
          '</button>' +
          '<button type="button" class="btn-primary-action" style="width:auto;padding:5px 14px;font-size:0.72rem;background:#1e3a8a;border-color:#172554;display:inline-flex;align-items:center;gap:6px;" onclick="copiarResumenIAAlChatAuditoria(\'' + s.id + '\')">' +
            '💾 Guardar Dictamen en Bitácora del Expediente' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    /* --- ACCIÓN RÁPIDA: GUARDAR DICTAMEN EN BITÁCORA DEL EXPEDIENTE (COLUMNA 21 SHEETS) --- */
    async function copiarResumenIAAlChatAuditoria(solicitudId) {
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(solicitudId));
      if (!s || !s.auditoriaIA || !s.auditoriaIA.resultado) {
        showToast('No hay dictamen de auditoría disponible para guardar.');
        return null;
      }
      ultimoResultadoAuditoria = s.auditoriaIA.resultado;
      return guardarDictamenEnBitacoraExpediente(s.id);
    }

    function renderListaArchivosAuditoriaPills() {
      const container = document.getElementById('listaArchivosAuditoriaPills');
      const actionsBar = document.getElementById('auditMultiRecibosActions');
      if (actionsBar) {
        actionsBar.style.display = archivosAuditoriaCola.length > 0 ? 'flex' : 'none';
      }
      if (!container) return;
      if (archivosAuditoriaCola.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';
      container.innerHTML = archivosAuditoriaCola.map((arch, idx) => {
        const isPdf = (arch.mimeType && arch.mimeType.includes('pdf')) || arch.renderizadoDesdePdfEscaneado;
        const icon = isPdf ? '📄' : '🖼️';
        const rawLen = arch.base64 ? arch.base64.length : (arch.textoExtraido ? arch.textoExtraido.length : 0);
        const kb = Math.max(1, Math.round((rawLen * 0.75) / 1024));
        const modoTxt = '';
        const numBadge = archivosAuditoriaCola.length > 1 ? ('<strong style="color:#1e40af;margin-right:3px;">#' + (idx + 1) + '</strong>') : '';
        return '<span class="ai-file-pill" onclick="event.stopPropagation()">' +
          '<span>' + numBadge + icon + ' <strong>' + sanitizeHTML(arch.nombre) + '</strong> (' + kb + ' KB' + modoTxt + ')</span>' +
          '<button type="button" class="ai-file-pill-del" onclick="event.stopPropagation();removerArchivoAuditoria(' + idx + ')" title="Quitar">&times;</button>' +
        '</span>';
      }).join(' ');
    }

    function removerArchivoAuditoria(idx) {
      archivosAuditoriaCola.splice(idx, 1);
      renderListaArchivosAuditoriaPills();
      if (archivosAuditoriaCola.length === 0) {
        const resCont = document.getElementById('aiAuditResultadosContainer');
        if (resCont) { resCont.style.display = 'none'; resCont.innerHTML = ''; }
      } else if (typeof showToast === 'function') {
        showToast('Recibo quitado. Hacé clic en "Re-analizar todos" para actualizar la consolidación.');
      }
    }

    async function agregarRecibosAuditoria(files) {
      if (!files || files.length === 0) return null;
      const arr = Array.from(files);
      const inpAdd = document.getElementById('fileInputAuditoriaAgregar');
      if (inpAdd) inpAdd.value = '';
      if (!Array.isArray(archivosAuditoriaCola)) archivosAuditoriaCola = [];

      let agregados = 0;
      for (const file of arr) {
        if (typeof file.size === 'number' && file.size < 5120) {
          const msgDanado = '⚠️ El archivo "' + file.name + '" parece estar vacío o dañado (pesa menos de 5 KB).';
          mostrarBannerErrorAuditoria(msgDanado);
          mostrarNotificacionToast(msgDanado, 'error');
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          const msgMax = 'El archivo "' + file.name + '" supera el límite permitido de 15 MB.';
          mostrarBannerErrorAuditoria(msgMax);
          showToast(msgMax);
          continue;
        }
        try {
          const nombreArchivo = file.name || 'documento_auditoria';
          const mimeReal = String(file.type || '').toLowerCase();
          const esPdf = mimeReal === 'application/pdf' || mimeReal.includes('pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');
          const mimeFinal = esPdf
            ? 'application/pdf'
            : (mimeReal.includes('png') ? 'image/png' : (mimeReal.includes('webp') ? 'image/webp' : 'image/jpeg'));
          const b64Puro = await archivoABase64Puro(file);
          if (!b64Puro) throw new Error('No se pudo leer "' + nombreArchivo + '".');
          archivosAuditoriaCola.push({
            nombre: nombreArchivo,
            mimeType: mimeFinal,
            base64: b64Puro,
            textoExtraido: ''
          });
          agregados++;
        } catch (err) {
          const msgProc = err && err.message ? err.message : ('Error procesando "' + file.name + '"');
          mostrarBannerErrorAuditoria(msgProc);
          showToast('⚠️ ' + msgProc);
        }
      }
      if (agregados > 0) {
        renderListaArchivosAuditoriaPills();
        return ejecutarAuditoriaDocumentalIA();
      }
      return null;
    }

    function manejarDragOverAuditoria(ev) {
      if (!ev) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dz = document.getElementById('aiDropzoneDirecta');
      if (dz && dz.classList) dz.classList.add('drag-active');
    }

    function manejarDragLeaveAuditoria(ev) {
      if (!ev) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dz = document.getElementById('aiDropzoneDirecta');
      if (dz && dz.classList) dz.classList.remove('drag-active');
    }

    async function manejarDropReciboAuditoria(ev) {
      if (!ev) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dz = document.getElementById('aiDropzoneDirecta');
      if (dz && dz.classList) dz.classList.remove('drag-active');
      const files = ev.dataTransfer && ev.dataTransfer.files ? ev.dataTransfer.files : null;
      if (files && files.length > 0) {
        await manejarSeleccionReciboAuditoria(files);
      }
    }

    async function manejarSeleccionReciboAuditoria(files) {
      if (!files || files.length === 0) return null;
      const lista = Array.from(files);
      const inp = document.getElementById('fileInputAuditoriaIA');
      if (inp) inp.value = '';

      idExpedienteAuditadoActivo = null;
      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();
      if (lista.length === 1) {
        return procesarReciboUnico(lista[0]);
      }
      await procesarArchivosAuditoria(lista, { omitirAutoInicio: true });
      return ejecutarAuditoriaDocumentalIA();
    }

    async function procesarArchivosAuditoria(files, opciones = {}) {
      if (!files || files.length === 0) return;
      const arr = Array.from(files);
      archivosAuditoriaCola = [];
      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();
      let procesados = 0;

      for (const file of arr) {
        if (typeof file.size === 'number' && file.size < 5120) {
          const msgDanado = '⚠️ El archivo seleccionado parece estar vacío o dañado (pesa menos de 5 KB). Por favor, suba un comprobante válido.';
          mostrarBannerErrorAuditoria(msgDanado);
          mostrarNotificacionToast(msgDanado, 'error');
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          const msgMax = 'El archivo "' + file.name + '" supera el límite permitido de 15 MB.';
          mostrarBannerErrorAuditoria(msgMax);
          showToast(msgMax);
          continue;
        }
        try {
          const nombreArchivo = file.name || 'documento_auditoria';
          const mimeReal = String(file.type || '').toLowerCase();
          const esPdf = mimeReal === 'application/pdf' || mimeReal.includes('pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');
          const mimeFinal = esPdf
            ? 'application/pdf'
            : (mimeReal.includes('png') ? 'image/png' : (mimeReal.includes('webp') ? 'image/webp' : 'image/jpeg'));

          const b64Puro = await archivoABase64Puro(file);
          if (!b64Puro) {
            throw new Error('No se pudo convertir "' + nombreArchivo + '" a Base64.');
          }
          archivosAuditoriaCola.push({
            nombre: nombreArchivo,
            mimeType: mimeFinal,
            base64: b64Puro,
            textoExtraido: ''
          });
          procesados++;
        } catch (err) {
          const msgProc = err && err.message ? err.message : ('Error procesando "' + file.name + '"');
          mostrarBannerErrorAuditoria(msgProc);
          showToast('⚠️ ' + msgProc);
        }
      }
      if (procesados > 0) {
        renderListaArchivosAuditoriaPills();
        if (!opciones || !opciones.omitirAutoInicio) {
          await ejecutarAuditoriaDocumentalIA();
        }
      }
    }

    function actualizarSelectorExpedientesAuditoria() {
      // Interfaz simplificada sin selectores desplegables (compatibilidad preservada)
    }

    function asociarExpedienteAuditoria(id) {
      idExpedienteAuditadoActivo = id ? String(id) : null;
    }

    function abrirAuditoriaModalExpediente(id) {
      cerrarModal('modalVerFichaCompleta');
      cambiarVistaPrincipal('auditoria-ia');
      idExpedienteAuditadoActivo = String(id);
      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();

      const s = getStoredSolicitudes().find(x => String(x.id) === String(id));
      if (s && s.adjuntos && s.adjuntos.length > 0) {
        const conBase = s.adjuntos.filter(a => a.base64 || a.dataUrl);
        if (conBase.length > 0) {
          archivosAuditoriaCola = conBase.map(a => ({
            nombre: a.nombre,
            mimeType: a.mimeType || a.tipoMime || (String(a.nombre || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
            base64: limpiarBase64ParaAPI(a.base64 || a.dataUrl),
            textoExtraido: ''
          }));
          renderListaArchivosAuditoriaPills();
          ejecutarAuditoriaDocumentalIA();
        } else {
          showToast('Subí el recibo del expediente para iniciar la auditoría automática.');
        }
      }

      const wrap = document.getElementById('vistaAuditoriaIA') || document.getElementById('wrapperMutualAuditoria');
      if (wrap && typeof wrap.scrollIntoView === 'function') {
        wrap.scrollIntoView({ behavior: 'smooth' });
      }
    }

    function limpiarPanelAuditoria() {
      archivosAuditoriaCola = [];
      ultimoResultadoAuditoria = null;
      idExpedienteAuditadoActivo = null;
      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();
      const inp = document.getElementById('fileInputAuditoriaIA');
      if (inp) inp.value = '';
      const inpAdd = document.getElementById('fileInputAuditoriaAgregar');
      if (inpAdd) inpAdd.value = '';
      renderListaArchivosAuditoriaPills();
      ocultarBannerErrorAuditoria();
      const resCont = document.getElementById('aiAuditResultadosContainer');
      if (resCont) {
        resCont.style.display = 'none';
        resCont.innerHTML = '';
      }
      const loadBar = document.getElementById('aiAuditLoadingBar');
      if (loadBar) loadBar.style.display = 'none';
      const loaderIA = document.getElementById('loader-auditoria-ia');
      if (loaderIA) loaderIA.classList.add('hidden');
      const inpBol = document.getElementById('inputBoletinDniConsulta');
      if (inpBol) inpBol.value = '';
      const resBol = document.getElementById('resultadoBoletinOficialER');
      if (resBol) { resBol.style.display = 'none'; resBol.innerHTML = ''; }
      if (typeof actualizarLinkDateasBoletin === 'function') actualizarLinkDateasBoletin();
      if (typeof limpiarEstadoAuditoria20 === 'function') limpiarEstadoAuditoria20();
      showToast('Panel de auditoría reiniciado.');
    }

    function recalcularMargenInteractivoAuditoria(nuevoRegimen = undefined, nuevaCuotaFutura2 = undefined, refiOpts = undefined) {
      if (!ultimoResultadoAuditoria) {
        showToast('Analizá un recibo primero para recalcular margen y ofertas.');
        return null;
      }
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const parseNumAudit = (v) => (typeof limpiarNumeroPadron === 'function')
        ? limpiarNumeroPadron(v)
        : (parseNumeroSeguroAuditoria(v) || 0);

      if (nuevoRegimen !== undefined) {
        const regUp = nuevoRegimen ? String(nuevoRegimen).trim().toUpperCase() : '';
        _auditRegimenOverride = (regUp === 'PASIVO' || regUp === 'ACTIVO') ? regUp : null;
      }
      if (nuevaCuotaFutura2 !== undefined) {
        _auditCuotaFutura2 = Math.max(0, r2(parseNumAudit(nuevaCuotaFutura2)));
      }
      if (refiOpts && typeof refiOpts === 'object') {
        if (refiOpts.cuotaRefinanciar !== undefined) {
          _auditCuotaRefinanciar = Math.max(0, r2(parseNumAudit(refiOpts.cuotaRefinanciar)));
        }
        if (refiOpts.saldoCancelar !== undefined) {
          _auditSaldoCancelar = Math.max(0, r2(parseNumAudit(refiOpts.saldoCancelar)));
        }
        if (refiOpts.saldoVigenteExterno !== undefined) {
          _auditSaldoVigenteExterno = Math.max(0, r2(parseNumAudit(refiOpts.saldoVigenteExterno)));
        }
        if (refiOpts.detalleRefinanciacion !== undefined) {
          _auditDetalleRefinanciacion = String(refiOpts.detalleRefinanciacion || '').trim();
        }
        if (refiOpts.factorMargen !== undefined) {
          const fm = parseNumAudit(refiOpts.factorMargen);
          _auditFactorMargen = (fm > 0 && fm <= 1.0) ? Number(fm.toFixed(4)) : 1.0;
        }
      }

      const cloned = Object.assign({}, ultimoResultadoAuditoria);
      if (Array.isArray(cloned._rawConceptosOriginal) && cloned._rawConceptosOriginal.length > 0) {
        const rawCopy = cloned._rawConceptosOriginal.map(c => Object.assign({}, c));
        cloned.conceptos = rawCopy.map(c => Object.assign({}, c));
        if (cloned.detalleCompletoRecibo) {
          cloned.detalleCompletoRecibo = Object.assign({}, cloned.detalleCompletoRecibo, {
            conceptos: rawCopy.map(c => Object.assign({}, c))
          });
        }
      } else if (cloned.detalleCompletoRecibo && Array.isArray(cloned.detalleCompletoRecibo.conceptos)) {
        const stripped = cloned.detalleCompletoRecibo.conceptos.map(c => {
          const cp = Object.assign({}, c);
          if (cp.metodoClasificacion && cp.metodoClasificacion !== 'EXPLICITA_NORMALIZADA') {
            delete cp.clasificacion;
            delete cp.metodoClasificacion;
            delete cp.lugarPadronMatch;
          }
          return cp;
        });
        cloned.conceptos = stripped.map(c => Object.assign({}, c));
        cloned.detalleCompletoRecibo = Object.assign({}, cloned.detalleCompletoRecibo, {
          conceptos: stripped.map(c => Object.assign({}, c))
        });
      }
      delete cloned.analisisMargen;
      delete cloned.ofertasPorPlazo;
      delete cloned.conclusionesRecomendaciones;

      const actualizado = normalizarResultadoAuditoriaIA(cloned, {
        regimenOverride: _auditRegimenOverride,
        cuotaFutura2: _auditCuotaFutura2,
        cuotaRefinanciar: _auditCuotaRefinanciar,
        saldoCancelar: _auditSaldoCancelar,
        saldoVigenteExterno: _auditSaldoVigenteExterno,
        detalleRefinanciacion: _auditDetalleRefinanciacion,
        factorMargen: _auditFactorMargen,
        forzarReclasificar: true
      });
      if (!actualizado) return null;
      ultimoResultadoAuditoria = actualizado;
      renderizarAuditoriaYSimulador(actualizado, { desdeRecalculoInteractivo: true });
      return actualizado;
    }

    function cambiarRegimenAuditoriaInteractivo(regimen) {
      const regUp = String(regimen || '').toUpperCase() === 'PASIVO' ? 'PASIVO' : 'ACTIVO';
      return recalcularMargenInteractivoAuditoria(regUp, undefined, undefined);
    }

    function aplicarCuotaFutura2Auditoria(val) {
      let valor = val;
      if (valor === undefined) {
        const inp = document.getElementById('inputAuditCuotaFutura2');
        valor = inp ? inp.value : 0;
      }
      return recalcularMargenInteractivoAuditoria(undefined, valor, undefined);
    }

    function aplicarRefinanciacionAuditoria(presetOpts = undefined) {
      if (presetOpts && typeof presetOpts === 'object') {
        return recalcularMargenInteractivoAuditoria(undefined, undefined, presetOpts);
      }
      const inpCuota = document.getElementById('inputAuditCuotaRefinanciar');
      const inpSaldo = document.getElementById('inputAuditSaldoCancelar');
      const inpExt = document.getElementById('inputAuditSaldoVigenteExterno');
      const inpDet = document.getElementById('inputAuditDetalleRefinanciacion');
      return recalcularMargenInteractivoAuditoria(undefined, undefined, {
        cuotaRefinanciar: inpCuota ? inpCuota.value : _auditCuotaRefinanciar,
        saldoCancelar: inpSaldo ? inpSaldo.value : _auditSaldoCancelar,
        saldoVigenteExterno: inpExt ? inpExt.value : _auditSaldoVigenteExterno,
        detalleRefinanciacion: inpDet ? inpDet.value : _auditDetalleRefinanciacion
      });
    }

    function limpiarRefinanciacionAuditoria() {
      return recalcularMargenInteractivoAuditoria(undefined, undefined, {
        cuotaRefinanciar: 0,
        saldoCancelar: 0,
        saldoVigenteExterno: 0,
        detalleRefinanciacion: ''
      });
    }

    function cambiarFactorMargenAuditoria(factor) {
      const fVal = Number(factor) === 0.7 || Number(factor) === 0.70 ? 0.70 : 1.0;
      return recalcularMargenInteractivoAuditoria(undefined, undefined, { factorMargen: fVal });
    }

    function formatearAntiguedadLegible(rawVal) {
      const s = String(rawVal || '').trim();
      if (!s) return '';
      const low = s.toLowerCase();
      if (/no registrada|no especificada|no consta|n\/a/.test(low)) return s;

      const joinYM = (anios, meses) => {
        const partes = [];
        if (anios > 0) partes.push(anios + (anios === 1 ? ' año' : ' años'));
        if (meses > 0) partes.push(meses + (meses === 1 ? ' mes' : ' meses'));
        if (partes.length === 0) return '0 años y 0 meses';
        return partes.join(' y ');
      };

      const mYmText = s.match(/^\s*(\d{1,2})\s*(?:años?|a\.?)\s*(?:[-,/yY\s]*)\s*(\d{1,2})\s*(?:mes(?:es)?|m\.?)\s*$/i);
      if (mYmText) return joinYM(parseInt(mYmText[1], 10), parseInt(mYmText[2], 10));

      const mSlash = s.match(/^\s*(\d{1,2})\s*[/\-]\s*(\d{1,2})\s*$/);
      if (mSlash) return joinYM(parseInt(mSlash[1], 10), parseInt(mSlash[2], 10));

      const mNum = s.match(/^\s*(\d{1,2})\s*$/);
      if (mNum) {
        const a = parseInt(mNum[1], 10);
        return a + (a === 1 ? ' año' : ' años');
      }

      const mOnlyY = s.match(/^\s*(\d{1,2})\s*(?:años?|a\.?)\s*$/i);
      if (mOnlyY) {
        const a = parseInt(mOnlyY[1], 10);
        return a + (a === 1 ? ' año' : ' años');
      }

      const mOnlyM = s.match(/^\s*(\d{1,2})\s*(?:mes(?:es)?|m\.?)\s*$/i);
      if (mOnlyM) {
        const m = parseInt(mOnlyM[1], 10);
        return m + (m === 1 ? ' mes' : ' meses');
      }

      return s;
    }

    function cambiarClasificacionItemAuditoria(idx, nuevaClasif) {
      if (!ultimoResultadoAuditoria) return null;
      const clsNorm = String(nuevaClasif || '').trim().toUpperCase();
      const aplicarCambio = (arr) => {
        if (!Array.isArray(arr) || !arr[idx]) return;
        if (!clsNorm || clsNorm === 'AUTO') {
          delete arr[idx].clasificacion;
          delete arr[idx].metodoClasificacion;
          delete arr[idx].lugarPadronMatch;
        } else {
          arr[idx].clasificacion = clsNorm;
          arr[idx].metodoClasificacion = 'EXPLICITA_NORMALIZADA';
          arr[idx].lugarPadronMatch = 'MANUAL';
        }
      };
      aplicarCambio(ultimoResultadoAuditoria.conceptos);
      if (ultimoResultadoAuditoria.detalleCompletoRecibo) {
        aplicarCambio(ultimoResultadoAuditoria.detalleCompletoRecibo.conceptos);
      }
      return recalcularMargenInteractivoAuditoria(undefined, undefined, undefined);
    }

    async function consolidarRecibosMultiplesAuditoria(resultadosIndiv) {
      if (!Array.isArray(resultadosIndiv) || resultadosIndiv.length === 0) return null;
      if (resultadosIndiv.length === 1) return resultadosIndiv[0];

      if (typeof RENDER_API_URL === 'string' && RENDER_API_URL.startsWith('http')) {
        try {
          const resp = await fetchConTimeout(`${RENDER_API_URL}/api/consolidar-recibos-multiples`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recibos: resultadosIndiv,
              cuotaFutura2: 0
            })
          }, 30000);
          if (resp && resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data && (data.ok !== false)) {
              const norm = normalizarResultadoAuditoriaIA(data);
              if (norm) return norm;
            }
          }
        } catch (errCons) {
          console.warn('Fallback local al consolidar múltiples recibos:', errCons && errCons.message ? errCons.message : errCons);
        }
      }

      // Fallback determinista local si el endpoint no respondió
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      let sumBruto = 0, sumDesc = 0, sumLiq = 0, sumLey = 0, sumBersa = 0, sumSide = 0, sumMut = 0, sumFed = 0;
      let embargoAny = false;
      const orgs = [], periodos = [], cargos = [], categorias = [], legajos = [], conceptosMerged = [], recibosIndiv = [];
      let titularRef = '', dniRef = '', cuilRef = '', antRef = '', fechaIngRef = '', tipoRef = '', lugarRef = '';

      resultadosIndiv.forEach((raw, idx0) => {
        const idx = idx0 + 1;
        const r = raw.resumenDecision || raw.reciboSueldo || raw || {};
        const d = raw.detalleCompletoRecibo || {};
        const am = raw.analisisMargen || {};
        const tit = String(r.titular || raw.titular || '').trim();
        const dni = String(r.dni || raw.dni || '').trim();
        const cuil = String(r.cuil || raw.cuil || '').trim();
        const org = String(r.organismo || raw.organismo || 'Organismo').trim();
        const cargo = String(r.cargo || d.escalafonCargo || '').trim();
        const per = String(r.periodo || d.periodo || '').trim();
        const ant = String(r.antiguedad || (raw.reciboSueldo && raw.reciboSueldo.antiguedadDetalle) || '').trim();
        const fec = String(r.fechaIngreso || raw.fechaIngreso || '').trim();
        const cat = String(r.categoria || raw.categoria || '').trim();
        const leg = String(r.legajo || raw.legajo || '').trim();
        if (!titularRef && tit) titularRef = tit;
        if (!dniRef && dni) dniRef = dni;
        if (!cuilRef && cuil) cuilRef = cuil;
        if (!antRef && ant) antRef = ant;
        if (!fechaIngRef && fec) fechaIngRef = fec;
        if (!tipoRef && (am.tipoBeneficiario || r.tipoBeneficiario)) tipoRef = am.tipoBeneficiario || r.tipoBeneficiario;
        if (!lugarRef && (am.lugarTrabajo || r.lugarTrabajo)) lugarRef = am.lugarTrabajo || r.lugarTrabajo;
        if (org && !orgs.includes(org)) orgs.push(org);
        if (per && !periodos.includes(per)) periodos.push(per);
        if (cargo && !cargos.includes(cargo)) cargos.push(cargo);
        if (cat && !categorias.includes(cat)) categorias.push(cat);
        if (leg && !legajos.includes(leg)) legajos.push(leg);

        const bI = r2(Number(am.totalHaberes ?? r.sueldoBrutoTotal ?? 0) || 0);
        const dI = r2(Math.abs(Number(am.totalDescuentos ?? r.totalDescuentos ?? 0) || 0));
        const lI = r2(Number(am.netoLiquido ?? r.sueldoLiquido ?? (bI - dI)) || 0);
        sumBruto = r2(sumBruto + bI);
        sumDesc = r2(sumDesc + dI);
        sumLiq = r2(sumLiq + lI);
        sumLey = r2(sumLey + (Number(r.descuentosLey || 0) || 0));
        sumBersa = r2(sumBersa + (Number(r.consumosBersa || 0) || 0));
        sumSide = r2(sumSide + (Number(r.consumosSidecreer || 0) || 0));
        sumMut = r2(sumMut + (Number(r.otrasMutualesOProveeduria || r.otrasMutuales || 0) || 0));
        sumFed = r2(sumFed + (Number(r.consumosFedem || 0) || 0));
        if (r.embargosJudiciales) embargoAny = true;

        const etiqueta = 'Recibo ' + idx + (org ? ' · ' + org : '');
        const cList = Array.isArray(raw.conceptos) ? raw.conceptos : (Array.isArray(d.conceptos) ? d.conceptos : []);
        const cCopyList = cList.map(c => Object.assign({}, c, { origenRecibo: etiqueta }));
        cCopyList.forEach(c => conceptosMerged.push(c));

        recibosIndiv.push({
          indice: idx,
          archivoNombre: raw.archivoNombre || ('Recibo ' + idx),
          titular: tit || 'No especificado',
          dni: dni || 'No especificado',
          cuil: cuil,
          organismo: org,
          cargo: cargo || 'Agente / Activo',
          periodo: per || 'Mes auditado',
          antiguedad: ant || 'No registrada',
          fechaIngreso: fec,
          categoria: cat,
          legajo: leg,
          sueldoBrutoTotal: bI,
          totalDescuentos: dI,
          sueldoLiquido: lI,
          embargosJudiciales: Boolean(r.embargosJudiciales),
          conceptos: cCopyList
        });
      });

      const merged = {
        titular: titularRef || 'No especificado',
        dni: dniRef || 'No especificado',
        cuil: cuilRef,
        organismo: (orgs.join(' + ') || 'Varios Empleadores') + ' (' + recibosIndiv.length + ' recibos)',
        cargo: cargos.join(' / ') || 'Agente / Pluriempleo',
        periodo: periodos.join(' · ') || 'Mes auditado',
        antiguedad: antRef || 'No registrada',
        fechaIngreso: fechaIngRef,
        categoria: categorias.join(' / '),
        legajo: legajos.join(' / '),
        tipoRecibo: tipoRef || 'ACTIVO',
        lugarTrabajo: lugarRef || 'GE_',
        sueldoBrutoTotal: sumBruto,
        totalDescuentos: sumDesc,
        sueldoLiquido: sumLiq,
        descuentosLey: sumLey,
        consumosBersa: sumBersa,
        consumosSidecreer: sumSide,
        otrasMutuales: sumMut,
        consumosFedem: sumFed,
        embargosJudiciales: embargoAny,
        conceptos: conceptosMerged,
        cantidadRecibos: recibosIndiv.length,
        recibosIndividuales: recibosIndiv
      };
      return normalizarResultadoAuditoriaIA(merged);
    }

    async function ejecutarAuditoriaDocumentalIA() {
      if (archivosAuditoriaCola.length === 0) {
        showToast('Seleccioná o arrastrá un Recibo de Sueldo (PDF o Imagen) para auditar.');
        return null;
      }

      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();

      const loadBar = document.getElementById('aiAuditLoadingBar');
      const loaderIA = document.getElementById('loader-auditoria-ia');
      const stageText = document.getElementById('aiAuditStageText');
      const resCont = document.getElementById('aiAuditResultadosContainer');

      ocultarBannerErrorAuditoria();
      if (loadBar) loadBar.style.display = 'block';
      if (resCont) {
        resCont.style.display = 'none';
        resCont.innerHTML = '';
      }

      const etapas = [
        '1/4. Procesando documento nativo (PDF / Imagen) con motor multimodal...',
        '2/4. Verificando titular, organismo, antigüedad y período liquidado...',
        '3/4. Auditando TOTAL HABERES, SUBTOTAL_1, NO_COMPUTABLE, AFECTADO y Embargos (Padrón 2.076 códigos)...',
        '4/4. Calculando Disponible Recibo, Tope Endeudamiento 41,67% y Ofertas por Plazo...'
      ];
      let step = 0;
      if (stageText) stageText.textContent = etapas[0];
      const stepTimer = setInterval(() => {
        step = (step + 1) % etapas.length;
        if (stageText) stageText.textContent = etapas[step];
      }, 1800);

      let datosDeclarados = null;
      let sAsociada = null;
      if (idExpedienteAuditadoActivo) {
        const all = getStoredSolicitudes();
        sAsociada = all.find(x => String(x.id) === String(idExpedienteAuditadoActivo)) || null;
        if (sAsociada) {
          datosDeclarados = {
            nombre: sAsociada.solicitante?.nombre || '',
            dni: sAsociada.solicitante?.dni || '',
            cuil: sAsociada.solicitante?.cuil || sAsociada.datosContacto?.cuil || '',
            fechaNacimiento: sAsociada.solicitante?.fechaNacimiento || sAsociada.solicitante?.fechaNac || '',
            organismo: sAsociada.solicitante?.organismo || '',
            cuota: sAsociada.propuestaMutual?.cuotaEstimada || sAsociada.prestamo?.cuotaEstimada || 0,
            plazoCuotas: sAsociada.propuestaMutual?.cuotas || sAsociada.prestamo?.cuotas || 0,
            monto: sAsociada.propuestaMutual?.monto || sAsociada.prestamo?.monto || 0
          };
        }
      }

      try {
        renderListaArchivosAuditoriaPills();

        let auditRes = null;
        if (archivosAuditoriaCola.length === 1) {
          auditRes = await procesarAuditoriaConTimeout(archivosAuditoriaCola, {
            idSolicitud: idExpedienteAuditadoActivo || 'DOCUMENTOS_SUELTOS',
            datosDeclarados: datosDeclarados,
            permitirBackendSinKey: true,
            preservarLoadingBar: true,
            timeoutMs: 90000
          });
        } else {
          clearInterval(stepTimer);
          const resultadosIndiv = [];
          const erroresIndiv = [];
          for (let idxRec = 0; idxRec < archivosAuditoriaCola.length; idxRec++) {
            const archItem = archivosAuditoriaCola[idxRec];
            if (stageText) {
              stageText.textContent = 'Analizando recibo ' + (idxRec + 1) + ' de ' + archivosAuditoriaCola.length + ': ' + archItem.nombre + '...';
            }
            const resItem = await procesarAuditoriaConTimeout([archItem], {
              idSolicitud: idExpedienteAuditadoActivo || 'DOCUMENTOS_SUELTOS',
              datosDeclarados: datosDeclarados,
              permitirBackendSinKey: true,
              preservarLoadingBar: true,
              timeoutMs: 90000
            });
            if (resItem) {
              resItem.archivoNombre = archItem.nombre;
              resultadosIndiv.push(resItem);
            } else {
              erroresIndiv.push(archItem.nombre + ': ' + (window._ultimaErrorAuditoriaIA || 'no legible'));
            }
          }
          if (resultadosIndiv.length === 0) {
            auditRes = null;
          } else if (resultadosIndiv.length === 1) {
            auditRes = resultadosIndiv[0];
          } else {
            if (stageText) {
              stageText.textContent = 'Consolidando ' + resultadosIndiv.length + ' recibos en motor Padrón oficial...';
            }
            auditRes = await consolidarRecibosMultiplesAuditoria(resultadosIndiv);
          }
          if (erroresIndiv.length > 0 && typeof showToast === 'function' && resultadosIndiv.length > 0) {
            showToast('⚠️ ' + erroresIndiv.length + ' recibo(s) no se pudieron leer: ' + erroresIndiv[0]);
          }
        }

        clearInterval(stepTimer);

        if (auditRes) {
          const okRendered = renderizarAuditoriaYSimulador(auditRes);
          if (!okRendered) {
            return null;
          }
          ultimoResultadoAuditoria = okRendered;
          if (sAsociada) {
            const all = getStoredSolicitudes();
            const idx = all.findIndex(x => String(x.id) === String(sAsociada.id));
            if (idx !== -1) {
              all[idx].auditoriaIA = {
                estado: 'completado',
                fechaFin: obtenerFechaHora24hs(),
                resultado: okRendered
              };
              saveStoredSolicitudes(all);
            }
          }
          showToast('Auditoría y simulación completadas.');
          return okRendered;
        } else {
          const msgFalla = window._ultimaErrorAuditoriaIA || 'No se recibió respuesta válida del motor de análisis documental.';
          mostrarBannerErrorAuditoria(msgFalla);
          showToast('⚠️ ' + msgFalla);
          return null;
        }
      } catch (err) {
        const msgErr = err && err.message ? err.message : 'Error de comunicación con el motor documental.';
        mostrarBannerErrorAuditoria(msgErr);
        showToast('⚠️ Error de comunicación en auditoría documental.');
        return null;
      } finally {
        clearInterval(stepTimer);
        if (loadBar) loadBar.style.display = 'none';
        if (loaderIA) loaderIA.classList.add('hidden');
      }
    }

    function mostrarBannerErrorAuditoria(mensajeError) {
      const msg = String(mensajeError || 'No se pudo completar el análisis documental del comprobante.');
      const resCont = document.getElementById('aiAuditResultadosContainer');
      if (resCont) {
        resCont.style.display = 'none';
        resCont.innerHTML = '';
      }
      const banner = document.getElementById('bannerErrorAuditoriaIA');
      const txtEl = document.getElementById('bannerErrorAuditoriaTexto');
      if (txtEl) {
        txtEl.textContent = msg;
      }
      if (banner) {
        banner.classList.remove('hidden');
        banner.style.display = 'block';
      }
    }

    function ocultarBannerErrorAuditoria() {
      const banner = document.getElementById('bannerErrorAuditoriaIA');
      if (banner) {
        banner.classList.add('hidden');
        banner.style.display = 'none';
      }
    }

    function renderErrorAuditoria(mensajeError) {
      mostrarBannerErrorAuditoria(mensajeError);
    }

    function calcularPlanesSugeridosAuditoria(cuotaMaximaObjetivo, canalKey = 'fedem', netoLiquido = null, offerOpts = null) {
      const cuotaTope = parseNumeroSeguroAuditoria(cuotaMaximaObjetivo);
      if (!cuotaTope || cuotaTope <= 0 || typeof MOTOR_FINANCIERO_EXACTO === 'undefined') {
        return [];
      }
      const key = (canalKey === 'muni' || canalKey === 'municipales' || canalKey === 'quad')
        ? 'muni'
        : (canalKey === 'sidecreer' ? 'sidecreer' : 'fedem');

      const liqRaw = (netoLiquido !== null && netoLiquido !== undefined)
        ? netoLiquido
        : (typeof window !== 'undefined' ? window._netoLiquidoAuditoria : null);
      const liqNum = parseNumeroSeguroAuditoria(liqRaw);
      const effOpts = (offerOpts && typeof offerOpts === 'object')
        ? offerOpts
        : (typeof window !== 'undefined' && window._offerOptsAuditoria ? window._offerOptsAuditoria : {});
      const cuotaPersRaw = parseNumeroSeguroAuditoria(effOpts.cuotaPersonalizada);
      const cuotaPers = (cuotaPersRaw && cuotaPersRaw > 0) ? cuotaPersRaw : 0;
      const cuotaEfectiva = (cuotaPers > 0 && cuotaPers < cuotaTope) ? cuotaPers : cuotaTope;
      const usandoCuotaPers = cuotaPers > 0 && cuotaPers < cuotaTope;

      if (liqNum !== null && liqNum > 0 && typeof calcularOfertasPorPlazo === 'function') {
        const ofertas = calcularOfertasPorPlazo(cuotaEfectiva, liqNum, key, effOpts);
        return ofertas.map(o => ({
          plazo: o.plazo,
          lineaKey: key,
          multiplicador: o.multiplicador,
          topeEndeudamientoCuota: o.topeEndeudamientoCuota,
          topeCompromisoTotal: o.topeCompromisoTotal,
          disponibleRecibo: o.disponibleRecibo,
          cuotaMaximaReal: o.cuotaMaximaReal,
          limitadoPor: (usandoCuotaPers && o.limitadoPor === 'MARGEN_RECIBO') ? 'CUOTA_PERSONALIZADA' : o.limitadoPor,
          neto: o.neto,
          capitalBruto: o.capitalBruto,
          cuotaFinal: o.cuotaResultante,
          totalPagar: o.totalPagar,
          saldoCancelar: o.saldoCancelar || 0,
          netoBolsillo: o.netoBolsillo !== undefined ? o.netoBolsillo : o.neto,
          cubreCancelacion: o.cubreCancelacion !== undefined ? o.cubreCancelacion : true,
          alivioMensual: o.alivioMensual !== undefined ? o.alivioMensual : null
        }));
      }

      const plazos = (key === 'muni') ? [12, 24] : [6, 12, 18, 24, 36, 48];
      const multMap = { 6: 2.5, 12: 5, 18: 7.5, 24: 10, 36: 15, 48: 20 };
      const saldoCanc = Math.max(0, Number(effOpts.saldoCancelar || 0));
      const cuotaRef = Math.max(0, Number(effOpts.cuotaRefinanciar || 0));

      return plazos.map(plazo => {
        let calc = null;
        if (key === 'muni') {
          calc = MOTOR_FINANCIERO_EXACTO.calcularMunicipalesDesdeCuota(cuotaEfectiva, plazo);
        } else if (key === 'sidecreer') {
          calc = MOTOR_FINANCIERO_EXACTO.calcularSidecreerDesdeCuota(cuotaEfectiva, plazo);
        } else {
          calc = MOTOR_FINANCIERO_EXACTO.calcularFEDEMDesdeCuota(cuotaEfectiva, plazo);
        }
        if (!calc || !Number.isFinite(calc.neto) || calc.neto <= 0) return null;
        const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
        const netoR = r2(calc.neto);
        const cuotaR = r2(calc.cuotaFinal);
        return {
          plazo,
          lineaKey: key,
          multiplicador: multMap[plazo] || null,
          topeEndeudamientoCuota: null,
          topeCompromisoTotal: null,
          disponibleRecibo: r2(cuotaTope),
          cuotaMaximaReal: r2(cuotaEfectiva),
          limitadoPor: usandoCuotaPers ? 'CUOTA_PERSONALIZADA' : 'MARGEN_RECIBO',
          neto: netoR,
          capitalBruto: r2(calc.capitalBruto || 0),
          cuotaFinal: cuotaR,
          totalPagar: r2(calc.totalPagar || (calc.cuotaFinal * plazo)),
          saldoCancelar: r2(saldoCanc),
          netoBolsillo: saldoCanc > 0 ? r2(netoR - saldoCanc) : netoR,
          cubreCancelacion: saldoCanc > 0 ? (netoR >= saldoCanc) : true,
          alivioMensual: cuotaRef > 0 ? r2(cuotaRef - cuotaR) : null
        };
      }).filter(Boolean);
    }

    function renderizarFilasPlanesAuditoria(cuotaMaxima, lineaKey = 'FEDEM', netoLiquido = null) {
      const normKey = String(lineaKey || 'FEDEM').toUpperCase();
      const planesKey = (normKey.includes('QUAD') || normKey.includes('MUNI')) ? 'muni' : (normKey.includes('SIDE') ? 'sidecreer' : 'fedem');
      const offerOpts = (typeof window !== 'undefined' && window._offerOptsAuditoria) ? window._offerOptsAuditoria : null;
      const planes = calcularPlanesSugeridosAuditoria(cuotaMaxima, planesKey, netoLiquido, offerOpts);
      if (!planes || planes.length === 0) {
        return '<tr><td colspan="4" class="py-4 px-3 text-center text-xs text-slate-500 font-sans">No hay ofertas habilitadas (SIN Disponible, saldo vigente supera tope o margen insuficiente para esta línea).</td></tr>';
      }
      const esAdm = esAdminAuditoria();
      return planes.map((p, idx) => {
        const zebraBg = (idx % 2 === 1) ? 'bg-slate-50/40' : 'bg-white';
        const netoNum = Number(p.neto) || 0;
        const cuotaNum = Number(p.cuotaFinal) || 0;
        const totalNum = Number(p.totalPagar) || 0;
        const saldoCanc = Number(p.saldoCancelar) || 0;
        const bolsilloNum = Number(p.netoBolsillo ?? netoNum);
        const cubreSaldo = p.cubreCancelacion !== false;
        const alivioNum = (p.alivioMensual !== null && p.alivioMensual !== undefined) ? Number(p.alivioMensual) : null;

        const netoFormateado = sanitizeHTML(formatMontoSinSimboloAr(netoNum));
        const cuotaFinalFormateada = sanitizeHTML(formatMontoSinSimboloAr(cuotaNum));
        const compMaxTxt = p.topeCompromisoTotal ? ('Comp. máx.: $ ' + sanitizeHTML(formatMontoSinSimboloAr(p.topeCompromisoTotal))) : '';
        const multTxt = p.multiplicador ? (p.multiplicador + 'x Neto · 41,67%') : '';
        const limitadoLabel = p.limitadoPor === 'CUOTA_PERSONALIZADA'
          ? 'Cuota Personalizada'
          : (p.limitadoPor === 'TOPE_ENDEUDAMIENTO_CON_SALDO'
            ? 'Tope 41,67% + Saldo Vigente'
            : (p.limitadoPor === 'TOPE_ENDEUDAMIENTO' ? 'Tope 41,67% Neto' : 'Margen Recibo'));

        let bolsilloHtml = '';
        if (saldoCanc > 0) {
          const badgeCubre = cubreSaldo
            ? '<span class="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Cubre saldo</span>'
            : '<span class="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">Falta $ ' + sanitizeHTML(formatMontoSinSimboloAr(Math.abs(bolsilloNum))) + '</span>';
          bolsilloHtml = '<div class="text-[11px] font-mono font-bold ' + (cubreSaldo ? 'text-indigo-700' : 'text-rose-700') + ' mt-0.5 flex items-center gap-1.5 flex-wrap">' +
            '<span>Bolsillo: $ ' + sanitizeHTML(formatMontoSinSimboloAr(bolsilloNum)) + '</span>' + badgeCubre +
          '</div>';
        }
        const alivioHtml = (alivioNum !== null)
          ? '<div class="text-[10px] font-mono font-bold ' + (alivioNum >= 0 ? 'text-emerald-700' : 'text-amber-700') + ' mt-0.5">Alivio: ' + (alivioNum >= 0 ? '+$ ' : '-$ ') + sanitizeHTML(formatMontoSinSimboloAr(Math.abs(alivioNum))) + '/mes</div>'
          : '';

        return '<tr class="' + zebraBg + ' hover:bg-indigo-50/40 transition-colors border-b border-slate-100 font-sans text-slate-700">' +
          '<td class="py-3 px-4 whitespace-nowrap">' +
            '<div class="text-sm font-bold text-emerald-700 font-mono">$ ' + netoFormateado + '</div>' +
            bolsilloHtml +
            (esAdm && totalNum > 0 ? '<div class="text-[10px] text-slate-400 font-mono mt-0.5">Total: $ ' + sanitizeHTML(formatMontoSinSimboloAr(totalNum)) + '</div>' : '') +
          '</td>' +
          '<td class="py-3 px-4 text-center whitespace-nowrap">' +
            '<div class="text-sm font-bold text-slate-800">' + p.plazo + ' cuotas fijas</div>' +
            (esAdm && multTxt ? '<div class="text-[10px] text-slate-500 font-mono mt-0.5">' + multTxt + (compMaxTxt ? ' · ' + compMaxTxt : '') + '</div>' : '') +
          '</td>' +
          '<td class="py-3 px-4 text-right whitespace-nowrap">' +
            '<div class="text-sm font-bold text-slate-900 font-mono">$ ' + cuotaFinalFormateada + '</div>' +
            (esAdm ? alivioHtml + '<div class="text-[10px] text-slate-400 mt-0.5">Tope: ' + limitadoLabel + '</div>' : '') +
          '</td>' +
          '<td class="py-2.5 px-4 text-right whitespace-nowrap">' +
            '<div class="inline-flex items-center justify-end gap-1.5">' +
              '<button type="button" onclick="seleccionarPlanAuditoria(' + p.plazo + ', ' + netoNum.toFixed(2) + ', ' + cuotaNum.toFixed(2) + ')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-medium shadow-sm transition-all duration-150 cursor-pointer">' +
                '<span>Seleccionar</span>' +
                '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>' +
              '</button>' +
              '<button type="button" onclick="cargarPlanAuditadoEnSimulador(' + netoNum.toFixed(2) + ', ' + p.plazo + ', \'' + p.lineaKey + '\')" class="audit-sim-sec-btn" title="Abrir esta oferta en el Simulador">Simular</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function seleccionarPlanAuditoria(plazo, neto, cuota) {
      const normKey = String(window._lineaAuditoriaSugerida || 'FEDEM').toUpperCase();
      const lineaKey = (normKey.includes('QUAD') || normKey.includes('MUNI')) ? 'muni' : (normKey.includes('SIDE') ? 'sidecreer' : 'fedem');
      trasladarPlanAuditadoAExpediente(neto, plazo, lineaKey);
    }

    function cambiarLineaAuditoria(nuevaLinea) {
      const normKey = String(nuevaLinea || 'FEDEM').toUpperCase();
      let selected = 'FEDEM';
      if (normKey.includes('QUAD') || normKey.includes('MUNI')) {
        selected = 'QUAD';
      } else if (normKey.includes('SIDE')) {
        selected = 'SIDECREER';
      }
      window._lineaAuditoriaSugerida = selected;
      const cuota = window._cuotaMaximaAuditoria || 0;
      const liq = (typeof window !== 'undefined' && window._netoLiquidoAuditoria !== undefined) ? window._netoLiquidoAuditoria : null;

      const tabActiveCls = 'tab-linea-auditoria px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 bg-white text-indigo-950 shadow-sm border border-slate-200/50';
      const tabInactiveCls = 'tab-linea-auditoria px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 text-slate-600 hover:text-slate-900 hover:bg-white/60';

      const tabFedem = document.getElementById('tabLineaFEDEM') || document.getElementById('btnLineaAuditoria_fedem');
      const tabQuad = document.getElementById('tabLineaQUAD') || document.getElementById('btnLineaAuditoria_muni');
      const tabSidecreer = document.getElementById('tabLineaSidecreer') || document.getElementById('btnLineaAuditoria_sidecreer');

      if (tabFedem) tabFedem.className = (selected === 'FEDEM') ? tabActiveCls : tabInactiveCls;
      if (tabQuad) tabQuad.className = (selected === 'QUAD') ? tabActiveCls : tabInactiveCls;
      if (tabSidecreer) tabSidecreer.className = (selected === 'SIDECREER') ? tabActiveCls : tabInactiveCls;

      const tbody = document.getElementById('tbodyPlanesAuditoria');
      if (tbody) {
        tbody.innerHTML = renderizarFilasPlanesAuditoria(cuota, selected, liq);
      }
    }

    function actualizarUICuotaPersonalizadaAuditoria() {
      const cuota = window._cuotaMaximaAuditoria || 0;
      const cuotaSeguraMax = window._cuotaSeguraMaxAuditoria || cuota;
      const liq = (typeof window !== 'undefined' && window._netoLiquidoAuditoria !== undefined) ? window._netoLiquidoAuditoria : null;
      const linea = window._lineaAuditoriaSugerida || 'FEDEM';
      window._offerOptsAuditoria = Object.assign({}, window._offerOptsAuditoria || {}, {
        cuotaPersonalizada: _auditCuotaPersonalizada > 0 ? _auditCuotaPersonalizada : 0
      });

      const tbody = document.getElementById('tbodyPlanesAuditoria');
      if (tbody) {
        tbody.innerHTML = renderizarFilasPlanesAuditoria(cuota, linea, liq);
      }

      const inp = document.getElementById('inputAuditCuotaPersonalizada');
      if (inp) {
        inp.value = _auditCuotaPersonalizada > 0 ? _auditCuotaPersonalizada.toFixed(2) : '';
      }

      const btnReset = document.getElementById('btnLimpiarCuotaPersSim');
      if (btnReset) {
        btnReset.style.display = _auditCuotaPersonalizada > 0 ? 'inline-flex' : 'none';
      }

      const badge = document.getElementById('badgeCuotaSeguraSim');
      if (badge) {
        const cuotaMostrar = (_auditCuotaPersonalizada > 0 && _auditCuotaPersonalizada < cuotaSeguraMax)
          ? _auditCuotaPersonalizada
          : cuotaSeguraMax;
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' +
          (_auditCuotaPersonalizada > 0 && _auditCuotaPersonalizada < cuotaSeguraMax
            ? ('Cuota Objetivo: ' + sanitizeHTML(formatPesosMargen(cuotaMostrar)) + ' / mes (Máx.: ' + sanitizeHTML(formatPesosMargen(cuotaSeguraMax)) + ')')
            : ('Cuota Segura Máx.: ' + sanitizeHTML(formatPesosMargen(cuotaSeguraMax)) + ' / mes'));
      }
    }

    function aplicarCuotaPersonalizadaAuditoria(val) {
      const maxDisp = Number(window._cuotaMaximaAuditoria || 0);
      const maxSeg = Number(window._cuotaSeguraMaxAuditoria || maxDisp);
      if (!maxDisp || maxDisp <= 0) return 0;

      let raw = val;
      if (raw === undefined) {
        const inp = document.getElementById('inputAuditCuotaPersonalizada');
        raw = inp ? inp.value : 0;
      }
      const parsed = (typeof limpiarNumeroPadron === 'function')
        ? limpiarNumeroPadron(raw)
        : (parseNumeroSeguroAuditoria(raw) || 0);
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const clean = Math.max(0, r2(parsed));

      if (clean <= 0) {
        _auditCuotaPersonalizada = 0;
      } else if (clean > maxSeg && maxSeg > 0) {
        _auditCuotaPersonalizada = 0;
        if (typeof showToast === 'function') {
          showToast('La cuota ingresada supera la Cuota Máxima Segura (' + formatPesosMargen(maxSeg) + '). Se mantiene el tope máximo.');
        }
      } else {
        _auditCuotaPersonalizada = clean;
      }
      actualizarUICuotaPersonalizadaAuditoria();
      return _auditCuotaPersonalizada;
    }

    function limpiarCuotaPersonalizadaAuditoria() {
      _auditCuotaPersonalizada = 0;
      actualizarUICuotaPersonalizadaAuditoria();
      return 0;
    }

    /* --- TARJETA DE RESUMEN DE AUDITORÍA CONTENIDA PARA EL MODAL DE NUEVA SOLICITUD --- */
    function generarTarjetaResumenAuditoriaModal(rawAudit) {
      if (!rawAudit) return '';
      const audit = (typeof normalizarResultadoAuditoriaIA === 'function')
        ? normalizarResultadoAuditoriaIA(rawAudit)
        : rawAudit;
      const payload = (rawAudit && typeof rawAudit === 'object')
        ? (rawAudit.auditoria || rawAudit.resultado || rawAudit.data || rawAudit)
        : {};
      const r = audit.resumenDecision || payload.resumenDecision || payload.reciboSueldo || payload.liquidacion || payload || {};
      const d = audit.detalleCompletoRecibo || payload.detalleCompletoRecibo || payload.reciboSueldo || payload || {};
      const rec = audit.reciboSueldo || {};
      const am = audit.analisisMargen || {};
      const esPasivo = (am.tipoBeneficiario || r.tipoBeneficiario) === 'PASIVO';
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const fmtP = (typeof formatPesosMargen === 'function') ? formatPesosMargen : formatMontoAuditoriaExacto;

      const bruto = parseNumeroSeguroAuditoria(
        am.totalHaberes ?? r.sueldoBrutoTotal ?? r.sueldoBruto ?? payload.sueldoBrutoTotal ?? d.totales?.totalHaberes ?? rec.sueldoBruto
      ) ?? 0;
      const descuentos = Math.abs(parseNumeroSeguroAuditoria(
        am.totalDescuentos ?? r.totalDescuentos ?? r.totalDescuentosRecibo ?? payload.totalDescuentos ?? d.totales?.totalDescuentos ?? rec.totalDescuentosRecibo
      ) ?? 0);
      const liquido = parseNumeroSeguroAuditoria(
        am.netoLiquido ?? r.sueldoLiquido ?? r.sueldoNeto ?? payload.sueldoLiquido ?? d.totales?.liquidoAPagar ?? rec.sueldoNeto
      ) ?? r2(bruto - descuentos);
      const disponibleRecibo = parseNumeroSeguroAuditoria(
        am.disponibleRecibo ?? r.disponibleRecibo ?? r.margenDisponiblePlanilla ?? rec.margenDisponibleCuota
      ) ?? 0;
      const topeEndeud = parseNumeroSeguroAuditoria(am.topeEndeudamientoMensual4167) ?? r2((5 * Math.max(0, liquido)) / 12);
      const puedeOfrecer = (am.puedeOfrecerCuotas !== undefined) ? (Boolean(am.puedeOfrecerCuotas) && disponibleRecibo > 0) : (disponibleRecibo > 0);
      const cuotaSegura = parseNumeroSeguroAuditoria(am.cuotaMaximaSeguraGeneral ?? r.cuotaMaximaSeguraGeneral) ?? (puedeOfrecer ? r2(Math.min(disponibleRecibo, topeEndeud)) : 0);

      const embargoDetectado = Boolean(
        r.embargosJudiciales || payload.embargosJudiciales || rec.embargoDetectado || (parseNumeroSeguroAuditoria(rec.embargoMonto) || 0) > 0
      );

      let badgeHtml = '';
      if (embargoDetectado) {
        badgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">● Rechazado — Embargo Activo</span>';
      } else if (puedeOfrecer && disponibleRecibo > 0) {
        badgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">● DISPONIBLE · ' + (esPasivo ? 'Pasivos 65%' : 'Activos 80%') + '</span>';
      } else {
        badgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">● SIN Disponible</span>';
      }

      const haberesFormateado = fmtP(bruto);
      const descuentosFormateado = fmtP(descuentos);
      const liquidoFormateado = fmtP(liquido);
      const margenFormateado = puedeOfrecer ? fmtP(cuotaSegura) : 'SIN Disponible';
      const margenSubHtml = puedeOfrecer
        ? ('<span class="block text-[10px] text-slate-500 font-mono mt-0.5">Disp.: ' + sanitizeHTML(fmtP(disponibleRecibo)) + ' · Tope 41,67%</span>')
        : ('<span class="block text-[10px] text-rose-600 font-mono mt-0.5">Disp. Recibo: ' + sanitizeHTML(fmtP(disponibleRecibo)) + '</span>');

      return '<div class="bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-indigo-100 rounded-xl p-4 mb-5 shadow-sm">' +
        '<div class="flex items-center justify-between pb-3 mb-3 border-b border-indigo-100/60 flex-wrap gap-2">' +
          '<div class="flex items-center gap-2">' +
            '<span class="p-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm">🛡️</span>' +
            '<div>' +
              '<h4 class="text-xs font-bold uppercase tracking-wider text-slate-800">Evaluación Salarial y Capacidad Crediticia</h4>' +
              '<p class="text-[11px] text-slate-500">Motor Padrón Oficial · ' + (esPasivo ? 'Pasivos 65%' : 'Activos 80%') + ' · Tope Endeudamiento 41,67% Neto</p>' +
            '</div>' +
          '</div>' +
          badgeHtml +
        '</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">' +
          '<div class="bg-white p-2.5 rounded-lg border border-slate-200/60">' +
            '<span class="text-[10px] uppercase font-bold text-slate-400 block">Total Haberes</span>' +
            '<span class="font-bold text-slate-800 text-sm font-mono" id="modalAuditoriaHaberes">' + sanitizeHTML(haberesFormateado) + '</span>' +
          '</div>' +
          '<div class="bg-white p-2.5 rounded-lg border border-slate-200/60">' +
            '<span class="text-[10px] uppercase font-bold text-slate-400 block">Total Descuentos</span>' +
            '<span class="font-bold text-rose-600 text-sm font-mono" id="modalAuditoriaDescuentos">' + sanitizeHTML(descuentosFormateado) + '</span>' +
          '</div>' +
          '<div class="bg-white p-2.5 rounded-lg border border-slate-200/60">' +
            '<span class="text-[10px] uppercase font-bold text-slate-400 block">Sueldo Líquido</span>' +
            '<span class="font-bold text-emerald-600 text-sm font-mono" id="modalAuditoriaLiquido">' + sanitizeHTML(liquidoFormateado) + '</span>' +
          '</div>' +
          '<div class="bg-white p-2.5 rounded-lg border border-slate-200/60">' +
            '<span class="text-[10px] uppercase font-bold text-slate-400 block">Cuota Máxima Segura</span>' +
            '<span class="font-bold ' + (puedeOfrecer ? 'text-indigo-900' : 'text-rose-700') + ' text-sm font-mono" id="modalAuditoriaMargen">' + sanitizeHTML(margenFormateado) + '</span>' +
            margenSubHtml +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function trasladarPlanAuditadoAExpediente(monto, plazo, linea = 'fedem') {
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const dictamen = ultimoResultadoAuditoria || {};
      const netoLimpio = Math.max(1000, r2(Number(monto) || 0));
      const plazoNum = Number(plazo) || 12;
      const lineaNormalizada = (linea === 'muni' || linea === 'municipales' || linea === 'quad') ? 'muni' : (linea === 'sidecreer' ? 'sidecreer' : 'fedem');

      dictamen.montoSugerido = netoLimpio;
      dictamen.cuotas = plazoNum;
      dictamen.plazo = plazoNum;
      dictamen.linea = lineaNormalizada;

      abrirNuevoExpedienteDesdeAuditoria(dictamen);

      const selLinea = document.getElementById('solLinea');
      if (selLinea) {
        selLinea.value = lineaNormalizada;
        if (typeof ajustarPlazosModalAlta === 'function') {
          ajustarPlazosModalAlta(lineaNormalizada);
        }
      }

      const selPlazo = document.getElementById('solPlazo');
      if (selPlazo) {
        selPlazo.value = String(plazoNum);
      }

      const inpMonto = document.getElementById('solMonto');
      if (inpMonto) {
        inpMonto.value = netoLimpio.toFixed(2);
        inpMonto.dataset.lastValid = netoLimpio.toFixed(2);
      }

      if (typeof recalcularValidacionesEdadYCuotas === 'function') {
        recalcularValidacionesEdadYCuotas();
      }
      if (typeof actualizarResumenCuotaAlta === 'function') {
        actualizarResumenCuotaAlta();
      }
      if (typeof sincronizarEstadoBotonSubmitAlta === 'function') {
        sincronizarEstadoBotonSubmitAlta();
      }

      showToast('Plan de ' + plazoNum + ' cuotas por $ ' + formatMontoSinSimboloAr(netoLimpio) + ' trasladado a la solicitud.');
    }

    function cargarPlanAuditadoEnSimulador(montoNeto, plazo, lineaKey = 'fedem') {
      const r2 = (typeof round2Margen === 'function') ? round2Margen : (n => Math.round(n * 100) / 100);
      const netoLimpio = Math.max(1000, r2(Number(montoNeto) || 0));
      const plazoNum = Number(plazo) || 12;
      state.linea = FINANCIAL_DATA[lineaKey] ? lineaKey : 'fedem';
      state.modo = 'neto';
      state.montoInputRaw = netoLimpio;
      state.plazo = plazoNum;
      const inputEl = document.getElementById('amountInput');
      if (inputEl) {
        inputEl.value = Number.isInteger(netoLimpio) ? integerFormatter.format(netoLimpio) : formatMontoSinSimboloAr(netoLimpio);
      }
      renderApp();
      if (typeof cambiarPestana === 'function') {
        cambiarPestana('view-simulador');
      }
      mostrarNotificacionToast('Plan de ' + plazoNum + ' cuotas por $ ' + formatMontoSinSimboloAr(netoLimpio) + ' cargado en el Simulador.', 'success');
    }

    /* --- TARJETA DE RESUMEN EJECUTIVO: AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER --- */
    function generarTarjetaResumenEjecutivoAMMER(rawAudit, accionesHtml = '') {
      if (!rawAudit) return '';
      const audit = (typeof normalizarResultadoAuditoriaIA === 'function')
        ? normalizarResultadoAuditoriaIA(rawAudit)
        : rawAudit;
      const payload = (rawAudit && typeof rawAudit === 'object')
        ? (rawAudit.auditoria || rawAudit.resultado || rawAudit.data || rawAudit)
        : {};
      const r = audit.resumenDecision || payload.resumenDecision || payload.reciboSueldo || payload.liquidacion || payload || {};
      const d = audit.detalleCompletoRecibo || payload.detalleCompletoRecibo || payload.reciboSueldo || payload || {};
      const rec = audit.reciboSueldo || {};
      const ident = audit.identidad || {};
      const datLab = audit.datosLaborales || {};
      const am = audit.analisisMargen || {};
      const esPadron = am && am.esCalculoPadron !== false && am.subtotal1 !== undefined;

      const titular = limpiarTextoAuditoria(r.titular || r.nombre || ident.titularDetectado || ident.nombre || rec.titular || payload.titular, 'No especificado');
      const dni = limpiarTextoAuditoria(r.dni || ident.dni || rec.dni || payload.dni, 'No especificado');
      const cuilClean = limpiarTextoAuditoria(r.cuil || ident.cuil || rec.cuil || payload.cuil, '');
      const mostrarCuil = cuilClean && cuilClean !== 'No consta en recibo' && cuilClean !== dni;
      const organismo = limpiarTextoAuditoria(r.organismo || r.empleador || datLab.organismoEmpleador || datLab.organismo || rec.organismo || payload.organismo, 'Organismo Provincial');
      const cargo = limpiarTextoAuditoria(r.cargo || datLab.escalafonCargo || datLab.cargo || d.escalafonCargo || rec.escalafonCargo || rec.situacionRevista || payload.cargo, 'Agente / Activo');

      const periodoRaw = limpiarTextoAuditoria(r.periodo || rec.periodo || d.periodo || payload.periodo || payload.mesLiquidado, '');
      const periodoClean = (periodoRaw && !/mes auditado|no consta|n\/a/i.test(periodoRaw)) ? periodoRaw : 'No especificado';

      const antigRaw = limpiarTextoAuditoria(r.antiguedad || rec.antiguedadDetalle || datLab.antiguedad || datLab.antiguedadDetalle || payload.antiguedad, '');
      const antigCleanRaw = (antigRaw && !/no registrada|no especificada|no consta|n\/a/i.test(antigRaw)) ? antigRaw : '';
      const antigClean = (typeof formatearAntiguedadLegible === 'function')
        ? formatearAntiguedadLegible(antigCleanRaw)
        : antigCleanRaw;

      const fechaIngRaw = limpiarTextoAuditoria(r.fechaIngreso || rec.fechaIngreso || datLab.fechaIngreso || datLab.fechaIngresoLaboral || payload.fechaIngreso, '');
      const fechaIngClean = (fechaIngRaw && !/no consta|sin fecha|n\/a/i.test(fechaIngRaw)) ? fechaIngRaw : '';

      let antiguedadDisplay = 'No especificada';
      if (antigClean && fechaIngClean) {
        antiguedadDisplay = antigClean + ' (Ing. ' + fechaIngClean + ')';
      } else if (antigClean) {
        antiguedadDisplay = antigClean;
      } else if (fechaIngClean) {
        antiguedadDisplay = 'Ingreso ' + fechaIngClean;
      }

      const catRaw = limpiarTextoAuditoria(r.categoria || rec.categoria || datLab.categoria || payload.categoria, '');
      const catClean = (catRaw && !/no consta|no especificada|n\/a/i.test(catRaw)) ? catRaw : '';

      const legajoRaw = limpiarTextoAuditoria(r.legajo || rec.legajo || datLab.legajo || datLab.legajoMunicipal || payload.legajo, '');
      const legajoClean = (legajoRaw && !/no consta|no especificada|n\/a/i.test(legajoRaw)) ? legajoRaw : '';

      const bruto = parseNumeroSeguroAuditoria(
        am.totalHaberes ?? r.sueldoBrutoTotal ?? r.sueldoBruto ?? payload.sueldoBrutoTotal ?? d.totales?.totalHaberes ?? rec.sueldoBruto
      ) ?? 0;
      const descuentos = Math.abs(parseNumeroSeguroAuditoria(
        am.totalDescuentos ?? r.totalDescuentos ?? r.totalDescuentosRecibo ?? payload.totalDescuentos ?? d.totales?.totalDescuentos ?? rec.totalDescuentosRecibo
      ) ?? 0);
      const liquido = parseNumeroSeguroAuditoria(
        am.netoLiquido ?? r.sueldoLiquido ?? r.sueldoNeto ?? payload.sueldoLiquido ?? d.totales?.liquidoAPagar ?? rec.sueldoNeto
      ) ?? round2Margen(bruto - descuentos);

      const tipoBenef = am.tipoBeneficiario || r.tipoBeneficiario || 'ACTIVO';
      const esPasivo = tipoBenef === 'PASIVO';
      const pctTopeNum = Math.round((am.porcentajeTope ?? (esPasivo ? 0.35 : 0.20)) * 100);
      const pctAfectNum = Math.round((am.porcentajeAfectableMaximo ?? (esPasivo ? 0.65 : 0.80)) * 100);
      const lugarTrabajo = am.lugarTrabajo || r.lugarTrabajo || (esPasivo ? 'JU_' : 'GE_');

      const totalSub1 = parseNumeroSeguroAuditoria(am.totalSubtotal1Desc ?? r.totalSubtotal1Desc ?? r.descuentosLey ?? rec.descuentosLey) ?? 0;
      const subtotal1 = parseNumeroSeguroAuditoria(am.subtotal1 ?? r.subtotal1) ?? round2Margen(bruto - totalSub1);
      const subtotalTope = parseNumeroSeguroAuditoria(am.subtotalTope ?? r.subtotalTope) ?? round2Margen(subtotal1 * (pctTopeNum / 100));
      const subtotal2 = parseNumeroSeguroAuditoria(am.subtotal2 ?? r.subtotal2) ?? round2Margen(subtotal1 - subtotalTope);
      const totalNoComp = parseNumeroSeguroAuditoria(am.totalNoComputable ?? r.totalNoComputable) ?? 0;
      const afectable = parseNumeroSeguroAuditoria(am.afectable ?? r.afectable) ?? round2Margen(subtotal2 - totalNoComp);
      const totalAfectado = parseNumeroSeguroAuditoria(am.totalAfectado ?? r.totalAfectado) ?? 0;
      const cuotaFutura2 = parseNumeroSeguroAuditoria(am.cuotaFutura2 ?? r.cuotaFutura2 ?? _auditCuotaFutura2) ?? 0;
      const cuotaRef = parseNumeroSeguroAuditoria(am.cuotaRefinanciar ?? r.cuotaRefinanciar) ?? 0;
      const cuotaRefAplicada = parseNumeroSeguroAuditoria(am.cuotaRefinanciarAplicada) ?? Math.min(totalAfectado, cuotaRef);
      const totalAfectadoEfectivo = parseNumeroSeguroAuditoria(am.totalAfectadoEfectivo ?? r.totalAfectadoEfectivo) ?? Math.max(0, round2Margen(totalAfectado - cuotaRefAplicada));
      const saldoCanc = parseNumeroSeguroAuditoria(am.saldoCancelar ?? r.saldoCancelar) ?? 0;
      const saldoExt = parseNumeroSeguroAuditoria(am.saldoVigenteExterno ?? r.saldoVigenteExterno) ?? 0;
      const detRef = String(am.detalleRefinanciacion ?? r.detalleRefinanciacion ?? '').trim();
      const facMargen = Number(am.factorMargen ?? r.factorMargen ?? 1.0) || 1.0;
      const dispOriginal = parseNumeroSeguroAuditoria(am.disponibleReciboOriginal ?? r.disponibleReciboOriginal) ?? round2Margen(afectable - totalAfectado - cuotaFutura2);
      const dispBruto = parseNumeroSeguroAuditoria(am.disponibleBrutoRecibo ?? r.disponibleBrutoRecibo) ?? round2Margen(afectable - totalAfectadoEfectivo - cuotaFutura2);
      const disponibleRecibo = parseNumeroSeguroAuditoria(am.disponibleRecibo ?? r.disponibleRecibo ?? r.margenDisponiblePlanilla ?? rec.margenDisponibleCuota) ?? dispBruto;
      const puedeOfrecer = am.puedeOfrecerCuotas !== undefined ? Boolean(am.puedeOfrecerCuotas) : (disponibleRecibo > 0);
      const topeEndeud = parseNumeroSeguroAuditoria(am.topeEndeudamientoMensual4167) ?? round2Margen((5 * Math.max(0, liquido)) / 12);
      const cuotaSegura = parseNumeroSeguroAuditoria(am.cuotaMaximaSeguraGeneral ?? r.cuotaMaximaSeguraGeneral) ?? (puedeOfrecer ? round2Margen(Math.min(disponibleRecibo, topeEndeud)) : 0);
      const concl = audit.conclusionesRecomendaciones || null;

      const embargoDetectado = Boolean(
        r.embargosJudiciales || payload.embargosJudiciales || rec.embargoDetectado || (parseNumeroSeguroAuditoria(rec.embargoMonto) || 0) > 0
      );
      const embargoMonto = parseNumeroSeguroAuditoria(rec.embargoMonto) || 0;
      const porcentajeDescuentos = bruto > 0 ? ((descuentos / bruto) * 100).toFixed(1) + '%' : '0.0%';

      let badgeTexto = '';
      let badgeToneCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      let badgeDotCls = 'bg-emerald-500 animate-pulse';
      let dictamenText = '';
      let canalSugerido = '';

      if (embargoDetectado) {
        badgeTexto = 'Rechazado — Embargo Activo';
        badgeToneCls = 'bg-rose-50 text-rose-700 border-rose-200';
        badgeDotCls = 'bg-rose-500';
        dictamenText = 'NO VIABLE — Se detectó retención judicial o embargo activo (' + formatPesosMargen(embargoMonto) + ').';
        canalSugerido = 'Canal bloqueado por política de riesgo crediticio institucional';
      } else if (puedeOfrecer && disponibleRecibo > 0) {
        badgeTexto = (cuotaRefAplicada > 0 ? 'DISPONIBLE (Refi) · ' : 'DISPONIBLE · ') + (esPasivo ? 'Pasivos 65%' : 'Activos 80%');
        badgeToneCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        badgeDotCls = 'bg-emerald-500 animate-pulse';
        dictamenText = 'APTO POR PLANILLA — Disponible Recibo ' + formatPesosMargen(disponibleRecibo) + ' · Cuota segura (Tope 41,67% Neto): ' + formatPesosMargen(cuotaSegura) + '.';
        canalSugerido = 'Habilitado Débito / Retención (Convenio Oficial AMMER)';
      } else {
        badgeTexto = 'SIN Disponible';
        badgeToneCls = 'bg-rose-50 text-rose-700 border-rose-200';
        badgeDotCls = 'bg-rose-500';
        dictamenText = 'SIN Disponible — Margen afectable negativo (' + formatPesosMargen(disponibleRecibo) + '). Simulación automática de cuotas bloqueada.';
        canalSugerido = 'Bloqueada oferta por planilla (requiere cancelación previa o revisión especial)';
      }

      const badgeHtml =
        '<div id="badgeEstadoAuditoria" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ' + badgeToneCls + '">' +
          '<span class="w-2 h-2 rounded-full ' + badgeDotCls + '"></span>' +
          '<span id="textoEstadoAuditoria">' + sanitizeHTML(badgeTexto) + '</span>' +
        '</div>';

      const catBadgePill = catClean
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs">' +
            '<span>🏷️</span>' +
            '<span class="text-slate-500 font-medium">Categoría:</span>' +
            '<strong>' + sanitizeHTML(/^cat/i.test(catClean) ? catClean : ('Cat. ' + catClean)) + '</strong>' +
          '</span>'
        : '';

      const legajoBadgePill = legajoClean
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs">' +
            '<svg class="w-3.5 h-3.5 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M15 10h3M15 14h3"/></svg>' +
            '<span class="text-slate-500 font-medium">Legajo:</span>' +
            '<strong class="font-mono">' + sanitizeHTML(legajoClean) + '</strong>' +
          '</span>'
        : '';

      // Validaciones y alertas del Paso 1
      const alertas = Array.isArray(am.alertas) ? am.alertas : (Array.isArray(audit.alertas) ? audit.alertas : []);
      const valid = am.validaciones || audit.validaciones || {};
      let validHtml = '';
      if (alertas.length > 0) {
        validHtml =
          '<div class="ai-valid-alerts-box">' +
            '<div style="font-weight:800;display:flex;align-items:center;gap:6px;">⚠️ Validaciones y Alertas del Recibo (' + alertas.length + ')</div>' +
            '<ul>' + alertas.map(al => '<li>' + sanitizeHTML(al) + '</li>').join('') + '</ul>' +
          '</div>';
      } else if (esPadron && valid.tieneDesgloseItems) {
        validHtml =
          '<div class="ai-valid-ok-box">' +
            '<span>✅ Consistencia de cabecera verificada (Bruto - Descuentos = Líquido) y totales de ítems conciliados.</span>' +
            '<span class="font-mono" style="font-size:0.68rem;">Ítems clasificados: ' + (Array.isArray(d.conceptos) ? d.conceptos.length : 0) + '</span>' +
          '</div>';
      } else if (!esPadron) {
        validHtml =
          '<div class="ai-valid-alerts-box">' +
            '<span>ℹ️ Dictamen histórico sin desglose de ítems: se muestran los totales resumidos almacenados sin reclasificación por código.</span>' +
          '</div>';
      }

      // Barra de capacidad de endeudamiento vs Tope 41,67%
      const ratioTope = topeEndeud > 0 ? Math.min(100, Math.max(0, round2Margen((Math.max(0, cuotaSegura) / topeEndeud) * 100))) : 0;
      const limitadoTxt = !puedeOfrecer
        ? 'SIN Disponible (margen agotado)'
        : (disponibleRecibo <= topeEndeud
          ? 'Acotado por Margen del Recibo (' + formatPesosMargen(disponibleRecibo) + ' ≤ ' + formatPesosMargen(topeEndeud) + ')'
          : 'Acotado por Tope de Endeudamiento 41,67% Neto (' + formatPesosMargen(topeEndeud) + ' < ' + formatPesosMargen(disponibleRecibo) + ')');

      const cf2Display = cuotaFutura2 > 0 ? cuotaFutura2.toFixed(2) : '';
      const cuotaRefDisplay = cuotaRef > 0 ? cuotaRef.toFixed(2) : '';
      const saldoCancDisplay = saldoCanc > 0 ? saldoCanc.toFixed(2) : '';
      const saldoExtDisplay = saldoExt > 0 ? saldoExt.toFixed(2) : '';
      const refPanelActive = Boolean(cuotaRef > 0 || saldoCanc > 0 || saldoExt > 0 || detRef);
      const esFactor70 = facMargen < 0.99;

      const chipsRefi = (concl && Array.isArray(concl.escenariosSugeridos) && concl.escenariosSugeridos.length > 0)
        ? ('<div class="ai-refi-chips">' +
            '<span style="font-size:0.67rem;font-weight:700;color:#475569;">Detección en AFECTADO (clic para precargar cuota a liberar):</span>' +
            concl.escenariosSugeridos.map(esc => {
              const entSafe = String(esc.entidad || '').replace(/'/g, '');
              const mNum = Number(esc.montoLiberable || 0);
              return '<button type="button" class="ai-refi-chip" onclick="aplicarRefinanciacionAuditoria({ cuotaRefinanciar: ' + mNum.toFixed(2) + ', detalleRefinanciacion: \'Refinanciación ' + sanitizeHTML(entSafe) + '\' })">' +
                '🔄 ' + sanitizeHTML(esc.entidad) + ': ' + sanitizeHTML(formatPesosMargen(mNum)) +
              '</button>';
            }).join('') +
          '</div>')
        : '';

      const refiPanelHtml =
        '<div class="ai-refi-panel ' + (refPanelActive ? 'is-active' : '') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span style="font-size:0.72rem;font-weight:800;color:#1e293b;">🔄 Refinanciación de Préstamos Vigentes y Saldo Externo</span>' +
            '<span style="font-size:0.66rem;color:#64748b;">Liberá cuotas del AFECTADO, descontá Saldo a Cancelar del neto o restá Saldo en Préstamos Vigentes del tope 41,67%</span>' +
          '</div>' +
          chipsRefi +
          '<div class="ai-refi-grid">' +
            '<div class="ai-refi-field">' +
              '<label for="inputAuditCuotaRefinanciar">Cuota a Liberar / Refinanciar ($)</label>' +
              '<input type="number" step="0.01" min="0" id="inputAuditCuotaRefinanciar" class="ai-refi-input" value="' + sanitizeHTML(cuotaRefDisplay) + '" placeholder="0,00" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aplicarRefinanciacionAuditoria();}"/>' +
            '</div>' +
            '<div class="ai-refi-field">' +
              '<label for="inputAuditSaldoCancelar">Saldo a Cancelar ($)</label>' +
              '<input type="number" step="0.01" min="0" id="inputAuditSaldoCancelar" class="ai-refi-input" value="' + sanitizeHTML(saldoCancDisplay) + '" placeholder="0,00" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aplicarRefinanciacionAuditoria();}"/>' +
            '</div>' +
            '<div class="ai-refi-field">' +
              '<label for="inputAuditSaldoVigenteExterno">Saldo en Préstamos Vigentes ($)</label>' +
              '<input type="number" step="0.01" min="0" id="inputAuditSaldoVigenteExterno" class="ai-refi-input" value="' + sanitizeHTML(saldoExtDisplay) + '" placeholder="0,00" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aplicarRefinanciacionAuditoria();}"/>' +
            '</div>' +
            '<div class="ai-refi-field">' +
              '<label for="inputAuditDetalleRefinanciacion">Entidad / Nota Refinanciación</label>' +
              '<input type="text" id="inputAuditDetalleRefinanciacion" class="ai-refi-input is-text" value="' + sanitizeHTML(detRef) + '" placeholder="Ej: BERSA / FEDEM" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aplicarRefinanciacionAuditoria();}"/>' +
            '</div>' +
            '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">' +
              '<button type="button" class="ai-cf2-btn" onclick="aplicarRefinanciacionAuditoria()">Aplicar Refinanciación</button>' +
              (refPanelActive ? '<button type="button" class="audit-sim-sec-btn" onclick="limpiarRefinanciacionAuditoria()">Limpiar</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>';

      let conclHtml = '';
      if (concl && concl.titulo) {
        const escTone = concl.escenario === 'EMBARGO' || concl.escenario === 'SIN_DISPONIBLE'
          ? 'tone-danger'
          : ((concl.escenario === 'SIN_DISPONIBLE_REFINANCIABLE' || concl.escenario === 'DISPONIBLE_LIMITADO_RECIBO') ? 'tone-warn' : 'tone-ok');
        const escBadgeMap = {
          EMBARGO: '🚫 Embargo Judicial',
          REFINANCIACION_ACTIVA: '🔄 Refinanciación Simulada',
          SIN_DISPONIBLE_REFINANCIABLE: '⚠️ Refinanciable',
          SIN_DISPONIBLE: '🔴 Margen Agotado',
          DISPONIBLE_LIMITADO_RECIBO: '🟡 Acotado por Recibo',
          DISPONIBLE_LIMITADO_TOPE_NETO: '✅ Capacidad Plena'
        };
        const escBadgeLbl = escBadgeMap[concl.escenario] || '💡 Dictamen';
        conclHtml =
          '<div class="ai-concl-card ' + escTone + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">' +
              '<div style="font-size:0.8rem;font-weight:800;color:#0f172a;">💡 Conclusiones y Recomendaciones — ' + sanitizeHTML(concl.titulo) + '</div>' +
              '<span style="font-size:0.66rem;font-weight:800;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.85);border:1px solid #cbd5e1;color:#1e293b;">' + sanitizeHTML(escBadgeLbl) + '</span>' +
            '</div>' +
            '<p style="font-size:0.75rem;font-weight:600;color:#1e293b;margin:0;line-height:1.45;">' + sanitizeHTML(concl.resumen || '') + '</p>' +
            (concl.plazoMinimoCobertura
              ? ('<div style="margin-top:6px;font-size:0.71rem;font-weight:700;color:#065f46;">✓ Cobertura del Saldo a Cancelar desde <strong>' + concl.plazoMinimoCobertura + ' cuotas</strong>.</div>')
              : '') +
            ((Array.isArray(concl.recomendaciones) && concl.recomendaciones.length > 0)
              ? ('<ul class="ai-concl-list">' + concl.recomendaciones.map(recIt => '<li>' + sanitizeHTML(recIt) + '</li>').join('') + '</ul>')
              : '') +
          '</div>';
      }

      const esAdmin = esAdminAuditoria();
      const accionesBoxSoloNonAdmin = accionesHtml
        ? ('<div class="bg-slate-50/90 rounded-xl p-4 border border-slate-200">' + accionesHtml + '</div>')
        : '';

      return '<div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden mb-6 font-sans antialiased">' +
        '<!-- Cabecera Institucional Limpia -->' +
        '<div class="bg-white border-b border-slate-200/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">' +
          '<div class="flex items-center gap-3">' +
            '<div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center shrink-0 text-indigo-700">' +
              '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
              '</svg>' +
            '</div>' +
            '<div>' +
              '<h3 class="text-sm sm:text-base font-bold text-slate-900 tracking-tight m-0">' +
                (esAdmin ? 'Auditoría Documental y Crediticia AMMER' : 'Auditoría Documental de Recibo AMMER') +
              '</h3>' +
              (esAdmin ? '<p class="text-xs text-slate-500 font-normal mt-0.5 mb-0">' +
                'Régimen ' + (esPasivo ? 'Pasivos (65%)' : 'Activos (80%)') + ' · Tope Endeudamiento 41,67% Neto' +
              '</p>' : '') +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2 flex-wrap">' +
            (esAdmin ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold font-mono">' + sanitizeHTML(lugarTrabajo) + '</span>' + badgeHtml : '') +
          '</div>' +
        '</div>' +

        '<!-- Grilla Limpia de Indicadores Clave Calculados -->' +
        '<div class="p-6 space-y-4">' +
          (esAdmin ? (
            '<div class="ai-regime-toolbar">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span style="font-size:0.7rem;font-weight:800;color:#334155;text-transform:uppercase;">Régimen Tope:</span>' +
                '<div class="ai-regime-toggle-wrap">' +
                  '<button type="button" onclick="cambiarRegimenAuditoriaInteractivo(\'ACTIVO\')" class="ai-regime-btn ' + (!esPasivo ? 'is-active' : '') + '">🏛️ Activos (80% · Tope 20%)</button>' +
                  '<button type="button" onclick="cambiarRegimenAuditoriaInteractivo(\'PASIVO\')" class="ai-regime-btn ' + (esPasivo ? 'is-active' : '') + '">👴 Pasivos / Jubilados (65% · Tope 35%)</button>' +
                '</div>' +
              '</div>' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span style="font-size:0.7rem;font-weight:800;color:#334155;text-transform:uppercase;">Criterio Margen:</span>' +
                '<div class="ai-regime-toggle-wrap">' +
                  '<button type="button" onclick="cambiarFactorMargenAuditoria(1.0)" class="ai-regime-btn ' + (!esFactor70 ? 'is-active' : '') + '">100% AMMER Directo</button>' +
                  '<button type="button" onclick="cambiarFactorMargenAuditoria(0.70)" class="ai-regime-btn ' + (esFactor70 ? 'is-active' : '') + '">70% Conservador c/ Gastos</button>' +
                '</div>' +
              '</div>' +
              '<div class="ai-cf2-wrap">' +
                '<label class="ai-cf2-label" for="inputAuditCuotaFutura2">Cuota Futura 2 ($):</label>' +
                '<input type="number" step="0.01" min="0" id="inputAuditCuotaFutura2" class="ai-cf2-input" value="' + sanitizeHTML(cf2Display) + '" placeholder="0,00" onkeydown="if(event.key===\'Enter\'){event.preventDefault();aplicarCuotaFutura2Auditoria();}"/>' +
                '<button type="button" class="ai-cf2-btn" onclick="aplicarCuotaFutura2Auditoria()">Aplicar</button>' +
              '</div>' +
            '</div>' +
            refiPanelHtml +
            validHtml
          ) : '') +

          '<div class="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/60">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">' +
              '<div>' +
                '<span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Titular</span>' +
                '<span class="text-base font-bold text-slate-900 break-words block">' + sanitizeHTML(titular) + '</span>' +
              '</div>' +
              '<div>' +
                '<span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">DNI / CUIL</span>' +
                '<span class="text-base font-normal text-slate-600 block mt-0.5"><span class="font-mono text-slate-700">' + sanitizeHTML(dni) + '</span>' + (mostrarCuil ? ' · <span class="font-mono text-slate-700">' + sanitizeHTML(cuilClean) + '</span>' : '') + '</span>' +
              '</div>' +
              '<div>' +
                '<span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Organismo</span>' +
                '<span class="text-base font-bold text-slate-900 break-words block">' + sanitizeHTML(organismo) + '</span>' +
                '<span class="text-sm font-normal text-slate-600 block mt-0.5">' + sanitizeHTML(cargo) + '</span>' +
              '</div>' +
              '<div>' +
                '<span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Retenciones vs Haberes</span>' +
                '<div class="flex items-center gap-2 mt-1">' +
                  '<div class="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">' +
                    '<div class="h-full ' + (parseFloat(porcentajeDescuentos) > 50 ? 'bg-rose-500' : 'bg-emerald-500') + '" style="width:' + Math.min(100, Math.max(0, parseFloat(porcentajeDescuentos))) + '%"></div>' +
                  '</div>' +
                  '<span class="font-mono text-sm font-bold text-slate-700 whitespace-nowrap">' + sanitizeHTML(porcentajeDescuentos) + '</span>' +
                '</div>' +
                (esAdmin
                  ? '<span class="text-xs text-slate-500 mt-1 block">Afectado real: ' + sanitizeHTML(formatPesosMargen(totalAfectado)) + '</span>'
                  : '<span class="text-xs text-slate-500 mt-1 block">Haberes: ' + sanitizeHTML(formatPesosMargen(bruto)) + ' · Retenciones: ' + sanitizeHTML(formatPesosMargen(descuentos)) + '</span>') +
              '</div>' +
            '</div>' +
            '<div class="mt-3 pt-3 border-t border-slate-200/70 flex flex-wrap items-center gap-2">' +
              '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs">' +
                '<span>📅</span>' +
                '<span class="text-slate-500 font-medium">Período Liquidado:</span>' +
                '<strong class="font-mono">' + sanitizeHTML(periodoClean) + '</strong>' +
              '</span>' +
              '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 border border-slate-200 text-xs font-semibold shadow-2xs">' +
                '<span>⏳</span>' +
                '<span class="text-slate-500 font-medium">Antigüedad / Ingreso:</span>' +
                '<strong>' + sanitizeHTML(antiguedadDisplay) + '</strong>' +
              '</span>' +
              catBadgePill +
              legajoBadgePill +
            '</div>' +
          '</div>' +

          (esAdmin ? (
            '<!-- Cascada Oficial de 5 Pasos del Motor Padrón -->' +
            '<div class="ai-waterfall-card">' +
              '<div class="ai-waterfall-title">' +
                '<span style="font-size:0.78rem;font-weight:800;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.03em;">📊 Cascada de Cálculo del Margen Afectable (' + (esPasivo ? 'Pasivos 65% · Tope 35%' : 'Activos 80% · Tope 20%') + ')</span>' +
                '<span class="font-mono" style="font-size:0.72rem;font-weight:700;color:#475569;">Neto Líquido: ' + sanitizeHTML(formatPesosMargen(liquido)) + '</span>' +
              '</div>' +
              '<div class="ai-waterfall-grid">' +
                '<div class="ai-wf-item">' +
                  '<span class="ai-wf-label">Total Haberes</span>' +
                  '<span class="ai-wf-val">' + sanitizeHTML(formatPesosMargen(bruto)) + '</span>' +
                  '<span class="ai-wf-sub">100% Haberes recibo</span>' +
                '</div>' +
                '<div class="ai-wf-item">' +
                  '<span class="ai-wf-label">(-) Descuentos SUBTOTAL_1</span>' +
                  '<span class="ai-wf-val text-rose-600">- ' + sanitizeHTML(formatPesosMargen(totalSub1)) + '</span>' +
                  '<span class="ai-wf-sub">Ley / Jubilación / OSER / Prioritarios</span>' +
                '</div>' +
                '<div class="ai-wf-item is-subtotal">' +
                  '<span class="ai-wf-label">(=) Subtotal1</span>' +
                  '<span class="ai-wf-val text-blue-800">' + sanitizeHTML(formatPesosMargen(subtotal1)) + '</span>' +
                  '<span class="ai-wf-sub">Bruto depurado</span>' +
                '</div>' +
                '<div class="ai-wf-item">' +
                  '<span class="ai-wf-label">(-) Tope Reserva (' + pctTopeNum + '%)</span>' +
                  '<span class="ai-wf-val text-rose-600">- ' + sanitizeHTML(formatPesosMargen(subtotalTope)) + '</span>' +
                  '<span class="ai-wf-sub">' + (esPasivo ? 'Pasivos: reserva 35%' : 'Activos: reserva 20%') + '</span>' +
                '</div>' +
                '<div class="ai-wf-item is-subtotal">' +
                  '<span class="ai-wf-label">(=) Subtotal2 (' + pctAfectNum + '%)</span>' +
                  '<span class="ai-wf-val text-blue-800">' + sanitizeHTML(formatPesosMargen(subtotal2)) + '</span>' +
                  '<span class="ai-wf-sub">Subtotal1 - Tope Reserva</span>' +
                '</div>' +
                '<div class="ai-wf-item">' +
                  '<span class="ai-wf-label">(-) No Computable</span>' +
                  '<span class="ai-wf-val text-amber-700">- ' + sanitizeHTML(formatPesosMargen(totalNoComp)) + '</span>' +
                  '<span class="ai-wf-sub">Sumas no remun. / Sal. fliar.</span>' +
                '</div>' +
                '<div class="ai-wf-item is-subtotal">' +
                  '<span class="ai-wf-label">(=) Afectable</span>' +
                  '<span class="ai-wf-val text-indigo-800">' + sanitizeHTML(formatPesosMargen(afectable)) + '</span>' +
                  '<span class="ai-wf-sub">Subtotal2 - No Computable</span>' +
                '</div>' +
                '<div class="ai-wf-item">' +
                  '<span class="ai-wf-label">(-) Afectado' + (cuotaRefAplicada > 0 ? ' efectivo' : '') + (cuotaFutura2 > 0 ? ' + Futura 2' : '') + '</span>' +
                  '<span class="ai-wf-val text-rose-600">- ' + sanitizeHTML(formatPesosMargen(round2Margen(totalAfectadoEfectivo + cuotaFutura2))) + '</span>' +
                  '<span class="ai-wf-sub">Recibo: ' + sanitizeHTML(formatPesosMargen(totalAfectado)) +
                    (cuotaRefAplicada > 0 ? (' · Cuota a liberar: -' + sanitizeHTML(formatPesosMargen(cuotaRefAplicada))) : '') +
                    (cuotaFutura2 > 0 ? (' · CF2: ' + sanitizeHTML(formatPesosMargen(cuotaFutura2))) : '') +
                  '</span>' +
                '</div>' +
                '<div class="ai-wf-item ' + (puedeOfrecer ? 'is-ok' : 'is-danger') + '">' +
                  '<span class="ai-wf-label">(=) Disponible Recibo' + (esFactor70 ? ' (× 70%)' : '') + '</span>' +
                  '<span class="ai-wf-val ' + (puedeOfrecer ? 'text-emerald-700' : 'text-rose-700') + '">' + sanitizeHTML(formatPesosMargen(disponibleRecibo)) + '</span>' +
                  '<span class="ai-wf-sub">' +
                    (cuotaRefAplicada > 0 ? ('Orig.: ' + sanitizeHTML(formatPesosMargen(dispOriginal)) + ' → ') : '') +
                    (esFactor70 ? ('Bruto 100%: ' + sanitizeHTML(formatPesosMargen(dispBruto)) + ' · ') : '') +
                    (puedeOfrecer ? '✅ Margen Real Positivo' : '🔴 SIN Disponible') +
                  '</span>' +
                '</div>' +
              '</div>' +

              '<div class="ai-debt-bar-wrap">' +
                '<div style="flex:1;min-width:240px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:0.72rem;">' +
                    '<span style="font-weight:700;color:#334155;">Tope Endeudamiento (41,67% Neto Líquido)</span>' +
                    '<strong class="font-mono" style="color:#1e3a8a;">' + sanitizeHTML(formatPesosMargen(topeEndeud)) + ' / mes</strong>' +
                  '</div>' +
                  '<div class="ai-debt-bar-track">' +
                    '<div class="ai-debt-bar-fill ' + (puedeOfrecer ? 'bg-emerald-500' : 'bg-rose-500') + '" style="width:' + ratioTope + '%"></div>' +
                  '</div>' +
                  '<div style="font-size:0.66rem;color:#64748b;margin-top:0.25rem;">' + sanitizeHTML(limitadoTxt) + (saldoExt > 0 ? (' · Saldo Externo descontado: ' + sanitizeHTML(formatPesosMargen(saldoExt))) : '') + '</div>' +
                '</div>' +
                '<div style="background:' + (puedeOfrecer ? '#ecfdf5' : '#fff1f2') + ';border:1px solid ' + (puedeOfrecer ? '#a7f3d0' : '#fecdd3') + ';border-radius:0.6rem;padding:0.45rem 0.75rem;text-align:right;">' +
                  '<span style="display:block;font-size:0.62rem;font-weight:800;text-transform:uppercase;color:' + (puedeOfrecer ? '#065f46' : '#9f1239') + ';">Cuota Máxima Segura</span>' +
                  '<strong class="font-mono" style="font-size:0.95rem;color:' + (puedeOfrecer ? '#047857' : '#be123c') + ';">' + (puedeOfrecer ? sanitizeHTML(formatPesosMargen(cuotaSegura)) : 'SIN Disponible') + '</strong>' +
                '</div>' +
              '</div>' +
            '</div>' +

            conclHtml +

            '<div class="bg-slate-50/90 rounded-xl p-4 border border-slate-200">' +
              '<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">' +
                '<div class="p-3 rounded-lg border ' + (puedeOfrecer && !embargoDetectado ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/50 border-rose-200') + '">' +
                  '<span class="block text-[11px] font-bold uppercase tracking-wider ' + (puedeOfrecer && !embargoDetectado ? 'text-emerald-900' : 'text-rose-900') + '">Dictamen Crediticio:</span>' +
                  '<p class="text-xs font-bold text-slate-900 mt-1 mb-0">' + sanitizeHTML(dictamenText) + '</p>' +
                '</div>' +
                '<div class="p-3 rounded-lg border ' + (puedeOfrecer && !embargoDetectado ? 'bg-indigo-50/70 border-indigo-200' : 'bg-rose-50/50 border-rose-200') + '">' +
                  '<span class="block text-[11px] font-bold uppercase tracking-wider ' + (puedeOfrecer && !embargoDetectado ? 'text-indigo-900' : 'text-rose-900') + '">Canal Sugerido:</span>' +
                  '<p class="text-xs font-bold text-slate-900 mt-1 mb-0">' + sanitizeHTML(canalSugerido) + '</p>' +
                '</div>' +
              '</div>' +
              (accionesHtml ? ('<div class="mt-3">' + accionesHtml + '</div>') : '') +
            '</div>'
          ) : accionesBoxSoloNonAdmin) +
        '</div>' +
      '</div>';
    }

    function renderizarAuditoriaYSimulador(rawJSON, renderOpts = {}) {
      const container = document.getElementById('aiAuditResultadosContainer');
      if (!container) return null;

      if (!(renderOpts && renderOpts.desdeRecalculoInteractivo)) {
        const regStored = rawJSON && (rawJSON.regimenOverride || (rawJSON.analisisMargen && rawJSON.analisisMargen.regimenOverride));
        _auditRegimenOverride = regStored ? String(regStored).trim().toUpperCase() : null;
        _auditCuotaFutura2 = Number(rawJSON && rawJSON.analisisMargen && rawJSON.analisisMargen.cuotaFutura2 || 0) || 0;
        const amStored = (rawJSON && rawJSON.analisisMargen) || {};
        _auditCuotaRefinanciar = Number(amStored.cuotaRefinanciar ?? rawJSON?.cuotaRefinanciar ?? rawJSON?.cuota_refinanciar ?? 0) || 0;
        _auditSaldoCancelar = Number(amStored.saldoCancelar ?? rawJSON?.saldoCancelar ?? rawJSON?.saldo_cancelar ?? 0) || 0;
        _auditSaldoVigenteExterno = Number(amStored.saldoVigenteExterno ?? rawJSON?.saldoVigenteExterno ?? rawJSON?.saldo_vigente_externo ?? 0) || 0;
        _auditDetalleRefinanciacion = String(amStored.detalleRefinanciacion ?? rawJSON?.detalleRefinanciacion ?? rawJSON?.detalle_refinanciacion ?? '').trim();
        const fmStored = Number(amStored.factorMargen ?? rawJSON?.factorMargen ?? rawJSON?.factor_margen ?? 1.0);
        _auditFactorMargen = (fmStored > 0 && fmStored <= 1.0) ? Number(fmStored.toFixed(4)) : 1.0;
      }

      const audit = normalizarResultadoAuditoriaIA(rawJSON);
      if (!audit) {
        mostrarBannerErrorAuditoria('La respuesta recibida no contiene datos salariales ni estructura válida de recibo.');
        return null;
      }
      const payload = (rawJSON && typeof rawJSON === 'object')
        ? (rawJSON.auditoria || rawJSON.resultado || rawJSON.data || rawJSON)
        : {};
      const r = audit.resumenDecision || payload.resumenDecision || payload.reciboSueldo || payload.liquidacion || payload || {};
      const d = audit.detalleCompletoRecibo || payload.detalleCompletoRecibo || payload.reciboSueldo || payload || {};
      const rec = audit.reciboSueldo || {};
      const am = audit.analisisMargen || {};

      const organismo = limpiarTextoAuditoria(r.organismo || r.empleador || rec.organismo || payload.organismo, 'Organismo Provincial');
      const conceptosClasif = clasificarConceptosReciboLocal(
        Array.isArray(d.conceptos) ? d.conceptos : (Array.isArray(rec.conceptos) ? rec.conceptos : (Array.isArray(payload.conceptos) ? payload.conceptos : [])),
        { lugarTrabajo: am.lugarTrabajo || r.lugarTrabajo, tipoBeneficiario: am.tipoBeneficiario, organismo: organismo }
      );
      const conceptos = conceptosClasif.rows;

      const bruto = parseNumeroSeguroAuditoria(
        am.totalHaberes ?? r.sueldoBrutoTotal ?? r.sueldoBruto ?? payload.sueldoBrutoTotal ?? d.totales?.totalHaberes ?? rec.sueldoBruto ?? conceptosClasif.sumHaberes
      ) ?? 0;
      const descuentos = Math.abs(parseNumeroSeguroAuditoria(
        am.totalDescuentos ?? r.totalDescuentos ?? r.totalDescuentosRecibo ?? payload.totalDescuentos ?? d.totales?.totalDescuentos ?? rec.totalDescuentosRecibo ?? conceptosClasif.sumDescuentos
      ) ?? 0);
      const liquido = parseNumeroSeguroAuditoria(
        am.netoLiquido ?? r.sueldoLiquido ?? r.sueldoNeto ?? payload.sueldoLiquido ?? d.totales?.liquidoAPagar ?? rec.sueldoNeto
      ) ?? round2Margen(bruto - descuentos);

      // PROHIBIDO renderizar resultados en $ 0,00 si falló la extracción salarial
      if (bruto <= 0 && liquido <= 0 && conceptos.length === 0) {
        mostrarBannerErrorAuditoria('El motor documental no devolvió haberes ni conceptos legibles del archivo adjunto. Verifique que el PDF o imagen corresponda a un recibo de sueldo nítido.');
        return null;
      }

      ocultarBannerErrorAuditoria();
      ultimoResultadoAuditoria = audit;
      window._offerOptsAuditoria = {
        saldoCancelar: Number(am.saldoCancelar || 0) || 0,
        saldoVigenteExterno: Number(am.saldoVigenteExterno || 0) || 0,
        cuotaRefinanciar: Number(am.cuotaRefinanciar || 0) || 0
      };

      const disponibleRecibo = parseNumeroSeguroAuditoria(
        am.disponibleRecibo ?? r.disponibleRecibo ?? r.margenDisponiblePlanilla ?? rec.margenDisponibleCuota
      ) ?? 0;
      const puedeOfrecerCuotas = (am.puedeOfrecerCuotas !== undefined)
        ? (Boolean(am.puedeOfrecerCuotas) && disponibleRecibo > 0)
        : (disponibleRecibo > 0);
      const topeEndeud = parseNumeroSeguroAuditoria(am.topeEndeudamientoMensual4167) ?? round2Margen((5 * Math.max(0, liquido)) / 12);
      const cuotaSegura = parseNumeroSeguroAuditoria(am.cuotaMaximaSeguraGeneral ?? r.cuotaMaximaSeguraGeneral) ?? (puedeOfrecerCuotas ? round2Margen(Math.min(disponibleRecibo, topeEndeud)) : 0);

      const embargoDetectado = Boolean(
        r.embargosJudiciales || payload.embargosJudiciales || rec.embargoDetectado || (parseNumeroSeguroAuditoria(rec.embargoMonto) || 0) > 0 || conceptosClasif.calcEmbargo > 0
      );
      const embargoMonto = parseNumeroSeguroAuditoria(rec.embargoMonto) || conceptosClasif.calcEmbargo || 0;

      const descLey = parseNumeroSeguroAuditoria(am.totalSubtotal1Desc ?? r.totalSubtotal1Desc ?? r.descuentosLey ?? payload.descuentosLey ?? rec.descuentosLey) ?? conceptosClasif.calcLey ?? 0;
      const descBersa = parseNumeroSeguroAuditoria(r.consumosBersa ?? payload.consumosBersa ?? rec.consumosBersa) ?? conceptosClasif.calcBersa ?? 0;
      const descSidecreer = parseNumeroSeguroAuditoria(r.consumosSidecreer ?? payload.consumosSidecreer ?? rec.consumosSidecreer) ?? conceptosClasif.calcSidecreer ?? 0;
      const descMutuales = parseNumeroSeguroAuditoria(r.otrasMutualesOProveeduria ?? r.otrasMutuales ?? payload.otrasMutuales ?? rec.otrasMutuales) ?? conceptosClasif.calcMutuales ?? 0;
      const descFedem = parseNumeroSeguroAuditoria(r.consumosFedem ?? payload.consumosFedem ?? rec.codigosFedemMonto) ?? conceptosClasif.calcFedem ?? 0;
      const fedemDetectados = Array.isArray(rec.codigosFedemDetectados) && rec.codigosFedemDetectados.length > 0
        ? rec.codigosFedemDetectados
        : conceptosClasif.fedemCodes;

      const esAdmin = esAdminAuditoria();
      const recibosIndiv = Array.isArray(audit.recibosIndividuales)
        ? audit.recibosIndividuales
        : (Array.isArray(payload.recibosIndividuales) ? payload.recibosIndividuales : []);
      const esMultiRecibo = recibosIndiv.length > 1;
      let desgloseMultiRecibosHtml = '';
      if (esMultiRecibo) {
        desgloseMultiRecibosHtml =
          '<div class="mb-5">' +
            '<p class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">' +
              '📑 Desglose Individual por Recibo (' + recibosIndiv.length + ' empleos / establecimientos)' +
            '</p>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
              recibosIndiv.map(ri => {
                const orgCard = limpiarTextoAuditoria(ri.organismo, 'Organismo Provincial');
                const catCard = ri.categoria ? (' · Cat. ' + sanitizeHTML(ri.categoria)) : '';
                const legCard = ri.legajo ? (' · Leg. ' + sanitizeHTML(ri.legajo)) : '';
                return '<div class="p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/30">' +
                  '<div class="flex items-start justify-between gap-2 mb-2">' +
                    '<div>' +
                      '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 mb-1">Recibo #' + ri.indice + ' · ' + sanitizeHTML(ri.archivoNombre || ('Comprobante ' + ri.indice)) + '</span>' +
                      '<div class="text-xs font-bold text-slate-900">' + sanitizeHTML(orgCard) + '</div>' +
                      '<div class="text-[11px] text-slate-600">' + sanitizeHTML(ri.cargo || 'Agente / Activo') + catCard + legCard + '</div>' +
                    '</div>' +
                    '<span class="font-mono text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">' + sanitizeHTML(ri.periodo || 'Mes auditado') + '</span>' +
                  '</div>' +
                  '<div class="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-100 text-xs">' +
                    '<div><span class="block text-[10px] text-slate-500">Haberes</span><strong class="font-mono text-emerald-700">' + sanitizeHTML(formatPesosMargen(ri.sueldoBrutoTotal || 0)) + '</strong></div>' +
                    '<div><span class="block text-[10px] text-slate-500">Retenciones</span><strong class="font-mono text-rose-700">' + sanitizeHTML(formatPesosMargen(ri.totalDescuentos || 0)) + '</strong></div>' +
                    '<div><span class="block text-[10px] text-slate-500">Líquido</span><strong class="font-mono text-slate-900">' + sanitizeHTML(formatPesosMargen(ri.sueldoLiquido || 0)) + '</strong></div>' +
                  '</div>' +
                  '<div class="mt-1.5 text-[10px] text-slate-500 flex items-center justify-between gap-2">' +
                    '<span>Antigüedad: <strong>' + sanitizeHTML(ri.antiguedad || 'No registrada') + '</strong></span>' +
                    (ri.embargosJudiciales ? '<span class="text-rose-700 font-bold">⚠️ Embargo detectado</span>' : '') +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>';
      }

      let conceptosHTML = '';
      if (conceptos.length > 0) {
        conceptosHTML = conceptos.map((c, idx) => {
          const haber = c.haberes > 0 ? c.haberes : 0;
          const desc = c.descuentos > 0 ? c.descuentos : 0;
          const badgeClasif = (typeof renderBadgeClasificacionPadron === 'function')
            ? renderBadgeClasificacionPadron(c.clasificacion, c.metodoClasificacion, c.lugarPadronMatch)
            : '<span class="ai-clasif-badge clasif-sin-clasif">' + sanitizeHTML(c.clasificacion || '—') + '</span>';
          const esManual = c.metodoClasificacion === 'EXPLICITA_NORMALIZADA' && c.lugarPadronMatch === 'MANUAL';
          const selVal = esManual ? (c.clasificacion || 'AUTO') : 'AUTO';
          const selectOverride = esAdmin
            ? ('<select aria-label="Reclasificar ítem" title="Ajustar clasificación manualmente" onchange="cambiarClasificacionItemAuditoria(' + idx + ', this.value)" style="margin-left:6px;font-size:0.65rem;padding:1px 4px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#475569;cursor:pointer;">' +
                '<option value="AUTO"' + (selVal === 'AUTO' ? ' selected' : '') + '>Auto</option>' +
                '<option value="COMPUTABLE"' + (selVal === 'COMPUTABLE' ? ' selected' : '') + '>Computable</option>' +
                '<option value="NO_COMPUTABLE"' + (selVal === 'NO_COMPUTABLE' ? ' selected' : '') + '>No Computable</option>' +
                '<option value="SUBTOTAL_1"' + (selVal === 'SUBTOTAL_1' ? ' selected' : '') + '>Subtotal 1</option>' +
                '<option value="AFECTADO"' + (selVal === 'AFECTADO' ? ' selected' : '') + '>Afectado</option>' +
              '</select>')
            : '';
          const origenPill = (esMultiRecibo && c.origenRecibo)
            ? (' <span class="inline-block ml-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">' + sanitizeHTML(c.origenRecibo) + '</span>')
            : '';
          return '<tr class="border-b border-slate-100 hover:bg-slate-50/80">' +
            '<td class="py-2.5 px-3 font-mono text-xs font-semibold text-slate-600">' + sanitizeHTML(c.codigo || '—') + '</td>' +
            '<td class="py-2.5 px-3 text-xs font-medium text-slate-800">' + sanitizeHTML(c.descripcion || 'Concepto liquidado') + origenPill + '</td>' +
            '<td class="py-2.5 px-3 font-mono text-xs text-right font-semibold ' + (haber > 0 ? 'text-emerald-700' : 'text-slate-300') + '">' +
              (haber > 0 ? sanitizeHTML(formatPesosMargen(haber)) : '—') +
            '</td>' +
            '<td class="py-2.5 px-3 font-mono text-xs text-right font-semibold ' + (desc > 0 ? 'text-rose-700' : 'text-slate-300') + '">' +
              (desc > 0 ? sanitizeHTML(formatPesosMargen(desc)) : '—') +
            '</td>' +
            (esAdmin ? ('<td class="py-2.5 px-3 text-left whitespace-nowrap">' + badgeClasif + selectOverride + '</td>') : '') +
          '</tr>';
        }).join('');
      } else {
        conceptosHTML = '<tr class="border-b border-slate-100">' +
          '<td class="py-2.5 px-3 font-mono text-xs text-slate-400">—</td>' +
          '<td class="py-2.5 px-3 text-xs text-slate-500">Totales consolidados extraídos del comprobante adjunto</td>' +
          '<td class="py-2.5 px-3 font-mono text-xs text-right font-semibold text-emerald-700">' + sanitizeHTML(formatPesosMargen(bruto)) + '</td>' +
          '<td class="py-2.5 px-3 font-mono text-xs text-right font-semibold text-rose-700">' + sanitizeHTML(formatPesosMargen(descuentos)) + '</td>' +
          (esAdmin ? '<td class="py-2.5 px-3 text-xs text-slate-400">Resumen</td>' : '') +
        '</tr>';
      }

      const accionesExpedienteHtml =
        '<div class="pt-3 mt-4 border-t border-slate-200">' +
          '<div class="flex flex-wrap justify-end gap-2">' +
            (idExpedienteAuditadoActivo
              ? '<button type="button" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-150 cursor-pointer" onclick="aplicarDatosExtraidosAlExpediente()">Aplicar Datos al Expediente</button>'
              : '') +
            '<button type="button" id="btnAbrirNuevoExpedienteAudit" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-150 cursor-pointer" onclick="abrirNuevoExpedienteDesdeAuditoria()">➕ Abrir Nuevo Expediente</button>' +
            '<button type="button" id="btnGuardarDictamenBitacora" class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-900 hover:from-indigo-800 hover:to-indigo-950 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-150 cursor-pointer" onclick="guardarDictamenEnBitacoraExpediente()">💾 Guardar Dictamen en Bitácora del Expediente</button>' +
          '</div>' +
          '<div id="selectorExpedienteBitacoraInline" class="hidden mt-3 p-3 rounded-lg border border-slate-200 bg-white"></div>' +
        '</div>';

      // BLOQUE 2 (CONDICIONAL · SOLO ADMIN): Cortafuegos estricto SIN Disponible vs Ofertas Seguras por Plazo
      let bloqueSimulacionHtml = '';
      if (esAdmin) {
        if (!puedeOfrecerCuotas || disponibleRecibo <= 0 || am.estado === 'SIN_DISPONIBLE') {
          window._cuotaMaximaAuditoria = 0;
          window._netoLiquidoAuditoria = liquido;
          bloqueSimulacionHtml =
            '<div class="ai-sin-disponible-banner font-sans antialiased">' +
              '<div class="flex items-start justify-between gap-3 flex-wrap">' +
                '<div>' +
                  '<div class="text-sm font-black tracking-tight" style="display:flex;align-items:center;gap:6px;">🔴 SIN Disponible — Simulación Automática de Cuotas Bloqueada</div>' +
                  '<p class="text-xs font-medium mt-1 mb-0" style="line-height:1.45;">' +
                    'El margen afectable real del recibo es negativo o nulo (<strong>Disponible Recibo: ' + sanitizeHTML(formatPesosMargen(disponibleRecibo)) + '</strong>' +
                    ' = Afectable ' + sanitizeHTML(formatPesosMargen(am.afectable ?? 0)) +
                    ' − Afectado efectivo ' + sanitizeHTML(formatPesosMargen(am.totalAfectadoEfectivo ?? am.totalAfectado ?? 0)) +
                    (am.cuotaFutura2 > 0 ? (' − Cuota Futura 2 ' + sanitizeHTML(formatPesosMargen(am.cuotaFutura2))) : '') + '). ' +
                    'Por regla de corte reglamentaria no se habilitan ofertas de cuotas ni se aplica cálculo estimativo sobre el neto líquido.' +
                  '</p>' +
                '</div>' +
                '<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-white text-rose-700 border border-rose-200 font-mono">SIN Disponible (' + sanitizeHTML(formatPesosMargen(disponibleRecibo)) + ')</span>' +
              '</div>' +
            '</div>';
        } else {
          const orgUpper = String(organismo || '').toUpperCase();
          const lineaInicial = (orgUpper.includes('MUNICIP') || orgUpper.includes('QUAD')) ? 'QUAD' : 'FEDEM';

          window._cuotaMaximaAuditoria = disponibleRecibo;
          window._cuotaSeguraMaxAuditoria = cuotaSegura > 0 ? cuotaSegura : disponibleRecibo;
          _auditCuotaPersonalizada = 0;
          window._offerOptsAuditoria = Object.assign({}, window._offerOptsAuditoria || {}, { cuotaPersonalizada: 0 });
          window._netoLiquidoAuditoria = liquido;
          window._lineaAuditoriaSugerida = lineaInicial;

          const isFedem = lineaInicial === 'FEDEM';
          const isQuad = lineaInicial === 'QUAD';
          const isSidecreer = lineaInicial === 'SIDECREER';

          const tabActiveCls = 'tab-linea-auditoria px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 bg-white text-indigo-950 shadow-sm border border-slate-200/50';
          const tabInactiveCls = 'tab-linea-auditoria px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all duration-150 text-slate-600 hover:text-slate-900 hover:bg-white/60';

          const filasPlanesHtml = renderizarFilasPlanesAuditoria(disponibleRecibo, lineaInicial, liquido);
          const alertaEmbargoSim = embargoDetectado
            ? '<div class="ai-valid-alerts-box mb-4">⚠️ <strong>Atención Embargo Judicial Detectado (' + sanitizeHTML(formatPesosMargen(embargoMonto)) + '):</strong> Verifique vigencia o levantamiento antes de pre-cargar una solicitud.</div>'
            : '';
          const saldoCancSim = Number(am.saldoCancelar || 0) || 0;
          const saldoExtSim = Number(am.saldoVigenteExterno || 0) || 0;

          bloqueSimulacionHtml =
            '<!-- BLOQUE 2 (CONDICIONAL): SIMULACIÓN DE AYUDA ECONÓMICA SUGERIDA -->' +
            '<div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 mb-6 font-sans antialiased">' +
              '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">' +
                '<div>' +
                  '<h2 class="text-base font-bold text-slate-900 tracking-tight m-0">' +
                    '⚡ Simulación de Ayuda Económica Sugerida' +
                  '</h2>' +
                  '<p class="text-xs text-slate-500 font-normal mt-1 mb-0">' +
                    'Oferta máxima por plazo acotada por min(Disponible Recibo, Tope Endeudamiento 41,67% Neto Líquido' + (saldoExtSim > 0 ? ' − Saldo Vigente' : '') + ')' +
                  '</p>' +
                '</div>' +
                '<div class="flex items-center gap-2 flex-wrap">' +
                  '<span id="badgeCuotaSeguraSim" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono">' +
                    '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' +
                    'Cuota Segura Máx.: ' + sanitizeHTML(formatPesosMargen(cuotaSegura)) + ' / mes' +
                  '</span>' +
                  '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-indigo-50 text-indigo-800 border-indigo-200 font-mono">' +
                    'Disponible: ' + sanitizeHTML(formatPesosMargen(disponibleRecibo)) + ' · Tope 41,67%: ' + sanitizeHTML(formatPesosMargen(topeEndeud)) +
                  '</span>' +
                  (saldoCancSim > 0
                    ? ('<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-200 font-mono">Saldo Cancelar: ' + sanitizeHTML(formatPesosMargen(saldoCancSim)) + '</span>')
                    : '') +
                  (saldoExtSim > 0
                    ? ('<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-800 border-rose-200 font-mono">Saldo Vigente Ext.: ' + sanitizeHTML(formatPesosMargen(saldoExtSim)) + '</span>')
                    : '') +
                '</div>' +
              '</div>' +

              alertaEmbargoSim +

              '<div class="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50">' +
                '<label for="inputAuditCuotaPersonalizada" class="text-xs font-bold text-slate-700">Cuota deseada ($)</label>' +
                '<input id="inputAuditCuotaPersonalizada" type="text" inputmode="decimal" placeholder="Máx. ' + sanitizeHTML(formatPesosMargen(cuotaSegura)) + '" onkeydown="if(event.key===\'Enter\'){aplicarCuotaPersonalizadaAuditoria();}" class="w-44 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono bg-white" />' +
                '<button type="button" onclick="aplicarCuotaPersonalizadaAuditoria()" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">Simular</button>' +
                '<button type="button" id="btnLimpiarCuotaPersSim" onclick="limpiarCuotaPersonalizadaAuditoria()" style="display:none" class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold">Restablecer al máximo</button>' +
                '<span class="text-[11px] text-slate-500">Ingresá una cuota menor o igual a la máxima segura para simular un monto menor.</span>' +
              '</div>' +

              '<!-- Selector de Línea Crediticia (Tabs / Píldoras Modernas) -->' +
              '<div class="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 mb-5">' +
                '<button type="button" onclick="cambiarLineaAuditoria(\'FEDEM\')" id="tabLineaFEDEM" class="' + (isFedem ? tabActiveCls : tabInactiveCls) + '">' +
                  '🏛️ FEDEM Provincial' +
                '</button>' +
                '<button type="button" onclick="cambiarLineaAuditoria(\'QUAD\')" id="tabLineaQUAD" class="' + (isQuad ? tabActiveCls : tabInactiveCls) + '">' +
                  '🏢 QUAD Municipales' +
                '</button>' +
                '<button type="button" onclick="cambiarLineaAuditoria(\'SIDECREER\')" id="tabLineaSidecreer" class="' + (isSidecreer ? tabActiveCls : tabInactiveCls) + '">' +
                  '💳 Convenio Sidecreer' +
                '</button>' +
              '</div>' +

              '<!-- Tabla de Simulación Sugerida: Orden exacto Monto a Entregar | Cantidad de Cuotas | Monto de Cuota | Acción -->' +
              '<div class="overflow-x-auto rounded-lg border border-slate-200">' +
                '<table class="w-full text-left border-collapse font-sans text-slate-700">' +
                  '<thead class="bg-slate-50 border-b border-slate-200">' +
                    '<tr>' +
                      '<th class="py-3 px-4 text-[11px] font-bold text-emerald-700 uppercase whitespace-nowrap">Monto a Entregar</th>' +
                      '<th class="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap">Cantidad de Cuotas</th>' +
                      '<th class="py-3 px-4 text-[11px] font-bold text-slate-700 uppercase text-right whitespace-nowrap">Monto de Cuota</th>' +
                      '<th class="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase text-right whitespace-nowrap">Acción</th>' +
                    '</tr>' +
                  '</thead>' +
                  '<tbody id="tbodyPlanesAuditoria" class="divide-y divide-slate-100 font-sans text-slate-700">' +
                    filasPlanesHtml +
                  '</tbody>' +
                '</table>' +
              '</div>' +
            '</div>';
        }
      }

      const radiografiaHtml = esAdmin
        ? ('<div class="mb-5">' +
            '<p class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">' +
              'A. Radiografía de Retenciones y Controles Reglamentarios' +
            '</p>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 gap-3">' +
              '<div class="p-3 rounded-lg border border-slate-100 bg-slate-50">' +
                '<span class="block text-[11px] font-semibold text-slate-500">Descuentos SUBTOTAL_1 (Prioritarios / Ley)</span>' +
                '<span class="font-mono text-sm font-bold text-slate-900">' + sanitizeHTML(formatPesosMargen(descLey)) + '</span>' +
                '<span class="block text-[10px] text-slate-400 mt-0.5">Jubilación, Obra Social OSER y Seguros</span>' +
              '</div>' +
              '<div class="p-3 rounded-lg border border-slate-100 bg-slate-50">' +
                '<span class="block text-[11px] font-semibold text-slate-500">Bancos / BERSA y Sidecreer (AFECTADO)</span>' +
                '<span class="font-mono text-sm font-bold text-slate-900">' + sanitizeHTML(formatPesosMargen(descBersa + descSidecreer)) + '</span>' +
                '<span class="block font-mono text-[10px] text-slate-400 mt-0.5">BERSA: ' + sanitizeHTML(formatPesosMargen(descBersa)) + ' · Sidecreer: ' + sanitizeHTML(formatPesosMargen(descSidecreer)) + '</span>' +
              '</div>' +
              '<div class="p-3 rounded-lg border border-slate-100 bg-slate-50">' +
                '<span class="block text-[11px] font-semibold text-slate-500">Mutuales / Proveeduría / FEDEM</span>' +
                '<span class="font-mono text-sm font-bold text-slate-900">' + sanitizeHTML(formatPesosMargen(descMutuales + descFedem)) + '</span>' +
                '<span class="block text-[10px] text-slate-400 mt-0.5">' + (fedemDetectados.length > 0 ? ('FEDEM: ' + sanitizeHTML(fedemDetectados.join(', '))) : 'Sin códigos FEDEM previos · Embargos: ' + (embargoDetectado ? ('SÍ (' + sanitizeHTML(formatPesosMargen(embargoMonto)) + ')') : 'NO')) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>')
        : ('<div class="mb-5">' +
            '<p class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">' +
              'A. Resumen General de Haberes y Retenciones' +
            '</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
              '<div class="p-3 rounded-lg border border-slate-100 bg-slate-50">' +
                '<span class="block text-[11px] font-semibold text-slate-500">Total Haberes (Bruto)</span>' +
                '<span class="font-mono text-sm font-bold text-emerald-700">' + sanitizeHTML(formatPesosMargen(bruto)) + '</span>' +
              '</div>' +
              '<div class="p-3 rounded-lg border border-slate-100 bg-slate-50">' +
                '<span class="block text-[11px] font-semibold text-slate-500">Total Descuentos / Retenciones</span>' +
                '<span class="font-mono text-sm font-bold text-rose-700">' + sanitizeHTML(formatPesosMargen(descuentos)) + '</span>' +
              '</div>' +
              '<div class="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70">' +
                '<span class="block text-[11px] font-semibold text-emerald-800">Líquido a Pagar (Neto)</span>' +
                '<span class="font-mono text-sm font-bold text-emerald-900">' + sanitizeHTML(formatPesosMargen(liquido)) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>');

      const html =
        '<div class="space-y-6 text-slate-800">' +
          '<!-- BLOQUE 1: RESUMEN EJECUTIVO: AUDITORÍA DOCUMENTAL Y CREDITICIA AMMER -->' +
          generarTarjetaResumenEjecutivoAMMER(audit, accionesExpedienteHtml) +

          bloqueSimulacionHtml +

          '<!-- BLOQUE 3: INFORME COMPLETO DE AUDITORÍA DOCUMENTAL Y SALARIAL -->' +
          '<div class="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 mb-6 font-sans antialiased">' +
            '<div class="border-b border-slate-100 pb-3 mb-4">' +
              '<h2 class="text-base font-bold text-slate-900 tracking-tight">' +
                (esAdmin ? '2. Informe Completo de Auditoría Documental y Salarial' : 'Informe Completo de Auditoría (Detalle del Recibo)') +
              '</h2>' +
            '</div>' +

            radiografiaHtml +

            desgloseMultiRecibosHtml +

            '<!-- B. Desglose Exhaustivo de Conceptos (Recibo Literal y Padrón) -->' +
            '<div>' +
              '<p class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">' +
                (esAdmin ? 'B. Desglose Exhaustivo de Conceptos (Recibo Literal y Clasificación Padrón)' : 'B. Detalle Completo del Recibo') +
              '</p>' +
              '<div class="overflow-x-auto rounded-lg border border-slate-200">' +
                '<table class="w-full text-left">' +
                  '<thead class="bg-slate-50 border-b border-slate-200">' +
                    '<tr>' +
                      '<th class="py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase w-16">Cód.</th>' +
                      '<th class="py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase">Descripción del Concepto</th>' +
                      '<th class="py-2.5 px-3 text-[11px] font-bold text-emerald-700 uppercase text-right">Haberes ($)</th>' +
                      '<th class="py-2.5 px-3 text-[11px] font-bold text-rose-700 uppercase text-right">Descuentos ($)</th>' +
                      (esAdmin ? '<th class="py-2.5 px-3 text-[11px] font-bold text-slate-500 uppercase">Clasificación</th>' : '') +
                    '</tr>' +
                  '</thead>' +
                  '<tbody class="divide-y divide-slate-100">' +
                    conceptosHTML +
                  '</tbody>' +
                  '<tfoot class="bg-slate-50 border-t-2 border-slate-300">' +
                    '<tr>' +
                      '<td colspan="2" class="py-2.5 px-3 text-xs font-extrabold text-slate-800">TOTALES CONSOLIDADOS (BRUTO / RETENCIONES)</td>' +
                      '<td class="py-2.5 px-3 font-mono text-xs font-black text-emerald-700 text-right">' + sanitizeHTML(formatPesosMargen(bruto)) + '</td>' +
                      '<td class="py-2.5 px-3 font-mono text-xs font-black text-rose-700 text-right">' + sanitizeHTML(formatPesosMargen(descuentos)) + '</td>' +
                      (esAdmin ? '<td class="py-2.5 px-3"></td>' : '') +
                    '</tr>' +
                    '<tr class="bg-emerald-50 border-t border-emerald-200">' +
                      '<td colspan="2" class="py-3 px-3 text-sm font-black text-emerald-800">LÍQUIDO A PAGAR (NETO FINAL EN BOLSILLO)</td>' +
                      '<td colspan="' + (esAdmin ? '3' : '2') + '" class="py-3 px-3 font-mono text-base font-black text-emerald-800 text-right">' + sanitizeHTML(formatPesosMargen(liquido)) + '</td>' +
                    '</tr>' +
                  '</tfoot>' +
                '</table>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.innerHTML = html;
      container.style.display = 'block';
      try {
        const dniExtraido = String(r.dni || rec.dni || d.dni || payload.dni || '').replace(/\D/g, '').trim();
        const inpBol = document.getElementById('inputBoletinDniConsulta');
        if (dniExtraido && inpBol && !inpBol.value.trim()) {
          inpBol.value = dniExtraido;
          actualizarLinkDateasBoletin();
        }
        if (typeof registrarReciboEnAuditoria20 === 'function') {
          registrarReciboEnAuditoria20(audit);
        }
      } catch (_) {}
      if (typeof container.scrollIntoView === 'function') {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return audit;
    }

    // [ETAPA 5] Módulo Boletín Oficial ER extraído en js/boletinER.js

    function renderizarAuditoriaExitosa(rawJSON) {
      return renderizarAuditoriaYSimulador(rawJSON);
    }

    function renderResultadosAuditoria(rawJSON) {
      return renderizarAuditoriaYSimulador(rawJSON);
    }

    function mostrarLoaderAuditoria(mensaje = 'Analizando recibo oficial de Entre Ríos...') {
      const loadBar = document.getElementById('aiAuditLoadingBar');
      const stageText = document.getElementById('aiAuditStageText');
      const loaderIA = document.getElementById('loader-auditoria-ia');
      if (stageText) stageText.textContent = mensaje;
      if (loadBar) loadBar.style.display = 'block';
      if (loaderIA) loaderIA.classList.add('hidden');
    }

    function ocultarLoaderAuditoria() {
      const loadBar = document.getElementById('aiAuditLoadingBar');
      const loaderIA = document.getElementById('loader-auditoria-ia');
      if (loadBar) loadBar.style.display = 'none';
      if (loaderIA) loaderIA.classList.add('hidden');
    }

    function mostrarErrorAuditoria(msg) {
      mostrarBannerErrorAuditoria(msg || 'No se pudo completar la lectura documental.');
    }

    function renderizarInformeAuditoriaIA(audit) {
      return renderizarAuditoriaYSimulador(audit);
    }

    // 2. Enviar comprobante al backend (Apps Script o servidor institucional)
    async function enviarReciboABackend(file) {
      if (!file) {
        mostrarBannerErrorAuditoria('Seleccione o arrastre un Recibo de Sueldo en formato PDF, PNG o JPG.');
        mostrarNotificacionToast('Seleccione un comprobante válido para auditar.', 'error');
        return null;
      }

      if (typeof file === 'object' && typeof file.size === 'number' && file.size < 5120) {
        const msgDanado = '⚠️ El archivo seleccionado parece estar vacío o dañado (pesa menos de 5 KB). Por favor, suba un comprobante válido.';
        mostrarBannerErrorAuditoria(msgDanado);
        mostrarNotificacionToast(msgDanado, 'error');
        return null;
      }

      if (typeof file === 'object' && typeof file.size === 'number' && file.size > 15 * 1024 * 1024) {
        const msgMax = 'El archivo seleccionado supera el tamaño máximo permitido de 15 MB.';
        mostrarBannerErrorAuditoria(msgMax);
        mostrarNotificacionToast(msgMax, 'error');
        return null;
      }

      const resCont = document.getElementById('aiAuditResultadosContainer');
      if (resCont) {
        resCont.style.display = 'none';
        resCont.innerHTML = '';
      }
      ocultarBannerErrorAuditoria();
      _auditRegimenOverride = null;
      _auditCuotaFutura2 = 0;
      resetearParametrosRefinanciacionAuditoria();

      const sizeKb = (typeof file === 'object' && typeof file.size === 'number')
        ? Math.max(1, Math.round(file.size / 1024))
        : 0;
      mostrarLoaderAuditoria(
        sizeKb > 0
          ? ('Analizando comprobante (' + sizeKb + ' KB) en el motor documental AMMER...')
          : 'Analizando comprobante en el motor documental AMMER...'
      );

      try {
        const fileName = (typeof file === 'object' && (file.name || file.nombre))
          ? String(file.name || file.nombre)
          : 'recibo_haberes.pdf';
        const mimeEntrada = (typeof file === 'object' && (file.type || file.mimeType))
          ? String(file.type || file.mimeType).toLowerCase()
          : '';
        const esPdf = mimeEntrada === 'application/pdf' ||
          mimeEntrada.includes('pdf') ||
          fileName.toLowerCase().endsWith('.pdf');
        const mimeFinal = esPdf
          ? 'application/pdf'
          : (mimeEntrada.includes('png') ? 'image/png' : (mimeEntrada.includes('webp') ? 'image/webp' : 'image/jpeg'));

        // 1. Obtener el Base64 limpio sin el prefijo data:...;base64,
        const base64Data = await obtenerBase64Limpio(file);
        if (!base64Data || base64Data.trim().length === 0) {
          throw new Error('No se recibió el archivo en Base64 (fileBase64) para ejecutar la auditoría OCR.');
        }

        const archivoPayload = {
          nombre: fileName,
          fileName: fileName,
          nombreArchivo: fileName,
          mimeType: mimeFinal,
          tipoMime: mimeFinal,
          base64: base64Data,
          fileBase64: base64Data,
          base64Archivo: base64Data,
          textoExtraido: ''
        };

        archivosAuditoriaCola = [archivoPayload];
        renderListaArchivosAuditoriaPills();

        const auditoria = await procesarAuditoriaConTimeout([archivoPayload], {
          idSolicitud: idExpedienteAuditadoActivo || 'DOCUMENTOS_SUELTOS',
          datosDeclarados: null,
          preservarLoadingBar: true,
          timeoutMs: 90000
        });

        if (!auditoria) {
          throw new Error(window._ultimaErrorAuditoriaIA || 'El motor documental no devolvió un dictamen legible.');
        }

        const okRendered = renderizarAuditoriaExitosa(auditoria);
        if (!okRendered) {
          return null;
        }
        mostrarNotificacionToast('Auditoría completada exitosamente.', 'success');
        return okRendered;
      } catch (err) {
        const msgErr = err && err.message ? err.message : String(err);
        console.error('Fallo crítico en auditoría:', err);
        mostrarBannerErrorAuditoria(msgErr);
        mostrarNotificacionToast('Aviso de Auditoría: ' + msgErr, 'error');
        return null;
      } finally {
        ocultarLoaderAuditoria();
      }
    }

    async function auditarReciboUniversal(file) {
      return enviarReciboABackend(file);
    }

    async function procesarReciboUnico(file) {
      return enviarReciboABackend(file);
    }

    async function auditarReciboDocumental(file) {
      return enviarReciboABackend(file);
    }

    async function ejecutarAuditoriaDocumental(base64Data, tipoMime = 'application/pdf') {
      if (base64Data && typeof base64Data === 'object' && (typeof base64Data.arrayBuffer === 'function' || base64Data.base64 || base64Data.textoExtraido)) {
        return auditarReciboDocumental(base64Data);
      }
      return auditarReciboDirectoGemini(base64Data, tipoMime);
    }

    async function auditarReciboDirectoGemini(base64Data, mimeType = 'application/pdf') {
      if (base64Data && typeof base64Data === 'object' && (typeof base64Data.arrayBuffer === 'function' || base64Data.base64 || base64Data.textoExtraido)) {
        return auditarReciboDocumental(base64Data);
      }
      const esPdfStr = String(mimeType || 'application/pdf').toLowerCase().includes('pdf');
      return auditarReciboDocumental({
        nombre: esPdfStr ? 'recibo_haberes.pdf' : 'recibo_haberes.jpg',
        mimeType: mimeType || 'application/pdf',
        base64: String(base64Data || '')
      });
    }

    async function auditarReciboConIA(archivoBase64, tipoMime = 'application/pdf') {
      return auditarReciboDirectoGemini(archivoBase64, tipoMime);
    }

    function aplicarDatosExtraidosAlExpediente() {
      if (!idExpedienteAuditadoActivo || !ultimoResultadoAuditoria) {
        showToast('No hay expediente o dictamen activo para aplicar.');
        return;
      }
      const all = getStoredSolicitudes();
      const s = all.find(x => String(x.id) === String(idExpedienteAuditadoActivo));
      if (!s) return;

      const rec = ultimoResultadoAuditoria.reciboSueldo || {};
      const dni = ultimoResultadoAuditoria.dni || {};
      const esLegible = (v) => v && !String(v).toUpperCase().includes('ILEGIBLE');

      if (!s.solicitante) s.solicitante = {};
      if (esLegible(rec.dni)) s.solicitante.dni = rec.dni;
      else if (esLegible(dni.numero)) s.solicitante.dni = dni.numero;
      if (esLegible(rec.cuil)) s.solicitante.cuil = rec.cuil;
      if (esLegible(rec.titular)) s.solicitante.nombre = rec.titular;
      else if (esLegible(dni.nombreCompleto)) s.solicitante.nombre = dni.nombreCompleto;
      if (esLegible(dni.domicilio)) s.solicitante.domicilio = dni.domicilio;
      if (esLegible(rec.dependencia)) s.solicitante.dependencia = rec.dependencia;
      if (esLegible(rec.organismo)) {
        s.solicitante.organismo = rec.organismo.toLowerCase().includes('muni') ? 'Municipal' : 'Provincial';
      }
      if (esLegible(rec.situacionRevista)) {
        s.solicitante.situacionRevista = rec.situacionRevista;
        s.solicitante.cargo = rec.situacionRevista.toLowerCase().includes('suplente') ? 'Suplente' : 'Titular';
      }
      if (rec.sueldoNeto !== null && rec.sueldoNeto !== undefined) {
        s.solicitante.sueldoNetoAuditor = rec.sueldoNeto;
      }

      saveStoredSolicitudes(all);
      sincronizarConBackend(true);
      showToast('✅ Datos legibles sincronizados en el expediente.');
      renderModuloMutual();
    }

    async function auditarReciboUnificado(file) {
      return procesarReciboUnico(file);
    }

    function construirPayloadBitacoraAuditoria(auditObj) {
      const audit = normalizarResultadoAuditoriaIA(auditObj) || auditObj || {};
      const r = audit.resumenDecision || {};
      const rec = audit.reciboSueldo || {};
      const sc = audit.scoringCrediticio || {};
      const am = audit.analisisMargen || {};
      const concl = audit.conclusionesRecomendaciones || null;
      const ofertasMap = audit.ofertasPorPlazo || { fedem: [], muni: [], sidecreer: [] };

      const titular = limpiarTextoAuditoria(r.titular || rec.titular, 'No especificado');
      const dni = limpiarTextoAuditoria(r.dni || rec.dni, 'No especificado');
      const cuil = limpiarTextoAuditoria(r.cuil || rec.cuil, '');
      const organismo = limpiarTextoAuditoria(r.organismo || rec.organismo, 'Organismo Provincial');
      const cargo = limpiarTextoAuditoria(r.cargo || rec.escalafonCargo || rec.situacionRevista, 'Agente / Activo');
      const periodo = limpiarTextoAuditoria(r.periodo || rec.periodo, 'Mes auditado');
      const antiguedad = limpiarTextoAuditoria(r.antiguedad || rec.antiguedadDetalle, 'No registrada');

      const bruto = parseNumeroSeguroAuditoria(r.sueldoBrutoTotal ?? rec.sueldoBruto ?? am.totalHaberes) ?? 0;
      const descuentos = parseNumeroSeguroAuditoria(r.totalDescuentos ?? rec.totalDescuentosRecibo ?? am.totalDescuentos) ?? 0;
      const liquido = parseNumeroSeguroAuditoria(r.sueldoLiquido ?? rec.sueldoNeto ?? am.netoLiquido) ?? round2Margen(bruto - Math.abs(descuentos));

      const totalSubtotal1Desc = parseNumeroSeguroAuditoria(am.totalSubtotal1Desc ?? r.totalSubtotal1Desc ?? r.descuentosLey ?? rec.descuentosLey) ?? 0;
      const subtotal1 = parseNumeroSeguroAuditoria(am.subtotal1 ?? r.subtotal1) ?? 0;
      const subtotalTope = parseNumeroSeguroAuditoria(am.subtotalTope ?? r.subtotalTope) ?? 0;
      const subtotal2 = parseNumeroSeguroAuditoria(am.subtotal2 ?? r.subtotal2) ?? 0;
      const totalNoComputable = parseNumeroSeguroAuditoria(am.totalNoComputable ?? r.totalNoComputable) ?? 0;
      const afectable = parseNumeroSeguroAuditoria(am.afectable ?? r.afectable) ?? 0;
      const totalAfectado = parseNumeroSeguroAuditoria(am.totalAfectado ?? r.totalAfectado) ?? 0;
      const totalAfectadoEfectivo = parseNumeroSeguroAuditoria(am.totalAfectadoEfectivo ?? r.totalAfectadoEfectivo) ?? totalAfectado;
      const cuotaFutura2 = parseNumeroSeguroAuditoria(am.cuotaFutura2 ?? r.cuotaFutura2) ?? 0;
      const cuotaRefinanciar = parseNumeroSeguroAuditoria(am.cuotaRefinanciar ?? r.cuotaRefinanciar) ?? 0;
      const saldoCancelar = parseNumeroSeguroAuditoria(am.saldoCancelar ?? r.saldoCancelar) ?? 0;
      const saldoVigenteExterno = parseNumeroSeguroAuditoria(am.saldoVigenteExterno ?? r.saldoVigenteExterno) ?? 0;
      const detalleRefinanciacion = String(am.detalleRefinanciacion ?? r.detalleRefinanciacion ?? '').trim();
      const factorMargen = Number(am.factorMargen ?? r.factorMargen ?? 1.0) || 1.0;
      const disponibleReciboOriginal = parseNumeroSeguroAuditoria(am.disponibleReciboOriginal ?? r.disponibleReciboOriginal) ?? 0;
      const disponibleBrutoRecibo = parseNumeroSeguroAuditoria(am.disponibleBrutoRecibo ?? r.disponibleBrutoRecibo) ?? 0;
      const disponibleRecibo = parseNumeroSeguroAuditoria(am.disponibleRecibo ?? r.disponibleRecibo ?? r.margenDisponiblePlanilla ?? rec.margenDisponibleCuota) ?? 0;
      const topeEndeud4167 = parseNumeroSeguroAuditoria(am.topeEndeudamientoMensual4167) ?? round2Margen((5 * Math.max(0, liquido)) / 12);
      const puedeOfrecerCuotas = am.puedeOfrecerCuotas !== undefined ? Boolean(am.puedeOfrecerCuotas) : (disponibleRecibo > 0);
      const cuotaMaximaSegura = parseNumeroSeguroAuditoria(am.cuotaMaximaSeguraGeneral ?? r.cuotaMaximaSeguraGeneral ?? rec.cuotaMaximaSeguraGeneral) ?? (puedeOfrecerCuotas ? round2Margen(Math.min(disponibleRecibo, topeEndeud4167)) : 0);
      const tipoBenef = am.tipoBeneficiario || r.tipoBeneficiario || rec.tipoBeneficiario || 'ACTIVO';
      const etiquetaBenef = am.etiquetaBeneficiario || (tipoBenef === 'PASIVO' ? 'Pasivos / Jubilados (65% afectable · Tope 35%)' : 'Activos (80% afectable · Tope 20%)');
      const lugarTrabajo = am.lugarTrabajo || r.lugarTrabajo || rec.lugarTrabajo || 'GE_';
      const estadoMargen = am.estado || r.estadoMargen || (puedeOfrecerCuotas ? 'DISPONIBLE' : 'SIN_DISPONIBLE');

      const cupo50 = round2Margen(bruto * 0.50);
      const margen = disponibleRecibo;
      const embargosJudiciales = Boolean(r.embargosJudiciales || rec.embargoDetectado || (parseNumeroSeguroAuditoria(rec.embargoMonto) || 0) > 0);
      const embargoMonto = parseNumeroSeguroAuditoria(rec.embargoMonto) || 0;
      const score = typeof sc.puntajeTotal === 'number'
        ? sc.puntajeTotal
        : (typeof r.scoringSugerido === 'number'
          ? r.scoringSugerido
          : (puedeOfrecerCuotas && !embargosJudiciales ? 88 : (liquido > 300000 && !embargosJudiciales ? 66 : 42)));

      const decisionPlanilla = r.decisionPlanilla || rec.decisionPlanilla || (puedeOfrecerCuotas && !embargosJudiciales ? 'APTO POR PLANILLA' : 'SIN DISPONIBLE / CUPO EXCEDIDO');
      const decisionAlternativaCBU = r.decisionAlternativaCBU || rec.decisionAlternativaCBU || (!embargosJudiciales && liquido > 300000 ? 'APTO CONDICIONADO CBU / SIDECREER' : 'NO VIABLE');

      const resumenAuditoria = {
        titular,
        dni,
        cuil,
        organismo,
        cargo,
        periodo,
        antiguedad,
        tipoBeneficiario: tipoBenef,
        etiquetaBeneficiario: etiquetaBenef,
        lugarTrabajo,
        porcentajeTope: am.porcentajeTope ?? (tipoBenef === 'PASIVO' ? 0.35 : 0.20),
        sueldoBrutoTotal: bruto,
        descuentosLey: totalSubtotal1Desc,
        consumosBersa: parseNumeroSeguroAuditoria(r.consumosBersa ?? rec.consumosBersa) ?? 0,
        consumosSidecreer: parseNumeroSeguroAuditoria(r.consumosSidecreer ?? rec.consumosSidecreer) ?? 0,
        otrasMutuales: parseNumeroSeguroAuditoria(r.otrasMutualesOProveeduria ?? r.otrasMutuales ?? rec.otrasMutuales) ?? 0,
        consumosFedem: parseNumeroSeguroAuditoria(r.consumosFedem ?? rec.codigosFedemMonto) ?? 0,
        totalDescuentos: descuentos,
        sueldoLiquido: liquido,
        cupoMaximo50: cupo50,
        totalSubtotal1Desc,
        subtotal1,
        subtotalTope,
        subtotal2,
        totalNoComputable,
        afectable,
        totalAfectado,
        totalAfectadoEfectivo,
        cuotaFutura2,
        cuotaRefinanciar,
        saldoCancelar,
        saldoVigenteExterno,
        detalleRefinanciacion,
        factorMargen,
        disponibleReciboOriginal,
        disponibleBrutoRecibo,
        disponibleRecibo,
        margenDisponiblePlanilla: disponibleRecibo,
        topeEndeudamientoMensual4167: topeEndeud4167,
        cuotaMaximaSeguraGeneral: cuotaMaximaSegura,
        puedeOfrecerCuotas,
        estadoMargen,
        embargosJudiciales,
        embargoMonto,
        decisionPlanilla,
        decisionAlternativaCBU,
        scoringSugerido: score,
        analisisMargen: am,
        ofertasPorPlazo: ofertasMap,
        conclusionesRecomendaciones: concl
      };

      const pctTopeLbl = tipoBenef === 'PASIVO' ? '35%' : '20%';
      const pctAfectLbl = tipoBenef === 'PASIVO' ? '65%' : '80%';
      const dispTexto = puedeOfrecerCuotas
        ? ('DISPONIBLE (' + formatPesosMargen(disponibleRecibo) + ')')
        : ('SIN Disponible (' + formatPesosMargen(disponibleRecibo) + ') — Ofertas bloqueadas');
      const refLineaTxt = (cuotaRefinanciar > 0 || saldoCancelar > 0 || saldoVigenteExterno > 0 || factorMargen < 0.99)
        ? ('\n• Refinanciación / Criterio: Cuota a liberar ' + formatPesosMargen(cuotaRefinanciar) + ' | Saldo Cancelar ' + formatPesosMargen(saldoCancelar) + ' | Saldo Externo ' + formatPesosMargen(saldoVigenteExterno) + ' | Criterio ' + Math.round(factorMargen * 100) + '%' + (detalleRefinanciacion ? (' (' + detalleRefinanciacion + ')') : ''))
        : '';
      const conclLineaTxt = (concl && concl.titulo)
        ? ('\n• Conclusión: ' + concl.titulo + ' — ' + (concl.resumen || ''))
        : '';

      const textoFormateado =
        '[DICTAMEN DE AUDITORÍA DOCUMENTAL IA — AMMER (MOTOR PADRÓN OFICIAL)]\n' +
        '• Titular: ' + titular + ' (DNI ' + dni + ') | ' + organismo + ' (' + cargo + ')\n' +
        '• Régimen Padrón: ' + etiquetaBenef + ' [' + lugarTrabajo + '] | Período: ' + periodo + ' | Antigüedad: ' + antiguedad + ' | Score: ' + score + '/100\n' +
        '• Haberes Brutos: ' + formatPesosMargen(bruto) + ' | Total Descuentos: ' + formatPesosMargen(descuentos) + ' | Neto Líquido: ' + formatPesosMargen(liquido) + '\n' +
        '• Cascada Padrón: Subtotal1 ' + formatPesosMargen(subtotal1) + ' (SUBTOTAL_1: -' + formatPesosMargen(totalSubtotal1Desc) + ') | Tope ' + pctTopeLbl + ' (-' + formatPesosMargen(subtotalTope) + ') → Subtotal2 (' + pctAfectLbl + '): ' + formatPesosMargen(subtotal2) + '\n' +
        '• Afectable: ' + formatPesosMargen(afectable) + ' (No Computable: -' + formatPesosMargen(totalNoComputable) + ') | Afectado: -' + formatPesosMargen(totalAfectado) + (cuotaFutura2 > 0 ? (' | Cuota Futura 2: -' + formatPesosMargen(cuotaFutura2)) : '') + '\n' +
        '• Disponible Recibo: ' + dispTexto + ' | Tope Endeud. 41,67% Líquido: ' + formatPesosMargen(topeEndeud4167) + ' | Cuota Segura Máx.: ' + formatPesosMargen(cuotaMaximaSegura) +
        refLineaTxt + conclLineaTxt + '\n' +
        '• Embargos: ' + (embargosJudiciales ? ('SÍ (' + formatPesosMargen(embargoMonto) + ')') : 'NO ($ 0,00)') + ' | Decisión Planilla: ' + decisionPlanilla + ' | Alternativa CBU: ' + decisionAlternativaCBU;

      return {
        resumenAuditoria,
        textoFormateado,
        score,
        embargosJudiciales,
        margen: disponibleRecibo,
        disponibleRecibo,
        puedeOfrecerCuotas,
        cuotaMaximaSegura,
        liquido
      };
    }

    function esEtapaOperativaInicialOIntermedia(estado) {
      if (!estado) return true;
      const estNorm = String(estado).toUpperCase().replace(/[\s_-]+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Excluir terminantemente expedientes en etapas avanzadas o de cierre
      const etapasCerradas = [
        'APROBADO_FEDEM', 'LIQUIDADO', 'RECHAZADO_DEFINITIVO', 'COBRADO', 'TRANSFERIDO',
        'APROBADO', 'RECHAZADO', 'CANCELADO', 'FINALIZADO', 'PAGADO', 'ANULADO'
      ];
      if (etapasCerradas.some(c => estNorm.includes(c))) {
        return false;
      }
      return true;
    }

    function abrirModalGuardadoAuditoria() {
      if (!ultimoResultadoAuditoria) {
        showToast('No hay dictamen de auditoría activo para guardar en bitácora.');
        return;
      }

      const normAudit = normalizarResultadoAuditoriaIA(ultimoResultadoAuditoria) || ultimoResultadoAuditoria;
      const datosBitacora = construirPayloadBitacoraAuditoria(normAudit);
      const resDec = normAudit.resumenDecision || {};
      const ident = normAudit.identidad || {};
      const datLab = normAudit.datosLaborales || {};
      const radSal = normAudit.radiografiaSalarial || {};
      const am = normAudit.analisisMargen || {};

      const titular = resDec.titular || ident.titularDetectado || 'Titular no detectado';
      const dniAudit = String(resDec.dni || ident.dni || (datosBitacora.resumenAuditoria && datosBitacora.resumenAuditoria.dni) || '').replace(/\D/g, '');
      const organismo = resDec.organismo || datLab.organismoEmpleador || 'Provincial';
      const cargo = resDec.cargo || datLab.escalafonCargo || 'Agente';
      const sueldoBruto = Number(am.totalHaberes ?? resDec.sueldoBrutoTotal ?? radSal.sueldoBrutoTotal ?? 0);
      const sueldoLiquido = Number(am.netoLiquido ?? resDec.sueldoLiquido ?? radSal.sueldoLiquido ?? 0);
      const disponibleRecibo = Number(am.disponibleRecibo ?? resDec.disponibleRecibo ?? resDec.margenDisponiblePlanilla ?? 0);
      const cuotaSegura = Number(am.cuotaMaximaSeguraGeneral ?? resDec.cuotaMaximaSeguraGeneral ?? 0);
      const puedeOfrecer = am.puedeOfrecerCuotas !== undefined ? Boolean(am.puedeOfrecerCuotas) : (disponibleRecibo > 0);
      const regLbl = (am.tipoBeneficiario === 'PASIVO') ? 'Pasivos 65%' : 'Activos 80%';
      const modalidadSugerida = puedeOfrecer ? ('Planilla FEDEM (' + regLbl + ')') : 'SIN Disponible / Revisión CBU';

      // 1. Meta banner
      const metaEl = document.getElementById('modalGuardadoAuditoriaMeta');
      if (metaEl) {
        metaEl.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">' +
            '<div>' +
              '<div style="font-weight:800;font-size:0.88rem;color:var(--color-primary);">' + sanitizeHTML(titular) + '</div>' +
              '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">DNI <strong style="color:#1e293b;" class="tabular-nums font-mono">' + (dniAudit || 'S/DNI') + '</strong> · ' + sanitizeHTML(organismo) + ' (' + sanitizeHTML(cargo) + ') · <strong>' + sanitizeHTML(regLbl) + '</strong></div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-size:0.7rem;color:var(--text-muted);">Disponible Recibo Real</div>' +
              '<div style="font-weight:800;font-size:0.95rem;color:' + (puedeOfrecer ? '#15803d' : '#b91c1c') + ';" class="tabular-nums">' +
                (puedeOfrecer ? sanitizeHTML(formatPesosMargen(disponibleRecibo)) : ('SIN Disponible (' + sanitizeHTML(formatPesosMargen(disponibleRecibo)) + ')')) +
              '</div>' +
              (puedeOfrecer ? ('<div style="font-size:0.68rem;color:#475569;font-weight:700;">Cuota Segura (Tope 41,67%): ' + sanitizeHTML(formatPesosMargen(cuotaSegura)) + '</div>') : '') +
            '</div>' +
          '</div>';
      }

      // 2. Query matching solicitudes in getStoredSolicitudes()
      const all = getStoredSolicitudes();
      const candidatos = all.filter(x => {
        const dniS = String((x.solicitante && x.solicitante.dni) || x.DNI_Asociado || x.dni || '').replace(/\D/g, '');
        const est = x.estado || x.Estado_Tramite;
        return dniS && dniAudit && dniS === dniAudit && esEtapaOperativaInicialOIntermedia(est);
      });

      // Badge count
      const badgeCount = document.getElementById('badgeCoincidenciasAuditoria');
      if (badgeCount) {
        badgeCount.textContent = candidatos.length + (candidatos.length === 1 ? ' trámite coincidente' : ' trámites coincidentes');
      }

      // Contenedor coincidencias
      const contCoinc = document.getElementById('contenedorCoincidenciasAuditoria');
      if (contCoinc) {
        if (candidatos.length === 0) {
          contCoinc.innerHTML =
            '<div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:0.75rem 1rem;font-size:0.74rem;color:#92400e;line-height:1.4;">' +
              'ℹ️ No se detectaron expedientes abiertos en <strong>etapa inicial o intermedia</strong> para el DNI ' + (dniAudit || 'del titular') + '. ' +
              'Si el solicitante ya tenía expedientes previos, estos ya se encuentran en etapas avanzadas o de cierre (aprobados, liquidados o cerrados). Puede abrir un nuevo trámite mediante la <strong>Opción B</strong>.' +
            '</div>';
        } else {
          const cardsHtml = candidatos.map(s => {
            const idBadge = renderBadgeIdentificadorExpediente(s);
            const fechaStr = formatearFechaTabla24hs(s.fecha || s.Fecha_Registro);
            const montoStr = formatMoney(s.prestamo?.monto || s.Monto_Solicitado_Neto || 0);
            const analistaStr = sanitizeHTML(s.analistaAsignado || s.Analista_Asignado || 'Sin Asignar');
            const estadoStr = sanitizeHTML(s.estado || s.Estado_Tramite || 'Pendiente');

            return '<div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.6rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">' +
              '<div style="flex:1;min-width:220px;">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                  idBadge +
                  '<span style="font-size:0.7rem;font-weight:700;color:var(--text-muted);">' + fechaStr + '</span>' +
                '</div>' +
                '<div style="font-size:0.75rem;color:#334155;">' +
                  'Monto: <strong style="color:var(--color-primary);">' + montoStr + '</strong> · ' +
                  'Estado: <span class="badge-status badge-' + estadoStr.replace(/\s/g, '') + '" style="font-size:0.65rem;">' + estadoStr + '</span>' +
                '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Analista: <strong>' + analistaStr + '</strong></div>' +
              '</div>' +
              '<div>' +
                '<button type="button" class="btn-primary-action" style="width:auto;padding:0.45rem 0.85rem;font-size:0.74rem;background:#1e3a8a;border-color:#172554;" onclick="ejecutarAsociacionAuditoriaAExpediente(\'' + s.id + '\')">' +
                  'Asentar en este Expediente' +
                '</button>' +
              '</div>' +
            '</div>';
          }).join('');
          contCoinc.innerHTML = cardsHtml;
        }
      }

      // 3. Resumen nuevo expediente
      const resNuevo = document.getElementById('resumenNuevoExpedienteAuditoria');
      if (resNuevo) {
        resNuevo.innerHTML =
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:6px;">' +
            '<div><strong>Titular:</strong> ' + sanitizeHTML(titular) + '</div>' +
            '<div><strong>DNI:</strong> ' + (dniAudit || '—') + '</div>' +
            '<div><strong>Organismo:</strong> ' + sanitizeHTML(organismo) + '</div>' +
            '<div><strong>Bruto:</strong> ' + sanitizeHTML(formatPesosMargen(sueldoBruto)) + '</div>' +
            '<div><strong>Líquido:</strong> ' + sanitizeHTML(formatPesosMargen(sueldoLiquido)) + '</div>' +
            '<div><strong>Disponible Recibo:</strong> ' + sanitizeHTML(puedeOfrecer ? formatPesosMargen(disponibleRecibo) : ('SIN Disponible (' + formatPesosMargen(disponibleRecibo) + ')')) + '</div>' +
            '<div><strong>Cuota Segura (41,67%):</strong> ' + sanitizeHTML(formatPesosMargen(cuotaSegura)) + '</div>' +
            '<div><strong>Modalidad:</strong> ' + sanitizeHTML(modalidadSugerida) + '</div>' +
          '</div>';
      }

      abrirModal('modalGuardadoAuditoriaInteligente');
    }

    async function ejecutarAsociacionAuditoriaAExpediente(idSolicitud) {
      cerrarModal('modalGuardadoAuditoriaInteligente');
      return guardarDictamenEnBitacoraExpediente(idSolicitud);
    }

    function abrirNuevoExpedienteDesdeAuditoria(dictamenParam) {
      const rawIn = dictamenParam || ultimoResultadoAuditoria;
      if (!rawIn) {
        showToast('⚠️ No hay auditoría activa para pre-cargar el expediente.');
        return null;
      }

      const dictamen = normalizarResultadoAuditoriaIA(rawIn) || rawIn;
      if (dictamenParam && dictamenParam !== dictamen) {
        if (dictamenParam.montoSugerido > 0) dictamen.montoSugerido = dictamenParam.montoSugerido;
        if (dictamenParam.cuotas > 0) dictamen.cuotas = dictamenParam.cuotas;
        if (dictamenParam.plazo > 0) dictamen.plazo = dictamenParam.plazo;
        if (dictamenParam.linea) dictamen.linea = dictamenParam.linea;
      }

      cerrarModal('modalGuardadoAuditoriaInteligente');

      // 1. Inicializar modal de alta según el rol del usuario logueado
      const origenSegunRol = esUsuarioRolMutualOAdmin() ? 'mutual_sede' : 'comercializador';
      abrirModalAltaSolicitud(origenSegunRol);

      // Restaurar tarjeta de resumen de auditoría en la cabecera del formulario
      const bannerAud = document.getElementById('bannerResumenAuditoriaModalAlta');
      if (bannerAud) {
        bannerAud.innerHTML = (typeof generarTarjetaResumenAuditoriaModal === 'function')
          ? generarTarjetaResumenAuditoriaModal(dictamen)
          : generarTarjetaResumenEjecutivoAMMER(dictamen);
        bannerAud.style.display = 'block';
      }

      // 2. Extracción tolerante multinivel de datos del dictamen
      const resDec = dictamen.resumenDecision || {};
      const ident = dictamen.identidad || {};
      const datLab = dictamen.datosLaborales || {};
      const recSueldo = dictamen.reciboSueldo || {};
      const radSal = dictamen.radiografiaSalarial || {};
      const am = dictamen.analisisMargen || {};
      const ofertasMap = dictamen.ofertasPorPlazo || { fedem: [], muni: [], sidecreer: [] };

      const dni = String(dictamen.dni || resDec.dni || ident.dni || '').replace(/\D/g, '');
      const titular = String(dictamen.titular || resDec.titular || ident.titularDetectado || ident.nombre || '').trim();
      const cuil = String(dictamen.cuil || resDec.cuil || ident.cuil || '').trim();
      const domicilio = String(dictamen.domicilio || ident.domicilio || '').trim();
      const organismoRaw = String(dictamen.organismo || resDec.organismo || datLab.organismoEmpleador || datLab.organismo || '').trim();
      const cargoRaw = String(dictamen.cargo || resDec.cargo || datLab.escalafonCargo || datLab.cargo || datLab.situacionRevista || '').trim();
      const condicionRaw = String(dictamen.condicion || datLab.condicion || '').trim();
      const legajoRaw = String(dictamen.legajo || recSueldo.legajo || datLab.legajo || datLab.legajoMunicipal || resDec.legajo || '').trim();
      const categoriaRaw = String(dictamen.categoria || recSueldo.categoria || datLab.categoria || resDec.categoria || '').trim();
      const antiguedadRaw = String(dictamen.antiguedad || recSueldo.antiguedadDetalle || datLab.antiguedad || datLab.antiguedadCalculada || '').trim();
      const fechaIngresoRaw = String(dictamen.fechaIngreso || recSueldo.fechaIngreso || datLab.fechaIngresoLaboral || datLab.fechaIngreso || '').trim();

      const sueldoLiquido = Number(am.netoLiquido ?? dictamen.sueldoLiquido ?? resDec.sueldoLiquido ?? radSal.sueldoLiquido ?? 0);
      const disponibleRecibo = Number(am.disponibleRecibo ?? resDec.disponibleRecibo ?? resDec.margenDisponiblePlanilla ?? dictamen.margen ?? 0);
      const puedeOfrecerCuotas = (am.puedeOfrecerCuotas !== undefined) ? Boolean(am.puedeOfrecerCuotas) : (disponibleRecibo > 0);

      // 3. Organismo: si incluye POLICIA, CGE, SALUD, PROVINCIA o GOBIERNO -> Provincial; si incluye MUNICIPAL o MUNICIP -> Municipal
      const orgUpper = organismoRaw.toUpperCase();
      let organismoSel = 'Provincial';
      if (orgUpper.includes('MUNICIPAL') || orgUpper.includes('MUNICIP')) {
        organismoSel = 'Municipal';
      } else {
        organismoSel = 'Provincial';
      }
      const selOrganismo = document.getElementById('solOrganismo');
      if (selOrganismo) {
        selOrganismo.value = organismoSel;
        if (typeof handleOrganismoChange === 'function') {
          handleOrganismoChange(organismoSel, 'solLegajo');
        }
      }

      // 4. Dependencia / Lugar de Trabajo
      const inpDependencia = document.getElementById('solDependencia');
      if (inpDependencia) {
        inpDependencia.value = organismoRaw;
      }

      // 5. Cargo / Condición de Revista
      const conceptosStr = JSON.stringify(dictamen.conceptosHaberes || dictamen.conceptos || []).toUpperCase();
      const cargoTotalStr = (cargoRaw + ' ' + conceptosStr + ' ' + orgUpper).toUpperCase();
      let cargoSel = 'Titular';
      if (cargoTotalStr.includes('SUPLENTE')) {
        cargoSel = 'Suplente';
      } else if (cargoTotalStr.includes('TITULAR')) {
        cargoSel = 'Titular';
      }
      const selCargo = document.getElementById('solicitud-cargo') || document.getElementById('solCargo');
      if (selCargo) {
        selCargo.value = cargoSel;
      }

      // 6. Condición laboral: default "Activo" (o "Jubilado" si Padrón determinó PASIVO / Caja)
      let condicionSel = 'Activo';
      const checkPasivo = (orgUpper + ' ' + condicionRaw.toUpperCase());
      if (am.tipoBeneficiario === 'PASIVO' || checkPasivo.includes('JUBILA') || checkPasivo.includes('PASIVO') || checkPasivo.includes('CAJA DE JUBILACION')) {
        condicionSel = 'Jubilado';
      } else if (checkPasivo.includes('PENSION')) {
        condicionSel = 'Pensionado';
      }
      const selCondicion = document.getElementById('solCondicion');
      if (selCondicion) {
        selCondicion.value = condicionSel;
      }

      // 7. Legajo y Categoría Municipal
      const inpLegajo = document.getElementById('solLegajo');
      if (inpLegajo && legajoRaw && !/no consta|n\/a/i.test(legajoRaw)) {
        const legajoDigits = legajoRaw.replace(/\D/g, '') || legajoRaw;
        inpLegajo.value = legajoDigits;
      }
      const inpCatMuni = document.getElementById('solicitud-categoria-municipal');
      if (inpCatMuni && categoriaRaw && !/no consta|n\/a/i.test(categoriaRaw)) {
        inpCatMuni.value = categoriaRaw;
      }

      // 8. DNI, Nombre y Apellido, CUIL, Domicilio
      const inpDni = document.getElementById('solDni');
      if (inpDni && dni) {
        inpDni.value = dni;
        if (typeof handleDniInputDebounced === 'function') {
          handleDniInputDebounced(dni);
        }
      }
      const inpNombre = document.getElementById('solNombre');
      if (inpNombre && titular) {
        inpNombre.value = titular;
      }
      const inpCuil = document.getElementById('solCuil');
      if (inpCuil && cuil) {
        inpCuil.value = cuil;
      }
      const inpDom = document.getElementById('solDomicilio');
      if (inpDom && domicilio) {
        inpDom.value = domicilio;
      }

      // 9. Antigüedad / Años y Meses
      let anios = 0;
      let meses = 0;
      if (antiguedadRaw && !/no registrada|no especificada|no consta/i.test(antiguedadRaw)) {
        const mAnios = antiguedadRaw.match(/(\d+)\s*(?:año|ano|a)/i);
        const mMeses = antiguedadRaw.match(/(\d+)\s*(?:mes|m)/i);
        if (mAnios) anios = parseInt(mAnios[1], 10) || 0;
        if (mMeses) meses = parseInt(mMeses[1], 10) || 0;

        if (!mAnios && !mMeses) {
          const parts = antiguedadRaw.split(/[-–—/]/).map(s => parseInt(s.trim(), 10));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            anios = parts[0];
            meses = parts[1];
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            anios = parts[0];
          }
        }
      }
      let totalMeses = (anios * 12) + meses;

      let fechaIngresoFinal = '';
      if (fechaIngresoRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaIngresoRaw)) {
        fechaIngresoFinal = fechaIngresoRaw;
      } else if (fechaIngresoRaw && /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.test(fechaIngresoRaw)) {
        const mF = fechaIngresoRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        fechaIngresoFinal = `${mF[3]}-${mF[2].padStart(2, '0')}-${mF[1].padStart(2, '0')}`;
      } else if (totalMeses > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - anios);
        d.setMonth(d.getMonth() - meses);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(Math.min(d.getDate(), 28)).padStart(2, '0');
        fechaIngresoFinal = `${yyyy}-${mm}-${dd}`;
      }

      if (totalMeses === 0 && fechaIngresoFinal) {
        const fIng = new Date(fechaIngresoFinal + 'T00:00:00');
        const hoy = new Date();
        if (!isNaN(fIng.getTime()) && fIng <= hoy) {
          let diffMeses = (hoy.getFullYear() - fIng.getFullYear()) * 12 + (hoy.getMonth() - fIng.getMonth());
          if (hoy.getDate() < fIng.getDate()) diffMeses--;
          if (diffMeses > 0) {
            anios = Math.floor(diffMeses / 12);
            meses = diffMeses % 12;
            totalMeses = diffMeses;
          }
        }
      }

      const inpFechaIngreso = document.getElementById('solicitud-fecha-ingreso');
      if (inpFechaIngreso && fechaIngresoFinal) {
        inpFechaIngreso.value = fechaIngresoFinal;
      }
      const antigLegibleModal = (anios === 0 && meses > 0)
        ? `${meses} ${meses === 1 ? 'mes' : 'meses'}`
        : `${anios} ${anios === 1 ? 'año' : 'años'} y ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
      const txtAntiguedad = document.getElementById('texto-antiguedad');
      if (txtAntiguedad) {
        txtAntiguedad.textContent = antigLegibleModal;
      }
      const hidAntiguedad = document.getElementById('solicitud-antiguedad-formateada');
      if (hidAntiguedad) {
        hidAntiguedad.value = antigLegibleModal;
      }
      window._antiguedadMesesActual = totalMeses;
      window._bloqueoAntiguedadMinima = (totalMeses < 10);
      const alertaAnt = document.getElementById('alerta-antiguedad-minima');
      if (alertaAnt) {
        if (totalMeses < 10 && totalMeses > 0) {
          alertaAnt.style.display = 'block';
          alertaAnt.innerHTML = '<div style="background:#fee2e2;border:1px solid #f87171;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:0.75rem;font-weight:700;">⚠️ Antigüedad laboral inferior a 10 meses (' + totalMeses + ' meses). Requiere autorización de gerencia.</div>';
        } else {
          alertaAnt.style.display = 'none';
          alertaAnt.innerHTML = '';
        }
      }

      // 10. Monto solicitado sugerido y cuotas (calculado por Motor Padrón + Tope Endeudamiento 41,67% Neto, sin fallback 30%)
      let lineaKey = dictamen.linea
        ? ((dictamen.linea === 'muni' || dictamen.linea === 'municipales' || dictamen.linea === 'quad') ? 'muni' : (dictamen.linea === 'sidecreer' ? 'sidecreer' : 'fedem'))
        : (window._lineaAuditoriaSugerida
          ? ((String(window._lineaAuditoriaSugerida).toUpperCase().includes('MUNI') || String(window._lineaAuditoriaSugerida).toUpperCase().includes('QUAD')) ? 'muni' : (String(window._lineaAuditoriaSugerida).toUpperCase().includes('SIDE') ? 'sidecreer' : 'fedem'))
          : ((organismoSel === 'Municipal') ? 'muni' : 'fedem'));

      const selLinea = document.getElementById('solLinea');
      if (selLinea) {
        selLinea.value = lineaKey;
        if (typeof ajustarPlazosModalAlta === 'function') {
          ajustarPlazosModalAlta(lineaKey);
        }
      }

      let cuotasSugeridas = Number(dictamen.cuotas || dictamen.plazo || dictamen.cuotasSugeridas || (lineaKey === 'muni' ? 12 : 24));
      if (lineaKey === 'muni' && cuotasSugeridas !== 12 && cuotasSugeridas !== 24) {
        cuotasSugeridas = 12;
      }
      const selPlazo = document.getElementById('solPlazo');
      if (selPlazo) {
        selPlazo.value = String(cuotasSugeridas);
      }

      let montoSugerido = null;
      if (dictamen.montoSugerido && Number(dictamen.montoSugerido) > 0) {
        montoSugerido = round2Margen(dictamen.montoSugerido);
      } else if (puedeOfrecerCuotas && disponibleRecibo > 0) {
        const listaOfertas = (Array.isArray(ofertasMap[lineaKey]) && ofertasMap[lineaKey].length > 0)
          ? ofertasMap[lineaKey]
          : calcularOfertasPorPlazo(disponibleRecibo, sueldoLiquido, lineaKey);
        const ofMatch = listaOfertas.find(o => Number(o.plazo) === cuotasSugeridas) || listaOfertas[0];
        if (ofMatch && ofMatch.neto > 0) {
          montoSugerido = round2Margen(ofMatch.neto);
        }
      }

      const inpMonto = document.getElementById('solMonto');
      if (inpMonto) {
        if (montoSugerido !== null && montoSugerido > 0) {
          inpMonto.value = montoSugerido.toFixed(2);
          inpMonto.dataset.lastValid = montoSugerido.toFixed(2);
        } else {
          // Si el dictamen es SIN Disponible, bloquear pre-carga automática de capital
          inpMonto.value = '';
          inpMonto.dataset.lastValid = '';
        }
      }

      // 11. Dictamen JSON y texto resumido asignados a campos ocultos y memoria
      const payloadBit = (typeof construirPayloadBitacoraAuditoria === 'function')
        ? construirPayloadBitacoraAuditoria(dictamen)
        : { textoFormateado: '', resumenAuditoria: {} };
      const jsonDictamenStr = JSON.stringify(dictamen);
      const txtDictamen = payloadBit.textoFormateado || '';

      const hidDictamen = document.getElementById('solDictamenIA');
      if (hidDictamen) hidDictamen.value = jsonDictamenStr;

      const hidTexto = document.getElementById('solTextoDictamen');
      if (hidTexto) hidTexto.value = txtDictamen;

      window._dictamenAuditoriaParaNuevaSolicitud = dictamen;
      window._dictamenAuditoriaTexto = txtDictamen;

      // 12. Adjunto de recibo auditado en memoria reactiva y fila documental
      const reciboEnCola = (archivosAuditoriaCola && archivosAuditoriaCola.length > 0) ? archivosAuditoriaCola[0] : null;
      if (reciboEnCola && reciboEnCola.base64) {
        const nombreDoc = reciboEnCola.nombre || 'recibo_sueldo_auditado.pdf';
        const mimeDoc = reciboEnCola.mimeType || 'application/pdf';
        const fileObj = {
          nombre: nombreDoc,
          name: nombreDoc,
          nombreOriginal: nombreDoc,
          nombreArchivo: nombreDoc,
          base64: reciboEnCola.base64,
          mimeType: mimeDoc,
          tipoMime: mimeDoc,
          type: mimeDoc,
          tamanio: reciboEnCola.tamanio || 120000,
          size: reciboEnCola.tamanio || 120000,
          dataUrl: 'data:' + mimeDoc + ';base64,' + reciboEnCola.base64,
          tipo: 'RECIBO DE SUELDO'
        };

        if (!window.stateArchivosAdjuntos) window.stateArchivosAdjuntos = {};
        window.stateArchivosAdjuntos['fileRecibo'] = [fileObj];
        if (window.state && window.state.archivosAdjuntos) {
          window.state.archivosAdjuntos['RECIBO DE SUELDO'] = fileObj;
        }

        const rowRecibo = document.getElementById('row-fileRecibo');
        const badgeRecibo = document.getElementById('badge-fileRecibo');
        const subRecibo = document.getElementById('sub-fileRecibo');
        const btnLblRecibo = document.getElementById('btnLbl-fileRecibo');
        const prevRecibo = document.getElementById('prev-fileRecibo');
        const delRecibo = document.getElementById('del-fileRecibo');

        if (rowRecibo) rowRecibo.classList.add('is-loaded');
        if (badgeRecibo) {
          badgeRecibo.className = 'doc-row-badge badge-cargado';
          badgeRecibo.textContent = '✓ Auditado IA';
        }
        if (subRecibo) {
          subRecibo.textContent = nombreDoc + ' (Comprobante auditado y validado por IA)';
        }
        if (btnLblRecibo) btnLblRecibo.textContent = 'Reemplazar';
        if (prevRecibo) prevRecibo.style.display = 'inline-flex';
        if (delRecibo) delRecibo.style.display = 'inline-flex';
      }

      // 13. Recalcular cuotas, documentación y reactivar botones
      if (typeof evaluarDocumentacionRequerida === 'function') evaluarDocumentacionRequerida();
      if (typeof recalcularValidacionesEdadYCuotas === 'function') recalcularValidacionesEdadYCuotas();
      if (typeof actualizarResumenCuotaAlta === 'function') actualizarResumenCuotaAlta();
      if (typeof sincronizarEstadoBotonSubmitAlta === 'function') sincronizarEstadoBotonSubmitAlta();

      abrirModal('modalAltaSolicitud');
      if (!puedeOfrecerCuotas && !dictamen.montoSugerido) {
        const msgSinDisp = '⚠️ Recibo en estado SIN Disponible (' + formatPesosMargen(disponibleRecibo) + '). Simulación automática bloqueada.';
        mostrarNotificacionToast(msgSinDisp, 'error');
        showToast(msgSinDisp);
      } else {
        mostrarNotificacionToast('Formulario de solicitud precargado con dictamen pericial ✓', 'success');
        showToast('Formulario de solicitud precargado con dictamen pericial ✓');
      }
      return true;
    }

    async function ejecutarCrearNuevoExpedienteDesdeAuditoria() {
      return abrirNuevoExpedienteDesdeAuditoria();
    }

    function confirmarGuardadoDictamenInline(idSolicitud) {
      if (typeof guardarDictamenEnBitacoraExpediente === 'function') {
        return guardarDictamenEnBitacoraExpediente(idSolicitud);
      }
      console.warn('guardarDictamenEnBitacoraExpediente no disponible.');
      return null;
    }

    async function guardarDictamenEnBitacoraExpediente(idSolicitudForzada) {
      if (!ultimoResultadoAuditoria) {
        showToast('No hay dictamen de auditoría activo para guardar en bitácora.');
        return null;
      }

      // Si no se especifica ID forzado, abrir el modal interactivo de decisión (Asociar a trámite o Abrir nuevo)
      if (!idSolicitudForzada) {
        abrirModalGuardadoAuditoria();
        return { ok: true, modalAbierto: true };
      }

      const normAudit = normalizarResultadoAuditoriaIA(ultimoResultadoAuditoria) || ultimoResultadoAuditoria;
      ultimoResultadoAuditoria = normAudit;

      const all = getStoredSolicitudes();
      const datosBitacora = construirPayloadBitacoraAuditoria(normAudit);
      let targetId = String(idSolicitudForzada);

      const s = all.find(x => String(x.id) === String(targetId));
      if (!s) {
        showToast('No se encontró el expediente seleccionado en la Bandeja.');
        return null;
      }

      idExpedienteAuditadoActivo = String(s.id);
      const session = typeof getSession === 'function' ? getSession() : null;
      const usuarioOperador = (session && session.nombre) ? session.nombre : 'Analista Mutual';
      const rolOperador = (session && session.rol) ? session.rol : 'Analista';
      const nowStr = obtenerFechaHora24hs();

      if (!Array.isArray(s.observaciones)) s.observaciones = [];
      const nodoAuditoria = {
        tipo: 'AUDITORIA_IA_DOCUMENTAL',
        autor: usuarioOperador + ' [Auditoría IA]',
        usuarioOperador: usuarioOperador,
        rol: rolOperador,
        fecha: nowStr,
        texto: datosBitacora.textoFormateado,
        resumenAuditoria: datosBitacora.resumenAuditoria
      };
      s.observaciones.push(nodoAuditoria);
      s.historialComentarios = s.observaciones;
      s.Historial_Comentarios_JSON = JSON.stringify(s.observaciones);
      s.Ultima_Actualizacion = nowStr;
      s.auditoriaIA = {
        estado: 'completado',
        fechaFin: nowStr,
        usuarioOperador: usuarioOperador,
        resumenAuditoria: datosBitacora.resumenAuditoria,
        analisisMargen: normAudit.analisisMargen || null,
        ofertasPorPlazo: normAudit.ofertasPorPlazo || null,
        resultado: normAudit
      };

      if ((datosBitacora.embargosJudiciales || !datosBitacora.puedeOfrecerCuotas) && (s.estado === 'Pendiente' || s.estado === 'En Análisis')) {
        s.estado = 'Observado';
      } else if (datosBitacora.puedeOfrecerCuotas && !datosBitacora.embargosJudiciales && s.estado === 'Pendiente') {
        s.estado = 'En Análisis';
      }

      saveStoredSolicitudes(all);
      try {
        renderModuloMutual();
      } catch (errRenderMutual) {
        console.warn('Actualización visual diferida de bandeja mutual:', errRenderMutual);
      }

      const prefijoExp = obtenerPrefijoOficialExpediente(s);
      const btnGuardar = document.getElementById('btnGuardarDictamenBitacora');
      if (btnGuardar) {
        btnGuardar.textContent = '✅ Dictamen Guardado en Bitácora (' + prefijoExp + ')';
      }

      const resRemoto = await callApi({
        action: 'guardarAuditoriaEnHistorial',
        idSolicitud: s.id,
        dniAsociado: datosBitacora.resumenAuditoria.dni,
        usuarioOperador: usuarioOperador,
        rol: rolOperador,
        resumenAuditoria: datosBitacora.resumenAuditoria,
        resultado: normAudit,
        textoFormateado: datosBitacora.textoFormateado
      }, {
        title: 'Guardando Dictamen en Bitácora...',
        sub: 'Persistiendo en Historial_Comentarios_JSON y Dictamen_IA_JSON (Google Sheets)'
      });

      const modalFicha = document.getElementById('modalVerFichaCompleta');
      if (modalFicha && modalFicha.classList && modalFicha.classList.contains('open')) {
        verFichaCompleta(s.id);
      }

      if (resRemoto && resRemoto.ok) {
        mostrarNotificacionToast('💾 Dictamen persistido en Bitácora y Google Sheets (' + prefijoExp + ').', 'success');
      } else {
        mostrarNotificacionToast('💾 Dictamen registrado en Bitácora local (' + prefijoExp + '). Se sincronizará con Google Sheets.', 'info');
      }

      return {
        ok: true,
        idSolicitud: s.id,
        nodoAuditoria,
        remoto: resRemoto
      };
    }

    function registrarDictamenEnChatAuditoria() {
      return guardarDictamenEnBitacoraExpediente(idExpedienteAuditadoActivo);
    }

