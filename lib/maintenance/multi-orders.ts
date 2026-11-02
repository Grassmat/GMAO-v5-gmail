import { validPrice, receiptPricing } from './suppliers';
import { AppError, type User } from '../auth';
import { database } from '../store';
import { validMachine } from './repository';
import { activePart, stockQuantity } from './parts';
import { stockMovementStatement } from './stock';
import { orderLines } from './order-lines';
import type { OrderLine } from './types';

export async function prepareMultiOrder(user:User,input:any,context:{id:string;row:{data:string}|null;previous:any}) {
  const {id,row,previous}=context,db=database(),site=input.site;
  if (!Array.isArray(input.lines)||!input.lines.length||input.lines.length>1000) throw new AppError('Ajoutez au moins une pièce au devis.');
  const oldLines=previous?orderLines(previous):[],oldById=new Map(oldLines.map(line=>[line.id,line]));
  const requestedStatus=input.status||'Devis';
  if (!['Devis','Commandé','Reçu','Partiellement reçu','Annulé','Refusé'].includes(requestedStatus)) throw new AppError('Statut invalide.');
  if (row&&(input.revision??0)!==(previous.revision??0)) throw new AppError('Ce devis a changé. Rechargez-le avant de modifier.',409);
  if (requestedStatus==='Refusé'&&previous&&!['Devis','Refusé'].includes(previous.status)) throw new AppError('Seul un devis non commandé peut être refusé.',409);
  if(previous?.status==='Refusé'&&['Commandé','Reçu','Partiellement reçu'].includes(requestedStatus))throw new AppError('Remettez d’abord ce devis dans les devis actifs avant de le commander.',409);
  const seen=new Set<string>(),lines:OrderLine[]=[],receiptOps=[],created=new Date().toISOString();
  for(const raw of input.lines) {
    if(!raw||typeof raw.id!=='string'||!(/^[a-f0-9-]{36}$/.test(raw.id)||raw.id==='legacy')||seen.has(raw.id))throw new AppError('Identifiant de ligne invalide ou dupliqué.');
    if(raw.received!=null&&typeof raw.received!=='boolean')throw new AppError('État de réception invalide.');
    seen.add(raw.id);
    const old=oldById.get(raw.id),received=!!old?.received;
    if(raw.id==='legacy'&&previous&&!old)throw new AppError('Identifiant de ligne réservé.');
    if(typeof raw.name!=='string'||!raw.name.trim())throw new AppError('Nom de chaque pièce obligatoire.');
    const part=typeof raw.part==='string'?raw.part:'',machine=typeof raw.machine==='string'?raw.machine:'';
    const quantity=received&&old.quantity==null?undefined:stockQuantity(raw.quantity??1);
    if(received) {
      if(raw.name.trim()!==old.name||String(raw.reference||'')!==old.reference||part!==old.part||quantity!==old.quantity||machine!==old.machine||raw.received===false)
        throw new AppError('Une ligne déjà reçue ne peut plus être changée ou décochée. Corrigez le stock par une entrée ou une sortie.',409);
      if(raw.unitCostCents!==undefined&&raw.unitCostCents!==old.unitCostCents&&old.receivedPart)receiptOps.push(...receiptPricing(old.receivedPart,site,String(input.supplier||'').trim().slice(0,200),String(raw.supplierReference??old.supplierReference??old.reference).slice(0,200),validPrice(raw.unitCostCents)));
      lines.push({...old,unitCostCents:validPrice(raw.unitCostCents,old.unitCostCents??null),supplierReference:String(raw.supplierReference??old.supplierReference??'').trim().slice(0,200)});continue;
    }
    const unchanged=old&&part===old.part;
    // Retired references may remain in historical quotes, but cannot receive stock.
    let ref:any=null;
    if(part) {
      if(raw.received===true||requestedStatus==='Reçu'||!unchanged) ref=await activePart(part,site);
    }
    if(machine&&(!old||machine!==old.machine))await validMachine(machine,site);
    const line:OrderLine={id:raw.id,name:raw.name.trim().slice(0,150),reference:ref?ref.values.reference||'':String(raw.reference||'').trim().slice(0,200),
      unitCostCents:validPrice(raw.unitCostCents,old?.unitCostCents??null),supplierReference:String(raw.supplierReference??old?.supplierReference??'').trim().slice(0,200),location:String(raw.location||'').trim().slice(0,200),part,quantity,machine,receiptGeneration:old?.receiptGeneration||0,received:false,receivedAt:'',receivedPart:''};
    const receives=raw.received===true||requestedStatus==='Reçu';
    if(receives) {
      if(['Refusé','Annulé'].includes(requestedStatus)||['Refusé','Annulé'].includes(previous?.status))throw new AppError('Remettez ce devis en commande avant de recevoir une pièce.',409);
      const receivedPart=part||'purchase-part:'+id+':'+raw.id,receiptId=id+':'+raw.id+(old?.receiptGeneration?':r'+old.receiptGeneration:'');
      line.received=true;line.receivedAt=created;line.receivedPart=receivedPart;
      if(!part)receiptOps.push(db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(receivedPart,'part',site,JSON.stringify({name:line.name,reference:line.reference,supplier:String(input.supplier||'').trim().slice(0,200),location:line.location,machines:machine?[machine]:[],minimum:0,deleted:false})));
      receiptOps.push(...receiptPricing(receivedPart,site,String(input.supplier||'').trim().slice(0,200),line.supplierReference||line.reference,line.unitCostCents??null));
      receiptOps.push(db.prepare('INSERT INTO purchase_line_receipts(id,order_id,line_id,part,site,quantity,actor,created) VALUES(?,?,?,?,?,?,?,?)').bind(receiptId,id,raw.id,receivedPart,site,quantity,user.name,created));
      receiptOps.push(stockMovementStatement({id:'receipt-line:'+receiptId,part:receivedPart,site,quantity:quantity!,machine:machine||null,reason:'Réception · '+line.name+(input.supplier?' · '+String(input.supplier).trim():''),actor:user.name,created}));
    }
    lines.push(line);
  }
  if(oldLines.some(line=>line.received&&!seen.has(line.id)))throw new AppError('Une pièce déjà reçue ne peut pas être retirée du devis.',409);
  const receivedCount=lines.filter(line=>line.received).length;
  if(receivedCount&&['Refusé','Annulé','Devis'].includes(requestedStatus)) {
    if(['Refusé','Annulé'].includes(requestedStatus))throw new AppError('Ce devis contient des pièces reçues. Conservez leur réception et leur historique.',409);
  }
  const status=receivedCount===lines.length?'Reçu':receivedCount?'Partiellement reçu':requestedStatus==='Partiellement reçu'?'Commandé':requestedStatus;
  if(!Number.isSafeInteger(lines.reduce((sum,l)=>sum+(l.unitCostCents??0)*(l.quantity??0),0)))throw new AppError('Le montant total du devis est trop élevé.');
  const first=lines[0],data={...previous,name:lines.length===1?first.name:input.name.trim().slice(0,150),supplier:String(input.supplier||'').trim().slice(0,200),
    lines,status,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||(row?undefined:created),
    // Legacy summaries are unambiguous only for single-line quotes.
    reference:lines.length===1?first.reference:'',quantity:lines.length===1?first.quantity:undefined,part:lines.length===1?first.part:'',
    machine:lines.every(l=>l.machine===first.machine)?first.machine:'',receivedPart:lines.length===1?first.receivedPart:'',
    receivedAt:status==='Reçu'?(previous?.receivedAt||created):'',
    ...(status==='Refusé'&&previous?.status!=='Refusé'?{refusedAt:created,refusedBy:user.name}:{})};
  const expectedData=JSON.stringify(data);
  const write=row?db.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=? AND kind='order' AND site=?").bind(row.data,expectedData,id,site)
    :db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id,'order',site,expectedData);
  return {id,ops:[write,...receiptOps],receives:receiptOps.length>0,part:data.part,quantity:data.quantity,site,expectedData,data};
}
