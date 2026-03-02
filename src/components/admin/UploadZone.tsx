import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";

interface UploadZoneProps {
  label: string;
  hint: string;
  accept: string;
  icon: string;
  file: File | null;
  onFile: (f: File) => void;
}

export default function UploadZone({ label, hint, accept, icon, file, onFile }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className="relative rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-3 group"
      style={{
        borderColor: drag ? "#2F4F4F" : file ? "#2F4F4F" : "#c8d8d8",
        background: drag ? "rgba(47,79,79,0.04)" : file ? "rgba(47,79,79,0.02)" : "#fff",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
        style={{ background: file ? "#2F4F4F" : "rgba(47,79,79,0.08)" }}
      >
        <Icon
          name={file ? "CheckCircle" : icon}
          size={20}
          className={file ? "text-white" : undefined}
          style={{ color: file ? undefined : "#2F4F4F" }}
        />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#2F4F4F" }}>
          {file ? file.name : label}
        </p>
        <p className="text-xs text-gray-400 font-ibm mt-0.5">
          {file ? `${(file.size / 1024).toFixed(0)} КБ` : hint}
        </p>
      </div>
      {!file && (
        <p className="text-xs text-gray-300 font-ibm">Нажмите или перетащите файл</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
