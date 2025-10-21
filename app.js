/* v5 con mejoras de filtros y popup */
const CSV_PATH = "datos_min.csv";
const GEOJSON_PROV = "provincias_simplificado.geojson";

let rawRows = [];
let filteredRows = [];
let map, cluster;

const el = id => document.getElementById(id);
const norm = s => (s||"").toString().trim();
const nkey = s => norm(s).toLowerCase().replace(/\s+|[.\-$/]/g,"_");

function get(row, aliases){
  for(const a of aliases){
    const k = Object.keys(row).find(key => nkey(key)===nkey(a));
    if(k !== undefined && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}
function parseNum(v){
  if(v===undefined||v===null) return undefined;
  let s = String(v).trim();
  if(!s) return undefined;
  s = s.replace(/[^0-9,.\-]/g,'');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if(lastComma>lastDot){ s = s.replace(/\./g,'').replace(',', '.'); }
  else { s = s.replace(/,/g,''); }
  const num = Number(s);
  return Number.isFinite(num)?num:undefined;
}
function currency(v){ return (Number.isFinite(v)? v:0).toLocaleString('es-EC',{style:'currency',currency:'USD'}); }
function regimeColor(r){
  const R = norm(r).toUpperCase();
  if(R==='COSTA') return '#d40000';
  if(R==='SIERRA') return '#f4d03f';
  return '#6b7280';
}
function zoneKey(z){ const m = /(\d+)/.exec(z||''); return m?parseInt(m[1],10):999; }

function init(){
  map = L.map('map').setView([-1.8,-78.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  cluster = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
  map.addLayer(cluster);

  Papa.parse(CSV_PATH, {
    download:true, header:true, dynamicTyping:false, skipEmptyLines:true,
    complete: res => {
      rawRows = res.data;
      setupFilters();
      applyFilters();
      el('status').textContent = `Listo (${rawRows.length} filas)`;
    }
  });

  ['amieTxt','provSel','cantSel','zonaSel','nivelSel','anioSel'].forEach(id=>{
    const node = el(id);
    if(!node) return;
    if(node.tagName==='SELECT') node.addEventListener('change', applyFilters);
    else node.addEventListener('input', applyFilters);
  });
  el('btnLimpiar').addEventListener('click', clearFilters);
  el('btnExport').addEventListener('click', exportCSV);
}

function setupFilters(){
  const provSet = new Set(), cantSet = new Set(), zonaSet = new Set(), nivelSet = new Set(), anioSet = new Set();
  rawRows.forEach(row=>{
    const prov = get(row,['provincia','provincia_adm','province']);
    const cant = get(row,['cantón','canton','canton_adm']);
    const zona = get(row,['ZONA','zona','zona_educativa']);
    const nivel = get(row,['NIVEL DE EDUCACIÓN','nivel_de_educación','nivel','nivel_educacion']);
    const anio = get(row,['AUX_AÑO DE DOTACIÓN','aux_año_de_dotación','aux_anio_de_dotacion','anio_dotacion','año_dotación']);
    if(prov) provSet.add(norm(prov));
    if(cant) cantSet.add(norm(cant));
    if(zona) zonaSet.add(norm(zona));
    if(nivel) nivelSet.add(norm(nivel));
    if(anio) anioSet.add(norm(anio));
  });
  fillSelect('provSel', provSet, false);
  fillSelect('cantSel', cantSet, false);
  fillSelect('zonaSel', zonaSet, true);
  fillSelect('nivelSel', nivelSet, false);
  fillSelect('anioSel', anioSet, false);
}

function fillSelect(id, set, isZone){
  const sel = el(id);
  if(!sel) return;
  sel.options.length = 1; // deja solo "Todas"/"Todos"
  let vals = [...set].filter(Boolean);
  if(isZone) vals.sort((a,b)=> zoneKey(a) - zoneKey(b) || a.localeCompare(b));
  else vals.sort((a,b)=> a.localeCompare(b));
  vals.forEach(v=>{
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
}

function rowPasses(row){
  const amieQ = norm(el('amieTxt').value).toLowerCase();
  const provQ = norm(el('provSel').value);
  const cantQ = norm(el('cantSel').value);
  const zonaQ = norm(el('zonaSel').value);
  const nivelQ = norm(el('nivelSel').value);
  const anioQ = norm(el('anioSel').value);

  const amie = norm(get(row,['amie','codigo_amie','cod_amie'])).toLowerCase();
  const prov = norm(get(row,['provincia','provincia_adm','province']));
  const cant = norm(get(row,['cantón','canton','canton_adm']));
  const zona = norm(get(row,['ZONA','zona','zona_educativa']));
  const nivel = norm(get(row,['NIVEL DE EDUCACIÓN','nivel_de_educación','nivel','nivel_educacion']));
  const anio = norm(get(row,['AUX_AÑO DE DOTACIÓN','aux_año_de_dotación','aux_anio_de_dotacion','anio_dotacion','año_dotación']));

  const okAmie = !amieQ || amie.includes(amieQ);
  const okProv = !provQ || prov===provQ;
  const okCant = !cantQ || cant===cantQ;
  const okZona = !zonaQ || zona===zonaQ;
  const okNivel = !nivelQ || nivel===nivelQ;
  const okAnio = !anioQ || anio===anioQ;
  return okAmie && okProv && okCant && okZona && okNivel && okAnio;
}

function applyFilters(){
  filteredRows = rawRows.filter(rowPasses);
  updateTable();
  updateMap();
  el('countInstituciones').textContent = `Instituciones: ${filteredRows.length}`;
  const actif = [];
  if(el('amieTxt').value) actif.push(`AMIE~${el('amieTxt').value}`);
  if(el('provSel').value) actif.push(`PROV=${el('provSel').value}`);
  if(el('cantSel').value) actif.push(`CANT=${el('cantSel').value}`);
  if(el('zonaSel').value) actif.push(`ZONA=${el('zonaSel').value}`);
  if(el('nivelSel').value) actif.push(`NIVEL=${el('nivelSel').value}`);
  if(el('anioSel').value) actif.push(`AÑO=${el('anioSel').value}`);
  el('filtrosActivos').textContent = `Filtros activos: ${actif.join(' • ') || '—'}`;
}

function updateTable(){
  const tbody = document.querySelector('#rubrosTable tbody');
  tbody.innerHTML = '';
  const totals = {
    'C2: Material Lúdico (Didáctico)': 0,
    'C2: Mobiliario': 0,
    'C2: Juegos Exteriores (Equipamiento)': 0,
  };
  filteredRows.forEach(row=>{
    const ml = parseNum(get(row,['material_ludico','material_lúdico','c2_rubro_2_3_1','rubro_2_3_1']));
    const mo = parseNum(get(row,['mobiliario','c2_rubro_2_3_2','rubro_2_3_2']));
    const je = parseNum(get(row,['juegos_exteriores','juegos_exteriores_(equipamiento)','c2_rubro_2_3_3','rubro_2_3_3']));
    if(Number.isFinite(ml)) totals['C2: Material Lúdico (Didáctico)'] += ml;
    if(Number.isFinite(mo)) totals['C2: Mobiliario'] += mo;
    if(Number.isFinite(je)) totals['C2: Juegos Exteriores (Equipamiento)'] += je;
  });
  Object.entries(totals).forEach(([k,v])=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${currency(v)}</td>`;
    tbody.appendChild(tr);
  });
  const total = Object.values(totals).reduce((a,b)=>a+b,0);
  el('totalCell').textContent = currency(total);
}

function updateMap(){
  if(cluster) cluster.clearLayers();
  const bounds = [];
  filteredRows.forEach(row=>{
    const lat = parseFloat(get(row,['lat','latitude','y']));
    const lon = parseFloat(get(row,['lon','lng','long','x']));
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const amie = get(row,['amie','codigo_amie','cod_amie']) || '';
    const institucion = get(row,['INSTITUCION','institución','institucion','nombre','ie']) || '';
    const sosten = get(row,['sostenimiento','SOSTENIMIENTO']) || '';
    const nivel = get(row,['NIVEL DE EDUCACIÓN','nivel_de_educación','nivel','nivel_educacion']) || '';
    const auxMat = get(row,['Aux_IE_Material','aux_ie_material','aux_ie_materiales']) || '';

    const md = parseNum(get(row,['MD_MONTO USD$','md_monto_usd$','md_monto_usd','md_monto']));
    const m  = parseNum(get(row,['M_MONTO USD$','m_monto_usd$','m_monto_usd','m_monto']));
    const je = parseNum(get(row,['JE_MONTO USD$','je_monto_usd$','je_monto_usd','je_monto']));
    const sumaMontos = [md,m,je].reduce((acc,v)=>acc+(Number.isFinite(v)?v:0),0);

    const regimen = get(row,['regimen','régimen']) || '';
    const zona = get(row,['ZONA','zona','zona_educativa']) || '';

    const marker = L.circleMarker([lat,lon],{
      radius:6, weight:1, color:'#111', fillColor:regimeColor(regimen), fillOpacity:0.9
    });

    const rows = [
      ['AMIE', amie],
      ['INSTITUCION', institucion],
      ['SOSTENIMIENTO', sosten],
      ['NIVEL DE EDUCACIÓN', nivel],
      ['Aux_IE_Material', auxMat],
      ['Suma montos (MD + M + JE)', currency(sumaMontos)],
      ['ZONA', zona],
      ['RÉGIMEN', regimen]
    ].map(([k,v])=>`<tr><td style="color:#6b7280">${k}</td><td>${v||'—'}</td></tr>`).join('');

    marker.bindPopup(`<div class="popup"><h3 style="margin:0 0 6px 0">${institucion || '—'}</h3><table>${rows}</table></div>`);
    cluster.addLayer(marker);
    bounds.push([lat,lon]);
  });
  if(bounds.length) map.fitBounds(bounds, {padding:[16,16]});
}

function clearFilters(){
  ['amieTxt','provSel','cantSel','zonaSel','nivelSel','anioSel'].forEach(id=>{
    const node = el(id);
    if(!node) return;
    if(node.tagName==='SELECT') node.value='';
    else node.value='';
  });
  applyFilters();
}

function exportCSV(){
  if(!filteredRows.length) return;
  const headers = Object.keys(filteredRows[0]);
  const lines = [headers.join(',')];
  filteredRows.forEach(r=>{
    lines.push(headers.map(h=>{
      const v = r[h];
      return (typeof v==='string') ? JSON.stringify(v) : v;
    }).join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'export_filtrado.csv'; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', init);
