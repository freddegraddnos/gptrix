/**
 * Real-time person segmentation (MediaPipe Selfie Segmentation) used to
 * occlude the tattoo.
 *
 * A tattoo that always renders on top is the fastest way an AR overlay reads
 * as fake. The segmenter tells us, per pixel, what belongs to the person; a
 * cheap skin test then splits that further. Anything inside the tattoo's
 * region that is *not* bare skin of the tattooed limb — a sleeve, a watch, a
 * strand of hair, an object crossing in front — is repainted from the live
 * video on a layer above the tattoo, so it occludes the ink.
 */

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

/** Working resolution of the mask; upscaled with blur when composited. */
const MASK_W = 192;

export type SegMask = {
  data: Uint8Array;
  width: number;
  height: number;
};

export class PersonSegmenter {
  private segmenter: {
    segmentForVideo: (v: HTMLVideoElement, ts: number) => unknown;
    close?: () => void;
  } | null = null;
  private loading: Promise<void> | null = null;
  private failed = false;

  /** Lazily creates the segmenter; safe to call every frame. */
  async ensure(wasmBase: string): Promise<boolean> {
    if (this.segmenter) return true;
    if (this.failed) return false;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const vision = await import("@mediapipe/tasks-vision");
          const fileset = await vision.FilesetResolver.forVisionTasks(wasmBase);
          this.segmenter = (await vision.ImageSegmenter.createFromOptions(
            fileset,
            {
              baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
              runningMode: "VIDEO",
              outputCategoryMask: true,
              outputConfidenceMasks: false,
            },
          )) as unknown as PersonSegmenter["segmenter"];
        } catch {
          this.failed = true;
        }
      })();
    }
    await this.loading;
    return !!this.segmenter;
  }

  /** Person mask for the current frame, or null when unavailable. */
  segment(video: HTMLVideoElement, timestampMs: number): SegMask | null {
    if (!this.segmenter) return null;
    try {
      const res = this.segmenter.segmentForVideo(video, timestampMs) as {
        categoryMask?: {
          getAsUint8Array: () => Uint8Array;
          width: number;
          height: number;
          close?: () => void;
        };
        close?: () => void;
      } | null;
      const mask = res?.categoryMask;
      if (!mask) return null;
      const out = {
        data: new Uint8Array(mask.getAsUint8Array()),
        width: mask.width,
        height: mask.height,
      };
      mask.close?.();
      res?.close?.();
      return out;
    } catch {
      return null;
    }
  }

  close() {
    this.segmenter?.close?.();
    this.segmenter = null;
    this.loading = null;
  }
}

/** Rough skin test in YCbCr — tolerant across skin tones. */
function isSkin(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return y > 30 && cb >= 77 && cb <= 135 && cr >= 130 && cr <= 180;
}

/**
 * Builds an alpha mask (white = occluding) for the tattoo's region.
 *
 * @param frame the current camera frame, already in canvas orientation
 * @param person person mask from {@link PersonSegmenter}, or null
 * @param region tattoo area in canvas pixels
 */
export function buildOcclusionMask(
  frame: HTMLCanvasElement,
  person: SegMask | null,
  region: { x: number; y: number; radius: number },
  mirrored: boolean,
  out?: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const w = MASK_W;
  const h = Math.max(2, Math.round((MASK_W * frame.height) / frame.width));
  const canvas = out ?? document.createElement("canvas");
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(frame, 0, 0, w, h);
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const px = img.data;

  const sx = w / frame.width;
  const cx = region.x * sx;
  const cy = region.y * sx;
  const rad = region.radius * sx * 1.25;
  const rad2 = rad * rad;

  let any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > rad2) {
        px[i + 3] = 0;
        continue;
      }
      // Sample the person mask (0 = background for the selfie segmenter).
      let isPerson = true;
      if (person) {
        // The frame canvas may be mirrored (front camera); the segmenter
        // always sees the raw video, so flip the lookup back.
        const u = mirrored ? 1 - x / w : x / w;
        const mx = Math.min(person.width - 1, Math.round(u * person.width));
        const my = Math.min(
          person.height - 1,
          Math.round((y / h) * person.height),
        );
        isPerson = person.data[my * person.width + mx] !== 0;
      }
      const skin = isSkin(px[i], px[i + 1], px[i + 2]);
      // Occlude where the frame is not bare skin of the person: background
      // showing through, or clothing/hair/objects in front of the limb.
      const occludes = !isPerson || !skin;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = occludes ? 255 : 0;
      if (occludes) any = true;
    }
  }
  if (!any) return null;
  ctx.putImageData(img, 0, 0);
  return canvas;
}
