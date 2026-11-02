import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
function statement(query,values=[]){return {bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){if(/RETURNING/.test(query))return {results:sql.prepare(query).all(...values),meta:{changes:1}};const r=sql.prepare(query).run(...values);return {results:[],meta:{changes:Number(r.changes)}}}}}
const db={prepare:statement,async batch(list){sql.exec('BEGIN');try{const result=[];for(const s of list)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
function module(file,deps,returns){let code=fs.readFileSync(file,'utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');code=ts.transpile(code,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS});return new Function(...Object.keys(deps),code+';return {'+returns.join(',')+'};')(...Object.values(deps))}

const env={MAIL_CONFIG_ENCRYPTION_KEY:'42'.repeat(32),APP_ORIGIN:'https://app.test.invalid'};
const auth=module('lib/auth.ts',{env,database:()=>db},['AppError','allowSite','digest']);
const config=module('lib/mail/configuration.ts',{env,database:()=>db,...auth,validSite:async(site)=>{if(!['site1','site2'].includes(site))throw new auth.AppError('Site invalide.');}},['appOrigin','readSecret','writeSecret','connectionId','mailConfigurationStatus','saveGoogleClient','startGoogleConnection','googleRequest','finishGoogleConnection','disconnectMail','readMailConfiguration','anyMailConnection']);
const provider=module('lib/mail/provider.ts',{env,database:()=>db,...auth,...config},['mailReady','sendMail','applicationLink']);
const director={id:'d',role:'director'},manager={id:'m',role:'manager',site:'site1'},tech={id:'t',role:'technician',site:'site1'};
let tokenRequests=0,sends=0,mode='success',mailBody;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 if(url==='https://oauth2.googleapis.com/token'){tokenRequests++;return Response.json({refresh_token:'refresh-fixture',access_token:'access-fixture',scope:'openid email https://www.googleapis.com/auth/gmail.send'});}
 if(url==='https://openidconnect.googleapis.com/v1/userinfo')return Response.json({email:'sender@example.org',email_verified:true});
 assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');sends++;mailBody=Buffer.from(JSON.parse(init.body).raw,'base64url').toString('utf8');if(mode==='timeout')throw Error('timeout');if(mode==='quota')return Response.json({error:'quota'},{status:429});return Response.json({id:'gmail-fixture-'+sends});
};
try{
 assert.equal(await provider.mailReady(),false);
 await assert.rejects(()=>config.saveGoogleClient(manager,{clientId:'1234567890.apps.googleusercontent.com',clientSecret:'secret-fixture-long',revision:0}),e=>e.status===403);
 await config.saveGoogleClient(director,{clientId:'1234567890.apps.googleusercontent.com',clientSecret:'secret-fixture-long',revision:0});
 const stored=sql.prepare("SELECT * FROM mail_configuration WHERE id='google-client'").get();assert(!JSON.stringify(stored).includes('secret-fixture'));assert(!JSON.stringify(await config.mailConfigurationStatus(director)).includes('secret-fixture'));
 await assert.rejects(()=>config.saveGoogleClient(director,{clientId:'1234567890.apps.googleusercontent.com',clientSecret:'secret-fixture-long',revision:0}),e=>e.status===409);
 await assert.rejects(()=>config.startGoogleConnection(manager,'','automatic'),e=>e.status===403);
 await assert.rejects(()=>config.startGoogleConnection(manager,'site2','automatic'),e=>e.status===403);
 await assert.rejects(()=>config.startGoogleConnection(tech,'site1','automatic'),e=>e.status===403);
 let flow=await config.startGoogleConnection(director,'','automatic'),url=new URL(flow.url);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('redirect_uri'),env.APP_ORIGIN+'/api/mail/google/callback');assert(!JSON.stringify(sql.prepare('SELECT * FROM mail_oauth_states').all()).includes(flow.token));
 await assert.rejects(()=>config.finishGoogleConnection(director,flow.token,'wrong','code'));assert.equal(tokenRequests,0);
 await assert.rejects(()=>config.finishGoogleConnection(manager,flow.token,flow.token,'code'));assert.equal(tokenRequests,0);
 await config.finishGoogleConnection(director,flow.token,flow.token,'code');await assert.rejects(()=>config.finishGoogleConnection(director,flow.token,flow.token,'code'));
 assert.equal(await provider.mailReady(),true);assert.equal((await config.mailConfigurationStatus(director)).sender,'sender@example.org');assert.equal((await config.readMailConfiguration()).refreshToken,'refresh-fixture');assert(!JSON.stringify(sql.prepare('SELECT * FROM mail_configuration').all()).includes('refresh-fixture'));
 const message={site:'site1',category:'account',to:'recipient@example.org',subject:'Mot de passe oublié',text:'Texte accentué',key:'account/fixture'};
 const id=await provider.sendMail(message);assert.equal(sends,1);assert(mailBody.includes('From: sender@example.org'));assert(mailBody.includes('To: recipient@example.org'));assert.equal(await provider.sendMail(message),id);assert.equal(sends,1);
 await assert.rejects(()=>provider.sendMail({...message,subject:'bad\r\nBcc: victim@example.org',key:'bad-header'}));assert.equal(sends,1);
 mode='timeout';await assert.rejects(()=>provider.sendMail({...message,key:'timeout'}));const attempts=sends;await assert.rejects(()=>provider.sendMail({...message,key:'timeout'}));assert.equal(sends,attempts);
 mode='quota';await assert.rejects(()=>provider.sendMail({...message,key:'quota'}));mode='success';await provider.sendMail({...message,key:'quota'});
 flow=await config.startGoogleConnection(manager,'site1','quote');await config.finishGoogleConnection(manager,flow.token,flow.token,'code');assert.equal((await config.readMailConfiguration('site1','quote')).id,'quote:site1');await assert.rejects(()=>provider.sendMail({...message,category:'quote',senderEmail:'other@example.org',key:'wrong-sender'}));
 assert.equal(await provider.mailReady('quote','site1','other@example.org'),false);assert.equal(await provider.mailReady('quote','site1','sender@example.org'),true);
 await assert.rejects(()=>config.disconnectMail(manager,'site2','quote',1),e=>e.status===403);
 await config.disconnectMail(manager,'site1','quote',1);assert.equal((await config.readMailConfiguration('site1','quote')).id,'automatic:global');
 flow=await config.startGoogleConnection(manager,'site1','automatic');sql.prepare('UPDATE mail_oauth_states SET expires=0').run();await assert.rejects(()=>config.finishGoogleConnection(manager,flow.token,flow.token,'code'));
 await config.disconnectMail(director,'','automatic',1);assert.equal(await provider.mailReady(),false);
 await assert.rejects(()=>config.writeSecret('automatic:global',{refreshToken:'stale'},'old@example.org',1),e=>e.status===409);assert.equal(await config.readMailConfiguration(),null);
 console.log('PASS: encrypted Gmail credentials, director/manager site permissions, scoped connections, PKCE/browser/user-bound one-use expiring OAuth states, sender identity, MIME, recipient isolation, header rejection, deduplicated sending and uncertain-delivery suppression.');
}finally{globalThis.fetch=originalFetch;sql.close();}
