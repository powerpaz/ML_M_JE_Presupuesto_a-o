const DATA_XLSX = 'base_cruce.xlsx';
const PROVINCIAS_GEOJSON = 'provincias.geojson';

const FIELD_MAP = {
  lat: ['lat','latitude','y','coord_y','coordenada_y','Lat','LAT'],
  lon: ['lon','long','lng','x','coord_x','coordenada_x','Lon','LON'],
  amie: ['amie','codigo','codigo_amie','AMIE'],
  nombre: ['nombre','institucion','establecimiento','NOMBRE'],
  tipo: ['tipo','TIPO'],
  sostenimiento: ['sostenimiento','SOSTENIMIENTO'],
  provincia: ['provincia','PROVINCIA'],
  canton: ['canton','cantón','CANTON','CANTÓN'],
  parroquia: ['parroquia','PARROQUIA']
};

let map, provinciasLayer, markersLayer;
let dataRows = [];
let filteredRows = [];

function money(n){ try { return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(n); } catch(e){ return '$ ' + n; } }
function updateKpis(){
  const mat = 2918.26, mob = 1528.00, jue = 5748.00;
  document.getElementById('kpi-total').innerText = money(mat + mob + jue);
}

function initMap(){
  map = L.map('map',{ zoomControl:true }).setView([-1.6,-78.6], 6);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
  const tonerLite = L.tileLayer('https://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png',{subdomains:'abcd',maxZoom:20});
  osm.addTo(map);
  L.control.layers({'OSM':osm,'TonerLite':tonerLite},{}).addTo(map);
}

async function loadProvincias(){
  const resp = await fetch(PROVINCIAS_GEOJSON);
  const gj = await resp.json();
  provinciasLayer = L.geoJSON(gj,{
    style: { color:'#233142', weight:1, fillColor:'#101a26', fillOpacity:0.2 }
  }).addTo(map);
  try { map.fitBounds(provinciasLayer.getBounds()); } catch(e){}
}

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

async function loadXlsx(){
  const resp = await fetch(DATA_XLSX);
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  if(!rows.length){ return []; }
  const fm = {};
  Object.entries(FIELD_MAP).forEach(([k,aliases])=> fm[k] = findField(rows[0], aliases));
  const norm = rows.map(r=> ({
      lat: parseFloat(r[fm.lat]),
      lon: parseFloat(r[fm.lon]),
      amie: r[fm.amie] ?? '',
      nombre: r[fm.nombre] ?? '',
      tipo: r[fm.tipo] ?? '',
      sostenimiento: r[fm.sostenimiento] ?? '',
      provincia: r[fm.provincia] ?? '',
      canton: r[fm.canton] ?? '',
      parroquia: r[fm.parroquia] ?? ''
  })).filter(d=> isFinite(d.lat) && isFinite(d.lon));
  return norm;
}

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
    tr.addEventListener('click', e=>{
      const idx = parseInt(tr.getAttribute('data-idx'));
      const row = rows[idx];
      map.setView([row.lat,row.lon], 15);
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
  if(markersLayer){ markersLayer.remove(); }
  markersLayer = L.layerGroup();
  rows.forEach(r=>{
    const m = L.circleMarker([r.lat, r.lon], { radius:6, color:'#1DB954', weight:2, fillColor:'#1DB954', fillOpacity:0.35 });
    const html = `<b>${r.nombre||'—'}</b><br>AMIE: ${r.amie||'—'}<br>${[r.provincia,r.canton,r.parroquia].filter(Boolean).join(' / ')}`;
    m.bindPopup(html);
    markersLayer.addLayer(m);
  });
  markersLayer.addTo(map);
}

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
  dataRows = await loadXlsx();
  if(!dataRows.length){
    alert('No se encontraron filas válidas en base_cruce.xlsx (revise columnas lat/lon).');
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
