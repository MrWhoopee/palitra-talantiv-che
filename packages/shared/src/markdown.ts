/**
 * The small part of markdown the studio's pages are written in, parsed into
 * blocks the web app renders as elements.
 *
 * It stops at data on purpose. Nothing here produces html, so there is nothing
 * to sanitise and no `dangerouslySetInnerHTML` anywhere downstream: a `<script>`
 * the studio pastes into the editor arrives as a string, and a string rendered
 * as a React child is characters on the page. That is the whole reason this is
 * written by hand rather than pulled in as a dependency along with its own
 * sanitiser to configure.
 *
 * What it understands: paragraphs, headings from the second level down, bulleted
 * and numbered lists, bold, italic, and links. What it does not understand it
 * leaves as text.
 */

export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };

export type MarkdownBlock =
  | { kind: 'paragraph'; content: MarkdownInline[] }
  | { kind: 'heading'; level: 2 | 3; content: MarkdownInline[] }
  | { kind: 'list'; ordered: boolean; items: MarkdownInline[][] };

/**
 * Addresses a link may point at: the site itself, another site over http(s),
 * a mailbox, a phone. Anything else keeps its text and loses its address -
 * `javascript:` is a valid url as far as a browser is concerned, and this is
 * the one place where text somebody typed becomes an `href`.
 */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/)[^\s]*$/i;

const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.+)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];

  for (const chunk of source.split(/\n\s*\n/)) {
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    if (lines.length === 0) {
      continue;
    }

    blocks.push(...blocksOf(lines));
  }

  return blocks;
}

/**
 * One chunk between blank lines can still hold more than one block: a list
 * written straight under its heading is the ordinary way to type it, and
 * demanding a blank line there would be a rule about markdown rather than
 * about writing.
 */
function blocksOf(lines: string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  function flush(): void {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
      list = null;
    }
  }

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      // A single hash is read as a second-level heading like the rest: the
      // page's `h1` is its title, which is edited in its own field, and a
      // second one on the same page would be a heading with no document.
      const level = heading[1]!.length >= 3 ? 3 : 2;
      blocks.push({ kind: 'heading', level, content: parseInline(heading[2] ?? '') });
      continue;
    }

    const item = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (item) {
      const ordered = BULLET.exec(line) === null;
      if (paragraph.length > 0) {
        flush();
      }
      if (list && list.ordered !== ordered) {
        flush();
      }
      list ??= { ordered, items: [] };
      list.items.push(item[1] ?? '');
      continue;
    }

    if (list) {
      flush();
    }
    paragraph.push(line);
  }

  flush();
  return blocks;
}

/**
 * `**bold**`, `*italic*` and `[text](href)`, in one pass.
 *
 * One regular expression with three alternatives rather than three passes:
 * finding the bold first and the links afterwards would mean searching text
 * that has already been decided, which is how a link's address ends up being
 * read for markup it never contained.
 */
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]*)\)/g;

function parseInline(source: string): MarkdownInline[] {
  const content: MarkdownInline[] = [];
  let plainFrom = 0;

  for (const match of source.matchAll(INLINE)) {
    const [whole, strong, em, linkText, href] = match;

    const piece = pieceOf({ strong, em, linkText, href });
    if (!piece) {
      continue;
    }

    pushText(content, source.slice(plainFrom, match.index));
    content.push(piece);
    plainFrom = match.index + whole.length;
  }

  pushText(content, source.slice(plainFrom));
  return content;
}

function pieceOf({
  strong,
  em,
  linkText,
  href,
}: {
  strong: string | undefined;
  em: string | undefined;
  linkText: string | undefined;
  href: string | undefined;
}): MarkdownInline | null {
  if (strong !== undefined) {
    return { kind: 'strong', text: strong };
  }
  if (em !== undefined) {
    return { kind: 'em', text: em };
  }
  if (linkText === undefined) {
    return null;
  }

  // The text of a link the browser must not follow is still the studio's
  // words, so it stays; only the address is dropped.
  return SAFE_HREF.test(href ?? '')
    ? { kind: 'link', text: linkText, href: href ?? '' }
    : { kind: 'text', text: linkText };
}

function pushText(content: MarkdownInline[], text: string): void {
  if (text === '') {
    return;
  }

  const last = content.at(-1);
  // Two runs of plain text next to each other are one run - it happens
  // whenever something between them was refused, such as an unsafe link.
  if (last?.kind === 'text') {
    last.text += text;
    return;
  }

  content.push({ kind: 'text', text });
}
