import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.ease,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colorScheme === 'dark' ? '#2a2a2a' : '#e8e8e8',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
            backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
          },
        ]}
      />
    </View>
  );
}

// Skeleton for stats card
export function StatsSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.statsContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <Skeleton width={40} height={40} borderRadius={12} style={{ marginBottom: 8 }} />
          <Skeleton width={50} height={20} />
          <Skeleton width={35} height={12} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

// Skeleton for list item
export function ListItemSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.listItem, { backgroundColor: theme.surface }]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={50} height={20} borderRadius={4} />
    </View>
  );
}

// Skeleton for finance section
export function FinanceSkeleton() {
  return (
    <View style={styles.section}>
      <StatsSkeleton />
      <View style={{ paddingHorizontal: 16 }}>
        <Skeleton width={100} height={16} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <ListItemSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

// Skeleton for todo section
export function TodoSkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.section}>
      <View style={{ paddingHorizontal: 16 }}>
        <Skeleton width={120} height={16} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.todoItem, { backgroundColor: theme.surface }]}>
            <Skeleton width={24} height={24} borderRadius={12} />
            <View style={styles.todoContent}>
              <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
              <View style={styles.todoMeta}>
                <Skeleton width={60} height={18} borderRadius={9} />
                <Skeleton width={40} height={14} style={{ marginLeft: 8 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Skeleton for inventory section
export function InventorySkeleton() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.section}>
      <View style={{ paddingHorizontal: 16 }}>
        {['常温', '冷藏', '冷冻'].map((zone) => (
          <View key={zone} style={[styles.inventoryGroup, { backgroundColor: theme.surface }]}>
            <View style={styles.inventoryHeader}>
              <Skeleton width={20} height={20} borderRadius={10} />
              <Skeleton width={80} height={16} style={{ marginLeft: 8 }} />
            </View>
            {[1, 2].map((i) => (
              <View key={i} style={styles.inventoryItem}>
                <View style={{ flex: 1 }}>
                  <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
                  <Skeleton width="30%" height={12} />
                </View>
                <View style={styles.inventoryQty}>
                  <Skeleton width={28} height={28} borderRadius={14} />
                  <Skeleton width={50} height={16} style={{ marginHorizontal: 8 }} />
                  <Skeleton width={28} height={28} borderRadius={14} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  section: {
    paddingTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  todoContent: {
    flex: 1,
    marginLeft: 12,
  },
  todoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inventoryGroup: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  inventoryQty: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
