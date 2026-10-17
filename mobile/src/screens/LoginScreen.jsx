// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useRef, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { isGoogleSignInConfigured } from '../auth/googleAuth';

const LOGO_DARK = require('../../assets/logos/WideDark.webp');
const LOGO_LIGHT = require('../../assets/logos/WideLight.webp');

export default function LoginScreen() {
  const { login, loginWithGoogle } = useAuthContext();
  const { colors, resolved, ui, fonts } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const passwordRef = useRef(null);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      Alert.alert('Sign in', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const result = await login({ email, password });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Sign in failed', result.error || 'Invalid credentials');
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);
    if (!result.success) {
      Alert.alert('Google sign-in', result.error || 'Could not sign in with Google');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandWrap}>
          <Image
            source={resolved === 'light' ? LOGO_LIGHT : LOGO_DARK}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="CerebroKognit"
          />
        </View>

        <View style={styles.badge}>
          <View style={[styles.badgeDot, { backgroundColor: colors.violet }]} accessibilityElementsHidden />
          <Text style={[styles.badgeText, { color: colors.violet, fontFamily: fonts.monoBold }]}>COGNITIVE ALARM SYSTEM</Text>
        </View>

        <Text style={[styles.hero, { color: colors.text, fontFamily: fonts.displayExtra }]}>Wake with purpose.</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Build better habits, one morning at a time.</Text>

        <View style={styles.form}>
          <TextInput
            style={ui.input}
            placeholder="Email"
            placeholderTextColor={ui.inputPlaceholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Email"
          />
          <View style={styles.passwordContainer}>
            <TextInput
              ref={passwordRef}
              style={[ui.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={ui.inputPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textFaint} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={ui.btnPrimary} onPress={handleLogin} disabled={loading} accessibilityRole="button">
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={ui.btnPrimaryText}>Log in</Text>}
          </TouchableOpacity>

          {isGoogleSignInConfigured() && (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              <TouchableOpacity
                style={[styles.googleBtn, { borderColor: colors.border }]}
                onPress={handleGoogle}
                disabled={googleLoading || loading}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.violet} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color={colors.text} />
                    <Text style={[styles.googleBtnText, { color: colors.text, fontFamily: fonts.bodyMedium }]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.foot, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
          Demo session: <Text style={[styles.footAccent, { color: colors.violet }]}>user@gmail.com</Text>
        </Text>
        <Text style={[styles.credit, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>Built by Pawan Simha R · Infosys Internship 7.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brandWrap: { alignItems: 'center', marginBottom: 24 },
  brandLogo: { width: 190, height: 48 },
  badge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14, gap: 8 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  hero: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6, lineHeight: 40 },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32, marginTop: 6 },
  form: { gap: 16 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', padding: 4 },
  foot: { fontSize: 12, textAlign: 'center', marginTop: 28 },
  footAccent: { fontWeight: '600' },
  credit: { fontSize: 11, textAlign: 'center', marginTop: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, letterSpacing: 2 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600' },
});