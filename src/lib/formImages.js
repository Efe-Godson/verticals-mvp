import { supabase } from '../supabaseClient'

// Uploads a builder-chosen image (right now: the form's header/banner
// picture, shown across the top of the public form Google-Forms style) to
// the shared `form-uploads` bucket and returns its public URL.
//
// Keyed on the owner's user id rather than the form id, so it behaves the
// same in CreateForm (no `forms` row exists yet when the picture is picked)
// as in EditForm. Throws on a bad file or a failed upload - the caller is
// expected to surface err.message.
export async function uploadBannerImage(file, session) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, GIF, ...).')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5MB.')
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `banners/${session.user.id}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('form-uploads').upload(path, file)
  if (error) throw new Error('Could not upload the image: ' + error.message)
  return supabase.storage.from('form-uploads').getPublicUrl(path).data.publicUrl
}
