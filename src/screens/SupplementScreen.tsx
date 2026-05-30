import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { colors, spacing, borderRadius } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { Supplement } from '../types';

const CARD_COLORS = ['#6C63FF', '#FF6584', '#43B89C', '#F6A623', '#E74C3C', '#2ECC71'];
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const WHEEL_REPEAT = 9;
const WHEEL_MIDDLE_REPEAT = Math.floor(WHEEL_REPEAT / 2);
const WHEEL_ITEM_INTERVAL = 40;

const COMMON_INGREDIENTS = [
  { name: '\uBE44\uD0C0\uBBFCA', defaultAmount: '700mcg' },
  { name: '\uBE44\uD0C0\uBBFCB1', defaultAmount: '1.2mg' },
  { name: '\uBE44\uD0C0\uBBFCB2', defaultAmount: '1.4mg' },
  { name: '\uBE44\uD0C0\uBBFCB3', defaultAmount: '16mg' },
  { name: '\uBE44\uD0C0\uBBFCB5', defaultAmount: '5mg' },
  { name: '\uBE44\uD0C0\uBBFCB6', defaultAmount: '1.5mg' },
  { name: '\uBE44\uD0C0\uBBFCB7', defaultAmount: '30mcg' },
  { name: '\uBE44\uD0C0\uBBFCB9', defaultAmount: '400mcg' },
  { name: '\uBE44\uD0C0\uBBFCB12', defaultAmount: '2.4mcg' },
  { name: '\uBE44\uD0C0\uBBFCC', defaultAmount: '1000mg' },
  { name: '\uBE44\uD0C0\uBBFCD', defaultAmount: '2000IU' },
  { name: '\uBE44\uD0C0\uBBFCE', defaultAmount: '15mg' },
  { name: '\uBE44\uD0C0\uBBFCK', defaultAmount: '120mcg' },
  { name: '\uC624\uBA54\uAC003', defaultAmount: '1000mg' },
  { name: '\uB9C8\uADF8\uB124\uC298', defaultAmount: '400mg' },
  { name: '\uCE7C\uC298', defaultAmount: '1000mg' },
  { name: '\uC544\uC5F0', defaultAmount: '10mg' },
  { name: '\uCCA0\uBD84', defaultAmount: '18mg' },
  { name: '\uB8E8\uD14C\uC778', defaultAmount: '20mg' },
  { name: '\uCF54\uC5D4\uC790\uC784Q10', defaultAmount: '100mg' },
  { name: '\uD504\uB85C\uBC14\uC774\uC624\uD2F1\uC2A4', defaultAmount: '10\uC5B5 CFU' },
  { name: '\uCF5C\uB77C\uAC90', defaultAmount: '1000mg' },
  { name: '\uAE00\uB8E8\uCF54\uC0AC\uBBFC', defaultAmount: '1500mg' },
  { name: '\uBC00\uD06C\uC528\uC2AC', defaultAmount: '200mg' },
  { name: '\uC140\uB808\uB284', defaultAmount: '55mcg' },
  { name: '\uD06C\uB86C', defaultAmount: '35mcg' },
  { name: '\uAD6C\uB9AC', defaultAmount: '0.9mg' },
  { name: '\uB9DD\uAC04', defaultAmount: '2.3mg' },
  { name: 'NAC', defaultAmount: '600mg' },
  { name: '\uC54C\uD30C\uB9AC\uD3EC\uC0B0', defaultAmount: '300mg' },
];

const LEGACY_TIME_MAP: Record<string, string> = {
  '\uC544\uCE68': '08:00',
  '\uC810\uC2EC': '12:00',
  '\uC800\uB141': '18:00',
  '\uCDE8\uCE68': '22:00',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface SelectedIngredient {
  name: string;
}

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (supp: Supplement) => Promise<void>;
  colorIndex: number;
  initialData?: Supplement;
}

interface TimelineItem {
  supplementId: string;
  name: string;
  dosage: string;
  time: string;
  color: string;
}

interface TimeWheelProps {
  values: string[];
  selectedValue: string;
  inputValue: string;
  onSelect: (value: string) => void;
  onInputChange: (value: string) => void;
  onInputEnd: () => void;
}

