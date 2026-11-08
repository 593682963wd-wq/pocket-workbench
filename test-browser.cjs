/** 独立浏览器、合成数据、无账户；所有页面请求限制为本机测试源。 */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.TEST_URL||'http://127.0.0.1:8080';
const out=process.env.SCREENSHOT_DIR||'work/screenshots';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const report={checks:[],externalRequests:[],errors:[]};
 const check=(name,condition)=>{assert.ok(condition,name);report.checks.push(name)};
 try {
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).origin!==base){report.externalRequests.push(route.request().url());return route.abort()}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base);await page.locator('#linksEmpty').waitFor();
  check('empty initial state',await page.locator('#linksGrid .link-item').count()===0);
  await page.locator('#todoInput').fill('Synthetic task');await page.locator('#todoForm button').click();
  check('task added',await page.locator('#todoList').innerText().then(t=>t.includes('Synthetic task')));
  await page.locator('#noteText').fill('Synthetic note');await page.waitForTimeout(800);
  await page.locator('#btnAddLink').click();await page.locator('#linkName').fill('Sample documentation');await page.locator('#linkUrl').fill('https://example.invalid/docs');await page.locator('#btnLinkSave').click();
  check('bookmark added without icon lookup',await page.locator('#linksGrid .link-item').count()===1);
  await page.reload();await page.locator('#noteText').waitFor();
  check('local data persisted',await page.locator('#noteText').inputValue()==='Synthetic note'&&await page.locator('#todoList').innerText().then(t=>t.includes('Synthetic task')));
  await page.locator('#btnSettings').click();await page.locator('#setTheme').selectOption('dark');await page.locator('#btnSettingsSave').click();
  check('theme changes',await page.locator('html').getAttribute('data-theme')==='dark');
  await page.locator('#btnAddLink').click();await page.keyboard.press('Escape');
  check('Escape closes dialog',await page.locator('#linkModal').isHidden());
  await page.locator('#btnSettings').click();await page.locator('#setTheme').selectOption('light');await page.locator('#btnSettingsSave').click();
  await page.waitForTimeout(2500);
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  check('mobile no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);await page.reload();await page.locator('#noteText').waitFor();
  check('offline shell and data',await page.locator('#noteText').inputValue()==='Synthetic note');
  check('no external page requests',report.externalRequests.length===0);
  check('no runtime errors',report.errors.length===0);
  report.status='PASS';
 } catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1}
 finally {await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
})();
