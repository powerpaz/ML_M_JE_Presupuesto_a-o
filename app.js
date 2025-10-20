# ========================================
# MAPA EDUCATIVO DINÁMICO - ECUADOR (Colab, robusto + descarga garantizada)
# ========================================

print("🚀 Iniciando procesamiento con detección automática de columnas…")

# ---- Dependencias
import pandas as pd, numpy as np, json, re, sys, subprocess, importlib
from datetime import datetime, date
from google.colab import files
from IPython.display import HTML as _HTML, display, IFrame
import warnings
warnings.filterwarnings("ignore")

def _ensure_pkg(pkg):
    try:
        importlib.import_module(pkg)
    except Exception:
        print(f"📦 Instalando {pkg}…")
        subprocess.check_call([sys.executable, "-m", "pip", "-q", "install", pkg])
        importlib.invalidate_caches()

# ========================================
# PASO 1: SUBIR ARCHIVO
# ========================================
print("\n" + "="*60)
print("📁 SUBIR ARCHIVO EXCEL")
print("="*60)
uploaded = files.upload()
if not uploaded:
    raise SystemExit("❌ No se subió archivo.")
filename = list(uploaded.keys())[0]
print(f"✅ Archivo detectado: {filename}")

# ========================================
# PASO 2: LECTURA
# ========================================
def pick_engine(fname: str) -> str:
    f = fname.lower()
    if f.endswith(".xlsx"): return "openpyxl"
    if f.endswith(".xls"):  return "xlrd"
    return "openpyxl"

engine = pick_engine(filename)
if engine == "openpyxl": _ensure_pkg("openpyxl")
if engine == "xlrd":     _ensure_pkg("xlrd")

print("\n" + "="*60)
print("📊 LEYENDO ARCHIVO")
print("="*60)
print(f"📋 Engine: {engine}")

def _read_excel_smart(path, engine):
    # intenta con header=2 y luego con header=0; si falla xlrd/openpyxl alterna engine
    try:
        return pd.read_excel(path, header=2, engine=engine)
    except Exception:
        try:
            return pd.read_excel(path, header=0, engine=engine)
        except Exception:
            alt = "xlrd" if engine == "openpyxl" else "openpyxl"
            if alt == "openpyxl": _ensure_pkg("openpyxl")
            if alt == "xlrd":     _ensure_pkg("xlrd")
            print(f"⚠️ Cambiando a engine alternativo: {alt}")
            return pd.read_excel(path, header=2, engine=alt)

df = _read_excel_smart(filename, engine)
print(f"✅ Registros: {len(df):,} | Columnas: {len(df.columns)}")
print("🧭 Primeras columnas:", list(df.columns)[:6])

# ========================================
# PASO 3: DETECTAR COLUMNAS CLAVE
# ========================================
def find_col(candidates):
    for col in df.columns:
        if col is None: 
            continue
        u = str(col).upper()
        if any(c in u for c in candidates):
            return col
    return None

amie_col   = find_col(["AMIE"])
nombre_col = find_col(["INSTITUCION", "INSTITUCIÓN", "NOMBRE", "ESCUELA", "COLEGIO"])
lat_col    = find_col(["LATITUD", "LAT"])
lng_col    = find_col(["LONGITUD", "LON", "LONG"])
sost_col   = find_col(["SOSTENIMIENTO"])
prov_col   = find_col(["PROVINCIA", "DPA_DESPRO"])
reg_col    = find_col(["REGIMEN", "RÉGIMEN"])
anio_col   = find_col(["AÑO LECT", "ANIO LECT", "ANO LECT"])  # opcional

print("\n🔍 Columnas detectadas:")
print("   AMIE:", amie_col)
print("   Nombre IE:", nombre_col)
print("   Latitud:", lat_col)
print("   Longitud:", lng_col)
print("   Sostenimiento:", sost_col)
print("   Provincia:", prov_col)
print("   Régimen:", reg_col)
print("   Año lectivo:", anio_col)

if not all([amie_col, nombre_col, lat_col, lng_col]):
    print("❌ Columnas esenciales faltantes. Disponibles:", list(df.columns))
    raise SystemExit("Faltan columnas esenciales (AMIE, Nombre, Latitud, Longitud).")

