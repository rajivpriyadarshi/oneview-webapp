import { useContext } from "react";
import { ArtifactContext } from "../contexts/ArtifactContext";

export function useArtifactContext() {
  const context = useContext(ArtifactContext);

  if (!context) {
    throw new Error("useArtifactContext must be used within ArtifactPopupProvider");
  }

  return context;
}
