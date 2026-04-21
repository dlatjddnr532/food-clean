import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AppContextType, AppUser, UserProfile, MealLogEntry,
  MealType, Food, DailyGoals, SignupData, ActivityLevel,
} from '../types';
import { DUMMY_FOODS } from '../data/dummyData';

const AppContext = createContext<AppContextType | null>(null);

// ── 해리스-베네딕트 공식으로 1일 권장량 계산 ──
export function calculateDailyGoals(profile: Partial<UserProfile>): DailyGoals {
  const a = parseFloat(profile.age ?? '25');
  const h = parseFloat(profile.height ?? '170');
  const w = parseFloat(profile.weight ?? '65');
  const gender = profile.gender ?? 'male';
  const activityLevel: ActivityLevel = profile.activityLevel ?? 'moderate';

  const bmr =
    gender === 'male'
      ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
      : 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const tdee = Math.round(bmr * multipliers[activityLevel]);

  return {
    calories: tdee,
    carbs: Math.round((tdee * 0.5) / 4),
    protein: Math.round((tdee * 0.2) / 4),
    fat: Math.round((tdee * 0.3) / 9),
    fiber: 25,
  };
}

// ── 기본 프로필 ──
const DEFAULT_PROFILE: UserProfile = {
  name: '사용자',
  email: '',
  gender: 'male',
  age: '25',
  height: '170',
  weight: '65',
  activityLevel: 'moderate',
};

// ── 테스트 계정 ──
const INITIAL_USERS: AppUser[] = [
  {
    id: 1,
    email: 'test@test.com',
    password: '1234',
    profile: {
      name: '김건강',
      email: 'test@test.com',
      gender: 'male',
      age: '28',
      height: '175',
      weight: '72',
      activityLevel: 'moderate',
    },
  },
];

const todayStr = (): string => new Date().toDateString();

// ── 초기 식단 로그 (테스트용) ──
const INITIAL_LOGS: MealLogEntry[] = [
  { id: 1001, userId: 1, date: todayStr(), mealType: '아침', food: DUMMY_FOODS[6] },
  { id: 1002, userId: 1, date: todayStr(), mealType: '점심', food: DUMMY_FOODS[0] },
];

// ── Provider ──
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>(INITIAL_LOGS);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const login = useCallback(
    (email: string, password: string) => {
      const found = users.find((u) => u.email === email && u.password === password);
      if (found) {
        setCurrentUser(found);
        setIsLoggedIn(true);
        return { success: true, user: found };
      }
      return { success: false };
    },
    [users],
  );

  const signup = useCallback(
    (userData: SignupData) => {
      if (users.find((u) => u.email === userData.email)) {
        return { success: false, message: '이미 사용 중인 이메일입니다.' };
      }
      const newUser: AppUser = {
        id: Date.now(),
        email: userData.email,
        password: userData.password,
        profile: {
          name: userData.name,
          email: userData.email,
          gender: userData.gender,
          age: userData.age,
          height: userData.height,
          weight: userData.weight,
          activityLevel: 'moderate',
        },
      };
      setUsers((prev) => [...prev, newUser]);
      return { success: true };
    },
    [users],
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  }, []);

  const updateProfile = useCallback(
    (newProfile: Partial<UserProfile>) => {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        return { ...prev, profile: { ...prev.profile, ...newProfile } };
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser?.id
            ? { ...u, profile: { ...u.profile, ...newProfile } }
            : u,
        ),
      );
    },
    [currentUser],
  );

  const addMealLog = useCallback(
    (mealType: MealType, food: Food): MealLogEntry => {
      const newLog: MealLogEntry = {
        id: Date.now(),
        userId: currentUser?.id ?? 0,
        date: todayStr(),
        mealType,
        food,
      };
      setMealLogs((prev) => [...prev, newLog]);
      return newLog;
    },
    [currentUser],
  );

  const removeMealLog = useCallback((logId: number) => {
    setMealLogs((prev) => prev.filter((l) => l.id !== logId));
  }, []);

  const toggleFavorite = useCallback((recipeId: number) => {
    setFavoriteIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId],
    );
  }, []);

  const isFavorite = useCallback(
    (recipeId: number) => favoriteIds.includes(recipeId),
    [favoriteIds],
  );

  const todayLogs = mealLogs.filter(
    (l) => l.date === todayStr() && l.userId === currentUser?.id,
  );

  const dailyGoals = calculateDailyGoals(currentUser?.profile ?? DEFAULT_PROFILE);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        currentUser,
        dailyGoals,
        login,
        signup,
        logout,
        updateProfile,
        mealLogs,
        todayLogs,
        addMealLog,
        removeMealLog,
        favoriteIds,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