# Renombrar a nombres estándar
df = df.rename(columns={
    amie_col:   "AMIE",
    nombre_col: "NOM_INSTITUCION_EDUCATIVA",
    lat_col:    "Latitud",
    lng_col:    "Longitud"
})
if sost_col: df = df.rename(columns={sost_col: "NOM_SOSTENIMIENTO"})
if prov_col: df = df.rename(columns={prov_col: "DPA_DESPRO"})
if reg_col:  df = df.rename(columns={reg_col:  "REGIMEN"})
if anio_col: df = df.rename(columns={anio_col: "ANIO_LECTIVO"})

# ========================================
# PASO 4: LIMPIEZA + VALIDACIÓN
# ========================================
print("\n" + "="*60)
print("🧹 LIMPIEZA Y VALIDACIÓN")
print("="*60)

df_clean = df[
    df["AMIE"].notna() &
    df["NOM_INSTITUCION_EDUCATIVA"].notna() &
    df["Latitud"].notna() &
    df["Longitud"].notna()
].copy()

df_clean["lat"] = pd.to_numeric(df_clean["Latitud"], errors="coerce")
df_clean["lng"] = pd.to_numeric(df_clean["Longitud"], errors="coerce")
df_clean = df_clean[df_clean["lat"].notna() & df_clean["lng"].notna()]

# Ecuador continental
df_clean = df_clean[df_clean["lat"].between(-5, 2) & df_clean["lng"].between(-82, -75)].copy()

print(f"✅ Instituciones válidas: {len(df_clean):,} / {len(df):,} ({len(df_clean)/max(len(df),1)*100:.1f}%)")
if len(df_clean):
    print(f"🌍 Latitud: {df_clean['lat'].min():.6f} a {df_clean['lat'].max():.6f}")
    print(f"🌍 Longitud: {df_clean['lng'].min():.6f} a {df_clean['lng'].max():.6f}")

# ========================================
# PASO 5: AGRUPAMIENTO POR PROXIMIDAD
# ========================================
print("\n" + "="*60)
print("📍 AGRUPAMIENTO (4 decimales ≈ 11m)")
print("="*60)

df_clean["lat_round"] = df_clean["lat"].round(4)
df_clean["lng_round"] = df_clean["lng"].round(4)
grupos = df_clean.groupby(["lat_round", "lng_round"], dropna=False)

def detectar_col_estudiantes(df_):
    for c in df_.columns:
        u = str(c).upper()
        if any(k in u for k in ["ESTUDIANT", "MATRICUL", "TOTAL ESTUDIANT"]):
            s = pd.to_numeric(df_[c], errors="coerce")
            if s.notna().any():
                return c
    return None

col_est = detectar_col_estudiantes(df_clean)

datos_para_mapa = []
for (latr, lngr), g in grupos:
    stats = {
        "lat": float(latr),
        "lng": float(lngr),
        "total_instituciones": int(len(g)),
        "sostenimiento": {},
        "provincias": {},
        "regimen": {},
        "instituciones_lista": list(g["NOM_INSTITUCION_EDUCATIVA"].astype(str).head(8))
    }
    if "NOM_SOSTENIMIENTO" in g.columns:
        c = g["NOM_SOSTENIMIENTO"].fillna("No especificado").value_counts()
        stats["sostenimiento"] = {str(k): int(v) for k, v in c.items()}
    else:
        stats["sostenimiento"] = {"No especificado": len(g)}
    if "DPA_DESPRO" in g.columns:
        c = g["DPA_DESPRO"].fillna("No especificado").value_counts()
        stats["provincias"] = {str(k): int(v) for k, v in c.items()}
    if "REGIMEN" in g.columns:
        c = g["REGIMEN"].fillna("No especificado").value_counts()
        stats["regimen"] = {str(k): int(v) for k, v in c.items()}
    if col_est:
        stats["estudiantes"] = int(pd.to_numeric(g[col_est], errors="coerce").fillna(0).sum())
    datos_para_mapa.append(stats)

print(f"✅ Total instituciones: {len(df_clean):,}")
print(f"✅ Puntos en el mapa: {len(datos_para_mapa):,}")

# ========================================
# PASO 6: ESTADÍSTICAS (estudiantes + año lectivo)
# ========================================
print("\n" + "="*60)
print("📈 ESTADÍSTICAS")
print("="*60)

