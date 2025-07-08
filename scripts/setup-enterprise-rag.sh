#!/bin/bash

echo "🏢 LocoDex Kurumsal RAG Sistemi Kurulumu"
echo "======================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 bulunamadı. Lütfen Python 3.8+ kurun."
    exit 1
fi

# Check Python version
python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $python_version bulundu"

# Create virtual environment
echo "🔧 Sanal ortam oluşturuluyor..."
cd "$(dirname "$0")/../src/services/enterprise_rag_service"
python3 -m venv rag_env

# Activate virtual environment
source rag_env/bin/activate

# Upgrade pip
echo "📦 pip güncelleniyor..."
pip install --upgrade pip

# Install requirements
echo "📚 Gerekli paketler kuruluyor..."
pip install -r requirements.txt

# Download NLTK data
echo "📖 NLTK verileri indiriliyor..."
python3 -c "
import nltk
nltk.download('punkt')
nltk.download('stopwords')
print('NLTK verileri indirildi')
"

# Test installation
echo "🧪 Kurulum test ediliyor..."
python3 -c "
from document_processor import EnterpriseDocumentProcessor
processor = EnterpriseDocumentProcessor()
print('✅ Kurulum başarılı!')
print(f'📊 Veritabanı: {processor.db_path}')
stats = processor.get_document_stats()
print(f'📚 Toplam belge: {stats[\"total_documents\"]}')
"

echo ""
echo "🎉 Kurumsal RAG Sistemi başarıyla kuruldu!"
echo ""
echo "📋 Kullanım:"
echo "   npm run cli documents    # Belge yönetimi CLI"
echo "   npm run dev              # Web arayüzü"
echo ""
echo "💡 Örnekler:"
echo "   • PDF, Word, Excel dosyalarını yükleyin"
echo "   • 'Son çeyrek finansal raporuna göre en kârlı ürün hangisi?' sorun"
echo "   • 'Yeni çalışan oryantasyon süreci' hakkında bilgi alın"
echo ""
echo "🔧 Sanal ortamı aktifleştirmek için:"
echo "   cd src/services/enterprise_rag_service && source rag_env/bin/activate"