"""Mocked public motif -> correct studio intake review. Never submits a request."""
import asyncio, json
from urllib.parse import urlparse
from playwright.async_api import async_playwright

MOTIF = "33333333-3333-4333-8333-333333333333"
STUDIO = "22222222-2222-4222-8222-222222222222"
RECEIVED = "44444444-4444-4444-8444-444444444444"
HANDLE = "test-studio"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width":390,"height":844},locale="en-GB")
        writes=[]
        status="available"
        async def guard(route):
            url=urlparse(route.request.url)
            if url.hostname in ("localhost","127.0.0.1") and url.port == 8080:
                await route.continue_(); return
            if url.hostname not in ("localhost","127.0.0.1") or url.port != 54321:
                await route.abort(); return
            path=url.path
            result=[]
            if path.endswith('/rpc/public_artist_page'):
                result={"user_id":STUDIO,"handle":HANDLE,"studio_name":"Fixture studio","city":"Fixture city","avatar_url":None}
            elif path.endswith('/marketplace_motifs'):
                result={"id":MOTIF,"artist_id":STUDIO,"name":"Fixture design","image_path":"test.png","description":"Fixture only","price_ore":0,"usage_terms":"Fixture usage terms","placements":["forearm"],"coverage":"single","published":True,"tattoo_availability":status,"tattoo_reuse":"unique","suggested_size_cm":12.5,"tattoo_price_note":"Fixture estimate"}
            elif path.endswith('/public_profiles'):result={"display_name":"Fixture artist"}
            elif path.endswith('/artist_profiles'):result={"handle":HANDLE,"studio_name":"Fixture studio"}
            elif '/storage/v1/object/sign/' in path:result={"signedURL":"/test.png"}
            elif path.endswith('/analytics_events'):result=[]
            elif route.request.method not in ('GET','HEAD') and '/rpc/' not in path:
                writes.append(path)
            await route.fulfill(status=200,content_type="application/json",body=json.dumps(result))
        await ctx.route('**/*',guard)
        page=await ctx.new_page()
        await page.goto(f'http://localhost:8080/shop/{MOTIF}',wait_until='domcontentloaded',timeout=90000)
        contact=page.get_by_role('link',name='I am interested in this design',exact=True)
        print("shop response",await page.title(),flush=True)
        await contact.wait_for(timeout=60000)
        print("shop contact ready",flush=True)
        await contact.click()
        await page.get_by_role('heading',name='Selected design',exact=True).wait_for(timeout=60000)
        print("intake ready",flush=True)
        section=page.locator('section').filter(has=page.get_by_role('heading',name='Selected design',exact=True))
        for text in ['Fixture design','Fixture studio','Available to tattoo','Unique design','12.5 cm','Fixture estimate']:
            assert await section.get_by_text(text,exact=False).count(), text
        assert await page.get_by_role('button',name='Sign in to review request',exact=True).count()==1
        assert f'/{HANDLE}/book' in page.url and MOTIF in page.url
        await page.evaluate('''args => sessionStorage.setItem('inkvision.booking-intake.v1:'+args.handle,JSON.stringify({requestKey:args.received,receivedRequestId:args.received,sourceMotifId:args.motif,name:'Fixture',email:'fixture@example.test',sizeUnsure:true,placementUnsure:true,description:'Original brief'}))''',{"handle":HANDLE,"received":RECEIVED,"motif":MOTIF})
        # Re-enter through the client router: the artist changes the offer after receipt.
        await page.goto(f'http://localhost:8080/shop/{MOTIF}',wait_until='domcontentloaded',timeout=90000)
        await page.get_by_role('link',name='I am interested in this design',exact=True).wait_for(timeout=60000)
        status="tattooed"
        await page.get_by_role('link',name='I am interested in this design',exact=True).click()
        await page.get_by_role('link',name='Open received request',exact=True).wait_for(timeout=60000)
        assert await page.get_by_role('heading',name='Selected design',exact=True).count()==0
        assert await page.locator('#share-review').count()==0
        assert await page.get_by_text('Nothing is sent until you press the button below.',exact=True).count()==0
        assert not writes,writes
        print('PASS: motif and studio retained; real offer metadata reviewed before auth; received state hides current mutable offer/unsent summary; no enquiry/payment/messages submitted.')
        await browser.close()

asyncio.run(main())
