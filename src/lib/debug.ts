/**
 * Internal debug flags. Default OFF — technical camera data (ISO, aperture)
 * should never be visible to regular users in production.
 *
 * Enable internally in the console:
 *   localStorage.setItem("inkvision.debug.camera", "1"); location.reload();
 */
export const DEBUG_CAMERA_TECH = false;

export function cameraTechVisible(): boolean {
  if (DEBUG_CAMERA_TECH) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("inkvision.debug.camera") === "1";
  } catch {
    return false;
  }
}

/**
 * Hidden computer-vision debug view.
 *
 * Draws the raw CV state straight over the camera: the cylinder proxy as a
 * wireframe, a dot at every tracked feature point, the limb segmentation mask
 * tinted translucent, plus point count and FPS. Off for regular users.
 *
 * Toggle: tap the "Live Preview" badge five times, or from the console:
 *   localStorage.setItem("inkvision.debug.cv", "1")
 */
const CV_KEY = "inkvision.debug.cv";

export function cvDebugVisible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CV_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCvDebug(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(CV_KEY, "1");
    else window.localStorage.removeItem(CV_KEY);
  } catch {
    /* storage blocked — the in-memory toggle still applies for this session */
  }
}
