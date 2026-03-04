'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, Loader2, X, Check } from 'lucide-react';
import Image from 'next/image';
import { extractBoxData as extractBoxDataServer, ExtractedBoxData } from '@/lib/ai';
import { extractBoxData as extractBoxDataClient } from '@/lib/ai-client';
import { resizeImage } from '@/lib/image-utils';
import { useBoxStore } from '@/store/useBoxStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function AddBox() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedBoxData | null>(null);
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
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setExtractedData(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    maxFiles: 1,
    noClick: true, // We'll handle clicks manually for better control
    noKeyboard: true
  });

  const openCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files.length > 0) {
        onDrop([e.target.files[0]]);
      }
    };
    input.click();
  };

  const openGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files.length > 0) {
        onDrop([e.target.files[0]]);
      }
    };
    input.click();
  };

  const handleProcess = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const rawBase64 = reader.result as string;
        try {
          const base64 = await resizeImage(rawBase64, 1200, 1200, 0.7);
          setPreviewUrl(base64); // Update preview with compressed version
          
          let data: ExtractedBoxData | null = null;
          try {
            console.log('Attempting server-side extraction...');
            data = await extractBoxDataServer(base64, 'image/jpeg');
          } catch (serverError: any) {
            console.error('Server-side extraction failed:', serverError);
            
            // If server fails due to API key or network, try client-side as fallback
            if (serverError.message?.includes('API key') || serverError.message?.includes('fetch')) {
              console.log('Attempting client-side extraction fallback...');
              try {
                data = await extractBoxDataClient(base64, 'image/jpeg');
              } catch (clientError: any) {
                console.error('Client-side extraction failed:', clientError);
                throw clientError; // Throw the client error if both fail
              }
            } else {
              throw serverError; // Throw original error if it's not key/network related
            }
          }

          if (!data) throw new Error('Failed to extract data');
          
          setExtractedData(data);
          toast.success('Successfully scanned box contents!');
        } catch (error: any) {
          console.error('AI Processing Error:', error);
          let errorMessage = 'Failed to process image. Please try again.';
          const errString = error.toString().toLowerCase();
          const errMessage = error.message?.toLowerCase() || '';

          if (errString.includes('api key') || errMessage.includes('api key') || errString.includes('403')) {
            errorMessage = 'Invalid or missing Gemini API Key. Please check your environment configuration.';
          } else if (errString.includes('fetch') || errMessage.includes('fetch') || errString.includes('network')) {
            errorMessage = 'Network error. This might be caused by ad-blockers, firewall, or connection issues. Please check your internet connection.';
          } else if (errString.includes('429') || errMessage.includes('quota') || errMessage.includes('exhausted')) {
            errorMessage = 'AI Usage Quota Exceeded. Please try again later or check your billing details.';
          } else if (errString.includes('500') || errString.includes('503') || errMessage.includes('internal')) {
            errorMessage = 'AI Service is currently experiencing issues. Please try again in a few moments.';
          } else if (errMessage.includes('safety') || errMessage.includes('blocked')) {
            errorMessage = 'The image was flagged by safety filters. Please try a different image.';
          } else if (errMessage.includes('candidate') || errMessage.includes('empty')) {
            errorMessage = 'The AI could not extract data from this image. Please ensure the text is legible and try again.';
          }

          toast.error(errorMessage, {
            duration: 5000, // Show for longer so user can read it
          });
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      toast.error('Failed to read file.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData || !previewUrl) return;

    try {
      // Convert previewUrl to base64 for storage
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        await addBox({
          boxNumber: extractedData.box_number,
          destinationRoom: extractedData.destination_room,
          items: extractedData.items,
          photoUrl: base64data,
        });
        
        toast.success('Box saved successfully!');
        router.push('/');
      };
    } catch (error) {
      console.error(error);
      toast.error('Failed to save box.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Scan New Box</h1>
        <p className="text-gray-500 mt-1">Upload a photo of your box list to automatically extract its contents.</p>
      </div>

      {!previewUrl ? (
        <div className="space-y-4">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors hidden md:block ${
              isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Drag and drop an image here</p>
                <p className="text-sm text-gray-500 mt-1">or click the buttons below</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={openCamera}
              className="flex items-center justify-center space-x-3 p-6 bg-indigo-600 text-white rounded-2xl shadow-sm hover:bg-indigo-700 transition-colors active:scale-95"
            >
              <Camera className="w-6 h-6" />
              <span className="text-lg font-semibold">Take Photo</span>
            </button>
            <button
              onClick={openGallery}
              className="flex items-center justify-center space-x-3 p-6 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors active:scale-95"
            >
              <Upload className="w-6 h-6" />
              <span className="text-lg font-semibold">Choose from Gallery</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 min-h-[200px]">
            <Image 
              src={previewUrl} 
              alt="Preview" 
              fill
              className="object-contain" 
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => {
                setFile(null);
                setPreviewUrl(null);
                setExtractedData(null);
              }}
              className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-700 hover:bg-white shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!extractedData ? (
            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Processing with AI...
                </>
              ) : (
                'Extract List with AI'
              )}
            </button>
          ) : (
            <form onSubmit={handleSave} className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Review Extracted Data</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="box_number" className="block text-sm font-medium text-gray-700">Box Number</label>
                  <input
                    type="number"
                    id="box_number"
                    value={extractedData.box_number}
                    onChange={(e) => setExtractedData({...extractedData, box_number: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="destination_room" className="block text-sm font-medium text-gray-700">Destination Room</label>
                  <input
                    type="text"
                    id="destination_room"
                    value={extractedData.destination_room}
                    onChange={(e) => setExtractedData({...extractedData, destination_room: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                <div className="space-y-2">
                  {extractedData.items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const newItems = [...extractedData.items];
                          newItems[index] = e.target.value;
                          setExtractedData({...extractedData, items: newItems});
                        }}
                        className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = extractedData.items.filter((_, i) => i !== index);
                          setExtractedData({...extractedData, items: newItems});
                        }}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExtractedData({...extractedData, items: [...extractedData.items, '']})}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Check className="-ml-1 mr-2 h-5 w-5" />
                  Save Box
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
