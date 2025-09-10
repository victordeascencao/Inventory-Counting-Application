import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getScanHistory, clearScanHistory } from '../../src/services/localStorage';
import { ScanHistory } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HistoryScreen() {
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const scanHistory = await getScanHistory();
    setHistory(scanHistory);
  };

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleClearHistory = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan history?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await clearScanHistory();
            setHistory([]);
            Alert.alert('Success', 'History cleared');
          },
        },
      ]
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const renderItem = ({ item, index }: { item: ScanHistory; index: number }) => {
    const isIn = item.type === 'in';
    const translateX = useRef(new Animated.Value(0)).current;
    const itemOpacity = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.timing(itemOpacity, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);
    
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 10;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(Math.max(gestureState.dx, -100));
          }
        },
        onPanResponderRelease: async (_, gestureState) => {
          if (gestureState.dx < -50) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.spring(translateX, {
              toValue: -80,
              useNativeDriver: true,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      })
    ).current;
    
    const handleDelete = async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Delete Entry',
        'Remove this scan from history?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Delete logic here
              Animated.timing(itemOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            },
          },
        ]
      );
    };
    
    return (
      <Animated.View style={{ opacity: itemOpacity }}>
        <View style={styles.historyItemContainer}>
          <Animated.View
            style={[
              styles.deleteAction,
              { transform: [{ translateX: Animated.add(translateX, 80) }] },
            ]}
          >
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.historyItem,
              { transform: [{ translateX }] },
            ]}
          >
            <TouchableOpacity 
              style={styles.historyItemTouchable}
              activeOpacity={0.7}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.iconContainer, isIn ? styles.iconIn : styles.iconOut]}>
                <Ionicons 
                  name={isIn ? "arrow-down" : "arrow-up"} 
                  size={24} 
                  color="white" 
                />
              </View>
              
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <View style={[styles.typeBadge, isIn ? styles.badgeIn : styles.badgeOut]}>
                    <Text style={[styles.typeText, isIn ? { color: '#10B981' } : { color: '#EF4444' }]}>
                      {isIn ? 'IN' : 'OUT'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.itemDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="barcode-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>{item.barcode}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cube-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>{item.quantity} units</Text>
                  </View>
                </View>
                
                <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="time-outline" size={64} color="#CCC" />
      <Text style={styles.emptyText}>No scan history yet</Text>
      <Text style={styles.emptySubtext}>
        Start scanning products to see them here
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (history.length === 0) return null;
    
    return (
      <View style={styles.headerContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Activity Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{history.length}</Text>
              <Text style={styles.summaryLabel}>Total Scans</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.inColor]}>
                {history.filter(h => h.type === 'in').length}
              </Text>
              <Text style={styles.summaryLabel}>Scan In</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.outColor]}>
                {history.filter(h => h.type === 'out').length}
              </Text>
              <Text style={styles.summaryLabel}>Scan Out</Text>
            </View>
          </View>
        </View>
        
        {history.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={handleClearHistory}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color="#DC3545" />
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={history.length === 0 ? styles.emptyList : styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#875A7B']}
            tintColor="#875A7B"
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  headerContainer: {
    padding: 15,
    paddingBottom: 10,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#875A7B',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 5,
  },
  inColor: {
    color: '#28A745',
  },
  outColor: {
    color: '#FF9800',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#DC3545',
    gap: 8,
    minHeight: 48,
  },
  clearButtonText: {
    color: '#DC3545',
    fontWeight: '600',
    fontSize: 16,
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  historyItemContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
  },
  deleteButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DC3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  historyItemTouchable: {
    flexDirection: 'row',
    padding: 16,
    minHeight: 88,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconIn: {
    backgroundColor: '#10B981',
  },
  iconOut: {
    backgroundColor: '#EF4444',
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 48,
    alignItems: 'center',
  },
  badgeIn: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  badgeOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  typeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemDetails: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  timestamp: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});