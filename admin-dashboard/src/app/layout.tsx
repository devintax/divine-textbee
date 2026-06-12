import type { Metadata } from 'next'
import LogoutButton from '@/components/LogoutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'TextBee Admin',
  description: 'Divine Financial Group — SMS Gateway Operations Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 bg-gray-900 text-white p-4 flex flex-col gap-1">
            <div className="text-sm font-semibold uppercase tracking-wider mb-4 text-gray-400">
              TextBee Admin
            </div>
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/devices">Devices</NavLink>
            <NavLink href="/send">Send SMS</NavLink>
            <NavLink href="/history">Message History</NavLink>
            <NavLink href="/api-keys">API Keys</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            <div className="mt-auto pt-4 border-t border-gray-700">
              <LogoutButton />
            </div>
          </nav>
          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors"
    >
      {children}
    </a>
  )
}


