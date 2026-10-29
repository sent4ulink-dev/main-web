// Short, locally synthesized button notes; audio begins only after interaction.
(() => {
  let enabled=true,context;
  const voices=new Set(),toggle=document.querySelector('#sound-toggle');
  const scream=new Audio('./assets/jumpscare-scream.mp3');
  scream.preload='auto';scream.volume=.42;
  function stopScream(){scream.pause();scream.currentTime=0;}
  function stopAll(){stopScream();for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
  function unlock(){
    if(!enabled)return null;
    try{const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine)return null;context??=new AudioEngine();if(context.state==='suspended')context.resume().catch(()=>{});return context;}catch{return null;}
  }
  function note(engine,frequency,end,offset,duration,volume,type='sine'){
    const voice=engine.createOscillator(),gain=engine.createGain(),start=engine.currentTime+offset;
    voice.type=type;voice.frequency.setValueAtTime(frequency,start);voice.frequency.exponentialRampToValueAtTime(end,start+duration);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    voice.connect(gain);gain.connect(engine.destination);voices.add(voice);
    voice.onended=()=>{voices.delete(voice);voice.disconnect();gain.disconnect();};
    voice.start(start);voice.stop(start+duration+.02);
  }
  function button(action){
    if(action==='sure')return;
    const engine=unlock();if(!engine)return;
    // Slime plop followed by a tiny magical, Halloween-like chime.
    note(engine,480,220,0,.09,.08);
    if(['up','down','left','right'].includes(action))return;
    if(action==='no'){note(engine,330,165,.04,.32,.055,'triangle');note(engine,247,124,.09,.3,.035);}
    else if(action==='yes'){[660,830,990].forEach((pitch,i)=>note(engine,pitch,pitch*.98,.06+i*.065,.23,.045));}
    else {note(engine,740,680,.055,.23,.045);note(engine,1110,1020,.1,.2,.025);}
  }
  window.spookySound={button,stopScream,scream(){if(!enabled)return;stopScream();scream.play().catch(()=>{});}};
  toggle.addEventListener('click',()=>{enabled=!enabled;toggle.textContent=enabled?'♫ Sound on':'♫ Sound off';toggle.setAttribute('aria-pressed',String(enabled));if(enabled)button('toggle');else stopAll();});
  window.addEventListener('pagehide',stopAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});
})();
