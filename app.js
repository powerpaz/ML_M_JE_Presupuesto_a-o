// ------------ Config ------------
const DATA_XLSX = 'base_cruce.xlsx';
const PROVINCIAS_GEOJSON = 'provincias.geojson';

// Si tus X/Y están en 17S por defecto, deja 17. Si usas 18S, cámbialo a 18.
// El detector igual intenta inferir automáticamente por valores.
const DEFAULT_UTM_ZONE = 17; // 17S o 18S

// Aliases de campos
const FIELD_MAP = {
  lat:  ['lat','latitude','y','coord_y','coordenada_y','LAT'],
  lon:  ['lon','long','lng','x','coord_x','coordenada_x','LON'],
  x:    ['x','este','este_utm','coord_x','coordenada x','coordenada_x','X'],
  y:    ['y','norte','norte_utm','coord_y','coordenada y','coordenada_y','Y'],
  amie: ['amie','codigo','codigo_amie','AMIE'],
  nombre:['nombre','institucion','establecimiento','NOMBRE'],
  tipo: ['tipo','TIPO'],
  sostenimiento:['sostenimiento','SOSTENIMIENTO'],
  provincia:['provincia','PROVINCIA'],
  canton:['canton','cantón','CANTON','CANTÓN'],
  parroquia:['parroquia','PARROQUIA'],
  zona:['zona','utm_zona','utmzone','ZONA'] // opcional si viene la zona en la tabla
};

let map, provinciasLayer, markersLayer;
let dataRows = [];
let filteredRows = [];

// ------------ Utiles ------------
function money(n){ try { return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(n); } catch(e){ return '$ ' + n; } }
function updateKpis(){
  const mat = 2918.26, mob = 1528.00, jue = 5748.00;
  document.getElementById('kpi-total').innerText = money(mat + mob + jue);
}

function initMap(){
  map = L.map('map',{ zoomControl:true }).setView([-1.6,-78.6], 6);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20});
  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20});
  osm.addTo(map);
  L.control.layers({'OSM':osm,'Satellite':esri},{}).addTo(map);
}

async function loadProvincias(){
  const resp = await fetch(PROVINCIAS_GEOJSON);
  const gj = await resp.json();
  provinciasLayer = L.geoJSON(gj, { style:{ color:'#233142', weight:1, fillColor:'#101a26', fillOpacity:0.2 } }).addTo(map);
  try { map.fitBounds(provinciasLayer.getBounds()); } catch(e){}
}

// alias finder
function findField(obj, aliases){
  const keys = Object.keys(obj);
  for (let a of aliases){
    const k = keys.find(k=>k.toLowerCase()===a.toLowerCase());
    if(k) return k;
  }
  for (let a of aliases){
    const k = keys.find(k=>k.toLowerCase().includes(a.toLowerCase()));
    if(k) return k;
  }
  return null;
}

// UTM -> WGS84
function utmToWgs84(E, N, zone, hemisphere='S'){
  // EPSG 327xx = WGS84 / UTM zone xxS  (sur)
  // EPSG 326xx = WGS84 / UTM zone xxN  (norte)
  const epsg = (hemisphere === 'S') ? `EPSG:327${zone}` : `EPSG:326${zone}`;
  // define proj si no existe
  const defs = {
    'EPSG:32717': '+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs',
    'EPSG:32718': '+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs',
    'EPSG:32617': '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs',
    'EPSG:32618': '+proj=utm +zone=18 +datum=WGS84 +units=m +no_defs'
  };
  if(!proj4.defs[epsg] && defs[epsg]) proj4.defs(epsg, defs[epsg]);
  const p = proj4(epsg, 'EPSG:4326', [E, N]); // [lon, lat]
  return { lon: p[0], lat: p[1] };
}

// detecta si son UTM por rangos típicos
function isProbablyUTM(x, y){
  // Este ~ 150k..850k ; Norte ~ 9.7e6..1.05e7 en Ecuador (aprox)
  return isFinite(x) && isFinite(y) && x>10000 && x<1000000 && y>9000000 && y<11000000;
}

