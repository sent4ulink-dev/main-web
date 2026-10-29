import {formatPlan,smsLink,calendarTiming,calendarFile} from './plan-core.js';
export {smsLink,calendarTiming,calendarFile};
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The image artwork could not load. Please try again.'));image.src=src;});}
function linesFor(ctx,text,width){const lines=[];let line='';for(const paragraph of String(text).split('\n')){for(const word of paragraph.split(/\s+/)){if(!word)continue;if(ctx.measureText(word).width>width){if(line){lines.push(line);line='';}let part='';for(const char of word){if(ctx.measureText(part+char).width>width){lines.push(part);part='';}part+=char;}line=part;}else if(line&&ctx.measureText(line+' '+word).width>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);line='';}return lines;}
function textBlock(ctx,text,x,y,width,height,size,color='#fff7e8',weight=600){let lines,lineHeight;do{ctx.font=`${weight} ${size}px "Trebuchet MS", "Segoe UI Symbol", "Apple Symbols", sans-serif`;lines=linesFor(ctx,text,width);lineHeight=size*1.28;if(lines.length*lineHeight<=height)break;size-=2;}while(size>=12);ctx.fillStyle=color;ctx.textBaseline='top';for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineHeight);}
export async function createPlanPNG(plan,{makeCanvas=()=>document.createElement('canvas'),getImage=loadImage,FileClass=File}={}) {
  const [background,ghost]=await Promise.all([getImage('./assets/cartoon-night.webp'),getImage('./assets/heart-ghost.png')]);
  const canvas=makeCanvas();canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image creation is unavailable in this browser.');
  const scale=Math.max(1080/background.width,1920/background.height),w=background.width*scale,h=background.height*scale;
  ctx.drawImage(background,(1080-w)/2,(1920-h)/2,w,h);ctx.fillStyle='#382052bb';ctx.fillRect(0,0,1080,1920);
  ctx.fillStyle='#513077eb';ctx.beginPath();ctx.roundRect(64,400,952,1370,56);ctx.fill();
  textBlock(ctx,plan.title,88,140,904,230,76,'#ffd39e',800);
  const rows=[['ACTIVITY',plan.activity],['DATE',plan.date],['TIME',`${plan.startTime} – ${plan.endTime}\n${plan.timezone}`],['PLACE',plan.location],['DRESS CODE',plan.dressCode]];
  rows.forEach(([label,text],i)=>{const y=450+i*184;textBlock(ctx,label,112,y,856,42,26,'#ffb5d7',800);textBlock(ctx,text,112,y+45,856,128,42);});
  textBlock(ctx,plan.message,112,1415,856,250,44,'#fff7e8');
  ctx.drawImage(ghost,826,1764,160,160);textBlock(ctx,'A little spooky. A little sweet.',88,1814,704,70,30,'#ffd39e',700);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The PNG could not be created.')),'image/png'));
  if(blob.type!=='image/png')throw new Error('The browser did not create a PNG.');
  return new FileClass([blob],'our-halloween-plan.png',{type:'image/png'});
}
// Inline data downloads do not create or upload a temporary image URL.
export async function downloadFile(file){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The download could not be prepared.'));reader.readAsDataURL(file);});const link=document.createElement('a');link.href=data;link.download=file.name;document.body.append(link);link.click();link.remove();}
export async function sharePlanPNG(file,plan,{nav=navigator,download=downloadFile}={}) {
  try{if(nav.share&&nav.canShare?.({files:[file]})){await nav.share({files:[file],title:plan.title,text:formatPlan(plan)});return 'Ready — image shared.';}await download(file);return 'Ready — PNG downloaded.';}
  catch(error){if(error.name==='AbortError')return 'Cancelled — your image is still ready.';throw error;}
}
