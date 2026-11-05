import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/Buttons';
import { showDialog } from '@/components/DialogHost';
import { FadeScrollView } from '@/components/FadeScrollView';
import { CameraIcon, ChevronRightIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { StackScreen } from '@/components/StackScreen';
import { getSplit } from '@/db/plan';
import type { Sex } from '@/db/profile';
import { notify } from '@/lib/confirm';
import { rise, stagger } from '@/lib/motion';
import { pickProfilePhoto, removeProfilePhoto } from '@/lib/photo';
import { formatNumber } from '@/lib/units';
import { APP_VERSION, checkForUpdate, type UpdateResult } from '@/lib/updates';
import { useProfile, useUnits } from '@/state/profile';
import { colors, radius, size, space, type } from '@/theme';

const FREE_EXERCISE_DB = 'https://github.com/yuhonas/free-exercise-db';

type Check = { state: 'idle' | 'checking' | 'error' } | { state: 'done'; result: UpdateResult };

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const { profile, update } = useProfile();
  const units = useUnits();
  const [name, setName] = useState(profile?.name ?? '');
  const [splitName, setSplitName] = useState<string | null>(null);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      getSplit(db).then((s) => setSplitName(s?.name ?? null));
    }, [db]),
  );

  if (!profile) return null;

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(profile.name); // a name is required; put the old one back
    else if (trimmed !== profile.name) update({ name: trimmed });
  };

  const changePhoto = async () => {
    try {
      const uri = await pickProfilePhoto();
      if (!uri) return;
      const old = profile.photoUri;
      await update({ photoUri: uri });
      removeProfilePhoto(old);
    } catch {
      notify('Couldn’t use that photo', 'Try another one.');
    }
  };

  const chooseSex = async () => {
    const options: Sex[] = ['female', 'male'];
    const i = await showDialog({
      title: 'Sex',
      message: 'Normal ranges for body fat, muscle, water and bone differ for men and women.',
      actions: [
        { label: 'Female', kind: profile.sex === 'female' ? 'primary' : 'neutral' },
        { label: 'Male', kind: profile.sex === 'male' ? 'primary' : 'neutral' },
      ],
    });
    if (i >= 0) update({ sex: options[i] });
  };

  const runCheck = async () => {
    setCheck({ state: 'checking' });
    try {
      setCheck({ state: 'done', result: await checkForUpdate() });
    } catch {
      setCheck({ state: 'error' });
    }
  };

  const targets = [
    profile.targetKg ? `${units.show(profile.targetKg)} ${units.units}` : null,
    profile.targetFat ? `${formatNumber(profile.targetFat)}%` : null,
  ].filter(Boolean);

  const rows: { label: string; value: string; onPress: () => void; hint?: string }[] = [
    {
      label: 'Goal',
      value: profile.goal === 'lean' ? 'Get lean' : 'Stay healthy',
      onPress: () => update({ goal: profile.goal === 'lean' ? 'healthy' : 'lean' }),
      hint: 'Switches between Get lean and Stay healthy',
    },
    {
      label: 'Split',
      value: splitName ?? 'Not set',
      onPress: () => router.push('/edit-split'),
    },
    {
      label: 'Sex',
      value: profile.sex === 'male' ? 'Male' : profile.sex === 'female' ? 'Female' : 'Not set',
      onPress: chooseSex,
      hint: 'Used for the normal ranges on Body',
    },
    {
      label: 'Units',
      value: profile.units,
      onPress: () => update({ units: profile.units === 'kg' ? 'lb' : 'kg' }),
      hint: 'Switches between kilograms and pounds',
    },
    {
      label: 'Targets',
      value: targets.length ? targets.join(' · ') : 'Not set',
      onPress: () => router.push('/targets'),
    },
    {
      label: 'Body check-ins',
      value: 'Body',
      onPress: () => router.navigate('/body'),
    },
  ];

  return (
    <StackScreen label="Profile">
      <FadeScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={rise(80)} style={styles.identity}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={changePhoto}
            style={styles.photo}
          >
            <Avatar name={profile.name} photoUri={profile.photoUri} size={size.avatarL} />
            <View style={styles.badge}>
              <CameraIcon size={size.iconXs} color={colors.onRed} />
            </View>
          </PressableScale>
          <View style={styles.nameBlock}>
            <TextInput
              accessibilityLabel="Name"
              value={name}
              onChangeText={setName}
              onBlur={saveName}
              onSubmitEditing={saveName}
              returnKeyType="done"
              maxLength={40}
              selectionColor={colors.inkMuted}
              cursorColor={colors.ink}
              style={styles.name}
            />
            <Text style={styles.meta}>Tap your name to change it · photo is optional</Text>
          </View>
        </Animated.View>

        <View style={styles.card}>
          {rows.map((r, i) => (
            <Animated.View key={r.label} entering={rise(stagger(i, 160))}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint={r.hint}
                onPress={r.onPress}
                style={[styles.row, i < rows.length - 1 && styles.divider]}
              >
                <Text style={styles.rowLabel}>{r.label}</Text>
                <View style={styles.rowValue}>
                  <Text style={styles.value} numberOfLines={1}>
                    {r.value}
                  </Text>
                  <ChevronRightIcon />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={rise(480)} style={[styles.card, styles.updates]}>
          <View style={styles.updatesHead}>
            <View>
              <Text style={styles.rowLabel}>Updates</Text>
              <Text style={styles.meta}>You have v{APP_VERSION}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={runCheck}
              disabled={check.state === 'checking'}
              style={styles.checkButton}
            >
              <Text style={styles.link}>{check.state === 'checking' ? 'Checking…' : 'Check for updates'}</Text>
            </Pressable>
          </View>
          {check.state === 'error' && (
            <Text style={styles.meta}>Couldn’t reach GitHub. Check your connection and try again.</Text>
          )}
          {check.state === 'done' && check.result.status === 'latest' && (
            <Text style={styles.meta}>You’re on the latest version.</Text>
          )}
          {check.state === 'done' && check.result.status === 'available' && (
            <View style={styles.release}>
              <Text style={styles.releaseTitle}>{check.result.release.version} is out.</Text>
              {check.result.release.notes ? (
                <Text style={styles.notes}>{check.result.release.notes}</Text>
              ) : null}
              <PrimaryButton
                label={`Download ${check.result.release.version}`}
                onPress={() => {
                  if (check.state === 'done' && check.result.status === 'available') {
                    Linking.openURL(check.result.release.url);
                  }
                }}
              />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={rise(510)} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Spot the Spotter, support Spotter"
            onPress={() => router.push('/support')}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Spot the Spotter</Text>
              <Text style={styles.meta}>Support Spotter</Text>
            </View>
            <ChevronRightIcon />
          </Pressable>
        </Animated.View>

        <Animated.View entering={rise(540)} style={styles.about}>
          <Text style={styles.label}>About</Text>
          <Text style={styles.meta}>
            Spotter v{APP_VERSION}. Exercise photos and instructions from{' '}
            <Text style={styles.inlineLink} onPress={() => Linking.openURL(FREE_EXERCISE_DB)} accessibilityRole="link">
              free-exercise-db
            </Text>
            , released into the public domain.
          </Text>
        </Animated.View>
      </FadeScrollView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[8], paddingTop: space[2] },
  identity: { alignItems: 'center', gap: space[4] },
  photo: { width: size.avatarL, height: size.avatarL },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: size.avatarBadge,
    height: size.avatarBadge,
    borderRadius: size.avatarBadge / 2,
    backgroundColor: colors.spotterRed,
    borderWidth: space[1],
    borderColor: colors.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: { alignItems: 'center', gap: space[1], alignSelf: 'stretch' },
  name: {
    ...type.title,
    color: colors.ink,
    textAlign: 'center',
    alignSelf: 'stretch',
    minHeight: size.tapTarget,
    paddingVertical: 0,
  },
  label: { ...type.labelWide, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted, textAlign: 'left' },
  link: { ...type.captionStrong, color: colors.ink },
  inlineLink: { color: colors.ink, textDecorationLine: 'underline' },
  card: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  divider: { borderBottomWidth: size.divider, borderBottomColor: colors.hairline },
  rowLabel: { ...type.bodyStrong, color: colors.ink },
  rowText: { flexShrink: 1, gap: space[1] },
  rowValue: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  value: { ...type.body, color: colors.inkMuted, flexShrink: 1 },
  updates: { padding: space[4], gap: space[3] },
  updatesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  checkButton: { minHeight: size.tapTarget, justifyContent: 'center' },
  release: { gap: space[3] },
  releaseTitle: { ...type.heading, color: colors.ink },
  notes: { ...type.caption, color: colors.inkMuted },
  about: { gap: space[2] },
});
