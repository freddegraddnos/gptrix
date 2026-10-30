import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  c=await b.new_context(viewport={'width':1280,'height':1800},has_touch=True,is_mobile=True)
  page=await c.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080/rita'); await page.get_by_role('dialog').wait_for(timeout=60000)
  await page.get_by_role('button',name='Start sketching',exact=True).click()
  await page.set_viewport_size({'width':390,'height':844});await page.wait_for_timeout(1000)
  await page.get_by_role('button',name='Fit to screen',exact=True).click()
  await page.wait_for_timeout(4500)
  await page.screenshot(path='/tmp/browser/paint-menu/after-390x844.png')
  # touch drawing, actual existing pointer input path
  r=await page.locator('canvas').bounding_box();cdp=await c.new_cdp_session(page)
  for typ,x,y in [('touchStart',.4,.4),('touchMove',.45,.45),('touchMove',.5,.5),('touchEnd',.5,.5)]:
   await cdp.send('Input.dispatchTouchEvent',{'type':typ,'touchPoints':[] if typ=='touchEnd' else [{'x':r['x']+r['width']*x,'y':r['y']+r['height']*y,'force':.5}]})
  await page.wait_for_timeout(600)
  assert await page.get_by_role('button',name='Undo',exact=True).is_enabled()
  await page.get_by_role('button',name='Save sketch',exact=True).click()
  await page.get_by_role('textbox',name='Sketch name').fill('Menu test sketch')
  await page.get_by_role('button',name='Save version',exact=True).click()
  await page.get_by_text('Version saved',exact=True).wait_for()
  await page.keyboard.press('Escape'); await page.wait_for_timeout(600)
  print('save status',await page.get_by_role('status').all_text_contents())
  record=await page.evaluate('''async()=>{const m=await import('/src/lib/paint/projectStore.ts');const p=(await m.listProjects()).find(p=>p.name==='Menu test sketch');const v=await m.latestVersion(p.id);return {project:p.id,width:v.file.width,height:v.file.height,mm:v.file.mmPerPixel,png:v.file.nodes.filter(n=>n.kind==='layer').map(n=>n.png),nodes:v.file.nodes.length};}''')
  assert record['nodes']>=1 and record['width']==2480 and record['height']==3508
  assert abs(record['width']*record['mm']-210)<.1
  await page.screenshot(path='/tmp/browser/paint-menu/saved.png')
  await page.keyboard.press('e');await page.wait_for_timeout(100)
  assert await page.locator('header').get_by_role('button',name='Eraser',exact=True).count()==1
  await page.keyboard.press('b');await page.keyboard.press('Control+z');
  assert await page.get_by_role('button',name='Redo',exact=True).is_enabled()
  await page.keyboard.press('Control+Shift+z')
  assert await page.get_by_role('button',name='Undo',exact=True).is_enabled()
  for w,h in [(320,732),(390,844),(732,320),(844,390)]:
   await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(250)
   await page.get_by_role('button',name='Draw',exact=True).tap()
   assert await page.locator('#paint-context').count()==1
   canvas=await page.locator('canvas').bounding_box();panel=await page.locator('#paint-context').bounding_box()
   assert canvas['y']+canvas['height']<=panel['y']+.5
   await page.keyboard.press('Escape');await page.wait_for_timeout(150)
   assert await page.locator('#paint-context').count()==0
   assert await page.get_by_role('button',name='Draw',exact=True).evaluate('(el)=>el===document.activeElement')
   await page.get_by_role('button',name='Insert',exact=True).click();await page.wait_for_timeout(400)
   print('INSERT',await page.locator('#paint-context').inner_text())
   await page.get_by_role('button',name='Text',exact=True).click();await page.wait_for_timeout(250)
   rr=await page.locator('canvas').bounding_box()
   await page.locator('canvas').tap(position={'x':rr['width']*.5,'y':rr['height']*.5});await page.wait_for_timeout(400)
   print('text',w,h,'textarea',await page.locator('#paint-context textarea').count(),await page.locator('header').inner_text())
   await page.get_by_role('button',name='Layers',exact=True).click();await page.wait_for_timeout(400)
   print('PANEL COUNT',await page.locator('#paint-context').count(),errors);
   await page.screenshot(path='/tmp/browser/paint-menu/layer-debug.png')
   await page.get_by_role('button',name='New layer',exact=True).click()
   assert await page.get_by_role('button',name='New group',exact=True).is_visible()
   await page.screenshot(path=f'/tmp/browser/paint-menu/layers-{w}x{h}.png')
   await page.get_by_role('button',name='More',exact=True).tap()
   for name in ['Canvas and scale','Guides / symmetry','Adjustments','Stencil','Export','Print at 1:1 scale']:
    await page.get_by_role('button',name=name,exact=True).click();await page.wait_for_timeout(100)
    assert await page.locator('#paint-context').count()==1
    await page.get_by_role('button',name='Back to tools',exact=True).click()
   await page.get_by_role('button',name='Close tool panel',exact=True).click()
   await page.get_by_role('button',name='Fit to screen',exact=True).click()
   await page.screenshot(path=f'/tmp/browser/paint-menu/after-{w}x{h}.png')
  # reload and read back exact layer payload in UI; saved record untouched
  await page.reload();await page.get_by_role('dialog').wait_for(timeout=60000);await page.keyboard.press('Escape')
  await page.get_by_role('button',name='More',exact=True).click();await page.get_by_role('button',name='History / saved sketches',exact=True).click()
  await page.get_by_role('button',name=__import__('re').compile('^Menu test sketch')).click();await page.get_by_role('button',name='Open',exact=True).first.click()
  await page.wait_for_timeout(400)
  assert await page.locator('header').get_by_text('Menu test sketch',exact=True).is_visible()
  await page.get_by_role('button',name='Save sketch',exact=True).click();await page.get_by_role('button',name='Save version',exact=True).click();await page.get_by_text('Version saved',exact=True).wait_for()
  reopened=await page.evaluate('''async(id)=>{const m=await import('/src/lib/paint/projectStore.ts');const v=await m.latestVersion(id);return {width:v.file.width,height:v.file.height,mm:v.file.mmPerPixel,png:v.file.nodes.filter(n=>n.kind==='layer').map(n=>n.png),nodes:v.file.nodes.length};}''',record['project'])
  assert all(reopened[k]==record[k] for k in ['width','height','mm','png','nodes'])
  print('PASS touch draw, keyboard undo/redo, local version save/reload identical pixels/layers/scale, one panel and canvas separation all sizes; errors',errors)
  await page.keyboard.press('Escape')
  await page.evaluate("localStorage.setItem('inksimulator.public-studio-lang','sv')")
  await page.reload();await page.get_by_role('dialog').wait_for(timeout=60000);await page.keyboard.press('Escape');await page.wait_for_timeout(800)
  assert await page.get_by_role('button',name='Rita',exact=True).is_visible()
  await page.get_by_role('button',name='Mer',exact=True).click()
  await page.screenshot(path='/tmp/browser/paint-menu/swedish.png')
  await b.close()
asyncio.run(main())
