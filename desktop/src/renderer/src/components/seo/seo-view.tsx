import { useState } from 'react'
import { SIDEBAR_WIDTH_PX } from '../../../../shared/sidebar'
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

export function SeoView({
  onTargetNavigate
}: {
  onClose: () => void
  // Called just before the target bar navigates the pane, so App can keep the
  // user in the SEO view rather than returning them to the device canvas.
  onTargetNavigate: () => void
}): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
  const [tab, setTab] = useState<SeoTab>('findings')
  const presentation = useSeoAuditPresentation(window.api)
  const {
    result,
    linkFilter,
    setLinkFilter,
    findingCategories,
    setFindingCategories,
    findingOutcomes,
    setFindingOutcomes,
    copyMarkdown
  } = presentation
  const isEmptyState = !result && !presentation.running

  return (
    <TooltipProvider delay={200}>
      <div
        data-testid="seo-view"
        className={cn(
          'relative z-10 box-border h-screen overflow-y-auto text-foreground',
          CANVAS_GLASS_SURFACE_CLASS
        )}
        style={{
          paddingLeft: sidebarOffset,
          scrollbarGutter: 'stable'
        }}
      >
        <div
          className={cn(
            'mx-auto flex w-full flex-col px-8 pt-16 pb-32',
            isEmptyState && 'min-h-full justify-center'
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            <header className="px-2 space-y-2">
              <h1 className="text-3xl font-normal tracking-tight text-white">Page SEO audit</h1>
              <p className=" text-base text-white/45">
                Check discoverability, metadata, and structured data for the current page.
              </p>
            </header>
            <AuditControls
              url={presentation.url}
              intent={presentation.intent}
              running={presentation.running}
              job={presentation.job}
              result={result}
              history={presentation.history}
              handleNavigate={(target) => {
                onTargetNavigate()
                presentation.handleNavigate(target)
              }}
              handleIntentChange={presentation.handleIntentChange}
              handleRun={presentation.handleRun}
              handleCancel={presentation.handleCancel}
            />

            {!result ? (
              presentation.running ? (
                <div
                  data-testid="seo-results-loading"
                  className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/40 px-6 py-16 text-sm text-white/55 backdrop-blur-md"
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                  Running audit…
                </div>
              ) : null
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
                      findingCategories={findingCategories}
                      findingOutcomes={findingOutcomes}
                      setFindingCategories={setFindingCategories}
                      setFindingOutcomes={setFindingOutcomes}
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
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
