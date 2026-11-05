import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/Buttons';
import { EdgeFade } from '@/components/EdgeFade';
import { CloseIcon } from '@/components/Icons';
import { PressableScale } from '@/components/PressableScale';
import { getMeta } from '@/db/meta';
import { useContentColumn } from '@/hooks/useContentColumn';
import { colors, layout, radius, size, space, type } from '@/theme';

import { bestLiftChoices, setBestLiftChoice, topLiftId } from './data';
import { renderWidget, widgetDb } from './render';

type Choice = { id: string; name: string; best: string | null };

// Opens when a Best lift widget is added (and from "Reconfigure" later). Pick one lift;
// the heaviest you've logged is picked to begin with. Runs in its own Android activity,
// outside the app's navigator, so it loads its own fonts and safe area.
export function BestLiftConfig({ widgetInfo, renderWidget: draw, setResult }: WidgetConfigurationScreenProps) {
  const [fontsLoaded] = useFonts({ Michroma_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const { isWide } = useContentColumn();

  useEffect(() => {
    (async () => {
      const db = await widgetDb();
      const current = await getMeta(db, `widget.best.${widgetInfo.widgetId}`);
      const list = await bestLiftChoices(db);
      setEditing(current !== null);
      setPicked(current ?? (await topLiftId(db)) ?? list[0]?.id ?? null);
      setChoices(list);
    })().catch(() => setChoices([]));
  }, [widgetInfo.widgetId]);

  const save = async () => {
    setBusy(true);
    try {
      const db = await widgetDb();
      if (picked) await setBestLiftChoice(db, widgetInfo.widgetId, picked);
      draw(await renderWidget('BestLift', widgetInfo));
      setResult('ok');
    } catch {
      setBusy(false);
    }
  };

  if (!fontsLoaded || !choices) return <View style={styles.root} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <View style={[styles.column, isWide && styles.columnWide]}>
          <View style={styles.header}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setResult('cancel')}
              style={styles.close}
            >
              <CloseIcon />
            </PressableScale>
            <Text style={styles.label}>Best lift</Text>
            <View style={styles.headerEnd} />
          </View>

          <Text style={styles.title}>Pick a lift</Text>

          {choices.length === 0 ? (
            <Text style={styles.meta}>
              Nothing logged yet. The widget will show your top lift once you have one.
            </Text>
          ) : (
            <View style={styles.fill}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                {choices.map((c) => {
                  const on = c.id === picked;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setPicked(c.id)}
                      style={styles.row}
                    >
                      <View style={styles.rowText}>
                        <Text style={styles.rowName}>{c.name}</Text>
                        <Text style={styles.meta}>{c.best ? `Best ${c.best}` : 'In your plan, not logged yet'}</Text>
                      </View>
                      <View style={[styles.radio, on && styles.radioOn]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <EdgeFade edge="bottom" />
            </View>
          )}

          {choices.length === 0 && <View style={styles.fill} />}
          <PrimaryButton label={editing ? 'Save' : 'Add widget'} onPress={save} disabled={busy} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  column: { flex: 1, width: '100%', padding: space[4], gap: space[4] },
  columnWide: { maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  close: {
    width: size.tapTarget,
    height: size.tapTarget,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.labelWide, color: colors.inkMuted, flexShrink: 1, textAlign: 'center' },
  headerEnd: { width: size.tapTarget },
  title: { ...type.title, color: colors.ink },
  fill: { flex: 1 },
  list: { paddingBottom: layout.fadeY },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: size.buttonPrimary,
    paddingVertical: space[2],
    borderBottomWidth: size.divider,
    borderBottomColor: colors.hairline,
  },
  rowText: { flex: 1, gap: space[1] },
  rowName: { ...type.bodyStrong, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  radio: {
    width: size.radio,
    height: size.radio,
    borderRadius: size.radio / 2,
    borderWidth: size.ring,
    borderColor: colors.inkFaint,
  },
  radioOn: { borderWidth: size.radio * 0.3, borderColor: colors.spotterRed, backgroundColor: colors.ink },
});
