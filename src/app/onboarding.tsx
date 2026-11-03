import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/Buttons';
import { FOOTER_CLEARANCE, FadeScrollView } from '@/components/FadeScrollView';
import { CameraIcon } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { PinnedFooter } from '@/components/PinnedFooter';
import { NumberField } from '@/components/NumberField';
import { PressableScale } from '@/components/PressableScale';
import { Segmented } from '@/components/Segmented';
import { SlantBar, SlantStrip } from '@/components/Slant';
import { TargetsForm, readTargets, type TargetsDraft } from '@/components/TargetsForm';
import { saveCheckin } from '@/db/checkins';
import { createProfile, type Goal, type Sex } from '@/db/profile';
import { useContentColumn } from '@/hooks/useContentColumn';
import { inLimits } from '@/lib/body';
import { DEFAULT_TRAINING_DAYS, estimateCalories } from '@/lib/calories';
import { notify } from '@/lib/confirm';
import { localDate } from '@/lib/dates';
import { rise, stagger } from '@/lib/motion';
import { pickProfilePhoto } from '@/lib/photo';
import { parseDecimal, parseWhole } from '@/lib/units';
import { useProfile } from '@/state/profile';
import { colors, layout, radius, size, space, type } from '@/theme';

const STEPS = 4;

const GOALS: { id: Goal; title: string; sub: string }[] = [
  { id: 'lean', title: 'Get lean', sub: 'Lose fat, keep your muscle.' },
  { id: 'healthy', title: 'Stay healthy', sub: 'Train consistently, hold your shape.' },
];

type Body = { weight: string; fat: string; muscle: string; bmr: string };

// What Spotter is, said once before any questions.
const PROMISES = [
  { title: 'Your plan', line: 'Pick the days you train and what you do on each.' },
  { title: 'What each exercise looks like', line: 'A silent demo loop and three form cues, right in the workout.' },
  { title: 'How your body is changing', line: 'Weight and scan results as one calm trend.' },
];

const TITLES = [
  'What should we call you?',
  'What are you training for?',
  'Your starting point.',
  'Where you’re heading.',
];

// One line on why each step asks what it asks.
const WHY = [
  'Your name greets you on Today. A photo is optional; it can go on your monthly recap.',
  'This sets your daily calorie target. Change it anytime in Profile.',
  'Only weight is needed. Add the rest from an InBody scan, now or later.',
  'All optional. Change it anytime.',
];

