'use client';
import { Trash2 } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
export function MovementsView({model}:{model:MaintenanceModel}) {
  const {tab,moves,site,records,machines}=model;
  if(tab!=='Magasin')return null;
  return <section className="panel"><h2>Mouvements récents</h2>{moves.filter(m=>m.site===site).map(m=>{
    const name=records.find(p=>p.id===m.part&&p.kind==='part')?.name||'Référence historique';
    return <div className="movement" key={m.id}><b>{m.quantity>0?'+':''}{m.quantity}</b><div>{name}<small>{m.reason} · {machines.find(x=>x.id===m.machine)?.name||'Magasin'} · {m.actor}</small></div><time>{new Date(m.created).toLocaleString('fr-FR')}</time>{model.user.role==='admin'&&<button className="danger" disabled={model.saving} aria-label={'Supprimer le mouvement de '+name} onClick={()=>{if(window.confirm('Supprimer ce mouvement de '+m.quantity+' pour « '+name+' » ? La quantité en stock et le document lié seront mis à jour.'))void model.save({action:'delete-movement',id:m.id});}}><Trash2 size={16}/>Supprimer</button>}</div>;
  })}{!moves.some(m=>m.site===site)&&<div className="empty">Les entrées et sorties de stock apparaîtront ici.</div>}<small>Seul l’admin peut supprimer un mouvement. Une réception supprimée repasse en attente ; les pièces consommées par un rapport sont recalculées.</small></section>;
}
