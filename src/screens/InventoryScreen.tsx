import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import odooApi from '../services/odooApi';
import { Product } from '../types';

export default function InventoryScreen() {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    filterInventory();
  }, [searchQuery, inventory]);

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
    setRefreshing(true);
    await loadInventory();
    setRefreshing(false);
  };

  const filterInventory = () => {
    if (!searchQuery) {
      setFilteredInventory(inventory);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = inventory.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query) ||
        (product.internal_reference && product.internal_reference.toLowerCase().includes(query))
    );
    setFilteredInventory(filtered);
  };

  const getStockLevelColor = (quantity: number) => {
    if (quantity === 0) return '#f44336';
    if (quantity < 10) return '#ff9800';
    return '#4CAF50';
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={[styles.stockBadge, { backgroundColor: getStockLevelColor(item.quantity) }]}>
          <Text style={styles.stockText}>{item.quantity}</Text>
        </View>
      </View>
      <View style={styles.productDetails}>
        <Text style={styles.detailText}>Barcode: {item.barcode || 'N/A'}</Text>
        {item.internal_reference && (
          <Text style={styles.detailText}>Ref: {item.internal_reference}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>{filteredInventory.length} products</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, barcode, or reference..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#875A7B" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : filteredInventory.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No products found' : 'No products in inventory'}
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadInventory}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#875A7B',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  searchContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  listContainer: {
    padding: 15,
  },
  productCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
    color: '#333',
  },
  stockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 50,
    alignItems: 'center',
  },
  stockText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  productDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#875A7B',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});