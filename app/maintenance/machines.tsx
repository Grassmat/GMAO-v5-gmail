'use client';
import { money } from '../../lib/maintenance/pricing';
import { useState, useEffect } from 'react';
import { Factory, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { movedMachines } from '../../lib/maintenance/machine-ordering';
import { MachineState } from './machine-state';
import type { MaintenanceModel } from './use-maintenance';
export function MachinesView({ model }: {model: MaintenanceModel;}) {
  const { tab, selected, list, setSelected, parts } = model;
  const [dragged,setDragged] = useState<string | null>(null);
  const [target,setTarget] = useState<string | null>(null);
  const [notice,setNotice] = useState('');
  useEffect(() => {setDragged(null);setTarget(null);setNotice('');},[model.site,model.archived,model.query]);
  const editable = !model.readOnly && !model.saving && !model.loading && !model.query.trim();
  async function move(source: string, destination: string) {
    setDragged(null); setTarget(null);
    if (!editable || source === destination) return;
    // Replace only the visible cohort's positions, leaving archived machines in place.
    const visible = movedMachines(list,source,destination), cohort = new Set(visible);
    let index=0;
    const ids=model.machines.map(row => cohort.has(row.id) ? visible[index++] : row.id);
    setNotice('Enregistrement de l’ordre…');
    setNotice(await model.reorderMachines(ids) ? 'Ordre enregistré.' : 'Ordre non enregistré. Consultez le message d’erreur.');
  }
  if (tab !== 'Machines' || selected) return null;
  return <>
    {!model.readOnly && <p className="muted machine-order-help">{model.query.trim() ? 'Effacez la recherche pour réorganiser les machines.' : 'Glissez la poignée d’une machine sur une autre pour changer l’ordre, ou utilisez les flèches. L’ordre est partagé pour ce site.'}</p>}
    <p className="machine-order-notice" role="status" aria-live="polite">{notice}</p>
    <div className="grid">{list.map((m,index) => <div key={m.id} className={'machine-sort-item'+(dragged===m.id?' dragging':'')+(target===m.id?' drop-target':'')}
      onDragOver={event => {if(editable && dragged && dragged!==m.id){event.preventDefault();event.dataTransfer.dropEffect='move';setTarget(m.id);}}}
      onDrop={event => {event.preventDefault();if(dragged)void move(dragged,m.id);}}>
      {!model.readOnly && <div className="machine-sort-controls">
        <button type="button" draggable={editable} disabled={!editable} className="machine-drag-handle" aria-label={'Déplacer '+m.name} title="Glisser pour déplacer"
          onDragStart={event => {setDragged(m.id);event.dataTransfer.setData('text/plain',m.id);event.dataTransfer.effectAllowed='move';setNotice('');}}
          onDragEnd={() => {setDragged(null);setTarget(null);}}><GripVertical size={18}/></button>
        <span className="machine-position">{index+1}</span>
        <button type="button" disabled={!editable || index===0} aria-label={'Avancer '+m.name} title="Avancer" onClick={() => void move(m.id,list[index-1].id)}><ArrowUp size={16}/></button>
        <button type="button" disabled={!editable || index===list.length-1} aria-label={'Reculer '+m.name} title="Reculer" onClick={() => void move(m.id,list[index+1].id)}><ArrowDown size={16}/></button>
      </div>}
      <button className={'machine machine-'+(m.serviceState||'unknown')} onClick={() => setSelected(m)}><div className="machine-icon"><Factory size={25} /></div>{m.archived && <span className="status">Archivée</span>}<h2>{m.name}</h2><MachineState machine={m} orders={model.records.filter(r => r.kind === 'order' && !r.deleted)} /><p>{parts.filter(p => p.machines?.includes(m.id)).length} références compatibles</p><p className="machine-cost">Pièces utilisées : <strong>{money(m.maintenanceCostCents||0)} HT</strong>{!!m.unpricedParts&&<small>{m.unpricedParts} ligne(s) non chiffrée(s)</small>}</p><div className="machine-foot">Ouvrir la fiche <span>•••</span></div></button>
    </div>)}{!list.length && <div className="empty">Aucune machine. Ajoutez votre premier équipement.</div>}</div>
  </>;
}
