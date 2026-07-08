import { useEffect, useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface SaveProjectDialogProps {
  open: boolean
  suggestedName: string
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
}

export function SaveProjectDialog({
  open,
  suggestedName,
  onOpenChange,
  onSave
}: SaveProjectDialogProps): React.JSX.Element | null {
  const [name, setName] = useState(suggestedName)

  useEffect(() => {
    if (!open) return
    setName(suggestedName)
    const frame = window.requestAnimationFrame(() => {
      const input = document.getElementById('project-name') as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, suggestedName])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  if (!open) return null

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    onSave(name)
    onOpenChange(false)
  }

  return (
    <div
      className="absolute top-full right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg"
      data-testid="save-project-dialog"
      data-app-region="no-drag"
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium" htmlFor="project-name">
          Project name
        </label>
        <Input
          id="project-name"
          data-testid="project-name-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" data-testid="project-save-confirm">
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}

interface SaveProjectButtonProps {
  disabled: boolean
  suggestedName: string
  onSave: (name: string) => void
}

export function SaveProjectButton({
  disabled,
  suggestedName,
  onSave
}: SaveProjectButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent): void => {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="save-project"
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background text-sm font-medium transition-all hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50'
        )}
        aria-label="Save current page as project"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Bookmark aria-hidden="true" className="size-4" />
      </button>
      <SaveProjectDialog
        open={open}
        suggestedName={suggestedName}
        onOpenChange={setOpen}
        onSave={onSave}
      />
    </div>
  )
}
