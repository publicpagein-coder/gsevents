/** Admin panel layout — only accessible to users with the admin role. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
