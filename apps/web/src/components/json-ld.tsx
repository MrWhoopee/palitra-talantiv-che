/**
 * Structured data, rendered on the server into the page it describes.
 *
 * `dangerouslySetInnerHTML` is the only way to put JSON inside a `<script>`
 * without React escaping it into something no crawler can parse. The content
 * is ours - built from our own objects, never from a request - and `<` is
 * escaped anyway, which is what closes the one hole that matters here.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll('<', '\\u003c') }}
    />
  );
}
