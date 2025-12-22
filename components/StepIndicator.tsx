
import React from 'react';
import { AppStep } from '../types';
import { ChevronRight, Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.INPUT_SCRIPT, label: '剧本输入' },
  { id: AppStep.OVERALL_STYLE, label: '整体设定' },
  { id: AppStep.CHARACTERS_SCENES, label: '角色场景' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  return (
    <div className="w-full py-4 md:py-6 bg-white border-b border-slate-200 sticky top-0 z-10 overflow-x-auto">
      <div className="max-w-6xl mx-auto px-4 min-w-max">
        <nav aria-label="Progress">
          <ol role="list" className="flex items-center justify-center">
            {steps.map((step, stepIdx) => (
              <li key={step.label} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-4 sm:pr-20' : ''}`}>
                {step.id < currentStep ? (
                  <div className="group flex items-center w-full">
                    <span className="flex items-center px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium">
                      <span className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 group-hover:bg-indigo-800 transition-colors">
                        <Check className="h-5 w-5 sm:h-6 sm:w-6 text-white" aria-hidden="true" />
                      </span>
                      <span className="ml-3 sm:ml-4 text-sm font-medium text-slate-900">{step.label}</span>
                    </span>
                  </div>
                ) : step.id === currentStep ? (
                  <div className="flex items-center" aria-current="step">
                    <span className="flex items-center px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium">
                      <span className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-indigo-600">
                        <span className="text-indigo-600 font-bold">{step.id + 1}</span>
                      </span>
                      <span className="ml-3 sm:ml-4 text-sm font-medium text-indigo-600">{step.label}</span>
                    </span>
                  </div>
                ) : (
                  <div className="group flex items-center">
                    <span className="flex items-center px-2 sm:px-6 py-2 sm:py-4 text-sm font-medium">
                      <span className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-slate-300 group-hover:border-slate-400">
                        <span className="text-slate-500 group-hover:text-slate-900">{step.id + 1}</span>
                      </span>
                      <span className="ml-3 sm:ml-4 text-sm font-medium text-slate-500 group-hover:text-slate-900">{step.label}</span>
                    </span>
                  </div>
                )}
                {stepIdx !== steps.length - 1 && (
                  <div className="absolute top-0 right-0 hidden h-full w-5 md:block" aria-hidden="true">
                     <ChevronRight className="h-full w-5 text-slate-300" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
};
