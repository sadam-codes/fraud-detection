/** Signed-in landing route: admins land on payments list. */
export function dashboardPath(user) {
  if (!user) return '/login'
  return user.role === 'admin' ? '/admin/payments' : '/account'
}
