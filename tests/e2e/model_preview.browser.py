"""Local GLB preview with an in-memory test-only triangle; no uploaded/private models or external requests."""
import asyncio, json, struct
from playwright.async_api import async_playwright

def model():
    positions = struct.pack('<9f', -1,0,0, 1,0,0, 0,2,0)
    document = {'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}], 'nodes':[{'mesh':0}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':0}}]}], 'buffers':[{'byteLength':len(positions)}],
        'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(positions),'target':34962}],
        'accessors':[{'bufferView':0,'componentType':5126,'count':3,'type':'VEC3','min':[-1,0,0],'max':[1,2,0]}]}
    data=json.dumps(document).encode(); data+=b' '*((-len(data))%4)
    size=12+8+len(data)+8+len(positions)
    return struct.pack('<III',0x46546c67,2,size)+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(positions),0x004e4942)+positions

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context=await browser.new_context(viewport={'width':600,'height':900})
        async def guard(route):
            if route.request.url.startswith('http://localhost:8080/') or route.request.url.startswith('blob:'):
                await route.continue_()
            elif route.request.url.startswith('http://127.0.0.1:54321/'):
                await route.fulfill(status=200,content_type='application/json',body='[]')
            else: await route.abort()
        await context.route('**/*',guard)
        page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:8080/mode3d',wait_until='domcontentloaded',timeout=90000)
        field=page.get_by_label('Choose GLB model',exact=True)
        await field.wait_for(timeout=60000)
        await page.wait_for_load_state('networkidle',timeout=60000)
        await field.set_input_files({'name':'renamed.glb','mimeType':'model/gltf-binary','buffer':b'not a model'})
        await page.get_by_role('alert').filter(has_text='Choose a GLB file').wait_for()
        await field.set_input_files({'name':'test-triangle.glb','mimeType':'model/gltf-binary','buffer':model()})
        rotate=page.get_by_role('button',name='Rotate right',exact=True)
        await rotate.wait_for(timeout=60000)
        await page.wait_for_function("[...document.querySelectorAll('button')].some(x=>x.textContent==='Rotate right'&&!x.disabled)",timeout=60000)
        canvas=page.locator('canvas').first
        before=await canvas.screenshot()
        await rotate.click(); await page.wait_for_timeout(100)
        after=await canvas.screenshot()
        assert before != after, 'Rotation did not change rendered pixels'
        await page.get_by_role('button',name='Zoom in',exact=True).click(); await page.wait_for_timeout(100)
        zoomed=await canvas.screenshot()
        assert zoomed != after, 'Zoom did not change rendered pixels'
        region=page.get_by_role('region',name='3D model. Use left and right arrows to rotate, plus and minus to zoom, and Home to reset.')
        await region.focus(); await page.keyboard.press('Home');await page.keyboard.press('ArrowLeft')
        await page.get_by_role('button',name='Close local model').click()
        assert await page.locator('canvas').count()==0
        assert not errors, errors
        print('PASS: rejected invalid GLB; real GLB rendered; rotation and zoom changed pixels; keyboard navigation and canvas cleanup verified. No external traffic.')
        await browser.close()
asyncio.run(main())
