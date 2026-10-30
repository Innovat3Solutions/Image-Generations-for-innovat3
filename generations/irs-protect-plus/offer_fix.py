"""First-month-free pass on the Pro/Story ads: one message, one offer, one CTA.

1. fal nano-banana-pro/edit removes every text element except the headline (KEEP below), plus logos and disclaimer.
   Only the pixels that changed are taken from the edit.
2. Composited on top: gold "PRIMER MES GRATIS" bar where the removed lines were, one CTA button,
   the real logo lockup (refs/) and a disclosure that carries the offer terms.

Usage: FAL_KEY=... python3 offer_fix.py [id ...]     (ids like pro01 story14)
"""
import glob, json, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import logo_fix as lf

DIR = lf.DIR
FB = os.path.join(lf.REFS, 'fonts', 'manrope-800.ttf')
FR = os.path.join(lf.REFS, 'fonts', 'manrope-500.ttf')
NAVY, GOLD = (16, 25, 63), (201, 162, 39)
OFFER = 'PRIMER MES GRATIS'
CTA = 'Activa tu mes de cobertura gratis'
DISCLOSURE = ('Primer mes gratis para nuevos miembros; luego $19.99 al mes hasta cancelar. Cancela cuando quieras. '
              'IRS Protect Plus es un programa de membresía de Best Vision Accounting, LLC y no es un seguro. '
              'Cubre avisos elegibles del IRS fechados después de la inscripción. Aplican requisitos, limitaciones y exclusiones.')

# Text that stays on each ad (the headline and, where the headline needs it, its short payoff line).
KEEP = {
    'pro01': ['¿Un aviso o una auditoría del IRS?', 'No tienes que cargarlo solo.'],
    'pro02': ['¿Llegó una carta del IRS?', 'Respira. Envíanosla.'],
    'pro03': ['Que llueven los avisos.', 'Tú estás cubierto.'],
    'pro04': ['No esperes la carta del IRS.', 'Protégete antes de que llegue.'],
    'pro05': ['Tú disfruta a tu familia.', 'Nosotros hablamos con el IRS.'],
    'pro06': ['Personas reales que responden por ti ante el IRS.'],
    'pro07': ['Caso cerrado. (white text in the navy box)', 'Así se siente estar respaldado.'],
    'pro08': ['Menos que dos cafés al mes.'],
    'pro09': ['¿CP2000? ¿Auditoría? ¿Cobro?', 'Tú no tienes que descifrarlo. Nosotros sí.', '(remove the small grey two-line paragraph "Envíanos el aviso y nuestro equipo determina qué pide el IRS y qué sigue.")'],
    'pro10': ['El IRS es complicado.', 'Tu protección no debería serlo.', '(also keep the large IRS Protect Plus shield logo at the top and the team photo)'],
    'pro11': ['Detrás de cada membresía hay un equipo que da la cara por ti.'],
    'story01': ['Llevas tres días sin abrir esa carta.', 'Ábrela. Nosotros nos encargamos.'],
    'story02': ['¿Otra noche en vela?', 'Que la próxima carta del IRS no te quite el sueño.'],
    'story03': ['Abriste el sobre y se te fue el aire.', 'Respira. De aquí en adelante vamos nosotros.'],
    'story04': ['¿A quién llamas cuando te escribe el IRS?', 'Ahora ya lo sabes.'],
    'story05': ['No tienes que entenderla.', 'Solo tienes que enviárnosla.'],
    'story06': ['El IRS te escribió a ti.', 'Pero le respondemos nosotros.'],
    'story07': ['Esto es lo que cuesta no volver a enfrentarlo solo.'],
    'story08': ['La carta llegó.', 'Y no pasó nada.', 'Porque esta vez no estabas solo.'],
    'story09': ['La carta llega en inglés.', 'Tu tranquilidad, en tu idioma.'],
    'story10': ['Llevas una eternidad en espera con el IRS.', 'Cuelga. Esa llamada la hacemos nosotros.'],
    'story11': ['Guardarla en un cajón no la hace desaparecer.', 'Responderla bien, sí. Y eso lo hacemos nosotros.'],
    'story12': ['Todavía no se lo cuentas a nadie.', 'Cuéntanoslo a nosotros.'],
    'story13': ['¿Y esto cuánto me va a costar?'],
    'story14': ['MULTAS / INTERESES / PLAZOS (the three navy pills)', '¿Cuándo te volviste experto en impuestos?', 'No tienes que serlo. Para eso está tu equipo.'],
    'story15': ['Entre diez sobres, siempre reconoces ese.', 'La próxima vez, que lo reciba tu equipo.'],
    'story16': ['La carta dice 30 días. El reloj ya corre.', 'Nosotros respondemos a tiempo, por ti.'],
    'story17': ['La carta llegó el viernes.', 'No dejes que te robe el fin de semana.'],
    'story18': ['Que la próxima carta del IRS la reciba tu equipo.'],
}
LEFT = {'pro01', 'pro06', 'pro07', 'pro08', 'pro11', 'story02', 'story06', 'story08', 'story18'}   # left-aligned headlines; the rest are centered
TEAM = {'pro06', 'pro10', 'story06', 'story18'}         # team photo fills the bottom: CTA goes next to the offer bar
SLOT_Y = {'pro09': 0.285, 'pro06': 0.255, 'pro08': 0.25, 'story08': 0.258}   # manual offer position where auto-detection picks the headline
LOCKUP_TOP = {'pro06': 'right', 'story18': 'right', 'story06': 'center'}

