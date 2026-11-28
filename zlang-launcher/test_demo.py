import asyncio, os, sys, json
from playwright.async_api import async_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:43817')
OUT = os.environ.get('OUT', '/workspace/lsd-launcher/screens/local')
os.makedirs(OUT, exist_ok=True)
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        for tag, vp, mobile in (('mobile', {'width': 412, 'height': 915}, True), ('desktop', {'width': 1280, 'height': 900}, False)):
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile)
            page = await ctx.new_page(); errs = []; reqs = []
            page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
            page.on('request', lambda r: reqs.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
            await page.goto(BASE + '/launcher/', wait_until='networkidle'); await page.wait_for_timeout(600)
            ov = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            print(tag, 'overflow-x px:', ov)
            await page.screenshot(path=f'{OUT}/crea-{tag}-top.png')
            await page.screenshot(path=f'{OUT}/crea-{tag}-full.png', full_page=True)
            print(' fee rows:', (await page.inner_text('#feeOut')).replace('\n', ' | ')[:700])
            print(' hash band:', await page.inner_text('#bandHash'))
            # interazioni crea
            await page.fill('#fName', 'Luna Dolce'); await page.fill('#fSym', 'luna'); await page.fill('#fSupply', '5000000000')
            await page.click('label.zl-tg:has(#tLock)'); await page.wait_for_timeout(300)
            print(' badge:', await page.inner_text('#pvBadge'), '| price:', await page.inner_text('#pvPrice'))
            await page.click('label.zl-tg:has(#tLock)'); await page.click('#btnSim'); await page.wait_for_timeout(500)
            print(' sim:', (await page.inner_text('#simRes')).replace('\n', ' | ')[:400])
            await page.screenshot(path=f'{OUT}/crea-{tag}-sim.png', full_page=True)
            await page.fill('#fSupply', 'abc'); print(' err supply:', await page.inner_text('#eSupply'), '| sim disabled:', await page.is_disabled('#btnSim'))
            await page.fill('#fSupply', '1000000000')
            for t in ('faucet', 'airdrop', 'party'):
                await page.click(f'#tab-{t}'); await page.wait_for_timeout(300)
                if t == 'faucet':
                    await page.fill('#faAddr', 'FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP'); await page.select_option('#faAge', '3'); await page.click('#btnFa'); await page.wait_for_timeout(300)
                    print(' faucet young:', (await page.inner_text('#faRes')).replace('\n', ' | ')[:200])
                    await page.select_option('#faAge', '30'); await page.click('#btnFa'); await page.wait_for_timeout(300)
                    print(' faucet ok:', (await page.inner_text('#faRes')).replace('\n', ' | ')[:300])
                    await page.click('#btnFa'); await page.wait_for_timeout(300)
                    print(' faucet again:', (await page.inner_text('#faRes')).replace('\n', ' | ')[:300])
                if t == 'airdrop':
                    await page.click('#btnAd'); await page.wait_for_timeout(500)
                    print(' airdrop:', (await page.inner_text('#adRes')).replace('\n', ' | ')[:300])
                    await page.click('#btnAdClaim'); await page.wait_for_timeout(200); await page.click('#btnAdClaim'); await page.wait_for_timeout(200)
                    print(' claim2:', (await page.inner_text('#adRes')).replace('\n', ' | ')[:200])
                    await page.fill('#adId', 'sconosciuto'); await page.click('#btnAd'); await page.wait_for_timeout(300)
                    print(' unknown:', (await page.inner_text('#adRes')).replace('\n', ' | ')[:120])
                    await page.click('#adSel'); await page.select_option('#adSel', 'esempio-merito-03'); await page.click('#btnAd'); await page.wait_for_timeout(400)
                if t == 'party':
                    await page.fill('#ppN', '250') if False else await page.evaluate("document.getElementById('ppN').value=250;document.getElementById('ppN').dispatchEvent(new Event('input'))")
                    print(' party:', await page.inner_text('#ppOut'), '|', await page.inner_text('#ppLocal'))
                await page.screenshot(path=f'{OUT}/{t}-{tag}.png', full_page=True)
                ov = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'); print(' ', t, 'overflow-x:', ov)
            await page.goto(BASE + '/launcher/piano/', wait_until='networkidle'); await page.wait_for_timeout(400)
            print(tag, 'piano overflow:', await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'))
            await page.screenshot(path=f'{OUT}/piano-{tag}-top.png'); await page.screenshot(path=f'{OUT}/piano-{tag}-full.png', full_page=True)
            print(tag, 'errors:', errs, '| external requests:', reqs)
            await ctx.close()
        await b.close()
asyncio.run(run())
