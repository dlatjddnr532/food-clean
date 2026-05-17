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
  foodId: number;
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
  id: number;
  email: string;
  password: string;
  profile: UserProfile;
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
  userId: number;
  date: string;
  mealType: MealType;
  food: Food;
}

export interface UserRecipeIngredient {
  name: string;
  amount: string;
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
  steps: string[];
  totalNutrition: NutritionInfo;
  createdAt: string;
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
