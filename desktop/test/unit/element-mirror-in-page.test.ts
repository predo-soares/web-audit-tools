// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createElementMirror, type ElementMirror } from '../../src/shared/element-mirror'

const mirror = createElementMirror()

function setBody(html: string): void {
  document.body.innerHTML = html
}

function interactiveElements(): Element[] {
  return Array.from(document.querySelectorAll(mirror.interactiveSelector)).filter(
    (el) => el instanceof HTMLElement && !(el as HTMLInputElement).disabled
  )
}

describe('element mirror in-page interface', () => {
  it('builds a fingerprint on a source DOM and resolves it on a restructured target DOM', () => {
    setBody(`
      <nav><a href="/pricing" id="nav-pricing">Pricing</a></nav>
      <main><button>Get started</button></main>
    `)
    const source = document.querySelector('#nav-pricing')!
    const fingerprint = mirror.buildFingerprint(source, interactiveElements())
    expect(fingerprint).not.toBeNull()

    // Target breakpoint: same link, different structure, no id
    setBody(`
      <div class="drawer">
        <a href="/pricing">Pricing</a>
        <button>Get started</button>
      </div>
    `)
    const match = mirror.resolveFingerprint(fingerprint!, interactiveElements())
    expect(match.element).not.toBeNull()
    expect(match.element!.getAttribute('href')).toBe('/pricing')
  })

  it('disambiguates identical candidates by index-among-matches on the click path', () => {
    setBody(`
      <button class="add">Add to cart</button>
      <button class="add">Add to cart</button>
      <button class="add">Add to cart</button>
    `)
    const second = document.querySelectorAll('button')[1]
    const fingerprint = mirror.buildFingerprint(second, interactiveElements(), {
      disambiguateAcrossLayers: true
    })
    expect(fingerprint?.indexAmongMatches).toBe(1)

    const match = mirror.resolveFingerprint(fingerprint!, interactiveElements())
    expect(match.element).toBe(document.querySelectorAll('button')[1])
  })

  it('reports ambiguity as a strict no-match when no index is recorded', () => {
    setBody(`
      <button>Add to cart</button>
      <button>Add to cart</button>
    `)
    const fingerprint = {
      layers: [{ type: 'text-tag' as const, tagName: 'button', text: 'Add to cart' }]
    }
    const match = mirror.resolveFingerprint(fingerprint, interactiveElements())
    expect(match.element).toBeNull()
    expect(match.failureReason).toBe('ambiguous')
  })

  it('builds and resolves a form fingerprint by name across restructured markup', () => {
    setBody(`
      <form name="site-search" method="POST" action="/search">
        <input type="search" name="q" placeholder="Search">
      </form>
    `)
    const form = document.querySelector('form')!
    const fingerprint = mirror.buildFingerprint(form, Array.from(document.querySelectorAll('form')))
    expect(fingerprint).not.toBeNull()
    expect(fingerprint!.layers).toContainEqual({ type: 'testid', testId: 'site-search' })

    setBody(`
      <section class="search-shell">
        <div class="search-panel">
          <form name="site-search" method="POST" action="/search">
            <fieldset>
              <input type="search" name="q" placeholder="Search">
              <input type="hidden" name="layout" value="desktop">
            </fieldset>
          </form>
        </div>
      </section>
    `)

    const match = mirror.resolveFingerprint(fingerprint!, Array.from(document.querySelectorAll('form')))
    expect(match.element).not.toBeNull()
    expect((match.element as HTMLFormElement).getAttribute('name')).toBe('site-search')
  })

  it('describes checkbox groups with a stable per-group test id', () => {
    setBody(`
      <input type="checkbox" name="topping" value="a" />
      <input type="checkbox" name="topping" value="b" />
    `)
    const second = document.querySelectorAll('input')[1] as HTMLInputElement
    expect(mirror.getInputGroupMatchIndex(second)).toBe(1)
    expect(mirror.describeElement(second).testId).toBe('checkbox:topping:1')
  })
})

