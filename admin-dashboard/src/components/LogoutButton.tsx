'use client'

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="block w-full text-left px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      Sign out
    </button>
  )
}
