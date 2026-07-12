import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'بحث...', className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-stone-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-10"
      />
    </div>
  );
};

export default SearchInput;
