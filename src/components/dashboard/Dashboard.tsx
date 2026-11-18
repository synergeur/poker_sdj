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
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader title={title} subtitle={subtitle} />
      <SummaryBar />
      <SimClockBar />
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_190px] gap-2 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
          <div
            className={
              emphasis === 'floor'
                ? 'h-[40%] min-h-0 shrink-0 overflow-hidden'
                : 'h-[28%] min-h-0 shrink-0 overflow-hidden'
            }
          >
            <FloorPlan />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <RotationTimeline />
          </div>
        </div>
        <aside className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-2">
            <RotationControls />
            <UpcomingPanel />
            <TableLegend />
          </div>
        </aside>
      </div>
    </div>
  )
}
