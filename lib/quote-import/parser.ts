import type { Row } from '../maintenance/types';
import type { PdfCell,PdfRow,ImportLine,QuoteImport } from './types';
const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').trim();
const refKey=(s:string)=>normal(s).replace(/[^a-z0-9]/g,'');
export function documentNumber(value:string):number|null {
 let text=value.trim().replace(/[\s\u00a0\u202f]/g,'').replace(/(?:EUR|€|%)/gi,'');
 if(!/^[+\-]?\d[\d.,]*$/.test(text))return null;
 const comma=text.lastIndexOf(','),dot=text.lastIndexOf('.');
 if(comma>=0&&dot>=0){const decimal=comma>dot?',':'.';text=text.split(decimal===','?'.':',').join('').replace(decimal,'.');}
 else if(comma>=0)text=text.replace(',','.');
 else if((text.match(/\./g)||[]).length>1)text=text.replace(/\.(?=.*\.)/g,'');
 const number=Number(text);return Number.isFinite(number)?number:null;
}
function moneyValue(text:string):number|null{const match=text.match(/[+\-]?\d[\d\s\u00a0\u202f.,]*(?:€|EUR)?/i);const value=match?documentNumber(match[0]):null;return value!=null&&value>=0&&value<=1000000?Math.round(value*100):null;}
function quantityValue(text:string):number|undefined{const match=text.match(/^\s*(\d+(?:[,.]\d+)?)\s*(?:pce?s?|pcs|un|u|pieces?)?\s*$/i);const value=match?documentNumber(match[1]):null;return value!=null&&Number.isSafeInteger(value)&&value>0&&value<=1000000?value:undefined;}
type Field='reference'|'name'|'quantity'|'price'|'total'|'discount';
type Column={field:Field;x:number;net?:boolean};
const headerPatterns:[Field,RegExp][]=[['name',/\b(?:designation|description|libelle|produit|article)\b/],['reference',/\b(?:reference|ref\.?|code(?:\s+article)?)\b/],['quantity',/\b(?:qte|quantite|qty|quantity)\b/],['price',/\b(?:p\.?\s*u\.?|prix\s*unit(?:aire)?|unit\s*price|prix\s*(?:ht|net))\b/],['total',/\b(?:montant|total|amount)\b/],['discount',/\b(?:remise|discount|rem\.)\b/]];
function columns(row:PdfRow):Column[]|null {
 const text=normal(row.text);if(!headerPatterns[2][1].test(text)||!headerPatterns.slice(0,2).some(([,p])=>p.test(text)))return null;
 const result:Column[]=[];
 for(const cell of row.cells){const normalized=normal(cell.text);for(const [field,pattern] of headerPatterns){if(field==='name'&&headerPatterns[1][1].test(normalized)&&!/(designation|description|libelle|produit)/.test(normalized))continue;const match=normalized.match(pattern);if(match)result.push({field,x:cell.x+(match.index||0)/Math.max(normalized.length,1)*cell.width,net:field==='price'&&/\bnet\b/.test(normalized)});}}
 const unique=result.filter((r,i)=>result.findIndex(x=>x.field===r.field)===i).sort((a,b)=>a.x-b.x);
 return unique.some(c=>c.field==='quantity')&&unique.some(c=>c.field==='name'||c.field==='reference')?unique:null;
}
function valuesFor(row:PdfRow,header:Column[]):Partial<Record<Field,string>> {
 const result:Partial<Record<Field,string>>={};
 for(const cell of row.cells){const center=cell.x+Math.min(cell.width/2,12);let column=header[0];for(let i=1;i<header.length;i++)if(center>=(header[i-1].x+header[i].x)/2)column=header[i];result[column.field]=[result[column.field],cell.text].filter(Boolean).join(' ');}
 return result;
}
const ignored=(text:string)=>/^(?:sous[ -]?total|total\b|net\s+a\s+payer|tva\b|taxe\b|iban\b|bic\b|siret\b|rcs\b|capital\b|conditions\b|adresse\b|livraison\b|reglement\b|paiement\b|validite\b|page\s+\d|merci\b)/i.test(normal(text));
const title=(text:string)=>/^(devis|offre(?:\s+de\s+prix)?|bon\s+de\s+commande|commande|facture|proforma)\b/i.test(normal(text));
function guessReference(text:string){const [first,...rest]=text.trim().split(/\s+/);return (/\d/.test(first)&&/[a-z/-]/i.test(first)||/^\d{3,}$/.test(first))&&first.length<=60?{reference:first,name:rest.join(' ')}:{reference:'',name:text.trim()};}
function makeLine(value:{reference?:string;name?:string;quantity?:string;price?:string;total?:string;discount?:string},source:string,id:string):ImportLine|null {
 // Some PDFs emit the reference and description as a single text cell under Reference.
 const rawReference=(value.reference||'').trim(),rawName=(value.name||'').trim();
 const combined=guessReference(rawReference);
 const splitCombined=!!combined.reference&&!!combined.name&&(!rawName||normal(rawName)===normal(rawReference)||normal(rawName)===normal(combined.name));
 const guessed=rawReference?{reference:rawReference,name:rawName}:guessReference(rawName);
 const reference=splitCombined?combined.reference:guessed.reference,name=splitCombined?combined.name:guessed.name;
 if(!name&&!reference)return null;if(ignored(name||reference)||title(name))return null;
 const quantity=quantityValue(value.quantity||'');let unitCostCents=value.price?moneyValue(value.price):null;const total=value.total?moneyValue(value.total):null,warnings:string[]=[];
 if(splitCombined)warnings.push('Référence et désignation séparées automatiquement : à vérifier.');
 const discount=value.discount?documentNumber(value.discount.replace('%','')):null;
 if(discount!=null&&discount>0&&discount<100&&unitCostCents!=null){unitCostCents=Math.round(unitCostCents*(1-discount/100));warnings.push('Prix après remise calculé : à vérifier.');}
 if(unitCostCents==null&&total!=null&&quantity){unitCostCents=Math.round(total/quantity);warnings.push('Prix unitaire calculé depuis le montant de ligne.');}
 if(quantity===undefined)warnings.push('Quantité non reconnue : à renseigner.');
 if(total!=null&&quantity&&unitCostCents!=null&&Math.abs(total-quantity*unitCostCents)>Math.max(2,quantity))warnings.push('Le prix × la quantité diffère du montant imprimé : vérifier la remise ou le prix.');
 if(/\b(frais|port|transport|emballage|main.d.oeuvre|prestation)\b/i.test(normal(name)))warnings.push('Cette ligne peut être un frais ou une prestation : vérifiez si elle doit devenir une pièce.');
 if(unitCostCents==null)warnings.push('Prix non reconnu, à compléter si souhaité.');
 return {id,name:(name||reference).slice(0,150),reference:reference.slice(0,200),quantity,unitCostCents,part:'',source,warnings};
}
function fallback(row:PdfRow,id:string):ImportLine|null {
 if(ignored(row.text)||title(row.text))return null;
 const pattern=/(.+?)\s+(\d+(?:[,.]\d+)?)\s*(?:PCE?S?|PCS|U|UN)?\s+((?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)[,.]\d{2,4})\s*(?:€|EUR)?\s+((?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)[,.]\d{2})\s*(?:€|EUR)?\s*$/i;
 const match=row.text.match(pattern);if(!match)return null;
 const guessed=guessReference(match[1]);return makeLine({...guessed,quantity:match[2],price:match[3],total:match[4]},row.text,id);
}
export function matchStock(line:Pick<ImportLine,'reference'|'name'>,parts:Row[]):Row[] {
 const key=refKey(line.reference);if(!key)return [];
 return parts.filter(p=>!p.deleted&&(refKey(p.reference||'')===key||(p.suppliers||[]).some(o=>refKey(o.reference)===key)));
}
export function parseQuoteRows(rows:PdfRow[],parts:Row[]=[],pages=1):QuoteImport {
 const text=rows.map(r=>r.text).join('\n'),warnings:string[]=[],lines:ImportLine[]=[];
 let header:Column[]|null=null,tablePage=0,lastLine:ImportLine|null=null,documentTotalCents:number|null=null;
 for(const row of rows){
  const next=columns(row);if(next){header=next;tablePage=row.page;lastLine=null;continue;}
  const normalized=normal(row.text);
  if(/\btotal\s*(?:h\.?\s*t\.?|hors\s+taxes)\b/.test(normalized)&&!/sous[ -]?total/.test(normalized)){const values=[...row.text.matchAll(/\d[\d\s\u00a0\u202f.]*[,\.]\d{2}\b/g)];const last=values.at(-1);if(last)documentTotalCents=moneyValue(last[0]);}
  if(ignored(row.text)){lastLine=null;continue;}
  let line:ImportLine|null=null;
  if(header&&row.page>=tablePage){const values=valuesFor(row,header);if(header.some(c=>c.field==='price'&&c.net))delete values.discount;const hasNumericQuantity=values.quantity&&/^\s*\d/.test(values.quantity);const hasPrice=values.price!=null&&/\d/.test(values.price)||values.total!=null&&/\d/.test(values.total);
   if((hasNumericQuantity||hasPrice)&&(values.name||values.reference))line=makeLine(values,row.text,'pdf-'+(lines.length+1));
   else if(lastLine&&values.name&&!values.quantity&&!values.price&&!values.total&&!title(row.text)&&!/@|siret|rcs|tel\b|www\./i.test(row.text)){lastLine.name=(lastLine.name+' '+values.name).slice(0,150);lastLine.source+='\n'+row.text;}
  }
  if(!line)line=fallback(row,'pdf-'+(lines.length+1));
  if(line){line.page=row.page;lines.push(line);lastLine=line;}
 }
 const heading=rows.slice(0,35).find(r=>title(r.text));
 const documentRef=heading?.text.match(/(?:devis|commande|offre|facture|proforma)\s*(?:(?:n[°ºo.]?|num[eé]ro|ref[.:]?)\s*)?[:#-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,60})/i)?.[1];
 const name=documentRef?'Devis '+documentRef:'Devis importé du PDF';
 const top=rows.slice(0,25).map(r=>r.text);
 const known=[...new Set(parts.flatMap(p=>[p.supplier,...(p.suppliers||[]).map(o=>o.name)]).filter((x):x is string=>!!x))];
 const explicitSupplier=top.map(t=>t.match(/^(?:fournisseur|supplier|vendeur)\s*[:：]\s*(.+)$/i)?.[1]).find(Boolean);
 const supplier=explicitSupplier||known.find(s=>top.some(t=>normal(t).includes(normal(s))))||(!heading||!/commande/i.test(heading.text)?top.find(t=>!title(t)&&!ignored(t)&&/[a-z]{3}/i.test(t)&&!/[\d@]/.test(t)&&t.length<100&&!/\b(client|destinataire|facturation|livraison|designation|reference|quantite|qte|prix)\b/.test(normal(t))):'')||'';
 for(const line of lines){const matches=matchStock(line,parts);if(matches.length===1){line.part=matches[0].id;}else if(matches.length>1)line.warnings.push('Plusieurs références du magasin correspondent : choisissez la bonne.');}
 const unparsedPages=Array.from({length:pages},(_,i)=>i+1).filter(p=>!lines.some(l=>l.page===p));
 if(pages>1&&unparsedPages.length)warnings.push('Aucune pièce reconnue sur la ou les pages '+unparsedPages.join(', ')+'. Vérifiez s’il s’agit de conditions ou de pages scannées.');
 if(!lines.length)warnings.push('Aucune ligne de pièce reconnue automatiquement. Utilisez le texte extrait pour compléter le devis.');
 if(lines.length>1000)throw Error('Plus de 1 000 lignes reconnues. Séparez ce document.');
 warnings.push('Vérifiez le fournisseur, les quantités, les prix HT et les références avant de reprendre la sélection.');
 if(rows.some(r=>/\bttc\b/.test(normal(r.text)))&&!rows.some(r=>/\b(?:ht|hors taxes)\b/.test(normal(r.text))))warnings.push('Le document ne précise pas clairement de prix HT : contrôlez les montants avant enregistrement.');
 const total=lines.reduce((sum,l)=>sum+(l.unitCostCents??0)*(l.quantity??0),0);
 if(documentTotalCents!=null&&Math.abs(total-documentTotalCents)>Math.max(lines.length,2))warnings.push('Le total des pièces reconnues diffère du total HT imprimé : vérifier les lignes manquantes, frais ou remises.');
 return {name,supplier,status:heading&&/commande/i.test(heading.text)?'Commandé':'Devis',lines,warnings,documentTotalCents,pages,text};
}
