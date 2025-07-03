const WebSocket = require('ws');

console.log('WebSocket bağlantısı kuruluyor...');

const ws = new WebSocket('ws://localhost:8001/research_ws');

ws.on('open', function open() {
  console.log('✅ Bağlantı başarılı!');
  
  // Test mesajı gönder
  const testMessage = { topic: "test konusu", model: "test-model" };
  console.log('📤 Mesaj gönderiliyor:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📥 Mesaj alındı:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket hatası:', err);
});

ws.on('close', function close() {
  console.log('🔌 Bağlantı kapatıldı');
  process.exit(0);
});

// 10 saniye sonra kapat
setTimeout(() => {
  console.log('⏰ Timeout - bağlantı kapatılıyor');
  ws.close();
}, 10000); 