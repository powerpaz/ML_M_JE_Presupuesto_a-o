# Mapa educativo – Ecuador (single‑file)

Este repositorio contiene un `index.html` **autosuficiente** (datos embebidos). 
Se puede publicar directamente en **GitHub Pages** sin archivos adicionales (.geojson, .csv, etc.).

## Publicar en GitHub Pages
1. Crea un repositorio nuevo (p. ej. `mapa-educativo-ecuador`).
2. Sube **este** `index.html` a la **raíz** del repositorio.
3. Ve a **Settings → Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona **Branch:** `main` y **Folder:** `/ (root)` → **Save**.
6. Espera unos segundos y abre la URL que te muestra GitHub (algo como `https://TU-USUARIO.github.io/TU-REPO/`).

## Notas técnicas
- El mapa usa **Leaflet** + **MarkerCluster** vía CDN, y centra/zooma según los puntos embebidos.
- No hace ningún `fetch`: es “a prueba de CORS”.
- Si necesitas actualizar los datos, vuelve a generar el `index.html` con tu Excel y reemplaza el archivo en el repo.

## Checklist si “no se ve”
- Asegúrate de que el archivo se llame **`index.html`** (no `index.html.html`).  
- Revisa que GitHub Pages esté activo (Settings → Pages) y que el **branch/carpeta** estén correctos.
- Limpia el caché duro del navegador (Ctrl+F5) si actualizaste recientemente.

---
Generado el 2025-09-22 16:48.
