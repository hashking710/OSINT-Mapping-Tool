// Minimal ZIP writer/reader (stored entries, no compression) so report
// bundles can be produced entirely in the browser without a dependency.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const toBytes = (content) => (typeof content === 'string' ? encoder.encode(content) : content);

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function createZip(files, now = new Date()) {
  const { time, day } = dosDateTime(now);
  const entries = files.map(({ name, content }) => {
    const data = toBytes(content);
    return { name: encoder.encode(name), data, crc: crc32(data) };
  });

  let size = 22;
  for (const e of entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let pos = 0;
  const u16 = (v) => {
    view.setUint16(pos, v, true);
    pos += 2;
  };
  const u32 = (v) => {
    view.setUint32(pos, v, true);
    pos += 4;
  };
  const put = (bytes) => {
    out.set(bytes, pos);
    pos += bytes.length;
  };

  const offsets = [];
  for (const e of entries) {
    offsets.push(pos);
    u32(0x04034b50);
    u16(20);
    u16(0x0800); // UTF-8 file names
    u16(0); // stored
    u16(time);
    u16(day);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0);
    put(e.name);
    put(e.data);
  }

  const centralStart = pos;
  entries.forEach((e, i) => {
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(time);
    u16(day);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(offsets[i]);
    put(e.name);
  });
  const centralSize = pos - centralStart;

  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(centralSize);
  u32(centralStart);
  u16(0);
  return out;
}

// Reads archives produced by createZip (stored entries) and verifies CRCs.
export function readZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Not a ZIP archive.');
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);

  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Corrupt ZIP directory.');
    const method = view.getUint16(pos + 10, true);
    const crc = view.getUint32(pos + 16, true);
    const compressed = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    if (method !== 0) throw new Error(`Unsupported compression for ${name}.`);

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + compressed);
    if (crc32(data) !== crc) throw new Error(`Checksum mismatch for ${name}.`);
    entries.push({ name, data });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
