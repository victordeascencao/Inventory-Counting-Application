# 📦 Odoo Inventory Scanner

A professional React Native mobile application for inventory management with full Odoo ERP integration. Features real-time barcode scanning, batch processing, and comprehensive inventory tracking.

![Expo](https://img.shields.io/badge/Expo-SDK%2053-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.79.5-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Odoo](https://img.shields.io/badge/Odoo-Compatible-875A7B?style=for-the-badge&logo=odoo&logoColor=white)

## Features

- **Barcode Scanning**: Use device camera to scan product barcodes
- **Odoo Integration**: Direct integration with Odoo ERP system
- **Scan In/Out**: Track inventory movements (stock in/out)
- **Inventory View**: Browse and search current inventory
- **History Tracking**: View scan history with timestamps
- **Offline Support**: Local storage for scan history
- **Manual Entry**: Option to manually enter barcodes

## Tech Stack

- React Native with Expo
- TypeScript
- Expo Camera for barcode scanning
- Axios for API calls
- React Navigation for app navigation
- AsyncStorage for local data persistence
- Expo Secure Store for credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/victordeascencao/Inventory-Counting-Application.git
cd inventory-counting-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Run on device/simulator:
- iOS: `npm run ios`
- Android: `npm run android`
- Web: `npm run web`

## Configuration

1. Launch the app
2. Navigate to Settings tab
3. Enter your Odoo configuration:
   - **URL**: Your Odoo instance URL (e.g., https://mycompany.odoo.com)
   - **Database**: Your Odoo database name
   - **Username**: Your Odoo login email
   - **Password**: Your Odoo password
4. Test connection to verify settings

## Usage

### Scanning Products

1. Go to Scanner tab
2. Select mode (SCAN IN or SCAN OUT)
3. Point camera at barcode
4. Confirm quantity and action
5. After Odoo confirms transfer creation, the scan is saved locally as synced
6. Validate the transfer in Odoo to complete the stock movement

The scanner creates a `stock.picking` record; `synced` means Odoo confirmed
creation, not that the receipt or delivery has been validated. If confirmation
fails, the scanner keeps the product and quantity for review and does not save a
synced scan. Check Odoo before retrying: a lost network response can leave the
outcome uncertain, and creating transfers is not idempotent.

### Manual Entry

1. Use the manual entry field at bottom of scanner
2. Type barcode number
3. Press Search
4. Follow same confirmation process

### Viewing Inventory

1. Navigate to Inventory tab
2. Search products by name, barcode, or reference
3. View current stock levels
4. Pull to refresh

### History

1. Go to History tab
2. View all scan transactions
3. See timestamps and quantities
4. Clear history if needed

## API Integration

The app integrates with Odoo through the JSON-RPC API, supporting:
- Product search by barcode
- Stock move creation
- Inventory queries
- Quantity updates

## Security

- Credentials stored securely using Expo Secure Store
- Session-based authentication with Odoo
- No sensitive data in local storage

## Requirements

- Node.js 16+
- Expo CLI
- iOS 13+ / Android 5+
- Camera permissions for barcode scanning
- Active Odoo instance with API access

## Development

To run in development mode:

```bash
npm start
```

This will start the Expo development server. Use the Expo Go app on your device to test.

### Receiving regression tests

```bash
npm ci
npm test -- --watch=false
```

These tests use Jest with the Expo preset. HTTP, credentials, device APIs, and
local storage are mocked; no live Odoo instance or existing inventory data is
accessed. Coverage includes confirmed transfers, rejected/invalid JSON-RPC
responses, authentication and network failures, preservation of existing history,
and duplicate submission prevention. The tests do not establish compatibility
with a particular live Odoo version or validate receipts against purchase orders.

## Building for Production

For standalone apps:

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
