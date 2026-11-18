import { BrowserRouter } from 'react-router'
import { RoomProvider } from '../features/room/RoomContext.tsx'
import { AppRoutes } from './router.tsx'

export default function App() {
  return (
    <RoomProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </RoomProvider>
  )
}
