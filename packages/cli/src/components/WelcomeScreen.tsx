import React from 'react';
import { Box, Text, Newline } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';

export const WelcomeScreen: React.FC = () => {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Gradient name="rainbow">
        <BigText text="LocoDex" />
      </Gradient>
      
      <Text color="gray">AI Destekli Yazılım Mühendisliği Platformu</Text>
      <Newline />
      
      <Box flexDirection="column" alignItems="flex-start">
        <Text color="cyan">🚀 Özellikler:</Text>
        <Text>  • Yerel AI modelleri ile çalışma</Text>
        <Text>  • Kod analizi ve geliştirme</Text>
        <Text>  • İnteraktif terminal arayüzü</Text>
        <Text>  • Ollama ve LM Studio desteği</Text>
        <Newline />
        
        <Text color="cyan">📖 Kullanım:</Text>
        <Text color="green">  locodex --model llama2:7b    </Text>
        <Text color="gray">    Belirli model ile başlat</Text>
        <Text color="green">  locodex --select-model       </Text>
        <Text color="gray">    Model seçim menüsü</Text>
        <Text color="green">  locodex models --list        </Text>
        <Text color="gray">    Mevcut modelleri listele</Text>
        <Text color="green">  locodex chat                 </Text>
        <Text color="gray">    AI ile sohbet başlat</Text>
        <Text color="green">  locodex code --file app.js   </Text>
        <Text color="gray">    Kod analizi yap</Text>
        <Text color="green">  locodex setup                </Text>
        <Text color="gray">    Kurulum ve yapılandırma</Text>
        <Newline />
        
        <Text color="yellow">💡 İpucu: Başlamak için </Text>
        <Text color="green">locodex --select-model</Text>
        <Text color="yellow"> komutunu kullanın</Text>
      </Box>
    </Box>
  );
};

