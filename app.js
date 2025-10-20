// Config
const XLSX_PATH = 'base_cruce.xlsx';
const SHEET_NAME = 'Hoja1';
const PROV_GEOJSON = 'provincias.geojson';

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

const PROV_NAME_CAND = ['DPA_DESPRO','PROVINCIA','prov_name'];

// State
let RAW_ROWS = [];
let COLS = [];
let MAP, CLUSTER, PROV_LAYER;

// Utils
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
  for(const name of cols){
    const up = norm(name);
    if(candidates.some(c => up.includes(norm(c).split(' ')[0]))) return name;
  }
  return null;
}

// Map
function initMap(){
  MAP = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap'
  }).addTo(MAP);
  CLUSTER = L.markerClusterGroup();
  CLUSTER.addTo(MAP);
  MAP.setView([-1.8, -78.2], 6);
}

async function loadProvinces(){
  try{
    const res = await fetch(PROV_GEOJSON);
    if(!res.ok) throw new Error('No se pudo cargar provincias.geojson');
    const gj = await res.json();
    const nameKey = pick(Object.keys(gj.features?.[0]?.properties||{}), PROV_NAME_CAND) || 'DPA_DESPRO';
    PROV_LAYER = L.geoJSON(gj, {
      style: { color:'#21335c', weight:1, fill:false, opacity:.7 },
      onEachFeature: (f, layer) => {
        const nm = f.properties?.[nameKey] ?? '';
        layer.bindTooltip(String(nm), {sticky:true, direction:'auto'});
      }
    }).addTo(MAP);
  }catch(e){
    console.warn(e);
  }
}

// Filtering
function uniqueSorted(arr){
  return Array.from(new Set(arr.filter(x => x!=null && x!==''))).sort((a,b)=> String(a).localeCompare(String(b),'es'));
}

function currentFilters(){
  const amie = document.getElementById('amieTxt').value.trim();
  const prov = document.getElementById('provSel').value;
  const cant = document.getElementById('cantSel').value;
  return { amie, prov, cant };
}

function applyFilters(rows){
  const {amie, prov, cant} = currentFilters();
  const colAmie = pick(COLS, CAND_AMIE);
  const colProv = pick(COLS, CAND_PROV);
  const colCant = pick(COLS, CAND_CANT);
  return rows.filter(r => {
    let ok = true;
    if(amie) ok = ok && String(r[colAmie]??'').toUpperCase().includes(amie.toUpperCase());
    if(prov) ok = ok && String(r[colProv]??'') === prov;
    if(cant) ok = ok && String(r[colCant]??'') === cant;
    return ok;
  });
}

function updateFilterUI(rows){
  const colProv = pick(COLS, CAND_PROV);
  const colCant = pick(COLS, CAND_CANT);
  const provSel = document.getElementById('provSel');
  const cantSel = document.getElementById('cantSel');

  const provs = uniqueSorted(rows.map(r => r[colProv]));
  provSel.innerHTML = '<option value="">Todas</option>' + provs.map(p => `<option>${p}</option>`).join('');

  // On province change, cascade cantons
  provSel.onchange = () => {
    const pv = provSel.value;
    const cantValues = uniqueSorted(RAW_ROWS.filter(r => !pv || r[colProv]===pv).map(r => r[colCant]));
    cantSel.innerHTML = '<option value="">Todos</option>' + cantValues.map(c => `<option>${c}</option>`).join('');
    renderAll(); // re-render with filter
  };

  // Initial cantons for all
  const cantValues = uniqueSorted(RAW_ROWS.map(r => r[colCant]));
  cantSel.innerHTML = '<option value="">Todos</option>' + cantValues.map(c => `<option>${c}</option>`).join('');
  cantSel.onchange = renderAll;

  const amieTxt = document.getElementById('amieTxt');
  amieTxt.oninput = () => { renderAll(false /*preserve view*/); };

  document.getElementById('btnLimpiar').onclick = () => {
    amieTxt.value = ''; provSel.value = ''; cantSel.value='';
    renderAll();
  };
}

function renderTable(rows){
  const colMD = pick(COLS, CAND_MD);
  const colM  = pick(COLS, CAND_M);
  const colJE = pick(COLS, CAND_JE);
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
}

