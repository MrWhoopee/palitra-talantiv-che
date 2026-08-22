import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import { approach, createRoom, fitCamera, runLoop, type Quality } from './stage-kit';

/**
 * The subjects, as a track list you can stand inside.
 *
 * The page states two numbers for every subject: how long a lesson lasts and
 * what it costs. On paper they are a bar and a price at the end of it. Here
 * they are the same bar with the room built around it - a beam laid across
 * the floor, as long as the lesson is against an hour, with the price lit at
 * the far end.
 *
 * Nothing is invented for the scene. If the studio changes a price in the
 * cabinet, this moves.
 */

export interface DirectionLesson {
  /** The lesson against an hour, 0 to 1. The length of the beam, and nothing else. */
  readonly share: number;
  readonly priceUah: number;
}

export interface DirectionCard {
  readonly id: string;
  readonly tint: string;
  /** Every length this subject is taught in, shortest first. */
  readonly lessons: readonly DirectionLesson[];
}

export interface DirectionsSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly quality: Quality;
  readonly portrait: boolean;
  readonly directions: readonly DirectionCard[];
}

export interface DirectionsScene {
  /** Which subject is in front. Fractional values are the crossing itself. */
  setIndex(index: number): void;
  /** Slide the slats apart, or close them again. */
  setOpen(open: boolean): void;
  resize(width: number, height: number, portrait: boolean): void;
  dispose(): void;
}

/** How long an hour is, in the room. Every beam is a fraction of this. */
const HOUR = 7.2;

/** The gap between one subject's beams and the next. */
const ROW_DEPTH = 3.4;

/** At most four lengths a subject is sold in; a fifth row would be a table. */
const MAX_LESSONS = 4;

/** And at most six subjects on the cover, for the same reason. */
const MAX_SLATS = 6;

