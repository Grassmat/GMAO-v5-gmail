import fs from 'node:fs';import path from 'node:path';import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const require=createRequire(file);const exports={};cache.set(file,exports);new Function('require','exports',output)(specifier=>{if(!specifier.startsWith('.'))return require(specifier);const base=path.resolve(path.dirname(file),specifier);return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)))},exports);return exports}
const {initialQuestions}=load('lib/interventions/types.ts');const {ReportForm}=load('app/interventions/report-form.tsx');const {FormEditor}=load('app/interventions/form-editor.tsx');const form={version:1,questions:initialQuestions};const props={form,site:'site-principal',siteName:'Site exemple',machines:[{id:'m1',name:'Machine ajoutée'},{id:'m2',name:'Ancienne machine',archived:true}],onSaved(){},onClose(){},onSessionChanged(){},onRefresh(){}};
const html=renderToStaticMarkup(React.createElement(ReportForm,props));assert(html.includes('Machine ajoutée'));assert(!html.includes('Ancienne machine'));assert(html.includes('Travaux réalisés'));assert(html.includes('type="file"'));assert(html.includes('Site exemple'));
const custom={...form,questions:[{id:'added',label:'Question ajoutée',type:'select',required:true,options:['Premier choix','Second choix']}]};const edited=renderToStaticMarkup(React.createElement(ReportForm,{...props,form:custom}));assert(edited.includes('Question ajoutée'));assert(edited.includes('Second choix'));assert(!edited.includes('Travaux réalisés'));
const editor=renderToStaticMarkup(React.createElement(FormEditor,{...props,form}));assert(editor.includes('Ajouter une question'));assert(editor.includes('Retirer'));assert(editor.includes('Réponse obligatoire'));
console.log('PASS: native form renders dynamic machines, optional photos, custom questions and the form editor.');
const {matchingParts}=load('app/interventions/parts-picker.tsx');
const stock=[{id:'generic',name:'Joint standard',reference:'STD-20',quantity:0,machines:[],location:'A1',supplier:'Fournisseur'},{id:'bearing',name:'Roulement étanche',reference:'SKF-6205',quantity:4,machines:['m1'],location:'B2',supplier:'SKF'}];
assert.deepEqual(matchingParts(stock,'ROULEMENT etanche',['m1']).map(p=>p.id),['bearing']);assert.equal(matchingParts(stock,'skf 6205',[])[0].id,'bearing');assert.equal(matchingParts(stock,'',['m1'])[0].id,'bearing');assert.equal(matchingParts(stock,'B2',[])[0].id,'bearing');
const {ReportDetails}=load('app/interventions/report-details.tsx');
const details=renderToStaticMarkup(React.createElement(ReportDetails,{report:{id:'report',actor:'Technicien',source:'GMAO',machines:[{id:'m1',name:'Machine'}],questions:[],answers:{},files:[],parts:[{part:'bearing',name:'Roulement étanche',reference:'SKF-6205',quantity:2},{part:null,name:'Joint hors catalogue',reference:'',quantity:1}]},onClose(){}}));assert(details.includes('SKF-6205'));assert(details.includes('Déduit du stock'));assert(details.includes('Non référencée'));assert(details.includes('Joint hors catalogue'));
// Drive the actual picker handlers with lightweight hook state, without requiring a browser.
let states=[stock,'',false],cursor=0,selectedUsage=[];
const mockReact={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}]},useRef(value){return {current:value}},useCallback(fn){return fn},useEffect(){}};
const pickerFile=path.resolve('app/interventions/parts-picker.tsx'),pickerCompiled=ts.transpileModule(fs.readFileSync(pickerFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const pickerExports={},pickerRequire=createRequire(pickerFile);new Function('require','exports',pickerCompiled)(specifier=>specifier==='react'?mockReact:specifier.startsWith('.')?load([path.resolve(path.dirname(pickerFile),specifier)+'.tsx',path.resolve(path.dirname(pickerFile),specifier)+'.ts'].find(fs.existsSync)):pickerRequire(specifier),pickerExports);
function renderPicker(){cursor=0;return pickerExports.PartsPicker({site:'site-principal',machines:['m1'],value:selectedUsage,onChange(value){selectedUsage=value},onSessionChanged(){},disabled:false})}
function nodes(node,type){if(!node||typeof node!=='object')return [];return [...(node.type===type?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>nodes(child,type))]}
const {ReferenceSelect}=load('app/shared/reference-select.tsx');
let picker=renderPicker();let pickerCombo=nodes(picker,ReferenceSelect)[0];assert(pickerCombo.props.options.find(option=>option.value==='generic').disabled);pickerCombo.props.onChange('generic');assert.equal(selectedUsage.length,0);pickerCombo.props.onChange('bearing');assert.equal(selectedUsage.length,0);picker=renderPicker();nodes(picker,'button').find(button=>String(button.props.children).includes('Ajouter la sélection')).props.onClick();
picker=renderPicker();nodes(picker,'input').find(input=>input.props.type==='number').props.onChange({target:{value:'2'}});
assert.deepEqual(selectedUsage,[{part:'bearing',name:'Roulement étanche',reference:'SKF-6205',unitCostCents:null,quantity:2}]);
picker=renderPicker();assert(!nodes(picker,ReferenceSelect)[0].props.options.some(option=>option.value==='bearing'));nodes(picker,'button').find(button=>React.Children.toArray(button.props.children).includes('Ajouter une pièce non référencée')).props.onClick();assert.equal(selectedUsage[1].part,null);
picker=renderPicker();const freeName=nodes(picker,'input').find(input=>input.props.maxLength===150);freeName.props.onChange({target:{value:'Joint externe'}});assert.equal(selectedUsage[1].name,'Joint externe');
picker=renderPicker();nodes(picker,'button').find(button=>button.props['aria-label']==='Retirer Roulement étanche').props.onClick();assert.equal(selectedUsage.length,1);assert.equal(selectedUsage[0].part,null);
console.log('PASS: accent/reference search, compatible priority, stock selection and quantities, removal, unlisted pieces and consumption details.');

const {chronologicalInterventions,interventionStart}=load('lib/interventions/types.ts');
const reportAt=(id,date,start,created)=>({id,date,created,answers:{start},questions:initialQuestions});
const chronology=[reportAt('later','2026-10-02','14:00','2026-10-02T08:00:00Z'),reportAt('earlier','2026-10-02','12:20','2026-10-02T16:00:00Z'),reportAt('yesterday','2026-10-01','23:00','2026-10-02T18:00:00Z')];
assert.deepEqual(chronology.reverse().sort(chronologicalInterventions).map(r=>r.id),['later','earlier','yesterday']);
assert.equal(interventionStart({...chronology[0],answers:{start:'25:90'}}),'');
console.log('PASS: report chronology uses intervention time instead of creation time.');

const deletionReport={id:'test-report',actor:'Technicien',source:'GMAO',canDelete:true,machines:[{id:'m1',name:'Machine exemple'}],questions:[],answers:{},files:[],parts:[{part:'bearing',name:'Roulement',reference:'6200',quantity:2}]};
const permittedDetails=renderToStaticMarkup(React.createElement(ReportDetails,{report:deletionReport,onClose(){},onDeleted(){}}));assert(permittedDetails.includes('Supprimer le rapport'));
const deniedDetails=renderToStaticMarkup(React.createElement(ReportDetails,{report:{...deletionReport,canDelete:false},onClose(){},onDeleted(){}}));assert(!deniedDetails.includes('Supprimer le rapport'));
let detailStates=[],detailCursor=0;const deletionRef={current:false};
const detailReact={...React,useState(initial){const index=detailCursor++;if(!(index in detailStates))detailStates[index]=initial;return [detailStates[index],value=>{detailStates[index]=value}]},useRef(){return deletionRef}};
const detailFile=path.resolve('app/interventions/report-details.tsx'),detailCode=ts.transpileModule(fs.readFileSync(detailFile,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const detailExports={},detailRequire=createRequire(detailFile);new Function('require','exports',detailCode)(specifier=>specifier==='react'?detailReact:specifier.startsWith('.')?load([path.resolve(path.dirname(detailFile),specifier)+'.ts',path.resolve(path.dirname(detailFile),specifier)+'.tsx'].find(fs.existsSync)):detailRequire(specifier),detailExports);
let deletedResult=null,deleteFetchCalls=0;const realFetch=globalThis.fetch;
const serverDeletion={id:'test-report',stockRestored:[{part:'bearing',name:'Roulement',reference:'6200',quantityRestored:2,remaining:4}]};
globalThis.fetch=async (url,options)=>{deleteFetchCalls++;assert.equal(url,'/api/interventions/test-report');assert.equal(options.method,'DELETE');return new Response(JSON.stringify(serverDeletion))};
function renderDetails(){detailCursor=0;return detailExports.ReportDetails({report:deletionReport,onClose(){},onDeleted(result){deletedResult=result},onSessionChanged(){}})}
let modal=renderDetails();nodes(modal,'button').find(button=>React.Children.toArray(button.props.children).includes('Supprimer le rapport')).props.onClick();assert.equal(deleteFetchCalls,0);
modal=renderDetails();assert(nodes(modal,'li').some(li=>renderToStaticMarkup(li).includes('6200')));
nodes(modal,'button').find(button=>button.props.children==='Annuler').props.onClick();assert.equal(deleteFetchCalls,0);
modal=renderDetails();nodes(modal,'button').find(button=>React.Children.toArray(button.props.children).includes('Supprimer le rapport')).props.onClick();modal=renderDetails();
const confirm=nodes(modal,'button').find(button=>button.props.children==='Confirmer la suppression');await Promise.all([confirm.props.onClick(),confirm.props.onClick()]);assert.equal(deleteFetchCalls,1);assert.deepEqual(deletedResult,serverDeletion);
globalThis.fetch=realFetch;
console.log('PASS: report deletion visibility, confirmation, cancellation, exact API call, double-click prevention and stock-return receipt.');
// Editing reuses the saved question snapshot and pre-populates the whole report.
const editExample={...deletionReport,revision:3,canEdit:true,date:'2026-10-02',questions:initialQuestions,answers:{type:'Curative',technicians:['Technicien A'],date:'2026-10-02',start:'12:20',end:'12:42',work:'Précision déjà sauvegardée',service:'Non'},machine_service:'Non',waiting_note:'Roulement 6200 attendu',waiting_order:'waiting-order',files:[]};
const editHtml=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:editExample,orders:[{id:'waiting-order',site:'site-principal',name:'Roulement commandé',reference:'6200',supplier:'Fournisseur A',status:'Commandé'}]}));assert(editHtml.includes('Modifier le rapport'));assert(editHtml.includes('Précision déjà sauvegardée'));assert(editHtml.includes('Roulement 6200 attendu'));assert(editHtml.includes('Roulement commandé'));assert(editHtml.includes('Enregistrer les modifications'));assert(editHtml.includes('Seule la différence'));assert(editHtml.includes('value="Non" selected=""'));
const editDetailsHtml=renderToStaticMarkup(React.createElement(ReportDetails,{report:editExample,onClose(){},onEdit(){}}));assert(editDetailsHtml.includes('Modifier le rapport'));
const {MachineState}=load('app/maintenance/machine-state.tsx');
const stoppedHtml=renderToStaticMarkup(React.createElement(MachineState,{machine:{id:'m1',name:'Machine exemple',serviceState:'stopped',waitingNote:'Roulement 6200',waitingOrder:'order'},orders:[{id:'order',name:'Roulement',reference:'6200',supplier:'Fournisseur',status:'Reçu'}]}));assert(stoppedHtml.includes('service-badge stopped'));assert(stoppedHtml.includes('Hors service'));assert(stoppedHtml.includes('En attente de pièce'));assert(stoppedHtml.includes('Pièce reçue'));assert(stoppedHtml.includes('remise en service à confirmer'));
const runningHtml=renderToStaticMarkup(React.createElement(MachineState,{machine:{id:'m1',serviceState:'running'},orders:[]}));assert(runningHtml.includes('service-badge running'));assert(runningHtml.includes('En service'));assert(!runningHtml.includes('Hors service'));
const {InterventionHistory}=load('app/interventions/history.tsx');
const historyProps={site:'site-principal',siteName:'Site exemple',onSessionChanged(){}};
const directorHistory=renderToStaticMarkup(React.createElement(InterventionHistory,{...historyProps,userRole:'director'}));assert(directorHistory.includes('Toutes les interventions des sites'));
const technicianHistory=renderToStaticMarkup(React.createElement(InterventionHistory,{...historyProps,userRole:'technician'}));assert(!technicianHistory.includes('Toutes les interventions des sites'));
console.log('PASS: full edit prefill, waiting-piece controls, green/red machine state, received-piece reminder and director intersite checkbox.');
assert(editHtml.includes('Créer un devis pour cette pièce'));
const futureEditHtml=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:{...editExample,date:'2099-12-31'}}));assert(futureEditHtml.includes('ne détermine pas l’état actuel'));
console.log('PASS: inline quote creation control and future report correction notice.');

