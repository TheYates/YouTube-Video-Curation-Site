"use client";

import { useCallback, useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-P5RT4FPR2F";
export const GA_CONSENT_KEY = "signal-ga-consent";
const STORAGE_KEY = GA_CONSENT_KEY;

type Consent = "pending" | "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function setDefaultDenied() {
  const dl = (window.dataLayer ??= []) as unknown as unknown[];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      dl.push(args);
    };
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export default function GaConsent() {
  const [consent, setConsent] = useState<Consent>("pending");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === "granted") {
      setConsent("granted");
    } else if (stored === "denied") {
      setDefaultDenied();
      setConsent("denied");
    } else {
      setDefaultDenied();
      setConsent("pending");
    }
  }, []);

  const accept = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "granted");
    } catch {
      // private mode — consent lasts for this session only
    }
    try {
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    } catch {
      // gtag not ready yet — GoogleAnalytics will pick up the stored grant
    }
    setConsent("granted");
  }, []);

  const decline = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "denied");
    } catch {
      // ignore — stays denied for this session
    }
    setConsent("denied");
  }, []);

  return (
    <>
      {consent === "granted" && <GoogleAnalytics gaId={GA_ID} />}
      {consent === "pending" && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Analytics consent"
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="mx-auto max-w-2xl rounded-sm border border-(--color-border) bg-(--color-card) p-5 shadow-lg">
            <p className="font-mono text-xs uppercase tracking-widest text-(--color-accent)">
              A quick ask
            </p>
            <p className="mt-2 text-sm leading-relaxed text-(--color-foreground)">
              Signal uses privacy-friendly analytics (Vercel) plus Google Analytics
              to see which videos get read. Allow analytics cookies?
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={accept}
                className="rounded-sm bg-(--color-accent) px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-(--color-accent-foreground) transition-opacity hover:opacity-80"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={decline}
                className="rounded-sm border border-(--color-border) px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-(--color-foreground) transition-colors hover:bg-(--color-muted)"
              >
                Decline
              </button>
              <a
                href="/privacy"
                className="font-mono text-xs text-(--color-muted-foreground) underline underline-offset-4 hover:text-(--color-foreground)"
              >
                Privacy policy
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
