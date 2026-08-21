import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
} from 'three';
import type { StageMaterials } from './materials';

/**
 * The white grand, stage left.
 *
 * It is a placeholder, so it is built the way a placeholder should be: from the
 * plan outline, which is the one thing about a grand piano that is unmistakable
 * even as a silhouette. Nobody looks at a shape with a straight bass side and a
 * bent treble side and wonders what it is. Detail that would not survive a
 * spotlight at four metres - the music desk, the hinges, the individual
 * dampers - is not here, and a real model will bring it later.
 *
 * The lid is a separate group hinged on the straight side, because a closed
 * grand and an open grand are different objects to the eye, and the open one is
 * the one that says "concert".
 */

const CASE_HEIGHT = 0.34;
const LEG_HEIGHT = 0.62;
const CASE_TOP = LEG_HEIGHT + CASE_HEIGHT;

/** The plan outline, centred on the case: straight at the bass side, bent at the tail. */
function pianoPlan(): Shape {
  const plan = new Shape();
  plan.moveTo(-0.75, -1.1);
  plan.lineTo(0.75, -1.1);
  plan.lineTo(0.75, 0.35);
  plan.bezierCurveTo(0.78, 0.95, 0.5, 1.15, -0.1, 1.15);
  plan.bezierCurveTo(-0.55, 1.15, -0.75, 0.85, -0.75, 0.2);
  plan.closePath();
  return plan;
}

/** Extrude a plan drawn flat and stand it up, so the extrusion becomes height. */
function standUp(shape: Shape, height: number, bevel: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 24,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export interface Instrument {
  readonly group: Group;
  dispose(): void;
}

export function createPiano(materials: StageMaterials): Instrument {
  const group = new Group();
  const geometries: BufferGeometry[] = [];

  const track = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const caseGeometry = track(standUp(pianoPlan(), CASE_HEIGHT, 0.015));
  const body = new Mesh(caseGeometry, materials.whiteLacquer);
  body.position.y = LEG_HEIGHT;
  group.add(body);

  // The lid, hinged along the straight side at x = 0.75.
  const lidGeometry = track(standUp(pianoPlan(), 0.028, 0.008));
  lidGeometry.translate(-0.75, 0, 0);
  const lid = new Mesh(lidGeometry, materials.whiteLacquer);
  const lidHinge = new Group();
  lidHinge.position.set(0.75, CASE_TOP, 0);
  lidHinge.rotation.z = -0.46;
  lidHinge.add(lid);
  group.add(lidHinge);

  const propGeometry = track(new CylinderGeometry(0.014, 0.014, 0.62, 8));
  const prop = new Mesh(propGeometry, materials.darkMetal);
  prop.position.set(0.16, CASE_TOP + 0.29, -0.35);
  prop.rotation.z = 0.24;
  group.add(prop);

  const legGeometry = track(new CylinderGeometry(0.052, 0.068, LEG_HEIGHT, 12));
  for (const [x, z] of [
    [-0.6, 0.9],
    [0.6, 0.9],
    [0.0, -0.95],
  ] as const) {
    const leg = new Mesh(legGeometry, materials.whiteLacquer);
    leg.position.set(x, LEG_HEIGHT / 2, z);
    group.add(leg);
  }

  // Keyboard: a white bed, the fallboard behind it, and enough black keys to
  // set the rhythm the eye expects.
  const bedGeometry = track(new BoxGeometry(1.34, 0.045, 0.3));
  const bed = new Mesh(bedGeometry, materials.ivory);
  bed.position.set(0, CASE_TOP - 0.075, 1.02);
  group.add(bed);

  const fallboardGeometry = track(new BoxGeometry(1.36, 0.1, 0.05));
  const fallboard = new Mesh(fallboardGeometry, materials.ebony);
  fallboard.position.set(0, CASE_TOP - 0.05, 0.86);
  group.add(fallboard);

  const blackKeyGeometry = track(new BoxGeometry(0.032, 0.03, 0.19));
  for (let i = 0; i < 15; i += 1) {
    // Skip the gaps where a keyboard has no black key, in twos and threes.
    if (i % 7 === 2 || i % 7 === 6) continue;
    const key = new Mesh(blackKeyGeometry, materials.ebony);
    key.position.set(-0.62 + i * 0.088, CASE_TOP - 0.05, 0.97);
    group.add(key);
  }

  // Pedal lyre.
  const lyreGeometry = track(new BoxGeometry(0.16, 0.42, 0.05));
  const lyre = new Mesh(lyreGeometry, materials.whiteLacquer);
  lyre.position.set(0, 0.22, 0.72);
  group.add(lyre);

  const pedalGeometry = track(new BoxGeometry(0.035, 0.015, 0.16));
  for (const x of [-0.055, 0, 0.055]) {
    const pedal = new Mesh(pedalGeometry, materials.brass);
    pedal.position.set(x, 0.1, 0.8);
    group.add(pedal);
  }

  // Bench.
  const bench = new Group();
  const seatGeometry = track(new BoxGeometry(0.92, 0.075, 0.36));
  const seat = new Mesh(seatGeometry, materials.whiteLacquer);
  seat.position.y = 0.5;
  bench.add(seat);
  const benchLegGeometry = track(new CylinderGeometry(0.022, 0.026, 0.5, 8));
  for (const [x, z] of [
    [-0.38, 0.13],
    [0.38, 0.13],
    [-0.38, -0.13],
    [0.38, -0.13],
  ] as const) {
    const leg = new Mesh(benchLegGeometry, materials.whiteLacquer);
    leg.position.set(x, 0.25, z);
    bench.add(leg);
  }
  bench.position.set(0, 0, 1.85);
  group.add(bench);

  // Turned towards the house, so the keyboard is not edge-on to the camera.
  group.rotation.y = 0.5;

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
