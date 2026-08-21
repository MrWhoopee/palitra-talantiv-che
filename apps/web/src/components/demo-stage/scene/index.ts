import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Clock,
  ConeGeometry,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SpotLight,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { LANDSCAPE_PATH, PORTRAIT_PATH, sampleCamera, type Keyframe } from './camera-path';
import { createCurtains, type Curtains } from './curtains';
import { createGuitar } from './guitar';
import { createLogo, type LogoMark } from './logo';
import { createMaterials } from './materials';
import { createMicrophone } from './microphone';
import { createPiano } from './piano';

/**
 * The stage: everything that is drawn, and the loop that draws it.
 *
 * Two clocks run here, and they are deliberately separate. The curtain runs on
 * real time, because it is a one-off event with a beginning and an end. The
 * journey runs on scroll, because the visitor is driving it - but not directly:
 * the scroll sets a target and the camera eases towards it every frame, which
 * is what turns a flicked trackpad into a glide instead of a jolt.
 *
 * Quality is a tier rather than a set of switches. A phone gets no shadows, no
 * bloom and a capped pixel ratio, and it gets them together, because the point
 * is to hold a frame rate - not to lose effects one at a time until the scene
 * looks broken in a way nobody chose.
 */

export type Quality = 'high' | 'low';

export interface StageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  readonly logoUrl: string;
  /** Called once the curtain has finished drawing back. */
  readonly onOpened?: () => void;
}

export interface Stage {
  /** Where along the 0..1 journey the scroll is asking the camera to be. */
  setProgress(progress: number): void;
  /** Draw the curtain back. Does nothing once it is already going. */
  open(): void;
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/** How far out from centre the outer two instruments stand. */
const STATION_X = 4.2;
/** The curtain hangs at the proscenium; the instruments are behind it. */
const CURTAIN_Z = 6.2;
const OPEN_SECONDS = 2.6;

/**
 * Where the mark hangs, in front of the cloth.
 *
 * The camera aims at exactly this point while the curtain is shut, and that is
 * what keeps the logo dead centre in the frame. Centring it by picking a height
 * and hoping only ever works for one window shape.
 */
const LOGO_POS = new Vector3(0, 2.6, CURTAIN_Z + 1.1);

/** Where the camera waits before the curtain goes - out in the house. */
const HOUSE_POS = new Vector3(0, 2.2, 12.5);
const HOUSE_LOOK = LOGO_POS;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A cheap stand-in for a light shaft: a wide, faint, additive cone. */
function createBeam(x: number): Mesh {
  const geometry = new ConeGeometry(1.5, 6.4, 24, 1, true);
  const material = new MeshBasicMaterial({
    color: 0xffe7c4,
    transparent: true,
    opacity: 0.05,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const beam = new Mesh(geometry, material);
  beam.position.set(x, 3.4, 0.6);
  return beam;
}

/** Motes drifting in the beams, turned as one body rather than moved one by one. */
function createDust(count: number): Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = Math.random() * 5.5 + 0.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xffe9cc,
    size: 0.022,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  return new Points(geometry, material);
}

export async function createStage(options: StageOptions): Promise<Stage> {
  const { canvas, quality, logoUrl, onOpened } = options;
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
  scene.fog = new FogExp2(0x05040a, 0.052);

  const camera = new PerspectiveCamera(options.portrait ? 58 : 42, 1, 0.1, 100);
  camera.position.copy(HOUSE_POS);
  camera.lookAt(HOUSE_LOOK);

  const materials = createMaterials();

  const floorGeometry = new PlaneGeometry(60, 44);
  const floor = new Mesh(floorGeometry, materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = high;
  scene.add(floor);

  // Ambient carries the violet the rest of the site is built on, so the shadows
  // belong to this studio rather than being a generic grey.
  scene.add(new AmbientLight(0x2a2038, 0.55));

  const rim = new DirectionalLight(0x6f78ff, 0.4);
  rim.position.set(-6, 7, -8);
  scene.add(rim);

  const spots: SpotLight[] = [];
  for (const x of [-STATION_X, 0, STATION_X]) {
    const spot = new SpotLight(0xfff0d8, 210, 22, 0.34, 0.6, 1.5);
    spot.position.set(x, 6.6, 2.4);
    spot.target.position.set(x, 0.9, 0);
    spot.castShadow = high;
    if (high) {
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0015;
    }
    scene.add(spot, spot.target, createBeam(x));
    spots.push(spot);
  }

  const dust = createDust(high ? 520 : 200);
  scene.add(dust);

  const instruments = [
    { instrument: createPiano(materials), x: -STATION_X },
    { instrument: createMicrophone(materials), x: 0 },
    { instrument: createGuitar(materials), x: STATION_X },
  ];
  for (const { instrument, x } of instruments) {
    instrument.group.position.x = x;
    instrument.group.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = high;
        object.receiveShadow = high;
      }
    });
    scene.add(instrument.group);
  }

