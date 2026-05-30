import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { getRecipes, getRecipeById, BackendRecipe, getTop3Recipes, analyzeYoutubeRecipe, createRecipe, toggleRecipeLike, toggleRecipePublic, deleteRecipe, updateRecipe, getMyRecipes, getMyLikedRecipes, saveMealLog } from '../api/diet';
import { Food, Recipe, MealType, NutritionInfo, UserRecipe } from '../types';
import { CookingModeModal } from './CookingModeModal';
import { RecipeEditModal } from './RecipeEditModal';

const TABS = ['즐겨찾기', '레시피', '재료·음식', '나만의 레시피'] as const;
const COOKING_TOOLS = ['프라이팬', '냄비', '전자레인지', '에어프라이어', '오븐', '믹서기', '블렌더', '찜기', '냉장고', '그릇'];
const TAB_ICONS = ['❤️', '📋', '🥬', '📹'];
const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];

const canMakeWithSelectedTools = (recipe: Pick<Recipe, 'tools'>, selectedTools: string[]): boolean => {
  if (selectedTools.length === 0) return true;
  if (recipe.tools.length === 0) return false;
  const selectedSet = new Set(selectedTools);
  return recipe.tools.every((tool) => selectedSet.has(tool));
};

// ── 영양소 미니 배지 ──

function extractYoutubeVideoId(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const watchId = url.searchParams.get('v');
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
        return watchId;
      }

      const parts = url.pathname.split('/').filter(Boolean);
      const videoPathIndex = parts.findIndex((part) => ['shorts', 'embed', 'live'].includes(part));
      const pathId = videoPathIndex >= 0 ? parts[videoPathIndex + 1] : undefined;
      return pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId) ? pathId : null;
    }
  } catch {
    return null;
  }

  return null;
}

