import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CameraInputProps {
  onCapture: (image: string) => void;
  onClose: () => void;
}

const CameraInput: React.FC<CameraInputProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prefer back camera
        });

        if (!isMounted) {
          // Component unmounted while waiting for camera
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        mediaStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          setError('Unable to access camera. Please ensure permissions are granted.');
          console.error("Camera error:", err);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageSrc = canvas.toDataURL('image/jpeg');
        onCapture(imageSrc);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="text-white p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50">
          <X size={24} />
        </button>
      </div>
      
      {error ? (
        <div className="text-white p-4 text-center">
          <p>{error}</p>
          <button onClick={onClose} className="mt-4 bg-white text-black px-4 py-2 rounded-lg">
            Close
          </button>
        </div>
      ) : (
        <>
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] h-[60%] border-2 border-white/50 rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
                
                <div className="absolute inset-x-0 bottom-[-60px] flex flex-col items-center">
                  <p className="text-white text-sm font-semibold shadow-black drop-shadow-md bg-black/30 px-3 py-1 rounded-full">
                    Ensure all codes are visible
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 w-full flex justify-center items-center">
            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/50 transition-all"
            >
              <div className="w-16 h-16 bg-white rounded-full"></div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CameraInput;