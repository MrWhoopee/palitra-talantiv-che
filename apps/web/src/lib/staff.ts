/**
 * The pointer writes Shchedryk.
 *
 * Five lines follow the cursor, a clef and two flats open the bar, and the
 * melody is set on it in beamed quavers. Not glyphs out of a font: heads,
 * stems and beams are drawn, because `♫` is a fixed pair of notes at a fixed
 * pitch, and a bar of real music is four notes at four pitches under one beam.
 *
 * Drawn on a 2D canvas. Lines, ellipses and a slanted beam are what notation
 * is made of, and a browser draws all three sharply - WebGL is kept for the
 * show, where there is a scene to render.
 */

/** Positions kept in the trail. Older ones are dropped from the front. */
const MAX_POINTS = 90;

/** How long anything stays on the page, in milliseconds. */
const LIFETIME = 2200;

/**
 * Lines in a stave, and the gap between them in CSS pixels.
 *
 * The gap decides everything else. Shchedryk's whole melody lives inside a
 * minor third, which is two gaps: set the stave small and the tune collapses
 * into a stripe with no shape in it.
 */
const LINES = 5;
const LINE_GAP = 11;

/** Below this the pointer has not really moved and nothing is written. */
const MIN_STEP_PX = 5;

/** Travel between one note and the next. Close, the way a bar is engraved. */
const NOTE_SPACING_PX = 30;

/** A stroke that paused this long starts a new bar, with its own clef. */
const NEW_BAR_AFTER_MS = 700;

/** How far a stem rises above its head. */
const STEM = LINE_GAP * 3;

/**
 * Quavers to a beat, and beats to a bar.
 *
 * Shchedryk is in three-four and runs in even quavers, so a bar holds six of
 * them and an engraver beams them in pairs - one beam per beat. The melody's
 * figure is four notes long, which is why it never lines up with the bar: four
 * against six is the hemiola the whole piece rocks on, and drawing the beams
 * by the beat rather than by the figure is what makes that visible.
 */
const QUAVERS_PER_BEAT = 2;
const QUAVERS_PER_BAR = 6;

const CLEF = '\u{1D11E}';
const FLAT = '♭';

/**
 * Steps on the stave, counted from the middle line: zero is the middle line,
 * one step is a line or a space, and positive goes down.
 */
const B4 = 0;
const A4 = 1;
const G4 = 2;
const E5 = -3;

/**
 * Shchedryk, note for note.
 *
 * Leontovych built the whole piece on one four-note figure inside a minor
 * third - B flat, A, B flat, G in G minor - and repeated it sixty-eight
 * times. That figure is the melody as every edition writes it, and it is why
 * this reads as music rather than as scattered glyphs: the shape repeats, and
 * a repeating shape is what a reader recognises.
 *
 * Written in 1916, and long out of copyright.
 */
const MELODY = [B4, A4, B4, G4];

/** Two flats after the clef: G minor, in the order scores write them. */
const KEY_SIGNATURE = [B4, E5];

const MUSIC_FONTS = "'Segoe UI Symbol', 'Noto Music', 'Apple Symbols', serif";

interface Point {
  x: number;
  y: number;
  born: number;
}

interface Note {
  x: number;
  y: number;
  born: number;
  /** Its place in the run, which is what decides where a beam ends. */
  slot: number;
}

interface Glyph {
  x: number;
  y: number;
  born: number;
  text: string;
  size: number;
}

export interface StaffLayer {
  stop(): void;
}

