"""Replace AI-drawn logos with the real brand files on the Pro/Story ads.

1. fal nano-banana-pro/edit erases the footer logo lockup + disclaimer line.
2. Only the region that changed is kept from the edit (everything else stays the original pixels).
3. The real logos from refs/ and a re-typeset disclaimer are composited back in the same spot.

Usage: FAL_KEY=... python3 logo_fix.py [name-substring ...]
"""
import base64, glob, io, json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont

DIR = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(DIR, 'refs')
H_ = {'Authorization': f"Key {os.environ['FAL_KEY']}", 'Content-Type': 'application/json'}
DISCLAIMER = 'IRS Protect Plus es un programa de membresía y no es un seguro.'

# Current (latest) version of every approved/corrected Pro/Story ad. pro10 has no logo lockup in its footer.
CURRENT = [
    'pro01_carga-irs', 'pro02_carta-llego', 'pro03_paraguas', 'pro04_buzon', 'pro05_familia', 'pro06_equipo-real',
    'pro07_resuelto_v2', 'pro08_dos-cafes_v2', 'pro09_cp2000-noche', 'pro11_equipo-split_v2',
    'story01_sin-abrir', 'story02_3am_v3', 'story03_se-te-fue-el-aire', 'story04_a-quien-llamas', 'story05_enviarnosla_v2',
    'story06_le-respondemos_v3', 'story07_veinte-dolares', 'story08_no-paso-nada_v3', 'story09_en-ingles',
    'story10_en-espera_v2', 'story11_cajon_v2', 'story12_no-lo-cuentas_v4', 'story13_cuanto-cuesta', 'story14_experto_v2',
    'story15_ese-sobre', 'story16_30-dias', 'story17_fin-de-semana', 'story18_equipo-cierre_v2',
]
TOP_LOCKUP = {'story06_le-respondemos_v3'}   # lockup sits at the top; footer has only the disclaimer
TOP_RIGHT = {'pro06_equipo-real', 'story18_equipo-cierre_v2'}   # team photos: real lockup top-right, footer keeps only the disclaimer

ERASE = ('Remove only the brand logos (the "Best Vision Accounting" logo and the "IRS Protect Plus" shield logo, and any divider line '
         'between them) and the small one-line disclaimer text {where}. Fill that area seamlessly with the natural continuation '
         'of the background behind them. Do not change anything else: every other element, all other text, people, objects, '
         'colors and the composition must stay exactly the same.')

BV = Image.open(os.path.join(REFS, 'best-vision-accounting-logo.png')).convert('RGBA')
BV = BV.crop(BV.getbbox())
IRS = Image.open(os.path.join(REFS, 'irs-protect-plus-plan-logo.png')).convert('RGBA')
IRS = IRS.crop(IRS.getbbox())
FONT = os.path.join(REFS, 'fonts', 'manrope-500.ttf')


def fal_edit(img, prompt):
    buf = io.BytesIO(); img.convert('RGB').save(buf, 'JPEG', quality=95)
    uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    r = requests.post('https://queue.fal.run/fal-ai/nano-banana-pro/edit', headers=H_, timeout=120, json={
        'prompt': prompt, 'image_urls': [uri], 'num_images': 1, 'aspect_ratio': '4:5', 'resolution': '2K', 'output_format': 'png'})
    r.raise_for_status(); j = r.json()
    for _ in range(200):
        if requests.get(j['status_url'], headers=H_, timeout=60).json().get('status') == 'COMPLETED':
            break
        time.sleep(4)
    res = requests.get(j['response_url'], headers=H_, timeout=60).json()
    out = Image.open(io.BytesIO(requests.get(res['images'][0]['url'], timeout=120).content)).convert('RGB')
    return out.resize(img.size, Image.LANCZOS) if out.size != img.size else out


