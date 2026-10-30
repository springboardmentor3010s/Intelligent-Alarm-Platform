// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel, ChipRow } from '../components/ui';
import { apiFetch, authHeaders, parseApiError } from '../utils/api';

const CATEGORIES = [
  { label: 'Suggestion', slug: 'suggestion', icon: 'bulb-outline' },
  { label: 'Bug report', slug: 'bug_report', icon: 'bug-outline' },
  { label: 'Compliment', slug: 'compliment', icon: 'heart-outline' },
  { label: 'Other', slug: 'other', icon: 'ellipsis-horizontal-circle-outline' },
];

const STAR_LABELS = { 1: 'Rate 1 star', 2: 'Rate 2 stars', 3: 'Rate 3 stars', 4: 'Rate 4 stars', 5: 'Rate 5 stars' };

const MAX_MESSAGE = 2000;

export default function FeedbackScreen({ navigation }) {
  const { user, token } = useAuthContext();
  const { colors, ui, fonts } = useTheme();
  const [category, setCategory] = useState('suggestion');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const canSubmit = message.trim().length > 0 && !submitting;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/feedback', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ category, rating: rating || null, message: message.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setSent(true);
    } catch (e) {
      setError(e.message || 'Could not send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.centerStage, { backgroundColor: colors.bg }]} testID="feedback-success">
        <View style={[styles.successRing, { backgroundColor: colors.violetSoft, borderColor: colors.violet }]}>
          <Ionicons name="checkmark" size={40} color={colors.violet} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text, fontFamily: fonts.displayBold }]}>Feedback sent</Text>
        <Text style={[styles.successDesc, { color: colors.textMuted }]}>
          Thanks for helping shape CerebroKognit. Your message is with the team.
        </Text>
        <TouchableOpacity
          style={ui.btnPrimary}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={ui.btnPrimaryText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="feedback-screen"
      >
        <SysLabel icon="chatbubble-ellipses-outline" tone="violet">Your voice</SysLabel>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>Send feedback</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          What would make CerebroKognit better for you? Replies come through your account email
          ({user?.email || 'set in profile'}).
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>CATEGORY</Text>
        <ChipRow
          options={CATEGORIES.map((c) => c.label)}
          active={CATEGORIES.find((c) => c.slug === category)?.label}
          onSelect={(label) => setCategory(CATEGORIES.find((c) => c.label === label)?.slug || 'other')}
        />

        <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>
          RATING · OPTIONAL
        </Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = value <= rating;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(rating === value ? 0 : value)}
                accessibilityRole="button"
                accessibilityLabel={STAR_LABELS[value]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name={filled ? 'star' : 'star-outline'} size={30} color={filled ? colors.violet : colors.borderStrong} />
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.ratingHint, { color: colors.textFaint }]}>
            {rating ? `${rating} of 5` : 'Tap to rate'}
          </Text>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textFaint, fontFamily: fonts.monoBold }]}>MESSAGE</Text>
        <TextInput
          testID="feedback-message"
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.text }]}
          multiline
          maxLength={MAX_MESSAGE}
          placeholder="Tell us what you think…"
          placeholderTextColor={colors.textFaint}
          value={message}
          onChangeText={setMessage}
          accessibilityLabel="Feedback message"
        />
        <Text style={[styles.counter, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
          {message.length} / {MAX_MESSAGE}
        </Text>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.roseSoft, borderColor: colors.rose }]}>
            <Ionicons name="alert-circle" size={18} color={colors.rose} />
            <Text style={[styles.errorText, { color: colors.rose }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[ui.btnPrimary, !canSubmit && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
        >
          <Text style={ui.btnPrimaryText}>{submitting ? 'Sending…' : 'Send feedback'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  centerStage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 26, marginTop: 6, marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, marginBottom: 10 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingHint: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 130,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, marginTop: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 14 },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600' },
  successRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  successTitle: { fontSize: 24, marginBottom: 8 },
  successDesc: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
});