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
    sendHtml(res, '<!doctype html><html><body><h1 id="fixture-home">Fixture Home</h1></body></html>')
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
    res.end(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))
    return
  }

  if (pathname === '/assets/image-2x.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(Buffer.from('89504e470d0a1a0a0000000d49484452000000020000000208060000001f15c489', 'hex'))
    return
  }

  if (pathname === '/assets/image-3x.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(Buffer.from('89504e470d0a1a0a0000000d49484452000000030000000308060000001f15c489', 'hex'))
    return
  }

  if (pathname === '/long-scroll') {
    const sections = Array.from({ length: 40 }, (_, index) => `<section id="section-${index}">Section ${index}</section>`).join('')
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
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
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

  res.writeHead(404)
  res.end('Not found')
}

export function startFixtureServer(port = DEFAULT_PORT): Promise<{ port: number; close: () => Promise<void> }> {
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
