import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { showDialog } from '@/components/DialogHost';
import { Segmented } from '@/components/Segmented';
import type { Profile } from '@/db/profile';
import { focusShortcutsAdded, setFocusShortcutsAdded } from '@/lib/focus';
import { SETUP_STEPS, SETUP_TITLE, openShortcuts } from '@/lib/focusShortcuts';
import {
  WAVES_ASK,
  allowLevels,
  canHearLevels,
  dndSupported,
  hasDndAccess,
  levelsSupported,
  mediaSupported,
  musicHint,
  openDndSettings,
} from '@/lib/media';
import { colors, radius, size, space, type } from '@/theme';

// "During a session" in Profile: music controls on the workout screen, and Focus mode.
// On Android, Focus needs Do Not Disturb access once; this says why and takes you there.
// On iPhone it runs two shortcuts the user adds once (lib/focusShortcuts.ts); this shows
// how. Music is absent on builds without the native module (web, an older APK).

// iPhone's Focus mode needs no native module, only Shortcuts.
const shortcutFocus = Platform.OS === 'ios';

type Props = {
  profile: Profile;
  update: (changes: Partial<Omit<Profile, 'id'>>) => Promise<void>;
};

const ON_OFF: { value: 'on' | 'off'; label: string }[] = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

export function SessionSettings({ profile, update }: Props) {
  const [music, setMusic] = useState(profile.musicControls);
  const [dnd, setDnd] = useState(hasDndAccess);
  const [focus, setFocus] = useState(profile.focusMode);
  const [waves, setWaves] = useState(canHearLevels);
  const db = useSQLiteContext();
  const [added, setAdded] = useState(true); // the iPhone shortcuts; checked below
  useEffect(() => {
    if (shortcutFocus) focusShortcutsAdded(db).then(setAdded, () => {});
  }, [db]);

  // Do Not Disturb access is granted in Settings, so check again on coming back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setDnd(hasDndAccess());
        setWaves(canHearLevels());
      }
    });
    return () => sub.remove();
  }, []);

  if (!mediaSupported && !dndSupported && !shortcutFocus) return null;

  // Android: live waves need Record audio. Asked here too, for anyone who said Not now;
  // once Android stops asking, its settings page is the way.
  const turnOnWaves = async () => {
    const i = await showDialog({ ...WAVES_ASK, actions: [{ label: 'Not now', kind: 'neutral' }, { label: 'Allow', kind: 'primary' }] });
    if (i !== 1) return;
    if (await allowLevels()) setWaves(true);
    else Linking.openSettings();
  };

  const showSetup = async () => {
    const i = await showDialog({
      title: SETUP_TITLE,
      message: SETUP_STEPS,
      actions: [
        { label: 'Not now', kind: 'neutral' },
        { label: 'Open Shortcuts', kind: 'primary' },
      ],
    });
    if (i === 1) openShortcuts();
  };

  const markAdded = async () => {
    setAdded(true);
    await setFocusShortcutsAdded(db, true);
  };

  const setFocusMode = async (on: boolean) => {
    setFocus(on);
    await update({ focusMode: on });
    if (shortcutFocus) {
      if (on && !added) await showSetup();
      return;
    }
    if (!on || hasDndAccess()) return;
    const i = await showDialog({
      title: 'Allow Do Not Disturb',
      message:
        'Focus mode turns on Do Not Disturb while a session runs and turns it off when you finish. Android asks you to allow that once. Alarms and your rest timer still come through.',
      actions: [
        { label: 'Not now', kind: 'neutral' },
        { label: 'Open settings', kind: 'primary' },
      ],
    });
    if (i === 1) openDndSettings();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>During a session</Text>

      {mediaSupported && (
        <View style={styles.block}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Music</Text>
            <Text style={styles.hint}>{musicHint}</Text>
          </View>
          <Segmented
            options={ON_OFF}
            value={music ? 'on' : 'off'}
            onChange={(v) => {
              setMusic(v === 'on');
              update({ musicControls: v === 'on' });
            }}
          />
          {music && levelsSupported && (
            <Text
              accessibilityRole="button"
              onPress={waves ? undefined : turnOnWaves}
              style={[styles.hint, !waves && styles.link, styles.tap]}
            >
              {waves ? 'The waves follow your music.' : 'Make the waves follow the music'}
            </Text>
          )}
        </View>
      )}

      {shortcutFocus && (
        <View style={styles.block}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Focus mode</Text>
            <Text style={styles.hint}>
              {focus && !added
                ? 'Waiting for the two Focus shortcuts.'
                : 'Your Focus on while a session runs, through two shortcuts. Shortcuts opens for a second as a session starts and ends.'}
            </Text>
          </View>
          <Segmented options={ON_OFF} value={focus ? 'on' : 'off'} onChange={(v) => setFocusMode(v === 'on')} />
          {focus && !added && (
            <View style={styles.links}>
              <Text accessibilityRole="button" onPress={showSetup} style={[styles.hint, styles.link, styles.tap]}>
                How to add them
              </Text>
              <Text accessibilityRole="button" onPress={markAdded} style={[styles.hint, styles.link, styles.tap]}>
                They’re added
              </Text>
            </View>
          )}
          {focus && added && (
            <Text accessibilityRole="button" onPress={showSetup} style={[styles.hint, styles.link, styles.tap]}>
              How the shortcuts work
            </Text>
          )}
        </View>
      )}

      {dndSupported && (
        <View style={styles.block}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Focus mode</Text>
            <Text style={styles.hint}>
              {focus && !dnd
                ? 'Waiting for Do Not Disturb access.'
                : 'Do Not Disturb while a session runs. Alarms and the rest timer still come through.'}
            </Text>
          </View>
          <Segmented options={ON_OFF} value={focus ? 'on' : 'off'} onChange={(v) => setFocusMode(v === 'on')} />
          {focus && !dnd && (
            <Text accessibilityRole="button" onPress={() => openDndSettings()} style={[styles.hint, styles.link, styles.tap]}>
              Allow Do Not Disturb
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: colors.surface, padding: space[4], gap: space[4] },
  title: { ...type.bodyStrong, color: colors.ink },
  block: { gap: space[2] },
  rowText: { flexShrink: 1, gap: space[1] },
  rowLabel: { ...type.body, color: colors.ink },
  hint: { ...type.caption, color: colors.inkMuted },
  link: { color: colors.ink, textDecorationLine: 'underline' },
  tap: { minHeight: size.tapTarget, textAlignVertical: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4] },
});
