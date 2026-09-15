function createBrowserPlatform(canvas){
  let pointerCallback=()=>{},resizeCallback=()=>{};
  const platform={
    canvas,width:canvas.clientWidth,height:canvas.clientHeight,dpr:Math.min(window.devicePixelRatio||1,3),
    storage:{
      get(key){const value=localStorage.getItem(key);return value===null?undefined:JSON.parse(value);},
      set(key,value){localStorage.setItem(key,JSON.stringify(value));},
      remove(key){localStorage.removeItem(key);},
    },
    createAudio(src){const audio=new Audio('/'+src);audio.preload='none';audio.destroy=()=>{audio.pause();audio.removeAttribute('src');audio.load();};return audio;},
    vibrate(){if(navigator.vibrate)navigator.vibrate(8);},
    onPointer(fn){pointerCallback=fn;},
    onResize(fn){resizeCallback=fn;},
    onHide(fn){document.addEventListener('visibilitychange',()=>{if(document.hidden)fn();});window.addEventListener('pagehide',fn);},
    onShow(fn){document.addEventListener('visibilitychange',()=>{if(!document.hidden)fn();});},
    requestFrame(fn){return window.requestAnimationFrame(fn);},
  };
  for(const [dom,type] of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','cancel']]){
    canvas.addEventListener(dom,e=>{
      if(!e.isPrimary)return;
      if(type==='down')canvas.setPointerCapture(e.pointerId);
      const r=canvas.getBoundingClientRect();
      pointerCallback({type,x:e.clientX-r.left,y:e.clientY-r.top});
      if(type==='up'||type==='cancel'){if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
    });
  }
  const observer=new ResizeObserver(()=>{
    platform.width=canvas.clientWidth;platform.height=canvas.clientHeight;
    platform.dpr=Math.min(window.devicePixelRatio||1,3);
    resizeCallback(platform.width,platform.height,platform.dpr);
  });
  observer.observe(canvas);
  return platform;
}
module.exports={createBrowserPlatform};
