"""Real IndexedDB recovery tests against the local Vite source server; no external traffic."""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
        context = await browser.new_context()
        async def route(req):
            if req.request.url == "http://localhost:8080/__draft_recovery_test":
                await req.fulfill(content_type="text/html", body="<!doctype html><title>Recovery test</title>")
            elif req.request.url.startswith("http://localhost:8080/"):
                await req.continue_()
            else:
                await req.abort()
        await context.route("**/*", route)
        page = await context.new_page()
        await page.goto("http://localhost:8080/__draft_recovery_test")
        await page.evaluate("""async () => {
          const d = await import('/src/lib/photoTryOnDraft.ts');
          const b = await import('/src/lib/pendingBooking.ts');
          const draft = {version:1, photoDataUrl:'data:image/png;base64,AAAA', motifId:'rose-051', pose:{x:.3,y:.6,scale:1.4,rotation:1.1,bend:120}, updatedAt:Date.now()};
          await d.savePhotoTryOnDraft(draft);
          const loaded = await d.loadPhotoTryOnDraft();
          if (JSON.stringify(loaded) !== JSON.stringify(draft)) throw Error('Editable draft mismatch');
          if (!await b.stashPendingTryOn({intent:'send', name:'First', tattooId:'rose-051', previewDataUrl:draft.photoDataUrl})) throw Error('Pending save failed');
          const first = await b.peekPendingTryOn();
          const again = await b.peekPendingTryOn();
          if (!first.projectId || first.projectId !== again.projectId) throw Error('Retry did not preserve identity');
          await b.stashPendingTryOn({intent:'send', name:'Newer', previewDataUrl:draft.photoDataUrl});
          await b.acknowledgePendingTryOn(first);
          if ((await b.peekPendingTryOn()).name !== 'Newer') throw Error('Acknowledgement removed newer work');
        }""")
        await page.reload()
        await page.evaluate("""async () => {
          const d = await import('/src/lib/photoTryOnDraft.ts');
          const b = await import('/src/lib/pendingBooking.ts');
          const draft = await d.loadPhotoTryOnDraft();
          if (draft.motifId !== 'rose-051' || draft.pose.scale !== 1.4 || draft.pose.rotation !== 1.1) throw Error('Reload lost editable placement');
          const pending = await b.peekPendingTryOn();
          if (pending.name !== 'Newer') throw Error('Reload lost pending photo');
          await b.acknowledgePendingTryOn(pending);
          if (await b.peekPendingTryOn()) throw Error('Acknowledged recovery not removed');
          await d.deletePhotoTryOnDraft();
          if (await d.loadPhotoTryOnDraft()) throw Error('Deleted device draft retained');
        }""")
        print("PASS: editable draft survives reload; pending save retains identity until acknowledgement; newer work protected; explicit deletion verified")
        await browser.close()

asyncio.run(main())
