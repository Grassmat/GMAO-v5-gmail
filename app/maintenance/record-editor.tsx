'use client';
import {ModalFooter} from '../shared/modal-footer';
import { money, orderTotal } from '../../lib/maintenance/pricing';
import { X } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
import { PartFields } from './part-fields';
import { OrderDocuments } from './order-documents';
import { OrderFields } from './order-fields';
export function RecordEditor({ model }: { model: MaintenanceModel }) {
  const { modal, setModal, save, machines, error, saving, qty } = model;
  if (!modal) return null;
  if (model.readOnly) return <div className="overlay"><div className="modal"><div className="panel-head"><h2>{modal.name}</h2><button onClick={() => setModal(null)}>Fermer</button></div><p>Consultation uniquement</p><p>Référence : {modal.reference || '—'}</p><p>Fournisseur : {modal.supplier || '—'}</p><p>Prix unitaire de référence : {money(modal.unitCostCents)} HT</p>{modal.suppliers?.map((s:any)=><p key={s.id}>{s.name} · {s.reference||'Sans référence'} · {money(s.unitCostCents)} HT</p>)}{modal.kind==='order'&&<p>Total chiffré : {money(orderTotal(modal).cents)} HT{orderTotal(modal).missing?' · montant partiel':''}</p>}<p>Statut : {modal.status || '—'}</p>{modal.lines?modal.lines.map((line:any)=><p key={line.id}>{line.name} · {line.reference||'Sans référence'} · quantité {line.quantity??'—'} · {line.received?'Reçue':'En attente'}</p>):<p>Quantité : {modal.quantity??'—'}</p>}{modal.kind === 'part' && <><p>Stock : {qty(modal.id)} · Minimum : {modal.minimum || 0}</p><p>Emplacement : {modal.location || '—'}</p><p>Famille : {(model.categories||[]).find(c=>c.id===modal.category)?.name||'Sans famille'}</p><p>Machines compatibles : {modal.machines?.map((id: string) => machines.find(machine => machine.id === id)?.name || id).join(', ') || 'Magasin général'}</p></>}{modal.kind === 'order' && <OrderDocuments order={modal.id} onSessionChanged={model.onSessionChanged}/>}<ModalFooter onClose={()=>setModal(null)}/></div></div>;
  const movement = modal.action === 'movement', deleting = modal.action === 'delete-part' || modal.action === 'delete-order', minimum = modal.action === 'minimum';
  const title = modal.kind==='part-category' ? (modal.id?'Renommer la famille':'Créer une famille') : deleting ? (modal.action === 'delete-order' ? 'Supprimer un devis' : 'Supprimer une référence') : minimum ? 'Stock minimum' : movement ? (modal.quantity > 0 ? 'Entrée de stock' : 'Sortie de stock') : modal.id ? 'Modifier' : 'Ajouter';
  return <div className="overlay"><form className="modal" onSubmit={e => { e.preventDefault(); if(!modal.pdfImportPending)save(modal); }} role="dialog" aria-modal="true" aria-labelledby="record-title">
    <div className="panel-head"><h2 id="record-title">{title}</h2><button type="button" disabled={saving} onClick={() => setModal(null)} aria-label="Fermer"><X size={20} /></button></div>
    <fieldset className="record-fields" disabled={saving}>
      {deleting ? <><p><strong>{modal.name}</strong></p>{modal.action === 'delete-order' ? <><p>Ce devis et ses PDF disparaîtront de la liste.</p>{modal.status === 'Reçu' && <p>Les pièces déjà reçues restent dans le stock. Pour corriger leur quantité, utilisez une entrée ou une sortie dans le magasin.</p>}</> : <><p>{modal.reference || 'Sans référence'} · Stock actuel : {qty(modal.id)}.</p><p>Cette référence disparaîtra du magasin et des choix de pièces. Ses mouvements et les rapports d’intervention seront conservés.</p></>}</> : minimum ? <><p>{modal.name}</p><label>Minimum à garder en stock<input required type="number" min="0" max="1000000" step="1" value={modal.minimum ?? 0} onChange={e => setModal({ ...modal, minimum: e.target.value === '' ? '' : Number(e.target.value) })} /></label><p className="muted">Ce seuil déclenche l’alerte de réapprovisionnement. Il ne modifie pas la quantité disponible.</p></> : movement ? <>
        <p>{modal.name}</p><label>Quantité<input required min="1" max="1000000" step="1" type="number" value={Math.abs(modal.quantity) || ''} onChange={e => setModal({ ...modal, quantity: Math.abs(Number(e.target.value)) * (modal.movementDirection || (modal.quantity > 0 ? 1 : -1)) })} /></label>
        <label>Machine<select value={modal.machine || ''} onChange={e => setModal({ ...modal, machine: e.target.value })}><option value="">Magasin / non assignée</option>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Motif<input required value={modal.reason || ''} onChange={e => setModal({ ...modal, reason: e.target.value })} /></label>
      </> : modal.kind === 'order' ? <OrderFields model={model} /> : <>
        <label>{modal.kind==='part-category'?'Nom de la famille':'Nom'}<input required maxLength={modal.kind==='part-category'?80:150} value={modal.name || ''} onChange={e => setModal({ ...modal, name: e.target.value })} /></label>
        {modal.kind==='part-category'&&<p className="muted">Exemples : Roulements, Courroies, Pneumatique. Affectez ensuite les références depuis leur fiche.</p>}{modal.kind === 'part' && <PartFields model={model} />}
      </>}
    </fieldset>
    {error && <p role="alert" className="error">{error}</p>}
    <ModalFooter onClose={()=>setModal(null)} disabled={saving}><button className={deleting ? 'danger' : 'primary'} disabled={saving||!!modal.pdfImportPending}>{saving ? 'Enregistrement…' : deleting ? (modal.action === 'delete-order' ? 'Supprimer le devis' : 'Supprimer du magasin') : 'Enregistrer'}</button></ModalFooter>
  </form></div>;
}
