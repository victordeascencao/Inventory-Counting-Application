import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import odooApi from '../src/services/odooApi';
import { saveScanHistory } from '../src/services/localStorage';
import { Product, ScanHistory, BatchScan } from '../src/types';

interface BatchItem {
  id: string;
  product: Product;
  quantity: number;
  scanned_at: Date;
}

export default function BatchScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scanType = (params.type as 'in' | 'out' | 'count' | 'transfer') || 'in';
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [modalVisible, setModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState('Main Warehouse');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning) return;
    
    setIsScanning(false);
    
    // Check if already scanned
    const existingItem = batchItems.find(item => item.product.barcode === data);
    if (existingItem) {
      Alert.alert(
        'Already Scanned',
        `${existingItem.product.name} is already in the batch. Do you want to update the quantity?`,
        [
          { text: 'Cancel', onPress: () => setIsScanning(true) },
          { 
            text: 'Update', 
            onPress: () => {
              setCurrentProduct(existingItem.product);
              setQuantity(existingItem.quantity.toString());
              setModalVisible(true);
            }
          },
        ]
      );
      return;
    }

    try {
      const product = await odooApi.searchProductByBarcode(data);
      
      if (product) {
        setCurrentProduct(product);
        setModalVisible(true);
      } else {
        Alert.alert('Product Not Found', `No product found with barcode: ${data}`);
        setTimeout(() => setIsScanning(true), 2000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search product. Check your connection.');
      setIsScanning(true);
    }
  };

  const addToBatch = () => {
    if (!currentProduct) return;
    
    const qty = parseInt(quantity) || 1;
    
    // Check if updating existing item
    const existingIndex = batchItems.findIndex(
      item => item.product.barcode === currentProduct.barcode
    );
    
    if (existingIndex >= 0) {
      const updated = [...batchItems];
      updated[existingIndex].quantity = qty;
      setBatchItems(updated);
    } else {
      const newItem: BatchItem = {
        id: Date.now().toString(),
        product: currentProduct,
        quantity: qty,
        scanned_at: new Date(),
      };
      setBatchItems([...batchItems, newItem]);
    }
    
    setModalVisible(false);
    setCurrentProduct(null);
    setQuantity('1');
    setTimeout(() => setIsScanning(true), 500);
  };

  const removeFromBatch = (id: string) => {
    setBatchItems(batchItems.filter(item => item.id !== id));
  };

  const processBatch = async () => {
    if (batchItems.length === 0) {
      Alert.alert('Empty Batch', 'Please scan at least one item before processing.');
      return;
    }

    Alert.alert(
      'Process Batch',
      `Are you sure you want to process ${batchItems.length} items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Process', onPress: performBatchProcess },
      ]
    );
  };

  const performBatchProcess = async () => {
    setIsProcessing(true);
    
    try {
      let successCount = 0;
      let failedItems: string[] = [];

      for (const item of batchItems) {
        try {
          const moveSuccess = await odooApi.createStockMove({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            type: scanType === 'count' ? 'adjustment' : scanType,
            location: location,
            timestamp: new Date(),
            barcode: item.product.barcode,
            reason: notes,
            reference: `BATCH-${Date.now()}`,
          });

          if (moveSuccess) {
            const scan: ScanHistory = {
              id: Date.now().toString(),
              barcode: item.product.barcode,
              product_name: item.product.name,
              quantity: item.quantity,
              type: scanType === 'count' ? 'adjustment' : scanType,
              timestamp: new Date(),
              location: location,
              synced: true,
            };
            
            await saveScanHistory(scan);
            successCount++;
          } else {
            failedItems.push(item.product.name);
          }
        } catch (error) {
          failedItems.push(item.product.name);
        }
      }

      if (successCount === batchItems.length) {
        Alert.alert(
          'Success',
          `All ${successCount} items processed successfully!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else if (successCount > 0) {
        Alert.alert(
          'Partial Success',
          `${successCount} items processed. Failed: ${failedItems.join(', ')}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Failed', 'Failed to process batch. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while processing the batch.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTotalQuantity = () => {
    return batchItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTypeConfig = () => {
    switch (scanType) {
      case 'in':
        return { title: 'Receive Stock', color: '#28A745', icon: 'download' };
      case 'out':
        return { title: 'Ship Items', color: '#DC3545', icon: 'upload' };
      case 'count':
        return { title: 'Stock Count', color: '#4ECDC4', icon: 'calculator' };
      case 'transfer':
        return { title: 'Transfer Stock', color: '#FFD93D', icon: 'swap-horizontal' };
      default:
        return { title: 'Batch Scan', color: '#875A7B', icon: 'layers' };
    }
  };

  const config = getTypeConfig();

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#875A7B" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: config.color }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{config.title}</Text>
          <Text style={styles.headerSubtitle}>Batch Mode</Text>
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.statNumber}>{batchItems.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
      </View>

      {/* Camera View */}
      {isScanning && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
              <Text style={styles.scanHint}>Scan product barcode</Text>
            </View>
          </CameraView>
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={() => setIsScanning(false)}
          >
            <Ionicons name="pause" size={24} color="white" />
            <Text style={styles.pauseText}>Pause Scanning</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Batch Items List */}
      <View style={styles.batchContainer}>
        <View style={styles.batchHeader}>
          <Text style={styles.batchTitle}>Scanned Items</Text>
          <Text style={styles.batchCount}>
            Total: {getTotalQuantity()} units
          </Text>
        </View>

        {batchItems.length === 0 ? (
          <View style={styles.emptyBatch}>
            <Ionicons name="scan-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No items scanned yet</Text>
            {!isScanning && (
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={() => setIsScanning(true)}
              >
                <Text style={styles.resumeText}>Resume Scanning</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={batchItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.batchItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.product.barcode} • {item.quantity} units
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromBatch(item.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#DC3545" />
                </TouchableOpacity>
              </View>
            )}
            style={styles.batchList}
          />
        )}
      </View>

      {/* Location and Notes */}
      <View style={styles.metaContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Enter location"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            multiline
          />
        </View>
      </View>

      {/* Process Button */}
      {batchItems.length > 0 && (
        <TouchableOpacity
          style={[styles.processButton, { backgroundColor: config.color }]}
          onPress={processBatch}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="white" />
              <Text style={styles.processText}>
                Process {batchItems.length} Items
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Add Item Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {currentProduct && (
              <>
                <Text style={styles.modalTitle}>Add to Batch</Text>
                <Text style={styles.productName}>{currentProduct.name}</Text>
                <Text style={styles.productBarcode}>{currentProduct.barcode}</Text>
                
                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Quantity</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        const qty = Math.max(1, parseInt(quantity) - 1);
                        setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="remove" size={24} color="#666" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantityInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        const qty = parseInt(quantity) + 1;
                        setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="add" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setModalVisible(false);
                      setIsScanning(true);
                    }}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.addButton]}
                    onPress={addToBatch}
                  >
                    <Text style={styles.addText}>Add to Batch</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5,
  },
  headerContent: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  headerStats: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  cameraContainer: {
    height: 200,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanArea: {
    width: 200,
    height: 80,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
  },
  scanHint: {
    color: 'white',
    marginTop: 10,
    fontSize: 14,
  },
  pauseButton: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  pauseText: {
    color: 'white',
    fontWeight: '600',
  },
  batchContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 15,
    borderRadius: 12,
    padding: 15,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  batchCount: {
    fontSize: 14,
    color: '#875A7B',
    fontWeight: '600',
  },
  emptyBatch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
  },
  resumeButton: {
    marginTop: 20,
    backgroundColor: '#875A7B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resumeText: {
    color: 'white',
    fontWeight: '600',
  },
  batchList: {
    flex: 1,
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 5,
  },
  metaContainer: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
    marginBottom: 30,
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  processText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    marginHorizontal: 30,
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  productBarcode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  quantitySection: {
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    marginHorizontal: 20,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  addButton: {
    backgroundColor: '#875A7B',
  },
  cancelText: {
    color: '#666',
    fontWeight: '600',
  },
  addText: {
    color: 'white',
    fontWeight: '600',
  },
});