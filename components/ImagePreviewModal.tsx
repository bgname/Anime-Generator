import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || images.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[210]"
      >
        <X className="w-8 h-8" />
      </button>
      
      {images.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[210] hover:scale-110 active:scale-95"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[210] hover:scale-110 active:scale-95"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div 
        className="relative max-w-full max-h-full flex flex-col items-center justify-center scale-100 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={images[currentIndex]} 
          alt={`Preview ${currentIndex + 1}`} 
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        
        {images.length > 1 && (
             <div className="mt-4 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-medium">
                 {currentIndex + 1} / {images.length}
             </div>
        )}
      </div>
    </div>
  );
};