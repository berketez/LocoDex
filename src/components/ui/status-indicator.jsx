import React from 'react'
import { Badge } from '@/components/ui/badge.jsx'
import { translateStatus, getStatusColor, getStatusIcon } from '@/utils/statusHelpers.js'
import { cn } from '@/lib/utils.js'

const StatusIndicator = ({ 
  status, 
  showIcon = true, 
  showText = true, 
  className,
  size = 'sm',
  pulse = false 
}) => {
  if (!status && status !== 0) {
    status = 'unknown'
  }

  const translatedStatus = translateStatus(status)
  const colorClasses = getStatusColor(status)
  const icon = getStatusIcon(status)
  
  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-3 py-1.5',
    lg: 'text-lg px-4 py-2'
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        colorClasses,
        sizeClasses[size],
        pulse && 'animate-pulse',
        'inline-flex items-center gap-1.5 font-medium',
        className
      )}
    >
      {showIcon && <span className="text-current">{icon}</span>}
      {showText && <span>{translatedStatus}</span>}
    </Badge>
  )
}

export default StatusIndicator