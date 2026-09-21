"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CandidateDetailClient({ candidate }: { candidate: any }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: candidate.name,
    email: candidate.email,
    targetRole: candidate.targetRole || "",
    hobbiesSkills: candidate.hobbiesSkills || "",
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to update candidate");
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this candidate and all their assessment sessions? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete candidate');
      router.push('/admin/candidates');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false); // Re-enable button only on error
    }
    // Note: on success we navigate away, so setDeleting(false) is intentionally omitted
  }

  return (
    <div className="card-p space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="text-sm font-bold text-slate-900">Candidate Information</h2>
        {!isEditing && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger text-xs px-3 py-1.5"
            >
              {deleting ? "Deleting..." : "Delete Candidate"}
            </button>
          </div>
        )}
      </div>


      {error && (
        <div className="alert-danger mb-4">
          {error}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Target Role</label>
              <input
                className="form-input"
                value={form.targetRole}
                onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Background / Skills</label>
            <textarea
              className="form-textarea min-h-[100px]"
              value={form.hobbiesSkills}
              onChange={(e) => setForm({ ...form, hobbiesSkills: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-ghost text-xs px-4 py-2"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-accent text-xs px-4 py-2">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</p>
              <p className="text-sm font-medium text-slate-900">{candidate.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-sm font-medium text-slate-900">{candidate.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Target Role</p>
              <p className="text-sm font-medium text-slate-900">{candidate.targetRole || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Joined Date</p>
              <p className="text-sm font-medium text-slate-900">
                {new Date(candidate.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {candidate.hobbiesSkills && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Background / Skills</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{candidate.hobbiesSkills}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