const preventiveEdit={...editExample,questions:initialQuestions,answers:{...editExample.answers,type:'Préventive',fault:'Panne ancienne',diagnosis:'Diagnostic ancien'}};const preventiveMarkup=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:preventiveEdit}));assert(!preventiveMarkup.includes('Description de la panne'));assert(!preventiveMarkup.includes('Diagnostic ancien'));assert(preventiveMarkup.includes('selected="">Préventive'));const preventiveDetails=renderToStaticMarkup(React.createElement(ReportDetails,{report:preventiveEdit,onClose(){}}));assert(!preventiveDetails.includes('Description de la panne'));assert(!preventiveDetails.includes('Diagnostic ancien'));const curativeMarkup=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:{...preventiveEdit,answers:{...preventiveEdit.answers,type:'Curative'}}}));assert(curativeMarkup.includes('Description de la panne'));assert(curativeMarkup.includes('Diagnostic ancien'));console.log('PASS: preventive reports hide fault and diagnosis in editing and reading; curative reports retain both sections.');
const {legacyPartsQuestion}=load('lib/interventions/types.ts');
const historicalEmpty={...editExample,questions:[legacyPartsQuestion],answers:{...editExample.answers,parts:''},parts:[{part:'bearing',name:'Roulement',reference:'6200',quantity:1}]};
const emptyLegacyHtml=renderToStaticMarkup(React.createElement(ReportDetails,{report:historicalEmpty,onClose(){}}));assert(!emptyLegacyHtml.includes('Pièces remplacées'));assert(emptyLegacyHtml.includes('Pièces utilisées'));assert(emptyLegacyHtml.includes('6200'));
const historicalText=renderToStaticMarkup(React.createElement(ReportDetails,{report:{...historicalEmpty,answers:{...historicalEmpty.answers,parts:'Ancienne note conservée'}},onClose(){}}));assert(historicalText.includes('Ancienne note conservée'));
assert(!renderToStaticMarkup(React.createElement(ReportForm,{...props,form:{version:1,questions:[...initialQuestions,legacyPartsQuestion]}})).includes('Pièces remplacées'));
console.log('PASS: legacy empty parts rubric is hidden, new reports use canonical part selection, and historical notes remain readable.');

