import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads a blank line as the end of a paragraph', () => {
    const blocks = parseMarkdown('Перший абзац.\n\nДругий абзац.');

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'Перший абзац.' }],
    });
  });

  it('joins the lines inside one paragraph', () => {
    const blocks = parseMarkdown('Рядок один\nрядок два');

    // A paragraph typed with the editor's own line breaks is still one
    // paragraph. Where it wraps on the page is the page's business.
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'Рядок один рядок два' }],
    });
  });

  it('ignores whitespace-only lines and a trailing newline', () => {
    expect(parseMarkdown('  \n\nАбзац.\n   \n\n')).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: 'Абзац.' }] },
    ]);
  });

  it('gives nothing for text that is only whitespace', () => {
    expect(parseMarkdown('   \n  \n')).toEqual([]);
  });

  it('reads headings from the second level down', () => {
    const blocks = parseMarkdown('## Наші правила\n\n### Пробне заняття');

    // The page's own `h1` is its title, which the studio edits in a separate
    // field. A heading typed in the body starts below it.
    expect(blocks[0]).toEqual({
      kind: 'heading',
      level: 2,
      content: [{ kind: 'text', text: 'Наші правила' }],
    });
    expect(blocks[1]).toMatchObject({ kind: 'heading', level: 3 });
  });

  it('treats a single hash as the same level, not as a second page title', () => {
    expect(parseMarkdown('# Заголовок')).toMatchObject([{ kind: 'heading', level: 2 }]);
  });

  it('collects the lines of a list into one block', () => {
    const blocks = parseMarkdown('- вокал\n- фортепіано\n- гітара');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        [{ kind: 'text', text: 'вокал' }],
        [{ kind: 'text', text: 'фортепіано' }],
        [{ kind: 'text', text: 'гітара' }],
      ],
    });
  });

  it('tells a numbered list from a bulleted one', () => {
    expect(parseMarkdown('1. перше\n2. друге')).toMatchObject([{ kind: 'list', ordered: true }]);
  });

  it('does not read a price as the start of a list', () => {
    // "2011 рік" begins with a digit and a full stop is a sentence away.
    const blocks = parseMarkdown('2011 рік. Ми відкрились.');

    expect(blocks[0]?.kind).toBe('paragraph');
  });

  it('reads bold, italic and links inside a paragraph', () => {
    const blocks = parseMarkdown('Не пізніше ніж за **24 години**, *будь ласка*.');

    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [
        { kind: 'text', text: 'Не пізніше ніж за ' },
        { kind: 'strong', text: '24 години' },
        { kind: 'text', text: ', ' },
        { kind: 'em', text: 'будь ласка' },
        { kind: 'text', text: '.' },
      ],
    });
  });

  it('keeps a lone asterisk as the character it is', () => {
    expect(parseMarkdown('2 * 2 = 4')).toEqual([
      { kind: 'paragraph', content: [{ kind: 'text', text: '2 * 2 = 4' }] },
    ]);
  });

  it('makes a link out of an address it can follow', () => {
    const blocks = parseMarkdown('Пишіть на [пошту](mailto:studio@example.com) або в [інстаграм](https://instagram.com/palitra).');

    expect(blocks[0]).toMatchObject({
      content: [
        { kind: 'text', text: 'Пишіть на ' },
        { kind: 'link', text: 'пошту', href: 'mailto:studio@example.com' },
        { kind: 'text', text: ' або в ' },
        { kind: 'link', text: 'інстаграм', href: 'https://instagram.com/palitra' },
        { kind: 'text', text: '.' },
      ],
    });
  });

  it('links to a page of the site itself', () => {
    expect(parseMarkdown('[Наші напрями](/directions)')).toMatchObject([
      { content: [{ kind: 'link', text: 'Наші напрями', href: '/directions' }] },
    ]);
  });

  it('refuses to make a link out of an address a browser would run', () => {
    const blocks = parseMarkdown('[тисни сюди](javascript:alert)');

    // The text stays, the address does not. Whoever edits these pages is
    // trusted, but "trusted" is not "immune to pasting something they were
    // sent", and this is the one place where typed text becomes an `href`.
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'тисни сюди' }],
    });
  });

  it('refuses it with brackets in the address too', () => {
    // A payload written with a call in it leaves a stray bracket behind, which
    // is what an address the parser refused to read looks like on the page.
    const blocks = parseMarkdown('[тисни сюди](javascript:alert(1))');

    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: 'тисни сюди)' }],
    });
  });

  it('leaves markup alone inside a heading and a list item', () => {
    expect(parseMarkdown('## **Важливо**')).toMatchObject([
      { kind: 'heading', content: [{ kind: 'strong', text: 'Важливо' }] },
    ]);
    expect(parseMarkdown('- [напрями](/directions)')).toMatchObject([
      { items: [[{ kind: 'link', href: '/directions' }]] },
    ]);
  });

  it('carries html through as text rather than as markup', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');

    // Nothing here produces html, so there is nothing to sanitise: the tag is
    // a string, and a string rendered as a React child is characters on the
    // page. This is the whole reason the renderer is written by hand.
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      content: [{ kind: 'text', text: '<script>alert(1)</script>' }],
    });
  });
});
