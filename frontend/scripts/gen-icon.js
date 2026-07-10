const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'));

async function main() {
  const png = await sharp(svg).resize(256, 256).png().toBuffer();
  // ICO header: reserved(2) + type(2) + count(2) = 6 bytes
  // Directory entry: w(1) + h(1) + palette(1) + reserved(1) + planes(2) + bpp(2) + size(4) + offset(4) = 16 bytes
  const buf = Buffer.alloc(6 + 16 + png.length);
  buf.writeUInt16LE(0, 0);    // reserved
  buf.writeUInt16LE(1, 2);    // type=1 (ICO)
  buf.writeUInt16LE(1, 4);    // count=1
  buf.writeUInt8(0, 6);       // w=0 (256)
  buf.writeUInt8(0, 7);       // h=0 (256)
  buf.writeUInt8(0, 8);       // palette colors
  buf.writeUInt8(0, 9);       // reserved
  buf.writeUInt16LE(1, 10);   // planes
  buf.writeUInt16LE(32, 12);  // bpp
  buf.writeUInt32LE(png.length, 14); // image size
  buf.writeUInt32LE(22, 18);  // offset
  png.copy(buf, 22);
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'app-icon.ico'), buf);
  console.log('Generated public/app-icon.ico');
}

main().catch(console.error);