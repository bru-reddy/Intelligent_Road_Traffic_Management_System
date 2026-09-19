import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";

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
    <div className="app-shell">
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

      <main className="main-content">
        <TopNavbar
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
