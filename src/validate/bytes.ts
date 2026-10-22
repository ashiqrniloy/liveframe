/** UTF-8 bytes of QuoteJSONString (ECMA-262), including quotes, without serialising. */
export function stringBytes(value: string, maximum = Infinity): number {
  let bytes = 2;
  for (let i = 0; i < value.length && bytes <= maximum; i++) {
    const unit = value.charCodeAt(i);
    if (unit === 0x22 || unit === 0x5c || unit === 8 || unit === 9 || unit === 10 || unit === 12 || unit === 13)
      bytes += 2;
    else if (unit < 0x20) bytes += 6;
    else if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 6;
    } else bytes += unit >= 0xdc00 && unit <= 0xdfff ? 6 : 3;
  }
  return bytes;
}
