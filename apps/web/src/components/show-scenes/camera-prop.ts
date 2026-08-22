import {
  Box3,
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
  Vector3,
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

export interface CameraPropOptions {
  /**
   * A real camera, if the studio has licensed one. It replaces the shapes
   * below the moment it arrives; until then, and if it fails to load, the
   * shapes are what is on screen. A cover that waits for a file is a cover
   * that is blank on a slow connection.
   */
  readonly modelUrl?: string | undefined;
  /** How wide the camera should end up, whatever the file thinks it is. */
  readonly width?: number | undefined;
}

export function createCameraProp(options: CameraPropOptions = {}): CameraProp {
  const group = new Group();
  // Everything drawn by hand goes in here, so a loaded model can take its
  // place with one line rather than by hunting through the tree.
  const built = new Group();
  group.add(built);

  // Metalness stays low. A metal in three.js reflects an environment map, and
  // this room has none - crank it up and the camera renders as a black
  // cut-out, which is exactly how the first screenshot came back.
  const shell = new MeshStandardMaterial({ color: 0x2a2733, roughness: 0.5, metalness: 0.25 });
  const grain = new MeshStandardMaterial({ color: 0x1a1822, roughness: 0.9, metalness: 0.1 });
  const chrome = new MeshStandardMaterial({ color: 0xb9bfd0, roughness: 0.3, metalness: 0.35 });

  const body = new Mesh(new BoxGeometry(3.1, 2, 1.1), shell);
  body.position.y = 0.1;
  built.add(body);

  // The grip, which is the one asymmetry that stops a box reading as a box.
  const grip = new Mesh(new BoxGeometry(0.7, 1.9, 1.24), grain);
  grip.position.set(-1.28, 0.05, 0.02);
  built.add(grip);

  // The prism hump, and the flash sitting on it.
  const hump = new Mesh(new BoxGeometry(1.15, 0.55, 0.95), shell);
  hump.position.set(0.1, 1.24, 0);
  built.add(hump);

  const flashMaterial = new MeshBasicMaterial({ color: 0xfff4e2 });
  const flash = new Mesh(new BoxGeometry(0.86, 0.16, 0.5), flashMaterial);
  flash.position.set(0.1, 1.55, 0.16);
  built.add(flash);

  const flashLight = new PointLight(0xfff3e0, 0, 26, 1.8);
  flashLight.position.set(0.1, 1.6, 1.6);
  built.add(flashLight);

  // The shutter release, because a camera nobody can imagine pressing is a
  // prop rather than an invitation.
  const release = new Mesh(new CylinderGeometry(0.12, 0.12, 0.12, 20), chrome);
  release.position.set(-1.28, 1.06, 0.2);
  built.add(release);

  // The barrel, pointed at whoever is looking: rings of falling radius, which
  // is what a lens looks like head on.
  const barrel = new Group();
  barrel.position.set(0.1, 0.05, 0);
  built.add(barrel);

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

  if (options.modelUrl !== undefined) {
    void loadModel(options.modelUrl, options.width ?? 4.2)
      .then((model) => {
        // The shapes step aside rather than being deleted: the flash light
        // lives among them, and it belongs to the prop, not to the model.
        built.visible = false;
        group.add(model);
      })
      .catch(() => {
        // Keep the shapes. A missing or unreadable model is a cover that
        // looks handmade, not a cover that is missing.
      });
  }

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

/**
 * A camera from a file, normalised: centred on its own middle and scaled to
 * the width the scene expects.
 *
 * Neither is optional. A model exported from anywhere arrives at whatever
 * size and offset its author left it in - metres, centimetres or inches, and
 * an origin that may be anywhere at all - and a scene that trusts the file is
 * a scene that looks right for exactly one file.
 */
async function loadModel(url: string, targetWidth: number): Promise<Group> {
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const model = await new FBXLoader().loadAsync(url);

  // The file arrives with the lens pointing along -X. Turned before it is
  // measured, because the width being normalised has to be the width the
  // scene will actually see.
  model.rotation.y = Math.PI / 2;
  model.updateMatrixWorld(true);

  // Its own materials reference texture maps that were not shipped beside it,
  // and a map that never loads renders black - which is how the camera first
  // arrived. Given the site's own finish instead: a dark body, low metalness,
  // and the room's environment to reflect. That costs the model's colours and
  // keeps its shape, which is the half worth having.
  const shell = new MeshStandardMaterial({
    color: 0x23212b,
    roughness: 0.46,
    metalness: 0.28,
    envMapIntensity: 1.1,
  });

  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = shell;
    object.castShadow = true;
  });

  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const centre = bounds.getCenter(new Vector3());

  model.position.sub(centre);

  // Wrapped rather than scaled in place: the rotation already sits on the
  // model, and stacking a scale and an offset on top of it is how a model
  // ends up sliding out of frame the moment either is touched.
  const holder = new Group();
  holder.add(model);
  holder.scale.setScalar(size.x > 0 ? targetWidth / size.x : 1);

  return holder;
}
