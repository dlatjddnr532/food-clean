// ============================================================
// AppContext.tsx — 앱 전역 상태 관리 (로그인, 식단, 물 섭취 등)
//
// 현재 상태: 로컬 메모리(useState)로만 동작 중
// 백엔드 연결 시: login, signup, addMealLog 등 각 함수에서
//   API 호출로 교체하고, 상태를 서버 응답 기반으로 업데이트하면 됩니다.
// ============================================================

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  AppContextType, AppUser, UserProfile, MealLogEntry,
  MealType, Food, DailyGoals, SignupData, ActivityLevel, GoalType, UserRecipe,
} from '../types';
import { DUMMY_FOODS } from '../data/dummyData';

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

// ── 테스트 계정 ──
// ⚠️ 백엔드 연결 후 삭제 예정 — 실제 로그인은 서버 DB 기반으로 동작
// 테스트 계정: test@test.com / 1234
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
      goalType: 'maintain',
    },
  },
];

const todayStr = (): string => new Date().toDateString();

// n일 전 날짜 문자열 생성 (주간 그래프용)
const dateStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toDateString();
};

// ── 초기 식단 로그 ──
// ⚠️ 테스트용 더미 데이터 — 백엔드 연결 후 삭제 예정
// 주간 칼로리 그래프 확인용으로 7일치 데이터 미리 넣어둠
const INITIAL_LOGS: MealLogEntry[] = [
  { id: 1001, userId: 1, date: todayStr(),    mealType: '아침', food: DUMMY_FOODS[6] },
  { id: 1002, userId: 1, date: todayStr(),    mealType: '점심', food: DUMMY_FOODS[0] },
  { id: 1003, userId: 1, date: dateStr(1),    mealType: '아침', food: DUMMY_FOODS[2] },
  { id: 1004, userId: 1, date: dateStr(1),    mealType: '저녁', food: DUMMY_FOODS[1] },
  { id: 1005, userId: 1, date: dateStr(2),    mealType: '점심', food: DUMMY_FOODS[11] },
  { id: 1006, userId: 1, date: dateStr(3),    mealType: '아침', food: DUMMY_FOODS[8] },
  { id: 1007, userId: 1, date: dateStr(3),    mealType: '저녁', food: DUMMY_FOODS[14] },
  { id: 1008, userId: 1, date: dateStr(4),    mealType: '점심', food: DUMMY_FOODS[7] },
  { id: 1009, userId: 1, date: dateStr(5),    mealType: '아침', food: DUMMY_FOODS[9] },
  { id: 1010, userId: 1, date: dateStr(5),    mealType: '저녁', food: DUMMY_FOODS[3] },
  { id: 1011, userId: 1, date: dateStr(6),    mealType: '점심', food: DUMMY_FOODS[12] },
];

// ============================================================
// AppProvider — 앱 전체를 감싸는 전역 상태 컨테이너
// App.tsx 최상단에 마운트되어 모든 화면에서 useApp()으로 접근 가능
// ============================================================
export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── 사용자 관련 상태 ──
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS); // 임시 유저 목록 (백엔드 연결 후 제거)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null); // 현재 로그인된 유저
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ── 식단 관련 상태 ──
  const [mealLogs, setMealLogs] = useState<MealLogEntry[]>(INITIAL_LOGS); // 전체 식단 기록

  // ── 즐겨찾기 상태 ──
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); // 즐겨찾기한 레시피 ID 목록

  // ── 물 섭취 상태 ──
  const [waterLogs, setWaterLogs] = useState<{ date: string; amount: number }[]>([]);

  // ── 나만의 레시피 상태 ──
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]); // 유튜브에서 가져온 레시피 목록

  // ============================================================
  // [기능] 로그인
  // 현재: 로컬 users 배열에서 이메일/비밀번호 일치 여부 확인
  // 백엔드 연결 시: POST /auth/login 호출 → JWT 토큰 받아 저장
  // ============================================================
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

  // ============================================================
  // [기능] 회원가입
  // 현재: 로컬 배열에 유저 추가 (앱 종료 시 초기화됨)
  // 백엔드 연결 시: POST /auth/signup 호출 → user 테이블에 INSERT
  // ============================================================
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
          goalType: 'maintain',
        },
      };
      setUsers((prev) => [...prev, newUser]);
      return { success: true };
    },
    [users],
  );

  // ============================================================
  // [기능] 로그아웃
  // 백엔드 연결 시: JWT 토큰 삭제 + 필요시 POST /auth/logout 호출
  // ============================================================
  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  }, []);

  // ============================================================
  // [기능] 프로필 수정 (나이, 키, 몸무게, 목표 등)
  // 현재: 로컬 상태만 업데이트
  // 백엔드 연결 시: PUT /user/profile 호출 → user_profile 테이블 UPDATE
  // ============================================================
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

  // ============================================================
  // [기능] 식단 기록 삭제
  // 백엔드 연결 시: DELETE /meal-log/:logId 호출
  // ============================================================
  const removeMealLog = useCallback((logId: number) => {
    setMealLogs((prev) => prev.filter((l) => l.id !== logId));
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
  // [기능] 주간 칼로리 계산 (홈 화면 꺾은선 그래프용)
  // 오늘 포함 7일간 날짜별 칼로리 합계 계산
  // 백엔드 연결 시: GET /meal-log/weekly?userId=... 로 서버에서 계산해서 받아도 됨
  // ============================================================
  const weeklyCalories = useMemo(() => {
    const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = d.toDateString();
      const calories = mealLogs
        .filter((l) => l.date === dStr && l.userId === currentUser?.id)
        .reduce((s, l) => s + (l.food?.nutrition?.calories ?? 0), 0);
      return { day: DAYS[d.getDay()], calories };
    });
  }, [mealLogs, currentUser]);

  // 오늘 식단 기록만 필터링 (홈 화면 표시용)
  const todayLogs = mealLogs.filter(
    (l) => l.date === todayStr() && l.userId === currentUser?.id,
  );

  // 현재 사용자 프로필 기반으로 1일 권장량 계산
  // 백엔드 연결 시: user_profile 테이블의 target_* 컬럼 값을 그대로 사용
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
        todayWater,
        addWater,
        resetWater,
        weeklyCalories,
        userRecipes,
        addUserRecipe,
        removeUserRecipe,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// 모든 화면에서 useApp()으로 전역 상태에 접근
export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
