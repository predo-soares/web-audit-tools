import { FormEvent, useState } from 'react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'

interface UrlBarProps {
  onNavigate: (url: string) => void
  disabled?: boolean
}

export function UrlBar({ onNavigate, disabled }: UrlBarProps): React.JSX.Element {
  const [value, setValue] = useState('')

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (!value.trim()) return
    onNavigate(value)
  }

  return (
    <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={handleSubmit}>
      <Input
        data-testid="url-input"
        type="text"
        placeholder="Enter a URL"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
      />
      <Button type="submit" data-testid="url-submit" disabled={disabled}>
        Go
      </Button>
    </form>
  )
}
