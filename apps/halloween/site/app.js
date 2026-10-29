import {InlineEditor} from './inline-editor.js';
import {ModeRepository,selectMode} from './mode-repository.js';
import {URLModesUI} from './url-modes.js';
const app = document.querySelector('#app');
const ghost = `<g class="ghost-float"><path d="M214 225c0-21 12-34 29-34s29 13 29 34c0 17 3 28 10 37 4 6-3 11-11 7-3 10-13 11-20 5-7 7-17 5-20 0-10 7-21 2-18-6-11 2-15-4-9-10 7-9 10-19 10-33Z" fill="#fff0db"/>
<g class="ghost-eyes">
  <g class="ghost-expression ghost-star-eyes" fill="#ffd65e" stroke="#a36535" stroke-width=".6"><text x="235" y="232" text-anchor="middle" font-family="Arial,sans-serif" font-size="16">★</text><text x="251" y="232" text-anchor="middle" font-family="Arial,sans-serif" font-size="16">★</text></g>
  <g class="ghost-expression ghost-heart-eyes" fill="#ff7fb6" stroke="#9d416b" stroke-width="1.8"><g transform="translate(228 221) scale(.43)"><path d="M16 28C-9 11 1-6 16 6 31-6 41 11 16 28Z"/></g><g transform="translate(244 221) scale(.43)"><path d="M16 28C-9 11 1-6 16 6 31-6 41 11 16 28Z"/></g></g>
  <g class="ghost-expression ghost-shy-eyes" fill="none" stroke="#38213d" stroke-width="2.4" stroke-linecap="round"><path d="M231 229q4-6 8 0m8 0q4-6 8 0"/></g>
</g><path class="ghost-smile" d="M239 240q5 7 10 0" fill="none" stroke="#38213d" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="227" cy="239" rx="4.5" ry="3" fill="#edb8a2"/><ellipse cx="259" cy="239" rx="4.5" ry="3" fill="#edb8a2"/></g>`;
const cat = `<g class="sourced-cat"><image class="asset-motion" href="./assets/video-cat.webp" x="125" y="162" width="100" height="116" preserveAspectRatio="xMidYMax meet"/><image class="asset-still" href="./assets/video-cat-still.png" x="125" y="162" width="100" height="116" preserveAspectRatio="xMidYMax meet"/></g>`;
const bat = `<path d="M-25 0Q-14-14-6-3l3-5 3 4 3-4 3 5Q14-14 25 0Q12-3 11 9Q4 4 0 13Q-4 4-11 9Q-12-3-25 0Z" fill="#221520"/>`;
function art(){return `<div class="scene-art" aria-hidden="true"><svg viewBox="0 0 400 300"><circle class="moon-haze" cx="202" cy="153" r="147"/><circle class="moon-haze" cx="202" cy="153" r="135"/><circle class="moon-disc" cx="202" cy="153" r="116"/><path class="moon-mark" d="M126 113q28-58 67-53l-14 24 23 16-25 22-19-5-4 23-29 7Zm102-32 35 5 21 32-28 10-31-21Zm-55 68 35-13 17 24-17 21-36-9Zm65 29 27-30 31 8 2 42-24 29-29-7Z"/><g class="moon-bat" transform="translate(113 105) rotate(-12) scale(.68)">${bat}</g><g class="moon-bat" transform="translate(301 146) rotate(12) scale(.43)">${bat}</g><path d="M38 287q72-35 156-11 102-23 170 12v12H38Z" fill="#1a121d"/><path d="m75 283-5-39m4 25-14-14m12 5 9-18m242 44 9-42m-6 25 14-12m-10 0-7-13" stroke="#322030" stroke-width="3" fill="none" stroke-linecap="round"/>${cat}${ghost}<path class="little-heart" d="M208 194c-10-8-14-12-10-16 4-4 9-1 10 2 2-4 7-6 10-2 4 4 0 9-10 16Z"/><g fill="#d99564"><path d="m67 141 2-6 2 6 6 2-6 2-2 6-2-6-6-2zm262-62 1-4 2 4 4 1-4 2-2 4-1-4-4-2Z"/><circle cx="91" cy="195" r="1.3"/><circle cx="304" cy="54" r="1.3"/></g></svg></div>`}
function chrome(n){document.querySelector('#progress').innerHTML=Array.from({length:8},(_,i)=>`<span class="${i+1===n?'active':i+1<n?'complete':''}"></span>`).join('');document.querySelector('#progress').setAttribute('aria-label',`Scene ${n} of 8`);return `<div class="story-count"><b>${String(n).padStart(2,'0')}</b> / 08</div><span class="corner-star" aria-hidden="true">✧</span>`}
function quest(){app.innerHTML=`<section class="scene quest">${chrome(2)}${art()}<p class="eyebrow">A little mystery, just for you</p><h1 tabindex="-1">A spooky<br><em>quest awaits.</em></h1><p class="subtitle">Someone special<br>is thinking of you...</p><button class="button" data-action="start">START <span class="arrow" aria-hidden="true">→</span></button><p class="whisper">TRICK OR SOMETHING SWEETER?</p></section>`;}

