import {
  Box3,
  type BufferGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

/**
 * The studio mark, standing in front of the closed curtain.
 *
 * It is built from `public/logo-mark.svg` at runtime rather than from a copy of
 * the outlines kept here, so the mark on this page is the same object as the
 * mark in the header: when the real logo arrives, this follows it without
 * anyone remembering that a second copy existed.
 *
 * The shine is not a texture. It is polished metal - full clearcoat over a
 * violet base - lit by a light the scene walks across the face of the mark.
 * A highlight that travels is the difference between metal and a purple sticker.
 *
 * SVG has y pointing down and three.js has it pointing up, which is why the
 * geometry is flipped before it is centred; skip that and the logo arrives
 * upside down with its baseline where its cap height should be.
 */

export interface LogoMark {
  readonly group: Group;
  /** 0 while the curtain is shut, 1 once it has gone with the reveal. */
  setReveal(reveal: number): void;
  dispose(): void;
}

export async function createLogo(url: string, targetWidth: number): Promise<LogoMark> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`logo-mark: ${response.status}`);
  const source = await response.text();

  const parsed = new SVGLoader().parse(source);
  const geometries: BufferGeometry[] = [];

  const material = new MeshPhysicalMaterial({
    color: 0x7546d0,
    metalness: 0.95,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    emissive: 0x1b0c34,
    transparent: true,
  });

  const letters = new Group();
  for (const path of parsed.paths) {
    for (const shape of SVGLoader.createShapes(path)) {
      const geometry = new ExtrudeGeometry(shape, {
        depth: 2.4,
        bevelEnabled: true,
        bevelThickness: 0.6,
        bevelSize: 0.5,
        bevelSegments: 3,
        curveSegments: 12,
      });
      geometries.push(geometry);
      letters.add(new Mesh(geometry, material));
    }
  }

  // SVG y grows downwards; flip, then centre on the mark rather than on the
  // viewBox, which carries whitespace the logo does not.
  letters.scale.y = -1;

  const bounds = new Box3().setFromObject(letters);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());
  const scale = size.x > 0 ? targetWidth / size.x : 1;

  letters.position.sub(centre);
  const restY = letters.position.y;

  const group = new Group();
  group.add(letters);
  group.scale.setScalar(scale);

  return {
    group,

    setReveal(reveal) {
      const t = Math.min(Math.max(reveal, 0), 1);
      // Lifts and dissolves rather than simply switching off: the mark is
      // handing the stage over, and the eye should follow it out of frame.
      material.opacity = 1 - t;
      // The lift moves the outlines inside the mark, never the group: the group
      // carries the placement the scene chose, and writing to it from here is
      // what dropped the logo onto the floor.
      letters.position.y = restY + (t * 0.9) / scale;
      group.scale.setScalar(scale * (1 + t * 0.14));
      group.visible = t < 0.999;
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
    },
  };
}
