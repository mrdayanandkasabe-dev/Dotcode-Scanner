import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { ScanBarcode, ClipboardList, Calendar, MapPin, User, Package, Home, AlertCircle, Hash, ChevronDown, WifiOff, Download, Settings, Key, CheckCircle, ChevronRight, ChevronUp } from 'lucide-react';
import FileUpload from './components/FileUpload';
import Results from './components/Results';
import { analyzeImage, AnalysisResult, ScannedItem, hasApiKey, setStoredApiKey, removeStoredApiKey } from './services/gemini';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary Component to catch runtime crashes
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-red-100 max-w-md w-full text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
              <AlertCircle size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6 text-sm">
              The application encountered an unexpected error.
              <br />
              <span className="font-mono text-xs bg-gray-100 p-1 rounded mt-2 inline-block max-w-full truncate">
                {this.state.error?.message}
              </span>
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface SessionInfo {
  date: string;
  city: string;
  supervisorCode: string;
  supervisorName: string;
  variantName: string;
}

const VARIANTS = [
  "MLB Red 10",
  "MLB Red 20",
  "MLB Gold Advance 10",
  "MLB Gold Advance 20",
  "MLB Advance Compact 10",
  "MLB Advance Compact EDGE 10",
  "MLB Advance Pocket 10",
  "MLB Gold 10",
  "MLB Gold 20",
  "MLB Fine Touch 10",
  "MLB Fuse Beyond 10",
  "MLB Fuse Beyond 20",
  "MLB Clove Mix 10",
  "MLB Filter Black 12",
  "MLB MLB Filter Black 10",
  "MLB Vista Forest Fusion 20",
  "MLB Vista Double Fusion 20",
  "MLB Vista Taaza Twist 10",
  "MLB Vista Forest Twist 10",
];

