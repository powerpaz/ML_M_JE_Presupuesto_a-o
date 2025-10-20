# Rubros C2 — desde base_cruce.xlsx
Proyecto para publicar **solo la tabla principal** de Rubros C2,
cargando los montos directamente desde `base_cruce.xlsx` en el navegador
(usando [SheetJS](https://sheetjs.com/)).

## Columnas esperadas (Hoja1)
- `MD_MONTO USD$` → Material Lúdico (Didáctico)
- `M_MONTO USD$`  → Mobiliario
- `JE_MONTO USD$` → Juegos Exteriores (Equipamiento)

El script detecta variantes (`... USD`, `_USD`, etc.). Si cambian los nombres,
ajusta los arrays `CAND_MD`, `CAND_M`, `CAND_JE` en `app.js`.

## Publicación
- Sube estos archivos a la **raíz** de tu repo:
  - `index.html`, `app.js`, `logo.png`, `base_cruce.xlsx`
- Activa GitHub Pages (branch `main`, root `/`).
- Abre la página: la tabla se llena automáticamente y muestra el **Total**.

## Exportación
Botón **Exportar CSV** descarga `rubros_c2_desde_base_cruce.csv` con los tres rubros y montos.
