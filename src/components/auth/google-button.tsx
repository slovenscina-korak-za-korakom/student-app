import { useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { Button } from '@/components/button';
import { useWarmUpBrowser } from '@/hooks/use-warm-up-browser';
import { getClerkErrorMessage } from '@/lib/clerk-errors';

// Dismisses the web browser when an OAuth redirect completes.
WebBrowser.maybeCompleteAuthSession();

type GoogleButtonProps = {
  onError?: (message: string) => void;
};

export function GoogleButton({ onError }: GoogleButtonProps) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      // On success the root auth guard redirects into the app once the session is active.
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // Otherwise additional steps (e.g. MFA) are required — handled when those flows land.
    } catch (err) {
      onError?.(getClerkErrorMessage(err, 'Google sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  return <Button label="Continue with Google" variant="secondary" loading={loading} onPress={onPress} />;
}
