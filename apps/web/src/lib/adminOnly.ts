export function isAdminEmail(email?: string | null) {
  const admin = process.env.ADMIN_EMAIL?.toLowerCase()
  return !!email && !!admin && email.toLowerCase() === admin
}