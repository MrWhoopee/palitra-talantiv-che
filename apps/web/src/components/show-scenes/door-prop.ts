import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

/**
 * The studio's door, and the wall it is set in.
 *
 * This is the teachers' cover: you knock, and somebody lets you in. It is the
 * plainest thing that could open a page about the people inside, and that is
 * the reason it is right - a lens, a curtain or an equaliser all say
 * something about the medium, and this says something about being welcomed.
 *
 * The wall is four boxes around an opening rather than one plane with a hole,
 * because four boxes is exactly what an opening in a wall is, and nothing
 * here has to be cut out of anything.
 */

export interface DoorProp {
  readonly group: Group;
  /** 0 is shut, 1 is both leaves swung back. */
  setOpen(open: number): void;
  /** A knock: the leaves take it and settle. */
  setKnock(strength: number): void;
  dispose(): void;
}

/** The opening, which every other measurement is stated against. */
const OPENING_WIDTH = 3.6;
const OPENING_HEIGHT = 5.4;
const WALL_SPAN = 40;

export function createDoorProp(): DoorProp {
  const group = new Group();

  const wallSkin = new MeshStandardMaterial({ color: 0x1b1726, roughness: 0.92, metalness: 0.05 });
  const casing = new MeshStandardMaterial({ color: 0x2c2438, roughness: 0.7, metalness: 0.1 });
  const leafSkin = new MeshStandardMaterial({ color: 0x3a2b1f, roughness: 0.62, metalness: 0.08 });
  const brass = new MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.85 });

  const halfOpening = OPENING_WIDTH / 2;
  const side = (WALL_SPAN - OPENING_WIDTH) / 2;

  // Four boxes around the way in.
  for (const x of [-(halfOpening + side / 2), halfOpening + side / 2]) {
    const pier = new Mesh(new BoxGeometry(side, WALL_SPAN, 0.6), wallSkin);
    pier.position.set(x, OPENING_HEIGHT / 2, 0);
    group.add(pier);
  }

  const lintel = new Mesh(new BoxGeometry(OPENING_WIDTH, WALL_SPAN, 0.6), wallSkin);
  lintel.position.set(0, OPENING_HEIGHT + WALL_SPAN / 2, 0);
  group.add(lintel);

  const threshold = new Mesh(new BoxGeometry(OPENING_WIDTH, WALL_SPAN, 0.6), wallSkin);
  threshold.position.set(0, -WALL_SPAN / 2, 0);
  group.add(threshold);

  // The casing around the opening, which is what makes it a doorway rather
  // than a gap.
  for (const x of [-halfOpening - 0.11, halfOpening + 0.11]) {
    const jamb = new Mesh(new BoxGeometry(0.22, OPENING_HEIGHT + 0.44, 0.34), casing);
    jamb.position.set(x, OPENING_HEIGHT / 2, 0.16);
    group.add(jamb);
  }

  const head = new Mesh(new BoxGeometry(OPENING_WIDTH + 0.44, 0.22, 0.34), casing);
  head.position.set(0, OPENING_HEIGHT + 0.11, 0.16);
  group.add(head);

  const leaves: Group[] = [];

  for (const sign of [-1, 1]) {
    // The pivot sits on the jamb, so the leaf swings on its own hinge rather
    // than sliding sideways and pretending.
    const hinge = new Group();
    hinge.position.set(sign * halfOpening, 0, 0);
    group.add(hinge);
    leaves.push(hinge);

    const leaf = new Mesh(new BoxGeometry(halfOpening, OPENING_HEIGHT, 0.1), leafSkin);
    leaf.position.set((-sign * halfOpening) / 2, OPENING_HEIGHT / 2, 0);
    hinge.add(leaf);

    // Two sunk panels, the way a door has them.
    for (const [y, height] of [
      [OPENING_HEIGHT * 0.68, OPENING_HEIGHT * 0.34],
      [OPENING_HEIGHT * 0.26, OPENING_HEIGHT * 0.3],
    ] as const) {
      const panel = new Mesh(new BoxGeometry(halfOpening - 0.5, height, 0.03), casing);
      panel.position.set((-sign * halfOpening) / 2, y, 0.06);
      hinge.add(panel);
    }

    const handle = new Mesh(new CylinderGeometry(0.05, 0.05, 0.3, 16), brass);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(-sign * 0.3, OPENING_HEIGHT * 0.46, 0.16);
    hinge.add(handle);

    const knob = new Mesh(new SphereGeometry(0.09, 20, 20), brass);
    knob.position.set(-sign * 0.3, OPENING_HEIGHT * 0.46, 0.3);
    hinge.add(knob);
  }

  return {
    group,

    setOpen(open) {
      // Swung inwards, away from whoever knocked - which is how a door lets
      // somebody in rather than pushing them back.
      leaves[0]!.rotation.y = -open * 1.9;
      leaves[1]!.rotation.y = open * 1.9;
    },

    setKnock(strength) {
      // The whole leaf takes the knock and settles: a door that shakes on its
      // hinges is a door somebody is standing behind.
      const shake = Math.sin(strength * Math.PI * 6) * 0.035 * strength;
      leaves[0]!.rotation.y = shake;
      leaves[1]!.rotation.y = -shake;
    },

    dispose() {
      group.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((one) => one.dispose());
        else material.dispose();
      });
    },
  };
}
