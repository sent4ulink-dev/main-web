// A hand-rolled, spec-following PNG validator — checks the signature, walks every
// chunk verifying its CRC32, and decompresses the actual pixel data to confirm the
// real dimensions/color type match what IHDR claims (not just trusting the header).
// Ported from the old Express server's Buffer-based version to Web-standard
// Uint8Array/DataView/DecompressionStream, since a Worker has no Node Buffer or
// node:zlib — DecompressionStream('deflate') decodes the zlib format PNG's IDAT
// chunks actually use (RFC 1950: 2-byte header + deflate data + Adler32), the same
// thing Node's zlib.inflateSync() decodes by default.
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function readUint32BE(bytes: Uint8Array, at: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, false);
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function inflate(data: Uint8Array, maxOutputLength: number): Promise<Uint8Array> {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxOutputLength) throw new Error("Decompressed PNG data is too large");
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function validPng(data: Uint8Array): Promise<boolean> {
  try {
    if (!bytesEqual(data.subarray(0, 8), PNG_SIGNATURE)) return false;
    let offset = 8,
      header = false,
      end = false,
      colorType = 0;
    const idat: Uint8Array[] = [];
    while (offset + 12 <= data.length) {
      const size = readUint32BE(data, offset),
        type = String.fromCharCode(...data.subarray(offset + 4, offset + 8)),
        finish = offset + 12 + size;
      if (finish > data.length) return false;
      const body = data.subarray(offset + 8, offset + 8 + size);
      if (crc32(data.subarray(offset + 4, offset + 8 + size)) !== readUint32BE(data, offset + 8 + size))
        return false;
      if (!header) {
        if (
          type !== "IHDR" ||
          size !== 13 ||
          readUint32BE(body, 0) !== 1080 ||
          readUint32BE(body, 4) !== 1920 ||
          body[8] !== 8 ||
          ![2, 6].includes(body[9]) ||
          body[10] !== 0 ||
          body[11] !== 0 ||
          body[12] !== 0
        )
          return false;
        header = true;
        colorType = body[9];
      } else if (type === "IHDR") return false;
      if (type === "IDAT") idat.push(body);
      if (type === "IEND") {
        end = size === 0 && finish === data.length;
        break;
      }
      offset = finish;
    }
    if (!end || !idat.length) return false;
    const compressed = new Uint8Array(idat.reduce((sum, c) => sum + c.length, 0));
    let at = 0;
    for (const c of idat) {
      compressed.set(c, at);
      at += c.length;
    }
    const inflated = await inflate(compressed, 1080 * 1920 * 4 + 1920);
    return inflated.length === (1080 * (colorType === 6 ? 4 : 3) + 1) * 1920;
  } catch {
    return false;
  }
}
