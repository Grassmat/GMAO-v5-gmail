import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const require=createRequire(file),exports={};cache.set(file,exports);new Function('require','exports',output)(specifier=>{if(!specifier.startsWith('.'))return require(specifier);const base=path.resolve(path.dirname(file),specifier);return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)))},exports);return exports;}
function nodes(node,type){if(node?.type?.name==='OrdersTable')return nodes(node.type(node.props),type);if(!node||typeof node!=='object')return [];return [...(node.type===type?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>nodes(child,type))];}
const {RecordEditor}=load('app/maintenance/record-editor.tsx'),{OrderFields}=load('app/maintenance/order-fields.tsx'),{StockView}=load('app/maintenance/stock.tsx'),{OrdersView}=load('app/maintenance/orders.tsx');
function captureOrders(model){let tree;function Capture(){tree=OrdersView({model});return tree;}renderToStaticMarkup(React.createElement(Capture));return tree;}
let draft;const part={id:'part1',kind:'part',site:'site-principal',name:'Roulement',reference:'SKF-6205',minimum:2,machines:['m1']};
const model={user:{role:'admin'},onSessionChanged(){},modal:{kind:'part',name:'Nouvelle pièce',quantity:6,machines:[]},machines:[{id:'m1',name:'Calandre'}],parts:[part],displayedParts:[part],records:[part],site:'site-principal',tab:'Magasin',qty(){return 7},setModal(value){draft=value},save(){},saving:false,error:''};
const render=model=>renderToStaticMarkup(React.createElement(RecordEditor,{model}));
let html=render(model);assert(html.includes('Quantité ajoutée au stock'));assert(html.includes('value="6"'));assert(!html.includes('Stock minimum'));
html=render({...model,modal:{...part}});assert(!html.includes('Quantité ajoutée au stock'));assert(!html.includes('Stock minimum'));
const stock=StockView({model});nodes(stock,'button').find(button=>button.props['aria-label']==='Modifier le minimum de Roulement').props.onClick();assert.equal(draft.action,'minimum');assert.equal(draft.minimum,2);
html=render({...model,modal:draft});assert(html.includes('Minimum à garder en stock'));assert(html.includes('ne modifie pas la quantité disponible'));
nodes(stock,'button').find(button=>button.props['aria-label']==='Supprimer Roulement').props.onClick();assert.equal(draft.action,'delete-part');assert.equal(draft.id,'part1');html=render({...model,modal:draft});assert(html.includes('Supprimer du magasin'));assert(html.includes('Stock actuel : 7'));assert(html.includes('conservés'));
const purchase={id:'order1',kind:'order',site:'site-principal',name:'Roulement',reference:'SKF-6205',part:'part1',quantity:4,supplier:'SKF France',status:'Commandé',revision:1};
html=render({...model,modal:purchase});assert(html.includes('Référence déjà en magasin'));assert(html.includes('SKF France'));assert(html.includes('Quantité commandée'));assert(html.includes('Pièce reçue'));
const fields=OrderFields({model:{...model,modal:purchase}});nodes(fields,'input').find(input=>input.props.type==='checkbox').props.onChange({target:{checked:true}});assert.equal(draft.status,'Reçu');assert.equal(draft.quantity,4);
html=render({...model,modal:{...purchase,part:'',name:'Nouvelle pièce',status:'Devis'}});assert(html.includes('Nom de la nouvelle pièce'));assert(html.includes('créera cette référence'));
const receivedFields=OrderFields({model:{...model,modal:{...purchase,status:'Reçu',receivedAt:'2026-10-02'}}});assert(nodes(receivedFields,'input').find(input=>input.props.type==='number'&&input.props.step==='1').props.disabled);assert(nodes(receivedFields,'input').find(input=>input.props.type==='checkbox').props.disabled);
const orderModel={...model,tab:'Devis & achats',records:[purchase]},orders=captureOrders(orderModel);html=renderToStaticMarkup(orders);assert(html.includes('Fournisseur'));assert(html.includes('SKF France'));nodes(orders,'button').find(button=>React.Children.toArray(button.props.children).includes('Marquer reçu')).props.onClick();assert.equal(draft.status,'Reçu');assert.equal(draft.originalStatus,'Commandé');assert.equal(draft.part,'part1');
console.log('PASS: initial quantity without minimum, independent minimum editing, reference removal confirmation, supplier and quantity fields, existing/new reference selection and receipt controls.');
// PDFs can be selected before creating a quote; deletion controls are visible only to admins.
html=render({...model,modal:{kind:'order',name:'Devis neuf',quantity:1,status:'Devis'}});assert(html.includes('Joindre un PDF au devis'));assert(html.includes('application/pdf,.pdf'));
const file=new File(['%PDF-1.7\nTest devis\n%%EOF'],'devis-test.pdf',{type:'application/pdf'});const pdfFields=OrderFields({model:{...model,modal:purchase}});nodes(pdfFields,'input').find(input=>input.props.type==='file').props.onChange({target:{files:[file]}});assert.equal(draft.pdfFile,file);assert.match(draft.documentId,/^[a-f0-9-]{36}$/);
const adminOrders=captureOrders(orderModel);nodes(adminOrders,'button').find(button=>React.Children.toArray(button.props.children).includes('Supprimer')).props.onClick();assert.equal(draft.action,'delete-order');assert.equal(draft.id,'order1');
html=render({...model,modal:{...draft,status:'Reçu'}});assert(html.includes('Supprimer le devis'));assert(html.includes('restent dans le stock'));
for(const role of ['director','manager','technician']){assert(!renderToStaticMarkup(StockView({model:{...model,user:{role}}})).includes('Supprimer'));assert(!renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,user:{role}}})).includes('Supprimer'))}
assert(!renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,records:[{...purchase,deleted:true}]}})).includes('SKF France'));
// Exercise the save workflow when quote creation succeeds but PDF upload needs a retry.
let hookStates=[],stateIndex=0,refs=[],refIndex=0;
const fakeReact={...React,useState(initial){const index=stateIndex++;if(!(index in hookStates))hookStates[index]=typeof initial==='function'?initial():initial;return [hookStates[index],value=>{hookStates[index]=typeof value==='function'?value(hookStates[index]):value}]},useRef(initial){const index=refIndex++;return refs[index]|| (refs[index]={current:initial})},useCallback(fn){return fn},useEffect(){}};
const maintenanceFile=path.resolve('app/maintenance/use-maintenance.ts'),maintenanceCode=ts.transpileModule(fs.readFileSync(maintenanceFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,maintenanceExports={},maintenanceRequire=createRequire(maintenanceFile);
new Function('require','exports',maintenanceCode)(specifier=>specifier==='react'?fakeReact:specifier.startsWith('.')?load(path.resolve(path.dirname(maintenanceFile),specifier)+'.ts'):maintenanceRequire(specifier),maintenanceExports);
const stableQuoteId=crypto.randomUUID(),stablePdfId=crypto.randomUUID(),postPayloads=[],uploadIds=[];let uploadAttempts=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
 if(url==='/api/data'&&options.method==='POST'){const payload=JSON.parse(options.body);postPayloads.push(payload);return Response.json({ok:true,record:{id:stableQuoteId,kind:'order',site:'site-principal',name:'Test',part:'',quantity:2,status:'Reçu',receivedAt:'2026-10-02',revision:postPayloads.length}})}
 if(url==='/api/order-documents'){uploadIds.push(options.body.get('uploadId'));return ++uploadAttempts===1?Response.json({error:'Stockage temporairement indisponible'},{status:503}):Response.json({document:{id:stablePdfId}})}
 return Response.json({records:[],movements:[],sites:[{id:'site-principal',name:'Site principal'}],reports:null});
};
function maintenance(){stateIndex=0;refIndex=0;return maintenanceExports.useMaintenance({role:'admin',site:'site-principal'},()=>{})}
try{
 let active=maintenance();await active.save({kind:'order',site:'site-principal',name:'Test',quantity:2,status:'Reçu',clientId:stableQuoteId,pdfFile:file,documentId:stablePdfId});
 active=maintenance();assert(active.error.includes('Le devis est enregistré'));assert.equal(active.modal.id,stableQuoteId);assert.equal(active.modal.revision,1);assert.equal(active.modal.pdfFile,file);assert.equal(postPayloads[0].pdfFile,undefined);
 await active.save(active.modal);active=maintenance();assert.equal(active.modal,null);assert.equal(postPayloads[1].id,stableQuoteId);assert.equal(postPayloads[1].revision,1);assert.deepEqual(uploadIds,[stablePdfId,stablePdfId]);
 const beforeInvalid=postPayloads.length;await active.save({kind:'order',name:'Test',pdfFile:new File(['not a pdf'],'bad.pdf')});assert.equal(postPayloads.length,beforeInvalid);
}finally{globalThis.fetch=originalFetch}
console.log('PASS: quote PDF selection, admin-only deletion controls, hidden deleted quotes, and safe PDF retry after the quote has already been saved.');
assert(render({...model,modal:purchase}).includes('Associer à un rapport en attente de pièce'));
assert(!renderToStaticMarkup(OrderFields({model:{...model,modal:purchase},hideReportLink:true})).includes('Associer à un rapport en attente de pièce'));
console.log('PASS: quote-to-report association control and shared inline fields without recursive report linking.');
// Quote lists use creation order, independently of identifiers, names or receipt status.
const sortedQuotes=[{...purchase,id:'quote-old',name:'Z ancien',creationOrder:10,status:'Reçu'}, {...purchase,id:'quote-new',name:'A récent',creationOrder:30}, {...purchase,id:'quote-mid',name:'M intermédiaire',creationOrder:20}];
const sortedHtml=renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,records:sortedQuotes}}));
assert(sortedHtml.indexOf('A récent')<sortedHtml.indexOf('M intermédiaire'));assert(sortedHtml.indexOf('M intermédiaire')<sortedHtml.indexOf('Z ancien'));
const machineSortedHtml=renderToStaticMarkup(React.createElement(OrdersView,{model:{...orderModel,selected:{id:purchase.machine || 'm1'},records:sortedQuotes.map(q=>({...q,machine:purchase.machine || 'm1'}))}}));assert(machineSortedHtml.indexOf('A récent')<machineSortedHtml.indexOf('Z ancien'));
assert.equal(sortedQuotes[0].id,'quote-old');
console.log('PASS: newest quotes appear first in site and machine lists without mutating source records.');

