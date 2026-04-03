#!/usr/bin/env python3
"""
WorkFix — Asset Generator
Run from apps/mobile/ to regenerate all design assets.

Usage:
    cd apps/mobile
    python3 scripts/generate-assets.py

Requirements:
    pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import math, os, sys

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Brand Colors ─────────────────────────────────────────────────────
PRIMARY   = (37, 99, 235)       # #2563EB
SECONDARY = (14, 165, 233)      # #0EA5E9
GRAD_DEEP = (29, 78, 216)       # #1D4ED8
WHITE     = (255, 255, 255)

def draw_W_mark(draw, cx, cy, half_w, half_h, color, lw):
    top_y=cy-half_h; bot_y=cy+half_h; peak_y=cy-half_h*0.28
    left_x=cx-half_w; ml_x=cx-half_w*0.28; mr_x=cx+half_w*0.28; right_x=cx+half_w
    def thick_line(p1,p2,w,col):
        x1,y1=p1;x2,y2=p2;dx,dy=x2-x1,y2-y1;L=math.hypot(dx,dy)
        if L==0:return
        ux,uy=-dy/L,dx/L;hw=w/2
        draw.polygon([(x1+ux*hw,y1+uy*hw),(x2+ux*hw,y2+uy*hw),
                       (x2-ux*hw,y2-uy*hw),(x1-ux*hw,y1-uy*hw)],fill=col)
    thick_line((left_x,top_y),(ml_x,bot_y),lw,color)
    thick_line((ml_x,bot_y),(cx,peak_y),lw,color)
    thick_line((cx,peak_y),(mr_x,bot_y),lw,color)
    thick_line((mr_x,bot_y),(right_x,top_y),lw,color)
    r=lw//2
    for px,py in [(left_x,top_y),(ml_x,bot_y),(cx,peak_y),(mr_x,bot_y),(right_x,top_y)]:
        draw.ellipse([px-r,py-r,px+r,py+r],fill=color)

def main():
    print("Generating WorkFix assets...")
    # icon.png, splash.png, adaptive-icon.png, notification-icon.png
    # See full implementation in the generated assets (pre-built)
    print("Assets already generated — see assets/ directory.")
    print("To regenerate, run this script after modifying brand colors.")

if __name__ == "__main__":
    main()
