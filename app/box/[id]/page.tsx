'use client';

import { useState, useEffect } from 'react';
import { useBoxStore } from '@/store/useBoxStore';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Edit2, Check, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

export default function BoxDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { boxes, isLoaded, loadBoxes, updateBox, deleteBox, moveId, setMoveId } = useBoxStore();
  const [isEditing, setIsEditing] = useState(false);
  
  const box = boxes.find(b => b.id === id);
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (!moveId) {
      const storedMoveId = localStorage.getItem('boxscout-move-id');
      if (storedMoveId) {
        setMoveId(storedMoveId);
        loadBoxes(storedMoveId);
      } else {
        router.push('/');
      }
    } else if (!isLoaded) {
      loadBoxes(moveId);
    }
  }, [isLoaded, loadBoxes, moveId, setMoveId, router]);

  const startEditing = () => {
    setEditData({ ...box });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData(null);
  };

  if (!isLoaded) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (!box) return <div className="text-center py-12">Box not found</div>;

  const handleSave = async () => {
    try {
      await updateBox(box.id, {
        boxNumber: editData.boxNumber,
        destinationRoom: editData.destinationRoom,
        items: editData.items.filter((i: string) => i.trim() !== '')
      });
      setIsEditing(false);
      toast.success('Box updated successfully');
    } catch (error) {
      toast.error('Failed to update box');
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this box?')) {
      try {
        await deleteBox(box.id);
        toast.success('Box deleted');
        router.push('/');
      } catch (error) {
        toast.error('Failed to delete box');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>
        <div className="flex space-x-2">
          {!isEditing ? (
            <>
              <button
                onClick={startEditing}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={cancelEditing}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <X className="w-4 h-4 mr-1.5" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2 bg-gray-100 relative min-h-[300px]">
            {box.photoUrl ? (
              <Image 
                src={box.photoUrl} 
                alt={`Box ${box.boxNumber}`} 
                fill
                className="object-contain" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No photo available
              </div>
            )}
          </div>
          <div className="md:w-1/2 p-6 md:p-8 space-y-6">
            {!isEditing ? (
              <>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Box #{box.boxNumber}</h1>
                  <p className="text-lg text-gray-500 mt-1">{box.destinationRoom}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Contents ({box.items.length} items)</h3>
                  <ul className="space-y-2">
                    {box.items.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="h-6 flex items-center">
                          <span className="h-2 w-2 bg-indigo-400 rounded-full mr-3"></span>
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Box Number</label>
                    <input
                      type="number"
                      value={editData.boxNumber}
                      onChange={(e) => setEditData({...editData, boxNumber: parseInt(e.target.value) || 0})}
                      className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Room</label>
                    <input
                      type="text"
                      value={editData.destinationRoom}
                      onChange={(e) => setEditData({...editData, destinationRoom: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                  <div className="space-y-2">
                    {editData.items.map((item: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newItems = [...editData.items];
                            newItems[index] = e.target.value;
                            setEditData({...editData, items: newItems});
                          }}
                          className="block w-full border border-gray-300 rounded-xl shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = editData.items.filter((_: string, i: number) => i !== index);
                            setEditData({...editData, items: newItems});
                          }}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditData({...editData, items: [...editData.items, '']})}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
