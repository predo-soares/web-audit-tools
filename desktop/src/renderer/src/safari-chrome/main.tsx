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

function TopChrome({ state }: { state: SafariChromeStripState }): React.JSX.Element {
  const host = displayHost(state.url)
  return (
    <div
      data-testid="safari-chrome-top"
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
          height: state.compact ? '100%' : 54,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0 18px 8px',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        <span>9:41</span>
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
        <span style={{ fontSize: 13, fontWeight: 500 }}>■■■ 100%</span>
      </div>
      {!state.compact ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px 10px',
            minHeight: 0
          }}
        >
          <div
            style={{
              flex: 1,
              height: 36,
              borderRadius: 12,
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
  return (
    <div
      data-testid="safari-chrome-bottom"
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
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px',
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

  return strip === 'top' ? <TopChrome state={state} /> : <BottomChrome state={state} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafariChromeApp />
  </StrictMode>
)