describe('element mirror injection safety', () => {
  // The engine serializes the factory with toString() and re-evaluates it
  // inside target panes. This re-evaluation must produce a working mirror,
  // which fails loudly here if the factory ever references module scope.
  it('re-evaluating createElementMirror.toString() yields a working mirror', () => {
    const injected = new Function(`return (${createElementMirror.toString()})()`)() as ElementMirror

    setBody(`
      <a href="/docs">Docs</a>
      <button id="save-button">Save</button>
    `)
    const target = document.querySelector('#save-button')!
    const fingerprint = injected.buildFingerprint(
      target,
      Array.from(document.querySelectorAll(injected.interactiveSelector))
    )
    expect(fingerprint).not.toBeNull()

    const match = injected.resolveFingerprint(
      fingerprint!,
      Array.from(document.querySelectorAll(injected.interactiveSelector))
    )
    expect(match.element).toBe(target)
    expect(injected.isMachineGeneratedId(':r1:')).toBe(true)
  })
})

describe('clickable ancestor (ADR 0005 amendment)', () => {
  it('treats dialog/backdrop and onclick elements as clickable, plain divs as not', () => {
    setBody(`
      <div id="plain"></div>
      <div id="dialog" role="dialog"></div>
      <div id="modal" aria-modal="true"></div>
      <div id="inline" onclick="void 0"></div>
      <button id="btn">Ok</button>
    `)
    expect(mirror.isClickable(document.querySelector('#plain')!)).toBe(false)
    expect(mirror.isClickable(document.querySelector('#dialog')!)).toBe(true)
    expect(mirror.isClickable(document.querySelector('#modal')!)).toBe(true)
    expect(mirror.isClickable(document.querySelector('#inline')!)).toBe(true)
    expect(mirror.isClickable(document.querySelector('#btn')!)).toBe(true)
  })

  it('treats a pointer-cursor element as clickable but not its inheriting children', () => {
    setBody(`
      <div id="card" style="cursor: pointer"><span id="label">Open</span></div>
    `)
    const card = document.querySelector('#card') as HTMLElement
    // happy-dom reflects inline style through getComputedStyle
    if (getComputedStyle(card).cursor === 'pointer') {
      expect(mirror.isClickable(card)).toBe(true)
      // The child inherits the pointer cursor but must not become its own
      // candidate — only the origin element counts.
      expect(mirror.isClickable(document.querySelector('#label')!)).toBe(false)
    }
  })

  it('finds the nearest clickable ancestor when clicking inside a backdrop', () => {
    setBody(`
      <div id="backdrop" role="dialog" aria-modal="true">
        <div class="content"><p><span id="inner">x</span></p></div>
      </div>
    `)
    const ancestor = mirror.findClickableAncestor(document.querySelector('#inner'))
    expect(ancestor).toBe(document.querySelector('#backdrop'))
  })

  it('collects clickable candidates including backdrops and excluding disabled/plain', () => {
    setBody(`
      <div id="wrap">
        <div id="overlay" role="dialog">backdrop</div>
        <button id="a">A</button>
        <button id="b" disabled>B</button>
        <div id="noise">just text</div>
      </div>
    `)
    const ids = mirror
      .collectClickableCandidates()
      .map((el) => el.id)
      .filter(Boolean)
    expect(ids).toContain('overlay')
    expect(ids).toContain('a')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('noise')
    expect(ids).not.toContain('wrap')
  })

  it('mirrors a modal backdrop across a restructured target via structural path', () => {
    // Source pane: user clicks the backdrop (no id, no text of its own).
    setBody(`
      <div class="app">
        <div class="modal-root">
          <div role="dialog" aria-modal="true"><div class="panel">Body</div></div>
        </div>
      </div>
    `)
    const source = mirror.findClickableAncestor(document.querySelector('[role="dialog"] .panel'))
    expect(source).not.toBeNull()
    const fingerprint = mirror.buildFingerprint(source!, mirror.collectClickableCandidates(), {
      disambiguateAcrossLayers: true
    })
    expect(fingerprint).not.toBeNull()

    // Target pane: same backdrop, slightly different wrapper structure.
    setBody(`
      <div class="app">
        <div role="dialog" aria-modal="true"><div class="panel">Body</div></div>
      </div>
    `)
    const match = mirror.resolveFingerprint(fingerprint!, mirror.collectClickableCandidates())
    expect(match.element).not.toBeNull()
    expect(match.element!.getAttribute('role')).toBe('dialog')
  })
})
