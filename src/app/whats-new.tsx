import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { FadeScrollView } from '@/components/FadeScrollView';
import { SlantBar } from '@/components/Slant';
import { StackScreen } from '@/components/StackScreen';
import { rise, stagger } from '@/lib/motion';
import { APP_VERSION } from '@/lib/updates';
import { currentNotes, markNotesSeen, notesSince } from '@/lib/whatsNew';
import { colors, size, space, type } from '@/theme';

// What's new: opens once on the first launch after an update with notes (from the tabs
// layout, with `since` = the last version seen), or from Profile for this version only.
export default function WhatsNewScreen() {
  const db = useSQLiteContext();
  const { since } = useLocalSearchParams<{ since?: string }>();
  const current = currentNotes();
  const entries = since ? notesSince(since) : current ? [current] : [];
  const several = entries.length > 1;

  // Seen as soon as it's on screen, however it's closed (button, X or back gesture).
  useEffect(() => {
    markNotesSeen(db);
  }, [db]);

  let i = 0;
  return (
    <StackScreen
      label="What’s new"
      close
      footer={<PrimaryButton label="Got it" onPress={() => router.back()} />}
    >
      <FadeScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={rise(80)} style={styles.hero}>
          <Text style={styles.version} numberOfLines={1} adjustsFontSizeToFit>
            v{APP_VERSION}
          </Text>
          <Text style={styles.meta}>Spotter is up to date.</Text>
        </Animated.View>

        {entries.length === 0 && (
          <Text style={styles.meta}>Small fixes in this version. Nothing new to learn.</Text>
        )}

        {entries.map((entry) => (
          <View key={entry.version} style={styles.section}>
            {several && (
              <Animated.Text entering={rise(stagger(i, 160))} style={styles.label}>
                v{entry.version}
              </Animated.Text>
            )}
            {entry.items.map((item) => (
              <Animated.View key={item.title} entering={rise(stagger(i++, 160))} style={styles.item}>
                <View style={styles.mark}>
                  <SlantBar width={size.cueMarkWidth} height={size.cueMarkHeight} color={colors.inkMuted} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{item.line}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        ))}
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[8], paddingTop: space[2] },
  hero: { gap: space[2] },
  version: { ...type.numeralL, color: colors.ink },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  section: { gap: space[4] },
  item: { flexDirection: 'row', gap: space[3] },
  // Lines the slanted mark up with the first line of the title.
  mark: { paddingTop: space[1] },
  itemText: { flex: 1, gap: space[1] },
  itemTitle: { ...type.bodyStrong, color: colors.ink },
});
