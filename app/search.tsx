import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation as useRNNavigation } from '@react-navigation/native';

import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/lib/ThemeContext';
import { useNavigation } from '@/lib/navigationContext';
import { navigationEvents } from '@/lib/navigationEvents';
import { searchAll, type SearchResult } from '@/lib/searchService';

// Highlight matching text
function HighlightText({ 
  text, 
  query, 
  colorScheme 
}: { 
  text: string; 
  query: string;
  colorScheme: 'light' | 'dark';
}) {
  if (!query || !text || text.trim().length === 0) {
    return <Text>{text || ''}</Text>;
  }

  // Theme-aware highlight colors
  const highlightStyle = colorScheme === 'dark' 
    ? { 
        backgroundColor: '#F59E0B', // Amber background for better visibility in dark theme
        color: '#0F172A', // Dark text for contrast
        fontWeight: '700' as const
      }
    : { 
        backgroundColor: '#FEF08A', // Yellow for light theme
        fontWeight: '600' as const
      };

  try {
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedQuery.length === 0) {
      return <Text>{text}</Text>;
    }
    
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    
    return (
      <Text>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Text key={index} style={highlightStyle}>
              {part}
            </Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  } catch (error) {
    // Fallback if regex fails
    console.error('Highlight error:', error);
    return <Text>{text}</Text>;
  }
}

// Search result item
interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onPress: () => void;
  colorScheme: 'light' | 'dark';
}

function SearchResultItem({ result, query, onPress, colorScheme }: SearchResultItemProps) {
  const colors = Colors[colorScheme];

  return (
    <TouchableOpacity
      style={[styles.resultItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.resultIcon, { backgroundColor: result.color + '20' }]}>
        <Ionicons name={result.icon as any} size={20} color={result.color} />
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
          <HighlightText text={result.title || '未命名'} query={query} colorScheme={colorScheme} />
        </Text>
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {result.subtitle || ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// Group results by type
function groupResultsByType(results: SearchResult[]) {
  const grouped: Record<string, SearchResult[]> = {
    history: [],
    finance: [],
    todo: [],
    inventory: [],
  };

  for (const result of results) {
    grouped[result.type].push(result);
  }

  return grouped;
}

const TYPE_LABELS: Record<string, string> = {
  history: '历史记录',
  finance: '消费记录',
  todo: '待办事项',
  inventory: '库存物品',
};

export default function SearchScreen() {
  const router = useRouter();
  const navigation = useRNNavigation();
  const insets = useSafeAreaInsets();
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];
  const { setTargetTab } = useNavigation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus search input when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Focus will be handled by TextInput autoFocus prop
      return () => {
        // Cleanup on unmount
      };
    }, [])
  );

  // Debounced search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const searchResults = await searchAll(query);
        // Ensure searchResults is an array before setting state
        if (Array.isArray(searchResults)) {
          setResults(searchResults);
        } else {
          console.error('Search results is not an array:', searchResults);
          setResults([]);
        }
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    searchTimeoutRef.current = timeout;

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [query]);

  const handleResultPress = async (result: SearchResult) => {
    switch (result.type) {
      case 'history':
        // Close modal and navigate
        navigation.goBack();
        await new Promise(resolve => setTimeout(resolve, 300));
        router.push(`/record/${result.id}`);
        break;
      case 'finance':
      case 'todo':
      case 'inventory':
        // Set target tab and emit event (data page will listen)
        setTargetTab(result.type);
        navigationEvents.navigateToTab(result.type);
        
        // Close modal first - use navigation.dismiss() if available
        try {
          // Try to dismiss the modal
          if ((navigation as any).dismiss) {
            (navigation as any).dismiss();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
        } catch (error) {
          // Fallback
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
        
        // Navigate to data tab - use a longer delay
        setTimeout(() => {
          // Navigate using React Navigation
          try {
            (navigation as any).navigate('(tabs)', {
              screen: 'data',
            });
          } catch (error) {
            console.error('Navigation error:', error);
            // Last resort: use router
            router.push('/(tabs)/data');
          }
        }, 800);
        break;
    }
  };

  const groupedResults = groupResultsByType(results);
  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="搜索历史、消费、待办、库存..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelButton}
        >
          <Text style={[styles.cancelText, { color: Colors.primary }]}>取消</Text>
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      {isSearching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>搜索中...</Text>
        </View>
      ) : hasQuery && !hasResults ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            没有找到相关结果
          </Text>
          <Text style={[styles.hintSubtext, { color: colors.textSecondary }]}>
            试试其他关键词
          </Text>
        </View>
      ) : !hasQuery ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            输入关键词开始搜索
          </Text>
          <Text style={[styles.hintSubtext, { color: colors.textSecondary }]}>
            可以搜索历史记录、消费、待办、库存等
          </Text>
        </View>
      ) : (
        <FlatList
          data={Object.entries(groupedResults).filter(([_, items]) => items.length > 0)}
          keyExtractor={([type]) => type}
          contentContainerStyle={styles.resultsContainer}
          renderItem={({ item: [type, items] }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {TYPE_LABELS[type]} ({items.length})
              </Text>
              {items.map((result) => (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  query={query.trim()}
                  onPress={() => handleResultPress(result)}
                  colorScheme={colorScheme}
                />
              ))}
            </View>
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  hintText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  hintSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  resultsContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 13,
  },
});
