import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordingResult {
  uri: string;
  duration: number; // in milliseconds
  fileSize: number; // in bytes
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  permissionStatus: Audio.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<Audio.PermissionStatus | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Audio.getPermissionsAsync();
      setPermissionStatus(status);
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status);
    return status === 'granted';
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Check permission
      if (permissionStatus !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          console.warn('Microphone permission not granted');
          return;
        }
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and prepare recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - startTimeRef.current);
      }, 100);

      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [permissionStatus, requestPermission]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    try {
      if (!recordingRef.current) {
        return null;
      }

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      setIsRecording(false);

      // Get recording status before stopping
      const status = await recordingRef.current.getStatusAsync();
      const duration = status.durationMillis || 0;

      // Stop and unload recording
      await recordingRef.current.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Get the recording URI
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        console.warn('No recording URI found');
        return null;
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      console.log('Recording stopped:', { uri, duration, fileSize });

      return {
        uri,
        duration,
        fileSize,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  }, []);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    permissionStatus,
    requestPermission,
  };
}

// Format duration for display (e.g., "0:05", "1:23")
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
