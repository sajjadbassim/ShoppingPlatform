import { Outlet } from 'react-router-dom'
import Header from '../common/Header'
import Footer from '../common/Footer'

const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header - Fixed 70px */}
      <Header />
      
      {/* Main Content Area */}
      <main className="flex-1 pt-[70px]">
        <Outlet />
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  )
}

export default MainLayout
