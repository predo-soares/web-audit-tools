import { describe, expect, it } from 'vitest'
import { createActivePaneTracker } from '../../src/main/active-pane-tracker'

describe('createActivePaneTracker', () => {
  describe('initial state', () => {
    it('starts with empty snapshot', () => {
      const tracker = createActivePaneTracker()
      expect(tracker.getSnapshot()).toEqual({
        activePane: null,
        barUrl: '',
        pageTitle: '',
        faviconUrl: null
      })
    })
  })

  describe('didNavigate — user-initiated', () => {
    it('updates activePane, barUrl, and clears title/favicon', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://example.com', { inPage: false, isProgrammatic: false })
      expect(tracker.getSnapshot()).toEqual({
        activePane: 'iphone',
        barUrl: 'https://example.com',
        pageTitle: '',
        faviconUrl: null
      })
    })

    it('carries forward the pane cached title and favicon until the new page updates them', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://example.com', { inPage: false, isProgrammatic: false })
      tracker.didTitleUpdate('iphone', 'Example')
      tracker.didFaviconUpdate('iphone', 'https://example.com/favicon.ico')

      tracker.didNavigate('iphone', 'https://example.com/page', { inPage: false, isProgrammatic: false })
      // The previous page's title/favicon are shown until the new page fires its own updates.
      expect(tracker.getSnapshot().pageTitle).toBe('Example')
      expect(tracker.getSnapshot().faviconUrl).toBe('https://example.com/favicon.ico')
    })

    it('ignores about:blank', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'about:blank', { inPage: false, isProgrammatic: false })
      expect(tracker.getSnapshot().activePane).toBeNull()
      expect(tracker.getSnapshot().barUrl).toBe('')
    })

    it('switches activePane when a different pane navigates', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      tracker.didNavigate('ipad', 'https://b.com', { inPage: false, isProgrammatic: false })
      expect(tracker.getSnapshot().activePane).toBe('ipad')
      expect(tracker.getSnapshot().barUrl).toBe('https://b.com')
    })
  })

  describe('didNavigate — programmatic', () => {
    it('updates paneUrl but does not change activePane or barUrl', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://user.com', { inPage: false, isProgrammatic: false })
      tracker.didNavigate('ipad', 'https://prog.com', { inPage: false, isProgrammatic: true })

      expect(tracker.getSnapshot().activePane).toBe('iphone')
      expect(tracker.getSnapshot().barUrl).toBe('https://user.com')
      expect(tracker.getPaneUrl('ipad')).toBe('https://prog.com')
    })
  })

  describe('didFocus', () => {
    it('updates activePane and barUrl to the focused pane', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      tracker.didNavigate('ipad', 'https://b.com', { inPage: false, isProgrammatic: true })

      tracker.didFocus('ipad')
      expect(tracker.getSnapshot().activePane).toBe('ipad')
      expect(tracker.getSnapshot().barUrl).toBe('https://b.com')
    })

    it('does not update barUrl when the pane has no real URL', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      tracker.didFocus('ipad') // ipad has no URL yet

      expect(tracker.getSnapshot().activePane).toBe('ipad')
      expect(tracker.getSnapshot().barUrl).toBe('https://a.com') // unchanged
    })

    it('does not update barUrl when the pane URL is about:blank', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      // Force ipad pane URL to about:blank via programmatic nav
      tracker.didNavigate('ipad', 'about:blank', { inPage: false, isProgrammatic: true })
      tracker.didFocus('ipad')

      expect(tracker.getSnapshot().barUrl).toBe('https://a.com')
    })
  })

  describe('didTitleUpdate', () => {
    it('returns true and updates pageTitle when pane is active', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      const changed = tracker.didTitleUpdate('iphone', 'Hello')
      expect(changed).toBe(true)
      expect(tracker.getSnapshot().pageTitle).toBe('Hello')
    })

    it('returns false and does not update pageTitle when pane is not active', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      const changed = tracker.didTitleUpdate('ipad', 'Other')
      expect(changed).toBe(false)
      expect(tracker.getSnapshot().pageTitle).toBe('')
    })

    it('treats the URL-matching pane as active when activePane is null', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigateAll('https://a.com')
      // activePane is null; the pane whose URL matches barUrl is "active"
      const changed = tracker.didTitleUpdate('desktop', 'Desktop Title')
      expect(changed).toBe(true)
      expect(tracker.getSnapshot().pageTitle).toBe('Desktop Title')
    })
  })

  describe('didFaviconUpdate', () => {
    it('returns true and updates faviconUrl when pane is active', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('desktop', 'https://a.com', { inPage: false, isProgrammatic: false })
      const changed = tracker.didFaviconUpdate('desktop', 'https://a.com/fav.ico')
      expect(changed).toBe(true)
      expect(tracker.getSnapshot().faviconUrl).toBe('https://a.com/fav.ico')
    })

    it('returns false when pane is not active', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://a.com', { inPage: false, isProgrammatic: false })
      const changed = tracker.didFaviconUpdate('ipad', 'https://b.com/fav.ico')
      expect(changed).toBe(false)
      expect(tracker.getSnapshot().faviconUrl).toBeNull()
    })
  })

  describe('didNavigateAll', () => {
    it('resets activePane and sets barUrl; clears titles', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://old.com', { inPage: false, isProgrammatic: false })
      tracker.didTitleUpdate('iphone', 'Old Title')

      tracker.didNavigateAll('https://new.com')
      expect(tracker.getSnapshot()).toEqual({
        activePane: null,
        barUrl: 'https://new.com',
        pageTitle: '',
        faviconUrl: null
      })
    })

    it('sets all pane URLs to the new URL', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigateAll('https://new.com')
      expect(tracker.getPaneUrl('iphone')).toBe('https://new.com')
      expect(tracker.getPaneUrl('ipad')).toBe('https://new.com')
      expect(tracker.getPaneUrl('desktop')).toBe('https://new.com')
    })
  })

  describe('getPaneUrl', () => {
    it('returns undefined for a pane with no recorded URL', () => {
      const tracker = createActivePaneTracker()
      expect(tracker.getPaneUrl('iphone')).toBeUndefined()
    })

    it('returns the last URL recorded for a pane regardless of programmatic flag', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigate('iphone', 'https://prog.com', { inPage: false, isProgrammatic: true })
      expect(tracker.getPaneUrl('iphone')).toBe('https://prog.com')
    })
  })

  describe('desktop fallback in resolveNavigationPane-equivalent logic', () => {
    it('activePane stays null after didNavigateAll until a user navigation or focus', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigateAll('https://example.com')
      expect(tracker.getSnapshot().activePane).toBeNull()
    })

    it('a user navigation after navigateAll sets activePane', () => {
      const tracker = createActivePaneTracker()
      tracker.didNavigateAll('https://example.com')
      tracker.didNavigate('ipad', 'https://next.com', { inPage: false, isProgrammatic: false })
      expect(tracker.getSnapshot().activePane).toBe('ipad')
    })
  })
})
