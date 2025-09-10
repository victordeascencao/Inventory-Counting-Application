import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import odooApi from '../services/odooApi';
import { OdooConfig } from '../types';

export default function SettingsScreen() {
  const [config, setConfig] = useState<OdooConfig>({
    url: '',
    db: '',
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    const hasConfig = await odooApi.loadConfig();
    if (hasConfig) {
      setIsConnected(true);
    }
  };

  const testConnection = async () => {
    if (!config.url || !config.db || !config.username || !config.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      await odooApi.saveConfig(config);
      const authenticated = await odooApi.authenticate();
      
      if (authenticated) {
        setIsConnected(true);
        Alert.alert('Success', 'Connected to Odoo successfully!');
      } else {
        Alert.alert('Error', 'Failed to authenticate. Please check your credentials.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to Odoo. Please check your settings.');
    }
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Odoo Configuration</Text>
          {isConnected && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Connected</Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Odoo URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://your-odoo-instance.com"
              value={config.url}
              onChangeText={(text) => setConfig({ ...config, url: text })}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Database Name</Text>
            <TextInput
              style={styles.input}
              placeholder="your_database"
              value={config.db}
              onChangeText={(text) => setConfig({ ...config, db: text })}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@example.com"
              value={config.username}
              onChangeText={(text) => setConfig({ ...config, username: text })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={config.password}
              onChangeText={(text) => setConfig({ ...config, password: text })}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={testConnection}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Testing Connection...' : 'Test Connection & Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Connection Help</Text>
          <Text style={styles.infoText}>
            • URL: Your Odoo instance URL (e.g., https://mycompany.odoo.com)
          </Text>
          <Text style={styles.infoText}>
            • Database: The name of your Odoo database
          </Text>
          <Text style={styles.infoText}>
            • Username: Your Odoo login email
          </Text>
          <Text style={styles.infoText}>
            • Password: Your Odoo password
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#875A7B',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#875A7B',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    padding: 20,
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
});