const refusedQuote={...purchase,id:'refused',name:'Offre refusée',status:'Refusé',refusedAt:'2026-10-09T09:00:00Z',refusedBy:'Responsable',revision:3};
const pendingQuote={...purchase,id:'pending',name:'Offre active',status:'Devis'};
let decision;
const decisionsModel={...orderModel,records:[refusedQuote,pendingQuote],save(value){decision=value}};
const decisionsTree=captureOrders(decisionsModel);
const decisionsHtml=renderToStaticMarkup(decisionsTree);
assert(decisionsHtml.indexOf('Offre active')<decisionsHtml.indexOf('Mes demandes de devis'));
assert(decisionsHtml.indexOf('Mes demandes de devis')<decisionsHtml.indexOf('Devis refusés'));
assert(decisionsHtml.indexOf('Devis refusés')<decisionsHtml.indexOf('Offre refusée'));
nodes(decisionsTree,'button').find(b=>b.props['aria-label']==='Refuser le devis : Offre active').props.onClick();assert.deepEqual(decision,{action:'refuse-order',id:'pending',revision:1});
nodes(decisionsTree,'button').find(b=>React.Children.toArray(b.props.children).includes('Remettre en devis')).props.onClick();assert.deepEqual(decision,{action:'restore-order',id:'refused',revision:3});
const readOnlyHtml=renderToStaticMarkup(React.createElement(OrdersView,{model:{...decisionsModel,readOnly:true,user:{role:'manager'}}}));assert(!readOnlyHtml.includes('Refuser le devis'));assert(!readOnlyHtml.includes('Remettre en devis'));assert(readOnlyHtml.includes('Offre refusée'));assert(readOnlyHtml.includes('Fiche / PDF'));
const refusedFields=OrderFields({model:{...model,modal:{...refusedQuote,originalStatus:'Refusé'}}});assert(nodes(refusedFields,'input').find(n=>n.props.type==='checkbox').props.disabled);
console.log('PASS: refused archive below mail requests, direct refusal/restoration controls, read-only archive access and protected receipt checkbox.');
// Existing quotes can expand into editable lines; received lines retain their stock receipt.
const addFields=OrderFields({model:{...model,modal:{...purchase,originalStatus:'Commandé'}}});
nodes(addFields,'button').find(b=>b.props.children==='Ajouter une autre pièce').props.onClick();
assert.equal(draft.lines.length,2);assert.equal(draft.lines[0].id,'legacy');assert.equal(draft.lines[0].quantity,4);assert.equal(draft.lines[1].received,false);
const multiUi={...draft,name:'Devis de plusieurs pièces',lines:[{...draft.lines[0],received:true,receivedAt:'2026-10-12T10:00:00Z'},{...draft.lines[1],name:'Courroie',reference:'COUR-01',quantity:3}],status:'Partiellement reçu',originalReceivedIds:['legacy']};
html=render({...model,modal:multiUi});assert(html.includes('Intitulé du devis'));assert(html.includes('Pièce 1 · Reçue'));assert(html.includes('Pièce 2 reçue'));assert(html.includes('Ajouter une pièce'));assert(html.includes('Fournisseur'));assert(html.includes('SKF France'));
const multiOrder={...purchase,id:'multi-ui',name:'Devis multiple',status:'Partiellement reçu',lines:multiUi.lines};
let receiptDecision;const multiTree=captureOrders({...orderModel,records:[multiOrder],save(value){receiptDecision=value}});
const multiHtml=renderToStaticMarkup(multiTree);assert(multiHtml.includes('Modifier / PDF'));assert(multiHtml.includes('Pièces et réceptions'));assert(multiHtml.includes('Courroie'));assert(multiHtml.includes('COUR-01'));
nodes(multiTree,'button').find(b=>React.Children.toArray(b.props.children).includes('Reçu')).props.onClick();assert.equal(receiptDecision.action,'receive-order-line');assert.equal(receiptDecision.lineId,multiUi.lines[1].id);
const {MovementsView}=load('app/maintenance/movements.tsx');
const movementModel={...model,tab:'Magasin',moves:[{id:'manual:demo',site:'site-principal',part:'part1',quantity:2,reason:'Test',actor:'Admin',created:'2026-10-12',intervention:null},{id:'receipt:demo',site:'site-principal',part:'part1',quantity:3,reason:'Réception',actor:'Admin',created:'2026-10-12',intervention:null}]};
const movementHtml=renderToStaticMarkup(React.createElement(MovementsView,{model:movementModel}));assert.equal((movementHtml.match(/Supprimer le mouvement/g)||[]).length,2);
assert(!renderToStaticMarkup(React.createElement(MovementsView,{model:{...movementModel,user:{role:'technician'}}})).includes('Supprimer le mouvement'));
console.log('PASS: expandable quote lines, supplier field, per-line receipts, read-only received fields and admin manual-movement deletion controls.');

