#!/usr/bin/env python3
"""Generatore icone LaTuaRata.

Disegna in modo vettoriale (Pillow, nessun font/CDN esterno) un'icona con:
- sfondo a gradiente diagonale indaco -> ciano (distinto dal grigio/giallo originale);
- simbolo Euro centrale racchiuso da una doppia freccia circolare,
  che richiama la conversione bidirezionale imponibile <-> rata di LaTuaRata.

Produce: icon-192, icon-512, icon-512-maskable, apple-touch-icon, favicon.
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 4  # supersampling per anti-aliasing

C1 = (79, 70, 229)    # indigo  #4F46E5  (alto-sinistra)
C2 = (6, 182, 212)    # cyan    #06B6D4  (basso-destra)
WHITE = (255, 255, 255, 255)
SOFT = (255, 255, 255, 235)


def gradient_bg(S):
    """Gradiente diagonale calcolato a bassa risoluzione e poi scalato."""
    g = 256
    base = Image.new("RGB", (g, g))
    px = base.load()
    for y in range(g):
        for x in range(g):
            t = (x + y) / (2 * (g - 1))
            px[x, y] = (
                int(C1[0] + (C2[0] - C1[0]) * t),
                int(C1[1] + (C2[1] - C1[1]) * t),
                int(C1[2] + (C2[2] - C1[2]) * t),
            )
    return base.resize((S, S), Image.LANCZOS).convert("RGBA")


def draw_arrow(d, cx, cy, R, w, a0, a1, color):
    """Arco spesso con punta di freccia all'estremo a1 (senso orario)."""
    box = [cx - R, cy - R, cx + R, cy + R]
    d.arc(box, a0, a1, fill=color, width=int(round(w)))
    th = math.radians(a1)
    P = (cx + R * math.cos(th), cy + R * math.sin(th))
    t = (-math.sin(th), math.cos(th))   # tangente (angolo crescente)
    r = (math.cos(th), math.sin(th))    # radiale
    L = w * 1.9
    hw = w * 1.4
    tip = (P[0] + t[0] * L, P[1] + t[1] * L)
    b1 = (P[0] + r[0] * hw, P[1] + r[1] * hw)
    b2 = (P[0] - r[0] * hw, P[1] - r[1] * hw)
    d.polygon([tip, b1, b2], fill=color)


def draw_euro(d, cx, cy, rc, color):
    sw = rc * 0.36
    box = [cx - rc, cy - rc, cx + rc, cy + rc]
    # "C" aperta a destra (gap intorno a 0 gradi)
    d.arc(box, 38, 322, fill=color, width=int(round(sw)))
    barh = sw * 0.9
    for dy in (-rc * 0.30, rc * 0.30):
        y = cy + dy
        x0 = cx - rc * 1.08
        x1 = cx + rc * 0.34
        d.rounded_rectangle([x0, y - barh / 2, x1, y + barh / 2],
                            radius=barh / 2, fill=color)


def draw_foreground(layer, S, content_ratio, with_ring=True):
    d = ImageDraw.Draw(layer)
    cx = cy = S / 2.0
    D = S * content_ratio
    if with_ring:
        R = D * 0.46
        w = D * 0.085
        draw_arrow(d, cx, cy, R, w, 35, 170, SOFT)
        draw_arrow(d, cx, cy, R, w, 215, 350, SOFT)
        rc = D * 0.205
    else:
        rc = D * 0.34
    draw_euro(d, cx, cy, rc, WHITE)


def rounded_alpha(S, radius_ratio):
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    r = int(S * radius_ratio)
    md.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
    return mask


def make(size, rounded=True, content_ratio=0.82, with_ring=True):
    S = size * SS
    img = gradient_bg(S)
    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_foreground(fg, S, content_ratio, with_ring)
    img = Image.alpha_composite(img, fg)
    if rounded:
        img.putalpha(rounded_alpha(S, 0.225))
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    p = os.path.join(OUT, name)
    img.save(p, "PNG")
    print("scritto", name, img.size)


if __name__ == "__main__":
    # Icone "any": angoli arrotondati, contenuto ampio
    save(make(192, rounded=True, content_ratio=0.82), "icon-192.png")
    save(make(512, rounded=True, content_ratio=0.82), "icon-512.png")
    # Maskable: full-bleed quadrato, contenuto entro ~80% centrale
    save(make(512, rounded=False, content_ratio=0.64), "icon-512-maskable.png")
    # Apple touch: full-bleed quadrato (iOS arrotonda da solo)
    save(make(180, rounded=False, content_ratio=0.80), "apple-touch-icon.png")
    # Favicon: versione semplificata (solo Euro, senza anello) per leggibilità
    save(make(48, rounded=True, content_ratio=0.74, with_ring=False), "favicon.png")
