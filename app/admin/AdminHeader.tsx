"use client";

export function AdminHeader({ title }: { title: string }) {
  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.replace("/admin/");
  }

  return (
    <header className="admin-header">
      <a className="brand" href="/admin/"><span className="brand-mark" aria-hidden="true">◒</span><span>Emoji Daily</span></a>
      <span className="admin-header-title">{title}</span>
      <button className="quiet-button" type="button" onClick={logout}>Log out</button>
    </header>
  );
}