// Family and machine filters combine with accent-insensitive text search.
const categorized=[{...stock[0],category:'joints',categoryName:'Joints'},{...stock[1],category:'bearings',categoryName:'Roulements'}];
assert.deepEqual(matchingParts(categorized,'roulements',['m1'],{category:'bearings',compatibleOnly:true}).map(p=>p.id),['bearing']);
assert.equal(matchingParts(categorized,'',['m2'],{compatibleOnly:true}).length,0);
assert.equal(matchingParts(categorized,'',[],{category:'none'}).length,0);
assert.equal(matchingParts(stock,'',[],{category:'none'}).length,2);
states=[categorized.map(p=>({...p,quantity:5})),'',false];selectedUsage=[];
picker=renderPicker();pickerCombo=nodes(picker,ReferenceSelect)[0];pickerCombo.props.multiple.onToggle('bearing');picker=renderPicker();nodes(picker,ReferenceSelect)[0].props.multiple.onToggle('generic');
picker=renderPicker();assert.equal(selectedUsage.length,0);assert.equal(nodes(picker,ReferenceSelect)[0].props.multiple.values.length,2);
nodes(picker,'button').find(button=>String(button.props.children).includes('Ajouter la sélection')).props.onClick();assert.equal(selectedUsage.length,2);assert(selectedUsage.every(p=>p.quantity===1));
picker=renderPicker();assert.equal(nodes(picker,ReferenceSelect)[0].props.multiple.values.length,0);
console.log('PASS: family and selected-machine filtering, category search and batch piece selection.');
const defectExample={...editExample,machine_service:'Defaut',defect_note:'Moteur chauffe, révision prévue',answers:{...editExample.answers,service:'Oui'}};
const defectFormHtml=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:defectExample}));assert(defectFormHtml.includes('value="Defaut" selected=""'));assert(defectFormHtml.includes('Défaut persistant / action'));assert(defectFormHtml.includes('Moteur chauffe, révision prévue'));assert(defectFormHtml.includes('Pièce attendue pour résoudre le défaut'));assert(defectFormHtml.includes('Créer un devis'));
const defectBadge=renderToStaticMarkup(React.createElement(MachineState,{machine:{id:'m',serviceState:'degraded',defectNote:'Moteur en surchauffe',waitingNote:'Remplacement moteur'},orders:[]}));assert(defectBadge.includes('service-badge degraded'));assert(defectBadge.includes('En service avec défaut'));assert(defectBadge.includes('Moteur en surchauffe'));assert(defectBadge.includes('Remplacement moteur'));
const defectDetails=renderToStaticMarkup(React.createElement(ReportDetails,{report:defectExample,onClose(){}}));assert(defectDetails.includes('En service avec défaut'));assert(defectDetails.includes('Moteur chauffe'));
const clearHtml=renderToStaticMarkup(React.createElement(ReportForm,{...props,initialReport:{...editExample,machine_service:'Oui',defect_resolved:1,answers:{...editExample.answers,service:'Oui'}}}));assert(clearHtml.includes('Les défauts persistants'));assert(clearHtml.includes('Un défaut déjà signalé reste orange'));
console.log('PASS: orange report choice, required persistent defect notes, waiting quote controls, machine badge/detail and explicit resolution confirmation.');

// The unlisted-piece form carries independent before-use and consumed quantities.
selectedUsage=[{part:null,name:'Pièce nouvelle',reference:'NEW',quantity:2,stockQuantity:5}];picker=renderPicker();let newMarkup=renderToStaticMarkup(picker);assert(newMarkup.includes('Quantité en magasin avant utilisation'));assert(newMarkup.includes('Fournisseur (facultatif)'));assert(newMarkup.includes('Stock après intervention : 3'));
const beforeUseInput=nodes(picker,'input').find(i=>i.props.type==='number'&&i.props.value===5);beforeUseInput.props.onChange({target:{value:'7'}});assert.equal(selectedUsage[0].stockQuantity,7);assert.equal(selectedUsage[0].quantity,2);
console.log('PASS: distinct inventory-before-use and consumed quantities, explicit remaining stock preview.');
