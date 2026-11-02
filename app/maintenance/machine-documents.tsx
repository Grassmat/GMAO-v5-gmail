'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, Download } from 'lucide-react';

type UploadItem={id:string;file:File;status:'queued'|'uploading'|'done'|'error'|'invalid';error?:string};
export function pdfSelectionError(file:File){return !file.name.toLowerCase().endsWith('.pdf')?'Choisissez un fichier PDF.':!file.size?'Le fichier est vide.':file.size>50*1024*1024?'Le PDF dépasse la limite de 50 Mo.':'';}
type Document = { id: string; name: string; size: number; actor: string; created: string };
export function MachineDocuments({ machine, readOnly = false, onSessionChanged }: { readOnly?: boolean; machine: string; onSessionChanged: () => void }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [items,setItems]=useState<UploadItem[]>([]);
  const [progress,setProgress]=useState('');
  const sending=useRef(false),generation=useRef(0),uploadAbort=useRef<AbortController|null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/documents?machine=${encodeURIComponent(machine)}`, { signal });
      const data = await response.json() as { documents: Document[]; error?: string };
      if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
      if (!response.ok) throw new Error(data.error);
      if(!signal?.aborted)setDocuments(data.documents);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [machine, onSessionChanged]);
  useEffect(()=>{setItems([]);setDocuments([]);setLoading(true);setUploading(false);setProgress('');uploadAbort.current=null;setNotice('');setError('');return()=>{generation.current++;uploadAbort.current?.abort();sending.current=false;};},[machine]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  const pending=items.filter(item=>item.status==='queued'||item.status==='error');
  function selectFiles(files:FileList|null){if(sending.current)return;setItems(Array.from(files||[]).map(file=>{const error=pdfSelectionError(file);return {id:crypto.randomUUID(),file,status:error?'invalid':'queued',error};}));setError('');setNotice('');}
  async function upload(event: React.FormEvent) {
    event.preventDefault();if(readOnly||sending.current||!pending.length)return;
    sending.current=true;setUploading(true);setError('');setNotice('');
    const epoch=generation.current,controller=new AbortController();uploadAbort.current=controller;let success=0,failed=0;
    const update=(id:string,patch:Partial<UploadItem>)=>{if(generation.current===epoch)setItems(current=>current.map(item=>item.id===id?{...item,...patch}:item));};
    try{
      for(let index=0;index<pending.length;index++){
        if(controller.signal.aborted||generation.current!==epoch)break;
        const item=pending[index];setProgress('Envoi '+(index+1)+' / '+pending.length+' · '+item.file.name);update(item.id,{status:'uploading',error:''});
        try{
          const validation=pdfSelectionError(item.file);if(validation){failed++;update(item.id,{status:'invalid',error:validation});continue;}
          if(new TextDecoder().decode(await item.file.slice(0,5).arrayBuffer())!=='%PDF-'){failed++;update(item.id,{status:'invalid',error:'Ce fichier ne contient pas un PDF valide.'});continue;}
          const form=new FormData();form.set('machine',machine);form.set('file',item.file);form.set('uploadId',item.id);
          const response=await fetch('/api/documents',{method:'POST',body:form,signal:controller.signal});const data=await response.json() as {error?:string};
          if(response.status===401||response.status===428){update(item.id,{status:'error',error:'Session expirée. Reconnectez-vous.'});onSessionChanged();break;}
          if(!response.ok)throw Error(data.error||'Envoi impossible. Réessayez ce fichier.');
          success++;update(item.id,{status:'done',error:''});
        }catch(cause){if(controller.signal.aborted)break;failed++;update(item.id,{status:'error',error:cause instanceof Error?cause.message:'Envoi impossible. Réessayez ce fichier.'});}
      }
      if(generation.current===epoch&&!controller.signal.aborted){setNotice(success+' PDF ajouté(s).'+(failed?' '+failed+' fichier(s) non envoyé(s), voir le détail ci-dessous.':''));if(input.current)input.current.value='';if(success)await load(controller.signal);}
    }finally{if(generation.current===epoch){sending.current=false;setUploading(false);setProgress('');uploadAbort.current=null;}}
  }

  return <section className="panel">
    <h2>Documents PDF</h2>
    <p className="muted">Notices, schémas et autres documents de cette machine.</p>
    {!readOnly && <form className="document-upload" onSubmit={upload}>
      <label htmlFor="machine-pdf">Choisir plusieurs PDF <small>50 Mo maximum par fichier</small></label>
      <input id="machine-pdf" ref={input} type="file" multiple accept="application/pdf,.pdf" disabled={uploading}
        onChange={event=>selectFiles(event.target.files)}/>
      <button className="primary" disabled={!pending.length || uploading}><Upload size={17}/>{uploading?'Envoi en cours…':'Ajouter les PDF ('+pending.length+')'}</button>
      {!!items.length&&<ul className="document-upload-list">{items.map(item=><li key={item.id}><span><strong>{item.file.name}</strong><small>{(item.file.size/1024/1024).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mo · {item.status==='done'?'Ajouté':item.status==='uploading'?'En cours':item.status==='queued'?'Prêt à envoyer':item.status==='invalid'?'Non accepté':'Échec — réessayez'}</small>{item.error&&<small className="red">{item.error}</small>}</span>{!uploading&&item.status!=='done'&&<button type="button" aria-label={'Retirer '+item.file.name} onClick={()=>setItems(current=>current.filter(i=>i.id!==item.id))}>Retirer</button>}</li>)}</ul>}
      {progress&&<p role="status" aria-live="polite">{progress}</p>}
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="document-notice">{notice}</p>}
    {loading ? <p>Chargement des documents…</p> : documents.length === 0 ? <div className="empty">Aucun document pour cette machine.</div> :
      <div className="table-wrap"><table>
        <thead><tr><th>Document</th><th>Ajouté par</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>{documents.map(document => <tr key={document.id}>
          <td><div className="document-name"><FileText size={19}/><strong>{document.name}</strong></div><small>{(document.size / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo</small></td>
          <td>{document.actor}</td><td>{new Date(document.created).toLocaleDateString('fr-FR')}</td>
          <td><div className="actions"><a href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer">Ouvrir</a>
            <a href={`/api/documents/${document.id}?download=1`}><Download size={15}/>Télécharger</a></div></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
