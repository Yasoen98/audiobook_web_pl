'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

type Tab = {
  value: string;
  label: string;
};

export const Tabs = ({ tabs, current, onChange }: { tabs: Tab[]; current: string; onChange: (value: string) => void }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            current === tab.value
              ? 'bg-emerald-500 text-white shadow'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
