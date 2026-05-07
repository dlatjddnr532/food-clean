import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { DUMMY_RECIPES, DUMMY_FOODS, DUMMY_INGREDIENTS } from '../data/dummyData';
import { Food, Recipe, MealType, NutritionInfo } from '../types';

const TABS = ['즐겨찾기', '레시피', '재료·음식'] as const;
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
    <View style={[nStyles.badge, { backgroundColor: color + '20', borderColor: color }]}>
      <Text style={[nStyles.val, { color }]}>{value ?? 0}{unit}</Text>
      <Text style={nStyles.lbl}>{label}</Text>
    </View>
  );
}

const nStyles = StyleSheet.create({
  badge: {
    alignItems: 'center', borderWidth: 1,
    borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  val: { fontSize: 13, fontWeight: '800' },
  lbl: { fontSize: 10, color: colors.textLight },
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

  // 100g 기준 영양소 × 수량 배율 계산
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
      setEditMode(false);
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

          {/* 수량 조절 */}
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

          <TouchableOpacity
            style={modal.editToggle}
            onPress={() => editMode ? setEditMode(false) : openEditMode()}
          >
            <Text style={modal.editToggleText}>
              {editMode ? '✕ 기본값 사용' : '✏️ 영양정보 직접 수정'}
            </Text>
          </TouchableOpacity>

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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40,
    maxHeight: '90%',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
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
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', marginTop: spacing.sm, padding: spacing.sm, marginBottom: spacing.lg },
  cancelText: { color: colors.textLight, fontSize: 14 },
});

export default function RecipeScreen() {
  const insets = useSafeAreaInsets();
  const { addMealLog, favoriteIds, toggleFavorite, isFavorite } = useApp();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const recipeListRef = useRef<FlatList>(null);

  const filteredRecipes = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return DUMMY_RECIPES;
    return DUMMY_RECIPES.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.category.includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q)),
    );
  }, [searchText]);

  const favoriteRecipes = useMemo(
    () => DUMMY_RECIPES.filter((r) => isFavorite(r.id)),
    [favoriteIds],
  );

  const filteredIngredients = useMemo<Food[]>(() => {
    const q = searchText.toLowerCase();
    if (!q) return DUMMY_INGREDIENTS;
    return DUMMY_INGREDIENTS.filter((i) => i.name.toLowerCase().includes(q));
  }, [searchText]);

  // 선택한 재료로 만들 수 있는 레시피 추천 (최소 2개 선택 시)
  const recommendedRecipes = useMemo(() => {
    if (selectedIngredients.length < 2) return [];
    return DUMMY_RECIPES.filter((recipe) => {
      const matchCount = recipe.ingredients.filter((ri) =>
        selectedIngredients.some(
          (ing) => ri.name.includes(ing) || ing.includes(ri.name),
        ),
      ).length;
      // 레시피 재료의 절반 이상이 선택된 재료에 포함되면 추천
      return matchCount >= Math.ceil(recipe.ingredients.length / 2);
    });
  }, [selectedIngredients]);

  const toggleIngredient = (name: string): void => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const goToRecipe = (recipeId: number): void => {
    setActiveTab(1);
    setExpandedId(recipeId);
    const index = DUMMY_RECIPES.findIndex((r) => r.id === recipeId);
    if (index !== -1) {
      setTimeout(() => {
        recipeListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      }, 100);
    }
  };

  const toggleLike = (id: number): void => {
    toggleFavorite(id);
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

  // 레시피 카드
  const RecipeCard = ({ item }: { item: Recipe }) => {
    const isExpanded = expandedId === item.id;
    const n = item.totalNutrition;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <TouchableOpacity onPress={() => toggleLike(item.id)}>
                <Text style={{ fontSize: 20 }}>{isFavorite(item.id) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardMeta}>⏱️ {item.cookTime}분 · {item.category} · 1인분 기준</Text>
            <Text style={styles.cardCal}>🔥 {n.calories} kcal</Text>
            <View style={styles.miniNutriRow}>
              <NutriBadge label="탄" value={n.carbs} color="#F6A623" />
              <NutriBadge label="단" value={n.protein} color="#2ECC71" />
              <NutriBadge label="지" value={n.fat} color="#9B59B6" />
              <NutriBadge label="섬유" value={n.fiber} color="#1ABC9C" />
              <NutriBadge label="당" value={n.sugar} color="#E74C3C" />
              <NutriBadge label="나트륨" value={n.sodium} color="#E67E22" unit="mg" />
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedArea}>
            <Text style={styles.expandTitle}>📋 재료</Text>
            {item.ingredients.map((ing) => (
              <View key={ing.name} style={styles.ingRow}>
                <Text style={styles.ingName}>• {ing.name} ({ing.amount})</Text>
                <Text style={styles.ingCal}>{ing.nutrition.calories}kcal</Text>
              </View>
            ))}
            <Text style={[styles.expandTitle, { marginTop: spacing.sm }]}>👨‍🍳 조리 방법</Text>
            {item.steps.map((step, i) => (
              <Text key={i} style={styles.stepText}>{i + 1}. {step}</Text>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalItem(item)}>
              <Text style={styles.addBtnText}>+ 식단에 추가하기</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 재료 카드
  const IngredientCard = ({ item }: { item: Food }) => {
    const n = item.nutrition;
    const isSelected = selectedIngredients.includes(item.name);
    return (
      <View style={[styles.foodCard, isSelected && styles.foodCardSelected]}>
        <Text style={styles.foodEmoji}>{item.emoji}</Text>
        <View style={styles.foodBody}>
          <View style={styles.foodTitleRow}>
            <Text style={styles.foodName}>{item.name}</Text>
            <Text style={styles.foodPer}>{item.per}</Text>
          </View>
          <Text style={styles.foodCal}>🔥 {n.calories} kcal</Text>
          <View style={styles.miniNutriRow}>
            <NutriBadge label="탄수화물" value={n.carbs} color="#F6A623" />
            <NutriBadge label="단백질" value={n.protein} color="#2ECC71" />
            <NutriBadge label="지방" value={n.fat} color="#9B59B6" />
            <NutriBadge label="식이섬유" value={n.fiber} color="#1ABC9C" />
            <NutriBadge label="당류" value={n.sugar} color="#E74C3C" />
            <NutriBadge label="나트륨" value={n.sodium} color="#E67E22" unit="mg" />
          </View>
        </View>
        <View style={styles.ingBtnCol}>
          <TouchableOpacity
            style={styles.mealAddBtn}
            onPress={() => setModalItem(item)}
          >
            <Text style={styles.mealAddBtnText}>🍽</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallAddBtn, isSelected && styles.smallAddBtnSelected]}
            onPress={() => toggleIngredient(item.name)}
          >
            <Text style={styles.smallAddBtnText}>{isSelected ? '✓' : '+'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: spacing.xl + insets.top }]}>
        <Text style={styles.headerTitle}>음식 검색 🔍</Text>
        <View style={styles.tabRow}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i as 0 | 1 | 2)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {t === '즐겨찾기' ? `❤️ ${t}${favoriteIds.length > 0 ? ` (${favoriteIds.length})` : ''}` : t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 2 ? '음식명, 재료명으로 검색...' : '레시피명, 재료로 검색...'}
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {activeTab === 0 ? (
        <FlatList
          data={favoriteRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RecipeCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyFav}>
              <Text style={styles.emptyFavIcon}>🤍</Text>
              <Text style={styles.emptyFavTitle}>즐겨찾기가 없어요</Text>
              <Text style={styles.emptyFavSub}>레시피 탭에서 하트를 눌러보세요!</Text>
            </View>
          }
        />
      ) : activeTab === 1 ? (
        <FlatList
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
          ListEmptyComponent={<Text style={styles.emptyText}>검색 결과가 없어요 😅</Text>}
        />
      ) : (
        <FlatList
          data={filteredIngredients}
          keyExtractor={(item) => `ing-${item.id}`}
          renderItem={({ item }) => <IngredientCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {selectedIngredients.length > 0 && (
                <View style={styles.selectedBox}>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedTitle}>🧺 선택한 재료</Text>
                    <TouchableOpacity onPress={() => setSelectedIngredients([])}>
                      <Text style={styles.clearText}>전체 삭제</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.chipRow}>
                    {selectedIngredients.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={styles.chip}
                        onPress={() => toggleIngredient(name)}
                      >
                        <Text style={styles.chipText}>{name} ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {recommendedRecipes.length > 0 && (
                    <View style={styles.recommendBox}>
                      <Text style={styles.recommendTitle}>
                        🍳 만들 수 있는 레시피 {recommendedRecipes.length}개
                      </Text>
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
                          <Text style={styles.recommendArrow}>→</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {selectedIngredients.length < 2 ? (
                    <Text style={styles.noRecommend}>재료를 {2 - selectedIngredients.length}개 더 선택하면 레시피를 추천해드려요!</Text>
                  ) : recommendedRecipes.length === 0 ? (
                    <Text style={styles.noRecommend}>😅 선택한 재료로 만들 수 있는 레시피가 없어요</Text>
                  ) : null}
                </View>
              )}
            </>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>검색 결과가 없어요 😅</Text>}
        />
      )}

      <AddMealModal
        visible={!!modalItem}
        item={modalItem}
        onClose={() => setModalItem(null)}
        onAdd={(mealType, customNutrition) => modalItem && handleAdd(mealType, modalItem, customNutrition)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.white, paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, ...shadow.small,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  tabRow: {
    flexDirection: 'row', marginTop: spacing.sm,
    backgroundColor: colors.background, borderRadius: borderRadius.full, padding: 3,
  },
  tab: { flex: 1, paddingVertical: spacing.xs + 2, borderRadius: borderRadius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white, ...shadow.small },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: colors.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  searchIcon: { fontSize: 16, marginRight: 4 },
  searchInput: { flex: 1, padding: spacing.sm, fontSize: 14, color: colors.text },
  clearBtn: { fontSize: 14, color: colors.textLight, padding: 4 },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  emptyText: { textAlign: 'center', color: colors.textLight, fontSize: 15, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, ...shadow.small, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', padding: spacing.md },
  cardLeft: {
    width: 64, height: 64, borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight, justifyContent: 'center',
    alignItems: 'center', marginRight: spacing.md,
  },
  cardEmoji: { fontSize: 36 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  cardMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  cardCal: { fontSize: 13, color: '#E67E22', fontWeight: '700', marginTop: 4 },
  miniNutriRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  expandedArea: {
    padding: spacing.md, borderTopWidth: 1,
    borderTopColor: colors.border, backgroundColor: colors.background,
  },
  expandTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  ingName: { fontSize: 12, color: colors.text },
  ingCal: { fontSize: 12, color: colors.textLight },
  stepText: { fontSize: 12, color: colors.text, lineHeight: 20, marginBottom: 2 },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  foodCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    marginBottom: spacing.sm, ...shadow.small,
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md,
  },
  foodEmoji: { fontSize: 36 },
  foodBody: { flex: 1 },
  foodTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { fontSize: 15, fontWeight: '700', color: colors.text },
  foodPer: { fontSize: 11, color: colors.textLight },
  foodCal: { fontSize: 13, color: '#E67E22', fontWeight: '700', marginVertical: 4 },
  ingBtnCol: { alignItems: 'center', gap: 6 },
  mealAddBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  mealAddBtnText: { fontSize: 16 },
  smallAddBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  smallAddBtnText: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  foodCardSelected: { borderWidth: 2, borderColor: colors.primary },
  smallAddBtnSelected: { backgroundColor: colors.primary },
  selectedBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.small,
  },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  clearText: { fontSize: 12, color: '#E74C3C', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  chipText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  recommendBox: {
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm,
  },
  recommendTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  recommendItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.background,
  },
  recommendEmoji: { fontSize: 28 },
  recommendName: { fontSize: 14, fontWeight: '700', color: colors.text },
  recommendCal: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  recommendArrow: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  noRecommend: { fontSize: 13, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.sm },
  emptyFav: { alignItems: 'center', marginTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyFavIcon: { fontSize: 52, marginBottom: spacing.md },
  emptyFavTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  emptyFavSub: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
});