function TimeWheel({ values, selectedValue, inputValue, onSelect, onInputChange, onInputEnd }: TimeWheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [editing, setEditing] = useState(false);
  const scrollingRef = useRef(false);
  const selectedRef = useRef(selectedValue);
  const wheelValues = useMemo(
    () => Array.from({ length: WHEEL_REPEAT }, () => values).flat(),
    [values],
  );

  useEffect(() => {
    selectedRef.current = selectedValue;
  }, [selectedValue]);

  const scrollToCenteredValue = (value: string, animated: boolean) => {
    const selectedIndex = Math.max(values.indexOf(value), 0);
    const targetIndex = WHEEL_MIDDLE_REPEAT * values.length + selectedIndex;
    scrollRef.current?.scrollTo({ y: targetIndex * WHEEL_ITEM_INTERVAL, animated });
  };

  useEffect(() => {
    if (editing || scrollingRef.current) return undefined;
    const timer = setTimeout(() => scrollToCenteredValue(selectedValue, false), 0);
    return () => clearTimeout(timer);
  }, [selectedValue, editing]);

  const valueFromOffset = (offsetY: number) => {
    const rawIndex = Math.round(offsetY / WHEEL_ITEM_INTERVAL);
    const valueIndex = ((rawIndex % values.length) + values.length) % values.length;
    return values[valueIndex];
  };

  const handleScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (editing) return;
    const nextValue = valueFromOffset(event.nativeEvent.contentOffset.y);
    if (nextValue !== selectedRef.current) {
      selectedRef.current = nextValue;
      onSelect(nextValue);
    }
  };

  const handleBegin = () => {
    scrollingRef.current = true;
  };

  const handleEnd = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    if (editing) return;
    const nextValue = valueFromOffset(event.nativeEvent.contentOffset.y);
    selectedRef.current = nextValue;
    onSelect(nextValue);
    scrollingRef.current = false;
    requestAnimationFrame(() => scrollToCenteredValue(nextValue, false));
  };

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const finishEditing = () => {
    onInputEnd();
    setEditing(false);
    requestAnimationFrame(() => scrollToCenteredValue(selectedRef.current, false));
  };

  return (
    <View style={m.timeWheelFrame}>
      <View pointerEvents="none" style={m.timeWheelCenterBand} />
      <ScrollView
        ref={scrollRef}
        style={m.timeWheel}
        contentContainerStyle={m.timeWheelContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={WHEEL_ITEM_INTERVAL}
        decelerationRate="fast"
        scrollEnabled={!editing}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBegin}
        onMomentumScrollBegin={handleBegin}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
      >
        {wheelValues.map((value, index) => (
          <View key={`${value}-${index}`} style={m.timeWheelItem}>
            <Text style={m.timeWheelText}>{value}</Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={m.timeWheelFadeTop} />
      <View pointerEvents="none" style={m.timeWheelFadeBottom} />
      {editing ? (
        <TextInput
          ref={inputRef}
          style={m.timeWheelInput}
          value={inputValue}
          onChangeText={onInputChange}
          onBlur={finishEditing}
          onSubmitEditing={finishEditing}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
      ) : (
        <TouchableOpacity activeOpacity={0.88} style={m.timeWheelCenterValue} onPress={startEditing}>
          <Text style={m.timeWheelCenterText}>{selectedValue}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function normalizeTime(time: string): string {
  return LEGACY_TIME_MAP[time] ?? time;
}

function sortTimes(times: string[]): string[] {
  return [...new Set(times.map(normalizeTime))].sort((a, b) => a.localeCompare(b));
}

function isValidTime(value: string): boolean {
  if (!TIME_PATTERN.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('supplements', {
        name: '\uC601\uC591\uC81C \uC54C\uB9BC',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('[supplement notification permission failed]', error);
    return false;
  }
}

export async function scheduleSupplementAlarms(
  suppName: string,
  dosage: string,
  times: string[],
): Promise<string[]> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return [];

  const scheduledIds: string[] = [];

  for (const time of sortTimes(times)) {
    const [hour, minute] = time.split(':').map(Number);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '\uD83D\uDC8A \uC601\uC591\uC81C \uBCF5\uC6A9 \uC2DC\uAC04\uC774\uC5D0\uC694!',
          body: `${suppName} ${dosage} \uBCF5\uC6A9\uD560 \uC2DC\uAC04\uC774\uC5D0\uC694.`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'supplements',
        },
      });
      scheduledIds.push(id);
    } catch (error) {
      console.warn('[supplement notification schedule failed]', time, error);
    }
  }

  console.log('[supplement notificationIds]', suppName, scheduledIds);
  return scheduledIds;
}

export async function cancelSupplementAlarms(notificationIds: string[] = []): Promise<void> {
  await Promise.all(
    notificationIds.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (error) {
        console.warn('[supplement notification cancel failed]', id, error);
      }
    }),
  );
}

function AddSupplementModal({ visible, onClose, onSave, colorIndex, initialData }: AddModalProps) {
  const isEdit = !!initialData;

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [hourInput, setHourInput] = useState('08');
  const [minuteInput, setMinuteInput] = useState('00');
  const [selectedTimes, setSelectedTimes] = useState<string[]>(['08:00']);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage);
      const initialTimes = sortTimes(initialData.times.length > 0 ? initialData.times : ['08:00']);
      const [hour, minute] = initialTimes[0].split(':');
      setSelectedTimes(initialTimes);
      setSelectedHour(hour);
      setSelectedMinute(minute);
      setHourInput(hour);
      setMinuteInput(minute);
      const parsed = initialData.nutrients
        ? initialData.nutrients.split(', ').filter(Boolean).map((n) => ({ name: n }))
        : [];
      setSelectedIngredients(parsed);
      setIngredientSearch('');
      setShowSearch(false);
    }

    if (visible && !initialData) {
      resetForm();
    }
  }, [visible, initialData]);

  const filteredIngredients = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    if (!query) return COMMON_INGREDIENTS;
    return COMMON_INGREDIENTS.filter((i) => i.name.toLowerCase().includes(query));
  }, [ingredientSearch]);

  const resetForm = () => {
    setName('');
    setDosage('');
    setSelectedHour('08');
    setSelectedMinute('00');
    setHourInput('08');
    setMinuteInput('00');
    setSelectedTimes(['08:00']);
    setIngredientSearch('');
    setSelectedIngredients([]);
    setShowSearch(false);
    setSaving(false);
  };

  const syncSelectedTime = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setHourInput(hour);
    setMinuteInput(minute);
  };

  const handleWheelInputChange = (unit: 'hour' | 'minute', value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    const max = unit === 'hour' ? 23 : 59;
    if (unit === 'hour') setHourInput(digits);
    else setMinuteInput(digits);

    if (digits.length === 2) {
      const num = Number(digits);
      if (num >= 0 && num <= max) {
        const normalized = String(num).padStart(2, '0');
        if (unit === 'hour') syncSelectedTime(normalized, selectedMinute);
        else syncSelectedTime(selectedHour, normalized);
      }
    }
  };

  const commitWheelInput = (unit: 'hour' | 'minute') => {
    const raw = unit === 'hour' ? hourInput : minuteInput;
    const max = unit === 'hour' ? 23 : 59;
    const num = Number(raw);
    if (!raw || Number.isNaN(num)) {
      if (unit === 'hour') setHourInput(selectedHour);
      else setMinuteInput(selectedMinute);
      return;
    }
    const normalized = String(Math.min(Math.max(num, 0), max)).padStart(2, '0');
    if (unit === 'hour') syncSelectedTime(normalized, selectedMinute);
    else syncSelectedTime(selectedHour, normalized);
  };

  const handleAddTime = () => {
    const value = `${selectedHour}:${selectedMinute}`;
    if (!isValidTime(value)) {
      Alert.alert('\uC2DC\uAC04 \uD615\uC2DD \uD655\uC778', '\uBCF5\uC6A9 \uC2DC\uAC04\uC740 HH:mm \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694. \uC608: 08:00');
      return;
    }
    if (selectedTimes.includes(value)) {
      Alert.alert('\uC911\uBCF5 \uC2DC\uAC04', '\uC774\uBBF8 \uCD94\uAC00\uB41C \uBCF5\uC6A9 \uC2DC\uAC04\uC785\uB2C8\uB2E4.');
      return;
    }
    setSelectedTimes((prev) => sortTimes([...prev, value]));
  };

  const removeTime = (time: string) => {
    setSelectedTimes((prev) => prev.filter((t) => t !== time));
  };

  const addIngredient = (ing: { name: string; defaultAmount: string }) => {
    if (selectedIngredients.some((i) => i.name === ing.name)) return;
    setSelectedIngredients((prev) => [...prev, { name: ing.name }]);
    setIngredientSearch('');
  };

  const removeIngredient = (ingredientName: string) => {
    setSelectedIngredients((prev) => prev.filter((i) => i.name !== ingredientName));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('\uC774\uB984 \uC785\uB825', '\uC601\uC591\uC81C \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.');
      return;
    }
    if (selectedTimes.length === 0) {
      Alert.alert('\uC2DC\uAC04 \uD615\uC2DD \uD655\uC778', '\uBCF5\uC6A9 \uC2DC\uAC04\uC740 HH:mm \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694. \uC608: 08:00');
      return;
    }

    setSaving(true);
    try {
      const finalDosage = dosage.trim() || '1\uC815';
      const nutrientsStr = selectedIngredients.map((i) => i.name).join(', ');
      const notificationIds = await scheduleSupplementAlarms(name.trim(), finalDosage, selectedTimes);

      await onSave({
        id: isEdit ? initialData!.id : String(Date.now()),
        name: name.trim(),
        dosage: finalDosage,
        times: sortTimes(selectedTimes),
        nutrients: nutrientsStr,
        color: isEdit ? initialData!.color : CARD_COLORS[colorIndex % CARD_COLORS.length],
        notificationIds,
      });

      resetForm();
      onClose();
    } catch {
      Alert.alert('\uC774\uB984 \uC785\uB825', '\uC601\uC591\uC81C \uC774\uB984\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={m.backdrop}>
        <KeyboardAwareScrollView
          style={m.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={20}
        >
          <Text style={m.title}>{isEdit ? '\uC601\uC591\uC81C \uC218\uC815' : '\uC601\uC591\uC81C \uCD94\uAC00'}</Text>

          <Text style={m.label}>{'\uC601\uC591\uC81C \uC774\uB984 *'}</Text>
          <TextInput
            style={m.input}
            placeholder={'\uC608: \uBE44\uD0C0\uBBFCC, \uC624\uBA54\uAC003, \uB9C8\uADF8\uB124\uC298'}
            placeholderTextColor={colors.textLight}
            value={name}
            onChangeText={setName}
          />

          <Text style={m.label}>{'\uBCF5\uC6A9\uB7C9'}</Text>
          <TextInput
            style={m.input}
            placeholder={'\uC608: 1\uC815, 2\uCEA1\uC290, 500mg'}
            placeholderTextColor={colors.textLight}
            value={dosage}
            onChangeText={setDosage}
          />

          <Text style={m.label}>{'\uBCF5\uC6A9 \uC2DC\uAC04 *'}</Text>
          {selectedTimes.length > 0 && (
            <View style={m.timeChipRow}>
              {sortTimes(selectedTimes).map((time) => (
                <View key={time} style={m.selectedTimeChip}>
                  <Text style={m.selectedTimeText}>{time}</Text>
                  <TouchableOpacity onPress={() => removeTime(time)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={m.selectedTimeRemove}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={m.timePickerBox}>
            <View style={m.timeWheelRow}>
              <TimeWheel
                values={HOURS}
                selectedValue={selectedHour}
                inputValue={hourInput}
                onSelect={(hour) => syncSelectedTime(hour, selectedMinute)}
                onInputChange={(value) => handleWheelInputChange('hour', value)}
                onInputEnd={() => commitWheelInput('hour')}
              />
              <Text style={m.timeColon}>:</Text>
              <TimeWheel
                values={MINUTES}
                selectedValue={selectedMinute}
                inputValue={minuteInput}
                onSelect={(minute) => syncSelectedTime(selectedHour, minute)}
                onInputChange={(value) => handleWheelInputChange('minute', value)}
                onInputEnd={() => commitWheelInput('minute')}
              />
            </View>
            <TouchableOpacity style={m.addTimeBtn} onPress={handleAddTime}>
              <Text style={m.addTimeText}>{'+ \uCD94\uAC00'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={m.label}>{'\uC601\uC591 \uC131\uBD84'}</Text>
          {selectedIngredients.length > 0 && (
            <View style={m.selectedList}>
              {selectedIngredients.map((ing) => (
                <View key={ing.name} style={m.selectedChip}>
                  <Text style={m.selectedChipName}>{ing.name}</Text>
                  <TouchableOpacity onPress={() => removeIngredient(ing.name)} style={m.chipRemove}>
                    <Text style={m.chipRemoveText}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={m.searchToggleBtn} onPress={() => setShowSearch((v) => !v)}>
            <Text style={m.searchToggleText}>{showSearch ? '\uC131\uBD84 \uAC80\uC0C9 \uB2EB\uAE30' : '+ \uC131\uBD84 \uAC80\uC0C9\uD574\uC11C \uCD94\uAC00'}</Text>
          </TouchableOpacity>

          {showSearch && (
            <View style={m.searchPanel}>
              <TextInput
                style={m.searchInput}
                placeholder={'\uC131\uBD84\uBA85 \uAC80\uC0C9'}
                placeholderTextColor={colors.textLight}
                value={ingredientSearch}
                onChangeText={setIngredientSearch}
                autoFocus
              />
              <ScrollView style={m.searchResults} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredIngredients.length === 0 ? (
                  <Text style={m.noResult}>{'\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC5B4\uC694.'}</Text>
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
                          <Text style={[m.resultName, already && { color: colors.textLight }]}>{ing.name}</Text>
                          <Text style={m.resultDefault}>{'\uAE30\uBCF8 \uD568\uB7C9: '}{ing.defaultAmount}</Text>
                        </View>
                        <Text style={m.resultAction}>{already ? '\uCD94\uAC00\uB428' : '+ \uCD94\uAC00'}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity style={[m.addBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.addBtnText}>{isEdit ? '\uC218\uC815\uD558\uAE30' : '\uCD94\uAC00\uD558\uAE30'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={m.cancelBtn} onPress={handleClose} disabled={saving}>
            <Text style={m.cancelText}>{'\uCDE8\uC18C'}</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

interface SupplementCardProps {
  supp: Supplement;
  onDelete: () => void;
  onEdit: () => void;
  takenTimes: string[];
  onToggle: (time: string) => void;
}

function SupplementCard({ supp, onDelete, onEdit, takenTimes, onToggle }: SupplementCardProps) {
  const times = sortTimes(supp.times);
  const allTaken = times.length > 0 && times.every((t) => takenTimes.includes(t));
  const takenCount = times.filter((t) => takenTimes.includes(t)).length;

  const confirmDelete = () => {
    Alert.alert('\uC0AD\uC81C \uD655\uC778', `\"${supp.name}\"\uC744(\uB97C) \uC0AD\uC81C\uD560\uAE4C\uC694?`, [
      { text: '\uCDE8\uC18C', style: 'cancel' },
      { text: '\uC0AD\uC81C', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={[c.card, { borderLeftColor: supp.color, borderLeftWidth: 4 }]}>
      <View style={c.cardHeader}>
        <View style={[c.dot, { backgroundColor: supp.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={c.name}>{supp.name}</Text>
          <Text style={c.dosage}>{supp.dosage}{' \u00B7 '}{times.join(', ')}</Text>
        </View>
        <View style={c.progress}>
          <Text style={[c.progressText, { color: allTaken ? '#2ECC71' : supp.color }]}>
            {allTaken ? '\uC644\uB8CC' : `${takenCount}/${times.length}`}
          </Text>
        </View>
        <TouchableOpacity onPress={onEdit} style={c.actionBtn}>
          <Text style={c.actionText}>{'\uC218\uC815'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={c.actionBtn}>
          <Text style={c.actionText}>{'\uC0AD\uC81C'}</Text>
        </TouchableOpacity>
      </View>

      <View style={c.timeRow}>
        {times.map((time) => {
          const taken = takenTimes.includes(time);
          return (
            <TouchableOpacity
              key={time}
              style={[c.timeChip, taken && { backgroundColor: supp.color + '22', borderColor: supp.color }]}
              onPress={() => onToggle(time)}
            >
              <Text style={[c.timeChipText, taken && { color: supp.color, fontWeight: '800' }]}>
                {time}{taken ? ' \uC644\uB8CC' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!!supp.nutrients && (
        <View style={c.nutriRow}>
          <Text style={c.nutriLabel}>{'\uC601\uC591 \uC131\uBD84'}</Text>
          <Text style={c.nutriText}>{supp.nutrients}</Text>
        </View>
      )}
    </View>
  );
}

function TodayTimeline({ items, getTakenTimes, onCompleteTime }: {
  items: TimelineItem[];
  getTakenTimes: (supplementId: string) => string[];
  onCompleteTime: (time: string, items: TimelineItem[]) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    items.forEach((item) => {
      const row = map.get(item.time) ?? [];
      row.push(item);
      map.set(item.time, row);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (grouped.length === 0) return null;

  return (
    <View style={t.box}>
      <Text style={t.title}>{'\uC624\uB298 \uBCF5\uC6A9 \uD0C0\uC784\uB77C\uC778'}</Text>
      {grouped.map(([time, row]) => {
        const done = row.every((item) => getTakenTimes(item.supplementId).includes(time));
        return (
          <TouchableOpacity key={time} style={t.row} onPress={() => onCompleteTime(time, row)}>
            <Text style={t.time}>{time}</Text>
            <View style={t.body}>
              {row.map((item) => (
                <Text key={`${item.supplementId}-${item.time}`} style={t.item} numberOfLines={1}>
                  {item.name} {item.dosage}
                </Text>
              ))}
            </View>
            <View style={[t.status, done && t.statusDone]}>
              <Text style={[t.statusText, done && t.statusTextDone]}>{done ? '\uC644\uB8CC' : '\uBCF5\uC6A9\uD558\uAE30'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SupplementScreen() {
  const insets = useSafeAreaInsets();
  const { supplements, addSupplement, removeSupplement, updateSupplement, getTodayTakenTimes, toggleSupplementTaken } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplement | undefined>(undefined);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    return supplements.flatMap((supp) =>
      sortTimes(supp.times).map((time) => ({
        supplementId: supp.id,
        name: supp.name,
        dosage: supp.dosage,
        time,
        color: supp.color,
      })),
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [supplements]);

  const handleOpenEdit = (supp: Supplement) => {
    setEditTarget(supp);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setEditTarget(undefined);
  };

  const handleSave = async (supp: Supplement) => {
    if (editTarget) {
      await cancelSupplementAlarms(editTarget.notificationIds ?? []);
      updateSupplement(supp);
    } else {
      addSupplement(supp);
    }
  };

  const handleDelete = async (supp: Supplement) => {
    await cancelSupplementAlarms(supp.notificationIds ?? []);
    removeSupplement(supp.id);
  };

  const handleCompleteTime = (time: string, items: TimelineItem[]) => {
    items.forEach((item) => {
      if (!getTodayTakenTimes(item.supplementId).includes(time)) {
        toggleSupplementTaken(item.supplementId, time);
      }
    });
  };

  const totalDoses = timelineItems.length;
  const takenDoses = timelineItems.filter((item) => getTodayTakenTimes(item.supplementId).includes(item.time)).length;
  const allDone = totalDoses > 0 && takenDoses === totalDoses;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: spacing.xl + insets.top }]}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>{'\uC601\uC591\uC81C \uAD00\uB9AC'}</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={s.addBtnText}>{'+ \uCD94\uAC00'}</Text>
          </TouchableOpacity>
        </View>

        {supplements.length > 0 && (
          <View style={[s.summaryBox, allDone && s.summaryBoxDone]}>
            <Text style={[s.summaryText, allDone && s.summaryTextDone]}>
              {allDone ? '\uC624\uB298 \uBCF5\uC6A9 \uC644\uB8CC!' : `\uC624\uB298 \uBCF5\uC6A9 \uD604\uD669: ${takenDoses} / ${totalDoses} \uC644\uB8CC`}
            </Text>
            {!allDone && totalDoses > 0 && (
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${(takenDoses / totalDoses) * 100}%` as any }]} />
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {supplements.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{'\uD83D\uDC8A'}</Text>
            <Text style={s.emptyTitle}>{'\uB4F1\uB85D\uB41C \uC601\uC591\uC81C\uAC00 \uC5C6\uC5B4\uC694'}</Text>
            <Text style={s.emptySub}>{'\uBCF5\uC6A9 \uC2DC\uAC04\uC744 \uC9C1\uC811 \uCD94\uAC00\uD558\uACE0 \uB9E4\uC77C \uC54C\uB9BC\uC744 \uBC1B\uC544\uBCF4\uC138\uC694.'}</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={s.emptyBtnText}>{'\uC601\uC591\uC81C \uCD94\uAC00\uD558\uAE30'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TodayTimeline
              items={timelineItems}
              getTakenTimes={getTodayTakenTimes}
              onCompleteTime={handleCompleteTime}
            />
            {supplements.map((supp) => (
              <SupplementCard
                key={supp.id}
                supp={{ ...supp, times: sortTimes(supp.times) }}
                onDelete={() => handleDelete(supp)}
                onEdit={() => handleOpenEdit(supp)}
                takenTimes={getTodayTakenTimes(supp.id)}
                onToggle={(time) => toggleSupplementTaken(supp.id, time)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <AddSupplementModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSave={handleSave}
        colorIndex={supplements.length}
        initialData={editTarget}
      />
    </View>
  );
}


// ── 모달 스타일 ──
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
  timeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  selectedTimeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '18', borderRadius: borderRadius.full,
    borderWidth: 1.5, borderColor: colors.primary,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
  },
  selectedTimeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  selectedTimeRemove: { fontSize: 12, color: colors.primary, fontWeight: '800', paddingHorizontal: 2 },
  timePickerBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  timeWheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  timeColon: { fontSize: 24, fontWeight: '800', color: colors.text },
  addTimeBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.sm,
    padding: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
  addTimeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  timeWheelFrame: {
    width: 64, height: 120, overflow: 'hidden',
    borderRadius: borderRadius.sm, position: 'relative',
  },
  timeWheelCenterBand: {
    position: 'absolute', top: '33%', left: 0, right: 0,
    height: '34%', backgroundColor: colors.primary + '15',
    borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.primary + '60',
    zIndex: 1,
  },
  timeWheel: { flex: 1 },
  timeWheelContent: { paddingVertical: 40 },
  timeWheelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  timeWheelText: { fontSize: 16, fontWeight: '600', color: colors.text },
  timeWheelFadeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 2,
  },
  timeWheelFadeBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 2,
  },
  timeWheelInput: {
    position: 'absolute', top: '33%', left: 0, right: 0, height: '34%',
    textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.primary,
    zIndex: 3, backgroundColor: 'transparent',
  },
  timeWheelCenterValue: {
    position: 'absolute', top: '33%', left: 0, right: 0, height: '34%',
    justifyContent: 'center', alignItems: 'center', zIndex: 3,
  },
  timeWheelCenterText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  selectedList: {
    marginBottom: spacing.xs, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08', padding: spacing.sm, gap: spacing.xs,
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
  searchToggleBtn: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs,
    backgroundColor: colors.primary + '10',
  },
  searchToggleText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  searchPanel: {
    marginTop: spacing.sm, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: '#fff',
  },
  searchInput: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    padding: spacing.md, fontSize: 14, color: colors.text, backgroundColor: colors.background,
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
  addBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.md,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: spacing.md, marginBottom: spacing.lg },
  cancelText: { color: colors.textLight, fontSize: 14 },
});

// ── 카드 스타일 ──
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
  actionBtn: { padding: spacing.xs },
  actionText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  timeChip: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  timeChipText: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  nutriRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    padding: spacing.sm, marginTop: spacing.xs,
  },
  nutriLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  nutriText: { fontSize: 12, color: colors.textLight, flex: 1, lineHeight: 18 },
});

// ── 타임라인 스타일 ──
const t = StyleSheet.create({
  box: {
    backgroundColor: '#fff', borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50',
    gap: spacing.sm,
  },
  time: { fontSize: 15, fontWeight: '800', color: colors.primary, width: 48 },
  body: { flex: 1 },
  item: { fontSize: 13, color: colors.text, fontWeight: '600' },
  status: {
    paddingVertical: 4, paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  statusDone: { backgroundColor: '#2ECC7120', borderColor: '#2ECC71' },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.textLight },
  statusTextDone: { color: '#27AE60' },
});

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
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
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