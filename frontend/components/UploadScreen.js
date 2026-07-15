"use client";

import { useState, useRef } from "react";

export default function UploadScreen({ onUpload, error, busy }) {
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      alert("Please upload a .zip of your project.");
      return;
    }
    onUpload(file, name || file.name.replace(".zip", ""));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <div className="text-2xl text-amber font-semibold tracking-tight">
          patch<span className="text-text">/</span>
          <span className="blink-cursor"></span>
        </div>
        <p className="text-subtext text-sm mt-2 max-w-md">
          upload a project. say what to change. it edits the files directly.
        </p>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="project name (optional)"
        className="mb-4 w-full max-w-md bg-panel border border-line rounded-sm px-3 py-2 text-sm text-text outline-none focus:border-amber"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-md h-44 border rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging ? "border-amber bg-panel" : "border-line hover:border-mint"
        }`}
      >
        <div className="text-sm text-text">
          {busy ? "uploading…" : "drop a .zip here, or click to browse"}
        </div>
        <div className="text-xs text-subtext mt-1">.zip only, source files</div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {error && <div className="mt-4 text-sm text-red-400 max-w-md text-center">{error}</div>}
    </div>
  );
}
