import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The studio's prop library.
 *
 * One file for every object the show puts in a room - `props.glb`, built from
 * `assets/blender/` by `pnpm assets:props`. One file rather than thirteen
 * because the corridor leads into any room, so whatever is fetched will be
 * wanted sooner or later, and thirteen requests to learn that is twelve too
 * many.
 *
 * The name a prop is asked for here is the name of its collection in Blender,
 * which is the name of its `.blend`. That chain is the whole convention, and
 * `export.py` refuses to build anything that breaks it - a prop that silently
 * vanished from the library would show up as an empty room, which is a much
 * worse way to find out.
 */

const URL = '/show/props.glb';

export interface PropSource {
  readonly geometry: BufferGeometry;
  readonly material: Material;
}

export interface PropLibrary {
  /**
   * A copy of the prop, to stand somewhere. Use for the props there is one of:
   * the reception desk, the sign by the door.
   */
  take(name: string): Object3D;
  /**
   * The geometry and material behind the prop, for `InstancedMesh`. Use for
   * the props whose number comes from the data - chairs, mirrors, sheets.
   * Thirty chairs drawn as one is the reason the rooms can afford to be rooms.
   */
  sourceOf(name: string): PropSource;
  dispose(): void;
}

/**
 * Progress in bytes, for the light under the door.
 *
 * `LoadingManager` reports files rather than bytes, and one file is either 0
 * or 1 - a strip of light that jumps from nothing to everything is not a
 * loader. So the fetch is done here and the bytes are counted as they arrive.
 */
export type OnProgress = (loaded: number, total: number) => void;

let pending: Promise<PropLibrary> | null = null;

/**
 * Loaded once per session and shared. The corridor and every room ask for the
 * same library, and a second copy would be a second few megabytes for nothing.
 */
export function loadProps(onProgress?: OnProgress): Promise<PropLibrary> {
  pending ??= fetchLibrary(onProgress);

  return pending;
}

async function fetchLibrary(onProgress?: OnProgress): Promise<PropLibrary> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(URL, (event) => {
    // `total` is 0 when the server sends no length - a bar that divides by it
    // would sit at Infinity. Better to report nothing than to report a lie.
    if (event.total > 0) onProgress?.(event.loaded, event.total);
  });

  const root = gltf.scene;

  const find = (name: string): Object3D => {
    const node = root.getObjectByName(name);

    if (node === undefined) {
      throw new Error(
        `У props.glb немає предмета «${name}». ` +
          `Перевір, що assets/blender/props/${name}.blend існує і що ` +
          `pnpm assets:props запускали після його появи.`,
      );
    }

    return node;
  };

  /**
   * Blender wraps a collection in an empty of the same name, so the node found
   * by name is usually a wrapper with the mesh inside it - and the object's
   * own placement can sit on either of them. Whole subtrees are taken and only
   * instancing digs for the mesh, because a clone of the mesh alone loses
   * whatever transform its parent was carrying: that is how the chair first
   * arrived with its legs below the floor.
   */
  const meshIn = (node: Object3D, name: string): Mesh => {
    if (node instanceof Mesh) return node;

    let mesh: Mesh | null = null;
    node.traverse((child) => {
      if (mesh === null && child instanceof Mesh) mesh = child;
    });

    if (mesh === null)
      throw new Error(`Предмет «${name}» у props.glb порожній — у ньому немає меша.`);

    return mesh;
  };

  return {
    take(name) {
      return find(name).clone(true);
    },

    sourceOf(name) {
      const node = find(name);
      const mesh = meshIn(node, name);
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

      if (material === undefined) throw new Error(`У предмета «${name}» немає матеріалу.`);

      // The geometry is handed over in its own local space, so an
      // `InstancedMesh` built from it lands where its matrices say only if the
      // prop was exported with its transforms applied and its origin on the
      // floor. `export.py` and the props' own `.blend` files hold that end up.
      return { geometry: mesh.geometry, material };
    },

    dispose() {
      root.traverse((child) => {
        if (!(child instanceof Mesh)) return;

        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          material.dispose();
        }
      });

      pending = null;
    },
  };
}
