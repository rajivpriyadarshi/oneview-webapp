"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import mixpanel from "mixpanel-browser";
import { appConfig } from "../lib/config";

let initialized = false;

function initMixpanel() {
  if (initialized || !appConfig.mixpanelToken) {
    return;
  }

  mixpanel.init(appConfig.mixpanelToken, {
    track_pageview: false,
    persistence: "localStorage",
  });
  initialized = true;
}

function getButtonText(element: HTMLElement) {
  const text = element.textContent?.trim();
  if (text) {
    return text.slice(0, 120);
  }

  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  const title = element.getAttribute("title")?.trim();
  if (title) {
    return title;
  }

  return "unknown";
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initMixpanel();
    if (!appConfig.mixpanelToken) {
      return;
    }

    const search = searchParams.toString();
    const pagePath = search ? `${pathname}?${search}` : pathname;

    mixpanel.track("page_view", {
      page_path: pagePath,
      page_url: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    initMixpanel();
    if (!appConfig.mixpanelToken) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const buttonEl = target.closest(
        'button, [role="button"], input[type="button"], input[type="submit"]'
      ) as HTMLElement | null;

      if (!buttonEl) {
        return;
      }

      mixpanel.track("button_click", {
        page_path: window.location.pathname + window.location.search,
        page_url: window.location.href,
        button_text: getButtonText(buttonEl),
        button_id: buttonEl.id || undefined,
        button_class: buttonEl.className || undefined,
      });
    };

    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
