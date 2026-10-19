import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  // Keep the splash overlay up until Clerk has resolved the session.
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <AppTabs />;
}
