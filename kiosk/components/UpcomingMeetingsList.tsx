"use client";

import { WeeklyData } from "@/types";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

export default function UpcomingMeetingsList({ data }: { data: WeeklyData | null }) {
  if (!data || !data.days || data.days.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
        <Calendar className="w-16 h-16 opacity-20" />
        <p className="text-xl font-medium">No upcoming meetings today</p>
      </div>
    );
  }

  // Assuming we only show today's schedule for the kiosk right panel
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayData = data.days.find(d => d.date === todayStr);

  const bookings = todayData?.bookings || [];

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-2xl font-bold text-white mb-8 flex items-center">
        <Calendar className="w-6 h-6 mr-3 text-zinc-400" />
        Today's Schedule
      </h3>

      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 pr-4">
        {bookings.length === 0 ? (
          <p className="text-zinc-500 font-medium">No schedule available.</p>
        ) : (
          bookings.map((booking, idx) => {
            const isPast = new Date(booking.endTime).getTime() < Date.now();
            const isOngoing = new Date(booking.startTime).getTime() <= Date.now() && !isPast;
            
            return (
              <div 
                key={booking._id || idx} 
                className={`p-5 rounded-2xl border transition-all ${
                  isOngoing 
                    ? "bg-red-500/10 border-red-500/30" 
                    : isPast 
                      ? "bg-zinc-900/30 border-zinc-800/50 opacity-50"
                      : "bg-zinc-900/60 border-white/5 hover:bg-zinc-800/80"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`text-lg font-bold ${isOngoing ? 'text-red-400' : 'text-zinc-200'}`}>
                    {booking.title}
                  </h4>
                  {isOngoing && <span className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded-full uppercase">Now</span>}
                </div>
                <p className="text-zinc-400 font-medium text-sm">
                  {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                </p>
                <p className="text-zinc-500 text-sm mt-2 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-zinc-700 mr-2"></span>
                  {booking.userName}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
