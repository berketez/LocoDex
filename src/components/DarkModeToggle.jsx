import React, { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Check for saved theme preference or default to dark mode
    const savedTheme = localStorage.getItem('theme')
    
    
    // Default to dark mode if no preference is saved
    if (savedTheme === 'dark' || (!savedTheme)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
      if (!savedTheme) {
        localStorage.setItem('theme', 'dark')
      }
    } else if (savedTheme === 'light') {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleDarkMode}
      className="w-9 h-9 p-0"
      title={isDark ? 'Light mode\'a geç' : 'Dark mode\'a geç'}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">
        {isDark ? 'Light mode\'a geç' : 'Dark mode\'a geç'}
      </span>
    </Button>
  )
}

export default DarkModeToggle

