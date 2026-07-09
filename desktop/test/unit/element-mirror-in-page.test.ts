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
