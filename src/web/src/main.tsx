import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/identity/Auth";
import { ErrorBoundary } from "./shared/ui";
import App from "./App";
import "./theme.css";
import "./application.css";
import "./features/quotes/quote.css";
import "./features/public/project-panels.css";
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
