import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { spacing, fontSize, borderRadius, type ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  madeRecipe: boolean;
  createdAt: string;
  user: { id: string; displayName: string };
}

interface Props {
  recipeId: string;
  ratingAvg: number;
  ratingCount: number;
}

const isWeb = Platform.OS === 'web';

export default function RecipeReviews({ recipeId, ratingAvg, ratingCount }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const fetchReviews = async (append = false) => {
    setLoading(true);
    try {
      const url = cursor && append
        ? `/recipes/${recipeId}/reviews?cursor=${cursor}&limit=10`
        : `/recipes/${recipeId}/reviews?limit=10`;
      const res = await api.get<any>(url);
      const items = res?.items || res || [];
      if (append) {
        setReviews((prev) => [...prev, ...items]);
      } else {
        setReviews(items);
      }
      setHasMore(res?.hasMore || false);
      setCursor(res?.nextCursor || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) fetchReviews();
  }, [expanded]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      const msg = 'Yorum yapmak için giriş yapın.';
      isWeb ? window.alert(msg) : Alert.alert('Giriş Gerekli', msg);
      return;
    }
    if (rating < 1 || rating > 5) return;

    setSubmitting(true);
    try {
      // If photo selected, upload first via media endpoint
      let imageUrl: string | undefined;
      if (photoUri) {
        try {
          const formData = new FormData();
          formData.append('file', { uri: photoUri, name: 'review.jpg', type: 'image/jpeg' } as any);
          const uploadRes = await api.post<any>('/media/upload', formData);
          imageUrl = (uploadRes as any).url;
        } catch {
          // Photo upload failed, continue without
        }
      }

      const newReview = await api.post<Review>(`/recipes/${recipeId}/reviews`, {
        rating,
        comment: comment.trim() || null,
        imageUrl,
        madeRecipe: true,
      });
      setReviews((prev) => [newReview as any, ...prev]);
      setShowForm(false);
      setComment('');
      setPhotoUri(null);
      setRating(5);
      const msg = 'Yorumunuz eklendi!';
      isWeb ? window.alert(msg) : Alert.alert('Teşekkürler', msg);
    } catch (err: any) {
      const msg = err.message || 'Yorum eklenemedi';
      isWeb ? window.alert(msg) : Alert.alert('Hata', msg);
    }
    setSubmitting(false);
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const StarRow = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange?.(i)} disabled={!onChange}>
          <MaterialIcons
            name={i <= value ? 'star' : 'star-border'}
            size={onChange ? 28 : 16}
            color="#F5A623"
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Toggle header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="rate-review" size={22} color={colors.primary} />
          <Text style={styles.headerTitle}>Yorumlar</Text>
          {ratingCount > 0 && (
            <Text style={styles.headerMeta}>
              ★ {Number(ratingAvg).toFixed(1)} ({ratingCount})
            </Text>
          )}
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Add review button */}
          {user && !showForm && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
                <MaterialIcons name="add" size={18} color={colors.onPrimary} />
                <Text style={styles.addBtnText}>Yorum Yaz</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.madeItBtn} onPress={() => { setShowForm(true); setRating(5); }}>
                <MaterialIcons name="photo-camera" size={18} color={colors.secondary} />
                <Text style={styles.madeItBtnText}>Bunu Yaptım!</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Review form */}
          {showForm && (
            <View style={styles.form}>
              <Text style={styles.formLabel}>Puanınız</Text>
              <StarRow value={rating} onChange={setRating} />
              <Text style={[styles.formLabel, { marginTop: spacing.sm }]}>Yorumunuz (opsiyonel)</Text>
              <TextInput
                style={styles.formInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Bu tarif hakkında ne düşünüyorsunuz?"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                numberOfLines={3}
              />
              {/* Photo */}
              <TouchableOpacity style={styles.photoPickBtn} onPress={pickPhoto}>
                <MaterialIcons name="add-a-photo" size={20} color={colors.primary} />
                <Text style={styles.photoPickText}>{photoUri ? 'Fotoğraf Değiştir' : 'Fotoğraf Ekle'}</Text>
              </TouchableOpacity>
              {photoUri && (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              )}

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setComment(''); setPhotoUri(null); }}>
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitBtnText}>Gönder</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Reviews list */}
          {loading && reviews.length === 0 ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : reviews.length === 0 ? (
            <Text style={styles.emptyText}>Henüz yorum yok. İlk yorumu siz yazın!</Text>
          ) : (
            <>
              {reviews.map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{r.user.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewName}>{r.user.displayName}</Text>
                      <Text style={styles.reviewDate}>{formatDate(r.createdAt)}</Text>
                    </View>
                    <StarRow value={r.rating} />
                  </View>
                  {r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  {r.imageUrl && (
                    <Image source={{ uri: r.imageUrl }} style={styles.reviewImage} />
                  )}
                  {r.madeRecipe && (
                    <View style={styles.madeBadge}>
                      <MaterialIcons name="check-circle" size={12} color={colors.secondary} />
                      <Text style={styles.madeText}>Bu tarifi yaptı</Text>
                    </View>
                  )}
                </View>
              ))}
              {hasMore && (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchReviews(true)} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Daha Fazla Yorum</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '50',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: fontSize.lg, fontFamily: 'Jakarta-Bold', color: colors.text },
  headerMeta: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: '#F5A623' },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  starRow: { flexDirection: 'row', gap: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  addBtnText: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.onPrimary },
  form: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formLabel: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.text, marginBottom: 4 },
  formInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: fontSize.md,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.md },
  cancelBtnText: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.textMuted },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.onPrimary },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  reviewCard: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh + '40',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontFamily: 'Jakarta-Bold', color: colors.primary },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.text },
  reviewDate: { fontSize: 11, fontFamily: 'Manrope-Regular', color: colors.textMuted },
  reviewComment: {
    fontSize: fontSize.md,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  madeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  madeText: { fontSize: 11, fontFamily: 'Manrope-SemiBold', color: colors.secondary },
  loadMoreBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  loadMoreText: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.primary },
  madeItBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary + '18',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  madeItBtnText: { fontSize: fontSize.sm, fontFamily: 'Jakarta-Bold', color: colors.secondary },
  photoPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    marginTop: spacing.sm,
  },
  photoPickText: { fontSize: fontSize.sm, color: colors.primary, fontFamily: 'Jakarta-Bold' },
  photoPreview: {
    width: '100%' as any,
    height: 150,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  reviewImage: {
    width: '100%' as any,
    height: 180,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
});
