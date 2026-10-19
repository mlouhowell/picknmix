"""Inline candy-kit.js into every candy page between the @candy-kit markers (pages stay single-file)."""
import re, pathlib
KIT = pathlib.Path(__file__).with_name('candy-kit.js').read_text().rstrip() + '\n'
PAGES = ['/workspace/polkagris-3d/index.html', '/workspace/djungelvral-3d/index.html']
pat = re.compile(r'(// @candy-kit:begin[^\n]*\n).*?(// @candy-kit:end)', re.S)
for p in PAGES:
    f = pathlib.Path(p)
    if not f.exists(): continue
    s = f.read_text()
    s2, n = pat.subn(lambda m: m.group(1) + KIT + m.group(2), s)
    assert n == 1, f'{p}: markers not found'
    f.write_text(s2); print('inlined kit ->', p)
