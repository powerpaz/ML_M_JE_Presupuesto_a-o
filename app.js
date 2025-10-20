const XLSX_PATH = 'base_cruce.xlsx';
const SHEET_NAME = 'Hoja1';

function formatoUSD_ES(value){
  try { return new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' }).format(value); }
  catch(e){ return `$${(+value||0).toFixed(2)}`; }
}

function norm(s){ return (s??'').toString().trim().toUpperCase(); }

const CAND_MD = ['MD_MONTO USD$', 'MD_MONTO USD', 'MD_MONTO_USD', 'MD_MONTO'];
const CAND_M  = ['M_MONTO USD$', 'M_MONTO USD', 'M_MONTO_USD', 'M_MONTO'];
const CAND_JE = ['JE_MONTO USD$', 'JE_MONTO USD', 'JE_MONTO_USD', 'JE_MONTO'];

function pick(colnames, candidates){
  const set = new Set(colnames.map(norm));
  for(const c of candidates){
    if(set.has(norm(c))) return c;
  }
  // fallback: return the first that fuzzy-includes token 'MD_' etc.
  for(const name of colnames){
    const up = norm(name);
    if(candidates.some(c => up.includes(norm(c).split(' ')[0]))) return name;
  }
  return null;
}

async function loadXLSX(){
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

    const colnames = Object.keys(rows[0]);
    const colMD = pick(colnames, CAND_MD);
    const colM  = pick(colnames, CAND_M);
    const colJE = pick(colnames, CAND_JE);

    if(!colMD || !colM || !colJE){
      throw new Error('No se hallaron columnas esperadas (MD/M/JE MONTO USD$)');
    }

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

    renderTable(data);
    st && (st.textContent = 'Listo');
  }catch(e){
    console.error(e);
    st && (st.textContent = String(e.message||e));
  }
}

function renderTable(rows){
  const tbody = document.querySelector('#rubrosTable tbody');
  const totalCell = document.getElementById('totalCell');
  const totalKPI = document.getElementById('totalKPI');
  if(!tbody) return;

  let total = 0;
  tbody.innerHTML = rows.map(r => {
    total += Number(r.costo)||0;
    return `<tr><td>${r.nombre}</td><td><b>${formatoUSD_ES(r.costo)}</b></td></tr>`;
  }).join('');

  const totalFmt = formatoUSD_ES(total);
  if(totalCell) totalCell.textContent = totalFmt;
  if(totalKPI) totalKPI.textContent = totalFmt;

  const btn = document.getElementById('btnExport');
  if(btn){
    btn.onclick = () => exportCSV(rows);
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

document.addEventListener('DOMContentLoaded', loadXLSX);
