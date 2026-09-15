function createWechatPlatform(wx){
  const canvas=wx.createCanvas();
  const getInfo=()=>typeof wx.getWindowInfo==='function'?wx.getWindowInfo():wx.getSystemInfoSync();
  const info=getInfo();
  const getInsets=windowInfo=>{
    let menu=null;
    try{if(typeof wx.getMenuButtonBoundingClientRect==='function')menu=wx.getMenuButtonBoundingClientRect();}catch(_){/* Some guest tools lack menu metrics. */}
    return {
      top:Math.max(windowInfo.safeArea?windowInfo.safeArea.top:0,menu&&Number.isFinite(menu.bottom)?menu.bottom+6:0),
      bottom:Math.max(0,windowInfo.windowHeight-(windowInfo.safeArea?windowInfo.safeArea.bottom:windowInfo.windowHeight)),
    };
  };
  let active=null;
  const platform={
    canvas,width:info.windowWidth,height:info.windowHeight,dpr:Math.min(info.pixelRatio||1,3),
    insets:getInsets(info),
    storage:{get:key=>wx.getStorageSync(key)||undefined,set:(key,value)=>wx.setStorageSync(key,value)},
    onPointer(fn){
      for(const [method,type] of [['onTouchStart','down'],['onTouchMove','move'],['onTouchEnd','up'],['onTouchCancel','cancel']]){
        wx[method](e=>{
          const touches=e.changedTouches||[];
          if(type==='cancel'&&!touches.length){active=null;fn({type,x:0,y:0});return;}
          if(type==='down'&&active===null&&touches[0])active=touches[0].identifier;
          const t=touches.find(t=>t.identifier===active);
          if(t)fn({type,x:t.clientX,y:t.clientY});
          if(t&&(type==='up'||type==='cancel'))active=null;
        });
      }
    },
    onResize(fn){
      wx.onWindowResize(()=>{
        const next=getInfo();platform.insets=getInsets(next);
        platform.width=next.windowWidth;platform.height=next.windowHeight;platform.dpr=Math.min(next.pixelRatio||1,3);
        fn(platform.width,platform.height,platform.dpr);
      });
    },
    onHide:fn=>wx.onHide(()=>{active=null;fn();}),
    requestFrame:fn=>requestAnimationFrame(fn),
  };
  return platform;
}
module.exports={createWechatPlatform};
