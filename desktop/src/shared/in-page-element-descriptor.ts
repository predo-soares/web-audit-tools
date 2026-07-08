import type { ElementDescriptor } from './element-fingerprint'

export const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export const VALUE_SYNC_SELECTOR = 'input:not([type="hidden"]),textarea,select'

export function getVisibleTextInPage(
  element: Element,
  normalizeText: (text: string | null | undefined) => string
): string {
  if (element instanceof HTMLInputElement) {
    if (['button', 'submit', 'reset'].includes(element.type)) {
      return normalizeText(element.value)
    }
    return ''
  }

  return normalizeText(element instanceof HTMLElement ? element.innerText : element.textContent)
}

export function getStructuralPathInPage(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== document.body) {
    const parent = current.parentElement
    if (parent) {
      const index = Array.from(parent.children).indexOf(current) + 1
      parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
    } else {
      parts.unshift(current.tagName.toLowerCase())
    }
    current = parent
  }
  return parts.join(' > ')
}

export function getInputGroupMatchIndexInPage(element: HTMLInputElement): number | null {
  if (!['checkbox', 'radio'].includes(element.type)) return null
  if (!element.name) return null

  const matches = Array.from(document.querySelectorAll('input')).filter(
    (candidate): candidate is HTMLInputElement =>
      candidate instanceof HTMLInputElement &&
      !candidate.disabled &&
      candidate.type === element.type &&
      candidate.name === element.name
  )

  if (matches.length <= 1) return null
  const index = matches.indexOf(element)
  return index >= 0 ? index : null
}

export function getDescriptorTestIdInPage(element: Element, isFormField: boolean): string | null {
  const explicitTestId = element.getAttribute('data-testid')
  if (explicitTestId) return explicitTestId
  if (!isFormField) return null

  if (element instanceof HTMLInputElement) {
    if ((element.type === 'checkbox' || element.type === 'radio') && element.name) {
      const groupIndex = getInputGroupMatchIndexInPage(element)
      if (groupIndex !== null) {
        return `${element.type}:${element.name}:${groupIndex}`
      }
    }

    return element.name || null
  }

  return element.getAttribute('name') || null
}

export function describeElementInPage(
  element: Element,
  normalizeText: (text: string | null | undefined) => string
): ElementDescriptor {
  const tagName = element.tagName.toLowerCase()
  const isFormField =
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement

  return {
    tagName,
    id: element.id || null,
    visibleText: getVisibleTextInPage(element, normalizeText),
    testId: getDescriptorTestIdInPage(element, isFormField),
    ariaLabel: element.getAttribute('aria-label') || null,
    role: element.getAttribute('role') || null,
    structuralPath: getStructuralPathInPage(element)
  }
}