// normaliza filas (desde objeto XLSX/Supabase)
function normalizeRow(r, fm){
  const out = {};
  // valores crudos
  const raw = {};
  Object.keys(r).forEach(k=> raw[k] = r[k]);

  const lat = parseFloat(r[fm.lat]);
  const lon = parseFloat(r[fm.lon]);
  const X = parseFloat(r[fm.x]);
  const Y = parseFloat(r[fm.y]);
  const zona = r[fm.zona] ? parseInt(r[fm.zona]) : null;

  let latOK=null, lonOK=null;

  if(isFinite(lat) && isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180){
    latOK = lat; lonOK = lon;
  } else if(isProbablyUTM(X, Y)){
    const zone = zona || DEFAULT_UTM_ZONE;
    const {lat:lat2, lon:lon2} = utmToWgs84(X, Y, zone, 'S');
    latOK = lat2; lonOK = lon2;
  }

  out.lat = latOK;
  out.lon = lonOK;

  out.amie = r[fm.amie] ?? '';
  out.nombre = r[fm.nombre] ?? '';
  out.tipo = r[fm.tipo] ?? '';
  out.sostenimiento = r[fm.sostenimiento] ?? '';
  out.provincia = r[fm.provincia] ?? '';
  out.canton = r[fm.canton] ?? '';
  out.parroquia = r[fm.parroquia] ?? '';
  out.__raw = raw; // para popup completo
  return out;
}

// Carga desde XLSX
async function loadFromXlsx(){
  const resp = await fetch(DATA_XLSX);
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  if(!rows.length) return [];
  const fm = {};
  Object.entries(FIELD_MAP).forEach(([k,aliases])=> fm[k] = findField(rows[0], aliases));
  return rows.map(r=> normalizeRow(r,fm)).filter(d=> isFinite(d.lat) && isFinite(d.lon));
}

// Carga desde Supabase (si existe window.env)
async function loadFromSupabase(){
  if(typeof window.env === 'undefined' || !window.env.SUPABASE_URL || !window.env.SUPABASE_KEY){
    return null;
  }
  const url = window.env.SUPABASE_URL;
  const key = window.env.SUPABASE_KEY;
  // Simple fetch a la REST API de Supabase (table: base_cruce, select all)
  const res = await fetch(`${url}/rest/v1/base_cruce?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if(!res.ok){ console.warn('Supabase error', await res.text()); return []; }
  const rows = await res.json();
  if(!rows.length) return [];
  const fm = {};
  Object.entries(FIELD_MAP).forEach(([k,aliases])=> fm[k] = findField(rows[0], aliases));
  return rows.map(r=> normalizeRow(r,fm)).filter(d=> isFinite(d.lat) && isFinite(d.lon));
}

// UI listas
function populateFilters(rows){
  function uniq(vals){ return Array.from(new Set(vals.filter(v=>v && v!==''))).sort(); }
  const prov = uniq(rows.map(r=>r.provincia));
  const cant = uniq(rows.map(r=>r.canton));
  const parr = uniq(rows.map(r=>r.parroquia));
  const sost = uniq(rows.map(r=>r.sostenimiento));
  function fill(sel, list, label){
    const el = document.getElementById(sel);
    el.innerHTML = `<option value="">${label}</option>` + list.map(v=>`<option>${v}</option>`).join('');
  }
  fill('filtro-prov', prov, 'Provincia');
  fill('filtro-cant', cant, 'Cantón');
  fill('filtro-parr', parr, 'Parroquia');
  fill('filtro-sost', sost, 'Sostenimiento');
}

function renderTable(rows){
  const tbody = document.querySelector('#tabla tbody');
  tbody.innerHTML = rows.map((r,idx)=>`
    <tr data-idx="${idx}">
      <td>${r.amie||''}</td>
      <td>${r.nombre||''}</td>
      <td>${r.tipo||''}</td>
      <td>${r.sostenimiento||''}</td>
      <td>${r.provincia||''}</td>
      <td>${r.canton||''}</td>
      <td>${r.parroquia||''}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      const idx = parseInt(tr.getAttribute('data-idx'));
      const row = rows[idx];
      map.setView([row.lat,row.lon], 15);
      // abre popup del marcador correspondiente
      markersLayer.eachLayer(l=>{
        if(l.getLatLng && Math.abs(l.getLatLng().lat-row.lat)<1e-8 && Math.abs(l.getLatLng().lng-row.lon)<1e-8){
          l.openPopup();
        }
      });
    });
  });
  document.getElementById('sel-count').innerText = 'Filas: ' + rows.length;
}

