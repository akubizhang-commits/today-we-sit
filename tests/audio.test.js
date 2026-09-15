const test=require('node:test');
const assert=require('node:assert/strict');
const {createAudioController}=require('../src/services/audio');
test('music respects user settings and background lifecycle',()=>{
  const sounds=[];
  const audio=createAudioController({createAudio:src=>{
    const s={src,playing:false,play(){this.playing=true;},pause(){this.playing=false;},destroy(){this.playing=false;}};
    sounds.push(s);return s;
  },settings:{music:true,effects:true}});
  audio.unlock('bus');assert.equal(sounds[0].playing,true);
  audio.suspend();assert.equal(sounds[0].playing,false);
  audio.setSettings({music:false,effects:true});audio.resume();
  assert.equal(sounds[0].playing,false);
  audio.setSettings({music:true,effects:true});assert.equal(sounds[0].playing,true);
  audio.dispose();assert.equal(sounds[0].playing,false);
});
test('unavailable audio does not throw or prevent game actions',()=>{
  const audio=createAudioController({createAudio:()=>{throw new Error('Unavailable');}});
  assert.doesNotThrow(()=>{audio.unlock('garden');audio.playEffect('place');audio.suspend();audio.resume();audio.dispose();});
});
