"""Render previews of <candy dir>/index.html.  Usage: python capture.py <candy dir> still|video [--mov] [--lite]
   Render previews of index.html with headless Chrome (SwiftShader WebGL).
   python capture.py still  -> preview.png (alpha), preview-checker.png, /tmp/preview_grey.png
   python capture.py video  -> preview.mp4 (grey bg), preview.webm (VP9 alpha), preview.mov (ProRes 4444 alpha, only with --mov),
                               preview-transparent.webp (animated, alpha)"""
import sys, os, subprocess, shutil
from playwright.sync_api import sync_playwright
D = sys.argv[1].rstrip('/')
GREY = '0xecebe7'
FPS, SIZE = 30, 800
mode = sys.argv[2] if len(sys.argv) > 2 else 'still'
LITE = '--lite' in sys.argv          # higher compression for very detailed (grainy) candies
ff = lambda *a: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
CHECKER = f'color=c=0xffffff:s={SIZE}x{SIZE},format=rgb24[w];color=c=0xcccccc:s={SIZE}x{SIZE},format=rgb24[g];' \
          f'[w][g]blend=all_expr=\'if(eq(mod(floor(X/32)+floor(Y/32)\\,2)\\,0)\\,A\\,B)\'[cb]'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': SIZE, 'height': SIZE})
    logs = []
    pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
    pg.goto('file://' + D + '/index.html')
    pg.wait_for_function('window.candy && window.candy.ready', timeout=60000)
    pg.evaluate('candy.pause()')
    shot = lambda path: pg.screenshot(path=path, omit_background=True)   # keeps real alpha
    if mode == 'still':
        pg.evaluate('candy.at(candy.staticTime)'); shot(D + '/preview.png')
        ff('-i', D + '/preview.png', '-filter_complex', CHECKER + ';[cb][0]overlay=format=auto', '-frames:v', '1', D + '/preview-checker.png')
        ff('-f', 'lavfi', '-i', f'color=c={GREY}:s={SIZE}x{SIZE}', '-i', D + '/preview.png',
           '-filter_complex', '[0][1]overlay=format=auto', '-frames:v', '1', '/tmp/preview_grey.png')
    else:
        fr = '/tmp/frames_' + os.path.basename(D); shutil.rmtree(fr, ignore_errors=True); os.makedirs(fr)
        SECS = pg.evaluate('candy.loopSeconds')            # one full motion loop -> seamless
        for i in range(round(FPS * SECS)):
            pg.evaluate(f'candy.at({i / FPS})'); shot(f'{fr}/f{i:04d}.png')
        src = ['-framerate', str(FPS), '-i', f'{fr}/f%04d.png']
        ff('-f', 'lavfi', '-i', f'color=c={GREY}:s={SIZE}x{SIZE}:r={FPS}', *src,
           '-filter_complex', '[0][1]overlay=format=auto:shortest=1,scale=640:640', '-c:v', 'libx264',
           '-pix_fmt', 'yuv420p', '-crf', '26' if LITE else '20', '-movflags', '+faststart', D + '/preview.mp4')
        ff(*src, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '40' if LITE else '30', '-row-mt', '1',
           '-auto-alt-ref', '0', D + '/preview.webm')
        if '--mov' in sys.argv: ff(*src, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16',
           '-vendor', 'apl0', D + '/preview.mov')
        ff(*src, '-vf', 'fps=15,scale=400:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-lossless', '0',
           '-quality', '70' if LITE else '80', '-loop', '0', D + '/preview-transparent.webp')
    print('\n'.join(logs))
    b.close()
