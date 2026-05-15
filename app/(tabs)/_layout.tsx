import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { AddPlaceTabIcon, MapTabIcon, SavedTabIcon } from '@/components/TabIcons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#0A0A0A',
        tabBarInactiveTintColor: '#ABABAB',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E4',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <MapTabIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <SavedTabIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="add-place"
        options={{
          title: 'Add Place',
          tabBarIcon: ({ color }) => <AddPlaceTabIcon color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
