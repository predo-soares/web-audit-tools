import { useState } from 'react'
import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import { CANVAS_GLASS_SURFACE_CLASS } from '@renderer/lib/glass-surface'
import { cn } from '@renderer/lib/utils'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { MotionTabs, type MotionTabItem } from '@renderer/components/ui/motion-tabs'
import { useSeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { AuditControls } from './audit-controls'
import { DocumentStructureSection } from './sections/document-structure-section'
import { FindingsSection } from './sections/findings-section'
import { ImagesMediaSection } from './sections/images-media-section'
import { InternationalizationSection } from './sections/internationalization-section'
import { LinkInventorySection } from './sections/link-inventory-section'
import { MetadataDetails } from './sections/metadata-details'
import { SearchPreview } from './sections/search-preview'
import { SocialPreviews } from './sections/social-previews'
import { StructuredDataSection } from './sections/structured-data-section'

type SeoTab = 'findings' | 'preview' | 'structure' | 'links' | 'media' | 'i18n'

const SEO_TABS: Array<MotionTabItem<SeoTab>> = [
  { value: 'findings', label: 'Findings', testId: 'seo-tab-findings' },
  { value: 'preview', label: 'Search & Social', testId: 'seo-tab-preview' },
  { value: 'structure', label: 'Structure', testId: 'seo-tab-structure' },
  { value: 'links', label: 'Links', testId: 'seo-tab-links' },
  { value: 'media', label: 'Images & Media', testId: 'seo-tab-media' },
  { value: 'i18n', label: 'International', testId: 'seo-tab-i18n' }
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SeoView({ onClose: _onClose }: { onClose: () => void }): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [tab, setTab] = useState<SeoTab>('findings')
  const presentation = useSeoAuditPresentation(window.api)
  const {
    auditable,
    result,
    linkFilter,
    setLinkFilter,
    findingCategory,
    setFindingCategory,
    findingOutcome,
    setFindingOutcome,
    copyMarkdown
  } = presentation

  return (
    <TooltipProvider delay={200}>
      <div
        data-testid="seo-view"
        className={cn(
          'absolute inset-0 z-10 box-border overflow-y-auto text-foreground',
          CANVAS_GLASS_SURFACE_CLASS
        )}
        style={{ paddingTop: TOOLBAR_HEIGHT_PX, paddingLeft: sidebarOffset }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-8 py-8">
          <header>
            <h1 className="text-lg font-semibold tracking-tight text-white">Page SEO audit</h1>
            <p className="mt-1 text-xs text-white/45">
              Check discoverability, metadata, and structured data for the current page.
            </p>
          </header>
          {!auditable ? (
            <p
              data-testid="seo-view-empty"
              className="rounded-xl border border-white/10 bg-black/40 px-6 py-16 text-center text-sm text-white/55 backdrop-blur-md"
            >
              Nothing to audit yet — load a page in the browser view, then come back to run an
              audit.
            </p>
          ) : (
            <>
              <AuditControls
                url={presentation.url}
                pageTitle={presentation.pageTitle}
                intent={presentation.intent}
                running={presentation.running}
                job={presentation.job}
                result={result}
                copied={presentation.copied}
                exportStatus={presentation.exportStatus}
                handleIntentChange={presentation.handleIntentChange}
                handleRun={presentation.handleRun}
                handleCancel={presentation.handleCancel}
                copyMarkdown={copyMarkdown}
                exportWithSnapshot={presentation.exportWithSnapshot}
              />

              {!result ? (
                <p className="rounded-xl border border-white/10 bg-black/40 px-6 py-16 text-center text-sm text-white/55 backdrop-blur-md">
                  Run an audit to see results.
                </p>
              ) : (
                <>
                  <MotionTabs
                    items={SEO_TABS}
                    value={tab}
                    onChange={setTab}
                    layoutId="seo-tab-indicator"
                    ariaLabel="SEO report sections"
                  />
                  <div
                    role="tabpanel"
                    data-testid={`seo-tabpanel-${tab}`}
                    className="flex flex-col gap-5"
                  >
                    {tab === 'findings' ? (
                      <FindingsSection
                        result={result}
                        findingCategory={findingCategory}
                        findingOutcome={findingOutcome}
                        setFindingCategory={setFindingCategory}
                        setFindingOutcome={setFindingOutcome}
                        copyMarkdown={copyMarkdown}
                      />
                    ) : null}

                    {tab === 'preview' ? (
                      <>
                        <SearchPreview result={result} />
                        <SocialPreviews result={result} />
                      </>
                    ) : null}

                    {tab === 'structure' ? (
                      <>
                        <DocumentStructureSection result={result} />
                        <StructuredDataSection result={result} />
                        <MetadataDetails result={result} />
                      </>
                    ) : null}

                    {tab === 'links' ? (
                      <LinkInventorySection
                        result={result}
                        linkFilter={linkFilter}
                        setLinkFilter={setLinkFilter}
                      />
                    ) : null}

                    {tab === 'media' ? <ImagesMediaSection result={result} /> : null}

                    {tab === 'i18n' ? <InternationalizationSection result={result} /> : null}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
