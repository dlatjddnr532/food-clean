import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { getRecipes, getRecipeById, BackendRecipe, searchFoods, ApiFoodInfo, analyzeYoutubeRecipe, createRecipe, toggleRecipeLike, deleteRecipe } from '../api/diet';
import { Food, Recipe, MealType, NutritionInfo, UserRecipe } from '../types';
import { CookingModeModal } from './CookingModeModal';
import { RecipeEditModal } from './RecipeEditModal';

const TABS = ['즐겨찾기', '레시피', '재료·음식', '나만의 레시피'] as const;
const TAB_ICONS = ['❤️', '📋', '🥬', '📹'];
const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];

// ── 영양소 미니 배지 ──
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
    borderRadius: borderRadius.sm, paddingHorizontal: 7, paddingVertical: 4,
    backgroundColor: '#fff',
    minWidth: 44,
  },
  val: { fontSize: 12, fontWeight: '800' },
  lbl: { fontSize: 9, color: colors.textLight, marginTop: 1 },
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
  const { addMealLog, favoriteIds, toggleFavorite, isFavorite, userRecipes, addUserRecipe, removeUserRecipe, updateUserRecipe, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<UserRecipe> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedRecipe, setAnalyzedRecipe] = useState<UserRecipe | null>(null);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedUserRecipeId, setExpandedUserRecipeId] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const recipeListRef = useRef<FlatList>(null);

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);

  // ── 음식 검색 (Tab 2) ──
  const [foodResults, setFoodResults] = useState<ApiFoodInfo[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);

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
    totalNutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
    steps: (r.steps ?? [])
      .sort((a, b) => a.step_number - b.step_number)
      .map((s) => s.description),
    content: r.content ?? '',
    creatorId: r.creator?.id,
    creatorName: r.creator?.nickname,
  });

  useEffect(() => {
    setRecipesLoading(true);
    getRecipes()
      .then((data) => setAllRecipes(data.map(backendToRecipe)))
      .catch(() => setAllRecipes([]))
      .finally(() => setRecipesLoading(false));
  }, []);

  // Tab 2 음식 검색 — 검색어가 바뀔 때마다 API 호출 (300ms 디바운스)
  useEffect(() => {
    if (activeTab !== 2) return;
    if (!searchText.trim()) { setFoodResults([]); return; }
    const timer = setTimeout(() => {
      setFoodSearchLoading(true);
      searchFoods(searchText)
        .then(setFoodResults)
        .finally(() => setFoodSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, activeTab]);

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
  const communityRecipes = useMemo(
    () => allRecipes,
    [allRecipes],
  );

  const filteredRecipes = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return communityRecipes;
    return communityRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
    );
  }, [searchText, communityRecipes]);

  const favoriteRecipes = useMemo(
    () => communityRecipes.filter((r) => isFavorite(r.id)),
    [favoriteIds, communityRecipes],
  );

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

  // Tab 2 통합 아이템 목록: API 음식(영양정보O) + 레시피 재료(영양정보X) 합산
  type Tab2Item = { name: string; apiFood?: ApiFoodInfo };
  const tab2Items = useMemo<Tab2Item[]>(() => {
    const apiNames = new Set(foodResults.map((f) => f.name));
    const recipeOnly = filteredIngredientNames.filter((n) => !apiNames.has(n));
    return [
      ...foodResults.map((f) => ({ name: f.name, apiFood: f })),
      ...recipeOnly.map((n) => ({ name: n })),
    ];
  }, [foodResults, filteredIngredientNames]);

  const recommendedRecipes = useMemo(() => {
    if (selectedIngredients.length < 2) return [];
    return allRecipes.filter((recipe) => {
      const matchCount = recipe.ingredients.filter((ri) =>
        selectedIngredients.some(
          (ing) => ri.name.includes(ing) || ing.includes(ri.name),
        ),
      ).length;
      return matchCount >= Math.ceil(recipe.ingredients.length / 2);
    });
  }, [selectedIngredients, allRecipes]);

  const toggleIngredient = (name: string): void => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const goToRecipe = (recipeId: number): void => {
    setActiveTab(1);
    setExpandedId(recipeId);
    const index = allRecipes.findIndex((r) => r.id === recipeId);
    if (index !== -1) {
      setTimeout(() => {
        recipeListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      }, 100);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // toggleLike: 좋아요 토글
  // 1) 낙관적 업데이트 — UI 즉시 반영 (toggleFavorite)
  // 2) POST /recipes/:id/like/:userId 호출
  // 3) 서버 반환 likes_count로 카드 숫자 동기화
  // ─────────────────────────────────────────────────────────────────────────
  const toggleLike = async (id: number): Promise<void> => {
    toggleFavorite(id); // 낙관적 업데이트 (즉시 UI 반영)
    if (currentUser) {
      try {
        const res = await toggleRecipeLike(id, currentUser.id);
        // 서버 likes_count로 동기화
        setAllRecipes((prev) =>
          prev.map((r) => (r.id === id ? { ...r, likes: res.likes_count } : r))
        );
      } catch {
        // 실패해도 로컬 상태 유지
      }
    }
  };

  const handleAdd = (mealType: MealType, item: ModalItem, customNutrition: NutritionInfo): void => {
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
    Alert.alert('추가 완료! ✅', `${mealType}에 "${food.name}"이(가) 추가됐어요!`);
  };

  // ── 레시피 카드 ──
  const RecipeCard = ({ item }: { item: Recipe }) => {
    const isExpanded = expandedId === item.id;
    const n = item.totalNutrition;
    const hasNutrition = n.calories > 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
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
                          try { await deleteRecipe(item.id, String(currentUser!.id)); } catch {}
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                >
                  <Text style={{ fontSize: 16 }}>{isFavorite(item.id) ? '❤️' : '🤍'}</Text>
                  {item.likes > 0 && (
                    <Text style={{
                      fontSize: 12, fontWeight: '700',
                      color: isFavorite(item.id) ? '#E74C3C' : colors.textLight,
                    }}>
                      {item.likes}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardMeta}>⏱️ {item.cookTime}분 · {item.category}</Text>
            {item.creatorName && (
              <Text style={styles.cardCreator}>👤 {item.creatorName}</Text>
            )}
            {hasNutrition ? (
              <View style={styles.calRow}>
                <Text style={styles.cardCal}>🔥 {n.calories} kcal</Text>
                <View style={styles.miniNutriRow}>
                  <NutriBadge label="탄" value={n.carbs} color="#F6A623" />
                  <NutriBadge label="단" value={n.protein} color="#2ECC71" />
                  <NutriBadge label="지" value={n.fat} color="#9B59B6" />
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
            {item.tools && item.tools.length > 0 && (
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
                      {ing.amount ? <Text style={styles.ingChipAmount}>{ing.amount}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {item.steps.length > 0 && (
              <View style={styles.expandSection}>
                <Text style={styles.expandTitle}>👨‍🍳 조리 방법</Text>
                {item.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

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
  const FoodIngredientCard = ({ name, apiFood }: { name: string; apiFood?: ApiFoodInfo }) => {
    const isSelected = selectedIngredients.includes(name);
    const hasNutrition = !!apiFood;
    const asFood: Food = {
      id: apiFood?.id ?? 0,
      name,
      emoji: '🍽️',
      category: '음식',
      per: `${apiFood?.servingSize ?? 100}g`,
      nutrition: {
        calories: apiFood?.calories ?? 0,
        carbs: apiFood?.carbs ?? 0,
        protein: apiFood?.protein ?? 0,
        fat: apiFood?.fat ?? 0,
        fiber: apiFood?.fiber ?? 0,
        sugar: apiFood?.sugar ?? 0,
        sodium: apiFood?.sodium ?? 0,
      },
    };
    return (
      <TouchableOpacity
        style={[styles.fiCard, isSelected && styles.fiCardSelected]}
        onPress={() => toggleIngredient(name)}
        activeOpacity={0.85}
      >
        {/* 선택 상태 왼쪽 바 */}
        <View style={[styles.fiSelectBar, isSelected && { backgroundColor: colors.primary }]} />

        <View style={styles.fiBody}>
          <View style={styles.fiNameRow}>
            <Text style={styles.fiName} numberOfLines={1}>{name}</Text>
            {isSelected && <Text style={styles.fiCheckBadge}>✓ 선택됨</Text>}
          </View>
          {hasNutrition ? (
            <View style={styles.calRow}>
              <Text style={styles.fiCal}>🔥 {apiFood!.calories} kcal</Text>
              <View style={styles.miniNutriRow}>
                <NutriBadge label="탄" value={apiFood!.carbs} color="#F6A623" />
                <NutriBadge label="단" value={apiFood!.protein} color="#2ECC71" />
                <NutriBadge label="지" value={apiFood!.fat} color="#9B59B6" />
              </View>
            </View>
          ) : (
            <Text style={styles.fiNoNutri}>✏️ 추가 시 직접 입력</Text>
          )}
        </View>

        {/* + 식단 추가 버튼 */}
        <TouchableOpacity
          style={styles.fiAddBtn}
          onPress={() => setModalItem(asFood)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fiAddBtnText}>+</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ── 유튜브 레시피 분석 ──
  const handleAnalyzeYoutube = async () => {
    if (!youtubeUrl.trim()) {
      Alert.alert('URL 입력', '유튜브 URL을 입력해주세요.');
      return;
    }
    if (!currentUser) {
      Alert.alert('로그인 필요', '로그인 후 사용할 수 있어요.');
      return;
    }
    const isYoutube = youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be');
    if (!isYoutube) {
      Alert.alert('잘못된 URL', '유튜브 URL만 지원해요.\n예: https://youtube.com/watch?v=...');
      return;
    }
    setAnalyzing(true);
    setAnalyzedRecipe(null);
    try {
      const res = await analyzeYoutubeRecipe(String(currentUser.id), youtubeUrl.trim());
      if (res.success && res.title) {
        const newRecipe: UserRecipe = {
          id: res.id ? String(res.id) : String(Date.now()),
          title: res.title,
          emoji: '🍳',
          category: '나만의 요리',
          cookTime: 30,
          servings: 2,
          youtubeUrl: res.video_url ?? youtubeUrl.trim(),
          ingredients: (res.ingredients ?? []).map((i) => ({ name: i.name, amount: '' })),
          steps: (res.steps ?? [])
            .sort((a, b) => a.step_number - b.step_number)
            .map((s) => s.description),
          totalNutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
          createdAt: new Date().toLocaleDateString('ko-KR'),
          sharedRecipeId: res.id,  // 백엔드가 이미 저장한 레시피 ID
        };
        setAnalyzedRecipe(newRecipe);
      } else {
        Alert.alert(
          '분석 실패 😥',
          '이 영상에서 레시피를 찾지 못했어요.\n\n' +
          '✅ 잘 되는 영상:\n• 한국어 자막이 있는 요리 영상\n• 말로 설명하는 쿠킹 채널\n\n' +
          '❌ 안 되는 영상:\n• 자막 없는 영상\n• 배경 음악만 있는 영상',
        );
      }
    } catch {
      Alert.alert(
        '연결 오류 😥',
        '서버와 연결할 수 없어요.\n잠시 후 다시 시도해주세요.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveUserRecipe = () => {
    if (!analyzedRecipe) return;
    addUserRecipe(analyzedRecipe);
    // YouTube 분석 레시피는 백엔드가 이미 저장 → allRecipes에도 바로 반영
    if (analyzedRecipe.sharedRecipeId) {
      const asRecipe: Recipe = {
        id: analyzedRecipe.sharedRecipeId,
        title: analyzedRecipe.title,
        emoji: analyzedRecipe.emoji,
        category: analyzedRecipe.category,
        cookTime: analyzedRecipe.cookTime,
        tools: [],
        ingredients: analyzedRecipe.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
        })),
        steps: analyzedRecipe.steps,
        totalNutrition: analyzedRecipe.totalNutrition,
        likes: 0,
        content: analyzedRecipe.steps.join('\n'),
        creatorId: String(currentUser?.id ?? ''),
        creatorName: currentUser?.profile?.name,
      };
      setAllRecipes((prev) => [asRecipe, ...prev]);
    }
    setAnalyzedRecipe(null);
    setYoutubeUrl('');
    Alert.alert('공개 완료! 🎉', `"${analyzedRecipe.title}" 레시피가 레시피 탭에 공개됐어요.`);
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
    // 기존 레시피 수정인지 신규인지 구분
    const isExisting = userRecipes.some((r) => r.id === recipe.id);
    if (isExisting) {
      updateUserRecipe(recipe);
      // 공유된 레시피라면 레시피 탭에도 즉시 반영
      if (recipe.sharedRecipeId) {
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
                    amount: i.amount,
                    nutrition: { calories: 0, carbs: 0, protein: 0, fat: 0 },
                  })),
                  steps: recipe.steps,
                  totalNutrition: recipe.totalNutrition,
                  content: recipe.steps.join('\n'),
                }
              : r
          )
        );
      }
    } else {
      // 신규 레시피 → 로컬에만 저장 (공개는 사용자가 직접 "공개하기" 버튼으로)
      addUserRecipe(recipe);
    }
    setEditModalVisible(false);
    setAnalyzedRecipe(null);
    setYoutubeUrl('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handlePublishUserRecipe: 나만의 레시피를 레시피 탭에 공개
  // - POST /recipes/:userId 로 DB에 저장
  // - 반환된 id를 sharedRecipeId로 저장 → 이후 수정/삭제 시 서버와 연결
  // - allRecipes 앞에 추가 → 레시피 탭 즉시 반영
  // ─────────────────────────────────────────────────────────────────────────
  const handlePublishUserRecipe = async (recipe: UserRecipe) => {
    if (!currentUser) return;
    Alert.alert(
      '레시피 공개',
      `"${recipe.title}"을 레시피 탭에 공개할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '공개하기', style: 'default',
          onPress: async () => {
            const dto = {
              title: recipe.title,
              content: recipe.steps.join('\n'),
              ingredients: recipe.ingredients.map((i) => i.name),
              cooking_tools: [] as string[],
              steps: recipe.steps.map((s, idx) => ({ step_number: idx + 1, description: s })),
            };
            try {
              const result = await createRecipe(String(currentUser.id), dto);
              const published = { ...recipe, sharedRecipeId: result.id };
              updateUserRecipe(published);
              setAllRecipes((prev) => [backendToRecipe(result), ...prev]);
              Alert.alert('공개 완료! 🎉', `"${recipe.title}" 레시피가 레시피 탭에 공개됐어요.`);
            } catch {
              Alert.alert('오류', '공개에 실패했어요. 잠시 후 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // handleUnpublishUserRecipe: 공개 레시피를 비공개로 전환
  // - 낙관적 업데이트: 즉시 allRecipes에서 제거 + sharedRecipeId 초기화
  // - DELETE /recipes/:id/:userId 호출 (백엔드 미구현 시 catch로 무시)
  //   → 백엔드 구현되면 DB에서도 삭제, 앱 재시작 후에도 사라짐
  //   → 미구현 상태: 로컬에선 사라지지만 앱 재시작 시 getRecipes()로 다시 표시됨
  // ─────────────────────────────────────────────────────────────────────────
  const handleUnpublishUserRecipe = async (recipe: UserRecipe) => {
    Alert.alert(
      '비공개로 전환',
      `"${recipe.title}"을 비공개로 전환할까요?\n레시피 탭에서 내려가고 나만의 레시피에만 남습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '비공개로 전환', style: 'destructive',
          onPress: async () => {
            // 로컬 즉시 반영
            updateUserRecipe({ ...recipe, sharedRecipeId: undefined });
            if (recipe.sharedRecipeId) {
              setAllRecipes((prev) => prev.filter((r) => r.id !== recipe.sharedRecipeId));
              // 백엔드 DELETE (구현되면 동작, 미구현 시 catch로 무시)
              try {
                await deleteRecipe(recipe.sharedRecipeId, String(currentUser?.id ?? ''));
              } catch { /* 백엔드 DELETE 미구현 — 로컬만 반영 */ }
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
          removeUserRecipe(r.id);
          if (r.sharedRecipeId) {
            setAllRecipes((prev) => prev.filter((a) => a.id !== r.sharedRecipeId));
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
              <Text style={styles.emptySub}>레시피 탭에서 하트를 눌러보세요!</Text>
            </View>
          }
        />
      ) : activeTab === 1 ? (
        recipesLoading ? <LoadingView /> : (
          <FlatList
            key="recipe-list"
            ref={recipeListRef}
            data={filteredRecipes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <RecipeCard item={item} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                recipeListRef.current?.scrollToIndex({ index: info.index, animated: true });
              }, 300);
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
              </View>
            }
          />
        )
      ) : activeTab === 2 ? (
        <FlatList
          key="food-ingredient-list"
          data={tab2Items}
          keyExtractor={(item) => `fi-${item.name}`}
          renderItem={({ item }) => <FoodIngredientCard name={item.name} apiFood={item.apiFood} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* 로딩 인디케이터 */}
              {foodSearchLoading && (
                <View style={styles.tab2LoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.tab2LoadingText}>음식 검색 중...</Text>
                </View>
              )}

              {/* 선택된 항목 + 레시피 추천 */}
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
                      <Text style={styles.noRecommend}>선택한 재료로 만들 수 있는 레시피가 없어요 😅</Text>
                    )
                  ) : (
                    <Text style={styles.noRecommend}>재료·음식을 {2 - selectedIngredients.length}개 더 선택하면 레시피를 추천해드려요!</Text>
                  )}
                </View>
              )}

              <Text style={styles.sectionHint}>
                카드 탭 = 선택(레시피 추천) · + 버튼 = 식단에 추가
              </Text>
            </>
          }
          ListEmptyComponent={
            recipesLoading || foodSearchLoading ? <LoadingView /> : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🥬</Text>
                <Text style={styles.emptyTitle}>음식·재료가 없어요</Text>
                <Text style={styles.emptySub}>검색하거나 레시피 탭에서 레시피를 불러와보세요</Text>
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
              <Text style={styles.youtubeEmoji}>📹</Text>
              <View>
                <Text style={styles.youtubeTitle}>유튜브 레시피 가져오기</Text>
                <Text style={styles.youtubeSub}>한국어 자막이 있는 요리 영상을 분석해드려요</Text>
              </View>
            </View>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={colors.textLight}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {youtubeUrl ? (
                <TouchableOpacity onPress={() => setYoutubeUrl('')}>
                  <Text style={styles.clearBtn}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
              onPress={handleAnalyzeYoutube}
              disabled={analyzing}
            >
              {analyzing
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.analyzeBtnText}>🤖 레시피 분석하기</Text>}
            </TouchableOpacity>
          </View>

          {/* 분석 결과 */}
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
              </View>
              <Text style={styles.expandTitle}>📋 재료</Text>
              <View style={styles.ingGrid}>
                {analyzedRecipe.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingChip}>
                    <Text style={styles.ingChipText}>{ing.name}</Text>
                    {ing.amount ? <Text style={styles.ingChipAmount}>{ing.amount}</Text> : null}
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
              <Text style={styles.emptySub}>유튜브 URL을 붙여넣어 레시피를 가져와보세요!</Text>
            </View>
          ) : (
            userRecipes.map((r) => {
              const isExpanded = expandedUserRecipeId === r.id;
              const n = r.totalNutrition;
              const asFood: Food = {
                id: 0, name: r.title, emoji: r.emoji,
                category: r.category, per: `${r.servings}인분`, nutrition: n,
              };
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
                          {r.sharedRecipeId ? (
                            <TouchableOpacity
                              style={styles.sharedBadge}
                              onPress={() => handleUnpublishUserRecipe(r)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={styles.sharedBadgeText}>🌐 공개됨 ∨</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.privateBadgeBtn}
                              onPress={() => handlePublishUserRecipe(r)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Text style={styles.privateBadgeText}>🔒 비공개  →공개</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => handleDeleteUserRecipe(r)}>
                            <Text style={{ fontSize: 16 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>⏱️ {r.cookTime}분 · {r.category} · {r.servings}인분</Text>
                      {n.calories > 0 ? (
                        <View style={styles.calRow}>
                          <Text style={styles.cardCal}>🔥 {n.calories} kcal</Text>
                          <View style={styles.miniNutriRow}>
                            <NutriBadge label="탄" value={n.carbs} color="#F6A623" />
                            <NutriBadge label="단" value={n.protein} color="#2ECC71" />
                            <NutriBadge label="지" value={n.fat} color="#9B59B6" />
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
                              {ing.amount ? <Text style={styles.ingChipAmount}>{ing.amount}</Text> : null}
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

  sectionHint: {
    fontSize: 12, color: colors.textLight, textAlign: 'center',
    marginBottom: spacing.sm, marginTop: spacing.xs,
  },

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
  cardCreator: { fontSize: 11, color: colors.textLight, marginTop: 1, marginBottom: 2, fontStyle: 'italic' },
  cardCal: { fontSize: 13, color: colors.primary, fontWeight: '700', marginRight: spacing.sm },
  calRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  miniNutriRow: { flexDirection: 'row', gap: 4 },
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
  youtubeCard: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.lg, marginBottom: spacing.sm,
    ...shadow.small,
  },
  youtubeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  youtubeEmoji: { fontSize: 36 },
  youtubeTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  youtubeSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  urlInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    height: 44,
  },
  urlInput: { flex: 1, fontSize: 13, color: colors.text },
  analyzeBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  analyzeBtnDisabled: { backgroundColor: colors.textLight },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // ── 분석 결과 카드 ──
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
  fiNoNutri: { fontSize: 11, color: colors.textLight, fontStyle: 'italic' },
  fiAddBtn: {
    backgroundColor: colors.primary,
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  fiAddBtnText: { color: '#fff', fontSize: 22, fontWeight: '700', lineHeight: 24 },
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