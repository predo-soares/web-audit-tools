import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { SafariChromeState } from '../../../shared/safari-chrome'

function displayHost(url: string): string {
  if (!url || url === 'about:blank') return 'Search or enter website name'
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '') || parsed.href
  } catch {
    return url
  }
}

const glassPill: React.CSSProperties = {
  position: 'relative',
  borderRadius: 24,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(248,248,248,0.12) 40%, rgba(68,68,68,0.18) 100%)',
  boxShadow:
    '0 8px 30px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(0,0,0,0.12)',
  border: '0.5px solid rgba(255,255,255,0.35)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  overflow: 'hidden'
}

function StatusCluster(): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px 0',
        color: '#000',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        position: 'relative',
        zIndex: 2
      }}
    >
      <span style={{ width: 64, textAlign: 'center' }}>9:41</span>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 12,
          transform: 'translateX(-50%)',
          width: 125,
          height: 37,
          borderRadius: 18,
          background: '#000'
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: 78,
          justifyContent: 'flex-end'
        }}
      >
        <span style={{ fontSize: 13, letterSpacing: 1 }}>•••</span>
        <span style={{ fontSize: 12 }}>▮</span>
        <span
          style={{
            width: 25,
            height: 12,
            borderRadius: 3,
            border: '1.5px solid #000',
            position: 'relative',
            boxSizing: 'border-box'
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 2,
              borderRadius: 1,
              background: '#000'
            }}
          />
        </span>
      </div>
    </div>
  )
}

function IphoneSafariChrome({ state }: { state: SafariChromeState }): React.JSX.Element {
  const host = displayHost(state.url)
  return (
    <div
      data-testid="safari-chrome-root"
      data-pane="iphone"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
      }}
    >
      <StatusCluster />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '0 24px',
          boxSizing: 'border-box',
          opacity: state.compact ? 0.92 : 1,
          transition: 'opacity 160ms ease'
        }}
      >
        <div
          data-testid="safari-chrome-back"
          style={{
            ...glassPill,
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden>
            <path
              d="M12.2 1.2L2.1 11.1L12.2 20.9"
              stroke="#1B1B1B"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          data-testid="safari-chrome-url"
          style={{
            ...glassPill,
            flex: 1,
            maxWidth: 218,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            gap: 8,
            minWidth: 0
          }}
        >
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
            <path
              d="M1 11h10M1 6h15M1 1h15"
              stroke="#1B1B1B"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 500,
              color: '#1B1B1B',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis'
            }}
          >
            {host}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 2.2a5.8 5.8 0 1 1-4.1 1.7"
              stroke="#1B1B1B"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M3.2 2.4h3.2V5.5" stroke="#1B1B1B" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <div
          data-testid="safari-chrome-tabs"
          style={{
            ...glassPill,
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <rect
              x="1.5"
              y="3.5"
              width="11"
              height="11"
              rx="2"
              stroke="#1B1B1B"
              strokeWidth="1.6"
            />
            <path
              d="M5.5 1.5h9A2 2 0 0 1 16.5 3.5v9"
              stroke="#1B1B1B"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

function IpadSafariChrome({ state }: { state: SafariChromeState }): React.JSX.Element {
  const host = displayHost(state.url)
  return (
    <div
      data-testid="safari-chrome-root"
      data-pane="ipad"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 18,
          height: 48,
          ...glassPill,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 14
        }}
      >
        <span style={{ color: '#007aff', fontSize: 20 }}>‹</span>
        <span style={{ color: '#007aff', fontSize: 20, opacity: 0.35 }}>›</span>
        <div
          data-testid="safari-chrome-url"
          style={{
            flex: 1,
            height: 32,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 500,
            color: '#1B1B1B',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 12px'
          }}
        >
          {host}
        </div>
        <span style={{ color: '#007aff', fontSize: 16 }}>□</span>
      </div>
    </div>
  )
}

function DesktopSafariChrome({ state }: { state: SafariChromeState }): React.JSX.Element {
  const host = displayHost(state.url)
  return (
    <div
      data-testid="safari-chrome-root"
      data-pane="desktop"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        pointerEvents: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          boxSizing: 'border-box',
          background: 'rgba(246, 246, 246, 0.92)',
          borderBottom: '0.5px solid rgba(0,0,0,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div style={{ display: 'flex', gap: 14, color: '#007aff', fontSize: 18, paddingLeft: 4 }}>
          <span>‹</span>
          <span style={{ opacity: 0.35 }}>›</span>
        </div>
        <div
          data-testid="safari-chrome-url"
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
        >
          {host}
        </div>
        <div style={{ display: 'flex', gap: 12, color: '#007aff', fontSize: 14, paddingRight: 4 }}>
          <span>↗</span>
          <span>+</span>
        </div>
      </div>
    </div>
  )
}

function SafariChromeApp(): React.JSX.Element {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const paneId = params.get('pane') ?? 'iphone'
  const [state, setState] = useState<SafariChromeState | null>(null)

  useEffect(() => {
    return window.safariChromeApi.onState((next) => {
      if (next.paneId !== paneId) return
      setState(next)
    })
  }, [paneId])

  if (!state?.visible) {
    return <div style={{ width: '100%', height: '100%', background: 'transparent' }} />
  }

  if (state.paneId === 'desktop') return <DesktopSafariChrome state={state} />
  if (state.paneId === 'ipad') return <IpadSafariChrome state={state} />
  return <IphoneSafariChrome state={state} />
}

export { SafariChromeApp }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafariChromeApp />
  </StrictMode>
)
