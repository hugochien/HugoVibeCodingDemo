import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EchoLog</Text>
      <Text style={styles.subtitle}>Voice-to-Structured-Data Engine</Text>
      <Text style={styles.hint}>Voice capture coming in Phase 2.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  hint: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
});
