"""One-shot: Notion/draw.io/MATLAB SVG exports -> theme-aware inline SVG.

Three jobs:
  1. strip export bloat (draw.io's mxGraph source, its base64 <image> fallbacks
     for non-foreignObject renderers, MathJax's 7 KB global stylesheet)
  2. simplify MATLAB's oversampled polylines (4465 segments per curve, at
     sub-0.01px spacing) with Douglas-Peucker at a sub-pixel tolerance
  3. rewrite every colour to a --fig-* custom property so the figure follows
     the theme toggle instead of baking in a light-mode palette

Provenance for src/assets/polymer-dissolution/*.svg, which are COMMITTED
outputs — nothing in the build runs this. Kept so the figures can be
regenerated if the author re-exports them:

    python3 scripts/theme-svg.py <export dir> src/assets/polymer-dissolution

The file list, the two viewBox crops and the fig-4 legend nudge at the bottom
are specific to that post; a different set of figures needs its own entries.
The output contract is the --fig-* vocabulary in components/mdx/Figure.astro.
"""
import re, sys, os, math

# ---- colour map ------------------------------------------------------------
# canonical lowercase hex -> figure token
INK    = 'var(--fig-ink)'
PAPER  = 'var(--fig-paper)'
FILL   = 'var(--fig-fill)'
LINE   = 'var(--fig-line)'
FLOW   = 'var(--fig-flow)'
LIQUID = 'var(--fig-liquid)'

COLORS = {
    '#000000': INK, '#202020': INK, '#262626': INK, '#36393d': INK,
    '#ffffff': PAPER,
    '#eeeeee': FILL, '#e6e6e6': FILL, '#ededed': FILL,
    '#cccccc': LINE, '#c8c8c8': LINE,
    '#007fff': FLOW, '#319eff': FLOW,
    '#ccffff': LIQUID, '#002525': LIQUID,
    # MATLAB default series order
    '#0072bd': 'var(--chart-5)',
    '#d95319': 'var(--chart-4)',
    '#edb120': 'var(--chart-2)',
    '#7e2f8e': 'var(--chart-3)',
    '#77ac30': 'var(--chart-6)',
    '#4dbeee': 'var(--chart-1)',
    # Fig 4 boundary layers
    '#3333cc': 'var(--fig-flow)',
    '#33cc33': 'var(--fig-conc)',
    # draw.io pastes MathJax labels as styled spans: dark ink on a pale chip
    '#1c1e21': INK, '#f8f9fa': 'transparent', '#ececec': FILL,
    'black': INK, 'white': PAPER,
}

def canon(c):
    c = c.strip().lower()
    m = re.fullmatch(r'rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', c)
    if m:
        return '#%02x%02x%02x' % tuple(int(x) for x in m.groups())
    if re.fullmatch(r'#[0-9a-f]{3}', c):
        return '#' + ''.join(ch * 2 for ch in c[1:])
    return c

# `white` must not match inside `white-space`, hence the hyphen-aware guards.
COLOR_RE = re.compile(
    r'rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)'
    r'|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b'
    r'|(?<![\w-])(?:black|white)(?![\w-])')

def recolor(text):
    def sub(m):
        return COLORS.get(canon(m.group(0)), m.group(0))
    return COLOR_RE.sub(sub, text)

# ---- polyline simplification ----------------------------------------------
def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        best, bi = -1.0, i
        for k in range(i + 1, j):
            px, py = pts[k]
            d = abs(dx * (ay - py) - (ax - px) * dy) / den if den else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, k
        if best > eps:
            keep[bi] = True
            stack.append((i, bi)); stack.append((bi, j))
    return [p for p, k in zip(pts, keep) if k]

def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return s if s not in ('', '-0') else '0'

PATH_RE = re.compile(r'(\sd=")([^"]*)(")')

