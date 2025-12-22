
import React from 'react';
import { AlertCircle, HelpCircle, Layers } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  type: 'alert' | 'confirm' | 'choice';
  message: string;
  onConfirm?: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
  confirmText?: string;
  secondaryText?: string;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({ 
  isOpen, 
  type, 
  message, 
  onConfirm, 
  onSecondary, 
  onCancel,
  confirmText,
  secondaryText
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
        case 'alert': return <AlertCircle className="w-8 h-8" />;
        case 'confirm': return <HelpCircle className="w-8 h-8" />;
        case 'choice': return <Layers className="w-8 h-8" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
        case 'alert': return 'bg-red-100 text-red-600';
        case 'confirm': return 'bg-amber-100 text-amber-600';
        case 'choice': return 'bg-indigo-100 text-indigo-600';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-100 p-6 scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className={`p-3 rounded-full mb-4 ${getIconBg()}`}>
            {getIcon()}
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {type === 'alert' ? '提示' : type === 'confirm' ? '确认操作' : '已有数据'}
          </h3>
          <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>
          
          <div className="flex flex-col gap-2 w-full">
            {type === 'choice' ? (
                <>
                    <button 
                        onClick={() => onConfirm?.()}
                        className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        {confirmText || '重新提取'}
                    </button>
                    <button 
                        onClick={() => onSecondary?.()}
                        className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        {secondaryText || '继续编辑'}
                    </button>
                    <button 
                        onClick={onCancel}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        取消
                    </button>
                </>
            ) : (
                <div className="flex gap-3 w-full">
                    {type === 'confirm' && (
                        <button 
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                        >
                            取消
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            else onCancel();
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-white transition-colors shadow-sm ${type === 'alert' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        {type === 'alert' ? '知道了' : (confirmText || '确认删除')}
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
