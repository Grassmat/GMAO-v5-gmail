import { AppError } from '../auth';
import { database } from '../store';
import type { SupplierOffer } from './types';
export function validPrice(value:unknown,previous:number|null=null):number|null {
 if(value===undefined)return previous;
 if(value===null||value==='')return null;
 if(!Number.isSafeInteger(value)||(value as number)<0||(value as number)>100000000)throw new AppError('Le prix doit être positif, en centimes (1 000 000 € maximum).');
 return value as number;
}
export function supplierOffers(part:{supplier?:string;reference?:string;suppliers?:SupplierOffer[];unitCostCents?:number|null}):SupplierOffer[] {
 if(Array.isArray(part.suppliers))return part.suppliers;
 return part.supplier?[{id:'primary',name:part.supplier,reference:part.reference||'',unitCostCents:part.unitCostCents??null}]:[];
}
export function validateSuppliers(input:unknown):SupplierOffer[] {
 if(!Array.isArray(input)||input.length>100)throw new AppError('Cent fournisseurs maximum par pièce.');
 const seen=new Set<string>();return input.map(row=>{
  if(!row||typeof row.id!=='string'||!/^(primary|[a-f0-9-]{36})$/.test(row.id)||seen.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>200||typeof row.reference!=='string'||row.reference.length>200)throw new AppError('Fournisseur ou référence fournisseur invalide.');
  seen.add(row.id);return {id:row.id,name:row.name.trim(),reference:row.reference.trim(),unitCostCents:validPrice(row.unitCostCents)};
 });
}
// Runs inside the receipt transaction. JSON-path updates preserve unrelated stock edits,
// and successive receipts of the same reference can update it without conflicting CAS writes.
export function receiptPricing(part:string,site:string,supplier:string,reference:string,unitCostCents:number|null) {
 const db=database(),ops=[];
 if(unitCostCents!==null)ops.push(db.prepare("UPDATE records SET data=json_set(data,'$.unitCostCents',?) WHERE id=? AND site=? AND kind='part'").bind(unitCostCents,part,site));
 if(supplier){
  const offer={id:crypto.randomUUID(),name:supplier,reference,unitCostCents};
  ops.push(db.prepare(`UPDATE records SET data=json_set(data,'$.suppliers',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(COALESCE(json_extract(data,'$.suppliers'),CASE WHEN COALESCE(json_extract(data,'$.supplier'),'')<>'' THEN json_array(json_object('id','primary','name',json_extract(data,'$.supplier'),'reference',COALESCE(json_extract(data,'$.reference'),''),'unitCostCents',json_extract(data,'$.unitCostCents'))) ELSE '[]' END)) WHERE json_extract(value,'$.name')=? AND json_extract(value,'$.reference')=?) THEN COALESCE(json_extract(data,'$.suppliers'),CASE WHEN COALESCE(json_extract(data,'$.supplier'),'')<>'' THEN json_array(json_object('id','primary','name',json_extract(data,'$.supplier'),'reference',COALESCE(json_extract(data,'$.reference'),''),'unitCostCents',json_extract(data,'$.unitCostCents'))) ELSE '[]' END) ELSE json_insert(COALESCE(json_extract(data,'$.suppliers'),CASE WHEN COALESCE(json_extract(data,'$.supplier'),'')<>'' THEN json_array(json_object('id','primary','name',json_extract(data,'$.supplier'),'reference',COALESCE(json_extract(data,'$.reference'),''),'unitCostCents',json_extract(data,'$.unitCostCents'))) ELSE '[]' END),'$[#]',json(?)) END)) WHERE id=? AND site=? AND kind='part'`).bind(supplier,reference,JSON.stringify(offer),part,site));
 }
 return ops;
}
