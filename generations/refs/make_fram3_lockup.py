#!/usr/bin/env python3
"""Render the provisional FRAM3 / by INNOVAT3 lockup deterministically."""
from PIL import Image, ImageDraw, ImageFont

SCRATCH = "/tmp/claude-0/-home-user-Image-Generations-for-innovat3/d923a5a1-42d1-5a89-8837-2df048d9006c/scratchpad"
LIME = (185, 217, 60, 255)

def render(main_color, out_path):
    anton = ImageFont.truetype(f"{SCRATCH}/Anton-Regular.ttf", 400)
    small = ImageFont.truetype(f"{SCRATCH}/ArchivoBlack-Regular.ttf", 54)

    canvas = Image.new("RGBA", (2400, 800), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    # Main word: FRAM in main color, 3 in lime, tight tracking
    x = 0
    top_y = 40
    track = -6
    for ch in "FRAM":
        d.text((x, top_y), ch, font=anton, fill=main_color)
        x += d.textlength(ch, font=anton) + track
    x += 14  # slight breath before the 3
    d.text((x, top_y), "3", font=anton, fill=LIME)
    main_w = x + d.textlength("3", font=anton)

    # Sub line: BY INNOVAT3, letterspaced, centered under the main word
    sub = "BY INNOVAT3"
    spacing = 26
    sub_w = sum(d.textlength(c, font=small) + spacing for c in sub) - spacing
    sx = (main_w - sub_w) / 2
    sy = top_y + 540
    for c in sub:
        d.text((sx, sy), c, font=small, fill=main_color)
        sx += d.textlength(c, font=small) + spacing

    canvas = canvas.crop(canvas.getbbox())
    canvas.save(out_path, "PNG")
    print(out_path, canvas.size)

render((255, 255, 255, 255), "generations/refs/fram3-lockup-white-transparent.png")
render((15, 15, 15, 255), "generations/refs/fram3-lockup-black-transparent.png")

# Preview strip: white version on black, black version on white
w_img = Image.open("generations/refs/fram3-lockup-white-transparent.png")
b_img = Image.open("generations/refs/fram3-lockup-black-transparent.png")
pw = Image.new("RGBA", (2600, 2000), (12, 12, 12, 255))
pw.alpha_composite(w_img, (100, 120))
white_bg = Image.new("RGBA", (2600, 1000), (247, 246, 240, 255))
pw.paste(white_bg, (0, 1000))
pw.alpha_composite(b_img, (100, 1120))
pw.convert("RGB").save("/tmp/claude-0/-home-user-Image-Generations-for-innovat3/d923a5a1-42d1-5a89-8837-2df048d9006c/scratchpad/fram3_lockup_preview.jpg", "JPEG", quality=92)
print("preview saved")
