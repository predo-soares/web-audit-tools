import { SIDEBAR_WIDTH_PX, TOOLBAR_HEIGHT_PX } from '../../../../shared/sidebar'
import { useSidebar } from '@renderer/context/sidebar-context'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useSeoAuditPresentation } from '@renderer/hooks/use-seo-audit-presentation'
import { AuditControls } from './audit-controls'
import { FindingFilters } from './finding-filters'
import { DocumentStructureSection } from './sections/document-structure-section'
import { FindingsSection } from './sections/findings-section'
import { ImagesMediaSection } from './sections/images-media-section'
import { InternationalizationSection } from './sections/internationalization-section'
import { LinkInventorySection } from './sections/link-inventory-section'
import { MetadataDetails } from './sections/metadata-details'
import { SearchPreview } from './sections/search-preview'
import { SocialPreviews } from './sections/social-previews'
import { StructuredDataSection } from './sections/structured-data-section'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SeoView({ onClose: _onClose }: { onClose: () => void }): React.JSX.Element {
  const { isOpen: sidebarOpen, isTransitioning: sidebarTransitioning } = useSidebar()
  const sidebarOffset = sidebarOpen || sidebarTransitioning ? SIDEBAR_WIDTH_PX : 0
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
        className="absolute inset-0 z-10 overflow-y-auto bg-transparent text-foreground"
        style={{ top: TOOLBAR_HEIGHT_PX, left: sidebarOffset }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
          {!auditable ? (
            <p
              data-testid="seo-view-empty"
              className="rounded-xl border border-white/10 bg-black/55 px-6 py-16 text-center text-sm text-white/55 backdrop-blur-md"
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
                <p className="rounded-xl border border-white/10 bg-black/55 px-6 py-16 text-center text-sm text-white/55 backdrop-blur-md">
                  Run an audit to see results.
                </p>
              ) : (
                <>
                  <FindingsSection
                    result={result}
                    findingCategory={findingCategory}
                    findingOutcome={findingOutcome}
                    copyMarkdown={copyMarkdown}
                  />
                  <SearchPreview result={result} />
                  <SocialPreviews result={result} />
                  <StructuredDataSection result={result} />
                  <DocumentStructureSection result={result} />
                  <LinkInventorySection
                    result={result}
                    linkFilter={linkFilter}
                    setLinkFilter={setLinkFilter}
                  />
                  <ImagesMediaSection result={result} />
                  <InternationalizationSection result={result} />
                  <MetadataDetails result={result} />
                  <FindingFilters
                    result={result}
                    findingOutcome={findingOutcome}
                    setFindingOutcome={setFindingOutcome}
                    findingCategory={findingCategory}
                    setFindingCategory={setFindingCategory}
                    copyMarkdown={copyMarkdown}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
