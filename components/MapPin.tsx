import { StyleSheet, View } from 'react-native';

type Props = {
  color: string;
  opacity?: number;
};

export function MapPin({ color, opacity = 1 }: Props) {
  return (
    <View style={[styles.outer, { opacity }]} collapsable={false}>
      <View style={[styles.inner, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  inner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
