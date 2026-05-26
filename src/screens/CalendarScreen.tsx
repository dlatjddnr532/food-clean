import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, shadow } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { MealType, MealLogEntry } from '../types';
import { getMealLogs } from '../api/diet';

// ─── 유틸 ──────────────────────────────────────────────────────────────────
// toDateKey: Date → "YYYY-MM-DD" 문자열 변환
// ※ mealLogs의 l.date 필드가 YYYY-MM-DD 형식이므로 반드시 일치시켜야 함
//   (toDateString() 사용 시 "Sun May 25 2026" 형태가 되어 날짜 매칭 실패)
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey(): string { return toDateKey(new Date()); }
function fmt(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
}

const MEAL_TYPES: MealType[] = ['아침', '점심', '저녁', '간식'];
const MEAL_EMOJIS: Record<MealType, string> = { 아침: '🌅', 점심: '☀️', 저녁: '🌙', 간식: '🍎' };
const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 영양소 게이지 (소형) ────────────────────────────────────────────────
function MiniGauge({ label, current, goal, color, unit = 'g' }: {
  label: string; current: number; goal: number; color: string; unit?: string;
}) {
  const pct = Math.min(current / (goal || 1), 1);
  const over = current > goal;
  return (
    <View style={gStyles.wrapper}>
      <View style={gStyles.row}>
        <Text style={gStyles.label}>{label}</Text>
        <Text style={[gStyles.val, over && { color: '#E74C3C' }]}>
          {Math.round(current)}<Text style={gStyles.unit}>{unit}</Text>
        </Text>
      </View>
      <View style={gStyles.track}>
        <View style={[gStyles.fill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: over ? '#E74C3C' : color }]} />
      </View>
    </View>
  );
}
const gStyles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 11, fontWeight: '600', color: colors.text },
  val: { fontSize: 11, fontWeight: '700', color: colors.primary },
  unit: { fontWeight: '400', color: colors.textLight },
  track: { height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

// ─── 달력 컴포넌트 ──────────────────────────────────────────────────────────
interface CalendarProps {
  visible: boolean;
  onClose: () => void;
}

export default function CalendarScreen({ visible, onClose }: CalendarProps) {
  const { mealLogs, currentUser, dailyGoals } = useApp();
  const today = new Date();

  // 현재 보고 있는 달
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // 선택된 날짜
  const [selectedKey, setSelectedKey] = useState<string>(todayKey());

  // ─────────────────────────────────────────────────────────────────────
  // 백엔드 history 캐시 — 월별로 한 번만 조회해서 저장
  // key: "YYYY-MM", value: 해당 월에 조회된 MealLogEntry 배열
  // ─────────────────────────────────────────────────────────────────────
  const [historyCache, setHistoryCache] = useState<Record<string, MealLogEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  // 월별 백엔드 history 조회 — 이미 캐시된 달은 재요청 안 함
  const fetchMonthHistory = useCallback(async (year: number, month: number) => {
    if (!currentUser) return;
    const cacheKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (historyCache[cacheKey] !== undefined) return; // 이미 로드됨

    const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDay  = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    setHistoryLoading(true);
    try {
      const res = await getMealLogs(currentUser.id, firstDay, lastDay);
      const entries: MealLogEntry[] = res.rawLogs.map((l) => ({
        id: l.id,
        userId: String(l.userId),
        date: l.eatDate,
        mealType: l.mealType,
        food: {
          id: l.id,
          name: l.foodName,
          emoji: '🍽️',
          category: '기타',
          per: `${l.quantity}g`,
          nutrition: {
            calories: l.calories, carbs: l.carbs, protein: l.protein, fat: l.fat,
            fiber: l.fiber ?? 0, sugar: l.sugar ?? 0, sodium: l.sodium ?? 0,
          },
        },
      }));
      setHistoryCache((prev) => ({ ...prev, [cacheKey]: entries }));
    } catch {
      // 실패 시 빈 배열 캐시 (무한 재요청 방지)
      setHistoryCache((prev) => ({ ...prev, [cacheKey]: [] }));
    } finally {
      setHistoryLoading(false);
    }
  }, [currentUser, historyCache]);

  // 달 이동 시 자동으로 해당 월 데이터 로드
  useEffect(() => {
    fetchMonthHistory(viewYear, viewMonth);
  }, [viewYear, viewMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // AppContext mealLogs(오늘/최근 7일) + 백엔드 history 캐시 병합
  // — id 중복 제거해서 통합된 전체 로그 목록 생성
  const allLogs = useMemo(() => {
    const cacheKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const fetched = historyCache[cacheKey] ?? [];
    const existingIds = new Set(mealLogs.map((l) => l.id));
    const extra = fetched.filter((l) => !existingIds.has(l.id));
    return [...mealLogs, ...extra].filter((l) => l.userId === currentUser?.id);
  }, [mealLogs, historyCache, viewYear, viewMonth, currentUser]);

  // 로그가 있는 날짜 집합
  const logDateSet = useMemo(() => {
    const set = new Set<string>();
    allLogs.forEach((l) => set.add(l.date));
    return set;
  }, [allLogs]);

  // 선택된 날짜의 로그
  const selectedLogs = useMemo(
    () => allLogs.filter((l) => l.date === selectedKey),
    [allLogs, selectedKey],
  );

  // 영양소 합계
  const totals = useMemo(() => selectedLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.food?.nutrition?.calories ?? 0),
      carbs: acc.carbs + (l.food?.nutrition?.carbs ?? 0),
      protein: acc.protein + (l.food?.nutrition?.protein ?? 0),
      fat: acc.fat + (l.food?.nutrition?.fat ?? 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  ), [selectedLogs]);

  const logsByMeal = useMemo(() =>
    MEAL_TYPES.reduce<Record<MealType, MealLogEntry[]>>((acc, t) => {
      acc[t] = selectedLogs.filter((l) => l.mealType === t);
      return acc;
    }, { 아침: [], 점심: [], 저녁: [], 간식: [] }),
    [selectedLogs],
  );

  // 달 이동 (1년 제한)
  const minYear = today.getFullYear() - 1;
  const canPrev = viewYear > minYear || (viewYear === minYear && viewMonth > 0);
  const canNext = viewYear < today.getFullYear() || (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const goPrev = () => {
    if (!canPrev) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (!canNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // 달력 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    // 6행 맞추기
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const todayKeyStr = todayKey();

  // 선택 날짜 표시
  const selectedDate = new Date(selectedKey);
  const selectedLabel = selectedDate.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📅 식단 달력</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 달력 카드 */}
          <View style={styles.calCard}>
            {/* 월 네비게이션 */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goPrev} style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}>
                <Text style={[styles.navArrow, !canPrev && { color: colors.border }]}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{fmt(new Date(viewYear, viewMonth, 1))}</Text>
              <TouchableOpacity onPress={goNext} style={[styles.navBtn, !canNext && styles.navBtnDisabled]}>
                <Text style={[styles.navArrow, !canNext && { color: colors.border }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* 요일 헤더 */}
            <View style={styles.weekRow}>
              {WEEK_LABELS.map((d, i) => (
                <Text key={d} style={[styles.weekLabel, i === 0 && { color: '#E74C3C' }, i === 6 && { color: '#3498DB' }]}>
                  {d}
                </Text>
              ))}
            </View>

            {/* 날짜 그리드 — 7칸씩 행으로 나눠서 렌더링 */}
            {Array.from({ length: calendarDays.length / 7 }, (_, wi) => (
              <View key={wi} style={styles.gridRow}>
                {calendarDays.slice(wi * 7, wi * 7 + 7).map((date, di) => {
                  if (!date) return <View key={`empty-${wi}-${di}`} style={styles.cell} />;

                  const key = toDateKey(date);
                  const isToday = key === todayKeyStr;
                  const isSelected = key === selectedKey;
                  const hasLog = logDateSet.has(key);
                  const isFuture = date > today;
                  const isSun = date.getDay() === 0;
                  const isSat = date.getDay() === 6;

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.cell,
                        isSelected && styles.cellSelected,
                        isToday && !isSelected && styles.cellToday,
                      ]}
                      onPress={() => !isFuture && setSelectedKey(key)}
                      disabled={isFuture}
                    >
                      <Text style={[
                        styles.dayText,
                        isSun && styles.sunday,
                        isSat && styles.saturday,
                        isSelected && styles.dayTextSelected,
                        isToday && !isSelected && styles.dayTextToday,
                        isFuture && styles.dayTextFuture,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {hasLog && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
                      {!hasLog && <View style={styles.dotPlaceholder} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* 선택된 날짜 기록 */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>{selectedLabel}</Text>
              {historyLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
              )}
            </View>

            {historyLoading ? (
              // 백엔드에서 이달 데이터 로딩 중
              <View style={styles.emptyCard}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.emptyText, { marginTop: spacing.sm }]}>식단 기록 불러오는 중...</Text>
              </View>
            ) : selectedLogs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🍽️</Text>
                <Text style={styles.emptyText}>이 날의 식단 기록이 없어요</Text>
              </View>
            ) : (
              <>
                {/* 칼로리 요약 */}
                <View style={styles.summaryCard}>
                  <View style={styles.calRow}>
                    <Text style={styles.calLabel}>총 칼로리</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={styles.calValue}>{totals.calories}</Text>
                      <Text style={styles.calGoal}> / {dailyGoals.calories} kcal</Text>
                    </View>
                  </View>
                  <View style={styles.calTrack}>
                    <View style={[styles.calFill, {
                      width: `${Math.min(totals.calories / (dailyGoals.calories || 1), 1) * 100}%` as `${number}%`,
                      backgroundColor: totals.calories > dailyGoals.calories ? '#E74C3C' : colors.primary,
                    }]} />
                  </View>
                  <View style={{ marginTop: spacing.sm }}>
                    <MiniGauge label="탄수화물" current={totals.carbs} goal={dailyGoals.carbs} color="#F6A623" />
                    <MiniGauge label="단백질" current={totals.protein} goal={dailyGoals.protein} color="#2ECC71" />
                    <MiniGauge label="지방" current={totals.fat} goal={dailyGoals.fat} color="#F093FB" />
                  </View>
                </View>

                {/* 식사별 음식 목록 */}
                {MEAL_TYPES.map((type) => {
                  const logs = logsByMeal[type];
                  if (logs.length === 0) return null;
                  const mealCal = logs.reduce((s, l) => s + (l.food?.nutrition?.calories ?? 0), 0);
                  return (
                    <View key={type} style={styles.mealCard}>
                      <View style={styles.mealHeader}>
                        <Text style={styles.mealEmoji}>{MEAL_EMOJIS[type]}</Text>
                        <Text style={styles.mealType}>{type}</Text>
                        <Text style={styles.mealCal}>{mealCal} kcal</Text>
                      </View>
                      {logs.map((log) => (
                        <View key={log.id} style={styles.foodRow}>
                          <Text style={styles.foodEmoji}>{log.food?.emoji ?? '🍽️'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.foodName}>{log.food?.name}</Text>
                            <Text style={styles.foodNutrient}>
                              {log.food?.nutrition?.calories}kcal · 탄{log.food?.nutrition?.carbs}g · 단{log.food?.nutrition?.protein}g · 지{log.food?.nutrition?.fat}g
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  closeBtnText: { fontSize: 15, color: colors.primary, fontWeight: '700' },

  // 달력 카드
  calCard: {
    margin: spacing.lg, backgroundColor: colors.white,
    borderRadius: borderRadius.lg, padding: spacing.md, ...shadow.small,
  },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  navBtn: { padding: spacing.sm },
  navBtnDisabled: { opacity: 0.3 },
  navArrow: { fontSize: 28, fontWeight: '300', color: colors.text, lineHeight: 32 },
  monthLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.textLight },
  gridRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4,
  },
  cellSelected: { backgroundColor: colors.primary, borderRadius: borderRadius.sm },
  cellToday: { backgroundColor: colors.primaryLight, borderRadius: borderRadius.sm },
  dayText: { fontSize: 14, fontWeight: '600', color: colors.text },
  dayTextSelected: { color: '#fff', fontWeight: '800' },
  dayTextToday: { color: colors.primary, fontWeight: '800' },
  dayTextFuture: { color: colors.border },
  sunday: { color: '#E74C3C' },
  saturday: { color: '#3498DB' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 },
  dotSelected: { backgroundColor: 'rgba(255,255,255,0.85)' },
  dotPlaceholder: { width: 5, height: 5, marginTop: 2 },

  // 기록 섹션
  section: { paddingHorizontal: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.md },

  emptyCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.xl, alignItems: 'center', ...shadow.small,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight, fontWeight: '600' },

  summaryCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.small,
  },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  calLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  calValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  calGoal: { fontSize: 12, color: colors.textLight },
  calTrack: { height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.sm },
  calFill: { height: '100%', borderRadius: 5 },

  mealCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.small,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  mealEmoji: { fontSize: 18, marginRight: 6 },
  mealType: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1 },
  mealCal: { fontSize: 13, fontWeight: '700', color: colors.primary },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  foodEmoji: { fontSize: 22, marginRight: spacing.sm },
  foodName: { fontSize: 13, fontWeight: '700', color: colors.text },
  foodNutrient: { fontSize: 11, color: colors.textLight, marginTop: 2 },
});
