import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { parse } from 'url'

const DEFAULT_PORT = 4173

function isMobileUa(ua: string): boolean {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua)
}

function sendHtml(res: ServerResponse, body: string, headers: Record<string, string> = {}): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...headers })
  res.end(body)
}

function sendJson(res: ServerResponse, data: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(200, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(data))
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? ''
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split('=')
        return [key, decodeURIComponent(rest.join('='))]
      })
  )
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const { pathname } = parse(req.url ?? '/', true)
  const ua = req.headers['user-agent'] ?? ''

  if (pathname === '/') {
    sendHtml(
      res,
      '<!doctype html><html><body><h1 id="fixture-home">Fixture Home</h1></body></html>'
    )
    return
  }

  if (pathname === '/runtime-evidence') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <h1 id="runtime-evidence-fixture">Runtime Evidence Fixture</h1>
        <button id="emit-console-error" data-testid="emit-console-error" type="button">
          Emit console error
        </button>
        <button id="emit-fetch-ok" data-testid="emit-fetch-ok" type="button">
          Fetch 200
        </button>
        <button id="emit-fetch-404" data-testid="emit-fetch-404" type="button">
          Fetch 404
        </button>
        <button id="emit-fetch-fail" data-testid="emit-fetch-fail" type="button">
          Fetch load failure
        </button>
        <button id="emit-many-logs" data-testid="emit-many-logs" type="button">
          Emit many console logs
        </button>
        <button id="emit-throw-error" data-testid="emit-throw-error" type="button">
          Throw uncaught error
        </button>
        <script>
          document.getElementById('emit-console-error').addEventListener('click', function () {
            console.error('fixture-runtime-error', 'deliberate test error');
          });
          document.getElementById('emit-fetch-ok').addEventListener('click', function () {
            void fetch('/runtime-evidence/api/ok');
          });
          document.getElementById('emit-fetch-404').addEventListener('click', function () {
            void fetch('/runtime-evidence/api/missing');
          });
          document.getElementById('emit-fetch-fail').addEventListener('click', function () {
            void fetch('/runtime-evidence/api/fail');
          });
          document.getElementById('emit-many-logs').addEventListener('click', function () {
            for (var i = 0; i < 30; i++) {
              console.log('fixture-log-batch', String(i).padStart(2, '0'));
            }
          });
          document.getElementById('emit-throw-error').addEventListener('click', function () {
            throw new Error('fixture-uncaught-error');
          });
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/runtime-evidence/api/ok') {
    sendJson(res, { ok: true })
    return
  }

  if (pathname === '/runtime-evidence/api/missing') {
    res.writeHead(404, {
      'Content-Type': 'application/json',
      'X-Fixture-Response': 'missing-resource'
    })
    res.end(JSON.stringify({ error: 'not found' }))
    return
  }

  if (pathname === '/runtime-evidence/api/fail') {
    req.socket.destroy()
    return
  }

  if (pathname === '/ua-sniff') {
    const mobile = isMobileUa(ua)
    sendHtml(
      res,
      `<!doctype html><html><body><div id="layout" data-variant="${mobile ? 'mobile' : 'desktop'}">${mobile ? 'mobile markup' : 'desktop markup'}</div></body></html>`
    )
    return
  }

  if (pathname === '/ua-echo') {
    sendJson(res, { userAgent: ua })
    return
  }

  if (pathname === '/pointer-hover') {
    sendHtml(
      res,
      `<!doctype html><html><head><style>
        #coarse { display: none; }
        #fine { display: none; }
        #hover-none { display: none; }
        #hover-hover { display: none; }
        @media (pointer: coarse) { #coarse { display: block; } }
        @media (pointer: fine) { #fine { display: block; } }
        @media (hover: none) { #hover-none { display: block; } }
        @media (hover: hover) { #hover-hover { display: block; } }
      </style></head><body>
        <div id="coarse" data-pointer="coarse">coarse</div>
        <div id="fine" data-pointer="fine">fine</div>
        <div id="hover-none" data-hover="none">hover-none</div>
        <div id="hover-hover" data-hover="hover">hover-hover</div>
      </body></html>`
    )
    return
  }

  if (pathname === '/viewport-meta') {
    sendHtml(
      res,
      `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin: 0; font: 16px system-ui; }
        #probe { width: 100vw; box-sizing: border-box; padding: 1rem; background: #def; }
      </style></head><body>
        <div id="probe" data-width=""></div>
        <script>
          document.getElementById('probe').dataset.width = String(document.documentElement.clientWidth);
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/dpr-image') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <img id="hero" alt="dpr"
          src="/assets/image-1x.png"
          srcset="/assets/image-1x.png 1x, /assets/image-2x.png 2x, /assets/image-3x.png 3x" />
        <script>
          (function () {
            const img = document.getElementById('hero');
            function mark() {
              document.body.dataset.loaded = new URL(img.currentSrc, location.href).pathname;
            }
            img.addEventListener('load', mark);
            if (img.complete) mark();
          })();
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/assets/image-1x.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(
      Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')
    )
    return
  }

  if (pathname === '/assets/image-2x.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(
      Buffer.from('89504e470d0a1a0a0000000d49484452000000020000000208060000001f15c489', 'hex')
    )
    return
  }

  if (pathname === '/assets/image-3x.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(
      Buffer.from('89504e470d0a1a0a0000000d49484452000000030000000308060000001f15c489', 'hex')
    )
    return
  }

  if (pathname === '/long-scroll') {
    const sections = Array.from(
      { length: 40 },
      (_, index) => `<section id="section-${index}">Section ${index}</section>`
    ).join('')
    const body = `<!doctype html><html><head><style>
        section { height: 240px; border-bottom: 1px solid #ccc; padding: 1rem; box-sizing: border-box; }
      </style></head><body>${sections}<div id="scroll-probe"></div>
      <script>
        window.reportScrollRatio = function () {
          const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          return max > 0 ? window.scrollY / max : 0;
        };
      </script></body></html>`
    setTimeout(() => sendHtml(res, body), 300)
    return
  }

  if (pathname === '/strict-headers') {
    sendHtml(
      res,
      '<!doctype html><html><body><h1 id="strict-ok">Strict headers page</h1></body></html>',
      {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'X-Content-Type-Options': 'nosniff'
      }
    )
    return
  }

  if (pathname === '/login' && req.method === 'GET') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <h1>Login</h1>
        <form method="POST" action="/login"><button id="login-btn" type="submit">Log in</button></form>
      </body></html>`
    )
    return
  }

  if (pathname === '/login' && req.method === 'POST') {
    res.writeHead(302, {
      'Set-Cookie': 'fixture_auth=1; Path=/; HttpOnly; SameSite=Lax',
      Location: '/auth-check'
    })
    res.end()
    return
  }

  if (pathname === '/auth-check') {
    const cookies = parseCookies(req)
    const authed = cookies.fixture_auth === '1'
    sendHtml(
      res,
      `<!doctype html><html><body><div id="auth-status" data-authed="${authed ? 'yes' : 'no'}">${authed ? 'authenticated' : 'guest'}</div></body></html>`
    )
    return
  }

  if (pathname === '/flow-a') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <h1 id="flow-a">Flow page A</h1>
        <a id="flow-link" href="/flow-b">Continue to page B</a>
      </body></html>`
    )
    return
  }

  if (pathname === '/flow-b') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <h1 id="flow-b">Flow page B</h1>
        <button id="flow-back" type="button" onclick="history.back()">Back</button>
      </body></html>`
    )
    return
  }

  if (pathname === '/ua-form' && req.method === 'GET') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <h1>UA form</h1>
        <form method="POST" action="/ua-form">
          <input id="name-input" name="name" type="text" placeholder="Name" />
          <button id="ua-submit" type="submit">Submit</button>
        </form>
      </body></html>`
    )
    return
  }

  if (pathname === '/ua-form' && req.method === 'POST') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <div id="ua-result" data-user-agent="${ua.replace(/"/g, '&quot;')}">${ua}</div>
      </body></html>`
    )
    return
  }

  if (pathname === '/enter-form-sync' && req.method === 'GET') {
    const mobile = isMobileUa(ua)
    sendHtml(
      res,
      mobile
        ? `<!doctype html><html><body>
        <h1>Search</h1>
        <form name="site-search" method="POST" action="/enter-form-sync">
          <input id="search-input" type="search" name="q" placeholder="Search">
        </form>
      </body></html>`
        : `<!doctype html><html><body>
        <h1>Search</h1>
        <section class="search-shell">
          <div class="search-panel">
            <form name="site-search" method="POST" action="/enter-form-sync">
              <fieldset>
                <input id="search-input" type="search" name="q" placeholder="Search">
                <input type="hidden" name="layout" value="desktop">
              </fieldset>
            </form>
          </div>
        </section>
      </body></html>`
    )
    return
  }

  if (pathname === '/enter-form-sync' && req.method === 'POST') {
    sendHtml(
      res,
      `<!doctype html><html><body>
        <div id="enter-form-result" data-user-agent="${ua.replace(/"/g, '&quot;')}">${ua}</div>
      </body></html>`
    )
    return
  }

  if (pathname === '/touch-probe') {
    sendHtml(
      res,
      `<!doctype html><html><head><style>
        #touch-target {
          display: block;
          width: 12rem;
          height: 3rem;
          margin: 2rem;
          font: 16px system-ui;
        }
      </style></head><body>
        <button id="touch-target" type="button">Tap me</button>
        <div id="touch-result" data-events=""></div>
        <script>
          (function () {
            const target = document.getElementById('touch-target');
            const result = document.getElementById('touch-result');
            const events = [];
            function record(type) {
              events.push(type);
              result.dataset.events = events.join(',');
            }
            target.addEventListener('touchstart', function () { record('touchstart'); }, { passive: true });
            target.addEventListener('click', function () { record('click'); });
          })();
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/semantic-click') {
    sendHtml(
      res,
      `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin: 0; font: 16px system-ui; }
        main { position: relative; min-height: 520px; }
        button, a { position: absolute; display: inline-flex; align-items: center; justify-content: center; min-width: 9rem; min-height: 3rem; padding: 0 1rem; }
        #semantic-primary { left: 20px; top: 24px; }
        #semantic-link { left: 20px; top: 104px; }
        #coordinate-trap { left: 260px; top: 280px; }
        @media (min-width: 700px) {
          #semantic-primary { left: 720px; top: 310px; }
          #semantic-link { left: 920px; top: 170px; }
          #coordinate-trap { left: 72px; top: 32px; }
        }
      </style></head><body>
        <main>
          <button id="semantic-primary" type="button"><span>Open menu</span></button>
          <a id="semantic-link" href="/semantic-destination">Continue</a>
          <button id="coordinate-trap" type="button">Wrong target</button>
          <div id="semantic-result"
            data-primary-count="0"
            data-trap-count="0"
            data-touch-count="0"
            data-last-trusted=""
            data-active-element=""></div>
        </main>
        <script>
          (function () {
            const primary = document.getElementById('semantic-primary');
            const trap = document.getElementById('coordinate-trap');
            const result = document.getElementById('semantic-result');

            primary.addEventListener('touchstart', function () {
              result.dataset.touchCount = String(Number(result.dataset.touchCount || '0') + 1);
            }, { passive: true });

            primary.addEventListener('click', function (event) {
              result.dataset.primaryCount = String(Number(result.dataset.primaryCount || '0') + 1);
              result.dataset.lastTrusted = String(event.isTrusted);
              requestAnimationFrame(function () {
                result.dataset.activeElement = document.activeElement ? document.activeElement.id : '';
              });
            });

            trap.addEventListener('click', function () {
              result.dataset.trapCount = String(Number(result.dataset.trapCount || '0') + 1);
            });
          })();
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/semantic-destination') {
    sendHtml(
      res,
      `<!doctype html><html><body><h1 id="semantic-destination">Semantic destination</h1></body></html>`
    )
    return
  }

  if (pathname === '/responsive-nav') {
    const mobile = isMobileUa(ua)
    if (mobile) {
      sendHtml(
        res,
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>
          <button id="hamburger-btn" aria-label="Open menu" type="button">&#9776;</button>
          <nav id="mobile-drawer" hidden>
            <a href="#">Home</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </nav>
          <div id="nav-result" data-hamburger-count="0"></div>
          <script>
            (function () {
              var btn = document.getElementById('hamburger-btn');
              var drawer = document.getElementById('mobile-drawer');
              var result = document.getElementById('nav-result');
              btn.addEventListener('click', function () {
                drawer.hidden = !drawer.hidden;
                result.dataset.hamburgerCount = String(Number(result.dataset.hamburgerCount || '0') + 1);
              });
            })();
          </script>
        </body></html>`
      )
    } else {
      sendHtml(
        res,
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>
          <nav id="desktop-nav">
            <a href="#">Home</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </nav>
          <div id="nav-result" data-hamburger-count="0"></div>
        </body></html>`
      )
    }
    return
  }

  if (pathname === '/duplicate-buttons') {
    sendHtml(
      res,
      `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin: 0; font: 16px system-ui; }
        #grid { display: flex; gap: 1rem; padding: 2rem; }
        .add-btn { padding: 0.5rem 1rem; min-height: 2.5rem; cursor: pointer; }
      </style></head><body>
        <div id="grid">
          <button class="add-btn" type="button">Add to cart</button>
          <button class="add-btn" type="button">Add to cart</button>
          <button class="add-btn" type="button">Add to cart</button>
        </div>
        <div id="result" data-clicked-index="-1"></div>
        <script>
          (function () {
            var buttons = document.querySelectorAll('.add-btn');
            var result = document.getElementById('result');
            buttons.forEach(function (btn, index) {
              btn.addEventListener('click', function () {
                result.dataset.clickedIndex = String(index);
              });
            });
          })();
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/below-fold-button') {
    sendHtml(
      res,
      `<!doctype html><html><head><style>
        body { margin: 0; height: 3000px; }
        #top-indicator { position: fixed; top: 10px; left: 10px; }
        #below-fold-btn { position: absolute; top: 2000px; left: 50px; }
        #result { position: fixed; bottom: 10px; left: 10px; }
      </style></head><body>
        <div id="top-indicator">top</div>
        <button id="below-fold-btn">Below fold</button>
        <div id="result" data-clicked="false">not clicked</div>
        <script>
          document.getElementById('below-fold-btn').addEventListener('click', function() {
            document.getElementById('result').dataset.clicked = 'true';
            document.getElementById('result').textContent = 'clicked';
          });
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/occluded-button') {
    sendHtml(
      res,
      `<!doctype html><html><head><style>
        body { margin: 0; }
        #overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; }
        #btn { position: relative; z-index: 1; margin: 20px; padding: 10px 20px; }
        #result { margin: 20px; }
      </style></head><body>
        <button id="btn">Under overlay</button>
        <div id="overlay"></div>
        <div id="result" data-clicked="false"></div>
        <script>
          document.getElementById('btn').addEventListener('click', function() {
            document.getElementById('result').dataset.clicked = 'true';
          });
        </script>
      </body></html>`
    )
    return
  }

  if (pathname === '/form-sync') {
    const mobile = isMobileUa(ua)
    sendHtml(
      res,
      `<!doctype html><html><head></head><body>
  <form id="test-form">
    <input id="text-field" type="text" name="username" placeholder="Username">
    <textarea id="textarea-field" name="bio" placeholder="Bio"></textarea>
    <input id="email-field" type="email" name="email" placeholder="Email">
    <select id="country-select" name="country">
      <option value="br">Brazil</option>
      <option value="us">United States</option>
      <option value="jp">Japan</option>
    </select>
    <select id="index-fallback-select" name="city">
      <option value="rio-mobile">Rio</option>
      <option value="ny-mobile">New York</option>
      <option value="tokyo-mobile">Tokyo</option>
    </select>
    <label><input id="newsletter-checkbox" type="checkbox" name="newsletter"> Newsletter</label>
    <label><input id="plan-basic" type="radio" name="plan" value="basic"> Basic</label>
    <label><input id="plan-pro" type="radio" name="plan" value="pro"> Pro</label>
    <button id="enter-submit" type="submit">Submit</button>
    <div
      id="form-result"
      data-text-value=""
      data-textarea-value=""
      data-email-value=""
      data-country-value="br"
      data-city-value="rio-mobile"
      data-checkbox-checked="false"
      data-radio-value=""
      data-submit-count="0"></div>
  </form>
  <input id="react-like-field" type="text" name="react-field">
  <div id="react-result" data-value=""></div>
  <section id="duplicate-controls">
    <div id="duplicate-inputs">
      ${
        mobile
          ? `<div class="dup-row"><input class="dup-text-input" type="text" name="shared-text"></div>
      <div class="dup-row"><input class="dup-text-input" type="text" name="shared-text"></div>`
          : `<div class="dup-stack">
        <div class="dup-row"><span>desktop</span><input class="dup-text-input" type="text" name="shared-text"></div>
      </div>
      <div class="dup-stack">
        <div class="dup-row"><span>desktop</span><input class="dup-text-input" type="text" name="shared-text"></div>
      </div>`
      }
    </div>
    <div id="duplicate-selects">
      ${
        mobile
          ? `<div class="dup-row">
        <select class="dup-select" name="shared-select">
          <option value="br">Brazil</option>
          <option value="us">United States</option>
          <option value="jp">Japan</option>
        </select>
      </div>
      <div class="dup-row">
        <select class="dup-select" name="shared-select">
          <option value="br">Brazil</option>
          <option value="us">United States</option>
          <option value="jp">Japan</option>
        </select>
      </div>`
          : `<div class="dup-stack">
        <div class="dup-row"><span>desktop</span>
          <select class="dup-select" name="shared-select">
            <option value="br">Brazil</option>
            <option value="us">United States</option>
            <option value="jp">Japan</option>
          </select>
        </div>
      </div>
      <div class="dup-stack">
        <div class="dup-row"><span>desktop</span>
          <select class="dup-select" name="shared-select">
            <option value="br">Brazil</option>
            <option value="us">United States</option>
            <option value="jp">Japan</option>
          </select>
        </div>
      </div>`
      }
    </div>
    <div id="duplicate-forms">
      ${
        mobile
          ? `<form class="dup-submit-form" data-testid="dup-submit-form-0">
        <input class="dup-submit-input" type="text" name="shared-submit" value="alpha">
        <button type="submit">Save draft</button>
      </form>
      <form class="dup-submit-form" data-testid="dup-submit-form-1">
        <input class="dup-submit-input" type="text" name="shared-submit" value="beta">
        <button type="submit">Save draft</button>
      </form>`
          : `<div class="dup-stack">
        <form class="dup-submit-form" data-testid="dup-submit-form-0">
          <div class="dup-row"><span>desktop</span><input class="dup-submit-input" type="text" name="shared-submit" value="alpha"></div>
          <button type="submit">Save draft</button>
        </form>
      </div>
      <div class="dup-stack">
        <form class="dup-submit-form" data-testid="dup-submit-form-1">
          <div class="dup-row"><span>desktop</span><input class="dup-submit-input" type="text" name="shared-submit" value="beta"></div>
          <button type="submit">Save draft</button>
        </form>
      </div>`
      }
    </div>
    <div id="duplicate-toggles">
      ${
        mobile
          ? `<div class="dup-row">
        <label><input class="dup-toggle-checkbox" type="checkbox" name="shared-checkbox"> Shared checkbox</label>
        <label><input class="dup-toggle-radio" type="radio" name="shared-radio" value="alpha"> Alpha</label>
      </div>
      <div class="dup-row">
        <label><input class="dup-toggle-checkbox" type="checkbox" name="shared-checkbox"> Shared checkbox</label>
        <label><input class="dup-toggle-radio" type="radio" name="shared-radio" value="beta"> Beta</label>
      </div>`
          : `<div class="dup-stack">
        <div class="dup-row"><span>desktop</span>
          <label><input class="dup-toggle-checkbox" type="checkbox" name="shared-checkbox"> Shared checkbox</label>
          <label><input class="dup-toggle-radio" type="radio" name="shared-radio" value="alpha"> Alpha</label>
        </div>
      </div>
      <div class="dup-stack">
        <div class="dup-row"><span>desktop</span>
          <label><input class="dup-toggle-checkbox" type="checkbox" name="shared-checkbox"> Shared checkbox</label>
          <label><input class="dup-toggle-radio" type="radio" name="shared-radio" value="beta"> Beta</label>
        </div>
      </div>`
      }
    </div>
  </section>
  <div
    id="duplicate-result"
    data-second-text=""
    data-second-select="br"
    data-second-checkbox="false"
    data-second-radio=""
    data-submit-index="-1"
    data-submit-values=""></div>
  <script>
    var result = document.getElementById('form-result');
    var duplicateResult = document.getElementById('duplicate-result');
    document.getElementById('text-field').addEventListener('input', function(e) {
      result.dataset.textValue = e.target.value;
    });
    document.getElementById('textarea-field').addEventListener('input', function(e) {
      result.dataset.textareaValue = e.target.value;
    });
    document.getElementById('email-field').addEventListener('input', function(e) {
      result.dataset.emailValue = e.target.value;
    });
    document.getElementById('country-select').addEventListener('change', function(e) {
      result.dataset.countryValue = e.target.value;
    });
    document.getElementById('index-fallback-select').addEventListener('change', function(e) {
      result.dataset.cityValue = e.target.value;
    });
    document.getElementById('newsletter-checkbox').addEventListener('change', function(e) {
      result.dataset.checkboxChecked = String(e.target.checked);
    });
    document.getElementById('plan-basic').addEventListener('change', function(e) {
      if (e.target.checked) result.dataset.radioValue = e.target.value;
    });
    document.getElementById('plan-pro').addEventListener('change', function(e) {
      if (e.target.checked) result.dataset.radioValue = e.target.value;
    });
    document.getElementById('test-form').addEventListener('submit', function(e) {
      e.preventDefault();
      result.dataset.submitCount = String(Number(result.dataset.submitCount || '0') + 1);
    });

    // Simulates React controlled input: listens to native input events via the setter override
    var reactField = document.getElementById('react-like-field');
    var reactResult = document.getElementById('react-result');

    // Override value setter to simulate React's synthetic event handling
    var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(reactField, 'value', {
      get: function() { return proto.get.call(this); },
      set: function(v) {
        proto.set.call(this, v);
        reactResult.dataset.value = v;
      }
    });

    reactField.addEventListener('input', function(e) {
      reactResult.dataset.value = e.target.value;
    });

    document.querySelectorAll('.dup-text-input').forEach(function(input, index) {
      input.addEventListener('input', function(e) {
        if (index === 1) {
          duplicateResult.dataset.secondText = e.target.value;
        }
      });
    });

    document.querySelectorAll('.dup-select').forEach(function(select, index) {
      select.addEventListener('change', function(e) {
        if (index === 1) {
          duplicateResult.dataset.secondSelect = e.target.value;
        }
      });
    });

    document.querySelectorAll('.dup-toggle-checkbox').forEach(function(input, index) {
      input.addEventListener('change', function(e) {
        if (index === 1) {
          duplicateResult.dataset.secondCheckbox = String(e.target.checked);
        }
      });
    });

    document.querySelectorAll('.dup-toggle-radio').forEach(function(input, index) {
      input.addEventListener('change', function(e) {
        if (index === 1 && e.target.checked) {
          duplicateResult.dataset.secondRadio = e.target.value;
        }
      });
    });

    document.querySelectorAll('.dup-submit-form').forEach(function(form, index) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        duplicateResult.dataset.submitIndex = String(index);
        duplicateResult.dataset.submitValues = Array.from(
          document.querySelectorAll('.dup-submit-input')
        ).map(function(input) {
          return input.value;
        }).join('|');
      });
    });

    if (navigator.userAgent.includes('Macintosh')) {
      document.getElementById('index-fallback-select').options[0].value = 'rio-desktop';
      document.getElementById('index-fallback-select').options[1].value = 'ny-desktop';
      document.getElementById('index-fallback-select').options[2].value = 'tokyo-desktop';
      result.dataset.cityValue = 'rio-desktop';
    }
  </script>
</body></html>`
    )
    return
  }

  if (pathname === '/seo/with-title') {
    sendHtml(
      res,
      `<!doctype html><html><head><title>Fixture SEO Page</title></head><body>
        <h1 id="seo-with-title">Has a title</h1>
      </body></html>`
    )
    return
  }

  if (pathname === '/seo/no-title') {
    sendHtml(
      res,
      `<!doctype html><html><head></head><body>
        <h1 id="seo-no-title">No title element</h1>
      </body></html>`
    )
    return
  }

  // Delivered <title> differs from the title after client-side rendering, so an
  // audit's delivered-vs-rendered check should warn.
  if (pathname === '/seo/hydrated-title') {
    sendHtml(
      res,
      `<!doctype html><html><head><title>Delivered Title</title></head><body>
        <h1 id="seo-hydrated-title">Hydrated</h1>
        <script>document.title = 'Rendered Title';</script>
      </body></html>`
    )
    return
  }

  if (pathname === '/seo/empty-title') {
    sendHtml(
      res,
      `<!doctype html><html><head><title></title></head><body>
        <h1 id="seo-empty-title">Empty title element</h1>
      </body></html>`
    )
    return
  }

  res.writeHead(404)
  res.end('Not found')
}

export function startFixtureServer(
  port = DEFAULT_PORT
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer(handleRequest)
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const resolvedPort = typeof address === 'object' && address ? address.port : port
      resolvePromise({
        port: resolvedPort,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => (error ? rejectClose(error) : resolveClose()))
          })
      })
    })
  })
}

export async function main(): Promise<void> {
  const { port } = await startFixtureServer()
  console.log(`Fixture server listening on http://127.0.0.1:${port}`)
}
