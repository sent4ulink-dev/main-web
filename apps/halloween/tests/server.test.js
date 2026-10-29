import test from 'node:test';import assert from 'node:assert/strict';import {createApi,createShareID,starterContent,FIVE_DAYS,FIRST_VISIT_GRACE} from '../server/api.js';import {createLocalBucket} from '../server/local-bucket.js';import {defaultPlan} from '../site/plan-core.js';
const content={plan:{...defaultPlan,location:'Candy Castle',message:'Meet you by the gate ♡'},texts:{'quest:0':'A sweet adventure'}};
const SITE='https://invitation.test';
function environment(extra={}){return {STUDIO_PASSWORD:'test-only-studio-password',SHARES:createLocalBucket(),CORS_ORIGIN:SITE,ORDERS_API_BASE:'https://orders.test',...extra};}
const links=env=>env.SHARES.keys().filter(key=>key.startsWith('shares/'));
const request=(path,method='GET',body=null,token=null,origin=SITE,headers={})=>new Request('https://api.test'+path,{method,headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
// A pretend orders server: it answers GET /links/<id> for the ids in `sold` (a link bought for this card) and 404 for the rest.
function store({sold=[],down=false}={}){const asked=[];return {asked,sold,fetchImpl:async url=>{asked.push(String(url));if(down)throw new Error('network down');const id=String(url).split('/').pop();return sold.includes(id)?Response.json({ok:true,product:'halloween'}):Response.json({error:'Not found.'},{status:404});}};}
async function login(api,env){const response=await api.fetch(request('/api/studio/login','POST',{password:env.STUDIO_PASSWORD}),env);assert.equal(response.status,200);assert.equal(response.headers.get('Set-Cookie'),null);return (await response.json()).token;}
async function create(api,env,token){assert.equal((await api.fetch(request('/api/studio/draft','PUT',{content,revision:0},token),env)).status,200);const response=await api.fetch(request('/api/studio/links','POST',{revision:1},token),env);assert.equal(response.status,201);return response.json();}
test('studio requires server password and memory bearer on every request; old singleton endpoint is closed',async()=>{
  const api=createApi(),env=environment();assert.equal((await api.fetch(request('/api/studio/draft'),env)).status,401);
  assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'wrong'}),env)).status,401);
  const token=await login(api,env);assert.equal((await api.fetch(request('/api/studio/draft','GET',null,token),env)).status,200);
  assert.equal((await api.fetch(request('/api/studio/draft','GET',null,token+'x'),env)).status,401);
  assert.equal((await api.fetch(request('/api/studio/draft'),env)).status,401);assert.equal((await api.fetch(request('/api/invitation'),env)).status,404);
  assert.equal((await api.fetch(request('/api/studio/draft','PUT',{content,revision:0},token,'https://other.test'),env)).status,403);
  env.STUDIO_PASSWORD='rotated-password';assert.equal((await api.fetch(request('/api/studio/draft','GET',null,token),env)).status,401);
});
test('missing server secret fails closed, password retries are rate limited for a quarter of an hour',async()=>{
  let now=Date.parse('2030-01-01T00:00:00Z');const api=createApi({now:()=>now}),env=environment();delete env.STUDIO_PASSWORD;assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'anything'}),env)).status,503);env.STUDIO_PASSWORD='test-password';
  for(let i=0;i<10;i++)assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'wrong'}),env)).status,401);
  assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'wrong'}),env)).status,429);
  assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'test-password'}),env)).status,429);
  assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'wrong'},null,SITE,{'X-Forwarded-For':'203.0.113.9'}),env)).status,401);
  now+=15*60*1000;assert.equal((await api.fetch(request('/api/studio/login','POST',{password:'test-password'}),env)).status,200);
  // a right password clears that address's count; the other address still has its one wrong try
  assert.equal(env.SHARES.keys().filter(key=>key.startsWith('attempts/')).length,1);
});
test('without storage every request fails closed',async()=>{
  const api=createApi(),env=environment();delete env.SHARES;assert.equal((await api.fetch(request('/api/invitations/'+'A'.repeat(32)),env)).status,503);assert.equal((await api.fetch(request('/api/studio/login','POST',{password:env.STUDIO_PASSWORD}),env)).status,503);
});
test('links can only be created from successfully saved current content and persist independent snapshots',async()=>{
  const api=createApi(),env=environment(),token=await login(api,env);
  assert.equal((await api.fetch(request('/api/studio/links','POST',{revision:0},token),env)).status,409);
  const link=await create(api,env,token);assert.match(link.id,/^[A-Za-z0-9_-]{32}$/);assert.equal(link.editingDeadline-link.createdAt,FIVE_DAYS);assert.equal(link.url,SITE+'/?share='+link.id);
  assert.equal((await api.fetch(request('/api/studio/links','POST',{revision:0},token),env)).status,409);
  const nextContent={...content,plan:{...content.plan,location:'Moon Hill'}};assert.equal((await api.fetch(request('/api/studio/draft','PUT',{content:nextContent,revision:1},token),env)).status,200);
  assert.equal((await api.fetch(request('/api/studio/draft','PUT',{content:nextContent,revision:1},token),env)).status,409);
  const saved=await(await createApi().fetch(request('/api/invitations/'+link.id),env)).json();assert.deepEqual(saved.content,content);assert(saved.canEdit);assert.equal(saved.finished,false);
  assert.deepEqual((await(await api.fetch(request('/api/studio/draft','GET',null,token),env)).json()).content,nextContent);
});
test('secure IDs are URL-safe, unique, and collisions retry without overwriting an invitation',async()=>{
  const ids=Array.from({length:1000},createShareID);assert.equal(new Set(ids).size,1000);ids.forEach(id=>assert.match(id,/^[A-Za-z0-9_-]{32}$/));
  const firstID='A'.repeat(32),secondID='B'.repeat(32);let calls=0;const api=createApi({randomID:()=>++calls<=2?firstID:secondID}),env=environment(),token=await login(api,env);await create(api,env,token);
  const second=await(await api.fetch(request('/api/studio/links','POST',{revision:1},token),env)).json();assert.equal(second.id,secondID);assert.equal(calls,3);assert.equal(links(env).length,2);
});
test('the five days start at the first visit, not when the link is made',async()=>{
  let now=Date.parse('2030-01-01T00:00:00Z');const api=createApi({now:()=>now}),env=environment(),token=await login(api,env),link=await create(api,env,token);const path='/api/invitations/'+link.id;
  // the studio opening its new link straight away is not a visit
  now+=FIRST_VISIT_GRACE-1;let state=await(await api.fetch(request(path),env)).json();assert.equal(state.editingDeadline,now+FIVE_DAYS);assert(state.canEdit);
  // a month on a shelf: still unvisited, still editable, and a save does not start the days either
  now+=30*24*60*60*1000;assert.equal((await api.fetch(request(path,'PUT',{content,revision:0}),env)).status,200);
  const first=now;state=await(await api.fetch(request(path),env)).json();assert.equal(state.editingDeadline,first+FIVE_DAYS);assert(state.canEdit);
  // …and from the first visit on, the deadline stays where it is
  now+=2*24*60*60*1000;state=await(await api.fetch(request(path),env)).json();assert.equal(state.editingDeadline,first+FIVE_DAYS);assert(state.canEdit);
  now=first+FIVE_DAYS;state=await(await api.fetch(request(path),env)).json();assert(!state.canEdit);assert.equal(state.editingDeadline,first+FIVE_DAYS);
});
test('five-day deadline is enforced on backend saves and finish, while viewing stays available',async()=>{
  let now=Date.parse('2030-01-01T00:00:00Z');const api=createApi({now:()=>now}),env=environment(),token=await login(api,env),link=await create(api,env,token);const path='/api/invitations/'+link.id;
  now+=FIRST_VISIT_GRACE+1;const deadline=(await(await api.fetch(request(path),env)).json()).editingDeadline;assert.equal(deadline,now+FIVE_DAYS);
  now=deadline-1;assert((await(await api.fetch(request(path),env)).json()).canEdit);
  assert.equal((await api.fetch(request(path,'PUT',{content,revision:0}),env)).status,200);
  assert.equal((await api.fetch(request(path,'PUT',{content,revision:1,editingDeadline:now+FIVE_DAYS}),env)).status,400);
  now=deadline;for(const [suffix,method]of [['','PUT'],['/finish','POST']]){const refused=await api.fetch(request(path+suffix,method,{content,revision:1}),env);assert.equal(refused.status,423);assert.equal((await refused.json()).editingDeadline,deadline);}
  const saved=await(await api.fetch(request(path),env)).json();assert(!saved.canEdit);assert.deepEqual(saved.content,content);assert.equal(saved.createdAt,link.createdAt);assert.equal(saved.editingDeadline,deadline);
});
test('permanent finishing atomically saves only that invitation and cannot be reversed',async()=>{
  const api=createApi(),env=environment(),token=await login(api,env),link=await create(api,env,token),path='/api/invitations/'+link.id;
  const changed={...content,plan:{...content.plan,location:'Pink Bat Castle'}};assert.equal((await api.fetch(request(path+'/finish','POST',{content:changed,revision:0}),env)).status,200);
  for(const [suffix,method]of [['','PUT'],['/finish','POST']])assert.equal((await api.fetch(request(path+suffix,method,{content,revision:1}),env)).status,423);
  const state=await(await createApi().fetch(request(path),env)).json();assert(state.finished);assert(!state.canEdit);assert.deepEqual(state.content,changed);
  const draft=await(await api.fetch(request('/api/studio/draft','GET',null,token),env)).json();assert.deepEqual(draft.content,content);assert(draft.canEdit);
});
test('a save and a finish sent together leave the invitation finished',async()=>{
  const api=createApi(),env=environment(),token=await login(api,env);await create(api,env,token);
  for(let round=0;round<20;round++){const link=await(await api.fetch(request('/api/studio/links','POST',{revision:1},token),env)).json(),path='/api/invitations/'+link.id;
    const responses=await Promise.all([api.fetch(request(path,'PUT',{content,revision:0}),env),api.fetch(request(path+'/finish','POST',{content,revision:0}),env),api.fetch(request(path,'PUT',{content,revision:0}),env)]);
    const state=await(await api.fetch(request(path),env)).json();
    // whichever arrived first won the revision; once the finish is in, nothing reopens it
    if(responses[1].status===200){assert(state.finished);assert(!state.canEdit);}else{assert.equal(responses[1].status,409);assert(!state.finished);assert.equal(state.revision,1);}
    assert.equal(responses.filter(r=>r.status===200).length,1);}
});
test('unknown IDs and test never return studio defaults or consume production records',async()=>{
  const shop=store(),api=createApi({fetchImpl:shop.fetchImpl}),env=environment();for(const id of ['test','', 'nope','Z'.repeat(32)])assert.equal((await api.fetch(request('/api/invitations/'+id),env)).status,404);
  assert.equal(links(env).length,0);assert.deepEqual(shop.asked,['https://orders.test/links/'+'Z'.repeat(32)]);
  const id=createShareID();assert.equal((await api.fetch(request('/api/invitations/'+id,'PUT',{content,revision:0}),env)).status,404);assert.equal(shop.asked.length,1);
});
test('expired studio tokens and stale invitation revisions cannot authorize or overwrite',async()=>{
  let now=Date.parse('2030-01-01T00:00:00Z');const api=createApi({now:()=>now}),env=environment(),token=await login(api,env),link=await create(api,env,token);const path='/api/invitations/'+link.id;
  assert.equal((await api.fetch(request(path,'PUT',{content,revision:0}),env)).status,200);assert.equal((await api.fetch(request(path,'PUT',{content,revision:0}),env)).status,409);
  now+=13*60*60*1000;assert.equal((await api.fetch(request('/api/studio/draft','GET',null,token),env)).status,401);
});
test('the store makes a sold link at its id: by its secret, or by vouching for the sale; never twice',async()=>{
  const now=Date.parse('2029-11-20T00:00:00Z'),sold=createShareID(),secret=createShareID(),unsold=createShareID(),shop=store({sold:[sold]});
  const api=createApi({now:()=>now,fetchImpl:shop.fetchImpl}),env=environment({SHARE_CREATE_SECRET:'store-secret'});
  const ensure=(id,headers={})=>api.fetch(request('/api/invitations/'+id+'/ensure','POST',null,null,null,headers),env);
  // with the store's secret, nobody is asked
  assert.equal((await ensure(secret,{'x-halloween-create-secret':'store-secret'})).status,201);assert.equal(shop.asked.length,0);
  // without it (or with a wrong one) the store is asked whether it sold the id
  assert.equal((await ensure(unsold,{'x-halloween-create-secret':'guess'})).status,403);assert.equal((await ensure(unsold)).status,403);assert.equal((await ensure('short')).status,404);
  const made=await ensure(sold);assert.equal(made.status,201);assert.deepEqual(await made.json(),{ok:true,existed:false});assert.equal(shop.asked.at(-1),'https://orders.test/links/'+sold);
  assert.deepEqual(links(env).sort(),['shares/'+secret+'.json','shares/'+sold+'.json'].sort());
  // it starts as the invitation's own words, for the coming Halloween, and its days have not begun
  const opened=await(await api.fetch(request('/api/invitations/'+sold),env)).json();assert.deepEqual(opened.content,starterContent(now));assert.equal(opened.content.plan.date,'October 31, 2030');assert.equal(starterContent(Date.parse('2029-10-30T00:00:00Z')).plan.date,'October 31, 2029');assert(opened.canEdit);assert.equal(opened.editingDeadline,now+FIVE_DAYS);
  // asked again after the buyer has written in it, nothing is overwritten
  assert.equal((await api.fetch(request('/api/invitations/'+sold,'PUT',{content,revision:0}),env)).status,200);
  assert.deepEqual(await(await ensure(sold)).json(),{ok:true,existed:true});assert.deepEqual((await(await api.fetch(request('/api/invitations/'+sold),env)).json()).content,content);
  assert.equal((await api.fetch(request('/api/invitations/'+sold+'/ensure'),env)).status,405);
});
test('a sold link opened before the store’s call arrived is made on opening; an unsold one is not',async()=>{
  const sold=createShareID(),shop=store({sold:[sold]}),api=createApi({fetchImpl:shop.fetchImpl}),env=environment({ORDERS_API_BASE:'https://store.example/'});
  const opened=await api.fetch(request('/api/invitations/'+sold),env);assert.equal(opened.status,200);assert((await opened.json()).canEdit);assert.deepEqual(shop.asked,['https://store.example/links/'+sold]);
  assert.equal((await api.fetch(request('/api/invitations/'+sold),env)).status,200);assert.equal(shop.asked.length,1);
  assert.equal((await api.fetch(request('/api/invitations/'+createShareID()),env)).status,404);assert.equal(links(env).length,1);
  const offline=createApi({fetchImpl:store({sold:[sold],down:true}).fetchImpl}),other=environment();assert.equal((await offline.fetch(request('/api/invitations/'+sold),other)).status,404);assert.equal(links(other).length,0);
});
