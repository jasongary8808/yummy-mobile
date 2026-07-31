import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Animated,
  ActivityIndicator,
  ScrollView,
  TextInput,
  StatusBar,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_URL = 'http://192.168.1.68:8000';

const COLORS = {
  bg: '#F7F3EE',
  surface: '#FFFFFF',
  ink: '#241E18',
  inkMuted: '#8B8178',
  coral: '#FF6B47',
  coralDeep: '#E44F27',
  coralSoft: '#FFE4DB',
  sage: '#57826A',
  sageSoft: '#E3EEE7',
  gold: '#EFA83C',
  goldSoft: '#FBEAD0',
  plum: '#A8567A',
  plumSoft: '#F3E0EA',
  teal: '#3C8DA3',
  tealSoft: '#DCEEF2',
  line: '#EBE3D8',
  cream: '#FBF6EF',
};

const LOADING_MESSAGES = [
  'Peeking in your fridge...',
  'Spotting ingredients...',
  'Dreaming up recipes...',
  'Plating it all up...',
];

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other'];
const CATEGORY_META = {
  Breakfast: { icon: 'sunny-outline', bg: COLORS.goldSoft, text: '#9A6B1B', bar: COLORS.gold },
  Lunch: { icon: 'fast-food-outline', bg: COLORS.sageSoft, text: COLORS.sage, bar: COLORS.sage },
  Dinner: { icon: 'moon-outline', bg: COLORS.coralSoft, text: COLORS.coralDeep, bar: COLORS.coral },
  Dessert: { icon: 'ice-cream-outline', bg: COLORS.plumSoft, text: COLORS.plum, bar: COLORS.plum },
  Snack: { icon: 'nutrition-outline', bg: COLORS.tealSoft, text: COLORS.teal, bar: COLORS.teal },
  Other: { icon: 'restaurant-outline', bg: '#EFEAE3', text: COLORS.inkMuted, bar: COLORS.inkMuted },
};
const SORT_OPTIONS = ['Newest', 'Top Rated', 'Quickest'];

const shadow = Platform.select({
  ios: { shadowColor: '#241E18', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14 },
  android: { elevation: 3 },
  default: {},
});

