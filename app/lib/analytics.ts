"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? "";
const MIXPANEL_PROXY_DOMAIN = process.env.NEXT_PUBLIC_MIXPANEL_PROXY_DOMAIN ?? "";
const APP_VERSION = process.env.NEXT_PUBLIC_VERSION ?? "local";

let initialized = false;

function isMobileWeb() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function baseMeta() {
  return {
    device: isMobileWeb() ? "mobile_web" : "desktop_web",
    web_version: APP_VERSION,
  };
}

export const MixpanelAnalytics = {
  hasToken() {
    return Boolean(MIXPANEL_TOKEN);
  },
  init() {
    if (initialized || !MIXPANEL_TOKEN) {
      return;
    }

    mixpanel.init(MIXPANEL_TOKEN, {
      ...(MIXPANEL_PROXY_DOMAIN ? { api_host: MIXPANEL_PROXY_DOMAIN } : {}),
      debug: APP_VERSION.includes("alpha"),
      track_pageview: false,
      ignore_dnt: true,
      persistence: "localStorage",
    });
    initialized = true;
  },
  track(event: string, params: Record<string, unknown> = {}) {
    if (!MIXPANEL_TOKEN) {
      return;
    }

    if (!initialized) {
      this.init();
    }

    try {
      mixpanel.track(event, params);
    } catch (error) {
      if (MIXPANEL_TOKEN) {
        console.log(error);
      }
    }
  },
  trackPage(pageName: string, params: Record<string, unknown> = {}) {
    this.track("page_load", {
      page_name: pageName,
      ...params,
      ...baseMeta(),
    });
  },
  trackCTAClick(buttonName: string, pageName: string, params: Record<string, unknown> = {}) {
    this.track("button_click", {
      button_name: buttonName,
      page_name: pageName,
      ...params,
      ...baseMeta(),
    });
  },
  trackSectionScroll(pageName: string, params: Record<string, unknown> = {}) {
    this.track("section_scroll", {
      page_name: pageName,
      ...params,
      ...baseMeta(),
    });
  },
  trackAPI(pageName: string, params: Record<string, unknown> = {}) {
    this.track("api_response", {
      page_name: pageName,
      ...params,
      ...baseMeta(),
    });
  },
  trackHalfWayScroll(pageName: string) {
    this.track("user_scroll", {
      page_name: pageName,
      ...baseMeta(),
    });
  },
  trackEnterTime() {
    // mixpanel.time_event("screen_duration");
  },
  tractExitTime(pageName: string, params: Record<string, unknown> = {}) {
    this.track("screen_duration", {
      screen_name: pageName,
      ...params,
      ...baseMeta(),
    });
  },
  trackUserAttributes(payload: Record<string, string>) {
    if (!MIXPANEL_TOKEN) {
      return;
    }

    if (!initialized) {
      this.init();
    }

    try {
      if (payload.id) {
        mixpanel.identify(payload.id);
        mixpanel.register({ user_id: payload.id });
      }

      const userAttributes: Record<string, string> = {};
      if (payload.email) {
        userAttributes.$email = payload.email;
      }
      if (payload.mobile) {
        userAttributes.mobile = payload.mobile;
        mixpanel.register({ phone_number: payload.mobile });
      }
      if (payload.fullName) {
        userAttributes.$name = payload.fullName;
      }

      mixpanel.people.set(userAttributes);
    } catch (error) {
      if (MIXPANEL_TOKEN) {
        console.log(error);
      }
    }
  },
  endSession() {
    if (!MIXPANEL_TOKEN) {
      return;
    }

    if (!initialized) {
      this.init();
    }

    try {
      mixpanel.reset();
    } catch (error) {
      if (MIXPANEL_TOKEN) {
        console.log(error);
      }
    }
  },
};

type AnalyticsPayload = {
  pageName: string;
  params?: Record<string, unknown>;
};

type ClickPayload = {
  buttonName: string;
  pageName: string;
  params?: Record<string, unknown>;
};

export const Mixpanel = MixpanelAnalytics;

export const ZincAnalytics = {
  trackEnterTime() {
    Mixpanel.trackEnterTime();
  },
  tractExitTime({ pageName, params = {} }: AnalyticsPayload) {
    Mixpanel.tractExitTime(pageName, params);
  },
  trackPage({ pageName, params = {} }: AnalyticsPayload) {
    Mixpanel.trackPage(pageName, params);
  },
  trackSectionScroll({ pageName, params = {} }: AnalyticsPayload) {
    Mixpanel.trackSectionScroll(pageName, params);
  },
  trackUserAttributes(payload: Record<string, string>) {
    Mixpanel.trackUserAttributes(payload);
  },
  endSession() {
    Mixpanel.endSession();
  },
  trackAPI({ pageName, params = {} }: AnalyticsPayload) {
    Mixpanel.trackAPI(pageName, params);
  },
  trackClick({ buttonName, pageName, params = {} }: ClickPayload) {
    Mixpanel.trackCTAClick(buttonName, pageName, params);
  },
  trackHalfPageScroll({ pageName }: { pageName: string }) {
    Mixpanel.trackHalfWayScroll(pageName);
  },
};
