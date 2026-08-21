import { MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three';

/**
 * The surfaces the stage is made of.
 *
 * They are shared across the instruments rather than built per part, because
 * every distinct material is another shader program to compile on the first
 * frame - and the first frame here happens while the curtains are opening,
 * which is the one moment a stutter would be seen.
 *
 * The lacquered pieces are `MeshPhysicalMaterial` for one property:
 * `clearcoat`. A polished piano is not a shiny white surface, it is a matte
 * white surface under a layer of varnish, and those two reflect at different
 * angles. That second layer is the whole reason the instrument reads as
 * expensive under a spotlight.
 */
export interface StageMaterials {
  readonly whiteLacquer: MeshPhysicalMaterial;
  readonly brass: MeshStandardMaterial;
  readonly darkMetal: MeshStandardMaterial;
  readonly ivory: MeshStandardMaterial;
  readonly ebony: MeshStandardMaterial;
  readonly wood: MeshPhysicalMaterial;
  readonly floor: MeshStandardMaterial;
  dispose(): void;
}

export function createMaterials(): StageMaterials {
  const whiteLacquer = new MeshPhysicalMaterial({
    color: 0xf4f2f7,
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });

  const brass = new MeshStandardMaterial({
    color: 0xd8a13a,
    metalness: 1,
    roughness: 0.26,
    // A touch of emission is what lets the bloom pass find the microphone
    // without having to blow out the spotlight to reach it.
    emissive: 0x3a2405,
    emissiveIntensity: 1,
  });

  const darkMetal = new MeshStandardMaterial({
    color: 0x24222c,
    metalness: 0.85,
    roughness: 0.42,
  });

  const ivory = new MeshStandardMaterial({ color: 0xfbf9f4, roughness: 0.35, metalness: 0 });
  const ebony = new MeshStandardMaterial({ color: 0x121118, roughness: 0.3, metalness: 0.1 });

  const wood = new MeshPhysicalMaterial({
    color: 0x9c6432,
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
  });

  const floor = new MeshStandardMaterial({
    color: 0x17141f,
    roughness: 0.38,
    metalness: 0.22,
  });

  const all: Material[] = [whiteLacquer, brass, darkMetal, ivory, ebony, wood, floor];

  return {
    whiteLacquer,
    brass,
    darkMetal,
    ivory,
    ebony,
    wood,
    floor,
    dispose() {
      for (const material of all) material.dispose();
    },
  };
}
