import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox"])
    for d, tag in [("x-zdos.it","zdos"),("ourvelvet.online","velvet"),("zx.x-zdos.it","zx")]:
        pg = b.new_page(viewport={"width":1100,"height":1500})
        errs=[]; pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.goto(f"https://{d}/verifica/", wait_until="networkidle")
        pg.screenshot(path=f"screens/verifica-{tag}.png", full_page=True)
        print(d, pg.title(), errs)
    b.close()
