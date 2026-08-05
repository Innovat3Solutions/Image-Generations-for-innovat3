#!/usr/bin/env python3
"""Stitch the site parts together and inline fonts, photos, and icon paths."""
import base64, json, re, sys, os

SP = os.path.dirname(os.path.abspath(__file__))

def b64(path, mime):
    with open(path, 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()

parts = ''
for p in ['part1-style.html', 'part2-top.html', 'part3-bottom.html', 'part4-js.html']:
    parts += open(os.path.join(SP, p)).read() + '\n'

icons = json.load(open(os.path.join(SP, 'icons.json')))
missing = []

def icon_sub(m):
    key = m.group(1)
    if key not in icons:
        missing.append('ICON:' + key)
        return ''
    return icons[key]

parts = re.sub(r'\{\{ICON:([a-z0-9-]+)\}\}', icon_sub, parts)

def font_sub(m):
    path = os.path.join(SP, 'fonts', m.group(1) + '.woff2')
    if not os.path.exists(path):
        missing.append('FONT:' + m.group(1))
        return ''
    return b64(path, 'font/woff2')

parts = re.sub(r'\{\{FONT:([A-Za-z0-9-]+)\}\}', font_sub, parts)

# Images referenced in markup
def img_sub(m):
    path = os.path.join(SP, 'imgs', m.group(1) + '.jpg')
    if not os.path.exists(path):
        missing.append('IMG:' + m.group(1))
        return ''
    return b64(path, 'image/jpeg')

parts = re.sub(r'\{\{IMG:([a-z0-9-]+)\}\}', img_sub, parts)

# Small thumbnails for the cart drawer: reuse the same data URIs via a JS map.
# Only include products whose catalog entry has img:true (keys match file names).
cart_imgs = {}
for key in ['choc-chunk','cookies-cream','churro','lemon-vanilla','kitchen-sink','biscoff-nutella',
            'cheesecake','smores','reeses','lava','lemon-blueberry','dubai','boston-cream','alfajor',
            'oreo-cake','baby-goliath','goliath','bucket','brazo','keychain','sticker','tote','blanket']:
    path = os.path.join(SP, 'imgs', key + '.jpg')
    if os.path.exists(path):
        cart_imgs[key] = b64(path, 'image/jpeg')
parts = parts.replace('{{IMGMAP}}', json.dumps(cart_imgs))

if missing:
    print('MISSING TOKENS:', missing)
    sys.exit(1)
leftover = re.findall(r'\{\{[A-Z]+:[^}]+\}\}', parts)
if leftover:
    print('LEFTOVER TOKENS:', leftover[:10])
    sys.exit(1)

# Artifact version: bare content (publisher wraps it in doctype/head/body)
open(os.path.join(SP, 'artifact.html'), 'w').write(parts)

# Repo version: complete standalone document (title/style hoisted into head)
title_m = re.search(r'<title>.*?</title>', parts, re.S)
body = parts.replace(title_m.group(0), '', 1)
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="description" content="The Snack Shack Bakery in Deltona, FL. '
        'Jumbo deep dish cookies, cookie sandwiches, cakes and merch. Order ahead for '
        'pickup or visit the self-serve Snack Station, open 7 days from 7 AM until sold out.">\n'
        + title_m.group(0) + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
repo = os.path.join(SP, 'index.html')
open(repo, 'w').write(full)
print('artifact.html', len(parts) // 1024, 'KB |', 'index.html', len(full) // 1024, 'KB')
