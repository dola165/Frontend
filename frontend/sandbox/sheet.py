"""Contact sheet: python3 sandbox/sheet.py out.png img1 img2 ... [--cols=2] [--width=900]"""
import sys
from PIL import Image, ImageDraw, ImageFont
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=') for a in sys.argv[1:] if a.startswith('--'))
cols = int(opts.get('cols', 2)); width = int(opts.get('width', 900)); maxh = int(opts.get('maxh', 1100))
out, files = args[0], args[1:]
tiles = []
try: font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 18)
except Exception: font = ImageFont.load_default()
for f in files:
    im = Image.open(f).convert('RGB')
    scale = width / im.width
    im = im.resize((width, int(im.height * scale)))
    if im.height > maxh: im = im.crop((0, 0, width, maxh))
    tile = Image.new('RGB', (width, im.height + 30), (40, 40, 40))
    tile.paste(im, (0, 30)); ImageDraw.Draw(tile).text((8, 5), f.split('/')[-1], fill=(255, 220, 0), font=font)
    tiles.append(tile)
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
W = cols * width + (cols - 1) * 10
H = sum(max(t.height for t in r) for r in rows) + (len(rows) - 1) * 10
sheet = Image.new('RGB', (W, H), (20, 20, 20)); y = 0
for r in rows:
    x = 0
    for t in r: sheet.paste(t, (x, y)); x += width + 10
    y += max(t.height for t in r) + 10
sheet.save(out); print(out, sheet.size)
