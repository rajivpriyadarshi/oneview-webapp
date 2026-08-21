"use client";

import { useEffect, useState } from "react";
import { Lottie } from "lottie-react";

export function ClientLottie({
  src,
  style,
}: {
  src: string;
  style?: React.CSSProperties;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <Lottie src={src} autoplay loop style={style} />;
}
