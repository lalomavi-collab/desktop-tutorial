"""Build Lalum Serif, the display family, from two SIL OFL fonts.

Hebrew comes from Frank Ruhl Libre (the Hebrew classic for legal and editorial
print), Latin from Newsreader at a display-leaning optical size. The Latin is scaled
so its capital height matches the proportion Frank Ruhl Libre itself keeps
between Hebrew and Latin (cap 660 over Hebrew height 597), the two scripts are
merged into one file per style, vertical metrics are unified, and the result is
renamed and written as woff2. See brand/fonts/README.md.

    python3 -m venv venv && venv/bin/pip install fonttools brotli
    venv/bin/python brand/fonts/build.py <dir with the four source ttf> <out dir>
"""
import sys, tempfile, pathlib
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem
from fontTools.varLib import instancer
from fontTools import subset, merge

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

FAMILY = "Lalum Serif"
UPM = 1000
LATIN_SCALE = 660 / 688.3          # Newsreader cap height at upem 1000 -> Frank Ruhl Libre's 660
OPSZ = 32                          # Newsreader optical size: between its 20px card titles and 60px headlines
VERSION = "Version 1.000; derived from Frank Ruhl Libre and Newsreader (SIL OFL 1.1)"
COPYRIGHT = (
    "Copyright 2015 The Frank Ruhl Libre Project Authors (https://github.com/fontef/frankruhllibre). "
    "Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader). "
    "Modified and merged as Lalum Serif."
)
LICENSE = "This Font Software is licensed under the SIL Open Font License, Version 1.1. https://openfontlicense.org"

# Hebrew and the shekel sign from Frank Ruhl Libre; everything else from Newsreader.
HEBREW = list(range(0x0590, 0x0600)) + list(range(0xFB1D, 0xFB50)) + [0x200E, 0x200F, 0x20AA]
LATIN = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x2010, 0x2028))
         + list(range(0x2030, 0x203B)) + [0x20AC, 0x2122, 0x2212, 0x00D7, 0x2044, 0x2215])
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "lnum", "onum", "pnum", "tnum", "case", "frac", "sups"]

def sub(font, unicodes, path):
    opts = subset.Options()
    opts.layout_features = FEATURES
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes)
    s.subset(font)
    font.save(path)

def build(weight, italic, tmp):
    hebrew = instancer.instantiateVariableFont(TTFont(SRC / "FrankRuhlLibre[wght].ttf"), {"wght": weight})
    latin_file = "Newsreader-Italic[opsz,wght].ttf" if italic else "Newsreader[opsz,wght].ttf"
    latin = instancer.instantiateVariableFont(TTFont(SRC / latin_file), {"wght": weight, "opsz": OPSZ})
    # Newsreader is 2000 upem. Scaling to LATIN_SCALE * 1000 and then declaring 1000
    # shrinks every glyph, advance and kern by LATIN_SCALE in one consistent step.
    scale_upem(latin, round(UPM * LATIN_SCALE))
    latin["head"].unitsPerEm = UPM
    hp, lp = tmp / "h.ttf", tmp / "l.ttf"
    sub(hebrew, HEBREW, hp)
    sub(latin, LATIN, lp)
    merged = merge.Merger().merge([str(lp), str(hp)])   # Latin first: it owns space and the digits
    return merged

def finish(font, weight, italic):
    style = {400: "Regular", 500: "Medium", 700: "Bold"}[weight]
    sub_family = ("Italic" if style == "Regular" else f"{style} Italic") if italic else style
    full = f"{FAMILY} {sub_family}"
    ps = f"LalumSerif-{sub_family.replace(' ', '')}"
    name = font["name"]
    name.names = []
    family_legacy = FAMILY if style == "Regular" or style == "Bold" else f"{FAMILY} {style}"
    legacy_sub = ("Italic" if italic else "Regular") if style != "Bold" else ("Bold Italic" if italic else "Bold")
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        for nid, val in ((0, COPYRIGHT), (1, family_legacy), (2, legacy_sub), (3, f"{VERSION};{ps}"), (4, full),
                         (5, VERSION), (6, ps), (13, LICENSE), (14, "https://openfontlicense.org"),
                         (16, FAMILY), (17, sub_family)):
            name.setName(val, nid, pid, eid, lid)
    # Weight and style, with one family and real 400/500/700 faces.
    os2 = font["OS/2"]
    os2.usWeightClass = weight
    sel = os2.fsSelection & ~0b1100001      # clear italic, bold, regular
    sel |= (1 << 7)                          # USE_TYPO_METRICS
    sel |= (1 if italic else (0b1000000 if weight == 400 else 0))
    if weight == 700 and not italic:
        sel |= 0b100000
    os2.fsSelection = sel
    font["head"].macStyle = (1 if weight == 700 else 0) | (2 if italic else 0)
    # One set of vertical metrics for both scripts: Frank Ruhl Libre's, which clear Hebrew points.
    asc, desc = 957, -334
    hh = font["hhea"]; hh.ascent, hh.descent, hh.lineGap = asc, desc, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = asc, desc, 0
    os2.usWinAscent, os2.usWinDescent = asc + 40, -desc + 40
    font["head"].unitsPerEm = UPM
    if "STAT" in font: del font["STAT"]
    return font

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as t:
        tmp = pathlib.Path(t)
        for weight, italic in ((400, False), (500, False), (700, False), (400, True)):
            f = finish(build(weight, italic, tmp), weight, italic)
            f.flavor = "woff2"
            out = OUT / f"lalum-serif-{weight}{'-italic' if italic else ''}.woff2"
            f.save(out)
            print(out.name, out.stat().st_size)
