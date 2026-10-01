import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { PageLoader } from '../common/PageLoader'
import Header from '../common/Header'
import Footer from '../common/Footer'
import BottomNav from '../common/BottomNav'
import PullToRefresh from '../common/PullToRefresh'

const MainLayout = () => {
  return (
    // مسافة سفلية بارتفاع شريط التنقل على الهاتف حتى لا يغطي نهاية الصفحة
    <div className="min-h-screen flex flex-col bg-white pb-[var(--bottom-nav-h)]">
      {/* Header - Fixed 70px */}
      <Header />

      {/* السحب للأسفل للتحديث */}
      <PullToRefresh />

      {/* Main Content Area */}
      <main className="flex-1 pt-[70px]">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom Navigation - الهاتف فقط */}
      <BottomNav />
    </div>
  )
}

export default MainLayout