  const curtains: Curtains = createCurtains();
  curtains.group.position.z = CURTAIN_Z;
  scene.add(curtains.group);

  // The light that walks across the mark, and is put out once the mark is gone.
  const markLight = new PointLight(0xffd9a0, 26, 12, 1.6);
  markLight.position.set(0, LOGO_POS.y + 0.2, LOGO_POS.z + 1.3);
  scene.add(markLight);

  let logo: LogoMark | null = null;
  try {
    logo = await createLogo(logoUrl, 4.4);
    logo.group.position.copy(LOGO_POS);
    scene.add(logo.group);
  } catch {
    // The stage is worth showing without the mark; the mark is not worth
    // failing the whole page over.
    logo = null;
  }

  let composer: EffectComposer | null = null;
  if (high) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.58, 0.55, 0.72));
    composer.addPass(new OutputPass());
  }

  let path: readonly Keyframe[] = options.portrait ? PORTRAIT_PATH : LANDSCAPE_PATH;
  let targetProgress = 0;
  let currentProgress = 0;
  let openedAt: number | null = null;
  let curtain = 0;
  let announced = false;

  const clock = new Clock();
  let time = 0;
  let frame = 0;

  const pathPos = new Vector3();
  const pathLook = new Vector3();
  const lookAt = new Vector3();

  const tick = (): void => {
    frame = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.05);
    time += delta;

    if (openedAt !== null) {
      curtain = easeInOutCubic(Math.min((time - openedAt) / OPEN_SECONDS, 1));
      if (curtain >= 1 && !announced) {
        announced = true;
        onOpened?.();
      }
    }
    curtains.setOpen(curtain);
    curtains.update(time);

    // The mark leaves ahead of the cloth, so it is gone before the stage it was
    // covering is fully in view.
    const markGone = Math.min(curtain * 1.6, 1);
    logo?.setReveal(markGone);
    markLight.position.x = Math.sin(time * 0.7) * 3.2;
    markLight.intensity = 26 * (1 - markGone);

    // Scroll sets the target and the camera eases towards it. Frame-rate
    // independent, so the same flick lands in the same place at 60Hz and 144Hz.
    currentProgress += (targetProgress - currentProgress) * (1 - Math.exp(-5 * delta));

    sampleCamera(path, currentProgress, pathPos, pathLook);
    if (curtain < 1) {
      // While the cloth is still moving, the camera is walking in from the house.
      const approach = easeInOutCubic(curtain);
      camera.position.lerpVectors(HOUSE_POS, pathPos, approach);
      lookAt.lerpVectors(HOUSE_LOOK, pathLook, approach);
    } else {
      camera.position.copy(pathPos);
      lookAt.copy(pathLook);
    }
    // A breath, so a held frame is never perfectly still.
    camera.position.x += Math.sin(time * 0.31) * 0.035;
    camera.position.y += Math.cos(time * 0.27) * 0.025;
    camera.lookAt(lookAt);

    dust.rotation.y = time * 0.012;
    dust.position.y = Math.sin(time * 0.15) * 0.12;

    // Whichever instrument is being visited gets the brighter lamp.
    for (let i = 0; i < spots.length; i += 1) {
      const station = (i - 1) * STATION_X;
      const distance = Math.abs(camera.position.x - station);
      spots[i]!.intensity = 150 + 150 / (1 + distance * distance * 0.5);
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  frame = requestAnimationFrame(tick);

  return {
    setProgress(progress) {
      targetProgress = Math.min(Math.max(progress, 0), 1);
    },

    open() {
      if (openedAt === null) openedAt = time;
    },

    resize(width, height, portrait) {
      path = portrait ? PORTRAIT_PATH : LANDSCAPE_PATH;
      camera.aspect = width / height;
      // A narrow window sees less of the stage across, so the lens widens -
      // otherwise a phone is looking at the scene through a keyhole.
      camera.fov = portrait ? 58 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      composer?.setSize(width, height);
    },

    dispose() {
      cancelAnimationFrame(frame);
      for (const { instrument } of instruments) instrument.dispose();
      curtains.dispose();
      logo?.dispose();
      materials.dispose();
      floorGeometry.dispose();
      dust.geometry.dispose();
      (dust.material as PointsMaterial).dispose();
      composer?.dispose();
      renderer.dispose();
    },
  };
}
