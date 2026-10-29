import {defaultPlan,cleanContent} from '../site/plan-core.js';

// The invitation's server: the private studio (a password, one draft, links
// made from it) and the links themselves, each its own saved invitation that
// its holder may edit for five days. Everything is kept as JSON objects in one
// bucket (env.SHARES: an R2 bucket on Render, a file on this computer):
//   shares/<id>.json    {content, createdAt, editingDeadline, finalized, revision}
//   studio/draft.json   {content, revision}
//   attempts/<key>.json {windowStart, attempts}   (wrong studio passwords)
// sent4u sells the links: the orders server mints an id when someone pays, and the invitation is made the
// first time that id is opened (or earlier, by POST …/<id>/ensure); the card asks the orders server whether the
// id was really bought for this card (askStore below).
export const FIVE_DAYS=5*24*60*60*1000;
// The five days start at a link's first visit, not when it is made: until then
// editingDeadline is null. The studio opens a new link itself the moment it is
// made, so an open within a minute of making doesn't count.
export const FIRST_VISIT_GRACE=60*1000;
const PRODUCT='halloween';   // what the orders server calls this card
const ID_PATTERN=/^[A-Za-z0-9_-]{16,64}$/;
const DRAFT_KEY='studio/draft.json';
const shareKey=id=>`shares/${id}.json`;
const encoder=new TextEncoder();
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const base64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function createShareID(){return base64(crypto.getRandomValues(new Uint8Array(24)));}
async function hash(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function equal(a,b){let result=a.length^b.length;for(let i=0;i<a.length;i++)result|=a[i]^(b[i]||0);return result===0;}
async function signature(value,password){const key=await crypto.subtle.importKey('raw',encoder.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));}
async function token(password,now){const payload=base64(encoder.encode(JSON.stringify({role:'studio',nonce:createShareID(),expires:now+12*60*60*1000})));return `${payload}.${base64(await signature(payload,password))}`;}
async function authorized(request,env,now){if(!env.STUDIO_PASSWORD)return false;const value=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];if(!value||value.length>700)return false;try{const [payload,sig]=value.split('.');if(!equal(encoder.encode(sig),encoder.encode(base64(await signature(payload,env.STUDIO_PASSWORD)))))return false;const decoded=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));return decoded.role==='studio'&&ID_PATTERN.test(decoded.nonce)&&Number.isFinite(decoded.expires)&&decoded.expires>now;}catch{return false;}}
async function bodyOf(request,allowed){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(new Error('Expected JSON content.'),{status:415});const raw=await request.text();if(raw.length>180000)throw Object.assign(new Error('Content is too large.'),{status:413});let body;try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key)))throw Object.assign(new Error('Invalid request fields.'),{status:400});return body;}
function checkedContent(body){if(!Number.isInteger(body.revision)||body.revision<0)throw Object.assign(new Error('Invalid revision.'),{status:400});try{return cleanContent(body.content);}catch(error){error.status=400;throw error;}}
async function read(bucket,key){const object=await bucket.get(key);return object?object.json():null;}
const write=(bucket,key,value)=>bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
const canEdit=(record,now)=>!record.finalized&&(record.editingDeadline==null||now<record.editingDeadline);
// What a page is told: the real deadline once the days are running; before
// that, when they would end if they started now (a page always gets a time).
const shownDeadline=(record,now)=>record.editingDeadline??now+FIVE_DAYS;
function linkState(record,now){return {content:record.content,revision:record.revision,createdAt:record.createdAt,editingDeadline:shownDeadline(record,now),finished:!!record.finalized,canEdit:canEdit(record,now)};}
function closed(record,now){return json({error:record.finalized?'Editing has permanently finished.':'The five-day editing window has closed.',finished:!!record.finalized,editingDeadline:shownDeadline(record,now),canEdit:false},423);}
// What a sold link starts as: the invitation's own words, for the coming Halloween.
export function starterContent(now){const date=new Date(now);return {plan:{...defaultPlan,date:`October 31, ${date.getUTCFullYear()+(date.getUTCMonth()>9?1:0)}`},texts:{}};}
const newLink=(content,now)=>({content,createdAt:now,editingDeadline:null,finalized:false,revision:0});

