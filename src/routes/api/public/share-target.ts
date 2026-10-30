import { createFileRoute } from "@tanstack/react-router";

/**
 * PWA share target: the phone's share menu posts an image here.
 * We respond with a small page that stores the image in localStorage and
 * forwards the user to the "Try It On Me" flow.
 */
const MAX_BYTES = 12 * 1024 * 1024;

function page(dataUrl: string | null) {
  const payload = dataUrl ? JSON.stringify(dataUrl) : "null";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>InkSimulator</title>
<style>body{background:#050505;color:#fff;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}</style>
</head><body><p>Opening InkSimulator…</p><script>
try{var d=${payload};if(d){localStorage.setItem("inkvision.shared.image",d);}}catch(e){}
location.replace("/try-it-on");
</script></body></html>`;
}

export const Route = createFileRoute("/api/public/share-target")({
  server: {
    handlers: {
      GET: async () =>
        new Response(page(null), {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      POST: async ({ request }) => {
        let dataUrl: string | null = null;
        try {
          const form = await request.formData();
          const file = (form.get("image") ?? form.get("file")) as File | null;
          if (file && typeof file === "object" && file.size > 0) {
            if (file.size > MAX_BYTES) throw new Error("too large");
            const buf = new Uint8Array(await file.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            const type = file.type?.startsWith("image/") ? file.type : "image/png";
            dataUrl = `data:${type};base64,${btoa(bin)}`;
          }
        } catch {
          dataUrl = null;
        }
        return new Response(page(dataUrl), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
