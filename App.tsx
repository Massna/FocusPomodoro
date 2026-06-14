import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  Easing,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBlockingActive, isServiceEnabled, getInstalledApps, requestAccessibilityPermission } from 'focus-accessibility';

const STUDY_MINUTES = 25;
const BREAK_MINUTES = 5;
const SETTINGS_KEY = '@focuspomodoro_settings';
const FIRST_RUN_KEY = '@focuspomodoro_first_run';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface AppInfo {
  packageName: string;
  appName: string;
}

interface Settings {
  blockedApps: string[];
  oneTimePassword: string | null;
  oneTimeEnabled: boolean;
  oneTimeDurationMinutes: number;
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const isTablet = width > 600;
  const scale = isTablet ? 1.25 : 1;

  const [mode, setMode] = useState<'study' | 'break' | 'idle'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(STUDY_MINUTES * 60);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [serviceEnabled, setServiceEnabled] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<'main' | 'settings' | 'onboarding'>('main');
  const [installedApps, setInstalledApps] = useState<AppInfo[]>([]);
  const [settings, setSettings] = useState<Settings>({ blockedApps: [], oneTimePassword: null, oneTimeEnabled: false, oneTimeDurationMinutes: 5 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [durationInput, setDurationInput] = useState('5');
  const [tempPassword, setTempPassword] = useState('');
  const [tempDuration, setTempDuration] = useState('');
  const [showTempUnlock, setShowTempUnlock] = useState(false);
  const [overlayPassword, setOverlayPassword] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentDuration = mode === 'break' ? BREAK_MINUTES * 60 : STUDY_MINUTES * 60;

  useEffect(() => {
    let mounted = true;
    async function init() {
      const firstRun = await AsyncStorage.getItem(FIRST_RUN_KEY);
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      const parsed: Settings = savedSettings ? JSON.parse(savedSettings) : { blockedApps: [], oneTimePassword: null, oneTimeEnabled: false, oneTimeDurationMinutes: 5 };
      if (mounted) {
        setSettings(parsed);
        if (!firstRun) {
          setScreen('onboarding');
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    async function checkService() {
      try {
        const enabled = await isServiceEnabled();
        setServiceEnabled(enabled);
      } catch (e) { console.error(e); }
    }
    checkService();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkService();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'main') { setScreen('main'); return true; }
      return false;
    });
    return () => handler.remove();
  }, [screen]);

  useEffect(() => {
    if (!active || paused) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { finishMode(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [active, paused, mode]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1 - secondsLeft / currentDuration,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [secondsLeft, currentDuration]);

  useEffect(() => {
    if (mode === 'study' && active && !paused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode, active, paused]);

  async function saveSettings(s: Settings) {
    setSettings(s);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  async function loadInstalledApps() {
    try {
      const apps = await getInstalledApps();
      setInstalledApps(apps);
    } catch (e) { console.error(e); }
  }

  async function openAccessibilitySettings() {
    try {
      await requestAccessibilityPermission();
    } catch (e) { console.error(e); }
  }

  function startStudy() {
    setMode('study');
    setSecondsLeft(STUDY_MINUTES * 60);
    setActive(true);
    setPaused(false);
    setBlocking(true);
  }

  function startBreak() {
    setMode('break');
    setSecondsLeft(BREAK_MINUTES * 60);
    setActive(true);
    setPaused(false);
    setBlocking(false);
  }

  function finishMode() {
    setActive(false);
    setPaused(false);
    setBlocking(false);
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
    setPaused(false);
    setBlocking(false);
    setMode('idle');
    setSecondsLeft(STUDY_MINUTES * 60);
  }

  function togglePause() {
    if (paused) {
      setPaused(false);
      if (mode === 'study') setBlocking(true);
    } else {
      setPaused(true);
      setBlocking(false);
    }
  }

  async function setBlocking(enabled: boolean) {
    try {
      await setBlockingActive(enabled);
    } catch (e) { console.error('Failed to toggle blocker', e); }
  }

  function openSettings() {
    loadInstalledApps();
    setScreen('settings');
  }

  const mainColor = mode === 'study' ? '#38BDF8' : mode === 'break' ? '#34D399' : '#818CF8';

  const filteredApps = installedApps.filter(a => a.appName.toLowerCase().includes(searchQuery.toLowerCase()) || a.packageName.toLowerCase().includes(searchQuery.toLowerCase()));

  if (screen === 'onboarding') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={[styles.inner, { paddingHorizontal: 24 * scale }]}>
          <View style={[styles.progressRing, { width: 160 * scale, height: 160 * scale, borderRadius: 80 * scale, borderWidth: 6, backgroundColor: '#1E293B', borderColor: '#38BDF8' }]}>
            <Text style={[styles.timer, { fontSize: 36 * scale, color: '#38BDF8' }]}>F</Text>
          </View>
          <Text style={[styles.title, { fontSize: 30 * scale, marginTop: 28 }]}>Focus Pomodoro</Text>
          <Text style={[styles.subtitle, { fontSize: 15 * scale, marginTop: 10, textAlign: 'center', lineHeight: 22 * scale }]}>
            Para bloquear apps durante o foco, o Focus Pomodoro precisa de acesso ao serviço de acessibilidade do Android.
          </Text>
          <View style={{ width: '100%', marginTop: 36, gap: 14 }}>
            <Pressable
              onPress={async () => { await AsyncStorage.setItem(FIRST_RUN_KEY, 'false'); await openAccessibilitySettings(); setScreen('main'); }}
              style={({ pressed }) => [styles.btn, styles.primaryBtn, { backgroundColor: '#38BDF8' }, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.btnText}>Permitir Acessibilidade</Text>
            </Pressable>
            <Pressable
              onPress={async () => { await AsyncStorage.setItem(FIRST_RUN_KEY, 'false'); setScreen('main'); }}
              style={({ pressed }) => [styles.btn, styles.secondaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.btnText, { color: '#94A3B8' }]}>Pular por enquanto</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'settings') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={[styles.header, { paddingHorizontal: 20 * scale }]}>
          <TouchableOpacity onPress={() => setScreen('main')}>
            <Text style={{ color: '#94A3B8', fontSize: 16 * scale }}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { fontSize: 20 * scale }]}>Configurações</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 * scale, paddingBottom: 40 }}>
          <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>BLOQUEIO DE APPS</Text>
          <Text style={[styles.subtitle, { fontSize: 13 * scale, marginBottom: 10 }]}>Selecione quais apps são bloqueados no modo foco:</Text>
          <TextInput
            style={[styles.searchInput, { fontSize: 14 * scale }]}
            placeholder="Buscar app..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={{ maxHeight: 320 * scale, backgroundColor: '#1E293B', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
            <ScrollView>
              {filteredApps.map(app => (
                <View key={app.packageName} style={[styles.appRow, { paddingVertical: 10 * scale, paddingHorizontal: 14 * scale }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F8FAFC', fontSize: 14 * scale }}>{app.appName}</Text>
                    <Text style={{ color: '#64748B', fontSize: 11 * scale }}>{app.packageName}</Text>
                  </View>
                  <Switch
                    value={settings.blockedApps.includes(app.packageName)}
                    onValueChange={(val) => {
                      const next = val ? [...settings.blockedApps, app.packageName] : settings.blockedApps.filter(p => p !== app.packageName);
                      saveSettings({ ...settings, blockedApps: next });
                    }}
                    thumbColor={settings.blockedApps.includes(app.packageName) ? '#38BDF8' : '#475569'}
                    trackColor={{ false: '#334155', true: '#1E3A5F' }}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          <Text style={[styles.sectionTitle, { fontSize: 14 * scale, marginTop: 28 }]}>ACESSIBILIDADE</Text>
          <Pressable
            onPress={openAccessibilitySettings}
            style={({ pressed }) => [styles.btn, styles.secondaryBtn, pressed && { opacity: 0.85 }, { marginTop: 8 }]}
          >
            <Text style={[styles.btnText, { color: '#F8FAFC' }]}>Abrir Configurações de Acessibilidade</Text>
          </Pressable>
          <Text style={[styles.subtitle, { fontSize: 12 * scale, marginTop: 6 }]}>Status: {serviceEnabled === true ? 'Ativo' : 'Desativado'}</Text>

          <Text style={[styles.sectionTitle, { fontSize: 14 * scale, marginTop: 28 }]}>DESBLOQUEIO POR SENHA</Text>
          <View style={[styles.appRow, { marginTop: 8, padding: 12 * scale, backgroundColor: '#1E293B', borderRadius: 12 }]}>
            <Text style={{ color: '#F8FAFC', fontSize: 14 * scale, flex: 1 }}>Habilitar senha de uso único</Text>
            <Switch
              value={settings.oneTimeEnabled}
              onValueChange={(val) => {
                if (val) setShowPasswordSetup(true);
                else saveSettings({ ...settings, oneTimeEnabled: false, oneTimePassword: null });
              }}
              thumbColor={settings.oneTimeEnabled ? '#38BDF8' : '#475569'}
              trackColor={{ false: '#334155', true: '#1E3A5F' }}
            />
          </View>
          {settings.oneTimeEnabled && settings.oneTimePassword && (
            <Text style={{ color: '#94A3B8', fontSize: 12 * scale, marginTop: 6 }}>Senha definida: {settings.oneTimePassword} • Duração: {settings.oneTimeDurationMinutes} min</Text>
          )}
        </ScrollView>

        <Modal transparent visible={showPasswordSetup} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { padding: 24 * scale }]}>
              <Text style={[styles.title, { fontSize: 20 * scale, marginBottom: 12 }]}>Definir Senha</Text>
              <Text style={[styles.subtitle, { fontSize: 13 * scale, marginBottom: 14 }]}>Crie uma senha numérica de uso único para desbloquear apps bloqueados temporariamente.</Text>
              <TextInput
                style={[styles.searchInput, { fontSize: 16 * scale, textAlign: 'center' }]}
                placeholder="Senha (ex: 1234)"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={6}
                value={passwordInput}
                onChangeText={setPasswordInput}
              />
              <TextInput
                style={[styles.searchInput, { fontSize: 16 * scale, textAlign: 'center', marginTop: 12 }]}
                placeholder="Duração do desbloqueio (min)"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                value={durationInput}
                onChangeText={setDurationInput}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <Pressable
                  onPress={() => setShowPasswordSetup(false)}
                  style={({ pressed }) => [styles.btn, styles.secondaryBtn, { flex: 1 }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.btnText, { color: '#94A3B8' }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const pwd = passwordInput.trim();
                    const dur = parseInt(durationInput, 10);
                    if (pwd && !isNaN(dur) && dur > 0) {
                      saveSettings({ ...settings, oneTimeEnabled: true, oneTimePassword: pwd, oneTimeDurationMinutes: dur });
                      setShowPasswordSetup(false);
                    }
                  }}
                  style={({ pressed }) => [styles.btn, styles.primaryBtn, { flex: 1, backgroundColor: '#38BDF8' }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.btnText}>Salvar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={[styles.inner, { paddingHorizontal: 28 * scale }]}>
        <View style={[styles.header, { marginBottom: 10 * scale }]}>
          <Text style={[styles.title, { fontSize: isTablet ? 40 : 32 }]}>Focus Pomodoro</Text>
          <TouchableOpacity onPress={openSettings}>
            <Text style={{ color: '#94A3B8', fontSize: 22 * scale }}>⚙</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.subtitle, { fontSize: isTablet ? 18 : 14, marginTop: 4 }]}>
          {mode === 'idle' ? 'Pronto para focar?' : mode === 'study' ? paused ? 'Foco pausado' : 'Modo Foco' : 'Pausa curta'}
        </Text>

        <View style={[styles.ringWrapper, { marginBottom: isTablet ? 60 : 30 }]}>
          <Animated.View style={[styles.progressRing, {
            width: isTablet ? 300 : 240,
            height: isTablet ? 300 : 240,
            borderRadius: isTablet ? 150 : 120,
            borderWidth: 8 * scale,
            borderColor: mainColor,
            transform: [{ scale: pulseAnim }]
          }]}>
            <Text style={[styles.timer, { fontSize: isTablet ? 64 : 52, color: mainColor }]}>{formatTime(secondsLeft)}</Text>
          </Animated.View>
          <View style={[styles.progressBarBg, { width: isTablet ? 300 : 240, marginTop: 28 * scale }]}>
            <Animated.View style={[styles.progressBarFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: mainColor
            }]} />
          </View>
        </View>

        {serviceEnabled === false && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Ative o serviço de acessibilidade nas configurações para bloquear apps durante o foco.
            </Text>
            <Pressable onPress={openAccessibilitySettings} style={{ marginTop: 10 }}>
              <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '700' }}>Abrir Configurações →</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.buttons, { gap: 14 * scale }]}>
          {!active ? (
            <>
              <Pressable
                onPress={startStudy}
                style={({ pressed }) => [styles.btn, styles.primaryBtn, { backgroundColor: mainColor, paddingVertical: 18 * scale }, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.btnText, { fontSize: 17 * scale }]}>Iniciar Foco</Text>
              </Pressable>
              {mode === 'break' && (
                <Pressable
                  onPress={startBreak}
                  style={({ pressed }) => [styles.btn, styles.secondaryBtn, { paddingVertical: 18 * scale }, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[styles.btnText, { color: '#34D399', fontSize: 17 * scale }]}>Iniciar Pausa</Text>
                </Pressable>
              )}
            </>
          ) : (
            <View style={{ width: '100%', gap: 12 * scale }}>
              <Pressable
                onPress={togglePause}
                style={({ pressed }) => [styles.btn, styles.secondaryBtn, { paddingVertical: 16 * scale }, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.btnText, { color: paused ? '#34D399' : '#FCD34D', fontSize: 17 * scale }]}>
                  {paused ? 'Continuar' : 'Pausar'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleStop}
                style={({ pressed }) => [styles.btn, styles.secondaryBtn, { paddingVertical: 16 * scale }, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.btnText, { color: '#F87171', fontSize: 17 * scale }]}>Parar</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={[styles.footer, { marginTop: 28 * scale, fontSize: isTablet ? 15 : 13 }]}>25 min foco → 5 min pausa</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  title: { fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
  subtitle: { color: '#94A3B8', marginBottom: 36 },
  ringWrapper: { alignItems: 'center' },
  progressRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  timer: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3 },
  warningBox: { backgroundColor: '#332A1A', borderRadius: 12, padding: 14, marginBottom: 24, width: '100%' },
  warningText: { color: '#FCD34D', fontSize: 13, textAlign: 'center' },
  buttons: { width: '100%' },
  btn: { width: '100%', borderRadius: 16, alignItems: 'center' },
  primaryBtn: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  secondaryBtn: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  btnText: { fontWeight: '700', color: '#0F172A' },
  footer: { color: '#64748B' },
  sectionTitle: { color: '#64748B', fontWeight: '700', marginTop: 20, letterSpacing: 1 },
  appRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#334155' },
  searchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#1E293B', borderRadius: 16, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#334155' },
});
