'use client';
import {ModalFooter} from '../shared/modal-footer';
import { DeletePlanning } from './controls';
import { PlanningMachinePicker } from './machine-picker';
import { AssignmentFields, assignmentLabel } from './assignment';
import { useState } from 'react';
import type { Routine, RoutineDone, Teammate, PlanView } from '../../lib/planning/types';
import { routineOccurs, planningMachines, routineCompletionState, routineCompletionLabel } from '../../lib/planning/routines-client';
import { interventionToday } from '../../lib/interventions/types';
import type { MaintenanceModel } from '../maintenance/use-maintenance';
export function RoutineCalendar({ model, routines, done, teammates = [], plans = [], canCreate = true, canManage = false, readOnly = false, onOpenPlan, onReportPlan, onSaved }: {
    model: MaintenanceModel;
    routines: Routine[];
    done: RoutineDone[];
    teammates?: Teammate[];
    plans?: PlanView[];
    canCreate?: boolean;
    canManage?: boolean;
    readOnly?: boolean;
    onOpenPlan?: (plan: PlanView) => void;
    onReportPlan?: (plan: PlanView) => void;
    onSaved: () => Promise<void>;
}) {
    const [month, setMonth] = useState(() => interventionToday().slice(0, 7)), [draft, setDraft] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''),[opened,setOpened]=useState<{id:string;date:string}|null>(null);
    const first = new Date(month + '-01T12:00:00Z'), days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(), offset = (first.getUTCDay() + 6) % 7;
    async function post(input: any) { if (busy)
        return; setBusy(true); setError(''); try {
        const response = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const data: any = await response.json();
        if (response.status === 401 || response.status === 428) {
            model.onSessionChanged();
            return;
        }
        if (!response.ok)
            throw Error(data.error);
        setDraft(null);setOpened(null);
        await onSaved();
    }
    catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.');
    }
    finally {
        setBusy(false);
    } }
    function shift(delta: number) { const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1)); setMonth(d.toISOString().slice(0, 7)); }
    const selectedRoutine=opened?routines.find(r=>r.id===opened.id):undefined,selectedDone=opened?done.find(d=>d.routine===opened.id&&d.date===opened.date):undefined;
    const selectedState=opened?routineCompletionState(opened.date,selectedDone):'pending';
    return <section className="panel routine-calendar"><div className="panel-head"><div><h2>Calendrier des interventions</h2><small>Tâches récurrentes et interventions ponctuelles datées. Le bouton « Fait » ne crée pas de rapport et ne modifie pas le stock.</small></div>{canCreate && <button onClick={() => setDraft({ assignment: { mode: 'any', users: [] }, action: 'routine', clientId: crypto.randomUUID(), site: model.site, name: '', instructions: '', machine: '', machines: [], start: interventionToday(), frequency: 'weekly',emailReminder:'none' })}>Ajouter une tâche</button>}</div>
 <p className="routine-legend"><span>● Vert : fait à temps</span><span>● Rouge : non fait, jour dépassé</span><span>● Orange : fait en retard</span></p>
 <div className="calendar-nav"><button onClick={() => shift(-1)} aria-label="Mois précédent">Précédent</button><strong>{first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><button onClick={() => shift(1)} aria-label="Mois suivant">Suivant</button></div>
 {error && <p className="error" role="alert">{error}</p>}<div className="calendar-grid">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <strong className="calendar-weekday" key={day}>{day}</strong>)}{Array.from({ length: offset }, (_, i) => <div className="calendar-blank" key={'blank' + i}/>)}{Array.from({ length: days }, (_, i) => { const date = month + '-' + String(i + 1).padStart(2, '0'); return <div className={'calendar-day' + (date === interventionToday() ? ' today' : '')} key={date}><time dateTime={date}>{i + 1}</time><CalendarPlans plans={plans.filter(plan => plan.date === date)} onOpen={onOpenPlan}/>{routines.filter(r => routineOccurs(r, date)).map(r => { const checked = done.find(d => d.routine === r.id && d.date === date),state=routineCompletionState(date,checked); return <div className={'calendar-task routine-task calendar-compact '+state} key={r.id}><button className="task-title" aria-label={r.name+' · '+(state==='complete'?'Fait':state==='late-complete'?'Fait en retard':state==='overdue'?'Non faite, en retard':'À faire')} title={r.name+(checked?' · Enregistré le '+routineCompletionLabel(checked.completedAt):'')} onClick={()=>setOpened({id:r.id,date})}>{r.name}</button></div>; })}</div>; })}</div>{!routines.length && !plans.some(plan => plan.date.startsWith(month)) && <p className="muted">Aucune tâche récurrente ou intervention datée pour ce mois.</p>}
 {selectedRoutine&&opened&&<div className="overlay"><div className="modal" role="dialog" aria-modal="true" aria-label={selectedRoutine.name}><div className="panel-head"><h2>{selectedRoutine.name}</h2><button type="button" disabled={busy} onClick={()=>{setOpened(null);setError('');}}>Fermer</button></div><p>Prévue le {new Date(opened.date+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'})}</p><p>Machines : {planningMachines(selectedRoutine).map(id=>model.machines.find(m=>m.id===id)?.name||'Machine introuvable').join(', ')||'Non précisées'}</p><p>Affectation : {assignmentLabel(selectedRoutine.assignment,teammates)}</p>{selectedRoutine.instructions&&<><h3>Consignes</h3><p className="plan-description">{selectedRoutine.instructions}</p></>}{selectedDone?<p className={selectedState==='late-complete'?'routine-late-label':'routine-complete-label'}>{selectedState==='late-complete'?'✓ Fait en retard':'✓ Fait'}<small className="routine-recorded">Enregistré le {routineCompletionLabel(selectedDone.completedAt)} · {selectedDone.actor}</small></p>:<><p>{selectedState==='overdue'?'Non faite · en retard':'À faire'}</p>{!readOnly&&<button className="primary" type="button" disabled={busy||opened.date>interventionToday()} onClick={()=>post({action:'routine-done',id:selectedRoutine.id,date:opened.date})}>Fait</button>}</>}{error&&<p className="error" role="alert">{error}</p>}{canCreate&&<button type="button" disabled={busy} onClick={()=>{setDraft({...selectedRoutine,action:'routine'});setOpened(null);}}>Modifier la tâche récurrente</button>}<ModalFooter disabled={busy} onClose={()=>{setOpened(null);setError('');}}>{canManage&&<DeletePlanning model={model} item={selectedRoutine} kind="routine" onDeleted={async()=>{setOpened(null);await onSaved();}}/>}</ModalFooter></div></div>}
 {canCreate && draft && <div className="overlay"><form className="modal" onSubmit={e => { e.preventDefault(); post(draft); }}><div className="panel-head"><h2>{draft.id ? 'Modifier' : 'Ajouter'} une tâche récurrente</h2><button type="button" disabled={busy} onClick={() => setDraft(null)}>Fermer</button></div><fieldset className="report-fields" disabled={busy}><label>Tâche *<input required maxLength={150} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><PlanningMachinePicker machines={model.machines} value={draft} onChange={machines => setDraft({ ...draft, machines })}/><label>Première occurrence *<input required type="date" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })}/></label><label>Récurrence<select value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value })}><option value="daily">Tous les jours</option><option value="weekly">Chaque semaine, le même jour</option><option value="monthly">Chaque mois, le même jour</option></select></label><label>Précisions pour réaliser la tâche<textarea maxLength={10000} value={draft.instructions || ''} onChange={e => setDraft({ ...draft, instructions: e.target.value })}/></label><AssignmentFields value={draft.assignment} teammates={teammates} onChange={assignment => setDraft({ ...draft, assignment })}/><label>Rappels par mail<select value={draft.emailReminder || 'none'} onChange={e=>setDraft({...draft,emailReminder:e.target.value})}><option value="none">Aucun rappel</option><option value="same">Le jour même</option><option value="before">La veille</option><option value="both">La veille et le jour même</option></select><small>À 8 h, heure de Paris, aux personnes affectées dont l’adresse est confirmée. Sans destinataire pour « N’importe qui ».</small></label><small>« Fait » valide cette occurrence pour toutes les machines sélectionnées. Pour les mois plus courts, une tâche prévue le 29, 30 ou 31 revient le dernier jour du mois.</small></fieldset>{error && <p className="error">{error}</p>}<ModalFooter disabled={busy} onClose={()=>setDraft(null)}><button className="primary" disabled={busy}>Enregistrer</button>{canManage && draft.id && <DeletePlanning model={model} item={draft} kind="routine" onDeleted={async () => { setDraft(null); await onSaved(); }}/>}</ModalFooter></form></div>}
 </section>;
}

function CalendarPlans({ plans, onOpen }: { plans: PlanView[]; onOpen?: (plan: PlanView) => void }) {
    return <>{[...plans].sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt)).map(plan => <div key={plan.id} className={'calendar-task calendar-plan calendar-compact' + (plan.status === 'done' ? ' complete' : '')}>
        <button className="task-title" title={plan.name} aria-label={plan.name+' · '+(plan.status==='done'?'Réalisée':plan.ready?'Réalisable':'En attente')} onClick={() => onOpen?.(plan)}>{plan.name}</button>
    </div>)}</>;
}
