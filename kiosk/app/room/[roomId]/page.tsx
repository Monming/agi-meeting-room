"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useKioskStore } from "@/store/kioskStore";
import { wsService } from "@/services/websocket";
import { format } from "date-fns";

import LiveClock from "@/components/LiveClock";
import MeetingStatusCard from "@/components/MeetingStatusCard";
import UpcomingMeetingsList from "@/components/UpcomingMeetingsList";
import RoomAvailabilityIndicator from "@/components/RoomAvailabilityIndicator";

export default function KioskRoomDisplay() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const { setRoomId, fetchData, fetchWeeklyData, kioskData, weeklyData } = useKioskStore();

  useEffect(() => {
    if (roomId) {
      setRoomId(roomId);
      fetchData();
      
      const today = format(new Date(), "yyyy-MM-dd");
      fetchWeeklyData(today);

      wsService.connect();
      const unsubscribe = wsService.onUpdate(() => {
        fetchData();
        fetchWeeklyData(today);
      });

      const interval = setInterval(() => {
        fetchData();
        fetchWeeklyData(today);
      }, 30000);

      return () => {
        unsubscribe();
        wsService.disconnect();
        clearInterval(interval);
      };
    }
  }, [roomId, setRoomId, fetchData, fetchWeeklyData]);

  if (!kioskData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-black">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-zinc-700 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-500 font-medium">Initializing Room System...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col p-8 bg-black/60">
      <RoomAvailabilityIndicator status={kioskData.status} />

      <div className="grid grid-cols-12 gap-8 h-full z-10">
        
        {/* LEFT PANEL */}
        <div className="col-span-3 flex flex-col justify-between">
          <LiveClock />
          
          <div className="mt-auto pb-8">
            <button 
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl bg-zinc-900/50 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors border border-white/5"
            >
              ← Change Room
            </button>
          </div>
        </div>

        {/* CENTER PANEL */}
        <div className="col-span-6 py-6 h-full">
          <MeetingStatusCard data={kioskData} />
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-3 py-6 h-full pl-6 border-l border-white/10">
          <UpcomingMeetingsList data={weeklyData} />
        </div>

      </div>
    </main>
  );
}
