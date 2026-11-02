'use client';
import { QuotePdfImport } from './quote-pdf-import';
import { SupplierChoice } from './supplier-fields';
import { priceInput, priceCents, money, orderTotal } from '../../lib/maintenance/pricing';
import { MultiOrderFields, newOrderLine } from './multi-order-fields';
import { orderLines } from '../../lib/maintenance/order-lines';
import type { MaintenanceModel } from './use-maintenance';
import { WaitingReportLink } from './waiting-report-link';
import { OrderDocuments } from './order-documents';
export function OrderFields({ model, hideReportLink = false }: { model: Pick<MaintenanceModel, 'modal' | 'setModal' | 'parts' | 'machines' | 'onSessionChanged' | 'site'>; hideReportLink?: boolean }) {
  const { modal, setModal, parts, machines } = model;
  const set = (key: string, value: unknown) => setModal({ ...modal, [key]: value });
  const received = !!modal.receivedAt || modal.originalStatus === 'Reçu';
  const existing = modal.orderMode === 'existing' || !!modal.part;
  return <>
    <QuotePdfImport model={model}/>
    <fieldset className="order-manual-fields" disabled={!!modal.pdfImportPending}>
    {modal.lines ? <MultiOrderFields model={model}/> : <>
    <fieldset disabled={received}><legend>Pièce à acheter</legend>
      <label className="check"><input type="radio" name="order-mode" checked={existing} onChange={() => setModal({ ...modal, orderMode: 'existing', part: '', name: '', reference: '' })} />Référence déjà en magasin</label>
      <label className="check"><input type="radio" name="order-mode" checked={!existing} onChange={() => setModal({ ...modal, orderMode: 'new', part: '', name: '', reference: '' })} />Nouvelle référence</label>
    </fieldset>
    {existing ? <label>Référence du magasin *<select required disabled={received} value={modal.part || ''} onChange={e => {
      const part = parts.find(p => p.id === e.target.value);
      setModal({ ...modal, part: e.target.value, name: part?.name || '', reference: part?.reference || '', supplier: modal.supplier || part?.supplier || '' });
    }}><option value="">Choisir une pièce…</option>{parts.map(part => <option key={part.id} value={part.id}>{part.name} · {part.reference || 'Sans référence'}</option>)}{modal.part && !parts.some(p => p.id === modal.part) && <option value={modal.part}>{modal.name} (référence supprimée)</option>}</select></label> : <>
      <label>Nom de la nouvelle pièce *<input required maxLength={150} disabled={received} value={modal.name || ''} onChange={e => set('name', e.target.value)} /></label>
      <label>Référence<input maxLength={200} disabled={received} value={modal.reference || ''} onChange={e => set('reference', e.target.value)} /></label>
      <label>Emplacement à la réception<input maxLength={200} disabled={received} value={modal.location || ''} onChange={e => set('location', e.target.value)} /></label>
    </>}
    {existing && <SupplierChoice part={parts.find(p=>p.id===modal.part)} onSelect={offer=>setModal({...modal,supplier:offer.name,supplierReference:offer.reference,unitCostCents:offer.unitCostCents})}/>}
    <label>Fournisseur<input maxLength={200} value={modal.supplier || ''} onChange={e => set('supplier', e.target.value)} /></label>
    <label>Référence fournisseur<input maxLength={200} value={modal.supplierReference||''} onChange={e=>set('supplierReference',e.target.value)}/></label>
    <label>Prix unitaire (€ HT, facultatif)<input type="number" min={0} max={1000000} step="0.01" value={priceInput(modal.unitCostCents)} onChange={e=>set('unitCostCents',priceCents(e.target.value))}/></label>
    <label>Quantité commandée *<input required type="number" min="1" max="1000000" step="1" disabled={received} value={modal.quantity ?? 1} onChange={e => set('quantity', e.target.value === '' ? '' : Number(e.target.value))} /></label>
    <label>Machine<select disabled={received} value={modal.machine || ''} onChange={e => set('machine', e.target.value)}><option value="">Magasin / non assignée</option>{machines.filter(m => !m.archived || m.id === modal.machine).map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
    <label>Statut<select disabled={received} value={modal.status || 'Devis'} onChange={e => set('status', e.target.value)}>{(modal.originalStatus === 'Refusé' ? ['Refusé','Devis','Annulé'] : ['Devis', 'Commandé', 'Reçu', 'Annulé', ...(modal.originalStatus === 'Devis' ? ['Refusé'] : [])]).map(status => <option key={status}>{status}</option>)}</select></label>
    <label className="check"><input type="checkbox" disabled={received || modal.originalStatus === 'Refusé' || modal.status === 'Refusé'} checked={modal.status === 'Reçu'} onChange={e => set('status', e.target.checked ? 'Reçu' : 'Commandé')} />Pièce reçue</label>
    <button type="button" onClick={()=>setModal({...modal,name:modal.name||'Devis multi-pièces',status:modal.status==='Reçu'?'Partiellement reçu':modal.status,originalReceivedIds:orderLines(modal).filter(l=>l.received).map(l=>l.id),lines:[...orderLines(modal).map(line=>!modal.id?{...line,id:crypto.randomUUID()}:line),newOrderLine(modal.machine||'')]})}>Ajouter une autre pièce</button>
    </>}
    <p className="quote-cost-total">Total chiffré : <strong>{money(orderTotal(modal).cents)}</strong>{orderTotal(modal).missing>0 && <small>{orderTotal(modal).missing} ligne(s) sans prix ou quantité — total partiel.</small>}</p>
    <label>Joindre un PDF au devis<input type="file" accept="application/pdf,.pdf" onChange={e => setModal({ ...modal, pdfFile: e.target.files?.[0] || null, documentId: crypto.randomUUID() })} /><small>50 Mo maximum. Le PDF sera ajouté quand vous enregistrerez le devis.</small>{modal.pdfFile && <small>À envoyer : {modal.pdfFile.name}</small>}</label>
    {!hideReportLink && <WaitingReportLink site={modal.site || model.site} draft={modal} onChange={setModal} onSessionChanged={model.onSessionChanged} />}
    {modal.id && <OrderDocuments order={modal.id} onSessionChanged={model.onSessionChanged} />}
    {!modal.lines&&<p className="muted">{modal.status === 'Refusé' ? 'Ce devis est archivé sans effet sur le stock. Remettez-le dans les devis actifs pour le commander.' : received ? (modal.receivedAt ? 'Cette réception a déjà actualisé le stock. Pour corriger une quantité, utilisez une entrée ou une sortie dans le magasin.' : 'Ancienne réception : le stock ne sera pas crédité rétroactivement.') : existing ? 'Le passage à « Reçu » ajoutera la quantité commandée au stock de la référence choisie.' : 'Le passage à « Reçu » créera cette référence dans le magasin avec la quantité commandée. Son minimum sera réglable ensuite.'}</p>}
    </fieldset>
  </>;
}
