'use strict';
function createAudioController({createAudio=()=>null,settings={music:true,effects:true},now=Date.now}={}){
  let unlocked=false,hidden=false,scene='bus',music=null,disposed=false,lastEffect=0;
  const effects=new Map();
  const safe=(object,method)=>{try{const result=object&&object[method]&&object[method]();if(result&&result.catch)result.catch(()=>{});}catch(_){}};
  function create(src){try{return createAudio(src);}catch(_){return null;}}
  function update(){
    if(disposed||!unlocked||hidden||!settings.music){safe(music,'pause');return;}
    if(!music){music=create(`assets/audio/music-${scene}.wav`);if(music){music.loop=true;music.volume=0.22;}}
    safe(music,'play');
  }
  return {
    unlock(nextScene=scene){
      const next=['bus','garden','cinema'].includes(nextScene)?nextScene:'bus';
      if(next!==scene){safe(music,'pause');safe(music,'destroy');music=null;scene=next;}
      if(!unlocked){unlocked=true;update();}else if(!music)update();
    },
    setScene(nextScene){if(nextScene===scene)return;safe(music,'pause');safe(music,'destroy');music=null;scene=['bus','garden','cinema'].includes(nextScene)?nextScene:'bus';update();},
    setSettings(next){settings={...next};update();},
    playEffect(name){
      if(disposed||!unlocked||hidden||!settings.effects||now()-lastEffect<65)return;
      const allowed=['select','place','swap','undo','reset','hint','complete','claim','open','close'];
      if(!allowed.includes(name))return;
      lastEffect=now();
      if(!effects.has(name)){const audio=create(`assets/audio/${name}.wav`);if(audio)audio.volume=0.35;effects.set(name,audio);}
      const audio=effects.get(name);try{if(audio){if(audio.seek)audio.seek(0);else audio.currentTime=0;}}catch(_){}
      safe(audio,'play');
    },
    suspend(){hidden=true;safe(music,'pause');effects.forEach(e=>safe(e,'pause'));},
    resume(){hidden=false;update();},
    dispose(){disposed=true;safe(music,'pause');safe(music,'destroy');effects.forEach(e=>{safe(e,'pause');safe(e,'destroy');});effects.clear();},
  };
}
module.exports={createAudioController};
