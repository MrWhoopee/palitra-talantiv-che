import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  TorusGeometry,
} from 'three';

/**
 * A camera, pointed at whoever is looking.
 *
 * This is the teachers' cover: a photograph is about to be taken, and the
 * person behind it is who the page is about. It is built from primitives on
 * purpose - a body, a barrel and a few rings is what a camera is from the
 * front, and at this angle nothing here has to pretend to be a model.
 *
 * The flash is a real light as well as a lit box: firing it has to throw
 * something onto the room, or it is a white square coming on.
 */

export interface CameraProp {
  readonly group: Group;
  /** 0 is dark, 1 is the moment the flash fires. */
  setFlash(strength: number): void;
  dispose(): void;
}

export function createCameraProp(): CameraProp {
  const group = new Group();

  // Metalness stays low. A metal in three.js reflects an environment map, and
  // this room has none - crank it up and the camera renders as a black
  // cut-out, which is exactly how the first screenshot came back.
  const shell = new MeshStandardMaterial({ color: 0x2a2733, roughness: 0.5, metalness: 0.25 });
  const grain = new MeshStandardMaterial({ color: 0x1a1822, roughness: 0.9, metalness: 0.1 });
  const chrome = new MeshStandardMaterial({ color: 0xb9bfd0, roughness: 0.3, metalness: 0.35 });

  const body = new Mesh(new BoxGeometry(3.1, 2, 1.1), shell);
  body.position.y = 0.1;
  group.add(body);

  // The grip, which is the one asymmetry that stops a box reading as a box.
  const grip = new Mesh(new BoxGeometry(0.7, 1.9, 1.24), grain);
  grip.position.set(-1.28, 0.05, 0.02);
  group.add(grip);

  // The prism hump, and the flash sitting on it.
  const hump = new Mesh(new BoxGeometry(1.15, 0.55, 0.95), shell);
  hump.position.set(0.1, 1.24, 0);
  group.add(hump);

  const flashMaterial = new MeshBasicMaterial({ color: 0xfff4e2 });
  const flash = new Mesh(new BoxGeometry(0.86, 0.16, 0.5), flashMaterial);
  flash.position.set(0.1, 1.55, 0.16);
  group.add(flash);

  const flashLight = new PointLight(0xfff3e0, 0, 26, 1.8);
  flashLight.position.set(0.1, 1.6, 1.6);
  group.add(flashLight);

  // The shutter release, because a camera nobody can imagine pressing is a
  // prop rather than an invitation.
  const release = new Mesh(new CylinderGeometry(0.12, 0.12, 0.12, 20), chrome);
  release.position.set(-1.28, 1.06, 0.2);
  group.add(release);

  // The barrel, pointed at whoever is looking: rings of falling radius, which
  // is what a lens looks like head on.
  const barrel = new Group();
  barrel.position.set(0.1, 0.05, 0);
  group.add(barrel);

  const rings: Array<[number, number, number]> = [
    [1.02, 0.42, 0.62],
    [0.94, 0.34, 0.98],
    [0.86, 0.26, 1.26],
  ];

  for (const [radius, depth, z] of rings) {
    const ring = new Mesh(new CylinderGeometry(radius, radius, depth, 48), shell);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = z;
    barrel.add(ring);
  }

  // A knurled grip ring, the way a focus ring is knurled.
  const knurl = new Mesh(new TorusGeometry(0.98, 0.07, 12, 64), grain);
  knurl.position.z = 0.8;
  barrel.add(knurl);

  const rim = new Mesh(new RingGeometry(0.74, 0.86, 64), chrome);
  rim.position.z = 1.4;
  barrel.add(rim);

  // The glass: dark, and just reflective enough to catch the room.
  const glass = new Mesh(
    new CircleGeometry(0.75, 64),
    new MeshPhysicalMaterial({
      color: 0x0a0a16,
      roughness: 0.08,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  );
  glass.position.z = 1.39;
  barrel.add(glass);

  // The violet the whole site is built on, caught in the coating.
  // The coating catches the studio's violet, and no more than catches it: a
  // filled disc reads as a purple lamp rather than as glass.
  const bloom = new Mesh(
    new CircleGeometry(0.34, 64),
    new MeshBasicMaterial({ color: 0x6b4bc4, transparent: true, opacity: 0.32 }),
  );
  bloom.position.z = 1.4;
  barrel.add(bloom);

  return {
    group,

    setFlash(strength) {
      flashMaterial.color.setRGB(1, 0.96 + strength * 0.04, 0.89 + strength * 0.11);
      flashLight.intensity = strength * 240;
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
