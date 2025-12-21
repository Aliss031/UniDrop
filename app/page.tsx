"use client";

import React, { useEffect, useRef, useState } from "react";
import { Database, CheckCircle, XCircle, Loader, Trash2 } from "lucide-react";
import { createWorker, PSM } from "tesseract.js";

type Parcel = {
  id: string;
  trackingNumber: string;
  timestamp: number;
  status: string;
  date: string;
};

type Notification = {
  message: string;
  type: "success" | "error";
};

export default function ParcelScannerApp() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [ocrReady, setOcrReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initOCR();
    startCamera();
    loadParcels();
    return () => {
      stopCamera();
      workerRef.current?.terminate();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (ocrReady && !scanIntervalRef.current) {
      scanIntervalRef.current = setInterval(() => {
        if (!isProcessing) captureAndScan();
      }, 3000); // ⏱ scan every 3 seconds
    }
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [ocrReady, isProcessing]);

  const initOCR = async () => {
    try {
      const worker = await createWorker();
      await worker.setParameters({
        tessedit_char_whitelist: "UD0123456789",
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
      });
      workerRef.current = worker;
      setOcrReady(true);
      showNotification("OCR ready for UniDrop scanning", "success");
    } catch (error) {
      console.error("OCR init error:", error);
      showNotification("Failed to initialize OCR", "error");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch {
      showNotification("Camera access denied", "error");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current || isProcessing) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const w = video.videoWidth;
      const h = video.videoHeight;

      // Focus on central 50% region (reduce background)
      const roiX = w * 0.25;
      const roiY = h * 0.35;
      const roiW = w * 0.5;
      const roiH = h * 0.3;

      canvas.width = roiW;
      canvas.height = roiH;
      ctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH);

      // Image preprocessing for better OCR
      const imageData = ctx.getImageData(0, 0, roiW, roiH);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const val = avg > 150 ? 255 : 0; // thresholding
        data[i] = data[i + 1] = data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);

      const { data: { text } } = await workerRef.current.recognize(canvas);
      const cleanText = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const match = cleanText.match(/UD\d{5}/); // ✅ only UD + 5 digits

      if (match) {
        const trackingNumber = match[0];
        console.log("Detected UniDrop ID:", trackingNumber);
        await saveParcel(trackingNumber);
      } else {
        console.log("No valid UniDrop ID found:", cleanText);
      }
    } catch (error) {
      console.error("OCR error:", error);
    }

    setIsProcessing(false);
  };

  const loadParcels = () => {
    try {
      const stored = localStorage.getItem("parcels");
      if (stored) {
        const list: Parcel[] = JSON.parse(stored);
        setParcels(list.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch {
      console.warn("Failed to load parcels");
    }
  };

  const saveParcel = async (trackingNumber: string) => {
    if (parcels.some((p) => p.trackingNumber === trackingNumber)) return;

    const parcel: Parcel = {
      id: Date.now().toString(),
      trackingNumber,
      timestamp: Date.now(),
      status: "Scanned",
      date: new Date().toLocaleString(),
    };

    const updated = [parcel, ...parcels];
    setParcels(updated);
    localStorage.setItem("parcels", JSON.stringify(updated));

    showNotification(`✅ Scanned: ${trackingNumber}`, "success");
    setScannedText(trackingNumber);
    setTimeout(() => setScannedText(""), 3000);
  };

  const deleteParcel = (id: string) => {
    const updated = parcels.filter((p) => p.id !== id);
    setParcels(updated);
    localStorage.setItem("parcels", JSON.stringify(updated));
    showNotification("Parcel deleted", "success");
  };

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">📦 UniDrop Scanner (High Accuracy)</h1>

        {notification && (
          <div
            className={`p-3 rounded-lg flex items-center gap-2 ${
              notification.type === "success" ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {notification.type === "success" ? <CheckCircle /> : <XCircle />}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        {/* --- Camera with Scan Indicator --- */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {isProcessing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded flex items-center gap-2 shadow">
              <Loader className="animate-spin" />
              <span>Scanning for UD#####...</span>
            </div>
          )}
          {scannedText && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-lg font-bold shadow">
              {scannedText}
            </div>
          )}
          {/* ROI guide box */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="border-4 border-green-400 rounded-xl w-1/2 h-1/3 opacity-70"></div>
          </div>
        </div>

        {/* --- Stored IDs --- */}
        <div className="bg-white p-4 rounded-lg shadow max-h-80 overflow-y-auto">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <Database /> Scanned UniDrop IDs ({parcels.length})
          </h2>
          {parcels.length === 0 ? (
            <p className="text-gray-600">No UniDrop IDs scanned yet</p>
          ) : (
            parcels.map((p) => (
              <div key={p.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <p className="font-bold text-green-700">{p.trackingNumber}</p>
                  <p className="text-sm text-gray-600">{p.date}</p>
                </div>
                <button onClick={() => deleteParcel(p.id)}>
                  <Trash2 className="text-red-600 hover:text-red-800" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
