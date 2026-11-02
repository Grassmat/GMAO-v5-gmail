import { currentUser,allowReadSite,AppError,replyError } from '../../../lib/auth';
import { readMaintenance } from '../../../lib/maintenance/service';
import { xlsx,excelResponse,type Cell } from '../../../lib/exports/xlsx';
export async function GET(request:Request){try{
 const user=await currentUser(request),site=new URL(request.url).searchParams.get('site')||'';allowReadSite(user,site);
 const data=await readMaintenance(user),name=data.sites.find(s=>s.id===site)?.name;if(!name)throw new AppError('Site introuvable.',404);
 const records=data.records as any[],parts=records.filter(p=>p.kind==='part'&&p.site===site&&!p.deleted).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 const qty=new Map<string,number>();for(const m of data.movements as any[])qty.set(m.part,(qty.get(m.part)||0)+m.quantity);
 const rows:Cell[][]=[[`Inventaire du stock — ${name}`],[`Export du ${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} · tout le stock du site, sans filtre.`],['Saisir les quantités comptées dans la colonne L. Ce fichier ne modifie pas automatiquement le stock.'],['Identifiant','Pièce','Référence','Emplacement','Famille','Machines compatibles','Fournisseurs','Stock théorique','Minimum','Prix unitaire HT','Valeur stock HT','Quantité comptée','Écart']];
 parts.forEach((p,i)=>{const r=i+5,q=qty.get(p.id)||0;rows.push([p.id,p.name,p.reference||'',p.location||'',records.find(c=>c.id===p.category)?.name||'',(p.machines||[]).map((id:string)=>records.find(m=>m.id===id)?.name||id).join(', '),(p.suppliers||[{name:p.supplier||'',reference:p.reference||''}]).map((s:any)=>[s.name,s.reference].filter(Boolean).join(' · ')).join(' / '),q,p.minimum||0,p.unitCostCents==null?null:p.unitCostCents/100,p.unitCostCents==null?null:{formula:`H${r}*J${r}`,value:q*p.unitCostCents/100},null,{formula:`IF(L${r}="","",L${r}-H${r})`,value:null}]);});
 return excelResponse(xlsx([{name:'Inventaire',rows,headerRow:4,widths:[40,32,24,22,20,38,40,18,14,20,22,20,16],moneyColumns:[9,10]}]),'inventaire-'+new Date().toISOString().slice(0,10)+'.xlsx');
}catch(e){return replyError(e);}}
