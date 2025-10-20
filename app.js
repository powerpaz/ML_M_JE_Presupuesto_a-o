/* ================== RUBROS C2 (tabla principal ÚNICA) ================== */
const RUBROS_C2 = [
  { nombre: 'C2: Rubro 2.3.1 MATERIAL LÚDICO (DIDÁCTICO)', costo: 2918.26 },
  { nombre: 'C2: Rubro 2.3.2 MOBILIARIO', costo: 1528.00 },
  { nombre: 'C2: Rubro 2.3.3 JUEGOS EXTERIORES (EQUIPAMIENTO)', costo: 5748.00 },
];

function formatoUSD_ES(value){
  try { return new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' }).format(value); }
  catch(e){ return `$${(+value||0).toFixed(2)}`; }
}

function renderRubros(){
  const tbody = document.querySelector('#rubrosTable tbody');
  const totalCell = document.getElementById('totalCell');
  const totalKPI = document.getElementById('totalKPI');
  if(!tbody) return;

  let total = 0;
  tbody.innerHTML = RUBROS_C2.map(r => {
    total += Number(r.costo)||0;
    return `<tr><td>${r.nombre}</td><td><b>${formatoUSD_ES(r.costo)}</b></td></tr>`;
  }).join('');

  const totalFmt = formatoUSD_ES(total);
  if(totalCell) totalCell.textContent = totalFmt;
  if(totalKPI) totalKPI.textContent = totalFmt;
}

function exportCSV(){
  const header = 'rubro,costo_usd\\n';
  const rows = RUBROS_C2.map(r => `${r.nombre.replaceAll(',', ' ')} , ${Number(r.costo)||0}`);
  const csv = header + rows.join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'rubros_c2.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  renderRubros();
  const btn = document.getElementById('btnExport');
  if(btn) btn.addEventListener('click', exportCSV);
});