const brandNewFields=OrderFields({model:{...model,modal:{kind:'order',clientId:crypto.randomUUID(),site:'site-principal',name:'Première pièce',quantity:2,status:'Devis'}}});
nodes(brandNewFields,'button').find(b=>b.props.children==='Ajouter une autre pièce').props.onClick();
assert.equal(draft.lines.length,2);assert.notEqual(draft.lines[0].id,'legacy');assert.match(draft.lines[0].id,/^[a-f0-9-]{36}$/);assert.equal(draft.lines[0].name,'Première pièce');assert.equal(draft.lines[0].quantity,2);
console.log('PASS: adding a second piece to a brand-new quote assigns ordinary line IDs and preserves entered values.');
const family={id:'family-bearing',kind:'part-category',site:'site-principal',name:'Roulements'};
let pickedMachine,pickedFamily,pickedSort;
const organizedModel={...model,categories:[family],stockMachine:'',stockCategory:'',stockSort:'name',setStockMachine(value){pickedMachine=value},setStockCategory(value){pickedFamily=value},setStockSort(value){pickedSort=value},displayedParts:[{...part,category:family.id}]};
const organizedStock=StockView({model:organizedModel});const organizedHtml=renderToStaticMarkup(organizedStock);assert(organizedHtml.includes('Roulements'));assert(organizedHtml.includes('Quantité croissante'));assert(organizedHtml.includes('Quantité décroissante'));assert(organizedHtml.includes('Toutes les machines'));
nodes(organizedStock,'button').find(b=>React.Children.toArray(b.props.children).includes('Nouvelle famille')).props.onClick();assert.equal(draft.kind,'part-category');assert.equal(draft.site,'site-principal');
const organizedFields=load('app/maintenance/part-fields.tsx').PartFields({model:{...organizedModel,modal:part}});nodes(organizedFields,'select')[0].props.onChange({target:{value:family.id}});assert.equal(draft.category,family.id);
assert(!renderToStaticMarkup(StockView({model:{...organizedModel,readOnly:true,user:{role:'manager'}}})).includes('Nouvelle famille'));
console.log('PASS: compact machine/family/quantity controls, family creation/assignment and read-only access without new table columns.');
const mixedOrders=[{...purchase,id:'pending-decision',name:'Devis à décider',status:'Devis',creationOrder:1},{...purchase,id:'pending-delivery',name:'Commande attendue',status:'Commandé',creationOrder:2},{...purchase,id:'pending-partial',name:'Livraison partielle',status:'Partiellement reçu',creationOrder:3},{...purchase,id:'fully-received',name:'Réception terminée',status:'Reçu',creationOrder:4},{...purchase,id:'cancelled',name:'Commande annulée',status:'Annulé',creationOrder:5}];
const separated=captureOrders({...orderModel,records:mixedOrders}),separatedHtml=renderToStaticMarkup(separated);
assert(separatedHtml.includes('Devis &amp; commandes en attente (3)'));
const receivedDetails=nodes(separated,'details').find(d=>d.props.className==='received-orders');assert(receivedDetails);assert(!receivedDetails.props.open);
const receivedHtml=renderToStaticMarkup(receivedDetails);assert(receivedHtml.includes('Réception terminée'));assert(!receivedHtml.includes('Commande attendue'));assert(!receivedHtml.includes('Livraison partielle'));
assert(separatedHtml.indexOf('Livraison partielle')<separatedHtml.indexOf('Reçus (1)'));assert(separatedHtml.indexOf('Commande annulée')>separatedHtml.indexOf('Devis refusés'));
console.log('PASS: pending decisions/orders and partial receipts stay visible, completed receipts collapse below, and cancelled quotes remain in history.');
// Full-site valuation stays independent of search filters and remains visible read-only.
const {stockValuation}=load('lib/maintenance/pricing.ts');
const valuedParts=[{id:'priced',unitCostCents:1250},{id:'free',unitCostCents:0},{id:'unknown',unitCostCents:null},{id:'empty'}];
const quantities={priced:4,free:2,unknown:3,empty:0};
assert.deepEqual(stockValuation(valuedParts,id=>quantities[id]),{cents:5000,missing:1});
assert.deepEqual(stockValuation([],()=>0),{cents:0,missing:0});
const valuationHtml=renderToStaticMarkup(React.createElement(StockView,{model:{...model,parts:valuedParts,displayedParts:[],qty:id=>quantities[id],readOnly:true}}));
assert(valuationHtml.includes('Valeur estimée du stock'));assert(valuationHtml.includes('50,00'));assert(valuationHtml.includes('Montant partiel : 1'));assert(valuationHtml.includes('Tout le stock du site'));
assert(!renderToStaticMarkup(React.createElement(StockView,{model:{...model,selected:{id:'m1'}}})).includes('Valeur estimée du stock'));
console.log('PASS: full-site stock valuation, zero prices, missing prices and read-only display.');
