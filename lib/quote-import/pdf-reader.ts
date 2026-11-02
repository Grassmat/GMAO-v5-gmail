import type { PdfRow,PdfCell } from './types';
export async function readQuotePdf(file:File,signal:AbortSignal,onProgress:(text:string)=>void):Promise<{rows:PdfRow[];pages:number}> {
 if(!/\.pdf$/i.test(file.name)||!file.size||file.size>50*1024*1024)throw Error('Choisissez un fichier PDF non vide de 50 Mo maximum.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Ce fichier ne possède pas une signature PDF valide.');
 const [pdfjs,worker]=await Promise.all([import('pdfjs-dist'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
 if(signal.aborted)throw new DOMException('Lecture annulée.','AbortError');
 pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
 const task=pdfjs.getDocument({data:bytes,disableFontFace:true,useSystemFonts:true});
 const abort=()=>{void task.destroy();};signal.addEventListener('abort',abort,{once:true});
 try {
  const pdf=await task.promise;if(pdf.numPages>100)throw Error('Ce PDF dépasse 100 pages. Séparez-le en plusieurs documents.');
  const rows:PdfRow[]=[];
  for(let p=1;p<=pdf.numPages;p++){
   if(signal.aborted)throw new DOMException('Lecture annulée.','AbortError');onProgress('Lecture de la page '+p+' / '+pdf.numPages+'…');
   const page=await pdf.getPage(p),content=await page.getTextContent();
   const items=content.items.filter((item):item is import('pdfjs-dist/types/src/display/api').TextItem=>'str' in item&&!!item.str.trim()).map(item=>({text:item.str.replace(/[\u00a0\u202f]/g,' ').trim(),x:item.transform[4],y:item.transform[5],width:item.width,height:Math.max(Math.abs(item.height),6)})).sort((a,b)=>b.y-a.y||a.x-b.x);
   const grouped:{y:number;cells:PdfCell[]}[]=[];
   for(const item of items){let row=grouped.find(r=>Math.abs(r.y-item.y)<=Math.min(3,item.height*.3));if(!row){row={y:item.y,cells:[]};grouped.push(row);}row.cells.push({text:item.text,x:item.x,width:item.width});}
   grouped.sort((a,b)=>b.y-a.y).forEach(r=>{r.cells.sort((a,b)=>a.x-b.x);rows.push({page:p,y:r.y,cells:r.cells,text:r.cells.map(c=>c.text).join(' ').trim()});});
   page.cleanup();
   if(rows.length>20000)throw Error('Ce document contient trop de texte. Importez un PDF plus court.');
  }
  if(rows.reduce((n,r)=>n+r.text.length,0)<30)throw Error('Ce PDF semble être un scan ou une image. La saisie automatique nécessite un PDF contenant du texte sélectionnable.');
  return {rows,pages:pdf.numPages};
 }catch(e){if(signal.aborted)throw new DOMException('Lecture annulée.','AbortError');if(e instanceof Error&&e.name==='PasswordException')throw Error('Ce PDF est protégé par un mot de passe. Utilisez une copie déverrouillée.');throw e;}
 finally{signal.removeEventListener('abort',abort);await task.destroy();}
}
