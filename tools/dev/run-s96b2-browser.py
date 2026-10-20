"""Run the S96b.2 real Worker acceptance using installed Chrome and Selenium."""
import functools
import http.server
import json
from pathlib import Path
import threading
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

root = Path(__file__).resolve().parents[2]
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
    driver.get(f'http://127.0.0.1:{server.server_port}/tests/browser/p0021-slice-96b2-history-enter.html')
    result = WebDriverWait(driver, 240).until(
        lambda browser: browser.execute_script('return window.s96b2Result || null'))
    print(json.dumps(result, indent=2), flush=True)
    if result['fail']:
        print(json.dumps(driver.get_log('browser'), indent=2), flush=True)
        raise SystemExit(1)
finally:
    if driver:
        driver.quit()
    server.shutdown()
