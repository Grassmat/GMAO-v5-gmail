import { CircleCheck, CircleAlert, Clock } from 'lucide-react';
import type { Row } from '../../lib/maintenance/types';
export function MachineState({ machine, orders, onToggle, busy=false }: { machine: Row; orders: Row[]; onToggle?:()=>void; busy?:boolean }) {
  const order = orders.find(row => row.id === machine.waitingOrder);
  const Tag=onToggle?'button':'span';
  return <div className="machine-state">
    <Tag className={'service-badge ' + (machine.serviceState || 'unknown')} {...(onToggle?{type:'button' as const,onClick:onToggle,disabled:busy,title:'Modifier l’état de la machine'}:{})}>
      {machine.serviceState === 'running' ? <CircleCheck size={16} /> : ['stopped','degraded'].includes(machine.serviceState||'') ? <CircleAlert size={16} /> : <Clock size={16} />}
      {machine.serviceState === 'running' ? 'En service' : machine.serviceState === 'degraded' ? 'En service avec défaut' : machine.serviceState === 'stopped' ? 'Hors service' : 'État non renseigné'}
    </Tag>
    {machine.defectNote&&<p className="machine-defect-note"><strong>Défaut persistant</strong><span>{machine.defectNote}</span></p>}
    {['stopped','degraded'].includes(machine.serviceState||'') && machine.waitingNote && <div className="waiting-piece"><strong>En attente de pièce</strong><span>{machine.waitingNote}</span>
      {order && <small>{order.name} · {order.reference || 'Sans référence'}{order.supplier ? ' · ' + order.supplier : ''} · {order.status === 'Reçu' ? machine.serviceState==='degraded'?'Pièce reçue — résolution du défaut à confirmer':'Pièce reçue — remise en service à confirmer' : order.status}</small>}
    </div>}
  </div>;
}
