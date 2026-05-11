/** Signed-in landing route: admins use Admin only, not Account. */
export function dashboardPath(user) {
  if (!user) return '/login'
  return user.role === 'admin' ? '/admin' : '/account'
}
