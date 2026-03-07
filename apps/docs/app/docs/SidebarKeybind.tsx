"use client";

// REACT
import { useEffect } from "react";

// FUMADOCS
import { useSidebar } from "fumadocs-ui/contexts/sidebar";

export default function SidebarKeybind() {
  // Hooks
  const { setCollapsed } = useSidebar();

  // Effect - Listen for Shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "[") {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCollapsed]);

  return null;
}
