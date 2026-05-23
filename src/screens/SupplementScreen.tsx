import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { Supplement, SupplementTime } from '../types';

const TIMES: SupplementTime[] = ['아침', '점심', '저녁', '취침'];
const TIME_EMOJI: Record<SupplementTime, string> = {
  아침: '🌅', 점심: '☀️', 저녁: '🌆', 취침: '🌙',
};
const CARD_COLORS = ['#6C63FF', '#FF6584', '#43B89C', '#F6A623', '#E74C3C', '#2ECC71'];

// ── 공통 영양 성분 목록 (백엔드 DB 연동 전 로컬 목록) ──
const COMMON_INGREDIENTS = [
  { name: '비타민A', defaultAmount: '700μg' },
  { name: '비타민B1', defaultAmount: '1.2mg' },
  { name: '비타민B2', defaultAmount: '1.4mg' },
  { name: '비타민B3 (나이아신)', defaultAmount: '16mg' },
  { name: '비타민B5 (판토텐산)', defaultAmount: '5mg' },
  { name: '비타민B6', defaultAmount: '1.5mg' },
  { name: '비타민B7 (비오틴)', defaultAmount: '30μg' },
  { name: '비타민B9 (엽산)', defaultAmount: '400μg' },
  { name: '비타민B12', defaultAmount: '2.4μg' },
  { name: '비타민C', defaultAmount: '1000mg' },
  { name: '비타민D', defaultAmount: '2000IU' },
  { name: '비타민E', defaultAmount: '15mg' },
  { name: '비타민K', defaultAmount: '120μg' },
  { name: '오메가3', defaultAmount: '1000mg' },
  { name: '마그네슘', defaultAmount: '400mg' },
  { name: '칼슘', defaultAmount: '1000mg' },
  { name: '아연', defaultAmount: '10mg' },
  { name: '철분', defaultAmount: '18mg' },
  { name: '루테인', defaultAmount: '20mg' },
  { name: '코엔자임Q10', defaultAmount: '100mg' },
  { name: '프로바이오틱스', defaultAmount: '10억CFU' },
  { name: '콜라겐', defaultAmount: '1000mg' },
  { name: '글루코사민', defaultAmount: '1500mg' },
  { name: '밀크씨슬', defaultAmount: '200mg' },
  { name: '셀레늄', defaultAmount: '55μg' },
  { name: '크롬', defaultAmount: '35μg' },
  { name: '구리', defaultAmount: '0.9mg' },
  { name: '망간', defaultAmount: '2.3mg' },
  { name: 'NAC (N-아세틸시스테인)', defaultAmount: '600mg' },
  { name: '알파리포산', defaultAmount: '300mg' },
];

interface SelectedIngredient {
  name: string;
}

// ── 영양제 추가 / 수정 모달 ──
interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (supp: Supplement) => void;
  colorIndex: number;
  initialData?: Supplement; // 수정 모드일 때 기존 데이터
}

