const {createWechatPlatform}=require('./src/platform/wechat');
const {GameApp}=require('./src/app');
const config=require('./src/config');
new GameApp(createWechatPlatform(wx,config));
