"""Debug: python pose.py <candy dir> out.png x,y,z [x,y,z ...]  -> fixed-orientation renders side by side on light grey."""
import sys, subprocess
from playwright.sync_api import sync_playwright
D, out, poses = sys.argv[1], sys.argv[2], sys.argv[3:]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 600, 'height': 600}); logs = []
    pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
    pg.goto('file://' + D + '/index.html'); pg.wait_for_function('window.candy && window.candy.ready', timeout=60000)
    pg.add_style_tag(content='html,body{background:#ecebe7 !important}')
    files = []
    for i, ps in enumerate(poses):
        pg.evaluate(f'candy.pose({ps})'); f = f'/tmp/pose_{i}.png'; pg.screenshot(path=f); files.append(f)
    b.close(); print('\n'.join(logs))
args = sum([['-i', f] for f in files], [])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args, '-filter_complex', f'hstack={len(files)}' if len(files) > 1 else 'null', out], check=True)
