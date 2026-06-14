import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { setBlockingActive, isServiceEnabled } from 'focus-accessibility';

const STUDY_MINUTES = 25;
const BREAK_MINUTES = 5;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [mode, setMode] = useState<'study' | 'break' | 'idle'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(STUDY_MINUTES * 60);
  const [active, setActive] = useState(false);
  const [serviceEnabled, setServiceEnabled] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentDuration = mode === 'break' ? BREAK_MINUTES * 60 : STUDY_MINUTES * 60;

  useEffect(() => {
    let mounted = true;
    async function checkService() {
      try {
        const enabled = await isServiceEnabled();
        if (mounted) setServiceEnabled(enabled);
      } catch (e) {
        console.error(e);
      }
    }
    checkService();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        isServiceEnabled().then(setServiceEnabled).catch(console.error);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finishMode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, mode]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1 - secondsLeft / currentDuration,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [secondsLeft, currentDuration]);

  useEffect(() => {
    if (mode === 'study' && active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode, active]);

  async function toggleBlocking(enabled: boolean) {
    try {
      await setBlockingActive(enabled);
    } catch (e) {
      console.error('Failed to toggle blocker', e);
    }
  }

  function startStudy() {
    setMode('study');
    setSecondsLeft(STUDY_MINUTES * 60);
    setActive(true);
    toggleBlocking(true);
  }

  function startBreak() {
    setMode('break');
    setSecondsLeft(BREAK_MINUTES * 60);
    setActive(true);
    toggleBlocking(false);
  }

  function finishMode() {
    setActive(false);
    toggleBlocking(false);
    if (mode === 'study') {
      setMode('break');
      setSecondsLeft(BREAK_MINUTES * 60);
      setActive(true);
    } else {
      setMode('idle');
      setSecondsLeft(STUDY_MINUTES * 60);
    }
  }

  function handleStop() {
    setActive(false);
    toggleBlocking(false);
    setMode('idle');
    setSecondsLeft(STUDY_MINUTES * 60);
  }

  const mainColor = mode === 'study' ? '#38BDF8' : mode === 'break' ? '#34D399' : '#818CF8';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.inner}>
        <Text style={styles.title}>Focus Pomodoro</Text>
        <Text style={styles.subtitle}>{mode === 'idle' ? 'Pronto para focar?' : mode === 'study' ? 'Modo Foco' : 'Pausa curta'}</Text>

        <View style={styles.ringWrapper}>
          <Animated.View style={[styles.progressRing, { borderColor: mainColor, transform: [{ scale: pulseAnim }] }]}>
            <Text style={[styles.timer, { color: mainColor }]}>{formatTime(secondsLeft)}</Text>
          </Animated.View>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: mainColor }]} />
          </View>
        </View>

        {serviceEnabled === false && mode === 'idle' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Ative o serviço de acessibilidade "Focus Pomodoro" nas configurações para bloquear apps durante o foco.
            </Text>
          </View>
        )}

        <View style={styles.buttons}>
          {!active ? (
            <>
              <Pressable
                onPress={startStudy}
                style={({ pressed }) => [styles.btn, styles.primaryBtn, { backgroundColor: mainColor }, pressed && { opacity: 0.85 }]}>
                <Text style={styles.btnText}>Iniciar Foco</Text>
              </Pressable>
              {mode === 'break' && (
                <Pressable
                  onPress={startBreak}
                  style={({ pressed }) => [styles.btn, styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
                  <Text style={[styles.btnText, { color: '#34D399' }]}>Iniciar Pausa</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Pressable
              onPress={handleStop}
              style={({ pressed }) => [styles.btn, styles.secondaryBtn, pressed && { opacity: 0.85 }]}>
              <Text style={[styles.btnText, { color: '#F87171' }]}>Parar</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.footer}>25 min foco → 5 min pausa</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 34, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 8, marginBottom: 36 },
  ringWrapper: { alignItems: 'center', marginBottom: 40 },
  progressRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  timer: { fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressBarBg: {
    width: 240,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#334155',
    marginTop: 28,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  warningBox: { backgroundColor: '#332A1A', borderRadius: 12, padding: 14, marginBottom: 24 },
  warningText: { color: '#FCD34D', fontSize: 13, textAlign: 'center' },
  buttons: { width: '100%', gap: 14 },
  btn: { width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  primaryBtn: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  secondaryBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  btnText: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  footer: { marginTop: 28, color: '#64748B', fontSize: 13 },
});
