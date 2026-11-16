// A tiny ZIP writer: "store" method (no compression), correct CRC-32, UTF-8 names.
// Enough for a handful of already-compressed files such as PNGs.

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Builds the archive bytes. */
export function makeZipBytes(files: ZipFile[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  if (files.length > 0xffff) throw new Error('Too many files for a simple ZIP');
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const entries = files.map((f) => ({ name: enc.encode(f.name), data: f.data, crc: crc32(f.data), offset: 0 }));

  let size = 22;
  for (const e of entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let p = 0;

  for (const e of entries) {
    e.offset = p;
    view.setUint32(p, 0x04034b50, true); // local file header
    view.setUint16(p + 4, 20, true); // version needed
    view.setUint16(p + 6, 0x0800, true); // flags: UTF-8 names
    view.setUint16(p + 8, 0, true); // method: store
    view.setUint16(p + 10, time, true);
    view.setUint16(p + 12, date, true);
    view.setUint32(p + 14, e.crc, true);
    view.setUint32(p + 18, e.data.length, true);
    view.setUint32(p + 22, e.data.length, true);
    view.setUint16(p + 26, e.name.length, true);
    view.setUint16(p + 28, 0, true);
    out.set(e.name, p + 30);
    out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.data.length;
  }

  const cdStart = p;
  for (const e of entries) {
    view.setUint32(p, 0x02014b50, true); // central directory header
    view.setUint16(p + 4, 20, true); // version made by
    view.setUint16(p + 6, 20, true); // version needed
    view.setUint16(p + 8, 0x0800, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, time, true);
    view.setUint16(p + 14, date, true);
    view.setUint32(p + 16, e.crc, true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, e.name.length, true);
    // extra length, comment length, disk number, internal attrs, external attrs stay 0
    view.setUint32(p + 42, e.offset, true);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  }

  view.setUint32(p, 0x06054b50, true); // end of central directory
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - cdStart, true);
  view.setUint32(p + 16, cdStart, true);
  return out;
}

export function makeZip(files: ZipFile[]): Blob {
  return new Blob([makeZipBytes(files)], { type: 'application/zip' });
}
