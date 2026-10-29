import {defaultPlan,formatPlan} from './plan-core.js';
import {createPlanPNG,sharePlanPNG,downloadFile,smsLink,calendarTiming,calendarFile} from './plan-actions.js';
import {ModeRepository,selectMode} from './mode-repository.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class InlineEditor {
  constructor({app,show,getScene,pause,repository=new ModeRepository(selectMode(location.search)),start=()=>{},onIssue=()=>{}}){Object.assign(this,{app,show,getScene,pause,repository,start,onIssue});this.content={plan:{...defaultPlan},texts:{}};this.revision=0;this.editing=false;this.dirty=false;this.change=0;this.file=null;this.fileKey='';this.imageRun=0;this.loading=true;this.toolbar=document.querySelector('#editor-toolbar');this.toggle=document.querySelector('#edit-toggle');
    this.toggle.addEventListener('click',()=>this.enable());this.toolbar.addEventListener('click',e=>this.command(e.target.closest('[data-editor-command]')?.dataset.editorCommand));
    document.addEventListener('input',e=>this.input(e));document.addEventListener('paste',e=>this.paste(e));
    window.addEventListener('beforeunload',e=>{if(this.dirty){e.preventDefault();e.returnValue='';}});
    this.deadlineTimer=setInterval(()=>this.checkDeadline(),1000);window.addEventListener('pagehide',()=>{this.repository.clearAccess();clearInterval(this.deadlineTimer);});
  }
  async load(){this.loading=true;this.unavailable=false;try{const data=await this.repository.load();this.content=data.content;this.revision=data.revision;this.canEdit=data.canEdit;this.finished=data.finished;this.editingDeadline=data.editingDeadline;this.toggle.hidden=!this.canEdit;this.loading=false;this.dirty=false;this.file=null;this.imageRun++;this.preparingKey=null;document.querySelector('#plan-load-status').textContent='';this.start(this.repository.mode.kind);this.decorate();this.modeStatus();return true;}catch(error){this.unavailable=true;this.canEdit=false;this.toggle.hidden=true;this.onIssue(error);this.actions();return false;}}
  enable(){this.checkDeadline();if(!this.canEdit||this.finished||this.loading)return;this.editing=true;this.toggle.hidden=true;this.toolbar.hidden=false;this.pause();this.commands();this.decorate();}
  commands(message=this.dirty?'Unsaved changes':'Editing inline'){this.toolbar.innerHTML=`<div class="editor-commands"><button type="button" data-editor-command="save">Save</button><button type="button" data-editor-command="previous">Previous screen</button><button type="button" data-editor-command="next">Next screen</button>${this.repository.mode.kind!=='studio'?'<button type="button" data-editor-command="finish">Finish Editing Permanently</button>':''}</div><span class="editor-status" role="status">${escape(message)}</span>`;}
  decorate(){
    const scene=this.getScene();this.bind(document.querySelector('.masthead'),'global',0);this.bind(document.querySelector('.site-footer'),'global',100);this.bind(this.app,scene,0);
    document.querySelector('.edition').textContent=this.content.plan.date.toUpperCase();
    for(const element of document.querySelectorAll('[data-plan-field]'))element.textContent=this.content.plan[element.dataset.planField];
    for(const element of document.querySelectorAll('[data-inline-key],[data-plan-field]')){element.contentEditable=this.editing?'plaintext-only':'false';element.classList.toggle('inline-editable',this.editing);if(this.editing){element.setAttribute('role','textbox');element.setAttribute('aria-label',`Edit ${element.dataset.planField||'text'}`);}else{element.removeAttribute('role');element.removeAttribute('aria-label');}}
    if(this.editing)this.pause();this.actions();
  }
  bind(root,prefix,start){let index=start;const nodes=[];const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){
    const parent=text.parentElement;if(!text.textContent.trim()||!parent||parent.closest('svg,[aria-hidden="true"],.sr-only,.story-count,.game-hud,.heart-toast,.controls-note,.plan-actions,.editor-toolbar,#edit-toggle,#sound-toggle,#generate-link,#reset-demo,#mode-label,#plan-load-status,#progress,.art-credit,.edition,[data-plan-field]'))continue;
    if(!parent.closest('h1,p,blockquote,dt,dd,.button-label,.brand,.site-footer>span'))continue;
    if(parent.closest('[data-inline-key]'))continue;nodes.push(text);
  }
    for(const node of nodes){const span=document.createElement('span');span.dataset.inlineKey=`${prefix}:${index++}`;span.textContent=this.content.texts[span.dataset.inlineKey]??node.textContent;node.replaceWith(span);}
    for(const element of root.querySelectorAll('[data-inline-key]')){const saved=this.content.texts[element.dataset.inlineKey];if(saved!==undefined)element.textContent=saved;}
  }
  input(event){if(!this.editing||this.finishing)return;const element=event.target.closest('[data-inline-key],[data-plan-field]');if(!element)return;
    if(element.textContent.length>600){element.textContent=element.textContent.slice(0,600);this.status('Keep each text under 600 characters.');}
    if(element.dataset.planField)this.content.plan[element.dataset.planField]=element.textContent.trim();else this.content.texts[element.dataset.inlineKey]=element.textContent;
    if(this.getScene()==='details'&&element.closest('h1'))this.content.plan.title=this.app.querySelector('h1').textContent.trim();
    this.dirty=true;this.change++;this.status('Unsaved changes');this.file=null;this.imageRun++;this.preparingKey=null;this.actions();
  }
  paste(event){if(!this.editing||!event.target.closest('[data-inline-key],[data-plan-field]'))return;event.preventDefault();const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const text=document.createTextNode(event.clipboardData.getData('text/plain').slice(0,600));range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);event.target.dispatchEvent(new Event('input',{bubbles:true}));}
  status(text){const status=this.toolbar.hidden?document.querySelector('#plan-load-status'):this.toolbar.querySelector('.editor-status');if(status)status.textContent=text;}
  modeStatus(){const label=document.querySelector('#mode-label');if(!label)return;const kind=this.repository.mode.kind;label.textContent=kind==='studio'?'Private studio':kind==='test'?'Test mode · local demo':this.finished?'Editing permanently finished':this.canEdit?`Editing until ${new Date(this.editingDeadline).toLocaleString()}`:'Editing window closed';}
  checkDeadline(){if(this.repository.mode.kind!=='invitation'||!this.editingDeadline||Date.now()<this.editingDeadline||!this.canEdit)return;this.canEdit=false;this.editing=false;this.toggle.hidden=true;this.toolbar.hidden=true;this.decorate();this.modeStatus();this.status(this.dirty?'Editing window closed. Changes were not saved. Reload to view the saved invitation.':'Editing window closed. Viewing remains available.');}
  command(command){if(!command||this.busy)return;
    if(command==='save')return this.save(false);
    if(command==='finish'&&this.repository.mode.kind!=='studio'){this.toolbar.innerHTML='<p class="finish-question">Permanently finish editing? The current changes will be saved. Editing cannot be restored afterward.</p><div class="editor-commands"><button type="button" data-editor-command="confirm">Yes, finish permanently</button><button type="button" data-editor-command="cancel">No, keep editing</button></div><span class="editor-status" role="status"></span>';return;}
    if(command==='cancel')return this.commands();if(command==='confirm')return this.save(true);
    const screens=['loading','quest','game','heartFound','invitation','confirmed','details','finale','decline','declined'];const index=screens.indexOf(this.getScene());this.show(screens[Math.max(0,Math.min(screens.length-1,index+(command==='previous'?-1:1)))]);
  }
  async save(finish){this.checkDeadline();if(this.busy||!this.canEdit||this.loading)return false;this.busy=true;this.finishing=finish;this.status(finish?'Finishing permanently…':'Saving…');this.toolbar.querySelectorAll('button').forEach(b=>b.disabled=true);
    if(finish)document.querySelectorAll('[contenteditable]').forEach(e=>e.contentEditable='false');
    const change=this.change;
    try{const data=await this.repository.save(this.content,this.revision,finish);this.revision=data.revision;this.dirty=this.change!==change;this.finished=data.finished;this.canEdit=data.canEdit;this.editingDeadline=data.editingDeadline;
      if(!this.dirty||finish){this.editing=false;this.toolbar.hidden=true;this.toggle.hidden=!this.canEdit;this.show(this.getScene());this.decorate();}
      this.modeStatus();this.status(finish?'Editing permanently finished.':this.dirty?'Saved. New changes are unsaved.':'Saved — previewing your invitation.');this.actions();return !this.dirty;
    }catch(error){if(error.status===423){this.finished=!!error.data.finished;this.canEdit=false;this.editing=false;this.editingDeadline=error.data.editingDeadline;this.toggle.hidden=true;this.toolbar.hidden=true;this.decorate();this.modeStatus();}this.status(`Failed — ${error.message}`);if(error.status===401)this.onIssue(error);return false;}finally{this.busy=false;this.finishing=false;this.toolbar.querySelectorAll('button').forEach(b=>b.disabled=false);if(finish&&this.editing)this.decorate();}
  }
  actions(){const region=this.app.querySelector('.plan-actions');if(!region)return;const disabled=this.loading||this.unavailable||this.dirty;region.querySelector('[data-plan-action="sms"]').href=smsLink(this.content.plan,navigator);region.querySelector('[data-plan-action="sms"]').setAttribute('aria-disabled',String(disabled));
    const blockedMessage=this.unavailable?'Saved plan unavailable. Reload before sharing.':this.loading?'Loading saved plan…':'Save changes before using the plan actions.';
    const timing=calendarTiming(this.content.plan);region.querySelector('[data-plan-action="calendar"]').disabled=disabled||!timing.valid;region.querySelector('.calendar-status').textContent=disabled?blockedMessage:timing.valid?'':timing.reason;
    const key=JSON.stringify(this.content.plan);const button=region.querySelector('[data-plan-action="image"]');button.disabled=true;
    if(disabled){this.imageStatus(blockedMessage);return;}
    if(this.file&&this.fileKey===key){button.disabled=false;this.imageStatus('Ready — image can be shared or downloaded.');return;}
    if(this.preparingKey===key)return;
    this.preparingKey=key;const run=++this.imageRun;this.imageStatus('Creating image…');
    createPlanPNG({...this.content.plan}).then(file=>{if(run!==this.imageRun||key!==JSON.stringify(this.content.plan))return;this.file=file;this.fileKey=key;this.preparingKey=null;this.imageStatus('Ready — image can be shared or downloaded.');const current=this.app.querySelector('[data-plan-action="image"]');if(current){current.disabled=this.dirty;current.textContent='Create and share image';}}).catch(error=>{if(run!==this.imageRun)return;this.preparingKey=null;this.imageStatus(`Failed — ${error.message}`);const current=this.app.querySelector('[data-plan-action="image"]');if(current){current.disabled=false;current.textContent='Retry creating image';}});
  }
  imageStatus(message){const status=this.app.querySelector('.image-status');if(status)status.textContent=message;}
  planAction(action,event){if(this.loading||this.dirty||this.unavailable){event?.preventDefault();return;}
    if(action==='sms')return;
    if(action==='calendar'){try{const data=calendarFile(this.content.plan);downloadFile(new File([data],'our-halloween-plan.ics',{type:'text/calendar;charset=utf-8'})).catch(error=>{this.app.querySelector('.calendar-status').textContent=`Failed — ${error.message}`;});}catch(error){this.app.querySelector('.calendar-status').textContent=error.message;}return;}
    if(action==='image'){if(!this.file){this.actions();return;}const button=this.app.querySelector('[data-plan-action="image"]');button.disabled=true;this.imageStatus('Ready — opening sharing…');sharePlanPNG(this.file,{...this.content.plan}).then(message=>this.imageStatus(message)).catch(error=>this.imageStatus(`Failed — ${error.message}`)).finally(()=>{if(button.isConnected)button.disabled=false;});}
  }
  planRows(){const p=this.content.plan;return [['mask','ACTIVITY','activity'],['calendar','DATE','date'],['clock','TIME','startTime'],['clock','END TIME','endTime'],['pin','PLACE','location'],['mask','DRESS CODE','dressCode'],['gift','MESSAGE','message']].map(([icon,label,key])=>[icon,label,`<span data-plan-field="${key}">${escape(p[key])}</span>${key==='startTime'?`<small class="plan-timezone" data-plan-field="timezone">${escape(p.timezone)}</small>`:''}`]);}
  actionMarkup(){return '<div class="plan-actions" aria-label="Share the confirmed plan"><button type="button" data-plan-action="image">Create and share image</button><a data-plan-action="sms" href="sms:">Send by message</a><button type="button" data-plan-action="calendar" disabled>Save to calendar</button><p class="image-status" role="status"></p><p class="calendar-status" role="status"></p></div>';}
}
