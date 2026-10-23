import { ToolComponentProps } from '@vtex/agentic-ui'
import { Link } from '@vtex/shoreline'

import { getToolOutput } from '../../toolOutput'
import { ToolErrorInfoCard } from '../ToolErrorInfoCard'
import { ToolCard } from '../ToolCard'
import { ToolSummaryTable } from '../ToolSummaryTable'
import { ToolTable } from '../ToolTable'

interface PreviewProductItem {
  productId?: number
  skuId?: number
  subCollectionId?: number
  productName?: string
  skuImageUrl?: string | null
}

interface CollectionPreviewData {
  total?: number
  page?: number
  products?: PreviewProductItem[]
}

export function CollectionPreviewProductsCard(props: ToolComponentProps) {
  const output = getToolOutput<CollectionPreviewData>(props.data.output)

  if (output?.status === 'error') {
    return <ToolErrorInfoCard title="Collection preview failed" output={output} />
  }

  const data = output?.data

  if (!data) return null

  const products = data.products || []
  const summaryRows = [
    { id: 'total', label: 'Total products', value: data.total ?? products.length },
    { id: 'page', label: 'Page', value: data.page ?? 1 },
  ]

  const productRows = products.map((product, index) => {
    const productId = product.productId
    const productName = product.productName
    const skuImageUrl = product.skuImageUrl

    return {
      id: `${productId ?? 'product'}-${index}`,
      cells: [
        productId ?? '-',
        productName || '-',
        skuImageUrl ? (
          <Link
            href={skuImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open image for ${productName || `product ${productId ?? index + 1}`}`}
          >
            Image
          </Link>
        ) : (
          '-'
        ),
      ],
    }
  })

  return (
    <ToolCard title="Collection preview" message={output?.message || `Found ${data.total ?? 0} product(s)`}>
      <ToolSummaryTable rows={summaryRows} ariaLabel="Collection preview summary" />
      <ToolTable
        columns={[
          { id: 'productId', header: 'Product ID' },
          { id: 'productName', header: 'Product name' },
          { id: 'skuImageUrl', header: 'Image' },
        ]}
        rows={productRows}
        emptyMessage="No products returned for this preview."
        ariaLabel="Collection preview products"
      />
    </ToolCard>
  )
}
