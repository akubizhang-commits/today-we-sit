'use strict';
const fs=require('node:fs'),path=require('node:path');
function checkRelease(root=path.resolve(__dirname,'..')){
 const issues=[];
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const nonempty=value=>typeof value==='string'&&value.trim().length>0;
 function read(label,load){
  try{const value=load();if(!record(value))throw new Error('Expected object');return value;}
  catch(_){issues.push(`${label}缺失、无法读取或格式不正确`);return {};}
 }
 const project=read('project.config.json',()=>JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8')));
 const config=read('src/config.js',()=>{
  const file=require.resolve(path.join(root,'src/config.js'));
  delete require.cache[file];
  try{return require(file);}finally{delete require.cache[file];}
 });
 const evidence=read('发布验收记录',()=>JSON.parse(fs.readFileSync(path.join(root,'docs/v1/release-evidence.json'),'utf8')));
 const storageMode=config.storageMode,adsMode=config.adsMode,notApplicable=[];
 if(!['local','cloud'].includes(storageMode))issues.push('必须明确配置有效的storageMode（local或cloud）');
 if(!['disabled','rewarded'].includes(adsMode))issues.push('必须明确配置有效的adsMode（disabled或rewarded）');
 for(const key of ['adUnitId','backendUrl','feedbackContact']){
  if(config[key]!==undefined&&typeof config[key]!=='string')issues.push(`${key}配置必须为字符串`);
 }
 let httpsBackend=false;
 try{
  if(nonempty(config.backendUrl)){
   const url=new URL(config.backendUrl);
   httpsBackend=url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password;
  }
 }catch(_){}
 if(!/^wx[0-9a-f]{16}$/i.test(project.appid))issues.push('未配置正式小游戏AppID');
 if(adsMode==='rewarded'&&!nonempty(config.adUnitId))issues.push('未配置真实激励广告位');
 // The platform also gates on adsMode; require a consistent release configuration.
 if(adsMode==='disabled'&&config.adUnitId)issues.push('广告已禁用，必须清空adUnitId以保持发布范围一致');
 if(storageMode==='cloud'&&!httpsBackend)issues.push('未配置有效的HTTPS云服务地址（不得包含登录凭据）');
 if(!nonempty(config.feedbackContact))issues.push('未配置真实运营反馈联系方式');
 if(config.environment!=='production')issues.push('当前仍是开发环境配置');
 const required={platformEligibility:'平台主体与资格',wechatDevices:'微信iOS/Android真机',feedbackLive:'真实反馈渠道可用性',manualContentQA:'124关人工体验验收',rights:'素材权利记录',privacyReview:'实际隐私告知与服务渠道',releaseRegression:'发布版本回归'};
 if(storageMode==='local')notApplicable.push('cloudLive');
 else required.cloudLive='云身份与同步/删除';
 if(adsMode==='disabled')notApplicable.push('adsLive');
 else required.adsLive='真实广告完成/取消/失败';
 for(const [key,label] of Object.entries(required)){
  if(evidence[key]!==true)issues.push(`${label}尚未确认`);
 }
 const checklistPassed=issues.length===0;
 // This source revision has a provider contract, but no application cloud adapter.
 // Remove this blocker only alongside that integration and its real acceptance.
 if(storageMode==='cloud')issues.push('当前应用尚未接入云身份、同步与删除；填写配置和人工清单不能解除此开发阻塞');
 const ready=issues.length===0;
 return {ready,checklistPassed,scope:'configuration-and-human-evidence-checklist',storageMode,adsMode,
  notApplicable,monetizationCandidate:ready&&adsMode==='rewarded',serviceConnectivityVerified:false,issues};
}
if(require.main===module){const result=checkRelease();console.log(JSON.stringify(result,null,2));if(!result.ready)process.exitCode=1;}
module.exports={checkRelease};
