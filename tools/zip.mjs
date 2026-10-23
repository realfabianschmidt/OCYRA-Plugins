// Deterministic regular-file ZIP32, stored entries only. No timestamps from the filesystem.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function zip(files) {
  if (!files.length || files.length > 4096) throw new Error('file count');
  const local = [], central = [];
  let offset = 0, centralBytes = 0;
  for (const { path, bytes } of files) {
    const name = Buffer.from(path, 'utf8'), crc = crc32(bytes);
    if (!name.length || name.length > 256 || bytes.length > 32 * 1024 * 1024) throw new Error('file limit');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); // 1980-01-01
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(0x314, 4); // UNIX, ZIP 2.0
    header.copy(record, 6, 4, 26);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    record.writeUInt32LE(offset, 42);
    local.push(header, name, bytes);
    central.push(record, name);
    offset += header.length + name.length + bytes.length;
    centralBytes += record.length + name.length;
    if (offset + centralBytes + 22 > 64 * 1024 * 1024) throw new Error('archive limit');
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
