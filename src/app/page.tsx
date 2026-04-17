"use client";

import { useState, useRef, useCallback } from "react";
import overlayConfig from "../../overlay-config.json";

type Status = "idle" | "processing" | "sending" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [aspectWarning, setAspectWarning] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatDate = useCallback((format: string): string => {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    return format.replace("YYYY", y).replace("MM", m).replace("DD", d);
  }, []);

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const checkAspectRatio = (
    width: number,
    height: number
  ): { match: boolean; actual: string; expected: string; scaleFactor: { x: number; y: number } } => {
    const { expectedAspectRatio, aspectRatioTolerance } = overlayConfig;
    const expectedRatio = expectedAspectRatio.width / expectedAspectRatio.height;
    const actualRatio = width / height;
    const match = Math.abs(actualRatio - expectedRatio) / expectedRatio <= aspectRatioTolerance;

    // Scale factor: overlay config is designed for a "reference" canvas.
    // We scale overlay positions proportionally to actual image size.
    // Reference size: assume config was designed for 900x1200 (3:4 portrait)
    const refWidth = 900;
    const refHeight = 1200;

    return {
      match,
      actual: `${width}:${height}`,
      expected: `${expectedAspectRatio.width}:${expectedAspectRatio.height}`,
      scaleFactor: { x: width / refWidth, y: height / refHeight },
    };
  };

  const processImage = async (file: File) => {
    setStatus("processing");
    setAspectWarning("");
    setMessage("");

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // Load the uploaded image
      const imgUrl = URL.createObjectURL(file);
      const baseImage = await loadImage(imgUrl);

      // Set canvas to full image resolution
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;

      // Check aspect ratio
      const aspectCheck = checkAspectRatio(baseImage.width, baseImage.height);
      if (!aspectCheck.match) {
        setAspectWarning(
          `⚠ アスペクト比が異なります (${aspectCheck.actual})。期待値: ${aspectCheck.expected}。画像全体を使用して処理します。`
        );
      }

      const sx = aspectCheck.scaleFactor.x;
      const sy = aspectCheck.scaleFactor.y;

      // Draw base image at full resolution
      ctx.drawImage(baseImage, 0, 0);

      const { overlays } = overlayConfig;

      // Draw logo overlay
      if (overlays.logo.enabled) {
        try {
          const logoImg = await loadImage(overlays.logo.imagePath);
          ctx.drawImage(
            logoImg,
            overlays.logo.x * sx,
            overlays.logo.y * sy,
            overlays.logo.width * sx,
            overlays.logo.height * sy
          );
        } catch {
          console.warn("Logo image not found, skipping");
        }
      }

      // Draw store name overlay
      if (overlays.storeName.enabled) {
        try {
          const storeImg = await loadImage(overlays.storeName.imagePath);
          ctx.drawImage(
            storeImg,
            overlays.storeName.x * sx,
            overlays.storeName.y * sy,
            overlays.storeName.width * sx,
            overlays.storeName.height * sy
          );
        } catch {
          console.warn("Store name image not found, skipping");
        }
      }

      // Draw date text
      if (overlays.date.enabled) {
        const dateText = formatDate(overlays.date.format);
        const fontSize = overlays.date.fontSize * Math.min(sx, sy);
        ctx.font = `${overlays.date.fontWeight} ${fontSize}px ${overlays.date.fontFamily}`;
        ctx.textBaseline = "top";

        // Draw stroke
        if (overlays.date.strokeWidth > 0) {
          ctx.strokeStyle = overlays.date.strokeColor;
          ctx.lineWidth = overlays.date.strokeWidth * Math.min(sx, sy);
          ctx.strokeText(dateText, overlays.date.x * sx, overlays.date.y * sy);
        }

        // Draw fill
        ctx.fillStyle = overlays.date.fontColor;
        ctx.fillText(dateText, overlays.date.x * sx, overlays.date.y * sy);
      }

      // Generate preview (lower quality for display)
      setPreview(canvas.toDataURL("image/jpeg", 0.6));

      URL.revokeObjectURL(imgUrl);

      // Send to Discord
      setStatus("sending");
      // Export as high-quality JPEG (95%) to keep file size under Discord/Vercel limits
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          "image/jpeg",
          0.95
        );
      });

      const formData = new FormData();
      const dateStr = formatDate("YYYY-MM-DD");
      formData.append("file", blob, `processed_${dateStr}.jpg`);

      // Add aspect ratio warning to Discord message if applicable
      let discordMessage = `📸 ${dateStr} の画像`;
      if (!aspectCheck.match) {
        discordMessage += `\n⚠ アスペクト比注意: 元画像 ${aspectCheck.actual} (期待値: ${aspectCheck.expected})`;
      }
      formData.append("content", discordMessage);

      const res = await fetch("/api/discord", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `送信失敗 (${res.status})`);
      }

      setStatus("done");
      setMessage("✅ Discordに送信しました！");
    } catch (err) {
      setStatus("error");
      setMessage(`❌ エラー: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processImage(file);
  };

  const reset = () => {
    setStatus("idle");
    setPreview(null);
    setMessage("");
    setAspectWarning("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">Auto Image</h1>

      {status === "idle" && (
        <div
          className="w-full max-w-md text-center"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="border-2 border-dashed border-gray-500 rounded-xl p-8 mb-4 hover:border-blue-400 transition-colors">
            <p className="text-lg mb-4">📷 写真を選択してください</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-300
                file:mr-4 file:py-3 file:px-6
                file:rounded-lg file:border-0
                file:text-base file:font-semibold
                file:bg-blue-600 file:text-white
                file:cursor-pointer
                hover:file:bg-blue-700"
            />
          </div>
          <p className="text-sm text-gray-400">またはドラッグ＆ドロップ</p>
        </div>
      )}

      {(status === "processing" || status === "sending") && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4" />
          <p>{status === "processing" ? "画像を加工中..." : "Discordに送信中..."}</p>
        </div>
      )}

      {aspectWarning && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3 mt-4 max-w-md text-sm">
          {aspectWarning}
        </div>
      )}

      {preview && (
        <div className="mt-4 max-w-md w-full">
          <img src={preview} alt="プレビュー" className="rounded-lg w-full" />
        </div>
      )}

      {message && (
        <p className="mt-4 text-lg">{message}</p>
      )}

      {(status === "done" || status === "error") && (
        <button
          onClick={reset}
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg transition-colors"
        >
          次の画像をアップロード
        </button>
      )}

      {/* Hidden canvas for image processing at full resolution */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
