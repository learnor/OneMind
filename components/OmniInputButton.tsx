import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { Colors } from '@/constants/Colors';

const LONG_PRESS_THRESHOLD = 500; // ms
const BUTTON_SIZE = 72;
const RIPPLE_SIZE = 120;

interface OmniInputButtonProps {
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  isRecording?: boolean;
}

export function OmniInputButton({
  onStartRecording,
  onStopRecording,
  isRecording = false,
}: OmniInputButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [isPressed, setIsPressed] = useState(false);
  const pressStartTime = useRef<number>(0);
  const longPressTriggered = useRef<boolean>(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Multiple ripples for recording effect
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const rippleOpacity1 = useRef(new Animated.Value(0)).current;
  const rippleOpacity2 = useRef(new Animated.Value(0)).current;
  const rippleOpacity3 = useRef(new Animated.Value(0)).current;

  // Breathing animation when idle
  useEffect(() => {
    if (!isRecording) {
      const breatheAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.05,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      breatheAnimation.start();

      // Subtle glow animation
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimation.start();

      return () => {
        breatheAnimation.stop();
        glowAnimation.stop();
        breatheAnim.setValue(1);
        glowAnim.setValue(0);
      };
    }
  }, [isRecording, breatheAnim, glowAnim]);

  // Recording ripple animation
  useEffect(() => {
    if (isRecording) {
      const createRippleAnimation = (
        ripple: Animated.Value,
        opacity: Animated.Value,
        delay: number
      ) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(ripple, {
                toValue: 1,
                duration: 1500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.timing(opacity, {
                  toValue: 0.6,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                  toValue: 0,
                  duration: 1400,
                  useNativeDriver: true,
                }),
              ]),
            ]),
            Animated.timing(ripple, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const anim1 = createRippleAnimation(ripple1, rippleOpacity1, 0);
      const anim2 = createRippleAnimation(ripple2, rippleOpacity2, 500);
      const anim3 = createRippleAnimation(ripple3, rippleOpacity3, 1000);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        ripple1.setValue(0);
        ripple2.setValue(0);
        ripple3.setValue(0);
        rippleOpacity1.setValue(0);
        rippleOpacity2.setValue(0);
        rippleOpacity3.setValue(0);
      };
    }
  }, [isRecording, ripple1, ripple2, ripple3, rippleOpacity1, rippleOpacity2, rippleOpacity3]);

  const handlePressIn = useCallback(() => {
    setIsPressed(true);
    pressStartTime.current = Date.now();
    longPressTriggered.current = false;

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    setIsPressed(false);

    // Scale back animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();

    // If long press was triggered, don't handle as tap
    if (longPressTriggered.current) {
      return;
    }

    const pressDuration = Date.now() - pressStartTime.current;

    // Short tap -> Toggle voice recording
    if (pressDuration < LONG_PRESS_THRESHOLD) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isRecording) {
        onStopRecording?.();
      } else {
        onStartRecording?.();
      }
    }
  }, [scaleAnim, isRecording, onStartRecording, onStopRecording]);

  const handleLongPress = useCallback(() => {
    longPressTriggered.current = true;

    // Heavy haptic feedback for long press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // If recording, stop it first
    if (isRecording) {
      onStopRecording?.();
    }

    // Navigate to camera
    router.push('/camera');
  }, [router, isRecording, onStopRecording]);

  const createRippleScale = (anim: Animated.Value) =>
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2],
    });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.4],
  });

  return (
    <View style={styles.container}>
      {/* Hint text */}
      <Text style={[styles.hintText, { color: theme.textSecondary }]}>
        {isRecording ? '点击停止录音' : '点击录音 · 长按拍照'}
      </Text>

      {/* Button container */}
      <View style={styles.buttonWrapper}>
        {/* Idle glow effect */}
        {!isRecording && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                backgroundColor: Colors.primary,
                opacity: glowOpacity,
                transform: [{ scale: breatheAnim }],
              },
            ]}
          />
        )}

        {/* Recording ripples */}
        {isRecording && (
          <>
            <Animated.View
              style={[
                styles.ripple,
                {
                  backgroundColor: Colors.error,
                  opacity: rippleOpacity1,
                  transform: [{ scale: createRippleScale(ripple1) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  backgroundColor: Colors.error,
                  opacity: rippleOpacity2,
                  transform: [{ scale: createRippleScale(ripple2) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.ripple,
                {
                  backgroundColor: Colors.error,
                  opacity: rippleOpacity3,
                  transform: [{ scale: createRippleScale(ripple3) }],
                },
              ]}
            />
          </>
        )}

        {/* Main button */}
        <Animated.View
          style={{
            transform: [
              { scale: Animated.multiply(scaleAnim, isRecording ? new Animated.Value(1) : breatheAnim) },
            ],
          }}
        >
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={handleLongPress}
            delayLongPress={LONG_PRESS_THRESHOLD}
            style={[
              styles.button,
              {
                backgroundColor: isRecording ? Colors.error : Colors.primary,
                shadowColor: isRecording ? Colors.error : Colors.primary,
              },
              isPressed && styles.buttonPressed,
            ]}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={30}
              color="#FFFFFF"
            />
          </Pressable>
        </Animated.View>

        {/* Camera hint indicator */}
        {!isRecording && (
          <View style={styles.cameraHint}>
            <Ionicons name="camera" size={12} color={theme.textSecondary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '500',
  },
  buttonWrapper: {
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 16,
    height: BUTTON_SIZE + 16,
    borderRadius: (BUTTON_SIZE + 16) / 2,
  },
  ripple: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonPressed: {
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  cameraHint: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
