import { Routes, Route } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import ServerSelect from './pages/ServerSelect'
import Home from './pages/Home'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<ServerSelect />} />
        <Route path="/s/:serverId" element={<Home />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  )
}
