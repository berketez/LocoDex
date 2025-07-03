#!/bin/bash

# LocoDex DMG Test Script
# Modern DMG paketleme iyileştirmelerini test eder

set -e

# Renkler
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🧪 LocoDex Modern DMG Test${NC}\n"

# Dosya kontrolü
echo -e "${BLUE}📁 Dosya kontrolü:${NC}"

if [ -f "assets/icon.icns" ]; then
    echo -e "${GREEN}✅ Icon dosyası mevcut: assets/icon.icns${NC}"
    ls -lh assets/icon.icns
else
    echo -e "${YELLOW}⚠️  Icon dosyası bulunamadı${NC}"
fi

if [ -f "assets/dmg-background.png" ]; then
    echo -e "${GREEN}✅ DMG arka planı mevcut: assets/dmg-background.png${NC}"
    ls -lh assets/dmg-background.png
else
    echo -e "${YELLOW}⚠️  DMG arka planı bulunamadı${NC}"
fi

if [ -f "build/entitlements.mac.plist" ]; then
    echo -e "${GREEN}✅ Entitlements dosyası mevcut${NC}"
else
    echo -e "${YELLOW}⚠️  Entitlements dosyası bulunamadı${NC}"
fi

# Package.json kontrolü
echo -e "\n${BLUE}📦 Package.json kontrolü:${NC}"

if grep -q "hardenedRuntime" package.json; then
    echo -e "${GREEN}✅ Hardened Runtime aktif${NC}"
else
    echo -e "${YELLOW}⚠️  Hardened Runtime bulunamadı${NC}"
fi

if grep -q "Universal" package.json; then
    echo -e "${GREEN}✅ Universal binary desteği${NC}"
else
    echo -e "${YELLOW}⚠️  Universal binary desteği bulunamadı${NC}"
fi

if grep -q "darkModeSupport" package.json; then
    echo -e "${GREEN}✅ Dark mode desteği${NC}"
else
    echo -e "${YELLOW}⚠️  Dark mode desteği bulunamadı${NC}"
fi

# CLI entegrasyonu kontrolü
echo -e "\n${BLUE}💻 CLI entegrasyonu kontrolü:${NC}"

if [ -f "packages/cli/dist/demo.cjs" ]; then
    echo -e "${GREEN}✅ CLI build dosyası mevcut${NC}"
    ls -lh packages/cli/dist/demo.cjs
else
    echo -e "${YELLOW}⚠️  CLI build dosyası bulunamadı${NC}"
fi

# Build script kontrolü
echo -e "\n${BLUE}🔧 Build script kontrolü:${NC}"

if [ -f "build-modern-dmg.sh" ]; then
    echo -e "${GREEN}✅ Modern DMG build script mevcut${NC}"
    if [ -x "build-modern-dmg.sh" ]; then
        echo -e "${GREEN}✅ Script çalıştırılabilir${NC}"
    else
        echo -e "${YELLOW}⚠️  Script çalıştırılabilir değil${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Modern DMG build script bulunamadı${NC}"
fi

# Sistem gereksinimleri
echo -e "\n${BLUE}🖥️  Sistem gereksinimleri:${NC}"

echo -e "${CYAN}Node.js: $(node --version 2>/dev/null || echo 'Bulunamadı')${NC}"
echo -e "${CYAN}NPM: $(npm --version 2>/dev/null || echo 'Bulunamadı')${NC}"
echo -e "${CYAN}Platform: $(uname -s)${NC}"
echo -e "${CYAN}Architecture: $(uname -m)${NC}"

# Öneriler
echo -e "\n${BLUE}💡 Modern DMG Özellikleri:${NC}"
echo -e "   • Universal Binary (Intel + Apple Silicon)"
echo -e "   • Hardened Runtime"
echo -e "   • Dark Mode desteği"
echo -e "   • Modern gradient arka plan"
echo -e "   • CLI entegrasyonu"
echo -e "   • Otomatik code signing hazırlığı"
echo -e "   • Notarization desteği"

echo -e "\n${GREEN}✨ Test tamamlandı!${NC}"
echo -e "${CYAN}DMG oluşturmak için: ./build-modern-dmg.sh${NC}"

