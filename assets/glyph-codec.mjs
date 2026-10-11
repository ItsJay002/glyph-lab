export const GLYPH_START = 0xF0000;
export const GLYPH_COUNT = 8192;
export const MAX_DECODE_TOKENS = 2000;
export const EXAMPLE_MESSAGE = 'effective accelerationism never dies';

/** Parse only the explicitly selected format; never guess or discard nonseparator input. */
export function parseGlyphInput(input, format) {
  if (typeof input !== 'string') throw new TypeError('The encoded message must be text.');
  let ids;
  if (format === 'glyphs') {
    ids = [];
    for (const character of input) {
      if (/\s/u.test(character)) continue;
      const id = character.codePointAt(0) - GLYPH_START;
      if (id < 0 || id >= GLYPH_COUNT) {
        throw new Error('Use Accelerando glyph characters only, with optional whitespace between them. For numbers, select Token IDs.');
      }
      ids.push(id);
      if (ids.length > MAX_DECODE_TOKENS) throw new Error('Decode up to 2,000 tokens at a time.');
    }
  } else if (format === 'ids') {
    let text = input.trim();
    if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1).trim();
    if (!text) return [];
    if (!/^\d+(?:(?:\s*,\s*|\s+)\d+)*$/u.test(text)) {
      throw new Error('Enter decimal token IDs separated by spaces or commas, optionally inside brackets. Each ID must be an integer from 0 to 8191.');
    }
    ids = text.split(/[\s,]+/u).map(Number);
    if (ids.length > MAX_DECODE_TOKENS) throw new Error('Decode up to 2,000 tokens at a time.');
    if (ids.some(id => !Number.isSafeInteger(id) || id < 0 || id >= GLYPH_COUNT)) {
      throw new Error('Each token ID must be an integer from 0 to 8191.');
    }
  } else {
    throw new Error('Select Glyph characters or Token IDs.');
  }
  return ids;
}

/** Recover the original bytes, including a leading UTF-8 BOM and all whitespace. */
export function decodeGlyphInput(input, format, tokenizer) {
  const ids = parseGlyphInput(input, format);
  if (!ids.length) return { ids, text: '' };
  const bytes = [];
  for (const id of ids) {
    const tokenBytes = tokenizer.bytes[id];
    if (!tokenBytes) throw new Error('This token is missing from the loaded dictionary. Reload and try again.');
    for (const byte of tokenBytes) bytes.push(byte);
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Uint8Array.from(bytes));
    return { ids, text };
  } catch {
    throw new Error('These tokens do not form valid UTF-8 text. The message may be incomplete or out of order.');
  }
}
