import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Action, Card, Copy, Heading, Screen, TopBar } from '@/components/steadiifit-ui';
import { SteadiifitColors as C } from '@/constants/theme';
import { useAuth } from '@/state/AuthContext';

export default function AuthScreen() {
  const { status, user, signIn, signUp, signOut } = useAuth();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (creatingAccount) {
        const result = await signUp(email, password);
        if (result.error) setError(result.error.message);
        else if (result.data?.requiresEmailConfirmation) setMessage('Check your email to confirm your account, then sign in.');
        else setMessage('Your account is ready.');
      } else {
        const result = await signIn(email, password);
        if (result.error) setError(result.error.message);
        else setMessage('You are signed in.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await signOut();
      if (result.error) setError(result.error.message);
      else setMessage('You are signed out.');
    } finally {
      setBusy(false);
    }
  };

  return <Screen>
    <TopBar title="Account" back={false} />
    <Heading>Supabase account</Heading>
    <Copy>This account screen is separate from your local Steadiifit profile and onboarding.</Copy>
    <Card style={{ marginTop: 16 }}>
      <Text style={s.label}>Session status</Text>
      <Text style={s.status}>{status === 'loading' ? 'Restoring session…' : user ? `Signed in as ${user.email ?? user.id}` : 'Not signed in'}</Text>
    </Card>

    {!user && status !== 'loading' ? <>
      <View style={s.modeRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !creatingAccount }} onPress={() => { setCreatingAccount(false); setMessage(''); setError(''); }}>
          <Text style={[s.mode, !creatingAccount && s.modeSelected]}>Sign in</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: creatingAccount }} onPress={() => { setCreatingAccount(true); setMessage(''); setError(''); }}>
          <Text style={[s.mode, creatingAccount && s.modeSelected]}>Create account</Text>
        </Pressable>
      </View>
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email address"
        placeholderTextColor={C.muted}
        textContentType="emailAddress"
        value={email}
        style={s.input}
      />
      <TextInput
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoComplete={creatingAccount ? 'new-password' : 'current-password'}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={C.muted}
        secureTextEntry
        textContentType={creatingAccount ? 'newPassword' : 'password'}
        value={password}
        style={s.input}
      />
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
      <Action title={busy ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in'} disabled={busy || !email.trim() || !password} onPress={() => void submit()} />
      <Copy style={s.note}>Passwords are sent directly to Supabase Auth and are not stored by Steadiifit.</Copy>
    </> : null}
    {user ? <>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={s.message}>{message}</Text> : null}
      <Action title={busy ? 'Please wait…' : 'Sign out'} disabled={busy} onPress={() => void handleSignOut()} />
    </> : null}
  </Screen>;
}

const s = StyleSheet.create({
  label: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 12 },
  status: { color: C.ink, fontFamily: 'InterSemiBold', fontSize: 15, marginTop: 5 },
  modeRow: { flexDirection: 'row', gap: 22, marginTop: 18, marginBottom: 4 },
  mode: { color: C.muted, fontFamily: 'InterSemiBold', fontSize: 14, paddingVertical: 9 },
  modeSelected: { color: C.ink, borderBottomWidth: 2, borderBottomColor: C.accent },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, color: C.ink, backgroundColor: C.surface, marginTop: 12, fontSize: 15, fontFamily: 'InterRegular' },
  error: { color: '#A33A2B', fontFamily: 'InterSemiBold', fontSize: 13, marginTop: 12 },
  message: { color: C.green, fontFamily: 'InterSemiBold', fontSize: 13, marginTop: 12 },
  note: { fontSize: 12, marginTop: 12 },
});
