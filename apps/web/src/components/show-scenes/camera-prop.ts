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
  SphereGeometry,
  TorusGeometry,
} from 'three';

/**
 * A camera, pointed at whoever is looking.
 *
 * This is the teachers' cover: a photograph is about to be taken, and the
 * person behind it is who the page is about.
 *
 * Drawn from the outline of a Canon AT-1 rather than loaded from a file. A
 * downloaded model arrived with textures that were not shipped beside it and
 * an origin nobody had tidied, and it read as a silver tin can. The shape of
 * that camera is a wide two-tone body, a prism between two dials, and one big
 * ringed barrel - all four of them boxes and cylinders. Drawing it costs a
 * hundred lines, owes nobody a licence, and weighs nothing.
 */

export interface CameraProp {
  readonly group: Group;
  /** 0 is dark, 1 is the moment the flash fires. */
  setFlash(strength: number): void;
  dispose(): void;
}

/** Half the body: every other measurement is stated against it. */
const HALF = 2.1;

export function createCameraProp(): CameraProp {
  const group = new Group();

  // The two finishes the camera is actually made of: a brushed top plate and
  // the black covering under it. Metalness stays low - there is an
  // environment to reflect now, but a mirror is not what either of these is.
  //
  // The black is very dark on purpose. Between the environment and two lights
  // this room is bright, and a merely dark grey came back looking like a grey
  // camera - which is a different camera.
  const chrome = new MeshStandardMaterial({ color: 0xa8adba, roughness: 0.34, metalness: 0.6 });
  const black = new MeshStandardMaterial({ color: 0x090910, roughness: 0.82, metalness: 0.1 });
  const barrelMetal = new MeshStandardMaterial({
    color: 0x1d1c23,
    roughness: 0.42,
    metalness: 0.4,
  });

  const body = new Mesh(new BoxGeometry(HALF * 2, 2.5, 1.15), black);
  group.add(body);

  // The top plate: the band of brushed metal that makes an AT-1 an AT-1.
  const plate = new Mesh(new BoxGeometry(HALF * 2, 0.62, 1.17), chrome);
  plate.position.y = 1.28;
  group.add(plate);

  // The prism, centred - it sits over the mirror, and the mirror is behind
  // the lens.
  const prism = new Mesh(new BoxGeometry(1.06, 0.46, 0.98), chrome);
  prism.position.set(0, 1.76, 0);
  group.add(prism);

  const prismCap = new Mesh(new BoxGeometry(0.78, 0.14, 0.86), chrome);
  prismCap.position.set(0, 2.03, 0);
  group.add(prismCap);

  // The flash shoe on top of the prism, and the light it throws.
  const shoe = new Mesh(new BoxGeometry(0.5, 0.1, 0.44), barrelMetal);
  shoe.position.set(0, 2.14, 0);
  group.add(shoe);

  const flashMaterial = new MeshBasicMaterial({ color: 0x2a2833 });
  const flash = new Mesh(new BoxGeometry(0.46, 0.09, 0.4), flashMaterial);
  flash.position.set(0, 2.21, 0);
  group.add(flash);

  const flashLight = new PointLight(0xfff3e0, 0, 30, 1.7);
  flashLight.position.set(0, 2.4, 1.4);
  group.add(flashLight);

  // Two dials: the rewind knob on the left, the speed dial on the right.
  const rewind = new Mesh(new CylinderGeometry(0.3, 0.3, 0.16, 28), chrome);
  rewind.position.set(-1.5, 1.66, 0);
  group.add(rewind);

  const rewindStem = new Mesh(new CylinderGeometry(0.12, 0.12, 0.2, 20), chrome);
  rewindStem.position.set(-1.5, 1.52, 0);
  group.add(rewindStem);

  const speed = new Mesh(new CylinderGeometry(0.34, 0.34, 0.2, 28), chrome);
  speed.position.set(1.44, 1.68, 0);
  group.add(speed);

  const release = new Mesh(new CylinderGeometry(0.13, 0.13, 0.1, 20), chrome);
  release.position.set(1.44, 1.82, 0);
  group.add(release);

  // The film advance lever: the one thing that says this camera takes film.
  const lever = new Mesh(new BoxGeometry(0.66, 0.09, 0.2), chrome);
  lever.position.set(1.86, 1.5, 0.28);
  lever.rotation.z = -0.12;
  group.add(lever);

  // The barrel: rings of falling radius, which is what a lens is head on.
  const barrel = new Group();
  barrel.position.z = 0.56;
  group.add(barrel);

  const mount = new Mesh(new CylinderGeometry(0.8, 0.8, 0.26, 56), barrelMetal);
  mount.rotation.x = Math.PI / 2;
  mount.position.z = 0.1;
  barrel.add(mount);

  const aperture = new Mesh(new CylinderGeometry(0.74, 0.77, 0.3, 56), black);
  aperture.rotation.x = Math.PI / 2;
  aperture.position.z = 0.36;
  barrel.add(aperture);

  // The knurled focus ring: the widest thing on the lens, and the only part
  // of it anybody actually holds.
  const focus = new Mesh(new CylinderGeometry(0.78, 0.78, 0.44, 56), black);
  focus.rotation.x = Math.PI / 2;
  focus.position.z = 0.7;
  barrel.add(focus);

  for (const z of [0.56, 0.7, 0.84]) {
    const grip = new Mesh(new TorusGeometry(0.79, 0.02, 8, 64), barrelMetal);
    grip.position.z = z;
    barrel.add(grip);
  }

  const front = new Mesh(new CylinderGeometry(0.72, 0.75, 0.22, 56), barrelMetal);
  front.rotation.x = Math.PI / 2;
  front.position.z = 1.03;
  barrel.add(front);

  const lip = new Mesh(new RingGeometry(0.6, 0.71, 64), chrome);
  lip.position.z = 1.15;
  barrel.add(lip);

  // The glass. Nearly black, and green where the coating catches the room -
  // the one detail that stops a lens reading as a hole.
  const glass = new Mesh(
    new CircleGeometry(0.61, 64),
    new MeshPhysicalMaterial({
      color: 0x070a0c,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    }),
  );
  glass.position.z = 1.14;
  barrel.add(glass);

  const coating = new Mesh(
    new CircleGeometry(0.53, 64),
    new MeshBasicMaterial({ color: 0x1d3a2f, transparent: true, opacity: 0.5 }),
  );
  coating.position.z = 1.15;
  barrel.add(coating);

  // The reflection of a window, which is in every photograph of a lens ever
  // taken.
  const catchlight = new Mesh(
    new CircleGeometry(0.15, 32),
    new MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.16 }),
  );
  catchlight.position.set(-0.22, 0.24, 1.16);
  barrel.add(catchlight);

  // The red dot beside the mount, the way there is one on the body.
  const dot = new Mesh(
    new SphereGeometry(0.05, 16, 16),
    new MeshBasicMaterial({ color: 0xc0392b }),
  );
  dot.position.set(0, 1.02, 0.6);
  group.add(dot);

  return {
    group,

    setFlash(strength) {
      // Dark until it fires: a flash that glows while nothing is happening is
      // a lamp.
      flashMaterial.color.setRGB(
        0.16 + strength * 0.84,
        0.157 + strength * 0.8,
        0.2 + strength * 0.8,
      );
      flashLight.intensity = strength * 260;
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
