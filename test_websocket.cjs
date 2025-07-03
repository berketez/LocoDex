const WebSocket = require('ws');

console.log('🚀 WebSocket test başlatılıyor...');

const ws = new WebSocket('ws://localhost:8001/research_ws');

ws.on('open', function open() {
  console.log('✅ Bağlantı başarılı!');
  
  // Gerçek model ismi ile test
  const message = { 
    topic: "M4 Max işlemci hakkında bilgi ver", 
    model: "gemma-3-27b-it" 
  };
  
  console.log('📤 Mesaj gönderiliyor:', JSON.stringify(message));
  ws.send(JSON.stringify(message));
});

ws.on('message', function message(data) {
  const parsed = JSON.parse(data.toString());
  console.log('📥 Mesaj alındı:', parsed);
  
  if (parsed.type === 'result') {
    console.log('\n🎉 SONUÇ ALINDI:');
    console.log(parsed.data);
    ws.close();
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket hatası:', err);
});

ws.on('close', function close() {
  console.log('🔌 Bağlantı kapatıldı');
  process.exit(0);
});

// 60 saniye timeout
setTimeout(() => {
  console.log('⏰ 60 saniye timeout - bağlantı kapatılıyor');
  ws.close();
}, 60000); 