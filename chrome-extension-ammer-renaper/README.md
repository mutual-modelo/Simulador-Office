# AMMER - Pestaña Dividida y Asistente (Extensión Chrome)

Esta extensión oficial interna de **Mutual Modelo (AMMER)** habilita el modo **Pestaña Dividida nativo de Google Chrome** (*Split View*) desde Simulador-Office (como en **🪪 Validar DNI (RENAPER)** y futuras herramientas externas):

- Abre `https://tramites.renaper.gob.ar/mi_ejemplar/` directamente en el panel derecho de la misma ventana de Chrome (en Chrome 155+ usa `chrome.tabs.create({ splitWithTabId })`; en versiones anteriores abre la pestaña adyacente).
- Autocompleta automáticamente DNI, Sexo y Fecha de Nacimiento en el formulario oficial de RENAPER.
- Muestra el botón **✕ Cerrar y volver** tanto en la barra flotante sobre RENAPER como en el asistente de Simulador-Office para cerrar la vista dividida en 1 clic al terminar.

## Instalación en 1 minuto (Chrome de escritorio)

1. Descargá y descomprimí la carpeta `chrome-extension-ammer-renaper` en tu PC (por ejemplo en `C:\AMMER-Renaper-Ext`).
2. Abrí Google Chrome y entrá a `chrome://extensions/`.
3. Activá el interruptor **Modo de desarrollador** (arriba a la derecha).
4. Hacé clic en **Cargar descomprimida** (*Load unpacked*) y seleccioná la carpeta `chrome-extension-ammer-renaper`.
5. Actualizá la pestaña de **Simulador-Office** (`F5`). A partir de ese momento, el botón **🪪 Validar DNI (RENAPER)** abrirá la pestaña dividida automáticamente.