total_instituciones = len(df_clean)
total_puntos = len(datos_para_mapa)
promedio_por_punto = int(round(total_instituciones / total_puntos)) if total_puntos else 0
lat_centro = float(df_clean["lat"].mean()) if len(df_clean) else -1.8312   # Quito aprox
lng_centro = float(df_clean["lng"].mean()) if len(df_clean) else -78.1834

if col_est:
    total_estudiantes = int(pd.to_numeric(df_clean[col_est], errors='coerce').fillna(0).sum())
    fuente_estudiantes = "reporte"
else:
    total_estudiantes = int(total_instituciones * 180)
    fuente_estudiantes = "estimación (180/IE)"

def inferir_anio_lectivo(df_):
    if "ANIO_LECTIVO" in df_.columns and df_["ANIO_LECTIVO"].notna().any():
        try:
            return str(df_["ANIO_LECTIVO"].dropna().astype(str).mode().iloc[0])
        except Exception:
            pass
    hoy = date.today(); y, m = hoy.year, hoy.month
    reg = None
    if "REGIMEN" in df_.columns and df_["REGIMEN"].notna().any():
        reg = df_["REGIMEN"].dropna().astype(str).str.upper().mode().iloc[0]
    corte = 3 if (reg and "COSTA" in reg) else 9
    return f"{y}-{y+1}" if m >= corte else f"{y-1}-{y}"

anio_lectivo = inferir_anio_lectivo(df_clean)

print(f"🏫 Instituciones: {total_instituciones:,}")
print(f"📍 Puntos: {total_puntos:,} | 📊 Promedio/punto: {promedio_por_punto}")
print(f"👥 Estudiantes: {total_estudiantes:,} ({fuente_estudiantes})")
print(f"📘 Año lectivo: {anio_lectivo}")
print(f"🎯 Centro: {lat_centro:.6f}, {lng_centro:.6f}")

# ========================================
# PASO 7: DIAGNÓSTICO RÁPIDO (opcional)
# ========================================
print("\n" + "="*60)
print("🔎 DIAGNÓSTICO DEL ARCHIVO")
print("="*60)

n_nulos_lat = df["Latitud"].isna().sum() if "Latitud" in df.columns else None
n_nulos_lng = df["Longitud"].isna().sum() if "Longitud" in df.columns else None
dup_amie = df_clean["AMIE"].astype(str).str.strip().duplicated().sum()

if "Latitud" in df.columns and "Longitud" in df.columns:
    lat0 = pd.to_numeric(df["Latitud"], errors="coerce")
    lng0 = pd.to_numeric(df["Longitud"], errors="coerce")
    oob = ~((lat0.between(-5,2)) & (lng0.between(-82,-75)))
    n_oob = int(oob.fillna(False).sum())
else:
    n_oob = None

print(f"• Filas totales: {len(df):,}")
if n_nulos_lat is not None:
    print(f"• Nulos Latitud: {n_nulos_lat:,} | Nulos Longitud: {n_nulos_lng:,}")
print(f"• AMIE duplicados (válidos): {dup_amie:,}")
if n_oob is not None:
    print(f"• Coordenadas fuera de Ecuador (previo a filtro): {n_oob:,}")

# ========================================
# PASO 8: GENERAR HTML (plantilla SIN f-strings)
# ========================================
print("\n" + "="*60)
print("🗺️ GENERANDO MAPA HTML")
print("="*60)

