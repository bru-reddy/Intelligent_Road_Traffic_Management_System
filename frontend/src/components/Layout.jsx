import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import MobileNav from "./MobileNav";

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 800) setMobileSidebarOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") closeMobileSidebar();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="irtms-app-shell">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />

      {mobileSidebarOpen && (
        <button
          type="button"
          className="irtms-sidebar-overlay"
          onClick={closeMobileSidebar}
          aria-label="Close navigation"
        />
      )}

      <main className="irtms-main-layout">
        <TopNavbar
          onMenuClick={() => setMobileSidebarOpen(true)}
          showMobileMenu={false}
        />

        <section className="content">
          <Outlet />
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
