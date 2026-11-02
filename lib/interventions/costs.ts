import { database } from '../store';
import { globalReadAccess, AppError, type User } from '../auth';
export function validateMachineHours(value:unknown,machines:string[]):Record<string,number> {
 if(value==null)return {};
 if(typeof value!=='object'||Array.isArray(value))throw new AppError('Compteurs horaires invalides.');
 const result:Record<string,number>={};
 for(const [id,hours] of Object.entries(value)){
  if(!machines.includes(id))throw new AppError('Compteur lié à une machine non sélectionnée.');
  if(hours===null||hours==='')continue;
  if(typeof hours!=='number'||!Number.isFinite(hours)||hours<0||hours>100000000)throw new AppError('Le compteur horaire doit être positif et inférieur à 100 000 000 h.');
  result[id]=Math.round(hours*100)/100;
 }
 return result;
}
export async function machineCosts(user:User) {
 const db=database();
 const rows=await (globalReadAccess(user)?db.prepare(`SELECT p.intervention,p.quantity,p.unit_cost_cents AS cost,m.machine FROM intervention_parts p JOIN interventions i ON i.id=p.intervention AND i.deleted=0 JOIN intervention_machines m ON m.intervention=i.id ORDER BY p.id,m.machine`):db.prepare(`SELECT p.intervention,p.quantity,p.unit_cost_cents AS cost,m.machine FROM intervention_parts p JOIN interventions i ON i.id=p.intervention AND i.deleted=0 JOIN intervention_machines m ON m.intervention=i.id WHERE i.site=? ORDER BY p.id,m.machine`).bind(user.site)).all<{intervention:string;quantity:number;cost:number|null;machine:string}>();
 const counts=await (globalReadAccess(user)?db.prepare('SELECT intervention,COUNT(*) AS n FROM intervention_machines GROUP BY intervention'):db.prepare('SELECT m.intervention,COUNT(*) AS n FROM intervention_machines m JOIN interventions i ON i.id=m.intervention WHERE i.site=? GROUP BY m.intervention').bind(user.site)).all<{intervention:string;n:number}>();
 const byReport=new Map(counts.results.map(r=>[r.intervention,r.n])),result=new Map<string,{maintenanceCostCents:number;unpricedParts:number}>();
 // Deterministic cents allocation for multi-machine reports: total is never counted twice.
 const indices=new Map<string,number>();
 for(const row of rows.results){
  const item=result.get(row.machine)||{maintenanceCostCents:0,unpricedParts:0};
  if(row.cost==null)item.unpricedParts++;
  else {const n=byReport.get(row.intervention)||1,total=row.cost*row.quantity,key=row.intervention+':'+row.quantity+':'+row.cost,index=(indices.get(key)||0)%n;indices.set(key,index+1);item.maintenanceCostCents+=Math.floor(total/n)+(index<total%n?1:0);}
  result.set(row.machine,item);
 }
 return result;
}
