"use client";

import React from "react";
import { AdminAuthProvider } from "@/app/context/AdminAuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