function toCanonicalYoutubeUrl(rawUrl: string): string | null {
  const videoId = extractYoutubeVideoId(rawUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

interface NutriBadgeProps {
  label: string;
  value: number | undefined;
  color: string;
  unit?: string;
}

function NutriBadge({ label, value, color, unit = 'g' }: NutriBadgeProps) {
  return (
    <View style={[nStyles.badge, { borderColor: color + '40' }]}>
      <Text style={[nStyles.val, { color }]}>{value ?? 0}{unit}</Text>
      <Text style={nStyles.lbl}>{label}</Text>
    </View>
  );
}

const nStyles = StyleSheet.create({
  badge: {
    alignItems: 'center', borderWidth: 1,
    borderRadius: borderRadius.sm, paddingHorizontal: 4, paddingVertical: 2,
    backgroundColor: '#fff',
    minWidth: 32,
  },
  val: { fontSize: 10, fontWeight: '800' },
  lbl: { fontSize: 8, color: colors.textLight, marginTop: 0 },
});

// ── 식사 추가 모달 ──
type ModalItem = Food | Recipe;

interface AddMealModalProps {
  visible: boolean;
  item: ModalItem | null;
  onClose: () => void;
  onAdd: (mealType: MealType, customNutrition: NutritionInfo) => void;
}

function AddMealModal({ visible, item, onClose, onAdd }: AddMealModalProps) {
  const [mealType, setMealType] = useState<MealType>('점심');
  const [editMode, setEditMode] = useState(false);
  const [quantity, setQuantity] = useState(100);
  const [calories, setCalories] = useState('');
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');

  const isRecipe = item && 'title' in item;
  const defaultNutrition: NutritionInfo | undefined =
    item && 'nutrition' in item ? item.nutrition : (item as Recipe | null)?.totalNutrition;
  const displayName = item && 'name' in item ? item.name : (item as Recipe | null)?.title;
  const displayEmoji = item?.emoji;

  const scale = quantity / 100;
  const computedNutrition: NutritionInfo = {
    calories: Math.round((defaultNutrition?.calories ?? 0) * scale),
    carbs: parseFloat(((defaultNutrition?.carbs ?? 0) * scale).toFixed(1)),
    protein: parseFloat(((defaultNutrition?.protein ?? 0) * scale).toFixed(1)),
    fat: parseFloat(((defaultNutrition?.fat ?? 0) * scale).toFixed(1)),
    fiber: parseFloat(((defaultNutrition?.fiber ?? 0) * scale).toFixed(1)),
    sugar: parseFloat(((defaultNutrition?.sugar ?? 0) * scale).toFixed(1)),
    sodium: Math.round((defaultNutrition?.sodium ?? 0) * scale),
  };

  useEffect(() => {
    if (item) {
      setQuantity(100);
      const n = defaultNutrition;
      const allZero = !n || (n.calories === 0 && n.carbs === 0 && n.protein === 0 && n.fat === 0);
      if (allZero) {
        // 영양정보 없음 → 바로 직접 입력 모드
        setEditMode(true);
        setCalories(''); setCarbs(''); setProtein(''); setFat('');
        setFiber(''); setSugar(''); setSodium('');
      } else {
        setEditMode(false);
      }
    }
  }, [item]);

  const openEditMode = () => {
    setCalories(String(computedNutrition.calories));
    setCarbs(String(computedNutrition.carbs));
    setProtein(String(computedNutrition.protein));
    setFat(String(computedNutrition.fat));
    setFiber(String(computedNutrition.fiber ?? 0));
    setSugar(String(computedNutrition.sugar ?? 0));
    setSodium(String(computedNutrition.sodium ?? 0));
    setEditMode(true);
  };

  const handleAdd = () => {
    const nutrition: NutritionInfo = editMode ? {
      calories: parseFloat(calories) || 0,
      carbs: parseFloat(carbs) || 0,
      protein: parseFloat(protein) || 0,
      fat: parseFloat(fat) || 0,
      fiber: parseFloat(fiber) || 0,
      sugar: parseFloat(sugar) || 0,
      sodium: parseFloat(sodium) || 0,
    } : computedNutrition;
    onAdd(mealType, nutrition);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.backdrop}>
        <ScrollView style={modal.sheet} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={modal.handle} />
          <Text style={modal.title}>식사에 추가하기</Text>
          {item && (
            <View style={modal.itemRow}>
              <Text style={modal.itemEmoji}>{displayEmoji ?? '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={modal.itemName}>{displayName}</Text>
                <Text style={modal.itemCal}>
                  {computedNutrition.calories} kcal
                  <Text style={modal.itemUnit}>  ({quantity}g 기준)</Text>
                </Text>
              </View>
            </View>
          )}

          <View style={modal.quantityRow}>
            <Text style={modal.quantityLabel}>섭취량</Text>
            <View style={modal.quantityCtrl}>
              <TouchableOpacity
                style={modal.qBtn}
                onPress={() => { setQuantity(q => Math.max(100, q - 100)); setEditMode(false); }}
              >
                <Text style={modal.qBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={modal.qVal}>{quantity}g</Text>
              <TouchableOpacity
                style={modal.qBtn}
                onPress={() => { setQuantity(q => q + 100); setEditMode(false); }}
              >
                <Text style={modal.qBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={modal.label}>식사 시간 선택</Text>
          <View style={modal.mealRow}>
            {MEAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[modal.mealBtn, mealType === t && modal.mealBtnActive]}
                onPress={() => setMealType(t)}
              >
                <Text style={[modal.mealText, mealType === t && modal.mealTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 영양정보가 있을 때만 직접수정 토글 표시 */}
          {defaultNutrition && (defaultNutrition.calories > 0 || defaultNutrition.protein > 0) && (
            <TouchableOpacity
              style={modal.editToggle}
              onPress={() => editMode ? setEditMode(false) : openEditMode()}
            >
              <Text style={modal.editToggleText}>
                {editMode ? '✕ 기본값 사용' : '✏️ 영양정보 직접 수정'}
              </Text>
            </TouchableOpacity>
          )}

          {editMode && (
            <View style={modal.editArea}>
              <View style={modal.editRow}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>칼로리 (kcal)</Text>
                  <TextInput style={modal.editInput} value={calories} onChangeText={setCalories} keyboardType="numeric" />
                </View>
              </View>
              <View style={modal.editRow}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>탄수화물 (g)</Text>
                  <TextInput style={modal.editInput} value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>단백질 (g)</Text>
                  <TextInput style={modal.editInput} value={protein} onChangeText={setProtein} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>지방 (g)</Text>
                  <TextInput style={modal.editInput} value={fat} onChangeText={setFat} keyboardType="numeric" />
                </View>
              </View>
              <View style={modal.editRow}>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>식이섬유 (g)</Text>
                  <TextInput style={modal.editInput} value={fiber} onChangeText={setFiber} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>당류 (g)</Text>
                  <TextInput style={modal.editInput} value={sugar} onChangeText={setSugar} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modal.editLabel}>나트륨 (mg)</Text>
                  <TextInput style={modal.editInput} value={sodium} onChangeText={setSodium} keyboardType="numeric" />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={modal.addBtn} onPress={handleAdd}>
            <Text style={modal.addBtnText}>{mealType}에 추가 →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelText}>취소</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: spacing.lg, paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  itemEmoji: { fontSize: 36 },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemCal: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  itemUnit: { fontSize: 11, color: colors.textLight, fontWeight: '400' },
  quantityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  quantityLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  quantityCtrl: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  qBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  qVal: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 52, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  mealRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  mealBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  mealBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  mealTextActive: { color: '#fff' },
  editToggle: {
    alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, backgroundColor: colors.background,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.sm,
  },
  editToggleText: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  editArea: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.sm, gap: spacing.xs,
  },
  editRow: { flexDirection: 'row', gap: spacing.sm },
  editLabel: { fontSize: 11, fontWeight: '600', color: colors.text, marginBottom: 2 },
  editInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.sm,
    padding: spacing.xs, fontSize: 13, color: colors.text, backgroundColor: colors.white,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', marginTop: spacing.sm, padding: spacing.sm, marginBottom: spacing.lg },
  cancelText: { color: colors.textLight, fontSize: 14 },
});

export default function RecipeScreen() {
  const insets = useSafeAreaInsets();
  const { addMealLog, favoriteIds, toggleFavorite, isFavorite, userRecipes, addUserRecipe, removeUserRecipe, updateUserRecipe, currentUser, deletedRecipeServerIds, addDeletedRecipeServerId } = useApp();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(1);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<UserRecipe> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatusText, setAnalysisStatusText] = useState('');
  const [youtubeAnalysisError, setYoutubeAnalysisError] = useState<string | null>(null);
  const [analyzedRecipe, setAnalyzedRecipe] = useState<UserRecipe | null>(null);
  const [searchText, setSearchText] = useState('');
  const [availableTools, setAvailableTools] = useState<string[]>([]); // 사용 가능한 조리기구 목록
  const [toolFilterVisible, setToolFilterVisible] = useState(false); // 조리기구 필터 패널 표시 여부
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedUserRecipeId, setExpandedUserRecipeId] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [tab2AvailTools, setTab2AvailTools] = useState<string[]>([]);
  const [tab2ToolFilterVisible, setTab2ToolFilterVisible] = useState(false);
  const [fetchingStepId, setFetchingStepId] = useState<number | null>(null);
  const [recipeActionId, setRecipeActionId] = useState<string | null>(null);
  // steps를 이미 가져온 레시피 ID 캐시 (재펼침 시 재요청 방지)
  const fetchedStepIds = useRef<Set<number>>(new Set());
  const recipeListRef = useRef<FlatList>(null);
  // 탭 전환 후 FlatList 마운트 시 스크롤할 인덱스 보관 (ref이므로 리렌더 없음)
  const pendingScrollIndexRef = useRef<number | null>(null);

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  // 서버 기준 인기 레시피 — GET /recipes/top3 결과
  // 로드 실패 시 top3Display(프론트 계산)로 자동 폴백
  const [top3Recipes, setTop3Recipes] = useState<Recipe[]>([]);
  // 서버 기준 좋아요한 레시피 — GET /recipes/my/liked/:userId
  const [serverLikedRecipes, setServerLikedRecipes] = useState<Recipe[]>([]);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<number>>(() => new Set());
  const pendingLikeIdsRef = useRef<Set<number>>(new Set());
  const top3RefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludeTools = useMemo(
    () => availableTools.length > 0
      ? COOKING_TOOLS.filter((tool) => !availableTools.includes(tool))
      : [],
    [availableTools],
  );
  const parseIngredientName = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.name) return String(parsed.name);
    } catch { /* not JSON */ }
    return raw;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // backendToRecipe: 서버 응답(BackendRecipe) → 앱 내부 Recipe 타입으로 변환
  // - likes_count → likes (좋아요 수 표시용)
  // - creator.nickname → creatorName (작성자 닉네임 카드에 표시)
  // - creator.id → creatorId (본인 레시피 여부 판단 + 삭제 버튼 노출)
  // ─────────────────────────────────────────────────────────────────────────
  const backendToRecipe = (r: BackendRecipe): Recipe => ({
    id: r.id,
    title: r.title,
    emoji: '🍽️',
    likes: r.likes_count ?? 0,
    cookTime: 30,
    category: '기타',
    tools: (r.cooking_tools ?? []).map((t) => parseIngredientName(t.name)),
    ingredients: (r.ingredients ?? []).map((i) => ({
      name: parseIngredientName(i.name),
      amount: '',
      nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
    })),
    totalNutrition: {
      calories: r.calories ?? 0,
      carbs: r.carbs ?? 0,
      protein: r.protein ?? 0,
      fat: r.fat ?? 0,
      fiber: r.fiber ?? 0,
      sugar: r.sugar ?? 0,
      sodium: r.sodium ?? 0,
    },
    steps: (r.steps ?? [])
      .sort((a, b) => a.step_number - b.step_number)
      .map((s) => s.description),
    content: r.content ?? '',
    creatorId: r.creator?.id,
    creatorName: r.creator?.nickname,
  });

  useEffect(() => {
    setRecipesLoading(true);
    getRecipes(excludeTools.length > 0 ? { excludeTools: excludeTools.join(',') } : undefined)
      .then((data) => setAllRecipes(data.map(backendToRecipe)))
      .catch(() => setAllRecipes([]))
      .finally(() => setRecipesLoading(false));
    // 서버 기준 top3 별도 로드
    getTop3Recipes()
      .then((data) => { if (data.length > 0) setTop3Recipes(data.map(backendToRecipe)); })
      .catch(() => { /* 실패 시 top3Display 폴백 */ });
  }, [excludeTools]);

  // ─────────────────────────────────────────────────────────────────────────
  // 서버 동기화: 로그인 사용자의 좋아요 레시피 + 나만의 레시피 목록을 서버에서 가져와 로컬과 병합
  // - getMyLikedRecipes: 서버 기준 좋아요 목록 → serverLikedRecipes 상태에 저장
  //   (즐겨찾기 탭에서 로컬 favoriteIds와 합쳐 표시)
  // - getMyRecipes: 서버에 저장된 내 레시피 중 로컬에 없는 것(backendId/sharedRecipeId 미매칭)
  //   → addUserRecipe로 자동 복원 (앱 재설치 후에도 내 레시피 유지)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const userId = String(currentUser.id);

    // 좋아요한 레시피 서버 동기화
    getMyLikedRecipes(userId)
      .then((data) => setServerLikedRecipes(data.map(backendToRecipe)))
      .catch(() => { /* 실패 시 로컬 favoriteIds만 사용 */ });

    // 내가 작성한 레시피 서버 동기화 — 로컬에 없는 것만 복원
    getMyRecipes(userId)
      .then((data) => {
        data.forEach((serverRecipe) => {
          // 이미 로컬에 sharedRecipeId 또는 backendId로 연결된 레시피는 건너뜀
          const alreadyLinked = userRecipes.some(
            (ur) => ur.sharedRecipeId === serverRecipe.id || ur.backendId === serverRecipe.id,
          );
          // 사용자가 직접 삭제한 레시피는 서버에 남아 있어도 재복원하지 않음
          const wasDeleted = deletedRecipeServerIds.includes(serverRecipe.id);
          if (!alreadyLinked && !wasDeleted) {
            const restored = backendToRecipe(serverRecipe);
            addUserRecipe({
              id: `server-${serverRecipe.id}`,
              title: restored.title,
              emoji: restored.emoji,
              category: restored.category,
              cookTime: restored.cookTime,
              servings: 2,
              ingredients: restored.ingredients,
              steps: restored.steps,
              tools: restored.tools,
              totalNutrition: restored.totalNutrition,
              youtubeUrl: serverRecipe.video_url ?? '',
              createdAt: serverRecipe.created_at,
              sharedRecipeId: serverRecipe.is_public ? serverRecipe.id : undefined,
              isPublic: serverRecipe.is_public === true,
              backendId: serverRecipe.id,
            });
          }
        });
      })
      .catch(() => { /* 실패 시 로컬 userRecipes만 사용 */ });
  }, [currentUser?.id, deletedRecipeServerIds]);

  // ─────────────────────────────────────────────────────────────────────
  // top3Display: 프론트 계산 폴백 — getTop3Recipes() 실패 시 사용
  // top3Banner: 실제 UI에서 쓰는 값 (서버 API 우선, 없으면 프론트 계산)
  // ─────────────────────────────────────────────────────────────────────
  const top3Display = useMemo(
    () =>
      [...allRecipes]
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 3),
    [allRecipes],
  );
  const top3Banner = top3Recipes.length > 0 ? top3Recipes : top3Display;



  const [cookingMode, setCookingMode] = useState<{ title: string; steps: string[] } | null>(null);

  const startCooking = async (title: string, steps: string[], recipeId?: number) => {
    // steps가 이미 있으면 바로 시작
    if (steps && steps.length > 0) {
      setCookingMode({ title, steps });
      return;
    }
    // steps가 없으면 상세 조회로 다시 가져오기
    if (!recipeId) {
      Alert.alert('조리 방법 없음', '이 레시피에는 등록된 조리 순서가 없어요.');
      return;
    }
    try {
      const detail = await getRecipeById(recipeId);
      const detailSteps = (detail.steps ?? [])
        .sort((a, b) => a.step_number - b.step_number)
        .map((s) => s.description);
      if (detailSteps.length === 0) {
        Alert.alert('조리 방법 없음', '이 레시피에는 등록된 조리 순서가 없어요.');
        return;
      }
      setCookingMode({ title, steps: detailSteps });
    } catch {
      Alert.alert('오류', '레시피 정보를 불러오지 못했어요.');
    }
  };

  // 백엔드에 올라간 레시피는 본인 것 포함 모두 표시
  useEffect(() => {
    if (activeTab !== 2) {
      setTab2AvailTools([]);
      setTab2ToolFilterVisible(false);
    }
  }, [activeTab]);

  const communityRecipes = useMemo(
    () => allRecipes,
    [allRecipes],
  );

  const filteredRecipes = useMemo(() => {
    const q = searchText.toLowerCase();

    return communityRecipes.filter((r) => {
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      return canMakeWithSelectedTools(r, availableTools);
    });
  }, [searchText, communityRecipes, availableTools]);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const favoriteRecipes = useMemo(() => {
    // 로컬 favoriteIds 기반 + 서버 liked 목록 병합 (중복 제거)
    const localFavs = communityRecipes.filter((r) => favoriteIdSet.has(r.id));
    const serverIds = new Set(localFavs.map((r) => r.id));
    const serverOnly = serverLikedRecipes.filter((r) => !serverIds.has(r.id));
    return [...localFavs, ...serverOnly];
  }, [favoriteIdSet, communityRecipes, serverLikedRecipes]);

  const setLikePending = (id: number, pending: boolean) => {
    const next = new Set(pendingLikeIdsRef.current);
    if (pending) next.add(id);
    else next.delete(id);
    pendingLikeIdsRef.current = next;
    setPendingLikeIds(next);
  };

  const updateRecipeLikeCount = (id: number, updater: (likes: number) => number) => {
    const applyLikeUpdate = (r: Recipe) => (
      r.id === id ? { ...r, likes: Math.max(0, updater(r.likes)) } : r
    );
    setAllRecipes((prev) => prev.map(applyLikeUpdate));
    setTop3Recipes((prev) => prev.map(applyLikeUpdate));
  };

  const refreshTop3Soon = () => {
    if (top3RefreshTimerRef.current) clearTimeout(top3RefreshTimerRef.current);
    top3RefreshTimerRef.current = setTimeout(() => {
      getTop3Recipes()
        .then((data) => { if (data.length > 0) setTop3Recipes(data.map(backendToRecipe)); })
        .catch(() => {});
    }, 700);
  };

  // 인기 레시피 카드 탭 → filteredRecipes에서 해당 아이템으로 스크롤
  const handleTop3Press = useCallback((recipeId: number) => {
    const idx = filteredRecipes.findIndex((r) => r.id === recipeId);
    if (idx >= 0) {
      recipeListRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  }, [filteredRecipes]);

  const allIngredientNames = useMemo<string[]>(() => {
    const names = new Set<string>();
    communityRecipes.forEach((r) => r.ingredients.forEach((i) => { if (i.name) names.add(i.name); }));
    return Array.from(names).sort();
  }, [communityRecipes]);

  const filteredIngredientNames = useMemo<string[]>(() => {
    const q = searchText.toLowerCase();
    if (!q) return allIngredientNames;
    return allIngredientNames.filter((n) => n.toLowerCase().includes(q));
  }, [searchText, allIngredientNames]);

  const tab2Items = filteredIngredientNames;

  const recommendedRecipes = useMemo(() => {
    if (selectedIngredients.length < 2) return [];
    return allRecipes.filter((recipe) => {
      const matchCount = recipe.ingredients.filter((ri) =>
        selectedIngredients.some(
          (ing) => ri.name.includes(ing) || ing.includes(ri.name),
        ),
      ).length;
      const len = recipe.ingredients.length;
      const threshold = len <= 3
        ? Math.ceil(len / 2)
        : Math.floor(len / 2) + 1;
      if (matchCount < threshold) return false;

      return canMakeWithSelectedTools(recipe, tab2AvailTools);
    });
  }, [selectedIngredients, allRecipes, tab2AvailTools]);

  const toggleIngredient = (name: string): void => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const goToRecipe = (recipeId: number): void => {
    // 1) 검색어 초기화 — 필터 해제해서 대상 레시피가 filteredRecipes 에 포함되게 함
    setSearchText('');
    // 2) 대상 카드 펼치기
    setExpandedId(recipeId);

    const index = allRecipes.findIndex((r) => r.id === recipeId);
    if (index === -1) return;

    if (activeTab === 1 && recipeListRef.current) {
      // 이미 레시피 탭이 열려있고 FlatList 가 마운트된 경우 → 바로 스크롤
      recipeListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    } else {
      // 다른 탭에서 넘어오는 경우 → pendingScrollIndexRef 에 저장
      // FlatList 가 마운트될 때 handleListRef 에서 자동으로 스크롤 실행
      pendingScrollIndexRef.current = index;
      setActiveTab(1);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // toggleLike: 좋아요 토글
  // 1) wasLiked 캡처 → toggleFavorite 낙관적 업데이트 (즉시 하트 반영)
  // 2) POST /recipes/:id/like/:userId 호출
  // 3) res.liked === wasLiked 이면 서버가 반대로 처리한 것 → toggleFavorite 재호출로 교정
  //    ※ isFavorite(id)를 async 콜백 내에서 쓰면 stale closure 로 잘못된 값을 읽으므로
  //       wasLiked (동기 캡처값)만 사용
  // 4) 서버 likes_count 로 숫자 동기화
  // 5) API 실패 → toggleFavorite 재호출로 낙관적 업데이트 롤백
  // ─────────────────────────────────────────────────────────────────────────
  const toggleLike = async (id: number): Promise<void> => {
    if (!currentUser || pendingLikeIdsRef.current.has(id)) return;

    const wasLiked = favoriteIdSet.has(id);
    const optimisticLiked = !wasLiked;
    const optimisticDelta = optimisticLiked ? 1 : -1;

    setLikePending(id, true);
    toggleFavorite(id);
    updateRecipeLikeCount(id, (likes) => likes + optimisticDelta);

    try {
      const res = await toggleRecipeLike(id, currentUser.id);

      if (res.liked !== optimisticLiked) {
        toggleFavorite(id);
      }

      updateRecipeLikeCount(id, () => res.likes_count);
      refreshTop3Soon();
    } catch {
      toggleFavorite(id);
      updateRecipeLikeCount(id, (likes) => likes - optimisticDelta);
      Alert.alert('좋아요 반영 실패', '네트워크 상태를 확인한 뒤 다시 눌러주세요.');
    } finally {
      setLikePending(id, false);
    }
  };

  const handleAdd = async (mealType: MealType, item: ModalItem, customNutrition: NutritionInfo): Promise<void> => {
    let food: Food;
    if ('title' in item) {
      food = {
        id: item.id, name: item.title, emoji: item.emoji,
        nutrition: customNutrition, per: '1인분', category: item.category,
      };
    } else {
      food = { ...item, nutrition: customNutrition };
    }

    addMealLog(mealType, food);
    Alert.alert('추가 완료!', `${mealType}에 "${food.name}"이(가) 추가됐어요.`);

    if (currentUser) {
      const today = new Date().toISOString().split('T')[0];
      saveMealLog(String(currentUser.id), {
        mealType,
        foodName: food.name,
        quantity: 100,
        calories: customNutrition.calories ?? 0,
        carbs: customNutrition.carbs ?? 0,
        protein: customNutrition.protein ?? 0,
        fat: customNutrition.fat ?? 0,
        fiber: customNutrition.fiber,
        sugar: customNutrition.sugar,
        sodium: customNutrition.sodium,
        eatDate: today,
      }).catch(() => {
        Alert.alert('서버 저장 실패', '앱에는 추가됐지만 서버 식단 기록 저장에 실패했어요. 네트워크 상태를 확인해주세요.');
      });
    }
  };

  // ── 레시피 카드 ──
  const RecipeCard = ({ item }: { item: Recipe }) => {
    const isExpanded = expandedId === item.id;
    const itemLiked = favoriteIdSet.has(item.id);
    const itemLikePending = pendingLikeIds.has(item.id);
    const n = item.totalNutrition;
    const hasNutrition = n.calories > 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => {
            const nextExpanded = isExpanded ? null : item.id;
            setExpandedId(nextExpanded);
            // 처음 펼칠 때, 아직 steps를 안 가져왔으면 getRecipeById로 조회
            if (nextExpanded !== null && !fetchedStepIds.current.has(item.id) && item.steps.length === 0) {
              setFetchingStepId(item.id);
              getRecipeById(item.id)
                .then((full) => {
                  const steps = (full.steps ?? [])
                    .sort((a, b) => a.step_number - b.step_number)
                    .map((s) => s.description);
                  setAllRecipes((prev) =>
                    prev.map((r) => r.id === item.id ? { ...r, steps } : r),
                  );
                  fetchedStepIds.current.add(item.id);
                })
                .catch(() => { /* steps 없으면 그냥 숨김 */ })
                .finally(() => setFetchingStepId(null));
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {item.creatorId === String(currentUser?.id ?? '') && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('레시피 삭제', `"${item.title}"을 삭제할까요?`, [
                      { text: '취소', style: 'cancel' },
                      {
                        text: '삭제', style: 'destructive',
                        onPress: async () => {
                          // 로컬 상태 먼저 제거 (백엔드 DELETE /recipes/:id/:userId 구현 후 API 연동 예정)
                          setAllRecipes((prev) => prev.filter((r) => r.id !== item.id));
                          setTop3Recipes((prev) => prev.filter((r) => r.id !== item.id));
                          removeUserRecipe(String(item.id));
                          addDeletedRecipeServerId(item.id);
                          try {
                            await deleteRecipe(item.id, String(currentUser!.id));
                            refreshTop3Soon();
                          } catch {
                            Alert.alert('삭제 실패', '서버에서 레시피를 삭제하지 못했어요. 네트워크 상태를 확인해주세요.');
                            refreshTop3Soon();
                          }
                        },
                      },
                    ])}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => toggleLike(item.id)}
                  disabled={itemLikePending}
                  activeOpacity={0.55}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 3,
                    opacity: itemLikePending ? 0.65 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{itemLiked ? '❤️' : '🤍'}</Text>
                  {item.likes > 0 && (
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: itemLiked ? '#E74C3C' : colors.textLight,
                    }}>
                      {item.likes}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardMeta}>⏱️ {item.cookTime}분 · {item.category}</Text>
            {Boolean(item.creatorName) && (
              <Text style={styles.cardCreator}>👤 {item.creatorName}</Text>
            )}
            {hasNutrition ? (
              <View style={styles.calRow}>
                <Text style={styles.cardCal}>🔥 {n.calories} kcal</Text>
                <View style={styles.miniNutriRow}>
                  <NutriBadge label="탄" value={n.carbs} color="#F6A623" />
                  <NutriBadge label="단" value={n.protein} color="#2ECC71" />
                  <NutriBadge label="지" value={n.fat} color="#9B59B6" />
                  <NutriBadge label="섬유" value={n.fiber ?? 0} color="#27AE60" />
                  <NutriBadge label="당" value={n.sugar ?? 0} color="#E67E22" />
                  <NutriBadge label="나트륨" value={n.sodium ?? 0} color="#7F8C8D" unit="mg" />
                </View>
              </View>
            ) : (
              <Text style={styles.noNutriText}>영양정보 미등록</Text>
            )}
          </View>
          <Text style={[styles.expandArrow, isExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedArea}>
            {item.tools.length > 0 && (
              <View style={styles.expandSection}>
                <Text style={styles.expandTitle}>🍳 조리도구</Text>
                <View style={styles.toolsRow}>
                  {item.tools.map((tool) => (
                    <View key={tool} style={styles.toolChip}>
                      <Text style={styles.toolChipText}>{tool}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {item.ingredients.length > 0 && (
              <View style={styles.expandSection}>
                <Text style={styles.expandTitle}>📋 재료</Text>
                <View style={styles.ingGrid}>
                  {item.ingredients.map((ing) => (
                    <View key={ing.name} style={styles.ingChip}>
                      <Text style={styles.ingChipText}>{ing.name}</Text>
                      </View>
                  ))}
                </View>
              </View>
            )}

            {fetchingStepId === item.id ? (
              <View style={[styles.expandSection, { alignItems: 'center', paddingVertical: 12 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textLight, marginTop: 6 }}>조리 방법 불러오는 중...</Text>
              </View>
            ) : item.steps.length > 0 ? (
              <View style={styles.expandSection}>
                <Text style={styles.expandTitle}>👨‍🍳 조리 방법</Text>
                {item.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.expandActions}>
              <TouchableOpacity
                style={styles.cookingBtn}
                onPress={() => startCooking(item.title, item.steps, item.id)}
              >
                <Text style={styles.cookingBtnText}>🍳 요리 시작</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={() => setModalItem(item)}>
                <Text style={styles.addBtnText}>+ 식단 추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  // ── 음식·재료 통합 카드 (Tab 2) ──
  // 카드 본체 탭 = 선택(레시피 추천용) / + 버튼 = 식단에 추가
  const FoodIngredientCard = ({ name }: { name: string }) => {
    const isSelected = selectedIngredients.includes(name);
    return (
      <TouchableOpacity
        style={[styles.fiCard, isSelected && styles.fiCardSelected]}
        onPress={() => toggleIngredient(name)}
        activeOpacity={0.85}
      >
        <View style={[styles.fiSelectBar, isSelected && { backgroundColor: colors.primary }]} />

        <View style={styles.fiBody}>
          <View style={styles.fiNameRow}>
            <Text style={styles.fiName} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── 유튜브 레시피 분석 ──
  // -- YouTube recipe analysis --
  const handleAnalyzeYoutube = async () => {
    if (!youtubeUrl.trim()) {
      Alert.alert('잘못된 URL', '유튜브 영상 주소만 사용할 수 있어요.\n예: https://youtube.com/watch?v=...');
    }
    if (!currentUser) {
      Alert.alert('로그인 필요', '로그인 후 사용할 수 있어요.');
      return;
    }
    const canonicalYoutubeUrl = toCanonicalYoutubeUrl(youtubeUrl);
    if (!canonicalYoutubeUrl) {
      Alert.alert('잘못된 URL', '유튜브 영상 주소만 사용할 수 있어요.\n예: https://youtube.com/watch?v=...');
      return;
    }
    setAnalyzing(true);
    setAnalysisStatusText('영상 주소를 확인하고 있어요.');
    setYoutubeAnalysisError(null);
    setAnalyzedRecipe(null);
    try {
      setAnalysisStatusText('자막을 읽고 레시피를 분석하고 있어요.');
      const res = await analyzeYoutubeRecipe(String(currentUser.id), canonicalYoutubeUrl);
      if (res.success && res.title) {
        const newRecipe: UserRecipe = {
          id: res.id ? String(res.id) : String(Date.now()),
          title: res.title,
          emoji: '🍳',
          category: '나만의 요리',
          cookTime: 30,
          servings: 2,
          youtubeUrl: res.video_url ?? canonicalYoutubeUrl,
          ingredients: (res.ingredients ?? []).map((i) => ({ name: i.name })),
          steps: (res.steps ?? [])
            .sort((a, b) => a.step_number - b.step_number)
            .map((s) => s.description),
          totalNutrition: {
            calories: res.calories ?? 0,
            carbs: res.carbs ?? 0,
            protein: res.protein ?? 0,
            fat: res.fat ?? 0,
            fiber: res.fiber ?? 0,
            sugar: res.sugar ?? 0,
            sodium: res.sodium ?? 0,
          },
          createdAt: new Date().toLocaleDateString('ko-KR'),
          backendId: res.id,
          isPublic: res.is_public === true,
          sharedRecipeId: res.is_public ? res.id : undefined,
        };
        setYoutubeAnalysisError(null);
        setAnalyzedRecipe(newRecipe);
      } else {
        const errMsg = res.message ?? '';
        const fallbackMessage = errMsg.includes('자막')
          ? '이 영상은 자막을 가져올 수 없어요. 영상 설명란이나 댓글의 레시피를 직접 붙여 넣어 저장할 수 있어요.'
          : '이 영상에서 레시피 정보를 찾지 못했어요. 한국어 자막이 있는 요리 영상이 가장 잘 분석돼요.';
        setYoutubeAnalysisError(fallbackMessage);
      }
    } catch {
      setYoutubeAnalysisError('서버와 연결할 수 없어요. 잠시 후 다시 시도하거나 직접 작성으로 이어가 주세요.');
    } finally {
      setAnalysisStatusText('');
      setAnalyzing(false);
    }
  };

  const handleYoutubeFallbackWrite = () => {
    const canonicalYoutubeUrl = toCanonicalYoutubeUrl(youtubeUrl) ?? youtubeUrl.trim();
    setEditInitial({ youtubeUrl: canonicalYoutubeUrl });
    setEditModalVisible(true);
  };

  const handleSaveUserRecipe = () => {
    if (!analyzedRecipe) return;
    const title = analyzedRecipe.title;
    // 비공개 상태로 나만의 레시피에만 저장 (backendId로 DB 연결 유지)
    addUserRecipe(analyzedRecipe);
    setAnalyzedRecipe(null);
    setYoutubeUrl('');
    Alert.alert('저장 완료! 🎉', `"${title}" 레시피가 나만의 레시피에 저장됐어요.
공개하려면 나만의 레시피에서 공개하기 버튼을 눌러주세요.`);
  };

  // 직접 작성 / 수정 후 저장
  const openNewRecipe = () => {
    setEditInitial(null);
    setEditModalVisible(true);
  };

  const openEditRecipe = (recipe: UserRecipe) => {
    setEditInitial(recipe);
    setEditModalVisible(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleEditSave: 레시피 직접 작성/수정 저장
  // - 신규 레시피: 나만의 레시피(로컬)에만 저장 → 공개는 별도 "공개하기" 버튼
  // - 기존 수정: 로컬 업데이트 + 공개 상태라면 레시피 탭(allRecipes)도 즉시 동기화
  //   * 수정 PATCH API 없음 → 프론트 로컬만 반영 (백엔드 구현 대기)
  // ─────────────────────────────────────────────────────────────────────────
  const handleEditSave = (recipe: UserRecipe) => {
    const isExisting = userRecipes.some((r) => r.id === recipe.id);
    if (isExisting) {
      updateUserRecipe(recipe);
      if (recipe.isPublic && recipe.sharedRecipeId) {
        // 로컬 즉시 반영
        setAllRecipes((prev) =>
          prev.map((r) =>
            r.id === recipe.sharedRecipeId
              ? {
                  ...r,
                  title: recipe.title,
                  emoji: recipe.emoji,
                  cookTime: recipe.cookTime,
                  category: recipe.category,
                  ingredients: recipe.ingredients.map((i) => ({
                    name: i.name,
                    amount: '',
                    nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
                  })),
                  tools: recipe.tools ?? r.tools,
                  steps: recipe.steps,
                  totalNutrition: recipe.totalNutrition,
                  content: recipe.steps.join('\n'),
                }
              : r,
          ),
        );
        // 백엔드 PUT /recipes/:id/:userId 동기화
        if (currentUser) {
          updateRecipe(recipe.backendId ?? recipe.sharedRecipeId, String(currentUser.id), {
            title: recipe.title,
            content: recipe.steps.join('\n'),
            ingredients: recipe.ingredients.map((i) => i.name),
            cooking_tools: recipe.tools ?? [],
            steps: recipe.steps.map((s, idx) => ({ step_number: idx + 1, description: s })),
          }).catch(() => { /* 로컬 반영은 이미 됐으므로 실패 무시 */ });
        }
      }
    } else {
      addUserRecipe(recipe);
    }
    setEditModalVisible(false);
    setAnalyzedRecipe(null);
    setYoutubeUrl('');
  };

  const handlePublishUserRecipe = async (recipe: UserRecipe) => {
    if (!currentUser) return;
    Alert.alert(
      '\uB808\uC2DC\uD53C \uACF5\uAC1C',
      `"${recipe.title}"\uC744(\uB97C) \uB808\uC2DC\uD53C \uD0ED\uC5D0 \uACF5\uAC1C\uD560\uAE4C\uC694?`,
      [
        { text: '\uCDE8\uC18C', style: 'cancel' },
        {
          text: '\uACF5\uAC1C\uD558\uAE30', style: 'default',
          onPress: async () => {
            setRecipeActionId(recipe.id);
            try {
              const numericRecipeId = Number(recipe.id);
              let backendId = recipe.backendId ?? (Number.isFinite(numericRecipeId) ? numericRecipeId : undefined);

              if (!backendId) {
                const created = await createRecipe(String(currentUser.id), {
                  title: recipe.title,
                  content: recipe.steps.join('\n'),
                  ingredients: recipe.ingredients.map((i) => i.name),
                  cooking_tools: recipe.tools ?? [],
                  steps: recipe.steps.map((s, idx) => ({ step_number: idx + 1, description: s })),
                });
                backendId = created.id;
              }

              const currentServerRecipe = backendId
                ? await getRecipeById(backendId).catch(() => null)
                : null;
              const result = currentServerRecipe?.is_public === true
                ? currentServerRecipe
                : await toggleRecipePublic(backendId, String(currentUser.id));

              const fullResult = (!result.title && backendId)
                ? await getRecipeById(backendId).catch(() => result)
                : result;

              const publishedServerId = fullResult.id ?? result.id ?? backendId;
              const nutrition = {
                calories: fullResult.calories ?? result.calories ?? recipe.totalNutrition.calories ?? 0,
                carbs: fullResult.carbs ?? result.carbs ?? recipe.totalNutrition.carbs ?? 0,
                protein: fullResult.protein ?? result.protein ?? recipe.totalNutrition.protein ?? 0,
                fat: fullResult.fat ?? result.fat ?? recipe.totalNutrition.fat ?? 0,
                fiber: fullResult.fiber ?? result.fiber ?? recipe.totalNutrition.fiber ?? 0,
                sugar: fullResult.sugar ?? result.sugar ?? recipe.totalNutrition.sugar ?? 0,
                sodium: fullResult.sodium ?? result.sodium ?? recipe.totalNutrition.sodium ?? 0,
              };
              const mergedRecipe: BackendRecipe = {
                ...fullResult,
                id: publishedServerId,
                title: fullResult.title || recipe.title,
                content: fullResult.content ?? recipe.steps.join('\n'),
                likes_count: fullResult.likes_count ?? 0,
                created_at: fullResult.created_at ?? new Date().toISOString(),
                ingredients: fullResult.ingredients?.length
                  ? fullResult.ingredients
                  : recipe.ingredients.map((i, idx) => ({ id: idx, name: i.name })),
                cooking_tools: fullResult.cooking_tools?.length
                  ? fullResult.cooking_tools
                  : (recipe.tools ?? []).map((name, idx) => ({ id: idx, name })),
                steps: fullResult.steps?.length
                  ? fullResult.steps
                  : recipe.steps.map((description, idx) => ({ step_number: idx + 1, description })),
                calories: nutrition.calories,
                carbs: nutrition.carbs,
                protein: nutrition.protein,
                fat: nutrition.fat,
                fiber: nutrition.fiber,
                sugar: nutrition.sugar,
                sodium: nutrition.sodium,
                is_public: fullResult.is_public ?? result.is_public ?? true,
              };
              const isActuallyPublic = mergedRecipe.is_public !== false;
              const published = {
                ...recipe,
                backendId: publishedServerId,
                sharedRecipeId: isActuallyPublic ? publishedServerId : undefined,
                isPublic: isActuallyPublic,
                totalNutrition: nutrition,
              };
              updateUserRecipe(published);

              if (isActuallyPublic) {
                const publicRecipe = backendToRecipe(mergedRecipe);
                setAllRecipes((prev) => [publicRecipe, ...prev.filter((r) => r.id !== publishedServerId)]);
                setTop3Recipes((prev) => [publicRecipe, ...prev.filter((r) => r.id !== publishedServerId)]
                  .sort((a, b) => b.likes - a.likes)
                  .slice(0, 3));
                refreshTop3Soon();
                Alert.alert('\uACF5\uAC1C \uC644\uB8CC!', `"${recipe.title}" \uB808\uC2DC\uD53C\uAC00 \uB808\uC2DC\uD53C \uD0ED\uC5D0 \uACF5\uAC1C\uB410\uC5B4\uC694.`);
              } else {
                Alert.alert('\uACF5\uAC1C \uC804\uD658 \uD655\uC778', '\uC11C\uBC84\uAC00 \uC544\uC9C1 \uBE44\uACF5\uAC1C \uC0C1\uD0DC\uB85C \uC751\uB2F5\uD588\uC5B4\uC694.');
              }
            } catch {
              Alert.alert('\uC624\uB958', '\uACF5\uAC1C\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
            } finally {
              setRecipeActionId(null);
            }
          },
        },
      ],
    );
  };

  const handleUnpublishUserRecipe = async (recipe: UserRecipe) => {
    Alert.alert(
      '비공개로 전환',
      `"${recipe.title}"을 비공개로 전환할까요?\n레시피 탭에서 내려가고 나만의 레시피에만 남습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '비공개로 전환', style: 'destructive',
          onPress: async () => {
            setRecipeActionId(recipe.id);
            // 로컬 즉시 반영
            updateUserRecipe({ ...recipe, sharedRecipeId: undefined, isPublic: false });
            const serverRecipeId = recipe.sharedRecipeId ?? recipe.backendId;
            if (serverRecipeId) {
              setAllRecipes((prev) => prev.filter((r) => r.id !== serverRecipeId));
              setTop3Recipes((prev) => prev.filter((r) => r.id !== serverRecipeId));
              refreshTop3Soon();
              // PATCH /recipes/:id/public/:userId — is_public 토글 (삭제 아님)
              try {
                const currentServerRecipe = await getRecipeById(serverRecipeId).catch(() => null);
                if (currentServerRecipe?.is_public !== false) {
                  await toggleRecipePublic(serverRecipeId, String(currentUser?.id ?? ''));
                }
              } catch {
                updateUserRecipe(recipe);
                Alert.alert('오류', '비공개 전환에 실패했어요. 잠시 후 다시 시도해주세요.');
              } finally {
                setRecipeActionId(null);
              }
            } else {
              setRecipeActionId(null);
            }
          },
        },
      ],
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleDeleteUserRecipe: 나만의 레시피 완전 삭제
  // - 로컬(userRecipes)에서 제거
  // - 공개 상태(sharedRecipeId 있음)면 allRecipes에서도 제거
  //   + DELETE API 호출 (백엔드 미구현 시 무시)
  // ─────────────────────────────────────────────────────────────────────────
  const handleDeleteUserRecipe = (r: UserRecipe) => {
    Alert.alert('삭제', `"${r.title}" 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          // 1. 로컬 제거
          removeUserRecipe(r.id);
          // 2. 레시피 탭(allRecipes)에서도 제거
          const serverRecipeId = r.sharedRecipeId ?? r.backendId;
          if (serverRecipeId) {
            setAllRecipes((prev) => prev.filter((a) => a.id !== serverRecipeId));
            setTop3Recipes((prev) => prev.filter((r) => r.id !== serverRecipeId));
              refreshTop3Soon();
          }
          // 3. 삭제된 서버 ID 영구 보관 (재시작/핫리로드 후 재복원 방지)
          if (serverRecipeId) {
            addDeletedRecipeServerId(serverRecipeId);
          }
          // 4. 백엔드 DELETE — sharedRecipeId(공개) 또는 backendId(비공개) 사용
          if (currentUser && serverRecipeId) {
            deleteRecipe(serverRecipeId, String(currentUser.id)).catch(() => {
              // 서버 삭제 실패해도 로컬은 이미 제거됨 — 무시
            });
          }
        },
      },
    ]);
  };



  // ── 로딩 뷰 ──
  const LoadingView = () => (
    <View style={styles.loadingBox}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>레시피 불러오는 중...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ── 헤더 ── */}
      <View style={[styles.header, { paddingTop: spacing.sm + insets.top }]}>
        <Text style={styles.headerTitle}>음식 검색</Text>

        {/* 탭 바 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRowContent}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i as 0 | 1 | 2 | 3)}
              activeOpacity={0.7}
            >
              <Text style={styles.tabIcon}>{TAB_ICONS[i]}</Text>
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {t === '즐겨찾기' && favoriteIds.length > 0 ? `${t} ${favoriteIds.length}` : t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 검색바 */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 2 ? '재료명으로 검색...' : '레시피명, 재료로 검색...'}
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 사용 가능한 조리기구 필터 (백엔드에는 선택하지 않은 도구를 excludeTools로 전달) */}
        {activeTab === 1 && (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: 6 }}>
            <TouchableOpacity
              onPress={() => setToolFilterVisible(v => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <Text style={{ fontSize: 13, color: availableTools.length > 0 ? colors.primary : colors.textLight, fontWeight: '600' }}>
                🍳 조리기구 필터 {availableTools.length > 0 ? `(${availableTools.length}개 사용 가능)` : ''}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textLight }}>{toolFilterVisible ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {toolFilterVisible && (
              <View>
                <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 6 }}>가지고 있는 조리기구를 선택하면, 그 도구만으로 가능한 레시피만 보여요</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {COOKING_TOOLS.map((tool) => {
                      const isAvailable = availableTools.includes(tool);
                      return (
                        <TouchableOpacity
                          key={tool}
                          onPress={() => setAvailableTools(prev =>
                            isAvailable ? prev.filter(t => t !== tool) : [...prev, tool]
                          )}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 5,
                            borderRadius: 14, borderWidth: 1,
                            borderColor: isAvailable ? colors.primary : colors.border,
                            backgroundColor: isAvailable ? colors.primaryLight : '#fff',
                          }}
                        >
                          <Text style={{ fontSize: 12, color: isAvailable ? colors.primary : colors.text, fontWeight: isAvailable ? '700' : '400' }}>
                            {isAvailable ? '✓ ' : ''}{tool}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                {availableTools.length > 0 && (
                  <TouchableOpacity onPress={() => setAvailableTools([])} style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 12, color: colors.primary }}>필터 초기화</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── 탭 콘텐츠 ── */}
      {activeTab === 0 ? (
        <FlatList
          key="favorite-list"
          data={favoriteRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RecipeCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🤍</Text>
              <Text style={styles.emptyTitle}>즐겨찾기가 없어요</Text>
              <Text style={styles.emptySub}>레시피 탭에서 마음에 드는 레시피를 저장해 보세요.</Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setActiveTab(1)}>
                <Text style={styles.emptyActionText}>레시피 보러가기</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : activeTab === 1 ? (
        recipesLoading ? <LoadingView /> : (
          <FlatList
            key="recipe-list"
            ref={(ref) => {
              recipeListRef.current = ref;
              // FlatList 가 마운트됐을 때 대기 중인 스크롤 요청이 있으면 실행
              if (ref && pendingScrollIndexRef.current !== null) {
                const idx = pendingScrollIndexRef.current;
                pendingScrollIndexRef.current = null;
                // 초기 레이아웃 완료 대기 (짧은 지연으로 충분)
                setTimeout(() => {
                  ref.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
                }, 150);
              }
            }}
            data={filteredRecipes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <RecipeCard item={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={top3Banner.length > 0 ? (
              <View style={styles.top3Card}>
                <Text style={styles.top3Title}>🏆 인기 레시피</Text>
                {top3Banner.map((r, i) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.top3Row}
                    activeOpacity={0.7}
                    onPress={() => handleTop3Press(r.id)}
                  >
                    <Text style={styles.top3Rank}>{['🥇','🥈','🥉'][i]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.top3Name} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.top3Meta}>
                        ❤️ {r.likes} · 👤 {r.creatorName ?? '익명'}{r.totalNutrition.calories ? ` · 🔥 ${r.totalNutrition.calories}kcal` : ''}
                      </Text>
                    </View>
                    <Text style={styles.top3Arrow}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            onScrollToIndexFailed={(info) => {
              // 아이템 높이 미계측 시 averageItemLength 로 오프셋 추정 후 이동
              recipeListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
              // 이동 후 정밀 교정 재시도
              setTimeout(() => {
                recipeListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 0.1,
                });
              }, 400);
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
                <Text style={styles.emptySub}>검색어를 바꾸거나 조리기구 필터를 초기화해 보세요.</Text>
                <View style={styles.emptyActionRow}>
                  <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setSearchText('')}>
                    <Text style={styles.emptyActionText}>다른 검색어 입력</Text>
                  </TouchableOpacity>
                  {availableTools.length > 0 ? (
                    <TouchableOpacity style={styles.emptyGhostBtn} onPress={() => setAvailableTools([])}>
                      <Text style={styles.emptyGhostText}>필터 초기화</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            }
          />
        )
      ) : activeTab === 2 ? (
        <FlatList
          key="food-ingredient-list"
          data={tab2Items}
          keyExtractor={(item) => `fi-${item}`}
          renderItem={({ item }) => <FoodIngredientCard name={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* 선택된 항목 + 레시피 추천 */}
              {selectedIngredients.length >= 2 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                      backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
                    }}
                    onPress={() => setTab2ToolFilterVisible((v) => !v)}
                  >
                    <Text style={{ fontSize: 13, color: tab2AvailTools.length > 0 ? colors.primary : colors.textLight, fontWeight: '600' }}>
                      {tab2AvailTools.length > 0 ? `\uD83C\uDF73 \uC0AC\uC6A9 \uAC00\uB2A5 ${tab2AvailTools.length}\uAC1C` : '\uD83C\uDF73 \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC870\uB9AC\uAE30\uAD6C'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textLight }}>{tab2ToolFilterVisible ? '\u25B2' : '\u25BC'}</Text>
                  </TouchableOpacity>

                  {tab2ToolFilterVisible && (
                    <View style={{ marginTop: 6, padding: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, color: colors.textLight, marginBottom: 6 }}>{'\uAC00\uC9C0\uACE0 \uC788\uB294 \uC870\uB9AC\uAE30\uAD6C\uB97C \uC120\uD0DD\uD558\uBA74, \uADF8 \uB3C4\uAD6C\uB9CC\uC73C\uB85C \uAC00\uB2A5\uD55C \uB808\uC2DC\uD53C\uB9CC \uBCF4\uC5EC\uC694'}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {COOKING_TOOLS.map((tool) => {
                            const isAvailable = tab2AvailTools.includes(tool);
                            return (
                              <TouchableOpacity
                                key={tool}
                                onPress={() => setTab2AvailTools((prev) =>
                                  isAvailable ? prev.filter((t) => t !== tool) : [...prev, tool]
                                )}
                                style={{
                                  paddingHorizontal: 12, paddingVertical: 5,
                                  borderRadius: 14, borderWidth: 1,
                                  borderColor: isAvailable ? colors.primary : colors.border,
                                  backgroundColor: isAvailable ? colors.primaryLight : '#fff',
                                }}
                              >
                                <Text style={{ fontSize: 12, color: isAvailable ? colors.primary : colors.text, fontWeight: isAvailable ? '700' : '400' }}>
                                  {isAvailable ? '\u2713 ' : ''}{tool}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                      {tab2AvailTools.length > 0 && (
                        <TouchableOpacity onPress={() => setTab2AvailTools([])} style={{ marginTop: 6 }}>
                          <Text style={{ fontSize: 12, color: colors.primary }}>{'\uD544\uD130 \uCD08\uAE30\uD654'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

              {selectedIngredients.length > 0 && (
                <View style={styles.selectedBox}>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedTitle}>🧺 선택한 재료·음식 ({selectedIngredients.length})</Text>
                    <TouchableOpacity onPress={() => setSelectedIngredients([])}>
                      <Text style={styles.clearText}>전체 해제</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.selectedChipRow}>
                    {selectedIngredients.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={styles.selectedChip}
                        onPress={() => toggleIngredient(name)}
                      >
                        <Text style={styles.selectedChipText}>{name}</Text>
                        <Text style={styles.selectedChipX}> ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {selectedIngredients.length >= 2 ? (
                    recommendedRecipes.length > 0 ? (
                      <View style={styles.recommendBox}>
                        <Text style={styles.recommendTitle}>🍳 만들 수 있는 레시피 {recommendedRecipes.length}개</Text>
                        {recommendedRecipes.map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={styles.recommendItem}
                            onPress={() => goToRecipe(r.id)}
                          >
                            <Text style={styles.recommendEmoji}>{r.emoji}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recommendName}>{r.title}</Text>
                              <Text style={styles.recommendCal}>🔥 {r.totalNutrition.calories} kcal · ⏱️ {r.cookTime}분</Text>
                            </View>
                            <Text style={styles.recommendArrow}>›</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noRecommendBox}>
                        <Text style={styles.noRecommend}>{tab2AvailTools.length > 0 ? '\uC120\uD0DD\uD55C \uC7AC\uB8CC\uC640 \uC870\uB9AC\uAE30\uAD6C\uB85C\uB294 \uCD94\uCC9C\uD560 \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694.' : '\uC120\uD0DD\uD55C \uC7AC\uB8CC \uC870\uD569\uC5D0 \uB9DE\uB294 \uB808\uC2DC\uD53C\uAC00 \uC5C6\uC5B4\uC694.'}</Text>
                        <View style={styles.emptyActionRow}>
                          {tab2AvailTools.length > 0 ? (
                            <TouchableOpacity style={styles.emptyGhostBtn} onPress={() => setTab2AvailTools([])}>
                              <Text style={styles.emptyGhostText}>필터 초기화</Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setSelectedIngredients([])}>
                            <Text style={styles.emptyActionText}>다른 재료 선택</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  ) : (
                    <Text style={styles.noRecommend}>재료·음식을 {2 - selectedIngredients.length}개 더 선택하면 레시피를 추천해드려요!</Text>
                  )}
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            recipesLoading ? <LoadingView /> : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🥬</Text>
                <Text style={styles.emptyTitle}>검색할 재료가 없어요</Text>
                <Text style={styles.emptySub}>다른 검색어를 입력하거나 레시피 탭에서 재료를 불러와 보세요.</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={() => setSearchText('')}>
                  <Text style={styles.emptyActionText}>다른 검색어 입력</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      ) : (
        /* ── 나만의 레시피 탭 ── */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* 직접 작성 버튼 */}
          <TouchableOpacity style={styles.writeRecipeBtn} onPress={openNewRecipe}>
            <Text style={styles.writeRecipeEmoji}>✏️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.writeRecipeTitle}>레시피 직접 작성</Text>
              <Text style={styles.writeRecipeSub}>재료, 조리 순서를 직접 입력해요</Text>
            </View>
            <Text style={styles.writeRecipeArrow}>›</Text>
          </TouchableOpacity>

          {/* URL 입력 카드 */}
          <View style={styles.youtubeCard}>
            <View style={styles.youtubeTitleRow}>
              <Text style={styles.youtubeTitle} numberOfLines={1}>📹 유튜브 레시피 가져오기</Text>
              <Text style={styles.youtubeSub} numberOfLines={2}>자막이 있으면 분석하고, 실패하면 직접 작성으로 이어갈 수 있어요</Text>
            </View>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={colors.textLight}
                value={youtubeUrl}
                onChangeText={(text) => {
                  setYoutubeUrl(text);
                  if (youtubeAnalysisError) setYoutubeAnalysisError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {youtubeUrl ? (
                <TouchableOpacity onPress={() => { setYoutubeUrl(''); setYoutubeAnalysisError(null); }}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
              onPress={handleAnalyzeYoutube}
              disabled={analyzing}
            >
              {analyzing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.analyzeBtnText, { fontSize: 13 }]}>{analysisStatusText || '분석 중이에요.'}</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>🤖 레시피 분석하기</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 분석 결과 */}
          {youtubeAnalysisError ? (
            <View style={styles.youtubeFallbackBox}>
              <Text style={styles.youtubeFallbackTitle}>다른 방법으로 저장할 수 있어요</Text>
              <Text style={styles.youtubeFallbackText}>{youtubeAnalysisError}</Text>
              <View style={styles.youtubeFallbackActions}>
                <TouchableOpacity style={styles.youtubeFallbackGhostBtn} onPress={() => setYoutubeAnalysisError(null)}>
                  <Text style={styles.youtubeFallbackGhostText}>다른 영상 입력</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.youtubeFallbackPrimaryBtn} onPress={handleYoutubeFallbackWrite}>
                  <Text style={styles.youtubeFallbackPrimaryText}>직접 작성으로 이어가기</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {analyzedRecipe && (
            <View style={styles.analyzedCard}>
              <View style={styles.analyzedHeader}>
                <Text style={styles.analyzedEmoji}>{analyzedRecipe.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.analyzedTitle}>{analyzedRecipe.title}</Text>
                  <Text style={styles.analyzedMeta}>⏱️ {analyzedRecipe.cookTime}분 · 🍽 {analyzedRecipe.servings}인분</Text>
                </View>
              </View>
              <View style={styles.nutritionRow}>
                <NutriBadge label="칼로리" value={analyzedRecipe.totalNutrition.calories} color="#E74C3C" unit="kcal" />
                <NutriBadge label="탄수화물" value={analyzedRecipe.totalNutrition.carbs} color="#F6A623" />
                <NutriBadge label="단백질" value={analyzedRecipe.totalNutrition.protein} color="#2ECC71" />
                <NutriBadge label="지방" value={analyzedRecipe.totalNutrition.fat} color="#9B59B6" />
                <NutriBadge label="식이섬유" value={analyzedRecipe.totalNutrition.fiber ?? 0} color="#27AE60" />
                <NutriBadge label="당류" value={analyzedRecipe.totalNutrition.sugar ?? 0} color="#E67E22" />
                <NutriBadge label="나트륨" value={analyzedRecipe.totalNutrition.sodium ?? 0} color="#7F8C8D" unit="mg" />
              </View>
              <Text style={styles.expandTitle}>📋 재료</Text>
              <View style={styles.ingGrid}>
                {analyzedRecipe.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingChip}>
                    <Text style={styles.ingChipText}>{ing.name}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.expandTitle, { marginTop: spacing.sm }]}>👨‍🍳 조리 방법</Text>
              {analyzedRecipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.cookingBtn, { marginTop: spacing.sm, marginBottom: spacing.xs }]}
                onPress={() => startCooking(analyzedRecipe.title, analyzedRecipe.steps)}
              >
                <Text style={styles.cookingBtnText}>🍳 요리 시작 (스텝 카드)</Text>
              </TouchableOpacity>
              <View style={styles.analyzedActions}>
                <TouchableOpacity style={styles.discardBtn} onPress={() => setAnalyzedRecipe(null)}>
                  <Text style={styles.discardBtnText}>다시 분석</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editRecipeBtn} onPress={() => analyzedRecipe && openEditRecipe(analyzedRecipe)}>
                  <Text style={styles.editRecipeBtnText}>✏️ 수정 후 저장</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveRecipeBtn} onPress={handleSaveUserRecipe}>
                  <Text style={styles.saveRecipeBtnText}>💾 바로 저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 저장된 레시피 목록 */}
          <View style={styles.savedHeader}>
            <Text style={styles.savedTitle}>저장된 레시피</Text>
            <Text style={styles.savedCount}>{userRecipes.length}개</Text>
          </View>

          {userRecipes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>저장된 레시피가 없어요</Text>
              <Text style={styles.emptySub}>직접 작성하거나 유튜브 URL로 레시피를 가져와 보세요.</Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={openNewRecipe}>
                <Text style={styles.emptyActionText}>레시피 작성하기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            userRecipes.map((r) => {
              const isExpanded = expandedUserRecipeId === r.id;
              const n = r.totalNutrition;
              const asFood: Food = {
                id: 0, name: r.title, emoji: r.emoji,
                category: r.category, per: `${r.servings}인분`, nutrition: n,
              };
              const isPublicRecipe = r.isPublic ?? Boolean(r.sharedRecipeId);
              const isServerSaved = Boolean(r.backendId ?? r.sharedRecipeId);
              return (
                <View key={r.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedUserRecipeId(isExpanded ? null : r.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardEmoji}>{r.emoji}</Text>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{r.title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {recipeActionId === r.id ? (
                            <View style={styles.pendingBadge}>
                              <ActivityIndicator size="small" color={colors.primary} />
                              <Text style={styles.pendingBadgeText}>반영 중</Text>
                            </View>
                          ) : isPublicRecipe ? (
                            <TouchableOpacity
                              style={styles.sharedBadge}
                              onPress={() => handleUnpublishUserRecipe(r)}
                              disabled={recipeActionId === r.id}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={styles.sharedBadgeText}>🌐 공개됨 ∨</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.privateBadgeBtn}
                              onPress={() => handlePublishUserRecipe(r)}
                              disabled={recipeActionId === r.id}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={styles.privateBadgeText}>🔒 비공개 · 공개하기</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => handleDeleteUserRecipe(r)} disabled={recipeActionId === r.id}>
                            <Text style={{ fontSize: 16 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>⏱️ {r.cookTime}분 · {r.category} · {r.servings}인분</Text>
                      <View style={styles.recipeStatusRow}>
                        <View style={[styles.recipeStatusPill, isPublicRecipe ? styles.recipeStatusPublic : styles.recipeStatusPrivate]}>
                          <Text style={[styles.recipeStatusText, isPublicRecipe ? styles.recipeStatusPublicText : styles.recipeStatusPrivateText]}>
                            {isPublicRecipe ? '공개' : '비공개'}
                          </Text>
                        </View>
                        <View style={[styles.recipeStatusPill, isServerSaved ? styles.recipeStatusServer : styles.recipeStatusLocal]}>
                          <Text style={[styles.recipeStatusText, isServerSaved ? styles.recipeStatusServerText : styles.recipeStatusLocalText]}>
                            {isServerSaved ? '서버 저장됨' : '로컬만 저장됨'}
                          </Text>
                        </View>
                      </View>
                      {n.calories > 0 ? (
                        <View style={styles.calRow}>
                          <Text style={styles.cardCal}>🔥 {n.calories} kcal</Text>
                          <View style={styles.miniNutriRow}>
                            <NutriBadge label="탄" value={n.carbs} color="#F6A623" />
                            <NutriBadge label="단" value={n.protein} color="#2ECC71" />
                            <NutriBadge label="지" value={n.fat} color="#9B59B6" />
                            <NutriBadge label="섬유" value={n.fiber ?? 0} color="#27AE60" />
                            <NutriBadge label="당" value={n.sugar ?? 0} color="#E67E22" />
                            <NutriBadge label="나트륨" value={n.sodium ?? 0} color="#7F8C8D" unit="mg" />
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.expandArrow, isExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.expandedArea}>
                      <View style={styles.expandSection}>
                        <Text style={styles.expandTitle}>📋 재료</Text>
                        <View style={styles.ingGrid}>
                          {r.ingredients.map((ing, i) => (
                            <View key={i} style={styles.ingChip}>
                              <Text style={styles.ingChipText}>{ing.name}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={styles.expandSection}>
                        <Text style={styles.expandTitle}>👨‍🍳 조리 방법</Text>
                        {r.steps.map((step, i) => (
                          <View key={i} style={styles.stepRow}>
                            <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                            <Text style={styles.stepText}>{step}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.expandActions}>
                        <TouchableOpacity
                          style={styles.cookingBtn}
                          onPress={() => startCooking(r.title, r.steps, Number(r.id))}
                        >
                          <Text style={styles.cookingBtnText}>🍳 요리 시작 (스텝 카드)</Text>
                        </TouchableOpacity>

                        <View style={styles.expandBtnRow}>
                          <TouchableOpacity style={styles.editBtn} onPress={() => openEditRecipe(r)}>
                            <Text style={styles.editBtnText}>✏️ 수정</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.addBtn} onPress={() => setModalItem(asFood)}>
                            <Text style={styles.addBtnText}>+ 식단 추가</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <AddMealModal
        visible={!!modalItem}
        item={modalItem}
        onClose={() => setModalItem(null)}
        onAdd={(mealType, customNutrition) => modalItem && handleAdd(mealType, modalItem, customNutrition)}
      />

      <RecipeEditModal
        visible={editModalVisible}
        initial={editInitial}
        userId={String(currentUser?.id ?? '')}
        ingredientSuggestions={allIngredientNames}
        cookingToolOptions={COOKING_TOOLS}
        onClose={() => setEditModalVisible(false)}
        onSave={handleEditSave}
      />

      {cookingMode && (
        <CookingModeModal
          visible={!!cookingMode}
          title={cookingMode.title}
          steps={cookingMode.steps}
          onClose={() => setCookingMode(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── 헤더 ──
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    ...shadow.small,
  },
  headerTitle: {
    fontSize: 24, fontWeight: '900', color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },

  // ── 탭 바 ──
  tabRowContent: {
    flexDirection: 'row', gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
  },
  tabActive: {
    backgroundColor: colors.primary,
    ...shadow.small,
  },
  tabIcon: { fontSize: 13 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  // ── 검색바 ──
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 15, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  clearBtn: { fontSize: 14, color: colors.textLight, paddingLeft: spacing.sm },

  // ── 리스트 ──
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 120 },

  // ── 로딩 ──
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },

  // ── 빈 상태 ──
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  emptySub: { fontSize: 13, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  emptyActionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, justifyContent: 'center', flexWrap: 'wrap' },
  emptyActionBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  emptyGhostBtn: {
    marginTop: spacing.md,
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emptyGhostText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

  // ── 재료 필터 칩 ──
  chipRow: { gap: spacing.xs, marginBottom: spacing.xs },
  ingFilterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    paddingVertical: 10, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    minHeight: 40,
  },
  ingFilterChipSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  ingFilterCheck: { fontSize: 12, color: colors.primary, fontWeight: '800' },
  ingFilterText: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
  ingFilterTextSelected: { color: colors.primary, fontWeight: '800' },

  // ── 선택된 재료 박스 ──
  selectedBox: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '30',
    ...shadow.small,
  },
  selectedHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.sm,
  },
  selectedTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  clearText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  selectedChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderRadius: borderRadius.full,
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: colors.primary + '50',
  },
  selectedChipText: { fontSize: 12, color: colors.primaryDark, fontWeight: '700' },
  selectedChipX: { fontSize: 11, color: colors.primary },

  // ── 추천 레시피 ──
  recommendBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    padding: spacing.sm, marginTop: spacing.xs,
  },
  recommendTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  recommendItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  recommendEmoji: { fontSize: 24 },
  recommendName: { fontSize: 14, fontWeight: '700', color: colors.text },
  recommendCal: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  recommendArrow: { fontSize: 22, color: colors.textLight, fontWeight: '300' },
  noRecommend: { fontSize: 13, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  noRecommendBox: { alignItems: 'center', paddingVertical: spacing.xs },

  // ── 레시피 카드 ──
  card: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadow.small,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
  },
  cardEmoji: { fontSize: 36, width: 48, textAlign: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1 },
  cardMeta: { fontSize: 12, color: colors.textLight, marginBottom: 4 },
  recipeStatusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4, marginBottom: 5 },
  recipeStatusPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  recipeStatusText: { fontSize: 10, fontWeight: '800' },
  recipeStatusPublic: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  recipeStatusPublicText: { color: '#4F46E5' },
  recipeStatusPrivate: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  recipeStatusPrivateText: { color: '#64748B' },
  recipeStatusServer: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  recipeStatusServerText: { color: '#047857' },
  recipeStatusLocal: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  recipeStatusLocalText: { color: '#92400E' },
  cardCreator: { fontSize: 11, color: colors.textLight, marginTop: 1, marginBottom: 2, fontStyle: 'italic' },
  cardCal: { fontSize: 13, color: colors.primary, fontWeight: '700', marginRight: spacing.sm },
  top3Card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.small,
  },
  top3Title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  top3Row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border },
  top3Rank: { fontSize: 18 },
  top3Name: { fontSize: 13, fontWeight: '700', color: colors.text },
  top3Meta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  top3Arrow: { fontSize: 20, color: colors.textLight, fontWeight: '300', marginLeft: 4 },
  calRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  miniNutriRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  noNutriText: { fontSize: 11, color: colors.textLight, fontStyle: 'italic' },
  expandArrow: {
    fontSize: 24, color: colors.textLight, fontWeight: '300',
    marginLeft: spacing.xs,
  },

  // ── 확장 영역 ──
  expandedArea: {
    backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md,
  },
  expandSection: { marginBottom: spacing.sm },
  expandTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  toolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toolChip: {
    backgroundColor: '#fff', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  toolChipText: { fontSize: 12, color: colors.text },
  ingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ingChip: {
    backgroundColor: '#fff', borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  ingChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  ingChipAmount: { fontSize: 11, color: colors.textLight },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, alignItems: 'flex-start' },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepText: { fontSize: 13, color: colors.text, lineHeight: 20, flex: 1 },
  expandActions: { flexDirection: 'column', gap: spacing.sm, marginTop: spacing.sm },
  expandBtnRow: { flexDirection: 'row', gap: spacing.sm },
  cookingBtn: {
    backgroundColor: '#1E1E2E', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  cookingBtnText: { color: '#A78BFA', fontSize: 13, fontWeight: '700' },
  editBtn: {
    flex: 1, backgroundColor: '#F0F4FF', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  addBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ── 공유하기 버튼 ──
  shareBtn: {
    backgroundColor: '#4F46E5', borderRadius: borderRadius.md,
    paddingVertical: 12, alignItems: 'center', marginBottom: spacing.xs,
  },
  shareBtnDone: { backgroundColor: '#6B7280' },
  shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ── 공유됨 배지 ──
  sharedBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  sharedBadgeText: { color: '#4F46E5', fontSize: 10, fontWeight: '700' },
  privateBadgeBtn: {
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  privateBadgeText: { color: '#64748B', fontSize: 10, fontWeight: '700' },

  // ── 직접 작성 버튼 ──
  writeRecipeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: '#fff', borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 2, borderColor: colors.primary,
    ...shadow.small,
  },
  writeRecipeEmoji: { fontSize: 28 },
  writeRecipeTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  writeRecipeSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  writeRecipeArrow: { fontSize: 22, color: colors.primary, fontWeight: '300' },

  // ── 분석 결과 수정 버튼 ──
  editRecipeBtn: {
    flex: 1, backgroundColor: '#F0F4FF', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary,
  },
  editRecipeBtnText: { color: colors.primary, fontSize: 13, fontWeight: '800' },

  // ── 유튜브 카드 ──
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F8FAFC', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  pendingBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },

  youtubeCard: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    alignSelf: 'stretch',
    width: '100%',
    ...shadow.small,
  },
  youtubeTitleRow: {
    marginBottom: spacing.md,
    alignSelf: 'stretch',
    width: '100%',
  },
  youtubeTitle: { fontSize: 15, fontWeight: '900', color: colors.text, width: '100%' },
  youtubeSub: { fontSize: 12, color: colors.textLight, marginTop: 4, lineHeight: 17, width: '100%', flexWrap: 'wrap' },
  urlInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    height: 44,
    alignSelf: 'stretch',
    width: '100%',
  },
  urlInput: { flex: 1, minWidth: 0, fontSize: 13, color: colors.text },
  analyzeBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
  },
  analyzeBtnDisabled: { backgroundColor: colors.textLight },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // ── 분석 결과 카드 ──
  youtubeFallbackBox: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
    padding: spacing.md,
  },
  youtubeFallbackTitle: { fontSize: 13, fontWeight: '900', color: '#92400E', marginBottom: 4 },
  youtubeFallbackText: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  youtubeFallbackActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  youtubeFallbackGhostBtn: {
    flex: 1, alignItems: 'center', borderRadius: borderRadius.md,
    paddingVertical: 10, borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#fff',
  },
  youtubeFallbackGhostText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  youtubeFallbackPrimaryBtn: {
    flex: 1, alignItems: 'center', borderRadius: borderRadius.md,
    paddingVertical: 10, backgroundColor: colors.primary,
  },
  youtubeFallbackPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  analyzedCard: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.md, marginTop: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    ...shadow.small,
  },
  analyzedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  analyzedEmoji: { fontSize: 40 },
  analyzedTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  analyzedMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  analyzedNutriRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  tab2LoadingText: { marginTop: spacing.sm, color: colors.textLight, fontSize: 13, textAlign: 'center' },

  // ── 재료·음식 탭 음식 아이템 카드 (fi = food item) ──
  fiCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow.small,
  },
  fiCardSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: '#F0F4FF',
  },
  fiSelectBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  fiBody: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  fiNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  fiName: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
  fiCheckBadge: {
    fontSize: 10, color: colors.primary, fontWeight: '700',
    backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  fiCal: { fontSize: 12, color: '#E74C3C', fontWeight: '700', marginRight: 4 },
  tab2LoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  nutritionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  analyzedActions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  discardBtn: { flex: 1, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  discardBtnText: { color: colors.textLight, fontSize: 13, fontWeight: '700' },
  saveRecipeBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' },
  saveRecipeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  savedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  savedTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  savedCount: { fontSize: 13, color: colors.textLight },
});
