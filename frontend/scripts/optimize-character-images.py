"""Builds the pet images the web app serves from the 1024px originals in public/characters.

Run from frontend/: python scripts/optimize-character-images.py
Requires Pillow with WebP support. Re-run after replacing or adding an original.
"""
from pathlib import Path

from PIL import Image

SOURCE = Path('public/characters')
TARGET = Path('src/assets/characters')
SIZES = (192, 640)  # avatars and thumbnails up to 96 CSS px / larger portraits

TARGET.mkdir(parents=True, exist_ok=True)
for original in sorted(SOURCE.glob('*.png')):
    with Image.open(original) as image:
        image = image.convert('RGBA')
        for size in SIZES:
            output = TARGET / f'{original.stem}-{size}.webp'
            image.resize((size, size), Image.LANCZOS).save(output, 'WEBP', quality=82, method=6)
            print(f'{output} {output.stat().st_size // 1024} KB')
