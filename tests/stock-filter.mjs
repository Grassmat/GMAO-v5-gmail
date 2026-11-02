import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=fs.readFileSync('lib/maintenance/stock-filter.ts','utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');
const {stockRows}=new Function(ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS})+';return {stockRows}')();
const parts=[{id:'a',name:'Roulement étanche',reference:'6200',supplier:'SKF',category:'bearing',machines:['m1']},{id:'b',name:'Capteur',category:'sensor',machines:['m2','m1']},{id:'c',name:'Courroie',machines:[]}],machines=[{id:'m1',name:'Tunnel'},{id:'m2',name:'Calandre'}],qty=id=>({a:5,b:0,c:2}[id]);
assert.deepEqual(stockRows(parts,machines,qty,{machine:'m1'}).map(p=>p.id),['b','a']);assert.deepEqual(stockRows(parts,machines,qty,{machine:'unassigned'}).map(p=>p.id),['c']);
assert.deepEqual(stockRows(parts,machines,qty,{category:'bearing'}).map(p=>p.id),['a']);assert.deepEqual(stockRows(parts,machines,qty,{category:'none'}).map(p=>p.id),['c']);
assert.deepEqual(stockRows(parts,machines,qty,{sort:'quantity-asc'}).map(p=>p.id),['b','c','a']);assert.deepEqual(stockRows(parts,machines,qty,{sort:'quantity-desc'}).map(p=>p.id),['a','c','b']);assert.deepEqual(stockRows(parts,machines,qty,{sort:'machine'}).map(p=>p.id),['c','b','a']);
assert.deepEqual(stockRows(parts,machines,qty,{query:'roulement etanche skf',machine:'m1',category:'bearing'}).map(p=>p.id),['a']);assert.deepEqual(stockRows(parts,machines,qty,{selected:'m2'}).map(p=>p.id),['b']);assert.deepEqual(parts.map(p=>p.id),['a','b','c']);
console.log('PASS: machine/unassigned/family filters, name/quantity/machine sorting, combined accent-insensitive search, machine-sheet scope and unchanged source records.');
