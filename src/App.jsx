import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Courts from "./pages/Courts";
import Players from "./pages/Players";
import PublicDisplayPage from "./pages/PublicDisplayPage";

const pageTitles = {
  dashboard: "Dashboard",
  queue: "Queue Management",
  courts: "Court Management",
  players: "Player Management",
  public: "Public Display",
  settings: "Settings",
};

function SettingsPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <span className="text-5xl mb-4 block">⚙️</span>
        <p className="text-lg font-medium text-[var(--text-h)]">Settings</p>
        <p className="text-sm text-[var(--text)] mt-1">Coming soon...</p>
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("queue");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "queue":
        return <Queue />;
      case "courts":
        return <Courts />;
      case "players":
        return <Players />;
      case "public":
        return <PublicDisplayPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  // For Public Display, render fullscreen without sidebar/header
  if (activePage === "public") {
    return <PublicDisplayPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={pageTitles[activePage] || "Dashboard"} />

        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;

