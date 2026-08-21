import type { MarkdownBlock, MarkdownInline } from '@palitra/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Blocks from `parseMarkdown` as elements.
 *
 * The parser stops at data on purpose, and this is the three lines that were
 * promised on the other side of that decision: nothing here builds html, so
 * there is no `dangerouslySetInnerHTML` and nothing to sanitise. A `<script>`
 * the studio pastes into the editor arrives here as a string, and a string
 * rendered as a React child is characters on the page.
 */
export function Prose({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = index;

        if (block.kind === 'heading') {
          return block.level === 2 ? (
            <h2 key={key}>{inline(block.content)}</h2>
          ) : (
            <h3 key={key}>{inline(block.content)}</h3>
          );
        }

        if (block.kind === 'list') {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item)}</li>
          ));

          return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }

        return (
          <p className="prose" key={key}>
            {inline(block.content)}
          </p>
        );
      })}
    </>
  );
}

function inline(content: MarkdownInline[]): ReactNode[] {
  return content.map((piece, index) => {
    if (piece.kind === 'strong') {
      return <strong key={index}>{piece.text}</strong>;
    }

    if (piece.kind === 'em') {
      return <em key={index}>{piece.text}</em>;
    }

    if (piece.kind === 'link') {
      // Inside the site, `Link` - so a page the studio linked to is reached
      // without a full load, like every other link on the site. Outside it, a
      // plain anchor: the address is already checked by the parser, which is
      // the only place typed text becomes an `href`.
      return piece.href.startsWith('/') ? (
        <Link href={piece.href} key={index}>
          {piece.text}
        </Link>
      ) : (
        <a href={piece.href} key={index} rel="noreferrer">
          {piece.text}
        </a>
      );
    }

    return piece.text;
  });
}
