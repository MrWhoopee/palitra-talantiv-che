import {
  ACESFilmicToneMapping,
  AmbientLight,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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

  // Something for metal to reflect.
  //
  // A `MeshStandardMaterial` with metalness reflects an environment and
  // nothing else; in a room with no environment it renders black, which is
  // exactly how the camera prop first came back. `RoomEnvironment` is
  // generated in memory - no file to fetch, no HDRI to license - and it is
  // what will make an imported model look like the object it is.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

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

/**
 * An aperture, closed over the frame.
 *
 * Six straight blades that turn as they retract - the way a lens opens, which
 * is the right way to open a page about portraits. Play draws it back; pause
 * closes it.
 *
 * Drawn as one quad with a shader rather than as six meshes. The blades of a
 * real aperture meet along straight chords, and a chord is exactly what a
 * polygon distance is: solving it per pixel is shorter and cleaner than
 * arranging six planes and hoping their corners never part.
 */
export interface Iris {
  readonly mesh: Mesh;
  /** 0 is shut, 1 is fully open. */
  setOpen(open: number): void;
  setAspect(aspect: number): void;
  dispose(): void;
}

const IRIS_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const IRIS_FRAGMENT = `
precision mediump float;

varying vec2 vUv;
uniform float u_open;
uniform float u_aspect;
uniform vec3 u_blade;
uniform vec3 u_rim;

const float BLADES = 6.0;
const float PI = 3.14159265;

void main() {
  vec2 p = (vUv - 0.5) * vec2(u_aspect, 1.0) * 2.0;
  float d = length(p);
  float angle = atan(p.y, p.x);

  // The blades turn as they go, so the opening reads as a mechanism rather
  // than as a hole being scaled up.
  float turn = (1.0 - u_open) * 0.7;
  float wedge = 2.0 * PI / BLADES;
  float local = mod(angle + turn + PI, wedge) - wedge * 0.5;

  // Centre to blade edge at this angle: a straight chord, which is what makes
  // the opening a polygon rather than a circle.
  float reach = (u_open * 2.2) / cos(local);

  if (d < reach) discard;

  // A bright edge where the blades meet the opening: a lens catches light
  // there, and without it the aperture is a flat mask.
  float rim = smoothstep(0.16, 0.0, d - reach);
  gl_FragColor = vec4(mix(u_blade, u_rim, rim), 1.0);
}`;

export function createIris(): Iris {
  const material = new ShaderMaterial({
    vertexShader: IRIS_VERTEX,
    fragmentShader: IRIS_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    // Marked transparent although it never blends. three.js draws every
    // transparent object after every opaque one, so an opaque mask ends up
    // *under* anything with transparency on it - which is how the cover came
    // back with the camera body hidden and its glass floating over the mask.
    transparent: true,
    uniforms: {
      u_open: { value: 0 },
      u_aspect: { value: 1 },
      u_blade: { value: new Color(0x0a0810) },
      u_rim: { value: new Color(0x8f6bf0) },
    },
  });

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  // Drawn last and never culled: it is in front of everything by definition.
  mesh.frustumCulled = false;
  mesh.renderOrder = 999;

  return {
    mesh,

    setOpen(open) {
      material.uniforms['u_open']!.value = open;
    },

    setAspect(aspect) {
      material.uniforms['u_aspect']!.value = aspect;
    },

    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * A backdrop to stand a cover against.
 *
 * A cover has to be a picture in its own right: whatever the scene behind it
 * is made of - a figure waiting, light running past - must not show through,
 * or the cover gives away the room before the door is opened.
 *
 * It is a photographer's sweep: one dark ground with a pool of light where
 * the subject stands, which is the backdrop the object in front of it belongs
 * to. Painted into a canvas rather than fetched, so there is no file and no
 * licence, and the colour comes from the site's own palette.
 */
export interface Backdrop {
  readonly mesh: Mesh;
  /** Fades out as the cover is left behind. */
  setOpacity(opacity: number): void;
  dispose(): void;
}

export function createBackdrop(pool: string, ground: string): Backdrop {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d')!;
  context.fillStyle = ground;
  context.fillRect(0, 0, size, size);

  // The pool sits a little above centre, where a light aimed at somebody
  // standing would put it.
  const glow = context.createRadialGradient(
    size / 2,
    size * 0.42,
    0,
    size / 2,
    size * 0.42,
    size * 0.62,
  );
  glow.addColorStop(0, pool);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  // Wide enough to fill any window it is asked to stand behind.
  const mesh = new Mesh(new PlaneGeometry(34, 20), material);

  return {
    mesh,

    setOpacity(opacity) {
      material.opacity = opacity;
      mesh.visible = opacity > 0.01;
    },

    dispose() {
      mesh.geometry.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
