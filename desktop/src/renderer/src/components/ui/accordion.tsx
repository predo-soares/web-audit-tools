import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@renderer/lib/utils'

const accordionHeightTransition = {
  open: {
    duration: 0.6,
    ease: [0.32, 0.72, 0, 1] as const
  },
  close: {
    duration: 0.4,
    ease: [0.32, 0.72, 0, 1] as const
  }
}

const accordionContentOpacityTransition = {
  open: {
    duration: accordionHeightTransition.open.duration,
    ease: accordionHeightTransition.open.ease
  },
  close: {
    duration: 0.15,
    ease: [0.23, 1, 0.32, 1] as const
  }
}

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('not-last:border-b', className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

interface AccordionContentBodyProps {
  panelProps: React.ComponentProps<'div'> & { ref?: React.Ref<HTMLDivElement> }
  state: AccordionPrimitive.Panel.State
  shouldReduceMotion: boolean | null
  children: React.ReactNode
}

function AccordionContentBody({
  panelProps,
  state,
  shouldReduceMotion,
  children
}: AccordionContentBodyProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  const measure = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [])

  useLayoutEffect(() => {
    if (!state.open) return
    measure()
  }, [state.open, children, measure])

  useLayoutEffect(() => {
    if (!state.open || !contentRef.current) return

    const observer = new ResizeObserver(measure)
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [state.open, measure])

  const {
    style: _panelStyle,
    className: panelClassName,
    hidden: _hidden,
    ...restPanelProps
  } = panelProps

  return (
    <div
      {...restPanelProps}
      data-slot="accordion-content"
      className={cn('overflow-hidden text-sm', panelClassName)}
      style={{ overflow: 'hidden' }}
    >
      <motion.div
        initial={false}
        animate={{
          height: state.open ? contentHeight : 0
        }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                height: state.open
                  ? accordionHeightTransition.open
                  : accordionHeightTransition.close
              }
        }
        style={{ overflow: 'hidden' }}
      >
        <motion.div
          initial={false}
          animate={{
            opacity: state.open ? 1 : 0
          }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  opacity: state.open
                    ? accordionContentOpacityTransition.open
                    : accordionContentOpacityTransition.close
                }
          }
        >
          <div ref={contentRef} className="pt-0 pb-2.5">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function AccordionContent({
  className,
  children,
  keepMounted = true,
  ...props
}: AccordionPrimitive.Panel.Props) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <AccordionPrimitive.Panel
      keepMounted={keepMounted}
      className={className}
      {...props}
      render={(panelProps, state) => (
        <AccordionContentBody
          panelProps={panelProps}
          state={state}
          shouldReduceMotion={shouldReduceMotion}
        >
          {children}
        </AccordionContentBody>
      )}
    />
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
