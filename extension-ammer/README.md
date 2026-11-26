# Extensión Chrome AMMER — Gestor Documental (v2.1.0)

## Instalación en PC de Oficina (Google Chrome / Edge)
1. Descargá o descomprimí la carpeta `extension-ammer/` en una ruta fija de tu PC (por ejemplo `C:\AMMER\extension-ammer`).
2. Abrí Google Chrome y entrá a `chrome://extensions/`.
3. Activá **Modo de desarrollador** (arriba a la derecha).
4. Hacé clic en **Cargar descomprimida** y seleccioná la carpeta `extension-ammer/`.
5. Fijá el ícono de **Asistente AMMER** en la barra de Chrome.

## Configuración por Puesto (1 clic)
1. Hacé clic derecho en el ícono de la extensión → **Opciones** (o abrí el popup → **⚙️ Opciones**).
2. Hacé clic en **📥 Importar Perfil JSON** y elegí el perfil según el puesto:
   - `perfiles/perfil_mesa_entradas.json` → Guarda **Recibos y DNI** automáticamente en `Downloads/AMMER_MesaEntradas/{DNI}/`.
   - `perfiles/perfil_tesoreria.json` → Guarda **Mutuo, Pagaré y Transferencia** al pasar a **Liquidado** en `Downloads/AMMER_Tesoreria/{ORGANIZACION}/{LINEA}/{DNI}/`.
   - `perfiles/perfil_auditoria.json` → Guarda **todos los documentos + Scoring IA** en modo manual en `Downloads/AMMER_Auditoria/{FECHA}/{ID_EXPEDIENTE}/`.
3. Hacé clic en **💾 Guardar Preferencias**.

## Empaquetado `.zip`
Desde la raíz del repo podés generar el paquete distribuible ejecutando:
```bash
cd extension-ammer && zip -r dist/extension-ammer-v2.1.0.zip manifest.json background.js content.js options.html options.js popup.html popup.js perfiles/ README.md
```
