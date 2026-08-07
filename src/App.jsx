import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Queue from "./pages/Queue";
import Tournament from "./pages/Tournament";
import Courts from "./pages/Courts";
import Players from "./pages/Players";
import PublicDisplayPage from "./pages/PublicDisplayPage";
import Settings from "./pages/Settings";

const pageTitles = {
  queue: "Rotation Queue Management",
  tournament: "Tournament Management",
  courts: "Court Management",
  players: "Player Management",
  public: "Public Display",
  settings: "Settings",
};

// Controls application navigation, layout, and saved theme startup.
function App() {
  const [activePage, setActivePage] = useState("queue");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply the saved theme when the application starts.
  useEffect(() => {
    // Load and apply the saved light, dark, or system theme.
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

  // Render the page selected in the sidebar.
  const renderPage = () => {
    switch (activePage) {
      case "queue":
        return <Queue />;
      case "tournament":
        return <Tournament />;
      case "courts":
        return <Courts />;
      case "players":
        return <Players />;
      case "public":
        return <PublicDisplayPage />;
      case "settings":
        return <Settings />;
      default:
        return <Queue />;
    }
  };

  
  if (activePage === "public") {
    return <PublicDisplayPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">

      {/* Application navigation */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Current page header */}
        <Header title={pageTitles[activePage] || "Rotation Queue Management"} />

        {/* Current page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;

