const test=require('node:test');
const assert=require('node:assert/strict');
const {createWechatPlatform}=require('../src/platform/wechat');
function fixture(){
  const callbacks={};
  const wx={
    createCanvas:()=>({}),
    getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:3,safeArea:{top:44,bottom:810}}),
    getMenuButtonBoundingClientRect:()=>({bottom:86}),
    getStorageSync(){},setStorageSync(){},
    onWindowResize:fn=>{callbacks.resize=fn;},
    onHide:fn=>{callbacks.hide=fn;},
  };
  for(const method of ['onTouchStart','onTouchMove','onTouchEnd','onTouchCancel'])wx[method]=fn=>{callbacks[method]=fn;};
  return {wx,callbacks};
}
test('unavailable menu bounds do not prevent WeChat startup',()=>{
  const {wx}=fixture();wx.getMenuButtonBoundingClientRect=()=>{throw new Error('Unavailable in guest tool');};
  const p=createWechatPlatform(wx);
  assert.equal(p.insets.top,44);assert.equal(p.insets.bottom,34);
});
test('empty touch cancellation releases the active finger and forwards cancellation',()=>{
  const {wx,callbacks}=fixture();const p=createWechatPlatform(wx);const events=[];p.onPointer(e=>events.push(e));
  callbacks.onTouchStart({changedTouches:[{identifier:1,clientX:10,clientY:20}]});
  callbacks.onTouchCancel({changedTouches:[]});
  callbacks.onTouchStart({changedTouches:[{identifier:2,clientX:30,clientY:40}]});
  assert.deepEqual(events.map(e=>e.type),['down','cancel','down']);
});
