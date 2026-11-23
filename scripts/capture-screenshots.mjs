import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE=process.env.SCREENSHOT_BASE_URL||'http://127.0.0.1:4173';
const OUT='./artifacts/screenshots';
const viewports=[{name:'mobile-390x844',width:390,height:844},{name:'tablet-768x1024',width:768,height:1024},{name:'desktop-1440x900',width:1440,height:900}];
const routes=[
 {name:'sections-hub',path:'/#/hub'},
 {name:'dashboard',path:'/#/dashboard'},
 {name:'warehouse',path:'/#/warehouse'},
 {name:'fleet',path:'/#/fleet'},
 {name:'shift-operations',path:'/#/shifts'},
 {name:'shuttle-engineering',path:'/#/engineering'},
 {name:'battery-management',path:'/#/batteries'},
 {name:'fault-management',path:'/#/faults'},
 {name:'maintenance-management',path:'/#/maintenance'},
 {name:'device-connections',path:'/#/connections'},
 {name:'notifications',path:'/#/notifications'},
 {name:'users-security',path:'/#/users'},
 {name:'system-settings',path:'/#/settings'}
];
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const failures=[];
 for(const viewport of viewports){
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
  page.on('pageerror',error=>failures.push(error.message));
  for(const route of routes){
   await page.goto(BASE+route.path,{waitUntil:'networkidle',timeout:45000});
   await page.locator('.app-shell').waitFor({state:'visible',timeout:30000});
   await page.waitForTimeout(900);
   const direction=await page.locator('.app-shell').getAttribute('dir');
   if(direction!=='rtl') throw new Error('Arabic-first layout is not RTL on '+route.name+': '+direction);
   const filename=route.name+'-'+viewport.name+'-ar-rtl-dark.png';
   const output=OUT+'/'+filename;
   await page.screenshot({path:output,fullPage:false,animations:'disabled'});
   const png=fs.readFileSync(output);
   const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
   if(width!==viewport.width||height!==viewport.height) throw new Error('Screenshot '+filename+' has '+width+'x'+height+', expected '+viewport.width+'x'+viewport.height);
   console.log('Captured '+filename+' ('+width+'x'+height+')');
  }
  if(viewport.name==='desktop-1440x900'){
   await page.goto(BASE+'/#/dashboard',{waitUntil:'networkidle',timeout:45000});
   await page.locator('.app-shell').waitFor({state:'visible'});
   const themeButton=page.getByRole('button',{name:/الوضع الفاتح|Light mode/i});
   if(!(await themeButton.count())) throw new Error('Could not locate the light-theme toggle for screenshot verification.');
   await themeButton.first().click();
   await page.waitForTimeout(300);
   const output=OUT+'/dashboard-desktop-1440x900-ar-rtl-light.png';
   await page.screenshot({path:output,fullPage:false,animations:'disabled'});
   const png=fs.readFileSync(output);
   if(png.readUInt32BE(16)!==1440||png.readUInt32BE(20)!==900) throw new Error('Light theme screenshot dimensions are invalid.');
   console.log('Captured dashboard-desktop-1440x900-ar-rtl-light.png (1440x900)');
  }
  await page.close();
 }
 await browser.close();
 if(failures.length) throw new Error('Browser page errors: '+failures.join(' | '));
 console.log('Verified 13 exact-viewport screenshots in '+OUT);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
