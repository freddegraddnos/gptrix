/**
 * Three.js overlay scene matched to the camera feed's exact resolution and aspect ratio.
 * Browser-only — call from an effect.
 */
import * as THREE from "three";

export type MpScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  /** Match drawing buffer to the camera resolution and fit (cover) the container. */
  resize: (videoW: number, videoH: number) => void;
  render: () => void;
  dispose: () => void;
};

export function createMpScene(canvas: HTMLCanvasElement, container: HTMLElement): MpScene {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // Pixel-space ortho camera: (0,0) top-left, (w,h) bottom-right of the video frame.
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000);
  let vw = 0, vh = 0;

  const resize = (videoW: number, videoH: number) => {
    if (!videoW || !videoH) return;
    vw = videoW; vh = videoH;
    renderer.setPixelRatio(1);
    renderer.setSize(videoW, videoH, false);
    camera.left = 0; camera.right = videoW; camera.top = 0; camera.bottom = videoH;
    camera.updateProjectionMatrix();
    const cw = container.clientWidth, ch = container.clientHeight;
    const s = Math.max(cw / videoW, ch / videoH);
    Object.assign(canvas.style, {
      position: "absolute",
      width: `${videoW * s}px`,
      height: `${videoH * s}px`,
      left: `${(cw - videoW * s) / 2}px`,
      top: `${(ch - videoH * s) / 2}px`,
    });
  };

  const onWin = () => resize(vw, vh);
  window.addEventListener("resize", onWin);
  window.addEventListener("orientationchange", onWin);

  return {
    renderer, scene, camera, resize,
    render: () => renderer.render(scene, camera),
    dispose: () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("orientationchange", onWin);
      renderer.dispose();
    },
  };
}
