import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import odooApi from '../../src/services/odooApi';
import { Product } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function InventoryScreen() {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'low' | 'out'>('all');
  
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadInventory();
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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

  useEffect(() => {
    filterInventory();
  }, [searchQuery, inventory, selectedFilter]);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const products = await odooApi.getInventory();
      setInventory(products);
      setFilteredInventory(products);
    } catch (error) {
      Alert.alert('Error', 'Failed to load inventory. Check your Odoo connection.');
    }
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  };

  const filterInventory = () => {
    let filtered = inventory;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.barcode.toLowerCase().includes(query) ||
          (product.internal_reference && product.internal_reference.toLowerCase().includes(query))
      );
    }
    
    // Apply stock filter
    switch (selectedFilter) {
      case 'low':
        filtered = filtered.filter(p => p.quantity > 0 && p.quantity < 10);
        break;
      case 'out':
        filtered = filtered.filter(p => p.quantity === 0);
        break;
    }
    
    setFilteredInventory(filtered);
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: '#EF4444', text: 'Out of Stock', icon: 'alert-circle', gradient: ['#FEE2E2', '#FECACA'] };
    if (quantity < 10) return { color: '#F59E0B', text: 'Low Stock', icon: 'warning', gradient: ['#FEF3C7', '#FDE68A'] };
    return { color: '#10B981', text: 'In Stock', icon: 'checkmark-circle', gradient: ['#D1FAE5', '#A7F3D0'] };
  };

  const handleProductPress = async (product: Product) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProduct(product);
    setShowProductDetail(true);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeProductDetail = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowProductDetail(false);
      setSelectedProduct(null);
    });
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const status = getStockStatus(item.quantity);
    const itemAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.timing(itemAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);
    
    return (
      <Animated.View
        style={[
          styles.productContainer,
          {
            opacity: itemAnim,
            transform: [
              {
                translateY: itemAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.productCard}
          onPress={() => handleProductPress(item)}
          activeOpacity={0.95}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FAFBFC']}
            style={styles.productGradient}
          >
            <View style={styles.productHeader}>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.productMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="barcode-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>{item.barcode || 'No barcode'}</Text>
                  </View>
                  {item.internal_reference && (
                    <View style={styles.metaItem}>
                      <Ionicons name="pricetag-outline" size={14} color="#64748B" />
                      <Text style={styles.metaText}>{item.internal_reference}</Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.stockContainer}>
                <LinearGradient
                  colors={status.gradient}
                  style={styles.stockBadge}
                >
                  <Text style={styles.stockQuantity}>{item.quantity}</Text>
                  <Text style={styles.stockUnit}>units</Text>
                </LinearGradient>
                <View style={[styles.statusIndicator, { backgroundColor: status.color }]}>
                  <Ionicons name={status.icon as any} size={16} color="white" />
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
      </View>
      <Text style={styles.emptyText}>
        {searchQuery ? 'No products found' : 'No products in inventory'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try a different search term' : 'Add products in your Odoo system'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.refreshButton} onPress={loadInventory}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.refreshGradient}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F0F4F8', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BlurView intensity={80} tint="light" style={styles.headerBlur}>
          <Text style={styles.headerTitle}>Inventory</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <BlurView intensity={100} tint="light" style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery ? (
                <TouchableOpacity 
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSearchQuery('');
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </BlurView>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterContainer}>
            {[
              { id: 'all', label: 'All Products', count: inventory.length },
              { id: 'low', label: 'Low Stock', count: inventory.filter(p => p.quantity > 0 && p.quantity < 10).length },
              { id: 'out', label: 'Out of Stock', count: inventory.filter(p => p.quantity === 0).length },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  selectedFilter === filter.id && styles.filterPillActive
                ]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFilter(filter.id as any);
                }}
              >
                {selectedFilter === filter.id ? (
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.filterGradient}
                  >
                    <Text style={styles.filterTextActive}>{filter.label}</Text>
                    <View style={styles.filterCount}>
                      <Text style={styles.filterCountText}>{filter.count}</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <>
                    <Text style={styles.filterText}>{filter.label}</Text>
                    <View style={styles.filterCountInactive}>
                      <Text style={styles.filterCountTextInactive}>{filter.count}</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </View>

      {/* Stats Bar */}
      <Animated.View style={[styles.statsBar, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{filteredInventory.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {filteredInventory.reduce((sum, p) => sum + p.quantity, 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Total Units</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>
            {filteredInventory.filter(p => p.quantity > 0 && p.quantity < 10).length}
          </Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
      </Animated.View>

      {/* Product List */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={filteredInventory.length === 0 ? styles.emptyList : styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6366F1']}
              tintColor="#6366F1"
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Product Detail Modal */}
      <Modal
        visible={showProductDetail}
        transparent
        animationType="none"
        onRequestClose={closeProductDetail}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={closeProductDetail}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalHandle} />
              
              {selectedProduct && (() => {
                const status = getStockStatus(selectedProduct.quantity);
                return (
                  <>
                    <View style={styles.modalHeader}>
                      <View style={styles.modalTitleContainer}>
                        <Text style={styles.modalTitle} numberOfLines={2}>
                          {selectedProduct.name}
                        </Text>
                        <LinearGradient
                          colors={status.gradient}
                          style={styles.modalStatusBadge}
                        >
                          <Ionicons name={status.icon as any} size={16} color={status.color} />
                          <Text style={[styles.modalStatusText, { color: status.color }]}>
                            {status.text}
                          </Text>
                        </LinearGradient>
                      </View>
                      <TouchableOpacity 
                        onPress={closeProductDetail}
                        style={styles.modalCloseButton}
                      >
                        <Ionicons name="close" size={24} color="#475569" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.detailSection}>
                      <View style={styles.detailCard}>
                        <LinearGradient
                          colors={['#F8FAFC', '#FFFFFF']}
                          style={styles.detailGradient}
                        >
                          <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                              <Ionicons name="barcode" size={24} color="#6366F1" />
                            </View>
                            <View style={styles.detailContent}>
                              <Text style={styles.detailLabel}>Barcode</Text>
                              <Text style={styles.detailValue}>
                                {selectedProduct.barcode || 'No barcode'}
                              </Text>
                            </View>
                          </View>

                          {selectedProduct.internal_reference && (
                            <View style={styles.detailRow}>
                              <View style={styles.detailIcon}>
                                <Ionicons name="pricetag" size={24} color="#8B5CF6" />
                              </View>
                              <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Reference</Text>
                                <Text style={styles.detailValue}>
                                  {selectedProduct.internal_reference}
                                </Text>
                              </View>
                            </View>
                          )}

                          <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                              <Ionicons name="cube" size={24} color="#10B981" />
                            </View>
                            <View style={styles.detailContent}>
                              <Text style={styles.detailLabel}>Current Stock</Text>
                              <Text style={styles.detailValue}>
                                {selectedProduct.quantity} units
                              </Text>
                            </View>
                          </View>
                        </LinearGradient>
                      </View>

                      <View style={styles.modalActions}>
                        <TouchableOpacity 
                          style={styles.modalButton}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            closeProductDetail();
                          }}
                        >
                          <LinearGradient
                            colors={['#10B981', '#059669']}
                            style={styles.modalButtonGradient}
                          >
                            <Ionicons name="arrow-down-circle" size={20} color="white" />
                            <Text style={styles.modalButtonText}>Scan In</Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.modalButton}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            closeProductDetail();
                          }}
                        >
                          <LinearGradient
                            colors={['#EF4444', '#DC2626']}
                            style={styles.modalButtonGradient}
                          >
                            <Ionicons name="arrow-up-circle" size={20} color="white" />
                            <Text style={styles.modalButtonText}>Scan Out</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                );
              })()}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: 'transparent',
  },
  headerBlur: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  searchContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  filterGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: -14,
    marginVertical: -8,
  },
  filterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterTextActive: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  filterCount: {
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountInactive: {
    marginLeft: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  filterCountTextInactive: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  listContainer: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  productContainer: {
    marginBottom: 12,
  },
  productCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  productGradient: {
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 10,
    lineHeight: 22,
  },
  productMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748B',
  },
  stockContainer: {
    alignItems: 'center',
  },
  stockBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  stockQuantity: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  stockUnit: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
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
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  refreshGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  modalTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  modalStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  detailSection: {
    paddingHorizontal: 24,
  },
  detailCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  detailGradient: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});