'use strict';
// Public settings only. Never put AppSecret, passwords or private tokens here.
module.exports=Object.freeze({
  buildId:'1.0.0-local',
  environment:'development',
  storageMode:'local', // local | cloud (cloud application integration is not implemented)
  adsMode:'disabled', // disabled | rewarded; disabled requires an empty adUnitId
  adUnitId:'',
  backendUrl:'',
  feedbackContact:'',
});
