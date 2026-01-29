import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  getRouteTypeDisplayName,
  processPhotoCapture,
  ProcessingProgress,
} from '@/lib/captureProcessor';
import { addHistoryItem, updateHistoryItem } from '@/lib/historyStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = 64;

interface CapturedPhoto {
  id: string;
  uri: string;
}

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);

  // Request media library permission on mount
  useEffect(() => {
    if (!mediaPermission?.granted) {
      requestMediaPermission();
    }
  }, [mediaPermission, requestMediaPermission]);

  // Request permission if not granted
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={[styles.permissionContent, { paddingTop: insets.top }]}>
          <Ionicons name="camera" size={64} color={Colors.primary} />
          <Text style={styles.permissionTitle}>需要相机权限</Text>
          <Text style={styles.permissionText}>
            请允许 OneMind 访问相机以拍摄物品和收据
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>授予权限</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const triggerFlashAnimation = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      if (photo) {
        triggerFlashAnimation();

        const newPhoto: CapturedPhoto = {
          id: Date.now().toString(),
          uri: photo.uri,
        };

        setPhotos((prev) => [...prev, newPhoto]);
        console.log('Photo taken:', newPhoto.uri);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('拍照失败', '请重试');
    } finally {
      setIsCapturing(false);
    }
  };

  const removePhoto = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('提示', '请至少拍摄一张照片');
      return;
    }

    // Check media library permission
    if (!mediaPermission?.granted) {
      const { granted } = await requestMediaPermission();
      if (!granted) {
        Alert.alert(
          '需要相册权限',
          '请在设置中允许 OneMind 访问相册以保存照片'
        );
        return;
      }
    }

    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Save all photos to the media library
      let savedCount = 0;
      for (const photo of photos) {
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
          savedCount++;
          console.log('Saved photo to library:', photo.uri);
        } catch (error) {
          console.error('Failed to save photo:', error);
        }
      }
      
      if (savedCount > 0) {
        // Add to history first (local state)
        const historyItem = await addHistoryItem({
          type: 'photo',
          uri: photos[0].uri,
          photoCount: savedCount,
          processingStatus: 'processing',
        });
        
        // Start AI processing
        setProcessingProgress({ status: 'uploading', message: '正在上传照片...', progress: 10 });
        
        const photoUris = photos.map(p => p.uri);
        const processingResult = await processPhotoCapture(
          photoUris,
          (progress) => setProcessingProgress(progress)
        );
        
        // Update history item with AI results
        await updateHistoryItem(historyItem.id, {
          processingStatus: processingResult.success ? 'completed' : 'failed',
          aiResponse: processingResult.aiResponse || undefined,
          sessionId: processingResult.sessionId || undefined,
        });
        
        setIsSaving(false);
        setProcessingProgress(null);
        
        if (processingResult.success && processingResult.aiResponse) {
          const routeType = getRouteTypeDisplayName(processingResult.aiResponse.route_type);
          Alert.alert(
            'AI 分析完成',
            `已保存 ${savedCount} 张照片到相册\n\n识别为: ${routeType}\n${processingResult.aiResponse.summary}`,
            [{ text: '好的', onPress: () => router.back() }]
          );
        } else {
          Alert.alert(
            '保存成功',
            `已保存 ${savedCount} 张照片到相册\n\nAI 分析失败: ${processingResult.error || '未知错误'}`,
            [{ text: '好的', onPress: () => router.back() }]
          );
        }
      } else {
        setIsSaving(false);
        Alert.alert('保存失败', '无法保存照片到相册，请重试');
      }
    } catch (error) {
      console.error('Failed to save photos:', error);
      setIsSaving(false);
      setProcessingProgress(null);
      Alert.alert('保存失败', '无法保存照片到相册，请重试');
    }
  };

  const renderThumbnail = ({ item }: { item: CapturedPhoto }) => (
    <View style={styles.thumbnailContainer}>
      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removePhoto(item.id)}
      >
        <Ionicons name="close-circle" size={22} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Camera View - No children allowed */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* Flash overlay - Absolute positioned */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.flashOverlay,
          { opacity: flashAnim },
        ]}
        pointerEvents="none"
      />

      {/* Processing overlay */}
      {(isSaving || processingProgress) && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.processingText}>
              {processingProgress?.message || '正在保存...'}
            </Text>
            {processingProgress && (
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${processingProgress.progress}%` }
                  ]} 
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Top bar - Absolute positioned */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.photoCounter}>
          <Text style={styles.photoCounterText}>
            {photos.length} 张照片
          </Text>
        </View>

        <TouchableOpacity
          style={styles.topButton}
          onPress={toggleCameraFacing}
        >
          <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls - Absolute positioned */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
        {/* Thumbnail strip */}
        {photos.length > 0 && (
          <View style={styles.thumbnailStrip}>
            <FlatList
              data={photos}
              renderItem={renderThumbnail}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailList}
            />
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Cancel/Back button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => router.back()}
          >
            <Text style={styles.sideButtonText}>取消</Text>
          </TouchableOpacity>

          {/* Shutter button */}
          <Pressable
            onPress={takePicture}
            disabled={isCapturing}
            style={({ pressed }) => [
              styles.shutterButton,
              pressed && styles.shutterButtonPressed,
            ]}
          >
            <View style={styles.shutterButtonInner}>
              {isCapturing ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <View style={styles.shutterButtonCore} />
              )}
            </View>
          </Pressable>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.sideButton,
              styles.submitButton,
              photos.length === 0 && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={photos.length === 0 || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    photos.length === 0 && styles.submitButtonTextDisabled,
                  ]}
                >
                  保存
                </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  flashOverlay: {
    backgroundColor: '#FFFFFF',
  },

  // Processing overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  processingContent: {
    alignItems: 'center',
    padding: 24,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 22,
  },
  photoCounter: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  photoCounterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Bottom controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  thumbnailStrip: {
    marginBottom: 20,
  },
  thumbnailList: {
    paddingHorizontal: 16,
  },
  thumbnailContainer: {
    marginRight: 8,
    position: 'relative',
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  sideButton: {
    width: 70,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    opacity: 0.6,
  },

  // Shutter button
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  shutterButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000000',
  },
});
