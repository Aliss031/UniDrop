"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Package,
  Database,
  CheckCircle,
  XCircle,
  Loader,
} from "lucide-react";

type Parcel = {
  id: string;
  trackingNumber: string;
  timestamp: number;
  status: string;
  date: string;
};

export default function ParcelScannerApp() {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedText, setScannedText] = useState("");
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadParcels();
    startCamera();

    return () => {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [cameraFacing]); // restart camera if facing changes

  useEffect(() => {
    if (isScanning && videoRef.current && !scanIntervalRef.current) {
      scanIntervalRef.current = setInterval(() => {
        if (!isProcessing) captureAndScan();
      }, 2000);
    } else if (!isScanning && scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isScanning, isProcessing]);

  // -------- Storage (localStorage) --------

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

  const saveParcel = async (trackingNumber: string) => {
    const parcel: Parcel = {
      id: Date.now().toString(),
      trackingNumber,
      timestamp: Date.now(),
      status: "Scanned",
      date: new Date().toLocaleString(),
    };

    localStorage.setItem(`parcel:${parcel.id}`, JSON.stringify(parcel));
    showNotification("Parcel saved successfully!", "success");
    loadParcels();

    setTimeout(() => setScannedText(""), 2000);
  };

  const deleteParcel = (id: string) => {
    localStorage.removeItem(`parcel:${id}`);
    showNotification("Parcel deleted", "success");
    loadParcels();
  };

  // -------- Camera --------

  const startCamera = async () => {
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: cameraFacing }, // back or front
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        streamRef.current = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      showNotification("Camera access denied or not supported", "error");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Mock scan
    if (Math.random() > 0.7) {
      const mockNumbers = [
        "1Z999AA10123456784",
        "TRK" + Math.random().toString(36).slice(2, 11).toUpperCase(),
        "PKG" + Date.now().toString().slice(-8),
      ];

      const detected =
        mockNumbers[Math.floor(Math.random() * mockNumbers.length)];

      setScannedText(detected);
      await saveParcel(detected);
    }

    setIsProcessing(false);
  };

  const showNotification = (message: string, type: "success" | "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // -------- UI --------

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Parcel Scanner</h1>
              <p className="text-sm text-gray-500">Auto-scanning enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCamera}
              className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg"
            >
              <Camera className="w-4 h-4" />
              Flip Camera
            </button>
            <div className="flex items-center gap-2 text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              Scanning
            </div>
          </div>
        </div>
      </div>

      {/* Camera */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-black aspect-video rounded-xl overflow-hidden relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {isProcessing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full flex gap-2">
              <Loader className="animate-spin w-4 h-4" />
              Processing…
            </div>
          )}

          {scannedText && (
            <div className="absolute bottom-4 left-4 right-4 bg-white p-4 rounded-xl">
              <p className="font-bold text-lg">{scannedText}</p>
            </div>
          )}
        </div>

        {/* Stored parcels */}
        <div className="bg-white mt-6 rounded-xl p-4">
          <h3 className="font-bold mb-2">
            Stored Parcels ({parcels.length})
          </h3>
          {parcels.map((p) => (
            <div
              key={p.id}
              className="flex justify-between bg-gray-50 p-3 rounded-lg mb-2"
            >
              <div>
                <p className="font-semibold">{p.trackingNumber}</p>
                <p className="text-sm text-gray-500">{p.date}</p>
              </div>
              <button
                onClick={() => deleteParcel(p.id)}
                className="text-red-600"
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
