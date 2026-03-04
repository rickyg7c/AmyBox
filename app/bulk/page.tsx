'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, CheckCircle2, XCircle, Play } from 'lucide-react';
import Image from 'next/image';
import { extractBoxData as extractBoxDataServer } from '@/lib/ai';
import { extractBoxData as extractBoxDataClient } from '@/lib/ai-client';
import { resizeImage } from '@/lib/image-utils';
import { useBoxStore } from '@/store/useBoxStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface FileStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  previewUrl: string;
  error?: string;
}

export default function BulkImport() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const { addBox, moveId, setMoveId, loadBoxes } = useBoxStore();
  const router = useRouter();

  useEffect(() => {
    if (!moveId) {
      const storedMoveId = localStorage.getItem('boxscout-move-id');
      if (storedMoveId) {
        setMoveId(storedMoveId);
        loadBoxes(storedMoveId);
      } else {
        router.push('/');
      }
    }
  }, [moveId, setMoveId, loadBoxes, router]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      previewUrl: URL.createObjectURL(file)
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    }
  });

  const processAll = async () => {
    if (files.length === 0) return;
    
    setIsProcessingAll(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];
      if (fileStatus.status === 'success') continue;

      setFiles(prev => prev.map((f, index) => index === i ? { ...f, status: 'processing' } : f));

      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileStatus.file);
        });

        const rawBase64 = await base64Promise;
        const base64 = await resizeImage(rawBase64, 1200, 1200, 0.7);
        
        let data;
        try {
          data = await extractBoxDataServer(base64, 'image/jpeg');
        } catch (serverError: any) {
          console.error('Server-side extraction failed:', serverError);
          if (serverError.message?.includes('API key') || serverError.message?.includes('fetch')) {
            console.log('Attempting client-side extraction fallback...');
            data = await extractBoxDataClient(base64, 'image/jpeg');
          } else {
            throw serverError;
          }
        }

        await addBox({
          boxNumber: data.box_number,
          destinationRoom: data.destination_room,
          items: data.items,
          photoUrl: base64,
        });

        setFiles(prev => prev.map((f, index) => index === i ? { ...f, status: 'success' } : f));
        successCount++;
      } catch (error: any) {
        console.error(error);
        let errorMessage = 'Failed to process';
        if (error.message?.includes('API key')) {
          errorMessage = 'Invalid API Key. Check your Secrets.';
        } else if (error.message?.includes('fetch')) {
          errorMessage = 'Network error or Ad-blocker detected. Please disable ad-blockers and check your connection.';
        }
        setFiles(prev => prev.map((f, index) => index === i ? { ...f, status: 'error', error: errorMessage } : f));
      }
    }

    setIsProcessingAll(false);
    
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} boxes!`);
      if (successCount === files.length) {
        setTimeout(() => router.push('/'), 1500);
      }
    } else {
      toast.error('Failed to import any boxes. Please try again.');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].previewUrl);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bulk Import</h1>
        <p className="text-gray-500 mt-1">Upload multiple photos of your box lists to process them all at once.</p>
      </div>

      <div className="space-y-4">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors hidden md:block ${
            isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">Select multiple photos</p>
              <p className="text-sm text-gray-500 mt-1">or drag and drop them here</p>
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e: any) => {
                if (e.target.files && e.target.files.length > 0) {
                  onDrop(Array.from(e.target.files));
                }
              };
              input.click();
            }}
            className="w-full flex items-center justify-center space-x-3 p-6 bg-indigo-600 text-white rounded-2xl shadow-sm hover:bg-indigo-700 transition-colors active:scale-95"
          >
            <Upload className="w-6 h-6" />
            <span className="text-lg font-semibold">Select Photos to Import</span>
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Files ({files.length})
            </h3>
            
            <button
              onClick={processAll}
              disabled={isProcessingAll || pendingCount === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessingAll ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  Processing ({processingCount + successCount + errorCount}/{files.length})
                </>
              ) : (
                <>
                  <Play className="-ml-1 mr-2 h-4 w-4" />
                  Process All Pending
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {files.map((fileStatus, index) => (
              <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-square">
                <Image 
                  src={fileStatus.previewUrl} 
                  alt={`Preview ${index}`} 
                  fill
                  className="object-cover" 
                  referrerPolicy="no-referrer"
                />
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {fileStatus.status === 'pending' && !isProcessingAll && (
                    <button 
                      onClick={() => removeFile(index)}
                      className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50"
                    >
                      <XCircle className="w-6 h-6" />
                    </button>
                  )}
                </div>

                <div className="absolute top-2 right-2">
                  {fileStatus.status === 'processing' && (
                    <div className="bg-white rounded-full p-1 shadow-sm">
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    </div>
                  )}
                  {fileStatus.status === 'success' && (
                    <div className="bg-white rounded-full p-1 shadow-sm">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  {fileStatus.status === 'error' && (
                    <div className="bg-white rounded-full p-1 shadow-sm" title={fileStatus.error}>
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
