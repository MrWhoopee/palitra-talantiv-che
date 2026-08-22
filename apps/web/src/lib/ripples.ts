/**
 * The water under the page.
 *
 * A fragment shader over one full-screen triangle. The pointer drops rings
 * that spread and fade; there is no simulation grid and no texture, only a
 * sum of a dozen analytic waves, which is what keeps this small enough to
 * ship on a page that has a performance budget.
 *
 * Written by hand rather than taken from `react-water-wave`, which is what
 * this started from: that library wraps the page in a component of its own
 * and wants an image to refract. Here the layer sits behind the document as
 * a sibling, and the site's own paper colour is the thing being disturbed.
 */

/** Rings alive at once. Older ones are overwritten, oldest first. */
const MAX_RIPPLES = 12;

/** How long one ring lives, in seconds. */
const LIFETIME = 1.9;

/** Distance the pointer must travel before it drops another ring. */
const SPACING_PX = 38;

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/**
 * `u_ripples[i]` is (x, y, age, strength), with the position already in
 * pixels and the age counted from the drop.
 */
const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform vec4 u_ripples[${MAX_RIPPLES}];
uniform vec3 u_tint;

out vec4 outColour;

void main() {
  vec2 pixel = gl_FragCoord.xy;
  float wave = 0.0;

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 ripple = u_ripples[i];
    if (ripple.w <= 0.0) continue;

    float distance = length(pixel - ripple.xy);
    float front = ripple.z * 420.0;

    // A ring rather than a filled circle: the crest is a narrow band that
    // travels outward, and everything behind it has already settled.
    float band = exp(-pow((distance - front) / 34.0, 2.0));
    float fade = max(0.0, 1.0 - ripple.z / ${LIFETIME.toFixed(1)});

    wave += sin((distance - front) * 0.06) * band * fade * ripple.w;
  }

  // The layer is transparent except where the water is moving, so the paper
  // colour behind it is the page's own and stays exactly as it was chosen.
  //
  // Multiplied by the alpha because a WebGL canvas is composited as
  // premultiplied by default. Handing it straight colour turns the studio's
  // violet into a pink that belongs to no one - which is exactly how it
  // looked in the first screenshot.
  float alpha = clamp(abs(wave) * 0.28, 0.0, 0.15);
  outColour = vec4(u_tint * alpha, alpha);
}`;

export interface RippleLayer {
  stop(): void;
}

/**
 * Starts the layer. Returns `null` when the browser cannot draw it, which the
 * caller treats as "this page has no water" rather than as a failure - the
 * site is built to read the same without it.
 */
export function startRipples(canvas: HTMLCanvasElement, tint: [number, number, number]) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false });
  if (gl === null) return null;

  const program = link(gl);
  if (program === null) return null;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle large enough to cover the clip space, which is cheaper than
  // two and has no seam down the diagonal.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(program);
  gl.uniform3fv(gl.getUniformLocation(program, 'u_tint'), tint);
  gl.enable(gl.BLEND);
  // `ONE`, not `SRC_ALPHA`, because the shader already multiplied the colour
  // by its alpha - see the note where it does.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
  const ripplesUniform = gl.getUniformLocation(program, 'u_ripples');

  // (x, y, bornAt, strength) per ring, flat, because that is the shape the
  // uniform wants and building it every frame would allocate every frame.
  const ripples = new Float32Array(MAX_RIPPLES * 4);
  let next = 0;
  let last: { x: number; y: number } | null = null;
  let frame = 0;
  let running = true;

  function resize() {
    // Capped at 2: past that the pixels are smaller than the effect and only
    // the battery notices.
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(resolutionUniform, canvas.width, canvas.height);
  }

  function drop(clientX: number, clientY: number, strength: number) {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const slot = next * 4;

    ripples[slot] = clientX * scale;
    // Clip space counts up from the bottom and the pointer counts down from
    // the top.
    ripples[slot + 1] = canvas.height - clientY * scale;
    ripples[slot + 2] = 0;
    ripples[slot + 3] = strength;

    next = (next + 1) % MAX_RIPPLES;
  }

  function onPointerMove(event: PointerEvent) {
    const from = last;
    last = { x: event.clientX, y: event.clientY };
    if (from === null) return;

    const travelled = Math.hypot(event.clientX - from.x, event.clientY - from.y);
    if (travelled < SPACING_PX) {
      last = from;
      return;
    }

    // A fast pointer leaves a stronger wake, the way a hand does.
    drop(event.clientX, event.clientY, Math.min(1, 0.35 + travelled / 260));
  }

  let previous = performance.now();

  function tick(now: number) {
    if (!running) return;

    const elapsed = Math.min((now - previous) / 1000, 0.05);
    previous = now;

    for (let i = 0; i < MAX_RIPPLES; i += 1) {
      if (ripples[i * 4 + 3]! <= 0) continue;
      ripples[i * 4 + 2]! += elapsed;
      if (ripples[i * 4 + 2]! > LIFETIME) ripples[i * 4 + 3] = 0;
    }

    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform4fv(ripplesUniform, ripples);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    frame = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  } satisfies RippleLayer;
}

function link(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (vertex === null || fragment === null) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  // A driver that refuses the program is not an error worth shouting about:
  // the page is complete without the water.
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true ? program : null;
}

function compile(gl: WebGL2RenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (shader === null) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true ? shader : null;
}
