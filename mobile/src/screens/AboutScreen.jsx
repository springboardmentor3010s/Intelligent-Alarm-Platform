// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { SysLabel, SectionHeader, ConnectRow } from '../components/ui';

const LOGO_DARK = require('../../assets/logos/WideDark.webp');
const LOGO_LIGHT = require('../../assets/logos/WideLight.webp');

const LINKS = [
  {
    icon: 'mail-outline',
    label: 'Email',
    sublabel: 'iampawansimha.2004@gmail.com',
    url: 'mailto:iampawansimha.2004@gmail.com',
  },
  { icon: 'logo-github', label: 'GitHub', sublabel: 'github.com/PawanSimha', url: 'https://github.com/PawanSimha' },
  { icon: 'logo-linkedin', label: 'LinkedIn', sublabel: 'linkedin.com/in/pawansimha', url: 'https://www.linkedin.com/in/pawansimha' },
  { icon: 'globe-outline', label: 'Portfolio', sublabel: 'portfolio-pawansimha.vercel.app', url: 'https://portfolio-pawansimha.vercel.app' },
  { icon: 'logo-google', label: 'Google Developer', sublabel: 'g.dev/pawansimha', url: 'https://g.dev/pawansimha' },
];

const SKILLS = [
  'React Native',
  'Expo',
  'React',
  'Python',
  'FastAPI',
  'SQLAlchemy',
  'PostgreSQL',
  'Machine Learning',
  'PyTorch',
  'Mobile UX',
];

export default function AboutScreen({ navigation }) {
  const { colors, resolved, fonts } = useTheme();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Image
        source={resolved === 'light' ? LOGO_LIGHT : LOGO_DARK}
        style={styles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="CerebroKognit"
      />
      <SysLabel icon="information-circle-outline" tone="violet">About the project</SysLabel>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.displayBold }]}>About CerebroKognit</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.bio, { color: colors.textMuted }]}>
          CerebroKognit is an intelligent cognitive alarm and habit platform. Every alarm is a wake-up drill: a short
          challenge you solve to dismiss it, so you are genuinely awake before the day starts.
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.bio, { color: colors.textMuted }]}>
          Built by Pawan Simha, MCA student at Sapthagiri NPS University, as part of the Infosys Virtual Internship 7.0
          program. Project mentor: Shanmukha Priya.
        </Text>
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Technical stack</SectionHeader>
      <View style={styles.chipWrap}>
        {SKILLS.map((skill) => (
          <View key={skill} style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.borderStrong }]}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{skill}</Text>
          </View>
        ))}
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Connect</SectionHeader>
      {LINKS.map((l) => (
        <ConnectRow key={l.label} icon={l.icon} label={l.label} sublabel={l.sublabel} url={l.url} accessibilityLabel={`${l.label} - CerebroKognit project owner`} />
      ))}
      <View style={[styles.mentorRow, { borderColor: colors.violetGlow }]}>
        <Ionicons name="school-outline" size={20} color={colors.violet} />
        <Text style={[styles.mentorText, { color: colors.textMuted }]}>
          Mentored by Shanmukha Priya under the Infosys Virtual Internship 7.0.
        </Text>
      </View>

      <SectionHeader tone="violet" style={styles.sectionHeader}>Your voice</SectionHeader>
      <TouchableOpacity
        style={[styles.feedbackRow, { backgroundColor: colors.violetSoft, borderColor: colors.violet }]}
        onPress={() => navigation.navigate('Feedback')}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.violet} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.feedbackLabel, { color: colors.text }]}>Send feedback</Text>
          <Text style={[styles.feedbackDesc, { color: colors.textMuted }]}>Report a bug, request a feature, or say thanks</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.violet} />
      </TouchableOpacity>

      <Text style={[styles.footer, { color: colors.textFaint, fontFamily: fonts.monoMedium }]}>
        CEREBROKOGNIT · VER 1.0 · INFOSYS INTERNSHIP 7.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  brandLogo: { width: 180, height: 44, marginTop: 8, marginBottom: 10, alignSelf: 'flex-start' },
  title: { fontSize: 26, marginTop: 6, marginBottom: 18 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 18 },
  bio: { fontSize: 14, lineHeight: 21 },
  divider: { height: 1, marginVertical: 14 },
  sectionHeader: { marginTop: 6, marginBottom: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '600' },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  mentorText: { flex: 1, fontSize: 13, lineHeight: 19 },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  feedbackLabel: { fontSize: 15, fontWeight: '700' },
  feedbackDesc: { fontSize: 12, marginTop: 2 },
  footer: { textAlign: 'center', marginTop: 22, fontSize: 10, letterSpacing: 1.4 },
});