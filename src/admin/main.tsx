import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

const root = document.getElementById("admin-root");
if (!root) throw new Error("Missing #admin-root element");

const initialAuthenticated = root.dataset.authenticated === "true";

createRoot(root).render(
  <StrictMode>
    <App initialAuthenticated={initialAuthenticated} />
  </StrictMode>
);
