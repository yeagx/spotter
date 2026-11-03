import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getProfile, updateProfile, type Profile } from '@/db/profile';
import { formatWeight, kgToUnit, unitToKg } from '@/lib/units';

type ProfileState = {
  profile: Profile | null | undefined; // undefined while loading, null before onboarding
  reload: () => Promise<void>;
  update: (changes: Partial<Omit<Profile, 'id'>>) => Promise<void>;
};

const ProfileContext = createContext<ProfileState | null>(null);

// One shared copy of the profile, so a change in Profile (units, name, photo) shows
// everywhere at once, and the tabs know whether onboarding is still to do.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>();

  const reload = useCallback(async () => setProfile(await getProfile(db)), [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(
    async (changes: Partial<Omit<Profile, 'id'>>) => {
      if (!profile) return;
      await updateProfile(db, profile.id, changes);
      await reload();
    },
    [db, profile, reload],
  );

  const value = useMemo(() => ({ profile, reload, update }), [profile, reload, update]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const state = useContext(ProfileContext);
  if (!state) throw new Error('useProfile must be used inside ProfileProvider');
  return state;
}

// Weight display and input in the user's units. Everything stored stays in kg.
export function useUnits() {
  const units = useProfile().profile?.units ?? 'kg';
  return useMemo(
    () => ({
      units,
      show: (kg: number) => formatWeight(kg, units),
      fromKg: (kg: number) => kgToUnit(kg, units),
      toKg: (value: number) => unitToKg(value, units),
    }),
    [units],
  );
}
