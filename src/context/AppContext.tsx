// ============================================================
// AppContext.tsx — 앱 전역 상태 관리 (로그인, 식단, 물 섭취 등)
// ============================================================

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, signup as apiSignup, savePhysicalInfo } from '../api/auth';
import { setToken, clearToken } from '../api/config';
import {
  AppContextType, AppUser, UserProfile, MealLogEntry,
  MealType, Food, DailyGoals, SignupData, ActivityLevel, GoalType, UserRecipe,
  Supplement, SupplementTakenLog, SupplementTime,
} from '../types';
import { getMealLogs, getHomeDashboard } from '../api/diet';

const STORAGE_KEY_USER         = '@food_app:user';
const STORAGE_KEY_TOKEN        = '@food_app:token';
const STORAGE_KEY_USER_RECIPES = '@food_app:userRecipes';
const STORAGE_KEY_FAVORITES    = '@food_app:favoriteIds';
const STORAGE_KEY_SUPPLEMENTS  = '@food_app:supplements';
const STORAGE_KEY_SUPP_LOGS    = '@food_app:supplementLogs';
const STORAGE_KEY_WATER_LOGS   = '@food_app:waterLogs';
const STORAGE_KEY_DELETED_IDS  = '@food_app:deletedLogIds'; // 서버 DELETE 미지원 대비 로컬 삭제 ID 보관

const AppContext = createContext<AppContextType | null>(null);

// ============================================================
// [기능] 1일 권장 영양소 계산
// 해리스-베네딕트 공식으로 기초대사량(BMR) 계산 후
// 활동량 배율(TDEE)과 목표(다이어트/유지/근육)에 따라 칼로리·탄단지 조정
//
// ⚠️ 백엔드 연결 시: 이 계산은 서버에서 해서 user_profile 테이블에 저장함
//    (target_calories, target_carbs_g 등 컬럼)
//    연결 후에는 API에서 받은 값을 그대로 쓰면 되고, 이 함수는 제거 가능
// ============================================================
export function calculateDailyGoals(profile: Partial<UserProfile>): DailyGoals {
  const a = parseFloat(profile.age ?? '25');
  const h = parseFloat(profile.height ?? '170');
  const w = parseFloat(profile.weight ?? '65');
  const gender = profile.gender ?? 'male';
  const activityLevel: ActivityLevel = profile.activityLevel ?? 'moderate';
  const goalType: GoalType = profile.goalType ?? 'maintain';

  // 성별에 따른 기초대사량(BMR) 계산
  const bmr =
    gender === 'male'
      ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
      : 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;

  // 활동량 배율 (TDEE = BMR × 배율)
  // ⚠️ ENUM 불일치: DB activity_type = NONE/LIGHT/MODERATE/ACTIVE
  //                 프론트 ActivityLevel = sedentary/light/moderate/active
  //    백엔드 API 연결 시 변환 처리 필요 (NONE ↔ sedentary, BULK ↔ muscle)
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,   // DB: NONE
    light: 1.375,     // DB: LIGHT
    moderate: 1.55,   // DB: MODERATE
    active: 1.725,    // DB: ACTIVE
  };
  const tdee = Math.round(bmr * multipliers[activityLevel]);

  // 목표 타입별 칼로리·탄단지 비율 조정
  // ⚠️ ENUM 불일치: DB goal_type = DIET/MAINTAIN/BULK
  //                 프론트 GoalType = diet/maintain/muscle
  const goalAdjust: Record<GoalType, { calAdj: number; carbs: number; protein: number; fat: number }> = {
    diet:     { calAdj: -500, carbs: 0.40, protein: 0.30, fat: 0.30 }, // DB: DIET
    maintain: { calAdj:    0, carbs: 0.50, protein: 0.20, fat: 0.30 }, // DB: MAINTAIN
    muscle:   { calAdj: +300, carbs: 0.45, protein: 0.30, fat: 0.25 }, // DB: BULK
  };
  const adj = goalAdjust[goalType];
  const targetCal = Math.max(1200, tdee + adj.calAdj);

  const sugarGoal: Record<GoalType, number> = { diet: 25, maintain: 40, muscle: 50 };

  return {
    calories: targetCal,
    carbs: Math.round((targetCal * adj.carbs) / 4),
    protein: Math.round((targetCal * adj.protein) / 4),
    fat: Math.round((targetCal * adj.fat) / 9),
    fiber: 25,
    sugar: sugarGoal[goalType],
    sodium: 2000,
  };
}

