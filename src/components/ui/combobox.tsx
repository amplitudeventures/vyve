import React, { useState, useRef, useEffect } from 'react'

type ComboboxWithDropdownProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
}

const ComboboxWithDropdown: React.FC<ComboboxWithDropdownProps> = ({ value, onValueChange, options }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)


  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value)
    setIsDropdownOpen(true)
  }

  const handleSelectOption = (option: string) => {
    onValueChange(option)
    setIsDropdownOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div ref={dropdownRef} className="relative w-[160px]">
      <input
        type="text"
        value={value}
        onChange={handleValueChange}
        className="w-full px-2 py-[7px] border border-gray-700 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter Company name"
        onFocus={() => setIsDropdownOpen(true)}
      />
      {isDropdownOpen && (
        <ul className="absolute mt-1 w-full bg-[#112240] border border-gray-700 rounded-md shadow-lg z-10 text-white text-sm">
          {options
            .filter((option) => option.toLowerCase().includes(value.toLowerCase())) // Filter options based on input
            .map((option, index) => (
              <li
                key={index}
                className="p-1 cursor-pointer hover:bg-[#233554] transition-colors"
                onClick={() => handleSelectOption(option)}
              >
                {option}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export default ComboboxWithDropdown
