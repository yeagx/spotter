import { Redirect, Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyIcon, PlanIcon, TodayIcon } from '@/components/TabIcons';
import { Tour } from '@/components/Tour';
import { getMeta, setMeta } from '@/db/meta';
import { getSplit } from '@/db/plan';
import { useContentColumn } from '@/hooks/useContentColumn';
import { useProfile } from '@/state/profile';
import { colors, size, space, type } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { inset } = useContentColumn();
  const { fontScale } = useWindowDimensions();
  const { profile } = useProfile();
  const db = useSQLiteContext();
  // The guided tour runs once, the first time the tabs open after onboarding.
  const [tour, setTour] = useState<{ hasSplit: boolean } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      if (await getMeta(db, TOUR_KEY)) return;
      const split = await getSplit(db);
      if (active) setTour({ hasSplit: Boolean(split) });
    })();
    return () => {
      active = false;
    };
  }, [db, profile]);

  const endTour = () => {
    setTour(null);
    setMeta(db, TOUR_KEY, String(Date.now()));
  };

  // The bar needs a numeric height: its inner row is flex: 1, which collapses to 0 on
  // native under an auto-height parent. Sum the parts, scaling the label with the
  // system font size so large text grows the bar instead of clipping.
  const tabBarHeight =
    space[2] +
    size.icon +
    space[1] +
    Math.ceil(type.tabLabel.lineHeight * fontScale) +
    space[2] +
    insets.bottom;

  // First open: no profile yet, so onboarding comes first. The launch animation covers
  // the moment while the profile loads.
  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/onboarding" />;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.ground },
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarLabelStyle: { ...type.tabLabel, marginTop: space[1] },
          // Same stacked layout on phones and tablets; the default goes side-by-side when wide.
          tabBarLabelPosition: 'below-icon',
          // Pin the item's internals to theme values so tabBarHeight above is exact.
          tabBarItemStyle: { padding: 0 },
          tabBarIconStyle: { width: size.icon, height: size.icon },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.hairline,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: space[2],
            paddingBottom: insets.bottom + space[2],
            // Keep the tabs inside the centered content column on wide screens.
            paddingLeft: Math.max(insets.left, space[4], inset),
            paddingRight: Math.max(insets.right, space[4], inset),
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Today', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }}
        />
        <Tabs.Screen
          name="plan"
          options={{ title: 'Plan', tabBarIcon: ({ color }) => <PlanIcon color={color} /> }}
        />
        <Tabs.Screen
          name="body"
          options={{ title: 'Body', tabBarIcon: ({ color }) => <BodyIcon color={color} /> }}
        />
      </Tabs>
      {tour && <Tour tabBarHeight={tabBarHeight} hasSplit={tour.hasSplit} onFinish={endTour} />}
    </>
  );
}

const TOUR_KEY = 'tour_done';
