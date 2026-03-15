import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { initDB } from './src/db/database';
import { THEME } from './src/utils/constants';
import { AppProvider } from './src/utils/AppContext';

import DashboardScreen from './src/screens/DashboardScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AddTransactionScreen from './src/screens/AddTransactionScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SavingsGoalsScreen from './src/screens/SavingsGoalsScreen';
import ManageCategoriesScreen from './src/screens/ManageCategoriesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TABS = [
  { name: 'Dashboard',     icon: '🏠', label: 'Home' },
  { name: 'Transactions',  icon: '📋', label: 'History' },
  { name: 'Budgets',       icon: '🎯', label: 'Budgets' },
  { name: 'Goals',         icon: '⭐', label: 'Goals' },
  { name: 'Reports',       icon: '📊', label: 'Reports' },
];

function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarOuter, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS.find(t => t.name === route.name);

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={() => {
                if (!focused) navigation.navigate(route.name);
              }}
              activeOpacity={0.7}
            >
              {focused && <View style={styles.tabPill} />}
              <Text style={[styles.tabIcon, { opacity: focused ? 1 : 0.45 }]}>
                {tab?.icon}
              </Text>
              <Text style={[styles.tabLabel, { color: focused ? THEME.primary : THEME.textSecondary, fontWeight: focused ? '700' : '500' }]}>
                {tab?.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: THEME.surface, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { color: THEME.textPrimary, fontWeight: '700', fontSize: 18 },
        headerShown: false,
      }}
    >
      {TABS.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={
          tab.name === 'Dashboard'    ? DashboardScreen    :
          tab.name === 'Transactions' ? TransactionsScreen :
          tab.name === 'Budgets'      ? BudgetsScreen      :
          tab.name === 'Goals'        ? SavingsGoalsScreen :
          ReportsScreen
        } />
      ))}
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDB().then(() => setReady(true)).catch(e => setError(e.message));
  }, []);

  if (error) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Failed to initialize database</Text>
      <Text style={styles.errorDetail}>{error}</Text>
    </View>
  );

  if (!ready) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={THEME.primary} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.transaction ? 'Edit Transaction' : 'New Transaction',
                presentation: 'modal',
                headerStyle: { backgroundColor: THEME.surface },
                headerTitleStyle: { color: THEME.textPrimary, fontWeight: '700' },
              })}
            />
            <Stack.Screen
              name="ManageCategories"
              component={ManageCategoriesScreen}
              options={{
                headerShown: false,
                presentation: 'modal',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.background },
  loadingText: { marginTop: 12, color: THEME.textSecondary, fontSize: 15 },
  errorText: { color: '#F44336', fontSize: 16, fontWeight: '700' },
  errorDetail: { color: THEME.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },

  // Floating tab bar
  tabBarOuter: {
    position: 'absolute', left: 16, right: 16,
  },
  tabBarInner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#0D9488',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 16,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4, borderRadius: 20, gap: 2, position: 'relative',
  },
  tabPill: {
    position: 'absolute', top: 0, left: 4, right: 4, bottom: 0,
    backgroundColor: '#CCFBF1', borderRadius: 16,
  },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 9, letterSpacing: 0.1 },
});
