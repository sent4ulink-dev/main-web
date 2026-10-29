import test from 'node:test';import assert from 'node:assert/strict';import {ModeRepository,DEMO_KEY,selectMode,RequestError} from '../site/mode-repository.js';
test('URL selection isolates studio, local test, real IDs, and unavailable links',()=>{
  assert.deepEqual(selectMode(''),{kind:'studio'});assert.deepEqual(selectMode('?other=true'),{kind:'studio'});assert.deepEqual(selectMode('?share=test'),{kind:'test'});assert.deepEqual(selectMode('?share='+'A'.repeat(32)),{kind:'invitation',id:'A'.repeat(32)});
  for(const query of ['?share=','?share=unknown','?share=TEST','?share=test&share=test','?share=%2Fetc'])assert.equal(selectMode(query).kind,'unavailable');
});
test('test edits, finishing and reset stay local, separately from production and never call fetch',async()=>{
  const map=new Map([['production:sentinel','keep']]);const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  let calls=0;const repo=new ModeRepository({kind:'test'},{storage:()=>storage,fetcher:()=>{calls++;throw new Error('Network must not be used');}});
  const sample=await repo.load();sample.content.plan.location='Demo garden';await repo.save(sample.content,0);assert(map.has(DEMO_KEY));assert.equal((await repo.load()).content.plan.location,'Demo garden');
  await repo.save(sample.content,1,true);assert.equal((await repo.load()).canEdit,false);await assert.rejects(repo.save(sample.content,2),error=>error.status===423);await assert.rejects(repo.createLink(2),error=>error.status===403);
  await repo.reset();assert(!map.has(DEMO_KEY));assert.equal((await repo.load()).canEdit,true);assert.equal(map.get('production:sentinel'),'keep');assert.equal(calls,0);
});
test('studio auth is memory only, a fresh repository cannot restore login, and other modes cannot log in',async()=>{
  const calls=[];let writes=0;const fetcher=async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({token:'memory-token'})};};const storage=()=>({getItem:()=>null,setItem:()=>writes++});
  const repo=new ModeRepository({kind:'studio'},{fetcher,storage});await repo.login('password');await repo.load();assert.equal(calls[1].options.headers.Authorization,'Bearer memory-token');assert.equal(writes,0);repo.clearAccess();assert.equal(repo.token,null);
  const fresh=new ModeRepository({kind:'studio'},{fetcher,storage});await fresh.load();assert.equal(calls[2].options.headers.Authorization,undefined);await assert.rejects(new ModeRepository({kind:'test'}).login('password'));
});
test('unavailable IDs fail closed and connection errors do not fall back to sample content',async()=>{
  const repo=new ModeRepository({kind:'invitation',id:'Z'.repeat(32)},{fetcher:async()=>({ok:false,status:404,json:async()=>({error:'Link unavailable'})})});await assert.rejects(repo.load(),error=>error instanceof RequestError&&error.status===404);
  const offline=new ModeRepository({kind:'invitation',id:'Z'.repeat(32)},{fetcher:async()=>{throw new Error('Offline');},patience:{totalMs:0}});await assert.rejects(offline.load(),/Connection error/);
  // a sleeping server: the first try is cut off, the second meets a 503 while it wakes, the third answers
  let tries=0;const waking=new ModeRepository({kind:'invitation',id:'Z'.repeat(32)},{fetcher:async()=>{tries++;if(tries===1)throw new Error('Offline');if(tries===2)return {ok:false,status:503,json:async()=>({})};return {ok:true,status:200,json:async()=>({content:{plan:{},texts:{}},revision:3,canEdit:false,finished:true})};},patience:{attemptMs:1000,totalMs:10000}});
  assert.equal((await waking.load()).revision,3);assert.equal(tries,3);
});
