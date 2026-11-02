import { database } from '../store';
import { allowSite, AppError, type User } from '../auth';
import { validSite } from './repository';
export async function validPartCategory(id:string,site:string) {
  if(!id)return;
  const row=await database().prepare("SELECT site FROM records WHERE id=? AND kind='part-category'").bind(id).first<{site:string}>();
  if(!row||row.site!==site)throw new AppError('Famille absente de ce site.',403);
}
export async function savePartCategory(user:User,input:any) {
  if(typeof input.site!=='string'||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80)throw new AppError('Nom de famille obligatoire, limité à 80 caractères.');
  allowSite(user,input.site);await validSite(input.site);
  const db=database(),name=input.name.trim(),key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const id=input.id||input.clientId;
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new AppError('Identifiant de famille invalide.');
  const current=await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(id).first<{kind:string;site:string;data:string}>();
  if(current&&(current.kind!=='part-category'||current.site!==input.site))throw new AppError('Famille inaccessible.',403);
  if(input.id&&!current)throw new AppError('Famille introuvable.',404);
  if(current&&!input.id)return;
  const duplicate=await db.prepare("SELECT id FROM records WHERE kind='part-category' AND site=? AND json_extract(data,'$.key')=? AND id<>?").bind(input.site,key,id).first<{id:string}>();
  if(duplicate){if(!input.id)return;throw new AppError('Une famille porte déjà ce nom.',409);}
  const data=JSON.stringify({name,key});
  if(current){
    const result=await db.prepare("UPDATE records SET data=? WHERE id=? AND data=? AND NOT EXISTS(SELECT 1 FROM records WHERE kind='part-category' AND site=? AND json_extract(data,'$.key')=? AND id<>?)").bind(data,id,current.data,input.site,key,id).run();
    if(!result.meta.changes)throw new AppError('Cette famille a changé. Rechargez le magasin.',409);
  }else await db.prepare("INSERT INTO records(id,kind,site,data) SELECT ?,'part-category',?,? WHERE NOT EXISTS(SELECT 1 FROM records WHERE kind='part-category' AND site=? AND json_extract(data,'$.key')=?)").bind(id,input.site,data,input.site,key).run();
}
