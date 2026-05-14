"use client";

import { KioskData } from "@/types";
import { Users, Clock, CalendarPlus, XCircle, RotateCw } from "lucide-react";
import MeetingProgressBar from "./MeetingProgressBar";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";

export default function MeetingStatusCard({ data }: { data: KioskData | null }) {
  if (!data) return null;

  const { status, currentBooking, nextBooking, room } = data;

  if (status === "AVAILABLE") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 h-full flex flex-col justify-center items-center text-center space-y-8"
      >
        <div className="w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <div className="w-24 h-24 rounded-full bg-green-500/40 flex items-center justify-center animate-pulse">
            <span className="text-green-400 text-5xl">✓</span>
          </div>
        </div>
        
        <div>
          <h2 className="text-6xl font-bold text-white mb-4">Available</h2>
          <p className="text-2xl text-zinc-400">This room is currently empty.</p>
        </div>

        {nextBooking && (
          <div className="bg-zinc-900/50 rounded-2xl p-6 mt-8 w-full max-w-md border border-zinc-800">
            <p className="text-sm text-zinc-500 uppercase tracking-wider font-semibold mb-2">Next Meeting</p>
            <p className="text-xl text-white font-medium">{nextBooking.title}</p>
            <p className="text-zinc-400 mt-1">{new Date(nextBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )}

        <div className="pt-8">
          <Button variant="glass" size="lg" className="w-64">
            <CalendarPlus className="mr-2 h-6 w-6" /> Book Now
          </Button>
        </div>
      </motion.div>
    );
  }

  if (status === "ONGOING" && currentBooking) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 h-full flex flex-col justify-between"
      >
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <span className="px-4 py-1.5 rounded-full bg-red-500/20 text-red-500 font-semibold text-sm tracking-wide uppercase border border-red-500/30">
              In Use
            </span>
            <h1 className="text-3xl font-bold text-white">{room.name}</h1>
          </div>

          <div className="mt-8">
            <h2 className="text-6xl font-bold text-white leading-tight mb-4 tracking-tight">
              {currentBooking.title}
            </h2>
            <div className="flex items-center space-x-6 text-xl text-zinc-300 font-medium">
              <div className="flex items-center">
                <Users className="w-6 h-6 mr-3 text-zinc-500" />
                {currentBooking.userName}
              </div>
              <div className="flex items-center">
                <Clock className="w-6 h-6 mr-3 text-zinc-500" />
                {new Date(currentBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(currentBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-12">
          <MeetingProgressBar startTime={currentBooking.startTime} endTime={currentBooking.endTime} />

          <div className="flex space-x-4">
            <Button variant="destructive" size="lg" className="flex-1">
              <XCircle className="mr-2 h-6 w-6" /> End Meeting
            </Button>
            <Button variant="glass" size="lg" className="flex-1">
              <RotateCw className="mr-2 h-6 w-6" /> Extend
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
