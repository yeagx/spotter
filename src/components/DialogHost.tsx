import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { useContentColumn } from '@/hooks/useContentColumn';
import { rise } from '@/lib/motion';
import { colors, layout, radius, size, space, type } from '@/theme';

// Spotter's own dialog, used instead of the system alert so pop-ups match the app.
// Screens never render it: they call confirmDestructive() / notify() in lib/confirm,
// which queue a request here. One <DialogHost /> sits at the app root.

// 'primary' is the red main action; 'neutral' buttons sit on surface-raised.
export type DialogAction = { label: string; kind: 'neutral' | 'primary' };

export type DialogRequest = {
  title: string;
  message: string;
  actions: DialogAction[]; // left to right; the last one is the main action
  resolve: (index: number) => void; // index of the action, or -1 when dismissed
};

let enqueue: ((r: DialogRequest) => void) | null = null;
const waiting: DialogRequest[] = [];

export function showDialog(request: Omit<DialogRequest, 'resolve'>): Promise<number> {
  return new Promise((resolve) => {
    const full = { ...request, resolve };
    if (enqueue) enqueue(full);
    else waiting.push(full); // before the host mounts; it drains this on mount
  });
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const { isWide } = useContentColumn();

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    if (waiting.length) setQueue((q) => [...q, ...waiting.splice(0)]);
    return () => {
      enqueue = null;
    };
  }, []);

  const current = queue[0];
  const close = (index: number) => {
    current?.resolve(index);
    setQueue((q) => q.slice(1));
  };


  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(-1)}
    >
      {current && (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
            <Pressable
              accessibilityLabel="Dismiss"
              onPress={() => close(-1)}
              style={[StyleSheet.absoluteFill, styles.scrim]}
            />
          </Animated.View>
          <Animated.View
            key={current.title + current.message}
            entering={rise()}
            accessibilityViewIsModal
            accessibilityRole="alert"
            style={[styles.card, isWide && styles.cardWide]}
          >
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.message}>{current.message}</Text>
            <View style={styles.actions}>
              {current.actions.map((a, i) => (
                <PressableScale
                  key={a.label}
                  accessibilityRole="button"
                  onPress={() => close(i)}
                  haptic={a.kind === 'primary' ? 'press' : 'select'}
                  style={[styles.action, a.kind === 'primary' ? styles.primary : styles.neutral]}
                >
                  <Text
                    style={[styles.actionLabel, a.kind === 'primary' && styles.primaryLabel]}
                    numberOfLines={1}
                  >
                    {a.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: space[4] },
  scrim: { backgroundColor: colors.scrim },
  card: {
    gap: space[3],
    padding: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: size.divider,
    borderColor: colors.hairline,
  },
  cardWide: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  title: { ...type.title, color: colors.ink },
  message: { ...type.body, color: colors.inkMuted },
  actions: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
  action: {
    flex: 1,
    minHeight: size.tapTarget + space[1],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  neutral: { backgroundColor: colors.surfaceRaised },
  primary: { backgroundColor: colors.spotterRed },
  actionLabel: { ...type.bodyStrong, color: colors.ink },
  primaryLabel: { fontFamily: type.button.fontFamily, color: colors.onRed },
});
