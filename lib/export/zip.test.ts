import { describe, expect, it } from 'vitest';
import { crc32, makeZip, makeZipBytes } from './zip';

const text = (s: string) => new TextEncoder().encode(s);

describe('crc32', () => {
  it('matches the standard check values', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
    expect(crc32(text('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('makeZip', () => {
  const a = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 255, 0, 128]);
  const b = text('week two ₹');
  const files = [
    { name: 'preppy-week-1.png', data: a },
    { name: 'preppy-week-2.png', data: b },
  ];

  it('writes a valid stored archive', () => {
    const z = makeZipBytes(files);
    const v = new DataView(z.buffer);

    // Local header of the first file.
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0); // store
    expect(v.getUint32(14, true)).toBe(crc32(a));
    expect(v.getUint32(18, true)).toBe(a.length);
    expect(v.getUint32(22, true)).toBe(a.length);

    // End of central directory.
    const eocd = z.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 8, true)).toBe(2);
    expect(v.getUint16(eocd + 10, true)).toBe(2);
    const cdSize = v.getUint32(eocd + 12, true);
    const cdStart = v.getUint32(eocd + 16, true);
    expect(cdStart + cdSize).toBe(eocd);

    // Walk the central directory and round-trip every file.
    let p = cdStart;
    const dec = new TextDecoder();
    files.forEach((f) => {
      expect(v.getUint32(p, true)).toBe(0x02014b50);
      const crc = v.getUint32(p + 16, true);
      const size = v.getUint32(p + 24, true);
      const nameLen = v.getUint16(p + 28, true);
      const offset = v.getUint32(p + 42, true);
      expect(dec.decode(z.subarray(p + 46, p + 46 + nameLen))).toBe(f.name);
      expect(size).toBe(f.data.length);
      expect(crc).toBe(crc32(f.data));

      expect(v.getUint32(offset, true)).toBe(0x04034b50);
      const localNameLen = v.getUint16(offset + 26, true);
      const start = offset + 30 + localNameLen + v.getUint16(offset + 28, true);
      expect(Array.from(z.subarray(start, start + size))).toEqual(Array.from(f.data));
      p += 46 + nameLen;
    });
    expect(p).toBe(eocd);
  });

  it('returns a zip Blob with the same bytes', async () => {
    const blob = makeZip(files);
    expect(blob.type).toBe('application/zip');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBe(makeZipBytes(files).length);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it('handles an empty archive', () => {
    const z = makeZipBytes([]);
    expect(z.length).toBe(22);
    expect(new DataView(z.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
