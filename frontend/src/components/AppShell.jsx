import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

function AppShell({ user, activeTab, setActiveTab, onLogout, title, streak, children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="app-shell" style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#0f172a", color: "#ffffff" }}>
      {/* DESKTOP / MOBILE SIDEBAR */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
        isMobileOpen={isMobileOpen}
        closeMobileSidebar={() => setIsMobileOpen(false)}
      />

      {/* MAIN CONTAINER */}
      <div
        className="app-main-content"
        style={{
          flex: 1,
          marginLeft: 250,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          width: "calc(100% - 250px)"
        }}
      >
        {/* REUSABLE HEADER */}
        <Header
          title={title}
          activeTab={activeTab}
          user={user}
          streak={streak}
          onLogout={onLogout}
          toggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)}
        />

        {/* PAGE CONTENT CONTAINER */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 32px 40px",
            boxSizing: "border-box"
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
