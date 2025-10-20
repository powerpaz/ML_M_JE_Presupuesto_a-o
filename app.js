
const CSV_PATH = 'datos_min.csv';
const PROV_GEOJSON_PATH = 'provincias_simplificado.geojson';

let RAW_ROWS = [];
let MAP, CLUSTER, PROV_LAYER;

function formatoUSD_ES(value){
  try { return new Intl.NumberFormat('es-EC', {style:'currency', currency:'USD'}).format(value); }
  catch(e){ return `$${(+value||0).toFixed(2)}`; }
}
function toNum(v){
  if (typeof v === 'number') return v;
  const s = String(v??'').replace(/\s/g,'').replace(',','.');
  const n = Number(s); return Number.isFinite(n) ? n : NaN;
}
function uniqueSorted(a){ return Array.from(new Set(a.filter(x=>x!=null && x!==''))).sort((x,y)=>String(x).localeCompare(String(y),'es')); }

// Map
function initMap(){
  MAP = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(MAP);
  CLUSTER = L.markerClusterGroup(); CLUSTER.addTo(MAP);
  MAP.setView([-1.8,-78.2],6);
}
async function loadProvinces(){
  try{
    const res = await fetch(PROV_GEOJSON_PATH, {cache:'no-store'});
    const gj = await res.json();
    if(PROV_LAYER) PROV_LAYER.remove();
    const nameKey = (gj.features[0] && gj.features[0].properties && (gj.features[0].properties.DPA_DESPRO!==undefined ? 'DPA_DESPRO' : Object.keys(gj.features[0].properties)[0])) || 'DPA_DESPRO';
    PROV_LAYER = L.geoJSON(gj, {
      style: ()=>({ color:'#1f4aa0', weight:1.6, fill:false, opacity:.9 }),
      onEachFeature: (f, layer)=>{ const nm = f.properties?.[nameKey] ?? ''; layer.bindTooltip(String(nm), {sticky:true}); }
    }).addTo(MAP);
  }catch(e){ console.warn('No se pudieron cargar provincias:', e); }
}

// Filters
function currentFilters(){ return { amie: document.getElementById('amieTxt').value.trim(), prov: document.getElementById('provSel').value, cant: document.getElementById('cantSel').value }; }
function applyFilters(rows){
  const {amie,prov,cant} = currentFilters();
  return rows.filter(r=>{
    let ok=true;
    if(amie) ok = ok && String(r.AMIE??'').toUpperCase().includes(amie.toUpperCase());
    if(prov) ok = ok && String(r.PROVINCIA??'')===prov;
    if(cant) ok = ok && String(r.CANTON??'')===cant;
    return ok;
  });
}
function updateFilterUI(rows){
  const provSel = document.getElementById('provSel');
  const cantSel = document.getElementById('cantSel');
  const provs = uniqueSorted(rows.map(r=>r.PROVINCIA));
  provSel.innerHTML = '<option value=\"\">Todas</option>'+provs.map(p=>`<option>${p}</option>`).join('');
  provSel.onchange = ()=>{
    const pv = provSel.value;
    const cants = uniqueSorted(rows.filter(r=>!pv || r.PROVINCIA===pv).map(r=>r.CANTON));
    cantSel.innerHTML = '<option value=\"\">Todos</option>'+cants.map(c=>`<option>${c}</option>`).join('');
    renderAll();
  };
  const cantsAll = uniqueSorted(rows.map(r=>r.CANTON));
  cantSel.innerHTML = '<option value=\"\">Todos</option>'+cantsAll.map(c=>`<option>${c}</option>`).join('');
  cantSel.onchange = ()=>renderAll();
  document.getElementById('amieTxt').oninput = ()=>renderAll(true);
  document.getElementById('btnLimpiar').onclick = ()=>{ document.getElementById('amieTxt').value=''; provSel.value=''; cantSel.value=''; renderAll(); };
}

