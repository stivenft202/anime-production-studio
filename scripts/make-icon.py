#!/usr/bin/env python3
"""Genera assets/icon.png (512x512) y assets/icon.ico (multi-tamaño).

Diseño (sin degradados, fondo plano):
- Fondo oscuro plano #1a1a2e.
- Letra "A" grande en violeta #7C3AED, centrada.
- Pequeño triángulo de "play" blanco en la esquina inferior derecha,
  dentro de un círculo violeta claro, como guiño a vídeo/animación.
"""
from PIL import Image, ImageDraw, ImageFont
import os

# Directorio de salida: assets/ junto a este script (ruta relativa al
# script, no hardcodeada al proyecto original).
OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets"))
SIZE = 512
BG = (0x1A, 0x1A, 0x2E, 255)      # #1a1a2e
VIOLET = (0x7C, 0x3A, 0xED, 255)  # #7C3AED
VIOLET_LIGHT = (0xA5, 0x78, 0xFF, 255)
WHITE = (255, 255, 255, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

img = Image.new("RGBA", (SIZE, SIZE), BG)
draw = ImageDraw.Draw(img)

# Letra "A" grande, centrada.
font = ImageFont.truetype(FONT_PATH, 340)
bbox = draw.textbbox((0, 0), "A", font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1] - 18),
          "A", font=font, fill=VIOLET)

# Círculo con triángulo de play (abajo a la derecha).
cx, cy, r = 392, 392, 62
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=VIOLET)
tri = [(cx - 20, cy - 30), (cx - 20, cy + 30), (cx + 32, cy)]
draw.polygon(tri, fill=WHITE)

img.save(f"{OUT_DIR}/icon.png", "PNG")

# ICO con varios tamaños (Pillow lo guarda directamente).
img.save(
    f"{OUT_DIR}/icon.ico",
    "ICO",
    sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
)

print("icon.png e icon.ico generados en", OUT_DIR)
