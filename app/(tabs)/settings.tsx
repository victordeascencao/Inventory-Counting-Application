import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import odooApi from '../../src/services/odooApi';
import { OdooConfig } from '../../src/types';

export default function SettingsScreen() {
  const [config, setConfig] = useState<OdooConfig>({
    url: '',
    db: '',
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadExistingConfig();
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadExistingConfig = async () => {
    const hasConfig = await odooApi.loadConfig();
    if (hasConfig) {
      setIsConnected(true);
      // Note: We can't retrieve the actual config values for security
      // User will need to re-enter if they want to change
    }
  };

  const testConnection = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (!config.url || !config.db || !config.username || !config.password) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      Alert.alert('Invalid URL', 'Please enter a valid URL (e.g., https://mycompany.odoo.com)');
      return;
    }

    setIsLoading(true);
    try {
      await odooApi.saveConfig(config);
      const authenticated = await odooApi.authenticate();
      
      if (authenticated) {
        setIsConnected(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success', 
          'Connected to Odoo successfully!',
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Authentication Failed', 
          'Please check your credentials and try again.'
        );
        setIsConnected(false);
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Connection Failed', 
        'Unable to connect to Odoo. Please check your settings and network connection.'
      );
      setIsConnected(false);
    }
    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Disconnect from Odoo',
      'Are you sure you want to disconnect? You will need to re-enter your credentials.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            // Clear config
            setConfig({
              url: '',
              db: '',
              username: '',
              password: '',
            });
            setIsConnected(false);
            Alert.alert('Disconnected', 'You have been disconnected from Odoo.');
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {isConnected && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#28A745" />
              <Text style={styles.statusTitle}>Connected to Odoo</Text>
            </View>
            <Text style={styles.statusText}>
              Your app is connected and syncing with your Odoo instance.
            </Text>
            <TouchableOpacity 
              style={styles.disconnectButton} 
              onPress={handleDisconnect}
              activeOpacity={0.7}
            >
              <Ionicons name="unlink" size={18} color="#DC3545" />
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Odoo Connection Settings</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Odoo URL *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="globe-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="https://mycompany.odoo.com"
                placeholderTextColor="#999"
                value={config.url}
                onChangeText={(text) => setConfig({ ...config, url: text })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <Text style={styles.helpText}>Your Odoo instance URL</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Database Name *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="server-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="mycompany"
                placeholderTextColor="#999"
                value={config.db}
                onChangeText={(text) => setConfig({ ...config, db: text })}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.helpText}>The name of your Odoo database</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username (Email) *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="admin@example.com"
                placeholderTextColor="#999"
                value={config.username}
                onChangeText={(text) => setConfig({ ...config, username: text })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
            <Text style={styles.helpText}>Your Odoo login email</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={config.password}
                onChangeText={(text) => setConfig({ ...config, password: text })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.eyeButton}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPassword(!showPassword);
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>Your Odoo password</Text>
          </View>

          <TouchableOpacity
            style={[styles.connectButton, isLoading && styles.disabledButton]}
            onPress={testConnection}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="link" size={20} color="white" />
                <Text style={styles.connectButtonText}>
                  Test Connection & Save
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#875A7B" />
            <Text style={styles.infoTitle}>How to Connect</Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>URL:</Text> Your Odoo instance address
              {'\n'}Example: https://mycompany.odoo.com
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Database:</Text> Usually your company name
              {'\n'}Contact your Odoo admin if unsure
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Credentials:</Text> Use your Odoo login email and password
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Permissions:</Text> Ensure your user has inventory access rights
            </Text>
          </View>
        </View>

        <Animated.View 
          style={[
            styles.settingsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.settingsTitle}>App Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="sync" size={24} color="#875A7B" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Auto Sync</Text>
                <Text style={styles.settingDescription}>
                  Automatically sync inventory changes
                </Text>
              </View>
            </View>
            <Switch
              value={autoSync}
              onValueChange={async (value) => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAutoSync(value);
              }}
              trackColor={{ false: '#E5E5E5', true: '#D4C4CE' }}
              thumbColor={autoSync ? '#875A7B' : '#999'}
            />
          </View>

          <View style={styles.settingDivider} />

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait" size={24} color="#875A7B" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Haptic Feedback</Text>
                <Text style={styles.settingDescription}>
                  Vibration feedback for actions
                </Text>
              </View>
            </View>
            <Switch
              value={hapticFeedback}
              onValueChange={async (value) => {
                if (value) {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setHapticFeedback(value);
              }}
              trackColor={{ false: '#E5E5E5', true: '#D4C4CE' }}
              thumbColor={hapticFeedback ? '#875A7B' : '#999'}
            />
          </View>
        </Animated.View>

        <View style={styles.versionCard}>
          <Text style={styles.versionText}>Odoo Inventory Scanner</Text>
          <Text style={styles.versionNumber}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  statusText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  disconnectButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderRadius: 8,
  },
  disconnectText: {
    color: '#DC3545',
    fontWeight: '600',
    fontSize: 15,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 52,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 17,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 8,
    padding: 10,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  connectButton: {
    backgroundColor: '#875A7B',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    minHeight: 56,
  },
  disabledButton: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFF9FC',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0E5EC',
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#875A7B',
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoBullet: {
    color: '#875A7B',
    marginRight: 8,
    fontSize: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: '#333',
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
  versionCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  versionNumber: {
    fontSize: 12,
    color: '#BBB',
  },
});