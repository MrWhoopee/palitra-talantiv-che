import {
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SpotLight,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { loadProps, type OnProgress } from './props';
import { approach, createRoom, fitCamera, runLoop, type Loop, type Quality } from './stage-kit';

/**
 * The corridor the seven rooms open off.
 *
 * The wall of covers from stage 8, turned into the building it was always
 * describing. It is the only place in the show with a floor plan: the rooms
 * behind the doors owe each other nothing, because you never walk between
 * them - you step back into the corridor and open another door.
 *
 * Built from the reference boards in `docs/references/corridor.md`. A
 * backstage corridor is narrow, low, warm and worn, with a lamp over each door
 * and darkness in between; a music school door has a tall narrow window you
 * see the player through. The window is what makes this corridor the studio's
 * rather than any building's: it carries its track's own colour, so every door
 * is lit by the room behind it before anybody opens it.
 */

export interface CorridorDoor {
  readonly label: string;
  /** The colour behind the glass - the room's own light, seen from outside. */
  readonly tint: string;
}

export interface CorridorOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  readonly doors: readonly CorridorDoor[];
  readonly onProgress?: OnProgress;
}

export interface CorridorScene {
  /** Which door is in front of you. Fractional values are the step itself. */
  setIndex(index: number): void;
  /**
   * A door being opened, and how far along it is.
   *
   * `null` puts the corridor back to rest. Otherwise light grows under that
   * door and its window brightens, which is the whole loader: the room behind
   * it is arriving, and the corridor says so without a spinner standing in
   * front of the show.
   */
  setOpening(index: number | null, progress: number): void;
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/**
 * Along the corridor, from one door to the next one facing it.
 *
 * Doors alternate walls, so two on the same side are twice this apart - 4.4 m,
 * which is the frontage of a real rehearsal room. The first corridor put them
 * 2.1 m apart on one wall, and that quietly said every room behind them was
 * two metres wide. Those are cupboards, not classrooms, and the building was
 * lying before a single room existed.
 */
const STRIDE = 2.2;

/** Low, because that is what makes a corridor a passage rather than a hall. */
const CEILING = 2.62;

/**
 * Wall to wall. A corridor is something you are *between*: at three and a half
 * metres it was as wide as a room, and standing in it felt like standing in
 * one.
 */
const WIDTH = 2.4;

const LAMP_HEIGHT = 2.3;

/** Which wall a door is on: even indices left, odd right. */
function sideOf(index: number): -1 | 1 {
  return index % 2 === 0 ? -1 : 1;
}

export async function createCorridor(options: CorridorOptions): Promise<CorridorScene> {
  const { canvas, quality, portrait, doors, onProgress } = options;

  // No shared floor here. The kit's is eighty metres across and catches the
  // rim light from outside, which in a corridor reads as a lit runway with
  // unlit walls either side of it - the one surface in the scene that is not
  // in the same room as the rest.
  const room = createRoom(canvas, quality, { floor: false });
  const library = await loadProps(onProgress);

  const span = (doors.length - 1) * STRIDE;
  const centre = span / 2;
  // Run past the doors at both ends. A wall that stops inside the frame turns
  // the corridor back into a flat with scenery standing on it.
  const RUN = STRIDE * 4;
  const length = span + RUN * 2;
  const wallZ = WIDTH / 2;
  const disposables: { dispose(): void }[] = [];

  // The walls. Without them the doors stand in a void and the corridor is a
  // row of covers again - the whole point is that this is a place.
  const wallMaterial = new MeshStandardMaterial({
    color: 0x16121c,
    roughness: 0.92,
    metalness: 0,
    side: DoubleSide,
  });
  disposables.push(wallMaterial);

  const wallGeometry = new PlaneGeometry(length, CEILING);
  disposables.push(wallGeometry);

  const left = new Mesh(wallGeometry, wallMaterial);
  left.position.set(centre, CEILING / 2, -wallZ);
  left.receiveShadow = room.high;

  const right = new Mesh(wallGeometry, wallMaterial);
  right.position.set(centre, CEILING / 2, wallZ);
  right.receiveShadow = room.high;

  const ceilingGeometry = new PlaneGeometry(length, WIDTH);
  disposables.push(ceilingGeometry);

  const ceiling = new Mesh(ceilingGeometry, wallMaterial);
  ceiling.position.set(centre, CEILING, 0);
  ceiling.rotation.x = Math.PI / 2;

  const keepFloor = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const floorGeometry = new PlaneGeometry(length, WIDTH);
  disposables.push(floorGeometry);

  const floorMaterial = new MeshStandardMaterial({
    color: 0x110e18,
    roughness: 0.78,
    metalness: 0.08,
  });
  disposables.push(floorMaterial);

  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.position.set(centre, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = room.high;

  room.scene.add(left, right, ceiling, floor);

  // The doors: one mesh, drawn once, however many tracks there turn out to be.
  //
  // Leaf and frame are separate meshes because a door that opens has to be:
  // the leaf swings on its hinge and the casing stays in the wall. Joined into
  // one - which is how the first door was modelled - swinging it would swing
  // the hole it hangs in.
  const leaves = library.instance('door_leaf', doors.length);
  leaves.mesh.castShadow = room.high;
  leaves.mesh.receiveShadow = room.high;

  const frames = library.instance('door_frame', doors.length);
  frames.mesh.castShadow = room.high;
  frames.mesh.receiveShadow = room.high;

  // The glass is unlit on purpose. It is standing in for light coming through
  // from the other side, and a surface that takes the corridor's own lamp on
  // its face would read as a painted panel instead.
  const glassMaterial = new MeshBasicMaterial({ side: DoubleSide });
  disposables.push(glassMaterial);

  const glass = library.instance('door_glass', doors.length, glassMaterial);

  const lampGeometry = new PlaneGeometry(0.34, 0.1);
  disposables.push(lampGeometry);
  const lampMaterial = new MeshBasicMaterial({ color: 0xffd9a6 });
  disposables.push(lampMaterial);
  const lamps = new InstancedMesh(lampGeometry, lampMaterial, doors.length);

  const matrix = new Matrix4();
  const tint = new Color();

  doors.forEach((door, index) => {
    const x = index * STRIDE;
    const side = sideOf(index);
    // A door on the far wall is the same door turned round to face back in.
    const turn = side < 0 ? 0 : Math.PI;

    leaves.place(index, matrix.makeRotationY(turn).setPosition(x, 0, side * wallZ));
    frames.place(index, matrix.makeRotationY(turn).setPosition(x, 0, side * wallZ));
    glass.place(index, matrix.makeRotationY(turn).setPosition(x, 0, side * (wallZ - 0.012)));
    lamps.setMatrixAt(
      index,
      matrix.makeRotationY(turn).setPosition(x, LAMP_HEIGHT, side * (wallZ - 0.16)),
    );

    glass.paint(index, lit(tint, door.tint));
  });

  leaves.commit();
  frames.commit();
  glass.commit();
  lamps.instanceMatrix.needsUpdate = true;

  room.scene.add(leaves.mesh, frames.mesh, glass.mesh, lamps);

  // The name goes on the door, not on the wall next to it.
  //
  // On the wall it sits between two doors and labels neither: the first walk
  // down the corridor had the lit door reading as the name of its neighbour.
  // A plate screwed to the leaf is both unambiguous and what the references
  // show - backstage doors carry their number on the door.
  const signs = doors.map((door, index) => {
    const texture = signTexture(door.label);
    disposables.push(texture);

    const material = new MeshBasicMaterial({ map: texture });
    disposables.push(material);

    const geometry = new PlaneGeometry(0.33, 0.085);
    disposables.push(geometry);

    const sign = new Mesh(geometry, material);
    const side = sideOf(index);
    const turn = side < 0 ? 0 : Math.PI;
    // On the left panel, clear of the glass, at the height a plate is screwed
    // on - and mirrored with its door when that door faces the other way.
    sign.rotation.y = turn;
    sign.position.set(index * STRIDE + (side < 0 ? -0.255 : 0.255), 1.72, side * (wallZ - 0.035));
    room.scene.add(sign);

    return sign;
  });

  // The light under the door. Flat on the floor in front of one door, and
  // nothing at all until that door is being opened.
  const spillMaterial = new MeshBasicMaterial({
    color: 0xffd9a6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(spillMaterial);

  const spill = new Mesh(keepFloor(new PlaneGeometry(1.1, 0.9)), spillMaterial);
  spill.rotation.x = -Math.PI / 2;
  spill.visible = false;
  spill.renderOrder = 2;
  room.scene.add(spill);

  // One light, and it walks with you. Seven would flatten the corridor into an
  // evenly lit room, and the references are unanimous that it is not one.
  const lamp = new SpotLight(0xffd2a0, 22, 5.4, 0.78, 0.55, 1.6);
  lamp.position.set(0, LAMP_HEIGHT, 0.5);
  lamp.castShadow = room.high;
  // Without these the door shadows itself in concentric rings - the shadow map
  // sampling its own surface. A door is flat and lit almost head-on, which is
  // the worst case for it.
  lamp.shadow.bias = -0.0015;
  lamp.shadow.normalBias = 0.035;
  room.scene.add(lamp, lamp.target);

  let current = 0;
  let target = 0;

  /**
   * Which wall the walk is against, as a number that crosses zero mid-step.
   *
   * Doors alternate sides, so a walk down the corridor weaves - and that weave
   * is what tells you there are two walls. Rounding to the nearest door would
   * snap the camera across the corridor instead.
   */
  const sideAt = (at: number) => {
    const lo = Math.floor(at);
    const hi = Math.min(doors.length - 1, lo + 1);
    const t = at - lo;

    return sideOf(Math.max(0, lo)) * (1 - t) + sideOf(hi) * t;
  };

  const place = (at: number) => {
    const x = at * STRIDE;
    const side = sideAt(at);

    // Back along the corridor and slightly across from the door, not square in
    // front of it. Square on, the corridor is invisible and this is a picture
    // of a door; from across and behind, the far doors recede past it and it
    // is a place with a length. Only slightly across: leaning the full way
    // over put the camera half a metre from the opposite wall, and the door it
    // had just left ate a third of the frame on the way past.
    room.camera.position.set(x - 3.1, 1.58, -side * 0.38);
    room.camera.lookAt(x + 0.25, 1.14, side * (wallZ - 0.15));

    lamp.position.set(x, LAMP_HEIGHT, side * (wallZ - 0.5));
    lamp.target.position.set(x, 0.9, side * wallZ);
    lamp.target.updateMatrixWorld();
  };

  /**
   * A corridor is shot wide.
   *
   * There is nowhere to step back to - the opposite wall is a metre and a half
   * away, which is the whole point of it being a corridor - so the lens has to
   * do what the feet cannot. At the show's usual 42 degrees the nearest door
   * fills the frame and is cut off at both ends.
   */
  const frame = (width: number, height: number, next: boolean) => {
    fitCamera(room, width, height, next);
    room.camera.fov = next ? 76 : 63;
    room.camera.updateProjectionMatrix();
  };

  place(0);
  frame(canvas.clientWidth, canvas.clientHeight, portrait);

  const loop: Loop = runLoop((delta) => {
    current = approach(current, target, 6, delta);
    place(current);

    room.renderer.render(room.scene, room.camera);
  });

  return {
    setIndex(index) {
      target = Math.max(0, Math.min(doors.length - 1, index));
    },

    setOpening(index, progress) {
      if (index === null) {
        spill.visible = false;
        spillMaterial.opacity = 0;

        for (const [at, door] of doors.entries()) glass.paint(at, lit(tint, door.tint));
        glass.commit();
        return;
      }

      const at = Math.max(0, Math.min(doors.length - 1, index));
      const open = Math.max(0, Math.min(1, progress));
      const side = sideOf(at);

      spill.visible = true;
      // Grows out of the doorway rather than fading up in place: light under a
      // door arrives as a widening wedge, because the gap it comes through is
      // at the bottom and the source is deep in the room.
      spill.position.set(at * STRIDE, 0.012, side * (wallZ - 0.12 - open * 0.62));
      spill.scale.set(0.55 + open * 0.75, 0.3 + open * 1.5, 1);
      spillMaterial.opacity = 0.05 + open * 0.5;

      // And the window over it comes up with it: the room behind is waking.
      const door = doors[at];
      if (door !== undefined) {
        glass.paint(at, lit(tint, door.tint).multiplyScalar(1 + open * 1.5));
        glass.commit();
      }
    },

    resize(width, height, next) {
      frame(width, height, next);
    },

    dispose() {
      loop.stop();

      for (const sign of signs) room.scene.remove(sign);
      leaves.mesh.dispose();
      frames.mesh.dispose();
      glass.mesh.dispose();
      lamps.dispose();
      for (const item of disposables) item.dispose();

      library.dispose();
      room.renderer.dispose();
    },
  };
}

/**
 * A track's colour as light rather than as ink.
 *
 * The tints are picked to be read on paper, so they run from near-black
 * (contacts) to a deep curtain red, and painted straight onto the glass they
 * come out as panels somebody painted. Mixing them towards white instead
 * washes the dark ones out - fourteen per cent was enough to turn the curtain
 * red into pink - because a small step towards white is a large step away from
 * a dark colour's saturation.
 *
 * So the hue is kept, the saturation is floored, and the lightness is set:
 * every window glows about as brightly, and each still glows its own colour.
 * The lightness is deliberately below half - at 0.58 the curtain's deep red
 * came out pink, which is a different colour, not a brighter one.
 */
function lit(into: Color, hex: string): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  into.set(hex).getHSL(hsl);

  return into.setHSL(hsl.h, Math.max(hsl.s, 0.62), 0.46);
}

/**
 * The name, drawn into a texture rather than set in HTML over the canvas.
 *
 * A label floating above the scene belongs to the page; a label painted on a
 * plane belongs to the wall, and takes the corridor's perspective with it.
 */
function signTexture(label: string): Texture {
  const width = 512;
  const height = 132;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d')!;

  // A plate, not floating letters. Unlit text keeps one brightness while the
  // door under it swings from black to lamp-lit, so light letters straight on
  // the leaf vanish exactly where somebody is looking. Its own dark ground
  // carries the contrast with it.
  context.fillStyle = '#0d0a12';
  context.fillRect(0, 0, width, height);

  context.strokeStyle = '#3a3245';
  context.lineWidth = 6;
  context.strokeRect(3, 3, width - 6, height - 6);

  context.fillStyle = '#efeaf6';
  context.font = '600 56px Rubik, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label.toUpperCase(), width / 2, height / 2 + 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}
