import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import odooApi from '../services/odooApi';
import { saveScanHistory } from '../services/localStorage';
import { Product, ScanHistory } from '../types';

export default function ScannerScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanMode, setScanMode] = useState<'in' | 'out'>('in');
  const [modalVisible, setModalVisible] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [manualBarcode, setManualBarcode] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    try {
      const product = await odooApi.searchProductByBarcode(data);
      
      if (product) {
        setScannedProduct(product);
        setModalVisible(true);
      } else {
        Alert.alert('Product Not Found', `No product found with barcode: ${data}`);
        setTimeout(() => setScanned(false), 2000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search product. Check your Odoo connection.');
      setScanned(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualBarcode) {
      Alert.alert('Error', 'Please enter a barcode');
      return;
    }

    try {
      const product = await odooApi.searchProductByBarcode(manualBarcode);
      
      if (product) {
        setScannedProduct(product);
        setModalVisible(true);
        setManualBarcode('');
      } else {
        Alert.alert('Product Not Found', `No product found with barcode: ${manualBarcode}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search product. Check your Odoo connection.');
    }
  };

  const confirmScan = async () => {
    if (!scannedProduct) return;

    const qty = parseInt(quantity) || 1;
    const newQuantity = scanMode === 'in' 
      ? scannedProduct.quantity + qty 
      : Math.max(0, scannedProduct.quantity - qty);

    try {
      const moveSuccess = await odooApi.createStockMove({
        product_id: scannedProduct.id,
        product_name: scannedProduct.name,
        quantity: qty,
        type: scanMode,
        location: 'Main Warehouse',
        timestamp: new Date(),
        barcode: scannedProduct.barcode,
      });

      if (moveSuccess) {
        const scan: ScanHistory = {
          id: Date.now().toString(),
          barcode: scannedProduct.barcode,
          product_name: scannedProduct.name,
          quantity: qty,
          type: scanMode,
          timestamp: new Date(),
        };
        
        await saveScanHistory(scan);
        
        Alert.alert(
          'Success',
          `${scanMode === 'in' ? 'Added' : 'Removed'} ${qty} x ${scannedProduct.name}\nNew quantity: ${newQuantity}`
        );
      } else {
        Alert.alert('Error', 'Failed to update inventory in Odoo');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process scan');
    }

    setModalVisible(false);
    setScannedProduct(null);
    setQuantity('1');
    setTimeout(() => setScanned(false), 1000);
  };

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory Scanner</Text>
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === 'in' && styles.activeMode]}
            onPress={() => setScanMode('in')}
          >
            <Text style={[styles.modeText, scanMode === 'in' && styles.activeModeText]}>
              SCAN IN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, scanMode === 'out' && styles.activeMode]}
            onPress={() => setScanMode('out')}
          >
            <Text style={[styles.modeText, scanMode === 'out' && styles.activeModeText]}>
              SCAN OUT
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
        </View>
      </CameraView>

      <View style={styles.manualEntry}>
        <TextInput
          style={styles.input}
          placeholder="Enter barcode manually"
          value={manualBarcode}
          onChangeText={setManualBarcode}
          keyboardType="default"
        />
        <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
          <Text style={styles.manualButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {scanned && (
        <TouchableOpacity
          style={styles.rescanButton}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.rescanText}>Tap to Scan Again</Text>
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {scannedProduct && (
              <>
                <Text style={styles.modalTitle}>Product Found</Text>
                <ScrollView style={styles.productInfo}>
                  <Text style={styles.productName}>{scannedProduct.name}</Text>
                  <Text style={styles.productDetail}>Barcode: {scannedProduct.barcode}</Text>
                  <Text style={styles.productDetail}>
                    Current Stock: {scannedProduct.quantity}
                  </Text>
                  {scannedProduct.internal_reference && (
                    <Text style={styles.productDetail}>
                      Reference: {scannedProduct.internal_reference}
                    </Text>
                  )}
                </ScrollView>

                <View style={styles.quantitySection}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setModalVisible(false);
                      setScanned(false);
                    }}
                  >
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={confirmScan}
                  >
                    <Text style={styles.buttonText}>
                      {scanMode === 'in' ? 'Add to Stock' : 'Remove from Stock'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
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
    textAlign: 'center',
    marginBottom: 15,
  },
  modeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modeButton: {
    paddingHorizontal: 30,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
    borderRadius: 20,
  },
  activeMode: {
    backgroundColor: 'white',
  },
  modeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  activeModeText: {
    color: '#875A7B',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  manualEntry: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  manualButton: {
    backgroundColor: '#875A7B',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 5,
  },
  manualButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  rescanButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: '#875A7B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  rescanText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  productInfo: {
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  productDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    width: 80,
    textAlign: 'center',
    borderRadius: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  confirmButton: {
    backgroundColor: '#875A7B',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});