"""Run the S96b.2 real Worker acceptance using installed Chrome and Selenium."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--page', default='tests/browser/p0021-slice-96b2-history-enter.html')
parser.add_argument('--result-variable', default='s96b2Result')
parser.add_argument('--buttons', nargs='+', help='Run existing acceptance buttons in order')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
# Keep Selenium Manager downloads out of the checkpoint worktree.
os.environ.setdefault('SE_CACHE_PATH', str(root / 'tools' / 'reports' / 'selenium-cache'))
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(
    ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--disable-gpu')
options.add_argument('--no-first-run')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = None
try:
    driver = webdriver.Chrome(options=options)
    print('Chrome:', driver.capabilities['browserVersion'], flush=True)
    print('ChromeDriver:', driver.capabilities.get('chrome', {}).get('chromedriverVersion', 'unavailable'), flush=True)
    driver.get(f'http://127.0.0.1:{server.server_port}/{args.page}')
    if args.buttons:
        cases = []
        for button in args.buttons:
            driver.execute_script('document.getElementById(arguments[0]).click()', button)
            outcome = WebDriverWait(driver, 240).until(lambda browser:
                browser.execute_script("return ['pass','fail'].includes(document.getElementById('status').className) ? {status:document.getElementById('status').className,log:document.getElementById('log').textContent} : null"))
            cases.append({'button':button, **outcome})
            if outcome['status'] == 'fail':
                break
        result = {'pass':sum(c['status']=='pass' for c in cases),
                  'fail':sum(c['status']=='fail' for c in cases),'cases':cases}
    else:
        result = WebDriverWait(driver, 240).until(
            lambda browser: browser.execute_script('return window[arguments[0]] || null', args.result_variable))
    print(json.dumps(result, indent=2), flush=True)
    if result['fail']:
        print(json.dumps(driver.get_log('browser'), indent=2), flush=True)
        raise SystemExit(1)
finally:
    if driver:
        driver.quit()
    server.shutdown()
