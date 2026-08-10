import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import type { InspectionMarkupNode } from '../../../shared/inspection'

interface InspectionMarkupTreeProps {
  node: InspectionMarkupNode
  selectedNodeId?: string
  onLoadChildren?: (nodeId: string) => Promise<InspectionMarkupNode[]>
}

interface VisibleNode {
  node: InspectionMarkupNode
  parentId: string | null
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

function findNode(node: InspectionMarkupNode, nodeId: string): InspectionMarkupNode | null {
  if (node.id === nodeId) return node
  for (const child of node.children ?? []) {
    const match = findNode(child, nodeId)
    if (match) return match
  }
  return null
}

function replaceChildren(
  node: InspectionMarkupNode,
  nodeId: string,
  children: InspectionMarkupNode[]
): InspectionMarkupNode {
  if (node.id === nodeId) return { ...node, children }
  if (!node.children) return node
  return {
    ...node,
    children: node.children.map((child) => replaceChildren(child, nodeId, children))
  }
}

function collectVisibleNodes(
  node: InspectionMarkupNode,
  expandedIds: ReadonlySet<string>,
  parentId: string | null = null,
  result: VisibleNode[] = []
): VisibleNode[] {
  result.push({ node, parentId })
  if (expandedIds.has(node.id)) {
    for (const child of node.children ?? []) {
      collectVisibleNodes(child, expandedIds, node.id, result)
    }
  }
  return result
}

function getInitialExpandedIds(node: InspectionMarkupNode): Set<string> {
  const expandedIds = new Set<string>()
  if (node.type !== 'element' || !node.hasChildren || node.children === undefined) {
    return expandedIds
  }

  expandedIds.add(node.id)
  for (const child of node.children) {
    if (child.type === 'element' && child.hasChildren && child.children !== undefined) {
      expandedIds.add(child.id)
    }
  }
  return expandedIds
}

function MarkupTokens({
  node,
  closing = false
}: {
  node: InspectionMarkupNode
  closing?: boolean
}): React.JSX.Element {
  if (node.type === 'text') {
    return (
      <span className="text-zinc-300" data-testid={`inspection-markup-text-${node.id}`}>
        {node.text === '' ? '""' : node.text}
      </span>
    )
  }

  if (node.type === 'comment') {
    return (
      <span className="text-zinc-500" data-testid={`inspection-markup-comment-${node.id}`}>
        &lt;!--{node.text ?? ''}--&gt;
      </span>
    )
  }

  return (
    <>
      <span className="text-zinc-500">&lt;</span>
      {closing ? <span className="text-zinc-500">/</span> : null}
      <span className="text-sky-300">{node.tagName}</span>
      {!closing
        ? (node.attributes ?? []).map((attribute) => (
            <span key={`${node.id}-${attribute.name}`}>
              <span className="text-zinc-400"> </span>
              <span className="text-violet-300">{attribute.name}</span>
              <span className="text-zinc-500">=</span>
              <span className="text-emerald-300">&quot;{attribute.value}&quot;</span>
            </span>
          ))
        : null}
      <span className="text-zinc-500">&gt;</span>
    </>
  )
}

function MarkupDisclosure({
  expanded,
  loading,
  onClick
}: {
  expanded: boolean
  loading: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={expanded ? 'Collapse node' : 'Expand node'}
      aria-expanded={expanded}
      disabled={loading}
      className="mr-1 inline-flex size-4 shrink-0 select-none items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <span
        aria-hidden="true"
        className={`text-[10px] transition-transform ${expanded ? 'rotate-90' : ''}`}
      >
        {loading ? '·' : '›'}
      </span>
    </button>
  )
}

function InspectionMarkupNodeRow({
  node,
  depth,
  expandedIds,
  loadingIds,
  selectedNodeId,
  onFocus,
  onToggle,
  registerRow,
  activeNodeId
}: {
  node: InspectionMarkupNode
  depth: number
  expandedIds: ReadonlySet<string>
  loadingIds: ReadonlySet<string>
  selectedNodeId: string
  onFocus: (nodeId: string) => void
  onToggle: (nodeId: string) => void
  registerRow: (nodeId: string, element: HTMLDivElement | null) => void
  activeNodeId: string
}): React.JSX.Element {
  const expandable = node.type === 'element' && node.hasChildren
  const expanded = expandedIds.has(node.id)
  const loading = loadingIds.has(node.id)
  const selected = node.id === selectedNodeId
  const children = node.children ?? []
  const tagName = node.tagName ?? ''
  const showClosingTag = node.type === 'element' && !VOID_ELEMENTS.has(tagName) && !node.hasChildren

  return (
    <div
      ref={(element) => registerRow(node.id, element)}
      role="treeitem"
      id={`inspection-markup-treeitem-${node.id}`}
      data-node-id={node.id}
      data-selected-node={selected ? 'true' : 'false'}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      tabIndex={activeNodeId === node.id ? 0 : -1}
      className="min-w-max outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      onFocus={() => onFocus(node.id)}
    >
      <div
        className={`flex min-h-6 items-center whitespace-pre-wrap rounded-sm pr-2 font-mono text-[11px] leading-relaxed ${selected ? 'bg-sky-300/10' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 2}px` }}
      >
        {expandable ? (
          <MarkupDisclosure
            expanded={expanded}
            loading={loading}
            onClick={() => onToggle(node.id)}
          />
        ) : (
          <span aria-hidden="true" className="mr-1 inline-block size-4 shrink-0" />
        )}
        <MarkupTokens node={node} />
        {node.type === 'element' && expandable && !expanded ? (
          <span className="text-zinc-600"> …</span>
        ) : null}
        {loading ? <span className="ml-2 text-[10px] text-zinc-600">loading</span> : null}
        {showClosingTag && node.type === 'element' ? (
          <>
            <span className="text-zinc-600"> </span>
            <MarkupTokens node={node} closing />
          </>
        ) : null}
      </div>
      {expanded && children.length ? (
        <div role="group">
          {children.map((child) => (
            <InspectionMarkupNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              selectedNodeId={selectedNodeId}
              onFocus={onFocus}
              onToggle={onToggle}
              registerRow={registerRow}
              activeNodeId={activeNodeId}
            />
          ))}
        </div>
      ) : null}
      {expanded && node.type === 'element' && children.length && !VOID_ELEMENTS.has(tagName) ? (
        <div
          role="none"
          className="min-h-6 whitespace-pre-wrap rounded-sm pr-2 font-mono text-[11px] leading-relaxed text-zinc-300"
          style={{ paddingLeft: `${(depth + 1) * 14 + 2}px` }}
        >
          <MarkupTokens node={node} closing />
        </div>
      ) : null}
    </div>
  )
}

