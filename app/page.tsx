'use client';

import { useEffect, useState, useMemo } from 'react';
import { useBoxStore } from '@/store/useBoxStore';
import { Search, PackageOpen, Filter, X, Settings, Download } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';

export default function Dashboard() {
  const { boxes, isLoaded, loadBoxes, moveId, setMoveId } = useBoxStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSwitchingMove, setIsSwitchingMove] = useState(false);
  const [targetMoveId, setTargetMoveId] = useState('');
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [isLoadingEnv, setIsLoadingEnv] = useState(false);

  const handleExportCSV = () => {
    if (boxes.length === 0) {
      toast.error('No boxes to export');
      return;
    }

    // Group boxes by room
    const boxesByRoom: Record<string, typeof boxes> = {};
    boxes.forEach(box => {
      const room = box.destinationRoom || 'Unassigned';
      if (!boxesByRoom[room]) {
        boxesByRoom[room] = [];
      }
      boxesByRoom[room].push(box);
    });

    // Sort rooms alphabetically
    const sortedRooms = Object.keys(boxesByRoom).sort();

    // Build CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    sortedRooms.forEach(room => {
      // Room Header
      csvContent += `Room: ${room}\n`;
      csvContent += "Box Number,Items\n";
      
      // Sort boxes by number
      const roomBoxes = boxesByRoom[room].sort((a, b) => a.boxNumber - b.boxNumber);
      
      roomBoxes.forEach(box => {
        // Escape quotes in items and join with semi-colons to keep in one cell
        const items = box.items.map(i => i.replace(/"/g, '""')).join('; ');
        csvContent += `${box.boxNumber},"${items}"\n`;
      });
      
      // Add empty line between rooms
      csvContent += "\n";
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `amybox_inventory_${moveId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Spreadsheet exported successfully!');
  };

  const checkEnv = async () => {
    setIsLoadingEnv(true);
    try {
      // Dynamic import to avoid build issues if action isn't ready
      const { checkEnvironmentStatus } = await import('@/app/actions');
      const status = await checkEnvironmentStatus();
      setEnvStatus(status);
    } catch (e) {
      console.error(e);
      toast.error('Failed to check environment');
    } finally {
      setIsLoadingEnv(false);
    }
  };

  useEffect(() => {
    // 1. Check URL for moveId
    const urlParams = new URLSearchParams(window.location.search);
    const urlMoveId = urlParams.get('moveId');
    
    // 2. Check LocalStorage
    const storedMoveId = localStorage.getItem('boxscout-move-id');
    
    const finalMoveId = urlMoveId || storedMoveId || `move-${Math.random().toString(36).substring(2, 9)}`;
    
    if (finalMoveId !== moveId) {
      setMoveId(finalMoveId);
      loadBoxes(finalMoveId);
      
      // Store in history
      const history = JSON.parse(localStorage.getItem('boxscout-move-history') || '[]');
      if (!history.includes(finalMoveId)) {
        const newHistory = [finalMoveId, ...history].slice(0, 5);
        localStorage.setItem('boxscout-move-history', JSON.stringify(newHistory));
      }
    } else if (!isLoaded) {
      // Ensure we load if we have a moveId but haven't loaded yet
      loadBoxes(finalMoveId);
    }
  }, [moveId, setMoveId, loadBoxes, isLoaded]);

  // Get unique rooms for filtering
  const rooms = useMemo(() => {
    const uniqueRooms = Array.from(new Set(boxes.map(b => b.destinationRoom)));
    return uniqueRooms.sort();
  }, [boxes]);

  const filteredAndSortedBoxes = useMemo(() => {
    // 1. Sort numerically by box number
    let result = [...boxes].sort((a, b) => a.boxNumber - b.boxNumber);

    // 2. Filter by room
    if (selectedRoom) {
      result = result.filter(box => box.destinationRoom === selectedRoom);
    }

    // 3. Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(box => 
        box.items.some(item => item.toLowerCase().includes(query)) ||
        box.destinationRoom.toLowerCase().includes(query) ||
        box.boxNumber.toString().includes(query)
      );
    }

    return result;
  }, [boxes, searchQuery, selectedRoom]);

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-slate-200 h-10 w-10"></div>
        <div className="flex-1 space-y-6 py-1">
          <div className="h-2 bg-slate-200 rounded"></div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="h-2 bg-slate-200 rounded col-span-2"></div>
              <div className="h-2 bg-slate-200 rounded col-span-1"></div>
            </div>
            <div className="h-2 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Amybox</h1>
            <div className="flex items-center space-x-3 mt-1">
              <p className="text-sm text-gray-500">Moving Inventory</p>
              <div className="h-1 w-1 bg-gray-300 rounded-full" />
              <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                Session: {moveId}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:hidden">
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-slate-600 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm active:scale-95"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Move Settings</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Current Move ID</h4>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-mono text-sm font-bold text-slate-700">{moveId}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(moveId || '');
                      toast.success('Move ID copied!');
                    }}
                    className="text-xs text-indigo-600 font-medium hover:underline"
                  >
                    Copy ID
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Switch Move</h4>
                {isSwitchingMove ? (
                  <div className="space-y-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-xs text-amber-700 font-medium">Enter a different Move ID to switch sessions:</p>
                    <input
                      type="text"
                      placeholder="e.g. move-abc1234"
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      value={targetMoveId}
                      onChange={(e) => setTargetMoveId(e.target.value)}
                    />
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          if (targetMoveId.trim()) {
                            const newId = targetMoveId.trim();
                            setMoveId(newId);
                            loadBoxes(newId);
                            
                            // Update URL
                            const newUrl = new URL(window.location.href);
                            newUrl.searchParams.set('moveId', newId);
                            window.history.pushState({}, '', newUrl);

                            setIsSwitchingMove(false);
                            setIsSettingsModalOpen(false);
                            toast.success('Switched to move: ' + newId);
                          }
                        }}
                        className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                      >
                        Switch Now
                      </button>
                      <button 
                        onClick={() => setIsSwitchingMove(false)}
                        className="px-3 py-2 bg-white text-gray-600 border border-amber-200 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsSwitchingMove(true)}
                    className="w-full py-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors text-left flex items-center"
                  >
                    <Filter className="w-3 h-3 mr-2" />
                    Switch to a different Move ID
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Data Management</h4>
                <button 
                  onClick={handleExportCSV}
                  className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Spreadsheet (CSV)
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Troubleshooting</h4>
                {!envStatus ? (
                  <button 
                    onClick={checkEnv}
                    disabled={isLoadingEnv}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                  >
                    {isLoadingEnv ? 'Checking...' : 'Check Connection Settings'}
                  </button>
                ) : (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Server API Key:</span>
                      <span className={`font-mono font-bold ${envStatus.serverKeyConfigured ? 'text-green-600' : 'text-red-600'}`}>
                        {envStatus.serverKeyConfigured ? `Present (${envStatus.serverKeyPrefix})` : 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Client API Key:</span>
                      <span className={`font-mono font-bold ${envStatus.publicKeyConfigured ? 'text-green-600' : 'text-red-600'}`}>
                        {envStatus.publicKeyConfigured ? `Present (${envStatus.publicKeyPrefix})` : 'Missing'}
                      </span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-slate-200 text-slate-500 italic">
                      If keys are missing, check your Secrets in the editor.
                    </div>
                    <button 
                      onClick={() => setEnvStatus(null)}
                      className="w-full mt-2 py-1 text-indigo-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Create New Move</h4>
                <button 
                  onClick={() => {
                    if (confirm('Are you sure? This will switch you to a completely new, empty move session. Your current move will be saved in history.')) {
                      const newId = `move-${Math.random().toString(36).substring(2, 9)}`;
                      setMoveId(newId);
                      loadBoxes(newId);
                      
                      // Update URL
                      const newUrl = new URL(window.location.href);
                      newUrl.searchParams.set('moveId', newId);
                      window.history.pushState({}, '', newUrl);

                      setIsSettingsModalOpen(false);
                      toast.success('Started new move: ' + newId);
                    }
                  }}
                  className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center"
                >
                  <PackageOpen className="w-4 h-4 mr-2" />
                  Start Fresh Move
                </button>
              </div>
            </div>

            <button 
              onClick={() => setIsSettingsModalOpen(false)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Room Filter Pills */}
      {rooms.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex-shrink-0 p-2 bg-gray-100 rounded-lg text-gray-500">
            <Filter className="w-4 h-4" />
          </div>
          <button
            onClick={() => setSelectedRoom(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedRoom === null 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Rooms
          </button>
          {rooms.map(room => (
            <button
              key={room}
              onClick={() => setSelectedRoom(selectedRoom === room ? null : room)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedRoom === room 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {room}
            </button>
          ))}
        </div>
      )}

      {filteredAndSortedBoxes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <PackageOpen className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No boxes found</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
            {searchQuery || selectedRoom 
              ? "Try adjusting your filters." 
              : `You are currently in Move ID: ${moveId}. If your boxes are missing, you might be in the wrong move session.`}
          </p>
          {!searchQuery && !selectedRoom && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/add" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Scan New Box
              </Link>
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Settings className="w-4 h-4 mr-2" />
                Switch Move ID
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedBoxes.map((box) => (
            <Link href={`/box/${box.id}`} key={box.id} className="group block">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div className="aspect-w-4 aspect-h-3 bg-gray-200 relative h-48">
                  {box.photoUrl ? (
                    <Image 
                      src={box.photoUrl} 
                      alt={`Box ${box.boxNumber}`} 
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <PackageOpen className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-gray-900 shadow-sm">
                    #{box.boxNumber}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{box.destinationRoom}</h3>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {box.items.slice(0, 4).map((item, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                        {item}
                      </span>
                    ))}
                    {box.items.length > 4 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                        +{box.items.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
