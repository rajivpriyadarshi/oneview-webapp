"use client";

import { createContext, useState, useCallback, type ReactNode } from "react";
import type { ArtifactData } from "../types/artifactTypes";

type ArtifactContextValue = {
  artifact: ArtifactData | null;
  isOpen: boolean;
  openArtifact: (artifact: ArtifactData) => void;
  closeArtifact: () => void;
  autoOpenEnabled: boolean;
  positioning: "fixed" | "absolute" | "client-panel";
};

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function ArtifactPopupProvider({
  children,
  autoOpenEnabled = false,
  positioning = "fixed",
}: {
  children: ReactNode;
  autoOpenEnabled?: boolean;
  positioning?: "fixed" | "absolute" | "client-panel";
}) {
  const [artifact, setArtifact] = useState<ArtifactData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openArtifact = useCallback((newArtifact: ArtifactData) => {
    setArtifact(newArtifact);
    setIsOpen(true);
  }, []);

  const closeArtifact = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <ArtifactContext.Provider
      value={{
        artifact,
        isOpen,
        openArtifact,
        closeArtifact,
        autoOpenEnabled,
        positioning,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

export { ArtifactContext };
