import {defaultPlan,cleanContent} from './plan-core.js';
import {API_BASE} from './config.js';
export const DEMO_KEY='sent4u-halloween:demo:v1';
export const validShareID=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{16,64}$/.test(id);
export function selectMode(search){const parameters=new URLSearchParams(search);if(!parameters.has('share'))return {kind:'studio'};const shares=parameters.getAll('share');if(shares.length!==1)return {kind:'unavailable'};const id=shares[0];return (id==='test'||id==='test-halloween')?{kind:'test'}:validShareID(id)?{kind:'invitation',id}:{kind:'unavailable'};}
export function sampleContent(now=new Date()){let year=now.getFullYear();if(now.getMonth()>9||(now.getMonth()===9&&now.getDate()===31&&now.getHours()>=20))year++;return {plan:{...defaultPlan,date:`October 31, ${year}`,location:'Moonlight Park',message:'Bring your favorite candy — this is a demonstration ♡'},texts:{}};}
export class RequestError extends Error{constructor(message,status=0,data={}){super(message);this.status=status;this.data=data;}}
export class ModeRepository{
  constructor(mode,{fetcher=(...args)=>fetch(...args),storage=()=>localStorage,patience={}}={}){this.mode=mode;this.fetcher=fetcher;this.storage=storage;this.token=null;this.patience={attemptMs:50000,totalMs:150000,...patience};}
  clearAccess(){this.token=null;}
  // The server sleeps when nobody has used it for a while and needs up to a minute to wake (more if it must wake
  // the shop too). A patient request keeps at it for up to 2½ minutes: each try may take 50 s, and a try that is cut
  // off or meets a server error (5xx, 408, 429) is made again.
  async request(path,{method='GET',body,patient=false}={}){let response;const started=Date.now();
    for(let attempt=0;;attempt++){const controller=patient?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),this.patience.attemptMs):0;
      try{response=await this.fetcher(API_BASE+path,{method,cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(this.token?{Authorization:`Bearer ${this.token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),...(controller?{signal:controller.signal}:{})});
        if(!patient||!(response.status>=500||response.status===408||response.status===429)||Date.now()-started>=this.patience.totalMs)break;}
      catch{if(!patient||Date.now()-started>=this.patience.totalMs)throw new RequestError('Connection error. Please check your connection and try again.');}
      finally{clearTimeout(timer);}
      await new Promise(resolve=>setTimeout(resolve,Math.min(1000*2**attempt,8000)));}
    let data;try{data=await response.json();}catch{throw new RequestError('Connection error. The server response could not be read.',response.status);}
    if(!response.ok)throw new RequestError(data.error||'The invitation could not be loaded.',response.status,data);return data;
  }
  async login(password){if(this.mode.kind!=='studio')throw new Error('This is not the studio.');const data=await this.request('/api/studio/login',{method:'POST',body:{password}});this.token=data.token;}
  async load(){
    if(this.mode.kind==='test'){const raw=this.storage().getItem(DEMO_KEY);if(raw){try{const data=JSON.parse(raw);return {content:cleanContent(data.content),revision:Number.isInteger(data.revision)?data.revision:0,finished:!!data.finished,canEdit:!data.finished};}catch{this.storage().removeItem(DEMO_KEY);}}return {content:sampleContent(),revision:0,finished:false,canEdit:true};}
    if(this.mode.kind==='studio')return this.request('/api/studio/draft',{patient:true});
    if(this.mode.kind==='invitation')return this.request(`/api/invitations/${this.mode.id}`,{patient:true});
    throw new RequestError('This invitation link is unavailable.',404);
  }
  async save(content,revision,finish=false){content=cleanContent(content);
    if(this.mode.kind==='test'){const current=await this.load();if(current.finished)throw new RequestError('Demo editing has finished. Reset the demonstration to start again.',423);if(current.revision!==revision)throw new RequestError('The demonstration changed in another tab. Reload before saving.',409);const data={content,revision:revision+1,finished:finish,canEdit:!finish};this.storage().setItem(DEMO_KEY,JSON.stringify(data));return data;}
    if(this.mode.kind==='studio'){if(finish)throw new RequestError('Finish editing on an invitation link; the studio stays available.',400);return this.request('/api/studio/draft',{method:'PUT',body:{content,revision}});}
    if(this.mode.kind==='invitation')return this.request(`/api/invitations/${this.mode.id}${finish?'/finish':''}`,{method:finish?'POST':'PUT',body:{content,revision}});
    throw new RequestError('This invitation link is unavailable.',404);
  }
  async createLink(revision){if(this.mode.kind!=='studio')throw new RequestError('Only the studio can generate invitation links.',403);return this.request('/api/studio/links',{method:'POST',body:{revision}});}
  reset(){if(this.mode.kind!=='test')throw new Error('Only the demonstration can be reset.');this.storage().removeItem(DEMO_KEY);return this.load();}
}
