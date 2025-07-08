import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx'
import { getHelpMessage } from '@/utils/statusHelpers.js'
import { AlertCircle, HelpCircle, RefreshCw } from 'lucide-react'

const HelpMessage = ({ 
  errorType, 
  onRetry,
  onDismiss,
  className,
  variant = 'default' // 'default', 'card', 'inline'
}) => {
  const helpData = getHelpMessage(errorType)

  if (variant === 'card') {
    return (
      <Card className={`border-orange-200 bg-orange-50 ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <HelpCircle className="h-5 w-5" />
            {helpData.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-orange-600">{helpData.message}</p>
          
          <div className="space-y-2">
            <p className="font-medium text-orange-700">Çözüm önerileri:</p>
            <ul className="list-disc list-inside space-y-1 text-orange-600">
              {helpData.actions.map((action, index) => (
                <li key={index} className="text-sm">{action}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button 
                size="sm" 
                onClick={onRetry}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Tekrar Dene
              </Button>
            )}
            {onDismiss && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onDismiss}
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                Anladım
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`p-3 bg-orange-50 border border-orange-200 rounded-md ${className}`}>
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-700">{helpData.title}</p>
            <p className="text-xs text-orange-600 mt-1">{helpData.message}</p>
            {onRetry && (
              <Button 
                size="xs" 
                onClick={onRetry}
                className="mt-2 bg-orange-600 hover:bg-orange-700 h-6 px-2"
              >
                Tekrar Dene
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default alert variant
  return (
    <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
      <AlertCircle className="h-4 w-4 text-orange-500" />
      <AlertTitle className="text-orange-700">{helpData.title}</AlertTitle>
      <AlertDescription className="text-orange-600 space-y-2">
        <p>{helpData.message}</p>
        <div className="space-y-1">
          <p className="font-medium">Çözüm önerileri:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {helpData.actions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
        {onRetry && (
          <div className="pt-2">
            <Button 
              size="sm" 
              onClick={onRetry}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Tekrar Dene
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}

export default HelpMessage