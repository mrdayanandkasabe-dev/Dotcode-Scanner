import React, { useState } from 'react';
import { AnalysisResult, ScannedItem } from '../services/gemini';
import { Copy, CheckCircle, Calendar, Tag, Home, Download, FileImage } from 'lucide-react';

export interface SessionInfo {
  date: string;
  city: string;
  supervisorCode: string;
  supervisorName: string;
  variantName: string;
}

interface ResultsProps {
  result: AnalysisResult;
  images: string[];
  onReset: () => void;
  onHome: () => void;
  sessionInfo: SessionInfo;
}

const CodeCard: React.FC<{ item: ScannedItem; index: number }> = ({ item, index }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (item.dotCode) {
      navigator.clipboard.writeText(item.dotCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
          <div className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">
            {index + 1}
          </div>
          <span>Product Code</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${
          item.confidence === 'High' ? 'bg-green-50 border-green-200 text-green-700' : 
          item.confidence === 'Medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 
          'bg-red-50 border-red-200 text-red-700'
        }`}>
          {item.confidence}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-gray-900 tracking-tight break-all">
            {item.dotCode || "No code"}
          </div>
          <button 
            onClick={copyToClipboard}
            className="mt-2 text-xs flex items-center justify-center gap-1 mx-auto text-blue-600 hover:text-blue-800 font-medium"
          >
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex flex-col">
             <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1">
               <Calendar size={10} /> MFD
             </span>
             <span className="font-medium text-gray-900">{item.manufacturingDate || "-"}</span>
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1">
               <Tag size={10} /> Price
             </span>
             <span className="font-medium text-gray-900">{item.price || "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Results: React.FC<ResultsProps> = ({ result, images, onReset, onHome, sessionInfo }) => {
  const handleExport = () => {
    try {
      if (!result.items || result.items.length === 0) {
        alert("No items to export");
        return;
      }

      // Helper to safely stringify and escape values for CSV
      const safeStr = (val: any) => {
        if (val === null || val === undefined) return "";
        return String(val).replace(/"/g, '""');
      };
      
      const headers = [
        "Item Index",
        "Session Date",
        "City",
        "Supervisor Code",
        "Supervisor Name",
        "Variant Name",
        "DotCode",
        "MFD",
        "Price"
      ];

      const rows = result.items.map((item, idx) => {
        return [
          idx + 1,
          `"${safeStr(sessionInfo.date)}"`,
          `"${safeStr(sessionInfo.city)}"`,
          `"${safeStr(sessionInfo.supervisorCode)}"`,
          `"${safeStr(sessionInfo.supervisorName)}"`,
          `"${safeStr(sessionInfo.variantName)}"`,
          `"${safeStr(item.dotCode)}"`,
          `"${safeStr(item.manufacturingDate)}"`,
          `"${safeStr(item.price)}"`
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      // Filename format: supervisor name_variant name_date
      const fileName = `${sessionInfo.supervisorName}_${sessionInfo.variantName}_${sessionInfo.date}.csv`;
      link.setAttribute("download", fileName);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export error:", error);
      alert("An error occurred during export.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Results Summary Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Scan Results</h3>
          <p className="text-sm text-gray-500">{result.summary}</p>
          {images && images.length > 1 && (
             <div className="flex items-center gap-2 mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
               <FileImage size={12} />
               <span>Merged results from {images.length} images</span>
             </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Download size={18} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Image Preview (Thumbnail) */}
      {images && images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
           {images.map((img, i) => (
             <div key={i} className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 group">
               <img src={img} alt={`Scan ${i}`} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
               <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1">
                 #{i + 1}
               </div>
             </div>
           ))}
        </div>
      )}

      {/* Grid of Codes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {result.items.map((item, index) => (
          <CodeCard key={`${index}-${item.dotCode}`} item={item} index={index} />
        ))}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 pb-4">
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Copy size={20} />
          Scan New Batch
        </button>

        <button 
          onClick={onHome}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Home size={20} />
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default Results;