export function createApi({now=()=>Date.now(),randomID=createShareID,fetchImpl=(...args)=>fetch(...args)}={}){
  // One thing at a time for each record: a save and a "finish" that arrive
  // together must not both read the invitation and both write it back.
  const turns=new Map();
  function inTurn(key,work){const run=(turns.get(key)??Promise.resolve()).then(work,work);const settled=run.then(()=>{},()=>{});turns.set(key,settled);settled.then(()=>{if(turns.get(key)===settled)turns.delete(key);});return run;}
  // What the store says of an id: {valid:true} if it sold it, {removed:true}
  // if it took it back; nothing if it can't be asked.
  // Was this id really bought for this card? The sent4u orders server knows: GET /links/<id> -> { ok, product }.
  // Answers { valid: true } only for a real, not-refunded link of this card; {} when it can't be asked.
  async function askStore(id,env){const base=String(env.ORDERS_API_BASE||'').replace(/[/]+$/,'');if(!base)return {};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{const response=await fetchImpl(`${base}/links/${encodeURIComponent(id)}`,{signal:controller.signal});if(!response.ok)return {};const body=(await response.json())||{};return {valid:body.ok===true&&body.product===PRODUCT};}
    catch(error){console.warn(`Checking ${id} with the orders server failed:`,error.message);return {};}finally{clearTimeout(timer);}}
  return {async fetch(request,env){const url=new URL(request.url),path=url.pathname,time=now(),bucket=env.SHARES;
  try{
    if(!bucket)throw new Error('Invitation storage unavailable');
    const studio=path.startsWith('/api/studio/');const linkMatch=/^\/api\/invitations\/([^/]+)(\/finish|\/ensure)?$/.exec(path);
    if(!studio&&!linkMatch)return json({error:'Not found.'},404);
    // The page is on another origin (CORS_ORIGIN lists it); a change asked for
    // by any other website is refused. The store's own calls carry no Origin.
    const origins=(env.CORS_ORIGIN||'*').split(',').map(value=>value.trim()).filter(Boolean),origin=request.headers.get('Origin');
    if(request.method!=='GET'&&origin&&!origins.includes('*')&&!origins.includes(origin))return json({error:'This request must come from this website.'},403);
    if(path==='/api/studio/login'){
      if(request.method!=='POST')return json({error:'Method not allowed.'},405);
      if(!env.STUDIO_PASSWORD)return json({error:'Studio password is not configured. Contact the owner.'},503);
      const body=await bodyOf(request,['password']);if(typeof body.password!=='string'||body.password.length>512)return json({error:'Enter the studio password.'},400);
      const address=request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0].trim()||'unavailable-ip';
      const key=`attempts/${base64(await hash(address))}.json`;
      return inTurn(key,async()=>{
        const attempts=await read(bucket,key),current=attempts&&attempts.windowStart+15*60*1000>time?attempts:null;
        if(current&&current.attempts>=10)return json({error:'Too many password attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
        if(!equal(await hash(body.password),await hash(env.STUDIO_PASSWORD))){await write(bucket,key,current?{...current,attempts:current.attempts+1}:{windowStart:time,attempts:1});return json({error:'Incorrect password. Please try again.'},401);}
        if(attempts)await bucket.delete(key);return json({token:await token(env.STUDIO_PASSWORD,time)});
      });
    }
    if(studio){
      if(!await authorized(request,env,time))return json({error:'Enter the studio password again to continue.'},401);
      if(path==='/api/studio/draft'){
        if(request.method==='GET'){const draft=await read(bucket,DRAFT_KEY);return json({content:draft?draft.content:{plan:defaultPlan,texts:{}},revision:draft?.revision||0,finished:false,canEdit:true});}
        if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
        const body=await bodyOf(request,['content','revision']),content=checkedContent(body);
        return inTurn(DRAFT_KEY,async()=>{
          const draft=await read(bucket,DRAFT_KEY);
          if((draft?.revision||0)!==body.revision)return json({error:'The studio changed in another tab. Reload before saving; your edits are kept here.'},409);
          await write(bucket,DRAFT_KEY,{content,revision:body.revision+1});return json({revision:body.revision+1,finished:false,canEdit:true});
        });
      }
      if(path==='/api/studio/links'&&request.method==='POST'){
        const body=await bodyOf(request,['revision']),draft=await read(bucket,DRAFT_KEY);
        if(!draft||!Number.isInteger(body.revision)||body.revision!==draft.revision)return json({error:'Save the current invitation successfully before generating a link.'},409);
        for(let retry=0;retry<8;retry++){const id=randomID();if(!ID_PATTERN.test(id))throw new Error('Invalid generated ID');
          const made=await inTurn(id,async()=>{if(await bucket.head(shareKey(id)))return false;await write(bucket,shareKey(id),newLink(draft.content,time));return true;});
          if(made)return json({id,url:`${origin||(origins.includes('*')?url.origin:origins[0])}/?share=${id}`,createdAt:time,editingDeadline:time+FIVE_DAYS},201);}
        throw new Error('ID collision retry limit');
      }
      return json({error:'Not found.'},404);
    }
    const [,id,action]=linkMatch;if(!ID_PATTERN.test(id))return json({error:'This invitation link is unavailable.'},404);
    return await inTurn(id,async()=>{
      const at=now();
      // The store, right after a link is sold: make it at its id, never touching
      // one that exists. With SHARE_CREATE_SECRET the store proves itself by its
      // x-halloween-create-secret; without, the orders server is asked whether this id was bought.
      if(action==='/ensure'){
        if(request.method!=='POST')return json({error:'Method not allowed.'},405);
        if(await bucket.head(shareKey(id)))return json({ok:true,existed:true});
        const trusted=!!env.SHARE_CREATE_SECRET&&equal(await hash(request.headers.get('x-halloween-create-secret')||''),await hash(env.SHARE_CREATE_SECRET));
        if(!trusted&&(await askStore(id,env)).valid!==true)return json({error:'Forbidden.'},403);
        await write(bucket,shareKey(id),newLink(starterContent(at),at));return json({ok:true,existed:false},201);
      }
      let record=await read(bucket,shareKey(id));
      // A sold link opened before the store's call arrived is made on opening.
      if(!record&&request.method==='GET'&&!action&&(await askStore(id,env)).valid===true){record=newLink(starterContent(at),at);await write(bucket,shareKey(id),record);console.log(`Made ${id} on opening (the store sold it, it wasn't made yet)`);}
      if(!record)return json({error:'This invitation link is unavailable.'},404);
      if(request.method==='GET'&&!action){
        // The first visit: the five days start now.
        if(record.editingDeadline==null&&!record.finalized&&at-record.createdAt>FIRST_VISIT_GRACE){record={...record,editingDeadline:at+FIVE_DAYS};await write(bucket,shareKey(id),record);}
        return json(linkState(record,at));
      }
      const finish=action==='/finish';
      if(!(request.method==='PUT'&&!action)&&!(request.method==='POST'&&finish))return json({error:'Method not allowed.'},405);
      if(!canEdit(record,at))return closed(record,at);
      const body=await bodyOf(request,['content','revision']),content=checkedContent(body);
      if(body.revision!==record.revision)return json({error:'This invitation changed in another tab. Reload before saving; your edits are kept here.'},409);
      record={...record,content,revision:record.revision+1,finalized:finish};await write(bucket,shareKey(id),record);
      return json({revision:record.revision,finished:finish,editingDeadline:shownDeadline(record,at),canEdit:canEdit(record,at)});
    });
  }catch(error){if(error.status)return json({error:error.message},error.status);console.error('Invitation request failed:',path,error.message);return json({error:'Connection error. The invitation could not be loaded or saved. Please try again.'},503);}
}};}
export default createApi();
