import { trackingEventsMap } from "../constants";
import { Mixpanel, ZincAnalytics } from "../utils";
import { Mixpanel, ZincAnalytics } from "../lib/analytics";

type AnalyticsPayload = {
  pageName: string;
  params?: Record<string, unknown>;
};

type ClickPayload = {
  buttonName: string;
  pageName: string;
  params?: Record<string, unknown>;
};

const useAnalytics = () => {
  const initialize = () => {
    Mixpanel.init();
  };

  const trackPage = (payload: AnalyticsPayload) => {
    ZincAnalytics.trackPage(payload);
  };

  const trackSectionScroll = (payload: AnalyticsPayload) => {
    ZincAnalytics.trackSectionScroll(payload);
  };

  const trackCTAClick = (buttonName: string) => {
    ZincAnalytics.trackClick({
      buttonName,
      pageName: trackingEventsMap.landingPage.PAGE,
    });
  };

  const trackClick = (payload: ClickPayload) => {
    ZincAnalytics.trackClick(payload);
  };

  const trackAPI = (payload: AnalyticsPayload) => {
    ZincAnalytics.trackAPI(payload);
  };

  const trackHalfWayScroll = (pageName: string) => {
    ZincAnalytics.trackHalfPageScroll({ pageName });
  };

  const trackEnterTime = () => {
    ZincAnalytics.trackEnterTime();
  };

  const tractExitTime = (pageName: string) => {
    ZincAnalytics.tractExitTime({ pageName });
  };

  const trackUserAttributes = (payload: Record<string, string>) => {
    ZincAnalytics.trackUserAttributes(payload);
  };

  return {
    initialize,
    trackPage,
    trackSectionScroll,
    trackCTAClick,
    trackClick,
    trackAPI,
    trackHalfWayScroll,
    trackEnterTime,
    tractExitTime,
    trackUserAttributes,
  };
};

export default useAnalytics;

