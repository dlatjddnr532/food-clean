// ============================================================
// 공유 타입 정의
// ============================================================

export type MealType = '아침' | '점심' | '저녁' | '간식';

export interface BackendMealLog {
  id: number;
  user_id: string;
  meal_type: MealType;
  food_img_url: string;
  total_nutrients: NutritionInfo;
}

export interface NutritionInfo {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface Food {
  id: number;
  name: string;
  emoji: string;
  category: string;
  nutrition: NutritionInfo;
  per: string;
  type?: 'food' | 'ingredient';
}

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
  foodId?: number;
  creatorId?: string;
  creatorName?: string; // 작성자 닉네임 (소셜 피드 표시용)
}

// Supplement types
export interface Supplement {
  id: string;
  name: string;
  dosage: string;
  times: string[];       // HH:mm format, e.g. ['08:00', '21:30']
  nutrients: string;
  color: string;
  notificationIds?: string[]; // expo-notifications scheduled IDs
}

export interface SupplementTakenLog {
  supplementId: string;
  date: string;          // YYYY-MM-DD
  times: string[];       // completed HH:mm times
}

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
  id: string;   // 백엔드 UUID (e.g. "550e8400-e29b-41d4-a716-446655440000")
  email: string;
  password: string;
  profile: UserProfile;
  savedGoals?: DailyGoals | null; // 서버에서 받아온 목표값 (없으면 로컬 공식 사용)
}

export interface DailyGoals {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface MealLogEntry {
  id: number;
  userId: string;
  date: string;
  mealType: MealType;
  food: Food;
}

export interface UserRecipeIngredient {
  name: string;
}

export interface UserRecipe {
  id: string;
  title: string;
  emoji: string;
  category: string;
  cookTime: number;
  servings: number;
  youtubeUrl: string;
  ingredients: UserRecipeIngredient[];
  tools?: string[];
  steps: string[];
  totalNutrition: NutritionInfo;
  createdAt: string;
  sharedRecipeId?: number;  // 공개 상태인 레시피의 백엔드 ID (공개됨 배지용)
  isPublic?: boolean;
  backendId?: number;       // DB에 저장된 ID (비공개 포함, 삭제/공개 전환 시 사용)
}

export interface AiFoodResult {
  name: string;
  confidence: number;
  foodId: number;
}

export interface AiAnalysisResult {
  aiResult: AiFoodResult;
  food: Food;
}

export interface AppContextType {
  isLoggedIn: boolean;
  authReady: boolean;   // 토큰 복원 완료 여부 (스플래시 대기용)
  currentUser: AppUser | null;
  dailyGoals: DailyGoals;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AppUser }>;
  signup: (userData: SignupData) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  mealLogs: MealLogEntry[];
  todayLogs: MealLogEntry[];
  addMealLog: (mealType: MealType, food: Food) => MealLogEntry;
  removeMealLog: (logId: number) => Promise<void>;
  favoriteIds: number[];
  toggleFavorite: (recipeId: number) => void;
  isFavorite: (recipeId: number) => boolean;
  todayWater: number;
  addWater: (amount: number) => void;
  resetWater: () => void;
  weeklyCalories: { day: string; calories: number }[];
  userRecipes: UserRecipe[];
  addUserRecipe: (recipe: UserRecipe) => void;
  removeUserRecipe: (id: string) => void;
  updateUserRecipe: (recipe: UserRecipe) => void;
  deletedRecipeServerIds: number[];
  addDeletedRecipeServerId: (serverId: number) => void;
  supplements: Supplement[];
  addSupplement: (supp: Supplement) => void;
  removeSupplement: (id: string) => void;
  updateSupplement: (supp: Supplement) => void;
  supplementLogs: SupplementTakenLog[];
  toggleSupplementTaken: (supplementId: string, time: string) => void;
  getTodayTakenTimes: (supplementId: string) => string[];
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