def simplify_paths(svg, eps=0.12, minlen=2000):
    def sub(m):
        d = m.group(2)
        if len(d) < minlen:
            return m.group(0)
        # only touch pure M/L polylines — anything with curves is left alone
        if re.search(r'[CcQqSsTtAaHhVv]', d):
            return m.group(0)
        toks = re.findall(r'([MLZz])\s*(-?[\d.]+)?[\s,]*(-?[\d.]+)?', d)
        pts, closed = [], False
        for cmd, x, y in toks:
            if cmd in 'Zz':
                closed = True
            elif x and y:
                pts.append((float(x), float(y)))
        if len(pts) < 3:
            return m.group(0)
        out = rdp(pts, eps)
        d2 = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in out) + (' Z' if closed else '')
        return m.group(1) + d2 + m.group(3)
    return PATH_RE.sub(sub, svg)

def round_paths(svg):
    """Trim coordinate precision on the paths RDP left alone."""
    def sub(m):
        d = m.group(2)
        if re.search(r'[CcQqSsTtAa]', d):
            return m.group(0)
        d2 = re.sub(r'-?\d+\.\d{3,}', lambda n: fmt(float(n.group(0))), d)
        return m.group(1) + d2 + m.group(3)
    return PATH_RE.sub(sub, svg)

# ---- element stripping -----------------------------------------------------
def strip_tag(svg, name, keep=lambda m: False):
    """Remove <name .../> and <name ...>...</name> (Batik writes '</name\n>')."""
    out, pos = [], 0
    open_re = re.compile(r'<%s\b' % name)
    while True:
        m = open_re.search(svg, pos)
        if not m:
            out.append(svg[pos:]); break
        # find end of the start tag, respecting quotes
        i, q = m.end(), None
        while i < len(svg):
            ch = svg[i]
            if q:
                if ch == q: q = None
            elif ch in '"\'': q = ch
            elif ch == '>': break
            i += 1
        selfclose = svg[i - 1] == '/'
        start_tag = svg[m.start():i + 1]
        if keep(start_tag):
            out.append(svg[pos:i + 1]); pos = i + 1; continue
        out.append(svg[pos:m.start()])
        if selfclose:
            pos = i + 1
        else:
            close = re.compile(r'</%s\s*>' % name)
            c = close.search(svg, i)
            pos = c.end() if c else i + 1
    return ''.join(out)

# MATLAB pads its canvas well beyond the axes. Cropping the viewBox to the
# measured content box (getBBox in the browser, plus a small margin) buys ~16%
# on every tick label without touching a single coordinate.
CROP = {
    'fig3-thickness-profiles.svg': '116 33 1204 772',
    'fig4-boundary-layers.svg': '132 33 1188 772',
}


