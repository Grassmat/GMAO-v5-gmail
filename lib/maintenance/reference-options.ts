import { orderLines, linkedOrderLine } from './order-lines';
import type { Row } from './types';
export type ReferenceOption={value:string;label:string;searchText?:string;group?:string;disabled?:boolean};
export const normalizeReferenceSearch=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function matchingReferences(options:ReferenceOption[],query:string) {
  const words=normalizeReferenceSearch(query).trim().split(/\s+/).filter(Boolean);
  return options.filter(option=>words.every(word=>normalizeReferenceSearch(option.searchText||option.label).includes(word)));
}
export function visibleReferences(options:ReferenceOption[],query:string,value:string,limit=50) {
  const matches=matchingReferences(options,query),visible=matches.slice(0,limit),selected=options.find(o=>o.value===value);
  if(selected&&!visible.some(o=>o.value===value))visible.unshift(selected);
  return {visible,total:matches.length,limited:matches.length>limit};
}
type Quote=Partial<Row>&{id:string;site:string;name:string};
export function pendingQuote(order:Quote) {
  return !order.deleted&&!['Reçu','Annulé','Refusé'].includes(order.status||'')&&orderLines(order).some(l=>!l.received);
}
export function reportQuoteOptions(orders:Quote[],site:string,current:string):ReferenceOption[] {
  return orders.filter(o=>o.site===site&&(pendingQuote(o)||o.id===current)).map(o=>({value:o.id,group:o.id===current&&!pendingQuote(o)?'Devis associé':'Devis en attente',
    label:[o.name,o.reference||'',o.supplier||'Fournisseur non renseigné',o.status||'Devis'].filter(Boolean).join(' · '),
    searchText:[o.name,o.reference,o.supplier,o.status,...orderLines(o).flatMap(l=>[l.name,l.reference])].filter(Boolean).join(' ')}));
}
export function planningReferenceOptions(records:Row[],site:string,qty:(id:string)=>number,groupQuotes=false):ReferenceOption[] {
  return records.filter(r=>r.site===site&&!r.deleted).flatMap((row):ReferenceOption[]=>{
    if(row.kind==='part')return [{value:'part:'+row.id,group:'Magasin',label:[row.name,row.reference||'Sans référence',qty(row.id)+' en stock'].join(' · '),searchText:[row.name,row.reference,row.supplier,row.location].filter(Boolean).join(' ')}];
    if(row.kind!=='order'||!pendingQuote(row))return [];
    if(groupQuotes && row.lines)return [{value:'order:'+row.id,group:'Devis en attente',label:[row.name,row.supplier||'Sans fournisseur',row.status,row.lines.length+' pièces'].filter(Boolean).join(' · '),searchText:[row.name,row.supplier,row.status,...row.lines.flatMap(l=>[l.name,l.reference])].filter(Boolean).join(' ')}];
    if(!row.lines)return [{value:'order:'+row.id,group:'Devis en attente',label:[row.name,row.reference||'Sans référence',row.supplier||'Sans fournisseur',row.status].filter(Boolean).join(' · ')}];
    return row.lines.filter(l=>!l.received).map(l=>({value:'order:'+row.id+'#'+l.id,group:'Devis en attente',label:[l.name,l.reference||'Sans référence',row.supplier||'Sans fournisseur',row.status].filter(Boolean).join(' · '),searchText:[l.name,l.reference,row.name,row.supplier,l.location,row.status].filter(Boolean).join(' ')}));
  }).sort((a,b)=>(a.group==='Magasin'?0:1)-(b.group==='Magasin'?0:1)||a.label.localeCompare(b.label,'fr',{numeric:true}));
}
export function selectedPlanningReference(records:Row[],value:string):ReferenceOption|undefined {
  if(!value)return;
  const kind=value.startsWith('part:')?'part':'order',identifier=value.slice(kind.length+1),[id,lineId]=identifier.split('#');
  const row=records.find(r=>r.id===id&&r.kind===kind);
  const line=row&&kind==='order'?linkedOrderLine(row,lineId):undefined;
  return {value,group:'Sélection actuelle',label:!row||row.deleted?'Référence supprimée — à remplacer':[line?.name||row.name,line?.reference||row.reference||'Sans référence',row.supplier||'',line?.received||row.status==='Reçu'?'Déjà reçue · lien conservé':row.status||''].filter(Boolean).join(' · ')};
}
