import { Dashboard } from '../components/dashboard/Dashboard.tsx'

export function LiveRoomPage() {
  return (
    <Dashboard
      emphasis="floor"
      title="Salle de poker — Pauses & rotations"
      subtitle="Prototype visuel. L'ouverture, la fermeture et les affectations sont actives. Les rotations ne sont pas calculées."
    />
  )
}
