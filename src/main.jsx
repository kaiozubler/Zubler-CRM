import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./CustomerSuccessApp.jsx";
import ExigirLogin from "./core/Login.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ExigirLogin>{(sessao) => <App sessao={sessao} />}</ExigirLogin>
  </StrictMode>
);
