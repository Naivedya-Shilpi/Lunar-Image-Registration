"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Console from "@/components/Console";
import ExploreMoonHero from "@/components/hero/ExploreMoonHero";
import AboutPage from "@/components/AboutPage";

type View = "hero" | "console" | "about";

function MainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Determine initial view from URL
  const paramView = searchParams.get("view");
  const getViewFromParam = useCallback((): View => {
    if (paramView === "console") return "console";
    if (paramView === "about") return "about";
    return "hero";
  }, [paramView]);

  const [view, setView] = useState<View>(getViewFromParam);

  // Sync view with URL param
  useEffect(() => {
    setView(getViewFromParam());
  }, [getViewFromParam]);

  // Sync URL param changes into view
  useEffect(() => {
    const urlView = searchParams.get("view");
    if (urlView === "console" && view !== "console") {
      setView("console");
    } else if (urlView === "about" && view !== "about") {
      setView("about");
    } else if (!urlView && view !== "hero") {
      setView("hero");
    }
  }, [searchParams, view]);

  const handleLaunchConsole = useCallback(() => {
    setView("console");
    router.push("/?view=console");
  }, [router]);

  const handleOpenAbout = useCallback(() => {
    setView("about");
    router.push("/?view=about");
  }, [router]);

  const handleBackToHero = useCallback(() => {
    setView("hero");
    router.push("/");
  }, [router]);

  if (view === "console") {
    return <Console onBackToHero={handleBackToHero} />;
  }

  if (view === "about") {
    return (
      <AboutPage
        onBackToHero={handleBackToHero}
        onOpenConsole={handleLaunchConsole}
      />
    );
  }

  return (
    <ExploreMoonHero
      onOpenConsole={handleLaunchConsole}
      onOpenAbout={handleOpenAbout}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#000000]" />}>
      <MainContent />
    </Suspense>
  );
}
