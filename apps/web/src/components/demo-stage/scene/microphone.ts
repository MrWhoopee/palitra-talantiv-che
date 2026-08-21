import {
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { StageMaterials } from './materials';
import type { Instrument } from './piano';

/**
 * The gold microphone on its stand, centre stage.
 *
 * This is the one placeholder that is not really a placeholder: a microphone is
 * cylinders and a sphere, which is exactly what code is good at, so the shape
 * here is the shape a model would have. What sells it is the metal - full
 * metalness at a low roughness, plus the faint emission carried by the brass
 * material so the bloom pass has something to catch. Under a spotlight that
 * combination is the shine the whole opening is promising.
 *
 * It leans towards the house, the way a stand is set for someone standing at
 * it, rather than pointing straight at the ceiling.
 */
export function createMicrophone(materials: StageMaterials): Instrument {
  const group = new Group();
  const geometries: BufferGeometry[] = [];

  const track = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const baseGeometry = track(new CylinderGeometry(0.3, 0.37, 0.05, 36));
  const base = new Mesh(baseGeometry, materials.darkMetal);
  base.position.y = 0.025;
  group.add(base);

  const baseTrimGeometry = track(new TorusGeometry(0.3, 0.016, 10, 40));
  const baseTrim = new Mesh(baseTrimGeometry, materials.brass);
  baseTrim.rotation.x = Math.PI / 2;
  baseTrim.position.y = 0.05;
  group.add(baseTrim);

  const columnGeometry = track(new CylinderGeometry(0.026, 0.031, 1.06, 20));
  const column = new Mesh(columnGeometry, materials.brass);
  column.position.y = 0.58;
  group.add(column);

  const collarGeometry = track(new CylinderGeometry(0.043, 0.043, 0.075, 20));
  const collar = new Mesh(collarGeometry, materials.darkMetal);
  collar.position.y = 1.11;
  group.add(collar);

  const upperGeometry = track(new CylinderGeometry(0.019, 0.022, 0.44, 16));
  const upper = new Mesh(upperGeometry, materials.brass);
  upper.position.y = 1.36;
  group.add(upper);

  // The head: clip, body, grille - tilted towards whoever is standing here.
  const head = new Group();
  head.position.set(0, 1.6, 0.02);
  head.rotation.x = -0.3;

  const clipGeometry = track(new CylinderGeometry(0.033, 0.033, 0.09, 16));
  const clip = new Mesh(clipGeometry, materials.darkMetal);
  clip.position.y = 0.02;
  head.add(clip);

  const bodyGeometry = track(new CylinderGeometry(0.046, 0.053, 0.2, 24));
  const body = new Mesh(bodyGeometry, materials.brass);
  body.position.y = 0.16;
  head.add(body);

  const grilleGeometry = track(new SphereGeometry(0.07, 28, 18));
  const grille = new Mesh(grilleGeometry, materials.brass);
  grille.position.y = 0.29;
  head.add(grille);

  group.add(head);

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