export function startStaff(canvas: HTMLCanvasElement, ink: string): StaffLayer | null {
  const context = canvas.getContext('2d');
  if (context === null) return null;

  const trail: Point[] = [];
  const notes: Note[] = [];
  const glyphs: Glyph[] = [];
  const bars: Point[] = [];

  // A font with a clef in it is not a given. Asked once, rather than drawing
  // a row of empty boxes and finding out from a screenshot.
  const clefAvailable = hasGlyph(context, CLEF);

  let sinceLastNote = 0;
  let lastMoveAt = 0;
  let written = 0;
  let frame = 0;
  let running = true;

  function resize() {
    // One device pixel per CSS pixel, at most two, and never a buffer wider
    // than a large window. Zoom raises the ratio as the viewport shrinks,
    // which is exactly when the extra pixels are worth least.
    const scale = Math.min(window.devicePixelRatio || 1, 2, 1600 / Math.max(window.innerWidth, 1));

    canvas.width = Math.floor(Math.max(window.innerWidth, 1) * scale);
    canvas.height = Math.floor(Math.max(window.innerHeight, 1) * scale);
    context!.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function onPointerMove(event: PointerEvent) {
    const now = performance.now();
    const last = trail[trail.length - 1];
    const step =
      last === undefined
        ? Number.POSITIVE_INFINITY
        : Math.hypot(event.clientX - last.x, event.clientY - last.y);

    if (step < MIN_STEP_PX) return;

    // A pause ends the bar. The next move opens a new one, and a bar opens
    // with its clef.
    if (trail.length === 0 || now - lastMoveAt > NEW_BAR_AFTER_MS) {
      trail.length = 0;
      sinceLastNote = 0;
      written = 0;

      if (clefAvailable) {
        // A treble clef reaches well above and below the stave it opens; at
        // the size of a note head it reads as a squiggle rather than a clef.
        glyphs.push({
          x: event.clientX,
          y: event.clientY,
          born: now,
          text: CLEF,
          size: LINE_GAP * 6.2,
        });
      }
    } else {
      sinceLastNote += step;

      // A bar line takes room of its own, the way it does on paper.
      const opensBar = written >= KEY_SIGNATURE.length && slotOf(written) % QUAVERS_PER_BAR === 0;
      const due = opensBar ? NOTE_SPACING_PX * 1.6 : NOTE_SPACING_PX;

      if (sinceLastNote >= due) {
        sinceLastNote = 0;

        if (opensBar) {
          bars.push({ x: event.clientX - NOTE_SPACING_PX * 0.55, y: event.clientY, born: now });
        }

        write(written, event.clientX, event.clientY, now);
        written += 1;
      }
    }

    lastMoveAt = now;
    trail.push({ x: event.clientX, y: event.clientY, born: now });
    if (trail.length > MAX_POINTS) trail.shift();
  }

  /** The key signature first, then the melody, cycling. */
  function write(index: number, x: number, y: number, now: number) {
    const flat = KEY_SIGNATURE[index];

    if (flat !== undefined) {
      glyphs.push({ x, y: y + stepToPixels(flat), born: now, text: FLAT, size: LINE_GAP * 2.2 });
      return;
    }

    const slot = index - KEY_SIGNATURE.length;

    notes.push({
      x,
      // The pitch belongs to the melody and the moment to the hand.
      y: y + stepToPixels(MELODY[slot % MELODY.length]!),
      born: now,
      slot,
    });
  }

  function tick(now: number) {
    if (!running) return;

    // Everything expires from the front, which is what makes the bar trail
    // away behind the pointer instead of hanging on the page.
    while (trail.length > 0 && now - trail[0]!.born > LIFETIME) trail.shift();

    // And nothing outlives the stave it stands on. The trail is capped by
    // count, so a fast hand fills it in less time than the lifetime allows -
    // without this, notes were left hanging over blank paper behind it.
    const earliest = trail[0]?.born ?? Number.POSITIVE_INFINITY;

    while (notes.length > 0 && notes[0]!.born < earliest) notes.shift();
    while (glyphs.length > 0 && glyphs[0]!.born < earliest) glyphs.shift();
    while (bars.length > 0 && bars[0]!.born < earliest) bars.shift();

    context!.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context!.strokeStyle = ink;
    context!.fillStyle = ink;
    context!.lineCap = 'round';
    context!.lineJoin = 'round';

    drawStave(context!, trail, now);

    // The light goes on the notes and not on the stave. Five glowing lines
    // over a paragraph turn into one smear, and the words underneath are what
    // the page is actually for.
    context!.shadowColor = ink;
    context!.shadowBlur = 5;

    drawBars(context!, bars, now);
    drawBeams(context!, notes, now);

    for (const note of notes) drawNote(context!, note, fade(now, note.born));

    context!.textAlign = 'center';
    context!.textBaseline = 'middle';

    for (const glyph of glyphs) {
      context!.globalAlpha = fade(now, glyph.born) * 0.8;
      context!.font = `${glyph.size}px ${MUSIC_FONTS}`;
      context!.fillText(glyph.text, glyph.x, glyph.y);
    }

    context!.globalAlpha = 1;
    context!.shadowBlur = 0;
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
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

/**
 * The five lines, each drawn as one curve rather than a chain of straight
 * pieces: a hand that changes direction quickly would otherwise put a corner
 * in the stave, and a stave has no corners.
 *
 * Every segment runs between the midpoints of neighbouring samples, with the
 * sample itself as the control point - the cheapest way to pass a smooth
 * curve through a series of positions.
 */
function drawStave(context: CanvasRenderingContext2D, trail: Point[], now: number) {
  if (trail.length < 3) return;

  context.lineWidth = 1;

  for (let line = 0; line < LINES; line += 1) {
    const offset = (line - (LINES - 1) / 2) * LINE_GAP;

    for (let i = 1; i < trail.length - 1; i += 1) {
      const previous = trail[i - 1]!;
      const point = trail[i]!;
      const next = trail[i + 1]!;

      context.globalAlpha = fade(now, point.born) * 0.3;
      context.beginPath();
      context.moveTo((previous.x + point.x) / 2, (previous.y + point.y) / 2 + offset);
      context.quadraticCurveTo(
        point.x,
        point.y + offset,
        (point.x + next.x) / 2,
        (point.y + next.y) / 2 + offset,
      );
      context.stroke();
    }
  }
}

/** Where a stem stands on its head, and where its beam meets it. */
function stemX(note: Note): number {
  return note.x + LINE_GAP * 0.52;
}

/**
 * The beam over each run of quavers. Stems up throughout, because every pitch
 * in this melody sits on or below the middle line - which is the rule an
 * engraver applies, and the reason it looks right.
 */
function drawBeams(context: CanvasRenderingContext2D, notes: Note[], now: number) {
  context.lineWidth = 2.4;

  for (let i = 1; i < notes.length; i += 1) {
    const from = notes[i - 1]!;
    const to = notes[i]!;

    // Consecutive, and inside the same beat. A beam that crossed a beat would
    // be a beam saying something else about the rhythm.
    if (to.slot - from.slot !== 1) continue;
    if (Math.floor(from.slot / QUAVERS_PER_BEAT) !== Math.floor(to.slot / QUAVERS_PER_BEAT)) {
      continue;
    }

    context.globalAlpha = Math.min(fade(now, from.born), fade(now, to.born)) * 0.85;
    context.beginPath();
    context.moveTo(stemX(from), from.y - STEM);
    context.lineTo(stemX(to), to.y - STEM);
    context.stroke();
  }
}

/** A filled head, tilted the way a nib leaves it, and its stem. */
function drawNote(context: CanvasRenderingContext2D, note: Note, alpha: number) {
  context.globalAlpha = alpha * 0.85;

  context.save();
  context.translate(note.x, note.y);
  context.rotate(-0.32);
  context.beginPath();
  // A head is one stave space tall and a little wider than it is tall. Any
  // bigger and it swallows the lines it is supposed to sit on.
  context.ellipse(0, 0, LINE_GAP * 0.56, LINE_GAP * 0.42, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(stemX(note), note.y - 1);
  context.lineTo(stemX(note), note.y - STEM);
  context.stroke();
}

/**
 * Eased rather than linear, so a bar thins out gradually instead of stepping
 * down at a constant rate and disappearing while still plainly visible.
 */
function fade(now: number, born: number): number {
  const life = 1 - (now - born) / LIFETIME;
  if (life <= 0) return 0;

  return life * life;
}

/**
 * Which quaver of the run a written place is, with the key signature taken
 * off the front: the clef and the flats stand before the music starts, and
 * counting them would put the bar lines in the wrong places.
 */
function slotOf(index: number): number {
  return index - KEY_SIGNATURE.length;
}

/**
 * The line that divides one bar from the next, drawn through the stave.
 *
 * Vertical rather than square to the stave's slope: a bar line is vertical on
 * paper, and matching the slope would read as a lean rather than as a rule.
 */
function drawBars(context: CanvasRenderingContext2D, bars: Point[], now: number) {
  context.lineWidth = 1.2;

  for (const bar of bars) {
    const half = ((LINES - 1) / 2) * LINE_GAP;

    context.globalAlpha = fade(now, bar.born) * 0.45;
    context.beginPath();
    context.moveTo(bar.x, bar.y - half);
    context.lineTo(bar.x, bar.y + half);
    context.stroke();
  }
}

/** A step on the stave in pixels: one step is half the gap between lines. */
function stepToPixels(step: number): number {
  return (step * LINE_GAP) / 2;
}

/**
 * Whether the font in use actually has this character.
 *
 * Measured against a code point no font defines: if the two come out the same
 * width, both are the browser's "missing glyph", and drawing it would put a
 * row of empty boxes across the page.
 */
function hasGlyph(context: CanvasRenderingContext2D, glyph: string): boolean {
  context.font = `20px ${MUSIC_FONTS}`;
  const missing = context.measureText('\u{10FFFD}').width;

  return Math.abs(context.measureText(glyph).width - missing) > 0.5;
}