// Saved plan content is supplied by the inline editor's single plan record.
let maze=[], heartPositions=[], monsterSpawn={x:7,y:7}, lastMazeSignature='';
function generateMaze(){
  const layout=Array.from({length:9},()=>Array(9).fill(1)),stack=[{x:1,y:1}];
  layout[1][1]=0;
  // Randomized carving connects every room; extra passages make the chase playful.
  while(stack.length){const cell=stack[stack.length-1];const choices=[[0,-2],[0,2],[-2,0],[2,0]].map(([dx,dy])=>({x:cell.x+dx,y:cell.y+dy})).filter(p=>p.x>0&&p.x<8&&p.y>0&&p.y<8&&layout[p.y][p.x]===1);if(!choices.length){stack.pop();continue;}const next=choices[Math.floor(Math.random()*choices.length)];layout[(cell.y+next.y)/2][(cell.x+next.x)/2]=0;layout[next.y][next.x]=0;stack.push(next);}
  const connectors=[];for(let y=1;y<8;y++)for(let x=1;x<8;x++)if(layout[y][x]===1&&((y%2===1&&x%2===0)||(y%2===0&&x%2===1)))connectors.push({x,y});
  for(let i=0;i<2;i++){const p=connectors.splice(Math.floor(Math.random()*connectors.length),1)[0];layout[p.y][p.x]=0;}
  // Even a rare identical random draw must produce a fresh map.
  if(JSON.stringify(layout)===lastMazeSignature){const p=connectors[Math.floor(Math.random()*connectors.length)];layout[p.y][p.x]=0;}
  maze=layout;lastMazeSignature=JSON.stringify(maze);
  const rooms=[];for(let y=1;y<8;y+=2)for(let x=1;x<8;x+=2)if(x!==1||y!==1)rooms.push({x,y});
  monsterSpawn=rooms.reduce((farthest,p)=>mazeRoute({x:1,y:1},p).length>mazeRoute({x:1,y:1},farthest).length?p:farthest,rooms[0]);
  const candidates=rooms.filter(p=>p.x!==monsterSpawn.x||p.y!==monsterSpawn.y);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  heartPositions=candidates.slice(0,5).map(p=>[p.x,p.y]);
}
const messages = ['You make spooky season brighter.','Good company makes everything better.','I kinda like you.','One more little heart…','Every little path led me to you.'];
let scene='loading', player={x:1,y:1}, monster={x:7,y:7}, collected=new Set(), toastTimer, sceneTimer, monsterTimer, transitioning=false;
const heartIcon = `<svg viewBox="0 0 32 30" aria-hidden="true"><path d="M16 28C-9 11 1-6 16 6 31-6 41 11 16 28Z" fill="currentColor"/></svg>`;
const miniGhost = `<svg viewBox="199 188 89 94" aria-hidden="true">${ghost}</svg>`;
const crescent = `<svg class="crescent" viewBox="0 0 70 80" aria-hidden="true"><path d="M52 4C8-3-9 58 34 73c12 4 24 1 32-8C21 76 10 21 52 4Z" fill="#f5bc79"/></svg>`;
function show(next){clearTimeout(sceneTimer);clearTimeout(toastTimer);clearTimeout(monsterTimer);window.spookySound?.stopScream();scene=next;transitioning=false;({loading,quest,game,heartFound,invitation,confirmed,details,finale,decline,declined,jumpscare})[next]();dressButtons();editor.decorate();const h=app.querySelector('h1');h?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function wrap(name,n,content){app.innerHTML=`<section class="scene ${name}">${chrome(n)}${content}</section>`;}
function loading(){wrap('loading',1,`${crescent}<p class="eyebrow">A little magic is on its way</p><h1 tabindex="-1">Something<br><em>spooky is loading...</em></h1><div class="loading-track" role="progressbar" aria-label="Preparing your invitation"><span></span></div><div class="single-ghost">${miniGhost}</div><p class="whisper">PLEASE WAIT · · ·</p><svg class="cemetery" viewBox="0 0 600 100" aria-hidden="true"><path d="M0 87q170-20 300 0t300-5v18H0Zm82 0V48H70V37h12V22h12v15h14v11H94v39m81 0V45a22 22 0 0 1 44 0v42m168 0V60h-13V48h13V28h12v20h15v12h-15v27m71 0V47a17 17 0 0 1 34 0v40" fill="#0b090f"/></svg>`);sceneTimer=setTimeout(()=>show('quest'),1800);}
function game(){generateMaze();player={x:1,y:1};collected.clear();monster={...monsterSpawn};wrap('game',3,`<p class="eyebrow">Follow your heart. All five of them.</p><h1 tabindex="-1">A little <em>heart hunt.</em></h1><div class="game-hud"><span class="heart-counter">${heartIcon}<span id="heart-count">${collected.size}</span><span class="count-total">/ 5</span></span><span class="game-hint">A tiny monster is chasing you!</span></div><div class="maze" role="group" aria-label="Random heart maze. Collect five hearts while avoiding the monster. Use arrow keys, W A S D, or the direction buttons. Getting tagged returns you to the start; hearts are kept." aria-describedby="position-status">${maze.flatMap((row,y)=>row.map((wall,x)=>`<div class="cell ${wall?'wall':'path'}" data-cell="${x},${y}"></div>`)).join('')}<div class="maze-monster" aria-hidden="true"><img src="./assets/maze-monster.svg" width="128" height="128" alt=""></div><div class="player">${miniGhost}</div></div><p class="sr-only" id="position-status" aria-live="polite"></p><div class="heart-toast" role="status" aria-live="polite"></div><div class="direction-pad" aria-label="Movement controls"><button class="direction up" data-direction="up" aria-label="Move up">↑</button><button class="direction left" data-direction="left" aria-label="Move left">←</button><button class="direction down" data-direction="down" aria-label="Move down">↓</button><button class="direction right" data-direction="right" aria-label="Move right">→</button></div><p class="whisper controls-note">COLLECT 5 HEARTS & DODGE YOUR LITTLE SHADOW<br><span>Arrow keys or WASD · or tap to wander<br>Tagged? Your hearts stay with you ♡</span></p>`);paintMaze();scheduleMonster(2400);}
function paintMaze(){heartPositions.forEach(([x,y],i)=>{app.querySelector(`[data-cell="${x},${y}"]`).innerHTML=collected.has(i)?'<span class="collected-spark">·</span>':`<span class="maze-heart">${heartIcon}</span>`;});for(const [selector,position] of [['.player',player],['.maze-monster',monster]]){const el=app.querySelector(selector);el.style.left=`${position.x/9*100}%`;el.style.top=`${position.y/9*100}%`;}app.querySelector('#heart-count').textContent=collected.size;app.querySelector('#position-status').textContent=`Ghost at row ${player.y}, column ${player.x}. Monster at row ${monster.y}, column ${monster.x}. ${collected.size} of 5 hearts collected.`;}
function gameToast(message,delay=1600){clearTimeout(toastTimer);const toast=app.querySelector('.heart-toast');toast.innerHTML=message;toast.classList.add('visible');toastTimer=setTimeout(()=>toast.classList.remove('visible'),delay);}
function mazeRoute(from,to){const queue=[{...from,path:[]}],seen=new Set([`${from.x},${from.y}`]);for(let i=0;i<queue.length;i++){const current=queue[i];if(current.x===to.x&&current.y===to.y)return current.path;for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){const x=current.x+dx,y=current.y+dy,key=`${x},${y}`;if(maze[y]?.[x]===0&&!seen.has(key)){seen.add(key);queue.push({x,y,path:[...current.path,{x,y}]});}}}return [];}
function scheduleMonster(delay=700){clearTimeout(monsterTimer);monsterTimer=setTimeout(chaseGhost,delay);}
function tagGhost(){player={x:1,y:1};monster={...monsterSpawn};gameToast('<b>BOO! TAG, YOU’RE IT ♡</b> Back to the start. Your hearts are safe!',2200);scheduleMonster(3000);}
function chaseGhost(){if(scene!=='game'||transitioning)return;if(document.hidden){scheduleMonster();return;}const step=mazeRoute(monster,player)[0];if(step)monster=step;if(monster.x===player.x&&monster.y===player.y)tagGhost();else scheduleMonster();paintMaze();}
function move(direction){if(scene!=='game'||transitioning)return;const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];if(!delta)return;const x=player.x+delta[0],y=player.y+delta[1];if(maze[y]?.[x]!==0)return;player={x,y};const found=heartPositions.findIndex(([hx,hy])=>hx===x&&hy===y);if(found>=0&&!collected.has(found)){collected.add(found);gameToast(`<b>HEART FOUND!</b> ${messages[collected.size-1]}`,1200);if(collected.size===5){transitioning=true;clearTimeout(monsterTimer);sceneTimer=setTimeout(()=>show('heartFound'),1150);}}if(!transitioning&&monster.x===player.x&&monster.y===player.y)tagGhost();paintMaze();}
function heartFound(){wrap('heart-found',4,`<div class="big-heart">${heartIcon}</div><p class="eyebrow">Five hearts. One little question.</p><h1 tabindex="-1">Heart <em>found!</em></h1><blockquote>“You make spooky<br>season brighter.”</blockquote><div class="single-ghost">${miniGhost}</div><button class="button" data-action="invitation">CONTINUE <span class="arrow" aria-hidden="true">→</span></button>`);}
function invitation(){wrap('invitation',5,`${art()}<p class="eyebrow">No tricks. Just this.</p><h1 tabindex="-1"><span class="question-small">Will you go on a</span><em>Halloween date</em><span class="question-small">with me?</span></h1><div class="button-stack"><button class="button" data-action="yes">YES <span class="button-heart" aria-hidden="true">♡</span></button><button class="button secondary" data-action="no">…NO?</button></div><p class="whisper">A LITTLE COURAGE. A LOT OF BUTTERFLIES.</p>`);}
function yes(){
  if(transitioning)return;
  transitioning=true;
  app.querySelector('.scene').classList.add('celebrating');
  app.querySelectorAll('button').forEach(b=>b.disabled=true);
  salute();
  sceneTimer=setTimeout(()=>show('confirmed'),window.matchMedia('(prefers-reduced-motion: reduce)').matches?250:850);
}
function decline(){wrap('decline',5,`<div class="boo-visitor"><p class="boo-bubble">Boo! <span>Just a tiny fright ♡</span></p><div class="single-ghost sourced-boo"><picture><source media="(prefers-reduced-motion: reduce)" srcset="./assets/ghost-still.svg"><img src="./assets/ghost.webp" width="512" height="512" alt="" decoding="async"></picture></div></div><p class="eyebrow">Your answer is yours</p><h1 tabindex="-1">Are you sure? <span class="eyes">👀</span></h1><p class="subtitle">No spells. No pressure.</p><div class="button-stack"><button class="button secondary" data-action="sure">YES, I’M SURE</button><button class="button" data-action="invitation">GO BACK</button></div>`);}
function declined(){wrap('declined',5,`<div class="single-ghost">${miniGhost}</div><h1 tabindex="-1">No worries <em>♡</em></h1><p class="subtitle">Worth a shot.</p><button class="button secondary" data-action="invitation">BACK TO THE INVITATION</button>`);}
function confirmNo(){if(scene!=='decline'||transitioning)return;show('jumpscare');}
function jumpscare(){
  app.innerHTML=`<section class="scene jumpscare"><img class="scare-photo" src="./assets/jumpscare-photo.png" width="415" height="739" alt="" aria-hidden="true"><div class="scare-caption"><h1 tabindex="-1">BOO!</h1><button class="button" data-action="dismissScare">PHEW! ♡</button></div></section>`;
  window.spookySound?.scream();
  sceneTimer=setTimeout(()=>show('declined'),window.matchMedia('(prefers-reduced-motion: reduce)').matches?1400:1800);
}
function confirmed(){wrap('confirmed',6,`<p class="eyebrow">It’s a yes!</p><h1 tabindex="-1">Date <em>confirmed!</em></h1><div class="confirmation-art" aria-hidden="true">${art()}<div class="confirmation-heart">${heartIcon}</div><div class="confirmation-bats">${Array.from({length:3},(_,i)=>`<picture class="confirmation-bat bat-${i+1}"><source media="(prefers-reduced-motion: reduce)" srcset="./assets/bat-still.svg"><img src="./assets/bat.webp" width="512" height="512" alt=""></picture>`).join('')}</div></div><p class="partner-text">OFFICIAL<br>SPOOKY PARTNERS <span>♡</span></p><button class="button" data-action="details">CONTINUE <span class="arrow" aria-hidden="true">→</span></button>`);}
const icons={calendar:'<rect x="4" y="6" width="24" height="23" rx="3"/><path d="M4 13h24M10 3v6m12-6v6m-12 9h2m8 0h2m-12 6h2m8 0h2"/>',clock:'<circle cx="16" cy="16" r="12"/><path d="M16 8v9l6 3"/>',pin:'<path d="M26 13c0 8-10 16-10 16S6 21 6 13a10 10 0 0120 0Z"/><circle cx="16" cy="13" r="3"/>',mask:'<path d="M3 8q13 8 26 0v11q-5 12-13 4C8 31 3 24 3 19Z"/><path d="m8 16 4 2m8 0 4-2"/>',gift:'<rect x="4" y="12" width="24" height="7" rx="1"/><path d="M6 19v10h20V19M16 12v17m0-17C-1 12 7-3 16 12Zm0 0C33 12 25-3 16 12Z"/>'};
const pumpkin=`<svg class="pumpkin" viewBox="0 0 60 60" aria-hidden="true"><path d="M31 15q-2-9 5-10" fill="none" stroke="#a77d53" stroke-width="4"/><path d="M30 17C5 4-3 51 20 53q10 5 20 0c23-2 15-49-10-36Z" fill="#f3934e"/><path d="m14 30 9-5 2 9Zm20 4 3-9 9 5ZM18 40l8 3 4-3 4 3 9-4q-10 19-25 1" fill="#281723"/></svg>`;
function details(){const rows=editor.planRows();wrap('details',7,`${pumpkin}<p class="eyebrow">Something to look forward to</p><h1 tabindex="-1">Our Halloween <em>date.</em></h1><dl class="details-list">${rows.map(([icon,label,value])=>`<div class="detail-row"><svg viewBox="0 0 32 32" aria-hidden="true">${icons[icon]}</svg><div><dt>${label}</dt><dd>${value}</dd></div></div>`).join('')}</dl>${editor.actionMarkup()}<button class="button" data-action="finale">CAN’T WAIT <span class="button-heart" aria-hidden="true">♡</span></button>`);}
function finale(){wrap('finale',8,`<div class="final-sky">${crescent}<span class="star one">✦</span><span class="star two">·</span><span class="star three">✧</span></div><div class="final-art love-letter-finale" aria-hidden="true"><picture class="final-letter"><source media="(prefers-reduced-motion: reduce)" srcset="./assets/love-letter-still.svg"><img src="./assets/love-letter.webp" width="512" height="512" alt="" decoding="async"></picture><span class="final-heart-ghost"><img src="./assets/heart-ghost.png" width="1024" height="1024" alt="" decoding="async"></span>${[1,2,3].map(i=>`<picture class="final-sparkle sparkle-${i}"><source media="(prefers-reduced-motion: reduce)" srcset="./assets/sparkling-heart-still.svg"><img src="./assets/sparkling-heart.webp" width="512" height="512" alt="" decoding="async"></picture>`).join('')}<picture class="final-pink-bat"><source media="(prefers-reduced-motion: reduce)" srcset="./assets/bat-still.svg"><img src="./assets/bat.webp" width="512" height="512" alt=""></picture></div><h1 tabindex="-1">See you soon,<br><em>my boo.</em></h1><p class="subtitle finale-message">Can’t wait to make a little<br>Halloween magic with you.</p><span class="final-heart" aria-hidden="true">♡</span>`);}
app.addEventListener('click',event=>{if(event.target.closest('[contenteditable]')?.isContentEditable)return;const planAction=event.target.closest('[data-plan-action]');if(planAction){editor.planAction(planAction.dataset.planAction,event);return;}const button=event.target.closest('button');if(!button||button.disabled)return;window.spookySound?.button(button.dataset.direction||button.dataset.action);if(button.dataset.direction){if(event.detail===0)move(button.dataset.direction);return;}const actions={start:()=>{player={x:1,y:1};collected.clear();show('game');},invitation:()=>show('invitation'),yes,no:()=>show('decline'),sure:confirmNo,dismissScare:()=>show('declined'),details:()=>show('details'),finale:()=>show('finale')};actions[button.dataset.action]?.();});
document.addEventListener('keydown',event=>{if(event.target.isContentEditable)return;if(scene==='jumpscare'&&event.key==='Escape'){event.preventDefault();show('declined');return;}if(scene!=='game'||event.ctrlKey||event.altKey||event.metaKey)return;const direction={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[event.key.length===1?event.key.toLowerCase():event.key];if(direction){event.preventDefault();move(direction);}});
// Phone-friendly steering: a key moves the moment it is pressed and keeps
// going while held; a swipe or drag on the board moves one cell per ~26px.
let holdTimer=0;
const stopHold=()=>{clearTimeout(holdTimer);holdTimer=0;};
document.addEventListener('pointerdown',event=>{
  const key=event.target.closest?.('.direction');
  if(key&&scene==='game'){
    event.preventDefault();
    stopHold();
    const direction=key.dataset.direction;
    window.spookySound?.button(direction);
    move(direction);
    const again=()=>{move(direction);holdTimer=setTimeout(again,150);};
    holdTimer=setTimeout(again,320);
    return;
  }
  const board=event.target.closest?.('.maze');
  if(!board||scene!=='game')return;
  let sx=event.clientX,sy=event.clientY;
  const id=event.pointerId;
  const step=Math.max(18,board.clientWidth/9*.55);
  const drag=e=>{
    if(e.pointerId!==id)return;
    const dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.max(Math.abs(dx),Math.abs(dy))<step)return;
    move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));
    sx=e.clientX;sy=e.clientY;
  };
  const end=e=>{if(e.pointerId!==id)return;removeEventListener('pointermove',drag);removeEventListener('pointerup',end);removeEventListener('pointercancel',end);};
  addEventListener('pointermove',drag);addEventListener('pointerup',end);addEventListener('pointercancel',end);
});
for(const type of ['pointerup','pointercancel','blur'])addEventListener(type,stopHold);
document.addEventListener('pointerout',event=>{if(event.target.closest?.('.direction'))stopHold();});
document.addEventListener('contextmenu',event=>{if(event.target.closest?.('.direction,.maze'))event.preventDefault();});
// Optional browser-agent access uses exactly the same movement and state as the controls.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();for(const tool of [{name:'read_heart_hunt',description:'Read the current Halloween scene, ghost and chasing monster positions, maze, and remaining hearts.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({scene,player,monster:scene==='game'?monster:null,maze,remainingHearts:heartPositions.filter((_,i)=>!collected.has(i)),hearts:collected.size})},{name:'move_ghost',description:'Move the ghost through the active heart hunt using a sequence of directions. Collection and monster tagging update the visible game.',inputSchema:{type:'object',properties:{directions:{type:'array',items:{type:'string',enum:['up','down','left','right']},maxItems:60}},required:['directions'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{if(scene!=='game')throw new Error('Start the heart hunt first.');if(!Array.isArray(input.directions)||input.directions.length>60||input.directions.some(d=>!['up','down','left','right'].includes(d)))throw new Error('Provide up to 60 valid directions.');input.directions.forEach(move);return{scene,player,monster,hearts:collected.size};}}]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
window.addEventListener('pagehide',()=>clearTimeout(monsterTimer));
window.addEventListener('pageshow',event=>{if(event.persisted&&scene==='game'&&!transitioning)scheduleMonster(2400);});
// Button shapes stay decorative; native buttons keep their labels and behavior.
function dressButtons(){
  app.querySelectorAll('.button,.direction').forEach(button=>{
    const label=document.createElement('span');
    label.className='button-label';
    while(button.firstChild)label.append(button.firstChild);
    button.append(label);
    if(button.classList.contains('direction'))return; // the arrow keys are plain cream keys
    const skin=button.dataset.action==='yes'?'candy':button.dataset.action==='no'?'graveyard':button.classList.contains('secondary')?'ghost':'pumpkin';
    button.classList.add('themed-button',`${skin}-button`);
    const skins={pumpkin:`<svg class="button-stem" viewBox="0 0 34 22" aria-hidden="true"><path d="M12 21q-1-11 6-17" fill="none" stroke="#2c193f" stroke-width="8" stroke-linecap="round"/><path d="M12 21q-1-11 6-17" fill="none" stroke="#7cc45a" stroke-width="4" stroke-linecap="round"/><path d="M16 12q8-9 16-3-7 8-16 3Z" fill="#9be07a" stroke="#2c193f" stroke-width="2" stroke-linejoin="round"/></svg><svg class="button-skin pumpkin-skin" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true"><path class="pumpkin-body" d="M38 9Q140 0 242 9Q275 13 275 40Q275 67 242 71Q140 80 38 71Q5 67 5 40Q5 13 38 9Z"/><path class="pumpkin-rib far" d="M52 9Q36 40 52 71M228 9Q244 40 228 71"/><path class="pumpkin-rib" d="M92 7Q78 40 92 73M188 7Q202 40 188 73"/><path class="pumpkin-shine" d="M26 24Q44 15 70 13"/><ellipse class="pumpkin-cheek" cx="34" cy="47" rx="11" ry="7"/><ellipse class="pumpkin-cheek" cx="246" cy="47" rx="11" ry="7"/></svg>`,ghost:`<svg class="button-skin ghost-skin" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true"><path class="ghost-body" d="M30 5H250Q275 5 275 30V58q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0q-13.5 20-27 0V30Q5 5 30 5Z"/><path class="ghost-shine" d="M26 19Q42 13 66 13"/><ellipse class="ghost-cheek" cx="34" cy="41" rx="11" ry="7"/><ellipse class="ghost-cheek" cx="246" cy="41" rx="11" ry="7"/></svg>`,candy:`<svg class="button-skin candy-skin" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true"><path class="candy-wrap" d="m47 26-37-14 8 28-8 28 37-14m186-28 37-14-8 28 8 28-37-14"/><rect class="candy-body" x="40" y="10" width="200" height="60" rx="30"/><path class="candy-stripe" d="m74 11 28 58m39-58 28 58m39-58 24 51" fill="none" stroke-width="14"/><path class="candy-shine" d="M67 21h57" fill="none" stroke-width="3" stroke-linecap="round"/></svg>`,graveyard:`<svg class="button-skin graveyard-skin" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true"><rect class="graveyard-body" x="3" y="3" width="274" height="74" rx="18"/><svg x="14" y="47" width="252" height="28" viewBox="0 0 600 100" preserveAspectRatio="none"><path d="M0 87q170-20 300 0t300-5v18H0Zm82 0V48H70V37h12V22h12v15h14v11H94v39m81 0V45a22 22 0 0 1 44 0v42m168 0V60h-13V48h13V28h12v20h15v12h-15v27m71 0V47a17 17 0 0 1 34 0v40" fill="#101e1c"/></svg></svg>`};
    button.insertAdjacentHTML('afterbegin',skins[skin]);
  });
}
function plantMoonlitHills(){
  document.body.insertAdjacentHTML('afterbegin',`<div class="moonlit-landscape" aria-hidden="true"><img src="./assets/cartoon-night.webp" width="1536" height="1024" alt="" decoding="async" fetchpriority="high"></div>`);
}
function salute(){
  document.querySelector('.treat-salute')?.remove();
  const candy=`<svg viewBox="0 0 60 40" aria-hidden="true"><path d="m17 15-14-9v28l14-9m26-10 14-9v28l-14-9" fill="#c3a4e9"/><rect x="14" y="7" width="32" height="26" rx="12" fill="#ffb26d"/><path d="m22 9 11 23m-2-25 11 21" stroke="#fff0d7" stroke-width="5"/></svg>`;
  const corn=`<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M16 4q4-7 8 0l15 35q3 7-5 7H6q-8 0-5-7Z" fill="#fff0d7"/><path d="m10 18-7 16h34l-7-16Z" fill="#ff9851"/><path d="m3 34-2 5q-3 7 5 7h28q8 0 5-7l-2-5Z" fill="#ebc064"/></svg>`;
  const batTreat='<picture><source media="(prefers-reduced-motion: reduce)" srcset="./assets/bat-still.svg"><img src="./assets/bat.webp" width="512" height="512" alt=""></picture>';
  const layer=document.createElement('div');layer.className='treat-salute';layer.setAttribute('aria-hidden','true');
  layer.innerHTML=Array.from({length:12},(_,i)=>{const side=i%2===0?-1:1;return `<span class="flying-treat" style="--start:${side<0?'8%':'92%'};--travel:${-side*(28+(i%3)*12)}vw;--rise:${-(40+(i%4)*10)}dvh;--turn:${side*(120+i*23)}deg;--delay:${Math.floor(i/2)*65}ms">${[candy,corn,pumpkin,batTreat][i%4]}</span>`;}).join('');
  document.body.append(layer);
  setTimeout(()=>layer.remove(),2200);
}
const pause=()=>{clearTimeout(sceneTimer);clearTimeout(monsterTimer);clearTimeout(toastTimer);transitioning=false;window.spookySound?.stopScream();};
const repository=new ModeRepository(selectMode(location.search));
let modesUI;
const editor=new InlineEditor({app,show,getScene:()=>scene,pause,repository,start:kind=>{show(kind==='studio'?'quest':'loading');if(kind==='studio')editor.enable();},onIssue:error=>modesUI.issue(error)});
modesUI=new URLModesUI({app,editor,repository,pause});
plantMoonlitHills();
modesUI.start();
