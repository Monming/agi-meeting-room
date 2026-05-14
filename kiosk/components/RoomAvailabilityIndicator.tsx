"use client";

import { motion } from "framer-motion";
import { RoomStatus } from "@/types";

export default function RoomAvailabilityIndicator({ status }: { status: RoomStatus }) {
  const colors = {
    AVAILABLE: "bg-green-500",
    ONGOING: "bg-red-500",
    UPCOMING: "bg-yellow-500",
  };

  return (
    <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
      <motion.div
        animate={{
          opacity: [0.1, 0.15, 0.1],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] ${colors[status]}`}
      />
      <motion.div
        animate={{
          opacity: [0.05, 0.1, 0.05],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className={`absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full blur-[100px] ${colors[status]}`}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
    </div>
  );
}
