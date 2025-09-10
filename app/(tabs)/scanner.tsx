import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import odooApi from '../../src/services/odooApi';
import { saveScanHistory } from '../../src/services/localStorage';
import { Product, ScanHistory } from '../../src/types';

const { width, height } = Dimensions.get('window');

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<'in' | 'out'>((params.mode as 'in' | 'out') || 'in');
  const [modalVisible, setModalVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setScanned(true);
    
    // Flash animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsLoading(true);
    
    try {
      const product = await odooApi.searchProductByBarcode(data);
      
      if (product) {
        setScannedProduct(product);
        setModalVisible(true);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Product Not Found', `No product found with barcode: ${data}`, [
          { text: 'Try Again', onPress: () => setScanned(false) }
        ]);
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to search product. Check your connection.');
      setScanned(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualBarcode.trim()) {
      Alert.alert('Error', 'Please enter a barcode');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    
    try {
      const product = await odooApi.searchProductByBarcode(manualBarcode);
      
      if (product) {
        setScannedProduct(product);
        setModalVisible(true);
        setManualBarcode('');
        setShowManualInput(false);
      } else {
        Alert.alert('Product Not Found', 'No product found with this barcode');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search product');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmScan = async () => {
    if (!scannedProduct) return;
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsLoading(true);
    
    try {
      await odooApi.createStockMove(
        scannedProduct.id,
        qty,
        scanMode
      );

      const scanRecord: ScanHistory = {
        id: Date.now().toString(),
        product_id: scannedProduct.id,
        product_name: scannedProduct.name,
        barcode: scannedProduct.barcode,
        quantity: qty,
        type: scanMode,
        timestamp: new Date(),
        synced: true,
      };

      await saveScanHistory(scanRecord);
      
      Alert.alert(
        'Success',
        `${scannedProduct.name} ${scanMode === 'in' ? 'added to' : 'removed from'} inventory`,
        [{ text: 'OK', onPress: resetScanner }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setModalVisible(false);
    setScannedProduct(null);
    setQuantity('1');
  };

  const toggleMode = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScanMode(scanMode === 'in' ? 'out' : 'in');
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#875A7B" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => Camera.requestCameraPermissionsAsync()}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView 
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
        }}
        enableTorch={torchOn}
      >
        {/* Scan Overlay */}
        <View style={styles.scanOverlay}>
          {/* Header */}
          <View style={[styles.scanHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Scanner</Text>
              <View style={[styles.modeBadge, scanMode === 'in' ? styles.modeBadgeIn : styles.modeBadgeOut]}>
                <Text style={styles.modeBadgeText}>
                  {scanMode === 'in' ? 'SCAN IN' : 'SCAN OUT'}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTorchOn(!torchOn);
              }}
            >
              <Ionicons name={torchOn ? "flash" : "flash-outline"} size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrame}>
            <View style={styles.scanCorner} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
            
            <Animated.View 
              style={[
                styles.scanLine,
                {
                  opacity: fadeAnim,
                }
              ]} 
            />
            
            <Text style={styles.scanHint}>
              {isLoading ? 'Processing...' : 'Align barcode within frame'}
            </Text>
          </View>

          {/* Bottom Controls */}
          <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity 
              style={styles.modeToggle}
              onPress={toggleMode}
            >
              <Ionicons 
                name={scanMode === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                size={24} 
                color="white" 
              />
              <Text style={styles.modeToggleText}>
                Switch to {scanMode === 'in' ? 'Scan Out' : 'Scan In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.manualButton}
              onPress={() => setShowManualInput(true)}
            >
              <Ionicons name="keypad" size={24} color="white" />
              <Text style={styles.manualButtonText}>Manual Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.manualInputModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Barcode Entry</Text>
              <TouchableOpacity onPress={() => setShowManualInput(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.barcodeInput}
              placeholder="Enter barcode number"
              placeholderTextColor="#9CA3AF"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="default"
              autoFocus
              autoCapitalize="characters"
            />

            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleManualEntry}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="white" />
                  <Text style={styles.searchButtonText}>Search Product</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Product Confirmation Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.productModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm {scanMode === 'in' ? 'Stock In' : 'Stock Out'}</Text>
              <TouchableOpacity onPress={resetScanner}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {scannedProduct && (
              <ScrollView style={styles.productDetails}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{scannedProduct.name}</Text>
                  <View style={styles.productMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="barcode-outline" size={16} color="#6B7280" />
                      <Text style={styles.metaText}>{scannedProduct.barcode}</Text>
                    </View>
                    {scannedProduct.internal_reference && (
                      <View style={styles.metaItem}>
                        <Ionicons name="pricetag-outline" size={16} color="#6B7280" />
                        <Text style={styles.metaText}>{scannedProduct.internal_reference}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.stockInfo}>
                    <Text style={styles.stockLabel}>Current Stock</Text>
                    <Text style={styles.stockValue}>{scannedProduct.quantity} units</Text>
                  </View>
                </View>

                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Quantity</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const qty = parseInt(quantity) - 1;
                        if (qty > 0) setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="remove" size={24} color="#111827" />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={styles.quantityInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                    
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const qty = parseInt(quantity) + 1;
                        setQuantity(qty.toString());
                      }}
                    >
                      <Ionicons name="add" size={24} color="#111827" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={resetScanner}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.confirmButton,
                      scanMode === 'in' ? styles.confirmButtonIn : styles.confirmButtonOut
                    ]}
                    onPress={confirmScan}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons 
                          name={scanMode === 'in' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                          size={20} 
                          color="white" 
                        />
                        <Text style={styles.confirmButtonText}>
                          {scanMode === 'in' ? 'Add to Stock' : 'Remove from Stock'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeBadgeIn: {
    backgroundColor: '#10B981',
  },
  modeBadgeOut: {
    backgroundColor: '#EF4444',
  },
  modeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: 'white',
    borderTopWidth: 3,
    borderLeftWidth: 3,
    top: height / 2 - 120,
    left: 40,
  },
  scanCornerTR: {
    borderLeftWidth: 0,
    borderRightWidth: 3,
    left: width - 80,
  },
  scanCornerBL: {
    borderTopWidth: 0,
    borderBottomWidth: 3,
    top: height / 2 + 80,
  },
  scanCornerBR: {
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    top: height / 2 + 80,
    left: width - 80,
  },
  scanLine: {
    position: 'absolute',
    width: width - 80,
    height: 2,
    backgroundColor: '#10B981',
  },
  scanHint: {
    color: 'white',
    fontSize: 16,
    marginTop: 240,
    textAlign: 'center',
  },
  bottomControls: {
    paddingHorizontal: 20,
    gap: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  modeToggleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  manualButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  permissionText: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#875A7B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  manualInputModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  productModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  barcodeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#875A7B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  productDetails: {
    padding: 20,
  },
  productInfo: {
    marginBottom: 24,
  },
  productName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  productMeta: {
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockInfo: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  stockValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  quantitySection: {
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityInput: {
    width: 80,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    backgroundColor: '#F9FAFB',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmButtonIn: {
    backgroundColor: '#10B981',
  },
  confirmButtonOut: {
    backgroundColor: '#EF4444',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});