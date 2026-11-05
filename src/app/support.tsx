import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { OutlineButton, PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { StackScreen } from '@/components/StackScreen';
import { INSTAPAY_URL } from '@/config/support';
import { notify } from '@/lib/confirm';
import { easeOut, rise } from '@/lib/motion';
import { colors, motion, radius, space, type } from '@/theme';

// How long "Copied." stays before it fades away.
const COPIED_MS = 2000;

// Spot the Spotter: the one place support is mentioned. Reached only from Profile;
// nothing else in the app points here.
export default function SupportScreen() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copiedOpacity = useSharedValue(0);
  const copiedStyle = useAnimatedStyle(() => ({ opacity: copiedOpacity.value }));

  useEffect(() => {
    copiedOpacity.value = withTiming(copied ? 1 : 0, {
      duration: motion.fadeMs,
      easing: easeOut,
      reduceMotion: ReduceMotion.System,
    });
  }, [copied, copiedOpacity]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = async () => {
    try {
      await Linking.openURL(INSTAPAY_URL);
    } catch {
      notify('Couldn’t open InstaPay', 'Copy the link and open it yourself.');
    }
  };

  const copy = async () => {
    // Only say "Copied." if it really was.
    if (!(await Clipboard.setStringAsync(INSTAPAY_URL).catch(() => false))) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <StackScreen label="Support">
      <FadeScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Animated.View entering={rise(80)} style={styles.intro}>
            <Text style={styles.title} accessibilityRole="header">
              Spot the Spotter
            </Text>
            <Text style={styles.line}>Spotter spots you every set. If it helped, spot it back.</Text>
            <Text style={styles.muted}>Free forever. Support is optional.</Text>
          </Animated.View>

          <Animated.View entering={rise(200)} style={styles.card}>
            {/* "Copied." is always laid out and only fades, so the card never changes size. */}
            <View style={styles.cardHead}>
              <Text style={styles.label}>InstaPay</Text>
              <Animated.Text
                style={[styles.muted, copiedStyle]}
                accessibilityLiveRegion="polite"
                accessibilityElementsHidden={!copied}
                importantForAccessibility={copied ? 'yes' : 'no-hide-descendants'}
              >
                Copied.
              </Animated.Text>
            </View>
            <PrimaryButton label="Send via InstaPay" onPress={send} />
            <OutlineButton label="Copy link" onPress={copy} icon={null} />
          </Animated.View>
        </View>

        <Animated.Text entering={rise(320)} style={[styles.muted, styles.thanks]}>
          locked in. thank you.
        </Animated.Text>
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  // flexGrow lets the thank-you line sit at the bottom on tall screens and simply
  // follow the card on short ones.
  content: { flexGrow: 1, justifyContent: 'space-between', gap: space[8], paddingTop: space[2] },
  top: { gap: space[6] },
  intro: { gap: space[2] },
  title: { ...type.title, color: colors.ink },
  line: { ...type.body, color: colors.ink },
  muted: { ...type.caption, color: colors.inkMuted },
  card: { borderRadius: radius.md, backgroundColor: colors.surface, padding: space[4], gap: space[3] },
  label: { ...type.labelWide, color: colors.inkMuted },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  thanks: { textAlign: 'center' },
});
