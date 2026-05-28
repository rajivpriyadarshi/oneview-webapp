# Mixpanel Debugging Guide

## Quick Debug Checklist

### 1. Check if Mixpanel Token is Set

Open your browser console and run:
```javascript
console.log('Token:', process.env.NEXT_PUBLIC_MIXPANEL_TOKEN);
```

Or check the Network tab for Mixpanel requests to `https://api.mixpanel.com/track`

**✅ If you see a token**: Proceed to step 2
**❌ If empty/undefined**: You need to set the token (see Configuration section below)

### 2. Check Console Logs

Since we have debug logging enabled for local/alpha environments, you should see:
```
[Analytics] Event: page_load {page_name: "auth_page", ...}
[Analytics] Event: button_click {button_name: "google_signin", ...}
```

**✅ If you see logs**: Mixpanel is receiving events, check Mixpanel dashboard
**❌ If no logs**: Analytics is not being called (see Troubleshooting section)

### 3. Check Network Tab

1. Open Chrome DevTools > Network tab
2. Filter by "track" or "mixpanel"
3. Look for requests to `https://api.mixpanel.com/track` or your proxy domain

**✅ If you see requests with 200 status**: Events are being sent successfully
**❌ If you see 4xx errors**: Check your Mixpanel token
**❌ If no requests**: Token might be missing or Mixpanel not initialized

### 4. Check Mixpanel Dashboard

Events can take 1-2 minutes to appear in Mixpanel. 

1. Go to your Mixpanel project
2. Click "Events" in the sidebar
3. Look for recent events like `page_load`, `button_click`, `api_response`

## Configuration

### Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Mixpanel Configuration
NEXT_PUBLIC_MIXPANEL_TOKEN=your_mixpanel_token_here
NEXT_PUBLIC_VERSION=local

# Optional: If you're using a proxy
NEXT_PUBLIC_MIXPANEL_PROXY_DOMAIN=https://your-proxy-domain.com
```

**To get your Mixpanel token:**
1. Go to [Mixpanel](https://mixpanel.com)
2. Select your project
3. Click Settings (gear icon) > Project Settings
4. Copy the "Project Token"

### Restart the Dev Server

After adding the token:
```bash
npm run dev
```

## Manual Testing in Browser Console

Test if Mixpanel is working by running these commands in the browser console:

```javascript
// Check if Mixpanel is initialized
console.log('Mixpanel initialized:', window.mixpanel);

// Manually send a test event
window.mixpanel?.track('test_event', { test: 'manual' });

// Check current user identity
console.log('User ID:', window.mixpanel?.get_distinct_id());
```

## Common Issues & Solutions

### Issue 1: No Console Logs Appearing

**Cause**: Analytics not being called or APP_VERSION not set to "local"

**Solution**:
1. Check `.env.local` has `NEXT_PUBLIC_VERSION=local`
2. Restart dev server
3. Check if `useAnalytics` hook is being called in components

**Verify**:
```javascript
// In browser console
console.log('APP_VERSION:', process.env.NEXT_PUBLIC_VERSION);
```

### Issue 2: "mixpanel is not defined" Error

**Cause**: Mixpanel not initialized or token missing

**Solution**:
1. Ensure `NEXT_PUBLIC_MIXPANEL_TOKEN` is set
2. Check that `Analytics` component is wrapping your app in `layout.tsx`
3. Verify the `mixpanel-browser` package is installed

**Verify**:
```bash
npm list mixpanel-browser
```

### Issue 3: Events in Console But Not in Mixpanel Dashboard

**Possible causes**:
1. **Wrong token**: Using a different project's token
2. **Adblockers**: Browser extensions blocking Mixpanel
3. **CORS issues**: If using a proxy, check CORS configuration
4. **Time delay**: Events can take 1-2 minutes to appear

**Solutions**:
- Verify the token matches your Mixpanel project
- Disable adblockers (uBlock Origin, Privacy Badger, etc.)
- Check browser console for CORS errors
- Wait 2-3 minutes and refresh Mixpanel dashboard

### Issue 4: Events Showing But No User Identity

**Cause**: `trackUserAttributes` not being called after login

**Solution**: This should be automatically called after successful login. To debug:

```javascript
// Check if user is identified in browser console
console.log('Mixpanel User:', window.mixpanel?.get_distinct_id());
console.log('User Properties:', window.mixpanel?.people);
```

If returning anonymous ID, check:
1. Login flow in `AuthFlow.tsx` line ~307
2. Profile setup in `ProfileSetup.tsx` line ~95

## Debug Helper Component

Add this component temporarily to debug analytics:

```tsx
// app/components/AnalyticsDebug.tsx
"use client";

import { useEffect } from "react";
import useAnalytics from "../hooks/useAnalytics";

export function AnalyticsDebug() {
  const analytics = useAnalytics();

  useEffect(() => {
    console.log("=== MIXPANEL DEBUG ===");
    console.log("Token:", process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ? "SET" : "MISSING");
    console.log("Version:", process.env.NEXT_PUBLIC_VERSION);
    console.log("Mixpanel object:", window.mixpanel);
    console.log("=====================");

    // Test event
    analytics.trackPage({
      pageName: "debug_test",
      params: { timestamp: Date.now() }
    });
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'black',
      color: 'lime',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      borderRadius: '4px'
    }}>
      Analytics Debug Active
      <br />
      Token: {process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ? '✅ SET' : '❌ MISSING'}
    </div>
  );
}
```

Add to your page:
```tsx
import { AnalyticsDebug } from "./components/AnalyticsDebug";

// In your component
{process.env.NODE_ENV === 'development' && <AnalyticsDebug />}
```

## Events Currently Tracked

### Auth Page
- `page_load` - Auth page viewed
- `button_click` - Google sign in, Email continue
- `button_click` - Terms of Service, Privacy Policy links
- `api_response` - OTP send success/failure

### OTP Page
- `page_load` - OTP page viewed
- `button_click` - Verify OTP, Resend OTP, Different email
- `api_response` - OTP verify success/failure

### Profile Setup Page
- `page_load` - Profile setup page viewed
- `button_click` - Proceed button
- `api_response` - Update profile success/failure

### Documents Upload Page
- `page_load` - Documents page viewed
- `button_click` - Upload statement, Remove document, See Oneview
- `button_click` - Download instructions modal (open, close, broker select)
- `button_click` - Oneview info modal (open, close, create)
- `api_response` - Upload success/failure, Delete success/failure

## Useful Mixpanel Queries

Once events are flowing, try these queries in Mixpanel:

1. **User Journey**: Events > Insights > Funnel
   - Step 1: `page_load` where `page_name = auth_page`
   - Step 2: `api_response` where `event_name = verify_otp_success`
   - Step 3: `page_load` where `page_name = documents_upload_page`

2. **Error Tracking**: Events > Insights > Segmentation
   - Event: `api_response`
   - Filter: `event_name contains failure`
   - Group by: `error`

3. **User Properties**: Users > Cohorts
   - View identified users with email, name, mobile

## Support

If you're still having issues:
1. Check all console errors (including Network tab)
2. Verify the Mixpanel project is not in "test mode"
3. Check Mixpanel service status: https://status.mixpanel.com/
4. Review Mixpanel documentation: https://docs.mixpanel.com/
