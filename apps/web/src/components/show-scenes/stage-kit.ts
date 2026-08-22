import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * What every scene in the show is built on.
 *
 * The hall came first and set the terms: a dark room, violet in the shadows,
 * one warm light doing the work. Each track gets its own scene, and they have
 * to look like seven views of one studio rather than seven demos - so the
 * room, the tone mapping and the quality tiers are decided once, here, and
 * only what stands in the room differs.
 *
 * Quality is a tier rather than a set of switches, for the reason the hall
 * gives: the point is to hold a frame rate, not to lose effects one at a time
 * until the scene looks broken in a way nobody chose.
 */

export type Quality = 'high' | 'low';

export interface SceneRoom {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly high: boolean;
}

export interface RoomOptions {
  /**
   * Whether the room has a floor. The hall needs one - there are instruments
   * standing on it. A scene that is only a wash and a figure does not: a floor
   * puts a hard horizon across the frame and cuts the figure in half.
   */
  readonly floor?: boolean;
}

export function createRoom(
  canvas: HTMLCanvasElement,
  quality: Quality,
  options: RoomOptions = {},
): SceneRoom {
  const high = quality === 'high';

  const renderer = new WebGLRenderer({
    canvas,
    antialias: high,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  scene.fog = new FogExp2(0x05040a, 0.05);

  if (options.floor !== false) {
    const floor = new Mesh(
      new PlaneGeometry(80, 60),
      new MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.62, metalness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = high;
    scene.add(floor);
  }

  // The ambient carries the violet the rest of the site is built on, so the
  // shadows belong to this studio rather than being a generic grey.
  scene.add(new AmbientLight(0x2a2038, 0.55));

  const rim = new DirectionalLight(0x6f78ff, 0.35);
  rim.position.set(-6, 7, -8);
  scene.add(rim);

  const camera = new PerspectiveCamera(42, 1, 0.1, 120);

  return { renderer, scene, camera, high };
}

export interface Loop {
  stop(): void;
}

/**
 * The frame loop, with the delta clamped: a tab that was in the background
 * comes back with one enormous step, and anything eased by it would jump.
 */
export function runLoop(onFrame: (delta: number, time: number) => void): Loop {
  const clock = new Clock();
  let time = 0;
  let frame = 0;
  let running = true;

  const tick = () => {
    if (!running) return;
    frame = requestAnimationFrame(tick);

    const delta = Math.min(clock.getDelta(), 0.05);
    time += delta;
    onFrame(delta, time);
  };

  frame = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
  };
}

/**
 * Frame-rate independent easing towards a target: the same flick lands in the
 * same place at 60Hz and at 144Hz, which a plain `+= (target - current) * 0.1`
 * does not manage.
 */
export function approach(current: number, target: number, rate: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * delta));
}

export function fitCamera(room: SceneRoom, width: number, height: number, portrait: boolean): void {
  room.camera.aspect = width / height;
  // A narrow window sees less of the room across, so the lens widens -
  // otherwise a phone is looking at the scene through a keyhole.
  room.camera.fov = portrait ? 58 : 42;
  room.camera.updateProjectionMatrix();
  room.renderer.setSize(width, height, false);
}
