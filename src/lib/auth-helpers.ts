import { supabase } from './supabase'

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function requireCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    throw new Error('You must be signed in to perform this action.')
  }
  return user.id
}

export async function addUserIdToInsert<T extends Record<string, unknown>>(
  data: T
): Promise<T & { user_id: string }> {
  const userId = await requireCurrentUserId()
  return { ...data, user_id: userId }
}
