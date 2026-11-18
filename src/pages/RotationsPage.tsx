import { Dashboard } from '../components/dashboard/Dashboard.tsx'

export function RotationsPage() {
  return (
    <Dashboard
      emphasis="timeline"
      title="Rotations & pauses"
      subtitle="La frise montre l'état réel de chaque croupier. Le contrôle à droite mémorise un intervalle, sans faire tourner la salle."
    />
  )
}