def transform(path, out_path, ns):
    s = open(path, encoding='utf-8').read()
    before = len(s)

    # draw.io embeds its own mxGraph XML source in the root content= attribute
    s = re.sub(r'\scontent="(?:[^"\\]|\\.)*"', '', s, count=1)

    # <switch><foreignObject>…</foreignObject><image base64 …/></switch> — the
    # raster is a fallback for renderers without foreignObject. Inlined into a
    # page it never renders, and it is ~80% of the file.
    s = strip_tag(s, 'image', keep=lambda t: 'base64' not in t)

    # MathJax ships a 7 KB global stylesheet per figure; the handful of rules
    # that actually matter live in Figure.astro instead. draw.io's @supports
    # block only feeds its own --ge-adaptive-bg, which we replace outright.
    s = strip_tag(s, 'style')

    # SVG <font>/<glyph> definitions: no browser has honoured these since SVG
    # 1.1 fonts were dropped. Text already falls back to a real font.
    s = strip_tag(s, 'font')

    # light-dark() hardcodes a light/dark pair that ignores the site toggle.
    # Collapse to the light value, then map it onto a token below.
    for _ in range(4):
        s2 = re.sub(r'light-dark\(\s*([^(),]+(?:\([^()]*\))?)\s*,\s*[^()]*(?:\([^()]*\))?[^()]*\)', r'\1', s)
        if s2 == s: break
        s = s2

    s = simplify_paths(s)
    s = round_paths(s)
    s = recolor(s)

    # exporter fonts -> the site's own stack, so figure labels match the prose
    s = re.sub(r"font-family:\s*'?(?:Helvetica Neue|Helvetica|Dialog|Arial)'?", 'font-family: var(--font-sans)', s)
    s = re.sub(r'font-family="(?:Helvetica Neue|Helvetica|Dialog|Arial)"', 'font-family="var(--font-sans)"', s)

    # draw.io asks the UA to pick a scheme; the site's toggle already decided
    s = s.replace('color-scheme: light dark;', '')
    s = s.replace('var(--ge-adaptive-bg, var(--fig-paper))', 'var(--fig-paper)')

    # namespace ids so two inlined figures on one page cannot collide
    ids = set(re.findall(r'\sid="([^"]+)"', s))
    for i in sorted(ids, key=len, reverse=True):
        s = s.replace('id="%s"' % i, 'id="%s-%s"' % (ns, i))
        s = s.replace('href="#%s"' % i, 'href="#%s-%s"' % (ns, i))
        s = s.replace('url(#%s)' % i, 'url(#%s-%s)' % (ns, i))

    # root: drop the fixed px box so the figure scales with its column, and
    # drop the baked-in background so the page shows through.
    m = re.search(r'<svg\b[^>]*>', s)
    root = m.group(0)
    w = re.search(r'\swidth="(\d+(?:\.\d+)?)(?:px)?"', root)
    h = re.search(r'\sheight="(\d+(?:\.\d+)?)(?:px)?"', root)
    new = root
    if not re.search(r'viewBox=', new) and w and h:
        new = new[:-1] + ' viewBox="0 0 %s %s">' % (w.group(1), h.group(1))
    new = re.sub(r'\swidth="[^"]*"', '', new, count=1)
    new = re.sub(r'\sheight="[^"]*"', '', new, count=1)
    new = re.sub(r'\sstyle="[^"]*"', lambda mm: re.sub(r'background[^;]*;?', '', mm.group(0)), new, count=1)
    # Inter is wider than the Helvetica MATLAB measured its legend box against,
    # so fig 4's two longest entries ("Hydrodynamic Boundary Layer") spilled out
    # through the right-hand border. 184 units of text into a 173-unit box: the
    # legend alone comes down a step so the whole block fits again.
    if os.path.basename(out_path) == 'fig4-boundary-layers.svg':
        s = re.sub(
            r'(translate\(1116,[\d.]+\)" style="font-size:)12\.6px',
            r'\g<1>11.6px', s)

    crop = CROP.get(os.path.basename(out_path))
    if crop:
        new = re.sub(r'viewBox="[^"]*"', 'viewBox="%s"' % crop, new)
    if 'preserveAspectRatio' not in new:
        new = new[:-1] + ' preserveAspectRatio="xMidYMid meet">'
    s = s.replace(root, new, 1)

    # the opaque paper rect draw.io/MATLAB paint first. The figure already sits
    # on var(--bg); a canvas-sized rect underneath it only makes the crop below
    # impossible to measure.
    s = re.sub(r'<rect fill="var\(--fig-paper\)" width="100%" height="100%"[^>]*/>', '', s)
    if w and h:
        s = re.sub(
            r'<rect[^>]*\bwidth="%s"[^>]*\bheight="%s"[^>]*/>' % (w.group(1), h.group(1)),
            '', s)
        s = re.sub(
            r'<rect[^>]*\bx="0"[^>]*\bwidth="%s"[^>]*\bheight="%s"[^>]*\by="0"[^>]*/>' % (w.group(1), h.group(1)),
            '', s)

    # XML prolog and DOCTYPE are invalid inside HTML
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'<!DOCTYPE[^>]*>', '', s, flags=re.S)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'\n\s*\n', '\n', s).strip()

    open(out_path, 'w', encoding='utf-8').write(s + '\n')
    print(f'{os.path.basename(out_path):34s} {before:7d} -> {len(s):7d}  ({100*len(s)//before:3d}%)')

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for fn, out, ns in [
        ('Fig1-Nomenclature.drawio.svg', 'fig1-nomenclature.svg', 'f1'),
        ('Fixed_Fig2.drawio.svg', 'fig2-element.svg', 'f2'),
        ('Fig3.svg', 'fig3-thickness-profiles.svg', 'f3'),
        ('Fig4.svg', 'fig4-boundary-layers.svg', 'f4'),
        ('Fig_5-Shifting_Leading_Edge.drawio.svg', 'fig5-shifting-leading-edge.svg', 'f5'),
    ]:
        transform(os.path.join(src, fn), os.path.join(dst, out), ns)
