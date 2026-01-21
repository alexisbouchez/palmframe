"use client"

import { useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { ThreadSidebar } from "@/components/sidebar/ThreadSidebar"
import { ChatContainer } from "@/components/chat/ChatContainer"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

export default function Home() {
  const { threads, currentThreadId, loadThreads, createThread, selectThread } = useAppStore()

  // Load threads on mount
  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Auto-create and select first thread if none exists
  useEffect(() => {
    if (threads.length === 0) {
      createThread({ title: `Thread ${new Date().toLocaleDateString()}` })
    } else if (!currentThreadId && threads.length > 0) {
      selectThread(threads[0].thread_id)
    }
  }, [threads, currentThreadId, createThread, selectThread])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Left sidebar - Thread list */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <ThreadSidebar />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main chat area */}
        <ResizablePanel defaultSize={80} minSize={50}>
          {currentThreadId ? (
            <ChatContainer threadId={currentThreadId} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-section-header mb-2">NO THREAD SELECTED</div>
                <div className="text-sm">Create or select a thread to start</div>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
