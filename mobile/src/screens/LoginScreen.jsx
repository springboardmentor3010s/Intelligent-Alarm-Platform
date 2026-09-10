import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { BRAND, ui } from '../theme/tokens';

export default function LoginScreen() {
  const { login } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const result = await login({ email, password });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Invalid credentials');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>COGNITIVE ALARM SYSTEM</Text>
      </View>

      <Text style={styles.title}>CerebroKognit</Text>
      <Text style={styles.subtitle}>Wake with purpose. Build better habits.</Text>

      <View style={styles.form}>
        <TextInput
          style={ui.input}
          placeholder="Email"
          placeholderTextColor={ui.inputPlaceholder}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={[ui.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={ui.inputPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={BRAND.textFaint} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={ui.btnPrimary} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>LOGIN</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.foot}>
        Demo session: <Text style={styles.footAccent}>demo@cerebro.com</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.space, justifyContent: 'center', padding: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 22, gap: 8 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.primary },
  badgeText: { color: BRAND.primary, fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  title: { fontSize: 34, fontWeight: '800', color: BRAND.text, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: BRAND.textFaint, textAlign: 'center', marginBottom: 40, marginTop: 4 },
  form: { gap: 16 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', padding: 4 },
  foot: { color: BRAND.textFaint, fontSize: 12, textAlign: 'center', marginTop: 28 },
  footAccent: { color: BRAND.purpleSoft, fontWeight: '600' },
});