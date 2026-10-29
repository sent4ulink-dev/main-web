export const defaultPlan = Object.freeze({title:'Our Halloween date.',activity:'Halloween date',date:'October 31, 2026',startTime:'8:00 PM',endTime:'10:00 PM',timezone:'Asia/Ulaanbaatar',location:'To be decided ♡',dressCode:'Something spooky',message:'Good company, fun & maybe candy ♡'});
export function cleanContent(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid invitation content.');
  const plan={};for(const key of Object.keys(defaultPlan)){if(typeof value.plan?.[key]!=='string'||value.plan[key].length>600)throw new Error('Keep plan details under 600 characters.');plan[key]=value.plan[key].trim();}
  const texts={};for(const [key,text] of Object.entries(value.texts||{})){if(!/^(global|[a-zA-Z]+):\d+$/.test(key)||typeof text!=='string'||text.length>600)throw new Error('Invalid edited text.');texts[key]=text;}
  if(Object.keys(texts).length>250)throw new Error('Too much invitation content.');
  return {plan,texts};
}
export function formatPlan(plan) {return `${plan.title}\n\nActivity: ${plan.activity}\nDate: ${plan.date}\nTime: ${plan.startTime} – ${plan.endTime} (${plan.timezone})\nPlace: ${plan.location}\nDress code: ${plan.dressCode}\n\n${plan.message}`;}
export function smsLink(plan,nav={}) {
  const ios=/iPhone|iPad|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
  return `sms:${ios?'&':'?'}body=${encodeURIComponent(formatPlan(plan))}`;
}
export function parseDate(text) {
  let match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());let y,m,d;
  if(match){[,y,m,d]=match;y=+y;m=+m;d=+d;}else{
    match=/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text.trim());if(!match)return null;
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'];m=months.indexOf(match[1].toLowerCase())+1;d=+match[2];y=+match[3];
  }
  const date=new Date(Date.UTC(y,m-1,d));return y>=1970&&y<=9999&&m>=1&&m<=12&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?{y,m,d}:null;
}
export function parseTime(text) {
  const m=/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text.trim());if(!m)return null;
  let h=+m[1];const minute=+m[2];if(minute>59)return null;
  if(m[3]){if(h<1||h>12)return null;h=h%12+(m[3].toUpperCase()==='PM'?12:0);}else if(h>23)return null;
  return {h,minute};
}
function zonedDate(date,time,zone) {
  const intended=Date.UTC(date.y,date.m-1,date.d,time.h,time.minute);let stamp=intended;
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const wall=n=>{const p=Object.fromEntries(formatter.formatToParts(n).map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);};
  for(let i=0;i<4;i++){const offset=wall(stamp)-intended;if(!offset)return new Date(stamp);stamp-=offset;}
  return wall(stamp)===intended?new Date(stamp):null;
}
export function calendarTiming(plan,now=new Date()) {
  try{const date=parseDate(plan.date),startTime=parseTime(plan.startTime),endTime=parseTime(plan.endTime);if(!date||!startTime||!endTime||!plan.title.trim()||!plan.activity.trim())return {valid:false,reason:'Use a full date (October 31, 2026) and valid start and end times.'};
    const start=zonedDate(date,startTime,plan.timezone),end=zonedDate(date,endTime,plan.timezone);
    if(!start||!end)return {valid:false,reason:'That local time does not exist. Choose another time.'};
    if(end<=start)return {valid:false,reason:'End time must be after start time on the same date.'};
    if(start<=now)return {valid:false,reason:'Choose a future date and start time to save to calendar.'};
    return {valid:true,start,end};
  }catch{return {valid:false,reason:'Use a valid time zone, such as Asia/Ulaanbaatar.'};}
}
const escapeICS=text=>String(text).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldLine(line){let result='',length=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(length+size>75){result+='\r\n ';length=1;}result+=char;length+=size;}return result;}
const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarFile(plan,now=new Date(),uid=globalThis.crypto.randomUUID()) {
  const timing=calendarTiming(plan,now);if(!timing.valid)throw new Error(timing.reason);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//A Little Spooky//Confirmed Plan//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${uid}@halloween-date`, `DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(timing.start)}`,`DTEND:${stamp(timing.end)}`,`SUMMARY:${escapeICS(plan.title)}`,`LOCATION:${escapeICS(plan.location)}`,`DESCRIPTION:${escapeICS(formatPlan(plan))}`,'END:VEVENT','END:VCALENDAR'].map(foldLine).join('\r\n')+'\r\n';
}
