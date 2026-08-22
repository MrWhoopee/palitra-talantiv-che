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
import { createCameraProp } from './camera-prop';
import {
  approach,
  createBackdrop,
  createIris,
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

  // The way this track opens: a camera pointed at whoever is looking. The
  // flash fires, the lens comes at us, and we go through the glass - which is
  // what a page about portraits should feel like being let into.
  // The cover's own ground, standing between the camera and the room: what is
  // waiting in there is not part of this picture.
  const backdrop = createBackdrop('rgba(122, 96, 190, 0.55)', '#0b0913');
  // In front of the row and behind the camera: standing it behind the figure
  // left the figure showing on the cover, which is the one thing it is for.
  backdrop.mesh.position.set(0, 2.4, 0.55);
  scene.add(backdrop.mesh);

  const prop = createCameraProp();
  prop.group.position.set(0, 2.5, 1.2);
  prop.group.scale.setScalar(0.9);
  scene.add(prop.group);

  // The room is dark by design, so the prop needs its own key or it is a
  // silhouette of a camera rather than a camera.
  const key = new SpotLight(0xfff0d8, 130, 26, 0.7, 0.55, 1.2);
  key.position.set(4, 6.4, 7.5);
  key.target.position.set(0, 2.5, 1.2);
  scene.add(key, key.target);

  // A cold fill from the other side, so the body has two sides rather than a
  // lit half and a black one.
  const fill = new SpotLight(0x8f9dff, 45, 24, 0.8, 0.6, 1.2);
  fill.position.set(-5, 3.4, 6);
  fill.target.position.set(0, 2.5, 1.2);
  scene.add(fill, fill.target);

  // Once we are through the glass, the aperture is what opens onto the row.
  const iris = createIris();
  scene.add(iris.mesh);

  // Nearly black while the camera is still out there: the teacher's colour
  // arrives with the teacher, not before.
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

    // The flash goes off first, then the lens comes at us, and only then does
    // the aperture open. Three beats in one movement, which is why they are
    // stated as ranges of the same number rather than as three timers.
    prop.setFlash(Math.max(0, 1 - Math.abs(drawn - 0.08) / 0.09));
    prop.group.visible = drawn < 0.82;

    // A slow turn, so the cover is an object standing in a room rather than a
    // picture of one. Straight on and still, a body this flat reads as card.
    prop.group.rotation.y = Math.sin(time * 0.32) * 0.16;
    prop.group.rotation.x = Math.sin(time * 0.21) * 0.05;
    // The ground goes while we are inside the barrel, where the frame is
    // black anyway - so the room is never seen arriving.
    backdrop.setOpacity(Math.min(Math.max((0.66 - drawn) / 0.14, 0), 1));

    // In through the glass, then out into the room. Stopping at the glass is
    // what left the row being looked at from two metres away, with the
    // teachers three times the size of the frame.
    const inward = Math.min(Math.max((drawn - 0.12) / 0.56, 0), 1);
    const outward = Math.min(Math.max((drawn - 0.7) / 0.3, 0), 1);
    const ease = (t: number) => t * t * (3 - 2 * t);

    camera.position.z = 7.2 - ease(inward) * 4.6 + ease(outward) * 4.6;
    camera.position.y = 2.5;
    camera.lookAt(0, 2.5, 0);

    // Wide open while the camera is still out there in the room - the blades
    // are not part of that picture. They shut only once we are inside the
    // barrel, where the frame is black anyway, and then open onto the row.
    iris.setOpen(drawn < 0.66 ? 1 : Math.min(Math.max((drawn - 0.7) / 0.3, 0), 1));

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
    // The colour arrives as the aperture does: outside the lens the room is
    // the dark the camera is standing in.
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
  iris.setAspect(window.innerWidth / window.innerHeight);

  return {
    setOpen(open) {
      openTarget = open ? 1 : 0;
    },

    setIndex(next) {
      index = Math.min(Math.max(next, 0), Math.max(teachers.length - 1, 0));
    },

    resize(width, height, portrait) {
      fitCamera(room, width, height, portrait);
      iris.setAspect(width / height);
      // Standing to one side only works where there is a side; on a phone the
      // figure comes to the middle and the words go over it.
      for (const plane of planes) plane.scale.setScalar(portrait ? 0.78 : 1);
    },

    dispose() {
      loop.stop();
      iris.dispose();
      prop.dispose();
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