export function InspectionMarkupTree({
  node,
  selectedNodeId = 'root',
  onLoadChildren
}: InspectionMarkupTreeProps): React.JSX.Element {
  const [tree, setTree] = useState(node)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => getInitialExpandedIds(node))
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set())
  const [activeNodeId, setActiveNodeId] = useState(node.id)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())

  const registerRow = useCallback((nodeId: string, element: HTMLDivElement | null): void => {
    if (element) rowRefs.current.set(nodeId, element)
    else rowRefs.current.delete(nodeId)
  }, [])

  const focusNode = useCallback((nodeId: string): void => {
    setActiveNodeId(nodeId)
    window.requestAnimationFrame(() => rowRefs.current.get(nodeId)?.focus())
  }, [])

  const toggleNode = useCallback(
    (nodeId: string): void => {
      const target = findNode(tree, nodeId)
      if (!target || target.type !== 'element' || !target.hasChildren) return
      if (loadingIds.has(nodeId)) return

      if (expandedIds.has(nodeId)) {
        setExpandedIds((current) => {
          const next = new Set(current)
          next.delete(nodeId)
          return next
        })
        return
      }

      const expand = async (): Promise<void> => {
        let children = target.children
        if (children === undefined) {
          setLoadingIds((current) => new Set(current).add(nodeId))
          try {
            children = (await onLoadChildren?.(nodeId)) ?? []
            setTree((current) => replaceChildren(current, nodeId, children ?? []))
          } catch {
            children = []
            setTree((current) => replaceChildren(current, nodeId, []))
          } finally {
            setLoadingIds((current) => {
              const next = new Set(current)
              next.delete(nodeId)
              return next
            })
          }
        }
        setExpandedIds((current) => new Set(current).add(nodeId))
      }

      void expand()
    },
    [expandedIds, loadingIds, onLoadChildren, tree]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      const currentId =
        (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset.nodeId ??
        activeNodeId
      const visibleNodes = collectVisibleNodes(tree, expandedIds)
      const currentIndex = visibleNodes.findIndex(
        ({ node: visibleNode }) => visibleNode.id === currentId
      )
      const current = visibleNodes[currentIndex]
      if (!current) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1
        const next = visibleNodes[nextIndex]
        if (next) focusNode(next.node.id)
        return
      }

      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        focusNode(visibleNodes[event.key === 'Home' ? 0 : visibleNodes.length - 1].node.id)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (current.node.type === 'element' && current.node.hasChildren) {
          if (!expandedIds.has(current.node.id)) toggleNode(current.node.id)
          else if (current.node.children?.[0]) focusNode(current.node.children[0].id)
        }
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (expandedIds.has(current.node.id)) toggleNode(current.node.id)
        else if (current.parentId) focusNode(current.parentId)
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        toggleNode(current.node.id)
      }
    },
    [activeNodeId, expandedIds, focusNode, toggleNode, tree]
  )

  return (
    <div
      role="tree"
      aria-label="Selected element markup"
      data-testid="inspection-markup-tree"
      className="max-w-full overflow-x-auto rounded-md bg-black/20 py-1 text-left select-text"
      onKeyDown={handleKeyDown}
    >
      <InspectionMarkupNodeRow
        node={tree}
        depth={0}
        expandedIds={expandedIds}
        loadingIds={loadingIds}
        selectedNodeId={selectedNodeId}
        onFocus={setActiveNodeId}
        onToggle={toggleNode}
        registerRow={registerRow}
        activeNodeId={activeNodeId}
      />
    </div>
  )
}
