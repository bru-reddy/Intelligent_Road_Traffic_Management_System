import React from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <TopNavbar />

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}