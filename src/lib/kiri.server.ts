/**
 * Thin client for the KIRI Engine Open API (video scan mode).
 * The API key is read from the environment in the calling handler and passed in here.
 */

const BASE = "https://api.kiriengine.app/api/v1/open";

export type KiriStatus =
  | { state: "processing"; raw: number }
  | { state: "done"; raw: number }
  | { state: "failed"; raw: number; message: string };

async function kiriFetch(path: string, apiKey: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || (json && json.ok === false)) {
    const msg = json?.msg ?? json?.message ?? text.slice(0, 300);
    throw new Error(`kiri_error:${res.status}:${msg}`);
  }
  return json;
}

/** Uploads the video in video-scan mode and returns KIRI's task id (serialize). */
export async function uploadVideoScan(
  apiKey: string,
  video: Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("videoFile", video, filename);
  form.append("modelQuality", "0"); // 0 = high
  form.append("textureQuality", "0");
  form.append("fileFormat", "GLB");
  form.append("isMask", "1");
  form.append("textureSmoothing", "0");

  const json = await kiriFetch("/photo/video", apiKey, { method: "POST", body: form });
  const serialize = json?.data?.serialize ?? json?.data?.taskId;
  if (!serialize) throw new Error("kiri_error:no_task_id");
  return String(serialize);
}

/** Asks KIRI for the processing status. */
export async function getScanStatus(apiKey: string, serialize: string): Promise<KiriStatus> {
  const json = await kiriFetch(
    `/model/getStatus?serialize=${encodeURIComponent(serialize)}`,
    apiKey,
  );
  const status = Number(json?.data?.status ?? -1);
  // KIRI: 0 = uploading, 1 = processing, 2 = failed, 3 = done, 4 = queuing, 5 = expired
  if (status === 3) return { state: "done", raw: status };
  if (status === 2 || status === 5) {
    return {
      state: "failed",
      raw: status,
      message:
        status === 5
          ? "The model has expired at the provider."
          : "The reconstruction failed – often due to a too shaky or blurry video.",
    };
  }
  return { state: "processing", raw: status };
}

/** Fetches the download link to the finished model (zip). */
export async function getModelZipUrl(apiKey: string, serialize: string): Promise<string> {
  const json = await kiriFetch(
    `/model/getModelZip?serialize=${encodeURIComponent(serialize)}`,
    apiKey,
  );
  const url = json?.data?.modelUrl ?? json?.data?.url;
  if (!url) throw new Error("kiri_error:no_model_url");
  return String(url);
}
