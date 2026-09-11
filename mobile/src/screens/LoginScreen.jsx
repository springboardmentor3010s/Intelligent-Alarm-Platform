import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { BrandLockup } from '../components/ui';

export default function LoginScreen() {
  const { login } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
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

  return (
    <View style={styles.container}>
      <View style={styles.brandWrap}>
        <BrandLockup icon="flash" wordmark="CerebroKognit" wordmarkSize={22} />
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
          accessibilityLabel="Email"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={[ui.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={ui.inputPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
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
      </View>

      <Text style={[styles.foot, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
        Demo session: <Text style={[styles.footAccent, { color: colors.violet }]}>demo@cerebro.com</Text>
      </Text>
      <Text style={[styles.credit, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>Built by Pawan Simha · Infosys Internship 7.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', padding: 24 },
  brandWrap: { alignItems: 'center', marginBottom: 24 },
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
});