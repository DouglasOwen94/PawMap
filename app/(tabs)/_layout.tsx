import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { AddPlaceTabIcon, MapTabIcon, SavedTabIcon } from '@/components/TabIcons';
import { Font } from '@/constants/fonts';

// React Navigation sizes the bar at a fixed 49pt plus the safe-area inset,
// which leaves too little room under a 24pt icon for a label with descenders —
// the tail of the "p" in "Map" was cut off by the bar's own bottom edge. Height
// has to be set here rather than nudging the label, because the bar is what
// clips: making the label taller alone just pushed more of it out of view.
// getTabBarHeight returns a custom height verbatim and stops adding the inset
// itself, so the inset has to be added back here or the bar rides up over the
// home indicator on gesture-nav devices.
const TAB_BAR_CONTENT_HEIGHT = 60;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#0A0A0A',
        tabBarInactiveTintColor: '#ABABAB',
        tabBarLabelStyle: {
          fontFamily: Font.medium,
          fontSize: 11,
          lineHeight: 15,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E4',
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
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
