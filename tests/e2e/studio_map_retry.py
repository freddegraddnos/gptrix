"""Simulated first WebGL init failure: error shows, 'Try again' builds one map, list option works."""
import asyncio
from playwright.async_api import async_playwright

FAIL_ONCE = """
(() => { let n = 0; const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...a) {
    if (/webgl/.test(type) && !window.__glOk) return null; return orig.call(this, type, ...a); }; })();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width": 390, "height": 900}, locale="sv-SE")
        page = await ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if "already initialized" in m.text else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto("http://localhost:8080/studios", wait_until="networkidle"); await page.wait_for_timeout(1500)
        await page.evaluate(FAIL_ONCE)
        await page.get_by_role("button", name="Map", exact=True).click()
        await page.get_by_role("button", name="Try again").wait_for(timeout=20000)
        print("error text:", (await page.get_by_role("alert").inner_text()).replace("\n", " | "))
        assert await page.get_by_role("button", name="Show studio list").is_visible(), "list option missing"
        await page.evaluate("window.__glOk = true")
        await page.get_by_role("button", name="Try again").click()
        await page.wait_for_timeout(6000)
        still = await page.get_by_role("button", name="Try again").count()
        n = await page.evaluate("document.querySelectorAll('.leaflet-container').length")
        print("error after retry:", still, "leaflet containers:", n, "errors:", errors)
        assert still == 0 and n == 1 and not errors
        assert "nearby" not in (await page.inner_text("main")).lower(), "nearby shown without known origin"
        await page.screenshot(path="/tmp/browser/a11y/map_retry.png")
        print("PASS map"); await b.close()
asyncio.run(main())