// ── 기본 프로필 (로그인 전 fallback용) ──
const DEFAULT_PROFILE: UserProfile = {
  name: '사용자',
  email: '',
  gender: 'male',
  age: '25',
  height: '170',
  weight: '65',
  activityLevel: 'moderate',
  goalType: 'maintain',
};



// 날짜 유틸: YYYY-MM-DD 형식
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// n일 전 날짜 문자열 (YYYY-MM-DD)
const dateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ============================================================
// AppProvider — 앱 전체를 감싸는 전역 상태 컨테이너
// App.tsx 최상단에 마운트되어 모든 화면에서 useApp()으로 접근 가능
// ============================================================
export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── 사용자 관련 상태 ──
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ── 식단 관련 상태 ──
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>([]); // 로그인 후 API에서 로드

  // ── 즐겨찾기 상태 ──
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); // 즐겨찾기한 레시피 ID 목록

  // ── 물 섭취 상태 ──
  const [waterLogs, setWaterLogs] = useState<{ date: string; amount: number }[]>([]);

  // ── 나만의 레시피 상태 ──
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]); // 유튜브에서 가져온 레시피 목록

  // ── 영양제 상태 ──
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [supplementLogs, setSupplementLogs] = useState<SupplementTakenLog[]>([]);

  // ── 앱 초기화 상태 (토큰 복원 중 로딩 표시용) ──
  const [authReady, setAuthReady] = useState(false);

  // ============================================================
  // [기능] 앱 시작 시 저장된 토큰 + 유저 정보 복원
  // ============================================================
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser, storedRecipes, storedFavs, storedSupps, storedSuppLogs, storedWater] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TOKEN),
          AsyncStorage.getItem(STORAGE_KEY_USER),
          AsyncStorage.getItem(STORAGE_KEY_USER_RECIPES),
          AsyncStorage.getItem(STORAGE_KEY_FAVORITES),
          AsyncStorage.getItem(STORAGE_KEY_SUPPLEMENTS),
          AsyncStorage.getItem(STORAGE_KEY_SUPP_LOGS),
          AsyncStorage.getItem(STORAGE_KEY_WATER_LOGS),
        ]);
        // 로그인 여부와 무관하게 로컬 데이터 복원
        try { if (storedRecipes) setUserRecipes(JSON.parse(storedRecipes)); } catch {}
        try { if (storedFavs)    setFavoriteIds(JSON.parse(storedFavs));    } catch {}
        try { if (storedSupps)   setSupplements(JSON.parse(storedSupps));   } catch {}
        try { if (storedSuppLogs) setSupplementLogs(JSON.parse(storedSuppLogs)); } catch {}
        try { if (storedWater)  setWaterLogs(JSON.parse(storedWater));      } catch {}
        if (storedToken && storedUser) {
          const user: AppUser = JSON.parse(storedUser);
          setToken(storedToken);   // axios 헤더에 토큰 복원
          setCurrentUser(user);
          setIsLoggedIn(true);
          // 식단 데이터도 다시 로드
          try {
            const end = todayStr();
            const startD = new Date();
            startD.setDate(startD.getDate() - 6);
            const start = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
            const history = await getMealLogs(user.id, start, end);
            // 삭제된 로그 ID 불러와서 필터링 (백엔드 DELETE 미구현 대응)
            const rawDeletedIds: number[] = JSON.parse(
              (await AsyncStorage.getItem(STORAGE_KEY_DELETED_IDS)) ?? '[]'
            );
            const deletedIdSet = new Set(rawDeletedIds);
            const logs: MealLogEntry[] = history.rawLogs
              .filter((l) => !deletedIdSet.has(l.id))
              .map((l) => ({
                id: l.id,
                userId: String(l.userId),
                date: l.eatDate,
                mealType: l.mealType,
                food: {
                  id: l.id, name: l.foodName, emoji: '🍽️', category: '기타',
                  per: `${l.quantity}g`,
                  nutrition: {
                    calories: l.calories, carbs: l.carbs, protein: l.protein, fat: l.fat,
                    fiber: l.fiber ?? 0, sugar: l.sugar ?? 0, sodium: l.sodium ?? 0,
                  },
                },
              }));
            setMealLogs(logs);
          } catch { /* 식단 로드 실패해도 로그인 유지 */ }

          // 대시보드에서 서버 저장 목표칼로리 동기화
          try {
            const dashboard = await getHomeDashboard(user.id);
            if (dashboard.success && dashboard.dailyGoals?.calories) {
              const withGoals = { ...user, savedGoals: dashboard.dailyGoals };
              setCurrentUser(withGoals);
              await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(withGoals));
            }
          } catch { /* 실패해도 로컬 공식으로 계산 */ }
        }
      } catch { /* 복원 실패 시 그냥 로그인 화면 */ }
      finally { setAuthReady(true); }
    })();
  }, []);

  // ============================================================
  // [기능] 로그인 — POST /auth/login 호출
  // ============================================================
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await apiLogin({ email, password });
        // 백엔드 응답: { id, email, nickname, token }
        const loggedInUser: AppUser = {
          id: String(res.id),  // 백엔드 UUID 그대로 string 보존
          email: res.email,
          password: '',
          profile: {
            name: res.nickname ?? '사용자',
            email: res.email,
            gender: 'male',
            age: '25',
            height: '170',
            weight: '65',
            activityLevel: 'moderate',
            goalType: 'maintain',
          },
        };
        setCurrentUser(loggedInUser);
        setIsLoggedIn(true);

        // 토큰 + 유저 정보 AsyncStorage에 저장
        await Promise.all([
          AsyncStorage.setItem(STORAGE_KEY_TOKEN, res.token),
          AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser)),
        ]);

        // 로그인 후 최근 7일 식단 로드
        try {
          const end = todayStr();
          const startD = new Date();
          startD.setDate(startD.getDate() - 6);
          const start = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
          const history = await getMealLogs(String(res.id), start, end);
          // 삭제된 로그 ID 불러와서 필터링 (백엔드 DELETE 미구현 대응)
          const rawDeletedIds2: number[] = JSON.parse(
            (await AsyncStorage.getItem(STORAGE_KEY_DELETED_IDS)) ?? '[]'
          );
          const deletedIdSet2 = new Set(rawDeletedIds2);
          const logs: MealLogEntry[] = history.rawLogs
            .filter((l) => !deletedIdSet2.has(l.id))
            .map((l) => ({
              id: l.id,
              userId: String(l.userId),
              date: l.eatDate, // YYYY-MM-DD
              mealType: l.mealType,
              food: {
                id: l.id,
                name: l.foodName,
                emoji: '🍽️',
                category: '기타',
                per: `${l.quantity}g`,
                nutrition: {
                  calories: l.calories,
                  carbs: l.carbs,
                  protein: l.protein,
                  fat: l.fat,
                  fiber: l.fiber ?? 0,
                  sugar: l.sugar ?? 0,
                  sodium: l.sodium ?? 0,
                },
              },
            }));
          setMealLogs(logs);
        } catch {
          // 식단 로드 실패해도 로그인은 성공
        }

        // 대시보드에서 서버 저장 목표칼로리 동기화
        try {
          const dashboard = await getHomeDashboard(String(res.id));
          if (dashboard.success && dashboard.dailyGoals?.calories) {
            const withGoals = { ...loggedInUser, savedGoals: dashboard.dailyGoals };
            setCurrentUser(withGoals);
            await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(withGoals));
          }
        } catch { /* 실패해도 로컬 공식으로 계산 */ }

        return { success: true, user: loggedInUser };
      } catch {
        return { success: false };
      }
    },
    [],
  );

  // ============================================================
  // [기능] 회원가입 — POST /auth/signup 호출
  // name → nickname 필드명 변환 포함
  // ============================================================
  const signup = useCallback(
    async (userData: SignupData) => {
      try {
        await apiSignup({
          email: userData.email,
          password: userData.password,
          nickname: userData.name, // 프론트 name → 백엔드 nickname
        });
        return { success: true };
      } catch (e: any) {
        const message = e?.response?.data?.message ?? '회원가입에 실패했습니다.';
        return { success: false, message };
      }
    },
    [],
  );

  // ============================================================
  // [기능] 로그아웃
  // 백엔드 연결 시: JWT 토큰 삭제 + 필요시 POST /auth/logout 호출
  // ============================================================
  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setMealLogs([]);
    clearToken();
    AsyncStorage.multiRemove([STORAGE_KEY_TOKEN, STORAGE_KEY_USER, STORAGE_KEY_USER_RECIPES, STORAGE_KEY_FAVORITES, STORAGE_KEY_SUPPLEMENTS, STORAGE_KEY_SUPP_LOGS, STORAGE_KEY_WATER_LOGS]);
  }, []);

  // ============================================================
  // [기능] 프로필 수정 (나이, 키, 몸무게, 목표 등)
  // 로컬 즉시 업데이트 후, 백그라운드로 POST /users/:userId/physical-info 호출
  // → 서버의 goal_calories/goal_macros 재계산 → dashboard로 savedGoals 갱신
  // ============================================================
  const updateProfile = useCallback(
    (newProfile: Partial<UserProfile>) => {
      // 1. 로컬 즉시 반영
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, profile: { ...prev.profile, ...newProfile } };

        // 2. 백그라운드 서버 동기화 (setState 콜백 내부에서 최신 값 캡처)
        const p = updated.profile;
        savePhysicalInfo(updated.id, {
          gender: p.gender,
          age: p.age,
          height: p.height,
          weight: p.weight,
          activityLevel: p.activityLevel,
        })
          .then(() => getHomeDashboard(updated.id))
          .then((dashboard) => {
            if (dashboard.success && dashboard.dailyGoals?.calories) {
              setCurrentUser((u) =>
                u ? { ...u, savedGoals: dashboard.dailyGoals } : u,
              );
            }
          })
          .catch(() => { /* 실패해도 로컬 반영 유지 */ });

        return updated;
      });
    },
    [],
  );

  // ============================================================
  // [기능] 식단 기록 추가 (아침/점심/저녁/간식에 음식 추가)
  // 현재: 로컬 배열에만 추가
  // 백엔드 연결 시: POST /meal-log + POST /meal-log-item 호출
  //   → meal_log 테이블 INSERT 후 meal_log_item INSERT
  // ============================================================
  const addMealLog = useCallback(
    (mealType: MealType, food: Food): MealLogEntry => {
      const newLog: MealLogEntry = {
        id: Date.now(),
        userId: currentUser?.id ?? '',
        date: todayStr(), // YYYY-MM-DD
        mealType,
        food,
      };
      setMealLogs((prev) => [...prev, newLog]);
      return newLog;
    },
    [currentUser],
  );

  // ============================================================
  // [기능] 식단 기록 삭제
  // ─ 백엔드에 DELETE 엔드포인트가 없으므로 로컬 숨김으로 대응:
  //   1) 낙관적 업데이트로 즉시 UI 제거
  //   2) 삭제된 logId를 AsyncStorage에 저장 → 앱 재시작 후 로딩 시 필터링
  // ============================================================
  const removeMealLog = useCallback(async (logId: number) => {
    // (1) 즉시 로컬 제거
    setMealLogs((prev) => prev.filter((l) => l.id !== logId));

    // (2) 삭제 ID 영구 보관 (앱 재시작 후 백엔드에서 다시 내려와도 필터링)
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_DELETED_IDS);
      const existingIds: number[] = raw ? JSON.parse(raw) : [];
      if (!existingIds.includes(logId)) {
        await AsyncStorage.setItem(
          STORAGE_KEY_DELETED_IDS,
          JSON.stringify([...existingIds, logId]),
        );
      }
    } catch { /* AsyncStorage 오류 무시 */ }
  }, []);

  // ============================================================
  // [기능] 레시피 즐겨찾기 토글 (하트 버튼)
  // 현재: 로컬 배열에서 추가/제거
  // 백엔드 연결 시: POST /favorite/:recipeId (추가) or DELETE /favorite/:recipeId (제거)
  //   → favorite_recipe 테이블 INSERT/DELETE
  // ============================================================
  const toggleFavorite = useCallback((recipeId: number) => {
    setFavoriteIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId],
    );
  }, []);

  // 특정 레시피가 즐겨찾기 됐는지 확인
  const isFavorite = useCallback(
    (recipeId: number) => favoriteIds.includes(recipeId),
    [favoriteIds],
  );

  // ── 물 섭취 ──

  // 오늘 마신 물 총량 (ml) 계산
  const todayWater = useMemo(
    () => waterLogs.filter((w) => w.date === todayStr()).reduce((s, w) => s + w.amount, 0),
    [waterLogs],
  );

  // ============================================================
  // [기능] 물 섭취량 추가 (기본 250ml 단위)
  // 백엔드 연결 시: PATCH /water-log → water_log 테이블의 amount_ml UPDATE (누적)
  // ============================================================
  const addWater = useCallback((amount: number) => {
    setWaterLogs((prev) => [...prev, { date: todayStr(), amount }]);
  }, []);

  // ============================================================
  // [기능] 오늘 물 섭취량 초기화
  // 백엔드 연결 시: PATCH /water-log → amount_ml = 0 으로 UPDATE
  // ============================================================
  const resetWater = useCallback(() => {
    setWaterLogs((prev) => prev.filter((w) => w.date !== todayStr()));
  }, []);

  // ============================================================
  // [기능] 나만의 레시피 저장 (유튜브 URL로 가져온 레시피)
  // 현재: 로컬 배열에만 저장 (앱 종료 시 사라짐)
  // 백엔드 연결 시: POST /recipe → recipe 테이블 INSERT (is_system=false, created_by=user_id)
  // ============================================================
  const addUserRecipe = useCallback((recipe: UserRecipe) => {
    setUserRecipes((prev) => [recipe, ...prev]);
  }, []);

  // ============================================================
  // [기능] 나만의 레시피 삭제
  // 백엔드 연결 시: DELETE /recipe/:recipeId 호출
  // ============================================================
  const removeUserRecipe = useCallback((id: string) => {
    setUserRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ============================================================
  // [기능] 나만의 레시피 업데이트 (공유 후 sharedRecipeId 저장 등)
  // ============================================================
  const updateUserRecipe = useCallback((updated: UserRecipe) => {
    setUserRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  // ============================================================
  // [기능] 영양제 CRUD + 복용 기록
  // ============================================================
  const addSupplement = useCallback((supp: Supplement) => {
    setSupplements((prev) => [...prev, supp]);
  }, []);

  const removeSupplement = useCallback((id: string) => {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateSupplement = useCallback((updated: Supplement) => {
    setSupplements((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const toggleSupplementTaken = useCallback((supplementId: string, time: SupplementTime) => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSupplementLogs((prev) => {
      const existing = prev.find((l) => l.supplementId === supplementId && l.date === date);
      if (existing) {
        const hasTaken = existing.times.includes(time);
        return prev.map((l) =>
          l.supplementId === supplementId && l.date === date
            ? { ...l, times: hasTaken ? l.times.filter((t) => t !== time) : [...l.times, time] }
            : l
        );
      }
      return [...prev, { supplementId, date, times: [time] }];
    });
  }, []);

  const getTodayTakenTimes = useCallback((supplementId: string): SupplementTime[] => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return supplementLogs.find((l) => l.supplementId === supplementId && l.date === date)?.times ?? [];
  }, [supplementLogs]);

    // ============================================================
  // [기능] 로컬 데이터 자동 저장 — 상태 변경 시마다 AsyncStorage에 반영
  // ============================================================
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEY_USER_RECIPES, JSON.stringify(userRecipes)); }, [userRecipes]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEY_FAVORITES,    JSON.stringify(favoriteIds)); }, [favoriteIds]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEY_SUPPLEMENTS,  JSON.stringify(supplements)); }, [supplements]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEY_SUPP_LOGS,    JSON.stringify(supplementLogs)); }, [supplementLogs]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEY_WATER_LOGS,   JSON.stringify(waterLogs)); }, [waterLogs]);
  // 프로필·savedGoals 변경 시 AsyncStorage 자동 갱신 — updateProfile 후 재시작해도 값 유지
  useEffect(() => {
    if (currentUser) {
      AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser)).catch(() => {});
    }
  }, [currentUser]);

  // ============================================================
  // [기능] 주간 칼로리 계산 (홈 화면 꺾은선 그래프용)
  // 오늘 포함 7일간 날짜별 칼로리 합계 계산
  // 백엔드 연결 시: GET /meal-log/weekly?userId=... 로 서버에서 계산해서 받아도 됨
  // ============================================================
  const weeklyCalories = useMemo(() => {
    const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const calories = mealLogs
        .filter((l) => l.date === dStr && l.userId === currentUser?.id)
        .reduce((s, l) => s + (l.food?.nutrition?.calories ?? 0), 0);
      return { day: DAYS[d.getDay()], calories };
    });
  }, [mealLogs, currentUser?.id]);

  // ── 오늘 식단 로그 (날짜 필터) ──
  const todayLogs = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return mealLogs.filter((l) => l.date === todayStr && l.userId === currentUser?.id);
  }, [mealLogs, currentUser?.id]);

  // ── 일일 목표 — 서버 저장값 우선, 없으면 로컬 BMR 공식 ──
  const dailyGoals = useMemo(() => {
    // 서버에서 받아온 목표값이 있으면 그것을 우선 사용
    if (currentUser?.savedGoals) return currentUser.savedGoals;
    if (!currentUser) return { calories: 2000, carbs: 250, protein: 60, fat: 55, fiber: 25, sugar: 50, sodium: 2300 };
    const p = currentUser.profile;
    const weight = parseFloat(p.weight) || 60;
    const height = parseFloat(p.height) || 165;
    const age = parseFloat(p.age) || 25;
    const actCoeff = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[p.activityLevel] ?? 1.2;
    const bmr = p.gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    const tdee = Math.round(bmr * actCoeff);
    const target = p.goalType === 'diet' ? tdee - 300 : p.goalType === 'muscle' ? tdee + 300 : tdee;
    return {
      calories: target,
      carbs: Math.round((target * 0.5) / 4),
      protein: Math.round((target * 0.2) / 4),
      fat: Math.round((target * 0.3) / 9),
      fiber: 25,
      sugar: 50,
      sodium: 2300,
    };
  }, [currentUser]);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        authReady,
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
        todayWater,
        addWater,
        resetWater,
        weeklyCalories,
        userRecipes,
        addUserRecipe,
        removeUserRecipe,
        updateUserRecipe,
        supplements,
        addSupplement,
        removeSupplement,
        updateSupplement,
        supplementLogs,
        toggleSupplementTaken,
        getTodayTakenTimes,
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
