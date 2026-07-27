import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// Your Mac's local network IP + backend port
const API_URL = 'http://192.168.1.68:8000';

const COLORS = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  primary: '#E8703A',
  primaryDeep: '#C6572A',
  primarySoft: '#FBE4D6',
  text: '#2B2420',
  textMuted: '#8A7F76',
  border: '#EFE7DD',
  star: '#F2A93B',
  error: '#D64545',
  tabInactive: '#B8ADA2',
};

const LOADING_MESSAGES = [
  'Peeking in your fridge...',
  'Spotting ingredients...',
  'Dreaming up recipes...',
  'Almost there...',
];

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#3A2E22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'scan' | 'library'
  const [flow, setFlow] = useState(null); // null | 'loading' | 'error' | 'results' | 'detail'

  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastPhotoUri, setLastPhotoUri] = useState(null);

  const [allRecipes, setAllRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetails, setRecipeDetails] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [username, setUsername] = useState('');
  const [selectedStars, setSelectedStars] = useState(0);

  const [cameraFacing, setCameraFacing] = useState('back');

  const cameraRef = useRef(null);
  const loadingIntervalRef = useRef(null);

  useEffect(() => {
    fetchAllRecipes();
  }, []);

  const fetchAllRecipes = async () => {
    try {
      const response = await fetch(`${API_URL}/recipes`);
      const data = await response.json();
      setAllRecipes([...data.recipes].reverse());
    } catch (error) {
      console.error('Error fetching recipes:', error);
    }
  };

  const startLoadingMessages = () => {
    let i = 0;
    setLoadingMsgIndex(0);
    loadingIntervalRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsgIndex(i);
    }, 1800);
  };

  const stopLoadingMessages = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  const analyzePhoto = async (photoUri) => {
    setLastPhotoUri(photoUri);
    setFlow('loading');
    startLoadingMessages();

    try {
      const formData = new FormData();
      formData.append('file', { uri: photoUri, name: 'fridge.jpg', type: 'image/jpeg' });

      const response = await fetch(`${API_URL}/analyze-fridge`, { method: 'POST', body: formData });

      if (!response.ok) throw new Error(`Server error (${response.status}). Please try again.`);

      const data = await response.json();

      if (!data.recipes || data.recipes.length === 0) {
        setErrorMsg("We couldn't find any recipes from that photo. Try a clearer shot of your fridge or pantry.");
        setFlow('error');
      } else {
        setResults(data);
        setFlow('results');
        fetchAllRecipes();
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
      setErrorMsg(
        error.message === 'Network request failed'
          ? "Couldn't reach the server. Make sure your phone and computer are on the same WiFi network."
          : error.message || 'Something went wrong. Please try again.'
      );
      setFlow('error');
    } finally {
      stopLoadingMessages();
    }
  };

  const retryLastPhoto = () => {
    if (lastPhotoUri) analyzePhoto(lastPhotoUri);
    else setFlow(null);
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      analyzePhoto(photo.uri);
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) analyzePhoto(result.assets[0].uri);
  };

  const openRecipeDetails = async (recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetails(null);
    setSelectedStars(0);
    setFlow('detail');

    try {
      const response = await fetch(`${API_URL}/recipes/${recipe.id}/details`);
      const data = await response.json();
      setRecipeDetails(data);
    } catch (error) {
      console.error('Error fetching recipe details:', error);
    }
  };

  const closeFlow = () => {
    setFlow(null);
    setResults(null);
    setSelectedRecipe(null);
    fetchAllRecipes();
  };

  const submitComment = async () => {
    if (!username.trim() || !commentText.trim()) {
      alert('Please enter a username and comment');
      return;
    }
    try {
      await fetch(`${API_URL}/recipes/${selectedRecipe.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, comment_text: commentText }),
      });
      setCommentText('');
      openRecipeDetails(selectedRecipe);
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment');
    }
  };

  const submitRating = async (stars) => {
    if (!username.trim()) {
      alert('Please enter a username first');
      return;
    }
    setSelectedStars(stars);
    try {
      await fetch(`${API_URL}/recipes/${selectedRecipe.id}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, stars }),
      });
      openRecipeDetails(selectedRecipe);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating');
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={48} color={COLORS.primary} style={{ marginBottom: 12 }} />
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.message}>
          We use your camera to scan your fridge or pantry and find recipes you can make right now.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- FULL-SCREEN FLOW OVERLAYS ----------

  if (flow === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{LOADING_MESSAGES[loadingMsgIndex]}</Text>
      </View>
    );
  }

  if (flow === 'error') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{errorMsg}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={retryLastPhoto}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={closeFlow}>
          <Text style={styles.linkButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (flow === 'detail' && selectedRecipe) {
    return (
      <View style={styles.screenRoot}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 60 }}>
          <TouchableOpacity onPress={closeFlow} style={styles.backRow}>
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.recipeDetailName}>{selectedRecipe.name}</Text>
          <Text style={styles.message}>{selectedRecipe.description}</Text>

          <View style={styles.macroRow}>
            <View style={styles.macroPill}>
              <Text style={styles.macroValue}>{selectedRecipe.calories}</Text>
              <Text style={styles.macroLabel}>calories</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={styles.macroValue}>{selectedRecipe.protein_grams}g</Text>
              <Text style={styles.macroLabel}>protein</Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={styles.macroValue}>{selectedRecipe.prep_time_minutes}</Text>
              <Text style={styles.macroLabel}>minutes</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Instructions</Text>
          {selectedRecipe.instructions.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Rating</Text>
          {recipeDetails ? (
            <Text style={styles.message}>
              {recipeDetails.ratings.average_rating
                ? `${recipeDetails.ratings.average_rating.toFixed(1)} ★ (${recipeDetails.ratings.total_ratings} rating${recipeDetails.ratings.total_ratings === 1 ? '' : 's'})`
                : 'No ratings yet — be the first!'}
            </Text>
          ) : (
            <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 10 }} />
          )}

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={COLORS.textMuted}
            value={username}
            onChangeText={setUsername}
          />

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => submitRating(star)} hitSlop={8}>
                <Ionicons
                  name={star <= selectedStars ? 'star' : 'star-outline'}
                  size={30}
                  color={COLORS.star}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.starHint}>Tap a star to rate</Text>

          <Text style={styles.sectionTitle}>Comments</Text>
          {recipeDetails ? (
            recipeDetails.comments.length > 0 ? (
              recipeDetails.comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <Text style={styles.commentUsername}>{comment.username}</Text>
                  <Text style={styles.message}>{comment.comment_text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.message}>No comments yet. Be the first!</Text>
            )
          ) : (
            <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 10 }} />
          )}

          <TextInput
            style={[styles.input, styles.commentInput]}
            placeholder="Write a comment..."
            placeholderTextColor={COLORS.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <TouchableOpacity style={styles.primaryButton} onPress={submitComment}>
            <Text style={styles.primaryButtonText}>Post Comment</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (flow === 'results' && results) {
    return (
      <View style={styles.screenRoot}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.sectionTitleTop}>Ingredients Detected</Text>
          <View style={styles.ingredientsBox}>
            <Text style={styles.message}>{results.ingredients_detected}</Text>
          </View>

          <Text style={styles.sectionTitle}>Recipes For You</Text>
          {results.recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={[styles.recipeCard, cardShadow]}
              activeOpacity={0.7}
              onPress={() => openRecipeDetails(recipe)}
            >
              <Text style={styles.recipeName}>{recipe.name}</Text>
              <Text style={styles.message}>{recipe.description}</Text>
              <View style={styles.macroRowSmall}>
                <Text style={styles.macroTextSmall}>{recipe.calories} cal</Text>
                <Text style={styles.macroDot}>·</Text>
                <Text style={styles.macroTextSmall}>{recipe.protein_grams}g protein</Text>
                <Text style={styles.macroDot}>·</Text>
                <Text style={styles.macroTextSmall}>{recipe.prep_time_minutes} min</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.primaryButton} onPress={closeFlow}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ---------- MAIN TAB SCREENS ----------

  const renderHome = () => (
    <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.brandBlock}>
        <View style={styles.logoCircle}>
          <Ionicons name="nutrition" size={32} color="#fff" />
        </View>
        <Text style={styles.brandName}>Yummy</Text>
        <Text style={styles.brandTagline}>Turn your fridge into dinner</Text>
      </View>

      <TouchableOpacity
        style={[styles.ctaCard, cardShadow]}
        activeOpacity={0.85}
        onPress={() => setActiveTab('scan')}
      >
        <View style={styles.ctaIconWrap}>
          <Ionicons name="camera" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Scan Your Fridge</Text>
          <Text style={styles.ctaSubtitle}>Snap a photo and get recipes instantly</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleTop}>Recent Recipes</Text>
        {allRecipes.length > 0 && (
          <TouchableOpacity onPress={() => setActiveTab('library')}>
            <Text style={styles.seeAllLink}>See all</Text>
          </TouchableOpacity>
        )}
      </View>

      {allRecipes.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Ionicons name="restaurant-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>
            No recipes yet — scan your fridge to get started.
          </Text>
        </View>
      ) : (
        allRecipes.slice(0, 4).map((recipe) => (
          <TouchableOpacity
            key={recipe.id}
            style={[styles.recipeCard, cardShadow]}
            activeOpacity={0.7}
            onPress={() => openRecipeDetails(recipe)}
          >
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.message} numberOfLines={2}>{recipe.description}</Text>
            <View style={styles.macroRowSmall}>
              <Text style={styles.macroTextSmall}>{recipe.calories} cal</Text>
              <Text style={styles.macroDot}>·</Text>
              <Text style={styles.macroTextSmall}>{recipe.protein_grams}g protein</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderLibrary = () => (
    <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.pageTitle}>Your Recipes</Text>
      {allRecipes.length === 0 ? (
        <View style={styles.emptyStateBox}>
          <Ionicons name="restaurant-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.emptyStateText}>
            No recipes yet — scan your fridge to get started.
          </Text>
        </View>
      ) : (
        allRecipes.map((recipe) => (
          <TouchableOpacity
            key={recipe.id}
            style={[styles.recipeCard, cardShadow]}
            activeOpacity={0.7}
            onPress={() => openRecipeDetails(recipe)}
          >
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.message} numberOfLines={2}>{recipe.description}</Text>
            <View style={styles.macroRowSmall}>
              <Text style={styles.macroTextSmall}>{recipe.calories} cal</Text>
              <Text style={styles.macroDot}>·</Text>
              <Text style={styles.macroTextSmall}>{recipe.protein_grams}g protein</Text>
              <Text style={styles.macroDot}>·</Text>
              <Text style={styles.macroTextSmall}>{recipe.prep_time_minutes} min</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderScan = () => (
    <View style={styles.cameraScreen}>
      <StatusBar barStyle="light-content" />
      <CameraView style={styles.camera} facing={cameraFacing} ref={cameraRef}>
        <View style={styles.cameraOverlayTop}>
          <Text style={styles.cameraOverlayTitle}>Scan Your Fridge</Text>
          <Text style={styles.cameraOverlaySubtitle}>Fill the frame for best results</Text>
        </View>
  
        <View style={styles.cameraButtonRow}>
          <TouchableOpacity style={styles.sideButton} onPress={pickFromLibrary} activeOpacity={0.7}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={styles.sideButtonText}>Upload</Text>
          </TouchableOpacity>
  
          <TouchableOpacity style={styles.captureButtonOuter} onPress={takePhoto} activeOpacity={0.8}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
  
          <TouchableOpacity style={styles.sideButton} onPress={toggleCameraFacing} activeOpacity={0.7}>
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            <Text style={styles.sideButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );

  return (
    <View style={styles.appRoot}>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'library' && renderLibrary()}
      {activeTab === 'scan' && renderScan()}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'home' ? COLORS.primary : COLORS.tabInactive}
          />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItemCenter} onPress={() => setActiveTab('scan')}>
          <View style={[styles.tabCenterButton, activeTab === 'scan' && styles.tabCenterButtonActive]}>
            <Ionicons name="camera" size={24} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('library')}>
          <Ionicons
            name={activeTab === 'library' ? 'book' : 'book-outline'}
            size={24}
            color={activeTab === 'library' ? COLORS.primary : COLORS.tabInactive}
          />
          <Text style={[styles.tabLabel, activeTab === 'library' && styles.tabLabelActive]}>Recipes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // Home
  brandBlock: {
    alignItems: 'center',
    marginBottom: 26,
    marginTop: 6,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...cardShadow,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  brandTagline: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  ctaSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 10,
  },
  seeAllLink: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  emptyStateBox: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },

  // Camera
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlayTop: { paddingTop: 64, paddingHorizontal: 24 },
  cameraOverlayTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cameraOverlaySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  cameraButtonRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  captureButtonOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.primary,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Buttons
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkButton: { marginTop: 14 },
  linkButtonText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },

  // Sections / cards
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitleTop: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  ingredientsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recipeCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recipeName: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  macroRowSmall: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  macroTextSmall: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  macroDot: { fontSize: 12, color: COLORS.textMuted, marginHorizontal: 6 },

  // Detail
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backLink: { color: COLORS.primary, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  recipeDetailName: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 8, marginBottom: 6 },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 6 },
  macroPill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    flex: 1,
  },
  macroValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  macroLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  stepRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumberText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },

  // Comments / rating
  commentCard: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentUsername: { fontWeight: '700', fontSize: 13, color: COLORS.text, marginBottom: 2 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  commentInput: { minHeight: 70, textAlignVertical: 'top' },
  starRow: { flexDirection: 'row', gap: 10 },
  starHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, marginBottom: 8 },

  // Bottom tab bar
  tabBar: {
    flexDirection: 'row',
    height: 78,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 18,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.tabInactive,
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabItemCenter: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  tabCenterButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -22,
    ...cardShadow,
  },
  tabCenterButtonActive: {
    backgroundColor: COLORS.primary,
  },
});