export function createDirectionsScene(options: DirectionsSceneOptions): DirectionsScene {
  const { canvas, quality, directions } = options;
  const room = createRoom(canvas, quality);
  const { scene, camera, renderer } = room;

  camera.position.set(0, 3.1, 9.4);
  camera.lookAt(0, 1.1, 0);

  // ---------------------------------------------------------------------
  // The cover: four slats stacked into a square, which is the track list of
  // the page itself lying flat. They are what the scene is seen through.
  // ---------------------------------------------------------------------

  // Standing where the camera is already looking, and far enough back that
  // four bars read as a block rather than as a wall: pressed up against the
  // lens they filled the frame one bar at a time, which states nothing.
  const shutter = new Group();
  shutter.position.set(0, 1.53, 2);
  scene.add(shutter);

  const slats: { group: Group; base: Mesh; lit: Mesh; sign: number }[] = [];

  // One slat per subject, not four bars of the same lesson: the cover is the
  // page's track list, and a track list has a row per track.
  const listed = directions.slice(0, MAX_SLATS);

  listed.forEach((direction, i) => {
    const group = new Group();
    // Stacked from the top down, the way a list is read, and about as tall
    // altogether as they are wide - a square of bars, which is the cover.
    group.position.y = ((listed.length - 1) / 2 - i) * 0.72;
    shutter.add(group);

    // The whole hour, unlit. Without it the lit part is a bar of unknown
    // length against a black room, and the proportion - which is the only
    // thing this cover says - cannot be read.
    const base = new Mesh(
      new PlaneGeometry(4.6, 0.5),
      new MeshBasicMaterial({ color: 0x241d38, transparent: true }),
    );
    group.add(base);

    // The lit part of the bar: how long that lesson is. Left-aligned inside
    // the slat, because a bar that grew from the middle would state nothing.
    // The longest lesson this subject is sold in, against the hour. One row,
    // one number - the lengths in between are what the scene behind is for.
    const share = Math.min(
      Math.max(Math.max(...direction.lessons.map((lesson) => lesson.share), 0.06), 0.06),
      1,
    );

    const lit = new Mesh(
      new PlaneGeometry(1, 0.5),
      new MeshBasicMaterial({
        color: new Color(direction.tint).offsetHSL(0, 0, 0.2),
        transparent: true,
      }),
    );
    lit.scale.x = 4.6 * share;
    lit.position.set(-2.3 + (4.6 * share) / 2, 0, 0.01);
    group.add(lit);

    slats.push({ group, base, lit, sign: i % 2 === 0 ? -1 : 1 });
  });

  // ---------------------------------------------------------------------
  // Behind them: one row of beams per subject, laid into the depth of the
  // room. The row in front is the one being read.
  // ---------------------------------------------------------------------

  const rows: {
    group: Group;
    beams: { bar: Mesh; head: Mesh; lamp: PointLight; share: number }[];
    tint: Color;
  }[] = [];

  for (const direction of directions) {
    const group = new Group();
    scene.add(group);

    const tint = new Color(direction.tint);
    const beams: { bar: Mesh; head: Mesh; lamp: PointLight; share: number }[] = [];
    const lessons = direction.lessons.slice(0, MAX_LESSONS);

    lessons.forEach((lesson, i) => {
      const share = Math.min(Math.max(lesson.share, 0.04), 1);
      const length = share * HOUR;

      // Lying just off the floor rather than on it: a beam at zero fights the
      // floor for the same pixels and flickers.
      const bar = new Mesh(
        new BoxGeometry(1, 0.07, 0.3),
        new MeshBasicMaterial({ color: tint.clone().offsetHSL(0, 0, 0.28), transparent: true }),
      );
      bar.scale.x = length;
      // Grown from the left edge, so the far end is where the price is.
      bar.position.set(-HOUR / 2 + length / 2, 0.05, i * 0.9 - (lessons.length - 1) * 0.45);
      group.add(bar);

      // The price, as the thing the beam arrives at.
      const head = new Mesh(
        new SphereGeometry(0.16, 20, 20),
        new MeshBasicMaterial({
          color: 0xffd9a8,
          transparent: true,
          blending: AdditiveBlending,
        }),
      );
      head.position.set(-HOUR / 2 + length, 0.05, bar.position.z);
      group.add(head);

      const lamp = new PointLight(tint.clone().offsetHSL(0, 0, 0.2).getHex(), 0, 6, 2);
      lamp.position.copy(head.position);
      lamp.position.y = 0.5;
      group.add(lamp);

      beams.push({ bar, head, lamp, share });
    });

    rows.push({ group, beams, tint });
  }

  const DARK = new Color(0x05040a);
  const wash = new Color(0x05040a);
  const washTarget = new Color(0x05040a);
  renderer.setClearColor(wash, 1);

  let index = 0;
  let shown = 0;
  let openTarget = 0;
  let openT = 0;

  const loop = runLoop((delta, time) => {
    if (openT !== openTarget) {
      const step = delta / 1.5;
      openT =
        openTarget > openT
          ? Math.min(openT + step, openTarget)
          : Math.max(openT - step, openTarget);
    }

    const drawn = openT < 0.5 ? 4 * openT * openT * openT : 1 - Math.pow(-2 * openT + 2, 3) / 2;

    shown = approach(shown, index, 5, delta);

    const current = directions[clamp(Math.round(shown), directions.length)];
    if (current) washTarget.set(current.tint);

    slats.forEach((slat, i) => {
      // The row being read is at full strength and the rest are the list it
      // sits in, so the cover says which track is selected before play.
      const chosen = Math.max(0, 1 - Math.abs(i - shown) * 1.4);

      // Apart, alternately, and out of frame: an equaliser opening rather
      // than a shutter lifting.
      const travel = drawn * 7;
      slat.group.position.x = slat.sign * travel;
      slat.group.rotation.z = slat.sign * drawn * 0.12;

      const fade = 1 - Math.min(drawn * 1.6, 1);
      (slat.lit.material as MeshBasicMaterial).opacity = fade * (0.45 + chosen * 0.55);
      (slat.base.material as MeshBasicMaterial).opacity = fade * (0.5 + chosen * 0.5);
    });

    shutter.visible = drawn < 0.995;

    rows.forEach((row, i) => {
      const offset = i - shown;
      row.group.position.z = -offset * ROW_DEPTH;
      // Only the row being read is at full strength; the rest are the room it
      // stands in.
      const focus = Math.max(0, 1 - Math.abs(offset) * 0.7);
      const strength = focus * drawn;

      for (const beam of row.beams) {
        (beam.bar.material as MeshBasicMaterial).opacity = 0.25 + strength * 0.75;
        (beam.head.material as MeshBasicMaterial).opacity = strength;
        // A slow breath along the beam, so a still page is not a photograph.
        beam.lamp.intensity = strength * (5 + Math.sin(time * 1.6 + i) * 1.2);
      }
    });

    wash.lerp(DARK.clone().lerp(washTarget, 0.22 * drawn), 1 - Math.exp(-4 * delta));
    renderer.setClearColor(wash, 1);

    renderer.render(scene, camera);
  });

  fitCamera(room, window.innerWidth, window.innerHeight, options.portrait);

  return {
    setOpen(open) {
      openTarget = open ? 1 : 0;
    },

    setIndex(next) {
      index = Math.min(Math.max(next, 0), Math.max(directions.length - 1, 0));
    },

    resize(width, height, portrait) {
      fitCamera(room, width, height, portrait);
      // A phone sees the room end-on, so the cover comes closer to fill it.
      shutter.scale.setScalar(portrait ? 0.72 : 1);
    },

    dispose() {
      loop.stop();
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

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}
