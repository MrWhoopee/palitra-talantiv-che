import { DoubleSide, Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, type IUniform } from 'three';

/**
 * The two halves of the house curtain, and the valance that stays put above
 * them.
 *
 * Two things make cloth out of a flat plane. The first is `sheen`, which is
 * what a physical material has instead of a specular highlight for fabric: it
 * lights the grazing angles rather than the facing ones, which is the whole
 * reason velvet looks like velvet and not like painted card. The second is the
 * fold wave in the vertex shader - and, more to the point, recomputing the
 * normal from its derivative. Displacing the surface without touching the
 * normals gives you a rippled silhouette lit as if it were still flat, which
 * reads as a bug rather than as cloth.
 *
 * Opening is a gather, not a slide: each half scales down towards its own wing,
 * and the fold amplitude climbs as it goes, because cloth bunches when it is
 * drawn back. The scaling happens on the group, so the folds live in material
 * space and compress with the cloth instead of sliding through it.
 */

/** Deep crimson, with the shadow tint left to the ambient light to supply. */
export const CURTAIN_COLOR = 0x6b1020;

const OPENING_WIDTH = 13;
const CURTAIN_HEIGHT = 7.2;
const VALANCE_HEIGHT = 1.35;
const HALF_WIDTH = OPENING_WIDTH * 0.56;

interface FoldUniforms {
  uTime: IUniform<number>;
  uGather: IUniform<number>;
  uFoldK: IUniform<number>;
  uFoldAmp: IUniform<number>;
  uHeight: IUniform<number>;
}

const VERTEX_HEAD = /* glsl */ `
  uniform float uTime;
  uniform float uGather;
  uniform float uFoldK;
  uniform float uFoldAmp;
  uniform float uHeight;
  varying float vFold;

  float ptFoldPhase(float x) {
    return x * uFoldK + sin(uTime * 0.22) * 0.35;
  }
  float ptFoldZ(float x) {
    return sin(ptFoldPhase(x)) * uFoldAmp * (1.0 + uGather * 2.4);
  }
  float ptFoldSlope(float x) {
    return cos(ptFoldPhase(x)) * uFoldAmp * uFoldK * (1.0 + uGather * 2.4);
  }
`;

const FRAGMENT_HEAD = /* glsl */ `
  varying float vFold;
`;

function makeVelvet(
  color: number,
  foldCount: number,
  amplitude: number,
): {
  material: MeshPhysicalMaterial;
  uniforms: FoldUniforms;
} {
  const uniforms: FoldUniforms = {
    uTime: { value: 0 },
    uGather: { value: 0 },
    uFoldK: { value: (foldCount * Math.PI * 2) / HALF_WIDTH },
    uFoldAmp: { value: amplitude },
    uHeight: { value: CURTAIN_HEIGHT },
  };

  const material = new MeshPhysicalMaterial({
    color,
    roughness: 0.94,
    metalness: 0,
    sheen: 1,
    sheenColor: 0xff8a6a,
    sheenRoughness: 0.38,
    side: DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = VERTEX_HEAD + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `
        vec3 objectNormal = normalize(vec3(-ptFoldSlope(position.x), 0.0, 1.0));
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        vec3 transformed = vec3(position);
        transformed.z += ptFoldZ(position.x);
        // The hem is looser than the head, and it stops moving once the cloth
        // is gathered and has nothing left to hang from.
        float ptHang = 1.0 - position.y / uHeight;
        transformed.x += sin(uTime * 0.35 + position.y * 0.6) * 0.035 * ptHang * (1.0 - uGather);
        vFold = sin(position.x * uFoldK) * 0.5 + 0.5;
      `,
    );

    shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
        #include <color_fragment>
        diffuseColor.rgb *= mix(0.42, 1.0, vFold);
      `,
    );
  };

  return { material, uniforms };
}

export interface Curtains {
  readonly group: Group;
  /** 0 is shut, 1 is fully drawn back into the wings. */
  setOpen(open: number): void;
  update(time: number): void;
  dispose(): void;
}

export function createCurtains(color: number = CURTAIN_COLOR): Curtains {
  const group = new Group();

  const cloth = makeVelvet(color, 11, 0.17);
  const valance = makeVelvet(color, 15, 0.1);

  // Each half is built with its pivot at its own wing, so scaling it in x
  // gathers it outwards rather than dragging it through the middle.
  const leftGeometry = new PlaneGeometry(HALF_WIDTH, CURTAIN_HEIGHT, 64, 20);
  leftGeometry.translate(HALF_WIDTH / 2, CURTAIN_HEIGHT / 2, 0);
  const rightGeometry = leftGeometry.clone();
  rightGeometry.scale(-1, 1, 1);

  const left = new Mesh(leftGeometry, cloth.material);
  left.position.set(-OPENING_WIDTH / 2, 0, 0);
  const right = new Mesh(rightGeometry, cloth.material);
  right.position.set(OPENING_WIDTH / 2, 0, 0);

  const valanceGeometry = new PlaneGeometry(OPENING_WIDTH * 1.12, VALANCE_HEIGHT, 96, 6);
  const valanceMesh = new Mesh(valanceGeometry, valance.material);
  valanceMesh.position.set(0, CURTAIN_HEIGHT - VALANCE_HEIGHT / 2, 0.15);

  group.add(left, right, valanceMesh);

  return {
    group,

    setOpen(open) {
      const t = Math.min(Math.max(open, 0), 1);
      left.scale.x = 1 - t * 0.82;
      right.scale.x = left.scale.x;
      left.position.x = -OPENING_WIDTH / 2 - t * 0.55;
      right.position.x = OPENING_WIDTH / 2 + t * 0.55;
      cloth.uniforms.uGather.value = t;
      // The valance lifts a little rather than gathering; it has nowhere to go.
      valanceMesh.position.y = CURTAIN_HEIGHT - VALANCE_HEIGHT / 2 + t * 0.28;
    },

    update(time) {
      cloth.uniforms.uTime.value = time;
      valance.uniforms.uTime.value = time;
    },

    dispose() {
      leftGeometry.dispose();
      rightGeometry.dispose();
      valanceGeometry.dispose();
      cloth.material.dispose();
      valance.material.dispose();
    },
  };
}
