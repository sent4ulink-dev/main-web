import test from 'node:test';import assert from 'node:assert/strict';
import {defaultPlan,formatPlan,smsLink,calendarTiming,calendarFile,parseDate} from '../site/plan-core.js';
import {createPlanPNG,sharePlanPNG} from '../site/plan-actions.js';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import fs from 'node:fs';
const plan={...defaultPlan,title:'Our moonlit picnic ♡',activity:'Picnic & candy hunt',date:'October 31, 2030',startTime:'8:15 PM',endTime:'10:45 PM',location:'Purple hill, by the trees',message:'Bring cocoa; I can’t wait!\nLove, Boo ♡'};
test('PNG uses fixed 1080×1920 artwork and draws the current confirmed plan',async()=>{
  const drawn=[];const ctx={font:'',measureText:s=>({width:s.length*20}),drawImage(...args){drawn.push(['image',...args]);},fillRect(){},beginPath(){},roundRect(){},fill(){},fillText(text){drawn.push(['text',text]);}};
  const canvas={getContext:()=>ctx,toBlob(fn,type){assert.equal(type,'image/png');fn(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type}));}};
  const file=await createPlanPNG(plan,{makeCanvas:()=>canvas,getImage:async src=>({src,width:1536,height:1024})});
  assert.equal(canvas.width,1080);assert.equal(canvas.height,1920);assert(file instanceof File);assert.equal(file.type,'image/png');assert.equal(file.name,'our-halloween-plan.png');
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[137,80,78,71,13,10,26,10]);
  const text=drawn.filter(v=>v[0]==='text').map(v=>v[1]).join('\n');for(const value of [plan.title,plan.activity,plan.date,plan.startTime,plan.endTime,plan.timezone,plan.location,...plan.message.split('\n')])assert(text.includes(value));
  assert(!/Save|Previous screen|Creating|Permanently finish/.test(text));assert(drawn.some(v=>v[0]==='image'&&v[1].src.endsWith('cartoon-night.webp')));
});
test('native share receives a real PNG File; unsupported browsers download; cancellation is distinct',async()=>{
  const file=new File([new Uint8Array([137,80,78,71])],'plan.png',{type:'image/png'});let shared,downloads=0;
  const nav={canShare:({files})=>files[0]===file,share:async data=>{shared=data;}};
  assert.match(await sharePlanPNG(file,plan,{nav,download:()=>downloads++}),/^Ready/);assert.equal(shared.files[0],file);assert.equal(shared.text,formatPlan(plan));assert.equal(downloads,0);
  await sharePlanPNG(file,plan,{nav:{canShare:()=>false},download:()=>downloads++});assert.equal(downloads,1);
  const cancelled=await sharePlanPNG(file,plan,{nav:{canShare:()=>true,share:()=>Promise.reject(new DOMException('Dismissed','AbortError'))},download:()=>downloads++});assert.match(cancelled,/^Cancelled/);assert.equal(downloads,1);
  await assert.rejects(sharePlanPNG(file,plan,{nav:{canShare:()=>true,share:()=>Promise.reject(new Error('Denied'))}}),/Denied/);
});
test('full artwork exports an encoded PNG at exactly 1080×1920',async()=>{
  const canvas=createCanvas(1080,1920);const file=await createPlanPNG(plan,{makeCanvas:()=>({set width(v){canvas.width=v;},set height(v){canvas.height=v;},getContext:()=>canvas.getContext('2d'),toBlob(callback){callback(new Blob([canvas.toBuffer('image/png')],{type:'image/png'}));}}),getImage:src=>loadImage('site/'+src)});
  const bytes=Buffer.from(await file.arrayBuffer());assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1920);assert(bytes.length>10000);
  fs.mkdirSync('.qa',{recursive:true});fs.writeFileSync('.qa/plan-export.png',bytes);
});
test('iOS, iPad desktop UA, and Android SMS links include the exact formatted plan',()=>{
  for(const nav of [{userAgent:'iPhone'},{userAgent:'iPad'},{platform:'MacIntel',maxTouchPoints:5}])assert.equal(decodeURIComponent(smsLink(plan,nav).split('&body=')[1]),formatPlan(plan));
  assert.equal(decodeURIComponent(smsLink(plan,{userAgent:'Android'}).split('?body=')[1]),formatPlan(plan));assert(smsLink(plan,{}).startsWith('sms:'));assert(!smsLink(plan,{}).includes('undefined'));
});
test('calendar has matching details, UTC times for the shown local zone, escaped UTF-8 folded lines',()=>{
  const ics=calendarFile(plan,new Date('2026-01-01T00:00:00Z'),'test-uid');const unfolded=ics.replace(/\r\n /g,'');
  assert(unfolded.includes('DTSTART:20301031T121500Z'));assert(unfolded.includes('DTEND:20301031T144500Z'));
  assert(unfolded.includes('SUMMARY:'+plan.title));assert(unfolded.includes('LOCATION:Purple hill\\, by the trees'));assert(unfolded.includes('Activity: Picnic & candy hunt'));assert(unfolded.includes('Bring cocoa\\; I can’t wait!\\nLove\\, Boo ♡'));
  assert(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));assert(ics.endsWith('END:VCALENDAR\r\n'));for(const line of ics.split('\r\n'))assert(new TextEncoder().encode(line).length<=75);
});
test('calendar rejects past, missing-year, invalid dates, backwards end times and nonexistent DST times',()=>{
  assert.equal(parseDate('February 30, 2030'),null);assert.equal(calendarTiming({...plan,date:'October 31'}).valid,false);
  assert.equal(calendarTiming({...plan,date:'January 1, 2020'}).valid,false);assert.equal(calendarTiming({...plan,endTime:'7:00 PM'}).valid,false);
  assert.equal(calendarTiming({...plan,date:'March 10, 2030',startTime:'2:30 AM',endTime:'4:00 AM',timezone:'America/New_York'}).valid,false);
  assert.throws(()=>calendarFile({...plan,startTime:'not a time'}),/valid/);
});
