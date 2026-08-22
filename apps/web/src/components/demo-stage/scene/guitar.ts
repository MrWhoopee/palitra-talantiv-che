import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  Path,
  Shape,
  TorusGeometry,
} from 'three';
import type { StageMaterials } from './materials';
import type { Instrument } from './piano';

/**
 * The acoustic guitar on its stand, stage right.
 *
 * Like the piano, it is drawn as an outline and extruded, because the outline
 * is the recognisable part: two bouts and a waist. The soundhole is a real hole
 * in the shape rather than a dark circle painted on the front, which matters
 * more than it sounds - an opening catches the spotlight on its far rim, and
 * that rim is what stops the body reading as a flat cutout.
 */

/** The body outline, waist at the origin, with the soundhole cut out of it. */
function guitarOutline(): Shape {
  const outline = new Shape();
  outline.moveTo(0, 0.62);
  outline.bezierCurveTo(0.3, 0.62, 0.34, 0.36, 0.24, 0.2);
  outline.bezierCurveTo(0.16, 0.06, 0.2, -0.1, 0.3, -0.24);
  outline.bezierCurveTo(0.45, -0.44, 0.3, -0.7, 0, -0.7);
  outline.bezierCurveTo(-0.3, -0.7, -0.45, -0.44, -0.3, -0.24);
  outline.bezierCurveTo(-0.2, -0.1, -0.16, 0.06, -0.24, 0.2);
  outline.bezierCurveTo(-0.34, 0.36, -0.3, 0.62, 0, 0.62);

  const soundhole = new Path();
  soundhole.absarc(0, -0.08, 0.115, 0, Math.PI * 2, true);
  outline.holes.push(soundhole);

  return outline;
}

export function createGuitar(materials: StageMaterials): Instrument {
  const group = new Group();
  const geometries: BufferGeometry[] = [];

  const track = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  // The instrument itself, built upright about its own waist.
  const guitar = new Group();

  const bodyGeometry = track(
    new ExtrudeGeometry(guitarOutline(), {
      depth: 0.115,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 3,
      curveSegments: 32,
    }),
  );
  const body = new Mesh(bodyGeometry, materials.wood);
  guitar.add(body);

  const rosetteGeometry = track(new TorusGeometry(0.125, 0.008, 8, 40));
  const rosette = new Mesh(rosetteGeometry, materials.brass);
  rosette.position.set(0, -0.08, 0.135);
  guitar.add(rosette);

  const bridgeGeometry = track(new BoxGeometry(0.19, 0.05, 0.022));
  const bridge = new Mesh(bridgeGeometry, materials.ebony);
  bridge.position.set(0, -0.4, 0.135);
  guitar.add(bridge);

  const neckGeometry = track(new BoxGeometry(0.07, 0.86, 0.05));
  const neck = new Mesh(neckGeometry, materials.wood);
  neck.position.set(0, 1.02, 0.085);
  guitar.add(neck);

  const fretboardGeometry = track(new BoxGeometry(0.066, 0.84, 0.014));
  const fretboard = new Mesh(fretboardGeometry, materials.ebony);
  fretboard.position.set(0, 1.02, 0.117);
  guitar.add(fretboard);

  const headstock = new Group();
  headstock.position.set(0, 1.5, 0.075);
  headstock.rotation.x = -0.22;
  const headGeometry = track(new BoxGeometry(0.1, 0.2, 0.042));
  const head = new Mesh(headGeometry, materials.wood);
  head.position.y = 0.07;
  headstock.add(head);
  const tunerGeometry = track(new CylinderGeometry(0.011, 0.011, 0.075, 10));
  for (let i = 0; i < 6; i += 1) {
    const tuner = new Mesh(tunerGeometry, materials.brass);
    tuner.rotation.z = Math.PI / 2;
    tuner.position.set(i < 3 ? -0.075 : 0.075, 0.02 + (i % 3) * 0.055, 0);
    headstock.add(tuner);
  }
  guitar.add(headstock);

  // Standing on the rest, leaning back the way a guitar on a stand does.
  guitar.position.set(0, 1.0, 0.02);
  guitar.rotation.x = 0.15;
  group.add(guitar);

  // The stand: a back leg and two front legs, a cradle the body sits in and a
  // yoke that steadies the waist.
  const stand = new Group();

  const legGeometry = track(new CylinderGeometry(0.019, 0.019, 1.12, 10));
  const backLeg = new Mesh(legGeometry, materials.darkMetal);
  backLeg.position.set(0, 0.54, -0.3);
  backLeg.rotation.x = 0.26;
  stand.add(backLeg);

  for (const side of [-1, 1]) {
    const leg = new Mesh(legGeometry, materials.darkMetal);
    leg.position.set(side * 0.24, 0.5, 0.14);
    leg.rotation.x = -0.2;
    leg.rotation.z = -side * 0.18;
    stand.add(leg);
  }

  const cradleGeometry = track(new CylinderGeometry(0.016, 0.016, 0.36, 10));
  const cradle = new Mesh(cradleGeometry, materials.darkMetal);
  cradle.rotation.z = Math.PI / 2;
  cradle.position.set(0, 0.3, 0.08);
  stand.add(cradle);

  const yokeGeometry = track(new CylinderGeometry(0.014, 0.014, 0.22, 10));
  for (const side of [-1, 1]) {
    const arm = new Mesh(yokeGeometry, materials.darkMetal);
    arm.position.set(side * 0.13, 0.96, -0.04);
    arm.rotation.x = Math.PI / 2 - 0.35;
    stand.add(arm);
  }

  group.add(stand);

  // Turned towards the house so the face is seen, not the edge.
  group.rotation.y = -0.42;

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
