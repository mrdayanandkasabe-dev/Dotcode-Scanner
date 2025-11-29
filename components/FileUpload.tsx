import React, { useRef } from 'react';
import { Upload, Layers } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (images: string[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const promises = validFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          }
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(images => {
      onFileSelect(images);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  return (
    <div
      className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 group"
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />
      <div className="p-4 rounded-full bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors relative">
        <Upload size={32} />
        <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-blue-100 shadow-sm">
          <Layers size={14} className="text-blue-600" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-700">Click to upload images</p>
        <p className="text-sm text-gray-500 mt-1">Select multiple photos or drag and drop</p>
      </div>
    </div>
  );
};

export default FileUpload;