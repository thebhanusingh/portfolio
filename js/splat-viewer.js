/**
 * Interactive Gaussian splat viewer (PlayCanvas, self-hosted in js/vendor).
 * Nothing heavy loads until the visitor clicks "Explore in 3D" on a
 * .splat-viewer block. Per-block settings come from data attributes:
 *   data-src       .sog file
 *   data-camera    start position "x,y,z"
 *   data-focus     orbit target "x,y,z"
 *   data-rotation  splat rotation in degrees "x,y,z" (exports are in COLMAP space)
 */
const ENGINE = new URL('./vendor/playcanvas/playcanvas.min.mjs', import.meta.url).href;
const CONTROLS = new URL('./vendor/playcanvas/camera-controls.mjs', import.meta.url).href;

const vec = (s, fallback) => (s || fallback).split(',').map(Number);

function webgl2Available() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

async function start(root) {
  const stage = root.querySelector('.splat-viewer__stage');
  const status = root.querySelector('.splat-viewer__status');
  const setStatus = (text) => { status.textContent = text; };

  if (!webgl2Available()) {
    root.dataset.state = 'error';
    setStatus('This browser can’t show the 3D view (WebGL 2 is off or unsupported).');
    return;
  }

  root.dataset.state = 'loading';
  setStatus('Loading 3D viewer…');

  try {
    const [pc, { CameraControls }] = await Promise.all([import(ENGINE), import(CONTROLS)]);

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', root.dataset.label || '3D view');
    stage.appendChild(canvas);

    const app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      graphicsDeviceOptions: { antialias: false }
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => app.resizeCanvas(stage.clientWidth, stage.clientHeight);
    new ResizeObserver(fit).observe(stage);
    fit();
    app.start();

    const asset = new pc.Asset(root.dataset.label || 'splat', 'gsplat', { url: root.dataset.src });
    asset.on('progress', (received, total) => {
      if (total) setStatus(`Loading splat… ${Math.round((received / total) * 100)}%`);
    });
    app.assets.add(asset);
    await new Promise((resolve, reject) => {
      asset.once('load', resolve);
      asset.once('error', reject);
      app.assets.load(asset);
    });

    const splat = new pc.Entity('splat');
    splat.addComponent('gsplat', { asset });
    splat.setLocalEulerAngles(...vec(root.dataset.rotation, '0,0,0'));
    app.root.addChild(splat);

    const focus = new pc.Vec3(...vec(root.dataset.focus, '0,0,0'));
    const home = new pc.Vec3(...vec(root.dataset.camera, '0,0,3'));
    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.043, 0.043, 0.05),
      fov: Number(root.dataset.fov || 65),
      nearClip: 0.01,
      farClip: 200
    });
    camera.setPosition(home);
    app.root.addChild(camera);
    camera.addComponent('script');
    const controls = camera.script.create(CameraControls);
    controls.focusPoint = focus;
    controls.moveSpeed = 2;
    controls.moveFastSpeed = 4;
    controls.moveSlowSpeed = 0.5;
    controls.zoomRange = new pc.Vec2(0.05, 20);

    root.querySelector('[data-action="reset"]').addEventListener('click', () => controls.reset(focus, home));
    const full = root.querySelector('[data-action="fullscreen"]');
    if (root.requestFullscreen) {
      full.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else root.requestFullscreen().catch(() => {});
      });
    } else {
      full.hidden = true;
    }

    root.dataset.state = 'ready';
    setStatus('');
    root.dispatchEvent(new CustomEvent('splat-ready', { bubbles: true }));
  } catch (err) {
    console.error(err);
    root.dataset.state = 'error';
    setStatus('The 3D view couldn’t load. Try refreshing, or use a desktop browser.');
  }
}

document.querySelectorAll('.splat-viewer').forEach((root) => {
  const button = root.querySelector('.splat-viewer__start');
  if (button) button.addEventListener('click', () => start(root), { once: true });
});
