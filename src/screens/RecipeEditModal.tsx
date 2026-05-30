import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { UserRecipe, UserRecipeIngredient } from '../types';
import { createRecipe, updateRecipe } from '../api/diet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface RecipeEditModalProps {
  visible: boolean;
  initial: Partial<UserRecipe> | null;
  userId: string;
  ingredientSuggestions?: string[];
  cookingToolOptions?: string[];
  onClose: () => void;
  onSave: (recipe: UserRecipe) => void;
}

export function RecipeEditModal({ visible, initial, userId, ingredientSuggestions = [], cookingToolOptions = [], onClose, onSave }: RecipeEditModalProps) {
  const insets = useSafeAreaInsets();
  const isEdit = !!initial?.title;

  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [cookTime, setCookTime] = useState('30');
  const [servings, setServings] = useState('2');
  const [ingredients, setIngredients] = useState<UserRecipeIngredient[]>([{ name: '' }]);
  const [tools, setTools]       = useState<string[]>([]);
  const [steps, setSteps]       = useState<string[]>(['']);
  const [saving, setSaving]     = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // 재료 검색 자동완성
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [activeIngIdx, setActiveIngIdx]   = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSearchResults([]);
    setActiveIngIdx(null);
    if (initial) {
      setTitle(initial.title ?? '');
      setContent('');
      setCookTime(String(initial.cookTime ?? 30));
      setServings(String(initial.servings ?? 2));
      setIngredients(
        initial.ingredients && initial.ingredients.length > 0
          ? initial.ingredients
          : [{ name: '' }],
      );
      setTools(initial.tools ?? []);
      setSteps(
        initial.steps && initial.steps.length > 0
          ? initial.steps
          : [''],
      );
    } else {
      setTitle('');
      setContent('');
      setCookTime('30');
      setServings('2');
      setIngredients([{ name: '' }]);
      setTools([]);
      setSteps(['']);
    }
  }, [visible]);

  const updateIngredient = (idx: number, val: string) => {
    setIngredients((prev) => prev.map((ing, i) => i === idx ? { ...ing, name: val } : ing));
    {
      setActiveIngIdx(idx);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (!val.trim()) { setSearchResults([]); return; }
      searchTimer.current = setTimeout(() => {
        const q = val.trim().toLowerCase();
        const filtered = ingredientSuggestions
          .filter((n) => n.toLowerCase().includes(q))
          .slice(0, 8);
        setSearchResults(filtered);
      }, 150);
    }
  };

  const selectIngredient = (idx: number, name: string) => {
    setIngredients((prev) => prev.map((ing, i) =>
      i === idx ? { ...ing, name } : ing
    ));
    setSearchResults([]);
    setActiveIngIdx(null);
  };

  const addIngredient = () => setIngredients((prev) => [...prev, { name: '' }]);
  const removeIngredient = (idx: number) => {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
    if (activeIngIdx === idx) { setSearchResults([]); setActiveIngIdx(null); }
  };

  const toggleTool = (tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  };

  const updateStep = (idx: number, val: string) => setSteps((prev) => prev.map((s, i) => i === idx ? val : s));
  const addStep    = () => setSteps((prev) => [...prev, '']);
  const removeStep = (idx: number) => {
    if (steps.length === 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveStep = (idx: number, dir: 'up' | 'down') => {
    setSteps((prev) => {
      const arr = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return arr;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('제목 필요', '레시피 제목을 입력해주세요.'); return; }
    const validSteps = steps.filter((s) => s.trim());
    if (validSteps.length === 0) { Alert.alert('조리 순서 필요', '조리 순서를 1단계 이상 입력해주세요.'); return; }
    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validTools = tools.filter((t) => t.trim());

    setSaving(true);
    setSaveStatus('레시피를 저장하고 있어요.');
    try {
      // 수정 모드: 기존 로컬 ID 유지 / 신규: 타임스탬프 → 서버 ID로 교체
      let savedId: string = initial?.id ?? String(Date.now());
      let backendId: number | undefined = initial?.backendId;
      let analyzedNutrition = initial?.totalNutrition ?? { calories: 0, carbs: 0, protein: 0, fat: 0 };

      if (userId) {
        try {
          const dto = {
            title: title.trim(),
            content: content.trim() || undefined,
            ingredients: validIngredients.map((i) => i.name.trim()),
            cooking_tools: validTools,
            steps: validSteps.map((desc, i) => ({ step_number: i + 1, description: desc.trim() })),
          };

          setSaveStatus('영양소를 분석하고 있어요.');
          let res;
          if (isEdit && backendId) {
            // 수정 모드 — PUT으로 기존 레시피 업데이트 (중복 생성 방지)
            res = await updateRecipe(backendId, userId, dto);
          } else {
            // 신규 — POST로 레시피 생성, 서버 ID 채택
            res = await createRecipe(userId, dto);
            if (res.id) {
              if (!isEdit) savedId = String(res.id);
              backendId = res.id;
            }
          }

          // 서버가 AI로 추정한 영양소 반영 (0이면 기존 값 유지)
          if ((res.calories ?? 0) > 0) {
            analyzedNutrition = {
              calories: res.calories ?? 0,
              carbs: res.carbs ?? 0,
              protein: res.protein ?? 0,
              fat: res.fat ?? 0,
              fiber: res.fiber ?? 0,
              sugar: res.sugar ?? 0,
              sodium: res.sodium ?? 0,
            };
          }
        } catch (e: any) {
          // 서버 오류 시 로컬에만 저장 + 실제 에러 메시지 Alert으로 노출 (디버깅용)
          const msg = e?.response?.data?.message ?? e?.message ?? String(e);
          const status = e?.response?.status ?? '없음';
          console.warn('[RecipeEditModal] 서버 저장 실패:', msg, status, e);
        }
      }

      const newRecipe: UserRecipe = {
        id: savedId,
        title: title.trim(),
        emoji: '🍳',
        category: '나만의 요리',
        cookTime: parseInt(cookTime, 10) || 30,
        servings: parseInt(servings, 10) || 2,
        youtubeUrl: initial?.youtubeUrl ?? '',
        ingredients: validIngredients,
        tools: validTools,
        steps: validSteps,
        totalNutrition: analyzedNutrition,
        createdAt: initial?.createdAt ?? new Date().toLocaleDateString('ko-KR'),
        backendId,
        sharedRecipeId: initial?.sharedRecipeId,
        isPublic: initial?.isPublic ?? Boolean(initial?.sharedRecipeId),
      };
      onSave(newRecipe);
      Alert.alert('저장 완료! ✅', `"${newRecipe.title}" 레시피가 저장됐어요.`);
    } catch {
      Alert.alert('오류', '저장 중 문제가 생겼어요.');
    } finally {
      setSaveStatus('');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <>
        <View style={[eStyles.container, { paddingTop: insets.top }]}>

          <View style={eStyles.header}>
            <TouchableOpacity onPress={onClose} style={eStyles.backBtn}>
              <Text style={eStyles.backTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={eStyles.headerTitle}>{isEdit ? '레시피 수정' : '레시피 직접 작성'}</Text>
            <TouchableOpacity style={[eStyles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <View style={eStyles.saveBusyRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={eStyles.saveBtnTxt}>저장 중</Text>
                </View>
              ) : <Text style={eStyles.saveBtnTxt}>저장</Text>}
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={eStyles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={140}
            keyboardOpeningTime={0}
          >
            {saving && saveStatus ? (
              <View style={eStyles.saveStatusBox}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={eStyles.saveStatusText}>{saveStatus}</Text>
              </View>
            ) : null}
            {/* 기본 정보 */}
            <Text style={eStyles.sectionLabel}>📌 기본 정보</Text>
            <View style={eStyles.card}>
              <Text style={eStyles.fieldLabel}>레시피 제목 *</Text>
              <TextInput style={eStyles.input} placeholder="예: 백종원 제육볶음" placeholderTextColor={colors.textLight} value={title} onChangeText={setTitle} />
              <Text style={eStyles.fieldLabel}>한 줄 소개</Text>
              <TextInput style={eStyles.input} placeholder="예: 집에서 불맛 나는 제육볶음" placeholderTextColor={colors.textLight} value={content} onChangeText={setContent} />
              <View style={eStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.fieldLabel}>⏱️ 조리 시간 (분)</Text>
                  <TextInput style={eStyles.input} keyboardType="numeric" value={cookTime} onChangeText={setCookTime} placeholder="30" placeholderTextColor={colors.textLight} />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={eStyles.fieldLabel}>🍽️ 인분 수</Text>
                  <TextInput style={eStyles.input} keyboardType="numeric" value={servings} onChangeText={setServings} placeholder="2" placeholderTextColor={colors.textLight} />
                </View>
              </View>
            </View>

            {/* 재료 */}
            <View style={eStyles.sectionHeader}>
              <Text style={eStyles.sectionLabel}>📋 재료</Text>
              <TouchableOpacity onPress={addIngredient} style={eStyles.addRowBtn}>
                <Text style={eStyles.addRowBtnTxt}>+ 추가</Text>
              </TouchableOpacity>
            </View>
            <View style={eStyles.card}>
              {ingredients.map((ing, idx) => (
                <View key={idx}>
                  <View style={eStyles.listRow}>
                    <View style={{ flex: 2 }}>
                      <TextInput
                        style={[eStyles.input, { marginBottom: 0 }]}
                        placeholder="재료 검색..."
                        placeholderTextColor={colors.textLight}
                        value={ing.name}
                        onChangeText={(v) => updateIngredient(idx, v)}
                        onFocus={() => setActiveIngIdx(idx)}
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeIngredient(idx)} style={eStyles.removeBtn}>
                      <Text style={eStyles.removeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 검색 결과 드롭다운 */}
                  {activeIngIdx === idx && searchResults.length > 0 && (
                    <View style={eStyles.dropdown}>
                      {searchResults.map((name) => (
                        <TouchableOpacity key={name} style={eStyles.dropdownItem} onPress={() => selectIngredient(idx, name)}>
                          <Text style={eStyles.dropdownName}>{name}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={eStyles.dropdownManual} onPress={() => { setSearchResults([]); setActiveIngIdx(null); }}>
                        <Text style={eStyles.dropdownManualTxt}>{`"${ing.name}" 직접 입력으로 사용 →`}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {idx < ingredients.length - 1 && <View style={{ height: spacing.sm }} />}
                </View>
              ))}
            </View>

            {/* 조리기구 */}
            <View style={eStyles.sectionHeader}>
              <Text style={eStyles.sectionLabel}>{'\uD83C\uDF73 \uC870\uB9AC\uAE30\uAD6C'}</Text>
            </View>
            <View style={eStyles.card}>
              <View style={eStyles.toolGrid}>
                {cookingToolOptions.map((tool) => {
                  const selected = tools.includes(tool);
                  return (
                    <TouchableOpacity
                      key={tool}
                      style={[eStyles.toolChip, selected && eStyles.toolChipActive]}
                      onPress={() => toggleTool(tool)}
                      activeOpacity={0.8}
                    >
                      <Text style={[eStyles.toolChipText, selected && eStyles.toolChipTextActive]}>
                        {selected ? '\u2713 ' : ''}{tool}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {tools.length > 0 && (
                <TouchableOpacity onPress={() => setTools([])} style={eStyles.clearToolsBtn}>
                  <Text style={eStyles.clearToolsText}>{'\uC120\uD0DD \uCD08\uAE30\uD654'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 조리 순서 */}
            <View style={eStyles.sectionHeader}>
              <Text style={eStyles.sectionLabel}>👨‍🍳 조리 순서 *</Text>
              <TouchableOpacity onPress={addStep} style={eStyles.addRowBtn}>
                <Text style={eStyles.addRowBtnTxt}>+ 추가</Text>
              </TouchableOpacity>
            </View>
            <View style={eStyles.card}>
              {steps.map((step, idx) => (
                <View key={idx} style={eStyles.stepEditRow}>
                  <View style={eStyles.stepBadge}>
                    <Text style={eStyles.stepBadgeTxt}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={[eStyles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={`${idx + 1}단계 설명`}
                    placeholderTextColor={colors.textLight}
                    value={step}
                    onChangeText={(v) => updateStep(idx, v)}
                    multiline
                  />
                  <View style={eStyles.stepBtns}>
                    <TouchableOpacity onPress={() => moveStep(idx, 'up')} disabled={idx === 0} style={[eStyles.orderBtn, idx === 0 && { opacity: 0.25 }]}>
                      <Text style={eStyles.orderBtnTxt}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveStep(idx, 'down')} disabled={idx === steps.length - 1} style={[eStyles.orderBtn, idx === steps.length - 1 && { opacity: 0.25 }]}>
                      <Text style={eStyles.orderBtnTxt}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeStep(idx)} style={eStyles.removeBtn}>
                      <Text style={eStyles.removeBtnTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ height: 170 }} />
          </KeyboardAwareScrollView>
        </View>
      </>
    </Modal>
  );
}

const eStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
    ...shadow.small,
  },
  backBtn: { padding: spacing.xs },
  backTxt: { fontSize: 18, color: colors.textLight },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, minWidth: 58, alignItems: 'center' },
  saveBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  saveStatusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF2FF', borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  saveStatusText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  body: { padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs, marginTop: spacing.md },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  addRowBtn: { backgroundColor: colors.primaryLight, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  addRowBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, ...shadow.small, marginTop: spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textLight, marginBottom: 4, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center', marginLeft: spacing.xs },
  removeBtnTxt: { fontSize: 11, color: '#E74C3C', fontWeight: '700' },
  // 검색 드롭다운
  dropdown: { backgroundColor: '#fff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4, marginBottom: spacing.sm, ...shadow.small, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownName: { fontSize: 14, fontWeight: '700', color: colors.text },
  dropdownMeta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  dropdownLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  dropdownLoadingTxt: { fontSize: 13, color: colors.textLight },
  dropdownManual: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background },
  dropdownManualTxt: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  // 조리 순서
  stepEditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  stepBadgeTxt: { fontSize: 13, fontWeight: '900', color: '#fff' },
  stepBtns: { flexDirection: 'column', gap: 2, marginTop: 4 },
  orderBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  orderBtnTxt: { fontSize: 9, color: colors.textLight },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toolChip: {
    paddingVertical: 6, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  toolChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toolChipText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  toolChipTextActive: { color: '#fff' },
  clearToolsBtn: { alignItems: 'center', marginTop: spacing.sm },
  clearToolsText: { fontSize: 12, color: '#E74C3C', fontWeight: '700' },
});
