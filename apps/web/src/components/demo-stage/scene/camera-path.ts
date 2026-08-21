import { type Vector3 } from 'three';

/**
 * The camera's route across the stage, written as keyframes pinned to scroll
 * positions rather than to seconds.
 *
 * The rhythm the path exists to produce is fly - dwell - fly - dwell: the pairs
 * of keyframes that sit close together in space but far apart in scroll are the
 * dwells, and the small distance between them is what keeps the frame drifting
 * instead of freezing. A frozen frame reads as a broken page.
 *
 * Every segment is eased in and out at its ends, so the camera settles as it
 * arrives at an instrument and leans into the departure rather than snapping.
 */
export interface Keyframe {
  /** Position along the 0..1 journey. */
  readonly at: number;
  readonly pos: readonly [number, number, number];
  readonly look: readonly [number, number, number];
}

/**
 * The wide framing. There is room across the screen for the stage to be seen
 * whole, so the camera can stand back and take the instruments at an angle.
 */
export const LANDSCAPE_PATH: readonly Keyframe[] = [
  { at: 0.0, pos: [0, 1.9, 10.5], look: [0, 1.5, 0] },
  { at: 0.12, pos: [-3.7, 1.35, 3.5], look: [-4.2, 0.95, 0] },
  { at: 0.3, pos: [-2.9, 1.55, 3.1], look: [-4.2, 1.05, 0] },
  { at: 0.42, pos: [-0.35, 1.5, 3.4], look: [0, 1.5, 0] },
  { at: 0.6, pos: [0.5, 1.62, 3.1], look: [0, 1.5, 0] },
  { at: 0.72, pos: [3.7, 1.35, 3.5], look: [4.2, 1.05, 0] },
  { at: 0.9, pos: [2.9, 1.55, 3.1], look: [4.2, 1.15, 0] },
  { at: 1.0, pos: [0, 2.6, 12], look: [0, 1.3, 0] },
];

/**
 * The tall framing. A portrait screen cannot hold three instruments spread
 * across a stage, so it does not try: the camera comes in close enough that one
 * instrument fills the frame, and the journey between them is longer. Same
 * choreography, less of the room.
 */
export const PORTRAIT_PATH: readonly Keyframe[] = [
  { at: 0.0, pos: [0, 1.9, 9.0], look: [0, 1.5, 0] },
  { at: 0.12, pos: [-4.2, 1.25, 2.5], look: [-4.25, 0.95, 0] },
  { at: 0.3, pos: [-3.8, 1.45, 2.3], look: [-4.2, 1.0, 0] },
  { at: 0.42, pos: [-0.2, 1.45, 2.4], look: [0, 1.45, 0] },
  { at: 0.6, pos: [0.3, 1.55, 2.2], look: [0, 1.45, 0] },
  { at: 0.72, pos: [4.2, 1.25, 2.5], look: [4.25, 1.05, 0] },
  { at: 0.9, pos: [3.8, 1.45, 2.3], look: [4.2, 1.1, 0] },
  { at: 1.0, pos: [0, 2.4, 10.5], look: [0, 1.3, 0] },
];

/** Ease in and out, so a segment starts and finishes at rest. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Read the path at a point in the journey, writing the result into the vectors
 * given rather than allocating: this runs on every frame.
 */
export function sampleCamera(
  path: readonly Keyframe[],
  progress: number,
  outPos: Vector3,
  outLook: Vector3,
): void {
  const p = Math.min(Math.max(progress, 0), 1);

  let next = 1;
  while (next < path.length - 1 && path[next]!.at < p) next += 1;

  const a = path[next - 1]!;
  const b = path[next]!;
  const span = b.at - a.at;
  const t = smoothstep(span <= 0 ? 0 : (p - a.at) / span);

  outPos.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * t,
    a.pos[1] + (b.pos[1] - a.pos[1]) * t,
    a.pos[2] + (b.pos[2] - a.pos[2]) * t,
  );
  outLook.set(
    a.look[0] + (b.look[0] - a.look[0]) * t,
    a.look[1] + (b.look[1] - a.look[1]) * t,
    a.look[2] + (b.look[2] - a.look[2]) * t,
  );
}
