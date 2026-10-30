import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  c=await b.new_context(viewport={'width':1280,'height':1800},has_touch=True,is_mobile=True)
  page=await c.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080/library')
  await page.evaluate("sessionStorage.setItem('inkvision:paint-return-to','/library?motif=menu-test');localStorage.setItem('inksimulator.public-studio-lang','en')")
  await page.goto('http://localhost:8080/rita');await page.get_by_role('dialog').wait_for(timeout=60000)
  await page.get_by_role('button',name='Start sketching',exact=True).click();await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(700)
  await page.get_by_role('button',name='Save sketch',exact=True).click()
  await page.get_by_role('textbox',name='Sketch name').fill('Synthetic failed save')
  await page.evaluate("()=>{window.originalTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){if(mode==='readwrite')throw new Error('Synthetic quota failure');return window.originalTransaction.call(this,stores,mode,...args)}}")
  await page.get_by_role('button',name='Save version',exact=True).click()
  await page.get_by_text('The sketch could not be saved on this device',exact=True).wait_for()
  await page.keyboard.press('Escape');await page.wait_for_timeout(200)
  assert await page.locator('header').get_by_text('Save failed · retry',exact=True).is_visible()
  await page.screenshot(path='/tmp/browser/paint-menu/save-error.png')
  await page.evaluate('()=>{IDBDatabase.prototype.transaction=window.originalTransaction}')
  await page.get_by_role('button',name='Leave the drawing studio',exact=True).click()
  await page.get_by_role('menuitem',name='Back to where I came from').click()
  await page.wait_for_url('**/library?motif=menu-test')
  assert await page.evaluate("sessionStorage.getItem('inkvision:paint-return-to')") is None
  print('PASS failed save shown honestly; origin return retains query and clears only return key; runtime errors:',errors)
  await b.close()
asyncio.run(main())
