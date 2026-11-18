import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '../components/layout/AppShell.tsx'
import { DealersPage } from '../pages/DealersPage.tsx'
import { LiveRoomPage } from '../pages/LiveRoomPage.tsx'
import { ReportsPage } from '../pages/ReportsPage.tsx'
import { RotationsPage } from '../pages/RotationsPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
import { TablesPage } from '../pages/TablesPage.tsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LiveRoomPage />} />
        <Route path="/rotations" element={<RotationsPage />} />
        <Route path="/dealers" element={<DealersPage />} />
        <Route path="/tables" element={<TablesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
