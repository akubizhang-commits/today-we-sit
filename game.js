const {createWechatPlatform}=require('./src/platform/wechat');
const {GameApp}=require('./src/app');
new GameApp(createWechatPlatform(wx));
