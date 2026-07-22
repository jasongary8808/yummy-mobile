import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

// Your Mac's local network IP + backend port
const API_URL = 'http://192.168.1.68:8000';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera access to scan your fridge.</Text>
        <TouchableOpacity style={styles.actionButton} onPress={requestPermission}>
          <Text style={styles.actionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Sends a photo (from either camera or file picker) to the backend
  const analyzePhoto = async (photoUri) => {
    setLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: photoUri,
        name: 'fridge.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(`${API_URL}/analyze-fridge`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error analyzing photo:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      analyzePhoto(photo.uri); // auto-trigger, no extra button
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      analyzePhoto(result.assets[0].uri); // auto-trigger, no extra button
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.message}>Analyzing your fridge...</Text>
      </View>
    );
  }

  // Results state
  if (results) {
    return (
      <ScrollView style={styles.resultsContainer}>
        {results.error ? (
          <Text style={styles.errorText}>Error: {results.error}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Ingredients Detected</Text>
            <Text style={styles.bodyText}>{results.ingredients_detected}</Text>

            <Text style={styles.sectionTitle}>Recipes</Text>
            {results.recipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeCard}>
                <Text style={styles.recipeName}>{recipe.name}</Text>
                <Text style={styles.bodyText}>{recipe.description}</Text>
                <Text style={styles.macros}>
                  {recipe.calories} cal | {recipe.protein_grams}g protein | {recipe.prep_time_minutes} min
                </Text>
              </View>
            ))}
          </>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={() => setResults(null)}>
          <Text style={styles.actionButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Default camera screen
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.libraryButton} onPress={pickFromLibrary}>
            <Text style={styles.libraryButtonText}>Upload{'\n'}Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={takePhoto} />

          <View style={styles.libraryButton} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    color: '#fff',
    padding: 20,
    fontSize: 16,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  buttonRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  libraryButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryButtonText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    margin: 20,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginTop: 60,
    textAlign: 'center',
  },
  recipeCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },
  recipeName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  macros: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
});