function renderMap(rows, preserveView=false){
  const colLat = pick(COLS, CAND_LAT);
  const colLon = pick(COLS, CAND_LON);
  const colName = pick(COLS, CAND_NOMBRE);
  const colAmie = pick(COLS, CAND_AMIE);
  const colProv = pick(COLS, CAND_PROV);
  const colCant = pick(COLS, CAND_CANT);
  const colMD = pick(COLS, CAND_MD);
  const colM  = pick(COLS, CAND_M);
  const colJE = pick(COLS, CAND_JE);

  CLUSTER.clearLayers();
  const markers = [];
  for(const r of rows){
    const lat = toNum(r[colLat]);
    const lon = toNum(r[colLon]);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const popup = `
      <div style="min-width:220px">
        <div style="font-weight:700">${r[colName]??''}</div>
        <div class="muted">AMIE: <b>${r[colAmie]??''}</b></div>
        <div class="muted">Provincia: ${r[colProv]??''} • Cantón: ${r[colCant]??''}</div>
        <hr style="border:none;border-top:1px solid #eaeef5;margin:6px 0"/>
        <div>Material Lúdico: <b>${formatoUSD_ES(Number(r[colMD])||0)}</b></div>
        <div>Mobiliario: <b>${formatoUSD_ES(Number(r[colM])||0)}</b></div>
        <div>Juegos Exteriores: <b>${formatoUSD_ES(Number(r[colJE])||0)}</b></div>
      </div>`;
    const m = L.marker([lat, lon]).bindPopup(popup);
    CLUSTER.addLayer(m); markers.push(m);
  }
  document.getElementById('countInstituciones').textContent = `Instituciones: ${markers.length}`;

  if(!preserveView){
    if(markers.length){
      const g = L.featureGroup(markers);
      MAP.fitBounds(g.getBounds().pad(0.15));
    } else {
      MAP.setView([-1.8,-78.2],6);
    }
  }
}

function describeFilters(){
  const {amie,prov,cant} = currentFilters();
  const arr = [];
  if(amie) arr.push(`AMIE contiene “${amie}”`);
  if(prov) arr.push(`PROVINCIA = ${prov}`);
  if(cant) arr.push(`CANTÓN = ${cant}`);
  return arr.length ? arr.join(' • ') : '—';
}

function renderAll(preserveView=false){
  const rows = applyFilters(RAW_ROWS);
  renderTable(rows);
  renderMap(rows, preserveView);
  document.getElementById('filtrosActivos').textContent = 'Filtros activos: ' + describeFilters();
  const btn = document.getElementById('btnExport');
  if(btn){
    const colMD = pick(COLS, CAND_MD), colM=pick(COLS, CAND_M), colJE=pick(COLS, CAND_JE);
    btn.onclick = () => {
      // exportar rubros filtrados (sumas)
      let sumMD=0,sumM=0,sumJE=0;
      for(const r of rows){ sumMD+=Number(r[colMD])||0; sumM+=Number(r[colM])||0; sumJE+=Number(r[colJE])||0; }
      const out = [
        { nombre:'C2: Rubro 2.3.1 MATERIAL LÚDICO (DIDÁCTICO)', costo:sumMD },
        { nombre:'C2: Rubro 2.3.2 MOBILIARIO', costo:sumM },
        { nombre:'C2: Rubro 2.3.3 JUEGOS EXTERIORES (EQUIPAMIENTO)', costo:sumJE },
      ];
      const header = 'rubro,costo_usd\n';
      const lines = out.map(r => `${(r.nombre||'').replaceAll(',', ' ')} , ${Number(r.costo)||0}`);
      const csv = header + lines.join('\n');
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download='rubros_c2_filtrado.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  }
}

async function loadWorkbook(){
  const st = document.getElementById('status');
  try{
    st && (st.textContent = 'Descargando Excel…');
    const res = await fetch(XLSX_PATH);
    if(!res.ok) throw new Error('No se pudo descargar base_cruce.xlsx');
    const ab = await res.arrayBuffer();
    st && (st.textContent = 'Leyendo…');
    const wb = XLSX.read(ab, { type:'array' });
    const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    RAW_ROWS = XLSX.utils.sheet_to_json(ws, { defval:0 });
    if(RAW_ROWS.length===0) throw new Error('Hoja vacía o no legible');

    COLS = Object.keys(RAW_ROWS[0]);
    updateFilterUI(RAW_ROWS);
    renderAll();
    st && (st.textContent = 'Listo');
  }catch(e){
    console.error(e);
    st && (st.textContent = String(e.message||e));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadProvinces();
  await loadWorkbook();
});
