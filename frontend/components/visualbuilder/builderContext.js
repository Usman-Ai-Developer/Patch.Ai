// frontend/components/visualbuilder/builderContext.js
"use client";

import React, { createContext, useContext } from "react";

const BuilderDataContext = createContext({
  projectId: null,
  models: [],
  designTokens: { colors: [], textStyles: [] },
  activeMode: "light",
});

export function BuilderDataProvider({ projectId, models, designTokens, activeMode = "light", children }) {
  return (
    <BuilderDataContext.Provider
      value={{
        projectId,
        models: models || [],
        designTokens: designTokens || { colors: [], textStyles: [] },
        activeMode,
      }}
    >
      {children}
    </BuilderDataContext.Provider>
  );
}

export function useBuilderData() {
  return useContext(BuilderDataContext);
}