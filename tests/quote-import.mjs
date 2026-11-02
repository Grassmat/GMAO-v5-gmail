import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync('lib/quote-import/parser.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const exports={};new Function('exports',code)(exports);const {parseQuoteRows,documentNumber,matchStock}=exports;
const cell=(text,x,width=text.length*5)=>({text,x,width});let y=800;const row=(cells,page=1)=>({page,y:y-=14,cells,text:cells.map(c=>c.text).join(' ')});
const part={id:'bearing',kind:'part',site:'a',name:'Roulement du magasin',reference:'6200-2RS',suppliers:[{id:'v',name:'Fournisseur Exemple',reference:'ALT-6200',unitCostCents:700}]};
const header=()=>row([cell('Référence',40),cell('Désignation',140),cell('Qté',350),cell('P.U. HT',410),cell('Total HT',510)]);
const rows=[row([cell('FOURNISSEUR EXEMPLE',40)]),row([cell('DEVIS N° DV-001',40)]),header(),row([cell('6200-2RS',40),cell('Roulement étanche',140),cell('2',350),cell('12,50',410),cell('25,00',510)]),row([cell('couronne renforcée',140)]),row([cell('JOINT-X',40),cell('Joint standard',140),cell('3',350),cell('4,00',410),cell('12,00',510)]),row([cell('Total HT',410),cell('37,00',510)])];
let parsed=parseQuoteRows(rows,[part]);assert.equal(parsed.name,'Devis DV-001');assert.equal(parsed.supplier,'Fournisseur Exemple');assert.equal(parsed.lines.length,2);assert.equal(parsed.lines[0].quantity,2);assert.equal(parsed.lines[0].unitCostCents,1250);assert.equal(parsed.lines[0].part,'bearing');assert(parsed.lines[0].name.includes('couronne renforcée'));assert.equal(parsed.documentTotalCents,3700);assert.equal(parsed.lines[1].part,'');
assert.equal(documentNumber('1 234,56 €'),1234.56);assert.equal(documentNumber('1,234.56'),1234.56);assert.equal(documentNumber('1.234,56'),1234.56);assert.equal(documentNumber('garbage'),null);
parsed=parseQuoteRows([row([cell('Devis ABC123',40)]),row([cell('Roulement 6200 2 10,00 20,00',40)]),row([cell('ALT-6200 Roulement renforcé 5 7,00 35,00',40)])],[part]);assert.equal(parsed.lines.length,2);assert.equal(parsed.lines[0].quantity,2);assert.equal(parsed.lines[0].unitCostCents,1000);assert.equal(parsed.lines[1].part,'bearing');assert.equal(parsed.lines[1].unitCostCents,700);
assert.equal(matchStock({reference:'ALT6200',name:'ignored'},[part]).length,1);assert.equal(matchStock({reference:'',name:part.name},[part]).length,0);assert.equal(matchStock({reference:'6200-2RS',name:''},[part,{...part,id:'duplicate'}]).length,2);
parsed=parseQuoteRows([header(),row([cell('UNKNOWN',40),cell('Pièce sans quantité',140),cell('10,00',410),cell('20,00',510)])]);assert.equal(parsed.lines[0].quantity,undefined);assert(parsed.lines[0].warnings.some(w=>w.includes('Quantité')));
const header2=()=>row([cell('Code article',40),cell('Description',140),cell('Quantité',350),cell('Prix unitaire HT',410),cell('Montant HT',530)]);
parsed=parseQuoteRows([header2(),row([cell('A-1',40),cell('Capteur',140),cell('10',350),cell('2,50',410),cell('25,00',530)]),header2(),row([cell('B-2',40),cell('Contacteur',140),cell('1',350),cell('18,00',410),cell('18,00',530)])]);assert.equal(parsed.lines.length,2);assert.equal(parsed.lines[0].name,'Capteur');assert.equal(parsed.lines[1].reference,'B-2');
parsed=parseQuoteRows([row([cell('BON DE COMMANDE N° BC-100',40)]),row([cell('Fournisseur : Nouvelle société',40)]),header(),row([cell('P1',40),cell('Pièce',140),cell('1',350),cell('10,00',410),cell('10,00',510)])]);assert.equal(parsed.status,'Commandé');assert.equal(parsed.supplier,'Nouvelle société');assert.equal(parsed.lines[0].quantity,1);
parsed=parseQuoteRows([row([cell('FOURNISSEUR',40)]),row([cell('Conditions de paiement : 30 jours',40)])]);assert.equal(parsed.lines.length,0);assert(parsed.warnings.some(w=>w.includes('Aucune ligne')));
console.log('PASS: multi-column and headerless quotes, multi-line descriptions, repeated headers, numbers/prices, exact supplier reference matching, ambiguous matches, missing quantities and purchase-order status.');
// Real PDF text extraction is checked independently with a generated multi-page supplier fixture.
if(process.argv[2]){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),isEvalSupported:false,useSystemFonts:true});const pdf=await task.promise,pdfRows=[];
 try{for(let p=1;p<=pdf.numPages;p++){const content=await(await pdf.getPage(p)).getTextContent();const grouped=[];for(const item of content.items.filter(x=>'str'in x&&x.str.trim())){let group=grouped.find(r=>Math.abs(r.y-item.transform[5])<=3);if(!group){group={page:p,y:item.transform[5],cells:[],text:''};grouped.push(group);}group.cells.push({text:item.str,x:item.transform[4],width:item.width});}for(const r of grouped.sort((a,b)=>b.y-a.y)){r.cells.sort((a,b)=>a.x-b.x);r.text=r.cells.map(c=>c.text).join(' ');pdfRows.push(r);}}
 const actual=parseQuoteRows(pdfRows,[part],pdf.numPages);assert.equal(actual.lines.length,64);assert.equal(actual.lines[0].quantity,2);assert.equal(actual.lines[0].unitCostCents,1250);assert.equal(actual.lines[0].part,'bearing');assert.equal(actual.pages,2);fs.writeFileSync('/workspace/scratch/afa291c548ce/pdf-import-test-result.json',JSON.stringify(actual,null,2));console.log('PASS: actual 2-page PDF extraction, 64 lines, French prices, repeated headers and canonical stock link.');}finally{await task.destroy();}
}
// Supplier PDF stores SKU + description in one cell instead of two columns.
for(const cells of [
 [cell('0403096AR Vérin pour convoyeur',40,260)],
 [cell('0403096AR Vérin pour convoyeur',140,260)],
 [cell('0403096AR Vérin pour convoyeur',40,260),cell('Vérin pour convoyeur',140)],
]){
 const result=parseQuoteRows([header(),row([...cells,cell('2',350),cell('15,00',410),cell('30,00',510)])]);
 assert.equal(result.lines[0].reference,'0403096AR');assert.equal(result.lines[0].name,'Vérin pour convoyeur');assert.equal(result.lines[0].quantity,2);
}
const spaced=parseQuoteRows([header(),row([cell('AB 123',40),cell('Capteur de pression',140),cell('1',350),cell('10,00',410),cell('10,00',510)])]);
assert.equal(spaced.lines[0].reference,'AB 123');assert.equal(spaced.lines[0].name,'Capteur de pression');
console.log('PASS: combined SKU/description cells separate correctly without changing independent references.');
