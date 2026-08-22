import {
  AdditiveBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TextureLoader,
  type Scene,
  type Texture,
} from 'three';
import { SpotLight } from 'three';
import { createDoorProp } from './door-prop';
import {
  approach,
  createBackdrop,
  createRoom,
  fitCamera,
  runLoop,
  type Quality,
} from './stage-kit';

/**
 * The teachers, as a screen you pick somebody from.
 *
 * A cut-out of the teacher standing to one side, their own colour washing the
 * room behind them, and light running past. Changing teacher slides one out
 * and the next in while the wash crosses to the new colour - the thing a
 * character-select screen does, and the reason it reads as a choice rather
 * than as a list.
 *
 * The figure is a picture on a plane rather than anything modelled. A person
 * built from primitives is a mannequin, and the studio's own photographs are
 * what belongs here the moment they arrive - the cut-outs shipped with this
 * are placeholders drawn for the purpose, not photographs of anybody.
 */

export interface TeacherCard {
  readonly id: string;
  /** A cut-out with a transparent ground: a shape of a person, not a square. */
  readonly figureUrl: string;
  /** The colour the room is washed in while this teacher is on screen. */
  readonly tint: string;
}

export interface TeachersSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  readonly teachers: readonly TeacherCard[];
}

export interface TeachersScene {
  /** Which teacher is on screen. Fractional values are the crossing itself. */
  setIndex(index: number): void;
  /** Draw this track's curtain back, or shut it again. */
  setOpen(open: boolean): void;
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/** How far a figure travels across the frame as it comes and goes. */
const TRAVEL = 3.4;

/** Streaks of light running past, which is where the speed comes from. */
const STREAKS = 9;

export function createTeachersScene(options: TeachersSceneOptions): TeachersScene {
  const { canvas, quality, teachers } = options;
  // No floor: this room is a wash and a figure, and a floor would put a hard
  // horizon across the frame and cut the figure at the knees.
  const room = createRoom(canvas, quality, { floor: false });
  const { scene, camera, renderer } = room;

  camera.position.set(0, 2.5, 7.2);
  camera.lookAt(0, 2.5, 0);

  const loader = new TextureLoader();
  const textures = new Map<string, Texture>();

  for (const teacher of teachers) {
    if (textures.has(teacher.figureUrl)) continue;
    textures.set(teacher.figureUrl, loader.load(teacher.figureUrl));
  }

  // Two planes, so one can be leaving while the other arrives. A single plane
  // whose texture is swapped would cut rather than cross.
  const planes = [makeFigure(), makeFigure()];
  for (const plane of planes) scene.add(plane);

  const streaks = makeStreaks(scene);

  // The way this track opens: a door you knock on, and somebody lets you in.
  // The cover's own ground, standing behind the wall: what is waiting in
  // there is not part of this picture.
  const backdrop = createBackdrop('rgba(122, 96, 190, 0.55)', '#0b0913');
  // Between the row and the wall: it fills the doorway while the leaves are
  // shut, so nothing of the room shows through the crack.
  backdrop.mesh.position.set(0, 2.4, 1.5);
  scene.add(backdrop.mesh);

  const door = createDoorProp();
  // Far enough back, and small enough, that the whole doorway is in the
  // frame. Standing it at arm's length filled the screen with one panel and
  // the leaves could swing without anybody being able to tell.
  door.group.position.set(0, 1.4, 2.2);
  door.group.scale.setScalar(0.5);
  scene.add(door.group);

  // The room is dark by design, so the door needs its own light or it is a
  // silhouette of a door rather than a door.
  const key = new SpotLight(0xffe8c4, 150, 30, 0.85, 0.5, 1.1);
  key.position.set(3.6, 6.4, 8.5);
  key.target.position.set(0, 2, 2.2);
  scene.add(key, key.target);

  const fill = new SpotLight(0x8f9dff, 45, 26, 0.9, 0.6, 1.2);
  fill.position.set(-5, 3.2, 7.5);
  fill.target.position.set(0, 2, 2.2);
  scene.add(fill, fill.target);

  // Nearly black while the door is still shut: the teacher's colour arrives
  // with the teacher, not before.
  const DARK = new Color(0x05040a);
  const wash = new Color(0x05040a);
  const washTarget = new Color(0x05040a);
  renderer.setClearColor(wash, 1);

  let index = 0;
  let shown = 0;
  let openTarget = 0;
  let openT = 0;

  const loop = runLoop((delta, time) => {
    // The cloth runs towards a target, so pause draws it shut by the same
    // path and at the same pace that play drew it back.
    if (openT !== openTarget) {
      const step = delta / 1.9;
      openT =
        openTarget > openT
          ? Math.min(openT + step, openTarget)
          : Math.max(openT - step, openTarget);
    }

    const drawn = openT < 0.5 ? 4 * openT * openT * openT : 1 - Math.pow(-2 * openT + 2, 3) / 2;

    // Knock, then the leaves swing, then the wall passes us. Three beats of
    // one number rather than three timers, so pause runs them backwards for
    // free.
    const knock = Math.min(Math.max(drawn / 0.16, 0), 1);
    const swing = Math.min(Math.max((drawn - 0.18) / 0.42, 0), 1);
    const through = Math.min(Math.max((drawn - 0.5) / 0.42, 0), 1);
    const ease = (t: number) => t * t * (3 - 2 * t);

    if (swing > 0) door.setOpen(ease(swing));
    else door.setKnock(knock < 1 ? knock : 0);

    // The wall comes at us and passes, rather than the camera walking
    // through: the row is framed from here, and moving the camera would
    // reframe it.
    door.group.position.z = 2.2 + ease(through) * 7;
    door.group.visible = through < 0.98;

    // The ground goes with the wall it stands behind.
    backdrop.setOpacity(1 - ease(through));

    shown = approach(shown, index, 6, delta);

    const whole = Math.round(shown);
    const drift = shown - whole;

    // The one being looked at, and the one being left behind or approached.
    paint(planes[0]!, teachers[clamp(whole, teachers.length)], -drift);
    paint(
      planes[1]!,
      teachers[clamp(whole + Math.sign(drift || 1), teachers.length)],
      -drift + Math.sign(drift || 1),
    );

    const current = teachers[clamp(Math.round(shown), teachers.length)];
    if (current) washTarget.set(current.tint);
    // The colour arrives as the doorway does: on the landing outside, the
    // room is only the dark you are standing in.
    wash.lerp(DARK.clone().lerp(washTarget, drawn), 1 - Math.exp(-4 * delta));
    renderer.setClearColor(wash, 1);

    for (let i = 0; i < streaks.length; i += 1) {
      const streak = streaks[i]!;
      // Each runs at its own pace and wraps, so the room never settles.
      streak.position.x = (((time * (0.6 + i * 0.13) + i * 3.1) % 14) - 7) * -1;
      (streak.material as MeshBasicMaterial).color.set(washTarget).offsetHSL(0, 0, 0.35);
    }

    renderer.render(scene, camera);
  });

  function paint(plane: Mesh, teacher: TeacherCard | undefined, offset: number) {
    const material = plane.material as MeshBasicMaterial;

    if (teacher === undefined) {
      material.opacity = 0;
      return;
    }

    material.map = textures.get(teacher.figureUrl) ?? null;
    material.needsUpdate = true;

    // Away from the middle it slides out and fades; a figure half off the
    // frame at full strength reads as two teachers at once.
    plane.position.x = 1.6 + offset * TRAVEL;
    plane.position.z = -Math.abs(offset) * 0.6;
    material.opacity = Math.max(0, 1 - Math.abs(offset) * 1.9);
  }

  fitCamera(room, window.innerWidth, window.innerHeight, options.portrait);

  return {
    setOpen(open) {
      openTarget = open ? 1 : 0;
    },

    setIndex(next) {
      index = Math.min(Math.max(next, 0), Math.max(teachers.length - 1, 0));
    },

    resize(width, height, portrait) {
      fitCamera(room, width, height, portrait);
      // Standing to one side only works where there is a side; on a phone the
      // figure comes to the middle and the words go over it.
      for (const plane of planes) plane.scale.setScalar(portrait ? 0.78 : 1);
    },

    dispose() {
      loop.stop();
      door.dispose();
      backdrop.dispose();
      for (const texture of textures.values()) texture.dispose();
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((one) => one.dispose());
        else material.dispose();
      });
      renderer.dispose();
    },
  };
}

function makeFigure(): Mesh {
  const plane = new Mesh(
    new PlaneGeometry(3.2, 5.4),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  // Standing to the right, with the whole figure inside the frame: a head cut
  // off by the top edge is a mistake, not a crop.
  plane.position.set(1.6, 2.6, 0);
  return plane;
}

/**
 * Light running past the figure: thin, tilted, additive planes, far enough
 * back to be scenery. Cheaper than a shader and reads as movement, which is
 * the only thing they are for.
 */
function makeStreaks(scene: Scene): Mesh[] {
  const streaks: Mesh[] = [];

  for (let i = 0; i < STREAKS; i += 1) {
    const streak = new Mesh(
      new PlaneGeometry(0.06, 7 + (i % 3) * 2.4),
      new MeshBasicMaterial({
        transparent: true,
        opacity: 0.12 + (i % 4) * 0.04,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );

    streak.position.set(0, 2.6, -4 - (i % 5) * 0.9);
    streak.rotation.z = 0.32;
    scene.add(streak);
    streaks.push(streak);
  }

  return streaks;
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}