datos_json = json.dumps(datos_para_mapa, ensure_ascii=False)

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mapa de Instituciones Educativas - Ecuador</title>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css"/>
  <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin:0; padding:20px; background:linear-gradient(135deg,#667eea,#764ba2); min-height:100vh; }
    .container { max-width:1400px; margin:0 auto; background:#fff; border-radius:15px; padding:20px; box-shadow:0 15px 35px rgba(0,0,0,.1); }
    .header { text-align:center; margin-bottom:20px; padding:20px; background:linear-gradient(135deg,#667eea,#764ba2); border-radius:10px; color:#fff; }
    .header h1 { margin:0; font-size:2.2em; }
    .header p { margin:10px 0 0 0; opacity:.9; }
    .dashboard { display:grid; grid-template-columns:320px 1fr; gap:20px; height:700px; }
    .sidebar { background:#f8f9fa; border-radius:15px; padding:20px; overflow:auto; border:1px solid #e9ecef; }
    .map-container { border-radius:15px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,.1); }
    #map { height:100%; width:100%; }
    .stat-card { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:20px; border-radius:10px; margin-bottom:15px; text-align:center; box-shadow:0 4px 8px rgba(0,0,0,.1); }
    .stat-number { font-size:28px; font-weight:700; display:block; }
    .stat-label { font-size:14px; opacity:.9; margin-top:5px; }
    .chart-container { background:#fff; border:1px solid #ddd; border-radius:10px; padding:15px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,.05); }
    .chart-title { font-weight:700; margin-bottom:15px; text-align:center; color:#333; font-size:14px; }
    .chart-bar { margin-bottom:8px; }
    .chart-bar-label { font-size:12px; margin-bottom:3px; color:#555; }
    .chart-bar-fill { height:8px; border-radius:4px; transition:width .3s ease; background:#764ba2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Mapa de Instituciones Educativas - Ecuador</h1>
      <p>__TOTAL_PUNTOS__ puntos en el mapa • __TOTAL_INSTITUCIONES__ instituciones • 👥 __TOTAL_ESTUDIANTES__ estudiantes</p>
      <p style="font-size:14px;">Procesado: __TIMESTAMP__ • __ARCHIVO__</p>
    </div>

    <div class="dashboard">
      <div class="sidebar">
        <div class="stat-card">
          <span class="stat-number">__TOTAL_INSTITUCIONES__</span>
          <div class="stat-label">Instituciones</div>
        </div>
        <div class="stat-card">
          <span class="stat-number">__TOTAL_ESTUDIANTES__</span>
          <div class="stat-label">Total Estudiantes</div>
        </div>
        <div class="stat-card">
          <span class="stat-number">__ANIO_LECTIVO__</span>
          <div class="stat-label">Año lectivo</div>
        </div>

        <div class="chart-container">
          <div class="chart-title">Distribución por Sostenimiento</div>
          <div id="chart-sostenimiento"></div>
        </div>
        <div class="chart-container">
          <div class="chart-title">Top 8 Provincias</div>
          <div id="chart-provincias"></div>
        </div>
      </div>

      <div class="map-container">
        <div id="map"></div>
      </div>
    </div>
  </div>

  <script>
    const datos = __DATOS_JSON__;
    let mapa, clusterGroup;

    function initMap() {
      mapa = L.map('map').setView([__LAT_CENTRO__, __LNG_CENTRO__], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 18
      }).addTo(mapa);

      clusterGroup = L.markerClusterGroup({
        chunkedLoading: true, maxClusterRadius: 50, spiderfyOnMaxZoom: true,
        showCoverageOnHover: false, zoomToBoundsOnClick: true, disableClusteringAtZoom: 15
      });
      mapa.addLayer(clusterGroup);
      agregarMarcadores(datos);
      crearGraficos();
    }

    function colorPorSostenimiento(k) {
      const K = (k||'').toString().toUpperCase();
      if (K === 'FISCAL') return '#2e7d32';
      if (K === 'PARTICULAR') return '#d32f2f';
      if (K.indexOf('FISCOM')>=0) return '#f57c00';
      return '#1976d2';
    }

    function agregarMarcadores(datos) {
      clusterGroup.clearLayers();
      datos.forEach(inst => {
        const sostKey = Object.keys(inst.sostenimiento||{})[0] || 'No especificado';
        const color = colorPorSostenimiento(sostKey);
        const size = Math.min(Math.max(Math.sqrt(inst.total_instituciones)*2 + 6, 8), 25);

        const marker = L.circleMarker([inst.lat, inst.lng], {
          radius:size, fillColor:color, color:'#fff', weight:2, fillOpacity:0.85
        });

        const sostInfo = Object.entries(inst.sostenimiento||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+v).join(', ') || '—';
        const provInfo = Object.entries(inst.provincias||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>k+': '+v).join(', ') || '—';
        const regInfo  = Object.entries(inst.regimen||{}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k+': '+v).join(', ');
        const instTxt  = (inst.instituciones_lista||[]).map(n=>'• '+(n||'').substring(0,60)+((n||'').length>60?'…':'')).join('<br/>');

        let html = '<div style="width:360px;font-family:Arial,sans-serif;">'
                 + '<h4 style="margin:0 0 8px;color:'+color+';">Ubicación Educativa</h4>'
                 + '<p style="margin:4px 0;"><b>Instituciones:</b> '+inst.total_instituciones+'</p>'
                 + '<p style="margin:4px 0;"><b>Sostenimiento:</b> '+sostInfo+'</p>'
                 + '<p style="margin:4px 0;"><b>Provincias:</b> '+provInfo+'</p>';
        if (regInfo) html += '<p style="margin:4px 0;"><b>Régimen:</b> '+regInfo+'</p>';
        if (typeof inst.estudiantes === 'number') {
          html += '<p style="margin:4px 0;"><b>Estudiantes (grupo):</b> '+inst.estudiantes.toLocaleString()+'</p>';
        }
        html += '<p style="margin:4px 0;"><b>Instituciones en esta ubicación:</b></p>'
             +  '<div style="font-size:11px;max-height:120px;overflow:auto;background:#f8f9fa;padding:6px;border-radius:4px;">'
             +  instTxt + '</div></div>';

        marker.bindPopup(html);
        clusterGroup.addLayer(marker);
      });
    }

    function crearGraficos() {
      const totS = {};
      datos.forEach(inst => { Object.entries(inst.sostenimiento||{}).forEach(([s,c]) => totS[s]=(totS[s]||0)+c); });
      const cS = document.getElementById('chart-sostenimiento'); cS.innerHTML='';
      const sumS = Object.values(totS).reduce((a,b)=>a+b,0) || 1;
      Object.entries(totS).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
        const pct = (v/sumS*100).toFixed(1);
        const d = document.createElement('div'); d.className='chart-bar';
        d.innerHTML = '<div class="chart-bar-label">'+k+': '+v.toLocaleString()+' ('+pct+'%)</div>'
                    + '<div class="chart-bar-fill" style="width:'+pct+'%;"></div>';
        cS.appendChild(d);
      });

      const totP = {};
      datos.forEach(inst => { Object.entries(inst.provincias||{}).forEach(([p,c]) => totP[p]=(totP[p]||0)+c); });
      const cP = document.getElementById('chart-provincias'); cP.innerHTML='';
      const top = Object.entries(totP).sort((a,b)=>b[1]-a[1]).slice(0,8);
      const maxv = top.length ? top[0][1] : 1;
      top.forEach(([k,v])=>{
        const pct = v/maxv*100;
        const d = document.createElement('div'); d.className='chart-bar';
        d.innerHTML = '<div class="chart-bar-label">'+k.substring(0,18)+': '+v.toLocaleString()+'</div>'
                    + '<div class="chart-bar-fill" style="width:'+pct+'%;"></div>';
        cP.appendChild(d);
      });
    }

    document.addEventListener('DOMContentLoaded', initMap);
  </script>
</body>
</html>
"""

timestamp_str = datetime.now().strftime('%d/%m/%Y %H:%M')
html_content = (HTML_TEMPLATE
  .replace("__TOTAL_PUNTOS__", f"{total_puntos:,}")
  .replace("__TOTAL_INSTITUCIONES__", f"{total_instituciones:,}")
  .replace("__TOTAL_ESTUDIANTES__", f"{total_estudiantes:,}")
  .replace("__TIMESTAMP__", timestamp_str)
  .replace("__ARCHIVO__", str(filename))
  .replace("__LAT_CENTRO__", f"{lat_centro:.6f}")
  .replace("__LNG_CENTRO__", f"{lng_centro:.6f}")
  .replace("__DATOS_JSON__", datos_json)
  .replace("__ANIO_LECTIVO__", str(anio_lectivo))
)

# ========================================
# PASO 9: GUARDAR + DESCARGAR (con fallback)
# ========================================
print("\n" + "="*60)
print("💾 GUARDANDO Y DESCARGANDO")
print("="*60)

out_name = f"mapa_instituciones_ecuador_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
with open(out_name, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"✅ Archivo generado: {out_name}")
try:
    files.download(out_name)  # método Colab
    print("⬇️ Descarga iniciada (si no aparece, mira el icono de descargas del navegador).")
except Exception as e:
    print(f"⚠️ files.download falló: {e}\nMostrando enlace de respaldo…")
    display(_HTML(f'<a href="/content/{out_name}" download target="_blank">👉 Descargar {out_name}</a>'))
    display(IFrame(src=f"/content/{out_name}", width="100%", height="500"))

