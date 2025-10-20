// Config
const XLSX_PATH = 'base_cruce.xlsx';
const SHEET_NAME = 'Hoja1';

// Column candidates
const CAND_MD = ['MD_MONTO USD$', 'MD_MONTO USD', 'MD_MONTO_USD', 'MD_MONTO'];
const CAND_M  = ['M_MONTO USD$',  'M_MONTO USD',  'M_MONTO_USD',  'M_MONTO'];
const CAND_JE = ['JE_MONTO USD$', 'JE_MONTO USD', 'JE_MONTO_USD', 'JE_MONTO'];
const CAND_LAT = ['LATITUD','LAT','Y','LATITUD DD','LATITUD_DECIMAL'];
const CAND_LON = ['LONGITUD','LON','X','LONGITUD DD','LONGITUD_DECIMAL'];
const CAND_NOMBRE = ['INSTITUCION','NOMBRE','NOMBRE IE','NOMBRE_INSTITUCION'];
const CAND_AMIE = ['AMIE','CODIGO AMIE','COD_AMIE','CODIGO'];
const CAND_PROV = ['PROVINCIA','DPA_DESPRO'];
const CAND_CANT = ['CANTON','DPA_DESCAN'];

function norm(s){ return (s??'').toString().trim().toUpperCase(); }
function formatoUSD_ES(value){
  try { return new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' }).format(value); }
  catch(e){ return `$${(+value||0).toFixed(2)}`; }
}
function toNum(v){
  if (typeof v === 'number') return v;
  const s = String(v??'').replace(/\s/g,'').replace(',','.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function pick(cols, candidates){
  const set = new Set(cols.map(norm));
  for(const c of candidates){
    if(set.has(norm(c))) return c;
  }
  // Fuzzy contains
  for(const name of cols){
    const up = norm(name);
    if(candidates.some(c => up.includes(norm(c).split(' ')[0]))) return name;
  }
  return null;
}

// Map
let map, cluster;
function initMap(){
  map = L.map('map', { zoomControl: true });
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  cluster = L.markerClusterGroup();
  cluster.addTo(map);
  // Ecuador view approx
  map.setView([-1.8, -78.2], 6);
}

function addMarkers(rows, cols){
  const colLat = pick(cols, CAND_LAT);
  const colLon = pick(cols, CAND_LON);
  const colName = pick(cols, CAND_NOMBRE);
  const colAmie = pick(cols, CAND_AMIE);
  const colProv = pick(cols, CAND_PROV);
  const colCant = pick(cols, CAND_CANT);

  const colMD = pick(cols, CAND_MD);
  const colM  = pick(cols, CAND_M);
  const colJE = pick(cols, CAND_JE);

  const markers = [];
  for(const r of rows){
    const lat = toNum(r[colLat]);
    const lon = toNum(r[colLon]);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const name = r[colName] ?? '';
    const amie = r[colAmie] ?? '';
    const prov = r[colProv] ?? '';
    const cant = r[colCant] ?? '';

    const md = Number(r[colMD])||0;
    const m  = Number(r[colM])||0;
    const je = Number(r[colJE])||0;

    const popup = `
      <div style="min-width:220px">
        <div style="font-weight:700">${name}</div>
        <div class="muted">AMIE: <b>${amie}</b></div>
        <div class="muted">Provincia: ${prov} • Cantón: ${cant}</div>
        <hr style="border:none;border-top:1px solid #eaeef5;margin:6px 0"/>
        <div>Material Lúdico: <b>${formatoUSD_ES(md)}</b></div>
        <div>Mobiliario: <b>${formatoUSD_ES(m)}</b></div>
        <div>Juegos Exteriores: <b>${formatoUSD_ES(je)}</b></div>
      </div>
    `;

    const marker = L.marker([lat, lon]);
    marker.bindPopup(popup);
    cluster.addLayer(marker);
    markers.push(marker);
  }

  if(markers.length){
    const g = L.featureGroup(markers);
    map.fitBounds(g.getBounds().pad(0.15));
    document.getElementById('countInstituciones').textContent = `Instituciones: ${markers.length}`;
  } else {
    document.getElementById('countInstituciones').textContent = `Instituciones: 0`;
  }
}

function renderTableFromRows(rows, cols){
  const colMD = pick(cols, CAND_MD);
  const colM  = pick(cols, CAND_M);
  const colJE = pick(cols, CAND_JE);

  let sumMD = 0, sumM = 0, sumJE = 0;
  for(const r of rows){
    sumMD += Number(r[colMD])||0;
    sumM  += Number(r[colM])||0;
    sumJE += Number(r[colJE])||0;
  }

  const data = [
    { nombre: 'C2: Rubro 2.3.1 MATERIAL LÚDICO (DIDÁCTICO)', costo: sumMD },
    { nombre: 'C2: Rubro 2.3.2 MOBILIARIO', costo: sumM },
    { nombre: 'C2: Rubro 2.3.3 JUEGOS EXTERIORES (EQUIPAMIENTO)', costo: sumJE },
  ];

  const tbody = document.querySelector('#rubrosTable tbody');
  const totalCell = document.getElementById('totalCell');
  const totalKPI = document.getElementById('totalKPI');

  let total = 0;
  tbody.innerHTML = data.map(r => {
    total += Number(r.costo)||0;
    return `<tr><td>${r.nombre}</td><td><b>${formatoUSD_ES(r.costo)}</b></td></tr>`;
  }).join('');

  const totalFmt = formatoUSD_ES(total);
  if(totalCell) totalCell.textContent = totalFmt;
  if(totalKPI) totalKPI.textContent = totalFmt;

  const btn = document.getElementById('btnExport');
  if(btn){
    btn.onclick = () => exportCSV(data);
  }
}

function exportCSV(rows){
  const header = 'rubro,costo_usd\n';
  const lines = rows.map(r => `${(r.nombre||'').replaceAll(',', ' ')} , ${Number(r.costo)||0}`);
  const csv = header + lines.join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'rubros_c2_desde_base_cruce.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function loadWorkbook(){
  const st = document.getElementById('status');
  try{
    st && (st.textContent = 'Descargando…');
    const res = await fetch(XLSX_PATH);
    if(!res.ok) throw new Error('No se pudo descargar base_cruce.xlsx');
    const ab = await res.arrayBuffer();
    st && (st.textContent = 'Leyendo…');
    const wb = XLSX.read(ab, { type:'array' });
    const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval:0 });

    if(rows.length === 0) throw new Error('Hoja vacía o no legible');

    const cols = Object.keys(rows[0]);
    renderTableFromRows(rows, cols);
    addMarkers(rows, cols);
    st && (st.textContent = 'Listo');
  }catch(e){
    console.error(e);
    st && (st.textContent = String(e.message||e));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadWorkbook();
});
