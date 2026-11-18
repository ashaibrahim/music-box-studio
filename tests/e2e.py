"""Browser test for Music Box Studio (server: python3 -m http.server 8099 in the project folder)."""
import os
import sys
from playwright.sync_api import sync_playwright
URL = 'http://127.0.0.1:8099/'
OUT = os.path.join(os.path.dirname(__file__), 'screenshots')
os.makedirs(OUT, exist_ok=True)
errors = []
def check(c, m):
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: errors.append(m)

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'page: {e}'))
    pg.on('console', lambda m: m.type == 'error' and 'fonts.g' not in m.text and errors.append(f'console: {m.text}'))
    pg.goto(URL); pg.wait_for_timeout(1200)
    check(pg.inner_text('#note-count') == '42', 'starts with Twinkle loaded (42 notes)')
    check(pg.get_attribute('.colophon .credit', 'href') == 'https://ashaibrahim.netlify.app/', 'studio has the © 2026 Asha portfolio link')

    # blank + compose with the mouse
    pg.select_option('#tune', 'blank'); pg.wait_for_timeout(200)
    check(pg.inner_text('#note-count') == '0', 'blank box is empty')
    pg.click('#bars-down'); pg.click('#bars-down'); pg.click('#bars-down'); pg.click('#bars-down'); pg.click('#bars-down'); pg.click('#bars-down')
    check(pg.inner_text('#bars-out') == '2 bars', 'length goes down to 2 bars (minimum)')
    pg.locator('#grid').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    box = pg.locator('#grid').bounding_box()
    CW, RH = 24, 17
    def cell(step, row): return (box['x'] + step * CW + CW / 2, box['y'] + row * RH + RH / 2)
    for step, row in [(0, 12), (2, 10), (4, 8), (6, 5), (8, 3), (10, 0)]:
        pg.mouse.click(*cell(step, row))
    check(pg.inner_text('#note-count') == '6', 'clicking adds notes')
    pg.mouse.click(*cell(10, 0))
    check(pg.inner_text('#note-count') == '5', 'clicking a note removes it')
    pg.click('#undo')
    check(pg.inner_text('#note-count') == '6', 'undo brings it back')
    # drag-paint a row
    x0, y0 = cell(12, 14); x1, _ = cell(15, 14)
    pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x1, y0, steps=6); pg.mouse.up()
    check(pg.inner_text('#note-count') == '10', 'dragging paints several notes')
    # keyboard
    pg.focus('#grid'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('Enter')
    check(pg.inner_text('#note-count') == '11', 'keyboard Enter adds a note')

    # play / stop
    pg.fill('#tempo', '180'); pg.dispatch_event('#tempo', 'input')
    pg.evaluate('window.scrollTo(0, 0)')
    pg.click('#play'); pg.wait_for_timeout(900)
    pos = pg.evaluate('document.getElementById("play-label").textContent')
    check(pos == 'Stop', 'play button switches to Stop')
    pg.screenshot(path=f'{OUT}/studio-playing.png')
    pg.click('#play'); pg.wait_for_timeout(200)
    check(pg.inner_text('#play-label') == 'Play', 'stop works')

    # gift options + link
    pg.click('.swatch[data-id="lavender"]')
    pg.click('#figures [data-id="cake"]')
    check(pg.get_attribute('#figures [data-id="cake"]', 'aria-checked') == 'true', 'birthday cake figure can be chosen')
    pg.fill('#gift-to', 'For Mei'); pg.fill('#gift-from', 'Asha')
    pg.fill('#gift-message', 'Happy birthday, Mei! I wrote this little tune for you. ♡')
    check(pg.inner_text('#msg-count') == str(len('Happy birthday, Mei! I wrote this little tune for you. ♡')), 'message counter updates')
    pg.click('#make-link'); pg.wait_for_timeout(300)
    url = pg.input_value('#share-url')
    check('#gift=' in url and len(url) < 400, f'gift link created ({len(url)} chars)')
    pg.screenshot(path=f'{OUT}/studio-gift.png')

    # reload keeps the work
    pg.reload(); pg.wait_for_timeout(900)
    check(pg.inner_text('#note-count') == '11' and pg.input_value('#gift-to') == 'For Mei', 'work is kept after reload')
    check(pg.get_attribute('#figures [data-id="cake"]', 'aria-checked') == 'true', 'figure choice is kept after reload')

    # ---- recipient ----
    g = b.new_context(viewport={'width': 1280, 'height': 860}).new_page()
    g.on('pageerror', lambda e: errors.append(f'gift page: {e}'))
    g.goto(url); g.wait_for_timeout(1200)
    check(g.is_visible('#gift') and not g.is_visible('#studio'), 'gift link opens the gift view')
    check(g.inner_text('#env-to') == 'For Mei' and g.inner_text('#env-from') == 'from Asha', 'shows who it is for and from')
    figure = g.evaluate("import('./js/song.js').then(m => m.decode(location.hash.slice(6)).gift.figure)")
    check(figure == 'cake', 'the figure travels in the gift link')
    check(g.is_visible('#envelope') and g.inner_text('#seal-letter') == 'A', 'gift opens as a sealed envelope with the sender initial')
    check(g.is_visible('.gift-credit') and g.inner_text('.gift-credit') == '© 2026 Asha', 'gift page shows the © 2026 Asha link')
    g.screenshot(path=f'{OUT}/gift-envelope.png')
    g.click('#envelope'); g.wait_for_selector('#gift-bottom:not([hidden])', timeout=8000); g.wait_for_timeout(1200)
    check(g.is_hidden('#envelope-scene') and g.is_visible('#wind'), 'breaking the seal reveals the box')
    try:
        g.wait_for_selector('#key-hint:not([hidden])', timeout=6000); ring = True
    except Exception:
        ring = False
    check(ring, 'a ring shows where the key is')
    g.wait_for_timeout(1500)
    check(g.is_visible('#turn-hint'), 'a hint says the box can be turned')
    g.screenshot(path=f'{OUT}/gift-closed.png')
    cb = g.locator('#gift-canvas').bounding_box()
    g.mouse.move(cb['x'] + cb['width'] * 0.3, cb['y'] + cb['height'] * 0.5); g.mouse.down()
    g.mouse.move(cb['x'] + cb['width'] * 0.45, cb['y'] + cb['height'] * 0.5, steps=8); g.mouse.up()
    check('used' in g.get_attribute('#turn-hint', 'class'), 'the hint fades once the box is turned')
    check(g.is_visible('#remix'), '"Make one back" is there from the start')
    g.click('#wind'); g.wait_for_timeout(2500)
    check(g.is_disabled('#wind') and g.inner_text('#wind') == 'Playing…', 'turning the key starts it')
    g.wait_for_selector('#note-hint:not([hidden])', timeout=8000)
    check(g.is_visible('#read'), 'a label and a button say the note can be read')
    g.screenshot(path=f'{OUT}/gift-playing.png')
    hb = g.locator('#note-hint').bounding_box()
    g.mouse.click(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2); g.wait_for_timeout(800)
    check(g.is_visible('#letter') and 'Happy birthday, Mei' in g.inner_text('#letter-text'), 'tapping the note in the lid opens the letter')
    g.screenshot(path=f'{OUT}/gift-letter.png')
    g.keyboard.press('Escape'); g.wait_for_timeout(300)
    check(g.is_hidden('#letter') and g.is_hidden('#note-hint'), 'the letter closes, and the label goes away')
    g.wait_for_function("document.querySelector('#wind').textContent === 'Play it again'", timeout=20000)
    check(g.is_enabled('#wind') and g.is_visible('#remix'), 'play it again once it ends')
    g.screenshot(path=f'{OUT}/gift-done.png')

    # broken link
    g.goto('about:blank'); g.goto(URL + '#gift=AQBg'); g.wait_for_timeout(1200)
    check(g.is_visible('#gift-error') and 'incomplete' in g.inner_text('#gift-error'), 'broken link explains what to do')
    check(g.is_visible('.gift-credit'), 'the © link is also on the broken-link page')

    # phone layout
    m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2).new_page()
    m.goto(URL); m.wait_for_timeout(1200); m.screenshot(path=f'{OUT}/phone.png', full_page=True)
    m.goto(url); m.wait_for_timeout(1200); m.screenshot(path=f'{OUT}/phone-envelope.png')
    m.click('#envelope'); m.wait_for_timeout(2600); m.screenshot(path=f'{OUT}/phone-gift.png')
    b.close()

print('\n'.join(errors) if errors else 'ALL GOOD')
sys.exit(1 if errors else 0)
