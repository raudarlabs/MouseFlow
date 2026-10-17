/* The three ways in, as glyphs standing on a GlassCell's lid: a composer for the app, a connector with a
 * spark for an AI over MCP, a paper plane for Telegram. Our own line art in the cell's frost and ice-2 -
 * never a third party's logo or colour. 24-unit art, as GlassCell expects; it is aria-hidden with the cell.
 */
import { GlassCellAccent, GlassCellPanel } from '@/components/brand/GlassCell';

/** A goal being typed: a field, two lines of words and the caret after them. */
export const ComposerGlyph = () => (
  <>
    <GlassCellPanel d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.5L7 21.2V18H6a3 3 0 0 1-3-3Z" />
    <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6.5L7 21.2V18H6a3 3 0 0 1-3-3Z" />
    <path d="M7 8.8h9M7 12.6h5" />
    <GlassCellAccent d="M14.6 11v3.3" />
  </>
);

/** A connector's plug, and the spark where it meets your AI. */
export const ConnectorGlyph = () => (
  <>
    <GlassCellPanel d="M6.5 9.5h9v3.2a4.5 4.5 0 0 1-9 0Z" />
    <path d="M6.5 9.5h9v3.2a4.5 4.5 0 0 1-9 0ZM9 9.5V5.6M13 9.5V5.6M11 17.2v4" />
    <GlassCellAccent d="M18.6 3.2v2.2M18.6 8.6v2.2M15.6 7h1.8M19.8 7h1.8" />
  </>
);

/** A paper plane: a message on its way. */
export const PlaneGlyph = () => (
  <>
    <GlassCellPanel d="M3.2 11.4 20.8 4.2l-4.6 15.6-4.9-4.4Z" />
    <path d="M3.2 11.4 20.8 4.2l-4.6 15.6-4.9-4.4Z" />
    <GlassCellAccent d="M20.8 4.2 11.3 15.4v4.2l2.5-2.3" />
  </>
);
