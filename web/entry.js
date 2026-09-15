const {GameApp}=require('../src/app');
const {createBrowserPlatform}=require('../src/platform/browser');
new GameApp(createBrowserPlatform(document.getElementById('game')));
