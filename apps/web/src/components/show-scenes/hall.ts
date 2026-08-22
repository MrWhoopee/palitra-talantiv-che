import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SpotLight,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { loadProps, type OnProgress } from './props';
import { approach, createRoom, fitCamera, runLoop, type Loop, type Quality } from './stage-kit';

/**
 * The hall: the room behind the first door.
 *
 * The studio's own auditorium - rows of seats on a rake, and a stage at the
 * far end. It is a room like the other six rather than a screen the show
 * opens with, which is the whole reason the curtain moved in here: across the
 * stage, where it hides something, instead of standing in the row of doors
 * where it hid a corridor.
 *
 * The mark hangs upstage, behind where the cloth will be. Closed, it cannot be
 * seen at all - and that is the point of it being there rather than painted on
 * the curtain, which is what the show did before and which made the mark the
 * curtain's pattern instead of what the curtain was keeping.
 */

export interface HallOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  readonly onProgress?: OnProgress;
}

export interface HallScene {
  /** 0 is the back of the hall, 1 is standing at the stage. */
  setApproach(value: number): void;
  /** 0 is shut, 1 is fully drawn back. */
  setCurtain(value: number): void;
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/** A small hall, the size a studio of this kind actually has. */
const WIDTH = 9.2;
const DEPTH = 13;
const CEILING = 4.6;

const STAGE_WIDTH = 7;
const STAGE_DEPTH = 4.2;
const STAGE_HEIGHT = 0.9;

/** Where the stage front is. Everything behind this is performance. */
const STAGE_FRONT = -DEPTH / 2 + STAGE_DEPTH;

const ROWS = 6;
const PER_ROW = 8;
/** Row to row, and seat to seat within a row - the spacing a hall is built to. */
const ROW_PITCH = 0.92;
const SEAT_PITCH = 0.56;
/** The gap up the middle. People have to get to their seats. */
const AISLE = 0.9;
/** Each row a little higher than the one in front, so row four can see. */
const RAKE = 0.11;

/** The modelled height of one curtain half, from `assets/blender/props/curtain.blend`. */
const CURTAIN_HEIGHT = 3.6;

export async function createHall(options: HallOptions): Promise<HallScene> {
  const { canvas, quality, portrait, onProgress } = options;

  // The kit's floor is eighty metres of nothing in particular; a hall has its
  // own, and walls to stop it.
  const room = createRoom(canvas, quality, { floor: false });
  const library = await loadProps(onProgress);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const shell = keep(
    new MeshStandardMaterial({ color: 0x13101a, roughness: 0.94, side: DoubleSide }),
  );

  const floor = new Mesh(keep(new PlaneGeometry(WIDTH, DEPTH)), shell);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = room.high;

  const ceiling = new Mesh(keep(new PlaneGeometry(WIDTH, DEPTH)), shell);
  ceiling.position.y = CEILING;
  ceiling.rotation.x = Math.PI / 2;

  const sideGeometry = keep(new PlaneGeometry(DEPTH, CEILING));
  const leftWall = new Mesh(sideGeometry, shell);
  leftWall.position.set(-WIDTH / 2, CEILING / 2, 0);
  leftWall.rotation.y = Math.PI / 2;

  const rightWall = new Mesh(sideGeometry, shell);
  rightWall.position.set(WIDTH / 2, CEILING / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;

  const backWall = new Mesh(keep(new PlaneGeometry(WIDTH, CEILING)), shell);
  backWall.position.set(0, CEILING / 2, DEPTH / 2);
  backWall.rotation.y = Math.PI;

  room.scene.add(floor, ceiling, leftWall, rightWall, backWall);

  // The stage: a platform, and the wall with a hole in it that makes the
  // platform a stage rather than a step.
  const deck = keep(new MeshStandardMaterial({ color: 0x1c1622, roughness: 0.7, metalness: 0.1 }));

  const platform = new Mesh(keep(new BoxGeometry(STAGE_WIDTH, STAGE_HEIGHT, STAGE_DEPTH)), deck);
  platform.position.set(0, STAGE_HEIGHT / 2, STAGE_FRONT - STAGE_DEPTH / 2);
  platform.castShadow = room.high;
  platform.receiveShadow = room.high;
  room.scene.add(platform);

  const proscenium = keep(new MeshStandardMaterial({ color: 0x0f0c15, roughness: 0.9 }));
  const pierWidth = (WIDTH - STAGE_WIDTH) / 2;

  for (const sign of [-1, 1]) {
    const pier = new Mesh(keep(new BoxGeometry(pierWidth, CEILING, 0.5)), proscenium);
    pier.position.set(sign * (STAGE_WIDTH + pierWidth) * 0.5, CEILING / 2, STAGE_FRONT);
    room.scene.add(pier);
  }

  // The header comes low: a proscenium that reaches the ceiling is a doorway,
  // and what makes a stage read as a stage is the band of dark above it.
  const headerHeight = CEILING - 3.3;
  const header = new Mesh(keep(new BoxGeometry(STAGE_WIDTH, headerHeight, 0.5)), proscenium);
  header.position.set(0, CEILING - headerHeight / 2, STAGE_FRONT);
  room.scene.add(header);

  // The mark, upstage, waiting. Nothing is in front of it yet - the cloth is
  // the next piece of work - so for now it hangs in a lit alcove and the hall
  // is a hall with its curtain still to come.
  const markTexture = keep(studioMark());
  const mark = new Mesh(
    keep(new PlaneGeometry(4.6, 1.5)),
    keep(new MeshBasicMaterial({ map: markTexture, transparent: true })),
  );
  mark.position.set(0, STAGE_HEIGHT + 1.7, -DEPTH / 2 + 0.15);
  room.scene.add(mark);

  // The curtain: two halves of one cloth, the second mirrored.
  //
  // Drawn back by gathering rather than sliding. A stage curtain does not
  // travel sideways as a flat sheet - it bunches towards the edge it hangs
  // from, and its folds crowd together as it goes. Scaling each half towards
  // its own outer edge is that gesture, and it is why the model's origin sits
  // on that edge rather than in the middle of the cloth.
  const OPENING_TOP = CEILING - headerHeight;
  const cloth = OPENING_TOP - STAGE_HEIGHT;
  const halves = [-1, 1].map((edge) => {
    // `edge` is which side the cloth hangs from; the mesh runs from its own
    // outer edge inwards, so the half on the left is *not* mirrored and the
    // half on the right is. Getting this backwards sends both halves out past
    // the piers, where they read as two red threads and nothing else.
    const towards = -edge;
    const half = library.take('curtain_half');

    half.traverse((child) => {
      if (child instanceof Mesh) {
        const material = child.material;
        // A cloth is one surface, and from the wings you see its back.
        if (!Array.isArray(material)) material.side = DoubleSide;
        child.castShadow = room.high;
      }
    });

    // A little wider than half the opening, so the two meet rather than
    // leaving a seam of lit stage up the middle.
    half.position.set(edge * (STAGE_WIDTH / 2), STAGE_HEIGHT, STAGE_FRONT - 0.4);
    half.scale.set(towards * 1.04, cloth / CURTAIN_HEIGHT, 1);
    room.scene.add(half);

    return { half, towards };
  });

  // The seats. One chair, forty-eight times, which is the whole reason the
  // rooms can afford to be rooms.
  const seats = library.instance('chair', ROWS * PER_ROW);
  seats.mesh.castShadow = room.high;
  seats.mesh.receiveShadow = room.high;

  const matrix = new Matrix4();
  const half = PER_ROW / 2;

  for (let row = 0; row < ROWS; row += 1) {
    for (let seat = 0; seat < PER_ROW; seat += 1) {
      const side = seat < half ? -1 : 1;
      const fromAisle = side < 0 ? half - seat : seat - half + 1;
      const x = side * (AISLE / 2 + (fromAisle - 0.5) * SEAT_PITCH);
      const z = STAGE_FRONT + 2.4 + row * ROW_PITCH;

      // Turned to face the stage: the chair is modelled looking the other way,
      // which is the way it stands in a classroom.
      seats.place(
        row * PER_ROW + seat,
        matrix.makeRotationY(Math.PI).setPosition(x, row * RAKE, z),
      );
    }
  }

  seats.commit();
  room.scene.add(seats.mesh);

  // House lights: low, warm, and few. A hall before a performance is not lit
  // to be worked in.
  for (const sign of [-1, 1]) {
    const house = new PointLight(0xffcf9a, 4.5, 7.5, 2.2);
    house.position.set(sign * (WIDTH / 2 - 0.5), CEILING - 0.35, 1.5);
    room.scene.add(house);
  }

  // And the wash that says something is about to happen there.
  //
  // Hung upstage of the proscenium, not in front of it. From the auditorium
  // side its cone crossed the opening and washed the header, which reads as a
  // smudge of light on the one surface that is meant to be a hard dark band.
  const wash = new SpotLight(0xffd9ae, 26, 9, 0.62, 0.5, 1.6);
  wash.position.set(0, CEILING - 0.6, STAGE_FRONT - 1.4);
  wash.target.position.set(0, STAGE_HEIGHT + 1.3, -DEPTH / 2 + 0.3);
  wash.castShadow = room.high;
  wash.shadow.bias = -0.0015;
  wash.shadow.normalBias = 0.03;
  room.scene.add(wash, wash.target);

  let current = 0;
  let target = 0;

  const place = (at: number) => {
    // From the back of the hall, by the door, walking down the aisle. The eye
    // stays on the stage the whole way, because that is what the room is for.
    const z = 5.4 - at * 4.6;
    const y = 1.95 - at * 0.35;

    room.camera.position.set(0, y, z);
    room.camera.lookAt(0, STAGE_HEIGHT + 1.25, -DEPTH / 2 + 0.6);
  };

  const frame = (width: number, height: number, next: boolean) => {
    fitCamera(room, width, height, next);
    // Wider than the kit's default: a room is read by how much of it you can
    // see at once, and a hall seen through a portrait lens is a corridor.
    room.camera.fov = next ? 72 : 58;
    room.camera.updateProjectionMatrix();
  };

  place(0);
  frame(canvas.clientWidth, canvas.clientHeight, portrait);

  const loop: Loop = runLoop((delta) => {
    current = approach(current, target, 3.2, delta);
    place(current);

    room.renderer.render(room.scene, room.camera);
  });

  return {
    setApproach(value) {
      target = Math.max(0, Math.min(1, value));
    },

    setCurtain(value) {
      const open = Math.max(0, Math.min(1, value));

      for (const { half, towards } of halves) {
        // Never to nothing: cloth drawn fully back is still a bolt of fabric
        // standing at the edge of the opening, and a curtain that vanishes was
        // a wall pretending.
        half.scale.x = towards * 1.04 * (1 - open * 0.82);
        // And it thickens as it goes. Squeezed on one axis alone the folds
        // compress below a pixel and the bunch comes back as a flat strip
        // crawling with moire; cloth gathered against an edge gets deeper,
        // not thinner.
        half.scale.z = 1 + open * 2.6;
      }
    },

    resize(width, height, next) {
      frame(width, height, next);
    },

    dispose() {
      loop.stop();
      seats.mesh.dispose();
      for (const item of disposables) item.dispose();
      library.dispose();
      room.renderer.dispose();
    },
  };
}

/**
 * The studio's name, upstage.
 *
 * Drawn rather than fetched: the logo is an SVG the browser cannot hand to
 * WebGL without a round trip through an image, and what hangs at the back of a
 * stage is a painted cloth anyway - letters, not a vector.
 */
function studioMark(): Texture {
  const width = 1024;
  const height = 334;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, width, height);

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.fillStyle = '#efe9f8';
  context.font = '700 168px Rubik, system-ui, sans-serif';
  context.fillText('ПАЛІТРА', width / 2, 118);

  context.fillStyle = new Color(0xb79cf5).getStyle();
  context.font = '500 76px Rubik, system-ui, sans-serif';
  context.letterSpacing = '22px';
  context.fillText('ТАЛАНТІВ', width / 2, 244);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}
