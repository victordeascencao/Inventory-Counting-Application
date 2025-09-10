import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScanHistory } from '../types';

const SCAN_HISTORY_KEY = 'scan_history';

export const saveScanHistory = async (scan: ScanHistory): Promise<void> => {
  try {
    const existingHistory = await getScanHistory();
    existingHistory.unshift(scan);
    // Keep only last 100 scans
    const trimmedHistory = existingHistory.slice(0, 100);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Failed to save scan history:', error);
  }
};

export const getScanHistory = async (): Promise<ScanHistory[]> => {
  try {
    const history = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Failed to get scan history:', error);
    return [];
  }
};

export const clearScanHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCAN_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear scan history:', error);
  }
};