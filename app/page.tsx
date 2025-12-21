"use client";

import React, { useEffect, useRef, useState } from "react";
import { createWorker, Worker, PSM } from "tesseract.js";
import { Package, Loader } from "lucide-react";

type Parcel = {
  id: string;
  trackingNumber: string;
  timestamp: number;
  date: string;
};

export default function ParcelScannerApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [parcels, setParcels] = useState<Parcel[]>([]);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    initWorker();
    startCamera();
    loadParcels();

    return () => {
      stopCamera();
      workerRef.current?.terminate();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    scanIntervalRef.current = setInterval(() => {
      if (!isProcessing) captureAndScan();
    }, 3000);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isProcessing]);

  /* ---------------- OCR WORKER ---------------- */

  const initWorker = async () => {
    const worker = await createWorker("eng");

    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });

    workerRef.current = worker;
  };

  /* ---------------- CAMERA ---------------- */

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();
      streamRef.current = stream;
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  /* ---------------- STORAGE ---------------- */

  const loadParcels = () => {
    const items: Parcel[] = [];

    Object.keys(localStorage)
      .filter((k) => k.startsWith("parcel:"))
      .forEach((key) => {
        const value = localStorage.getItem(key);
        if (value) items.push(JSON.parse(value));
      });

    setParcels(items.sort((a, b) => b.timestamp - a.timestamp));
  };

  const saveParcel = (trackingNumber: string) => {
    if (parcels.some((p) => p.trackingNumber === trackingNumber)) return;

    const parcel: Parcel = {
      id: Date.now().toString(),
      trackingNumber,
      timestamp: Date.now(),
      date: new Date().toLocaleString(),
    };

    localStorage.setItem(`parcel:${parcel.id}`, JSON.stringify(parcel));
    setScannedText(trackingNumber);
    loadParcels();
  };

  const deleteParcel = (id: string) => {
    localStorage.removeItem(`parcel:${id}`);
    loadParcels();
  };

  /* ---------------- OCR SCAN ---------------- */

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const {
        data: { text },
      } = await workerRef.current.recognize(canvas);

      const matches = text.match(/\bUD[A-Z0-9]+\b/g);

      if (matches) {
        matches.forEach(saveParcel);
      }
    } catch (err) {
      console.error("OCR error:", err);
    }

    setIsProcessing(false);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 text-black">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-purple-600 p-2 rounded-xl">
            <Package className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-black">
            Parcel Scanner (UD OCR)
          </h1>
        </div>
      </div>

      {/* Camera */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-black aspect-video rounded-xl overflow-hidden relative">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {isProcessing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 rounded-full flex gap-2">
              <Loader className="animate-spin w-4 h-4" />
              OCR Scanning…
            </div>
          )}

          {scannedText && (
            <div className="absolute bottom-4 left-4 right-4 bg-white p-4 rounded-xl">
              <p className="font-bold text-lg text-black">
                {scannedText}
              </p>
            </div>
          )}
        </div>

        {/* Stored parcels */}
        <div className="bg-white mt-6 rounded-xl p-4">
          <h3 className="font-bold mb-2 text-black">
            Stored Parcels ({parcels.length})
          </h3>

          {parcels.map((p) => (
            <div
              key={p.id}
              className="flex justify-between bg-gray-50 p-3 rounded-lg mb-2"
            >
              <div>
                <p className="font-semibold text-black">
                  {p.trackingNumber}
                </p>
                <p className="text-sm text-black">
                  {p.date}
                </p>
              </div>
              <button
                onClick={() => deleteParcel(p.id)}
                className="text-black font-semibold"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
