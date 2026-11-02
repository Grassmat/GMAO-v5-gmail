'use client';
import { useEffect,useRef,useState } from 'react';
import { FileUp,Plus,Trash2 } from 'lucide-react';
import { readQuotePdf } from '../../lib/quote-import/pdf-reader';
import { parseQuoteRows } from '../../lib/quote-import/parser';
import type { QuoteImport,ImportLine } from '../../lib/quote-import/types';
import { priceInput,priceCents,money } from '../../lib/maintenance/pricing';
import { ReferenceSelect } from '../shared/reference-select';
import type { MaintenanceModel } from './use-maintenance';
export function QuotePdfImport({model}:{model:Pick<MaintenanceModel,'modal'|'setModal'|'parts'>}) {
 const {modal,setModal,parts}=model;
 const [preview,setPreview]=useState<QuoteImport|null>(null),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[replace,setReplace]=useState(false);
 const controller=useRef<AbortController|null>(null),input=useRef<HTMLInputElement|null>(null),latest=useRef(modal);latest.current=modal;
 useEffect(()=>()=>controller.current?.abort(),[]);
 const protectedReceipt=!!modal.receivedAt||modal.originalStatus==='Reçu'||modal.lines?.some((line:any)=>line.receivedAt||modal.originalReceivedIds?.includes(line.id));
 const protectedStatus=['Refusé','Annulé'].includes(modal.originalStatus||modal.status);
 const disabled=protectedReceipt||protectedStatus;
 async function analyze(chosen:File|undefined){if(!chosen||busy||disabled)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setProgress('Ouverture du PDF…');setPreview(null);setReplace(false);setModal({...latest.current,pdfImportPending:true});
  try {const result=await readQuotePdf(chosen,abort.signal,setProgress);if(abort.signal.aborted)return;const imported=parseQuoteRows(result.rows,parts,result.pages);setFile(chosen);setPreview(imported);setProgress('');}
  catch(e){if(!abort.signal.aborted){setError(e instanceof Error?e.message:'Lecture du PDF impossible.');setModal({...latest.current,pdfImportPending:false});}}
  finally{if(!abort.signal.aborted)setBusy(false);}
 }
 function cancel(){controller.current?.abort();setBusy(false);setPreview(null);setFile(null);setError('');setProgress('');setModal({...latest.current,pdfImportPending:false});if(input.current)input.current.value='';}
 function change(id:string,patch:Partial<ImportLine>){setPreview(p=>p?{...p,lines:p.lines.map(l=>l.id===id?{...l,...patch}:l)}:p);}
 const hasExisting=!!modal.name?.trim()||!!modal.part||!!modal.lines?.length;
 const invalid=preview?.lines.some(l=>!l.name.trim()||!Number.isSafeInteger(l.quantity)||(l.quantity??0)<1||(l.quantity??0)>1000000||l.unitCostCents!=null&&(!Number.isSafeInteger(l.unitCostCents)||l.unitCostCents<0||l.unitCostCents>100000000));
 function apply(){if(!preview||!file||invalid||!preview.lines.length||hasExisting&&!replace||disabled)return;
  const current=latest.current;
  const lines=preview.lines.map(line=>{const part=parts.find(p=>p.id===line.part);return {id:crypto.randomUUID(),part:part?.id||'',name:part?.name||line.name.trim(),reference:part?.reference||line.reference.trim(),supplierReference:line.reference.trim(),location:part?.location||'',quantity:line.quantity,unitCostCents:line.unitCostCents,machine:current.machine||'',received:false};});
  setModal({...current,pdfImportPending:false,name:preview.name.trim()||'Devis importé du PDF',supplier:preview.supplier.trim(),status:preview.status,lines,part:'',reference:'',supplierReference:'',quantity:undefined,unitCostCents:null,originalReceivedIds:[],pdfFile:file,documentId:crypto.randomUUID()});setPreview(null);setFile(null);setError('');
 }
 return <section className="quote-pdf-import" aria-label="Saisie automatique du devis"><div className="panel-head"><div><h3>Saisie automatique depuis un PDF</h3><small>Devis ou bon de commande : lecture, contrôle des lignes, puis enregistrement.</small></div><button type="button" disabled={busy||!!disabled} onClick={()=>input.current?.click()}><FileUp size={16}/>Choisir un PDF</button></div>
 <input className="sr-only" ref={input} type="file" accept="application/pdf,.pdf" aria-label="PDF pour la saisie automatique" disabled={busy||!!disabled} onChange={e=>void analyze(e.target.files?.[0])}/>
 {disabled?<small>La saisie automatique s’utilise avant toute réception, sur un devis actif.</small>:!preview&&!busy&&<div className="pdf-drop-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void analyze(e.dataTransfer.files[0]);}}>Déposez le PDF ici ou utilisez « Choisir un PDF ».<small>50 Mo maximum · PDF contenant du texte · lecture dans votre navigateur, sans envoi à un service d’IA.</small></div>}
 {busy&&<div role="status"><p>{progress}</p><button type="button" onClick={cancel}>Annuler la lecture</button></div>}
 {error&&<p className="error" role="alert">{error}</p>}
 {preview&&<div className="pdf-import-preview"><div className="panel-head"><h3>{preview.lines.length} pièce(s) proposée(s) · {preview.pages} page(s)</h3><button type="button" onClick={cancel}>Annuler l’import</button></div>
 <div className="pdf-import-notices">{preview.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>
 <div className="fields"><label>Intitulé du devis<input maxLength={150} value={preview.name} onChange={e=>setPreview({...preview,name:e.target.value})}/></label><label>Fournisseur (à confirmer)<input maxLength={200} value={preview.supplier} onChange={e=>setPreview({...preview,supplier:e.target.value})}/></label><label>Statut<select value={preview.status} onChange={e=>setPreview({...preview,status:e.target.value as 'Devis'|'Commandé'})}><option>Devis</option><option>Commandé</option></select></label></div>
 <div className="pdf-import-lines">{preview.lines.map((line,index)=><fieldset key={line.id} className="pdf-import-line"><legend>Pièce {index+1}{line.part?' · reliée au magasin':''}</legend><div className="fields"><label>Désignation *<input required maxLength={150} value={line.name} onChange={e=>change(line.id,{name:e.target.value})}/></label><label>Référence dans le PDF<input maxLength={200} value={line.reference} onChange={e=>change(line.id,{reference:e.target.value,part:''})}/></label><label>Quantité *<input required type="number" min={1} max={1000000} step={1} value={line.quantity??''} onChange={e=>change(line.id,{quantity:e.target.value===''?undefined:Number(e.target.value)})}/></label><label>Prix unitaire (€ HT)<input type="number" min={0} max={1000000} step="0.01" value={priceInput(line.unitCostCents)} onChange={e=>change(line.id,{unitCostCents:priceCents(e.target.value)})}/></label></div>
 <ReferenceSelect label="Relier au magasin (facultatif)" value={line.part} placeholder="Nouvelle référence créée à la réception" options={parts.map(p=>({value:p.id,label:p.name+' · '+(p.reference||'Sans référence'),searchText:[p.name,p.reference,p.supplier,...(p.suppliers||[]).map(s=>s.reference)].join(' ')}))} onChange={value=>change(line.id,{part:value})}/>{line.part&&<small>Le nom et la référence du magasin seront conservés. La référence du PDF sera reprise comme référence fournisseur.</small>}
 {!!line.warnings.length&&<small>{line.warnings.join(' ')}</small>}<details><summary>Voir le texte d’origine</summary><p className="pdf-source-text">{line.source||'Ligne ajoutée manuellement.'}</p></details><button type="button" className="danger" onClick={()=>setPreview({...preview,lines:preview.lines.filter(l=>l.id!==line.id)})}><Trash2 size={15}/>Retirer la ligne</button></fieldset>)}</div>
 <button type="button" disabled={preview.lines.length>=1000} onClick={()=>setPreview({...preview,lines:[...preview.lines,{id:crypto.randomUUID(),name:'',reference:'',quantity:undefined,unitCostCents:null,part:'',source:'',warnings:[]}]})}><Plus size={16}/>Ajouter une ligne manquante</button>
 <p>Total des lignes : <strong>{money(preview.lines.reduce((s,l)=>s+(l.unitCostCents??0)*(l.quantity??0),0))} HT</strong>{preview.documentTotalCents!=null&&<small>Total HT repéré dans le PDF : {money(preview.documentTotalCents)}</small>}</p>
 <details><summary>Voir tout le texte extrait</summary><textarea className="pdf-extracted-text" readOnly value={preview.text} aria-label="Texte extrait du PDF"/></details>
 {hasExisting&&<label className="check"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/>Remplacer les lignes et informations actuelles par cette sélection.</label>}
 <p className="muted">Le PDF sera joint quand vous enregistrerez le devis. Aucune pièce ne sera réceptionnée automatiquement.</p>
 <button type="button" className="primary" disabled={!preview.lines.length||invalid||hasExisting&&!replace} onClick={apply}>Reprendre ces {preview.lines.length} pièce(s) dans le devis</button><small>Vous pourrez encore corriger les informations dans le formulaire avant d’enregistrer.</small>
 </div>}
 </section>;
}
