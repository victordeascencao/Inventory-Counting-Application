/* global jest */
// Never use a real Odoo connection or device storage in these tests.
jest.mock('axios', () => ({
  post: jest.fn(() => Promise.reject(new Error('Unexpected HTTP request in test'))),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

global.fetch = jest.fn(() => Promise.reject(new Error('Network disabled in tests')));
global.XMLHttpRequest = jest.fn(() => {
  throw new Error('Network disabled in tests');
});
