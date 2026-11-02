'use client';
import { money, orderTotal } from '../../lib/maintenance/pricing';
import { orderLines } from '../../lib/maintenance/order-lines';
import { QuoteRequests } from './quote-approval';
import { useState } from 'react';
import { QuoteMail } from './quote-mail';
import type { Row } from '../../lib/maintenance/types';
import { Plus, PackageCheck, Trash2, XCircle, RotateCcw } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';

function OrdersTable({model,orders,archived=false,onMail}:{model:MaintenanceModel;orders:Row[];archived?:boolean;onMail:(order:Row)=>void}) {
  const {saving,setModal}=model;
  return <div className="table-wrap"><table><thead><tr><th>Pièce / référence</th><th>Fournisseur</th><th>Quantité</th><th>{archived?'Refus':'Statut'}</th><th>Actions</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}>
    <td><strong>{order.name}</strong>{order.lines?<small>{order.lines.length} pièces · {order.lines.filter(l=>l.received).length} reçues</small>:<small>{order.reference || 'Sans référence'} · {order.part ? 'Référence existante' : 'Nouvelle référence'}</small>}</td>
    <td>{order.supplier || '—'}<small>{orderTotal(order).missing===orderLines(order).length?'Prix non renseigné':money(orderTotal(order).cents)+' HT'+(orderTotal(order).missing?' · partiel':'')}</small></td><td>{order.lines?'Voir les pièces':order.quantity ?? 'À préciser'}</td>
    <td>{!model.readOnly&&order.status==='Devis'?<button className="badge" disabled={saving} title="Passer à Commandé" aria-label={'Passer à Commandé : '+order.name} onClick={()=>model.save({...order,status:'Commandé'})}>Devis</button>:<span className="badge">{order.status}</span>}
      {order.receivedAt && <small>Stock mis à jour</small>}{archived&&order.refusedAt&&<small>{new Date(order.refusedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}{order.refusedBy?' · '+order.refusedBy:''}</small>}</td>
    <td><div className="actions"><button onClick={() => setModal({ ...order, originalStatus: order.status, originalReceivedIds:orderLines(order).filter(l=>l.received).map(l=>l.id) })}>{model.readOnly?'Fiche / PDF':'Modifier / PDF'}</button>
      {!model.readOnly&&!archived&&<button onClick={()=>onMail(order)}>Demander par mail</button>}
      {!model.readOnly&&order.status==='Devis'&&<button className="danger" disabled={saving} aria-label={'Refuser le devis : '+order.name} onClick={()=>model.save({action:'refuse-order',id:order.id,revision:order.revision})}><XCircle size={16}/>Refuser</button>}
      {!model.readOnly&&archived&&order.status==='Refusé'&&<button disabled={saving} onClick={()=>model.save({action:'restore-order',id:order.id,revision:order.revision})}><RotateCcw size={16}/>Remettre en devis</button>}
      {!model.readOnly&&!archived && !order.lines && order.status !== 'Reçu' && order.status !== 'Annulé' && <button disabled={saving} onClick={() => setModal({ ...order, originalStatus: order.status, originalReceivedIds:orderLines(order).filter(l=>l.received).map(l=>l.id), quantity: order.quantity ?? 1, status: 'Reçu' })}><PackageCheck size={16} />Marquer reçu</button>}
      {model.user.role === 'admin' && <button className="danger" onClick={() => setModal({ action: 'delete-order', id: order.id, name: order.name, status: order.status })}><Trash2 size={16} />Supprimer</button>}
    </div>{order.lines&&<details className="order-receipt-lines"><summary>Pièces et réceptions ({order.lines.length})</summary>{order.lines.map(line=><div className="order-receipt-line" key={line.id}><div><strong>{line.name}</strong><small>{line.reference||'Sans référence'} · quantité {line.quantity??'à préciser'} · {line.received?'Reçue':'En attente'}</small></div>{!model.readOnly&&!archived&&!line.received&&order.status!=='Annulé'&&<button disabled={saving} onClick={()=>model.save({action:'receive-order-line',id:order.id,lineId:line.id,revision:order.revision})}><PackageCheck size={16}/>Reçu</button>}</div>)}</details>}</td>
  </tr>)}</tbody></table></div>;
}
export function OrdersView({ model }: { model: MaintenanceModel }) {
  const [mail,setMail]=useState<Row|true|null>(null);
  const { tab, selected, site, records, setModal } = model;
  if (tab !== 'Devis & achats' && !selected) return null;
  // D1 insertion order also covers older quotes without a creation timestamp.
  const all = records.filter(row => row.kind === 'order' && !row.deleted && row.site === site && (!selected || (row.machine === selected.id || row.lines?.some(l=>l.machine===selected.id))))
    .sort((a,b) => (b.creationOrder || 0) - (a.creationOrder || 0) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const orders=all.filter(row=>!['Reçu','Refusé','Annulé'].includes(row.status||''));
  const received=all.filter(row=>row.status==='Reçu');
  const refused=all.filter(row=>['Refusé','Annulé'].includes(row.status||'')).sort((a,b)=>(b.refusedAt||'').localeCompare(a.refusedAt||''));
  return <><section className="panel"><div className="panel-head"><h2>Devis & commandes en attente ({orders.length})</h2>{!model.readOnly&&<button onClick={()=>setMail(true)}>Demander un devis par mail</button>}{!model.readOnly && selected && <button onClick={() => setModal({ kind: 'order', site, clientId: crypto.randomUUID(), name: '', part: '', quantity: 1, machine: selected.id, status: 'Devis' })}><Plus size={16} />Ajouter</button>}</div>
    {!orders.length ? <div className="empty">Aucun devis ou commande en attente.</div> : <OrdersTable model={model} orders={orders} onMail={setMail}/>}
    <details className="received-orders"><summary>Reçus ({received.length})</summary>{received.length?<OrdersTable model={model} orders={received} onMail={setMail}/>:<p className="muted">Aucune réception enregistrée.</p>}</details>
  </section>
    {!selected&&<QuoteRequests model={model}/>}
    <section className="panel"><div className="panel-head"><h2>Devis refusés et annulés · archives ({refused.length})</h2></div><p className="muted">Les devis non retenus restent consultables avec leurs informations et leurs PDF.</p>
      {!refused.length?<div className="empty">Aucun devis refusé ou annulé.</div>:<OrdersTable model={model} orders={refused} archived onMail={setMail}/>}
    </section>
    {mail&&!model.readOnly&&<QuoteMail model={model} order={mail===true?undefined:mail} onClose={()=>setMail(null)}/>}</>;
}
