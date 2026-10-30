"""Keyboard test: motif dialog traps focus, closes on Escape and returns focus. Run against http://localhost:8080."""
import asyncio, sys
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await (await b.new_context(viewport={"width": 390, "height": 900})).new_page()
        await page.goto("http://localhost:8080/library", wait_until="networkidle"); await page.wait_for_timeout(1500)
        opener = page.get_by_role("button", name="View design").first
        await opener.scroll_into_view_if_needed(); await opener.focus(); await page.keyboard.press("Enter")
        dlg = page.get_by_role("dialog")
        await dlg.wait_for()
        inside = lambda: page.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)")
        assert await inside(), "focus did not move into dialog"
        for _ in range(12):
            await page.keyboard.press("Tab"); assert await inside(), "Tab escaped dialog"
        for _ in range(4):
            await page.keyboard.press("Shift+Tab"); assert await inside(), "Shift+Tab escaped dialog"
        hrefs = await dlg.locator("a").evaluate_all("els => els.map(e => e.getAttribute('href'))")
        assert all("motif=" in h for h in hrefs), hrefs
        await page.keyboard.press("Escape")
        await dlg.wait_for(state="detached")
        assert await opener.evaluate("e => e === document.activeElement"), "focus not returned to opener"
        print("PASS keyboard", hrefs); await b.close()
asyncio.run(main())
