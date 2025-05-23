"use client"
import { Suspense } from "react"
import Navbar from "@/components/navbar"
import dynamic from 'next/dynamic'
import { Toaster } from "@/components/ui/sonner"
import Footer from "@/components/footer"
import PromoBanner from "@/components/promo-banner"

// Dynamic imports with SSR disabled
const HeroSection = dynamic(() => import('@/components/hero-section'), { ssr: false })
const LandingContractTemplates = dynamic(() => import('@/components/landing-contract-template'), { ssr: false })
const ActiveWalletsExplorers = dynamic(() => import('@/components/Active-WalletsExplorers'), { ssr: false })
const FeaturesSection = dynamic(() => import('@/components/features-section'), { ssr: false })
const BlogSection = dynamic(() => import('@/components/blog-section'), { ssr: false })
const FaqSection = dynamic(() => import('@/components/faq-section'), { ssr: false })

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 ">
      <Navbar />
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
    
        <HeroSection />
        <LandingContractTemplates/>
        <ActiveWalletsExplorers />
        <FeaturesSection />
        <BlogSection />
        <FaqSection />
        <Footer/>
      </Suspense>
      <Toaster />
    </main>
  )
}

function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  }

  return (
    <div className="flex justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-solid border-zinc-700 border-t-teal-500`}
      ></div>
    </div>
  )
}