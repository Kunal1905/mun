import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { SetupRequired } from "./pages/SetupRequired";
import { CLERK_KEY } from "./lib/config";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    {CLERK_KEY ? (
      <ClerkProvider
        publishableKey={CLERK_KEY}
        afterSignOutUrl="/"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/play"
        signUpFallbackRedirectUrl="/play"
        appearance={{
          variables: {
            colorPrimary: "#1B2A41",
            colorForeground: "#1B2A41",
            colorBackground: "#FFFFFF",
            borderRadius: "0.75rem",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <SetupRequired />
    )}
  </StrictMode>,
);
