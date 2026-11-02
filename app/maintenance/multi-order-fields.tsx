'use client';
import { SupplierChoice } from './supplier-fields';
import { priceInput, priceCents } from '../../lib/maintenance/pricing';
import { Plus, Trash2 } from 'lucide-react';
import type { OrderLine } from '../../lib/maintenance/types';
import type { MaintenanceModel } from './use-maintenance';
export function newOrderLine(machine=''):OrderLine {return {id:crypto.randomUUID(),name:'',reference:'',location:'',part:'',quantity:1,machine,received:false};}
export function MultiOrderFields({model}:{model:Pick<MaintenanceModel,'modal'|'setModal'|'parts'|'machines'>}) {
  const {modal,setModal,parts,machines}=model,lines=modal.lines as OrderLine[];
  const set=(key:string,value:unknown)=>setModal({...modal,[key]:value});
  const change=(index:number,patch:Partial<OrderLine>)=>set('lines',lines.map((line,i)=>i===index?{...line,...patch}:line));
  const hasReceived=lines.some(l=>!!l.receivedAt||modal.originalReceivedIds?.includes(l.id));
  return <>
    <label>Intitulé du devis *<input required maxLength={150} value={modal.name||''} onChange={e=>set('name',e.target.value)}/></label>
    <label>Fournisseur<input maxLength={200} value={modal.supplier||''} onChange={e=>set('supplier',e.target.value)}/></label>
    <label>Statut du devis<select value={modal.status||'Devis'} onChange={e=>set('status',e.target.value)}>
      {(modal.originalStatus==='Refusé'?['Refusé','Devis','Annulé']:hasReceived?['Partiellement reçu','Reçu']:['Devis','Commandé','Reçu','Annulé',...(modal.originalStatus==='Devis'?['Refusé']:[])]).map(status=><option key={status}>{status}</option>)}
    </select><small>Le statut « Reçu » réceptionne toutes les lignes restantes à l’enregistrement. Cochez chaque pièce séparément pour une réception partielle.</small></label>
    {lines.map((line,index)=>{
      const locked=!!line.receivedAt||modal.originalReceivedIds?.includes(line.id)||line.id==='legacy'&&modal.originalStatus==='Reçu';
      const existing=!!line.part;
      return <fieldset className="order-line-fields" key={line.id}><legend>Pièce {index+1}{locked?' · Reçue':''}</legend>
        <fieldset disabled={locked} className="order-line-content"><legend>Référence et quantité</legend>
          <label>Origine de la pièce<select aria-label={'Origine de la pièce '+(index+1)} value={existing?'existing':'new'} onChange={e=>change(index,{part:e.target.value==='existing'?'__choose__':'',name:'',reference:''})}><option value="new">Nouvelle référence</option><option value="existing">Référence déjà en magasin</option></select></label>
          {existing?<label>Référence du magasin *<select required value={line.part==='__choose__'?'':line.part} onChange={e=>{const part=parts.find(p=>p.id===e.target.value);change(index,{part:e.target.value||'__choose__',name:part?.name||'',reference:part?.reference||''});}}><option value="">Choisir une pièce…</option>{parts.map(part=><option key={part.id} value={part.id}>{part.name} · {part.reference||'Sans référence'}</option>)}{line.part!=='__choose__'&&!parts.some(p=>p.id===line.part)&&<option value={line.part}>{line.name} (référence supprimée)</option>}</select></label>:<>
            <label>Nom de la pièce *<input required maxLength={150} value={line.name} onChange={e=>change(index,{name:e.target.value})}/></label>
            <label>Référence<input maxLength={200} value={line.reference} onChange={e=>change(index,{reference:e.target.value})}/></label>
            <label>Emplacement à la réception<input maxLength={200} value={line.location} onChange={e=>change(index,{location:e.target.value})}/></label>
          </>}
          {existing && <SupplierChoice part={parts.find(p=>p.id===line.part)} onSelect={offer=>setModal({...modal,supplier:offer.name,lines:lines.map((l,i)=>i===index?{...l,supplierReference:offer.reference,unitCostCents:offer.unitCostCents}:l)})}/>}
          <label>Quantité commandée *<input required type="number" min={1} max={1000000} step={1} value={line.quantity??1} onChange={e=>change(index,{quantity:e.target.value===''?undefined:Number(e.target.value)})}/></label>
          <label>Machine<select value={line.machine} onChange={e=>change(index,{machine:e.target.value})}><option value="">Magasin / non assignée</option>{machines.filter(m=>!m.archived||m.id===line.machine).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </fieldset>
        <label>Référence fournisseur<input maxLength={200} value={line.supplierReference||''} onChange={e=>change(index,{supplierReference:e.target.value})}/></label>
        <label>Prix unitaire (€ HT, facultatif)<input type="number" min={0} max={1000000} step="0.01" value={priceInput(line.unitCostCents)} onChange={e=>change(index,{unitCostCents:priceCents(e.target.value)})}/></label>
        <label className="check"><input type="checkbox" disabled={locked||['Refusé','Annulé'].includes(modal.status)||modal.originalStatus==='Refusé'} checked={line.received||modal.status==='Reçu'} onChange={e=>change(index,{received:e.target.checked})}/>Pièce {index+1} reçue</label>
        {locked?<small>Réception conservée. Pour corriger la quantité, utilisez un mouvement de stock.</small>:<button type="button" className="danger" disabled={lines.length===1} onClick={()=>set('lines',lines.filter((_,i)=>i!==index))}><Trash2 size={16}/>Retirer cette pièce</button>}
      </fieldset>;
    })}
    <button type="button" onClick={()=>setModal({...modal,status:modal.status==='Reçu'?'Partiellement reçu':modal.status,lines:[...lines,newOrderLine(modal.machine||'')]})}><Plus size={16}/>Ajouter une pièce</button>
    <p className="muted">Chaque ligne reçue actualise uniquement sa référence dans le magasin. Les autres pièces restent en attente.</p>
  </>;
}
