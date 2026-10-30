/** Still-photo placement is intentionally 2D and independent of live AR tracking. */
export type PhotoPose = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  bend: number;
};

export function drawPhotoTattoo(
  ctx: CanvasRenderingContext2D,
  motif: HTMLImageElement,
  pose: PhotoPose,
  width: number,
  height: number,
) {
  if (!motif.naturalWidth || !motif.naturalHeight) return;
  const motifWidth = width * 0.45 * pose.scale;
  const motifHeight = motifWidth * motif.naturalHeight / motif.naturalWidth;
  const bend = Math.max(0, Math.min(1, (180 - pose.bend) / 90));

  ctx.save();
  ctx.translate(pose.x * width, pose.y * height);
  ctx.rotate(pose.rotation);
  // A gentle surface tilt/compression for the manual bend control. Drawing the
  // whole image in one operation avoids seams and broken WebGL texture strips.
  ctx.transform(1 - bend * 0.12, bend * 0.07, bend * 0.08, 1 - bend * 0.16, 0, 0);
  ctx.globalAlpha = 0.92;
  ctx.globalCompositeOperation = "multiply";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(motif, -motifWidth / 2, -motifHeight / 2, motifWidth, motifHeight);
  ctx.restore();
}