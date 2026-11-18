import { FloorPlan } from '../floor-plan/FloorPlan.tsx'
import { PageHeader } from '../layout/PageHeader.tsx'
import { RotationControls, TableLegend, UpcomingPanel } from '../rotations/SidePanels.tsx'
import { RotationTimeline } from '../timeline/RotationTimeline.tsx'
import { SimClockBar } from './SimClockBar.tsx'
import { SummaryBar } from './SummaryBar.tsx'

export function Dashboard({
  title,
  subtitle,
  emphasis,
}: {
  title: string
  subtitle: string
  emphasis: 'floor' | 'timeline'
}) {
  const floor = <FloorPlan />
  const timeline = <RotationTimeline tall={emphasis === 'timeline'} />

  return (
    <div className="flex flex-col gap-3 p-3 lg:p-4">
      <PageHeader title={title} subtitle={subtitle} />
      <SummaryBar />
      <SimClockBar />
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          {emphasis === 'floor' ? floor : null}
          {timeline}
          {emphasis === 'timeline' ? floor : null}
        </div>
        <aside className="flex flex-col gap-3">
          <RotationControls />
          <UpcomingPanel />
          <TableLegend />
        </aside>
      </div>
    </div>
  )
}
