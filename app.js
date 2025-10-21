// Config
const DATA_PATH = "./data/instituciones.csv";

let map, cluster, allMarkers = [], dataRows = [];

function initMap(){
  map = L.map('map').setView([-1.8, -78.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  cluster = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
  map.addLayer(cluster);

  document.getElementById('chk-costa').addEventListener('change', refresh);
  document.getElementById('chk-sierra').addEventListener('change', refresh);
  document.getElementById('sel-zona').addEventListener('change', refresh);
  document.getElementById('sel-anio').addEventListener('change', refresh);

  Papa.parse(DATA_PATH, {
    download: true, header: true, dynamicTyping: false, skipEmptyLines: true,
    complete: (res) => {
      dataRows = res.data;
      populateFilters();
      buildMarkers();
    }
  });
}

function normKey(k){
  return (k||"").toString().trim().toLowerCase().replace(/\s+|[.\-]/g,'_');
}
function getVal(row, names){
  for(const n of names){
    const key = Object.keys(row).find(k => normKey(k) === normKey(n));
    if(key && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return undefined;
}
function parseNumber(val){
  if(val === undefined || val === null) return undefined;
  let s = String(val).trim();
  if(!s) return undefined;
  s = s.replace(/[^0-9,.\-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if(lastComma > lastDot){ s = s.replace(/\./g,'').replace(',', '.'); }
  else { s = s.replace(/,/g,''); }
  const num = Number(s);
  return Number.isFinite(num) ? num : undefined;
}
function formatCurrency(n){
  if(n === undefined) return '—';
  return n.toLocaleString('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function regimeColor(reg){
  const r = (reg||"").toString().trim().toUpperCase();
  if(r === "COSTA") return "#d40000";
  if(r === "SIERRA") return "#f4d03f";
  return "#666";
}

function populateFilters(){
  const selZona = document.getElementById('sel-zona');
  const selAnio = document.getElementById('sel-anio');
  const zonas = new Set();
  const anios = new Set();
  for(const row of dataRows){
    const z = getVal(row, ['zona','zona_educativa','zona_adm','zona_apit','region','área','ZONA']);
    if(z !== undefined && String(z).trim() !== '') zonas.add(String(z).trim());
    const a = getVal(row, ['AUX_AÑO DE DOTACIÓN','aux_año_de_dotación','aux_año_dotación','aux_anio_de_dotacion','anio_dotacion','año_dotación','anio_de_dotacion']);
    if(a !== undefined && String(a).trim() !== '') anios.add(String(a).trim());
  }
  if(zonas.size === 0){ selZona.parentElement.style.display = 'none'; }
  else { [...zonas].sort((a,b)=>a.localeCompare(b)).forEach(z => {
      const opt = document.createElement('option'); opt.value = z; opt.textContent = z; selZona.appendChild(opt);
    });
  }
  if(anios.size === 0){ selAnio.parentElement.style.display = 'none'; }
  else { [...anios].sort((a,b)=>a.localeCompare(b)).forEach(a => {
      const opt = document.createElement('option'); opt.value = a; opt.textContent = a; selAnio.appendChild(opt);
    });
  }
}

function buildMarkers(){
  cluster.clearLayers();
  allMarkers = [];

  let bounds = [];
  dataRows.forEach((row) => {
    const lat = parseFloat(getVal(row, ['lat','latitude','y']));
    const lon = parseFloat(getVal(row, ['lon','lng','long','x']));
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const nombre = getVal(row, ['nombre','name','ie','institucion']) || '—';
    const amie   = getVal(row, ['amie','codigo_amie','cod_amie']) || '—';
    const regimen = (getVal(row, ['regimen','régimen']) || '').toString().toUpperCase();
    const zona = getVal(row, ['zona','zona_educativa','zona_adm','zona_apit','region','área','ZONA']);
    const anio = getVal(row, ['AUX_AÑO DE DOTACIÓN','aux_año_de_dotación','aux_año_dotación','aux_anio_de_dotacion','anio_dotacion','año_dotación','anio_de_dotacion']);

    const aux = getVal(row, ['AUX_T_IE','AUX_T. IE','aux_t_ie','aux_t_ie_']);
    const y2026 = getVal(row, ['2026','y2026','anio_2026','anio2026']);
    const y2027 = getVal(row, ['2027','y2027','anio_2027','anio2027']);
    const total = getVal(row, ['total','TOTAL','suma_total']);

    // Rubros
    const vML = parseNumber(getVal(row, ['material_ludico','material_lúdico','ml','c2_rubro_2_3_1','rubro_2_3_1']));
    const vMo = parseNumber(getVal(row, ['mobiliario','mo','c2_rubro_2_3_2','rubro_2_3_2']));
    const vJE = parseNumber(getVal(row, ['juegos_exteriores','juegos_exteriores_(equipamiento)','je','c2_rubro_2_3_3','rubro_2_3_3']));
    const rubroSum = [vML,vMo,vJE].reduce((acc,v)=>acc + (Number.isFinite(v)?v:0), 0);
    const hasRubro = [vML,vMo,vJE].some(v=>Number.isFinite(v));

    const marker = L.circleMarker([lat, lon], {
      radius: 6, weight: 1, color: '#111', fillColor: regimeColor(regimen), fillOpacity: 0.9
    });

    const rows = [];
    rows.push(['AMIE', amie]);
    rows.push(['Nombre', nombre]);
    if(regimen) rows.push(['Régimen', regimen]);
    if(zona !== undefined) rows.push(['Zona', zona]);
    if(anio !== undefined) rows.push(['Año de dotación', anio]);
    if(aux !== undefined) rows.push(['AUX_T_IE', aux]);
    if(y2026 !== undefined) rows.push(['2026', y2026]);
    if(y2027 !== undefined) rows.push(['2027', y2027]);
    if(total !== undefined) rows.push(['Total', total]);
    if(hasRubro) rows.push(['Rubro (ML + Mo + JE)', `<span class="currency">${formatCurrency(rubroSum)}</span>`]);

    const tbl = rows.map(r=>`<tr><td class="key">${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    marker.bindPopup(`<div class="popup"><h3>${nombre}</h3><table>${tbl}</table></div>`);

    marker.feature = { properties: { regimen, zona: (zona||''), anio: (anio||'') } };
    allMarkers.push(marker);
    cluster.addLayer(marker);
    bounds.push([lat,lon]);
  });

  if(bounds.length) map.fitBounds(bounds, { padding:[20,20] });
  refresh();
}

function refresh(){
  const showCosta = document.getElementById('chk-costa').checked;
  const showSierra = document.getElementById('chk-sierra').checked;
  const zonaSel = document.getElementById('sel-zona').value;
  const anioSel = document.getElementById('sel-anio').value;

  cluster.clearLayers();
  allMarkers.forEach(m => {
    const r = (m.feature?.properties?.regimen || '').toUpperCase();
    const z = (m.feature?.properties?.zona || '');
    const a = (m.feature?.properties?.anio || '');
    const okReg = (r === 'COSTA' && showCosta) || (r === 'SIERRA' && showSierra) || (r!== 'COSTA' && r!=='SIERRA' && (showCosta||showSierra));
    const okZona = !zonaSel || z === zonaSel;
    const okAnio = !anioSel || a === anioSel;
    if(okReg && okZona && okAnio) cluster.addLayer(m);
  });
}

window.addEventListener('DOMContentLoaded', initMap);
