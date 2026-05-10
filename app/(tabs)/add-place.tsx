import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { Font } from '@/constants/fonts';

export default function AddPlaceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Add a place coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontFamily: Font.regular,
    color: '#ABABAB',
  },
});
