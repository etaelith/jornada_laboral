import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarLabelStyle: { fontSize: 12 }, tabBarStyle: { minHeight: 60 } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarAccessibilityLabel: 'Inicio' }} />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendario', tabBarAccessibilityLabel: 'Calendario' }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Estadísticas', tabBarAccessibilityLabel: 'Estadísticas' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Configuración', tabBarAccessibilityLabel: 'Configuración' }}
      />
    </Tabs>
  );
}
