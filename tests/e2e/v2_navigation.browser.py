"""Local navigation regression: block all external traffic; no real login or requests."""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get('INK_TEST_URL', 'http://localhost:8080')
OUT = Path(os.environ.get('INK_TEST_ARTIFACTS', '/workspace/verification'))

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width':390,'height':844})
        async def guard(route):
            if route.request.url.startswith(BASE + '/'):
                await route.continue_()
            elif route.request.url.startswith('http://127.0.0.1:54321/'):
                await route.fulfill(status=200, content_type='application/json', body='[]')
            else:
                await route.abort()
        await context.route('**/*', guard)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE + '/', wait_until='networkidle', timeout=90000)
        await page.get_by_role('heading', name='YOUR NEXT TATTOO.').wait_for()
        assert await page.locator('a[href="/artists"]').count() >= 1
        assert await page.locator('a[href="/studios"]').count() >= 1
        assert await page.locator('a[href="/ar?start=design"]').count() == 1
        assert await page.locator('a[href^="/ar?motif="]').count() == 3
        for width in [320,390,1440]:
            await page.set_viewport_size({'width':width,'height':844})
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}'
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_role('button',name='SV',exact=True).click()
        await page.get_by_role('heading',name='DIN NÄSTA TATUERING.').wait_for()
        assert await page.locator('a[href="/sv/artists"]').count() >= 1
        await page.screenshot(path=str(OUT/'home-sv-mobile.png'),full_page=True)
        await page.locator('a[href="/sv/artists"]').first.click()
        await page.get_by_role('button',name='Logga in →',exact=True).wait_for(timeout=60000)
        signup = page.locator('a[href*="mode=signup"]')
        await signup.wait_for()
        await signup.click()
        await page.wait_for_url('**/auth?**')
        assert 'redirect=%2Fartists%2Fdashboard' in page.url or 'redirect=/artists/dashboard' in page.url
        await page.locator('input[type="password"]').first.wait_for()
        await page.screenshot(path=str(OUT/'studio-signup-mobile.png'),full_page=True)
        # Do not submit: confirmation mail and account creation require an isolated auth backend.
        assert not errors, errors
        print(json.dumps({'passed':['home EN/SV','direct artist discovery','studio login to signup and preserved redirect','existing motif links','320/390/1440 no horizontal overflow'],'pageErrors':errors}))
        await browser.close()

asyncio.run(main())