PROMPT = ('Edit this advertisement. Remove ALL text in the image EXCEPT the following, which must stay exactly as it is now '
          '(same words, position, size, font and color): {keep}. Remove every other line of text (subheadlines, small grey or blue '
          'lines, price lines, paragraphs, buttons and pills with text), and remove all logos (the Best Vision Accounting logo, '
          'IRS Protect Plus logos, divider lines, white logo plates) and the small disclaimer text at the bottom{extra}. Fill every '
          'removed area seamlessly with the natural continuation of the background. Do not change anything else: people, '
          'objects, scene and colors stay exactly the same.')


def pill(text, font, size, fg, bg, pad=(48, 26), arrow=False):
    f = ImageFont.truetype(font, size)
    x0, y0, x1, y1 = f.getbbox(text)
    tw, th = x1 - x0, y1 - y0
    aw = int(size * 1.15) + 22 if arrow else 0
    w, h = tw + pad[0] * 2 + aw, th + pad[1] * 2
    im = Image.new('RGBA', (w + 24, h + 30), (0, 0, 0, 0))
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((12, 20, 12 + w, 20 + h), radius=h // 2, fill=(0, 0, 0, 70))
    im = Image.alpha_composite(im, Image.fromarray(cv2.GaussianBlur(np.asarray(sh), (0, 0), 8)))
    d = ImageDraw.Draw(im)
    if isinstance(bg, tuple) and len(bg) == 2:   # vertical gold gradient
        g = Image.new('RGBA', (w, h)); gd = ImageDraw.Draw(g)
        for yy in range(h):
            t = yy / h; c = tuple(int(bg[0][i] * (1 - t) + bg[1][i] * t) for i in range(3)) + (255,)
            gd.line((0, yy, w, yy), fill=c)
        m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=255)
        im.paste(g, (12, 6), m)
    else:
        d.rounded_rectangle((12, 6, 12 + w, 6 + h), radius=h // 2, fill=bg)
    d.text((12 + pad[0] - x0, 6 + pad[1] - y0), text, font=f, fill=fg)
    if arrow:
        r = int(size * 0.58); cx = 12 + pad[0] + tw + 22 + r; cy = 6 + h // 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD if fg == (255, 255, 255) else NAVY)
        ac = NAVY if fg == (255, 255, 255) else (255, 255, 255)
        d.line((cx - r * .45, cy, cx + r * .4, cy), fill=ac, width=max(4, size // 10))
        d.polygon([(cx + r * .5, cy), (cx + r * .05, cy - r * .38), (cx + r * .05, cy + r * .38)], fill=ac)
    return im


SUBLINE = 'de tu membresía de representación ante el IRS'


def offer_bar(arrow=False):
    """Two-line gold button: PRIMER MES GRATIS + supporting line. Soft glow centered behind it (no offset slab)."""
    fm, fs_ = ImageFont.truetype(FB, 96), ImageFont.truetype(os.path.join(lf.REFS, 'fonts', 'manrope-700.ttf'), 42)
    mb, sb = fm.getbbox(OFFER), fs_.getbbox(SUBLINE)
    aw = 120 if arrow else 0
    w = max(mb[2] - mb[0], sb[2] - sb[0]) + 130 + aw
    h = (mb[3] - mb[1]) + (sb[3] - sb[1]) + 30 + 64
    m = 60                                   # room for the glow
    im = Image.new('RGBA', (w + 2 * m, h + 2 * m), (0, 0, 0, 0))
    glow = Image.new('L', im.size, 0)
    ImageDraw.Draw(glow).rounded_rectangle((m, m, m + w, m + h), radius=h // 2, fill=120)
    glow = Image.fromarray(cv2.GaussianBlur(np.asarray(glow), (0, 0), 22))
    im.paste(Image.new('RGBA', im.size, (12, 18, 44, 255)), (0, 0), glow)
    g = Image.new('RGBA', (w, h)); gd = ImageDraw.Draw(g)
    for yy in range(h):
        t = yy / h; c = tuple(int(a * (1 - t) + b * t) for a, b in zip((243, 218, 125), (201, 162, 39))) + (255,)
        gd.line((0, yy, w, yy), fill=c)
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=255)
    im.paste(g, (m, m), mask)
    d = ImageDraw.Draw(im)
    tw = w - aw
    y1 = m + 32
    d.text((m + (tw - (mb[2] - mb[0])) // 2 - mb[0], y1 - mb[1]), OFFER, font=fm, fill=NAVY)
    y2 = y1 + (mb[3] - mb[1]) + 30
    d.text((m + (tw - (sb[2] - sb[0])) // 2 - sb[0], y2 - sb[1]), SUBLINE, font=fs_, fill=NAVY)
    if arrow:
        r = 46; cx = m + w - aw // 2 - 20; cy = m + h // 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=NAVY)
        d.line((cx - r * .45, cy, cx + r * .4, cy), fill=(255, 255, 255), width=8)
        d.polygon([(cx + r * .5, cy), (cx + r * .05, cy - r * .38), (cx + r * .05, cy + r * .38)], fill=(255, 255, 255))
    im.offset = m
    return im


def cta_btn(dark):
    return pill(CTA, FB, 46, NAVY if dark else (255, 255, 255), (255, 255, 255) if dark else NAVY, pad=(44, 26), arrow=True)


def disclosure(W, dark):
    f = ImageFont.truetype(FR, 24); words = DISCLOSURE.split(); lines, cur = [], ''
    for w_ in words:
        t = (cur + ' ' + w_).strip()
        if f.getlength(t) > W - 180 and cur:
            lines.append(cur); cur = w_
        else:
            cur = t
    lines.append(cur)
    lh = 34; T = Image.new('RGBA', (W - 160, lh * len(lines) + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(T)
    for i, l in enumerate(lines):
        d.text((0, 2 + i * lh), l, font=f, fill=(255, 255, 255, 205) if dark else (60, 66, 84, 235))
    return T


def latest(id_):
    fs = glob.glob(os.path.join(DIR, f'irs-protect-plus_{id_}_*.png'))
    def ver(f):
        m = re.search(r'_v(\d+)_\d+\.png$', f); return int(m.group(1)) if m else 1
    return max(fs, key=ver)


def fix(id_):
    src = latest(id_); orig = Image.open(src).convert('RGB'); W, H = orig.size
    keep = '; '.join(f'"{k}"' for k in KEEP[id_])
    extra = ' and the logo lockup at the top' if id_ in LOCKUP_TOP else ''
    cached = os.path.join(DIR, '.clean', f'{id_}.png')
    edited = Image.open(cached).convert('RGB') if os.path.exists(cached) else lf.fal_edit(orig, PROMPT.format(keep=keep, extra=extra))
    mask, boxes = lf.changed_boxes(orig, edited, [(0, 1)])
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 8)[..., None]
    clean = Image.fromarray((np.asarray(orig, np.float32) * (1 - soft) + np.asarray(edited, np.float32) * soft).clip(0, 255).astype(np.uint8))
    os.makedirs(os.path.join(DIR, '.clean'), exist_ok=True)
    clean.save(os.path.join(DIR, '.clean', f'{id_}.png'))
    out = clean.convert('RGBA')

    # offer bar: where the first removed line under the headline was
    upper = [b for b in boxes if b[1] < H * .62 and b[1] > H * .05 and b[2] > W * .12]
    if id_ in LOCKUP_TOP:
        upper = [b for b in upper if b[1] > H * .12]
    slot = min(upper, key=lambda b: b[1]) if upper else (90, int(H * .3), W - 180, 120)
    if id_ in SLOT_Y:
        slot = (90, int(H * SLOT_Y[id_]), W - 180, 120)
    sx, sy, sw, sh = slot
    centered = id_ not in LEFT
    bar = offer_bar()
    dark_top = lf.is_dark(clean, (max(0, sx), sy, max(1, sw), max(1, min(sh, 200))))
    if id_ in TEAM:   # no clear spot for a second button over the team photo: the offer bar itself is the CTA
        bar = offer_bar(arrow=True)
        out.alpha_composite(bar, ((W - bar.width) // 2 if centered else 80 - bar.offset, sy + 10 - bar.offset))
    else:
        out.alpha_composite(bar, ((W - bar.width) // 2 if centered else 80 - bar.offset, sy + 10 - bar.offset))

    # footer: disclosure + (lockup left, CTA right) or top lockup for team layouts
    fy = int(H * .82)
    dark_f = lf.is_dark(clean, (0, fy, W, H - fy))
    T = disclosure(W, dark_f); ty = H - 40 - T.height
    # soft backing band so the fine print stays legible on busy photos (and hides any eraser residue)
    band_top = ty - 70
    reg = np.asarray(clean.crop((0, band_top, W, H)), np.float32)
    col = tuple(int(v) for v in np.median(reg.reshape(-1, 3), 0))
    col = (12, 18, 44) if dark_f else tuple(min(255, int(c * .25 + 255 * .75)) for c in col)
    band = Image.new('RGBA', (W, H - band_top), col + (0,)); a = np.zeros((H - band_top, W), np.uint8)
    for yy in range(H - band_top):
        a[yy] = int(235 * min(1, yy / 60))
    band.putalpha(Image.fromarray(a)); out.alpha_composite(band, (0, band_top))
    out.alpha_composite(T, (80, ty))
    if id_ in LOCKUP_TOP:
        L = lf.lockup(lf.is_dark(clean, (0, 0, W, int(H * .14))), 0.9 if LOCKUP_TOP[id_] == 'right' else 1.2)
        out.alpha_composite(L, (W - 90 - L.width if LOCKUP_TOP[id_] == 'right' else (W - L.width) // 2, 80))
    elif id_ not in TEAM:
        L = lf.lockup(True, 0.85); cta = cta_btn(dark_f)   # always plated: the dark script disappears on mid-tone photos
        row_h = max(L.height, cta.height); ry = ty - 30 - row_h
        out.alpha_composite(L, (80, ry + (row_h - L.height) // 2))
        out.alpha_composite(cta, (W - 70 - cta.width, ry + (row_h - cta.height) // 2))

    m = re.search(r'irs-protect-plus_(.+?)(?:_v(\d+))?_(\d+)\.png$', os.path.basename(src))
    base, ver = m.group(1), int(m.group(2) or 1)
    ts = int(time.time()); name = f'irs-protect-plus_{base}_v{ver + 1}_{ts}'
    out.convert('RGB').save(os.path.join(DIR, name + '.png'))
    json.dump({'model': 'fal-ai/nano-banana-pro/edit (text removal) + manual composite', 'provider': 'fal',
               'concept': 'Oferta: primer mes gratis. Solo titular + oferta + un CTA + divulgación',
               'source': os.path.basename(src), 'kept_text': KEEP[id_], 'offer': OFFER, 'offer_subline': SUBLINE, 'cta': CTA, 'disclosure': DISCLOSURE,
               'logos': ['refs/best-vision-accounting-logo.png', 'refs/irs-protect-plus-plan-logo.png'],
               'project': 'irs-protect-plus', 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts))},
              open(os.path.join(DIR, name + '.json'), 'w'), indent=2, ensure_ascii=False)
    return f'{id_}: ok -> {name}.png'


if __name__ == '__main__':
    ids = sys.argv[1:] or list(KEEP)
    def safe(i):
        try:
            return fix(i)
        except Exception as e:
            return f'{i}: error {e}'
    with ThreadPoolExecutor(8) as ex:
        for r in ex.map(safe, ids):
            print(r, flush=True)
