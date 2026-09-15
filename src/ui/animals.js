'use strict';
// Stable visual identities only: never changes puzzle IDs, rules or saved layouts.
const SPECIES=Object.freeze([
  {id:'cat',label:'小猫',fur:'#EDC38C',dark:'#B57949'},
  {id:'dog',label:'小狗',fur:'#CFAB85',dark:'#805A42'},
  {id:'pig',label:'小猪',fur:'#EDB5B4',dark:'#CE8188'},
  {id:'tiger',label:'小老虎',fur:'#E9AF59',dark:'#76503C'},
  {id:'mouse',label:'小老鼠',fur:'#BDC5D0',dark:'#838D9D'},
  {id:'cow',label:'小牛',fur:'#F2EBDD',dark:'#5A6460'},
  {id:'sheep',label:'小羊',fur:'#F4EAD6',dark:'#BDA98D'},
  {id:'rabbit',label:'小兔',fur:'#EADBCF',dark:'#C8A899'},
  {id:'panda',label:'熊猫',fur:'#F1EBDD',dark:'#56635F'},
  {id:'fox',label:'小狐狸',fur:'#D79967',dark:'#9A664C'},
  {id:'bear',label:'小熊',fur:'#B58D6B',dark:'#805C47'},
  {id:'raccoon',label:'小浣熊',fur:'#B6B5A7',dark:'#646F69'},
].map(Object.freeze));
const CAST=Object.freeze({'小满':0,'阿穗':1,'阿陶':2,'圆圆':3,'小岚':4,'青禾':5,'阿榆':6,'林叔':7,'阿杏':8,'小游':9,'苏苏':10,'阿麦':11});
function animalIndex(character=0){
  if(Number.isInteger(character))return ((character%SPECIES.length)+SPECIES.length)%SPECIES.length;
  const name=typeof character==='string'?character:character.name||character.id||'';
  if(Object.hasOwn(CAST,name))return CAST[name];
  let hash=0;for(const ch of name)hash=(hash*31+ch.codePointAt(0))>>>0;
  return hash%SPECIES.length;
}
function animalProfile(character){return SPECIES[animalIndex(character)];}
module.exports={SPECIES,animalIndex,animalProfile};
