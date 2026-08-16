import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { AddPlaceTabIcon, MapTabIcon, SavedTabIcon } from '@/components/TabIcons';
import { Font } from '@/constants/fonts';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#0A0A0A',
        tabBarInactiveTintColor: '#ABABAB',
        // lineHeight is set explicitly, not left to the default: the label
        // renders with numberOfLines={1}, which on web becomes an
        // overflow-hidden line box sized by the browser's default line
        // height. That box is a shade too short for Urbanist's descenders,
        // so the tail of the "p" in "Map" was being sliced off.
        tabBarLabelStyle: {
          fontFamily: Font.medium,
          fontSize: 11,
          lineHeight: 15,
        },
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
