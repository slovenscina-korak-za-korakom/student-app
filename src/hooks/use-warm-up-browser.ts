import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

/**
 * Pre-warms the OAuth browser on Android so the SSO flow opens instantly, and
 * cools it down on unmount. No-op on iOS/web. See Clerk's Expo SSO guide.
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