// First open: a welcome that says what Spotter is, then four steps (name and photo,
// goal, starting point, targets), then Today with a short guided tour.
// Weights here are kg; units can be switched to lb later in Profile.
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const { reload } = useProfile();
  const { isWide } = useContentColumn();
  const [step, setStep] = useState(0); // 0 is the welcome
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal>('lean');
  const [sex, setSex] = useState<Sex | null>(null);
  const [body, setBody] = useState<Body>({ weight: '', fat: '', muscle: '', bmr: '' });
  const [targets, setTargets] = useState<TargetsDraft>({
    targetKg: '',
    targetFat: '',
    mode: 'estimate',
    kcal: '',
  });
  const [busy, setBusy] = useState(false);
  const saving = useRef(false); // a double tap must never create two profiles

  // Parsed starting point; null for anything empty or unreadable.
  const num = (s: string, whole = false) => (s.trim() ? (whole ? parseWhole(s) : parseDecimal(s)) : null);
  const weight = num(body.weight);
  const fat = num(body.fat);
  const muscle = num(body.muscle);
  const bmr = num(body.bmr, true);
  const estimate = estimateCalories(
    { weight: weight ?? 0, fat: fat && inLimits('fat', fat) ? fat : null, bmr: bmr && inLimits('bmr', bmr) ? bmr : null },
    goal,
    DEFAULT_TRAINING_DAYS,
  );

  // Android back steps back through onboarding instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const choosePhoto = async () => {
    try {
      const uri = await pickProfilePhoto();
      if (uri) setPhotoUri(uri);
    } catch {
      notify('Couldn’t add that photo', 'Try another one, or skip it for now.');
    }
  };

  // Checks the starting point before moving on; only weight is required.
  const bodyProblem = (): string | null => {
    if (weight === null || !inLimits('weight', weight)) return 'Enter your weight in kg.';
    const checks: [string, number | null, 'fat' | 'muscle' | 'bmr', string][] = [
      [body.fat, fat, 'fat', 'Body fat'],
      [body.muscle, muscle, 'muscle', 'Muscle'],
      [body.bmr, bmr, 'bmr', 'BMR'],
    ];
    for (const [raw, n, key, label] of checks) {
      if (raw.trim() && (n === null || !inLimits(key, n))) return `${label} looks off. Check the number.`;
    }
    return null;
  };

  const next = () => {
    if (step === 3) {
      const problem = bodyProblem();
      if (problem) {
        notify('Check that again', problem);
        return;
      }
    }
    setStep((s) => Math.min(STEPS, s + 1));
  };

  const finish = async () => {
    const parsed = readTargets(targets, (v) => v, parseDecimal);
    if ('problem' in parsed) {
      notify('Check that again', parsed.problem);
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      // Check-in first, profile last: the profile is what ends onboarding, so a failure
      // in between just means trying again (the check-in is one per day, so no duplicate).
      await saveCheckin(db, {
        date: localDate(),
        weight: weight!,
        bmi: null,
        fat,
        muscle,
        water: null,
        bone: null,
        bmr,
      });
      await createProfile(db, {
        name: name.trim(),
        photoUri,
        goal,
        sex,
        targetKg: parsed.targetKg,
        targetFat: parsed.targetFat,
        calorieMode: targets.mode,
        calorieTarget: parsed.calorieTarget,
      });
      await reload();
      router.replace('/');
    } catch {
      notify('Couldn’t save', 'Something went wrong. Try again.');
      saving.current = false;
      setBusy(false);
    }
  };

  const canContinue =
    step === 1 ? name.trim().length > 0 : step === 3 ? weight !== null && sex !== null : true;

  if (step === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={[styles.column, isWide && styles.columnWide]}>
          <FadeScrollView contentContainerStyle={styles.welcome}>
            <Animated.View entering={rise()}>
              <Logo height={size.logoL} />
            </Animated.View>
            <Animated.View entering={rise(120)} style={styles.heading}>
              <Text style={styles.title}>A quiet gym companion.</Text>
              <Text style={styles.sub}>
                Like a good spotter: stays behind you, says little, shows up when it matters.
              </Text>
            </Animated.View>
            <View style={styles.promises}>
              {PROMISES.map((p, i) => (
                <Animated.View key={p.title} entering={rise(stagger(i, 260))} style={styles.promise}>
                  <View style={styles.promiseMark}>
                    <SlantBar width={size.cueMarkWidth} height={size.cueMarkHeight} color={colors.spotterRed} />
                  </View>
                  <View style={styles.promiseText}>
                    <Text style={styles.photoTitle}>{p.title}</Text>
                    <Text style={styles.meta}>{p.line}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
            <Animated.Text entering={rise(500)} style={styles.meta}>
              No account. Everything stays on this phone, and works offline.
            </Animated.Text>
          </FadeScrollView>
          <PinnedFooter>
            <PrimaryButton label="Get started" onPress={() => setStep(1)} />
          </PinnedFooter>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.fill}>
        <View style={[styles.column, isWide && styles.columnWide]}>
          <View style={styles.top}>
            <Animated.View entering={rise()}>
              <Logo height={size.logoS} />
            </Animated.View>
            <View style={styles.progress} accessibilityLabel={`Step ${step} of ${STEPS}`}>
              <SlantStrip
                height={size.stripThin}
                gap={space[1]}
                bars={Array.from({ length: STEPS }, (_, i) => ({
                  color: i === step - 1 ? colors.ink : i < step ? colors.spotterRed : colors.surfaceRaised,
                }))}
              />
            </View>
          </View>

          <FadeScrollView
            key={step}
            contentContainerStyle={styles.content}
            // The footer here also holds Back under the main button.
            bottomOffset={FOOTER_CLEARANCE + size.tapTarget + space[3]}
          >
            <Animated.View entering={rise(100)} style={styles.heading}>
              <Text style={styles.label}>
                {step} / {STEPS}
              </Text>
              <Text style={styles.title}>{TITLES[step - 1]}</Text>
              <Text style={styles.sub}>{WHY[step - 1]}</Text>
            </Animated.View>

            {step === 1 && (
              <>
                <Animated.View entering={rise(160)}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={photoUri ? 'Change profile photo' : 'Add a profile photo (optional)'}
                    onPress={choosePhoto}
                    style={styles.photo}
                  >
                    {photoUri ? (
                      <Avatar name={name} photoUri={photoUri} size={size.avatarM} />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <CameraIcon size={size.icon} />
                      </View>
                    )}
                    <View>
                      <Text style={styles.photoTitle}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
                      <Text style={styles.meta}>Optional</Text>
                    </View>
                  </PressableScale>
                </Animated.View>
                <Animated.View entering={rise(220)} style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    accessibilityLabel="Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={colors.inkFaint}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => canContinue && next()}
                    maxLength={40}
                    selectionColor={colors.inkMuted}
                    cursorColor={colors.ink}
                    style={styles.nameInput}
                  />
                </Animated.View>
              </>
            )}

            {step === 2 && (
              <View style={styles.goals} accessibilityRole="radiogroup">
                {GOALS.map((g, i) => {
                  const on = goal === g.id;
                  return (
                    <Animated.View key={g.id} entering={rise(stagger(i, 100))}>
                      <PressableScale
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        onPress={() => setGoal(g.id)}
                        style={[styles.goal, on && styles.goalOn]}
                      >
                        <View style={styles.goalText}>
                          <Text style={styles.goalTitle}>{g.title}</Text>
                          <Text style={styles.meta}>{g.sub}</Text>
                        </View>
                        <View style={[styles.radio, on && styles.radioOn]} />
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            )}

            {step === 3 && (
              <Animated.View entering={rise(100)} style={styles.field}>
                <Text style={styles.label}>Sex · for normal body ranges</Text>
                <Segmented
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                  ]}
                  value={sex}
                  onChange={setSex}
                />
              </Animated.View>
            )}

            {step === 3 && (
              <View style={styles.grid}>
                {(
                  [
                    ['weight', 'Weight kg', '0.0'],
                    ['fat', 'Body fat %', 'optional'],
                    ['muscle', 'Muscle %', 'optional'],
                    ['bmr', 'BMR kcal', 'optional'],
                  ] as const
                ).map(([key, label, placeholder], i) => (
                  <Animated.View key={key} entering={rise(stagger(i, 160))} style={styles.cell}>
                    <NumberField
                      label={label}
                      value={body[key]}
                      onChangeText={(v) => setBody((b) => ({ ...b, [key]: v }))}
                      placeholder={placeholder}
                      whole={key === 'bmr'}
                    />
                  </Animated.View>
                ))}
              </View>
            )}

            {step === 4 && (
              <TargetsForm draft={targets} onChange={setTargets} estimate={estimate} weightUnit="kg" />
            )}
          </FadeScrollView>

          <PinnedFooter>
            {step < STEPS ? (
              <PrimaryButton label="Continue" onPress={next} disabled={!canContinue} />
            ) : (
              <PrimaryButton label="Lock in" onPress={finish} disabled={busy} />
            )}
            {step > 0 && (
              <Pressable accessibilityRole="button" onPress={() => setStep((s) => s - 1)} style={styles.back}>
                <Text style={styles.backLabel}>Back</Text>
              </Pressable>
            )}
          </PinnedFooter>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  fill: { flex: 1 },
  column: {
    flex: 1,
    width: '100%',
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[4],
    gap: space[8],
  },
  columnWide: { maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { width: '33%' },
  content: { gap: space[8] },
  welcome: { gap: space[8], paddingTop: space[6] },
  promises: { gap: space[4] },
  promise: { flexDirection: 'row', gap: space[3] },
  // Lines the slanted mark up with the first line of the title.
  promiseMark: { paddingTop: space[1] },
  promiseText: { flex: 1, gap: space[1] },
  heading: { gap: space[2] },
  label: { ...type.labelWide, color: colors.inkMuted },
  title: { ...type.titleL, color: colors.ink },
  sub: { ...type.body, color: colors.inkMuted },
  meta: { ...type.caption, color: colors.inkMuted },
  photo: { flexDirection: 'row', alignItems: 'center', gap: space[4], alignSelf: 'flex-start' },
  photoEmpty: {
    width: size.avatarM,
    height: size.avatarM,
    borderRadius: size.avatarM / 2,
    backgroundColor: colors.surface,
    borderWidth: size.ring,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTitle: { ...type.bodyStrong, color: colors.ink },
  field: { gap: space[2] },
  nameInput: {
    ...type.heading,
    fontSize: type.numeralS.fontSize,
    lineHeight: type.numeralS.lineHeight,
    minHeight: size.buttonPrimary,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    color: colors.ink,
  },
  goals: { gap: space[2] },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[4] + space[1],
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: size.ring,
    borderColor: 'transparent',
  },
  goalOn: { backgroundColor: colors.surfaceRaised, borderColor: colors.spotterRed },
  goalText: { flex: 1, gap: space[1] },
  goalTitle: { ...type.button, color: colors.ink },
  // Empty ring when off; a white centre inside a thick red ring when on.
  radio: {
    width: size.radio,
    height: size.radio,
    borderRadius: size.radio / 2,
    borderWidth: size.ring,
    borderColor: colors.inkFaint,
  },
  radioOn: { borderWidth: size.radio * 0.3, borderColor: colors.spotterRed, backgroundColor: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], rowGap: space[4] },
  cell: { flexGrow: 1, flexBasis: '45%' },
  back: { minHeight: size.tapTarget, alignItems: 'center', justifyContent: 'center' },
  backLabel: { ...type.bodyStrong, color: colors.inkMuted },
});
