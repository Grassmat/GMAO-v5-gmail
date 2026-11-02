import type { Row } from './types';
export type StockSort='name'|'quantity-asc'|'quantity-desc'|'machine';
export function stockRows(parts:Row[],machines:Row[],qty:(id:string)=>number,filters:{machine?:string;category?:string;sort?:StockSort;query?:string;selected?:string}) {
  const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=normalize(filters.query||'').trim().split(/\s+/).filter(Boolean);
  const machineName=(part:Row)=>(part.machines||[]).map(id=>machines.find(m=>m.id===id)?.name||id).sort((a,b)=>a.localeCompare(b,'fr',{numeric:true})).join(', ');
  const compareName=(a:Row,b:Row)=>a.name.localeCompare(b.name,'fr',{numeric:true})||(a.reference||'').localeCompare(b.reference||'','fr',{numeric:true})||a.id.localeCompare(b.id);
  return parts.filter(part=>(!filters.selected||part.machines?.includes(filters.selected))
    &&(!filters.machine||(filters.machine==='unassigned'?!part.machines?.length:part.machines?.includes(filters.machine)))
    &&(!filters.category||(filters.category==='none'?!part.category:part.category===filters.category))
    &&words.every(word=>normalize([part.name,part.reference,part.supplier,part.location].filter(Boolean).join(' ')).includes(word)))
    .sort((a,b)=>(filters.sort==='quantity-asc'?qty(a.id)-qty(b.id):filters.sort==='quantity-desc'?qty(b.id)-qty(a.id):filters.sort==='machine'?machineName(a).localeCompare(machineName(b),'fr',{numeric:true}):0)||compareName(a,b));
}
