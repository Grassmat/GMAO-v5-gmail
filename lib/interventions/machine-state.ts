import { database } from '../store';
import { globalReadAccess, type User } from '../auth';
import { chronologicalInterventions, isFutureIntervention, type Intervention } from './types';

// Report state and persistent defects are derived independently: an ordinary restart cannot clear an open defect.
export async function machineStates(user: User) {
 const db=database();
 const rows=await(globalReadAccess(user)?db.prepare('SELECT i.*,m.machine FROM interventions i JOIN intervention_machines m ON m.intervention=i.id WHERE i.deleted=0'):db.prepare('SELECT i.*,m.machine FROM interventions i JOIN intervention_machines m ON m.intervention=i.id WHERE i.deleted=0 AND i.site=?').bind(user.site)).all<any>();
 const reports=rows.results.map(r=>({...r,answers:JSON.parse(r.answers),questions:JSON.parse(r.questions)})).sort((a,b)=>chronologicalInterventions(a as Intervention,b as Intervention));
 const states=new Map<string,{serviceState:string;defectNote:string;waitingNote:string;waitingOrder:string|null;stateReport:string;stateRevision:number}>();
 const defects=new Map<string,{open:boolean;note:string;created:string;waitingNote?:string;waitingOrder?:string|null}>();
 for(const report of reports){
  if(isFutureIntervention(report))continue;
  const service=report.machine_service||report.answers.service;
  if(!['Oui','Non','Defaut'].includes(service))continue;
  if(!defects.has(report.machine)&&(service==='Defaut'||report.defect_resolved===1))defects.set(report.machine,{open:service==='Defaut',note:report.defect_note||'',created:report.created,waitingNote:report.waiting_note||'',waitingOrder:report.waiting_order||null});
  if(states.has(report.machine))continue;
  states.set(report.machine,{serviceState:service==='Non'?'stopped':service==='Defaut'?'degraded':'running',defectNote:'',waitingNote:['Non','Defaut'].includes(service)?report.waiting_note||'':'',waitingOrder:['Non','Defaut'].includes(service)?report.waiting_order||null:null,stateReport:report.id,stateRevision:report.revision||1});
 }
 const machines=await(globalReadAccess(user)?db.prepare("SELECT id,data FROM records WHERE kind='machine'"):db.prepare("SELECT id,data FROM records WHERE kind='machine' AND site=?").bind(user.site)).all<any>();
 for(const machine of machines.results){
  const data=JSON.parse(machine.data);let latest=states.get(machine.id),defect=defects.get(machine.id);
  const anchor=(latest?.stateReport||'')+':'+(latest?.stateRevision||0);
  if(data.manualDefectEvent&&['open','resolved'].includes(data.manualDefectEvent.state)&&(!defect||data.manualDefectEvent.at>defect.created||data.manualDefectEvent.at===defect.created&&data.manualServiceAnchor===anchor))defect={open:data.manualDefectEvent.state==='open',note:data.manualDefectEvent.note||'',created:data.manualDefectEvent.at,waitingNote:defect?.waitingNote,waitingOrder:defect?.waitingOrder};
  if(['running','stopped','degraded'].includes(data.manualServiceState)&&data.manualServiceAnchor===anchor){latest={serviceState:data.manualServiceState,defectNote:'',waitingNote:data.manualServiceState!=='running'?latest?.waitingNote||'':'',waitingOrder:data.manualServiceState!=='running'?latest?.waitingOrder||null:null,stateReport:latest?.stateReport||'',stateRevision:latest?.stateRevision||0};}
  if(latest){latest={...latest,defectNote:defect?.open?defect.note:'',waitingNote:latest.waitingNote||(defect?.open?defect.waitingNote||'':''),waitingOrder:latest.waitingOrder||(defect?.open?defect.waitingOrder||null:null),serviceState:defect?.open&&latest.serviceState==='running'?'degraded':latest.serviceState};states.set(machine.id,latest);}
 }
 return states;
}
