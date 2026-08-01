import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import RoundRobin from "./pages/RoundRobin";
import Courts from "./pages/Courts";
import Players from "./pages/Players";
import PublicDisplayPage from "./pages/PublicDisplayPage";
import Settings from "./pages/Settings";

const pageTitles = {
  dashboard: "Dashboard",
  queue: "Rotation Queue Management",
  roundrobin: "Round Robin Management",
  courts: "Court Management",
  players: "Player Management",
  public: "Public Display",
  settings: "Settings",
};

function App() {
  const [activePage, setActivePage] = useState("queue");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply persisted theme preference on startup (before first paint matters little here)
  useEffect(() => {
    async function applySavedTheme() {
      try {
        const data = await window.api.getSettings();
        const theme = data.theme || "light";
        const root = document.documentElement;
        root.classList.remove("dark", "light");
        if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          root.classList.add(prefersDark ? "dark" : "light");
        } else {
          root.classList.add(theme === "dark" ? "dark" : "light");
        }
      } catch (err) {
        console.error("Failed to apply saved theme:", err);
      }
    }
    applySavedTheme();
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "queue":
        return <Queue />;
      case "roundrobin":
        return <RoundRobin />;
      case "courts":
        return <Courts />;
      case "players":
        return <Players />;
      case "public":
        return <PublicDisplayPage />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  
  if (activePage === "public") {
    return <PublicDisplayPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

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

