export const trackingEventsMap = {
  landingPage: {
    PAGE: "landing_page",
    CLICK_SIGN_IN: "sign_in",
    CLICK_TRY_MERIDIAN: "try_meridian",
    CLICK_SEE_ONEVIEW: "see_your_oneview",
  },
  waitlist: {
    PAGE: "waitlist_page",
    CLICK_PROFILE: "profile",
    CLICK_RESEND: "resend",
  },
  profileCreate: {
    PAGE: "basic_details",
    CLICK_SUBMIT: "proceed",
  },
  profileStep: {
    PAGE: "profile_step",
    CLICK_PROFILE: "profile",
    CLICK_PROCEED: "proceed",
    SECTION: {
      HEADER: "header",
      ONBOARDING_STEPPER: "onboarding_stepper",
    },
    COMPONENT_STATE: {
      SUBMIT_INFO: "submit_info",
      EMAIL_VERIFICATION: "email_verification",
      VKYC_PENDING: "vkyc_pending",
      VKYC_SUBMITTED: "vkyc_submitted",
      VKYC_REJECTED: "vkyc_rejected",
      DOC_SUBMITTED: "doc_submitted",
    },
  },
} as const;
