// app.v9.js — usa Supabase; CSV fallback -> rubros_csv.csv (;) y columnas limpias
import { supabase, hasSupabase, fetchInstituciones } from "./supabaseClient.js";

const GEOJSON_PROVINCIAS = "provincias_simplificado.geojson";
const CSV_PATH = "rubros_csv.csv"; // nuevo dataset limpio con ';'

let rawRows = [];
let filteredRows = [];
let map, cluster, provLayer;

const el = id => document.getElementById(id);
const norm = s => (s??"").toString().trim();
const normalizeText = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const nkey = s => normalizeText(s).replace(/\s+|[.\-$/]/g,"_");

function get(row, aliases){
  for(const a of aliases){
    const k = Object.keys(row).find(key => nkey(key)===nkey(a));
    if(k !== undefined && row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
  }
  for(const key of Object.keys(row)){
    const nk = nkey(key);
    for(const a of aliases){
      if(nk.includes(nkey(a))) return row[key];
    }
  }
  return undefined;
}
function parseNum(v){
  if(v===undefined||v===null||v==='') return undefined;
  let s = String(v).trim();
  s = s.replace(/\s/g,'');
  s = s.replace(/USD|\$/ig,'');
  s = s.replace(/[^0-9,.\-]/g,'');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if(lastComma>lastDot){ s = s.replace(/\./g,'').replace(',', '.'); }
  else { s = s.replace(/,/g,''); }
  const num = Number(s);
  return Number.isFinite(num)?num:undefined;
}
function currency(v){ return (Number.isFinite(v)? v:0).toLocaleString('es-EC',{style:'currency',currency:'USD'}); }
function regimeColor(r){
  const R = (r??'').toString().toUpperCase();
  if(R==='COSTA') return '#d40000';
  if(R==='SIERRA') return '#f4d03f';
  return '#6b7280';
}
function zoneKey(z){ const m = /(\d+)/.exec(z||''); return m?parseInt(m[1],10):999; }

async function init(){
  map = L.map('map').setView([-1.8,-78.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  cluster = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
  map.addLayer(cluster);

  // Provincias
  fetch(GEOJSON_PROVINCIAS).then(r=>r.json()).then(geo=>{
    provLayer = L.geoJSON(geo,{
      style: {color:'#2b5cab', weight:1, opacity:0.7, fillOpacity:0},
      onEachFeature: (f,l)=> l.bindTooltip(f.properties?.DPA_DESPROV || f.properties?.name || 'Provincia',{sticky:true})
    }).addTo(map);
  });

  await loadData();
  setupFilters();
  applyFilters();

  ['amieTxt','provSel','cantSel','zonaSel','nivelSel','anioSel'].forEach(id=>{
    const node = el(id);
    if(!node) return;
    if(node.tagName==='SELECT') node.addEventListener('change', applyFilters);
    else node.addEventListener('input', applyFilters);
  });
  el('btnLimpiar').addEventListener('click', clearFilters);
  el('btnExport').addEventListener('click', exportCSV);
}

async function loadData(){
  if(hasSupabase()){
    el('srcLabel').textContent = 'Supabase';
    el('status').textContent = 'Consultando Supabase…';
    const { data, error } = await fetchInstituciones({ zona:null, nivel:null, anio:null, limit:10000 });
    if(error || !data || !data.length){
      el('srcLabel').textContent = 'CSV';
      await loadFromCSV();
    }else{
      rawRows = data || [];
      el('status').textContent = `Supabase listo (${rawRows.length} filas)`;
    }
  }else{
    el('srcLabel').textContent = 'CSV';
    await loadFromCSV();
  }
}

async function loadFromCSV(){
  return new Promise((resolve)=>{
    Papa.parse(CSV_PATH, {
      download:true, header:true, dynamicTyping:false, skipEmptyLines:true, delimiter:';',
      complete: res => { rawRows = res.data; el('status').textContent = `CSV listo (${rawRows.length} filas)`; resolve(); }
    });
  });
}

function setupFilters(){
  const provSet = new Set(), cantSet = new Set(), zonaSet = new Set(), nivelSet = new Set(), anioSet = new Set();
  rawRows.forEach(row=>{
    const prov = get(row,['PROVINCIA']);
    const cant = get(row,['CANTON','CANTÓN']);
    const zona = get(row,['ZONA']);
    const nivel = get(row,['NIVEL DE EDUCACIÓN','NIVEL DE EDUCACION','NIVEL_DE_EDUCACION']);
    const anio = get(row,['AUX_AÑO DE DOTACIÓN','AUX_ANIO_DOTACION','AUX_ANIO DE DOTACION']);
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
  sel.options.length = 1;
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
  const amieQ = normalizeText(el('amieTxt').value);
  const provQ = normalizeText(el('provSel').value);
  const cantQ = normalizeText(el('cantSel').value);
  const zonaQ = normalizeText(el('zonaSel').value);
  const nivelQ = normalizeText(el('nivelSel').value);
  const anioQ = normalizeText(el('anioSel').value);

  const amie = normalizeText(get(row,['AMIE']));
  const prov = normalizeText(get(row,['PROVINCIA']));
  const cant = normalizeText(get(row,['CANTON','CANTÓN']));
  const zona = normalizeText(get(row,['ZONA']));
  const nivel = normalizeText(get(row,['NIVEL DE EDUCACIÓN','NIVEL DE EDUCACION','NIVEL_DE_EDUCACION']));
  const anio = normalizeText(get(row,['AUX_AÑO DE DOTACIÓN','AUX_ANIO_DOTACION','AUX_ANIO DE DOTACION']));

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
    const ml = parseNum(get(row,['MD_MONTO USD$','MD_MONTO_USD']));
    const mo = parseNum(get(row,['M_MONTO USD$','M_MONTO_USD']));
    const je = parseNum(get(row,['JE_MONTO USD$','JE_MONTO_USD']));
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
    const lat = parseFloat(get(row,['LATITUD']));
    const lon = parseFloat(get(row,['LONGITUD']));
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const amie = get(row,['AMIE']) || '';
    const institucion = get(row,['INSTITUCION']) || '';
    const sosten = get(row,['SOSTENIMIENTO']) || '';
    const nivel = get(row,['NIVEL DE EDUCACIÓN','NIVEL DE EDUCACION','NIVEL_DE_EDUCACION']) || '';
    const auxMat = get(row,['Aux_IE_Material']) || '';

    const md = parseNum(get(row,['MD_MONTO USD$','MD_MONTO_USD']));
    const m  = parseNum(get(row,['M_MONTO USD$','M_MONTO_USD']));
    const je = parseNum(get(row,['JE_MONTO USD$','JE_MONTO_USD']));
    const sumaMontos = [md,m,je].reduce((acc,v)=>acc+(Number.isFinite(v)?v:0),0);

    const regimen = get(row,['RÉGIMEN','REGIMEN']) || '';
    const zona = get(row,['ZONA']) || '';

    const marker = L.circleMarker([lat,lon],{
      radius:6, weight:1, color:'#111', fillColor:regimeColor(regimen), fillOpacity:0.9
    });

    const rows = [
      ['AMIE', amie],
      ['INSTITUCION', institucion],
      ['SOSTENIMIENTO', sosten],
      ['NIVEL DE EDUCACIÓN', nivel],
      ['Aux_IE_Material', auxMat],
      ['Suma montos (MD + M + JE)', isNaN(sumaMontos)? '—' : sumaMontos.toLocaleString('es-EC',{style:'currency',currency:'USD'})],
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
    node.value='';
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
  const blob = new Blob([lines.join('\\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'export_filtrado.csv'; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', init);
