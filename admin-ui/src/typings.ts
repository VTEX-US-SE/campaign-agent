import { ToolComponentProps, ToolContent } from '@vtex/agentic-ui'

/**
 * Tool component props with typed output.
 * Use TOutput to describe the shape of props.data.output
 * (e.g. { data: MyToolPayload }).
 */
export type ToolComponentPropsWithOutput<TOutput> = Omit<ToolComponentProps, 'data'> & {
  data: ToolContent<TOutput>
}

export interface ToolOutputEnvelope<TData> {
  status?: 'success' | 'error' | string
  message?: string
  data?: TData
  code?: string | number
  account?: string
}

/** Props when tool output is { status, message, data }. */
export type ToolDataProps<TData> = ToolComponentPropsWithOutput<ToolOutputEnvelope<TData>>

// ---------------------------------------------------------------------------
// OperationDetails — structured payload from confirm_action
// ---------------------------------------------------------------------------

/** A single scalar field row in the operation-details card. */
export interface FieldDetail {
  label: string
  value: string | number | boolean | null
  kind: 'text' | 'count'
}

/** A resolved (id, name) pair for a brand/category/collection/product/etc. */
export interface ReferenceItem {
  id: number
  /** null when name resolution failed on the backend */
  name: string | null
}

/** One criterion row inside a rule block. */
export interface CriterionDetail {
  label: string
  kind:
    | 'brand-reference'
    | 'category-reference'
    | 'collection-reference'
    | 'product-reference'
    | 'sku-reference'
    | 'product-spec-value-reference'
    | 'sku-spec-value-reference'
    | 'term-filter'
    | 'product-text-spec-filter'
    | 'sku-text-spec-filter'
  items: ReferenceItem[]
  /** Present when the backend capped the items list at MAX_REFERENCE_ITEMS_PER_CRITERION */
  truncated_count?: number
}

/**
 * Product-status scope of a static-filter rule. `active_only` is the
 * controlplane default; `active_and_inactive` means the user opted in via
 * `include_inactive_products`. Always present on static-filter rules (so the
 * card states the scope even in the default case), never on dynamic rules.
 */
export type StaticFilterStatus = 'active_only' | 'active_and_inactive'

/** One rule sub-block inside the operation-details card. */
export interface RuleDetail {
  index: number
  type: 'inclusive' | 'exclusive' | 'static_filter'
  criteria: CriterionDetail[]
  /** True for static-filter rules — a fixed snapshot, not auto-updating */
  static?: boolean
  /** Product-status scope; only set by the backend on static-filter rules */
  status?: StaticFilterStatus
}

/**
 * Top-level structured payload produced in Phase 1 and forwarded verbatim
 * by confirm_action to the frontend. The LLM never edits this.
 */
export interface OperationDetails {
  title: string
  action_label: string
  tool_name: string
  fields: FieldDetail[]
  rules?: RuleDetail[]
}
