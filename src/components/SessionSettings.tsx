import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { showDialog } from '@/components/DialogHost';
import { Segmented } from '@/components/Segmented';
import type { Profile } from '@/db/profile';
import { dndSupported, hasDndAccess, mediaSupported, musicHint, openDndSettings } from '@/lib/media';
import { colors, radius, size, space, type } from '@/theme';

// "During a session" in Profile: music controls on the workout screen, and Focus mode.
// Focus needs Do Not Disturb access once; this says why and takes you there.
// Absent on builds without the native module (web, an older APK).

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

  // Do Not Disturb access is granted in Settings, so check again on coming back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setDnd(hasDndAccess());
    });
    return () => sub.remove();
  }, []);

  if (!mediaSupported && !dndSupported) return null;

  const setFocusMode = async (on: boolean) => {
    setFocus(on);
    await update({ focusMode: on });
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
});