function haptic(style = 'light') {
  if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function Pressy({ onPress, onLongPress, style, children, scaleTo = 0.96 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Pressable onPressIn={() => animateTo(scaleTo)} onPressOut={() => animateTo(1)} onPress={onPress} onLongPress={onLongPress}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function Logo({ size = 64 }) {
  return (
    <LinearGradient colors={[COLORS.coral, COLORS.coralDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.logoGradient, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Ionicons name="restaurant" size={size * 0.48} color="#fff" />
    </LinearGradient>
  );
}

function MacroBar({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={styles.macroBarRow}>
      <Text style={styles.macroBarLabel}>{label}</Text>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[styles.recipeCard, { opacity }]}>
      <View style={styles.skelLine1} />
      <View style={styles.skelLine2} />
      <View style={styles.skelLine3} />
    </Animated.View>
  );
}

function EmptyState({ text, icon = 'restaurant-outline' }) {
  return (
    <View style={styles.emptyStateBox}>
      <Ionicons name={icon} size={28} color={COLORS.inkMuted} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function RecipeCard({ recipe, onPress, onToggleFavorite, onDelete, isChefsPick }) {
  const meta = CATEGORY_META[recipe.category] || CATEGORY_META.Other;
  return (
    <Pressy onPress={onPress} onLongPress={onDelete} style={[styles.recipeCard, shadow]}>
      <View style={[styles.cardAccent, { backgroundColor: meta.bar }]} />
      {isChefsPick && (
        <View style={styles.chefsPickBadge}>
          <Ionicons name="ribbon" size={12} color="#fff" />
          <Text style={styles.chefsPickText}>Chef's Pick</Text>
        </View>
      )}
      <View style={styles.recipeCardBody}>
        <View style={styles.recipeCardTopRow}>
          <View style={[styles.categoryTag, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={12} color={meta.text} />
            <Text style={[styles.categoryTagText, { color: meta.text }]}>{recipe.category}</Text>
          </View>
          <TouchableOpacity onPress={() => { haptic(); onToggleFavorite(); }} hitSlop={10}>
            <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={20} color={COLORS.coral} />
          </TouchableOpacity>
        </View>

        <Text style={styles.recipeName}>{recipe.name}</Text>
        <Text style={styles.message} numberOfLines={2}>{recipe.description}</Text>

        <View style={styles.macroRowSmall}>
          <Text style={styles.macroTextSmall}>{recipe.calories} cal</Text>
          <Text style={styles.macroDot}>·</Text>
          <Text style={styles.macroTextSmall}>{recipe.protein_grams}g protein</Text>
          <Text style={styles.macroDot}>·</Text>
          <Text style={styles.macroTextSmall}>{recipe.prep_time_minutes} min</Text>
        </View>

        <View style={styles.cardFooterRow}>
          {recipe.average_rating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.gold} />
              <Text style={styles.ratingText}>{recipe.average_rating.toFixed(1)} ({recipe.rating_count})</Text>
            </View>
          ) : (
            <Text style={styles.ratingTextMuted}>No ratings yet</Text>
          )}
          <Text style={styles.dateTextSmall}>{timeAgo(recipe.created_at)}</Text>
        </View>
      </View>
    </Pressy>
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState('home');
  const [flow, setFlow] = useState(null);

  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastPhotoUri, setLastPhotoUri] = useState(null);

  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetails, setRecipeDetails] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [username, setUsername] = useState('');
  const [selectedStars, setSelectedStars] = useState(0);
  const [cameraFacing, setCameraFacing] = useState('back');

  const cameraRef = useRef(null);
  const loadingIntervalRef = useRef(null);

  useEffect(() => { fetchAllRecipes(); }, []);

  const fetchAllRecipes = async () => {
    try {
      const response = await fetch(`${API_URL}/recipes`);
      const data = await response.json();
      setAllRecipes(data.recipes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoadingRecipes(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchAllRecipes(); };

  const startLoadingMessages = () => {
    let i = 0;
    setLoadingMsgIndex(0);
    loadingIntervalRef.current = setInterval(() => { i = (i + 1) % LOADING_MESSAGES.length; setLoadingMsgIndex(i); }, 1800);
  };
  const stopLoadingMessages = () => {
    if (loadingIntervalRef.current) { clearInterval(loadingIntervalRef.current); loadingIntervalRef.current = null; }
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
        haptic('success');
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

  const retryLastPhoto = () => { if (lastPhotoUri) analyzePhoto(lastPhotoUri); else setFlow(null); };

  const takePhoto = async () => {
    if (cameraRef.current) {
      haptic('medium');
      const photo = await cameraRef.current.takePictureAsync();
      analyzePhoto(photo.uri);
    }
  };

  const toggleCameraFacing = () => { haptic(); setCameraFacing((c) => (c === 'back' ? 'front' : 'back')); };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) analyzePhoto(result.assets[0].uri);
  };

  const openRecipeDetails = async (recipe) => {
    haptic();
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

  const closeFlow = () => { setFlow(null); setResults(null); setSelectedRecipe(null); fetchAllRecipes(); };

  const submitComment = async () => {
    if (!username.trim() || !commentText.trim()) { alert('Please enter a username and comment'); return; }
    try {
      await fetch(`${API_URL}/recipes/${selectedRecipe.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, comment_text: commentText }),
      });
      haptic('success');
      setCommentText('');
      openRecipeDetails(selectedRecipe);
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment');
    }
  };

  const submitRating = async (stars) => {
    if (!username.trim()) { alert('Please enter a username first'); return; }
    haptic('success');
    setSelectedStars(stars);
    try {
      await fetch(`${API_URL}/recipes/${selectedRecipe.id}/ratings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, stars }),
      });
      openRecipeDetails(selectedRecipe);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating');
    }
  };

  const toggleFavorite = async (recipeId) => {
    setAllRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, is_favorite: !r.is_favorite } : r)));
    if (selectedRecipe?.id === recipeId) setSelectedRecipe((prev) => ({ ...prev, is_favorite: !prev.is_favorite }));
    try {
      const response = await fetch(`${API_URL}/recipes/${recipeId}/favorite`, { method: 'POST' });
      const data = await response.json();
      setAllRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, is_favorite: data.is_favorite } : r)));
      if (selectedRecipe?.id === recipeId) setSelectedRecipe((prev) => ({ ...prev, is_favorite: data.is_favorite }));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const deleteRecipe = async (recipeId) => {
    try {
      await fetch(`${API_URL}/recipes/${recipeId}`, { method: 'DELETE' });
      haptic('success');
      setAllRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      if (selectedRecipe?.id === recipeId) closeFlow();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe');
    }
  };

  const confirmDelete = (recipe) => {
    Alert.alert('Delete Recipe?', `"${recipe.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecipe(recipe.id) },
    ]);
  };

  if (!permission) return <View style={styles.container}><ActivityIndicator size="large" color={COLORS.coral} /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={48} color={COLORS.coral} style={{ marginBottom: 12 }} />
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.message}>We use your camera to scan your fridge or pantry and find recipes you can make right now.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (flow === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.coral} />
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
    const meta = CATEGORY_META[selectedRecipe.category] || CATEGORY_META.Other;
    return (
      <View style={styles.screenRoot}>
        <StatusBar barStyle="dark-content" />
        <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={closeFlow} style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={COLORS.coral} />
              <Text style={styles.backLink}>Back</Text>
            </TouchableOpacity>
            <View style={styles.detailHeaderActions}>
              <TouchableOpacity onPress={() => confirmDelete(selectedRecipe)} hitSlop={8} style={{ marginRight: 18 }}>
                <Ionicons name="trash-outline" size={22} color={COLORS.inkMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { haptic(); toggleFavorite(selectedRecipe.id); }} hitSlop={8}>
                <Ionicons name={selectedRecipe.is_favorite ? 'heart' : 'heart-outline'} size={26} color={COLORS.coral} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.categoryTag, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={13} color={meta.text} />
            <Text style={[styles.categoryTagText, { color: meta.text }]}>{selectedRecipe.category}</Text>
          </View>

          <Text style={styles.recipeDetailName}>{selectedRecipe.name}</Text>
          <Text style={styles.dateText}>{timeAgo(selectedRecipe.created_at)}</Text>
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

          <View style={styles.macroBarsBox}>
            <MacroBar label="Calories" value={selectedRecipe.calories} max={800} color={COLORS.coral} />
            <MacroBar label="Protein" value={selectedRecipe.protein_grams} max={60} color={COLORS.sage} />
          </View>

          <Text style={styles.sectionTitle}>Instructions</Text>
          {selectedRecipe.instructions.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
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
          ) : <ActivityIndicator color={COLORS.coral} style={{ marginBottom: 10 }} />}

          <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={COLORS.inkMuted} value={username} onChangeText={setUsername} />

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => submitRating(star)} hitSlop={8}>
                <Ionicons name={star <= selectedStars ? 'star' : 'star-outline'} size={30} color={COLORS.gold} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.starHint}>Tap a star to rate</Text>

          <Text style={styles.sectionTitle}>Comments</Text>
          {recipeDetails ? (
            recipeDetails.comments.length > 0 ? (
              recipeDetails.comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{comment.username[0]?.toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentUsername}>{comment.username}</Text>
                    <Text style={styles.message}>{comment.comment_text}</Text>
                  </View>
                </View>
              ))
            ) : <Text style={styles.message}>No comments yet. Be the first!</Text>
          ) : <ActivityIndicator color={COLORS.coral} style={{ marginBottom: 10 }} />}

          <TextInput style={[styles.input, styles.commentInput]} placeholder="Write a comment..." placeholderTextColor={COLORS.inkMuted} value={commentText} onChangeText={setCommentText} multiline />
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
          <View style={styles.ingredientsBox}><Text style={styles.message}>{results.ingredients_detected}</Text></View>

          <Text style={styles.sectionTitle}>Recipes For You</Text>
          {results.recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onPress={() => openRecipeDetails(recipe)}
              onToggleFavorite={() => toggleFavorite(recipe.id)} onDelete={() => confirmDelete(recipe)} />
          ))}

          <TouchableOpacity style={styles.primaryButton} onPress={closeFlow}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const topRatedId = allRecipes.length
    ? allRecipes.reduce((best, r) => ((r.average_rating || 0) > (best?.average_rating || 0) ? r : best), null)?.id
    : null;

  const renderHome = () => (
    <ScrollView style={styles.scrollBodyNoPad} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coral} />}>
      <LinearGradient colors={[COLORS.coralSoft, COLORS.cream]} style={styles.heroBlock}>
        <View style={styles.heroDecorCircle1} />
        <View style={styles.heroDecorCircle2} />
        <View style={styles.brandBlock}>
          <Logo size={64} />
          <Text style={styles.greetingText}>{greeting()}</Text>
          <Text style={styles.brandName}>Welcome to Yummy</Text>
          <Text style={styles.brandTagline}>Turn your fridge into dinner</Text>
        </View>
      </LinearGradient>

      <View style={styles.homeContent}>
        <Pressy onPress={() => setActiveTab('scan')} style={[styles.ctaCard, shadow]}>
          <LinearGradient colors={[COLORS.coral, COLORS.coralDeep]} style={styles.ctaIconWrap}>
            <Ionicons name="camera" size={22} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Scan Your Fridge</Text>
            <Text style={styles.ctaSubtitle}>Snap a photo and get recipes instantly</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.inkMuted} />
        </Pressy>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.coralSoft }]}><Ionicons name="book" size={16} color={COLORS.coralDeep} /></View>
            <Text style={styles.statValue}>{allRecipes.length}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={[styles.statBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.plumSoft }]}><Ionicons name="heart" size={16} color={COLORS.plum} /></View>
            <Text style={styles.statValue}>{allRecipes.filter((r) => r.is_favorite).length}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={[styles.statBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.tealSoft }]}><Ionicons name="grid" size={16} color={COLORS.teal} /></View>
            <Text style={styles.statValue}>{new Set(allRecipes.map((r) => r.category)).size}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleTop}>Recent Recipes</Text>
          {allRecipes.length > 0 && (
            <TouchableOpacity onPress={() => setActiveTab('recipes')}>
              <Text style={styles.seeAllLink}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadingRecipes ? (
          <>{[1, 2].map((i) => <SkeletonCard key={i} />)}</>
        ) : allRecipes.length === 0 ? (
          <EmptyState text="No recipes yet — scan your fridge to get started." />
        ) : (
          allRecipes.slice(0, 4).map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} isChefsPick={recipe.id === topRatedId && recipe.average_rating}
              onPress={() => openRecipeDetails(recipe)} onToggleFavorite={() => toggleFavorite(recipe.id)} onDelete={() => confirmDelete(recipe)} />
          ))
        )}
      </View>
    </ScrollView>
  );

  let filteredRecipes = selectedCategory === 'All' ? allRecipes : allRecipes.filter((r) => r.category === selectedCategory);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredRecipes = filteredRecipes.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }
  if (sortBy === 'Top Rated') filteredRecipes = [...filteredRecipes].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
  else if (sortBy === 'Quickest') filteredRecipes = [...filteredRecipes].sort((a, b) => a.prep_time_minutes - b.prep_time_minutes);

  const categoriesPresent = ['All', ...CATEGORIES.filter((c) => allRecipes.some((r) => r.category === c))];

  const renderRecipes = () => (
    <View style={styles.scrollBody}>
      <Text style={styles.pageTitle}>Your Recipes</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.inkMuted} />
        <TextInput style={styles.searchInput} placeholder="Search recipes..." placeholderTextColor={COLORS.inkMuted} value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={16} color={COLORS.inkMuted} /></TouchableOpacity>
        )}
      </View>

      {allRecipes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}>
          {categoriesPresent.map((cat) => {
            const active = selectedCategory === cat;
            const meta = cat === 'All' ? null : CATEGORY_META[cat];
            return (
              <TouchableOpacity key={cat}
                style={[styles.chip, active && { backgroundColor: meta ? meta.bar : COLORS.ink, borderColor: meta ? meta.bar : COLORS.ink }]}
                onPress={() => { haptic(); setSelectedCategory(cat); }}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {allRecipes.length > 0 && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity key={opt} style={[styles.sortChip, sortBy === opt && styles.sortChipActive]} onPress={() => setSortBy(opt)}>
              <Text style={[styles.sortChipText, sortBy === opt && styles.sortChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coral} />}>
        {loadingRecipes ? (
          <>{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</>
        ) : allRecipes.length === 0 ? (
          <EmptyState text="No recipes yet — scan your fridge to get started." />
        ) : filteredRecipes.length === 0 ? (
          <EmptyState text="No recipes match your search." icon="search-outline" />
        ) : (
          filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} isChefsPick={recipe.id === topRatedId && recipe.average_rating}
              onPress={() => openRecipeDetails(recipe)} onToggleFavorite={() => toggleFavorite(recipe.id)} onDelete={() => confirmDelete(recipe)} />
          ))
        )}
      </ScrollView>
    </View>
  );

  const favoriteRecipes = allRecipes.filter((r) => r.is_favorite);

  const renderFavorites = () => (
    <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coral} />}>
      <Text style={styles.pageTitle}>Favorites</Text>
      {favoriteRecipes.length === 0 ? (
        <EmptyState text="No favorites yet — tap the heart on a recipe to save it here." icon="heart-outline" />
      ) : (
        favoriteRecipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onPress={() => openRecipeDetails(recipe)} onToggleFavorite={() => toggleFavorite(recipe.id)} onDelete={() => confirmDelete(recipe)} />
        ))
      )}
    </ScrollView>
  );

  const renderProfile = () => {
    const totalRatingsGiven = allRecipes.reduce((sum, r) => sum + (r.rating_count || 0), 0);
    const avgAcrossAll = allRecipes.filter((r) => r.average_rating).length
      ? (allRecipes.reduce((sum, r) => sum + (r.average_rating || 0), 0) / allRecipes.filter((r) => r.average_rating).length).toFixed(1)
      : '—';

    return (
      <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.brandBlockPlain}>
          <Logo size={56} />
          <Text style={[styles.brandName, { fontSize: 20, marginTop: 8, color: COLORS.ink }]}>Your Kitchen</Text>
        </View>

        <View style={styles.profileGrid}>
          <View style={[styles.profileStatBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.coralSoft }]}><Ionicons name="book" size={18} color={COLORS.coralDeep} /></View>
            <Text style={styles.statValue}>{allRecipes.length}</Text>
            <Text style={styles.statLabel}>Total Recipes</Text>
          </View>
          <View style={[styles.profileStatBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.plumSoft }]}><Ionicons name="heart" size={18} color={COLORS.plum} /></View>
            <Text style={styles.statValue}>{allRecipes.filter((r) => r.is_favorite).length}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={[styles.profileStatBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.sageSoft }]}><Ionicons name="chatbubble" size={18} color={COLORS.sage} /></View>
            <Text style={styles.statValue}>{totalRatingsGiven}</Text>
            <Text style={styles.statLabel}>Ratings Given</Text>
          </View>
          <View style={[styles.profileStatBox, shadow]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.goldSoft }]}><Ionicons name="star" size={18} color={COLORS.gold} /></View>
            <Text style={styles.statValue}>{avgAcrossAll}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recipes by Category</Text>
        {CATEGORIES.filter((c) => allRecipes.some((r) => r.category === c)).map((cat) => {
          const count = allRecipes.filter((r) => r.category === cat).length;
          const pct = (count / allRecipes.length) * 100;
          const meta = CATEGORY_META[cat];
          return (
            <View key={cat} style={styles.categoryStatRow}>
              <View style={styles.categoryStatHeader}>
                <Ionicons name={meta.icon} size={14} color={meta.text} />
                <Text style={styles.categoryStatLabel}>{cat}</Text>
                <Text style={styles.categoryStatCount}>{count}</Text>
              </View>
              <View style={styles.macroBarTrack}>
                <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: meta.bar }]} />
              </View>
            </View>
          );
        })}

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About Yummy</Text>
          <Text style={styles.message}>Yummy uses AI vision to scan your fridge or pantry and instantly generate recipes tailored to what you already have, complete with nutrition info, ratings, and community comments.</Text>
        </View>
      </ScrollView>
    );
  };

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
      {activeTab === 'recipes' && renderRecipes()}
      {activeTab === 'scan' && renderScan()}
      {activeTab === 'favorites' && renderFavorites()}
      {activeTab === 'profile' && renderProfile()}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => { haptic(); setActiveTab('home'); }}>
          <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={22} color={activeTab === 'home' ? COLORS.coral : COLORS.inkMuted} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => { haptic(); setActiveTab('recipes'); }}>
          <Ionicons name={activeTab === 'recipes' ? 'book' : 'book-outline'} size={22} color={activeTab === 'recipes' ? COLORS.coral : COLORS.inkMuted} />
          <Text style={[styles.tabLabel, activeTab === 'recipes' && styles.tabLabelActive]}>Recipes</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItemCenter} onPress={() => { haptic('medium'); setActiveTab('scan'); }}>
          <LinearGradient colors={[COLORS.coral, COLORS.coralDeep]} style={styles.tabCenterButton}>
            <Ionicons name="camera" size={23} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => { haptic(); setActiveTab('favorites'); }}>
          <Ionicons name={activeTab === 'favorites' ? 'heart' : 'heart-outline'} size={22} color={activeTab === 'favorites' ? COLORS.coral : COLORS.inkMuted} />
          <Text style={[styles.tabLabel, activeTab === 'favorites' && styles.tabLabelActive]}>Favorites</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => { haptic(); setActiveTab('profile'); }}>
          <Ionicons name={activeTab === 'profile' ? 'person' : 'person-outline'} size={22} color={activeTab === 'profile' ? COLORS.coral : COLORS.inkMuted} />
          <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: COLORS.bg },
  screenRoot: { flex: 1, backgroundColor: COLORS.bg },
  scrollBody: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  scrollBodyNoPad: { flex: 1 },
  homeContent: { paddingHorizontal: 20, paddingTop: 20 },
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.ink, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: COLORS.inkMuted, lineHeight: 20, marginBottom: 10 },
  loadingText: { marginTop: 16, fontSize: 15, color: COLORS.inkMuted, fontWeight: '500' },

  logoGradient: { justifyContent: 'center', alignItems: 'center', ...shadow },

  heroBlock: {
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroDecorCircle1: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.35)', top: -50, right: -30,
  },
  heroDecorCircle2: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)', bottom: -30, left: -20,
  },
  brandBlock: { alignItems: 'center' },
  brandBlockPlain: { alignItems: 'center', marginBottom: 22, marginTop: 6 },
  greetingText: { fontSize: 12, color: COLORS.coralDeep, fontWeight: '700', marginTop: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  brandName: { fontSize: 24, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.2, marginTop: 4 },
  brandTagline: { fontSize: 13, color: COLORS.inkMuted, marginTop: 2 },

  ctaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.line },
  ctaIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  ctaSubtitle: { fontSize: 12, color: COLORS.inkMuted, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  statBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 14, alignItems: 'center' },
  statIconWrap: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
  statLabel: { fontSize: 11, color: COLORS.inkMuted, marginTop: 2, fontWeight: '600' },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 },
  seeAllLink: { color: COLORS.coral, fontSize: 13, fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginBottom: 14 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.ink },

  chipRow: { flexGrow: 0, height: 42, marginBottom: 10 },
  chipRowContent: { alignItems: 'center', paddingRight: 20 },
  chip: { paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.inkMuted, lineHeight: 16 },
  chipTextActive: { color: '#fff' },

  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sortChipActive: { backgroundColor: COLORS.sageSoft },
  sortChipText: { fontSize: 12, color: COLORS.inkMuted, fontWeight: '600' },
  sortChipTextActive: { color: COLORS.sage },

  emptyStateBox: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 30, paddingHorizontal: 20 },
  emptyStateText: { fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  cameraScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlayTop: { paddingTop: 64, paddingHorizontal: 24 },
  cameraOverlayTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  cameraOverlaySubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  cameraButtonRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 40, paddingBottom: 40 },
  captureButtonOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: COLORS.coral },
  sideButton: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  sideButtonText: { color: '#fff', fontSize: 10, fontWeight: '600', marginTop: 2 },

  primaryButton: { backgroundColor: COLORS.coral, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, marginTop: 16, alignItems: 'center', width: '100%' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkButton: { marginTop: 14 },
  linkButtonText: { color: COLORS.inkMuted, fontSize: 14, fontWeight: '600' },

  sectionTitle: { fontSize: 19, fontWeight: '700', color: COLORS.ink, marginTop: 22, marginBottom: 10 },
  sectionTitleTop: { fontSize: 19, fontWeight: '700', color: COLORS.ink, marginBottom: 10 },
  ingredientsBox: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },

  recipeCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  cardAccent: { width: 5 },
  recipeCardBody: { flex: 1, padding: 16 },
  recipeCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recipeName: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  macroRowSmall: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  macroTextSmall: { fontSize: 12, color: COLORS.inkMuted, fontWeight: '600' },
  macroDot: { fontSize: 12, color: COLORS.inkMuted, marginHorizontal: 6 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.line },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: COLORS.ink, fontWeight: '700' },
  ratingTextMuted: { fontSize: 12, color: COLORS.inkMuted },
  dateTextSmall: { fontSize: 12, color: COLORS.inkMuted },
  dateText: { fontSize: 12, color: COLORS.inkMuted, marginBottom: 8, fontWeight: '600' },

  chefsPickBadge: { position: 'absolute', top: 10, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, zIndex: 2 },
  chefsPickText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  categoryTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4, marginBottom: 8 },
  categoryTagText: { fontSize: 11, fontWeight: '700' },

  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backLink: { color: COLORS.coral, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  recipeDetailName: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginBottom: 2 },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 6 },
  macroPill: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 16, fontWeight: '800', color: COLORS.coral },
  macroLabel: { fontSize: 11, color: COLORS.inkMuted, marginTop: 2 },

  macroBarsBox: { backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, padding: 14, marginTop: 12 },
  macroBarRow: { marginBottom: 8 },
  macroBarLabel: { fontSize: 11, fontWeight: '700', color: COLORS.inkMuted, marginBottom: 4 },
  macroBarTrack: { height: 6, backgroundColor: COLORS.line, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 6, borderRadius: 3 },

  stepRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.coral, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1 },
  stepNumberText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, color: COLORS.ink, lineHeight: 20 },

  commentCard: { flexDirection: 'row', backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.line, gap: 10 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.coralSoft, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { fontSize: 13, fontWeight: '800', color: COLORS.coralDeep },
  commentUsername: { fontWeight: '700', fontSize: 13, color: COLORS.ink, marginBottom: 2 },

  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 12, fontSize: 14, color: COLORS.ink },
  commentInput: { minHeight: 70, textAlignVertical: 'top' },
  starRow: { flexDirection: 'row', gap: 10 },
  starHint: { fontSize: 12, color: COLORS.inkMuted, marginTop: 4, marginBottom: 8 },

  skelLine1: { height: 12, width: '40%', backgroundColor: COLORS.line, borderRadius: 6, marginBottom: 10, marginLeft: 16, marginTop: 16 },
  skelLine2: { height: 16, width: '70%', backgroundColor: COLORS.line, borderRadius: 6, marginBottom: 8, marginLeft: 16 },
  skelLine3: { height: 12, width: '90%', backgroundColor: COLORS.line, borderRadius: 6, marginLeft: 16, marginBottom: 16 },

  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  profileStatBox: { width: '47%', backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, paddingVertical: 16, alignItems: 'center' },
  categoryStatRow: { marginBottom: 12 },
  categoryStatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  categoryStatLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink, flex: 1 },
  categoryStatCount: { fontSize: 12, color: COLORS.inkMuted, fontWeight: '700' },
  aboutCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginTop: 24 },
  aboutTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink, marginBottom: 6 },

  tabBar: { flexDirection: 'row', height: 78, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.line, paddingBottom: 18, paddingTop: 8 },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel: { fontSize: 10, color: COLORS.inkMuted, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: COLORS.coral },
  tabItemCenter: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  tabCenterButton: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: -22, ...shadow },
});