import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';

const screenWidth = Dimensions.get('window').width;

// ============ Spending Trend Chart ============
interface TrendData {
  labels: string[];
  data: number[];
}

interface SpendingTrendChartProps {
  data: TrendData;
  title?: string;
}

export function SpendingTrendChart({ data, title = '消费趋势' }: SpendingTrendChartProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];
  const isDark = effectiveTheme === 'dark';

  // Handle empty data
  if (!data.labels.length || !data.data.length) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          暂无消费数据
        </Text>
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: theme.surface,
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: () => theme.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: Colors.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    },
  };

  return (
    <View style={[styles.chartContainer, { backgroundColor: theme.surface }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>
      <LineChart
        data={{
          labels: data.labels,
          datasets: [{ data: data.data }],
        }}
        width={screenWidth - 48}
        height={200}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        withShadow={false}
        fromZero
        yAxisSuffix="¥"
      />
    </View>
  );
}

// ============ Category Pie Chart ============
interface CategoryData {
  name: string;
  amount: number;
  color: string;
  legendFontColor?: string;
}

interface CategoryPieChartProps {
  data: CategoryData[];
  title?: string;
}

// Predefined colors for categories
const CATEGORY_COLORS = [
  '#6366F1', // Primary purple
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#84CC16', // Lime
];

export function CategoryPieChart({ data, title = '消费分类' }: CategoryPieChartProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  // Handle empty data
  if (!data.length) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.surface }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          暂无分类数据
        </Text>
      </View>
    );
  }

  // Process data with colors
  const chartData = data.map((item, index) => ({
    name: item.name,
    population: item.amount,
    color: item.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    legendFontColor: theme.textSecondary,
    legendFontSize: 12,
  }));

  const chartConfig = {
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  };

  return (
    <View style={[styles.chartContainer, { backgroundColor: theme.surface }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>
      <PieChart
        data={chartData}
        width={screenWidth - 48}
        height={200}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
    </View>
  );
}

// ============ Simple Bar Stats ============
interface BarStatData {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}

interface SimpleBarStatsProps {
  data: BarStatData[];
  title?: string;
}

export function SimpleBarStats({ data, title }: SimpleBarStatsProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  if (!data.length) {
    return null;
  }

  return (
    <View style={[styles.barContainer, { backgroundColor: theme.surface }]}>
      {title && <Text style={[styles.chartTitle, { color: theme.text }]}>{title}</Text>}
      {data.map((item, index) => {
        const percentage = item.maxValue > 0 ? (item.value / item.maxValue) * 100 : 0;
        return (
          <View key={index} style={styles.barItem}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[styles.barValue, { color: theme.textSecondary }]}>
                ¥{item.value.toFixed(0)}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: item.color || Colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============ Weekly Summary Card ============
interface WeeklySummaryProps {
  thisWeek: number;
  lastWeek: number;
  averageDaily: number;
}

export function WeeklySummaryCard({ thisWeek, lastWeek, averageDaily }: WeeklySummaryProps) {
  const { effectiveTheme } = useTheme();
  const theme = Colors[effectiveTheme];

  const change = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;
  const isIncrease = change > 0;

  return (
    <View style={[styles.summaryContainer, { backgroundColor: theme.surface }]}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>本周概览</Text>
      
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>本周消费</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>¥{thisWeek.toFixed(0)}</Text>
        </View>
        
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>日均</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>¥{averageDaily.toFixed(0)}</Text>
        </View>
        
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>较上周</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: isIncrease ? Colors.error : Colors.success },
            ]}
          >
            {isIncrease ? '↑' : '↓'} {Math.abs(change).toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -8,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  barContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  barItem: {
    marginBottom: 12,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  barValue: {
    fontSize: 14,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryContainer: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
