"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const InstallContext = createContext({
  installed: false,
  canPrompt: false,
  promptInstall: async () => false,
});

export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const syncDisplay = () =>
      setInstalled(
        display.matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    syncDisplay();
    display.addEventListener("change", syncDisplay);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Installation remains available; a later visit can retry offline support.
        });
    }
    return () => {
      display.removeEventListener("change", syncDisplay);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function promptInstall() {
    if (!prompt) return false;
    try {
      await prompt.prompt();
      return (await prompt.userChoice).outcome === "accepted";
    } finally {
      setPrompt(null);
    }
  }
  return (
    <InstallContext.Provider
      value={{ installed, canPrompt: !!prompt, promptInstall }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export const usePwaInstall = () => useContext(InstallContext);
