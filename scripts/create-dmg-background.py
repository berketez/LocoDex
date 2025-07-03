#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LocoDex Modern DMG Background Generator
macOS Sonoma tarzı modern gradient arka plan oluşturur
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import colorsys

def create_modern_gradient(width, height):
    """Modern macOS tarzı gradient oluştur"""
    image = Image.new('RGB', (width, height), '#ffffff')
    draw = ImageDraw.Draw(image)
    
    # Ana gradient (mavi tonları)
    for y in range(height):
        # Yumuşak gradient hesaplama
        ratio = y / height
        
        # Çoklu renk geçişi
        if ratio < 0.3:
            # Üst: açık mavi
            r = int(248 + (240 - 248) * (ratio / 0.3))
            g = int(250 + (248 - 250) * (ratio / 0.3))
            b = int(255 + (255 - 255) * (ratio / 0.3))
        elif ratio < 0.7:
            # Orta: gradient
            local_ratio = (ratio - 0.3) / 0.4
            r = int(240 + (235 - 240) * local_ratio)
            g = int(248 + (245 - 248) * local_ratio)
            b = int(255 + (250 - 255) * local_ratio)
        else:
            # Alt: daha koyu
            local_ratio = (ratio - 0.7) / 0.3
            r = int(235 + (230 - 235) * local_ratio)
            g = int(245 + (240 - 245) * local_ratio)
            b = int(250 + (245 - 250) * local_ratio)
        
        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)
    
    return image

def add_subtle_pattern(image):
    """İnce pattern ekle"""
    width, height = image.size
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # İnce grid pattern
    grid_size = 60
    for x in range(0, width, grid_size):
        draw.line([(x, 0), (x, height)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, height, grid_size):
        draw.line([(0, y), (width, y)], fill=(255, 255, 255, 8), width=1)
    
    # Diagonal pattern
    for i in range(-height, width, 40):
        draw.line([(i, 0), (i + height, height)], fill=(255, 255, 255, 4), width=1)
    
    # Overlay'i ana görüntüye uygula
    image = Image.alpha_composite(image.convert('RGBA'), overlay)
    return image.convert('RGB')

def add_logo_area(image):
    """Logo ve başlık alanı ekle"""
    width, height = image.size
    draw = ImageDraw.Draw(image)
    
    # Ana logo alanı
    logo_area = (30, 30, width - 30, 120)
    
    # Yumuşak arka plan
    logo_bg = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    logo_draw = ImageDraw.Draw(logo_bg)
    
    # Rounded rectangle için çokgen yaklaşımı
    corner_radius = 15
    logo_draw.rounded_rectangle(logo_area, radius=corner_radius, 
                               fill=(255, 255, 255, 200), 
                               outline=(220, 220, 220, 100), width=2)
    
    # Blur efekti
    logo_bg = logo_bg.filter(ImageFilter.GaussianBlur(radius=1))
    
    # Ana görüntüye uygula
    image = Image.alpha_composite(image.convert('RGBA'), logo_bg)
    image = image.convert('RGB')
    draw = ImageDraw.Draw(image)
    
    # Metin ekle
    try:
        # macOS sistem fontunu dene
        title_font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Display-Bold.otf', 32)
        subtitle_font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Text-Regular.otf', 16)
    except:
        try:
            # Helvetica alternatifi
            title_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 32)
            subtitle_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
        except:
            # Varsayılan font
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
    
    # Başlık
    title_text = "LocoDex"
    title_color = (44, 62, 80)  # Koyu gri-mavi
    draw.text((50, 55), title_text, font=title_font, fill=title_color)
    
    # Alt başlık
    subtitle_text = "AI Destekli Yazılım Mühendisliği Platformu"
    subtitle_color = (127, 140, 141)  # Açık gri
    draw.text((50, 90), subtitle_text, font=subtitle_font, fill=subtitle_color)
    
    return image

def add_installation_guide(image):
    """Kurulum rehberi ekle"""
    width, height = image.size
    draw = ImageDraw.Draw(image)
    
    # Alt kısımda rehber alanı
    guide_area = (30, height - 80, width - 30, height - 20)
    
    # Arka plan
    guide_bg = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    guide_draw = ImageDraw.Draw(guide_bg)
    
    guide_draw.rounded_rectangle(guide_area, radius=10, 
                                fill=(52, 152, 219, 40), 
                                outline=(52, 152, 219, 80), width=1)
    
    image = Image.alpha_composite(image.convert('RGBA'), guide_bg)
    image = image.convert('RGB')
    draw = ImageDraw.Draw(image)
    
    # Rehber metni
    try:
        guide_font = ImageFont.truetype('/System/Library/Fonts/SF-Pro-Text-Medium.otf', 14)
    except:
        try:
            guide_font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
        except:
            guide_font = ImageFont.load_default()
    
    guide_text = "← LocoDex.app dosyasını Applications klasörüne sürükleyerek kurulumu tamamlayın"
    guide_color = (41, 128, 185)
    draw.text((40, height - 55), guide_text, font=guide_font, fill=guide_color)
    
    return image

def add_modern_effects(image):
    """Modern görsel efektler ekle"""
    width, height = image.size
    
    # Subtle vignette efekti
    vignette = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    vignette_draw = ImageDraw.Draw(vignette)
    
    # Köşelerden merkeze doğru hafif karartma
    for i in range(50):
        alpha = int(i * 0.5)
        vignette_draw.rectangle([(i, i), (width-i, height-i)], 
                               outline=(0, 0, 0, alpha), width=1)
    
    # Vignette'i uygula
    image = Image.alpha_composite(image.convert('RGBA'), vignette)
    
    return image.convert('RGB')

def create_dmg_background(width=540, height=380, output_path='assets/dmg-background.png'):
    """Ana DMG arka plan oluşturma fonksiyonu"""
    print(f"🎨 Modern DMG arka planı oluşturuluyor ({width}x{height})...")
    
    # Assets klasörünü oluştur
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Ana gradient oluştur
    image = create_modern_gradient(width, height)
    
    # Pattern ekle
    image = add_subtle_pattern(image)
    
    # Logo alanı ekle
    image = add_logo_area(image)
    
    # Kurulum rehberi ekle
    image = add_installation_guide(image)
    
    # Modern efektler ekle
    image = add_modern_effects(image)
    
    # Kaydet
    image.save(output_path, 'PNG', quality=95, optimize=True)
    
    print(f"✅ Modern DMG arka planı oluşturuldu: {output_path}")
    return output_path

if __name__ == "__main__":
    # Komut satırı argümanları
    if len(sys.argv) > 1:
        output_path = sys.argv[1]
    else:
        output_path = 'assets/dmg-background.png'
    
    try:
        create_dmg_background(output_path=output_path)
        print("🎉 İşlem tamamlandı!")
    except Exception as e:
        print(f"❌ Hata: {e}")
        sys.exit(1)