def changed_boxes(orig, edited, bands):
    """Bounding boxes of what the eraser changed, limited to the given vertical bands (fractions of height)."""
    a = cv2.GaussianBlur(np.asarray(orig, np.float32), (0, 0), 2)
    b = cv2.GaussianBlur(np.asarray(edited, np.float32), (0, 0), 2)
    d = (np.abs(a - b).mean(2) > 14).astype(np.uint8)
    H, W = d.shape
    allow = np.zeros_like(d)
    for t, btm in bands:
        allow[int(H * t):int(H * btm)] = 1
    d *= allow
    d = cv2.morphologyEx(d, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    d = cv2.dilate(d, np.ones((41, 41), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(d)
    boxes = [tuple(stats[i, :4]) for i in range(1, n) if stats[i, 4] > 4000]
    return d, boxes


def lockup(dark_bg, scale=1.0):
    """Real-logo lockup: Best Vision (left) | divider | IRS Protect Plus (right)."""
    hb, hi, gap = int(150 * scale), int(186 * scale), int(38 * scale)
    bv = BV.resize((int(BV.width * hb / BV.height), hb), Image.LANCZOS)
    irs = IRS.resize((int(IRS.width * hi / IRS.height), hi), Image.LANCZOS)
    w = bv.width + gap * 2 + 3 + irs.width; h = max(hb, hi)
    pad = 26 if dark_bg else 0
    L = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    if dark_bg:   # the Best Vision script is dark ink: give it a white plate on dark scenes so it stays legible
        plate = Image.new('RGBA', L.size, (0, 0, 0, 0))
        ImageDraw.Draw(plate).rounded_rectangle((0, 0, L.width - 1, L.height - 1), radius=28, fill=(255, 255, 255, 240))
        L = Image.alpha_composite(L, plate)
    L.alpha_composite(bv, (pad, pad + (h - hb) // 2))
    ImageDraw.Draw(L).rectangle((pad + bv.width + gap, pad + 22, pad + bv.width + gap + 2, pad + h - 22), fill=(16, 25, 63, 110))
    L.alpha_composite(irs, (pad + bv.width + gap * 2 + 3, pad + (h - hi) // 2))
    return L


def text_img(dark_bg):
    f = ImageFont.truetype(FONT, 30)
    x0, y0, x1, y1 = f.getbbox(DISCLAIMER)
    T = Image.new('RGBA', (x1 + 4, y1 + 8), (0, 0, 0, 0))
    ImageDraw.Draw(T).text((2 - x0, 2), DISCLAIMER, font=f, fill=(255, 255, 255, 200) if dark_bg else (60, 66, 84, 235))
    return T


def is_dark(img, box):
    x, y, w, h = box
    return np.asarray(img.convert('L').crop((x, y, x + w, y + h)), np.float32).mean() < 115


def fix(key):
    src = sorted(glob.glob(os.path.join(DIR, f'irs-protect-plus_{key}_1*.png')))[-1]
    orig = Image.open(src).convert('RGB'); W, H = orig.size
    top = key in TOP_LOCKUP
    tr = key in TOP_RIGHT
    where = 'in the lower part of the image'
    prompt = ERASE.format(where=where) if not top else ('Remove only the logo lockup centered at the top of the image (the IRS Protect Plus shield, '
              'the divider line and the Best Vision Accounting logo). Fill that area with the plain light background. Do not change anything else.')
    if tr:
        prompt = ('Remove the logo lockup in the top-right corner (IRS Protect Plus shield and Best Vision Accounting logo), and the '
                  'brand logos and the small one-line disclaimer text at the bottom of the image. Fill those areas seamlessly with the '
                  'natural continuation of the plain background. Do not change anything else: the people, all other text and colors stay exactly the same.')
    edited = fal_edit(orig, prompt)
    bands = [(0, .2)] if top else [(0, .22), (.66, 1)] if tr else [(.66, 1)]
    mask, boxes = changed_boxes(orig, edited, bands)
    if not boxes:
        return f'{key}: eraser changed nothing, skipped'
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 8)[..., None]
    clean = Image.fromarray((np.asarray(orig, np.float32) * (1 - soft) + np.asarray(edited, np.float32) * soft).clip(0, 255).astype(np.uint8))
    out = clean.convert('RGBA')
    foot = max(boxes, key=lambda b: b[1] + b[3])          # lowest changed region = footer
    fx, fy, fw, fh = foot
    cx = fx + fw / 2
    align = 'left' if cx < W * .38 else 'right' if cx > W * .62 else 'center'
    margin = 90
    if tr:
        tb = min(boxes, key=lambda b: b[1])
        L = lockup(is_dark(clean, tb), 0.85); out.alpha_composite(L, (W - 90 - L.width, max(80, tb[1] + 20)))
        T = text_img(is_dark(clean, foot)); out.alpha_composite(T, ((W - T.width) // 2, H - 64 - T.height))
        dark = False
    elif top:
        tb = min(boxes, key=lambda b: b[1])
        dark = is_dark(clean, tb)
        L = lockup(dark, 1.3); out.alpha_composite(L, ((W - L.width) // 2, max(80, tb[1] + 40)))
    else:
        dark = is_dark(clean, foot)
        L = lockup(dark); T = text_img(dark)
        ty = H - 64 - T.height; ly = ty - 26 - L.height
        lx = margin if align == 'left' else W - margin - L.width if align == 'right' else (W - L.width) // 2
        tx = margin if align == 'left' else W - margin - T.width if align == 'right' else (W - T.width) // 2
        out.alpha_composite(L, (lx, ly)); out.alpha_composite(T, (tx, ty))
    m = re.match(r'(.*?)(?:_v(\d+))?$', key)
    base, ver = m.group(1), int(m.group(2) or 1)
    ts = int(time.time())
    name = f'irs-protect-plus_{base}_v{ver + 1}_{ts}'
    out.convert('RGB').save(os.path.join(DIR, name + '.png'))
    json.dump({'model': 'fal-ai/nano-banana-pro/edit (erase) + manual composite', 'provider': 'fal',
               'concept': 'Logos reales: se reemplazan los logos generados por IA por los archivos oficiales de refs/',
               'source': os.path.basename(src), 'erase_prompt': prompt,
               'logos': ['refs/best-vision-accounting-logo.png', 'refs/irs-protect-plus-plan-logo.png'],
               'disclaimer': DISCLAIMER, 'layout': {'align': 'top-right' if tr else 'center-top' if top else align, 'dark_plate': bool(dark)},
               'project': 'irs-protect-plus', 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts))},
              open(os.path.join(DIR, name + '.json'), 'w'), indent=2)
    return f'{key}: ok -> {name}.png ({"top" if top else align}{", plate" if dark else ""})'


if __name__ == '__main__':
    keys = [k for k in CURRENT if not sys.argv[1:] or any(a in k for a in sys.argv[1:])]
    with ThreadPoolExecutor(8) as ex:
        def safe(k):
            try:
                return fix(k)
            except Exception as e:
                return f'{k}: error {e}'
        for r in ex.map(safe, keys):
            print(r, flush=True)