// Table & Map render
function renderTable(rows){
  let sumMD=0,sumM=0,sumJE=0;
  for(const r of rows){ sumMD+=Number(r.MD)||0; sumM+=Number(r.M)||0; sumJE+=Number(r.JE)||0; }
  const data = [
    { nombre:'C2: Rubro 2.3.1 MATERIAL LÚDICO (DIDÁCTICO)', costo:sumMD },
    { nombre:'C2: Rubro 2.3.2 MOBILIARIO', costo:sumM },
    { nombre:'C2: Rubro 2.3.3 JUEGOS EXTERIORES (EQUIPAMIENTO)', costo:sumJE },
  ];
  const tbody = document.querySelector('#rubrosTable tbody'), totalCell = document.getElementById('totalCell'), totalKPI = document.getElementById('totalKPI');
  let total=0; tbody.innerHTML = data.map(r=>{ total+=Number(r.costo)||0; return `<tr><td>${r.nombre}</td><td><b>${formatoUSD_ES(r.costo)}</b></td></tr>`; }).join('');
  const tf = formatoUSD_ES(total); if(totalCell) totalCell.textContent=tf; if(totalKPI) totalKPI.textContent=tf;
}
function renderMap(rows, preserveView=false){
  CLUSTER.clearLayers(); const markers=[];
  for(const r of rows){
    const lat = toNum(r.LAT), lon = toNum(r.LON);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
    const popup = `<div style="min-width:220px">
      <div style="font-weight:700">${r.NOMBRE??''}</div>
      <div class="muted">AMIE: <b>${r.AMIE??''}</b></div>
      <div class="muted">Provincia: ${r.PROVINCIA??''} • Cantón: ${r.CANTON??''}</div>
      <hr style="border:none;border-top:1px solid #eaeef5;margin:6px 0"/>
      <div>Material Lúdico: <b>${formatoUSD_ES(Number(r.MD)||0)}</b></div>
      <div>Mobiliario: <b>${formatoUSD_ES(Number(r.M)||0)}</b></div>
      <div>Juegos Exteriores: <b>${formatoUSD_ES(Number(r.JE)||0)}</b></div>
    </div>`;
    const m = L.marker([lat, lon]).bindPopup(popup); CLUSTER.addLayer(m); markers.push(m);
  }
  document.getElementById('countInstituciones').textContent = `Instituciones: ${markers.length}`;
  if(!preserveView){
    if(markers.length){ const g=L.featureGroup(markers); MAP.fitBounds(g.getBounds().pad(0.15)); } else { MAP.setView([-1.8,-78.2],6); }
  }
}

function describeFilters(){
  const {amie,prov,cant} = currentFilters();
  const arr = []; if(amie) arr.push(`AMIE contiene “${amie}”`); if(prov) arr.push(`PROVINCIA = ${prov}`); if(cant) arr.push(`CANTÓN = ${cant}`);
  return arr.length?arr.join(' • '):'—';
}
function renderAll(preserveView=false){
  const rows = applyFilters(RAW_ROWS);
  renderTable(rows); renderMap(rows, preserveView);
  document.getElementById('filtrosActivos').textContent = 'Filtros activos: ' + describeFilters();
  const btn = document.getElementById('btnExport');
  if(btn){
    btn.onclick = ()=>{
      let sumMD=0,sumM=0,sumJE=0;
      for(const r of rows){ sumMD+=Number(r.MD)||0; sumM+=Number(r.M)||0; sumJE+=Number(r.JE)||0; }
      const out = [
        { nombre:'C2: Rubro 2.3.1 MATERIAL LÚDICO (DIDÁCTICO)', costo:sumMD },
        { nombre:'C2: Rubro 2.3.2 MOBILIARIO', costo:sumM },
        { nombre:'C2: Rubro 2.3.3 JUEGOS EXTERIORES (EQUIPAMIENTO)', costo:sumJE },
      ];
      const header='rubro,costo_usd\n'; const lines = out.map(r=>`${(r.nombre||'').replaceAll(',', ' ')} , ${Number(r.costo)||0}`); const csv=header+lines.join('\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='rubros_c2_filtrado.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };
  }
}

// Load CSV (datos_min.csv)
async function loadCSV(){
  const st = document.getElementById('status');
  try{
    st && (st.textContent='Descargando CSV…');
    const res = await fetch(CSV_PATH, {cache:'no-store'});
    if(!res.ok) throw new Error('No se pudo descargar datos_min.csv');
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',');
    RAW_ROWS = lines.slice(1).map(row=>{
      const cells = row.split(',');
      const obj = {}; headers.forEach((h,i)=> obj[h]=cells[i] ?? '');
      // cast numeric after
      obj.LAT = toNum(obj.LAT); obj.LON = toNum(obj.LON);
      obj.MD = toNum(obj.MD); obj.M = toNum(obj.M); obj.JE = toNum(obj.JE);
      return obj;
    });
    updateFilterUI(RAW_ROWS); renderAll();
    st && (st.textContent='Listo');
  }catch(e){ console.error(e); st && (st.textContent=String(e.message||e)); }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  initMap();
  await loadProvinces();
  await loadCSV();
});
