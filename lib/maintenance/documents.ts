import { env } from 'cloudflare:workers';
import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export type MachineDocument = {
  id: string; machine: string; site: string; name: string;
  object_key: string; size: number; actor: string; created: string;
};
function bucket() {
  if (!env.BUCKET) throw new AppError('Le stockage des documents est indisponible. Réessayez.', 503);
  return env.BUCKET;
}
export async function machineForDocuments(user: User, id: string) {
  const machine = await database().prepare("SELECT id,site FROM records WHERE id=? AND kind='machine'")
    .bind(id).first<{ id: string; site: string }>();
  if (!machine) throw new AppError('Machine introuvable.', 404);
  allowReadSite(user, machine.site);
  return machine;
}
export async function listDocuments(user: User, machineId: string) {
  await machineForDocuments(user, machineId);
  const result = await database().prepare('SELECT id,machine,name,size,actor,created FROM machine_documents WHERE machine=? ORDER BY created DESC,id DESC')
    .bind(machineId).all();
  return result.results;
}
export async function uploadDocument(user: User, machineId: string, file: File, uploadId = crypto.randomUUID()) {
  const machine = await machineForDocuments(user, machineId);
  allowSite(user, machine.site);
  const name = await validatePdf(file);
  if(typeof uploadId!=='string'||!/^[a-f0-9-]{36}$/.test(uploadId))throw new AppError('Identifiant d’envoi invalide.');
  const id=uploadId,existing=await database().prepare('SELECT machine,name FROM machine_documents WHERE id=?').bind(id).first<{machine:string;name:string}>();
  if(existing){if(existing.machine!==machineId)throw new AppError('Identifiant de document déjà utilisé.',409);return {id,name:existing.name};}
  const key = `machine-documents/${machine.id}/${id}/${crypto.randomUUID()}.pdf`;
  const storage = bucket();
  await storage.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: 'application/pdf' } });
  try {
    await database().prepare('INSERT INTO machine_documents(id,machine,site,name,object_key,size,actor,created) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id, machine.id, machine.site, name, key, file.size, user.name, new Date().toISOString()).run();
  } catch (error) {
    try { await storage.delete(key); } catch (cleanupError) { console.error('Document cleanup failed', cleanupError); }
    const committed=await database().prepare('SELECT machine,name FROM machine_documents WHERE id=?').bind(id).first<{machine:string;name:string}>();
    if(committed?.machine===machineId)return {id,name:committed.name};
    throw error;
  }
  return { id, name };
}
export async function validatePdf(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.size === 0) throw new AppError('Choisissez un fichier PDF non vide.');
  if (file.size > MAX_PDF_BYTES) throw new AppError('Le PDF dépasse la limite de 50 Mo.', 413);
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') throw new AppError('Le fichier choisi n’est pas un PDF valide.');
  return file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200);
}
export async function readDocument(user: User, id: string) {
  const document = await database().prepare('SELECT * FROM machine_documents WHERE id=?').bind(id).first<MachineDocument>();
  if (!document) throw new AppError('Document introuvable.', 404);
  await machineForDocuments(user, document.machine);
  allowReadSite(user, document.site);
  const object = await bucket().get(document.object_key);
  if (!object) throw new AppError('Le fichier est indisponible. Contactez l’administrateur.', 503);
  return { document, object };
}

// Bound multipart parsing as well as the individual PDF size.
export async function documentFormData(request: Request, limit = MAX_PDF_BYTES + 64 * 1024, limitMessage = 'Le PDF dépasse la limite de 50 Mo.') {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) throw new AppError('Formulaire de document invalide.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Aucun fichier reçu.');
  let size = 0,exceeded=false;
  // Forward bounded chunks into the multipart parser without a second full request copy.
  const stream=new ReadableStream<Uint8Array>({
    async pull(controller){
      try{const chunk=await reader.read();if(chunk.done){controller.close();return;}
        size+=chunk.value.byteLength;
        if(size>limit){exceeded=true;await reader.cancel();controller.error(new AppError(limitMessage,413));return;}
        controller.enqueue(chunk.value);
      }catch(error){controller.error(error);}
    },cancel(reason){return reader.cancel(reason);}
  });
  try { return await new Response(stream, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { if(exceeded)throw new AppError(limitMessage,413);throw new AppError('Le fichier n’a pas pu être reçu. Réessayez.'); }
}
