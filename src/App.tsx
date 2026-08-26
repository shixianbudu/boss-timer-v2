import { Routes, Route } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import ServerSelect from './pages/ServerSelect'
import Home from './pages/Home'
import RulesDialog from '@/sections/RulesDialog'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<ServerSelect />} />
        <Route path="/s/:serverId" element={<Home />} />
      </Routes>
      <RulesDialog />
      <Toaster position="top-center" richColors />
    </>
  )
}
