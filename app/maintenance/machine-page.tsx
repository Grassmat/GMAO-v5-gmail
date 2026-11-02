
'use client';
import {ModalFooter} from '../shared/modal-footer';
import { money } from '../../lib/maintenance/pricing';
import { MachinePlanning } from './machine-planning';
import { MachineState } from './machine-state';
import { useState } from 'react';
import { FileText, Wrench, ClipboardList } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
import { StockView } from './stock';
import { OrdersView } from './orders';
import { MachineDetailsView } from './machine-details';
import { InterventionHistory } from '../interventions/history';
import { MachineDocuments } from './machine-documents';
export function MachinePage({ model, onSessionChanged }: { model: MaintenanceModel; onSessionChanged: () => void }) {
  const [tab, setTab] = useState<'overview' | 'documents' | 'interventions'>('overview');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [stateDraft,setStateDraft]=useState<{machine:NonNullable<typeof model.selected>;serviceState:string;defectNote:string;resolved:boolean}|null>(null);
  function toggleState(){if(!model.selected||model.readOnly)return;setStateDraft({machine:{...model.selected},serviceState:model.selected.serviceState==='unknown'?'running':model.selected.serviceState||'running',defectNote:model.selected.defectNote||'',resolved:false});}
  async function saveState(){if(!stateDraft||busy||model.readOnly)return;const machine=stateDraft.machine;setBusy(true);setError('');try{const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'machine-state',id:machine.id,serviceState:stateDraft.serviceState,defectNote:stateDraft.defectNote,resolveDefect:stateDraft.resolved,expectedState:machine.serviceState||'unknown',expectedReport:(machine.stateReport||'')+':'+(machine.stateRevision||0),expectedManualAt:machine.manualServiceAt||'',expectedDefectNote:machine.defectNote||''})}),d:any=await r.json();if([401,428].includes(r.status)){onSessionChanged();return;}if(!r.ok)throw Error(d.error);setStateDraft(null);await model.refresh();}catch(e){setError(e instanceof Error?e.message:'Modification impossible.');await model.refresh();}finally{setBusy(false);}}
  if (!model.selected) return null;
  return <>
    {stateDraft&&<div className="overlay"><form className="modal" role="dialog" aria-modal="true" aria-label="État de la machine" onSubmit={e=>{e.preventDefault();saveState();}}><div className="panel-head"><h2>État de la machine</h2><button type="button" disabled={busy} onClick={()=>{setStateDraft(null);setError('');}}>Fermer</button></div><fieldset disabled={busy}><label>État<select value={stateDraft.serviceState} onChange={e=>setStateDraft({...stateDraft,serviceState:e.target.value,resolved:false})}><option value="running">En service</option><option value="degraded">En service avec défaut</option><option value="stopped">Hors service</option></select></label>{stateDraft.serviceState==='degraded'&&<label>Défaut persistant *<textarea required maxLength={1000} value={stateDraft.defectNote} onChange={e=>setStateDraft({...stateDraft,defectNote:e.target.value})}/></label>}{stateDraft.serviceState==='running'&&stateDraft.machine.defectNote&&<label className="check"><input type="checkbox" required checked={stateDraft.resolved} onChange={e=>setStateDraft({...stateDraft,resolved:e.target.checked})}/>Le défaut est résolu — repasser au vert</label>}</fieldset>{error&&<p className="error" role="alert">{error}</p>}<ModalFooter disabled={busy} onClose={()=>{setStateDraft(null);setError('');}}><button className="primary" disabled={busy}>Enregistrer l’état</button></ModalFooter></form></div>}
    {error&&!stateDraft&&<p className="error" role="alert">{error}</p>}
    <MachineState busy={busy} onToggle={model.readOnly?undefined:toggleState} machine={model.selected} orders={model.records.filter(r => r.kind === 'order' && !r.deleted)} />
    <p className="machine-cost">Coût des pièces utilisées : <strong>{money(model.selected.maintenanceCostCents||0)} HT</strong>{!!model.selected.unpricedParts&&' · montant partiel, pièces sans prix.'}<small>Rapports enregistrés uniquement, hors main-d’œuvre. Les rapports multi-machines sont répartis à parts égales.</small></p>
    <div className="machine-tabs" role="tablist" aria-label="Fiche machine">
      <button id="machine-overview-tab" role="tab" aria-selected={tab === 'overview'} aria-controls="machine-overview" onClick={() => setTab('overview')}><Wrench size={17} />Aperçu</button>
      <button id="machine-documents-tab" role="tab" aria-selected={tab === 'documents'} aria-controls="machine-documents" onClick={() => setTab('documents')}><FileText size={17} />Documents</button>
      <button id="machine-interventions-tab" role="tab" aria-selected={tab === 'interventions'} aria-controls="machine-interventions" onClick={() => setTab('interventions')}><ClipboardList size={17} />Interventions</button>
    </div>
    {tab === 'overview' ? <div role="tabpanel" id="machine-overview" aria-labelledby="machine-overview-tab">
      <MachinePlanning model={model}/><StockView model={model} /><OrdersView model={model} /><MachineDetailsView model={model} />
    </div> : tab === 'interventions' ? <div role="tabpanel" id="machine-interventions" aria-labelledby="machine-interventions-tab"><InterventionHistory readOnly={model.readOnly} key={model.selected.id} site={model.site} siteName={model.sites.find(s => s.id === model.site)?.name || ''} machine={model.selected.id} userRole={model.user.role} onStockChanged={model.refresh} onSessionChanged={onSessionChanged} /></div> : <div role="tabpanel" id="machine-documents" aria-labelledby="machine-documents-tab">
      <MachineDocuments readOnly={model.readOnly} machine={model.selected.id} onSessionChanged={onSessionChanged} />
    </div>}
  </>;
}
