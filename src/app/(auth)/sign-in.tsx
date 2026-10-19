import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScaffold, Divider } from '@/components/auth/auth-scaffold';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { Spacing } from '@/constants/theme';
import { getClerkErrorMessage } from '@/lib/clerk-errors';

type Step = 'email' | 'password' | 'register' | 'mfa' | 'verify';

/** Second-factor strategies we support, in the order we prefer to offer them. */
type MfaStrategy = 'totp' | 'phone_code' | 'email_code' | 'backup_code';
const MFA_PRIORITY: MfaStrategy[] = ['totp', 'phone_code', 'email_code', 'backup_code'];

const MFA_COPY: Record<MfaStrategy, { subtitle: string; label: string; numeric: boolean }> = {
  totp: {
    subtitle: 'Enter the code from your authenticator app.',
    label: 'Authenticator code',
    numeric: true,
  },
  phone_code: {
    subtitle: 'Enter the code we texted to your phone.',
    label: 'SMS code',
    numeric: true,
  },
  email_code: {
    subtitle: 'Enter the code we emailed you.',
    label: 'Email code',
    numeric: true,
  },
  backup_code: {
    subtitle: 'Enter one of your backup codes.',
    label: 'Backup code',
    numeric: false,
  },
};

function pickSecondFactor(factors: { strategy: string }[]): MfaStrategy | null {
  const available = new Set(factors.map((f) => f.strategy));
  return MFA_PRIORITY.find((s) => available.has(s)) ?? null;
}

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetToEmail = () => {
    setStep('email');
    setPassword('');
    setCode('');
    setMfaStrategy(null);
    setError(null);
  };

  // Step 1 — figure out whether this email already has an account.
  const onContinueEmail = async () => {
    if (loading || !email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() });
      if (!createError) {
        setStep('password');
      } else if (createError.code === 'form_identifier_not_found') {
        setStep('register');
      } else {
        setError(getClerkErrorMessage(createError, 'Something went wrong. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — existing account: password sign-in.
  const onSignIn = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error: passwordError } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });
      if (passwordError) {
        setError(getClerkErrorMessage(passwordError, 'Incorrect password. Please try again.'));
        return;
      }

      // `finalize()` only works once the sign-in is complete — guard it so it can't throw.
      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(getClerkErrorMessage(finalizeError, 'Could not complete sign-in. Please try again.'));
          return;
        }
        router.replace('/');
      } else if (signIn.status === 'needs_second_factor') {
        await startSecondFactor();
      } else {
        setError(`Could not complete sign-in (status: ${signIn.status}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Transition into the 2FA step, sending a code first if the method requires it.
  // Assumes the caller already set `loading` and cleared `error`.
  const startSecondFactor = async (strategy?: MfaStrategy) => {
    const chosen = strategy ?? pickSecondFactor(signIn.supportedSecondFactors);
    if (!chosen) {
      setError('Your account needs a second factor this app does not support yet.');
      return;
    }
    if (chosen === 'phone_code' || chosen === 'email_code') {
      const send = chosen === 'phone_code' ? signIn.mfa.sendPhoneCode : signIn.mfa.sendEmailCode;
      const { error: sendError } = await send();
      if (sendError) {
        setError(getClerkErrorMessage(sendError, 'Could not send a verification code. Please try again.'));
        return;
      }
    }
    setCode('');
    setMfaStrategy(chosen);
    setStep('mfa');
  };

  // 2FA step — verify the second-factor code and finalize.
  const onVerifyMfa = async () => {
    if (loading || !mfaStrategy) return;
    setError(null);
    setLoading(true);
    try {
      const trimmed = code.trim();
      const verify = () => {
        switch (mfaStrategy) {
          case 'phone_code':
            return signIn.mfa.verifyPhoneCode({ code: trimmed });
          case 'email_code':
            return signIn.mfa.verifyEmailCode({ code: trimmed });
          case 'backup_code':
            return signIn.mfa.verifyBackupCode({ code: trimmed });
          case 'totp':
          default:
            return signIn.mfa.verifyTOTP({ code: trimmed });
        }
      };
      const { error: verifyError } = await verify();
      if (verifyError) {
        setError(getClerkErrorMessage(verifyError, 'Invalid or expired code. Please try again.'));
        return;
      }
      if (signIn.status !== 'complete') {
        setError(`Could not complete sign-in (status: ${signIn.status}).`);
        return;
      }
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) {
        setError(getClerkErrorMessage(finalizeError, 'Could not complete sign-in. Please try again.'));
        return;
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — new account: create with name + password.
  const onRegister = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error: passwordError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (passwordError) {
        setError(getClerkErrorMessage(passwordError, 'Unable to create your account. Please try again.'));
        return;
      }

      if (signUp.status === 'complete') {
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(getClerkErrorMessage(finalizeError, 'Could not complete sign-up. Please try again.'));
          return;
        }
        router.replace('/');
        return;
      }

      // Email verification required before the account can be activated.
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(getClerkErrorMessage(sendError, 'Could not send a verification code. Please try again.'));
        return;
      }
      setStep('verify');
    } finally {
      setLoading(false);
    }
  };

  // Optional step — confirm the email verification code.
  const onVerify = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verifyError) {
        setError(getClerkErrorMessage(verifyError, 'Invalid or expired code. Please try again.'));
        return;
      }
      if (signUp.status !== 'complete') {
        setError('Additional information is required to finish signing up.');
        return;
      }
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setError(getClerkErrorMessage(finalizeError, 'Could not complete sign-up. Please try again.'));
        return;
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const errorRow = error ? (
    <ThemedText type="small" style={styles.error}>
      {error}
    </ThemedText>
  ) : null;

  const changeEmailLink = (
    <Pressable onPress={resetToEmail} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Not {email}? <ThemedText type="smallBold">Use a different email</ThemedText>
      </ThemedText>
    </Pressable>
  );

  const emailField = (
    <ThemedTextInput
      label="Email"
      value={email}
      onChangeText={setEmail}
      placeholder="you@example.com"
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      inputMode="email"
      textContentType="emailAddress"
      editable={step === 'email'}
      onSubmitEditing={onContinueEmail}
      returnKeyType="next"
    />
  );

  if (step === 'password') {
    return (
      <AuthScaffold title="Welcome back" subtitle="Enter your password to sign in.">
        <View style={styles.form}>
          {emailField}
          <ThemedTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            autoFocus
            onSubmitEditing={onSignIn}
            returnKeyType="go"
          />
          {errorRow}
          <Button label="Sign in" onPress={onSignIn} loading={loading} />
          {changeEmailLink}
        </View>
      </AuthScaffold>
    );
  }

  if (step === 'register') {
    return (
      <AuthScaffold title="Create your account" subtitle="Just a few details to get started.">
        <View style={styles.form}>
          {emailField}
          <View style={styles.nameRow}>
            <View style={styles.flex}>
              <ThemedTextInput
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Janez"
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                autoFocus
              />
            </View>
            <View style={styles.flex}>
              <ThemedTextInput
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Novak"
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
              />
            </View>
          </View>
          <ThemedTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={onRegister}
            returnKeyType="go"
          />
          {errorRow}
          <Button label="Create account" onPress={onRegister} loading={loading} />
          {changeEmailLink}
        </View>
      </AuthScaffold>
    );
  }

  if (step === 'mfa') {
    const copy = mfaStrategy ? MFA_COPY[mfaStrategy] : MFA_COPY.totp;
    const canUseBackup =
      mfaStrategy !== 'backup_code' &&
      signIn.supportedSecondFactors?.some((f) => f.strategy === 'backup_code');

    const onUseBackupCode = async () => {
      if (loading) return;
      setError(null);
      setLoading(true);
      try {
        await startSecondFactor('backup_code');
      } finally {
        setLoading(false);
      }
    };

    return (
      <AuthScaffold title="Two-step verification" subtitle={copy.subtitle}>
        <View style={styles.form}>
          <ThemedTextInput
            label={copy.label}
            value={code}
            onChangeText={setCode}
            placeholder={copy.numeric ? '123456' : 'XXXXX-XXXXX'}
            keyboardType={copy.numeric ? 'number-pad' : 'default'}
            inputMode={copy.numeric ? 'numeric' : 'text'}
            autoCapitalize="none"
            autoComplete={copy.numeric ? 'one-time-code' : 'off'}
            textContentType={copy.numeric ? 'oneTimeCode' : 'none'}
            autoFocus
            onSubmitEditing={onVerifyMfa}
            returnKeyType="go"
          />
          {errorRow}
          <Button label="Verify" onPress={onVerifyMfa} loading={loading} />
          {canUseBackup ? (
            <Pressable onPress={onUseBackupCode} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                Can&apos;t access it? <ThemedText type="smallBold">Use a backup code</ThemedText>
              </ThemedText>
            </Pressable>
          ) : null}
          {changeEmailLink}
        </View>
      </AuthScaffold>
    );
  }

  if (step === 'verify') {
    return (
      <AuthScaffold title="Check your email" subtitle={`We sent a 6-digit code to ${email}.`}>
        <View style={styles.form}>
          <ThemedTextInput
            label="Verification code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            onSubmitEditing={onVerify}
            returnKeyType="go"
          />
          {errorRow}
          <Button label="Verify email" onPress={onVerify} loading={loading} />
          {changeEmailLink}
        </View>
      </AuthScaffold>
    );
  }

  // step === 'email'
  return (
    <AuthScaffold title="Welcome" subtitle="Sign in or create an account to continue.">
      <View style={styles.form}>
        {emailField}
        {errorRow}
        <Button label="Continue" onPress={onContinueEmail} loading={loading} disabled={!email.trim()} />
      </View>

      <Divider label="or" />
      <GoogleButton onError={setError} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  error: {
    color: '#D64545',
  },
  centered: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