function AddSupplementModal({ visible, onClose, onAdd, colorIndex, initialData }: AddModalProps) {
  const isEdit = !!initialData;

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<SupplementTime[]>(['아침']);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // 수정 모드: 모달 열릴 때 기존 값으로 초기화
  React.useEffect(() => {
    if (visible && initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage);
      setSelectedTimes([...initialData.times]);
      const parsed = initialData.nutrients
        ? initialData.nutrients.split(', ').filter(Boolean).map((n) => ({ name: n }))
        : [];
      setSelectedIngredients(parsed);
    }
    if (!visible) {
      setName(''); setDosage(''); setSelectedTimes(['아침']);
      setIngredientSearch(''); setSelectedIngredients([]); setShowSearch(false);
    }
  }, [visible]);

  const filteredIngredients = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    if (!query) return COMMON_INGREDIENTS;
    return COMMON_INGREDIENTS.filter((i) => i.name.toLowerCase().includes(query));
  }, [ingredientSearch]);

  const toggleTime = (t: SupplementTime) => {
    setSelectedTimes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const addIngredient = (ing: { name: string; defaultAmount: string }) => {
    if (selectedIngredients.some((i) => i.name === ing.name)) return;
    setSelectedIngredients((prev) => [...prev, { name: ing.name }]);
    setIngredientSearch('');
  };

  const removeIngredient = (name: string) => {
    setSelectedIngredients((prev) => prev.filter((i) => i.name !== name));
  };

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert('이름 입력', '영양제 이름을 입력해주세요.');
      return;
    }
    if (selectedTimes.length === 0) {
      Alert.alert('시간 선택', '복용 시간대를 하나 이상 선택해주세요.');
      return;
    }
    const nutrientsStr = selectedIngredients.map((i) => i.name).join(', ');
    onAdd({
      id: isEdit ? initialData!.id : String(Date.now()),
      name: name.trim(),
      dosage: dosage.trim() || '1정',
      times: selectedTimes,
      nutrients: nutrientsStr,
      color: isEdit ? initialData!.color : CARD_COLORS[colorIndex % CARD_COLORS.length],
    });
    setName('');
    setDosage('');
    setSelectedTimes(['아침']);
    setIngredientSearch('');
    setSelectedIngredients([]);
    setShowSearch(false);
    onClose();
  };

  const handleClose = () => {
    setName('');
    setDosage('');
    setSelectedTimes(['아침']);
    setIngredientSearch('');
    setSelectedIngredients([]);
    setShowSearch(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={m.backdrop}>
          <ScrollView
            style={m.sheet}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text style={m.title}>{isEdit ? '✏️ 영양제 수정' : '💊 영양제 추가'}</Text>

            <Text style={m.label}>영양제 이름 *</Text>
            <TextInput
              style={m.input}
              placeholder="예: 비타민C, 오메가3, 마그네슘"
              placeholderTextColor={colors.textLight}
              value={name}
              onChangeText={setName}
            />

            <Text style={m.label}>1회 복용량</Text>
            <TextInput
              style={m.input}
              placeholder="예: 1정, 2캡슐, 500mg"
              placeholderTextColor={colors.textLight}
              value={dosage}
              onChangeText={setDosage}
            />

            <Text style={m.label}>복용 시간대 *</Text>
            <View style={m.timeRow}>
              {TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[m.timeBtn, selectedTimes.includes(t) && m.timeBtnActive]}
                  onPress={() => toggleTime(t)}
                >
                  <Text style={m.timeEmoji}>{TIME_EMOJI[t]}</Text>
                  <Text style={[m.timeText, selectedTimes.includes(t) && m.timeTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── 영양 성분 검색 ── */}
            <Text style={m.label}>영양 성분 (선택)</Text>

            {/* 선택된 성분 목록 */}
            {selectedIngredients.length > 0 && (
              <View style={m.selectedList}>
                {selectedIngredients.map((ing) => (
                  <View key={ing.name} style={m.selectedChip}>
                    <Text style={m.selectedChipName}>{ing.name}</Text>
                    <TouchableOpacity onPress={() => removeIngredient(ing.name)} style={m.chipRemove}>
                      <Text style={m.chipRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 검색창 토글 버튼 */}
            <TouchableOpacity
              style={m.searchToggleBtn}
              onPress={() => setShowSearch((v) => !v)}
            >
              <Text style={m.searchToggleText}>
                {showSearch ? '▲ 성분 검색 닫기' : '+ 성분 검색하여 추가'}
              </Text>
            </TouchableOpacity>

            {/* 성분 검색 패널 */}
            {showSearch && (
              <View style={m.searchPanel}>
                <TextInput
                  style={m.searchInput}
                  placeholder="성분명 검색 (예: 비타민C, 아연)"
                  placeholderTextColor={colors.textLight}
                  value={ingredientSearch}
                  onChangeText={setIngredientSearch}
                  autoFocus
                />
                <ScrollView
                  style={m.searchResults}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredIngredients.length === 0 ? (
                    <Text style={m.noResult}>검색 결과가 없어요</Text>
                  ) : (
                    filteredIngredients.map((ing) => {
                      const already = selectedIngredients.some((i) => i.name === ing.name);
                      return (
                        <TouchableOpacity
                          key={ing.name}
                          style={[m.resultRow, already && m.resultRowDone]}
                          onPress={() => !already && addIngredient(ing)}
                          disabled={already}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[m.resultName, already && { color: colors.textLight }]}>
                              {ing.name}
                            </Text>
                            <Text style={m.resultDefault}>기본 용량: {ing.defaultAmount}</Text>
                          </View>
                          <Text style={m.resultAction}>{already ? '✓ 추가됨' : '+ 추가'}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={m.addBtn} onPress={handleAdd}>
              <Text style={m.addBtnText}>{isEdit ? '수정하기' : '추가하기'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancelBtn} onPress={handleClose}>
              <Text style={m.cancelText}>취소</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40, maxHeight: '92%',
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: 14, color: colors.text, backgroundColor: colors.background,
  },
  timeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  timeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  timeBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  timeEmoji: { fontSize: 20 },
  timeText: { fontSize: 11, fontWeight: '600', color: colors.textLight, marginTop: 2 },
  timeTextActive: { color: colors.primary },
  // 선택된 성분 목록
  selectedList: {
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, paddingHorizontal: spacing.sm, gap: 6,
  },
  selectedChipName: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
  chipRemove: { padding: 4 },
  chipRemoveText: { fontSize: 12, color: '#E74C3C', fontWeight: '800' },
  // 검색 토글
  searchToggleBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs,
    backgroundColor: colors.primary + '10',
  },
  searchToggleText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  // 검색 패널
  searchPanel: {
    marginTop: spacing.sm, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: '#fff',
  },
  searchInput: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    padding: spacing.md, fontSize: 14, color: colors.text,
    backgroundColor: colors.background,
  },
  searchResults: { maxHeight: 200 },
  noResult: { padding: spacing.md, color: colors.textLight, textAlign: 'center', fontSize: 13 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border + '60',
  },
  resultRowDone: { backgroundColor: colors.background },
  resultName: { fontSize: 14, fontWeight: '700', color: colors.text },
  resultDefault: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  resultAction: { fontSize: 12, fontWeight: '700', color: colors.primary },
  // 버튼
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: spacing.md, marginBottom: spacing.lg },
  cancelText: { color: colors.textLight, fontSize: 14 },
});

// ── 영양제 카드 ──
interface SupplementCardProps {
  supp: Supplement;
  onDelete: () => void;
  onEdit: () => void;
  takenTimes: SupplementTime[];
  onToggle: (time: SupplementTime) => void;
}

function SupplementCard({ supp, onDelete, onEdit, takenTimes, onToggle }: SupplementCardProps) {
  const allTaken = supp.times.every((t) => takenTimes.includes(t));
  const takenCount = supp.times.filter((t) => takenTimes.includes(t)).length;

  const confirmDelete = () => {
    Alert.alert('삭제 확인', `"${supp.name}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={[c.card, { borderLeftColor: supp.color, borderLeftWidth: 4 }]}>
      <View style={c.cardHeader}>
        <View style={[c.dot, { backgroundColor: supp.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={c.name}>{supp.name}</Text>
          <Text style={c.dosage}>{supp.dosage} · {supp.times.join(', ')}</Text>
        </View>
        <View style={c.progress}>
          <Text style={[c.progressText, { color: allTaken ? '#2ECC71' : supp.color }]}>
            {allTaken ? '✅' : `${takenCount}/${supp.times.length}`}
          </Text>
        </View>
        <TouchableOpacity onPress={onEdit} style={c.deleteBtn}>
          <Text style={c.deleteText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={c.deleteBtn}>
          <Text style={c.deleteText}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* 복용 시간 체크 버튼 */}
      <View style={c.timeRow}>
        {supp.times.map((t) => {
          const taken = takenTimes.includes(t);
          return (
            <TouchableOpacity
              key={t}
              style={[c.timeChip, taken && { backgroundColor: supp.color + '22', borderColor: supp.color }]}
              onPress={() => onToggle(t)}
            >
              <Text style={c.timeChipEmoji}>{TIME_EMOJI[t]}</Text>
              <Text style={[c.timeChipText, taken && { color: supp.color, fontWeight: '800' }]}>
                {t} {taken ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 영양 성분 */}
      {!!supp.nutrients && (
        <View style={c.nutriRow}>
          <Text style={c.nutriLabel}>💊 성분</Text>
          <Text style={c.nutriText}>{supp.nutrients}</Text>
        </View>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  dosage: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  progress: { marginRight: spacing.xs },
  progressText: { fontSize: 15, fontWeight: '800' },
  deleteBtn: { padding: spacing.xs },
  deleteText: { fontSize: 18 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  timeChipEmoji: { fontSize: 13 },
  timeChipText: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  nutriRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    padding: spacing.sm, marginTop: spacing.xs,
  },
  nutriLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  nutriText: { fontSize: 12, color: colors.textLight, flex: 1, lineHeight: 18 },
});

// ── 메인 화면 ──
export default function SupplementScreen() {
  const insets = useSafeAreaInsets();
  const { supplements, addSupplement, removeSupplement, updateSupplement, getTodayTakenTimes, toggleSupplementTaken } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplement | undefined>(undefined);

  const handleOpenEdit = (supp: Supplement) => {
    setEditTarget(supp);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditTarget(undefined);
  };

  const handleSave = (supp: Supplement) => {
    if (editTarget) {
      updateSupplement(supp);
    } else {
      addSupplement(supp);
    }
  };

  // 오늘 전체 복용 현황
  const totalDoses = supplements.reduce((s, sup) => s + sup.times.length, 0);
  const takenDoses = supplements.reduce((s, sup) => s + getTodayTakenTimes(sup.id).length, 0);
  const allDone = totalDoses > 0 && takenDoses === totalDoses;

  return (
    <View style={s.container}>
      {/* 헤더 */}
      <View style={[s.header, { paddingTop: spacing.xl + insets.top }]}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>영양제 관리 💊</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={s.addBtnText}>+ 추가</Text>
          </TouchableOpacity>
        </View>

        {/* 오늘 복용 현황 요약 */}
        {supplements.length > 0 && (
          <View style={[s.summaryBox, allDone && s.summaryBoxDone]}>
            <Text style={[s.summaryText, allDone && s.summaryTextDone]}>
              {allDone
                ? '🎉 오늘 모든 영양제 복용 완료!'
                : `오늘 복용 현황: ${takenDoses} / ${totalDoses} 완료`}
            </Text>
            {!allDone && totalDoses > 0 && (
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${(takenDoses / totalDoses) * 100}%` as any }]} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* 영양제 목록 */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {supplements.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💊</Text>
            <Text style={s.emptyTitle}>등록된 영양제가 없어요</Text>
            <Text style={s.emptySub}>+ 추가 버튼을 눌러 영양제를 등록해보세요!</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={s.emptyBtnText}>영양제 추가하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          supplements.map((supp) => (
            <SupplementCard
              key={supp.id}
              supp={supp}
              onDelete={() => removeSupplement(supp.id)}
              onEdit={() => handleOpenEdit(supp)}
              takenTimes={getTodayTakenTimes(supp.id)}
              onToggle={(time) => toggleSupplementTaken(supp.id, time)}
            />
          ))
        )}
      </ScrollView>

      <AddSupplementModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onAdd={handleSave}
        colorIndex={supplements.length}
        initialData={editTarget}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: '#fff', paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  summaryBox: {
    backgroundColor: colors.primary + '15', borderRadius: borderRadius.md,
    padding: spacing.sm, borderWidth: 1.5, borderColor: colors.primary + '40',
  },
  summaryBoxDone: { backgroundColor: '#2ECC7120', borderColor: '#2ECC7160' },
  summaryText: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  summaryTextDone: { color: '#27AE60' },
  progressBar: {
    height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  list: { padding: spacing.md, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 3 },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  emptySub: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
