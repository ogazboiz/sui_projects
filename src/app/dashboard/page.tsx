import { Suspense } from "react"
import Navbar from "@/components/navbar"
import Dashboard from "@/components/dashboard/dashboard"
import { Toaster } from "@/components/ui/sonner"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <Dashboard network="testnet" />
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
