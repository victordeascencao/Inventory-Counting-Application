import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, renderAsync, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import ScannerScreen from '../app/(tabs)/scanner';
import odooApi from '../src/services/odooApi';
import { getScanHistory } from '../src/services/localStorage';

jest.mock('../src/services/odooApi', () => ({
  searchProductByBarcode: jest.fn(),
  createStockMove: jest.fn(),
}));
jest.mock('expo-camera', () => ({
  Camera: { requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }) },
  CameraView: jest.requireActual('react-native').View,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const product = { id: 42, name: 'Test milk', barcode: '6000000000042', quantity: 10 };
const existingScan = {
  id: 'existing-scan', barcode: '6000000000001', product_name: 'Existing stock',
  quantity: 2, type: 'in', timestamp: '2026-10-15T10:00:00Z', synced: true,
};
const createMove = jest.mocked(odooApi.createStockMove);

async function openConfirmation(mode: 'in' | 'out' = 'in') {
  jest.mocked(useLocalSearchParams).mockReturnValue({ mode });
  await renderAsync(<ScannerScreen />);
  fireEvent.press(screen.getByText('Manual Entry'));
  fireEvent.changeText(screen.getByPlaceholderText('Enter barcode number'), product.barcode);
  fireEvent.press(screen.getByText('Search Product'));
  await screen.findByText('Test milk');
  fireEvent.changeText(screen.getByDisplayValue('1'), '6');
  return screen.getByText(mode === 'in' ? 'Add to Stock' : 'Remove from Stock');
}

beforeEach(async () => {
  jest.clearAllMocks();
  createMove.mockReset();
  jest.mocked(odooApi.searchProductByBarcode).mockResolvedValue(product);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await AsyncStorage.clear();
  await AsyncStorage.setItem('scan_history', JSON.stringify([existingScan]));
  jest.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => jest.restoreAllMocks());

it.each(['in', 'out'] as const)('saves a synced %s scan only after Odoo confirmation', async mode => {
  let resolveMove!: (result: boolean) => void;
  createMove.mockReturnValue(new Promise(resolve => { resolveMove = resolve; }));
  const confirm = await openConfirmation(mode);
  fireEvent.press(confirm);

  expect(createMove).toHaveBeenCalledWith({
    product_id: 42, product_name: 'Test milk', barcode: product.barcode,
    quantity: 6, type: mode, location: 'Main Warehouse', timestamp: expect.any(Date),
  });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();

  await act(async () => { resolveMove(true); });

  const history = await getScanHistory();
  expect(history).toEqual([
    expect.objectContaining({ product_id: 42, product_name: 'Test milk', quantity: 6, type: mode, synced: true }),
    existingScan,
  ]);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  expect(Alert.alert).toHaveBeenCalledWith('Transfer Saved', expect.stringContaining('Validate the transfer in Odoo'));
  expect(screen.queryByText('Test milk')).toBeNull();
});

it.each(['rejected', 'network failure'] as const)('does not record a false receipt after a %s', async failure => {
  if (failure === 'rejected') createMove.mockResolvedValue(false);
  else createMove.mockRejectedValue(new Error('Connection lost'));
  fireEvent.press(await openConfirmation());

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Transfer Not Confirmed', expect.stringContaining('before retrying to avoid duplicates')
  ));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(await getScanHistory()).toEqual([existingScan]);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(createMove).toHaveBeenCalledTimes(1);
  // Keep the original product and quantity available for review; do not auto-retry.
  expect(screen.getByText('Test milk')).toBeTruthy();
  expect(screen.getByDisplayValue('6')).toBeTruthy();
  expect(screen.getByText('Add to Stock')).toBeTruthy();
});

it('blocks rapid duplicate confirmation taps while submitting', async () => {
  let resolveMove!: (result: boolean) => void;
  createMove.mockReturnValue(new Promise(resolve => { resolveMove = resolve; }));
  const confirm = await openConfirmation();
  act(() => {
    fireEvent.press(confirm);
    fireEvent.press(confirm);
  });
  expect(createMove).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Cancel'));
  expect(screen.getByText('Test milk')).toBeTruthy();
  await act(async () => { resolveMove(true); });
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
});

it('allows a deliberate retry after a rejection without duplicating history', async () => {
  createMove.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  fireEvent.press(await openConfirmation());
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Transfer Not Confirmed', expect.any(String)));
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('Add to Stock'));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Transfer Saved', expect.any(String)));
  expect(createMove).toHaveBeenCalledTimes(2);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  expect(await getScanHistory()).toHaveLength(2);
});

it('does not report a confirmed transfer as failed if haptic feedback fails', async () => {
  createMove.mockResolvedValue(true);
  jest.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error('Haptics unavailable'));
  fireEvent.press(await openConfirmation());
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Transfer Saved', expect.any(String)));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect((await getScanHistory())[0].synced).toBe(true);
});

it('rejects an invalid quantity without contacting Odoo or changing history', async () => {
  const confirm = await openConfirmation();
  fireEvent.changeText(screen.getByDisplayValue('6'), '0');
  fireEvent.press(confirm);
  expect(Alert.alert).toHaveBeenCalledWith('Invalid Quantity', expect.any(String));
  expect(createMove).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
