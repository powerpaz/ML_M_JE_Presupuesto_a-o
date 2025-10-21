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

  Papa.parse(DATA_PATH, {
    download: true, header: true, dynamicTyping: false, skipEmptyLines: true,
    complete: (res) => {
      dataRows = res.data;
      populateZonaFilter();
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
  // Remove currency symbols and spaces
  s = s.replace(/[^0-9,.\-]/g, '');
  // If comma is decimal (common in EC): normalize "1.234.567,89" -> "1234567.89"
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if(lastComma > lastDot){
    s = s.replace(/\./g,'').replace(',', '.');
  } else {
    s = s.replace(/,/g,'');
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : undefined;
}

function formatCurrency(n){
  if(n === undefined) return '—';
  return n.toLocaleString('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function regimeColor(reg){
  const r = (reg||"").toString().trim().toUpperCase();
  if(r === "COSTA") return "#d40000";     // rojo
  if(r === "SIERRA") return "#f4d03f";    // amarillo
  return "#666";
}

function populateZonaFilter(){
  const sel = document.getElementById('sel-zona');
  // Aliases de zona
  const zonas = new Set();
  for(const row of dataRows){
    const z = getVal(row, ['zona','zona_educativa','zona_adm','zona_apit','region','área']);
    if(z !== undefined && String(z).trim() !== '') zonas.add(String(z).trim());
  }
  if(zonas.size === 0){
    // Si no hay zona, ocultar el control
    sel.parentElement.style.display = 'none';
    return;
  }
  [...zonas].sort((a,b)=>a.localeCompare(b)).forEach(z => {
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = z;
    sel.appendChild(opt);
  });
}

function buildMarkers(){
  cluster.clearLayers();
  allMarkers = [];

  let bounds = [];
  let cCosta = 0, cSierra = 0;

  dataRows.forEach((row) => {
    const lat = parseFloat(getVal(row, ['lat','latitude','y']));
    const lon = parseFloat(getVal(row, ['lon','lng','long','x']));
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const nombre = getVal(row, ['nombre','name','ie','institucion']) || '—';
    const amie   = getVal(row, ['amie','codigo_amie','cod_amie']) || '—';
    const regimen = (getVal(row, ['regimen','régimen']) || '').toString().toUpperCase();
    const zona = getVal(row, ['zona','zona_educativa','zona_adm','zona_apit','region','área']);

    const aux = getVal(row, ['AUX_T_IE','AUX_T. IE','aux_t_ie','aux_t_ie_']);
    const y2026 = getVal(row, ['2026','y2026','anio_2026','anio2026']);
    const y2027 = getVal(row, ['2027','y2027','anio_2027','anio2027']);
    const total = getVal(row, ['total','TOTAL','suma_total']);

    // Aliases de rubros
    const vML = parseNumber(getVal(row, ['material_ludico','material_lúdico','ml','c2_rubro_2_3_1','rubro_2_3_1']));
    const vMo = parseNumber(getVal(row, ['mobiliario','mo','c2_rubro_2_3_2','rubro_2_3_2']));
    const vJE = parseNumber(getVal(row, ['juegos_exteriores','juegos_exteriores_(equipamiento)','je','c2_rubro_2_3_3','rubro_2_3_3']));

    const rubroSum = [vML,vMo,vJE].reduce((acc,v)=>acc + (Number.isFinite(v)?v:0), 0);
    const hasRubro = [vML,vMo,vJE].some(v=>Number.isFinite(v));

    const color = regimeColor(regimen);
    if(regimen === 'COSTA') cCosta++;
    if(regimen === 'SIERRA') cSierra++;

    const marker = L.circleMarker([lat, lon], {
      radius: 6, weight: 1, color: '#111', fillColor: color, fillOpacity: 0.9
    });

    const rows = [];
    rows.push(['AMIE', amie]);
    rows.push(['Nombre', nombre]);
    if(regimen) rows.push(['Régimen', regimen]);
    if(zona !== undefined) rows.push(['Zona', zona]);
    if(aux !== undefined) rows.push(['AUX_T_IE', aux]);
    if(y2026 !== undefined) rows.push(['2026', y2026]);
    if(y2027 !== undefined) rows.push(['2027', y2027]);
    if(total !== undefined) rows.push(['Total', total]);
    if(hasRubro) rows.push(['Rubro (ML + Mo + JE)', `<span class="currency">${formatCurrency(rubroSum)}</span>`]);

    const tbl = rows.map(r=>`<tr><td class="key">${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const html = `<div class="popup"><h3>${nombre}</h3><table>${tbl}</table></div>`;
    marker.bindPopup(html);

    marker.feature = { properties: { regimen, zona: (zona||'').toString() } };
    allMarkers.push(marker);
    cluster.addLayer(marker);
    bounds.push([lat,lon]);
  });

  if(bounds.length) map.fitBounds(bounds, { padding:[20,20] });
  document.getElementById('kpi-total').textContent = allMarkers.length;
  document.getElementById('kpi-costa').textContent = cCosta;
  document.getElementById('kpi-sierra').textContent = cSierra;

  refresh();
}

function refresh(){
  const showCosta = document.getElementById('chk-costa').checked;
  const showSierra = document.getElementById('chk-sierra').checked;
  const zonaSel = document.getElementById('sel-zona').value;

  cluster.clearLayers();
  allMarkers.forEach(m => {
    const r = (m.feature?.properties?.regimen || '').toUpperCase();
    const z = (m.feature?.properties?.zona || '');
    const okReg = (r === 'COSTA' && showCosta) || (r === 'SIERRA' && showSierra) || (r!== 'COSTA' && r!=='SIERRA' && (showCosta||showSierra));
    const okZona = !zonaSel || z === zonaSel;
    if(okReg && okZona) cluster.addLayer(m);
  });
}

window.addEventListener('DOMContentLoaded', initMap);
