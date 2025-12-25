import struct, random, base64

width, height = 64, 64
row_padding = (4 - (width * 3) % 4) % 4
file_size = 14 + 40 + (width * 3 + row_padding) * height

# Bitmap Header
header = struct.pack('<2sIHHI', b'BM', file_size, 0, 0, 54)
# DIB Header
dib_header = struct.pack('<IiiHHIIIIII', 40, width, height, 1, 24, 0, 0, 0, 0, 0, 0)

pixels = bytearray()
for _ in range(height):
    for _ in range(width):
        v = random.randint(0, 255)
        pixels.extend((v, v, v)) # BGR
    pixels.extend(b'\x00' * row_padding)

bmp_data = header + dib_header + pixels
b64 = base64.b64encode(bmp_data).decode('utf-8')

with open("noise_base64.txt", "w", encoding="utf-8") as f:
    f.write(f"data:image/bmp;base64,{b64}")
