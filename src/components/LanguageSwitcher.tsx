import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="crystal-tile flex items-center rounded-xl p-1">
      <button
        onClick={() => setLanguage('th')}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          language === 'th' 
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm' 
            : 'text-slate-300 hover:text-white'
        }`}
      >
        TH
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          language === 'en' 
            ? 'bg-violet-600 text-white shadow-sm' 
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        EN
      </button>
    </div>
  );
};
