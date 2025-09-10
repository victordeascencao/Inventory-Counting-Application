import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import odooApi from '../../src/services/odooApi';
import { getScanHistory } from '../../src/services/localStorage';
import { DashboardMetrics, ScanHistory } from '../../src/types';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    recentMovements: 0,
    pendingSync: 0,
    todayScans: 0,
    weeklyTrend: 0,
  });
  const [recentScans, setRecentScans] = useState<ScanHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const hasConfig = await odooApi.loadConfig();
      setIsConnected(hasConfig);

      const inventory = await odooApi.getInventory();
      const history = await getScanHistory();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayScans = history.filter(h => {
        const scanDate = new Date(h.timestamp);
        scanDate.setHours(0, 0, 0, 0);
        return scanDate.getTime() === today.getTime();
      });

      setMetrics({
        totalProducts: inventory.length,
        totalValue: inventory.reduce((sum, p) => sum + p.quantity, 0),
        lowStockItems: inventory.filter(p => p.quantity > 0 && p.quantity < 10).length,
        outOfStockItems: inventory.filter(p => p.quantity === 0).length,
        recentMovements: history.length,
        pendingSync: history.filter(h => !h.synced).length,
        todayScans: todayScans.length,
        weeklyTrend: calculateWeeklyTrend(history),
      });

      setRecentScans(history.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
    setIsLoading(false);
  };

  const calculateWeeklyTrend = (history: ScanHistory[]) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = history.filter(h => new Date(h.timestamp) >= weekAgo).length;
    return thisWeek;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleQuickAction = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedAction(action);
    
    // Animate button press
    setTimeout(() => {
      setSelectedAction(null);
      switch (action) {
        case 'scan_in':
          router.push('/(tabs)/scanner?mode=in');
          break;
        case 'scan_out':
          router.push('/(tabs)/scanner?mode=out');
          break;
        case 'inventory':
          router.push('/(tabs)/inventory');
          break;
        case 'batch':
          router.push('/batch-scan?type=in');
          break;
      }
    }, 200);
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.98],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp',
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#F0F4F8', '#FFFFFF']}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F0F4F8', '#FFFFFF', '#F8FAFC']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          { 
            paddingTop: insets.top + 16,
            opacity: headerOpacity,
            transform: [{ scale: headerScale }]
          }
        ]}
      >
        <BlurView intensity={80} tint="light" style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.headerTitle}>Inventory Dashboard</Text>
            </View>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.settingsGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="settings-outline" size={22} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366F1']}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Status */}
        {!isConnected && (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              style={styles.connectionAlert}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#FEE2E2', '#FECACA']}
                style={styles.alertGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.alertIcon}>
                  <Ionicons name="cloud-offline" size={20} color="#DC2626" />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.connectionText}>Not connected to Odoo</Text>
                  <Text style={styles.connectionSubtext}>Tap to connect →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Quick Actions with Animation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { id: 'scan_in', icon: 'arrow-down-circle', title: 'Scan In', subtitle: 'Add to inventory', colors: ['#10B981', '#059669'] },
              { id: 'scan_out', icon: 'arrow-up-circle', title: 'Scan Out', subtitle: 'Remove from stock', colors: ['#EF4444', '#DC2626'] },
              { id: 'inventory', icon: 'cube', title: 'Inventory', subtitle: 'View all products', colors: ['#3B82F6', '#2563EB'] },
              { id: 'batch', icon: 'layers', title: 'Batch Scan', subtitle: 'Multiple items', colors: ['#8B5CF6', '#7C3AED'] },
            ].map((action, index) => (
              <Animated.View
                key={action.id}
                style={[
                  { 
                    transform: [
                      { 
                        scale: scaleAnim.interpolate({
                          inputRange: [0.9, 1],
                          outputRange: [0.95, 1],
                        })
                      }
                    ],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <TouchableOpacity 
                  style={[
                    styles.actionCard,
                    selectedAction === action.id && styles.actionCardPressed
                  ]}
                  onPress={() => handleQuickAction(action.id)}
                  activeOpacity={0.95}
                >
                  <LinearGradient
                    colors={action.colors}
                    style={styles.actionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.actionIconContainer}>
                      <Ionicons name={action.icon as any} size={32} color="white" />
                    </View>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Metrics Cards with Glass Effect */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory Overview</Text>
          <View style={styles.metricsContainer}>
            <BlurView intensity={100} tint="light" style={styles.metricsBlur}>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="cube-outline" size={24} color="#6366F1" />
                  </View>
                  <Text style={styles.metricValue}>{metrics.totalProducts}</Text>
                  <Text style={styles.metricLabel}>Total Products</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="layers-outline" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.metricValue}>{metrics.totalValue.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>Total Units</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="warning-outline" size={24} color="#F59E0B" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#F59E0B' }]}>{metrics.lowStockItems}</Text>
                  <Text style={styles.metricLabel}>Low Stock</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIconBg, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                  </View>
                  <Text style={[styles.metricValue, { color: '#EF4444' }]}>{metrics.outOfStockItems}</Text>
                  <Text style={styles.metricLabel}>Out of Stock</Text>
                </View>
              </View>
            </BlurView>
          </View>
        </View>

        {/* Activity Card with Modern Design */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Activity</Text>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/history')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={16} color="#6366F1" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.activityCard}>
            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              style={styles.activityGradient}
            >
              <View style={styles.activityStats}>
                <View style={styles.activityStat}>
                  <View style={styles.statCircle}>
                    <Text style={styles.activityNumber}>{metrics.todayScans}</Text>
                  </View>
                  <Text style={styles.activityLabel}>Scans Today</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.activityStat}>
                  <View style={styles.statCircle}>
                    <Text style={styles.activityNumber}>{metrics.weeklyTrend}</Text>
                  </View>
                  <Text style={styles.activityLabel}>This Week</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.activityStat}>
                  <View style={styles.statCircle}>
                    <Text style={[styles.activityNumber, metrics.pendingSync > 0 && { color: '#F59E0B' }]}>
                      {metrics.pendingSync}
                    </Text>
                  </View>
                  <Text style={styles.activityLabel}>Pending</Text>
                </View>
              </View>

              {/* Recent Scans with Beautiful Cards */}
              {recentScans.length > 0 && (
                <View style={styles.recentScans}>
                  <Text style={styles.recentTitle}>Recent Transactions</Text>
                  {recentScans.map((scan, index) => (
                    <Animated.View
                      key={scan.id}
                      style={[
                        styles.scanItem,
                        {
                          opacity: fadeAnim,
                          transform: [
                            {
                              translateX: fadeAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [50, 0],
                              })
                            }
                          ]
                        }
                      ]}
                    >
                      <View style={[
                        styles.scanIconBg,
                        scan.type === 'in' ? styles.scanInBg : styles.scanOutBg
                      ]}>
                        <Ionicons 
                          name={scan.type === 'in' ? 'arrow-down' : 'arrow-up'} 
                          size={18} 
                          color="white" 
                        />
                      </View>
                      <View style={styles.scanContent}>
                        <Text style={styles.scanProduct} numberOfLines={1}>
                          {scan.product_name}
                        </Text>
                        <Text style={styles.scanMeta}>
                          {scan.quantity} units • {new Date(scan.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </View>
                      <View style={[
                        styles.scanTypeBadge,
                        scan.type === 'in' ? styles.scanInBadge : styles.scanOutBadge
                      ]}>
                        <Text style={[
                          styles.scanTypeText,
                          scan.type === 'in' ? styles.scanInText : styles.scanOutText
                        ]}>
                          {scan.type.toUpperCase()}
                        </Text>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              )}

              {recentScans.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="clipboard-outline" size={48} color="#CBD5E1" />
                  </View>
                  <Text style={styles.emptyText}>No activity yet today</Text>
                  <TouchableOpacity 
                    style={styles.startButton}
                    onPress={() => router.push('/(tabs)/scanner')}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={styles.startGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.startText}>Start Scanning</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
  },
  settingsGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 140,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  connectionAlert: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  alertGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  connectionText: {
    fontSize: 16,
    color: '#991B1B',
    fontWeight: '600',
    marginBottom: 2,
  },
  connectionSubtext: {
    fontSize: 13,
    color: '#DC2626',
    opacity: 0.8,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginTop: 12,
  },
  actionCard: {
    width: (width - 52) / 2,
    height: 120,
    margin: 6,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  actionCardPressed: {
    transform: [{ scale: 0.95 }],
  },
  actionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  metricsContainer: {
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  metricsBlur: {
    padding: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  metricCard: {
    width: (width - 72) / 2,
    padding: 8,
    alignItems: 'center',
  },
  metricIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  activityCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  activityGradient: {
    padding: 20,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  activityStat: {
    alignItems: 'center',
  },
  statCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366F1',
  },
  activityLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  recentScans: {
    marginTop: 4,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  scanIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scanInBg: {
    backgroundColor: '#10B981',
  },
  scanOutBg: {
    backgroundColor: '#EF4444',
  },
  scanContent: {
    flex: 1,
  },
  scanProduct: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  scanMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  scanTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scanInBadge: {
    backgroundColor: '#D1FAE5',
  },
  scanOutBadge: {
    backgroundColor: '#FEE2E2',
  },
  scanTypeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scanInText: {
    color: '#059669',
  },
  scanOutText: {
    color: '#DC2626',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
  },
  startButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  startText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});