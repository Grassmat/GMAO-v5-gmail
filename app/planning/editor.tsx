'use client';
import {ModalFooter} from '../shared/modal-footer';
import { QuotePartsPicker } from './quote-parts-picker';
import { ReferenceSelect } from '../shared/reference-select';
import { planningReferenceOptions, selectedPlanningReference } from '../../lib/maintenance/reference-options';
import { PlanningMachinePicker } from './machine-picker';
import { AssignmentFields } from './assignment';
import { useState } from 'react';
import type { MaintenanceModel } from '../maintenance/use-maintenance';
import type { PlanView, Requirement, Assignment, Teammate } from '../../lib/planning/types';
export function PlanEditor({ model, initial, teammates = [], onClose, onSaved }: {
    model: MaintenanceModel;
    initial?: PlanView;
    teammates?: Teammate[];
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [draft, setDraft] = useState(() => initial ? { ...initial } : { assignment: { mode: 'any', users: [] } as Assignment, notifyEmail:false, clientId: crypto.randomUUID(), site: model.site, name: '', machine: '', machines: [] as string[], date: '', time: '', work: '', instructions: '', requirements: [] as Requirement[], equipment: '', equipmentReady: false });
    const [quotePicker, setQuotePicker] = useState<{order:string;index:number}|null>(null);
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const set = (key: string, value: unknown) => setDraft(d => ({ ...d, [key]: value }));
    async function save(e: React.FormEvent) { e.preventDefault(); if (busy || quotePicker)
        return; setBusy(true); setError(''); try {
        const response = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
        const data: any = await response.json();
        if (response.status === 401 || response.status === 428) {
            model.onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        if(draft.notifyEmail && !initial && (!data.mailReady || data.notification?.missing || data.notificationWarning)) window.alert(data.notificationWarning || (!data.mailReady ? 'Intervention enregistrée. Les mails seront disponibles après activation du service mail.' : 'Intervention enregistrée. Certaines personnes n’ont pas encore confirmé leur adresse mail.'));
        await onSaved();
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
    finally {
        setBusy(false);
    } }
    const referenceOptions=planningReferenceOptions(model.records,model.site,model.qty,true);
    const optionsFor=(value:string)=>referenceOptions.some(o=>o.value===value)||!value?referenceOptions:[...referenceOptions,selectedPlanningReference(model.records,value)!];
    const changeLine = (index: number, line: Requirement) => set('requirements', draft.requirements.map((r, i) => i === index ? line : r));
    const pickedOrder=quotePicker ? model.records.find(r=>r.id===quotePicker.order && r.kind==='order' && r.site===model.site && !r.deleted) : undefined;
    function applyQuote(lines: Requirement[]) {
        if(!quotePicker)return;
        const next:Requirement[]=[];
        draft.requirements.forEach((r,i)=>{if(i===quotePicker.index)next.push(...lines);if(i!==quotePicker.index && r.order!==quotePicker.order)next.push(r);});
        set('requirements',next);setQuotePicker(null);
    }
    return <div className="overlay"><form className="modal intervention-modal" onSubmit={save}><div className="panel-head"><h2>{initial ? 'Modifier' : 'Planifier'} une intervention</h2><button type="button" disabled={busy} onClick={onClose}>Fermer</button></div><fieldset disabled={busy} className="report-fields">
 <label>Titre *<input required maxLength={150} value={draft.name} onChange={e => set('name', e.target.value)}/></label><PlanningMachinePicker machines={model.machines} value={draft} onChange={ids => set('machines', ids)}/>
 <label>Date prévue (facultatif)<input type="date" value={draft.date} onChange={e => set('date', e.target.value)}/></label><label>Heure prévue (facultatif)<input type="time" value={draft.time} onChange={e => set('time', e.target.value)}/></label><label>Travaux prévus<textarea maxLength={10000} value={draft.work} onChange={e => set('work', e.target.value)}/></label><label>Précisions pour réaliser la tâche<textarea maxLength={10000} placeholder="Étapes à suivre, points de contrôle, consignes…" value={draft.instructions || ''} onChange={e => set('instructions', e.target.value)}/></label><small>Laissez la date et/ou l’heure vides si le créneau reste à définir.</small>
 <AssignmentFields value={draft.assignment} teammates={teammates} onChange={value => set('assignment', value)}/>
 {!initial && <label className="check"><input type="checkbox" checked={draft.notifyEmail===true} onChange={e=>set('notifyEmail',e.target.checked)}/>Alerter les personnes affectées par mail à la création</label>}<small>Pour une affectation « N’importe qui », aucun destinataire n’est imposé. Les destinataires doivent avoir confirmé leur adresse mail.</small>
 <fieldset className="plan-reference-fields"><legend>Pièces requises / devis associés</legend><fieldset className="plan-selected-references" disabled={!!quotePicker}>{draft.requirements.map((line, index) => <div className="plan-requirement" key={index}><ReferenceSelect label="Pièce ou devis *" required options={optionsFor(line.part?'part:'+line.part:line.order?'order:'+line.order+(line.orderLine?'#'+line.orderLine:''):'')} value={line.part?'part:'+line.part:line.order?'order:'+line.order+(line.orderLine?'#'+line.orderLine:''):''} onChange={value=>{const [kind,...ids]=value.split(':');const orderId=ids.join(':').split('#')[0];if(kind==='order' && model.records.find(r=>r.id===orderId)?.lines){setQuotePicker({order:orderId,index});return;}changeLine(index,{...line,part:kind==='part'?ids.join(':'):null,order:kind==='order'?ids.join(':').split('#')[0]:null,orderLine:kind==='order'?ids.join(':').split('#')[1]||null:null});}}/><label>Quantité requise<input required type="number" min={1} max={1000000} value={line.quantity} onChange={e => changeLine(index, { ...line, quantity: Number(e.target.value) })}/></label><button type="button" onClick={() => set('requirements', draft.requirements.filter((_, i) => i !== index))}>Retirer</button>{line.order && model.records.find(r=>r.id===line.order)?.lines && draft.requirements.findIndex(r=>r.order===line.order)===index && <button className="quote-parts-edit" type="button" onClick={()=>setQuotePicker({order:line.order!,index})}>Choisir les pièces du devis</button>}</div>)}<button type="button" onClick={() => set('requirements', [...draft.requirements, { part: null, order: null, quantity: 1 }])}>Ajouter une pièce ou un devis</button></fieldset>{quotePicker && !pickedOrder && <p role="alert">Devis indisponible. <button type="button" onClick={()=>setQuotePicker(null)}>Annuler la sélection</button></p>}{pickedOrder && <QuotePartsPicker key={pickedOrder.id} order={pickedOrder} requirements={draft.requirements} onApply={applyQuote} onCancel={()=>setQuotePicker(null)}/>}<small>La planification ne réserve ni ne déduit le stock. Les quantités prévues sont le total pour toutes les machines cochées. La quantité réellement utilisée sera confirmée dans le rapport.</small></fieldset>
 <label>Équipement particulier (facultatif)<input maxLength={1000} placeholder="Ex. nacelle, outillage spécifique" value={draft.equipment} onChange={e => set('equipment', e.target.value)}/></label>{draft.equipment && <label className="check"><input type="checkbox" checked={draft.equipmentReady} onChange={e => set('equipmentReady', e.target.checked)}/>Équipement disponible</label>}
 </fieldset>{error && <p className="error" role="alert">{error}</p>}<ModalFooter onClose={onClose} disabled={busy}><button className="primary" disabled={busy || !!quotePicker}>{busy ? 'Enregistrement…' : 'Enregistrer la planification'}</button></ModalFooter></form></div>;
}
