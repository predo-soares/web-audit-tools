import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { SafariChromeStripState } from '../../../shared/safari-chrome'

function displayHost(url: string): string {
  if (!url || url === 'about:blank') return 'Search or enter website name'
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '') || parsed.href
  } catch {
    return url
  }
}

function DesktopTopChrome({ state }: { state: SafariChromeStripState }): React.JSX.Element {
  const host = displayHost(state.url)
  return (
    <div
      data-testid="safari-chrome-top"
      data-pane="desktop"
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        boxSizing: 'border-box',
        background: 'rgba(246, 246, 246, 0.96)',
        borderBottom: '0.5px solid rgba(0,0,0,0.12)',
        color: '#1d1d1f',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
      }}
    >
      <div style={{ display: 'flex', gap: 14, color: '#007aff', fontSize: 18, paddingLeft: 4 }}>
        <span aria-hidden>‹</span>
        <span aria-hidden style={{ opacity: 0.35 }}>
          ›
        </span>
      </div>
      <div
        style={{
          flex: 1,
          height: 28,
          borderRadius: 6,
          background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 10px',
          fontSize: 13,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}
        data-testid="safari-chrome-url"
      >
        {host}
      </div>
      <div style={{ display: 'flex', gap: 12, color: '#007aff', fontSize: 14, paddingRight: 4 }}>
        <span aria-hidden>↗</span>
        <span aria-hidden>+</span>
      </div>
    </div>
  )
}

function TopChrome({ state }: { state: SafariChromeStripState }): React.JSX.Element {
  if (state.paneId === 'desktop') {
    return <DesktopTopChrome state={state} />
  }

  const host = displayHost(state.url)
  const isIphone = state.paneId === 'iphone'
  const statusHeight = state.compact ? '100%' : isIphone ? 54 : 24

  return (
    <div
      data-testid="safari-chrome-top"
      data-pane={state.paneId}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(242, 242, 247, 0.94)',
        color: '#000',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        boxSizing: 'border-box',
        borderBottom: '0.5px solid rgba(0,0,0,0.12)'
      }}
    >
      <div
        style={{
          height: statusHeight,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: isIphone ? '0 18px 8px' : '0 24px 4px',
          fontSize: isIphone ? 15 : 12,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        <span>9:41</span>
        {isIphone ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 10,
              transform: 'translateX(-50%)',
              width: 110,
              height: 32,
              borderRadius: 20,
              background: '#000'
            }}
          />
        ) : null}
        <span style={{ fontSize: isIphone ? 13 : 11, fontWeight: 500 }}>■■■ 100%</span>
      </div>
      {!state.compact ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: isIphone ? '0 12px 10px' : '0 16px 8px',
            minHeight: 0
          }}
        >
          <div
            style={{
              flex: 1,
              height: isIphone ? 36 : 34,
              borderRadius: isIphone ? 12 : 10,
              background: 'rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              fontSize: 15,
              fontWeight: 500,
              color: '#000',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}
            data-testid="safari-chrome-url"
          >
            {host}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function BottomChrome({ state }: { state: SafariChromeStripState }): React.JSX.Element {
  const isIphone = state.paneId === 'iphone'
  return (
    <div
      data-testid="safari-chrome-bottom"
      data-pane={state.paneId}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        background: 'rgba(242, 242, 247, 0.94)',
        color: '#007aff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        borderTop: '0.5px solid rgba(0,0,0,0.12)',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          height: isIphone ? 44 : 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: isIphone ? '0 8px' : '0 48px',
          fontSize: 22,
          fontWeight: 300
        }}
      >
        <span aria-hidden>‹</span>
        <span aria-hidden>›</span>
        <span aria-hidden style={{ fontSize: 18 }}>
          ↗
        </span>
        <span aria-hidden style={{ fontSize: 16 }}>
          □
        </span>
        <span aria-hidden style={{ fontSize: 18 }}>
          +
        </span>
      </div>
      {isIphone ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 8
          }}
        >
          <div
            style={{
              width: 128,
              height: 5,
              borderRadius: 3,
              background: '#000'
            }}
          />
        </div>
      ) : null}
      <span style={{ display: 'none' }}>{state.url}</span>
    </div>
  )
}

function SafariChromeApp(): React.JSX.Element | null {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const strip = (params.get('strip') === 'bottom' ? 'bottom' : 'top') as 'top' | 'bottom'
  const [state, setState] = useState<SafariChromeStripState | null>(null)

  useEffect(() => {
    return window.safariChromeApi.onState((next) => {
      if (next.strip !== strip) return
      setState(next)
    })
  }, [strip])

  if (!state?.visible) {
    return <div style={{ width: '100%', height: '100%', background: 'transparent' }} />
  }

  if (strip === 'bottom' && state.paneId === 'desktop') {
    return <div style={{ width: '100%', height: '100%', background: 'transparent' }} />
  }

  return strip === 'top' ? <TopChrome state={state} /> : <BottomChrome state={state} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafariChromeApp />
  </StrictMode>
)
