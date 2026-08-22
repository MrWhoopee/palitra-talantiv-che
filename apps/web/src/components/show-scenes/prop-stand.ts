import { SpotLight } from 'three';
import { loadProps, type OnProgress } from './props';
import { createRoom, fitCamera, runLoop, type Loop, type Quality } from './stage-kit';

/**
 * A turntable for the prop library.
 *
 * Not part of the show: it is the bench the props are looked at on. Every
 * object in `props.glb` gets stood on the floor of the same dark room the
 * rooms are lit by, and turned, because a prop that reads well from the
 * three-quarter Blender viewport can still be a silhouette of nothing under
 * one warm light - and that light is the only one the show has.
 *
 * It lives under `(demo)`, where three.js is allowed and the real site never
 * looks.
 */

export interface PropStandOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  /** Names as they are spelled in `assets/blender/props/`. */
  readonly names: readonly string[];
  readonly onProgress?: OnProgress;
}

export interface PropStandScene {
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/** Enough room between props that neither stands in the other's shadow. */
const SPACING = 0.9;

export async function createPropStand(options: PropStandOptions): Promise<PropStandScene> {
  const { canvas, quality, portrait, names, onProgress } = options;

  const room = createRoom(canvas, quality, { floor: true });
  const library = await loadProps(onProgress);

  // One warm light, from the side and above: the show's whole lighting
  // grammar, so a prop is judged here under what it will actually stand in.
  const key = new SpotLight(0xffd8a8, 26, 12, 0.72, 0.45, 1.4);
  key.position.set(2.2, 3.4, 2.6);
  key.castShadow = room.high;
  room.scene.add(key, key.target);

  const stand = names.map((name, index) => {
    const prop = library.take(name);
    prop.position.x = (index - (names.length - 1) / 2) * SPACING;
    prop.castShadow = room.high;
    room.scene.add(prop);

    return prop;
  });

  room.camera.position.set(0, 1.15, 2.5);
  room.camera.lookAt(0, 0.5, 0);

  // Fitted before the first frame: the library takes a moment to arrive, and a
  // canvas that renders once at the wrong aspect flashes a stretched prop.
  fitCamera(room, canvas.clientWidth, canvas.clientHeight, portrait);

  const loop: Loop = runLoop((_delta, time) => {
    // Slow, and the same for all of them: a prop turning at its own speed
    // would be a prop being sold rather than being looked at.
    for (const prop of stand) prop.rotation.y = time * 0.35;

    room.renderer.render(room.scene, room.camera);
  });

  return {
    resize(width, height, next) {
      fitCamera(room, width, height, next);
    },

    dispose() {
      loop.stop();
      library.dispose();
      room.renderer.dispose();
    },
  };
}
