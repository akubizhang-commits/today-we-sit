'use strict';
const {createCatalog}=require('./catalog');
const {levels}=require('./runtime/levels');
const manifest=require('./runtime/manifest');
const catalog=createCatalog(manifest,levels);
module.exports={catalog,levels,manifest};
