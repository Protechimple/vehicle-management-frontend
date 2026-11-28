import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { BrandingProvider } from '../context/BrandingContext';
import { AutoBackLink, BackLinkProvider } from '../components/ui';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrandingProvider>
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

        {sidebarOpen && (
          <div
            role="presentation"
            onClick={() => setSidebarOpen(false)}
            // Above the sticky header (z-30) and below the drawer (z-40), so the header is dimmed and can't be tapped
            // through while the menu is open.
            className="fixed inset-0 z-35 bg-brand-900/50 lg:hidden"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} />
          <main className="min-w-0 flex-1 p-3 sm:p-5">
            <BackLinkProvider>
              <AutoBackLink home="/dashboard" hideOn={['/dashboard']} />
              <Outlet />
            </BackLinkProvider>
          </main>
        </div>
      </div>
    </BrandingProvider>
  );
}
