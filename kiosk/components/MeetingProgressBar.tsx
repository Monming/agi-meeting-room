"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

interface Props {
  startTime: string;
  endTime: string;
}

export default function MeetingProgressBar({ startTime, endTime }: Props) {
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateProgress = () => {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const now = Date.now();

      if (now < start) {
        setProgress(0);
        setTimeLeft("Starts soon");
        return;
      }
      
      if (now > end) {
        setProgress(100);
        setTimeLeft("Ending...");
        return;
      }

      const total = end - start;
      const elapsed = now - start;
      setProgress((elapsed / total) * 100);

      const diffMins = Math.ceil((end - now) / 60000);
      if (diffMins >= 60) {
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setTimeLeft(`${hrs}h ${mins}m remaining`);
      } else {
        setTimeLeft(`${diffMins} min remaining`);
      }
    };

    calculateProgress();
    const interval = setInterval(calculateProgress, 10000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return (
    <div className="w-full mt-6 space-y-2">
      <div className="flex justify-between text-sm text-zinc-400 font-medium">
        <span>{format(new Date(startTime), "HH:mm")}</span>
        <span className="text-white font-semibold">{timeLeft}</span>
        <span>{format(new Date(endTime), "HH:mm")}</span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
