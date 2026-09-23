import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";

import "./retro.css";
import "./desktop.css";
import "./messenger.css";
function RoutedApp() {
  const [search, setSearch] = React.useState(window.location.search);
  React.useEffect(() => {
    const navigate = () => setSearch(window.location.search);
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);
  return <App key={search} search={search} />;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RoutedApp />
  </React.StrictMode>,
);