function renderMarkers(rows){
  if(markersLayer) markersLayer.remove();
  markersLayer = L.layerGroup();

  rows.forEach(r=>{
    // Etiqueta permanente con AMIE
    const marker = L.circleMarker([r.lat, r.lon], {
      radius:6, color:'#1DB954', weight:2, fillColor:'#1DB954', fillOpacity:0.35
    });
    marker.bindTooltip(r.amie || '—', {permanent:true, direction:'top', offset:[0,-8], className:'amie-label'});
    // Popup con TODAS las columnas
    const kv = Object.entries(r.__raw || {}).map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v==null?'':v}</td></tr>`).join('');
    marker.bindPopup(`<div style="max-height:240px;overflow:auto">
      <b>${r.nombre||'—'}</b><br/>AMIE: ${r.amie||'—'}<hr/>
      <table class="popup-table">${kv}</table>
    </div>`);
    markersLayer.addLayer(marker);
  });
  markersLayer.addTo(map);
}

// filtro
function doFilter(){
  const p = document.getElementById('filtro-prov').value;
  const c = document.getElementById('filtro-cant').value;
  const pr = document.getElementById('filtro-parr').value;
  const s = document.getElementById('filtro-sost').value;
  const qA = document.getElementById('buscar-amie').value.trim().toLowerCase();
  const qN = document.getElementById('buscar-nombre').value.trim().toLowerCase();
  filteredRows = dataRows.filter(r=>{
    return (!p || r.provincia===p) &&
           (!c || r.canton===c) &&
           (!pr || r.parroquia===pr) &&
           (!s || r.sostenimiento===s) &&
           (!qA || (r.amie||'').toLowerCase().includes(qA)) &&
           (!qN || (r.nombre||'').toLowerCase().includes(qN));
  });
  renderTable(filteredRows);
  renderMarkers(filteredRows);
}

function exportCSV(){
  const header = ['amie','nombre','tipo','sostenimiento','provincia','canton','parroquia','lat','lon'];
  const rows = [header.join(',')].concat(filteredRows.map(r=> header.map(h=> (r[h]??'')).join(',')));
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'seleccion.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function bootstrap(){
  updateKpis();
  initMap();
  await loadProvincias();

  // Prioriza Supabase si existe config
  const fromSupabase = await loadFromSupabase();
  dataRows = (fromSupabase && fromSupabase.length) ? fromSupabase : await loadFromXlsx();

  if(!dataRows.length){
    alert('No se encontraron filas válidas (revisa columnas lat/lon o UTM X/Y).');
  }
  populateFilters(dataRows);
  filteredRows = dataRows.slice();
  renderTable(filteredRows);
  renderMarkers(filteredRows);

  document.getElementById('btn-buscar').addEventListener('click', doFilter);
  document.getElementById('btn-limpiar').addEventListener('click', ()=>{
    ['filtro-prov','filtro-cant','filtro-parr','filtro-sost','buscar-amie','buscar-nombre'].forEach(id=>{ document.getElementById(id).value=''; });
    doFilter();
  });
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('toggle-panel').addEventListener('click', ()=>{
    const panel = document.querySelector('.panel');
    if(panel.style.display==='none'){ panel.style.display='flex'; document.getElementById('toggle-panel').innerText='Ocultar'; }
    else { panel.style.display='none'; document.getElementById('toggle-panel').innerText='Mostrar'; }
  });
}

bootstrap();
