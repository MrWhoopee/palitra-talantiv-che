import { InstancedMesh, Matrix4, Mesh, type Color, type Material, type Object3D } from 'three';
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

/**
 * Copies of one prop, placed by matrix.
 *
 * The whole reason this is a helper rather than a `new InstancedMesh` at every
 * call site: gltfpack stores positions as integers and leaves the scale that
 * turns them back into metres on the mesh's own node. An `InstancedMesh` is
 * handed a geometry and nothing else, so that scale has to be folded into
 * every instance matrix - and folding it into the geometry instead does not
 * work, because writing transformed floats back into a `Uint16Array` truncates
 * the prop to a point. Six more rooms will want instances; none of them should
 * have to know this.
 */
export interface PropInstances {
  readonly mesh: InstancedMesh;
  /** Where this copy stands. The dequantisation is applied on top. */
  place(index: number, matrix: Matrix4): void;
  /** Per-copy colour. Only materials that read it - `MeshBasicMaterial` - show it. */
  paint(index: number, color: Color): void;
  /** Call once the copies are placed. */
  commit(): void;
}

export interface PropLibrary {
  /**
   * A copy of the prop, to stand somewhere. Use for the props there is one of:
   * the reception desk, the sign by the door.
   */
  take(name: string): Object3D;
  /**
   * Many copies of the prop, drawn as one. Use for the props whose number comes
   * from the data - chairs, mirrors, sheets. Thirty chairs drawn as one is the
   * reason the rooms can afford to be rooms.
   *
   * `material` replaces the prop's own, for the cases where the copies are not
   * the same as the model: the door's glass is unlit in the corridor because it
   * stands in for light coming through from the other side.
   */
  instance(name: string, count: number, material?: Material): PropInstances;
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

    instance(name, count, material) {
      const node = find(name);
      const mesh = meshIn(node, name);

      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const use = material ?? own;

      if (use === undefined) throw new Error(`У предмета «${name}» немає матеріалу.`);

      // The mesh's place in the file, which for a packed glb is the scale and
      // offset that turn quantised integers back into metres.
      mesh.updateWorldMatrix(true, false);
      const dequantise = mesh.matrixWorld.clone();

      const instances = new InstancedMesh(mesh.geometry, use, count);
      const composed = new Matrix4();

      return {
        mesh: instances,

        place(index, matrix) {
          instances.setMatrixAt(index, composed.multiplyMatrices(matrix, dequantise));
        },

        paint(index, color) {
          instances.setColorAt(index, color);
        },

        commit() {
          instances.instanceMatrix.needsUpdate = true;
          if (instances.instanceColor !== null) instances.instanceColor.needsUpdate = true;
        },
      };
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
