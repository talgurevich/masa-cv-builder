"use client";

import { api } from "@/lib/paths";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewCVButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const res = await fetch(api("/api/cv"), { method: "POST" });
    if (!res.ok) {
      setLoading(false);
      alert("שגיאה ביצירת CV חדש");
      return;
    }
    const { id } = await res.json();
    router.push(`/${id}`);
  }

  return (
    <button
      onClick={create}
      disabled={loading}
      className="rounded-lg bg-ink text-white px-4 py-2 font-medium hover:bg-ink/90 disabled:opacity-50 transition"
    >
      {loading ? "יוצר…" : "+ קורות חיים חדשים"}
    </button>
  );
}
