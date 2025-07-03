import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';

interface ChatInterfaceProps {
  model: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ model }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (model) {
      // Model yükleme simülasyonu
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsReady(true);
        setMessages([{
          role: 'assistant',
          content: `Merhaba! ${model} modeli ile çalışıyorum. Size nasıl yardımcı olabilirim?`,
          timestamp: new Date()
        }]);
      }, 2000);
    }
  }, [model]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // AI yanıt simülasyonu
    setTimeout(() => {
      const assistantMessage: Message = {
        role: 'assistant',
        content: `Bu bir simüle edilmiş yanıt. Gerçek uygulamada ${model} modeli kullanılarak "${query}" sorusuna yanıt verilecek.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  if (!model) {
    return (
      <Box paddingY={1}>
        <Text color="yellow">⚠️  Önce bir model seçmeniz gerekiyor.</Text>
      </Box>
    );
  }

  if (!isReady) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box>
          <Spinner type="dots" />
          <Text> {model} modeli yükleniyor...</Text>
        </Box>
        <Text color="gray">Bu işlem birkaç saniye sürebilir...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Mesaj geçmişi */}
      <Box flexDirection="column" flexGrow={1} paddingBottom={1}>
        {messages.map((message, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text color={message.role === 'user' ? 'cyan' : 'green'}>
              {message.role === 'user' ? '👤 Sen' : '🤖 LocoDex'}:
            </Text>
            <Text>{message.content}</Text>
            {index < messages.length - 1 && <Newline />}
          </Box>
        ))}
        
        {isLoading && (
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text color="gray"> Düşünüyor...</Text>
          </Box>
        )}
      </Box>

      {/* Giriş alanı */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <Text color="cyan">💬 Mesajınızı yazın (Enter ile gönder, Ctrl+C ile çık):</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Sorunuzu buraya yazın..."
        />
      </Box>
    </Box>
  );
};

