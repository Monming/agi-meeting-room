"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export default function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-start justify-center h-full space-y-2">
      <div className="text-[8rem] leading-none font-bold tracking-tighter text-white drop-shadow-lg">
        {format(time, "HH:mm")}
      </div>
      <div className="text-3xl font-medium text-zinc-400">
        {format(time, "EEEE, MMMM do")}
      </div>
    </div>
  );
}
