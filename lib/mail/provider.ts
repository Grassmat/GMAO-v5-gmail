import { env } from 'cloudflare:workers';
import { database } from '../store';
import { AppError } from '../auth';
import { readMailConfiguration,anyMailConnection,googleRequest } from './configuration';
export async function mailConfiguration(){const config=env as unknown as Record<string,string>;return {key:config.RESEND_API_KEY||'',from:config.MAIL_FROM||'',origin:config.APP_ORIGIN||''};}
export async function mailReady(category:'account'|'notification'|'quote'='account',site?:string,sender?:string){const c=await mailConfiguration();if(site!==undefined){const g=await readMailConfiguration(site,category==='quote'?'quote':'automatic');if(g)return !sender||sender.toLowerCase()===g.sender;if(!c.key)return false;}return /^https:\/\/[^/]+$/.test(c.origin)&&((!!c.key&&!!c.from)||await anyMailConnection(category));}
export async function applicationLink(query=''){const c=await mailConfiguration();if(!/^https:\/\/[^/]+$/.test(c.origin))throw new AppError('Adresse de l’application indisponible.',503);return c.origin+'/'+query;}
function header(value:string){if(/[\r\n]/.test(value))throw new AppError('En-tête mail invalide.');return value;}
const base64=(value:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
export async function sendMail(message:{to:string;subject:string;text:string;key:string;site?:string;replyTo?:string;senderName?:string;senderEmail?:string;category?:'account'|'notification'|'quote'}){
 const gmail=await readMailConfiguration(message.site||'',message.category==='quote'?'quote':'automatic');
 if(gmail){
  if(message.category==='quote'&&message.senderEmail&&message.senderEmail.toLowerCase()!==gmail.sender)throw new AppError('Connectez la boîte Gmail choisie pour les devis de ce site.',503);
  const db=database(),deliveryKey='gmail:'+message.key,previous=await db.prepare('SELECT * FROM mail_deliveries WHERE id=?').bind(deliveryKey).first<any>();
  if(previous?.state==='accepted')return previous.provider_id as string;
  if(previous)throw new AppError('Envoi incertain : vérifiez la boîte Envoyés avant toute reprise manuelle.',503);
  const token=await googleRequest('https://oauth2.googleapis.com/token',new URLSearchParams({client_id:gmail.clientId,client_secret:gmail.clientSecret,refresh_token:gmail.refreshToken,grant_type:'refresh_token'}));
  if(typeof token.access_token!=='string')throw new AppError('Reconnectez la boîte Gmail.',503);
  const lines=['From: '+header(gmail.sender),'To: '+header(message.to),'Subject: =?UTF-8?B?'+base64(header(message.subject))+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64',...(message.replyTo?['Reply-To: '+header(message.replyTo)]:[]),'',base64(message.text).match(/.{1,76}/g)?.join('\r\n')||''];
  const claim=await db.prepare("INSERT OR IGNORE INTO mail_deliveries(id,state,created) VALUES(?,'sending',?)").bind(deliveryKey,Date.now()).run();if(!claim.meta.changes)throw new AppError('Envoi déjà en cours ou à vérifier.',503);
  let response:Response;try{response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw:base64(lines.join('\r\n')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}),signal:AbortSignal.timeout(12000)});}catch{throw new AppError('Envoi Gmail incertain : vérifiez la boîte Envoyés.',503);}
  const result:any=await response.json().catch(()=>null);
  if(!response.ok){if(response.status<500)await db.prepare("DELETE FROM mail_deliveries WHERE id=? AND state='sending'").bind(deliveryKey).run();throw new AppError('Gmail n’a pas accepté l’envoi. Vérifiez la connexion et le quota.',503);}
  if(typeof result?.id!=='string')throw new AppError('Réponse Gmail incertaine : vérifiez la boîte Envoyés.',503);
  await db.prepare("UPDATE mail_deliveries SET state='accepted',provider_id=? WHERE id=?").bind(result.id,deliveryKey).run();return result.id as string;
 }
 const c=await mailConfiguration();if(!c.key||!c.from)throw new AppError('Connectez une boîte mail pour activer les envois.',503);
 const configuredAddress=c.from.match(/<([^>]+)>/)?.[1]||c.from,sameDomain=message.senderEmail&&configuredAddress.split('@')[1]?.toLowerCase()===message.senderEmail.split('@')[1]?.toLowerCase();
 const from=message.senderName?message.senderName+' <'+(sameDomain?message.senderEmail:configuredAddress)+'>':c.from;
 let response:Response;try{response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json','Idempotency-Key':message.key},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text,...(message.replyTo?{reply_to:message.replyTo}:{})}),signal:AbortSignal.timeout(12000)});}catch{throw new AppError('Le service mail est momentanément indisponible.',503);}
 const data:any=await response.json().catch(()=>null);if(!response.ok||typeof data?.id!=='string')throw new AppError('Le service mail n’a pas accepté l’envoi.',503);return data.id as string;
}
