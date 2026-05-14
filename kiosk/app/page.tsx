"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { mockApi } from "@/services/mock";
import { env } from "@/config/env";
import { Room } from "@/types";

export default function RoomSelector() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadRooms() {
      setLoadError(null);
      try {
        const service = env.isMockMode ? mockApi : api;
        const data = await service.getRooms();
        setRooms(data);
      } catch (err) {
        console.error("Failed to load rooms", err);
        setLoadError(
          err instanceof Error ? err.message : "Could not reach the rooms API.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadRooms();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-2">Select a Room</h1>
        <p className="text-zinc-400 mb-12">
          Tap a room card below to open its full-screen kiosk. Cards appear after rooms load from the
          API or mock data.
        </p>

        {loading ? (
          <div className="text-center text-zinc-500 py-12">Loading rooms...</div>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-900/60 bg-red-950/40 px-6 py-5 text-red-100/95 space-y-3"
          >
            <p className="font-medium">Could not load rooms</p>
            <p className="text-sm text-red-200/80">{loadError}</p>
            <ul className="list-disc pl-5 text-sm text-zinc-300 space-y-1">
              <li>
                Run the Express API (default <code className="text-zinc-100">GET /api/rooms</code> on port 3000). The
                kiosk dev server uses port <code className="text-zinc-100">3001</code> and proxies{" "}
                <code className="text-zinc-100">/api/*</code> via{" "}
                <code className="text-zinc-100">KIOSK_BACKEND_ORIGIN</code> (127.0.0.1:3000).
              </li>
              <li>
                Override the API base only if needed:{" "}
                <code className="text-zinc-100">NEXT_PUBLIC_API_URL=https://host/api</code> (skips the proxy).
              </li>
              <li>
                For a quick demo without the server, set{" "}
                <code className="text-zinc-100">NEXT_PUBLIC_MOCK_MODE=true</code> and restart the kiosk.
              </li>
            </ul>
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-6 py-8 text-zinc-300 space-y-3">
            <p className="font-medium text-zinc-100">No rooms to show</p>
            <p className="text-sm">
              The API returned an empty list. Add active rooms in your admin app or database, or enable
              mock data with <code className="text-zinc-100">NEXT_PUBLIC_MOCK_MODE=true</code>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <button
                key={room._id}
                type="button"
                onClick={() => router.push(`/room/${room._id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-3xl p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-2">{room.name}</h2>
                <div className="flex items-center text-zinc-400 text-sm space-x-4">
                  {room.capacity != null && room.capacity > 0 && (
                    <span>👥 {room.capacity} seats</span>
                  )}
                  {room.floor != null && room.floor !== "" && <span>🏢 Floor {room.floor}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
