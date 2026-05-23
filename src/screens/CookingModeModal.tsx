import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../utils/theme';

const VOICE_NEXT = ['다음', '넥스트', '다음 단계', '앞으로'];
const VOICE_PREV = ['이전', '뒤로', '이전 단계', '돌아가'];
const VOICE_FIRST = ['처음', '처음으로', '첫 번째'];
const VOICE_EXIT = ['종료', '그만', '닫기', '끝'];

interface CookingModeProps {
  visible: boolean;
  title: string;
  steps: string[];
  onClose: () => void;
}

function CookingModeModal({ visible, title, steps, onClose }: CookingModeProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [ExpoSpeech, setExpoSpeech] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const totalSteps = steps.length;

  // 최신 값을 항상 참조하기 위한 refs (stale closure 방지)
  const currentStepRef = useRef(currentStep);
  const isListeningRef = useRef(isListening);
  const subscriptionsRef = useRef<any[]>([]);
  const ExpoSpeechRef = useRef<any>(null);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { ExpoSpeechRef.current = ExpoSpeech; }, [ExpoSpeech]);

  // expo-speech-recognition 동적 import
  useEffect(() => {
    try {
      const mod = require('expo-speech-recognition');
      setExpoSpeech(mod);
    } catch {
      setExpoSpeech(null);
    }
  }, []);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setTranscript('');
      setVoiceError('');
    } else {
      stopListening();
    }
  }, [visible]);

  const animateSlide = (direction: 'left' | 'right') => {
    const toValue = direction === 'left' ? -30 : 30;
    Animated.sequence([
      Animated.timing(slideAnim, { toValue, duration: 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  // ref를 통해 항상 최신 currentStep 참조
  const goNext = useCallback(() => {
    const cur = currentStepRef.current;
    if (cur < totalSteps - 1) {
      animateSlide('left');
      setCurrentStep(cur + 1);
    }
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    const cur = currentStepRef.current;
    if (cur > 0) {
      animateSlide('right');
      setCurrentStep(cur - 1);
    }
  }, []);

  const goFirst = useCallback(() => {
    animateSlide('right');
    setCurrentStep(0);
  }, []);

  // 음성 명령 처리
  const handleVoiceResult = useCallback((text: string) => {
    setTranscript(text);
    const lower = text.toLowerCase();
    if (VOICE_NEXT.some((k) => lower.includes(k))) goNext();
    else if (VOICE_PREV.some((k) => lower.includes(k))) goPrev();
    else if (VOICE_FIRST.some((k) => lower.includes(k))) goFirst();
    else if (VOICE_EXIT.some((k) => lower.includes(k))) {
      stopListening();
      onClose();
    }
    setTimeout(() => setTranscript(''), 1500);
  }, [goNext, goPrev, goFirst, onClose]);

  const handleVoiceResultRef = useRef(handleVoiceResult);
  useEffect(() => { handleVoiceResultRef.current = handleVoiceResult; }, [handleVoiceResult]);

  const stopListening = useCallback(() => {
    // 구독 해제
    subscriptionsRef.current.forEach((sub) => {
      try { sub?.remove?.(); } catch { /* ignore */ }
    });
    subscriptionsRef.current = [];

    const speech = ExpoSpeechRef.current;
    if (speech && isListeningRef.current) {
      try { speech.ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, []);

  const startListening = async () => {
    if (!ExpoSpeech) {
      setVoiceError('expo-speech-recognition 설치가 필요해요.');
      return;
    }
    try {
      const { ExpoSpeechRecognitionModule } = ExpoSpeech;

      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        setVoiceError('마이크 권한이 필요해요.');
        return;
      }

      // 결과 이벤트 리스너
      const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const text = event?.results?.[0]?.transcript ?? '';
        if (text) handleVoiceResultRef.current(text);
      });

      // 인식 종료 시 자동 재시작 (연속 인식)
      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        if (isListeningRef.current) {
          try {
            ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', continuous: false, interimResults: false });
          } catch { /* ignore */ }
        }
      });

      subscriptionsRef.current = [resultSub, endSub];
      ExpoSpeechRecognitionModule.start({ lang: 'ko-KR', continuous: false, interimResults: false });
      setIsListening(true);
      setVoiceError('');
    } catch {
      setVoiceError('마이크 권한이 필요해요.');
    }
  };

  const toggleListening = () => {
    isListening ? stopListening() : startListening();
  };

  // 스와이프 제스처 — ref 콜백으로 stale closure 방지
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) goNextRef.current();
        else if (g.dx > 40) goPrevRef.current();
      },
    })
  ).current;

  const progressColor = (i: number) =>
    i <= currentStep ? colors.primary : colors.border;

  if (!visible) return null;

  const isLast = currentStep === totalSteps - 1;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[cStyles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* 헤더 */}
        <View style={cStyles.header}>
          <TouchableOpacity onPress={onClose} style={cStyles.closeBtn}>
            <Text style={cStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={cStyles.headerTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={goFirst} style={cStyles.firstBtn}>
            <Text style={cStyles.firstTxt}>처음으로</Text>
          </TouchableOpacity>
        </View>

        {/* 진행 도트 */}
        <View style={cStyles.dotsRow}>
          {steps.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setCurrentStep(i)}>
              <View style={[cStyles.dot, { backgroundColor: progressColor(i) }]} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={cStyles.stepCount}>{currentStep + 1} / {totalSteps}</Text>

        {/* 스텝 카드 */}
        <Animated.View
          style={[cStyles.cardWrap, { transform: [{ translateX: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={cStyles.stepCard}>
            <View style={cStyles.stepNumBadge}>
              <Text style={cStyles.stepNumTxt}>{currentStep + 1}</Text>
            </View>
            <Text style={cStyles.stepBodyTxt}>{steps[currentStep]}</Text>
          </View>
          <Text style={cStyles.swipeHint}>← 스와이프로 이동 →</Text>
        </Animated.View>

        {/* 음성 인식 상태 */}
        {(transcript || voiceError) ? (
          <View style={[cStyles.transcriptBox, voiceError ? cStyles.transcriptErr : null]}>
            <Text style={cStyles.transcriptTxt}>
              {voiceError || `🎤 "${transcript}"`}
            </Text>
          </View>
        ) : isListening ? (
          <View style={cStyles.transcriptBox}>
            <Text style={cStyles.listeningTxt}>🎤 듣고 있어요... "다음", "이전", "종료"</Text>
          </View>
        ) : null}

        {/* 하단 컨트롤 */}
        <View style={cStyles.controls}>
          <TouchableOpacity
            style={[cStyles.navBtn, currentStep === 0 && cStyles.navBtnDisabled]}
            onPress={goPrev}
            disabled={currentStep === 0}
          >
            <Text style={[cStyles.navTxt, currentStep === 0 && cStyles.navTxtDisabled]}>◀ 이전</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cStyles.micBtn, isListening && cStyles.micBtnActive]}
            onPress={toggleListening}
          >
            <Text style={cStyles.micIcon}>{isListening ? '🔴' : '🎤'}</Text>
            <Text style={[cStyles.micLabel, isListening && cStyles.micLabelActive]}>
              {isListening ? '인식 중' : '음성 인식'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cStyles.navBtn, isLast && cStyles.navBtnDone]}
            onPress={isLast ? onClose : goNext}
          >
            <Text style={[cStyles.navTxt, isLast && cStyles.navTxtDone]}>
              {isLast ? '완료 ✓' : '다음 ▶'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeBtn: { padding: spacing.xs },
  closeTxt: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#fff', marginHorizontal: spacing.sm },
  firstBtn: { padding: spacing.xs },
  firstTxt: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, margin: 2 },
  stepCount: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6, marginBottom: spacing.md },
  cardWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  stepCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: spacing.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  stepNumBadge: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  stepNumTxt: { fontSize: 24, fontWeight: '900', color: '#fff' },
  stepBodyTxt: { fontSize: 20, fontWeight: '500', color: '#fff', lineHeight: 32, textAlign: 'center' },
  swipeHint: { marginTop: spacing.md, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  transcriptBox: {
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: borderRadius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  transcriptErr: { backgroundColor: 'rgba(255,80,80,0.15)' },
  transcriptTxt: { fontSize: 13, color: '#fff', textAlign: 'center' },
  listeningTxt: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  controls: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  navBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnDone: { backgroundColor: colors.primary },
  navTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  navTxtDisabled: { color: 'rgba(255,255,255,0.4)' },
  navTxtDone: { color: '#fff' },
  micBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', minWidth: 72,
  },
  micBtnActive: { backgroundColor: 'rgba(255,60,60,0.3)', borderColor: '#ff4444' },
  micIcon: { fontSize: 22 },
  micLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  micLabelActive: { color: '#ff8888' },
});

export { CookingModeModal };
