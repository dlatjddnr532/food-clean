// ============================================================
// 공유 타입 정의 — 백엔드 엔티티 기반
// ============================================================

// 백엔드 user.entity.ts 기반
export interface BackendUser {
  id: string; // uuid
  email: string;
  nickname: string;
  goal_calories: number;
  goal_macros: { c: number; p: number; f: number };
}

// 백엔드 meal-log.entity.ts 기반
export type MealType = '아침' | '점심' | '저녁' | '간식';

export interface BackendMealLog {
  id: number;
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
}

// ── 영양소 ──
export interface NutritionInfo {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

// ── 음식/재료 ──
export interface Food {
  id: number;
  name: string;
  emoji: string;
  category: string;
  nutrition: NutritionInfo;
  per: string;
  type?: 'food' | 'ingredient';
}

// ── 레시피 ──
export interface RecipeIngredient {
  name: string;
  amount: string;
  nutrition: Pick<NutritionInfo, 'calories' | 'carbs' | 'protein' | 'fat'>;
}

export interface Recipe {
  id: number;
  title: string;
  emoji: string;
  likes: number;
  cookTime: number;
  category: string;
  tools: string[];
  ingredients: RecipeIngredient[];
  totalNutrition: NutritionInfo;
  steps: string[];
  content: string;
  foodId: number;
}

// ── 사용자 프로필 (프론트 전용) ──
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';
export type GoalType = 'diet' | 'maintain' | 'muscle';

export interface UserProfile {
  name: string;
  email: string;
  gender: Gender;
  age: string;
  height: string;
  weight: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}

export interface AppUser {
  id: number;
  email: string;
  password: string;
  profile: UserProfile;
}

// ── 1일 권장량 ──
export interface DailyGoals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// ── 식단 기록 (프론트 전용) ──
export interface MealLogEntry {
  id: number;
  userId: number;
  date: string;
  mealType: MealType;
  food: Food;
}

// ── AI 분석 결과 ──
export interface AiFoodResult {
  name: string;
  confidence: number;
  foodId: number;
}

export interface AiAnalysisResult {
  aiResult: AiFoodResult;
  food: Food;
}

// ── Context 타입 ──
export interface AppContextType {
  isLoggedIn: boolean;
  currentUser: AppUser | null;
  dailyGoals: DailyGoals;
  login: (email: string, password: string) => { success: boolean; user?: AppUser };
  signup: (userData: SignupData) => { success: boolean; message?: string };
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  mealLogs: MealLogEntry[];
  todayLogs: MealLogEntry[];
  addMealLog: (mealType: MealType, food: Food) => MealLogEntry;
  removeMealLog: (logId: number) => void;
  // 즐겨찾기
  favoriteIds: number[];
  toggleFavorite: (recipeId: number) => void;
  isFavorite: (recipeId: number) => boolean;
  // 물 섭취
  todayWater: number;
  addWater: (amount: number) => void;
  resetWater: () => void;
  // 주간 칼로리
  weeklyCalories: { day: string; calories: number }[];
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  gender: Gender;
  age: string;
  height: string;
  weight: string;
}