const AppContent: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [images, setImages] = useState<string[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // API Key State
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  useEffect(() => {
    // Check for API key on mount
    if (!hasApiKey()) {
      setIsApiKeyMissing(true);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA install event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setStoredApiKey(tempApiKey);
      setIsApiKeyMissing(false);
      setShowSettings(false);
      setError(null);
      setErrorDetails(null);
    }
  };

  const handleClearApiKey = () => {
    removeStoredApiKey();
    setIsApiKeyMissing(!hasApiKey()); // Re-check (might still be env var)
    setTempApiKey("");
    window.location.reload(); // Reload to ensure clean state
  };

  const handleSessionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOnline) {
      setError("Internet connection is required to start a session.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    setSessionInfo({
      date: (formData.get('date') as string) || new Date().toISOString().split('T')[0],
      city: (formData.get('city') as string) || "",
      supervisorCode: (formData.get('supervisorCode') as string) || "",
      supervisorName: (formData.get('supervisorName') as string) || "",
      variantName: (formData.get('variantName') as string) || "",
    });
    setError(null);
    setErrorDetails(null);
  };

  const handleScanReset = () => {
    setImages(null);
    setResult(null);
    setError(null);
    setErrorDetails(null);
    setShowErrorDetails(false);
  };

  const handleHome = () => {
    setSessionInfo(null);
    handleScanReset();
  };

  const handleImageSelect = async (selectedImages: string[]) => {
    if (!isOnline) {
      setError("Cannot analyze images without an internet connection.");
      return;
    }
    setImages(selectedImages);
    processImages(selectedImages);
  };

  const processImages = async (imgs: string[]) => {
    setIsProcessing(true);
    setError(null);
    setErrorDetails(null);
    const uniqueCodes = new Set<string>();
    const allItems: ScannedItem[] = [];
    let processedCount = 0;
    
    // Use 'any' to handle mixed error types safely
    let lastError: any = null;

    try {
      // Process images concurrently
      const promises = imgs.map(async (img) => {
        try {
          return await analyzeImage(img);
        } catch (e: any) {
          console.error("Error analyzing one of the images:", e);
          lastError = e;
          return null;
        }
      });

      const results = await Promise.all(promises);

      results.forEach(res => {
        if (res && res.items) {
          res.items.forEach(item => {
            // Normalize code to check for duplicates (remove all whitespace)
            const normalizedCode = (item.dotCode || "").replace(/\s+/g, '').toUpperCase();
            
            // Only add if we have a valid code and haven't seen it yet
            if (normalizedCode.length > 0 && !uniqueCodes.has(normalizedCode)) {
              uniqueCodes.add(normalizedCode);
              allItems.push(item);
            }
          });
          processedCount++;
        }
      });

      if (processedCount === 0 && imgs.length > 0) {
         // Priority Check: Did we fail because of the API Key?
         if (lastError && (lastError.code === "MISSING_API_KEY" || lastError.message?.includes("API Key"))) {
            setIsApiKeyMissing(true); // Trigger Setup Screen
            throw new Error("API Key configuration is missing or invalid.");
         }
         
         // Check for network error explicitly
         if (lastError?.message?.includes("fetch") || lastError?.message?.includes("network")) {
            throw new Error("Network error detected. Please check your internet connection.");
         }

         // Capture the actual error message if present
         if (lastError) {
             setErrorDetails(lastError.message || String(lastError));
             throw new Error("Analysis failed. See technical details for more info.");
         }

         // Otherwise, generic no results found
         setErrorDetails("The AI scanned the image but did not return any recognized items. This usually means the image is blurry, the codes are too small, or the model could not confidently read the text.");
         throw new Error("No recognizable DotCodes found. Please ensure image is clear.");
      }

      setResult({
        items: allItems,
        summary: `Processed ${processedCount} of ${imgs.length} images. Found ${allItems.length} unique codes.`
      });

    } catch (err: any) {
      if (err.message !== "API Key configuration is missing or invalid.") {
         setError(err.message || "An unexpected error occurred.");
         if (!errorDetails && err.message) {
            setErrorDetails(err.message);
         }
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // RENDER: API Key Setup Screen
  if (isApiKeyMissing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600">
            <Key size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Required</h1>
          <p className="text-gray-500 mb-6">
            To use the DotCode Scanner, you need to provide a Google Gemini API Key. This will be stored locally on your device.
          </p>
          
          <div className="text-left mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter Gemini API Key</label>
            <input 
              type="text" 
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-gray-400 mt-2">
              Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Get one here</a>
            </p>
          </div>

          <button 
            onClick={handleSaveApiKey}
            disabled={!tempApiKey.trim()}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CheckCircle size={20} />
            Save & Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo / Title */}
          <button 
            onClick={() => sessionInfo && handleHome()}
            disabled={!sessionInfo}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity disabled:cursor-default disabled:opacity-100"
          >
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
               <ScanBarcode size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-gray-800">DotCode Scanner</h1>
          </button>
          
          {/* Top Right Actions */}
          <div className="flex items-center gap-2">
            {/* Install Button */}
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-blue-200 shadow-sm animate-pulse"
                title="Install App"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {sessionInfo && (
              <button 
                onClick={handleHome}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-3 py-2 rounded-lg flex items-center gap-2 transition-colors border border-gray-200 shadow-sm"
                title="End Session and Return Home"
              >
                <Home size={18} />
                <span className="hidden sm:inline">Home</span>
              </button>
            )}

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute right-4 top-16 bg-white shadow-xl border border-gray-200 rounded-xl p-4 w-64 z-50">
             <h3 className="font-bold text-gray-900 mb-2">Settings</h3>
             <button 
                onClick={handleClearApiKey}
                className="w-full text-left text-sm text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-2"
             >
                <Key size={16} />
                Reset/Change API Key
             </button>
          </div>
        )}
        
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
            <WifiOff size={16} />
            <span>No Internet Connection. Scanning requires online access to AI Cloud.</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {!sessionInfo ? (
          // SESSION DETAILS FORM
          <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-200 mt-8">
            <div className="mb-8 text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Session Details</h2>
              <p className="text-gray-500 mt-2 text-sm">Enter the batch details to start scanning.</p>
            </div>

            <form onSubmit={handleSessionSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Calendar size={18} />
                  </div>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <MapPin size={18} />
                  </div>
                  <input 
                    name="city" 
                    type="text" 
                    required 
                    placeholder="Enter City"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 bg-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Hash size={18} />
                  </div>
                  <input 
                    name="supervisorCode" 
                    type="text" 
                    required 
                    placeholder="Enter Code"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 bg-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input 
                    name="supervisorName" 
                    type="text" 
                    required 
                    placeholder="Enter Name"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 bg-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Package size={18} />
                  </div>
                  <select 
                    name="variantName" 
                    required 
                    defaultValue=""
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 bg-white appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select Variant</option>
                    {VARIANTS.map(variant => (
                      <option key={variant} value={variant}>{variant}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={!isOnline}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 mt-4 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isOnline ? "Start Scanning" : "Offline - Scanning Unavailable"}
              </button>
            </form>
          </div>
        ) : (
          // SCANNING VIEW
          <div className="space-y-6">
            {/* Session Summary Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between text-sm">
               <div className="flex flex-wrap gap-4">
                 <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={16} />
                    <span>{sessionInfo.date}</span>
                 </div>
                 <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={16} />
                    <span>{sessionInfo.city}</span>
                 </div>
                 <div className="flex items-center gap-2 text-gray-600">
                    <Hash size={16} />
                    <span className="font-medium text-gray-900">{sessionInfo.supervisorCode}</span>
                 </div>
                 <div className="flex items-center gap-2 text-gray-600">
                    <User size={16} />
                    <span className="font-medium text-gray-900">{sessionInfo.supervisorName}</span>
                 </div>
                 <div className="flex items-center gap-2 text-gray-600">
                    <Package size={16} />
                    <span className="font-medium text-gray-900">{sessionInfo.variantName}</span>
                 </div>
               </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <span className="font-medium">{error}</span>
                </div>
                {errorDetails && (
                   <div className="mt-2 text-xs">
                      <button 
                        onClick={() => setShowErrorDetails(!showErrorDetails)}
                        className="flex items-center gap-1 text-red-700 font-semibold hover:underline mb-1"
                      >
                         {showErrorDetails ? <ChevronUp size={12} /> : <ChevronRight size={12} />}
                         {showErrorDetails ? "Hide Technical Details" : "Show Technical Details"}
                      </button>
                      {showErrorDetails && (
                         <div className="bg-white/50 p-2 rounded border border-red-100 font-mono break-all whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {errorDetails}
                         </div>
                      )}
                   </div>
                )}
              </div>
            )}

            {/* Main Action Area */}
            {!result && !isProcessing && (
              <div className="flex flex-col items-center gap-6 mt-8">
                 {isOnline ? (
                   <div className="w-full max-w-md">
                     <FileUpload onFileSelect={handleImageSelect} />
                   </div>
                 ) : (
                   <div className="text-center py-10 opacity-60">
                     <WifiOff size={48} className="mx-auto mb-4 text-gray-400" />
                     <p className="text-lg font-medium text-gray-600">You are currently offline.</p>
                     <p className="text-gray-500">Please connect to the internet to upload and scan images.</p>
                   </div>
                 )}
              </div>
            )}

            {/* Loading State */}
            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900">Processing Images...</h3>
                <p className="text-gray-500 mt-2">Identifying DotCodes and analyzing data.</p>
              </div>
            )}

            {/* Results View */}
            {result && (
              <Results 
                result={result} 
                images={images || []} 
                onReset={handleScanReset} 
                onHome={handleHome}
                sessionInfo={sessionInfo}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;