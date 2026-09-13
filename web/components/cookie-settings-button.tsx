"use client";

import { GA_CONSENT_KEY } from "./ga-consent";

export default function CookieSettingsButton({
  variant = "link",
}: {
  variant?: "link" | "button";
}) {
  function resetConsent() {
    try {
      window.localStorage.removeItem(GA_CONSENT_KEY);
    } catch {
      // storage unavailable — reload still resets to ask-again state
    }
    window.location.reload();
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={resetConsent}
        className="rounded-sm border border-(--color-border) px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-(--color-foreground) transition-colors hover:bg-(--color-muted)"
      >
        Cookie settings
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={resetConsent}
      className="font-mono text-xs uppercase tracking-widest transition-colors hover:text-[var(--color-foreground)]"
      style={{ color: "var(--color-muted-foreground)" }}
    >
      Cookies
    </button>
  );
}
