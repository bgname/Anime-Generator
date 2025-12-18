import React from 'react';
import { EpisodeInfo } from '../types';
import { Clock, AlignLeft, Lightbulb, Type } from 'lucide-react';

interface EpisodeInfoCardProps {
  info: EpisodeInfo;
  onUpdate: (field: keyof EpisodeInfo, value: string) => void;
}

export const EpisodeInfoCard: React.FC<EpisodeInfoCardProps> = ({ info, onUpdate }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-indigo-600 rounded-full"></span>
        分集基本信息
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
            <Type className="w-4 h-4" /> 分集标题
          </label>
          <input
            type="text"
            value={info.title}
            onChange={(e) => onUpdate('title', e.target.value)}
            className="w-full text-base font-semibold text-slate-900 border-b border-slate-200 focus:border-indigo-500 focus:outline-none py-2"
            placeholder="输入标题..."
          />
        </div>

        {/* Duration */}
        <div className="col-span-1">
          <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
            <Clock className="w-4 h-4" /> 预期时长
          </label>
          <input
            type="text"
            value={info.targetDuration}
            onChange={(e) => onUpdate('targetDuration', e.target.value)}
            className="w-full text-base text-slate-900 border-b border-slate-200 focus:border-indigo-500 focus:outline-none py-2"
            placeholder="例如：15分钟"
          />
        </div>

        {/* Summary */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
            <AlignLeft className="w-4 h-4" /> 剧情梗概
          </label>
          <textarea
            value={info.summary}
            onChange={(e) => onUpdate('summary', e.target.value)}
            rows={2}
            className="w-full text-sm text-slate-700 border border-slate-200 rounded-md p-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            placeholder="本集剧情简述..."
          />
        </div>

        {/* Optimization Suggestions */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-indigo-600 mb-1 flex items-center gap-1">
            <Lightbulb className="w-4 h-4" /> 综合优化建议
          </label>
          <textarea
            value={info.optimizationSuggestions}
            onChange={(e) => onUpdate('optimizationSuggestions', e.target.value)}
            rows={3}
            className="w-full text-sm text-slate-700 bg-indigo-50 border border-indigo-100 rounded-md p-3 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="AI 提供的优化建议..."
          />
        </div>
      </div>
    </div>
  );
};