import fs from 'node:fs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
// The form migration must retain custom questions/order and every historical answer.
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE intervention_form(id TEXT PRIMARY KEY,version INTEGER,questions TEXT);CREATE TABLE interventions(id TEXT,answers TEXT,questions TEXT);');
const legacy={id:'parts',label:'Pièces remplacées',type:'textarea',required:false,options:[]},custom={id:'custom',label:'Question personnalisée',type:'text',required:false,options:[]};
db.prepare('INSERT INTO intervention_form VALUES(?,?,?)').run('global',7,JSON.stringify([custom,legacy,{...custom,id:'last'}]));
db.prepare('INSERT INTO interventions VALUES(?,?,?)').run('historical',JSON.stringify({parts:'Roulement 6205'}),JSON.stringify([legacy]));const oldReport=db.prepare('SELECT * FROM interventions').get();
const migration=fs.readFileSync('drizzle/0023_remove_legacy_parts_question.sql','utf8');db.exec(migration);db.exec(migration);
const current=db.prepare('SELECT * FROM intervention_form').get();assert.equal(current.version,8);assert.deepEqual(JSON.parse(current.questions).map(q=>q.id),['custom','last']);assert.deepEqual(db.prepare('SELECT * FROM interventions').get(),oldReport);
db.prepare('UPDATE intervention_form SET questions=?,version=9').run(JSON.stringify([{...legacy,label:'Question pièces personnalisée'}]));db.exec(migration);assert.equal(db.prepare('SELECT version FROM intervention_form').get().version,9);
console.log('PASS: removal of only the default free-text field, stable order/custom fields, preserved historical reports and migration idempotency.');
