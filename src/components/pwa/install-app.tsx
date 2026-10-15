"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "./pwa-provider";

export function InstallApp() {
  const { installed, canPrompt, promptInstall } = usePwaInstall();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  if (installed) return null;
  return (
    <details className="pwa-install">
      <summary>
        <Download size={16} aria-hidden />
        Install app
      </summary>
      <div className="pwa-install-guide">
        <p>
          Keep mini-habitify on your Home Screen and open it in its own window.
        </p>
        {canPrompt && (
          <Button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setMessage("");
              try {
                const accepted = await promptInstall();
                if (!accepted)
                  setMessage("You can install later from your browser’s menu.");
              } catch {
                setMessage("Use your browser’s install menu to try again.");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Opening…" : "Install mini-habitify"}
          </Button>
        )}
        <p>
          <strong>On iPhone or iPad:</strong> open this site in Safari, tap
          Share, then Add to Home Screen. If shown, keep Open as Web App
          enabled.
        </p>
        <p>
          On other supported browsers, choose Install app or Add to Home Screen
          from the browser menu.
        </p>
        <p className="muted">
          Recording and viewing activities requires an internet connection.
        </p>
        <p role="status">{message}</p>
      </div>
    </details>
  );
}
