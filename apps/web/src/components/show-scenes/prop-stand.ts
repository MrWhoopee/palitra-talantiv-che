import { Box3, SpotLight, Vector3 } from 'three';
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

/** Between one prop and the next, so neither stands in the other's shadow. */
const GAP = 0.45;

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

  // Measured rather than assumed. A fixed step and a fixed camera worked while
  // the library was one chair; a door is twice as tall and the chair would
  // have been standing inside it. The bench has to hold whatever is modelled
  // next without being adjusted for it.
  const taken = names.map((name) => {
    const prop = library.take(name);
    const size = new Box3().setFromObject(prop).getSize(new Vector3());

    return { prop, size };
  });

  const span = taken.reduce((total, { size }) => total + size.x, 0) + GAP * (taken.length - 1);
  const tallest = taken.reduce((high, { size }) => Math.max(high, size.y), 0);

  let cursor = -span / 2;
  const stand = taken.map(({ prop, size }) => {
    prop.position.x = cursor + size.x / 2;
    cursor += size.x + GAP;
    prop.castShadow = room.high;
    room.scene.add(prop);

    return prop;
  });

  // Far enough back that the widest of the two - the row across, or the
  // tallest prop up - fits the frame with a margin.
  const fov = (room.camera.fov * Math.PI) / 180;
  const reach = Math.max(tallest, span / room.camera.aspect) / (2 * Math.tan(fov / 2));

  room.camera.position.set(0, tallest * 0.55, reach * 1.35 + 1);
  room.camera.lookAt(0, tallest * 0.45, 0);
  key.target.position.set(0, tallest * 0.4, 0);

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
